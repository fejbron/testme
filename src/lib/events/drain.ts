import { prisma } from "@/lib/db";
import { JobType } from "./types";
import { processEvent } from "./handlers";
import { log } from "@/lib/observability/logger";

interface ClaimedJob {
  id: string;
  type: string;
  payloadJson: unknown;
  attempts: number;
  maxAttempts: number;
}

/** Claim up to `limit` due jobs atomically with FOR UPDATE SKIP LOCKED (spec §16). */
async function claimJobs(limit: number): Promise<ClaimedJob[]> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<ClaimedJob[]>(
      `SELECT id, type, "payloadJson", attempts, "maxAttempts"
         FROM "Job"
        WHERE status = 'QUEUED' AND "runAfter" <= now()
        ORDER BY "runAfter" ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED`,
      limit,
    );
    if (rows.length) {
      await tx.job.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { status: "RUNNING", lockedAt: new Date() },
      });
    }
    return rows;
  });
}

async function runJob(job: ClaimedJob): Promise<void> {
  const payload = (job.payloadJson ?? {}) as Record<string, unknown>;
  switch (job.type) {
    case JobType.PROCESS_EVENT:
      await processEvent(String(payload.eventId));
      break;
    case JobType.GRADE_SUBMISSION: {
      const mod = await import("@/lib/grading/execute");
      await mod.executeGrading(String(payload.submissionId));
      break;
    }
    case JobType.PROVISION_ENVIRONMENT: {
      const mod = await import("@/lib/environment/provision");
      await mod.provisionEnvironment(String(payload.campaignInstanceId));
      break;
    }
    case JobType.GENERATE_ARTIFACT: {
      const mod = await import("@/lib/environment/provision");
      await mod.generateArtifactInstance(String(payload.artifactInstanceId));
      break;
    }
    default:
      throw new Error(`unknown job type ${job.type}`);
  }
}

/** Drain due jobs. Returns count processed. Safe to call from cron and inline waitUntil. */
export async function drainJobs(limit = 10): Promise<number> {
  const jobs = await claimJobs(limit);
  let done = 0;
  for (const job of jobs) {
    try {
      await runJob(job);
      await prisma.job.update({ where: { id: job.id }, data: { status: "DONE" } });
      done++;
    } catch (err) {
      const attempts = job.attempts + 1;
      const dead = attempts >= job.maxAttempts;
      const backoffMs = Math.min(60_000, 1000 * 2 ** attempts);
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: dead ? "DEAD" : "QUEUED",
          attempts,
          lastError: err instanceof Error ? err.message.slice(0, 500) : String(err),
          runAfter: new Date(Date.now() + backoffMs),
          lockedAt: null,
        },
      });
      log.error("job failed", { jobId: job.id }, { type: job.type, attempts, dead });
    }
  }
  return done;
}
