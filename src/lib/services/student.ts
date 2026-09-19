import { prisma } from "@/lib/db";
import { createHash } from "node:crypto";
import type { NotebookType, SubmissionType } from "@prisma/client";
import { computeTotal, computeByCategory } from "@/lib/scoring";
import { enqueueJob, emitEvent } from "@/lib/events/emit";
import { EventType, JobType } from "@/lib/events/types";
import { stageAward } from "@/lib/scoring";
import { ApiError } from "@/lib/api/handler";

/** Aggregated student-facing overview of a campaign instance (no locked-stage leakage). */
export async function instanceOverview(campaignInstanceId: string) {
  const instance = await prisma.campaignInstance.findUniqueOrThrow({
    where: { id: campaignInstanceId },
    include: {
      campaignVersion: { include: { campaign: true, stages: { orderBy: { slug: "asc" } } } },
      challengeInstances: { include: { stage: true } },
      environment: true,
      scoreEvents: true,
    },
  });
  const score = computeTotal(instance.scoreEvents);
  const byCategory = computeByCategory(instance.scoreEvents);
  const ciByStage = new Map(instance.challengeInstances.map((c) => [c.stageId, c]));

  const stages = instance.campaignVersion.stages.map((s) => {
    const ci = ciByStage.get(s.id);
    const status = ci?.status ?? "LOCKED";
    const visible = status !== "LOCKED";
    return {
      challengeInstanceId: ci?.id ?? null,
      status,
      // Only reveal details for unlocked stages.
      title: visible ? s.title : "??????",
      slug: visible ? s.slug : null,
      description: visible ? s.description : null,
      points: visible ? s.points : null,
      completionType: visible ? s.completionType : null,
      scoreAwarded: ci?.scoreAwarded ?? 0,
    };
  });

  const completed = instance.challengeInstances.filter((c) => c.status === "COMPLETED").length;
  const total = instance.campaignVersion.stages.length;

  const recentEvents = await prisma.domainEvent.findMany({
    where: { campaignInstanceId, eventType: { in: [EventType.STAGE_UNLOCKED, EventType.STAGE_COMPLETED, EventType.SERVICE_STARTED, EventType.SUBMISSION_PASSED, EventType.HINT_USED] } },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  return {
    id: instance.id,
    status: instance.status,
    campaign: { name: instance.campaignVersion.campaign.name, version: instance.campaignVersion.version },
    score,
    byCategory,
    progress: { completed, total },
    environment: instance.environment
      ? { status: instance.environment.status, services: (instance.environment.metadataJson as { services?: string[] })?.services ?? [] }
      : null,
    stages,
    recentEvents: recentEvents.map((e) => ({ type: e.eventType, at: e.createdAt, payload: e.payloadJson })),
  };
}

export async function listNotebook(campaignInstanceId: string) {
  return prisma.notebookEntry.findMany({ where: { campaignInstanceId }, orderBy: { updatedAt: "desc" } });
}

export async function createNotebook(params: {
  campaignInstanceId: string;
  studentId: string;
  type: NotebookType;
  title: string;
  content: string;
  confidence?: string;
  links?: Record<string, unknown>;
}) {
  return prisma.notebookEntry.create({
    data: {
      campaignInstanceId: params.campaignInstanceId,
      studentId: params.studentId,
      type: params.type,
      title: params.title,
      content: params.content,
      confidence: params.confidence ?? "MEDIUM",
      linksJson: (params.links ?? {}) as object,
    },
  });
}

export async function createFinding(params: {
  challengeInstanceId: string;
  campaignInstanceId: string;
  studentId: string;
  findingType: string;
  title: string;
  structuredData: Record<string, unknown>;
  explanation: string;
  confidence?: string;
}) {
  return prisma.finding.create({
    data: {
      challengeInstanceId: params.challengeInstanceId,
      campaignInstanceId: params.campaignInstanceId,
      studentId: params.studentId,
      findingType: params.findingType,
      title: params.title,
      structuredDataJson: params.structuredData as object,
      explanation: params.explanation,
      confidence: params.confidence ?? "MEDIUM",
    },
  });
}

/** Create a submission and enqueue asynchronous grading. Returns the submission id. */
export async function createSubmission(params: {
  challengeInstanceId: string;
  studentId: string;
  type: SubmissionType;
  payload: Record<string, unknown>;
  code?: { language: string; sourceText: string; entrypoint?: string };
}): Promise<string> {
  const sub = await prisma.$transaction(async (tx) => {
    const submission = await tx.submission.create({
      data: {
        challengeInstanceId: params.challengeInstanceId,
        studentId: params.studentId,
        type: params.type,
        status: "PENDING",
        payloadJson: params.payload as object,
      },
    });
    if (params.code) {
      await tx.codeSubmission.create({
        data: {
          submissionId: submission.id,
          language: params.code.language,
          sourceText: params.code.sourceText,
          entrypoint: params.code.entrypoint,
        },
      });
    }
    await tx.challengeInstance.update({
      where: { id: params.challengeInstanceId },
      data: { attemptCount: { increment: 1 }, status: "IN_PROGRESS" },
    });
    const ci = await tx.challengeInstance.findUniqueOrThrow({ where: { id: params.challengeInstanceId } });
    await emitEvent(
      { campaignInstanceId: ci.campaignInstanceId, type: EventType.SUBMISSION_RECEIVED, payload: { submissionId: submission.id }, idempotencyKey: `received:${submission.id}` },
      tx,
    );
    await enqueueJob({ type: JobType.GRADE_SUBMISSION, payload: { submissionId: submission.id }, idempotencyKey: `grade:${submission.id}` }, tx);
    return submission;
  });
  return sub.id;
}

export async function listHints(challengeInstanceId: string) {
  const ci = await prisma.challengeInstance.findUniqueOrThrow({ where: { id: challengeInstanceId }, include: { stage: { include: { hints: { orderBy: { level: "asc" } } } }, hintUsages: true } });
  const usedIds = new Set(ci.hintUsages.map((u) => u.hintId));
  return ci.stage.hints.map((h) => ({
    id: h.id,
    level: h.level,
    penalty: h.pointPenalty,
    used: usedIds.has(h.id),
    // Content only revealed once used.
    content: usedIds.has(h.id) ? h.content : null,
  }));
}

/** Consume a hint: records usage once, applies a negative ScoreEvent penalty. Idempotent per (hint, challenge). */
export async function useHint(params: { challengeInstanceId: string; hintId: string; studentId: string }) {
  return prisma.$transaction(async (tx) => {
    const ci = await tx.challengeInstance.findUniqueOrThrow({ where: { id: params.challengeInstanceId }, include: { stage: true } });
    const hint = await tx.hint.findUniqueOrThrow({ where: { id: params.hintId } });
    if (hint.stageId !== ci.stageId) throw new ApiError(400, "hint does not belong to this stage");
    const existing = await tx.hintUsage.findUnique({ where: { hintId_challengeInstanceId: { hintId: params.hintId, challengeInstanceId: params.challengeInstanceId } } });
    if (existing) return { content: hint.content, penaltyApplied: existing.penaltyApplied, alreadyUsed: true };

    await tx.hintUsage.create({ data: { hintId: params.hintId, challengeInstanceId: params.challengeInstanceId, studentId: params.studentId, penaltyApplied: hint.pointPenalty } });
    await tx.scoreEvent.create({ data: { campaignInstanceId: ci.campaignInstanceId, stageSlug: ci.stage.slug, category: "HintPenalty", delta: -hint.pointPenalty, reason: `hint L${hint.level}` } });
    await emitEvent({ campaignInstanceId: ci.campaignInstanceId, type: EventType.HINT_USED, payload: { hintId: hint.id, level: hint.level }, idempotencyKey: `hint:${params.challengeInstanceId}:${hint.id}` }, tx);
    return { content: hint.content, penaltyApplied: hint.pointPenalty, alreadyUsed: false };
  });
}

export function sha256Hex(s: string | Buffer): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Award stage completion score once; used by the grading executor. */
export async function awardStageCompletion(campaignInstanceId: string, challengeInstanceId: string) {
  return prisma.$transaction(async (tx) => {
    const ci = await tx.challengeInstance.findUniqueOrThrow({ where: { id: challengeInstanceId }, include: { stage: true, hintUsages: true } });
    if (ci.status === "COMPLETED") return { alreadyComplete: true, awarded: ci.scoreAwarded };
    const award = stageAward({
      basePoints: ci.stage.points,
      hintPenalties: [], // hint penalties already recorded as their own ScoreEvents
      attemptCount: ci.attemptCount,
    });
    await tx.challengeInstance.update({ where: { id: challengeInstanceId }, data: { status: "COMPLETED", completedAt: new Date(), scoreAwarded: award } });
    await tx.scoreEvent.create({ data: { campaignInstanceId, stageSlug: ci.stage.slug, category: "Completion", delta: award, reason: `stage ${ci.stage.slug} complete` } });
    await emitEvent({ campaignInstanceId, type: EventType.STAGE_COMPLETED, payload: { stageId: ci.stageId, stageSlug: ci.stage.slug }, idempotencyKey: `completed:${challengeInstanceId}` }, tx);
    return { alreadyComplete: false, awarded: award };
  });
}
