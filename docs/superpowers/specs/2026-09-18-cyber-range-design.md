# Cyber Range Platform — Design Spec (Vercel-native MVP)

**Date:** 2026-09-18
**Status:** approved for implementation
**Source requirements:** `AGENTS.md` (pasted product brief), 41 sections.

## 1. Goal

A production web platform for advanced cybersecurity / systems-programming
challenges where a challenge is an *executable investigation environment*, not a
quiz. Students investigate unknown systems, reverse engineer, write code, recover
evidence, and unlock later stages. Per-student deterministic personalization makes
"paste the prompt into an AI" insufficient. Campaigns run from hours to 72h+.

This spec adapts `AGENTS.md` to a **Vercel + Supabase** deployment that can be
built and deployed from this session. It preserves the domain model, security
posture, seed engine, grader taxonomy, event engine, and the North Star. It
deviates only where Vercel's runtime forbids the literal AGENTS.md stack.

## 2. Deployment-driven architecture decisions

Vercel is serverless (no long-lived Docker daemon, no raw WebSocket PTY, no
BullMQ worker host). The brief's Docker/NestJS/Redis stack is therefore mapped:

| AGENTS.md wants | Vercel-native realization | Rationale |
|---|---|---|
| NestJS API + WS | Next.js 15 App Router route handlers (REST) + SSE for streams | one deployable, no separate API host |
| Docker per-student network | **Vercel Sandbox** (Firecracker microVM) per campaign instance as the "workstation"; challenge services run as processes inside it | real VM isolation, `deny-all` egress |
| xterm.js over WS PTY | xterm.js UI → `/api/.../exec` → `sandbox.runCommand`, streamed via SSE; server keeps cwd/env state | Vercel has no persistent WS; command-shell is the deviation |
| BullMQ workers | Postgres-backed `Job` table + idempotency keys, drained by `/api/jobs/tick` (Vercel Cron) and inline `waitUntil` | no Redis needed for MVP |
| MinIO / S3 | **Supabase Storage** with short-lived signed URLs | first-party, signed download |
| PostgreSQL + Prisma | **Supabase Postgres** + Prisma (pooled `DATABASE_URL` 6543, `DIRECT_URL` 5432 for migrations) | as specified |
| Redis locks/pubsub | Postgres advisory locks + `SELECT … FOR UPDATE SKIP LOCKED` | MVP-adequate |
| Auth | **Supabase Auth** (email/password) + `profiles.role` | server-verified, RLS-backed |

**Grader plane:** hidden-test code grading runs in **throwaway** Sandboxes
(`persistent:false`, `networkPolicy:"deny-all"`, `timeout:45_000`, `vcpus:1`),
created by the job drainer, never in a request handler, never on the host.

**Environment-state grader:** runs a trusted check script *inside* the student's
workstation Sandbox via the control-plane handle (`sandbox.runCommand`) — a side
channel the student cannot forge, since they only get command output, never the
handle.

### 2.1 Single-app layout (not a pnpm monorepo)

Vercel deploys one Next.js app. Internal modularity replaces the monorepo's
packages; challenge content stays a portable directory tree, decoupled from app code.

```
/                      Next.js app root (deploys to Vercel)
  /app                 App Router: pages + /api route handlers
  /src
    /lib/db            Prisma client, transaction helpers
    /lib/auth          Supabase auth, session, policy functions (canX)
    /lib/seed          HKDF seed engine + typed helpers
    /lib/campaign      YAML manifest schema (zod) + loader + validator + import
    /lib/graders       value | code | finding | environment-state | file
    /lib/sandbox       Vercel Sandbox provider (provision/start/stop/reset/destroy/status/exec)
    /lib/events        domain-event emit + idempotent handlers + job drainer
    /lib/scoring       deterministic score events + totals
    /lib/storage       Supabase Storage signed URLs, bounded uploads
    /lib/audit         append-only audit log
    /lib/observability structured logger (request_id, ...ids)
  /prisma              schema.prisma + migrations + seed.ts
  /challenges/janus    campaign.yaml, stages/, generators/, graders/, services/, tests/
  /scripts             campaign:validate, campaign:import, sandbox-image build
  /docs                architecture.md, security-model.md, challenge-authoring.md,
                       grader-contract.md, event-model.md, deployment.md, campaign-design-72h.md
```

## 3. Domain model (Prisma)

Implement all AGENTS.md §5 entities. Enums are Prisma enums. Key tables:

