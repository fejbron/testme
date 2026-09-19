# Security Model

The platform separates three planes. A compromise of the challenge plane must not
reach the control or grader planes (spec §25).

## Control plane
Vercel Functions (Next.js route handlers), Supabase Postgres, Supabase Storage
credentials, the sandbox OIDC identity, and the seed-encryption key
(`SEED_ENC_KEY`). Students have **no network path** to it. The Supabase
service-role key is server-only and never shipped to the browser. Authorization is
enforced in every route via policy functions (`src/lib/auth/policies.ts`) — UI
restrictions are never sufficient. RLS on Supabase tables is defense-in-depth.

## Challenge plane
The per-student workstation microVM (Vercel Sandbox), the seeded artifacts, and any
challenge services running inside it. **Assume full compromise.** Controls:
- `networkPolicy: "deny-all"` egress by default; per-stage allowlists only when a
  challenge legitimately needs external docs.
- No platform secrets injected into the VM. The raw seed never enters the VM — only
  seed-*derived* concrete values the challenge is meant to expose.
- Resource caps (1 vCPU, short/bounded session timeout); each VM is an isolated
  Firecracker guest, so a crash/fork-bomb/disk-fill is contained.
- The browser terminal runs commands through the control plane
  (`/api/campaign-instances/:id/exec` → `sandbox.exec`); the Docker/VM handle is
  never exposed, and a blocklist rejects obviously destructive commands.

## Grader plane
Untrusted-code grading (hidden tests) runs in **throwaway** microVMs
(`persistent:false`, `deny-all`, ~45s timeout, 1 vCPU), created by the job drainer,
never in a request handler, never on a worker host. The VM holds no platform
secret and is destroyed after each grade. The environment-state grader reaches into
the student's workstation one-way via the trusted control-plane handle; the student
never holds the runner, so results cannot be forged.

## Seeds
A 32-byte root seed is minted server-side per campaign instance, sealed with
AES-256-GCM under `SEED_ENC_KEY`, and stored encrypted. It is opened only inside
trusted generator/grader code paths (`src/lib/seed/context.ts`, marked
`server-only`). It never appears in a student API response, a log line, or a client
bundle. Salt = campaign-version manifest hash, so `(seed, version)` deterministically
reproduces the whole environment for debugging, grading, and resets.

## Uploads & downloads
Uploads are size-bounded (25 MB), content-type checked, filename-sanitized
(zip-slip / path traversal rejected — `safeObjectKey`), and stored by generated key,
not user filename. Downloads use short-lived (≤120s) Supabase signed URLs scoped to
one object, gated by the same view policy and stage-unlock check.

## Audit
Security-sensitive actions (login-adjacent flows, campaign start, environment
create/reset, grader execution, terminal exec, hint use, artifact download, manual
score change) append immutable rows to `AuditLog`.

## Threats explicitly handled
Cross-student access (ownership checks + RLS), cross-cohort instructor access
(role policy), terminal-session hijack (ownership check on every exec), signed-URL
leakage (short TTL + per-object scope), malicious upload/zip-slip (sanitizer),
oversized uploads (size cap), grader escape (throwaway deny-all VM), unauthorized
reset (instructor-only progress reset), seed exposure (encrypted at rest, server-only
decrypt), and direct challenge→control-plane access (network isolation).
