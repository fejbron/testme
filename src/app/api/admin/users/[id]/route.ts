import { z } from "zod";
import { route, readJson, ApiError } from "@/lib/api/handler";
import { isAdmin } from "@/lib/auth/policies";
import { setUserRole, deleteUser } from "@/lib/services/admin";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const Patch = z.object({ role: z.enum(["STUDENT", "INSTRUCTOR", "AUTHOR", "ADMIN"]) });

export const PATCH = route(async ({ user, req, params }) => {
  if (!isAdmin(user.profile)) throw new ApiError(403, "forbidden");
  const { role } = Patch.parse(await readJson(req));
  const res = await setUserRole(params.id, role, user.profile.id);
  await audit({ actorId: user.profile.id, action: "admin.user.role", targetType: "profile", targetId: params.id, meta: { role } });
  return res;
});

export const DELETE = route(async ({ user, params }) => {
  if (!isAdmin(user.profile)) throw new ApiError(403, "forbidden");
  const res = await deleteUser(params.id, user.profile.id);
  await audit({ actorId: user.profile.id, action: "admin.user.delete", targetType: "profile", targetId: params.id });
  return res;
});
