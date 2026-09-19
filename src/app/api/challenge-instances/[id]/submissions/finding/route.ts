import { z } from "zod";
import { route, readJson } from "@/lib/api/handler";
import { loadControllableChallenge } from "@/lib/api/access";
import { createSubmission } from "@/lib/services/student";
import { kickDrain } from "@/lib/events/kick";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ fields: z.record(z.string(), z.union([z.string(), z.number()])) });

export const POST = route(async ({ user, req, params }) => {
  const ch = await loadControllableChallenge(user, params.id, { requireUnlocked: true });
  const { fields } = Body.parse(await readJson(req));
  const submissionId = await createSubmission({ challengeInstanceId: ch.id, studentId: user.profile.id, type: "FINDING", payload: { fields } });
  await kickDrain();
  return { submissionId };
});
