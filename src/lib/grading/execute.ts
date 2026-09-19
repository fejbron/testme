import { prisma } from "@/lib/db";
import { loadSeedContext } from "@/lib/seed/context";
import { campaignRuntime } from "@/lib/campaigns/registry";
import { gradeValue } from "@/lib/graders/value";
import { gradeFinding } from "@/lib/graders/finding";
import { gradeCode } from "@/lib/graders/code";
import { gradeEnvironmentState } from "@/lib/graders/environment-state";
import type { GraderFeedback } from "@/lib/graders/types";
import { createSandboxProvider } from "@/lib/sandbox/provider";
import { awardStageCompletion } from "@/lib/services/student";
import { emitEvent } from "@/lib/events/emit";
import { EventType } from "@/lib/events/types";
import { log } from "@/lib/observability/logger";

/** Grade one submission end-to-end: derive expected from the seed, run the grader, persist, and on pass complete the stage. */
export async function executeGrading(submissionId: string): Promise<void> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      code: true,
      challengeInstance: { include: { stage: true, campaignInstance: { include: { campaignVersion: { include: { campaign: true } } } } } },
    },
  });
  if (!submission) return;

  const ci = submission.challengeInstance;
  const stage = ci.stage;
  const campaignInstanceId = ci.campaignInstanceId;

  // Recovery path: a prior run graded PASSED but may have failed before completing
  // the stage (e.g. a transaction timeout). Re-drive the idempotent award/unlock.
  if (submission.status === "PASSED") {
    await awardStageCompletion(campaignInstanceId, ci.id);
    await emitEvent({ campaignInstanceId, type: EventType.SUBMISSION_PASSED, payload: { submissionId }, idempotencyKey: `passed:${submissionId}` });
    return;
  }
  const campaignSlug = ci.campaignInstance.campaignVersion.campaign.slug;

  await prisma.submission.update({ where: { id: submissionId }, data: { status: "GRADING" } });

  let feedback: GraderFeedback;
  try {
    const seedCtx = await loadSeedContext(campaignInstanceId);
    const plan = campaignRuntime(campaignSlug).deriveGrading(stage.slug, seedCtx);
    const payload = (submission.payloadJson ?? {}) as Record<string, unknown>;

    if (plan.kind === "value") {
      feedback = gradeValue(String(payload.value ?? ""), plan.expected);
    } else if (plan.kind === "finding") {
      feedback = gradeFinding((payload.fields ?? payload) as Record<string, unknown>, plan.spec);
    } else if (plan.kind === "code") {
      const provider = createSandboxProvider();
      const source = submission.code?.sourceText ?? String(payload.sourceText ?? "");
      feedback = await gradeCode({ language: plan.language, sourceText: source }, plan.spec, (spec) => provider.runEphemeralGrade(spec));
    } else {
      const provider = createSandboxProvider();
      const env = await prisma.environmentInstance.findUnique({ where: { campaignInstanceId } });
      const name = env?.externalRef;
      if (!name) throw new Error("environment not provisioned");
      feedback = await gradeEnvironmentState(plan.checks, (req) => provider.exec(name, { cmd: req.cmd, args: req.args }));
    }
  } catch (err) {
    log.error("grading error", { submissionId }, { message: err instanceof Error ? err.message : String(err) });
    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: "ERROR", gradedAt: new Date(), graderFeedbackJson: { error: "grading failed" } },
    });
    throw err;
  }

  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      status: feedback.passed ? "PASSED" : "FAILED",
      gradedAt: new Date(),
      scoreAwarded: feedback.passed ? feedback.score : 0,
      graderFeedbackJson: feedback as object,
    },
  });

  if (feedback.passed) {
    await awardStageCompletion(campaignInstanceId, ci.id);
    await emitEvent({ campaignInstanceId, type: EventType.SUBMISSION_PASSED, payload: { submissionId }, idempotencyKey: `passed:${submissionId}` });
  } else {
    await emitEvent({ campaignInstanceId, type: EventType.SUBMISSION_FAILED, payload: { submissionId }, idempotencyKey: `failed:${submissionId}` });
  }
}
