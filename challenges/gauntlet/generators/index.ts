/**
 * The Gauntlet content generators.
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
// cipher-drift: cipherchain
// ---------------------------------------------------------------------------

/** Caesar/ROT-N shift over A-Za-z only; everything else passes through. */
function caesarShift(input: string, shift: number): string {
  let result = "";
  for (const ch of input) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      result += String.fromCharCode((((code - 65 + shift) % 26) + 26) % 26 + 65);
    } else if (code >= 97 && code <= 122) {
      result += String.fromCharCode((((code - 97 + shift) % 26) + 26) % 26 + 97);
    } else {
      result += ch;
    }
  }
  return result;
}

const cipherchain: Generator = (ctx, out) => {
  const files: { path: string; sha256: string }[] = [];
  const emit = makeEmitter(out, files);
  const cctx = ctx.namespace("cipherchain");

  const marker = `GAUNTLET-${cctx.hex("marker", 4)}`;
  const shift = cctx.int("shift", 1, 25);

  // layer 1: caesar/rot shift, layer 2: base64, layer 3: hex.
  const layer1 = caesarShift(marker, shift);
  const layer2 = Buffer.from(layer1, "utf8").toString("base64");
  const layer3 = Buffer.from(layer2, "utf8").toString("hex");

  const header =
    "GAUNTLET :: cipher-drift\n" +
    "This blob was produced by applying three reversible text transformations,\n" +
    "in sequence, to a short secret marker. Reverse them in the correct order\n" +
    "to recover the original marker.\n" +
    "---\n";
  const blob = Buffer.from(`${header}${layer3}\n`, "utf8");

  emit("cipherchain/blob.txt", blob);

  return {
    files,
    metadata: { layers: 3, finalEncoding: "hex" },
    expected: { marker, shift: String(shift) },
  };
};

// ---------------------------------------------------------------------------
// vault-run: vault
// ---------------------------------------------------------------------------

const vault: Generator = (ctx, out) => {
  const files: { path: string; sha256: string }[] = [];
  const emit = makeEmitter(out, files);
  const vctx = ctx.namespace("vault");

  const keyLen = vctx.int("keyLen", 4, 7);
  const key = vctx.bytes("key", keyLen);
  const token = `VAULT-${vctx.hex("token", 6)}`;

  // The prefix up through the start of the token value is fixed structure
  // (doesn't depend on the seed) - that's exactly what makes it a valid
  // known-plaintext crib.
  const prefix = '{\n  "service": "vault",\n  "token": "';
  const suffix = '"\n}\n';
  const plaintext = Buffer.from(`${prefix}${token}${suffix}`, "utf8");

  const cipher = Buffer.alloc(plaintext.length);
  for (let i = 0; i < plaintext.length; i++) {
    cipher[i] = (plaintext[i] as number) ^ (key[i % keyLen] as number);
  }

  emit("vault/cipher.bin", cipher);
  emit("vault/crib.txt", Buffer.from(prefix, "utf8"));

  return {
    files,
    metadata: { plaintextLength: plaintext.length, keyLen },
    expected: { token, keyHex: key.toString("hex"), keyLen: String(keyLen) },
  };
};

// ---------------------------------------------------------------------------
// hidden-pixels: stego
// ---------------------------------------------------------------------------

/**
 * HKDF-SHA256 (used by `SeedContext.bytes`) can derive at most 255*32=8160
 * bytes per call. Pixel buffers can exceed that, so derive in fixed-size
 * chunks (each its own deterministic label) and concatenate.
 */
function deriveLargeBytes(sctx: SeedContext, label: string, n: number): Buffer {
  const CHUNK = 4096;
  const chunks: Buffer[] = [];
  let remaining = n;
  let i = 0;
  while (remaining > 0) {
    const take = Math.min(CHUNK, remaining);
    chunks.push(sctx.bytes(`${label}:chunk:${i}`, take));
    remaining -= take;
    i++;
  }
  return Buffer.concat(chunks);
}

