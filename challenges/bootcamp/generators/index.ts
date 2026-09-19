/**
 * Boot Camp content generators.
 *
 * Every generator is a pure, deterministic function of a `SeedContext`:
 * the same context (same root seed + salt + namespace path) always
 * produces byte-identical files and identical `expected` grading values.
 * Generators are intentionally decoupled from application internals -
 * they only depend on the `SeedContext` *type* and the small `GenOutput`
 * / `GenManifest` contract below, both of which are safe to hand to a
 * trusted build step without exposing any app code.
 *
 * Boot Camp is the beginner campaign: every puzzle here is a single small
 * artifact and a single well-known encoding/scan technique. No multi-file
 * chains, no decoys-that-look-almost-real - just clean, unambiguous
 * exercises.
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

/** ROT13: rotate ASCII letters by 13, leave everything else untouched. */
function rot13(input: string): string {
  return input.replace(/[a-zA-Z]/g, (ch) => {
    const base = ch <= "Z" ? 65 : 97;
    return String.fromCharCode(((ch.charCodeAt(0) - base + 13) % 26) + base);
  });
}

/** ASCII-encode a string as space-separated 8-bit binary groups. */
function toBinaryGroups(input: string): string {
  return Array.from(Buffer.from(input, "ascii"))
    .map((byte) => byte.toString(2).padStart(8, "0"))
    .join(" ");
}

// ---------------------------------------------------------------------------
// welcome: base64
// ---------------------------------------------------------------------------

const WELCOME_GREETINGS = [
  "Welcome aboard, recruit!",
  "Greetings, new arrival!",
  "Hello and welcome to Boot Camp!",
  "Good morning, trainee!",
] as const;

const welcome: Generator = (ctx, out) => {
  const files: { path: string; sha256: string }[] = [];
  const emit = makeEmitter(out, files);
  const wctx = ctx.namespace("welcome");

  const token = `BC1-${wctx.hex("token", 4)}`;
  const greeting = wctx.pick("greeting", WELCOME_GREETINGS);
  const message = `${greeting} Your access code for today's briefing is ${token}. Keep it safe and report to the training officer when ready.`;
  const encoded = Buffer.from(message, "utf8").toString("base64");
  const content = `decode me:\n${encoded}\n`;

  emit("welcome/message.txt", Buffer.from(content, "utf8"));

  return {
    files,
    metadata: { messageLength: message.length },
    expected: { token },
  };
};

// ---------------------------------------------------------------------------
// rotate: ROT13
// ---------------------------------------------------------------------------

const ROTATE_LINES = [
  "Field note: the rally point password is",
  "Quartermaster memo: today's supply code is",
  "Drill sergeant reminder: checkpoint code is",
  "Radio operator log: authenticator string is",
] as const;

const rotate: Generator = (ctx, out) => {
  const files: { path: string; sha256: string }[] = [];
  const emit = makeEmitter(out, files);
  const rctx = ctx.namespace("rotate");

  const token = `BC2-${rctx.hex("token", 4)}`;
  const line = rctx.pick("line", ROTATE_LINES);
  const message = `${line} ${token}.`;
  const encoded = rot13(message);

  emit("rotate/note.txt", Buffer.from(`${encoded}\n`, "utf8"));

  return {
    files,
    metadata: { messageLength: message.length },
    expected: { token },
  };
};

// ---------------------------------------------------------------------------
// hexdump: hex encoding
// ---------------------------------------------------------------------------

const HEXDUMP_PHRASES = [
  "Recon report: access token",
  "Signal intercept: access token",
  "Comms log entry: access token",
  "Sentry checkpoint: access token",
] as const;

