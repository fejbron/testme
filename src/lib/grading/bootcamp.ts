import type { SeedContext } from "@/lib/seed";
import { generators } from "../../../challenges/bootcamp/generators";
import type { GradingPlan } from "./plan";

function expectedOf(name: string, ctx: SeedContext): Record<string, string> {
  const gen = generators[name];
  if (!gen) throw new Error(`unknown generator ${name}`);
  return gen(ctx, { file: () => {} }).expected;
}

/** Boot Camp (beginner) — every stage is a single recovered value. */
export function deriveGrading(stageSlug: string, ctx: SeedContext): GradingPlan {
  switch (stageSlug) {
    case "decode-1":
      return { kind: "value", expected: expectedOf("welcome", ctx).token };
    case "decode-2":
      return { kind: "value", expected: expectedOf("rotate", ctx).token };
    case "decode-3":
      return { kind: "value", expected: expectedOf("hexdump", ctx).token };
    case "count":
      return { kind: "value", expected: expectedOf("tally", ctx).sum };
    case "search":
      return { kind: "value", expected: expectedOf("needle", ctx).token };
    case "decode-4":
      return { kind: "value", expected: expectedOf("binary", ctx).token };
    default:
      throw new Error(`no grading plan for bootcamp stage ${stageSlug}`);
  }
}
