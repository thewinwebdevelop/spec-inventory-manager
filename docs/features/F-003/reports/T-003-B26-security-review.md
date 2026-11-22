# Security review — T-003-B26a + B26b (test tasks · implementation)

Verdict: **approve with fixes (must-fix: M-1)** — ready-with-recommendations
(advisory — backend-api / qa decide adoption)

Scope: uncommitted `apps/api/test/f003-role-writes.int.test.ts`, `f003-concurrency.int.test.ts`,
`tx-barrier.kit.ts` + `tx-barrier.kit.test.ts`, `regression-pack.ts`, `cited-paths.test.ts`,
`.github/workflows/ci.yml` integration-api floors, `docs/features/F-003/tasks.md` B26 rows.
`apps/web/**` and the ci.yml e2e-lane `ROLE_WRITES_ENABLED`/`E2E_ROLE_WRITES` lines (T-003-W06) were
not reviewed.

Evidence I gathered myself: I re-ran `npx vitest run f003-role-writes f003-concurrency tx-barrier` on
`omnistock_ci` and got **67/67 passing** (31 + 28 + 8). I counted the cases against the CI floors and
read the trigger SQL (`20260928000000_f003_role_expand/migration.sql:255-322`), the accept path
(`invitations.service.ts:900-970`) and the filter's 500 branch (`domain-exception.filter.ts:166-175`).
I did not run any mutations again; for those I relied on the builder's log (`mutations-b26.txt`,
22 entries, all red after MUT-10 was fixed).

## Findings (severity-ranked)

- **[Medium] M-1 — IC3-06(b) "accept ‖ edit R" cannot tell a working D-035 re-check from a broken
  one, yet it is pinned as the SR-F003-02 proof** — `f003-concurrency.int.test.ts` IC3-06(b)
  (~line 497), `regression-pack.ts` SR-F003-02 row ("accept ‖ role edit, both commit orders").
  Scenario: the invitation was issued by the **Owner**, and the edit **lowers** R. An Owner-issued
  invitation always passes the issuer re-check (§13.7(4)), and the issuer still covers a lowered
  role. So (b) passes even if accept re-checks the issuer against stale caps (read before the org
  lock, or copied from the invitation row), or skips the re-check entirely. The mutation log agrees:
  MUT-B26-04 (no re-check) turns only (c) red. (c) is the inviter-demotion race, not the role-edit
  race. The dangerous direction is never raced: a non-Owner issuer, and a **raise** of R during the
  accept.
  Recommendation (@qa / @backend-api): add two cells.
  - (e) Admin A issues an invitation to R ⊆ A. The Owner raises R with `manage_billing`, and the
    edit commits first. The accept, which waited, gets `409 INVITATION_CANCELLED`, reason
    `inviter_exceeds`, excess `["manage_billing"]`, and no membership is created.
  - (f) The reverse order: the accept commits first and gets 200, then the raise lands.
  Then run one mutation: make `recheckIssuer` use the invitation-time or pre-lock caps of R. (e)
  must go red. Until then, change the SR-F003-02 pin text so it does not claim the role-edit leg.

- **[Low] L-1 — I3-56 swapped-keys case cannot catch "Owner role decided by `key`"** — `f003-role-writes.int.test.ts`
  I3-56 first case (~line 690). After the swap, nothing writes to the Staff role that now has
  `key=owner`. The only check is the read-side verdict. This is why MUT-B26-19 stays green there
  (the "partial catch"). Recommendation: add `PATCH` (rename) and `DELETE` of the Staff role by the
  Owner, expecting 200 and `409 ROLE_IN_USE`/200. One line each, and then both cases discriminate.
  Today the custom `key=owner` case is the only guard.

