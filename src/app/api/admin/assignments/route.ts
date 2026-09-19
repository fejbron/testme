import { z } from "zod";
import { route, readJson, ApiError } from "@/lib/api/handler";
import { isAdmin } from "@/lib/auth/policies";
import { assignVersionToCohort } from "@/lib/services/admin";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ campaignVersionId: z.string().min(1), cohortId: z.string().min(1) });

export const POST = route(async ({ user, req }) => {
  if (!isAdmin(user.profile)) throw new ApiError(403, "forbidden");
  const b = Body.parse(await readJson(req));
  const res = await assignVersionToCohort(b.campaignVersionId, b.cohortId);
  await audit({ actorId: user.profile.id, action: "admin.assign", targetType: "campaignVersion", targetId: b.campaignVersionId, meta: { cohortId: b.cohortId, assigned: res.assigned } });
  return res;
});
