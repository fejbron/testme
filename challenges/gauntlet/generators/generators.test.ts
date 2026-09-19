import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createRootSeed, createSeedContext } from "../../../src/lib/seed";
import { generators, type GenOutput } from "./index";

const FIXED_SEED = Buffer.alloc(32, 0x47); // 'G' repeated - fixed for determinism tests
const SALT = "gauntlet-v1";

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

describe("generator determinism", () => {
  for (const [name, generator] of Object.entries(generators)) {
    it(`${name}: same seed -> identical file bytes and sha256`, () => {
      const ctxA = createSeedContext(FIXED_SEED, SALT);
      const { out: outA, files: filesA } = collectingOutput();
      const manifestA = generator(ctxA, outA);

      const ctxB = createSeedContext(FIXED_SEED, SALT);
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

    it(`${name}: different seed -> different seed-derived expected values`, () => {
      const seedA = createRootSeed();
      const seedB = createRootSeed();

      const ctxA = createSeedContext(seedA, SALT);
      const { out: outA } = collectingOutput();
      const manifestA = generator(ctxA, outA);

      const ctxB = createSeedContext(seedB, SALT);
      const { out: outB } = collectingOutput();
      const manifestB = generator(ctxB, outB);

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

// ---------------------------------------------------------------------------
// cipherchain correctness: hex -> base64 -> un-rot recovers marker
// ---------------------------------------------------------------------------

function caesarUnshift(input: string, shift: number): string {
  let result = "";
  for (const ch of input) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      result += String.fromCharCode((((code - 65 - shift) % 26) + 26) % 26 + 65);
    } else if (code >= 97 && code <= 122) {
      result += String.fromCharCode((((code - 97 - shift) % 26) + 26) % 26 + 97);
    } else {
      result += ch;
    }
  }
  return result;
}

describe("cipherchain generator", () => {
  it("reversing hex -> base64 -> un-rot recovers the marker", () => {
    const ctx = createSeedContext(FIXED_SEED, SALT);
    const { out, files } = collectingOutput();
    const manifest = generators.cipherchain?.(ctx, out) as ReturnType<NonNullable<typeof generators.cipherchain>>;

    const blob = (files.get("cipherchain/blob.txt") as Buffer).toString("utf8");
    const hexLine = blob.trim().split("\n").pop() as string;

    const layer2 = Buffer.from(hexLine, "hex").toString("utf8");
    const layer1 = Buffer.from(layer2, "base64").toString("utf8");
    const shift = Number(manifest.expected.shift);
    const recovered = caesarUnshift(layer1, shift);

    expect(recovered).toBe(manifest.expected.marker);
    expect(manifest.expected.marker).toMatch(/^GAUNTLET-[0-9a-f]{8}$/);
  });
});

// ---------------------------------------------------------------------------
// vault correctness: crib XOR cipher recovers key, key recovers token
// ---------------------------------------------------------------------------

describe("vault generator", () => {
  it("crib recovers the key, and the key recovers the token", () => {
    const ctx = createSeedContext(FIXED_SEED, SALT);
    const { out, files } = collectingOutput();
    const manifest = generators.vault?.(ctx, out) as ReturnType<NonNullable<typeof generators.vault>>;

    const cipher = files.get("vault/cipher.bin") as Buffer;
    const crib = files.get("vault/crib.txt") as Buffer;
    const keyLen = Number(manifest.expected.keyLen);

    expect(crib.length).toBeGreaterThanOrEqual(keyLen);

    const recoveredKey = Buffer.alloc(keyLen);
    for (let i = 0; i < keyLen; i++) {
      recoveredKey[i] = (crib[i] as number) ^ (cipher[i] as number);
    }
    expect(recoveredKey.toString("hex")).toBe(manifest.expected.keyHex);

    const plaintext = Buffer.alloc(cipher.length);
    for (let i = 0; i < cipher.length; i++) {
      plaintext[i] = (cipher[i] as number) ^ (recoveredKey[i % keyLen] as number);
    }
    const parsed = JSON.parse(plaintext.toString("utf8")) as { service: string; token: string };
    expect(parsed.service).toBe("vault");
    expect(parsed.token).toBe(manifest.expected.token);
    expect(manifest.expected.token).toMatch(/^VAULT-[0-9a-f]{12}$/);
  });
});

// ---------------------------------------------------------------------------
// stego correctness: extracting LSBs at bitOffset recovers the marker
// ---------------------------------------------------------------------------

describe("stego generator", () => {
  it("extracting LSBs at bitOffset recovers the marker", () => {
    const ctx = createSeedContext(FIXED_SEED, SALT);
    const { out, files } = collectingOutput();
    const manifest = generators.stego?.(ctx, out) as ReturnType<NonNullable<typeof generators.stego>>;

    const ppm = files.get("stego/image.ppm") as Buffer;
    const width = Number(manifest.expected.width);
    const height = Number(manifest.expected.height);

    // Parse the P6 header to find where pixel data begins.
    expect(ppm.subarray(0, 2).toString("ascii")).toBe("P6");
    const headerText = `P6\n${width} ${height}\n255\n`;
    const headerLen = Buffer.byteLength(headerText, "ascii");
    expect(ppm.subarray(0, headerLen).toString("ascii")).toBe(headerText);

    const pixelData = ppm.subarray(headerLen);
    expect(pixelData.length).toBe(width * height * 3);

    const bitOffset = Number(manifest.expected.bitOffset);
    const markerLen = manifest.expected.marker.length;
    let cursor = bitOffset;
    let recovered = "";
    for (let c = 0; c < markerLen; c++) {
      let code = 0;
      for (let b = 0; b < 8; b++) {
        const bit = (pixelData[cursor] as number) & 1;
        code = (code << 1) | bit;
        cursor++;
      }
      recovered += String.fromCharCode(code);
    }

    expect(recovered).toBe(manifest.expected.marker);
    expect(manifest.expected.marker).toMatch(/^SEEN-[0-9a-f]{8}$/);
  });
});

// ---------------------------------------------------------------------------
// ledger correctness: target block holds token, chain hashes verify
// ---------------------------------------------------------------------------

interface LedgerBlock {
  index: number;
  prevHash: string;
  data: string;
  hash: string;
}

describe("ledger generator", () => {
  it("target block contains the token, not last, and the chain verifies", () => {
    const ctx = createSeedContext(FIXED_SEED, SALT);
    const { out, files } = collectingOutput();
    const manifest = generators.ledger?.(ctx, out) as ReturnType<NonNullable<typeof generators.ledger>>;

    const chain = JSON.parse((files.get("ledger/chain.json") as Buffer).toString("utf8")) as LedgerBlock[];
    const targetIndex = Number(manifest.expected.targetIndex);

    expect(targetIndex).toBeLessThan(chain.length - 1);
    expect(chain[0]?.prevHash).toBe("0".repeat(64));

    let prevHash = "0".repeat(64);
    for (const block of chain) {
      const expectedHash = createHash("sha256")
        .update(`${block.index}|${block.prevHash}|${block.data}`)
        .digest("hex");
      expect(block.prevHash).toBe(prevHash);
      expect(block.hash).toBe(expectedHash);
      prevHash = block.hash;
    }
    expect(prevHash).toBe(manifest.expected.tipHash);

    const targetBlock = chain[targetIndex] as LedgerBlock;
    expect(targetBlock.data).toContain(`TOKEN=${manifest.expected.token}`);
    expect(manifest.expected.token).toMatch(/^LEDGER-[0-9a-f]{10}$/);
  });
});

// ---------------------------------------------------------------------------
// stackvm correctness: simulating example.prog yields example.out
// ---------------------------------------------------------------------------

function simulate(program: string): string {
  const stack: number[] = [];
  let output = "";
  for (const rawLine of program.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const [opRaw, argRaw] = line.split(" ");
    const op = opRaw as string;
    if (op === "PUSH") {
      stack.push(Number(argRaw));
    } else if (op === "ADD") {
      const b = stack.pop() as number;
      const a = stack.pop() as number;
      stack.push(a + b);
    } else if (op === "SUB") {
      const b = stack.pop() as number;
      const a = stack.pop() as number;
      stack.push(a - b);
    } else if (op === "MUL") {
      const b = stack.pop() as number;
      const a = stack.pop() as number;
      stack.push(a * b);
    } else if (op === "DUP") {
      stack.push(stack[stack.length - 1] as number);
    } else if (op === "SWAP") {
      const a = stack.pop() as number;
      const b = stack.pop() as number;
      stack.push(a);
      stack.push(b);
    } else if (op === "PRINT") {
      output += `${stack.pop() as number}\n`;
    } else {
      throw new Error(`unknown opcode: ${op}`);
    }
  }
  return output;
}

describe("stackvm generator", () => {
  it("simulating example.prog yields example.out", () => {
    const ctx = createSeedContext(FIXED_SEED, SALT);
    const { out, files } = collectingOutput();
    const manifest = generators.stackvm?.(ctx, out) as ReturnType<NonNullable<typeof generators.stackvm>>;

    const prog = (files.get("stackvm/example.prog") as Buffer).toString("utf8");
    const expectedOut = (files.get("stackvm/example.out") as Buffer).toString("utf8");
    const isa = (files.get("stackvm/ISA.md") as Buffer).toString("utf8");

    expect(isa).toContain("PUSH");
    expect(isa).toContain("PRINT");
    expect(prog.trim().split("\n").pop()).toBe("PRINT");

    const simulated = simulate(prog);
    expect(simulated).toBe(expectedOut);
    expect(simulated).toBe(manifest.expected.sampleOutput);

    expect(manifest.expected.sampleSha256).toBe(
      createHash("sha256").update(Buffer.from(prog, "utf8")).digest("hex"),
    );
  });
});

// ---------------------------------------------------------------------------
// injection correctness: the flagged line parses to payload + secret
// ---------------------------------------------------------------------------

describe("injection generator", () => {
  it("exactly one line carries the injection, matching expected payload/secret/lineNumber", () => {
    const ctx = createSeedContext(FIXED_SEED, SALT);
    const { out, files } = collectingOutput();
    const manifest = generators.injection?.(ctx, out) as ReturnType<NonNullable<typeof generators.injection>>;

    const log = (files.get("injection/access.log") as Buffer).toString("utf8");
    const lines = log.split("\n").filter((l) => l.length > 0);

    const flaggedLines = lines.filter((l) => l.includes("OR 1=1"));
    expect(flaggedLines.length).toBe(1);

    const lineNumber = Number(manifest.expected.lineNumber);
    expect(lines[lineNumber - 1]).toBe(flaggedLines[0]);

    const flagged = flaggedLines[0] as string;
    const idMatch = /id=(.+?)" -> leaked=(.+)$/.exec(flagged);
    expect(idMatch).not.toBeNull();
    const [, payload, secret] = idMatch as RegExpExecArray;

    expect(payload).toBe(manifest.expected.payload);
    expect(secret).toBe(manifest.expected.secret);
    expect(manifest.expected.param).toBe("id");
    expect(manifest.expected.secret).toMatch(/^SECRET-[0-9a-f]{12}$/);
  });
});
