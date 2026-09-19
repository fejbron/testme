import type { EphemeralRunner, ExecResult, GraderFeedback } from "./types";

const MAX_SCORE = 100;

const EXTENSION_BY_LANGUAGE: Record<CodeSubmission["language"], string> = {
  python: "py",
  c: "c",
  javascript: "js",
};

export interface CodeSubmission {
  language: "python" | "c" | "javascript";
  sourceText: string;
}

export interface CodeStep {
  cmd: string;
  args: string[];
}

export type CodePassCondition = "exit0" | { stdoutIncludes: string };

export interface CodeTestGroup {
  name: string;
  step: CodeStep;
  weight: number;
  passIf: CodePassCondition;
}

export interface CodeSpec {
  harnessFiles: { path: string; contentBase64: string }[];
  buildSteps: CodeStep[];
  testGroups: CodeTestGroup[];
}

function stepPasses(result: ExecResult, passIf: CodePassCondition): boolean {
  if (passIf === "exit0") return result.exitCode === 0;
  return result.stdout.includes(passIf.stdoutIncludes);
}

/**
 * Grades a code submission by assembling the submission alongside the
 * challenge's harness files, running build steps then each test group's
 * step through the injected `run` (sandbox) function, and scoring by
 * weighted fraction of passing groups.
 *
 * Never surfaces hidden-test source or the stdout of hidden groups —
 * feedback exposes only group names and PASS/FAIL/build-failure status.
 */
export async function gradeCode(submission: CodeSubmission, spec: CodeSpec, run: EphemeralRunner): Promise<GraderFeedback> {
  const ext = EXTENSION_BY_LANGUAGE[submission.language];
  const submissionFile = {
    path: `/vercel/sandbox/submission.${ext}`,
    contentBase64: Buffer.from(submission.sourceText, "utf8").toString("base64"),
  };

  const files = [submissionFile, ...spec.harnessFiles];
  const steps = [...spec.buildSteps, ...spec.testGroups.map((g) => g.step)];

  const result = await run({ files, steps });

  const buildResults = result.steps.slice(0, spec.buildSteps.length);
  const testResults = result.steps.slice(spec.buildSteps.length);

  const buildFailed = buildResults.some((r) => r.exitCode !== 0);

  const categories: Record<string, string> = {};
  categories.Build = buildFailed ? "FAIL" : "PASS";

  if (buildFailed) {
    for (const group of spec.testGroups) {
      categories[group.name] = "FAIL";
    }
    return {
      passed: false,
      score: 0,
      maxScore: MAX_SCORE,
      categories,
      summary: "Build failed; tests were not run.",
    };
  }

  let totalWeight = 0;
  let passedWeight = 0;
  let passedGroups = 0;

  for (let i = 0; i < spec.testGroups.length; i += 1) {
    const group = spec.testGroups[i];
    const testResult = testResults[i];
    const ok = testResult !== undefined && stepPasses(testResult, group.passIf);
    categories[group.name] = ok ? "PASS" : "FAIL";
    totalWeight += group.weight;
    if (ok) {
      passedWeight += group.weight;
      passedGroups += 1;
    }
  }

  const fraction = totalWeight === 0 ? 0 : passedWeight / totalWeight;
  const score = Math.round(fraction * MAX_SCORE);
  const passed = spec.testGroups.length > 0 && passedGroups === spec.testGroups.length;

  return {
    passed,
    score,
    maxScore: MAX_SCORE,
    categories,
    summary: `${passedGroups}/${spec.testGroups.length} test groups passed.`,
  };
}
