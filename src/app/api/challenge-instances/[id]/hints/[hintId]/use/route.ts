import { route } from "@/lib/api/handler";
import { loadControllableChallenge } from "@/lib/api/access";
import { useHint } from "@/lib/services/student";
import { kickDrain } from "@/lib/events/kick";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

export const POST = route(async ({ user, params }) => {
  const ch = await loadControllableChallenge(user, params.id, { requireUnlocked: true });
  const res = await useHint({ challengeInstanceId: ch.id, hintId: params.hintId, studentId: user.profile.id });
  await audit({ actorId: user.profile.id, action: "hint.use", targetType: "challengeInstance", targetId: ch.id, meta: { hintId: params.hintId } });
  await kickDrain();
  return res;
});
