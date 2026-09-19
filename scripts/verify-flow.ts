/** End-to-end sanity check of the progression engine against the live DB. */
import { PrismaClient } from "@prisma/client";
import { startCampaignInstance } from "../src/lib/campaign/bootstrap";
import { drainJobs } from "../src/lib/events/drain";
import { loadSeedContext } from "../src/lib/seed/context";
import { deriveGrading } from "../src/lib/grading/janus";
import { createSubmission } from "../src/lib/services/student";

const prisma = new PrismaClient();

async function drainAll(label: string) {
  let total = 0;
  for (let i = 0; i < 10; i++) {
    const n = await drainJobs(20);
    total += n;
    if (n === 0) break;
  }
  console.log(`  drained ${total} jobs (${label})`);
}

async function main() {
  const student = await prisma.profile.findUniqueOrThrow({ where: { email: "student1@range.local" } });
  const ci = await prisma.campaignInstance.findFirstOrThrow({ where: { studentId: student.id } });
  console.log(`instance ${ci.id}`);

  await startCampaignInstance(ci.id);
  await drainAll("after start");

  // first-light is value + visible by default
  const first = await prisma.challengeInstance.findFirstOrThrow({ where: { campaignInstanceId: ci.id, stage: { slug: "first-light" } }, include: { stage: true } });
  console.log(`first-light status: ${first.status}`);

  const ctx = await loadSeedContext(ci.id);
  const plan = deriveGrading("first-light", ctx);
  if (plan.kind !== "value") throw new Error("expected value plan");
  console.log(`derived expected marker: ${plan.expected}`);

  const subId = await createSubmission({ challengeInstanceId: first.id, studentId: student.id, type: "VALUE", payload: { value: plan.expected } });
  await drainAll("after submit");

  const sub = await prisma.submission.findUniqueOrThrow({ where: { id: subId } });
  console.log(`submission status: ${sub.status}, score ${sub.scoreAwarded}`);

  const firstAfter = await prisma.challengeInstance.findUniqueOrThrow({ where: { id: first.id } });
  const relay = await prisma.challengeInstance.findFirstOrThrow({ where: { campaignInstanceId: ci.id, stage: { slug: "silent-relay" } } });
  console.log(`first-light after: ${firstAfter.status} | silent-relay: ${relay.status}`);

  const scoreEvents = await prisma.scoreEvent.findMany({ where: { campaignInstanceId: ci.id } });
  const total = scoreEvents.reduce((a, e) => a + e.delta, 0);
  const artifacts = await prisma.artifactInstance.count({ where: { campaignInstanceId: ci.id } });
  console.log(`score total: ${total} | artifact instances: ${artifacts}`);

  const pass = sub.status === "PASSED" && firstAfter.status === "COMPLETED" && relay.status === "AVAILABLE";
  console.log(pass ? "\nPASS: submit → grade → complete → unlock works" : "\nFAIL: progression did not advance as expected");
  process.exit(pass ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.stack : e);
  await prisma.$disconnect();
  process.exit(1);
});
