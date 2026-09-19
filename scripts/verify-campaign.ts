/** Generic verify: start a student's instance for <slug>, solve its first value stage, confirm unlock. */
import { PrismaClient } from "@prisma/client";
import { startCampaignInstance } from "../src/lib/campaign/bootstrap";
import { drainJobs } from "../src/lib/events/drain";
import { loadSeedContext } from "../src/lib/seed/context";
import { createSubmission } from "../src/lib/services/student";
import { campaignRuntime } from "../src/lib/campaigns/registry";

const prisma = new PrismaClient();

async function drainAll() {
  for (let i = 0; i < 12; i++) if ((await drainJobs(20)) === 0) break;
}

async function main() {
  const slug = process.argv[2];
  const firstStage = process.argv[3];
  const nextStage = process.argv[4];
  const student = await prisma.profile.findUniqueOrThrow({ where: { email: "student1@range.local" } });
  const ci = await prisma.campaignInstance.findFirstOrThrow({
    where: { studentId: student.id, campaignVersion: { campaign: { slug } } },
  });
  await startCampaignInstance(ci.id);
  await drainAll();

  const ctx = await loadSeedContext(ci.id);
  const plan = campaignRuntime(slug).deriveGrading(firstStage, ctx);
  if (plan.kind !== "value") throw new Error(`${firstStage} is not a value stage`);
  const first = await prisma.challengeInstance.findFirstOrThrow({ where: { campaignInstanceId: ci.id, stage: { slug: firstStage } } });
  const subId = await createSubmission({ challengeInstanceId: first.id, studentId: student.id, type: "VALUE", payload: { value: plan.expected } });
  await drainAll();

  const sub = await prisma.submission.findUniqueOrThrow({ where: { id: subId } });
  const nxt = await prisma.challengeInstance.findFirstOrThrow({ where: { campaignInstanceId: ci.id, stage: { slug: nextStage } } });
  const firstAfter = await prisma.challengeInstance.findUniqueOrThrow({ where: { id: first.id } });
  console.log(`${slug}: ${firstStage}=${firstAfter.status} sub=${sub.status} → ${nextStage}=${nxt.status} (answer ${plan.expected})`);

  // sanity: derive all stages' plans without error
  const stages = await prisma.challengeStage.findMany({ where: { campaignVersion: { campaign: { slug }, instances: { some: { id: ci.id } } } } });
  for (const s of stages) {
    const p = campaignRuntime(slug).deriveGrading(s.slug, ctx);
    console.log(`  ${s.slug}: ${p.kind}`);
  }

  const pass = sub.status === "PASSED" && firstAfter.status === "COMPLETED" && nxt.status === "AVAILABLE";
  console.log(pass ? "PASS" : "FAIL");
  process.exit(pass ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.stack : e);
  await prisma.$disconnect();
  process.exit(1);
});
