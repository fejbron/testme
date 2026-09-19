import { prisma } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { createSeedContext, type SeedContext } from "./index";
import { openSeed } from "./seal";

/**
 * Load the per-student root SeedContext for a campaign instance. Server-only, used by
 * trusted generator/grader code paths. The raw seed never leaves this boundary.
 * Salt = campaign version manifestHash so (seed, version) reproduces the environment.
 */
export async function loadSeedContext(campaignInstanceId: string): Promise<SeedContext> {
  const instance = await prisma.campaignInstance.findUnique({
    where: { id: campaignInstanceId },
    include: { seed: true, campaignVersion: true },
  });
  if (!instance?.seed) throw new Error("seed not initialized for instance");
  const key = serverEnv().SEED_ENC_KEY;
  if (!key) throw new Error("SEED_ENC_KEY not configured");
  const rootSeed = openSeed(instance.seed.encryptedSeed, key);
  return createSeedContext(rootSeed, instance.campaignVersion.manifestHash).namespace(`campaign:${instance.campaignVersion.campaignId}`);
}
