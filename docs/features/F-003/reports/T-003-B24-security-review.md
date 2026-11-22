## Security review — T-003-B24 ★ `PATCH /orgs/{orgId}/roles/{roleId}` (implementation)

Verdict: **approve** (ready-with-recommendations; nothing above Low)
(advisory — backend-api/user decides adoption)

Scope: the uncommitted B24 diff on `claude/f003-test-loop` (on top of `f4ad164`), with
`apps/mobile/api_client/**` and `.claude/launch.json` excluded. Checked against api-spec §1/§2/§3/§5,
architecture §1.3, §2, §3, §4, §6, §7, §8, §13, SR-F003-13/14/17/19 and test-plan U-API3-01..07,
I3-06..08, I3-14, I3-15, I3-42.

Evidence I ran myself:
- `pnpm --filter api test`: 1118 passed, 374 skipped (int lane, skipped by design), 0 failed
- `pnpm --filter api typecheck` (src + test tsconfig): clean
- `npx vitest run f003-role-update` on `omnistock_ci` with `REQUIRE_INT_LANE=1`: **14/14** passed, which matches the CI floor `f003-role-update=14`
- core-domain `invitation-clamp.test.ts`: 6/6 passed

### Findings (severity-ranked)

- **[Low] The contract is looser than the server on `version` and on "at least one field"**: `packages/contracts/openapi/components/roles.yaml:291-306` (`UpdateRoleRequest`)
  Scenario: the server refuses `version > 2147483647` (`roles.service.ts` `ROLE_VERSION_MAX`) and refuses a body that has neither `name` nor `capabilities`. The schema has only `minimum: 1` and no `maximum`/`anyOf`, so a generated client sees both as valid. The server fails closed (422), so this is drift, not a hole.
  Recommendation: add `maximum: 2147483647` and `anyOf: [{required:[name]},{required:[capabilities]}]` (or `minProperties: 2`). Also consider `name.maxLength: 200` so the raw cap is documented for both create and update. (@backend-api)

