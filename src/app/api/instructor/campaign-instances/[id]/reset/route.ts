import { z } from "zod";
import { route, readJson, ApiError } from "@/lib/api/handler";
import { prisma } from "@/lib/db";
import { canResetCampaignProgress } from "@/lib/auth/policies";
import { resetEnvironment } from "@/lib/environment/provision";
import { kickDrain } from "@/lib/events/kick";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ mode: z.enum(["environment", "stage", "progress"]), stageSlug: z.string().optional() });

export const POST = route(async ({ user, req, params }) => {
  const instance = await prisma.campaignInstance.findUnique({ where: { id: params.id } });
  if (!instance) throw new ApiError(404, "not found");
  if (!canResetCampaignProgress(user.profile, instance.studentId)) throw new ApiError(403, "forbidden");
  const { mode, stageSlug } = Body.parse(await readJson(req));

  if (mode === "environment") {
    await resetEnvironment(params.id);
  } else if (mode === "stage") {
    if (!stageSlug) throw new ApiError(400, "stageSlug required");
    const stage = await prisma.challengeStage.findFirst({ where: { campaignVersionId: instance.campaignVersionId, slug: stageSlug } });
    if (!stage) throw new ApiError(404, "stage not found");
    await prisma.challengeInstance.updateMany({ where: { campaignInstanceId: params.id, stageId: stage.id }, data: { status: "AVAILABLE", attemptCount: 0, completedAt: null, scoreAwarded: 0 } });
  } else {
    const stages = await prisma.challengeStage.findMany({ where: { campaignVersionId: instance.campaignVersionId } });
    for (const s of stages) {
      await prisma.challengeInstance.updateMany({ where: { campaignInstanceId: params.id, stageId: s.id }, data: { status: s.visibleByDefault ? "AVAILABLE" : "LOCKED", attemptCount: 0, completedAt: null, scoreAwarded: 0 } });
    }
    await prisma.scoreEvent.deleteMany({ where: { campaignInstanceId: params.id } });
    await resetEnvironment(params.id);
  }
  await audit({ actorId: user.profile.id, action: `reset.${mode}`, targetType: "campaignInstance", targetId: params.id, meta: { stageSlug } });
  await kickDrain();
  return { ok: true };
});
