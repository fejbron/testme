import { z } from "zod";
import { route, readJson, ApiError } from "@/lib/api/handler";
import { isAdmin } from "@/lib/auth/policies";
import { listUsers, createUser } from "@/lib/services/admin";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(120),
  role: z.enum(["STUDENT", "INSTRUCTOR", "AUTHOR", "ADMIN"]),
});

export const GET = route(async ({ user }) => {
  if (!isAdmin(user.profile)) throw new ApiError(403, "forbidden");
  return { users: await listUsers() };
});

export const POST = route(async ({ user, req }) => {
  if (!isAdmin(user.profile)) throw new ApiError(403, "forbidden");
  const b = Body.parse(await readJson(req));
  const created = await createUser(b);
  await audit({ actorId: user.profile.id, action: "admin.user.create", targetType: "profile", targetId: created.id, meta: { role: b.role } });
  return created;
});
