# QA report — T-003-QA10 · mutation red run MUT-01..18 (test-plan §9)

Verdict: **PASS with one test defect found and fixed (I3-21 did not exist)** — all 18 mutations
(24 variants) turn their §9 target tests red, every mutation was reverted, and every target set has a
no-mutation control that is green with **0 skipped**.
Open items for other owners: CI floor gaps (devops, §4) and the fact that this evidence is local, not
CI (§5).

Branch / base: `claude/f003-test-loop` @ `206fe2a` (uncommitted: the new I3-21 test only).
Date: 2026-11-22 · Owner: qa.

## 1. How it was run

- Local real stack using the `integration-api` env from `.github/workflows/ci.yml`. The DB is
  Postgres `omnistock_ci` on `localhost:55432` and Redis is on `:56379`. `TEST_DATABASE_URL` and
  `TEST_REDIS_URL` are set, so `INT_LANE_ENABLED` is true.
- One driver applies each mutation as an exact single-match string edit and runs vitest. It then
  **reverts in a `finally` step** and checks that `git diff --stat` is empty, both on the mutated
  files and on all of `apps/` + `packages/` (excluding `apps/api/test`). For core-domain mutations it
  rebuilds `dist` with the mutation (the api resolves core-domain through `dist`), then rebuilds it
  clean afterwards and checks the md5 against the pre-run baseline (`14e64238…`, 40 files). The
  checksum matched every time.
- **MUT-01..12** ran the full core-domain and apps/api lanes. On the clean tree the baseline was
  core-domain 788/788 and apps/api 1628/1629. The one red is perf-smoke P-03, a local timing failure
  that is red on the clean tree too and is not mutation-related. **0 skipped** in every MUT-01..12
  run.
- **MUT-13..18** ran only targeted files because free disk was down to about 4 GB. The driver refused
  to start below 1.5 GB. Each targeted set first ran **unmutated** (`CLEAN-MUT-xx`) and was green with
  **0 skipped** before the mutated run counted.
- **Void run, recorded honestly.** The first MUT-13 attempt happened while Postgres was down after a
  disk-full event. Every int suite failed in `beforeAll`, and vitest reported its tests as
  *skipped* (117), not failed. The driver at that point only flagged a file failure when a file had
  zero assertion results, so that run looked like a clean pass. It was discarded. The driver now marks
  any suite that fails outside a test as `INVALID RUN`. MUT-01..12 are not affected: each of them has
  int-only target IDs (I3-xx) failing, which is only possible with the DB up, and 0 skipped.

## 2. Results

`n red` = failing tests in that run. For MUT-01..12 the api count may include the P-03 timing red.

