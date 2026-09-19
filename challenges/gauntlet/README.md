# The Gauntlet - author notes

Six-stage campaign, harder than Project Janus: every artifact is a real,
parseable file format (JSON, PPM, a hash-chain, a tiny VM ISA, an access
log) rather than plain text, and each puzzle requires combining two or
three primitives instead of one. Every value a student sees (markers,
tokens, keys, offsets, secrets) is derived from `SeedContext`, so no two
students share bytes or answers, and generated content can't be copied
between students.

Generators live in `generators/index.ts` and only depend on the
`SeedContext` *type* (`../../../src/lib/seed`), never on app internals.
Each `Generator(ctx, out) -> GenManifest` is a pure function: same `ctx`
implies byte-identical files implies identical sha256. `expected` on the
returned `GenManifest` carries the seed-derived grading answers - it is
returned only to the trusted build/grading pipeline, never written to a
file a student can read. Each generator namespaces its derivations via
`ctx.namespace(name)` so labels can't collide across generators.

## Stage-by-stage

**1. cipher-drift** (`cipherchain` generator). A marker `GAUNTLET-<hex>` is
run through three reversible layers - Caesar/ROT shift by a seeded N
(1-25, letters only), base64, then hex - and only the final hex blob is
shipped, with a header that says "three reversible layers" but never
names them or the shift amount. Anti-AI lever: there's no single canonical
decode chain to paste into a tool; the student must recognize each
encoding by its character set and peel them off outermost-first, then
brute-force (or reason about) the rotation. Difficulty: easy-medium
(stage 1 of 6). Grader keys: `expected.marker`, `expected.shift`.

**2. vault-run** (`vault` generator). A repeating-key XOR cipher (key
length 4-7 bytes) over a pretty-printed JSON plaintext
`{"service":"vault","token":"VAULT-<hex>"}`. `vault/crib.txt` ships the
fixed structural prefix of the plaintext (everything before the token
value starts) as a known-plaintext crib - crib XOR ciphertext at offset 0
recovers the repeating key directly. Anti-AI lever: there is no key to
"guess" or brute force; the puzzle is recognizing that a known-plaintext
prefix defeats repeating-key XOR, then applying it correctly. Difficulty:
medium. Grader keys: `expected.token`, `expected.keyHex`,
`expected.keyLen`.

**3. hidden-pixels** (`stego` generator). A valid binary PPM (P6) image
with seeded width/height (32-64 px) and fully random pixel data. A marker
`SEEN-<hex>` is embedded 1 bit per byte (LSB), 8 pixel-data bytes per
ASCII character, starting at a seeded byte offset into the pixel data
(never offset 0). Anti-AI lever: the student must parse the real PPM
header to find where pixel data begins, then sweep for the start offset
rather than assume it - there's no visual artifact in the image itself.
Difficulty: medium. Grader keys: `expected.marker`, `expected.bitOffset`,
`expected.width`, `expected.height`.

**4. the-ledger** (`ledger` generator). A sha256 hash chain of 8-12
blocks, each `{index, prevHash, data, hash}` with
`hash = sha256(index|prevHash|data)` and genesis `prevHash` =
`"0"*64`. A `TOKEN=LEDGER-<hex>` string is embedded in one seeded block's
`data` field, and that block is guaranteed to be neither the genesis nor
the final (tip) block. Anti-AI lever: grepping the file for `TOKEN=` still
works, but confirming the token is trustworthy - and locating it relative
to the chain - requires recomputing every hash and walking `prevHash`
links from genesis to tip, since nothing marks the target block as
special beyond its position and content. Difficulty: medium-hard. Grader
keys: `expected.token`, `expected.targetIndex`, `expected.tipHash`.

**5. machine-code** (`stackvm` generator). Defines a tiny stack VM ISA
(`PUSH n`, `ADD`, `SUB`, `MUL`, `DUP`, `SWAP`, `PRINT`) in `ISA.md`, plus
one seeded worked example (`example.prog`, 8-14 instructions ending in a
single `PRINT`) and its exact output (`example.out`), computed by
simulating the VM inside the generator itself so the shipped example is
always correct. Anti-AI lever: this is a code stage - the student writes
an interpreter that must generalize to hidden seeded programs the grader
runs separately, so hard-coding the one sample program's output fails.
Difficulty: hard (largest stage, code grader). Grader keys:
`expected.sampleSha256` (identifies `example.prog`'s exact bytes),
`expected.sampleOutput` (what a correct interpreter must print for it).

**6. trace** (`injection` generator). An `access.log` of ~18-22 seeded,
mostly-benign query log lines (`TS <ts> ip=<ip> user=<u>
q="SELECT * FROM items WHERE id=<n>"`). Exactly one seeded line carries a
SQL tautology injection in the `id` parameter (`<n> OR 1=1 -- `) and ends
with `-> leaked=<SECRET-hex>`, simulating the response leaking a secret
because the injected clause matched every row. Anti-AI lever: the
malicious line's position, the base id it mutates, and the leaked secret
are all seeded per student, so the student must actually parse and scan
the log rather than recall a canned payload string. Difficulty: medium.
Grader keys: `expected.param`, `expected.payload`, `expected.secret`,
`expected.lineNumber`.
