# Boot Camp - author notes

Beginner campaign. Six independent, single-artifact puzzles, each teaching
one classic encoding or scanning technique. No chained stages, no
adversarial decoys - every artifact is small, clean, and has exactly one
unambiguous answer.

Generators live in `generators/index.ts` and only depend on the
`SeedContext` *type* (`../../../src/lib/seed`), never on app internals.
Each `Generator(ctx, out) -> GenManifest` is a pure function: same `ctx`
implies byte-identical files implies identical sha256 and identical
`expected`. `expected` on the returned `GenManifest` carries the
seed-derived grading answers - it is returned only to the trusted
build/grading pipeline, never written to a file a student can read.

## Puzzles

**1. welcome** (`welcome` generator). A friendly briefing message
containing a token (`BC1-<hex4>`) is base64-encoded and written to
`welcome/message.txt`, preceded by a `decode me:` header line. Concept:
base64 decoding. Solve by base64-decoding the second line of the file and
reading the token out of the plaintext. Grader key: `expected.token`.

**2. rotate** (`rotate` generator). A short field note containing a token
(`BC2-<hex4>`) is ROT13-encoded and written to `rotate/note.txt`. Only
letters are rotated; the token's digits and hyphen pass through unchanged.
Concept: ROT13 / Caesar ciphers. Solve by applying ROT13 again (it is its
own inverse) to recover the plaintext and the token. Grader key:
`expected.token`.

**3. hexdump** (`hexdump` generator). A short message containing a token
(`BC3-<hex4>`) is hex-encoded (lowercase, no separators) and written to
`hexdump/data.hex`. Concept: hex encoding. Solve by hex-decoding the file
to ASCII and reading the token. Grader key: `expected.token`.

**4. tally** (`tally` generator). Twelve seeded integers in `[1, 999]`,
one per line, written to `tally/numbers.txt`. Concept: basic arithmetic /
scripting over a data file. Solve by summing all twelve numbers. Grader
keys: `expected.sum` (the total) and `expected.count` (always `"12"`).

**5. needle** (`needle` generator). Forty plausible-looking log lines
(timestamps, levels, routine messages) written to `needle/haystack.log`.
Exactly one line contains `SECRET=<token>` (`BC5-<hex4>`); no other line
contains the string `SECRET=`. Concept: needle-in-a-haystack scanning /
grep. Solve by finding the one line containing `SECRET=` and reading the
token and its 1-indexed line number. Grader keys: `expected.token` and
`expected.line`.

**6. binary** (`binary` generator). A token (`BC6-<hex4>`) is ASCII-encoded
as space-separated 8-bit binary groups (e.g. `01000010 01000011 ...`) and
written to `binary/bits.txt`. Concept: binary/ASCII encoding. Solve by
converting each 8-bit group back to its ASCII character. Grader key:
`expected.token`.

## Determinism

Every derived value (token, greeting/phrase pick, seeded numbers, secret
line position) is HKDF-derived through `ctx.namespace(<puzzle>)`, so two
students never see the same bytes, and re-running a generator against the
same root seed + salt reproduces byte-identical files and `expected`
every time.

## Tests

`generators/generators.test.ts` (vitest) covers, per generator:
determinism (two contexts built from the same fixed 32-byte root seed +
salt produce identical file bytes/sha256 and identical `expected`),
seed-sensitivity (two random root seeds produce at least one differing
`expected` value), plus a puzzle-specific round-trip check: base64-decode
recovers the welcome token, ROT13 recovers the rotate token, hex-decode
recovers the hexdump token, the tally numbers sum to `expected.sum`, the
flagged needle line (and only that line) contains the token, and the
binary groups decode back to the token.

Run: `cd /c/Users/EdBron/Documents/testme && node_modules/.bin/vitest run challenges/bootcamp`
