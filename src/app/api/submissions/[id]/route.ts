import { route, ApiError } from "@/lib/api/handler";
import { prisma } from "@/lib/db";
import { canViewCampaignInstance } from "@/lib/auth/policies";

export const runtime = "nodejs";

export const GET = route(async ({ user, params }) => {
  const sub = await prisma.submission.findUnique({
    where: { id: params.id },
    include: { challengeInstance: { include: { campaignInstance: true } } },
  });
  if (!sub) throw new ApiError(404, "not found");
  if (!canViewCampaignInstance(user.profile, sub.challengeInstance.campaignInstance.studentId)) throw new ApiError(403, "forbidden");
  return {
    id: sub.id,
    type: sub.type,
    status: sub.status,
    scoreAwarded: sub.scoreAwarded,
    feedback: sub.graderFeedbackJson,
    submittedAt: sub.submittedAt,
    gradedAt: sub.gradedAt,
  };
});
