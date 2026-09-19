import { z } from "zod";
import { route, readJson } from "@/lib/api/handler";
import { loadControllableChallenge } from "@/lib/api/access";
import { createSubmission } from "@/lib/services/student";
import { kickDrain } from "@/lib/events/kick";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ value: z.string().min(1).max(4000) });

export const POST = route(async ({ user, req, params }) => {
  const ch = await loadControllableChallenge(user, params.id, { requireUnlocked: true });
  const { value } = Body.parse(await readJson(req));
  const submissionId = await createSubmission({ challengeInstanceId: ch.id, studentId: user.profile.id, type: "VALUE", payload: { value } });
  await kickDrain();
  return { submissionId };
});
