/**
 * Project Janus content generators.
 *
 * Every generator is a pure, deterministic function of a `SeedContext`:
 * the same context (same root seed + salt + namespace path) always
 * produces byte-identical files and identical `expected` grading values.
 * Generators are intentionally decoupled from application internals -
 * they only depend on the `SeedContext` *type* and the small `GenOutput`
 * / `GenManifest` contract below, both of which are safe to hand to a
 * trusted build step without exposing any app code.
 */
import { createHash } from "node:crypto";
import type { SeedContext } from "../../../src/lib/seed";

/** Sink a generator writes its output files into. */
export interface GenOutput {
  file(path: string, content: Buffer): void;
}

/** What a generator hands back to the (trusted) build/grading pipeline. */
export interface GenManifest {
  files: { path: string; sha256: string }[];
  metadata: Record<string, unknown>;
  /**
   * Seed-derived grading answers. Never shipped to the student - only
   * returned to the trusted caller that also holds the grader.
   */
  expected: Record<string, string>;
}

export type Generator = (ctx: SeedContext, out: GenOutput) => GenManifest;

function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Wrap a `GenOutput` with a small helper that writes a file through it
 * *and* records its path + sha256 so a generator can build its own
 * `GenManifest.files` list without `GenOutput` needing a getter.
 */
function makeEmitter(
  out: GenOutput,
  files: { path: string; sha256: string }[],
): (path: string, content: Buffer) => void {
  return (path, content) => {
    out.file(path, content);
    files.push({ path, sha256: sha256Hex(content) });
  };
}

function padTo(buf: Buffer, len: number, fill = 0x20): Buffer {
  if (buf.length > len) {
    throw new RangeError(`padTo: content of length ${buf.length} exceeds pad length ${len}`);
  }
  const result = Buffer.alloc(len, fill);
  buf.copy(result, 0);
  return result;
}

// ---------------------------------------------------------------------------
// first-light: filesystem
// ---------------------------------------------------------------------------

const FS_DIRS = ["var/log/app", "var/log/sys", "etc/config", "home/operator/notes", "tmp/cache"] as const;
const FS_LOG_LINES = 40;

function formatTimestamp(baseTs: number, i: number): string {
  return new Date((baseTs + i * 37) * 1000).toISOString();
}

const filesystem: Generator = (ctx, out) => {
  const files: { path: string; sha256: string }[] = [];
  const emit = makeEmitter(out, files);
  const fsCtx = ctx.namespace("filesystem");

  const marker = `MARKER-${fsCtx.hex("marker", 4)}`;

  const listingLines: string[] = [];
  for (const dir of FS_DIRS) {
    listingLines.push(`d ${dir}`);
    const fileCount = fsCtx.int(`filecount:${dir}`, 2, 4);
    for (let i = 0; i < fileCount; i++) {
      const size = fsCtx.int(`size:${dir}:${i}`, 128, 65536);
      const uid = fsCtx.hex(`uid:${dir}:${i}`, 4);
      listingLines.push(`f ${dir}/entry-${uid}.dat ${size}`);
    }
  }

  const baseTs = fsCtx.int("ts-base", 1_690_000_000, 1_750_000_000);
  const markerLine = fsCtx.int("marker-line", 5, FS_LOG_LINES - 5);
  const logLines: string[] = [];
  for (let i = 0; i < FS_LOG_LINES; i++) {
    const ts = formatTimestamp(baseTs, i);
    if (i === markerLine) {
      logLines.push(`[${ts}] anomaly detected token=${marker}`);
      continue;
    }
    const kind = fsCtx.pick(`decoy-kind:${i}`, ["info", "warn", "debug"] as const);
    const noise = fsCtx.hex(`decoy:${i}`, 6);
    if (fsCtx.bool(`decoy-fake-marker:${i}`, 0.3)) {
      logLines.push(`[${ts}] ${kind} session=${noise} near-miss=MRKR-${noise}`);
    } else {
      logLines.push(`[${ts}] ${kind} heartbeat id=${noise}`);
    }
  }
  const logContent = `${logLines.join("\n")}\n`;
  listingLines.push(`f var/log/app/service.log ${Buffer.byteLength(logContent, "utf8")}`);
  const listing = `${listingLines.join("\n")}\n`;

  emit("filesystem/listing.txt", Buffer.from(listing, "utf8"));
  emit("filesystem/var/log/app/service.log", Buffer.from(logContent, "utf8"));

  return {
    files,
    metadata: { dirCount: FS_DIRS.length, logLines: FS_LOG_LINES, markerLine },
    expected: { marker },
  };
};

