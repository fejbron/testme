import { z } from "zod";
import { route, readJson, ApiError } from "@/lib/api/handler";
import { isAdmin } from "@/lib/auth/policies";
import { publishPackage } from "@/lib/services/admin";
import { CampaignImportError } from "@/lib/campaign/import";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ slug: z.string().min(1) });

export const POST = route(async ({ user, req }) => {
  if (!isAdmin(user.profile)) throw new ApiError(403, "forbidden");
  const { slug } = Body.parse(await readJson(req));
  try {
    const res = await publishPackage(slug, user.profile.id);
    await audit({ actorId: user.profile.id, action: "admin.campaign.publish", targetType: "campaign", targetId: slug, meta: { version: res.version } });
    return res;
  } catch (err) {
    if (err instanceof CampaignImportError) throw new ApiError(400, `${err.message}: ${err.issues.map((i) => i.message).join("; ")}`);
    throw err;
  }
});