const stego: Generator = (ctx, out) => {
  const files: { path: string; sha256: string }[] = [];
  const emit = makeEmitter(out, files);
  const sctx = ctx.namespace("stego");

  const width = sctx.int("width", 32, 64);
  const height = sctx.int("height", 32, 64);
  const pixelBytesLen = width * height * 3;
  const pixels = deriveLargeBytes(sctx, "pixels", pixelBytesLen);

  const marker = `SEEN-${sctx.hex("marker", 4)}`;
  const requiredBits = marker.length * 8;
  const maxOffset = pixelBytesLen - requiredBits;
  const bitOffset = sctx.int("bitOffset", 0, maxOffset - 1);

  const pixelData = Buffer.from(pixels);
  let cursor = bitOffset;
  for (const ch of marker) {
    const code = ch.charCodeAt(0);
    for (let b = 7; b >= 0; b--) {
      const bit = (code >> b) & 1;
      const byteVal = pixelData[cursor] as number;
      pixelData[cursor] = (byteVal & 0xfe) | bit;
      cursor++;
    }
  }

  const header = Buffer.from(`P6\n${width} ${height}\n255\n`, "ascii");
  const ppm = Buffer.concat([header, pixelData]);
  emit("stego/image.ppm", ppm);

  return {
    files,
    metadata: {
      pixelDataBytes: pixelBytesLen,
      headerLength: header.length,
      markerLength: marker.length,
      bitsPerChar: 8,
    },
    expected: {
      marker,
      bitOffset: String(bitOffset),
      width: String(width),
      height: String(height),
    },
  };
};

// ---------------------------------------------------------------------------
// the-ledger: ledger
// ---------------------------------------------------------------------------

interface LedgerBlock {
  index: number;
  prevHash: string;
  data: string;
  hash: string;
}

const ledger: Generator = (ctx, out) => {
  const files: { path: string; sha256: string }[] = [];
  const emit = makeEmitter(out, files);
  const lctx = ctx.namespace("ledger");

  const blockCount = lctx.int("blockCount", 8, 12);
  const targetIndex = lctx.int("targetIndex", 1, blockCount - 2);
  const token = `LEDGER-${lctx.hex("token", 5)}`;

  const blocks: LedgerBlock[] = [];
  let prevHash = "0".repeat(64);

  for (let i = 0; i < blockCount; i++) {
    const noise = lctx.hex(`data:${i}`, 6);
    const data = i === targetIndex ? `note-${noise} TOKEN=${token}` : `note-${noise}`;
    const hash = sha256Hex(Buffer.from(`${i}|${prevHash}|${data}`, "utf8"));
    blocks.push({ index: i, prevHash, data, hash });
    prevHash = hash;
  }

  const chainJson = `${JSON.stringify(blocks, null, 2)}\n`;
  emit("ledger/chain.json", Buffer.from(chainJson, "utf8"));

  const tipHash = (blocks[blocks.length - 1] as LedgerBlock).hash;

  return {
    files,
    metadata: { blockCount, targetIndex },
    expected: { token, targetIndex: String(targetIndex), tipHash },
  };
};

// ---------------------------------------------------------------------------
// machine-code: stackvm
// ---------------------------------------------------------------------------

const STACKVM_ISA_DOC = `# Gauntlet StackVM

A tiny stack machine. A program is a plain-text file, one instruction per
line. Every value on the stack is a signed integer.

## Opcodes

- \`PUSH n\`  Push the integer literal \`n\` onto the top of the stack.
- \`ADD\`     Pop b, pop a, push (a + b).
- \`SUB\`     Pop b, pop a, push (a - b).
- \`MUL\`     Pop b, pop a, push (a * b).
- \`DUP\`     Duplicate the top of the stack (requires >= 1 item on stack).
- \`SWAP\`    Swap the top two items on the stack (requires >= 2 items).
- \`PRINT\`   Pop the top of the stack and print it as a decimal integer,
            followed by a newline.

For \`ADD\`/\`SUB\`/\`MUL\`, the operand popped *first* is named \`b\` (it was
on top of the stack); the operand popped *second* is named \`a\` (it was
pushed earlier and sat deeper in the stack). Example: with stack \`[3, 10]\`
(10 on top), \`SUB\` pops b=10, then a=3, and pushes \`3 - 10 = -7\`.

## Program format

One instruction per line, uppercase opcode name. \`PUSH\` is followed by a
single space and a base-10 integer (which may be negative). No other
opcode takes an operand. A well-formed program never underflows the stack
and ends with exactly one \`PRINT\`.

## Example

See \`example.prog\` for a worked sample program and \`example.out\` for its
exact expected output (what running the program should print).
`;

