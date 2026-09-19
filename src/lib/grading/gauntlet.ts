import type { SeedContext } from "@/lib/seed";
import { generators } from "../../../challenges/gauntlet/generators";
import type { CodeSpec } from "@/lib/graders/code";
import type { GradingPlan } from "./plan";

const b64 = (s: string): string => Buffer.from(s, "utf8").toString("base64");

function expectedOf(name: string, ctx: SeedContext): Record<string, string> {
  const gen = generators[name];
  if (!gen) throw new Error(`unknown generator ${name}`);
  return gen(ctx, { file: () => {} }).expected;
}

// --- stack VM (mirrors challenges/gauntlet stackvm ISA) for hidden-test generation ---
type Op = string;

function genProgram(ctx: SeedContext, label: string, len: number): Op[] {
  const prog: Op[] = [];
  let depth = 0;
  for (let i = 0; i < len; i++) {
    const choices: Op[] = ["PUSH"];
    if (depth >= 1) choices.push("DUP", "PRINT");
    if (depth >= 2) choices.push("ADD", "SUB", "MUL", "SWAP");
    const op = ctx.pick(`${label}:op:${i}`, choices);
    if (op === "PUSH") {
      prog.push(`PUSH ${ctx.int(`${label}:n:${i}`, 0, 99)}`);
      depth += 1;
    } else if (op === "ADD" || op === "SUB" || op === "MUL") {
      prog.push(op);
      depth -= 1;
    } else if (op === "DUP") {
      prog.push(op);
      depth += 1;
    } else if (op === "SWAP") {
      prog.push(op);
    } else {
      prog.push("PRINT");
      depth -= 1;
    }
  }
  if (depth < 1) {
    prog.push(`PUSH ${ctx.int(`${label}:final`, 1, 99)}`);
    depth += 1;
  }
  prog.push("PRINT");
  return prog;
}

function simulate(prog: Op[]): string {
  const stack: number[] = [];
  const out: string[] = [];
  for (const line of prog) {
    const [op, arg] = line.split(/\s+/);
    if (op === "PUSH") stack.push(Number(arg) | 0);
    else if (op === "ADD") stack.push((stack.pop()! + stack.pop()!) | 0);
    else if (op === "MUL") stack.push((stack.pop()! * stack.pop()!) | 0);
    else if (op === "SUB") {
      const b = stack.pop()!;
      const a = stack.pop()!;
      stack.push((a - b) | 0);
    } else if (op === "DUP") stack.push(stack[stack.length - 1]!);
    else if (op === "SWAP") {
      const b = stack.pop()!;
      const a = stack.pop()!;
      stack.push(b, a);
    } else if (op === "PRINT") out.push(String(stack[stack.length - 1]!));
  }
  return out.join("\n");
}

function vmSpec(ctx: SeedContext): CodeSpec {
  const c = ctx.namespace("vm-hidden");
  const make = (label: string, n: number) =>
    Array.from({ length: n }, (_, i) => {
      const prog = genProgram(c.namespace(label), `p${i}`, c.int(`${label}:len:${i}`, 6, 14));
      return { program: prog.join("\n"), output: simulate(prog) };
    });
  const vectors = { visible: make("vis", 3), hidden: make("hid", 6) };
  const harness = String.raw`import json, sys, subprocess
grp = sys.argv[1]
data = json.load(open("/vercel/sandbox/vectors.json"))
cases = data[grp]
ok = 0
total = len(cases)
for c in cases:
    try:
        p = subprocess.run(["python3","/vercel/sandbox/submission.py"], input=c["program"]+"\n",
                            capture_output=True, text=True, timeout=5)
        got = (p.stdout or "").strip().replace("\r\n","\n")
        if got == c["output"].strip():
            ok += 1
    except Exception:
        pass
print(f"{grp}: {ok}/{total}")
sys.exit(0 if ok == total else 1)
`;
  return {
    harnessFiles: [
      { path: "harness.py", contentBase64: b64(harness) },
      { path: "vectors.json", contentBase64: b64(JSON.stringify(vectors)) },
    ],
    buildSteps: [],
    testGroups: [
      { name: "visible", step: { cmd: "python3", args: ["/vercel/sandbox/harness.py", "visible"] }, weight: 1, passIf: "exit0" },
      { name: "hidden", step: { cmd: "python3", args: ["/vercel/sandbox/harness.py", "hidden"] }, weight: 3, passIf: "exit0" },
    ],
  };
}

/** Derive the grading plan for a Gauntlet stage from the per-student seed. */
export function deriveGrading(stageSlug: string, ctx: SeedContext): GradingPlan {
  switch (stageSlug) {
    case "cipher-drift":
      return { kind: "value", expected: expectedOf("cipherchain", ctx).marker };
    case "vault-run":
      return { kind: "value", expected: expectedOf("vault", ctx).token };
    case "hidden-pixels": {
      const e = expectedOf("stego", ctx);
      return {
        kind: "finding",
        spec: {
          fields: [
            { key: "marker", expected: e.marker, label: "Hidden marker" },
            { key: "bitOffset", expected: Number(e.bitOffset), label: "Start byte offset" },
          ],
        },
      };
    }
    case "the-ledger":
      return { kind: "value", expected: expectedOf("ledger", ctx).token };
    case "machine-code":
      return { kind: "code", language: "python", spec: vmSpec(ctx) };
    case "trace": {
      const e = expectedOf("injection", ctx);
      return {
        kind: "finding",
        spec: {
          fields: [
            { key: "payload", expected: e.payload, label: "Injected id value" },
            { key: "secret", expected: e.secret, label: "Leaked secret" },
          ],
        },
      };
    }
    default:
      throw new Error(`no grading plan for gauntlet stage ${stageSlug}`);
  }
}
