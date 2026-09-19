import { createHash, timingSafeEqual } from "node:crypto";
import type { GraderFeedback } from "./types";

const MAX_SCORE = 100;

/** sha256 digest of a string, used so timingSafeEqual always compares equal-length buffers. */
function sha256(input: string): Buffer {
  return createHash("sha256").update(input, "utf8").digest();
}

/**
 * Grades an exact-value submission (e.g. a flag, a marker string, a
 * config value). Normalizes only surrounding whitespace on both sides,
 * then compares via a constant-time digest comparison so response
 * timing cannot leak how many characters matched.
 */
export function gradeValue(submitted: string, expected: string): GraderFeedback {
  const normalizedSubmitted = submitted.trim();
  const normalizedExpected = expected.trim();

  const submittedDigest = sha256(normalizedSubmitted);
  const expectedDigest = sha256(normalizedExpected);
  const passed = timingSafeEqual(submittedDigest, expectedDigest);

  return {
    passed,
    score: passed ? MAX_SCORE : 0,
    maxScore: MAX_SCORE,
    categories: { Value: passed ? "PASS" : "FAIL" },
    summary: passed ? "Submitted value matches." : "Submitted value does not match.",
  };
}
