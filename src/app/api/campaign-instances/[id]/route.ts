import { route } from "@/lib/api/handler";
import { loadViewableInstance } from "@/lib/api/access";
import { instanceOverview } from "@/lib/services/student";

export const runtime = "nodejs";

export const GET = route(async ({ user, params }) => {
  await loadViewableInstance(user, params.id);
  return instanceOverview(params.id);
});