type StackOp = "PUSH" | "ADD" | "SUB" | "MUL" | "DUP" | "SWAP";

const stackvm: Generator = (ctx, out) => {
  const files: { path: string; sha256: string }[] = [];
  const emit = makeEmitter(out, files);
  const vctx = ctx.namespace("stackvm");

  const instrCount = vctx.int("instrCount", 8, 14);
  const bodyLen = instrCount - 1;

  const stack: number[] = [];
  const instructions: string[] = [];

  for (let i = 0; i < bodyLen; i++) {
    const ops: StackOp[] = ["PUSH"];
    if (stack.length >= 1) ops.push("DUP");
    if (stack.length >= 2) ops.push("ADD", "SUB", "MUL", "SWAP");
    const op = vctx.pick(`op:${i}`, ops);

    if (op === "PUSH") {
      const value = vctx.int(`pushval:${i}`, -20, 20);
      stack.push(value);
      instructions.push(`PUSH ${value}`);
    } else if (op === "DUP") {
      const top = stack[stack.length - 1] as number;
      stack.push(top);
      instructions.push("DUP");
    } else if (op === "SWAP") {
      const a = stack.pop() as number;
      const b = stack.pop() as number;
      stack.push(a);
      stack.push(b);
      instructions.push("SWAP");
    } else {
      const b = stack.pop() as number;
      const a = stack.pop() as number;
      const result = op === "ADD" ? a + b : op === "SUB" ? a - b : a * b;
      stack.push(result);
      instructions.push(op);
    }
  }

  instructions.push("PRINT");
  const top = stack.pop() as number;
  const sampleOutput = `${top}\n`;

  const progBuf = Buffer.from(`${instructions.join("\n")}\n`, "utf8");
  emit("stackvm/ISA.md", Buffer.from(STACKVM_ISA_DOC, "utf8"));
  emit("stackvm/example.prog", progBuf);
  emit("stackvm/example.out", Buffer.from(sampleOutput, "utf8"));

  return {
    files,
    metadata: { instructionCount: instrCount },
    expected: { sampleSha256: sha256Hex(progBuf), sampleOutput },
  };
};

// ---------------------------------------------------------------------------
// trace: injection
// ---------------------------------------------------------------------------

const LOG_USERS = ["alice", "bob", "carol", "dave", "erin", "frank", "grace", "heidi"] as const;

const injection: Generator = (ctx, out) => {
  const files: { path: string; sha256: string }[] = [];
  const emit = makeEmitter(out, files);
  const ictx = ctx.namespace("injection");

  const lineCount = ictx.int("lineCount", 18, 22);
  const injectedLine = ictx.int("injectedLine", 1, lineCount); // 1-indexed
  const seededId = ictx.int("seededId", 1000, 9999);
  const secret = `SECRET-${ictx.hex("secret", 6)}`;
  const payload = `${seededId} OR 1=1 -- `;

  let ts = ictx.int("baseTs", 1_700_000_000, 1_750_000_000);
  const lines: string[] = [];

  for (let i = 1; i <= lineCount; i++) {
    ts += ictx.int(`tsdelta:${i}`, 2, 9);
    const ip = [
      ictx.int(`ip0:${i}`, 10, 203),
      ictx.int(`ip1:${i}`, 0, 255),
      ictx.int(`ip2:${i}`, 0, 255),
      ictx.int(`ip3:${i}`, 1, 254),
    ].join(".");
    const user = ictx.pick(`user:${i}`, LOG_USERS);

    if (i === injectedLine) {
      lines.push(
        `TS ${ts} ip=${ip} user=${user} q="SELECT * FROM items WHERE id=${payload}" -> leaked=${secret}`,
      );
    } else {
      const id = ictx.int(`id:${i}`, 1, 9999);
      lines.push(`TS ${ts} ip=${ip} user=${user} q="SELECT * FROM items WHERE id=${id}"`);
    }
  }

  const content = `${lines.join("\n")}\n`;
  emit("injection/access.log", Buffer.from(content, "utf8"));

  return {
    files,
    metadata: { lineCount, injectedLine },
    expected: { param: "id", payload, secret, lineNumber: String(injectedLine) },
  };
};

// ---------------------------------------------------------------------------

export const generators: Record<string, Generator> = {
  cipherchain,
  vault,
  stego,
  ledger,
  stackvm,
  injection,
};
