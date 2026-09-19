# The 72-Hour Gauntlet — Challenge Design Blueprint

This is the authoring blueprint for a 72+ hour cybersecurity & systems-programming
campaign that runs on this platform. It is the "ultimate challenge" specification:
a single connected investigation, personalized per student, that resists being
solved by pasting text into an AI. It is designed to be authored as a campaign
manifest (`campaign.yaml`) with seeded generators and graders, exactly like the
`janus` sample — just larger and deeper.

The proven Project Janus pipeline (8 stages) is the *engine test*. This document
scales that engine to a 28-stage, six-track, 72-hour campaign: **"Blacksite"**.

---

## 1. Design philosophy (the North Star)

Do not ask *"did the student know the answer?"* Ask:

> Can the student investigate an unfamiliar computing system, form hypotheses,
> gather evidence, build working tools, explain failures, and prove their
> conclusions are correct?

Every stage must be **an environment, not a question**. The student is dropped
into an unknown system and must determine *what kind of problem they even face*
before they can solve it. Titles are neutral ("Node 7", "Residual State",
"Out of Order") — never "AES-CBC Padding Oracle".

## 2. Why AI alone cannot solve it

The platform does not ban AI. It makes AI *insufficient*. Every major stage
combines at least two of these levers so the answer cannot be produced from the
prompt text alone:

1. **Per-student randomization** — offsets, keys, nonces, ports, usernames,
   filenames, commit hashes, and final answers are HKDF-derived from a secret
   per-student seed. Two students face the same concept; neither can copy a value.
2. **Interactive environment state** — the answer only exists after the student
   *changes* a live system (repairs a service, replays traffic, triggers a race).
3. **Runtime-generated values** — a nonce that only appears in a core dump the
   student must produce; a token minted by a service the student must first start.
4. **Hidden tests** — implementation stages grade submitted code against unseen,
   seeded inputs in an isolated microVM; the test source is never disclosed.
5. **Code submission** — the student must produce *working* tooling, not a
   description of one.
6. **Evidence submission** — conclusions require a terminal transcript, a packet
   filter, a debugger session, or a core dump; the platform captures provenance.
7. **Cross-stage dependencies** — a value recovered in stage 14 unlocks the
   decryption in stage 19; there is no shortcut around the chain.
8. **Ambiguous initial classification** — the student must first decide *what the
   problem is*. An AI handed the artifact with no framing tends to guess wrong.
9. **Experiment reproduction** — the grader checks that a claimed crash actually
   reproduces in the sandbox, not that the student described it plausibly.
10. **Oral / written defense** — high-value stages require a root-cause
    explanation graded for correctness, linked to captured evidence.

A convenient heuristic while authoring: **if a stage's answer is a fact rather
than a produced artifact or a changed state, it is too weak — redesign it.**

## 3. Scoring across the 72 hours

Score is stored as immutable, auditable **score events** (never a mutable total).
Categories, weighted for a 72h campaign (target ~5000 points):

| Category | Weight | What it rewards |
|---|---|---|
| Technical discovery | 15% | finding the artifacts, services, hidden state |
| Reverse engineering | 20% | protocol/format/binary reconstruction |
| Implementation | 25% | working decoders, patches, exploits, repairs |
| Security investigation | 15% | vuln identification + root cause |
| Systems reasoning | 15% | concurrency, memory, distributed-state proofs |
| Evidence quality | 5% | reproducible, well-documented evidence |
| Final reconstruction | 5% | the capstone |

Penalties: progressive hint penalties (5/10/20/30 per level), small per-failed-
attempt penalties on implementation stages, and an evidence multiplier (a correct
answer with no supporting evidence earns reduced credit — configurable per stage).

## 4. Time & pacing (72h, self-paced)

- **Act I (0–12h): Foothold & Discovery** — filesystem, logs, first capture,
  first protocol. Gets everyone moving; low frustration, high orientation.
- **Act II (12–36h): Reverse Engineering & Tooling** — protocol decoders, format
  parsers, git archaeology, firmware. The implementation-heavy core.
- **Act III (36–60h): Exploitation & Remediation** — memory-safety bugs, a
  crypto flaw, a race condition; each requires *break then fix*.
- **Act IV (60–72h): Distributed Reconstruction** — combine every recovered
  fragment to rebuild a small distributed service; environment-state graded.

Convergence points (`CONVERGES_WITH`) let several tracks feed one capstone, so the
graph is a DAG with breadth in the middle and a single sink at the end.

## 5. The six tracks

Each track is a chain of 4–6 stages. Tracks interleave and cross-feed.

1. **Signals** (network/protocol RE) — captures → framing → decoder → live replay.
2. **Archive** (forensics/source archaeology) — disk image, deleted files, git
   history, a reverted commit, a leaked credential fragment.
3. **Ironworks** (systems/pwn) — a C/Rust service with a seeded memory-safety bug;
   reproduce, analyze the core dump, patch, pass regression.
4. **Cipher** (crypto) — nonce reuse, weak KDF, a padding oracle *behavior* (never
   named), or an ECB tell; recover a key/plaintext *without brute force*.
5. **Cabinet** (web/services) — an internal API with an auth/logic flaw; the flaw
   yields a token used elsewhere. Break-then-remediate.
6. **Quorum** (distributed systems) — a 3-node cluster with a consistency bug;
   the student must make replicas agree. Environment-state graded.

## 6. The 28-stage graph (Blacksite)

