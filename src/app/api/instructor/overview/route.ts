import { route, ApiError } from "@/lib/api/handler";
import { prisma } from "@/lib/db";
import { canViewInstructorDashboard } from "@/lib/auth/policies";
import { computeTotal } from "@/lib/scoring";

export const runtime = "nodejs";

export const GET = route(async ({ user }) => {
  if (!canViewInstructorDashboard(user.profile)) throw new ApiError(403, "forbidden");
  const instances = await prisma.campaignInstance.findMany({
    include: {
      student: true,
      campaignVersion: { include: { campaign: true, stages: true } },
      challengeInstances: true,
      environment: true,
      scoreEvents: true,
    },
    orderBy: { createdAt: "desc" },
  });
  const rows = await Promise.all(
    instances.map(async (ci) => {
      const failed = await prisma.submission.count({ where: { challengeInstance: { campaignInstanceId: ci.id }, status: "FAILED" } });
      const hints = await prisma.hintUsage.count({ where: { challengeInstance: { campaignInstanceId: ci.id } } });
      const lastEvent = await prisma.domainEvent.findFirst({ where: { campaignInstanceId: ci.id }, orderBy: { createdAt: "desc" } });
      return {
        instanceId: ci.id,
        student: { id: ci.student.id, name: ci.student.displayName, email: ci.student.email },
        campaign: ci.campaignVersion.campaign.name,
        status: ci.status,
        score: computeTotal(ci.scoreEvents),
        progress: { completed: ci.challengeInstances.filter((c) => c.status === "COMPLETED").length, total: ci.campaignVersion.stages.length },
        environment: ci.environment?.status ?? "PENDING",
        hintsUsed: hints,
        failedSubmissions: failed,
        lastActivity: lastEvent?.createdAt ?? ci.createdAt,
      };
    }),
  );
  return { students: rows };
});
