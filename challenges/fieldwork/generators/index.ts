/**
 * Field Work content generators.
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

// ---------------------------------------------------------------------------
// caesar
// ---------------------------------------------------------------------------

function caesarShiftChar(c: string, shift: number): string {
  const code = c.charCodeAt(0);
  if (code >= 65 && code <= 90) {
    return String.fromCharCode(((code - 65 + shift + 26) % 26) + 65);
  }
  if (code >= 97 && code <= 122) {
    return String.fromCharCode(((code - 97 + shift + 26) % 26) + 97);
  }
  return c;
}

function caesarShiftText(text: string, shift: number): string {
  return text
    .split("")
    .map((c) => caesarShiftChar(c, shift))
    .join("");
}

const CAESAR_SCENARIOS = ["checkpoint", "supply depot", "forward outpost", "relay station", "border crossing"] as const;

const caesar: Generator = (ctx, out) => {
  const files: { path: string; sha256: string }[] = [];
  const emit = makeEmitter(out, files);
  const cctx = ctx.namespace("caesar");

  const token = `FW1-${cctx.hex("token", 5)}`;
  const shift = cctx.int("shift", 1, 25);
  const scenario = cctx.pick("scenario", CAESAR_SCENARIOS).toUpperCase();

  const plaintext = `FIELD REPORT: AGENT CONFIRMS ARRIVAL AT THE ${scenario}. AUTHORIZATION TOKEN ${token} IS VALID UNTIL FURTHER NOTICE. STAND BY FOR ORDERS.`;
  const ciphertext = caesarShiftText(plaintext, shift);

  emit("caesar/intercept.txt", Buffer.from(`${ciphertext}\n`, "utf8"));

  return {
    files,
    metadata: { shift },
    expected: { token, shift: String(shift) },
  };
};

// ---------------------------------------------------------------------------
// vigenere
// ---------------------------------------------------------------------------

const VIGENERE_CRIB = "REPORT BEGINS ";
const VIGENERE_OBJECTS = ["CONVOY", "SHIPMENT", "UNIT", "PATROL", "CACHE"] as const;

function isLetter(c: string): boolean {
  return (c >= "A" && c <= "Z") || (c >= "a" && c <= "z");
}

function vigenereEncryptChar(c: string, shift: number): string {
  const isUpper = c >= "A" && c <= "Z";
  const base = isUpper ? 65 : 97;
  const code = c.charCodeAt(0) - base;
  return String.fromCharCode(((code + shift + 26) % 26) + base);
}

function vigenereEncrypt(text: string, key: string): string {
  let keyIdx = 0;
  let out = "";
  for (const c of text) {
    if (!isLetter(c)) {
      out += c;
      continue;
    }
    const keyChar = key[keyIdx % key.length] as string;
    const shift = keyChar.charCodeAt(0) - 97;
    out += vigenereEncryptChar(c, shift);
    keyIdx++;
  }
  return out;
}

const vigenere: Generator = (ctx, out) => {
  const files: { path: string; sha256: string }[] = [];
  const emit = makeEmitter(out, files);
  const vctx = ctx.namespace("vigenere");

  const token = `FW2-${vctx.hex("token", 5)}`;
  const keyLen = vctx.int("keyLen", 4, 6);
  let keyword = "";
  for (let i = 0; i < keyLen; i++) {
    keyword += String.fromCharCode(97 + vctx.int(`keychar:${i}`, 0, 25));
  }
  const objectWord = vctx.pick("object", VIGENERE_OBJECTS);

  const secretSentence = `${objectWord} CONFIRMS TOKEN ${token} AT RENDEZVOUS POINT`;
  const plaintext = `${VIGENERE_CRIB}${secretSentence}`;
  const ciphertext = vigenereEncrypt(plaintext, keyword);

  emit("vigenere/cipher.txt", Buffer.from(`${ciphertext}\n`, "utf8"));
  emit("vigenere/crib.txt", Buffer.from(`${VIGENERE_CRIB}\n`, "utf8"));

  return {
    files,
    metadata: { keyLen },
    expected: { token, key: keyword },
  };
};

// ---------------------------------------------------------------------------
// jwt
// ---------------------------------------------------------------------------

const JWT_ROLES = ["field-agent", "analyst-ii", "liaison", "observer"] as const;
const JWT_SITES = ["ALPHA", "BRAVO", "CHARLIE", "DELTA", "ECHO"] as const;

function base64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

const jwt: Generator = (ctx, out) => {
  const files: { path: string; sha256: string }[] = [];
  const emit = makeEmitter(out, files);
  const jctx = ctx.namespace("jwt");

  const clearance = `FW3-${jctx.hex("token", 5)}`;
  const role = jctx.pick("role", JWT_ROLES);
  const site = jctx.pick("site", JWT_SITES);
  const iat = jctx.int("iat", 1_700_000_000, 1_750_000_000);

  const header = { alg: "none", typ: "JWT" };
  const payload = { sub: "analyst", clearance, role, site, iat };

  const headerPart = base64url(JSON.stringify(header));
  const payloadPart = base64url(JSON.stringify(payload));
  const token = `${headerPart}.${payloadPart}.`;

  emit("jwt/token.jwt", Buffer.from(`${token}\n`, "utf8"));

  return {
    files,
    metadata: { role, site },
    expected: { claim: clearance },
  };
};

// ---------------------------------------------------------------------------
// layers
// ---------------------------------------------------------------------------

const LAYERS_CONTEXTS = ["ALPHA", "BRAVO", "CHARLIE", "DELTA"] as const;

const layers: Generator = (ctx, out) => {
  const files: { path: string; sha256: string }[] = [];
  const emit = makeEmitter(out, files);
  const lctx = ctx.namespace("layers");

  const token = `FW4-${lctx.hex("token", 5)}`;
  const context = lctx.pick("context", LAYERS_CONTEXTS);

  const plaintextJson = JSON.stringify({ token, context });
  const b64Inner = Buffer.from(plaintextJson, "utf8").toString("base64");
  const b64Outer = Buffer.from(b64Inner, "utf8").toString("base64");
  const hexBlob = Buffer.from(b64Outer, "utf8").toString("hex");

  emit("layers/blob.txt", Buffer.from(hexBlob, "utf8"));

  return {
    files,
    metadata: { context },
    expected: { token },
  };
};

// ---------------------------------------------------------------------------
// weblog
// ---------------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const BENIGN_PATHS = ["/", "/index.html", "/api/health", "/static/app.css", "/static/app.js", "/favicon.ico", "/login", "/about"] as const;
const SUSPICIOUS_PATHS = ["/admin", "/.env", "/backup.zip", "/wp-login.php", "/config.php"] as const;

function formatApacheTs(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = MONTHS[d.getUTCMonth()] as string;
  const year = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${day}/${month}/${year}:${hh}:${mm}:${ss} +0000`;
}

function ipFromCtx(ctx: SeedContext, label: string): string {
  const o1 = ctx.int(`${label}:o1`, 1, 223);
  const o2 = ctx.int(`${label}:o2`, 0, 255);
  const o3 = ctx.int(`${label}:o3`, 0, 255);
  const o4 = ctx.int(`${label}:o4`, 1, 254);
  return `${o1}.${o2}.${o3}.${o4}`;
}

interface LogEvent {
  ip: string;
  path: string;
  status: number;
  size: number;
}

const weblog: Generator = (ctx, out) => {
  const files: { path: string; sha256: string }[] = [];
  const emit = makeEmitter(out, files);
  const wctx = ctx.namespace("weblog");

  const attackerIp = ipFromCtx(wctx, "attackerIp");
  const benignIpPool: string[] = [];
  for (let i = 0; i < 10; i++) benignIpPool.push(ipFromCtx(wctx, `benignIp:${i}`));

  const benignCount = wctx.int("benignCount", 35, 42);

  const [mostProbedPath, ...restSuspicious] = wctx.shuffle("suspiciousOrder", SUSPICIOUS_PATHS);
  const otherPaths = restSuspicious.slice(0, 2);

  const mostProbedCount = wctx.int("mostProbedCount", 8, 12);
  const otherMax = Math.max(1, Math.floor(mostProbedCount / 2));
  const otherCounts = otherPaths.map((_, i) => wctx.int(`otherCount:${i}`, 1, otherMax));

  const events: LogEvent[] = [];

  for (let i = 0; i < benignCount; i++) {
    const ip = wctx.pick(`benignIp-pick:${i}`, benignIpPool);
    const path = wctx.pick(`benignPath:${i}`, BENIGN_PATHS);
    const size = wctx.int(`benignSize:${i}`, 200, 5000);
    events.push({ ip, path, status: 200, size });
  }

  let attackerTotal = 0;
  for (let i = 0; i < mostProbedCount; i++) {
    const size = wctx.int(`mostProbedSize:${i}`, 150, 400);
    events.push({ ip: attackerIp, path: mostProbedPath as string, status: 404, size });
    attackerTotal++;
  }
  for (let p = 0; p < otherPaths.length; p++) {
    const count = otherCounts[p] as number;
    for (let i = 0; i < count; i++) {
      const size = wctx.int(`otherSize:${p}:${i}`, 150, 400);
      events.push({ ip: attackerIp, path: otherPaths[p] as string, status: 404, size });
      attackerTotal++;
    }
  }

  const orderedEvents = wctx.shuffle("eventOrder", events);

  let ts = wctx.int("baseTs", 1_700_000_000, 1_750_000_000);
  const lines: string[] = [];
  for (let i = 0; i < orderedEvents.length; i++) {
    const ev = orderedEvents[i] as LogEvent;
    const tsStr = formatApacheTs(ts);
    lines.push(`${ev.ip} - - [${tsStr}] "GET ${ev.path} HTTP/1.1" ${ev.status} ${ev.size}`);
    ts += wctx.int(`tsDelta:${i}`, 1, 5);
  }

  const content = `${lines.join("\n")}\n`;
  emit("weblog/access.log", Buffer.from(content, "utf8"));

  return {
    files,
    metadata: { totalLines: orderedEvents.length, benignCount, attackerTotal },
    expected: { ip: attackerIp, path: mostProbedPath as string, count: String(attackerTotal) },
  };
};

// ---------------------------------------------------------------------------
// csvsum
// ---------------------------------------------------------------------------

const CSV_LABELS = ["grocery", "fuel", "rent", "utilities", "dining", "travel", "supplies", "misc", "subscription", "refund"] as const;

const CSVSUM_SPEC = `# csvsum

Read a CSV on stdin with header \`id,amount,label\`; print the integer sum
of the \`amount\` column.

- Input: CSV text on stdin, first line is the header \`id,amount,label\`.
- \`amount\` is always an integer (may be negative).
- Output: a single line containing the exact integer sum of every
  \`amount\` value in the input, and nothing else.

See \`example.csv\` for a worked sample input and \`example.out\` for its
expected output.
`;

const csvsum: Generator = (ctx, out) => {
  const files: { path: string; sha256: string }[] = [];
  const emit = makeEmitter(out, files);
  const sctx = ctx.namespace("csvsum");

  const rowCount = sctx.int("rowCount", 7, 9);
  const rows: { id: number; amount: number; label: string }[] = [];
  let sum = 0;
  for (let i = 0; i < rowCount; i++) {
    const isRefund = sctx.bool(`isRefund:${i}`, 0.2);
    const amount = isRefund ? -sctx.int(`amountNeg:${i}`, 1, 300) : sctx.int(`amountPos:${i}`, 1, 1000);
    const label = sctx.pick(`label:${i}`, CSV_LABELS);
    rows.push({ id: i + 1, amount, label });
    sum += amount;
  }

  const csvLines = ["id,amount,label", ...rows.map((r) => `${r.id},${r.amount},${r.label}`)];
  const csvContent = `${csvLines.join("\n")}\n`;
  const csvBuf = Buffer.from(csvContent, "utf8");

  emit("csvsum/example.csv", csvBuf);
  emit("csvsum/example.out", Buffer.from(`${sum}\n`, "utf8"));
  emit("csvsum/SPEC.md", Buffer.from(CSVSUM_SPEC, "utf8"));

  return {
    files,
    metadata: { rowCount },
    expected: { sampleSum: String(sum), sampleSha256: sha256Hex(csvBuf) },
  };
};

// ---------------------------------------------------------------------------

export const generators: Record<string, Generator> = {
  caesar,
  vigenere,
  jwt,
  layers,
  weblog,
  csvsum,
};
