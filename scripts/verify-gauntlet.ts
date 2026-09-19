/** Verify the Gauntlet campaign: start, solve cipher-drift (value), unlock vault-run; sanity-check other plans. */
import { PrismaClient } from "@prisma/client";
import { startCampaignInstance } from "../src/lib/campaign/bootstrap";
import { drainJobs } from "../src/lib/events/drain";
import { loadSeedContext } from "../src/lib/seed/context";
import { deriveGrading } from "../src/lib/grading/gauntlet";
import { createSubmission } from "../src/lib/services/student";

const prisma = new PrismaClient();

async function drainAll() {
  for (let i = 0; i < 12; i++) {
    if ((await drainJobs(20)) === 0) break;
  }
}

async function main() {
  const student = await prisma.profile.findUniqueOrThrow({ where: { email: "student2@range.local" } });
  const ci = await prisma.campaignInstance.findFirstOrThrow({
    where: { studentId: student.id, campaignVersion: { campaign: { slug: "gauntlet" } } },
  });
  console.log(`gauntlet instance ${ci.id}`);

  await startCampaignInstance(ci.id);
  await drainAll();

  const ctx = await loadSeedContext(ci.id);

  // cipher-drift (value)
  const first = await prisma.challengeInstance.findFirstOrThrow({ where: { campaignInstanceId: ci.id, stage: { slug: "cipher-drift" } } });
  const plan = deriveGrading("cipher-drift", ctx);
  if (plan.kind !== "value") throw new Error("expected value");
  console.log(`cipher-drift status ${first.status}; marker ${plan.expected}`);
  const subId = await createSubmission({ challengeInstanceId: first.id, studentId: student.id, type: "VALUE", payload: { value: plan.expected } });
  await drainAll();
  const sub = await prisma.submission.findUniqueOrThrow({ where: { id: subId } });
  const vault = await prisma.challengeInstance.findFirstOrThrow({ where: { campaignInstanceId: ci.id, stage: { slug: "vault-run" } } });
  console.log(`submission ${sub.status}; vault-run now ${vault.status}`);

  // sanity-check the other plans derive without error
  for (const slug of ["vault-run", "hidden-pixels", "the-ledger", "machine-code", "trace"]) {
    const p = deriveGrading(slug, ctx);
    const detail =
      p.kind === "value" ? `value(${p.expected.slice(0, 12)}…)` :
      p.kind === "finding" ? `finding(${p.spec.fields.map((f) => f.key).join(",")})` :
      p.kind === "code" ? `code(${p.spec.testGroups.length} groups)` : `env(${p.checks.length})`;
    console.log(`  ${slug}: ${p.kind} → ${detail}`);
  }

  const pass = sub.status === "PASSED" && first.status !== "LOCKED" && vault.status === "AVAILABLE";
  console.log(pass ? "\nPASS: gauntlet grade + unlock works" : "\nFAIL");
  process.exit(pass ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.stack : e);
  await prisma.$disconnect();
  process.exit(1);
});
