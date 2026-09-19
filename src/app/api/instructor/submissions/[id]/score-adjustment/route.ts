import { z } from "zod";
import { route, readJson, ApiError } from "@/lib/api/handler";
import { prisma } from "@/lib/db";
import { canAdjustScore } from "@/lib/auth/policies";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const Body = z.object({ delta: z.number().int().min(-1000).max(1000), reason: z.string().min(1).max(500) });

export const POST = route(async ({ user, req, params }) => {
  if (!canAdjustScore(user.profile)) throw new ApiError(403, "forbidden");
  const sub = await prisma.submission.findUnique({ where: { id: params.id }, include: { challengeInstance: { include: { stage: true } } } });
  if (!sub) throw new ApiError(404, "not found");
  const { delta, reason } = Body.parse(await readJson(req));
  await prisma.scoreEvent.create({
    data: { campaignInstanceId: sub.challengeInstance.campaignInstanceId, stageSlug: sub.challengeInstance.stage.slug, category: "ManualAdjustment", delta, reason },
  });
  await audit({ actorId: user.profile.id, action: "score.adjust", targetType: "submission", targetId: params.id, meta: { delta, reason } });
  return { ok: true };
});
