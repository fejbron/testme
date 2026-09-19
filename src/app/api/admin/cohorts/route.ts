import { z } from "zod";
import { route, readJson, ApiError } from "@/lib/api/handler";
import { isAdmin } from "@/lib/auth/policies";
import { listCohorts, createCohort } from "@/lib/services/admin";

export const runtime = "nodejs";

const Body = z.object({ courseId: z.string().min(1), name: z.string().min(1).max(120) });

export const GET = route(async ({ user }) => {
  if (!isAdmin(user.profile)) throw new ApiError(403, "forbidden");
  return { courses: await listCohorts() };
});

export const POST = route(async ({ user, req }) => {
  if (!isAdmin(user.profile)) throw new ApiError(403, "forbidden");
  const b = Body.parse(await readJson(req));
  return createCohort(b.courseId, b.name);
});
