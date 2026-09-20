import { route, ApiError } from "@/lib/api/handler";
import { prisma } from "@/lib/db";
import { canViewInstructorDashboard } from "@/lib/auth/policies";
import { computeTotal } from "@/lib/scoring";

export const runtime = "nodejs";

export const GET = route(async ({ user }) => {
  if (!canViewInstructorDashboard(user.profile)) throw new ApiError(403, "forbidden");
  const instances = await prisma.campaignInstance.findMany({
    select: {
      id: true,
      status: true,
      createdAt: true,
      student: { select: { id: true, displayName: true, email: true } },
      campaignVersion: {
        select: {
          campaign: { select: { name: true } },
          _count: { select: { stages: true } },
        },
      },
      challengeInstances: {
        select: {
          status: true,
          _count: {
            select: {
              submissions: { where: { status: "FAILED" } },
              hintUsages: true,
            },
          },
        },
      },
      environment: { select: { status: true } },
      scoreEvents: { select: { delta: true } },
      domainEvents: {
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const rows = instances.map((ci) => {
    const failed = ci.challengeInstances.reduce((total, challenge) => total + challenge._count.submissions, 0);
    const hints = ci.challengeInstances.reduce((total, challenge) => total + challenge._count.hintUsages, 0);
    return {
      instanceId: ci.id,
      student: { id: ci.student.id, name: ci.student.displayName, email: ci.student.email },
      campaign: ci.campaignVersion.campaign.name,
      status: ci.status,
      score: computeTotal(ci.scoreEvents),
      progress: { completed: ci.challengeInstances.filter((c) => c.status === "COMPLETED").length, total: ci.campaignVersion._count.stages },
      environment: ci.environment?.status ?? "PENDING",
      hintsUsed: hints,
      failedSubmissions: failed,
      lastActivity: ci.domainEvents[0]?.createdAt ?? ci.createdAt,
    };
  });
  return { students: rows };
});
