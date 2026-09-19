import { z } from "zod";
import { route, readJson } from "@/lib/api/handler";
import { loadControllableChallenge } from "@/lib/api/access";
import { createSubmission } from "@/lib/services/student";
import { kickDrain } from "@/lib/events/kick";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  language: z.enum(["python", "c", "javascript"]),
  sourceText: z.string().min(1).max(200000),
  entrypoint: z.string().optional(),
});

export const POST = route(async ({ user, req, params }) => {
  const ch = await loadControllableChallenge(user, params.id, { requireUnlocked: true });
  const b = Body.parse(await readJson(req));
  const submissionId = await createSubmission({
    challengeInstanceId: ch.id,
    studentId: user.profile.id,
    type: "CODE",
    payload: { language: b.language },
    code: { language: b.language, sourceText: b.sourceText, entrypoint: b.entrypoint },
  });
  await kickDrain();
  return { submissionId };
});
