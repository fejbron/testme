import type { SeedContext } from "@/lib/seed";
import { generators } from "../../../challenges/janus/generators";
import type { FindingSpec } from "@/lib/graders/finding";
import type { CodeSpec } from "@/lib/graders/code";
import type { EnvCheck } from "@/lib/graders/environment-state";

const b64 = (s: string): string => Buffer.from(s, "utf8").toString("base64");

/** Run a generator with a discarding sink to obtain its seed-derived `expected` map. */
function expectedOf(name: string, ctx: SeedContext): Record<string, string> {
  const gen = generators[name];
  if (!gen) throw new Error(`unknown generator ${name}`);
  return gen(ctx, { file: () => {} }).expected;
}

export type GradingPlan =
  | { kind: "value"; expected: string }
  | { kind: "finding"; spec: FindingSpec }
  | { kind: "code"; language: "python" | "c"; spec: CodeSpec }
  | { kind: "environment_state"; checks: EnvCheck[] };

// --- transcriber hidden-vector construction (mirrors the pcap frame layout) ---
const PCAP_BODY_SIZE = 16;
const PCAP_MSG_TYPES = [0x01, 0x02, 0x03, 0x04, 0x05] as const;

function buildFrame(ctx: SeedContext, i: number, layout: { width: number; endian: "LE" | "BE"; msgTypeOffset: number; seqOffset: number }, seq: number) {
  const body = Buffer.alloc(PCAP_BODY_SIZE);
  for (let b = 0; b < PCAP_BODY_SIZE; b++) body[b] = ctx.int(`hf:${i}:${b}`, 0, 255);
  const msgType = ctx.pick(`hmt:${i}`, PCAP_MSG_TYPES);
  body[layout.msgTypeOffset] = msgType;
  body.writeUInt16BE(seq & 0xffff, layout.seqOffset);
  const lenField = Buffer.alloc(layout.width);
  if (layout.width === 2) layout.endian === "LE" ? lenField.writeUInt16LE(PCAP_BODY_SIZE, 0) : lenField.writeUInt16BE(PCAP_BODY_SIZE, 0);
  else layout.endian === "LE" ? lenField.writeUInt32LE(PCAP_BODY_SIZE, 0) : lenField.writeUInt32BE(PCAP_BODY_SIZE, 0);
  const frame = Buffer.concat([lenField, body]);
  return { hex: frame.toString("hex"), length: PCAP_BODY_SIZE, msgType, seq: seq & 0xffff };
}

