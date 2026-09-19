import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { JobType } from "./types";

type Tx = PrismaClient | Prisma.TransactionClient;

/**
 * Emit a domain event idempotently and enqueue a PROCESS_EVENT job for it.
 * idempotencyKey makes re-emits safe (spec §16). Returns the event id (existing or new).
 */
export async function emitEvent(
  params: { campaignInstanceId: string; type: string; payload?: Record<string, unknown>; idempotencyKey: string },
  db: Tx = prisma,
): Promise<string> {
  const existing = await db.domainEvent.findUnique({ where: { idempotencyKey: params.idempotencyKey } });
  if (existing) return existing.id;

  const event = await db.domainEvent.create({
    data: {
      campaignInstanceId: params.campaignInstanceId,
      eventType: params.type,
      payloadJson: (params.payload ?? {}) as object,
      idempotencyKey: params.idempotencyKey,
    },
  });
  await enqueueJob({ type: JobType.PROCESS_EVENT, payload: { eventId: event.id }, idempotencyKey: `process:${event.id}` }, db);
  return event.id;
}

export async function enqueueJob(
  params: { type: string; payload?: Record<string, unknown>; idempotencyKey: string; runAfter?: Date },
  db: Tx = prisma,
): Promise<void> {
  await db.job.upsert({
    where: { idempotencyKey: params.idempotencyKey },
    update: {},
    create: {
      type: params.type,
      payloadJson: (params.payload ?? {}) as object,
      idempotencyKey: params.idempotencyKey,
      runAfter: params.runAfter ?? new Date(),
    },
  });
}