- **[Low] L-2 — the post-commit non-vacuity check is weaker than its comment, and the test name
  claims more than it does** — `f003-concurrency.int.test.ts` `roleLockModes`, ~lines 920-960.
  Scenario: `RowExclusiveLock` on relation `Role` is a **table-level** lock. Any UPDATE or INSERT
  statement takes it, including an `updateMany` that matched 0 rows. So it proves that a statement
  ran, not that "the paused tx really wrote the Role row". Separately, the test is named "fails at
  COMMIT", but it actually throws inside the callback, just before COMMIT.
  Recommendation:
  - PATCH: from `holderDb`, run `SELECT 1 FROM "Role" WHERE id=$1 FOR UPDATE NOWAIT` and expect
    `55P03`. That is a row-level proof.
  - POST: insert the same live name from `holderDb` and `waitUntilBlockedBy` on the unique index.
  - Rename both tests to "…tx aborts after the last statement, before COMMIT…".

- **[Low] L-3 — the SR-06 write-skew race covers only the Membership INSERT leg** —
  `f003-concurrency.int.test.ts` IC3-07(c)/(d). One trigger function serves INSERT **and**
  `UPDATE OF "roleId", status` on both Membership and Invitation (migration lines 313-322).
  Removing `FOR SHARE` is caught. But a binding regression is never raced: for example, narrowing
  the trigger to `BEFORE INSERT`, dropping the Invitation trigger, or changing a `WHEN`. Those are
  left to the sequential `role-db-guards.int.test.ts:264`. The builder's own observation matters
  here. An INSERT cannot slip past the org lock (the FK takes `FOR KEY SHARE` on Organization), so
  the realistic lock-skipping writer is an **UPDATE of `roleId`/`status`**, and that leg has no race
  test. Recommendation: parametrize (c)/(d) over {Membership INSERT, Membership UPDATE `roleId`
  (incl. revoked→active), Invitation INSERT}. It costs about 4 cases and uses the same barrier
  shape.

- **[Low] L-4 — the I3-49 set-equality compares two hand-written lists** — I3-49 (~line 1150).
  `seenOps` comes from the 15 hand-picked cells. A **new** non-GET route that calls a decider but
  is not in the cell list would not be caught. (MUT-B26-12, the reverse direction, is caught.) The
  test-plan wording ("during the sweep") is technically met. I3-57 already enumerates GET routes
  from the router, so the same approach is available. Recommendation: enumerate the write routes
  from the router, or name the static gate that covers "a new decider call site" in the test
  header.

## Builder decisions — my read

- **(a) Trigger refusal stays 500: acceptable, and I agree with it.**
  - Nothing leaks. The body is the generic `INTERNAL` envelope, pinned by `expectOpaque500`, which
    forbids `f003_|restrict|23001|Role|Membership|Invitation`. Detail goes only to the server log
    (role ids, no PII).
  - Alert noise is not a concern. No F-003 application path can hit the trigger without first
    skipping the org lock (G3-11 pins that). A trigger refusal therefore means *our code has a
    missing-lock bug*, and a 500 plus an error log is the right alarm.
  - Mapping it to 422 (MUT-B26-09) would hide that regression behind a normal-looking client error.
  - Recommendation to @devops: route `f003_role_deleted|f003_role_in_use` in the 500 logs to a bug
    alert, not to a generic 5xx budget.
  - The tests check that nothing was written and no success event was emitted.
- **(b) IC3-07 both orders:**
  - App level: (a)/(b) serialize on the org lock, and the outcomes match the commit order. Good.
  - SQL level: (c)/(d) prove the wait with `pg_blocking_pids` and a statement-specific regex, then
    the refusal. MUT-B26-07/07b make both directions red. The FK-lock observation is correct.
    `FOR UPDATE` on Organization conflicts with `FOR KEY SHARE`, which is why the B25-L1 delete leg
    uses a Membership UPDATE. It also motivates L-3.
