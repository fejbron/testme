import { describe, expect, it } from "vitest";
import { gradeCode, type CodeSpec } from "./code";
import type { EphemeralRunner, ExecResult } from "./types";

function ok(stdout = ""): ExecResult {
  return { stdout, stderr: "", exitCode: 0 };
}

function fail(stdout = "", exitCode = 1): ExecResult {
  return { stdout, stderr: "boom", exitCode };
}

function fakeRunner(results: ExecResult[]): EphemeralRunner {
  return async (spec) => {
    expect(spec.steps.length).toBe(results.length);
    return { steps: results };
  };
}

const spec: CodeSpec = {
  harnessFiles: [{ path: "/vercel/sandbox/harness.py", contentBase64: Buffer.from("# harness").toString("base64") }],
  buildSteps: [{ cmd: "python3", args: ["-m", "py_compile", "submission.py"] }],
  testGroups: [
    { name: "basic", step: { cmd: "pytest", args: ["-k", "basic"] }, weight: 1, passIf: "exit0" },
    { name: "edge-cases", step: { cmd: "pytest", args: ["-k", "edge"] }, weight: 3, passIf: { stdoutIncludes: "4 passed" } },
  ],
};

describe("gradeCode", () => {
  it("computes a weighted score across passing/failing groups", async () => {
    const runner = fakeRunner([
      ok(), // build
      ok(), // basic group passes (exit0)
      fail("2 passed, 2 failed"), // edge-cases fails (missing "4 passed")
    ]);

    const result = await gradeCode({ language: "python", sourceText: "print(1)" }, spec, runner);

    // weight 1 (basic, pass) out of total weight 4 => 25
    expect(result.score).toBe(25);
    expect(result.passed).toBe(false);
    expect(result.categories.basic).toBe("PASS");
    expect(result.categories["edge-cases"]).toBe("FAIL");
    expect(result.categories.Build).toBe("PASS");
  });

  it("passes fully when all groups pass", async () => {
    const runner = fakeRunner([ok(), ok(), ok("4 passed")]);
    const result = await gradeCode({ language: "python", sourceText: "print(1)" }, spec, runner);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  it("zeroes all tests when the build fails", async () => {
    const runner = fakeRunner([fail("", 1), ok(), ok("4 passed")]);
    const result = await gradeCode({ language: "python", sourceText: "print(1" }, spec, runner);
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
    expect(result.categories.Build).toBe("FAIL");
    expect(result.categories.basic).toBe("FAIL");
    expect(result.categories["edge-cases"]).toBe("FAIL");
  });

  it("never leaks hidden test stdout/source into feedback, only pass/fail counts", async () => {
    const runner = fakeRunner([ok(), ok(), fail("SECRET_HIDDEN_TEST_DATA_XYZ")]);
    const result = await gradeCode({ language: "python", sourceText: "print(1)" }, spec, runner);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("SECRET_HIDDEN_TEST_DATA_XYZ");
    expect(serialized).not.toContain("harness.py");
    expect(result.summary).toBe("1/2 test groups passed.");
  });

  it("writes the submission to a spec-named path with the correct extension", async () => {
    let capturedPaths: string[] = [];
    const runner: EphemeralRunner = async (s) => {
      capturedPaths = s.files.map((f) => f.path);
      return { steps: [ok(), ok(), ok("4 passed")] };
    };
    await gradeCode({ language: "c", sourceText: "int main(){return 0;}" }, spec, runner);
    expect(capturedPaths).toContain("/vercel/sandbox/submission.c");
  });
});
