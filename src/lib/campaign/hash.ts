import { createHash } from "node:crypto";
import type { Manifest } from "./schema";

/**
 * Recursively produce a canonical JSON string with object keys sorted
 * lexicographically at every level. Arrays keep their original order
 * (order is semantically meaningful for stages, hints, etc.).
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const sortedKeys = Object.keys(source).sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      result[key] = canonicalize(source[key]);
    }
    return result;
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

/**
 * Compute a deterministic sha256 hex digest of a manifest, based on a
 * canonical JSON serialization with recursively sorted object keys.
 * The result is independent of the key order in the original object.
 */
export function manifestHash(m: Manifest): string {
  const canonical = canonicalJson(m);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
