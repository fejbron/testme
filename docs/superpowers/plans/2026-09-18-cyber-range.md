# Cyber Range Platform — Implementation Plan

> **For agentic workers:** implement task-by-task; each task ends with a working,
> typechecking, committed deliverable. Steps use `- [ ]`.

**Goal:** Ship a deployed Vercel + Supabase cyber-range platform where a student
completes a personalized, seed-driven, AI-resistant multi-stage investigation
campaign graded by hidden tests in isolated microVMs.

**Architecture:** Single Next.js 15 (App Router, TS, Tailwind) app on Vercel;
Supabase (Postgres via Prisma, Auth, Storage); Vercel Sandbox for student
workstation + code grading; Postgres-backed job/event engine. See spec
`docs/superpowers/specs/2026-09-18-cyber-range-design.md`.

**Tech Stack:** Next.js 15, React 19, TypeScript (strict), TailwindCSS, Prisma,
@supabase/supabase-js + @supabase/ssr, @vercel/sandbox, zod, yaml, vitest.

**Spec:** `docs/superpowers/specs/2026-09-18-cyber-range-design.md`

## Global Constraints
- Strict TS, no implicit `any`; zod at every boundary.
- No seed / expected answer / secret in any client bundle or log line.
- Every API route authorizes via a policy function (`src/lib/auth/policies.ts`).
- Grader + sandbox runs only in the job drainer, never in a request handler.
- Prisma/Sandbox/node:crypto routes use `export const runtime = "nodejs"`.
- Deterministic generation; `/challenges/*` decoupled from app code.
- Supabase: `DATABASE_URL` = pooled 6543 (pgbouncer), `DIRECT_URL` = 5432 for migrate.

---

### Task 1: App scaffold + Vercel deploy pipeline
Next.js app (TS, Tailwind, App Router, `src/`), base layout, health route, env
schema (`src/lib/env.ts` zod), link to Vercel project `cyber-range`, first deploy.
Deliverable: live URL renders a landing page; `/api/health` returns ok.

### Task 2: Prisma schema + Supabase migration
Full §5 schema + enums + `Job`/`ProcessedEvent`/`ScoreEvent`/`AuditLog`. Prisma
client singleton. `prisma migrate` against Supabase. RLS enabled on student tables.
Deliverable: migration applied; `prisma studio` shows tables.

### Task 3: Supabase auth + roles + policy functions
`@supabase/ssr` server/client, middleware session, `profiles` row on signup with
role, login/logout/me, `src/lib/auth/policies.ts` (`canViewCampaignInstance`,
`canResetEnvironment`, `canGradeSubmission`, `canAccessCourse`…). Seed one admin.
Deliverable: login works; role gates a protected page.

### Task 4: Seed engine + tests
`src/lib/seed` HKDF namespaced derivation + typed helpers + AES-256-GCM seal/open.
Vitest determinism + distribution + no-raw-seed-leak tests.

### Task 5: Campaign manifest schema + validator + importer
zod `cyberrange/v1` schema, YAML loader, manifestHash, `campaign:validate` (DAG,
reachability, dup ids, missing grader/generator, leak scan), `campaign:import`
(transactional immutable publish). Tests on a fixture manifest.

### Task 6: Janus campaign content (stages 1–8) + generators
`/challenges/janus`: `campaign.yaml`, seeded generators (filesystem tarball, PCAP,
git repo, C service, config), graders wiring, hints, per-stage README. Generators
deterministic + unit-tested (same seed ⇒ same sha256).

### Task 7: Sandbox provider
`src/lib/sandbox`: provision/start/stop/reset/destroy/status/exec over
@vercel/sandbox; workstation named per instance, `deny-all`, resource caps; seeded
filesystem materialized on create; env-state check-script channel.

### Task 8: Job + event engine
`emitEvent`, handlers (unlock, award, generate-artifact, start-service),
idempotency, drainer route + Vercel Cron, backoff. Tests: completion unlocks
dependent; retries don't double-apply.

### Task 9: Graders
value / code(hidden tests in throwaway Sandbox) / finding / environment-state /
file. Category feedback without hidden-source disclosure. Tests per grader.

### Task 10: Student API + pages
Routes per §23 (campaigns, instances, stages, artifacts signed download, notebook,
findings, submissions, hints). Pages: overview, environment panel, xterm terminal
(SSE exec), notebook, artifacts, findings, submissions, hints.

### Task 11: Instructor API + dashboard
Cohort progress, student detail (timeline/notebook/submissions/evidence/grader
results), reset controls (3 distinct), manual score adjust, audit-logged.

### Task 12: Scoring + audit + observability
ScoreEvent fold, append-only AuditLog on sensitive actions, structured logger with
request_id + entity ids.

### Task 13: End-to-end demo seed + verification
Seed instructor+2 students, publish+assign Janus, script/manually walk acceptance
§40 path on the deployed URL; fix breaks.

### Task 14: 72h+ campaign design doc
`docs/campaign-design-72h.md` — full anti-AI blueprint + ~28-stage 72h graph.

### Task 15: Docs
architecture / security-model / challenge-authoring / grader-contract / event-model
/ deployment.