| MUT | mutation (§9) | §9 target(s) | went red (target IDs) | n red cd / api |
|---|---|---|---|---|
| 01 | `change_role` loses target axis | U-RB-10 · U-RB-21 · I3-25 · I3-27 · U-RB-18 | all ✓ | 18 / 14 |
| 02 | drop before ⊊ in `decideRoleWrite` | U-RB-12 (R01/03/04/05/09) · I3-31 · I3-32 · U-RB-18 | all ✓ | 19 / 21 |
| 03 | `write_held_role` loses `manage_members` floor | U-RB-12 (R13–R16) · I3-33 · U-RB-18 | all ✓ (+ I3-31 R13–16) | 21 / 19 |
| 04 | PATCH self skips grant axis | U-RB-10 (self) · I3-28 · U-RB-18 | all ✓ | 9 / 2 |
| 05 | accept re-check uses `invitedByUserId` | I3-38(e)(j) | all ✓ (+ U-API3-09) | – / 9 |
| 06 | accept re-check loses `manage_members` floor | I3-38(i) · U-RB-10 | all ✓ (+ I3-38(a)(j), I3-40, IC3-06(c)) | 4 / 7 |
| 07a | `RolesService.update`: `assertOwnerRemains` deleted | U-API3-01 · I3-15 | all ✓ | – / 5 |
| 07b | … moved after the write | U-API3-01 · I3-15 | all ✓ | – / 4 |
| 07c | `delete`: `assertOwnerRemains` deleted | (07 delete leg) | ✓ delete-route checks | – / 7 |
| 07d | `create`: `assertOwnerRemains` deleted | (07 create leg) | ✓ create-route checks | – / 5 |
| 08 | no-op short-circuit in `MembersService.updateRole` | I3-30(a) | all ✓ (+ I3-30(b), I3-23) | – / 6 |
| 09a | reset ⊊ refusal answers 403 | I3-35 · I3-36 | all ✓ | – / 22 |
| 09b | reset ⊊ refusal = 404 with different body | I3-35 · I3-36 | **I3-36 ✓ · I3-35 stays green** (status-only by design — I3-36 is the byte check) | – / 6 |
| 10 | `GET /roles` without `LIVE_ROLE_WHERE` | G3-04 · I3-10 | all ✓ | – / 6 |
| 11 | flag guard before `CapabilityGuard` | I3-44 | all ✓ (POST/PATCH/DELETE legs + guard-order unit) | – / 5 |
| 12 | `hasCapability` skips `expandCapabilities` | U-RB-04 | all ✓ (3 cases) | 12 / 227 |
| 13 | middleware memoizes membership per access token | I3-21 | **I3-21 did not exist → added; ✓ red** (see §3) | – / 8 (targeted) |
| 14 | `GET /roles` publishes `capabilities` | I3-22 | ✓ I3-22 (+ its G3-14 golden-fixture case) | – / 2 (targeted) |
| 15a | `isElevatedRole` by `key === "admin"` (core-domain) | U-RB-16 · I3-56 · G-12 | all ✓ (+ U-RB-17, U-CD-03, U-API3-04 clamp, I3-41, I3-42) | 12 / 4 (targeted) |
| 15b | invite create TTL by `role.key === "admin"` (api call site) | U-RB-16 · I3-56 · G-12 | I3-56 part 2 ✓ · G-12 ✓ · I3-41 ✓ (U-RB-16 is core-domain and not affected by an api call-site edit) | – / 3 (targeted) |
| 16 | `ROLE_WRITES_ENABLED` gates strict rule on PATCH /members | I3-44 | ✓ I3-44 "strict rules on SHIPPED routes are not behind it" (+ I3-25, I3-27, I3-28, I3-30(b), members.service unit) | – / 6 (targeted) |
| 17 | `viewer.*` on GET emits `escalation_denied` | I3-57 | ✓ I3-57 sweep (+ I3-57 control in `f003-sweeps`) | – / 2 (targeted) |
| 18 | PATCH role compares `version` before the no-op | I3-08 | ✓ I3-08 "even with a STALE version (MUT-18)" | – / 1 (targeted) |

Targeted file sets (MUT-13..18) and their no-mutation controls:

| MUT | files | control |
|---|---|---|
| 13 | `f003-role-update.e2e` · `members.e2e` · `members.f003.e2e` · `admin-reset.f003.e2e` · `org-leak.kit` · `concurrency-matrix` · `f003-live-role-ownership` · `src/tenancy/` | 173/173, 0 skipped |
| 14 | `f003-viewer-verdicts.e2e` · `f003-role-reads.e2e` | 23/23, 0 skipped |
| 15a | core-domain `src/orgs/` + `invitations.f003.e2e` · `role-key-authority.int` · `f003-role-writes.int` · `static-gates/role-key-authority.gate` · `f003-role-update.e2e` | 121/121, 0 skipped |
| 15b | `invitations.f003.e2e` · `role-key-authority.int` · `f003-role-writes.int` · `static-gates/role-key-authority.gate` · `src/orgs/invitations.service.test` | 142/142, 0 skipped |
| 16 | `f003-role-create.e2e` · `members.f003.e2e` · `members.e2e` · `src/orgs/members.service.test` | 114/114, 0 skipped |
| 17 | `f003-role-reads.e2e` · `f003-sweeps.int` · `f003-viewer-verdicts.e2e` | 28/28, 0 skipped |
| 18 | `f003-role-update.e2e` · `f003-role-writes.int` · `src/orgs/roles.service.test` | 56/56, 0 skipped |

Note on MUT-15a and MUT-15b: I3-56 **part 1** (`role-key-authority.int.test.ts`) stayed green under
both. That is expected: part 1 swaps Owner/Staff keys on the F-002 Owner-only set and does not test
TTL. Part 2 (`f003-role-writes.int.test.ts`, "TTL follows capabilities") is the TTL catcher, and it
went red.

## 3. Defect found → fixed in this task: I3-21 was missing (MUT-13)

