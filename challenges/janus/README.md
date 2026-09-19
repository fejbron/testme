# Project Janus - author notes

Eight-stage campaign, neutral stage titles, hidden category. Everything a
student sees (files, markers, protocol values, config artifacts) is derived
from `SeedContext`, so no two students get the same bytes or the same
answer, and answers can't be shared/copied between students.

Generators live in `generators/index.ts` and only depend on the
`SeedContext` *type* (`../../../src/lib/seed`), never on app internals.
Each `Generator(ctx, out) -> GenManifest` is a pure function: same `ctx`
implies byte-identical files implies identical sha256. `expected` on the
returned `GenManifest` carries the seed-derived grading answers - it is
returned only to the trusted build/grading pipeline, never written to a
file a student can read.

## Stage-by-stage

**1. first-light** (`filesystem` generator). A fake filesystem listing plus
an application log with ~40 lines. One line carries `MARKER-<hex>`; decoys
use a different, near-miss prefix (`MRKR-`) so naive substring matching on
"marker-ish" text fails. Grader key: `expected.marker`.

**2. silent-relay** (`pcap` generator). A real libpcap file (magic
`0xa1b2c3d4`, version 2.4, snaplen 65535, linktype 147/USER0) whose records
carry a custom length-prefixed frame. Anti-AI lever: there's no public spec
for this "protocol" to look up, so the student has to infer framing from
observed byte patterns, not recall a known format. Grader key:
`expected.protocolClass`.

**3. framing**. No new artifact - reuses the same capture, but now the
student must pin exact field offsets/width/endianness/checksum kind rather
than just the framing style. Grader keys:
`lengthFieldOffset/Width/Endian`, `msgTypeOffset`, `seqOffset`,
`checksumKind`, `checksumOffset`.

**4. transcriber**. Code stage: student writes a decoder implementing the
layout from stage 3. Hidden tests are built from unseen seeded packets, so
a decoder hard-coded against the one sample capture fails - it has to
generalize the offsets/checksum logic. No shipped `expected` value; the
grader runs the student's code against fresh seeded fixtures.

**5. the-archive** (`gitrepo` generator). A deterministic JSON commit log
(not a live `.git` dir, so the artifact stays portable) with four commits:
init, an "add credentials" commit, an explicit revert of that commit, and
an unrelated cleanup commit at HEAD. The fragment
(`ARCHIVE-FRAGMENT-<hex>`) only ever appears inside the *reverted* commit's
file content - HEAD and the worktree snapshot never contain it. Forces
history-walking instead of `grep`-ing the checkout. Grader key:
`expected.archiveFragment`.

**6. out-of-order** (`cservice` generator). A small C struct-copy function
with a seeded off-by-one (either a `<=` loop bound or a `+1` write index),
picked per seed, with the buffer size and function name also seeded. The
source contains no comments hinting at the bug - a regression-harness
description (`regression.md`) states expected behavior only, so the
student has to reproduce the overflow, not read an annotation. Grader keys:
`bugFunction`, `bufferSize`, `offByOneKind`.

**7. residual-state** (`config` generator). Two "encrypted" configs
(XOR with an HKDF-derived keystream) that reuse the *same* nonce - the
classic many-time-pad flaw. One artifact (`reference.cfg`) is paired with
its own known plaintext (`reference-plaintext.json`, a "public default
template"); XORing the two recovers the keystream, which then decrypts
`target.cfg` to reveal `CONFIG-OK-<hex>`. No brute force is possible or
needed. Grader keys: `plaintextMarker`, `nonce`.

**8. reconstruction**. Environment-state stage: no shipped artifact. The
`cluster-health` grader inspects the live workstation/service replicas
(configured using values recovered in earlier stages, e.g. the recovered
protocol, the archive fragment, the patched service, the decrypted config)
and checks they've converged to agreement. There's nothing to submit as a
single value, which prevents answer-sharing for this stage entirely.

## Anti-AI / anti-copy levers used throughout

- Every marker/fragment/offset/nonce is HKDF-derived per (student seed,
  salt, namespace path) - two students never see the same bytes.
- Decoys are format-adjacent but not format-identical (`MRKR-` vs
  `MARKER-`), so pattern-matching on "looks like a flag" fails.
- Stage 4's decoder and stage 6's patch are graded against *unseen* seeded
  fixtures generated at grading time, not against the shipped sample, so a
  solution hardcoded to the sample artifact fails hidden tests.
- Stage 5's answer is absent from the current working tree entirely; it
  only exists inside one non-HEAD commit's diff.
- Stage 7's flaw is structural (nonce reuse), not brute-forceable; copying
  someone else's decrypted value doesn't work because both the nonce and
  the ciphertexts are per-seed.
- Stage 8 has no single submittable value at all.
- Stage titles are neutral (`First Light`, `Silent Relay`, `Framing`,
  `Transcriber`, `The Archive`, `Out of Order`, `Residual State`,
  `Reconstruction`); nothing in `campaign.yaml` names the vulnerability
  classes involved.

## Tests

`generators/generators.test.ts` (vitest) covers, per generator:
determinism (two contexts built from the same fixed 32-byte root seed +
salt produce identical file bytes/sha256 and identical `expected`),
seed-sensitivity (two random root seeds produce at least one differing
`expected` value), plus generator-specific checks: the pcap's global
header magic/version/snaplen/linktype and a full record-count/frame parse
against `expected`'s field layout, the filesystem log containing exactly
one true marker occurrence, the gitrepo fragment being present in the
reverted commit but absent from HEAD/worktree, the C source containing no
`bug`-labelled comments, and the config artifacts round-tripping through
the reused-nonce keystream attack to recover `expected.plaintextMarker`.

Run: `cd /c/Users/EdBron/Documents/testme && node_modules/.bin/vitest run challenges/janus`
