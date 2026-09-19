import { route, ApiError } from "@/lib/api/handler";
import { isAdmin } from "@/lib/auth/policies";
import { removeCohortMember } from "@/lib/services/admin";

export const runtime = "nodejs";

export const DELETE = route(async ({ user, params }) => {
  if (!isAdmin(user.profile)) throw new ApiError(403, "forbidden");
  return removeCohortMember(params.id, params.studentId);
});
