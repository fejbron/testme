import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { canViewCampaignInstance } from "@/lib/auth/policies";
import { prisma } from "@/lib/db";
import { signedDownloadUrl } from "@/lib/storage";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await ctx.params;
  const ai = await prisma.artifactInstance.findUnique({ where: { id }, include: { campaignInstance: true, challengeInstance: true } });
  if (!ai) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!canViewCampaignInstance(user.profile, ai.campaignInstance.studentId)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // Owner may only download once the owning stage is unlocked.
  if (user.profile.id === ai.campaignInstance.studentId && ai.challengeInstance && ai.challengeInstance.status === "LOCKED") {
    return NextResponse.json({ error: "locked" }, { status: 403 });
  }
  const url = await signedDownloadUrl(ai.storageUri, 120);
  await audit({ actorId: user.profile.id, action: "artifact.download", targetType: "artifactInstance", targetId: id });
  return NextResponse.redirect(url, { status: 307 });
}
