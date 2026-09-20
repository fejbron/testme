import { describe, expect, it } from "vitest";
import { createSandboxProvider } from "./provider";
import type {
  SandboxCommandResult,
  SandboxCreateOptions,
  SandboxInstance,
  SandboxRunCommandArgs,
  SandboxSdk,
  SandboxWriteFile,
} from "./provider";
import type { GradeSandboxSpec, WorkstationSpec } from "./types";

function makeResult(exitCode: number, stdout = "", stderr = ""): SandboxCommandResult {
  return {
    exitCode,
    stdout: async () => stdout,
    stderr: async () => stderr,
  };
}

/** Records every call made against it, for assertions. */
class FakeInstance implements SandboxInstance {
  readonly name: string;
  readonly runCommandCalls: SandboxRunCommandArgs[] = [];
  readonly writeFilesCalls: SandboxWriteFile[][] = [];
  readonly mkDirCalls: string[] = [];
  stopCount = 0;
  deleteCount = 0;
  private readonly runCommandImpl: (args: SandboxRunCommandArgs) => Promise<SandboxCommandResult>;

  constructor(
    name: string,
    runCommandImpl: (args: SandboxRunCommandArgs) => Promise<SandboxCommandResult> = async () =>
      makeResult(0),
  ) {
    this.name = name;
    this.runCommandImpl = runCommandImpl;
  }

  async runCommand(args: SandboxRunCommandArgs): Promise<SandboxCommandResult> {
    this.runCommandCalls.push(args);
    return this.runCommandImpl(args);
  }

  async writeFiles(files: SandboxWriteFile[]): Promise<void> {
    this.writeFilesCalls.push(files);
  }

  async mkDir(path: string): Promise<void> {
    this.mkDirCalls.push(path);
  }

  async stop(): Promise<void> {
    this.stopCount++;
  }

  async delete(): Promise<void> {
    this.deleteCount++;
  }
}

/** A fake `SandboxSdk` that records every call and never touches the network. */
class FakeSdk implements SandboxSdk {
  readonly events: string[] = [];
  readonly createOptions: SandboxCreateOptions[] = [];
  readonly instances = new Map<string, FakeInstance>();
  readonly createdInstances: FakeInstance[] = [];
  runCommandImpl?: (args: SandboxRunCommandArgs) => Promise<SandboxCommandResult>;
  /** When set, `get` rejects with this for any name not already created. */
  missingIsNotFound = true;

  async create(options: SandboxCreateOptions): Promise<SandboxInstance> {
    this.events.push(`create:${options.name ?? "<anon>"}`);
    this.createOptions.push(options);
    const instance = new FakeInstance(options.name ?? "anon", this.runCommandImpl);
    if (options.name) this.instances.set(options.name, instance);
    this.createdInstances.push(instance);
    return instance;
  }

  async get(options: { name: string }): Promise<SandboxInstance> {
    this.events.push(`get:${options.name}`);
    const existing = this.instances.get(options.name);
    if (!existing) {
      if (this.missingIsNotFound) {
        throw new Error(`sandbox not_found: ${options.name}`);
      }
      throw new Error(`unexpected missing sandbox: ${options.name}`);
    }
    return existing;
  }

  async getOrCreate(options: SandboxCreateOptions & { name: string }): Promise<SandboxInstance> {
    this.events.push(`getOrCreate:${options.name}`);
    this.createOptions.push(options);
    const existing = this.instances.get(options.name);
    if (existing) return existing;
    const instance = new FakeInstance(options.name, this.runCommandImpl);
    this.instances.set(options.name, instance);
    return instance;
  }
}

const BASE_WORKSTATION: WorkstationSpec = {
  name: "ws-1",
  files: [{ path: "hello.txt", contentBase64: Buffer.from("hello world").toString("base64") }],
};

