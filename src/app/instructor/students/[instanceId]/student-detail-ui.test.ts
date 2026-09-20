import { describe, expect, it } from "vitest";
import { validateReset, validateScoreAdjustment } from "./student-detail-ui";

describe("student detail action validation", () => {
  it("rejects a non-integer score delta", () => {
    expect(validateScoreAdjustment("1.5", "manual review")).toEqual({ error: "Delta must be an integer." });
  });

  it("rejects a blank score reason", () => {
    expect(validateScoreAdjustment("2", " ")).toEqual({ error: "Reason is required." });
  });

  it("accepts an integer delta with a reason", () => {
    expect(validateScoreAdjustment("-2", "duplicate submission")).toEqual({ delta: -2 });
  });

  it("requires a stage for stage reset", () => {
    expect(validateReset("stage", "")).toBe("Select a stage first.");
    expect(validateReset("progress", "")).toBeNull();
  });
});
