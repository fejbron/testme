# Deployment

## Prereqs
- Vercel project `cyber-range` (linked). Vercel Sandbox available on the plan for
  live workstations + code grading (artifact generation works without it).
- Supabase project (Postgres + Auth + Storage).

## Environment variables (Vercel: production/preview/development)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (pooled 6543, `pgbouncer=true`),
`DIRECT_URL` (5432, migrations), `SEED_ENC_KEY` (base64 32 bytes), `CRON_SECRET`
(optional, protects `/api/jobs/tick`).

## Database
- `node scripts/prisma-env.mjs migrate deploy` — apply migrations.
- `node scripts/run-with-env.mjs prisma/seed.ts` — seed admin/instructor/students.
- `node scripts/run-with-env.mjs scripts/campaign-import.ts challenges/janus` — publish.
- `node scripts/run-with-env.mjs scripts/assign-demo.ts` — demo course/cohort/assign.
- `node scripts/run-with-env.mjs scripts/ensure-bucket.ts` — create the storage bucket.

## Deploy
`vercel deploy --prod`. The build runs `prisma generate && next build`. A Vercel
Cron drives the job drainer every 2 minutes; actions also drain inline.

## Demo credentials
admin@range.local / instructor@range.local / student1@range.local /
student2@range.local — passwords set by `prisma/seed.ts` (rotate before real use).
