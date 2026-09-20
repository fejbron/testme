import { posix } from "node:path";
import type {
  EnvironmentHandle,
  EnvState,
  ExecRequest,
  ExecResult,
  GradeSandboxResult,
  GradeSandboxSpec,
  SeededFile,
  WorkstationSpec,
} from "./types";

/**
 * Minimal shape of a finished command result, abstracting
 * `@vercel/sandbox`'s `CommandFinished`.
 */
export interface SandboxCommandResult {
  exitCode: number;
  stdout(): Promise<string>;
  stderr(): Promise<string>;
}

/** Minimal shape of the arguments accepted by a sandbox's `runCommand`. */
export interface SandboxRunCommandArgs {
  cmd: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}

/** A file write, as accepted by a sandbox's `writeFiles`. */
export interface SandboxWriteFile {
  path: string;
  content: Buffer;
  mode?: number;
}

/**
 * Minimal shape of `@vercel/sandbox`'s `NetworkPolicy`, restricted to the
 * subset this module produces (a plain domain allow-list).
 */
export type SandboxNetworkPolicy = "allow-all" | "deny-all" | { allow: string[] };

/** Options accepted when creating or getting-or-creating a sandbox. */
export interface SandboxCreateOptions {
  name?: string;
  image?: string;
  resources?: { vcpus: number };
  timeout?: number;
  persistent?: boolean;
  networkPolicy?: SandboxNetworkPolicy;
}

/**
 * Minimal shape of a live sandbox handle, abstracting the parts of
 * `@vercel/sandbox`'s `Sandbox` class this module uses.
 */
export interface SandboxInstance {
  readonly name: string;
  runCommand(args: SandboxRunCommandArgs): Promise<SandboxCommandResult>;
  writeFiles(files: SandboxWriteFile[]): Promise<void>;
  mkDir(path: string): Promise<void>;
  stop(): Promise<void>;
  delete(): Promise<void>;
}

/**
 * Minimal shape of the `@vercel/sandbox` module surface this provider
 * depends on. Real usage is behind a lazy-imported adapter; tests inject a
 * fake implementation of this interface instead.
 */
export interface SandboxSdk {
  create(options: SandboxCreateOptions): Promise<SandboxInstance>;
  get(options: { name: string }): Promise<SandboxInstance>;
  getOrCreate(options: SandboxCreateOptions & { name: string }): Promise<SandboxInstance>;
}

/** The environment orchestrator's public surface over Vercel Sandbox. */
export interface EnvironmentProvider {
  provision(spec: WorkstationSpec): Promise<EnvironmentHandle>;
  start(name: string): Promise<void>;
  stop(name: string): Promise<void>;
  reset(name: string, spec: WorkstationSpec): Promise<EnvironmentHandle>;
  destroy(name: string): Promise<void>;
  status(name: string): Promise<EnvironmentHandle>;
  exec(name: string, req: ExecRequest): Promise<ExecResult>;
  runEphemeralGrade(spec: GradeSandboxSpec): Promise<GradeSandboxResult>;
}

const DEFAULT_GRADE_TIMEOUT_MS = 45_000;
const DEFAULT_VCPUS = 1;
const WORKSPACE_DIR = "/vercel/sandbox";

function workspacePath(path: string): string {
  const resolved = posix.resolve(WORKSPACE_DIR, path);
  if (resolved !== WORKSPACE_DIR && !resolved.startsWith(`${WORKSPACE_DIR}/`)) {
    throw new Error(`seeded file must stay inside ${WORKSPACE_DIR}`);
  }
  return resolved;
}

function decodeSeededFiles(files: SeededFile[]): SandboxWriteFile[] {
  return files.map((file) => ({
    path: workspacePath(file.path),
    content: Buffer.from(file.contentBase64, "base64"),
    mode: file.mode,
  }));
}

function networkPolicyFor(egressAllow: string[] | undefined): SandboxNetworkPolicy {
  if (!egressAllow || egressAllow.length === 0) {
    return "deny-all";
  }
  return { allow: egressAllow };
}

function isNotFoundError(err: unknown): boolean {
  if (!err) return false;
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";
  return /not[_ -]?found/i.test(message);
}

async function toExecResult(result: SandboxCommandResult): Promise<ExecResult> {
  const [stdout, stderr] = await Promise.all([result.stdout(), result.stderr()]);
  return { stdout, stderr, exitCode: result.exitCode };
}

function createOptionsFor(spec: WorkstationSpec, persistent: boolean): SandboxCreateOptions {
  return {
    name: spec.name,
    image: spec.image,
    resources: { vcpus: spec.vcpus ?? DEFAULT_VCPUS },
    timeout: spec.timeoutMs,
    persistent,
    networkPolicy: networkPolicyFor(spec.egressAllow),
  };
}

async function seedFiles(instance: SandboxInstance, files: SeededFile[]): Promise<void> {
  if (files.length === 0) return;
  await instance.mkDir(WORKSPACE_DIR);
  await instance.writeFiles(decodeSeededFiles(files));
}

