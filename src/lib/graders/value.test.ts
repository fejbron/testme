import { describe, expect, it } from "vitest";
import { gradeValue } from "./value";

describe("gradeValue", () => {
  it("passes on an exact match", () => {
    const result = gradeValue("FLAG{abc123}", "FLAG{abc123}");
    expect(result.passed).toBe(true);
    expect(result.score).toBe(result.maxScore);
  });

  it("fails on a mismatch", () => {
    const result = gradeValue("FLAG{wrong}", "FLAG{abc123}");
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
  });

  it("passes when only surrounding whitespace differs", () => {
    const result = gradeValue("  FLAG{abc123}\n", "FLAG{abc123}");
    expect(result.passed).toBe(true);
  });

  it("fails when internal whitespace differs (not normalized)", () => {
    const result = gradeValue("FLAG{ab c123}", "FLAG{abc123}");
    expect(result.passed).toBe(false);
  });

  it("is correct across repeated calls regardless of input length (timing-safe correctness)", () => {
    const short = gradeValue("a", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    const long = gradeValue("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(short.passed).toBe(false);
    expect(long.passed).toBe(true);
  });

  it("never reveals the expected value in categories or summary", () => {
    const result = gradeValue("wrong", "supersecret");
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("supersecret");
  });
});
