import type { CompletionType, Prisma, PrismaClient } from "@prisma/client";
import { parseManifest } from "./load";
import { validateCampaign } from "./validate";
import { manifestHash } from "./hash";
import type { Manifest, StageManifest } from "./schema";

/** Grader names referenced by the shipped campaigns (used for manifest validation). */
export const KNOWN_GRADERS = [
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
  // bootcamp / fieldwork (generic)
  "text-answer",
  "log-finding",
  "script-check",
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

export interface ImportResult {
  slug: string;
  name: string;
  version: number;
  stageCount: number;
  manifestHash: string;
  alreadyImported: boolean;
}

export class CampaignImportError extends Error {
  constructor(
    message: string,
    public issues: { code: string; message: string; stage?: string }[] = [],
  ) {
    super(message);
    this.name = "CampaignImportError";
  }
}

/**
 * Validate a campaign manifest and publish it as an immutable version.
 * Shared by the CLI (`scripts/campaign-import.ts`) and the admin API.
 * `knownGenerators` should be the generator names available for this campaign's runtime.
 */
export async function importCampaign(
  prisma: PrismaClient,
  params: { yamlText: string; authorId: string; knownGenerators: string[] },
): Promise<ImportResult> {
  const manifest: Manifest = parseManifest(params.yamlText);

  const result = validateCampaign(manifest, { knownGraders: KNOWN_GRADERS, knownGenerators: params.knownGenerators });
  if (!result.ok) {
    throw new CampaignImportError(`validation failed with ${result.errors.length} error(s)`, result.errors);
  }

  const hash = manifestHash(manifest);

  return prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
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
          createdById: params.authorId,
        },
      });

      const existing = await tx.campaignVersion.findFirst({ where: { campaignId: campaign.id, manifestHash: hash } });
      if (existing) {
        return {
          slug: manifest.campaign.slug,
          name: manifest.campaign.name,
          version: existing.version,
          stageCount: manifest.stages.length,
          manifestHash: hash,
          alreadyImported: true,
        };
      }

      const last = await tx.campaignVersion.findFirst({ where: { campaignId: campaign.id }, orderBy: { version: "desc" } });
      const version = (last?.version ?? 0) + 1;

      const cv = await tx.campaignVersion.create({
        data: { campaignId: campaign.id, version, manifestHash: hash, manifestJson: manifest as object },
      });

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

      return {
        slug: manifest.campaign.slug,
        name: manifest.campaign.name,
        version,
        stageCount: manifest.stages.length,
        manifestHash: hash,
        alreadyImported: false,
      };
    },
    { timeout: 60_000, maxWait: 15_000 },
  );
}
