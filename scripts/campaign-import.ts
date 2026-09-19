/**
 * Validate and import a campaign package into the database as an immutable version.
 * Usage: node scripts/run-with-env.mjs scripts/campaign-import.ts challenges/janus
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { parseManifest } from "../src/lib/campaign/load";
import { importCampaign, CampaignImportError } from "../src/lib/campaign/import";
import { campaignRuntime } from "../src/lib/campaigns/registry";

const prisma = new PrismaClient();

async function main() {
  const dir = process.argv[2] ?? "challenges/janus";
  const abs = resolve(process.cwd(), dir);
  const yamlText = readFileSync(join(abs, "campaign.yaml"), "utf8");

  const slug = parseManifest(yamlText).campaign.slug;
  const knownGenerators = Object.keys(campaignRuntime(slug).generators);

  const author = await prisma.profile.findUnique({ where: { email: "admin@range.local" } });
  if (!author) throw new Error("author admin@range.local not found — run the seed first");

  const res = await importCampaign(prisma, { yamlText, authorId: author.id, knownGenerators });
  if (res.alreadyImported) console.log(`${res.slug} v${res.version} already imported (hash ${res.manifestHash.slice(0, 12)}); nothing to do`);
  else console.log(`imported ${res.slug} v${res.version} (${res.stageCount} stages, hash ${res.manifestHash.slice(0, 12)})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    if (e instanceof CampaignImportError) {
      for (const i of e.issues) console.error(`  ERROR [${i.code}] ${i.stage ?? ""} ${i.message}`);
    }
    console.error(e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
