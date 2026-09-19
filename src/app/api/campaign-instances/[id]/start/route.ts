import { route } from "@/lib/api/handler";
import { loadControllableInstance } from "@/lib/api/access";
import { startCampaignInstance } from "@/lib/campaign/bootstrap";
import { kickDrain } from "@/lib/events/kick";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = route(async ({ user, params }) => {
  await loadControllableInstance(user, params.id);
  await startCampaignInstance(params.id);
  await audit({ actorId: user.profile.id, action: "campaign.start", targetType: "campaignInstance", targetId: params.id });
  await kickDrain();
  return { ok: true };
});
