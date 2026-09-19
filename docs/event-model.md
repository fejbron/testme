# Event Model

Progression is event-driven and idempotent (spec §16).

- `emitEvent(campaignInstanceId, type, payload, idempotencyKey)` inserts a unique
  `DomainEvent` and enqueues a `PROCESS_EVENT` job. Re-emits are no-ops.
- Handlers guard themselves with a `ProcessedEvent(eventId, handlerName)` unique row,
  so retries never double-apply.
- Key events: CAMPAIGN_STARTED, STAGE_UNLOCKED, STAGE_COMPLETED, ARTIFACT_GENERATED,
  SERVICE_STARTED, SUBMISSION_RECEIVED/PASSED/FAILED, HINT_USED, ENVIRONMENT_RESET.
- Effects: STAGE_COMPLETED → unlock dependents whose REQUIRES prerequisites are all
  complete, and apply the stage's manifest `onComplete` (startService/emit).
- Jobs: `Job` table, claimed with `FOR UPDATE SKIP LOCKED`, bounded attempts with
  exponential backoff, drained inline (`kickDrain`) and by Vercel Cron
  (`/api/jobs/tick`, every 2 min).