- **[Low] After a self-edit, `viewer.*` in the 200 describes the actor's PRE-edit caps**: `apps/api/src/orgs/roles.service.ts` (update, step 4b `viewer`)
  Scenario: the only Admin drops `manage_members` from their own role. The 200 `RoleDetail` can still say `canEdit.allowed = true` for a held-role edit, but the next request would refuse it. Nothing is exposed that the actor could not see when the decision was made, and authority is always re-read in the tx, so this is not a bypass. A client that trusted the returned `viewer` for the next action would show a stale UI. Builder decision 2 (the post-edit caps tripped `roleDetailViewer`'s guard and gave a 500) is the right trade, and it matches the api-spec §4.2b wording "actor caps read in the same tx".
  Recommendation: add one line to the PATCH 200 description: "after editing your own role, re-fetch `GET /orgs/{orgId}/capabilities` before trusting `viewer.*`". @frontend: on a self-edit (AC-3.10 path), refetch capabilities and do not reuse the PATCH body's `viewer`. (@backend-api docs, @frontend)

- **[Low] I3-14 proves less than it could about the Admin leg**: `apps/api/test/f003-role-update.e2e.int.test.ts:423-432`
  Scenario: it asserts `denied.length >= 1` and checks only `denied[0]`. In this harness the Redis provider is not bound (the run logs `rate limit fail-open … redis provider not bound`), so dedupe almost certainly fails open and all 3 attempts emit. The test would still pass if only the first one did. The test name ("escalation_denied role_locked") is honest. It is just weaker than it needs to be.
  Recommendation: assert that EVERY entry has `actorUserId = adm`, `reason = "role_locked"` and `operation = "update_role"`, and that `1 <= length <= 3`. Better still, assert `length === 3` when dedupe is known to be off (or exactly 1 plus a `suppressedCount` when it is on). (@qa)

- **[Info] The int lane does not exercise the `roleWrite` quota on PATCH**: rate limiting fails open in this harness (see above). This was already the case for B23, so it is not reintroduced. Make sure some test that binds Redis covers `429` on PATCH (the guard is shared with POST, so one route-level pin would do). (@qa)

- **[Info] Non-event refusals other than `ROLE_CHANGED` / `requires_manage_members` leave no `role_write_refused` warn**: architecture §7 says `ROLE_EMPTY` / `UNKNOWN_CAPABILITY` / name taken get "log warn พอ". This is the same as create (B23), so it is consistent, not a regression. It is a minor observability gap. (@backend-api, optional)

- **[Info] The clamp issues one `UPDATE` per pending link of the role, and also touches already-expired pending rows**: harmless, because the guard is `expiresAt > new` and the value is per row (`tokenIssuedAt + 24h`). The number of statements is bounded by the per-role pending-invitation count under the org lock. Keep in mind if invitation caps are ever raised a lot.

### Builder decisions: my read

1. **Early `ROLE_LOCKED` via the seam with `next: "unchanged"`, holders 0, acting only on `forbidden` / `role_locked`.** Sound. `decideRoleWrite` returns those two before any rule that depends on `next` or holders (`rbac/role-write.ts` steps 0–1). The full verdict is taken again at step 4 on the validated body and the real holder count, so nothing is skipped. Using the seam is what lets I3-15 / U-API3-01 prove that the Owner invariant stands on its own.
2. **Viewer = in-tx pre-edit caps.** Accepted (see the Low above for the doc/client follow-up).
3. **`affectedActiveMembers` = others + the actor if they hold the role; warn logs for `ROLE_CHANGED` / `requires_manage_members`.** Correct per §7/§8. The log has ids + reason only, with no name or e-mail.
4. **Body: neither field present → field errors on both; `version` must be an int in 1..2³¹−1; `null` is malformed.** Correct and fail-closed. `key` / `isSystem` are never read. The raw name cap (200) is reused through `nameError`, so the B23 L-1 fix is **not** lost on update.
5. **Clamp = one guarded `updateMany` per link, with `expiresAt > new` in `where`.** Correct. The new value is `tokenIssuedAt + 24h` (arch §6 layer 1), it can only shorten, and it runs only when the role goes from not elevated to elevated (both the service and the pure fn check this, and `isElevatedRole` expands caps). Tenant isolation holds: `roleId` has already been proven to belong to this org at step 1, and `Invitation` is in `ORG_SCOPED_MODELS`, so `findMany` / `updateMany` go through `ORG_PRISMA`. Another org's link cannot be reached.
6. **G-12 allowlist for `selfKey`.** Acceptable. The key feeds only the reserved-label naming policy. Authority comes from `decideRoleWrite` on capabilities, and the allowlist entry is file-scoped with a reason.
7. **I3-14 `>= 1` because of dedupe.** Understandable, but it can be tightened (Low above).

### Threat-model trace (checked, holds)

- **No-op / rename-only as an oracle or a bypass (N-1, SR-19).** The no-op is decided at 4b, strictly after `ROLE_EXCEEDS_ACTOR` → `ROLE_HELD_REQUIRES_MANAGE_MEMBERS` → `TARGET_NOT_BELOW_ACTOR`. Rename-only passes `UNCHANGED`, which the decider resolves to the role's own caps, so the held-role rules still apply (U-API3-05 "no-op on a held role → 403/ROLE_HELD", plus the I3-08 control on a real DB). A 200 no-op tells the caller only what `viewer.canEdit` and `GET /roles/{id}` already tell a `manage_roles` holder. It still costs the `roleWrite` quota. Skipping the version check on a no-op hands back only the current `version`, which a GET also gives, so it does not weaken SR-14.
- **Escalation through role edits.** `before ⊆ actor ∧ after ⊆ actor` on every update, and with other holders also `manage_members` and `before ⊊ actor`. Editing your own role (no other holders) can only reduce. Editing your own role while others hold it at your level gives `TARGET_NOT_BELOW_ACTOR`. Raising someone else's role is capped at ⊆ actor, which is the same power as `change_role` on the member route. The Owner role is locked for everyone (and ROLE_LOCKED by a non-Owner leaves an `escalation_denied` event, SR-13). `full_access` → `FULL_ACCESS_RESERVED` (+event).
- **Actor authority from the tx, not the ALS.** `readActor` reads through `tx` after the org lock. A membership that has vanished → `ORG_ACCESS_DENIED`. The floor `manage_roles` and `manage_members` are both from the tx (U-API3-02).
- **Order.** 404 → floor → ROLE_LOCKED → shape → name → caps → exceeds → held → not-below → no-op → Owner invariant → write is exactly api-spec §2. 404 comes before the floor, but scoped to this org and `ORG_PRISMA`, so no cross-tenant id oracle. Another shop's id answers 404 and its row stays unchanged (int test).
- **Version race / lost update.** `updateMany where {id, version, live}` plus `version: {increment: 1}` under the org lock. `count === 0` → `409 ROLE_CHANGED {currentVersion}`, no write, and no event (warn log). Because every Role writer takes the org lock, `role.version` from step 1 really is current.
- **Deadlock / TOCTOU.** Role write: Organization → Role (X) → Invitation (X). Steps 2/4/5 read Membership with no lock, before the Role write, and nothing locks Membership after it (U test "after the Role row is written NOTHING touches Membership"). Admin reset takes User → Membership S → Role S, with no shared resource in reverse order, so the graph stays a DAG. IC-B24 shows on a real DB that the reset queues on `"Role"` and then decides on the NEW caps (with a no-edit control). Member PATCH / accept / revoke are under the same org lock, so the holder count cannot go stale. `assertOwnerRemainsInTx` uses plain reads.
- **Events after commit only.** Refusals leave the tx as values and are emitted or logged after it returns. `org.role.updated` is emitted only on `kind: "updated"`. A rollback (unique violation, LAST_OWNER, busy) emits nothing. The payload has ids, name/caps before/after and counts only (AC-9.5).
- **Info leaks.** `ROLE_EXCEEDS_ACTOR` / `TARGET_NOT_BELOW_ACTOR` / `ROLE_HELD…` / `ROLE_LOCKED` have no details. The excess keys go only into the event. The new Thai messages name no capability key (pinned by a test). `currentVersion` reaches only a caller who passed every authority rule.
- **B23 regressions.** Not reintroduced: the raw name cap is shared via `nameError`. G3-02 leg 1b now covers `roleUpdateData(` (escape-cast fixture, outside-caller fixture, non-vacuity for both writers). Leg 2 shows that a `string[]`, a literal array and an extra `isSystem` do not compile, and that a validated value or `null` does (control). Leg 3 pins `role.updateMany({where, data: roleUpdateData(…)})` as the only Role write in `update`. The CI floor `--require f003-role-update=14` plus `--min-passed 276` is present and matches the local count. Flag-off 503 still goes through `PLANNED_5XX_CODES` at warn, and the PATCH route is in `ROLE_WRITE_ROUTES` (exact-equality test).
- **Golden rules.** No money or stock is touched. The clamp decision is a pure fn in core-domain. Every query is org-scoped (explicit `organizationId` on the holder count, `ORG_PRISMA` elsewhere). Everything is in one tx.

### Strengths (keep these)

- Refusals carried out as values. Events and logs only after the tx resolves.
- The early-seam trick, so the Owner invariant is provably independent of the decider (I3-15 on a real DB, U-API3-01 with every write spied).
- The clamp guard in `where` (LEAST semantics, even against a concurrent move).
- The lock-order barrier test with a control. It shows that the reset waits on Role, not just that the order is correct on paper.
- Stale-version-on-no-op pinned both ways (MUT-18 and its ROLE_CHANGED control).

### Questions to route (not guessed)

- @frontend / @qa: SR-14 (client must re-fetch on `ROLE_CHANGED`, never auto-resubmit) is a client obligation and is not covered by this diff. It needs its own client test when the edit screen is wired.

---

## Fix round 1 (lead, 2026-11-21)

| Finding | Status | Change |
|---|---|---|
| Low 1 — contract looser than the server | ✅ fixed | `UpdateRoleRequest`: `version.maximum 2147483647`, `name.maxLength 200`, `minProperties: 2` (version + at least one field) · `CreateRoleRequest.name.maxLength 200` · regenerated TS + Dart (Dart: doc comments only) · contracts 44 pass |
| Low 2 — `viewer.*` after a self-edit reflects pre-edit caps | carried to W07 | frontend must re-fetch capabilities after editing its own role (note for T-003-W07) |
| Low 3 — I3-14 only checks the first event | ✅ fixed | every `escalation_denied` must be the Admin's `role_locked` on the Owner role |
| Info — no 429 test in int (Redis disconnected in that harness) · no warn log for ROLE_EMPTY etc. · client "re-fetch, never resubmit" test | carried | W07 owns the SR-14 client test |

Re-run: int `f003-role-*` + `openapi-parity` 63/63 · api unit 1118.
