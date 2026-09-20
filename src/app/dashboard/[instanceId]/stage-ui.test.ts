import { describe, expect, it } from "vitest";
import type { StageView } from "@/components/api-types";
import { firstAccessibleStage, stageTone } from "./stage-ui";

function stage(overrides: Partial<StageView>): StageView {
  return {
    challengeInstanceId: "challenge-1",
    status: "NOT_STARTED",
    title: "Stage",
    slug: "stage",
    description: null,
    points: 100,
    completionType: "VALUE",
    scoreAwarded: 0,
    ...overrides,
  };
}

describe("stage workspace state", () => {
  it("selects the first accessible stage", () => {
    const stages = [
      stage({ slug: null, status: "LOCKED" }),
      stage({ slug: "decode", status: "ACTIVE" }),
      stage({ slug: "logs", status: "NOT_STARTED" }),
    ];

    expect(firstAccessibleStage(stages)).toBe("decode");
  });

  it("prefers the active stage over an earlier completed stage", () => {
    const stages = [
      stage({ slug: "orientation", status: "COMPLETED" }),
      stage({ slug: "warm-up", status: "COMPLETED" }),
      stage({ slug: "decode", status: "ACTIVE" }),
    ];

    expect(firstAccessibleStage(stages)).toBe("decode");
  });

  it("maps stages to distinct timeline tones", () => {
    expect(stageTone(stage({ status: "COMPLETED" }), false)).toBe("complete");
    expect(stageTone(stage({ status: "ACTIVE" }), true)).toBe("active");
    expect(stageTone(stage({ status: "LOCKED", slug: null }), false)).toBe("locked");
    expect(stageTone(stage({ status: "NOT_STARTED" }), false)).toBe("ready");
  });
});
