import { route } from "@/lib/api/handler";
import { prisma } from "@/lib/db";
import { computeTotal } from "@/lib/scoring";

export const runtime = "nodejs";

const DIFFICULTY_ORDER: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2, expert: 3 };

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
    campaigns: instances
      .map((ci) => ({
        id: ci.id,
        name: ci.campaignVersion.campaign.name,
        description: ci.campaignVersion.campaign.description,
        version: ci.campaignVersion.version,
        difficulty: ci.campaignVersion.campaign.difficulty,
        status: ci.status === "PENDING" ? "NOT_STARTED" : ci.status,
        score: computeTotal(ci.scoreEvents),
        progress: {
          completed: ci.challengeInstances.filter((c) => c.status === "COMPLETED").length,
          total: ci.campaignVersion.stages.length,
        },
      }))
      .sort((a, b) =>
        (DIFFICULTY_ORDER[a.difficulty] ?? Number.MAX_SAFE_INTEGER) -
          (DIFFICULTY_ORDER[b.difficulty] ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name),
      ),
  };
});
