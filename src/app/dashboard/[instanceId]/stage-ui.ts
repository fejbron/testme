import type { StageView } from "@/components/api-types";

export type StageTone = "complete" | "active" | "locked" | "ready";

export function firstAccessibleStage(stages: StageView[]) {
  return stages.find((stage) => stage.status === "ACTIVE" && stage.slug)?.slug
    ?? stages.find((stage) => stage.status !== "LOCKED" && stage.slug)?.slug
    ?? null;
}

export function stageTone(stage: StageView, selected: boolean): StageTone {
  if (stage.status === "COMPLETED") return "complete";
  if (selected || stage.status === "ACTIVE") return "active";
  if (stage.status === "LOCKED" || !stage.slug) return "locked";
  return "ready";
}
