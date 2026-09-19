import { route, ApiError } from "@/lib/api/handler";
import { isAdmin } from "@/lib/auth/policies";
import { listCampaigns, listAvailablePackages } from "@/lib/services/admin";

export const runtime = "nodejs";

export const GET = route(async ({ user }) => {
  if (!isAdmin(user.profile)) throw new ApiError(403, "forbidden");
  return { campaigns: await listCampaigns(), packages: listAvailablePackages() };
});
