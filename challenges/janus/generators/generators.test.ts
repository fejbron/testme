import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createRootSeed, createSeedContext, type SeedContext } from "../../../src/lib/seed";
import { generators, type GenOutput } from "./index";

const FIXED_SEED = Buffer.alloc(32, 0x4a); // 'J' repeated - fixed for determinism tests
const SALT = "janus-v1";

function buildCtx(rootSeed: Buffer, salt: string, stageLabel: string): SeedContext {
  return createSeedContext(rootSeed, salt).namespace(`campaign:janus`).namespace(`stage:${stageLabel}`);
}

/** Collects files written by a generator into a plain map for inspection. */
function collectingOutput(): { out: GenOutput; files: Map<string, Buffer> } {
  const files = new Map<string, Buffer>();
  return {
    out: {
      file(path, content) {
        files.set(path, content);
      },
    },
    files,
  };
}

const GENERATOR_STAGES: Record<keyof typeof generators, string> = {
  filesystem: "first-light",
  pcap: "silent-relay",
  gitrepo: "the-archive",
  cservice: "out-of-order",
  config: "residual-state",
};

describe("generator determinism", () => {
  for (const [name, generator] of Object.entries(generators)) {
    it(`${name}: same seed -> identical file bytes and sha256`, () => {
      const stage = GENERATOR_STAGES[name as keyof typeof generators];

      const ctxA = buildCtx(FIXED_SEED, SALT, stage);
      const { out: outA, files: filesA } = collectingOutput();
      const manifestA = generator(ctxA, outA);

      const ctxB = buildCtx(FIXED_SEED, SALT, stage);
      const { out: outB, files: filesB } = collectingOutput();
      const manifestB = generator(ctxB, outB);

      expect(manifestA.files.length).toBeGreaterThan(0);
      expect(manifestA.files).toEqual(manifestB.files);
      expect(manifestA.expected).toEqual(manifestB.expected);

      for (const { path, sha256 } of manifestA.files) {
        const bufA = filesA.get(path);
        const bufB = filesB.get(path);
        expect(bufA).toBeDefined();
        expect(bufB).toBeDefined();
        expect(bufA?.equals(bufB as Buffer)).toBe(true);
        expect(sha256).toBe(createHash("sha256").update(bufA as Buffer).digest("hex"));
      }
    });

    it(`${name}: different seed -> different marker/fragment expected values`, () => {
      const stage = GENERATOR_STAGES[name as keyof typeof generators];
      const seedA = createRootSeed();
      const seedB = createRootSeed();

      const ctxA = buildCtx(seedA, SALT, stage);
      const { out: outA } = collectingOutput();
      const manifestA = generator(ctxA, outA);

      const ctxB = buildCtx(seedB, SALT, stage);
      const { out: outB } = collectingOutput();
      const manifestB = generator(ctxB, outB);

      // At least one expected value (the seed-derived answer) must differ.
      const keys = new Set([...Object.keys(manifestA.expected), ...Object.keys(manifestB.expected)]);
      let sawDifference = false;
      for (const key of keys) {
        if (manifestA.expected[key] !== manifestB.expected[key]) {
          sawDifference = true;
          break;
        }
      }
      expect(sawDifference).toBe(true);
    });
  }
});

describe("filesystem generator", () => {
  it("embeds exactly one true marker line distinct from decoys", () => {
    const ctx = buildCtx(FIXED_SEED, SALT, "first-light");
    const { out, files } = collectingOutput();
    const manifest = generators.filesystem(ctx, out);

    const log = files.get("filesystem/var/log/app/service.log");
    expect(log).toBeDefined();
    const text = (log as Buffer).toString("utf8");
    const occurrences = text.split(manifest.expected.marker as string).length - 1;
    expect(occurrences).toBe(1);
    expect(manifest.expected.marker).toMatch(/^MARKER-[0-9a-f]{8}$/);
  });
});

describe("pcap generator", () => {
  it("produces a valid pcap global header and a matching record count", () => {
    const ctx = buildCtx(FIXED_SEED, SALT, "silent-relay");
    const { out, files } = collectingOutput();
    const manifest = generators.pcap(ctx, out);

    const buf = files.get("pcap/capture.pcap");
    expect(buf).toBeDefined();
    const data = buf as Buffer;

    expect(data.readUInt32LE(0)).toBe(0xa1b2c3d4);
    expect(data.readUInt16LE(4)).toBe(2); // version major
    expect(data.readUInt16LE(6)).toBe(4); // version minor
    expect(data.readUInt32LE(16)).toBe(65535); // snaplen
    expect(data.readUInt32LE(20)).toBe(147); // linktype USER0

    let offset = 24;
    let recordCount = 0;
    while (offset < data.length) {
      const inclLen = data.readUInt32LE(offset + 8);
      offset += 16 + inclLen;
      recordCount++;
    }

    expect(offset).toBe(data.length);
    expect(String(recordCount)).toBe(manifest.expected.recordCount);
  });

  it("frame layout in `expected` correctly decodes every record", () => {
    const ctx = buildCtx(FIXED_SEED, SALT, "silent-relay");
    const { out, files } = collectingOutput();
    const manifest = generators.pcap(ctx, out);
    const data = files.get("pcap/capture.pcap") as Buffer;

    const lengthFieldWidth = Number(manifest.expected.lengthFieldWidth);
    const lengthFieldEndian = manifest.expected.lengthFieldEndian;
    const checksumOffset = Number(manifest.expected.checksumOffset);
    const checksumKind = manifest.expected.checksumKind;

    let offset = 24;
    let parsedRecords = 0;
    while (offset < data.length) {
      const inclLen = data.readUInt32LE(offset + 8);
      const frame = data.subarray(offset + 16, offset + 16 + inclLen);

      const declaredLen =
        lengthFieldWidth === 2
          ? lengthFieldEndian === "LE"
            ? frame.readUInt16LE(0)
            : frame.readUInt16BE(0)
          : lengthFieldEndian === "LE"
            ? frame.readUInt32LE(0)
            : frame.readUInt32BE(0);
      const body = frame.subarray(lengthFieldWidth);
      expect(declaredLen).toBe(body.length);

      if (checksumKind === "xor8") {
        let acc = 0;
        for (let b = 0; b < body.length; b++) if (b !== checksumOffset) acc ^= body[b] as number;
        expect(body[checksumOffset]).toBe(acc);
      } else if (checksumKind === "sum8") {
        let acc = 0;
        for (let b = 0; b < body.length; b++) if (b !== checksumOffset) acc = (acc + (body[b] as number)) & 0xff;
        expect(body[checksumOffset]).toBe(acc);
      }

      offset += 16 + inclLen;
      parsedRecords++;
    }

    expect(String(parsedRecords)).toBe(manifest.expected.recordCount);
  });
});