// ---------------------------------------------------------------------------
// silent-relay: pcap
// ---------------------------------------------------------------------------

const PCAP_MAGIC = 0xa1b2c3d4;
const LINKTYPE_USER0 = 147;
const PCAP_BODY_SIZE = 16;
const PCAP_MSG_TYPES = [0x01, 0x02, 0x03, 0x04, 0x05] as const;

const pcap: Generator = (ctx, out) => {
  const files: { path: string; sha256: string }[] = [];
  const emit = makeEmitter(out, files);
  const pctx = ctx.namespace("pcap");

  const lengthFieldWidth = pctx.pick("lengthFieldWidth", [2, 4] as const);
  const lengthFieldEndian = pctx.pick("lengthFieldEndian", ["LE", "BE"] as const);
  const checksumKind = pctx.pick("checksumKind", ["xor8", "sum8", "xor16"] as const);
  const msgTypeOffset = pctx.int("msgTypeOffset", 0, 3);
  const seqOffset = pctx.int("seqOffset", 4, 6);
  const recordCount = pctx.int("recordCount", 6, 10);
  const checksumWidth = checksumKind === "xor16" ? 2 : 1;
  const checksumOffset = PCAP_BODY_SIZE - checksumWidth;

  let seq = pctx.int("seqStart", 1, 50);
  let tsSec = pctx.int("tsStart", 1_700_000_000, 1_750_000_000);

  const globalHeader = Buffer.alloc(24);
  globalHeader.writeUInt32LE(PCAP_MAGIC, 0);
  globalHeader.writeUInt16LE(2, 4);
  globalHeader.writeUInt16LE(4, 6);
  globalHeader.writeInt32LE(0, 8);
  globalHeader.writeUInt32LE(0, 12);
  globalHeader.writeUInt32LE(65535, 16);
  globalHeader.writeUInt32LE(LINKTYPE_USER0, 20);

  const recordBuffers: Buffer[] = [];
  for (let i = 0; i < recordCount; i++) {
    const body = Buffer.alloc(PCAP_BODY_SIZE);
    for (let b = 0; b < PCAP_BODY_SIZE; b++) {
      body[b] = pctx.int(`filler:${i}:${b}`, 0, 255);
    }
    body[msgTypeOffset] = pctx.pick(`msgType:${i}`, PCAP_MSG_TYPES);
    body.writeUInt16BE(seq & 0xffff, seqOffset);
    seq += 1;

    if (checksumKind === "xor8") {
      let acc = 0;
      for (let b = 0; b < PCAP_BODY_SIZE; b++) if (b !== checksumOffset) acc ^= body[b] as number;
      body[checksumOffset] = acc;
    } else if (checksumKind === "sum8") {
      let acc = 0;
      for (let b = 0; b < PCAP_BODY_SIZE; b++) if (b !== checksumOffset) acc = (acc + (body[b] as number)) & 0xff;
      body[checksumOffset] = acc;
    } else {
      let acc0 = 0;
      let acc1 = 0;
      for (let b = 0; b < PCAP_BODY_SIZE; b++) {
        if (b === checksumOffset || b === checksumOffset + 1) continue;
        if (b % 2 === 0) acc0 ^= body[b] as number;
        else acc1 ^= body[b] as number;
      }
      if (lengthFieldEndian === "LE") {
        body[checksumOffset] = acc0;
        body[checksumOffset + 1] = acc1;
      } else {
        body[checksumOffset] = acc1;
        body[checksumOffset + 1] = acc0;
      }
    }

    const lenField = Buffer.alloc(lengthFieldWidth);
    if (lengthFieldWidth === 2) {
      if (lengthFieldEndian === "LE") lenField.writeUInt16LE(PCAP_BODY_SIZE, 0);
      else lenField.writeUInt16BE(PCAP_BODY_SIZE, 0);
    } else {
      if (lengthFieldEndian === "LE") lenField.writeUInt32LE(PCAP_BODY_SIZE, 0);
      else lenField.writeUInt32BE(PCAP_BODY_SIZE, 0);
    }

    const frame = Buffer.concat([lenField, body]);

    const recHeader = Buffer.alloc(16);
    recHeader.writeUInt32LE(tsSec, 0);
    recHeader.writeUInt32LE(pctx.int(`tsUsec:${i}`, 0, 999_999), 4);
    recHeader.writeUInt32LE(frame.length, 8);
    recHeader.writeUInt32LE(frame.length, 12);
    tsSec += pctx.int(`tsDelta:${i}`, 1, 5);

    recordBuffers.push(Buffer.concat([recHeader, frame]));
  }

  const pcapBuffer = Buffer.concat([globalHeader, ...recordBuffers]);
  emit("pcap/capture.pcap", pcapBuffer);

  return {
    files,
    metadata: { recordCount, bodySize: PCAP_BODY_SIZE },
    expected: {
      protocolClass: "length-prefixed framing",
      lengthFieldOffset: "0",
      lengthFieldWidth: String(lengthFieldWidth),
      lengthFieldEndian,
      msgTypeOffset: String(msgTypeOffset),
      seqOffset: String(seqOffset),
      checksumKind,
      checksumOffset: String(checksumOffset),
      recordCount: String(recordCount),
    },
  };
};