`Profile`(id=auth uid, role, displayName) · `Course` · `Cohort` · `CohortMember`
· `Campaign` · `CampaignVersion`(manifestHash, artifactBundleUri, immutable) ·
`ChallengeStage` · `ChallengeDependency`(REQUIRES|UNLOCKS|OPTIONAL|CONVERGES_WITH,
conditionJson) · `Assignment`(campaignVersion→cohort) · `CampaignInstance` ·
`ChallengeInstance`(status, instanceStateJson) · `Seed`(encryptedSeed, AES-256-GCM)
· `EnvironmentTemplate` · `EnvironmentInstance`(provider, externalRef=sandbox name,
status, expiresAt) · `Artifact` · `ArtifactInstance`(storageUri, sha256) ·
`Submission`(type, status, graderFeedbackJson) · `CodeSubmission` · `Finding` ·
`Evidence`(immutable, sha256) · `NotebookEntry` · `Hint` · `HintUsage` ·
`DomainEvent`(idempotencyKey unique) · `ProcessedEvent` · `Job`(type, payload,
status, idempotencyKey, attempts, lockedAt) · `ScoreEvent` · `AuditLog`(append-only).

All state transitions that must be atomic use `prisma.$transaction`.

## 4. Security model (control / challenge / grader planes)

- **Control plane** (Vercel functions, Supabase DB, Storage creds, sandbox OIDC):
  students have no network path to it. Service-role key server-only. RLS on all
  student-facing tables as defense in depth; authorization is *also* enforced in
  every route handler via policy functions (never UI-only).
- **Challenge plane** (student workstation Sandbox + services + artifacts): assume
  full compromise. `deny-all` egress by default; explicit allow-list only when a
  stage needs external docs. No secrets injected. Seed never present in the VM in
  raw form — only seed-*derived* concrete values the challenge legitimately exposes.
- **Grader plane**: throwaway VM, no platform secrets, no control-plane network,
  destroyed after each grade. Env-state grader talks one-way (control→VM check
  script), returns pass/fail + bounded feedback.
- Seeds: root seed generated server-side (32 random bytes), AES-256-GCM encrypted
  with `SEED_ENC_KEY`, decrypted only inside generator/grader code paths. Never in
  any student API response, log line, or frontend bundle.
- Uploads: size-bounded, content-type checked, filename sanitized (zip-slip / path
  traversal rejected), stored by generated key not user filename.
- Signed URLs: short TTL (≤120s), scoped to the object.

## 5. Seed engine (§7)

`RootSeed → HKDF-SHA256` namespaced derivation:
`campaign → stage → artifact → value`. Salt = campaignVersion manifestHash.
Typed helpers: `seed.int(label,min,max)`, `seed.hex(label,bytes)`,
`seed.bytes(label,n)`, `seed.uuid(label)`, `seed.pick(label,arr)`,
`seed.bool(label,p)`, `seed.shuffle(label,arr)`. Determinism property tested:
same (rootSeed, campaignVersion) ⇒ identical values; different rootSeed ⇒ different.

## 6. Campaign manifest (§6) + validation (§28)

`apiVersion: cyberrange/v1`. Zod schema. Loader parses YAML → typed manifest →
manifestHash (sha256 of canonical JSON). `scripts/campaign:validate`: schema, DAG
(no illegal cycles, no unreachable stages, all requires/unlock targets exist, no
dup ids, graders referenced exist, generators exist, hidden-answer leak scan).
`scripts/campaign:import`: validate → create Campaign+CampaignVersion (immutable)
+ Stages + Dependencies + Artifact templates + Hints in one transaction.

## 7. Graders (§14–15)

Contract: `grade(ctx) → { passed, score, feedbackJson, evidenceAutoCaptured }`.
Run in job drainer, never inline. Types:
- **value**: compare submitted value to seed-derived expected (constant-time).
- **code**: throwaway Sandbox → write submission + harness → compile → visible /
  hidden / malformed / boundary / resource tests → category scores, no hidden
  source disclosed (feedback like `Correctness: 8/10, Malformed: 4/5, Memory: PASS`).
- **finding**: validate structured fields with tolerance/ranges.
- **environment-state**: run check script inside workstation VM via handle.
- **file**: sha256 + parser/semantic validation, not filename.

## 8. Event engine (§16)

`emitEvent(instanceId, type, payload, idempotencyKey)` inserts DomainEvent (unique
key) then enqueues Job(s). Handlers idempotent via ProcessedEvent(eventId,handler).
Effects: STAGE_COMPLETED→unlock dependents; SUBMISSION_PASSED→award score + maybe
start service; FINDING_CONFIRMED→generate artifact; etc. Drainer:
`FOR UPDATE SKIP LOCKED`, bounded attempts, exponential backoff.

