# Security review — T-003-B25 ★ `DELETE /orgs/{orgId}/roles/{roleId}` (implementation)

Reviewer: security-reviewer (advisory — backend-api/user decides adoption) · 2026-11-21
Scope: the uncommitted B25 diff on `claude/f003-test-loop` (on top of `e3eaabf`). The generated
`apps/mobile/api_client/**` and `.claude/launch.json` were not reviewed.

**Verdict: approve** (ready-with-recommendations). Nothing is above Low. No must-fix items.

## Evidence run

- `pnpm --filter api test` → 80 files passed / 23 skipped · **1161 passed**, 388 skipped (the int lane is skipped without a DB).
- `apps/api` int lane against `omnistock_ci` with `REQUIRE_INT_LANE=1`: `npx vitest run f003-role-delete` →
  **14/14 passed**. That matches the new CI floor `--require "test/f003-role-delete.e2e.int.test.ts=14"`.
  `--min-passed 290` = 276 + 14 also adds up.
- The run logs `rate limit fail-open … redis provider not bound` for test modules built without Redis.
  This is the existing fail-open design, not new in B25. I3-46, which binds Redis, does get its 429.

## Threat model: what I checked and what holds

| Question | Result |
|---|---|
| Escalation through delete | `decideRoleWrite(op:"delete")` runs on capabilities re-read in the tx (`roles.service.ts` ~L820–838) before any in-use or cap fact is revealed. ROLE_LOCKED, EXCEEDS_ACTOR, HELD_REQUIRES_MANAGE_MEMBERS and TARGET_NOT_BELOW_ACTOR are all checked before ROLE_IN_USE. A delete grants nothing, and the actor cannot delete the role they hold, because `activeMembers` counts the actor too. |
| Removing a role others rely on | It is not possible. Any active holder or any pending link (expired ones included, AC-3.9) gives 409 ROLE_IN_USE. A designer without `manage_members` is stopped earlier by HELD_REQUIRES_MANAGE_MEMBERS. |
| Write-skew: delete ‖ assign / invite / accept (SR-06) | Two layers close it. (1) Every writer of `Membership.roleId`/status and `Invitation` (`updateMemberRole`, `acceptInvitation`, `createInvitation`, `reissueInvitationLink`, plus the role ops) is in `ORG_LOCK_REQUIRED_OPERATIONS` and runs under the same Organization anchor. The in-use count is read under that lock, so the two serialize. (2) For SQL that skips the lock, the DB has `role_soft_delete_guard` (BEFORE UPDATE of deletedAt, counts active/pending) and `role_live_reference_guard`. The second takes `Role … FOR SHARE`, which conflicts with the delete's NO KEY UPDATE, so the later writer is refused (migration `20260928000000_f003_role_expand` L261–322). The app-level race test (IC3-06/07) is owned by B26b and `role-db-guards.int.test.ts`, not B25. |
| Lock order vs admin-reset | Delete takes Org → Role (row) and reads Membership with plain reads only. Admin-reset takes Membership FOR SHARE → Role FOR SHARE. There is no cycle. IC-B25 proves it with pg_locks (delete holds only ACCESS SHARE on Membership, and the reset finishes while the delete is paused). The unit test checks "nothing touches Membership after the write". |
| Tenant scoping of counts | All Role, Membership and Invitation reads go through `ORG_PRISMA` (Invitation is org-scoped: `org-models.test.ts:62`). The membership counts also add `organizationId` explicitly. The role is resolved live and in-org first, so another shop's id is the same 404 (tested). |
| AC-6.4 oracle: do the ROLE_IN_USE counts leak? | No new disclosure. Only a `manage_roles` holder gets past the floor. That same caller already sees `usage {activeMembers, pendingInvitations}` on `GET /roles/{id}` (`role-read.service.ts:197–216`, `manage_roles`). The details are numbers only (I3-09 scans the body for email, userId and names). A caller without `manage_members` who faces other holders gets HELD_REQUIRES_MANAGE_MEMBERS without counts. |
| History cap: off-by-one / DoS | `deletedRows >= max` refuses, so at most `max` (500) soft-deleted rows. I3-11 checks this with max=2: two deletes pass, the third is refused. The role stays live. ROLE_IN_USE is answered before the cap, so the cap does not hide in-use. A DoS needs `manage_roles` (an insider) plus about 1000 writes (create + delete pairs) against the shop-wide `roleWrite` quota of 60/h: that is roughly 17 hours of visible activity. `role_deleted_rows_high` at 80% gives warning first. This is accepted per SR-12. |
| Soft-deleted role unusable everywhere | The G3-04 per-method pins keep `MembersService.updateRole`, `InvitationsService.accept`, `InvitationsService.readRole`, the list and detail reads, and create/update LIVE. `RolesService.delete` gets exactly one history allowance (the deleted-row cap: exact snippet, args and label). The new fixture shows a dodge going red and its twin staying green. I3-10 proves at runtime that the live reads stop seeing the role and that its id answers like an unknown id. The DB `role_live_reference_guard` is the backstop. |
| Name reuse after delete | Allowed by design (live-only unique index `Role_org_name_ci_live_key`). I3-10 proves that a POST with the same name gets 201. The history rows keep the old name (`roleDeleteData` does not touch `name`). |
| Writer surface | `roleDeleteData` writes only `deletedAt`, `deletedByUserId` and `version+1`. G3-02 (2) proves that `capabilities`, `name` and `isSystem` do not compile. G3-02 (3) pins the only Role write in `delete` to `updateMany({where:{…,...LIVE_ROLE_WHERE}, data: roleDeleteData(…)})`: no `delete`/`deleteMany`, no raw SQL. G3-02 (1b) non-vacuity now requires all three writers. |
| Events post-commit | `org.role.deleted` and `escalation_denied` are emitted after `runInOrgLockTransaction` returns. The unit test checks "once, after commit". The payload is ids, role name and caps (AC-9.5). The ROLE_LOCKED-by-Owner path asserts that the whole `org.*` sink is empty. |

