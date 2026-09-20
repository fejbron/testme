export type StudentSectionId = "overview" | "stages" | "submissions" | "notes" | "timeline";
export type ResetMode = "environment" | "stage" | "progress";
export type ScoreAdjustmentValidation = { delta: number } | { error: string };

export function validateScoreAdjustment(delta: string, reason: string): ScoreAdjustmentValidation {
  const value = Number(delta);
  if (!Number.isInteger(value)) return { error: "Delta must be an integer." };
  if (!reason.trim()) return { error: "Reason is required." };
  return { delta: value };
}

export function validateReset(mode: ResetMode, stageSlug: string) {
  return mode === "stage" && !stageSlug ? "Select a stage first." : null;
}