- **Barrier kit:** deterministic.
  - Pauses are promises, released only after the needed state has been observed.
  - `waitUntilBlockedBy` polls for a **condition** (20 ms ticks, fails loudly at 2.5 s). It never
    sleeps to set the order.
  - It requires a matching statement, and each test has its own org, so it is safe in parallel
    lanes.
  - Gates are one-shot and per user. `afterEach` resets them, so a failure cannot leave a request
    hung.
  - One possible blind spot: `beforeTx` claims the user's *first* `$transaction`. If the guard ever
    opened one, the pause would land before the guard and IC3-03a/04a would pass vacuously.
    MUT-B26-02 turning red rules that out today. Consider asserting `gate.claimed` together with
    some marker that the guard has already run.
  - The kit's own unit test (8 cases, including a "never fires on another user" case) is a good
    non-vacuity layer.
- **Partial catch (key vs isSystem):** acceptable once L-1 is added.
- **Not covered:**
  - I3-56 part 2 backfill: M3-04 exists in `packages/db/test/f003-backfill.int.test.ts`. Fine.
  - I3-51 post-window half: unit only. Acceptable because it needs time control, not concurrency.

## CI floors

Correct. `f003-role-writes` has 31 `it` (21 rows + §4.4 edge + 4 + 2 + 1 + 2) and
`f003-concurrency` has 28; `--min-passed 349 = 290 + 59`. `assert-tests-ran` defaults
`--max-skipped 0`, so a self-skipped file goes red. `tx-barrier.kit.test.ts` runs in the unit lane
through the vitest `test/**` include. No floor is needed, but adding one is cheap.

Housekeeping: the same ci.yml diff carries the W06 e2e-lane `ROLE_WRITES_ENABLED: "true"`. Commit
it with W06 and its own review, not with B26.

## Strengths (keep these)

- Every race is ordered by real lock observation and runs both commit orders, with "nobody answered
  while paused" asserted before release.
- `expectRefused` checks the whole Role row (caps, name, version) and that no success event was
  emitted on every refusal. Addendum-2 rows assert *no* security event plus the warn line.
- Each attack test has a control that shows the threat is real (Owner step 1 → reset 200; MR′ → MM
  reset 200).
- I3-34 recomputes the verdict reason from data MR can already read, and asserts that no identities
  appear in the body.
- The post-commit test was fixed after MUT-10 stayed green. The mutation log is honest, including
  the first-attempt miss.

## Questions to route (not guessed)

- @product / @backend-api: for M-1 (e), does an Owner raising R above the issuer's caps after the
  link was issued mean the link is cancelled (`inviter_exceeds`)? Or does policy prefer the raise to
  shorten or cancel the link at edit time (§6 layer 1 already cuts links of roles that *became
  elevated*)? Either way the test should pin whichever one is the rule.

---

## Fix round 1 (backend-api, verified by lead 2026-11-22)

| Finding | Status | Change |
|---|---|---|
| **M-1 (must-fix)** IC3-06(b) could not go red | ✅ fixed | IC3-06(e)/(f): an ADMIN issues the link, the Owner raises the role (+`manage_billing`) racing the accept, barriers both orders — edit-first → 409 `INVITATION_CANCELLED` (`inviter_exceeds`), accept-first → 200 then the raise. MUT-B26-21 (stale caps) and MUT-B26-04b (skip re-check) both red. SR-F003-02 pin → (c)+(e). Accept-time cancellation is the specified rule (arch §6.1, D-035 Addendum) — no product change. |
| L-1 swapped-keys case never wrote the `key=owner` Staff role | ✅ fixed | Owner rename (200) + delete (409 ROLE_IN_USE) of it; MUT-B26-19b red on both cases |
| L-2 table-level lock proof | ✅ fixed | row-level `FOR UPDATE NOWAIT` (55P03) / waiting duplicate INSERT; tests renamed "aborts after its last statement, before COMMIT" |
| L-3 SR-06 only Membership INSERT | ✅ fixed | 4 writers × 2 orders (Membership INSERT, UPDATE roleId, UPDATE status, Invitation INSERT); narrowed/dropped triggers go red |
| L-4 I3-49 hand-picked set | ✅ fixed | every non-GET route from the router is either a cell or on a reasoned exemption list |

Lead re-run: `f003-role-writes` + `f003-concurrency` 67/67 (31+36) · api unit 1169. CI floors 31 / 36, `--min-passed 357`.