const hexdump: Generator = (ctx, out) => {
  const files: { path: string; sha256: string }[] = [];
  const emit = makeEmitter(out, files);
  const hctx = ctx.namespace("hexdump");

  const token = `BC3-${hctx.hex("token", 4)}`;
  const phrase = hctx.pick("phrase", HEXDUMP_PHRASES);
  const message = `${phrase} ${token}`;
  const encoded = Buffer.from(message, "utf8").toString("hex");

  emit("hexdump/data.hex", Buffer.from(`${encoded}\n`, "utf8"));

  return {
    files,
    metadata: { messageLength: message.length },
    expected: { token },
  };
};

// ---------------------------------------------------------------------------
// tally: arithmetic
// ---------------------------------------------------------------------------

const TALLY_COUNT = 12;

const tally: Generator = (ctx, out) => {
  const files: { path: string; sha256: string }[] = [];
  const emit = makeEmitter(out, files);
  const tctx = ctx.namespace("tally");

  const numbers: number[] = [];
  let sum = 0;
  for (let i = 0; i < TALLY_COUNT; i++) {
    const n = tctx.int(`n:${i}`, 1, 999);
    numbers.push(n);
    sum += n;
  }
  const content = `${numbers.join("\n")}\n`;

  emit("tally/numbers.txt", Buffer.from(content, "utf8"));

  return {
    files,
    metadata: { count: TALLY_COUNT },
    expected: { sum: String(sum), count: String(TALLY_COUNT) },
  };
};

// ---------------------------------------------------------------------------
// needle: needle-in-a-haystack scan
// ---------------------------------------------------------------------------

const NEEDLE_LINES = 40;
const NEEDLE_LEVELS = ["INFO", "WARN", "DEBUG", "ERROR"] as const;
const NEEDLE_MESSAGES = [
  "heartbeat ok",
  "cache miss for key",
  "connection established",
  "request completed",
  "queue drained",
  "retrying operation",
  "health check passed",
  "session refreshed",
] as const;

const needle: Generator = (ctx, out) => {
  const files: { path: string; sha256: string }[] = [];
  const emit = makeEmitter(out, files);
  const nctx = ctx.namespace("needle");

  const token = `BC5-${nctx.hex("token", 4)}`;
  const secretLineIndex = nctx.int("secretLine", 0, NEEDLE_LINES - 1);
  const baseTs = nctx.int("ts-base", 1_700_000_000, 1_750_000_000);

  const lines: string[] = [];
  for (let i = 0; i < NEEDLE_LINES; i++) {
    const ts = new Date((baseTs + i * 17) * 1000).toISOString();
    const level = nctx.pick(`level:${i}`, NEEDLE_LEVELS);
    if (i === secretLineIndex) {
      lines.push(`[${ts}] ${level} config loaded SECRET=${token}`);
      continue;
    }
    const msg = nctx.pick(`msg:${i}`, NEEDLE_MESSAGES);
    const id = nctx.hex(`id:${i}`, 3);
    lines.push(`[${ts}] ${level} ${msg} id=${id}`);
  }
  const content = `${lines.join("\n")}\n`;

  emit("needle/haystack.log", Buffer.from(content, "utf8"));

  return {
    files,
    metadata: { lineCount: NEEDLE_LINES },
    expected: { token, line: String(secretLineIndex + 1) },
  };
};

// ---------------------------------------------------------------------------
// binary: 8-bit binary encoding
// ---------------------------------------------------------------------------

const binary: Generator = (ctx, out) => {
  const files: { path: string; sha256: string }[] = [];
  const emit = makeEmitter(out, files);
  const bctx = ctx.namespace("binary");

  const token = `BC6-${bctx.hex("token", 4)}`;
  const encoded = toBinaryGroups(token);

  emit("binary/bits.txt", Buffer.from(`${encoded}\n`, "utf8"));

  return {
    files,
    metadata: { tokenLength: token.length },
    expected: { token },
  };
};

// ---------------------------------------------------------------------------

export const generators: Record<string, Generator> = {
  welcome,
  rotate,
  hexdump,
  tally,
  needle,
  binary,
};
