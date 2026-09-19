import { describe, it, expect } from "vitest";
import { computeTotal, computeByCategory, stageAward } from "./index";

describe("scoring", () => {
  it("folds deltas deterministically", () => {
    expect(computeTotal([{ delta: 100 }, { delta: -20 }, { delta: 50 }])).toBe(130);
  });
  it("groups by category sorted", () => {
    const r = computeByCategory([
      { category: "Implementation", delta: 100 },
      { category: "Discovery", delta: 50 },
      { category: "Implementation", delta: -10 },
    ]);
    expect(r).toEqual([
      { category: "Discovery", total: 50 },
      { category: "Implementation", total: 90 },
    ]);
  });
  it("applies hint and attempt penalties, floors at zero", () => {
    expect(stageAward({ basePoints: 100, hintPenalties: [5, 10], attemptCount: 1 })).toBe(85);
    expect(stageAward({ basePoints: 100, hintPenalties: [], attemptCount: 4, attemptPenaltyPerFail: 10 })).toBe(70);
    expect(stageAward({ basePoints: 50, hintPenalties: [30, 30, 30], attemptCount: 1 })).toBe(0);
  });
  it("evidence multiplier boosts", () => {
    expect(stageAward({ basePoints: 100, hintPenalties: [], attemptCount: 1, evidenceMultiplier: 1.2 })).toBe(120);
  });
});