// ---------------------------------------------------------------------------
// the-archive: gitrepo
// ---------------------------------------------------------------------------

interface CommitRecord {
  hash: string;
  parent: string | null;
  message: string;
  timestamp: number;
  files: Record<string, string>;
}

const gitrepo: Generator = (ctx, out) => {
  const files: { path: string; sha256: string }[] = [];
  const emit = makeEmitter(out, files);
  const gctx = ctx.namespace("gitrepo");

  const fragment = `ARCHIVE-FRAGMENT-${gctx.hex("fragment", 5)}`;
  const baseTs = gctx.int("baseTs", 1_690_000_000, 1_700_000_000);

  const hash0 = gctx.hex("hash:c0", 20);
  const hash1 = gctx.hex("hash:c1", 20);
  const hash2 = gctx.hex("hash:c2", 20);
  const hash3 = gctx.hex("hash:c3", 20);

  const secretPath = "config/staging.env";
  const readmePath = "README.md";

  const commits: CommitRecord[] = [
    {
      hash: hash0,
      parent: null,
      message: "init: scaffold project",
      timestamp: baseTs,
      files: { [readmePath]: "# staging service\n\ninternal deployment notes.\n" },
    },
    {
      hash: hash1,
      parent: hash0,
      message: "chore: add staging credentials placeholder",
      timestamp: baseTs + gctx.int("d1", 3600, 7200),
      files: { [secretPath]: `STAGING_TOKEN=${fragment}\n` },
    },
    {
      hash: hash2,
      parent: hash1,
      message: 'Revert "chore: add staging credentials placeholder"',
      timestamp: baseTs + gctx.int("d2", 7300, 14400),
      files: { [secretPath]: "STAGING_TOKEN=REDACTED_PENDING_ROTATION\n" },
    },
    {
      hash: hash3,
      parent: hash2,
      message: "docs: tidy up notes",
      timestamp: baseTs + gctx.int("d3", 14500, 21600),
      files: { [readmePath]: "# staging service\n\ninternal deployment notes.\nsee ops runbook.\n" },
    },
  ];

  const headFiles: Record<string, string> = {};
  for (const commit of commits) Object.assign(headFiles, commit.files);

  const historyDoc = { head: hash3, commits };
  emit("gitrepo/history.json", Buffer.from(`${JSON.stringify(historyDoc, null, 2)}\n`, "utf8"));
  emit("gitrepo/worktree/config/staging.env", Buffer.from(headFiles[secretPath] as string, "utf8"));
  emit("gitrepo/worktree/README.md", Buffer.from(headFiles[readmePath] as string, "utf8"));

  return {
    files,
    metadata: { commitCount: commits.length, head: hash3 },
    expected: { archiveFragment: fragment, revertedCommit: hash1, secretPath },
  };
};

// ---------------------------------------------------------------------------
// out-of-order: cservice
// ---------------------------------------------------------------------------

type OffByOneKind = "loop-bound" | "write-index";

function buildCSource(fnName: string, bufferSize: number, kind: OffByOneKind): string {
  const loopBody =
    kind === "loop-bound"
      ? `    for (i = 0; i <= n; i++) {\n        dst->data[i] = src[i];\n    }`
      : `    for (i = 0; i < n; i++) {\n        dst->data[i + 1] = src[i];\n    }`;

  return `#include <stddef.h>
#include <string.h>

#define BUFFER_SIZE ${bufferSize}

typedef struct {
    unsigned char data[BUFFER_SIZE];
    size_t len;
} frame_buffer_t;

int ${fnName}(frame_buffer_t *dst, const unsigned char *src, size_t n) {
    if (dst == NULL || src == NULL) {
        return -1;
    }
    if (n > BUFFER_SIZE) {
        return -1;
    }

    size_t i;
${loopBody}

    dst->len = n;
    return 0;
}
`;
}

