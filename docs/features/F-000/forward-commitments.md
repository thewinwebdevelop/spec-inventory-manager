# F-000 → Forward Commitments (seam now, build later)

> Feature-local companion to the central
> [docs/features/forward-commitments.md](../forward-commitments.md) register. Entries here are
> F-000-specific test/automation debt surfaced during the F-000 final whole-branch review
> (2026-07-05) — tracked here so the destination feature's Gate 1/2 picks them up.

---

## → F-001 (e2e-in-CI for AC3 / AC15)

| ที่มา                                                                                         | สิ่งที่เลื่อน                                                                                                                                                                                                                                      | seam ที่ F-000 วางแล้ว                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-000 test-plan.md AC3 (api `/health` boot, web `GET /` 200, flutter analyze+build)           | Add a real e2e-in-CI job: supertest hit against a booted `apps/api` process, an HTTP `GET /` against a booted `apps/web` dev/prod server, and a flutter build smoke — wired as an automated, merge-blocking CI check (not just local verification) | F-000 verified these locally with live evidence (see PR/build evidence); node-ci already runs `build`/`typecheck`/`test`/`lint`, flutter-ci already runs `flutter analyze`+`flutter test` (AC13). `apps/api` has only the `/health` endpoint in F-000 — deferred until F-001 gives it real endpoints worth an e2e smoke around. |
| F-000 test-plan.md AC15 (Redis/BullMQ boot + `/health` probe, incl. negative Redis-down case) | Same e2e job (or a sibling job) boots the compose stack (Postgres+Redis), hits `/health` for the healthy case, stops Redis, hits `/health` again for the degraded case — asserted in CI, not just local                                            | F-000 verified locally (boot api against compose, hit `/health` healthy, stop Redis, hit `/health` degraded); the health-check endpoint and its Redis/queue probe shape already exist (T-000-08)                                                                                                                                |

**Decision record:** see [DECISIONS.md](../../DECISIONS.md) — this deferral is a PM decision made
during the F-000 final whole-branch review (2026-07-05), not a new D-XXX entry (it doesn't change
scope/contract, only clarifies which checks in test-plan.md's `[auto]` legend are CI-automated vs
locally-verified-for-F-000). Test-plan.md AC3/AC15 sections carry an inline note pointing back here.

**Owner when F-001 opens Gate 2:** devops wires the CI job; qa defines the pass/fail assertions
(consistent with test-plan.md §9 "cross-domain wiring" split already in effect for F-000).
