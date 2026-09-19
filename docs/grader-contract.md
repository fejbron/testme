# Grader Contract

All graders return `GraderFeedback { passed, score, maxScore, categories, summary }`
and never disclose hidden-test source or expected answers. They run in the job
drainer, never in a request handler.

- **value** `gradeValue(submitted, expected)` — constant-time compare (sha256 +
  timingSafeEqual), whitespace-normalized. Expected is seed-derived.
- **finding** `gradeFinding(submitted, spec)` — per-field exact or numeric
  tolerance/range; partial credit; categories show PASS/FAIL, never the expected value.
- **code** `gradeCode(submission, spec, run)` — assembles submission + harness in a
  throwaway microVM (`run` = injected ephemeral runner), runs build + visible/hidden/
  malformed/boundary groups, weighted scoring; only pass/fail counts are surfaced.
- **environment-state** `gradeEnvironmentState(checks, run)` — runs checks inside the
  student's workstation via the trusted control-plane handle; unforgeable.
- **file** `gradeFile(bytes, spec)` — sha256 + parser/semantic checks (pcap magic,
  json), `mustContain`; never trusts filename.

Per-campaign glue (`src/lib/grading/janus.ts`) derives each stage's expected values
from the seed by running the same deterministic generators used for provisioning, so
grading and the artifacts the student holds always agree.
