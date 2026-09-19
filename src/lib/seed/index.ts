/**
 * Deterministic seed engine.
 *
 * Given a 32-byte root seed and a campaign-version salt (the manifest hash),
 * every value derived through a `SeedContext` is a pure, deterministic
 * function of (rootSeed, salt, namespace path, helper kind, label). Re-running
 * generation against the same root seed and manifest always reproduces the
 * same values; namespacing keeps unrelated derivations from colliding.
 */
import { hkdfSync, randomBytes } from "node:crypto";

type HelperKind = "int" | "hex" | "bytes" | "uuid" | "pick" | "bool" | "shuffle";

/**
 * Generate a fresh cryptographically-random 32-byte root seed.
 */
export function createRootSeed(): Buffer {
  return randomBytes(32);
}

/**
 * Deterministic derivation context. Immutable: every helper call and every
 * `namespace()` call returns fresh values/contexts without mutating `this`.
 */
export class SeedContext {
  private readonly rootSeed: Buffer;
  private readonly salt: string;
  private readonly saltBuf: Buffer;
  private readonly infoPath: string;

  constructor(rootSeed: Buffer, salt: string, infoPath = "") {
    this.rootSeed = rootSeed;
    this.salt = salt;
    this.saltBuf = Buffer.from(salt, "utf8");
    this.infoPath = infoPath;
  }

  /**
   * Return a child context whose derivations are scoped under `label`.
   * Labels fold into the HKDF info prefix, joined with "/", e.g.
   * "campaign:janus/stage:silent-relay/artifact:pcap".
   */
  namespace(label: string): SeedContext {
    const childPath = this.infoPath ? `${this.infoPath}/${label}` : label;
    return new SeedContext(this.rootSeed, this.salt, childPath);
  }

  /** Uniform random integer in [min, max] inclusive. */
  int(label: string, min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new RangeError("int: min and max must be integers");
    }
    if (min > max) {
      throw new RangeError("int: min must be <= max");
    }
    return this.uniformInt("int", label, min, max);
  }

  /** Deterministic hex string of `bytes` random bytes. */
  hex(label: string, bytes: number): string {
    return this.deriveBytes("hex", label, bytes).toString("hex");
  }

  /** Deterministic buffer of `n` random bytes. */
  bytes(label: string, n: number): Buffer {
    return this.deriveBytes("bytes", label, n);
  }

  /** RFC-4122 v4-shaped UUID, deterministically derived. */
  uuid(label: string): string {
    const buf = this.deriveBytes("uuid", label, 16);
    // Set version (4) and variant (10xx) bits per RFC 4122.
    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;
    const hex = buf.toString("hex");
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join("-");
  }

  /** Deterministically pick one element from `arr`. */
  pick<T>(label: string, arr: readonly T[]): T {
    if (arr.length === 0) {
      throw new RangeError("pick: array must not be empty");
    }
    const idx = this.uniformInt("pick", label, 0, arr.length - 1);
    return arr[idx] as T;
  }

  /** Deterministic boolean, true with probability `pTrue` (default 0.5). */
  bool(label: string, pTrue = 0.5): boolean {
    const buf = this.deriveBytes("bool", label, 6);
    const frac = Number(bytesToBigInt(buf)) / Number(1n << 48n);
    return frac < pTrue;
  }

  /** Deterministic Fisher-Yates shuffle; returns a new array. */
  shuffle<T>(label: string, arr: readonly T[]): T[] {
    const result = arr.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.uniformInt("shuffle", `${label}:${i}`, 0, i);
      const tmp = result[i] as T;
      result[i] = result[j] as T;
      result[j] = tmp;
    }
    return result;
  }

  /**
   * Derive `n` fresh bytes via HKDF-SHA256, namespaced by helper kind and
   * label so different helper kinds/labels never collide, even at the same
   * namespace path.
   */
  private deriveBytes(helperKind: HelperKind, label: string, n: number): Buffer {
    const info = `${this.infoPath}#${helperKind}:${label}`;
    const derived = hkdfSync("sha256", this.rootSeed, this.saltBuf, info, n);
    return Buffer.from(derived);
  }

  private uniformInt(helperKind: HelperKind, label: string, min: number, max: number): number {
    const range = BigInt(max - min + 1);
    const buf = this.deriveBytes(helperKind, label, 6);
    const val = bytesToBigInt(buf);
    return min + Number(val % range);
  }
}

function bytesToBigInt(buf: Buffer): bigint {
  let val = 0n;
  for (const byte of buf) {
    val = (val << 8n) | BigInt(byte);
  }
  return val;
}

/** Factory: create a root SeedContext from a root seed and campaign salt. */
export function createSeedContext(rootSeed: Buffer, salt: string): SeedContext {
  return new SeedContext(rootSeed, salt);
}
