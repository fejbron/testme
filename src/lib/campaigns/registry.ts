import type { SeedContext } from "@/lib/seed";
import type { GradingPlan } from "@/lib/grading/plan";
import { generators as janusGenerators } from "../../../challenges/janus/generators";
import { deriveGrading as deriveJanus } from "@/lib/grading/janus";
import { generators as gauntletGenerators } from "../../../challenges/gauntlet/generators";
import { deriveGrading as deriveGauntlet } from "@/lib/grading/gauntlet";

/** A generator matches the challenges/* GenManifest contract. */
export type CampaignGenerator = (
  ctx: SeedContext,
  out: { file(path: string, content: Buffer): void },
) => { files: { path: string; sha256: string }[]; metadata: Record<string, unknown>; expected: Record<string, string> };

export interface CampaignRuntime {
  generators: Record<string, CampaignGenerator>;
  deriveGrading: (stageSlug: string, ctx: SeedContext) => GradingPlan;
}

/** Maps a campaign slug to its portable content runtime (generators + grading derivation). */
const REGISTRY: Record<string, CampaignRuntime> = {
  "project-janus": { generators: janusGenerators, deriveGrading: deriveJanus },
  gauntlet: { generators: gauntletGenerators, deriveGrading: deriveGauntlet },
};

export function registerCampaign(slug: string, runtime: CampaignRuntime): void {
  REGISTRY[slug] = runtime;
}

export function campaignRuntime(slug: string): CampaignRuntime {
  const rt = REGISTRY[slug];
  if (!rt) throw new Error(`no runtime registered for campaign "${slug}"`);
  return rt;
}
