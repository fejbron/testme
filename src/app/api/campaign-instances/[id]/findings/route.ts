import { route } from "@/lib/api/handler";
import { loadViewableInstance } from "@/lib/api/access";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export const GET = route(async ({ user, params }) => {
  await loadViewableInstance(user, params.id);
  return { findings: await prisma.finding.findMany({ where: { campaignInstanceId: params.id }, orderBy: { createdAt: "desc" } }) };
});
