import { route, ApiError } from "@/lib/api/handler";
import { prisma } from "@/lib/db";
import { canViewInstructorDashboard } from "@/lib/auth/policies";
import { computeTotal, computeByCategory } from "@/lib/scoring";
import { orderStagesByManifest } from "@/lib/campaign/stage-order";

export const runtime = "nodejs";

export const GET = route(async ({ user, params }) => {
  if (!canViewInstructorDashboard(user.profile)) throw new ApiError(403, "forbidden");
  const ci = await prisma.campaignInstance.findUnique({
    where: { id: params.instanceId },
    include: {
      student: true,
      campaignVersion: { include: { campaign: true, stages: true } },
      challengeInstances: { include: { stage: true } },
      environment: true,
      scoreEvents: true,
      notebookEntries: true,
      findings: true,
    },
  });
  if (!ci) throw new ApiError(404, "not found");
  const submissions = await prisma.submission.findMany({ where: { challengeInstance: { campaignInstanceId: ci.id } }, orderBy: { submittedAt: "desc" }, take: 50 });
  const timeline = await prisma.domainEvent.findMany({ where: { campaignInstanceId: ci.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const evidence = await prisma.evidence.findMany({ where: { campaignInstanceId: ci.id }, orderBy: { createdAt: "desc" } });
  return {
    student: { id: ci.student.id, name: ci.student.displayName, email: ci.student.email },
    campaign: ci.campaignVersion.campaign.name,
    status: ci.status,
    score: computeTotal(ci.scoreEvents),
    byCategory: computeByCategory(ci.scoreEvents),
    environment: ci.environment ? { status: ci.environment.status, ref: ci.environment.externalRef } : null,
    stages: orderStagesByManifest(
      ci.challengeInstances.map((c) => ({
        slug: c.stage.slug,
        title: c.stage.title,
        status: c.status,
        score: c.scoreAwarded,
        attempts: c.attemptCount,
      })),
      ci.campaignVersion.manifestJson,
    ),
    notebook: ci.notebookEntries,
    findings: ci.findings,
    submissions: submissions.map((s) => ({ id: s.id, type: s.type, status: s.status, score: s.scoreAwarded, feedback: s.graderFeedbackJson, at: s.submittedAt })),
    evidence,
    timeline: timeline.map((e) => ({ type: e.eventType, at: e.createdAt, payload: e.payloadJson })),
  };
});
