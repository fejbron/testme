import type { SeedContext } from "@/lib/seed";
import { generators } from "../../../challenges/fieldwork/generators";
import type { CodeSpec } from "@/lib/graders/code";
import type { GradingPlan } from "./plan";

const b64 = (s: string): string => Buffer.from(s, "utf8").toString("base64");

function expectedOf(name: string, ctx: SeedContext): Record<string, string> {
  const gen = generators[name];
  if (!gen) throw new Error(`unknown generator ${name}`);
  return gen(ctx, { file: () => {} }).expected;
}

/** csvsum code stage: fresh seeded CSVs, student's program sums the amount column. */
function csvSumSpec(ctx: SeedContext): CodeSpec {
  const c = ctx.namespace("csv-hidden");
  const makeCsv = (label: string, rows: number) => {
    let sum = 0;
    const lines = ["id,amount,label"];
    for (let i = 0; i < rows; i++) {
      const amount = c.int(`${label}:amt:${i}`, -50, 500);
      sum += amount;
      const id = c.hex(`${label}:id:${i}`, 3);
      const tag = c.pick(`${label}:tag:${i}`, ["alpha", "bravo", "charlie", "delta"]);
      lines.push(`${id},${amount},${tag}`);
    }
    return { csv: lines.join("\n") + "\n", sum };
  };
  const make = (label: string, n: number) =>
    Array.from({ length: n }, (_, i) => makeCsv(`${label}:${i}`, c.int(`${label}:rows:${i}`, 5, 12)));
  const vectors = { visible: make("vis", 2), hidden: make("hid", 5) };
  const harness = String.raw`import json, sys, subprocess
grp = sys.argv[1]
data = json.load(open("/vercel/sandbox/vectors.json"))
cases = data[grp]
ok = 0
total = len(cases)
for c in cases:
    try:
        p = subprocess.run(["python3","/vercel/sandbox/submission.py"], input=c["csv"],
                            capture_output=True, text=True, timeout=5)
        got = (p.stdout or "").strip().splitlines()
        val = int(got[-1]) if got else None
        if val == c["sum"]:
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

/** Field Work (intermediate). */
export function deriveGrading(stageSlug: string, ctx: SeedContext): GradingPlan {
  switch (stageSlug) {
    case "shift":
      return { kind: "value", expected: expectedOf("caesar", ctx).token };
    case "keyword":
      return { kind: "value", expected: expectedOf("vigenere", ctx).token };
    case "token-forge":
      return { kind: "value", expected: expectedOf("jwt", ctx).claim };
    case "onion":
      return { kind: "value", expected: expectedOf("layers", ctx).token };
    case "access": {
      const e = expectedOf("weblog", ctx);
      return {
        kind: "finding",
        spec: {
          fields: [
            { key: "ip", expected: e.ip, label: "Attacker IP" },
            { key: "path", expected: e.path, label: "Most-probed path" },
          ],
        },
      };
    }
    case "tally-script":
      return { kind: "code", language: "python", spec: csvSumSpec(ctx) };
    default:
      throw new Error(`no grading plan for fieldwork stage ${stageSlug}`);
  }
}
