import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { openSeed, sealSeed, SeedSealError } from "./seal";

const FIXED_KEY_B64 = Buffer.alloc(32, 7).toString("base64");

describe("seal / open", () => {
  it("round-trips seal -> open to the original bytes", () => {
    const rootSeed = randomBytes(32);
    const sealed = sealSeed(rootSeed, FIXED_KEY_B64);
    const opened = openSeed(sealed, FIXED_KEY_B64);
    expect(opened.equals(rootSeed)).toBe(true);
  });

  it("throws when the ciphertext is tampered with", () => {
    const rootSeed = randomBytes(32);
    const sealed = sealSeed(rootSeed, FIXED_KEY_B64);
    const raw = Buffer.from(sealed, "base64");
    raw[raw.length - 1] = (raw[raw.length - 1] as number) ^ 0xff;
    const tampered = raw.toString("base64");

    expect(() => openSeed(tampered, FIXED_KEY_B64)).toThrow(SeedSealError);
  });

  it("throws SeedSealError for a key of the wrong length", () => {
    const badKey = Buffer.alloc(16, 1).toString("base64");
    expect(() => sealSeed(randomBytes(32), badKey)).toThrow(SeedSealError);

    const sealed = sealSeed(randomBytes(32), FIXED_KEY_B64);
    expect(() => openSeed(sealed, badKey)).toThrow(SeedSealError);
  });

  it("throws SeedSealError for a malformed/short sealed payload", () => {
    const tooShort = Buffer.alloc(10).toString("base64");
    expect(() => openSeed(tooShort, FIXED_KEY_B64)).toThrow(SeedSealError);
  });
});