describe("gitrepo generator", () => {
  it("hides the fragment from HEAD but keeps it in a reverted commit", () => {
    const ctx = buildCtx(FIXED_SEED, SALT, "the-archive");
    const { out, files } = collectingOutput();
    const manifest = generators.gitrepo(ctx, out);

    const historyBuf = files.get("gitrepo/history.json") as Buffer;
    const history = JSON.parse(historyBuf.toString("utf8")) as {
      head: string;
      commits: { hash: string; message: string; files: Record<string, string> }[];
    };

    const fragment = manifest.expected.archiveFragment as string;
    expect(fragment).toMatch(/^ARCHIVE-FRAGMENT-[0-9a-f]{10}$/);

    const worktreeSecret = files.get("gitrepo/worktree/config/staging.env") as Buffer;
    expect(worktreeSecret.toString("utf8")).not.toContain(fragment);

    const revertedCommit = history.commits.find((c) => c.hash === manifest.expected.revertedCommit);
    expect(revertedCommit).toBeDefined();
    const secretPath = manifest.expected.secretPath as string;
    expect(revertedCommit?.files[secretPath]).toContain(fragment);
  });
});

describe("cservice generator", () => {
  it("emits C source containing the declared buffer size and function name", () => {
    const ctx = buildCtx(FIXED_SEED, SALT, "out-of-order");
    const { out, files } = collectingOutput();
    const manifest = generators.cservice(ctx, out);

    const source = (files.get("cservice/src/service.c") as Buffer).toString("utf8");
    expect(source).toContain(`#define BUFFER_SIZE ${manifest.expected.bufferSize}`);
    expect(source).toContain(`int ${manifest.expected.bugFunction}(`);
    // The bug is present but never annotated/labelled as such in the source.
    expect(source.toLowerCase()).not.toContain("bug");
  });
});

describe("config generator", () => {
  it("round-trips via the reused-nonce keystream to reveal the plaintext marker", () => {
    const ctx = buildCtx(FIXED_SEED, SALT, "residual-state");
    const { out, files } = collectingOutput();
    const manifest = generators.config(ctx, out);

    const referencePlaintext = files.get("config/reference-plaintext.json") as Buffer;
    const referenceCipherFile = files.get("config/reference.cfg") as Buffer;
    const targetCipherFile = files.get("config/target.cfg") as Buffer;

    const marker = Buffer.from("---\n", "utf8");
    const refBodyStart = referenceCipherFile.indexOf(marker) + marker.length;
    const targetBodyStart = targetCipherFile.indexOf(marker) + marker.length;

    const refCipherBody = referenceCipherFile.subarray(refBodyStart);
    const targetCipherBody = targetCipherFile.subarray(targetBodyStart);

    // Nonce reuse: both bodies were XORed with the *same* keystream, and one
    // plaintext (the reference) is known, so the keystream is recoverable
    // without ever knowing the key.
    const len = Math.min(referencePlaintext.length, refCipherBody.length, targetCipherBody.length);
    const keystream = Buffer.alloc(len);
    for (let i = 0; i < len; i++) {
      keystream[i] = (referencePlaintext[i] as number) ^ (refCipherBody[i] as number);
    }

    const recoveredTarget = Buffer.alloc(len);
    for (let i = 0; i < len; i++) {
      recoveredTarget[i] = (targetCipherBody[i] as number) ^ (keystream[i] as number);
    }

    const recoveredText = recoveredTarget.toString("utf8");
    expect(recoveredText).toContain(manifest.expected.plaintextMarker as string);

    // Also confirm both artifacts really do declare the same (reused) nonce.
    const refHeaderText = referenceCipherFile.subarray(0, refBodyStart).toString("utf8");
    const targetHeaderText = targetCipherFile.subarray(0, targetBodyStart).toString("utf8");
    expect(refHeaderText).toContain(`nonce=${manifest.expected.nonce}`);
    expect(targetHeaderText).toContain(`nonce=${manifest.expected.nonce}`);
  });
});
