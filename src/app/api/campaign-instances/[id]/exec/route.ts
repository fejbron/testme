import { z } from "zod";
import { route, readJson, ApiError } from "@/lib/api/handler";
import { loadControllableInstance } from "@/lib/api/access";
import { prisma } from "@/lib/db";
import { createSandboxProvider } from "@/lib/sandbox/provider";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

// Command-shell over the workstation VM. Persisted cwd lives client-side and is echoed back.
const Body = z.object({ cmd: z.string().min(1).max(2000), cwd: z.string().max(1000).optional() });

const BLOCKED = [/\bsudo\b/, /rm\s+-rf\s+\//];

export const POST = route(async ({ user, req, params }) => {
  const instance = await loadControllableInstance(user, params.id);
  const env = await prisma.environmentInstance.findUnique({ where: { campaignInstanceId: instance.id } });
  if (!env?.externalRef || env.status !== "RUNNING") throw new ApiError(409, "environment not running");
  const { cmd, cwd } = Body.parse(await readJson(req));
  if (BLOCKED.some((re) => re.test(cmd))) throw new ApiError(400, "command not permitted");

  const provider = createSandboxProvider();
  const workdir = cwd && cwd.startsWith("/vercel/sandbox") ? cwd : "/vercel/sandbox";
  const result = await provider.exec(env.externalRef, { cmd: "bash", args: ["-lc", `cd ${JSON.stringify(workdir)} && ${cmd}`], timeoutMs: 30000 });
  await audit({ actorId: user.profile.id, action: "terminal.exec", targetType: "campaignInstance", targetId: instance.id, meta: { cmd: cmd.slice(0, 200) } });
  return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode, cwd: workdir };
});
