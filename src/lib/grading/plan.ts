import type { FindingSpec } from "@/lib/graders/finding";
import type { CodeSpec } from "@/lib/graders/code";
import type { EnvCheck } from "@/lib/graders/environment-state";

/** A stage's grading plan, derived from the per-student seed. Shared across campaigns. */
export type GradingPlan =
  | { kind: "value"; expected: string }
  | { kind: "finding"; spec: FindingSpec }
  | { kind: "code"; language: "python" | "c"; spec: CodeSpec }
  | { kind: "environment_state"; checks: EnvCheck[] };
