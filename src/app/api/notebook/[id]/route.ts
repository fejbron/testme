import { z } from "zod";
import { route, readJson, ApiError } from "@/lib/api/handler";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const Patch = z.object({ title: z.string().max(200).optional(), content: z.string().max(20000).optional(), confidence: z.string().optional() });

async function owned(userId: string, id: string) {
  const entry = await prisma.notebookEntry.findUnique({ where: { id } });
  if (!entry) throw new ApiError(404, "not found");
  if (entry.studentId !== userId) throw new ApiError(403, "forbidden");
  return entry;
}

export const PATCH = route(async ({ user, req, params }) => {
  await owned(user.profile.id, params.id);
  const b = Patch.parse(await readJson(req));
  return prisma.notebookEntry.update({ where: { id: params.id }, data: b });
});

export const DELETE = route(async ({ user, params }) => {
  await owned(user.profile.id, params.id);
  await prisma.notebookEntry.delete({ where: { id: params.id } });
  return { ok: true };
});
