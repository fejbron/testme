import { route } from "@/lib/api/handler";
import { loadControllableChallenge } from "@/lib/api/access";
import { createSubmission } from "@/lib/services/student";
import { kickDrain } from "@/lib/events/kick";

export const runtime = "nodejs";
export const maxDuration = 120;

export const POST = route(async ({ user, params }) => {
  const ch = await loadControllableChallenge(user, params.id, { requireUnlocked: true });
  const submissionId = await createSubmission({ challengeInstanceId: ch.id, studentId: user.profile.id, type: "ENVIRONMENT_STATE", payload: {} });
  await kickDrain();
  return { submissionId };
});
