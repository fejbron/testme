import { z } from "zod";
import { route, readJson } from "@/lib/api/handler";
import { loadControllableChallenge } from "@/lib/api/access";
import { createFinding } from "@/lib/services/student";

export const runtime = "nodejs";

const Body = z.object({
  findingType: z.string().min(1),
  title: z.string().min(1).max(200),
  structuredData: z.record(z.string(), z.unknown()).default({}),
  explanation: z.string().max(10000).default(""),
  confidence: z.string().optional(),
});

export const POST = route(async ({ user, req, params }) => {
  const ch = await loadControllableChallenge(user, params.id, { requireUnlocked: true });
  const b = Body.parse(await readJson(req));
  return createFinding({ challengeInstanceId: ch.id, campaignInstanceId: ch.campaignInstanceId, studentId: user.profile.id, ...b });
});
