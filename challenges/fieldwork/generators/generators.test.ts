import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createRootSeed, createSeedContext, type SeedContext } from "../../../src/lib/seed";
import { generators, type GenOutput } from "./index";

const FIXED_SEED = Buffer.alloc(32, 0x46); // 'F' repeated - fixed for determinism tests
const SALT = "fieldwork-v1";

function buildCtx(rootSeed: Buffer, salt: string): SeedContext {
  return createSeedContext(rootSeed, salt).namespace("campaign:fieldwork");
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

describe("generator determinism", () => {
  for (const [name, generator] of Object.entries(generators)) {
    it(`${name}: same seed -> identical file bytes and sha256`, () => {
      const ctxA = buildCtx(FIXED_SEED, SALT);
      const { out: outA, files: filesA } = collectingOutput();
      const manifestA = generator(ctxA, outA);

      const ctxB = buildCtx(FIXED_SEED, SALT);
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

    it(`${name}: different seed -> different token/claim/ip`, () => {
      const seedA = createRootSeed();
      const seedB = createRootSeed();

      const ctxA = buildCtx(seedA, SALT);
      const { out: outA } = collectingOutput();
      const manifestA = generator(ctxA, outA);

      const ctxB = buildCtx(seedB, SALT);
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
// caesar
// ---------------------------------------------------------------------------

function unCaesar(text: string, shift: number): string {
  const back = (26 - (shift % 26)) % 26;
  return text
    .split("")
    .map((c) => {
      const code = c.charCodeAt(0);
      if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + back) % 26) + 65);
      if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + back) % 26) + 97);
      return c;
    })
    .join("");
}

describe("caesar generator", () => {
  it("un-caesar with the seeded shift recovers the token", () => {
    const ctx = buildCtx(FIXED_SEED, SALT);
    const { out, files } = collectingOutput();
    const manifest = generators.caesar(ctx, out);

    const cipher = (files.get("caesar/intercept.txt") as Buffer).toString("utf8");
    const shift = Number(manifest.expected.shift);
    const recovered = unCaesar(cipher, shift);

    expect(manifest.expected.token).toMatch(/^FW1-[0-9a-f]{10}$/);
    expect(recovered).toContain(manifest.expected.token as string);
  });
});

// ---------------------------------------------------------------------------
// vigenere
// ---------------------------------------------------------------------------

function vigenereDecrypt(text: string, key: string): string {
  let keyIdx = 0;
  let out = "";
  for (const c of text) {
    const isUpper = c >= "A" && c <= "Z";
    const isLower = c >= "a" && c <= "z";
    if (!isUpper && !isLower) {
      out += c;
      continue;
    }
    const base = isUpper ? 65 : 97;
    const keyChar = key[keyIdx % key.length] as string;
    const shift = keyChar.charCodeAt(0) - 97;
    const code = c.charCodeAt(0) - base;
    out += String.fromCharCode(((code - shift + 26) % 26) + base);
    keyIdx++;
  }
  return out;
}

describe("vigenere generator", () => {
  it("decrypting with the seeded key recovers the crib and the token", () => {
    const ctx = buildCtx(FIXED_SEED, SALT);
    const { out, files } = collectingOutput();
    const manifest = generators.vigenere(ctx, out);

    const cipher = (files.get("vigenere/cipher.txt") as Buffer).toString("utf8").trimEnd();
    const crib = (files.get("vigenere/crib.txt") as Buffer).toString("utf8").trimEnd();

    const key = manifest.expected.key as string;
    expect(key).toMatch(/^[a-z]{4,6}$/);

    const decrypted = vigenereDecrypt(cipher, key);
    expect(decrypted.startsWith(crib)).toBe(true);
    expect(manifest.expected.token).toMatch(/^FW2-[0-9a-f]{10}$/);
    expect(decrypted).toContain(manifest.expected.token as string);
  });
});

// ---------------------------------------------------------------------------
// jwt
// ---------------------------------------------------------------------------

describe("jwt generator", () => {
  it("payload base64url-decodes to JSON whose clearance matches expected.claim", () => {
    const ctx = buildCtx(FIXED_SEED, SALT);
    const { out, files } = collectingOutput();
    const manifest = generators.jwt(ctx, out);

    const token = (files.get("jwt/token.jwt") as Buffer).toString("utf8").trimEnd();
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    expect(parts[2]).toBe("");

    const header = JSON.parse(Buffer.from(parts[0] as string, "base64url").toString("utf8")) as {
      alg: string;
      typ: string;
    };
    expect(header).toEqual({ alg: "none", typ: "JWT" });

    const payload = JSON.parse(Buffer.from(parts[1] as string, "base64url").toString("utf8")) as {
      sub: string;
      clearance: string;
    };
    expect(payload.sub).toBe("analyst");
    expect(manifest.expected.claim).toMatch(/^FW3-[0-9a-f]{10}$/);
    expect(payload.clearance).toBe(manifest.expected.claim);
  });
});

// ---------------------------------------------------------------------------
// layers
// ---------------------------------------------------------------------------

describe("layers generator", () => {
  it("reversing hex -> base64 -> base64 recovers the token", () => {
    const ctx = buildCtx(FIXED_SEED, SALT);
    const { out, files } = collectingOutput();
    const manifest = generators.layers(ctx, out);

    const hexBlob = (files.get("layers/blob.txt") as Buffer).toString("utf8");
    const b64Outer = Buffer.from(hexBlob, "hex").toString("utf8");
    const b64Inner = Buffer.from(b64Outer, "base64").toString("utf8");
    const plainJson = Buffer.from(b64Inner, "base64").toString("utf8");
    const parsed = JSON.parse(plainJson) as { token: string };

    expect(manifest.expected.token).toMatch(/^FW4-[0-9a-f]{10}$/);
    expect(parsed.token).toBe(manifest.expected.token);
  });
});

// ---------------------------------------------------------------------------
// weblog
// ---------------------------------------------------------------------------

describe("weblog generator", () => {
  it("the attacker IP in expected has the most 404s against the expected path", () => {
    const ctx = buildCtx(FIXED_SEED, SALT);
    const { out, files } = collectingOutput();
    const manifest = generators.weblog(ctx, out);

    const log = (files.get("weblog/access.log") as Buffer).toString("utf8");
    const lines = log.trimEnd().split("\n");
    expect(lines.length).toBeGreaterThan(30);

    const lineRe = /^(\S+) - - \[[^\]]+\] "GET (\S+) HTTP\/1\.1" (\d+) (\d+)$/;
    const count404ByIp = new Map<string, number>();
    const countByIpPath = new Map<string, number>();
    let total200 = 0;
    let total404 = 0;

    for (const line of lines) {
      const match = lineRe.exec(line);
      expect(match).not.toBeNull();
      const [, ip, path, statusStr] = match as RegExpExecArray;
      const status = Number(statusStr);
      if (status === 200) total200++;
      if (status === 404) {
        total404++;
        count404ByIp.set(ip as string, (count404ByIp.get(ip as string) ?? 0) + 1);
        const key = `${ip}|${path}`;
        countByIpPath.set(key, (countByIpPath.get(key) ?? 0) + 1);
      }
    }

    // Most lines are benign 200s.
    expect(total200).toBeGreaterThan(total404);

    const attackerIp = manifest.expected.ip as string;
    const maxCount = Math.max(...count404ByIp.values());
    expect(count404ByIp.get(attackerIp)).toBe(maxCount);
    for (const [ip, count] of count404ByIp) {
      if (ip !== attackerIp) expect(count).toBeLessThan(maxCount);
    }
    expect(String(count404ByIp.get(attackerIp))).toBe(manifest.expected.count);

    const attackerPath = manifest.expected.path as string;
    const attackerPathCount = countByIpPath.get(`${attackerIp}|${attackerPath}`) ?? 0;
    for (const [key, count] of countByIpPath) {
      if (key.startsWith(`${attackerIp}|`) && key !== `${attackerIp}|${attackerPath}`) {
        expect(count).toBeLessThan(attackerPathCount);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// csvsum
// ---------------------------------------------------------------------------

describe("csvsum generator", () => {
  it("the example.csv amount column sums to expected.sampleSum and matches expected.sampleSha256", () => {
    const ctx = buildCtx(FIXED_SEED, SALT);
    const { out, files } = collectingOutput();
    const manifest = generators.csvsum(ctx, out);

    const csvBuf = files.get("csvsum/example.csv") as Buffer;
    const csvText = csvBuf.toString("utf8");
    const outText = (files.get("csvsum/example.out") as Buffer).toString("utf8").trimEnd();
    const specText = (files.get("csvsum/SPEC.md") as Buffer).toString("utf8");

    const lines = csvText.trimEnd().split("\n");
    expect(lines[0]).toBe("id,amount,label");
    let sum = 0;
    for (const line of lines.slice(1)) {
      const parts = line.split(",");
      sum += Number(parts[1]);
    }

    expect(String(sum)).toBe(manifest.expected.sampleSum);
    expect(outText).toBe(manifest.expected.sampleSum);
    expect(createHash("sha256").update(csvBuf).digest("hex")).toBe(manifest.expected.sampleSha256);
    expect(specText).toContain("id,amount,label");
  });
});