/**
 * Lazily loads `@vercel/sandbox` and adapts its `Sandbox` class to the
 * minimal `SandboxSdk` interface this module depends on. Kept behind a
 * dynamic import so `@vercel/sandbox` never enters a client bundle, and so
 * tests can inject a fake `SandboxSdk` without touching the real module.
 */
async function loadDefaultSdk(): Promise<SandboxSdk> {
  const { Sandbox } = await import("@vercel/sandbox");

  function adapt(instance: {
    name: string;
    runCommand(params: SandboxRunCommandArgs): Promise<SandboxCommandResult>;
    writeFiles(files: { path: string; content: Buffer; mode?: number }[]): Promise<void>;
    mkDir(path: string): Promise<void>;
    stop(): Promise<unknown>;
    delete(): Promise<void>;
  }): SandboxInstance {
    return {
      name: instance.name,
      runCommand: (args) => instance.runCommand(args),
      writeFiles: (files) => instance.writeFiles(files),
      mkDir: (path) => instance.mkDir(path),
      stop: async () => {
        await instance.stop();
      },
      delete: () => instance.delete(),
    };
  }

  // `Sandbox.create`/`getOrCreate` accept a large discriminated union (git
  // source, tarball source, snapshot source, ...) that our minimal
  // `SandboxCreateOptions` is a deliberate subset of. We never set `source`,
  // so we always land in the sourceless branch of that union; the single
  // cast at this boundary is what lets the rest of this module depend on
  // our own narrow, testable type instead of the SDK's full option surface.
  type CreateParams = Parameters<typeof Sandbox.create>[0];
  type GetOrCreateParams = Parameters<typeof Sandbox.getOrCreate>[0];

  return {
    create: async (options) => adapt(await Sandbox.create(options as CreateParams)),
    get: async (options) => adapt(await Sandbox.get(options)),
    getOrCreate: async (options) =>
      adapt(await Sandbox.getOrCreate(options as GetOrCreateParams)),
  };
}

/**
 * Creates an `EnvironmentProvider` backed by Vercel Sandbox.
 *
 * @param sdk Optional `SandboxSdk` implementation. Defaults to a lazily
 * loaded adapter over the real `@vercel/sandbox` package; tests inject a
 * fake here instead so no network call is ever made.
 */
export function createSandboxProvider(sdk?: SandboxSdk): EnvironmentProvider {
  const sdkPromise: Promise<SandboxSdk> = sdk ? Promise.resolve(sdk) : loadDefaultSdk();

  async function getSdk(): Promise<SandboxSdk> {
    return sdkPromise;
  }

  async function doProvision(spec: WorkstationSpec): Promise<EnvironmentHandle> {
    const client = await getSdk();
    const instance = await client.getOrCreate({
      ...createOptionsFor(spec, true),
      name: spec.name,
    });
    await seedFiles(instance, spec.files);
    return { name: instance.name, state: "RUNNING" };
  }

  async function doDestroy(name: string): Promise<void> {
    const client = await getSdk();
    try {
      const instance = await client.get({ name });
      await instance.delete();
    } catch (err) {
      if (!isNotFoundError(err)) throw err;
    }
  }

  return {
    async provision(spec) {
      return doProvision(spec);
    },

    async start(name) {
      const client = await getSdk();
      // Resuming a sandbox happens on the next call that needs a running
      // session; `get` is enough to ensure it exists and is addressable.
      await client.get({ name });
    },

    async stop(name) {
      const client = await getSdk();
      try {
        const instance = await client.get({ name });
        await instance.stop();
      } catch (err) {
        if (!isNotFoundError(err)) throw err;
      }
    },

    async reset(name, spec) {
      await doDestroy(name);
      return doProvision({ ...spec, name });
    },

    async destroy(name) {
      await doDestroy(name);
    },

    async status(name) {
      const client = await getSdk();
      try {
        const instance = await client.get({ name });
        return { name: instance.name, state: "RUNNING" };
      } catch (err) {
        if (isNotFoundError(err)) {
          return { name, state: "DESTROYED" };
        }
        throw err;
      }
    },

    async exec(name, req) {
      const client = await getSdk();
      const instance = await client.get({ name });
      const result = await instance.runCommand({
        cmd: req.cmd,
        args: req.args,
        cwd: req.cwd,
        env: req.env,
        timeoutMs: req.timeoutMs,
      });
      return toExecResult(result);
    },

    async runEphemeralGrade(spec) {
      const client = await getSdk();
      const instance = await client.create({
        image: spec.image,
        resources: { vcpus: DEFAULT_VCPUS },
        timeout: spec.timeoutMs ?? DEFAULT_GRADE_TIMEOUT_MS,
        persistent: false,
        networkPolicy: "deny-all",
      });
      try {
        await seedFiles(instance, spec.files);
        const steps: ExecResult[] = [];
        for (const step of spec.steps) {
          const result = await instance.runCommand({
            cmd: step.cmd,
            args: step.args,
            cwd: step.cwd,
            env: step.env,
            timeoutMs: step.timeoutMs,
          });
          steps.push(await toExecResult(result));
        }
        return { steps };
      } finally {
        await instance.stop();
      }
    },
  };
}

export type { EnvironmentHandle, EnvState, ExecRequest, ExecResult, GradeSandboxResult, GradeSandboxSpec };
