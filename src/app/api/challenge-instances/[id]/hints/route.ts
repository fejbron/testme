import { route } from "@/lib/api/handler";
import { loadViewableChallenge } from "@/lib/api/access";
import { listHints } from "@/lib/services/student";

export const runtime = "nodejs";

export const GET = route(async ({ user, params }) => {
  const ch = await loadViewableChallenge(user, params.id);
  return { hints: await listHints(ch.id) };
});
