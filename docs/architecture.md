# Architecture

A single Next.js 15 app (App Router, TypeScript) deployed to Vercel, backed by
Supabase (Postgres, Auth, Storage) and Vercel Sandbox (Firecracker microVMs).
See the design spec: `docs/superpowers/specs/2026-09-18-cyber-range-design.md`.

## Layers
- **Web / API** — Next.js route handlers under `src/app/api` (REST). Node runtime
  wherever Prisma / Sandbox / node:crypto are touched. Auth via Supabase + a
  `Profile.role` gate enforced by `src/lib/auth/policies.ts`.
- **Domain services** — `src/lib/services`, `src/lib/campaign`, `src/lib/scoring`,
  `src/lib/events`. Business logic lives here, not in controllers.
- **Seed engine** — `src/lib/seed` (HKDF derivation, AES-GCM sealing). Central to
  per-student personalization and deterministic regeneration.
- **Graders** — `src/lib/graders` (value / finding / code / environment-state /
  file). Pure w.r.t. infrastructure; untrusted execution is injected.
- **Sandbox provider** — `src/lib/sandbox` wraps Vercel Sandbox behind an
  `EnvironmentProvider` interface (provision/start/stop/reset/destroy/exec +
  ephemeral grade).
- **Event/job engine** — `src/lib/events`. `emitEvent` (idempotent) + a
  Postgres-backed `Job` queue drained with `FOR UPDATE SKIP LOCKED`, kicked inline
  and by a Vercel Cron (`/api/jobs/tick`). Handlers unlock stages, award score,
  start services, generate artifacts — all idempotent via `ProcessedEvent`.
- **Challenge content** — `challenges/janus` is a portable package (manifest +
  seeded generators + per-stage grading), decoupled from app code.

## Request → progression flow
1. Student starts an instance → seed minted+sealed, challenge instances created,
   `PROVISION_ENVIRONMENT` enqueued.
2. Provisioning deterministically generates the student's artifacts (stored, hashed)
   and boots the workstation microVM with the seeded filesystem.
3. Student investigates via artifacts + terminal, then submits (value/finding/code/
   env-check). A `GRADE_SUBMISSION` job runs the grader (code in a throwaway VM).
4. On pass, the stage completes, a score event is written, `STAGE_COMPLETED` is
   emitted; the handler unlocks dependents and may start a service.
5. Instructors observe the whole timeline; resets deterministically reproduce the
   same personalized challenge from the same seed.

## Why the deviations from AGENTS.md
Vercel is serverless (no long-lived Docker daemon, no raw-WS PTY, no BullMQ host).
The Docker orchestrator → Vercel Sandbox; the PTY terminal → a command-shell over
`sandbox.exec`; BullMQ → a Postgres job queue; MinIO → Supabase Storage. The domain
model, seed engine, grader taxonomy, event engine, and security posture are intact.
