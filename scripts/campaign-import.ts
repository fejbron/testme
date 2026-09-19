/**
 * Validate and import a campaign package into the database as an immutable version.
 * Usage: node scripts/run-with-env.mjs scripts/campaign-import.ts challenges/janus
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PrismaClient, type CompletionType } from "@prisma/client";
import { parseManifest } from "../src/lib/campaign/load";
import { validateCampaign } from "../src/lib/campaign/validate";
import { manifestHash } from "../src/lib/campaign/hash";
import type { Manifest, StageManifest } from "../src/lib/campaign/schema";

const prisma = new PrismaClient();

const KNOWN_GRADERS = [
  // janus
  "marker-check",
  "protocol-class",
  "frame-fields",
  "decoder",
  "archive-fragment",
  "patch-regression",
  "config-open",
  "cluster-health",
  // gauntlet
  "cipher-open",
  "vault-open",
  "stego-find",
  "ledger-walk",
  "vm-interp",
  "log-forensics",
];
const KNOWN_GENERATORS = [
  // janus
  "filesystem",
  "pcap",
  "gitrepo",
  "cservice",
  "config",
  // gauntlet
  "cipherchain",
  "vault",
  "stego",
  "ledger",
  "stackvm",
  "injection",
];

const COMPLETION_MAP: Record<string, CompletionType> = {
  value: "VALUE",
  code: "CODE",
  finding: "FINDING",
  environment_state: "ENVIRONMENT_STATE",
  file: "FILE",
};

const ARTIFACT_KIND_MAP: Record<string, string> = {
  file: "FILE",
  pcap: "PCAP",
  binary: "BINARY",
  source: "SOURCE",
  memory_dump: "MEMORY_DUMP",
  disk_image: "DISK_IMAGE",
  database: "DATABASE",
  git_repository: "GIT_REPOSITORY",
  log_archive: "LOG_ARCHIVE",
  configuration: "CONFIGURATION",
  other: "OTHER",
};

function stageOnComplete(stage: StageManifest): Record<string, unknown> {
  return { onComplete: stage.onComplete ?? [] };
}

async function main() {
  const dir = process.argv[2] ?? "challenges/janus";
  const abs = resolve(process.cwd(), dir);
  const yamlText = readFileSync(join(abs, "campaign.yaml"), "utf8");
  const manifest: Manifest = parseManifest(yamlText);

  const result = validateCampaign(manifest, { knownGraders: KNOWN_GRADERS, knownGenerators: KNOWN_GENERATORS });
  for (const w of result.warnings) console.warn(`  warn [${w.code}] ${w.stage ?? ""} ${w.message}`);
  if (!result.ok) {
    for (const e of result.errors) console.error(`  ERROR [${e.code}] ${e.stage ?? ""} ${e.message}`);
    throw new Error(`campaign validation failed with ${result.errors.length} error(s)`);
  }

  const hash = manifestHash(manifest);
  const authorEmail = "admin@range.local";
  const author = await prisma.profile.findUnique({ where: { email: authorEmail } });
  if (!author) throw new Error(`author ${authorEmail} not found — run the seed first`);

  await prisma.$transaction(async (tx) => {
    const campaign = await tx.campaign.upsert({
      where: { slug: manifest.campaign.slug },
      update: {
        name: manifest.campaign.name,
        description: manifest.campaign.description ?? "",
        estimatedHours: manifest.campaign.estimatedHours ?? 8,
        difficulty: manifest.campaign.difficulty ?? "advanced",
        status: "PUBLISHED",
      },
      create: {
        slug: manifest.campaign.slug,
        name: manifest.campaign.name,
        description: manifest.campaign.description ?? "",
        estimatedHours: manifest.campaign.estimatedHours ?? 8,
        difficulty: manifest.campaign.difficulty ?? "advanced",
        status: "PUBLISHED",
        createdById: author.id,
      },
    });

    const existing = await tx.campaignVersion.findFirst({ where: { campaignId: campaign.id, manifestHash: hash } });
    if (existing) {
      console.log(`version with hash ${hash.slice(0, 12)} already imported (v${existing.version}); nothing to do`);
      return;
    }
    const last = await tx.campaignVersion.findFirst({ where: { campaignId: campaign.id }, orderBy: { version: "desc" } });
    const version = (last?.version ?? 0) + 1;

    const cv = await tx.campaignVersion.create({
      data: { campaignId: campaign.id, version, manifestHash: hash, manifestJson: manifest as object },
    });

    // Stages
    const stageIdBySlug = new Map<string, string>();
    for (const stage of manifest.stages) {
      const row = await tx.challengeStage.create({
        data: {
          campaignVersionId: cv.id,
          slug: stage.id,
          title: stage.title,
          description: stage.description ?? "",
          estimatedMinutes: stage.estimatedMinutes ?? 60,
          points: stage.points ?? 100,
          completionType: COMPLETION_MAP[stage.completion.type],
          graderName: stage.completion.grader ?? null,
          visibleByDefault: stage.visibility?.default ?? false,
          configJson: stageOnComplete(stage) as object,
        },
      });
      stageIdBySlug.set(stage.id, row.id);

      for (const h of stage.hints ?? []) {
        await tx.hint.create({ data: { stageId: row.id, level: h.level, content: h.content, pointPenalty: h.penalty } });
      }
      for (const a of stage.artifacts ?? []) {
        await tx.artifact.create({
          data: {
            campaignVersionId: cv.id,
            stageId: row.id,
            slug: a.id,
            kind: ARTIFACT_KIND_MAP[a.type] as never,
            generatorName: a.generator,
          },
        });
      }
    }

    // Dependencies: dependent REQUIRES prerequisite (source=dependent, target=prereq)
    for (const stage of manifest.stages) {
      for (const reqSlug of stage.requires ?? []) {
        await tx.challengeDependency.create({
          data: {
            sourceStageId: stageIdBySlug.get(stage.id)!,
            targetStageId: stageIdBySlug.get(reqSlug)!,
            dependencyType: "REQUIRES",
          },
        });
      }
    }

    console.log(`imported ${manifest.campaign.slug} v${version} (${manifest.stages.length} stages, hash ${hash.slice(0, 12)})`);
  }, { timeout: 60_000, maxWait: 15_000 });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
