# Field Work - author notes

Six-puzzle intermediate campaign. Each puzzle is a self-contained encoding
or analysis exercise, a real step up from trivial decoding but solvable by
hand or with a short script. Everything a student sees (tokens, keys,
IPs, ciphertexts, CSV rows) is derived from `SeedContext`, so no two
students get the same bytes or the same answer.

Generators live in `generators/index.ts` and only depend on the
`SeedContext` *type* (`../../../src/lib/seed`), never on app internals.
Each `Generator(ctx, out) -> GenManifest` is a pure function: same `ctx`
implies byte-identical files implies identical sha256 and identical
`expected`. `expected` carries the seed-derived grading answers - it is
returned only to the trusted build/grading pipeline, never written to a
file a student can read.

## Puzzles

**1. caesar** (`caesar` generator). A token `FW1-<hex10>` is embedded in a
short field report, then the whole message is Caesar-shifted by a seeded
amount N in 1..25 (only letters rotate; digits, hyphens, spaces and
punctuation pass through unchanged, so the token's digits/hyphen stay
recognizable even in ciphertext). Emitted as `caesar/intercept.txt`.
Concept: classical substitution cipher, brute-forceable across 25 shifts
or solvable by frequency/structure. Difficulty: easy-intermediate.
Grader keys: `expected.token`, `expected.shift`.

**2. vigenere** (`vigenere` generator). A token `FW2-<hex10>` sits inside a
secret sentence appended to a known fixed crib, `"REPORT BEGINS "`. The
full string (crib + secret) is encrypted with a Vigenere cipher using a
seeded lowercase keyword of length 4-6; non-letters pass through and don't
advance the keystream. `vigenere/cipher.txt` holds the ciphertext,
`vigenere/crib.txt` holds the known plaintext prefix. Concept:
known-plaintext attack against a polyalphabetic cipher - XOR-style
recovery of the repeating key from the crib and the start of the
ciphertext. Difficulty: intermediate. Grader keys: `expected.token`,
`expected.key`.

**3. jwt** (`jwt` generator). A real three-part JWT string with
`alg: "none"`, an empty signature, and a payload carrying seeded claims
including `clearance: "FW3-<hex10>"` alongside decoy claims (`role`,
`site`, `iat`). Emitted as `jwt/token.jwt`. Concept: JWTs are just
base64url-encoded JSON, not encrypted - reading the claim requires
decoding, not cracking. Difficulty: easy-intermediate. Grader key:
`expected.claim`.

**4. layers** (`layers` generator). A token `FW4-<hex10>` plus a small
context field is JSON-encoded, then base64-encoded twice, then hex-encoded
once: `hex(base64(base64(json)))`. Emitted as `layers/blob.txt` with no
in-band hint about the nesting order - only this README documents it (in
that exact order: hex is the outermost layer, applied last). Concept:
peeling nested nested encodings in the right order. Difficulty:
intermediate. Grader key: `expected.token`.

**5. weblog** (`weblog` generator). `weblog/access.log` holds ~40-60
seeded Apache Common Log Format lines. The majority are benign 200s from a
pool of varied IPs hitting ordinary paths. One seeded attacker IP
generates a burst of 404s scanning suspicious paths (`/admin`, `/.env`,
`/backup.zip`, `/wp-login.php`, `/config.php`); one of those paths is
seeded to receive strictly more hits than any other from that IP.
Concept: log triage - separating signal (a scanning IP) from noise
(normal traffic) and identifying its most-probed target. Difficulty:
intermediate. Grader keys: `expected.ip`, `expected.path`,
`expected.count` (total 404s from the attacker IP).

**6. csvsum** (`csvsum` generator). `csvsum/example.csv` (header
`id,amount,label`, ~7-9 seeded rows, `amount` always an integer, some
negative) and `csvsum/example.out` (the exact integer sum of the `amount`
column, self-computed by the generator). `csvsum/SPEC.md` states the task
in prose: read a CSV on stdin with header `id,amount,label`; print the
integer sum of the `amount` column. This is a code-submission puzzle - a
hidden grader will feed the student's program fresh, unseen CSVs built the
same way; the shipped example is only a worked sample to develop and
sanity-check against. Concept: stdin parsing and aggregation. Difficulty:
easy-intermediate. Grader keys: `expected.sampleSum`,
`expected.sampleSha256` (hash of the shipped `example.csv`, to confirm the
grader and the student are looking at the same sample).

## Tests

`generators/generators.test.ts` (vitest) covers, per generator:
determinism (two contexts built from the same fixed 32-byte root seed +
salt produce identical file bytes/sha256 and identical `expected`),
seed-sensitivity (two random root seeds produce at least one differing
`expected` value), plus generator-specific correctness checks: un-Caesar
with the seeded shift recovers the token; Vigenere decryption with the
seeded key recovers both the crib and the token; the JWT payload
base64url-decodes to JSON whose `clearance` matches `expected.claim`;
reversing hex -> base64 -> base64 on the layers blob recovers the token;
the weblog's attacker IP truly has the most 404s (and the most hits on
its most-probed path) among all IPs in the log; and the csvsum example's
`amount` column sums to `expected.sampleSum` with a matching sha256.

Run:
`cd /c/Users/EdBron/Documents/testme && node_modules/.bin/vitest run challenges/fieldwork`
