/**
 * Shared types for the grader library.
 *
 * Graders are PURE with respect to infrastructure: they receive their
 * inputs and, where they need to run untrusted code, an injected runner
 * function. They must NEVER import `@vercel/sandbox` or Prisma, so they
 * stay unit-testable with no network.
 */

/**
 * Result of grading a single submission. `categories` must never contain
 * hidden-test source, expected answers, or anything that could let a
 * student reconstruct the correct answer from feedback alone.
 */
export interface GraderFeedback {
  passed: boolean;
  score: number;
  maxScore: number;
  categories: Record<string, string>;
  summary: string;
}

/** Result of executing a single command, mirrors the sandbox provider's shape. */
export type ExecResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

/**
 * Injected function matching the sandbox provider's `runEphemeralGrade`
 * shape. Graders call this instead of talking to `@vercel/sandbox`
 * directly, which keeps them infrastructure-free and unit-testable.
 */
export type EphemeralRunner = (spec: {
  files: { path: string; contentBase64: string; mode?: number }[];
  steps: { cmd: string; args: string[]; cwd?: string; timeoutMs?: number }[];
  timeoutMs?: number;
}) => Promise<{ steps: ExecResult[] }>;