function transcriberSpec(ctx: SeedContext): CodeSpec {
  const exp = expectedOf("pcap", ctx);
  const layout = {
    width: Number(exp.lengthFieldWidth),
    endian: exp.lengthFieldEndian as "LE" | "BE",
    msgTypeOffset: Number(exp.msgTypeOffset),
    seqOffset: Number(exp.seqOffset),
  };
  const mk = (label: string, n: number, seq0: number) => {
    const c = ctx.namespace(label);
    return Array.from({ length: n }, (_, i) => buildFrame(c, i, layout, seq0 + i));
  };
  const vectors = {
    visible: mk("hidden-visible", 4, 100),
    hidden: mk("hidden-secret", 6, 900),
    malformed: mk("hidden-mal", 2, 5).map((v) => ({ hex: v.hex.slice(0, v.hex.length - 6) })),
  };
  const harness = String.raw`import json, sys, subprocess
grp = sys.argv[1]
data = json.load(open("/vercel/sandbox/vectors.json"))
cases = data[grp]
ok = 0
total = len(cases)
for c in cases:
    try:
        p = subprocess.run(["python3","/vercel/sandbox/submission.py"], input=c["hex"]+"\n",
                            capture_output=True, text=True, timeout=5)
        out = (p.stdout or "").strip().splitlines()
        if grp == "malformed":
            # must not crash; any clean exit counts
            if p.returncode == 0: ok += 1
            continue
        obj = json.loads(out[-1]) if out else {}
        if int(obj.get("length",-1))==c["length"] and int(obj.get("msgType",-1))==c["msgType"] and int(obj.get("seq",-1))==c["seq"]:
            ok += 1
    except Exception:
        pass
print(f"{grp}: {ok}/{total}")
sys.exit(0 if ok==total else 1)
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
      { name: "malformed", step: { cmd: "python3", args: ["/vercel/sandbox/harness.py", "malformed"] }, weight: 1, passIf: "exit0" },
    ],
  };
}

function patchRegressionSpec(ctx: SeedContext): CodeSpec {
  const exp = expectedOf("cservice", ctx);
  const fnName = exp.bugFunction;
  const bufferSize = Number(exp.bufferSize);
  const mainC = String.raw`#include <stddef.h>
#include <string.h>
#include <stdio.h>
#include "submission.c"
int main(void){
  frame_buffer_t dst; memset(&dst, 0, sizeof(dst));
  unsigned char src[${bufferSize}];
  for (size_t i=0;i<${bufferSize};i++) src[i]=(unsigned char)(i*7+3);
  int rc = ${fnName}(&dst, src, ${bufferSize});
  if (rc!=0){ printf("rc!=0\n"); return 2; }
  if (dst.len!=${bufferSize}){ printf("len\n"); return 3; }
  if (memcmp(dst.data, src, ${bufferSize})!=0){ printf("mismatch\n"); return 4; }
  printf("regression: ok\n");
  return 0;
}
`;
  return {
    harnessFiles: [{ path: "main.c", contentBase64: b64(mainC) }],
    buildSteps: [{ cmd: "bash", args: ["-c", "cd /vercel/sandbox && gcc -fsanitize=address -g -O1 -o prog main.c 2>build.log; echo built"] }],
    testGroups: [{ name: "regression", step: { cmd: "bash", args: ["-c", "cd /vercel/sandbox && ./prog"] }, weight: 1, passIf: { stdoutIncludes: "regression: ok" } }],
  };
}

/** Derive the grading plan for a Janus stage from the per-student seed context. */
export function deriveGrading(stageSlug: string, ctx: SeedContext): GradingPlan {
  switch (stageSlug) {
    case "first-light":
      return { kind: "value", expected: expectedOf("filesystem", ctx).marker };
    case "silent-relay": {
      const exp = expectedOf("pcap", ctx);
      return { kind: "finding", spec: { fields: [{ key: "protocolClass", expected: exp.protocolClass, label: "Protocol class" }] } };
    }
    case "framing": {
      const e = expectedOf("pcap", ctx);
      return {
        kind: "finding",
        spec: {
          fields: [
            { key: "lengthFieldOffset", expected: Number(e.lengthFieldOffset), label: "Length offset" },
            { key: "lengthFieldWidth", expected: Number(e.lengthFieldWidth), label: "Length width" },
            { key: "lengthFieldEndian", expected: e.lengthFieldEndian, label: "Endianness" },
            { key: "msgTypeOffset", expected: Number(e.msgTypeOffset), label: "Msg-type offset" },
            { key: "seqOffset", expected: Number(e.seqOffset), label: "Sequence offset" },
            { key: "checksumKind", expected: e.checksumKind, label: "Checksum kind" },
          ],
        },
      };
    }
    case "transcriber":
      return { kind: "code", language: "python", spec: transcriberSpec(ctx) };
    case "the-archive":
      return { kind: "value", expected: expectedOf("gitrepo", ctx).archiveFragment };
    case "out-of-order":
      return { kind: "code", language: "c", spec: patchRegressionSpec(ctx) };
    case "residual-state":
      return { kind: "value", expected: expectedOf("config", ctx).plaintextMarker };
    case "reconstruction": {
      const marker = expectedOf("config", ctx).plaintextMarker;
      return {
        kind: "environment_state",
        checks: [
          { name: "solution-present", cmd: "bash", args: ["-c", "cat /vercel/sandbox/reconstruction/solution 2>/dev/null || true"], passIf: { stdoutIncludes: marker } },
        ],
      };
    }
    default:
      throw new Error(`no grading plan for stage ${stageSlug}`);
  }
}
