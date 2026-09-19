/**
 * AES-256-GCM sealing of a root seed for at-rest storage.
 *
 * Sealed payload layout (base64-encoded): iv(12) || authTag(16) || ciphertext.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const IV_LEN = 12;
const AUTH_TAG_LEN = 16;
const KEY_LEN = 32;

/** Thrown for malformed sealed input or a key of the wrong length. */
export class SeedSealError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedSealError";
  }
}

function decodeKey(keyB64: string): Buffer {
  const key = Buffer.from(keyB64, "base64");
  if (key.length !== KEY_LEN) {
    throw new SeedSealError(`SEED_ENC_KEY must decode to ${KEY_LEN} bytes, got ${key.length}`);
  }
  return key;
}

/** Seal `rootSeed` with AES-256-GCM using the base64-encoded 32-byte key. */
export function sealSeed(rootSeed: Buffer, keyB64: string): string {
  const key = decodeKey(keyB64);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(rootSeed), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/** Inverse of `sealSeed`. Throws `SeedSealError` on malformed input or bad key. */
export function openSeed(sealed: string, keyB64: string): Buffer {
  const key = decodeKey(keyB64);

  let raw: Buffer;
  try {
    raw = Buffer.from(sealed, "base64");
  } catch (err) {
    throw new SeedSealError(`Malformed base64 sealed payload: ${(err as Error).message}`);
  }

  if (raw.length < IV_LEN + AUTH_TAG_LEN) {
    throw new SeedSealError("Sealed payload too short to contain iv + authTag");
  }

  const iv = raw.subarray(0, IV_LEN);
  const authTag = raw.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
  const ciphertext = raw.subarray(IV_LEN + AUTH_TAG_LEN);

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (err) {
    throw new SeedSealError(`Failed to open sealed seed: ${(err as Error).message}`);
  }
}