- **Defect (test-plan §1 AC-6.5 and §9 row 13 name I3-21; no test carried that ID).** Under MUT-13,
  **every int test stayed green** (run `MUT-13-without-I3-21`: 165 passed, 7 red, 1 deselected).
  Test tokens get a fresh random `jti` from every `AccessTokenService.sign`, so a per-token cache is
  never hit by a test that signs per request.
- **Correction to my earlier interim note.** I first said MUT-13 was probably caught by nothing. That
  was wrong. 7 unit tests in `apps/api/src/tenancy/org-scope.guard.test.ts` go red. They use a
  deterministic token (`t.usr`). One is a deliberate catch: "membership revoked → 403 … (AC US-5:
  next request, no cache)" sends the same token twice in one test. The other 6 go red because the
  memo leaks across tests. That unit test covers the membership-status axis against a fake Prisma. It
  does not cover AC-6.5 on the real stack: a **role edit** or a **member move** taking effect on the
  next request made with the same token.
- **Fix (uncommitted).** Added `★ I3-21` to
  `apps/api/test/f003-role-update.e2e.int.test.ts` (+53 lines, header index updated). One access
  token is signed **once** and reused for every request. Packer (no `manage_roles`) → 403 · Owner
  gives the role `manage_roles` → 200 · takes it back → 403 · moves the member to Admin → 200 · back
  to Packer → 403. Probe route: `GET /orgs/{id}/capabilities` (`@RequireCapability(manage_roles)`,
  read-only).
- **Proof:** clean → **green** (`CLEAN-MUT-13-with-I3-21`, 173/173) · under MUT-13 → **red**
  (`MUT-13-with-I3-21`: I3-21 + the 7 unit tests) · `tsc -p tsconfig.test.json` 0 · eslint 0.
- The CI floor `test/f003-role-update.e2e.int.test.ts=14` is still satisfied (the file now has 15).
  Raising it to 15 is a devops call (§4).

## 4. For devops — CI floor gaps (`integration-api` job, `assert-tests-ran`)

CI run 44974845570 @ `206fe2a`: all 28 int files ran, 462/462, 0 skipped. So today nothing is
skipped. But **7 of the 28 int files have no `--require` floor**, and several of them are the only
catchers for mutations above. The only protection is `--min-passed 362` against 462, so any one of
these files (≤16 tests each) can vanish or skip without turning CI red:

| file (no floor) | tests in CI | catches |
|---|---|---|
| `test/members.f003.e2e.int.test.ts` | 15 | MUT-01 · 04 · 08 · 16 (I3-25/27/28/30) |
| `test/admin-reset.f003.e2e.int.test.ts` | 13 | MUT-09 (I3-35/36) |
| `test/f003-viewer-verdicts.e2e.int.test.ts` | 10 | MUT-14 (I3-22 — the only catcher) |
| `test/f003-live-role-ownership.int.test.ts` | 7 | MUT-10 |
| `test/invitations.f003.e2e.int.test.ts` | 6 | MUT-05 · 15a/15b (I3-38, I3-41) |
| `test/role-db-guards.int.test.ts` | 12 | (not a QA10 target) |
| `test/f003-seed.kit.int.test.ts` | 16 | (kit meta-test) |

Also: `test/invitations-redeem.e2e.int.test.ts` has 30 tests but a floor of 16, and
`f003-role-update.e2e` now has 15 against a floor of 14. Recommendation (QA defines, devops wires):
add a `--require` floor for every int file at its current count, and raise `--min-passed` to the new
total (463 including I3-21).

## 5. Limitations (stated, not hidden)

- **Local evidence, not CI.** No mutated commit was pushed. The CI run only shows that the target
  files execute in CI (0 skipped); it does not show the reds. Test-plan §9 asks for "CI run or log
  that shows the int lane on". This report is the log form, and every MUT run's skip count is 0.
- MUT-13..18 ran targeted files, not the whole lane. A mutation could in principle make an untargeted
  file red as well, which would add catchers. It cannot remove the reds recorded here.
- MUT-09b leaves I3-35 green on purpose: I3-35 asserts status and I3-36 asserts bytes. §9 lists both,
  and the pair together catches both variants.
- Per-run logs and diffs are in the session scratchpad (`qa10/MUT-*.txt`, `MUT-*.diff`,
  `CLEAN-MUT-*.txt`). They are not durable; this report is the record.
