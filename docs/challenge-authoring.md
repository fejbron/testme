# Challenge Authoring

A campaign is a portable package under `challenges/<slug>/`:
`campaign.yaml` (manifest), `generators/index.ts` (seeded, deterministic), a
per-stage grading derivation, `README.md`. See `challenges/janus/` as the reference
and `docs/campaign-design-72h.md` for large-campaign design.

## Manifest (`cyberrange/v1`)
`campaign` meta; `environment.workstation`; `stages[]` each with `completion`
(type + grader), `visibility.default`, `requires`, `artifacts` (type + generator),
`hints` (level/penalty/content), `evidence.required`, and `onComplete`
(unlock/emit/startService).

## Rules
- Neutral titles; never name the vuln class. No answer leaks in descriptions/hints
  (the validator scans for "answer:", "flag{", "the key is", "password is").
- Every student-visible value must be seed-derived (`SeedContext`). Generators are
  pure and deterministic: same `(seed, version)` ⇒ identical bytes ⇒ identical hash.
- `expected` grading values are returned to the trusted caller, never shipped.
- Each major stage uses ≥2 anti-AI levers.

## Validate & publish
`pnpm campaign:validate challenges/<slug>` then `pnpm campaign:import
challenges/<slug>`. Validation checks schema, DAG reachability, cycles, duplicate
ids, missing grader/generator, and answer leaks. Published versions are immutable;
any change is a new version, and existing student instances stay pinned.
