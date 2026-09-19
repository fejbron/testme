import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { EventType } from "./types";
import { emitEvent } from "./emit";

type Tx = PrismaClient | Prisma.TransactionClient;

/**
 * Handle one domain event, idempotently. A ProcessedEvent(eventId, handlerName)
 * row guards each handler so retries never double-apply (spec §16).
 */
export async function processEvent(eventId: string): Promise<void> {
  const event = await prisma.domainEvent.findUnique({ where: { id: eventId } });
  if (!event) return;

  if (event.eventType === EventType.STAGE_COMPLETED) {
    await runOnce(eventId, "unlock-dependents", async (tx) => {
      const payload = event.payloadJson as { stageId?: string; stageSlug?: string };
      if (!payload.stageId) return;
      await unlockDependents(tx, event.campaignInstanceId, payload.stageId);
      // Apply onComplete manifest effects (unlock/startService/emit) recorded on the stage config.
      await applyOnComplete(tx, event.campaignInstanceId, payload.stageId);
    });
  }
}

async function runOnce(eventId: string, handlerName: string, fn: (tx: Prisma.TransactionClient) => Promise<void>): Promise<void> {
  await prisma.$transaction(async (tx) => {
    try {
      await tx.processedEvent.create({ data: { eventId, handlerName } });
    } catch {
      return; // already processed (unique violation) — idempotent no-op
    }
    await fn(tx);
  });
}

/** Unlock every stage that REQUIRES the completed stage, once all its requirements are COMPLETED. */
export async function unlockDependents(tx: Tx, campaignInstanceId: string, completedStageId: string): Promise<void> {
  const deps = await tx.challengeDependency.findMany({
    where: { sourceStageId: completedStageId, dependencyType: { in: ["REQUIRES", "UNLOCKS"] } },
  });
  // dependencies are modeled as source REQUIRES/UNLOCKS target; find stages whose prerequisite is this one.
  const dependents = await tx.challengeDependency.findMany({
    where: { targetStageId: completedStageId, dependencyType: "REQUIRES" },
  });
  void deps;

  const ci = await tx.challengeInstance.findMany({
    where: { campaignInstanceId },
    select: { stageId: true, status: true },
  });
  const statusByStage = new Map(ci.map((c) => [c.stageId, c.status]));

  for (const dep of dependents) {
    const dependentStageId = dep.sourceStageId;
    // all REQUIRES prerequisites of dependentStage must be COMPLETED
    const prereqs = await tx.challengeDependency.findMany({
      where: { sourceStageId: dependentStageId, dependencyType: "REQUIRES" },
    });
    const allMet = prereqs.every((p) => statusByStage.get(p.targetStageId) === "COMPLETED");
    if (!allMet) continue;
    const current = await tx.challengeInstance.findUnique({
      where: { campaignInstanceId_stageId: { campaignInstanceId, stageId: dependentStageId } },
    });
    if (current && current.status === "LOCKED") {
      await tx.challengeInstance.update({
        where: { id: current.id },
        data: { status: "AVAILABLE", unlockedAt: new Date() },
      });
      await emitEvent(
        {
          campaignInstanceId,
          type: EventType.STAGE_UNLOCKED,
          payload: { stageId: dependentStageId },
          idempotencyKey: `unlocked:${campaignInstanceId}:${dependentStageId}`,
        },
        tx,
      );
    }
  }
}

/** Apply the completed stage's manifest onComplete effects stored in stage.configJson. */
async function applyOnComplete(tx: Tx, campaignInstanceId: string, stageId: string): Promise<void> {
  const stage = await tx.challengeStage.findUnique({ where: { id: stageId } });
  if (!stage) return;
  const config = stage.configJson as { onComplete?: Array<Record<string, string>>; startsServices?: string[] };
  const effects = config.onComplete ?? [];
  const services = effects.filter((e) => e.startService).map((e) => e.startService);
  if (services.length) {
    const env = await tx.environmentInstance.findUnique({ where: { campaignInstanceId } });
    if (env) {
      const meta = (env.metadataJson as { services?: string[] }) ?? {};
      const merged = Array.from(new Set([...(meta.services ?? []), ...services]));
      await tx.environmentInstance.update({ where: { id: env.id }, data: { metadataJson: { ...meta, services: merged } } });
      for (const svc of services) {
        await emitEvent(
          { campaignInstanceId, type: EventType.SERVICE_STARTED, payload: { service: svc }, idempotencyKey: `svc:${campaignInstanceId}:${svc}` },
          tx,
        );
      }
    }
  }
}