Legend: `→` unlocks; `⇒` cross-track dependency (value/state from A required by B).
Grader kind in brackets. All titles neutral.

```
Act I — Foothold
 1  First Light            [value]  filesystem recon; find the anomalous log     → 2, 6
 2  Silent Relay           [finding] classify unknown binary protocol in a pcap  → 3
 3  Framing                [finding] length/type/seq/checksum field map          → 4
 4  Transcriber            [code]   write a decoder; hidden packet tests        → 5, 7 ⇒(token)12
 5  Handshake              [env]    replay a valid frame to a live service       → 12
 6  The Cabinet Door       [finding] map an internal API surface                 → 11
Act II — Reverse Engineering
 7  The Archive            [value]  git history; fragment in a reverted commit   → 8, 13
 8  Ghost Sectors          [file]   carve a deleted file from a disk image       → 9
 9  Container Manifest     [finding] parse a custom on-disk format               → 10
10  Rehydrate              [code]   reconstruct the original file (sha + parser) → 19
11  Cabinet Logic          [finding] identify the API logic flaw                 → 12
12  Minted                 [value]  abuse the flaw to mint a token ⇐4,11         → 20
13  Firmware Dump          [finding] identify arch/endianness of a blob          → 14
14  Disassembled           [code]   write a loader/parser for the blob           → 21
Act III — Exploitation & Remediation
15  Out of Order           [code]   reproduce a C service off-by-one; patch      → 16
16  Core Truth             [finding] analyze the core dump; recover a nonce      → 17 ⇒(nonce)18
17  Root Cause             [finding] explain the bug class + fix (defended)      → 22
18  Residual State         [value]  nonce reuse ⇒ recover config plaintext ⇐16   → 22
19  Weak Ceremony          [finding] identify a KDF/mode weakness                → 20
20  Keyholder              [value]  recover a key w/o brute force ⇐12,19         → 23
21  Instrumented           [code]   patch the firmware parser; regression        → 23
22  Quiet Fix              [env]    deploy the remediation; healthcheck passes   → 24
Act IV — Distributed Reconstruction
23  Quorum                 [finding] diagnose the cluster consistency bug ⇐20,21 → 24
24  Split Brain            [code]   fix replica reconciliation; hidden tests     → 25
25  Convergence            [env]    three replicas agree ⇐18,22,24               → 26
26  The Blacksite          [env]    rebuild the service from all fragments       → 27
27  Attestation            [finding] produce the evidence dossier (defended)     → 28
28  Exfil                  [value]  final derived proof value ⇐ all              (sink)
```

Reachability: stage 1 is visible by default; every other stage unlocks only
through `requires`/`⇒` edges, and the whole graph converges on stage 28.

## 7. Per-stage authoring template

For each stage, an author specifies (mirrors `challenges/janus/`):

- **Concept** (hidden from student) and neutral **title**.
- **Seeded generator(s)** — deterministic `(SeedContext) → files + expected`.
  Everything the student sees is derived from the seed; `expected` holds the
  grading answers and is never shipped.
- **Completion type + grader** — value | finding | code | environment_state | file.
- **Anti-AI levers** — name the ≥2 used.
- **Evidence required** — e.g. `explanation`, `source_code`, `pcap_filter`,
  `debugger_output`, `core_dump`.
- **Progressive hints** — 3–4 levels, penalties 5/10/20/30, each revealing one
  more concrete step without giving the answer.
- **onComplete** — `unlock`, `startService`, `emit` effects that drive the graph.

## 8. Environment topology (per student, isolated)

A private network the control plane provisions per student instance:

```
student browser → terminal gateway → challenge network:
   workstation  (student shell; tools: gdb, tshark, gcc, python, git)
   relay        (Signals track service; started by stage 5)
   cabinet      (internal API; Cabinet track)
   vault        (crypto service; Cipher track)
   node-1/2/3   (Quorum cluster)
   archive      (git + disk image host; started by stage 4)
```

No lateral access between students; no control-plane reachability; egress
deny-all except explicit per-stage allowlists (e.g. a docs mirror). On this
Vercel-native deployment the workstation is a Firecracker microVM (Vercel
Sandbox); the "services" run as processes inside it, reachable on loopback, and
started/stopped by stage events. A multi-host build swaps in the Docker/Firecracker
orchestrator described in `docs/security-model.md` without changing the manifest.

## 9. Integrity & anti-cheat

- Per-student seeds ⇒ shared final answers are worthless.
- Hidden tests + reproduction ⇒ copied code that doesn't run fails.
- Evidence provenance (auto-captured compile/test/grader output, hashed and
  immutable) ⇒ borrowed screenshots don't match the student's seed.
- Defense stages (root-cause explanations graded for correctness against the
  student's *own* seeded bug) ⇒ generic explanations fail.
- Rate limiting + audit logging on submissions, terminal, and downloads.

## 10. How to build it on this platform

1. Author `challenges/blacksite/campaign.yaml` (28 stages) + `generators/` +
   per-stage grading specs, following `challenges/janus/` as the reference.
2. `pnpm campaign:validate challenges/blacksite` — schema, DAG reachability,
   cycle, grader/generator existence, hidden-answer leak scan.
3. `pnpm campaign:import challenges/blacksite` — immutable versioned publish.
4. Assign to a cohort; each student gets a seeded instance and isolated microVM.
5. The 8-stage `janus` campaign already exercises every grader kind and the full
   event/unlock/scoring pipeline — Blacksite is the same machine, scaled.

The engine is proven; the 72-hour campaign is content authored on top of it.
