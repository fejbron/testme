import { route } from "@/lib/api/handler";
import { loadControllableInstance } from "@/lib/api/access";
import { startEnvironment, stopEnvironment, resetEnvironment } from "@/lib/environment/provision";
import { kickDrain } from "@/lib/events/kick";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = route(async ({ user, params }) => {
  await loadControllableInstance(user, params.id);
  await startEnvironment(params.id);
  await audit({ actorId: user.profile.id, action: "environment.start", targetType: "campaignInstance", targetId: params.id });
  await kickDrain();
  return { ok: true };
});
