import { z } from "zod";
import { route, readJson, ApiError } from "@/lib/api/handler";
import { isAdmin } from "@/lib/auth/policies";
import { addCohortMember } from "@/lib/services/admin";

export const runtime = "nodejs";

const Body = z.object({ studentId: z.string().min(1) });

export const POST = route(async ({ user, req, params }) => {
  if (!isAdmin(user.profile)) throw new ApiError(403, "forbidden");
  const { studentId } = Body.parse(await readJson(req));
  return addCohortMember(params.id, studentId);
});