function buildHarnessDoc(fnName: string, bufferSize: number): string {
  return `# Regression harness: ${fnName}

## Fixture

- Buffer capacity: ${bufferSize} bytes.
- Input: a source buffer of exactly ${bufferSize} bytes, filled with a
  deterministic byte pattern.

## Procedure

1. Call \`${fnName}\` with the fixture input at its full length.
2. Confirm the call returns 0 (success) and does not corrupt memory
   adjacent to the destination buffer.
3. Confirm \`dst->len\` equals the input length and \`dst->data\` matches
   the input bytes exactly, in order.
4. Run the fixture under a memory-safety instrumented build. A clean run
   produces no out-of-bounds read or write reports.

## Pass criteria

The regression passes when step 4 reports zero out-of-bounds accesses
for the maximum-length fixture. A failing run indicates the copy touches
memory outside \`dst->data\`.
`;
}

const cservice: Generator = (ctx, out) => {
  const files: { path: string; sha256: string }[] = [];
  const emit = makeEmitter(out, files);
  const cctx = ctx.namespace("cservice");

  const bufferSize = cctx.int("bufferSize", 16, 64);
  const fnName = cctx.pick("fnName", ["copy_frame", "ingest_record", "drain_queue"] as const);
  const offByOneKind = cctx.pick("offByOneKind", ["loop-bound", "write-index"] as const);

  emit("cservice/src/service.c", Buffer.from(buildCSource(fnName, bufferSize, offByOneKind), "utf8"));
  emit("cservice/tests/regression.md", Buffer.from(buildHarnessDoc(fnName, bufferSize), "utf8"));

  return {
    files,
    metadata: { bufferSize, fnName },
    expected: {
      bugFunction: fnName,
      bufferSize: String(bufferSize),
      offByOneKind,
      overflowBytes: "1",
    },
  };
};

// ---------------------------------------------------------------------------
// residual-state: config
// ---------------------------------------------------------------------------

const CONFIG_PLAINTEXT_LEN = 256;

function xorWithKeystream(plain: Buffer, keystream: Buffer): Buffer {
  const cipher = Buffer.alloc(plain.length);
  for (let i = 0; i < plain.length; i++) {
    cipher[i] = (plain[i] as number) ^ (keystream[i] as number);
  }
  return cipher;
}

const config: Generator = (ctx, out) => {
  const files: { path: string; sha256: string }[] = [];
  const emit = makeEmitter(out, files);
  const cctx = ctx.namespace("config");

  const nonceHex = cctx.hex("nonce", 12);
  const keystream = cctx.bytes("keystream", CONFIG_PLAINTEXT_LEN);
  const plaintextMarker = `CONFIG-OK-${cctx.hex("marker", 4)}`;
  const rotatedAt = cctx.int("rotatedAt", 1_700_000_000, 1_750_000_000);

  const referencePlaintext = `${JSON.stringify(
    { service: "residual-state", mode: "default-template", marker: "CONFIG-DEFAULT-TEMPLATE" },
    null,
    2,
  )}\n`;
  const targetPlaintext = `${JSON.stringify(
    { service: "residual-state", mode: "recovered", marker: plaintextMarker, rotatedAt },
    null,
    2,
  )}\n`;

  const refBuf = padTo(Buffer.from(referencePlaintext, "utf8"), CONFIG_PLAINTEXT_LEN);
  const targetBuf = padTo(Buffer.from(targetPlaintext, "utf8"), CONFIG_PLAINTEXT_LEN);

  const refCipher = xorWithKeystream(refBuf, keystream);
  const targetCipher = xorWithKeystream(targetBuf, keystream);

  const header = (label: string): Buffer => Buffer.from(`nonce=${nonceHex}\nlabel=${label}\n---\n`, "utf8");

  emit("config/reference.cfg", Buffer.concat([header("reference-default"), refCipher]));
  emit("config/target.cfg", Buffer.concat([header("target-recovered"), targetCipher]));
  emit("config/reference-plaintext.json", Buffer.from(referencePlaintext, "utf8"));

  return {
    files,
    metadata: { nonce: nonceHex, plaintextLen: CONFIG_PLAINTEXT_LEN },
    expected: {
      plaintextMarker,
      nonce: nonceHex,
      targetPlaintextSha256: sha256Hex(targetBuf),
    },
  };
};

// ---------------------------------------------------------------------------

export const generators: Record<string, Generator> = {
  filesystem,
  pcap,
  gitrepo,
  cservice,
  config,
};