## Regression check of B23/B24 fixed items

- Escape casts into the writers: G3-02 (1b) now also scans `roleDeleteData(`. Clean.
- CI floor: per-file `=14` plus `--min-passed 290` were added, and the local count matches.
- Flag-off 503: I3-44 (delete) gives 503 to `manage_roles` holders and 403 to Staff (MUT-11 order).
- Contract matching server limits: `ROLE_HISTORY_LIMIT_REACHED.details.limit` is the configured value. The OpenAPI wording says "60 per hour per shop" for `roleWrite`, which matches I3-46.
- Every-event assertions: present (see "Events post-commit" in the table above).
- The `pendingTask: "T-003-B25"` row was removed from `ORG_LOCK_REQUIRED_OPERATIONS`, and the regression-pack `pending` entry was removed in the same diff.

## Findings (severity-ranked)

- **[Low] A DB-trigger refusal on the delete path would surface as 500 INTERNAL, not 409 ROLE_IN_USE / 422.**
  Nothing in `apps/api/src` maps `restrict_violation` / `f003_role_in_use` / `f003_role_deleted`.
  Scenario: only reachable if some writer skips the org lock (the design says it cannot). The client would then see
  a 500 instead of an honest 409. The data stays safe either way.
  Recommendation: optional. Either map the SQLSTATE 23001 + message prefix to ROLE_IN_USE (without counts) in the
  exception filter, or document that 500 is the intended "invariant drift" answer and log it as an error.
  Owner: @backend-api.

- **[Low] `role_deleted_rows_high` fires on every delete at or above 80%, not once.** `roles.service.ts` ~L913.
  The unit test name says "once the deleted rows reach 80%". The test asserts the threshold, not single-firing, so
  the name is honest as read. It is still log noise at the cap: up to 100 warns per shop, each limited by `roleWrite`.
  Recommendation: none required. If it matters, log only when crossing (`deletedRows === ceil(0.8*max)`), or keep
  it as is and treat it as a gauge. Owner: @backend-api.

- **[Low/consistency] `tx.invitation.count({ where: { roleId, status:"pending" } })` relies on ORG_PRISMA alone, while the
  sibling membership counts also add `organizationId` explicitly.** `roles.service.ts` ~L849.
  This is correct today: Invitation is an org-scoped model, and the role id was already resolved in-org.
  Recommendation: add `organizationId` for symmetry (belt and braces, matching golden rule 3 as written).
  Owner: @backend-api.

## Strengths (keep these)

- The check order matches arch §1.3 and api-spec §2, and every step is pinned by a unit test (404 before the floor,
  held-role rules before in-use, in-use before the cap, cap before the Owner invariant).
- The capabilities are re-read in the tx (U-API3-02 delete leg) and the decider is shared with PATCH.
- The 0-row `updateMany` gives 404 instead of a silent success.
- G3-04's move from "all live" to "all live + one exact allowance" is a real tightening, and it has a red/green fixture.
- IC-B25 uses `pg_locks` evidence rather than a timing heuristic.

## Questions to route (not guessed)

- @qa: IC3-07 (delete ‖ invite at the app level, both directions) belongs to B26b / `role-db-guards.int.test.ts`.
  Confirm it covers the *delete* direction now that the route exists (accept-first gives ROLE_IN_USE, delete-first
  gives 422).

---

## Fix round 1 (lead, 2026-11-21)

| Finding | Status | Change |
|---|---|---|
| Low 1 — a DB-trigger refusal (`restrict_violation`) would surface as 500, not 409 | carried → T-003-B26b | only reachable from a writer that skips the org lock; B26b owns the trigger concurrency tests (SR-06) — map or document there |
| Low 2 — `role_deleted_rows_high` warns on every delete ≥80% | accepted | log noise only; revisit with observability (architecture §8) |
| Low 3 — pending-invitation count relies on ORG_PRISMA alone | ✅ fixed | explicit `organizationId` in the `where` (unit pin updated) |
| Q — IC3-07 delete‖invite both orderings | carried → T-003-B26b / qa | |

Re-run: api unit 1161 · int `f003-role-delete` 14/14 · typecheck/lint clean.
