import { z } from "zod";

/**
 * Zod schemas for the campaign manifest format (apiVersion: cyberrange/v1).
 *
 * These schemas define the on-disk YAML shape for a campaign manifest and
 * are the single source of truth for the inferred TypeScript types used
 * throughout the campaign loader/validator.
 */

export const API_VERSION = "cyberrange/v1" as const;

export const DifficultySchema = z.enum(["beginner", "intermediate", "advanced", "expert"]);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const CompletionTypeSchema = z.enum(["value", "code", "finding", "environment_state", "file"]);
export type CompletionType = z.infer<typeof CompletionTypeSchema>;

export const ArtifactTypeSchema = z.enum([
  "file",
  "pcap",
  "binary",
  "source",
  "memory_dump",
  "disk_image",
  "database",
  "git_repository",
  "log_archive",
  "configuration",
  "other",
]);
export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;

export const ServiceSchema = z.object({
  name: z.string().min(1),
  startsLockedUntil: z.string().min(1).optional(),
});
export type ServiceManifest = z.infer<typeof ServiceSchema>;

export const WorkstationSchema = z.object({
  image: z.string().min(1),
  services: z.array(ServiceSchema).optional(),
});
export type WorkstationManifest = z.infer<typeof WorkstationSchema>;

export const EnvironmentSchema = z.object({
  workstation: WorkstationSchema,
});
export type EnvironmentManifest = z.infer<typeof EnvironmentSchema>;

export const CampaignMetaSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug must be lowercase kebab-case"),
  name: z.string().min(1),
  description: z.string().min(1),
  estimatedHours: z.number().positive(),
  difficulty: DifficultySchema,
});
export type CampaignMeta = z.infer<typeof CampaignMetaSchema>;

export const CompletionSchema = z.object({
  type: CompletionTypeSchema,
  grader: z.string().min(1).optional(),
});
export type CompletionManifest = z.infer<typeof CompletionSchema>;

export const VisibilitySchema = z.object({
  default: z.boolean().default(false),
});
export type VisibilityManifest = z.infer<typeof VisibilitySchema>;

export const ArtifactSchema = z.object({
  id: z.string().min(1),
  type: ArtifactTypeSchema,
  generator: z.string().min(1),
});
export type ArtifactManifest = z.infer<typeof ArtifactSchema>;

export const HintSchema = z.object({
  level: z.int().positive(),
  penalty: z.number().min(0),
  content: z.string().min(1),
});
export type HintManifest = z.infer<typeof HintSchema>;

export const EvidenceSchema = z.object({
  required: z.array(z.string().min(1)).optional(),
});
export type EvidenceManifest = z.infer<typeof EvidenceSchema>;

export const OnCompleteActionSchema = z
  .object({
    unlock: z.string().min(1).optional(),
    emit: z.string().min(1).optional(),
    startService: z.string().min(1).optional(),
  })
  .refine((v) => v.unlock !== undefined || v.emit !== undefined || v.startService !== undefined, {
    message: "onComplete entry must specify one of: unlock, emit, startService",
  });
export type OnCompleteAction = z.infer<typeof OnCompleteActionSchema>;

export const StageManifestSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    points: z.number().nonnegative(),
    estimatedMinutes: z.number().positive(),
    completion: CompletionSchema,
    visibility: VisibilitySchema.default({ default: false }),
    requires: z.array(z.string().min(1)).optional(),
    artifacts: z.array(ArtifactSchema).optional(),
    hints: z.array(HintSchema).optional(),
    evidence: EvidenceSchema.optional(),
    onComplete: z.array(OnCompleteActionSchema).optional(),
  })
  .refine(
    (stage) => {
      if (!stage.hints || stage.hints.length === 0) return true;
      const levels = stage.hints.map((h) => h.level);
      return new Set(levels).size === levels.length;
    },
    { message: "hint levels must be unique within a stage" },
  );
export type StageManifest = z.infer<typeof StageManifestSchema>;

export const ManifestSchema = z.object({
  apiVersion: z.literal(API_VERSION),
  campaign: CampaignMetaSchema,
  environment: EnvironmentSchema,
  stages: z.array(StageManifestSchema).min(1),
});
export type Manifest = z.infer<typeof ManifestSchema>;