describe("createSandboxProvider", () => {
  describe("provision", () => {
    it("writes decoded seeded files and applies a deny-all policy when egressAllow is empty", async () => {
      const sdk = new FakeSdk();
      const provider = createSandboxProvider(sdk);

      const handle = await provider.provision(BASE_WORKSTATION);

      expect(handle).toEqual({ name: "ws-1", state: "RUNNING" });
      expect(sdk.events).toEqual(["getOrCreate:ws-1"]);

      const opts = sdk.createOptions[0];
      expect(opts.networkPolicy).toBe("deny-all");
      expect(opts.persistent).toBe(true);
      expect(opts.resources).toEqual({ vcpus: 1 });

      const instance = sdk.instances.get("ws-1");
      expect(instance).toBeDefined();
      expect(instance?.mkDirCalls).toEqual(["/vercel/sandbox"]);
      expect(instance?.writeFilesCalls).toHaveLength(1);
      const written = instance?.writeFilesCalls[0]?.[0];
      expect(written?.path).toBe("/vercel/sandbox/hello.txt");
      expect(written?.content.toString("utf8")).toBe("hello world");
    });

    it("uses an allow-list network policy when egressAllow is provided", async () => {
      const sdk = new FakeSdk();
      const provider = createSandboxProvider(sdk);

      await provider.provision({ ...BASE_WORKSTATION, egressAllow: ["api.example.com"] });

      expect(sdk.createOptions[0].networkPolicy).toEqual({ allow: ["api.example.com"] });
    });
  });

  describe("exec", () => {
    it("maps stdout/stderr/exitCode through", async () => {
      const sdk = new FakeSdk();
      sdk.runCommandImpl = async () => makeResult(3, "out-text", "err-text");
      // Seed an existing sandbox so `get` resolves.
      await sdk.getOrCreate({ name: "ws-1", persistent: true });
      const provider = createSandboxProvider(sdk);

      const result = await provider.exec("ws-1", { cmd: "echo", args: ["hi"] });

      expect(result).toEqual({ stdout: "out-text", stderr: "err-text", exitCode: 3 });
      const instance = sdk.instances.get("ws-1");
      expect(instance?.runCommandCalls[0]).toMatchObject({ cmd: "echo", args: ["hi"] });
    });
  });

  describe("reset", () => {
    it("destroys the existing sandbox before recreating it from the spec", async () => {
      const sdk = new FakeSdk();
      const provider = createSandboxProvider(sdk);
      await provider.provision(BASE_WORKSTATION);
      sdk.events.length = 0; // clear provision noise

      const handle = await provider.reset("ws-1", BASE_WORKSTATION);

      expect(handle).toEqual({ name: "ws-1", state: "RUNNING" });
      // destroy (get + delete) must happen strictly before recreation.
      const getIdx = sdk.events.indexOf("get:ws-1");
      const createIdx = sdk.events.indexOf("getOrCreate:ws-1");
      expect(getIdx).toBeGreaterThanOrEqual(0);
      expect(createIdx).toBeGreaterThan(getIdx);
    });

    it("swallows a not-found error when the sandbox did not already exist", async () => {
      const sdk = new FakeSdk();
      const provider = createSandboxProvider(sdk);

      const handle = await provider.reset("never-existed", BASE_WORKSTATION);

      expect(handle.name).toBe("never-existed");
      expect(handle.state).toBe("RUNNING");
    });
  });

  describe("runEphemeralGrade", () => {
    const spec: GradeSandboxSpec = {
      files: [{ path: "grade.py", contentBase64: Buffer.from("print(1)").toString("base64") }],
      steps: [
        { cmd: "python3", args: ["grade.py"] },
        { cmd: "cat", args: ["result.txt"] },
      ],
    };

    it("runs steps in order, collects results, and stops even when a step exits non-zero", async () => {
      const sdk = new FakeSdk();
      let call = 0;
      sdk.runCommandImpl = async () => {
        call++;
        return call === 1 ? makeResult(0, "step1-out") : makeResult(1, "", "step2-fail");
      };
      const provider = createSandboxProvider(sdk);

      const result = await provider.runEphemeralGrade(spec);

      expect(result.steps).toEqual([
        { stdout: "step1-out", stderr: "", exitCode: 0 },
        { stdout: "", stderr: "step2-fail", exitCode: 1 },
      ]);
      const created = sdk.createdInstances[0];
      expect(created.stopCount).toBe(1);
      expect(created.runCommandCalls).toHaveLength(2);

      const createOpts = sdk.createOptions[0];
      expect(createOpts.persistent).toBe(false);
      expect(createOpts.networkPolicy).toBe("deny-all");
      expect(createOpts.timeout).toBe(45_000);
    });

    it("still calls stop() when a step throws", async () => {
      const sdk = new FakeSdk();
      let call = 0;
      sdk.runCommandImpl = async () => {
        call++;
        if (call === 1) return makeResult(0, "ok");
        throw new Error("sandbox exploded");
      };
      const provider = createSandboxProvider(sdk);

      await expect(provider.runEphemeralGrade(spec)).rejects.toThrow("sandbox exploded");

      const created = sdk.createdInstances[0];
      expect(created.stopCount).toBe(1);
      expect(created.runCommandCalls).toHaveLength(2);
    });

    it("honors a custom timeout when provided", async () => {
      const sdk = new FakeSdk();
      const provider = createSandboxProvider(sdk);

      await provider.runEphemeralGrade({ ...spec, timeoutMs: 10_000 });

      expect(sdk.createOptions[0].timeout).toBe(10_000);
    });
  });

  describe("destroy/stop", () => {
    it("is a best-effort no-op when the sandbox does not exist", async () => {
      const sdk = new FakeSdk();
      const provider = createSandboxProvider(sdk);

      await expect(provider.destroy("missing")).resolves.toBeUndefined();
      await expect(provider.stop("missing")).resolves.toBeUndefined();
    });

    it("deletes / stops an existing sandbox", async () => {
      const sdk = new FakeSdk();
      const provider = createSandboxProvider(sdk);
      await provider.provision(BASE_WORKSTATION);

      await provider.stop("ws-1");
      expect(sdk.instances.get("ws-1")?.stopCount).toBe(1);

      await provider.destroy("ws-1");
      expect(sdk.instances.get("ws-1")?.deleteCount).toBe(1);
    });
  });

  describe("status", () => {
    it("reports DESTROYED for an unknown sandbox and RUNNING for a known one", async () => {
      const sdk = new FakeSdk();
      const provider = createSandboxProvider(sdk);
      await provider.provision(BASE_WORKSTATION);

      await expect(provider.status("ws-1")).resolves.toEqual({ name: "ws-1", state: "RUNNING" });
      await expect(provider.status("nope")).resolves.toEqual({ name: "nope", state: "DESTROYED" });
    });
  });
});
