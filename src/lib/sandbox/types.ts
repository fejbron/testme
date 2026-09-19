/**
 * Shared types for the sandbox environment orchestrator.
 *
 * This module intentionally has zero dependency on `@vercel/sandbox` so it
 * can be imported anywhere (including client-adjacent code) without pulling
 * the SDK into the bundle.
 */

/** A file to be written into a sandbox before/at boot time. */
export interface SeededFile {
  /** Path relative to /vercel/sandbox, or absolute under it. */
  path: string;
  /** Base64-encoded file content (decoded to a Buffer by the provider). */
  contentBase64: string;
  /** Optional POSIX file mode, e.g. 0o755 for an executable script. */
  mode?: number;
}

/**
 * Declarative spec for a persistent, named "workstation" sandbox — the
 * long-lived environment a learner/agent works in across sessions.
 */
export interface WorkstationSpec {
  /** Unique, stable sandbox name used to provision/resume it. */
  name: string;
  /** Managed or custom image reference. Defaults to the provider default. */
  image?: string;
  /** vCPU count (1 or an even number up to plan max). Defaults to 1. */
  vcpus?: number;
  /** Session timeout in milliseconds. */
  timeoutMs?: number;
  /** Files to seed into the sandbox filesystem at provision time. */
  files: SeededFile[];
  /**
   * Domains the sandbox is allowed to reach. Empty/undefined means the
   * sandbox gets a deny-all network policy (no egress, including DNS).
   */
  egressAllow?: string[];
}

/** A single command to run inside a sandbox. */
export interface ExecRequest {
  cmd: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}

/** The outcome of a single executed command. */
export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Lifecycle state of an environment as tracked by the orchestrator. */
export type EnvState =
  | "PENDING"
  | "PROVISIONING"
  | "RUNNING"
  | "STOPPED"
  | "FAILED"
  | "DESTROYING"
  | "DESTROYED";

/** A handle identifying a named environment and its current lifecycle state. */
export interface EnvironmentHandle {
  name: string;
  state: EnvState;
}

/**
 * Spec for a throwaway sandbox used to grade/run untrusted code: never
 * persisted, network-denied unless explicitly overridden, short-lived.
 */
export interface GradeSandboxSpec {
  image?: string;
  files: SeededFile[];
  steps: ExecRequest[];
  timeoutMs?: number;
}

/** Results of running each step of a grading sandbox, in order. */
export interface GradeSandboxResult {
  steps: ExecResult[];
}
