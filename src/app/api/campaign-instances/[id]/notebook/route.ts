import { z } from "zod";
import { route, readJson } from "@/lib/api/handler";
import { loadViewableInstance, loadControllableInstance } from "@/lib/api/access";
import { listNotebook, createNotebook } from "@/lib/services/student";

export const runtime = "nodejs";

const Body = z.object({
  type: z.enum(["OBSERVATION", "HYPOTHESIS", "EXPERIMENT", "RESULT", "CONCLUSION", "NOTE"]),
  title: z.string().min(1).max(200),
  content: z.string().max(20000).default(""),
  confidence: z.string().optional(),
  links: z.record(z.string(), z.unknown()).optional(),
});

export const GET = route(async ({ user, params }) => {
  await loadViewableInstance(user, params.id);
  return { entries: await listNotebook(params.id) };
});

export const POST = route(async ({ user, req, params }) => {
  await loadControllableInstance(user, params.id);
  const b = Body.parse(await readJson(req));
  return createNotebook({ campaignInstanceId: params.id, studentId: user.profile.id, ...b });
});
