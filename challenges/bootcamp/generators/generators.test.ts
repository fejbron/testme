import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createRootSeed, createSeedContext } from "../../../src/lib/seed";
import { generators, type GenOutput } from "./index";

const FIXED_SEED = Buffer.alloc(32, 0x42); // 'B' repeated - fixed for determinism tests
const SALT = "bootcamp-v1";

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

/** ROT13 is its own inverse: rotating a rotated string recovers the original. */
function rot13(input: string): string {
  return input.replace(/[a-zA-Z]/g, (ch) => {
    const base = ch <= "Z" ? 65 : 97;
    return String.fromCharCode(((ch.charCodeAt(0) - base + 13) % 26) + base);
  });
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

    it(`${name}: different seed -> different expected values`, () => {
      const seedA = createRootSeed();
      const seedB = createRootSeed();

      const ctxA = createSeedContext(seedA, SALT);
      const { out: outA } = collectingOutput();
      const manifestA = generator(ctxA, outA);

      const ctxB = createSeedContext(seedB, SALT);
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

describe("welcome generator", () => {
  it("base64-decodes to reveal the token", () => {
    const ctx = createSeedContext(FIXED_SEED, SALT);
    const { out, files } = collectingOutput();
    const manifest = generators.welcome(ctx, out);

    const content = (files.get("welcome/message.txt") as Buffer).toString("utf8");
    const lines = content.split("\n");
    expect(lines[0]).toBe("decode me:");

    const decoded = Buffer.from(lines[1] as string, "base64").toString("utf8");
    expect(decoded).toContain(manifest.expected.token as string);
    expect(manifest.expected.token).toMatch(/^BC1-[0-9a-f]{8}$/);
  });
});

describe("rotate generator", () => {
  it("un-rot13 recovers the token", () => {
    const ctx = createSeedContext(FIXED_SEED, SALT);
    const { out, files } = collectingOutput();
    const manifest = generators.rotate(ctx, out);

    const content = (files.get("rotate/note.txt") as Buffer).toString("utf8").trim();
    const decoded = rot13(content);
    expect(decoded).toContain(manifest.expected.token as string);
    expect(manifest.expected.token).toMatch(/^BC2-[0-9a-f]{8}$/);
  });
});

describe("hexdump generator", () => {
  it("hex-decodes to reveal the token", () => {
    const ctx = createSeedContext(FIXED_SEED, SALT);
    const { out, files } = collectingOutput();
    const manifest = generators.hexdump(ctx, out);

    const content = (files.get("hexdump/data.hex") as Buffer).toString("utf8").trim();
    expect(content).toMatch(/^[0-9a-f]+$/);
    const decoded = Buffer.from(content, "hex").toString("utf8");
    expect(decoded).toContain(manifest.expected.token as string);
    expect(manifest.expected.token).toMatch(/^BC3-[0-9a-f]{8}$/);
  });
});

describe("tally generator", () => {
  it("numbers sum to the expected total", () => {
    const ctx = createSeedContext(FIXED_SEED, SALT);
    const { out, files } = collectingOutput();
    const manifest = generators.tally(ctx, out);

    const content = (files.get("tally/numbers.txt") as Buffer).toString("utf8").trim();
    const numbers = content.split("\n").map((line) => Number(line));
    expect(numbers).toHaveLength(Number(manifest.expected.count));
    for (const n of numbers) {
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(999);
    }

    const sum = numbers.reduce((a, b) => a + b, 0);
    expect(String(sum)).toBe(manifest.expected.sum);
  });
});

describe("needle generator", () => {
  it("exactly one line carries the SECRET token, at the expected line number", () => {
    const ctx = createSeedContext(FIXED_SEED, SALT);
    const { out, files } = collectingOutput();
    const manifest = generators.needle(ctx, out);

    const content = (files.get("needle/haystack.log") as Buffer).toString("utf8");
    const lines = content.split("\n").filter((line) => line.length > 0);
    const token = manifest.expected.token as string;

    const matches = lines.filter((line) => line.includes(`SECRET=${token}`));
    expect(matches).toHaveLength(1);

    const lineNumber = Number(manifest.expected.line);
    expect(lines[lineNumber - 1]).toContain(`SECRET=${token}`);
    expect(manifest.expected.token).toMatch(/^BC5-[0-9a-f]{8}$/);
  });
});

describe("binary generator", () => {
  it("binary groups decode to the token", () => {
    const ctx = createSeedContext(FIXED_SEED, SALT);
    const { out, files } = collectingOutput();
    const manifest = generators.binary(ctx, out);

    const content = (files.get("binary/bits.txt") as Buffer).toString("utf8").trim();
    const groups = content.split(" ");
    expect(groups.every((g) => /^[01]{8}$/.test(g))).toBe(true);

    const decoded = groups.map((g) => String.fromCharCode(Number.parseInt(g, 2))).join("");
    expect(decoded).toBe(manifest.expected.token as string);
    expect(manifest.expected.token).toMatch(/^BC6-[0-9a-f]{8}$/);
  });
});
