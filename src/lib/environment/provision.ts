import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { loadSeedContext } from "@/lib/seed/context";
import { campaignRuntime } from "@/lib/campaigns/registry";
import { uploadArtifact, ensureBucket, safeObjectKey } from "@/lib/storage";
import { createSandboxProvider } from "@/lib/sandbox/provider";
import type { SeededFile } from "@/lib/sandbox/types";
import { emitEvent } from "@/lib/events/emit";
import { EventType } from "@/lib/events/types";
import { log } from "@/lib/observability/logger";

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

interface GeneratedArtifact {
  artifactId: string;
  slug: string;
  files: { path: string; content: Buffer; sha256: string }[];
}

/** Run every campaign artifact's generator with the instance seed; returns files (in-memory). */
async function generateAll(campaignInstanceId: string): Promise<{ artifacts: GeneratedArtifact[]; workstationFiles: SeededFile[] }> {
  const instance = await prisma.campaignInstance.findUniqueOrThrow({
    where: { id: campaignInstanceId },
    include: { campaignVersion: { include: { artifacts: true, campaign: true } } },
  });
  const ctx = await loadSeedContext(campaignInstanceId);
  const { generators } = campaignRuntime(instance.campaignVersion.campaign.slug);

  const artifacts: GeneratedArtifact[] = [];
  const workstationFiles: SeededFile[] = [];

  for (const artifact of instance.campaignVersion.artifacts) {
    if (!artifact.generatorName) continue;
    const gen = generators[artifact.generatorName];
    if (!gen) {
      log.warn("missing generator", { campaignInstanceId }, { generator: artifact.generatorName });
      continue;
    }
    const files: { path: string; content: Buffer; sha256: string }[] = [];
    gen(ctx, {
      file: (path: string, content: Buffer) => {
        files.push({ path, content, sha256: sha256(content) });
        workstationFiles.push({ path, contentBase64: content.toString("base64") });
      },
    });
    artifacts.push({ artifactId: artifact.id, slug: artifact.slug, files });
  }

  // Final-stage reconstruction puzzle scaffold (student writes the recovered marker into solution).
  workstationFiles.push({
    path: "reconstruction/README.txt",
    contentBase64: Buffer.from(
      "Repair the service: write the recovered configuration marker into ./solution, then verify.\n",
      "utf8",
    ).toString("base64"),
  });

  return { artifacts, workstationFiles };
}

/** Persist generated artifacts to object storage and upsert ArtifactInstance rows. */
async function storeArtifacts(campaignInstanceId: string, generated: GeneratedArtifact[]): Promise<void> {
  await ensureBucket().catch((e) => log.warn("ensureBucket failed", { campaignInstanceId }, { message: String(e) }));
  for (const g of generated) {
    if (g.files.length === 0) continue;
    const stored: { path: string; key: string; sha256: string; size: number }[] = [];
    for (const f of g.files) {
      const key = safeObjectKey(campaignInstanceId, g.slug, f.path);
      await uploadArtifact(key, f.content);
      stored.push({ path: f.path, key, sha256: f.sha256, size: f.content.byteLength });
    }
    const primary = stored[0];
    await prisma.artifactInstance.upsert({
      where: { artifactId_campaignInstanceId: { artifactId: g.artifactId, campaignInstanceId } },
      update: { storageUri: primary.key, sha256: primary.sha256, sizeBytes: primary.size, metadataJson: { files: stored } },
      create: {
        artifactId: g.artifactId,
        campaignInstanceId,
        storageUri: primary.key,
        sha256: primary.sha256,
        sizeBytes: primary.size,
        metadataJson: { files: stored },
      },
    });
    await emitEvent({ campaignInstanceId, type: EventType.ARTIFACT_GENERATED, payload: { slug: g.slug }, idempotencyKey: `artifact:${campaignInstanceId}:${g.slug}` });
  }
}

/**
 * Provision a student's environment: deterministically generate + store their personalized
 * artifacts, then best-effort boot an isolated workstation microVM with the seeded filesystem.
 * Artifact availability does not depend on the sandbox (so the campaign works even if the
 * Sandbox runtime is unavailable on the current plan).
 */
export async function provisionEnvironment(campaignInstanceId: string): Promise<void> {
  const env = await prisma.environmentInstance.upsert({
    where: { campaignInstanceId },
    update: { status: "PROVISIONING" },
    create: { campaignInstanceId, status: "PROVISIONING" },
  });

  const { artifacts, workstationFiles } = await generateAll(campaignInstanceId);
  await storeArtifacts(campaignInstanceId, artifacts);

  const name = `ws-${campaignInstanceId}`.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60);
  try {
    const provider = createSandboxProvider();
    await provider.provision({ name, vcpus: 1, timeoutMs: 45 * 60_000, files: workstationFiles });
    await prisma.environmentInstance.update({
      where: { id: env.id },
      data: { status: "RUNNING", externalRef: name, startedAt: new Date(), expiresAt: new Date(Date.now() + 45 * 60_000) },
    });
  } catch (err) {
    // Workstation VM unavailable — artifacts are still generated & downloadable.
    log.warn("workstation provisioning failed", { campaignInstanceId, environmentInstanceId: env.id }, { message: err instanceof Error ? err.message : String(err) });
    await prisma.environmentInstance.update({
      where: { id: env.id },
      data: { status: "FAILED", externalRef: null, metadataJson: { note: "workstation unavailable; artifacts generated" } },
    });
  }
}

/** Generate a single artifact instance on demand (GENERATE_ARTIFACT job). */
export async function generateArtifactInstance(artifactInstanceId: string): Promise<void> {
  const ai = await prisma.artifactInstance.findUnique({ where: { id: artifactInstanceId } });
  if (!ai) return;
  await provisionEnvironment(ai.campaignInstanceId);
}

export async function startEnvironment(campaignInstanceId: string): Promise<void> {
  const env = await prisma.environmentInstance.findUnique({ where: { campaignInstanceId } });
  if (env?.externalRef && env.status !== "FAILED") {
    const provider = createSandboxProvider();
    await provider.start(env.externalRef);
    await prisma.environmentInstance.update({ where: { id: env.id }, data: { status: "RUNNING", startedAt: new Date() } });
  } else {
    await provisionEnvironment(campaignInstanceId);
  }
}

export async function stopEnvironment(campaignInstanceId: string): Promise<void> {
  const env = await prisma.environmentInstance.findUnique({ where: { campaignInstanceId } });
  if (env?.externalRef) {
    const provider = createSandboxProvider();
    await provider.stop(env.externalRef).catch(() => {});
    await prisma.environmentInstance.update({ where: { id: env.id }, data: { status: "STOPPED", stoppedAt: new Date() } });
  }
}

/** Reset environment: destroy + regenerate deterministically from the SAME seed (spec §35). */
export async function resetEnvironment(campaignInstanceId: string): Promise<void> {
  const env = await prisma.environmentInstance.findUnique({ where: { campaignInstanceId } });
  if (env?.externalRef) {
    const provider = createSandboxProvider();
    await provider.destroy(env.externalRef).catch(() => {});
  }
  await emitEvent({ campaignInstanceId, type: EventType.ENVIRONMENT_RESET, idempotencyKey: `reset:${campaignInstanceId}:${Date.now()}` });
  await provisionEnvironment(campaignInstanceId);
}
