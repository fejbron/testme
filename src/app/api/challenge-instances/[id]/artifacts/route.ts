import { route } from "@/lib/api/handler";
import { loadViewableChallenge } from "@/lib/api/access";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export const GET = route(async ({ user, params }) => {
  const ch = await loadViewableChallenge(user, params.id);
  const templates = await prisma.artifact.findMany({ where: { stageId: ch.stageId } });
  const instances = await prisma.artifactInstance.findMany({
    where: { campaignInstanceId: ch.campaignInstanceId, artifactId: { in: templates.map((t) => t.id) } },
  });
  const byArtifact = new Map(instances.map((i) => [i.artifactId, i]));
  return {
    artifacts: templates.map((t) => {
      const inst = byArtifact.get(t.id);
      return { id: inst?.id ?? null, slug: t.slug, kind: t.kind, sha256: inst?.sha256 ?? null, sizeBytes: inst?.sizeBytes ?? 0, ready: !!inst };
    }),
  };
});
