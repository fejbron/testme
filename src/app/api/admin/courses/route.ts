import { z } from "zod";
import { route, readJson, ApiError } from "@/lib/api/handler";
import { isAdmin } from "@/lib/auth/policies";
import { createCourse } from "@/lib/services/admin";

export const runtime = "nodejs";

const Body = z.object({ name: z.string().min(1).max(120) });

export const POST = route(async ({ user, req }) => {
  if (!isAdmin(user.profile)) throw new ApiError(403, "forbidden");
  const { name } = Body.parse(await readJson(req));
  return createCourse(name, user.profile.id);
});
