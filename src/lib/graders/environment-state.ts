import type { ExecResult, GraderFeedback } from "./types";

const MAX_SCORE = 100;

export type EnvPassCondition = "exit0" | { stdoutIncludes: string };

export interface EnvCheck {
  name: string;
  cmd: string;
  args: string[];
  passIf: EnvPassCondition;
}

export type EnvExecRunner = (req: { cmd: string; args: string[] }) => Promise<ExecResult>;

function checkPasses(result: ExecResult, passIf: EnvPassCondition): boolean {
  if (passIf === "exit0") return result.exitCode === 0;
  return result.stdout.includes(passIf.stdoutIncludes);
}

/**
 * Grades the live state of a student's workstation by running each check
 * via the injected exec function — the trusted side-channel into the
 * environment. The student never holds the runner, so results cannot be
 * forged.
 */
export async function gradeEnvironmentState(checks: EnvCheck[], run: EnvExecRunner): Promise<GraderFeedback> {
  const categories: Record<string, string> = {};
  let passedCount = 0;

  for (const check of checks) {
    const result = await run({ cmd: check.cmd, args: check.args });
    const ok = checkPasses(result, check.passIf);
    categories[check.name] = ok ? "PASS" : "FAIL";
    if (ok) passedCount += 1;
  }

  const total = checks.length;
  const passed = total > 0 && passedCount === total;
  const score = total === 0 ? 0 : Math.round((passedCount / total) * MAX_SCORE);

  return {
    passed,
    score,
    maxScore: MAX_SCORE,
    categories,
    summary: `${passedCount}/${total} checks passed.`,
  };
}