## 9. Sample campaign "Project Janus" (§29) — 8 stages, ~10h

Neutral titles; category hidden. Every concrete value seed-derived.

1. **First Light** — workstation VM, unfamiliar filesystem; find anomalous logs +
   a capture file (value: a path/marker derived from seed).
2. **Silent Relay** — personalized PCAP of an unknown binary protocol; classify it
   (structured findings: it's length-prefixed framing).
3. **Framing** — determine frame boundary, length field offset/width/endian, msg
   type, seq number, checksum (structured-finding grader, seeded offsets).
4. **Transcriber** — write a decoder; hidden tests on unseen seeded packets (code
   grader). Passing reveals credential fragment + starts the archive service.
5. **The Archive** — git repo where the secret lives in history, not HEAD
   (git archaeology; value from a reverted commit, seeded).
6. **Out of Order** — a broken C service (seeded off-by-one / UAF); reproduce the
   crash, explain root cause (finding), submit a patch that passes regression
   (code+env-state grader).
7. **Residual State** — a runtime nonce recovered in stage 6 lets you validate/
   decrypt a seeded configuration artifact (crypto-param finding + value; no brute
   force — the nonce reuse is the flaw).
8. **Reconstruction** — combine fragments to repair a small service; env-state
   grader verifies three replicas agree / handshake passes.

Each stage uses ≥2 anti-AI levers (§18): per-student randomization + hidden tests
+ interactive state + evidence + cross-stage dependency.

## 10. UX

- **Student**: campaign overview (progress, score, discovered systems, recent
  events — no locked-stage leakage); environment panel (start/stop/reset/open
  terminal, health only); xterm terminal; investigation notebook (6 entry types,
  linkable); unlocked artifacts (name/type/size/hash/download); structured findings
  form; submissions (value/code/file/finding/env-check); hints with visible penalty
  + confirm.
- **Instructor**: cohort table (progress, env status, score, hint usage, failed
  submissions, unlocked stages, last activity); student detail (timeline, notebook
  per policy, submissions, evidence, terminal session metadata, grader results,
  reset controls — Reset Environment / Reset Stage / Reset Campaign Progress kept
  distinct, §35).
- **Author**: MVP = YAML + `campaign:validate`/`import`; visual DAG editor deferred.

## 11. Scoring (§20)

Store `ScoreEvent`s (base, hint penalty, attempt penalty, evidence multiplier,
manual adjustment), never only a mutable total; total = deterministic fold. Auditable.

## 12. Non-goals for MVP (§30)

Visual campaign editor, Firecracker-beyond-Sandbox, billing, marketplace, social,
AI tutor, live collab, mobile. Real PTY (command-shell instead). Multi-host Docker
topology (single workstation VM with internal processes instead).

## 13. Acceptance (maps to §40)

A fresh student account can: get assigned a published versioned campaign → start →
receive a unique deterministic seed → provision an isolated Sandbox → open the
browser terminal → discover artifacts → download a personalized PCAP → RE the
protocol → submit a decoder graded by hidden tests in an isolated runner → passing
emits an event that unlocks the next stage and starts a service → record findings
→ use a hint and take a penalty → repair the broken service → env-state grader
verifies → complete reconstruction. Instructor reviews the full timeline. Reset
reproduces the same personalized challenge. A second student gets different concrete
values, same concepts, and cannot reach the first student's environment; challenge
code cannot reach the control plane or secrets.

## 14. The 72h+ deliverable

`docs/campaign-design-72h.md`: the full challenge-design blueprint/prompt the user
asked for — anti-AI principles, stage taxonomy, a ~28-stage 72h graph across
crypto / RE / pwn / forensics / distributed-systems / web tracks, hint and scoring
guidance — authored on top of the proven Janus pipeline. Content deliverable, built
after the engine works.

## 15. Global constraints

- Strict TypeScript, no implicit `any`; zod at every system boundary.
- No secret, seed, or expected-answer in any client bundle or log.
- Every backend route verifies authorization via a policy function.
- Grader/sandbox execution never in a request handler — always the job drainer.
- Deterministic generation; challenge content decoupled from app code.
- Tests required for: seed derivation, scoring, dependency resolution, manifest
  validation, authorization policies, grader evaluation, event handlers.
- Node runtime (not Edge) for any route touching Prisma / Sandbox / node:crypto.
