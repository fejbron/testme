import { route } from "@/lib/api/handler";
import { prisma } from "@/lib/db";
import { computeTotal } from "@/lib/scoring";

export const runtime = "nodejs";

export const GET = route(async ({ user }) => {
  const instances = await prisma.campaignInstance.findMany({
    where: { studentId: user.profile.id },
    include: {
      campaignVersion: { include: { campaign: true, stages: true } },
      challengeInstances: true,
      scoreEvents: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return {
    campaigns: instances.map((ci) => ({
      id: ci.id,
      name: ci.campaignVersion.campaign.name,
      version: ci.campaignVersion.version,
      status: ci.status === "PENDING" ? "NOT_STARTED" : ci.status,
      score: computeTotal(ci.scoreEvents),
      progress: {
        completed: ci.challengeInstances.filter((c) => c.status === "COMPLETED").length,
        total: ci.campaignVersion.stages.length,
      },
    })),
  };
});
