import { createHash } from "node:crypto";
import type { GraderFeedback } from "./types";

const MAX_SCORE = 100;

const PCAP_MAGIC_BE = 0xa1b2c3d4;
const PCAP_MAGIC_LE = 0xd4c3b2a1;

export interface FileSpec {
  sha256?: string;
  mustContain?: string[];
  parser?: "pcap" | "json";
}

function checkSha256(bytes: Buffer, expected: string): boolean {
  const digest = createHash("sha256").update(bytes).digest("hex");
  return digest.toLowerCase() === expected.toLowerCase();
}

function checkMustContain(bytes: Buffer, needle: string): boolean {
  const utf8 = bytes.toString("utf8");
  if (utf8.includes(needle)) return true;
  const hex = bytes.toString("hex");
  if (hex.includes(needle.toLowerCase())) return true;
  return false;
}

function checkPcapMagic(bytes: Buffer): boolean {
  if (bytes.length < 4) return false;
  const magicBe = bytes.readUInt32BE(0);
  const magicLe = bytes.readUInt32LE(0);
  return magicBe === PCAP_MAGIC_BE || magicLe === PCAP_MAGIC_BE || magicBe === PCAP_MAGIC_LE || magicLe === PCAP_MAGIC_LE;
}

function checkJson(bytes: Buffer): boolean {
  try {
    JSON.parse(bytes.toString("utf8"));
    return true;
  } catch {
    return false;
  }
}

/**
 * Grades a file submission (bytes only — filename is never a signal).
 * Verifies sha256 if given, each mustContain substring (utf8/hex
 * tolerant), and a parser check (pcap magic bytes or JSON.parse).
 */
export function gradeFile(bytes: Buffer, spec: FileSpec): GraderFeedback {
  const categories: Record<string, string> = {};
  let total = 0;
  let passedCount = 0;

  if (spec.sha256 !== undefined) {
    total += 1;
    const ok = checkSha256(bytes, spec.sha256);
    categories.Checksum = ok ? "PASS" : "FAIL";
    if (ok) passedCount += 1;
  }

  if (spec.mustContain !== undefined) {
    for (let i = 0; i < spec.mustContain.length; i += 1) {
      total += 1;
      const ok = checkMustContain(bytes, spec.mustContain[i]);
      categories[`Contains ${i + 1}`] = ok ? "PASS" : "FAIL";
      if (ok) passedCount += 1;
    }
  }

  if (spec.parser === "pcap") {
    total += 1;
    const ok = checkPcapMagic(bytes);
    categories.Format = ok ? "PASS" : "FAIL";
    if (ok) passedCount += 1;
  } else if (spec.parser === "json") {
    total += 1;
    const ok = checkJson(bytes);
    categories.Format = ok ? "PASS" : "FAIL";
    if (ok) passedCount += 1;
  }

  const passed = total > 0 && passedCount === total;
  const score = total === 0 ? 0 : Math.round((passedCount / total) * MAX_SCORE);

  return {
    passed,
    score,
    maxScore: MAX_SCORE,
    categories,
    summary: `${passedCount}/${total} checks passed.`,
  };
}
