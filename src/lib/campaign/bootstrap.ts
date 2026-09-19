import { prisma } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { createRootSeed } from "@/lib/seed";
import { sealSeed } from "@/lib/seed/seal";
import { emitEvent, enqueueJob } from "@/lib/events/emit";
import { EventType, JobType } from "@/lib/events/types";

/** Ensure a student has a campaign instance for a given published version. */
export async function getOrCreateCampaignInstance(studentId: string, campaignVersionId: string): Promise<string> {
  const existing = await prisma.campaignInstance.findUnique({
    where: { campaignVersionId_studentId: { campaignVersionId, studentId } },
  });
  if (existing) return existing.id;
  const created = await prisma.campaignInstance.create({
    data: { studentId, campaignVersionId, status: "PENDING" },
  });
  return created.id;
}

/**
 * Start a campaign instance: mint + seal the per-student root seed, create challenge
 * instances (visible-by-default → AVAILABLE, else LOCKED), mark ACTIVE, emit CAMPAIGN_STARTED,
 * and enqueue environment provisioning. Idempotent.
 */
export async function startCampaignInstance(campaignInstanceId: string): Promise<void> {
  const instance = await prisma.campaignInstance.findUnique({
    where: { id: campaignInstanceId },
    include: { campaignVersion: { include: { stages: true } }, seed: true, challengeInstances: true },
  });
  if (!instance) throw new Error("campaign instance not found");

  await prisma.$transaction(async (tx) => {
    if (!instance.seed) {
      const key = serverEnv().SEED_ENC_KEY;
      if (!key) throw new Error("SEED_ENC_KEY not configured");
      const sealed = sealSeed(createRootSeed(), key);
      await tx.seed.create({ data: { campaignInstanceId, encryptedSeed: sealed } });
    }

    if (instance.challengeInstances.length === 0) {
      for (const stage of instance.campaignVersion.stages) {
        await tx.challengeInstance.create({
          data: {
            campaignInstanceId,
            stageId: stage.id,
            status: stage.visibleByDefault ? "AVAILABLE" : "LOCKED",
            unlockedAt: stage.visibleByDefault ? new Date() : null,
          },
        });
      }
    }

    if (instance.status === "PENDING") {
      await tx.campaignInstance.update({
        where: { id: campaignInstanceId },
        data: { status: "ACTIVE", startedAt: new Date() },
      });
    }

    await tx.environmentInstance.upsert({
      where: { campaignInstanceId },
      update: {},
      create: { campaignInstanceId, status: "PENDING" },
    });

    await emitEvent(
      { campaignInstanceId, type: EventType.CAMPAIGN_STARTED, idempotencyKey: `started:${campaignInstanceId}` },
      tx,
    );
    await enqueueJob(
      { type: JobType.PROVISION_ENVIRONMENT, payload: { campaignInstanceId }, idempotencyKey: `provision:${campaignInstanceId}` },
      tx,
    );
  });
}
