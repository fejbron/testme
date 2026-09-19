import { describe, expect, it } from "vitest";
import { gradeEnvironmentState, type EnvCheck, type EnvExecRunner } from "./environment-state";
import type { ExecResult } from "./types";

function fakeExec(byCmd: Record<string, ExecResult>): EnvExecRunner {
  return async (req) => {
    const result = byCmd[req.cmd];
    if (!result) throw new Error(`unexpected cmd ${req.cmd}`);
    return result;
  };
}

describe("gradeEnvironmentState", () => {
  const checks: EnvCheck[] = [
    { name: "kubectl-nodes", cmd: "kubectl-nodes-check", args: [], passIf: "exit0" },
    { name: "service-up", cmd: "service-check", args: [], passIf: { stdoutIncludes: "active" } },
  ];

  it("passes when all checks pass", async () => {
    const run = fakeExec({
      "kubectl-nodes-check": { stdout: "", stderr: "", exitCode: 0 },
      "service-check": { stdout: "status: active", stderr: "", exitCode: 0 },
    });
    const result = await gradeEnvironmentState(checks, run);
    expect(result.passed).toBe(true);
    expect(result.categories["kubectl-nodes"]).toBe("PASS");
    expect(result.categories["service-up"]).toBe("PASS");
  });

  it("fails overall when one check fails, with a per-check category", async () => {
    const run = fakeExec({
      "kubectl-nodes-check": { stdout: "", stderr: "", exitCode: 1 },
      "service-check": { stdout: "status: active", stderr: "", exitCode: 0 },
    });
    const result = await gradeEnvironmentState(checks, run);
    expect(result.passed).toBe(false);
    expect(result.categories["kubectl-nodes"]).toBe("FAIL");
    expect(result.categories["service-up"]).toBe("PASS");
  });
});
