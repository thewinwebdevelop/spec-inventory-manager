## Security review — T-003-B23 ★ `POST /orgs/{orgId}/roles` (implementation)

Verdict: **approve with fixes** (ready-with-recommendations; one must-fix is a merge-process gate, not a code hole)
(advisory — backend-api/user decides adoption)

Reviewed: uncommitted diff on `claude/f003-test-loop` under `apps/api/**`, `packages/{core-domain,db,contracts}/**`, `docs/features/F-003/tasks.md`.
Against: api-spec §1/§2/§5/§7, architecture §1.3/§2/§3/§7/§12/§13/§14, security-review SR-F003-01..19, test-plan rows listed in the brief.

Evidence I ran myself (2026-11-21):
- `pnpm --filter api test` → 78 files pass / 21 skipped, 1063 tests pass (G3-02 compiler legs, G3-03, MUT-11 order, DV01 unit, U-API3-01/02 included).
- int lane `npx vitest run f003-role-create` (omnistock_ci DB + Redis :56379) → 18/18 pass, including the real-Redis order test (flag-off does not use up quota; flag-on → 429 + Retry-After), I3-44/45, MUT-07 on a real DB, G3-01 decider/assert spy.

No Critical or High findings. The authz chain, tenant scoping, TOCTOU handling and mass-assignment resistance all hold up when I traced them in the code.

---

### Findings (severity-ranked)

- **[Medium] (MUST-FIX before merge) The new int file has no CI floor (R3-08 not done)** — `.github/workflows/ci.yml` (no `--require "test/f003-role-create.e2e.int.test.ts=…"`); builder note in `docs/features/F-003/tasks.md:62`
  Scenario: the int lane skips this file (env gate, rename, `d = describe.skip` path when `REQUIRE_INT_LANE` is unset in one job) and CI is still green. Every ★ runtime claim of this task — I3-44 (non-holders get 403, not 503), the capability → flag → rate-limit order with real Redis, MUT-07 on a real DB, the G3-01 spy — then has no proof on the deployed commit. architecture §14 says plainly that a role-write route may not merge unless CI really ran these suites ("ตรวจจำนวนเทสต์ที่รันใน log"), and flag-open condition 3 depends on it. This is the "green locally ≠ tested" failure the project has already hit once.
  Recommendation: add `--require "test/f003-role-create.e2e.int.test.ts=18"` and raise the int `--min-passed` total in the same PR, or in a PR merged first. Confirm in the CI log that the 18 cases ran. (Owner: @backend-api + @devops, since ci.yml has someone else's uncommitted edits, so coordinate.) Also run oasdiff in CI; it was not run locally.

- **[Low] Unbounded `name` is normalised while the org lock is held** — `apps/api/src/orgs/roles.service.ts:86` (shape check) → `validateRoleName` at step 4
  Scenario: a `manage_roles` holder sends `name` at about 100 KB (the express default body cap). NFC, the Cc/Cf regex and whitespace collapse all run inside `runInOrgLockTransaction`, so every other org write waits behind them. The cost is milliseconds, and the 60/h `roleWrite` quota caps it, so this is not a real DoS. It is still work done under the lock that a cheap bound would refuse first.
  Recommendation: in `parseCreateRoleBody`, reject `name.length > ~200` UTF-16 units as `VALIDATION_FAILED fieldErrors.name`. This keeps the spec order (it is still the "body shape" step) and matches api-spec §7, which bounds every other DTO field. (@backend-api)

- **[Low] G3-02 leg 1 only catches the literal brand cast** — `apps/api/test/static-gates/g3-02-validated-capabilities.test.ts:38`
  Scenario: `roleCreateData({ ...x, capabilities: raw as never })`, `… as any`, or `({…} as unknown as RoleCreateDataInput)` gets a raw list past the brand. Leg 1 stays green, and leg 3 (`data: roleCreateData(`) stays green too. Defence in depth still holds: core-domain `looksValidated` refuses non-frozen or non-canonical lists in `decideRoleWrite` (but only on the value passed to the decider), and the DB trigger refuses `full_access`/`isSystem` (I3-16).
  Recommendation: extend leg 1 to flag `as never` / `as any` / `as unknown as RoleCreateDataInput` inside the argument of `roleCreateData(`. Or make leg 3 assert that the `capabilities:` argument is the same identifier passed to `this.decide({ next: … })`. Add one red fixture line per shape. (@qa / @backend-api)

- **[Low] DV01 comments overclaim "nothing reads process.env again"** — `apps/api/src/common/boot-env.ts:9`, `app.module.ts:19`
  Scenario: `auth/auth.module.ts:33,55,62`, `tenancy/tenancy.module.ts:66` (JWT access secret), `health/health.module.ts:16` and `ORG_RATE_LIMITS` (live getters, `org-rate-limit.guard.ts:101`) all still read `process.env`. Security-wise this is harmless: process.env is not attacker-controlled, and the values cannot drift from boot in practice. But a future reviewer will read the comment as a guarantee and may rely on it, for example when adding a kill switch whose value is supposed to be fixed at boot. This is the "test/comment name overclaims" pattern.
  Recommendation: reword to "every org-config provider and the role-write flag read the snapshot; auth/JWT/health and the rate-limit numbers (deliberately live, U-CFG3-03) still read process.env". Optionally list the remaining readers as follow-up. (@backend-api)

- **[Low] Flag-off answers are logged at ERROR with a stack and count as 5xx** — `apps/api/src/common/domain-exception.filter.ts:249-251` with `ROLE_WRITES_DISABLED` = 503
  Scenario: during the rollout window, every `manage_roles` holder who reaches the route (a stale client, or a direct API call) produces an ERROR log line plus a 5xx sample. 5xx-rate alerts or SLO burn can then page someone, or hide real 5xx, during exactly the window where rollout health matters. 503 without `Retry-After` is also an invitation to a client retry loop.
  Recommendation: either log the 503 for this code at `warn`, or tell @devops to exclude `code=ROLE_WRITES_DISABLED` from 5xx alerting during rollout. Consider `Retry-After` (for example 3600). The contract change is @backend-api's call.

- **[Info] `JsonOnlyGuard` runs after the rate limiter** — `apps/api/src/orgs/roles.controller.ts:67`
  A `manage_roles` holder's non-JSON POSTs use up the shared shop quota before getting 415. The same is true on every other org write (handler-level guard), and only an insider with the capability can trigger it. No change is needed for B23. Note it for consistency if the guard chain is ever reorganised.

- **[Info] One `manage_roles` holder can use up the whole shop's `roleWrite` quota (60/h, keyed `o:{orgId}`)** — by design (architecture §10). It is an insider-only, bounded denial of role editing for other admins. Accepted by spec; recorded so it is a known, not a surprise.

- **[Info] Placeholder Thai messages (deviation 7)** — `apps/api/src/common/error-codes.ts`. I checked all six: none names a capability key or echoes input (AC-6.4 holds). Wording is @ux's call.

---

### Builder deviations — my read

1. **Global flag guard between CapabilityGuard and OrgRateLimitGuard** — sound, and arguably better than per-handler (a handler `@UseGuards` would run after the limiter). Proven three ways: static provider order (`role-write.test.ts:156`, MUT-11), I3-44 (STF/MM get 403 FORBIDDEN, never 503), and the real-Redis order test (three flag-off 503s leave the 1-request quota untouched). The guard is closed on `undefined`/non-boolean. The only APP_GUARDs in the app are the four in TenancyModule, so cross-module ordering is not a concern today. **Accept.**
2. **DV01 widened (`AppModule.forRoot(env)` + `BootEnvModule`)** — correct. One token feeds both the 503 and `writes_disabled` verdicts, so they cannot disagree. I3-45 and the DV01 unit tests prove that changing process.env after boot has no effect. Rate-limit numbers staying live is deliberate (U-CFG3-03) and not a security issue. **Accept; fix the comment (Low above).**
3. **Shape validation in the service after the in-tx floor** — I tried to abuse it and could not. The body is never spread: only `name`/`capabilities` are read, and the row comes solely from `roleCreateData`, which hard-codes `key:null`, `isSystem:false` and never takes `version`. I3-01 sends `key:"owner", isSystem:true, version:7` and checks the DB row. `@Body() body: unknown` means ValidationPipe does not validate it (metatype Object/undefined). That is harmless because nothing downstream trusts unparsed fields. Arrays are bounded at 64×64. `__proto__` keys from JSON.parse are own properties and never merged. The only gap is the unbounded `name` (Low above). **Accept.**
4. **201 built inside the same tx with actor caps re-read in tx** — correct, and better than reading the ALS snapshot (`viewer.*` cannot claim more than the actor holds now). `getDetail(…, { client: tx })` reads only through the ORG_PRISMA tx, so it stays tenant-scoped. The cost is a few extra reads under the lock, which is acceptable. **Accept.**
5. **`role_create` Owner-invariant shape** — the pure function changes nobody's capabilities and fails closed on an org with 0 active Owners (MUT-07 int: 409 LAST_OWNER, no row, `role_invariant_violation` error log with `roleId:null`). The `never` exhaustiveness default in `capabilitiesAfterChange` is kept. **Accept.**
6. **G3-02 excludes provisioning; provisioning stays on the G3-03 allowlist** — correct. The Owner blueprint holds `full_access` and cannot be `ValidatedCapabilities`. G3-03 checks that provisioning still reads `SYSTEM_ROLE_BLUEPRINT` and that the allowlist has exactly two writers (non-vacuity runs both ways). **Accept.**
7. **Placeholder Thai messages** — no leak (Info above).

### Threat-model trace (what I checked and found holding)

- **Order (api-spec §2):** guard `manage_roles` → flag → `roleWrite` → org lock → in-tx floor (`hasCapability` on caps re-read through `tx`) → shape → name → ROLE_EMPTY → FULL_ACCESS_RESERVED → UNKNOWN_CAPABILITY → ⊆ (`ROLE_WRITE_DECIDER`) → ROLE_LIMIT_REACHED → `assertOwnerRemainsInTx` → write → unique → ROLE_NAME_TAKEN. This matches the spec line for line (`roles.service.ts:220-333`), and U-API3-01/02 plus "fixed order" unit tests pin it.
- **Escalation / full_access:** `validateRoleCapabilities` refuses `full_access` for everyone, the Owner included, and emits the event as the spec requires. Tier `full` and non-selectable keys collapse into the same `UNKNOWN_CAPABILITY` as bogus keys, so there is no oracle for hidden tier-`full` keys. ⊆ is computed on expanded caps from the tx read. `ROLE_EXCEEDS_ACTOR` has no `details`, and the excess goes only to the event (AC-6.4, I3-01 int asserts `details` is undefined).
- **TOCTOU:** the actor's membership and role caps are re-read under the Organization FOR UPDATE lock. A vanished membership gives ORG_ACCESS_DENIED rather than `[]`. Name and live-role-count checks are serialised by the same lock, and a P2002 race is caught after rollback. The barrier test (IC3-03) is correctly tracked as pending in B26b in the regression pack.
- **Tenant isolation:** every read and write goes through the ORG_PRISMA `tx`. `organizationId` comes from the ALS context, never from the body. `X-Organization-Id` mismatch gives 422 and outsiders get 403 ORG_ACCESS_DENIED (int-tested). The rate-limit bucket is a cuid (case-sensitive text), so it cannot be dodged by changing case.
- **Events:** refusals with an event leave the tx as a value. `emitEscalationDenied` runs after commit, has its own try/catch (dedupe failure does not replace the refusal), and is followed by a rethrow. `org.role.created` fires after commit with ids, name and caps only.
- **Gates non-vacuous:** G3-01 checks set-equality both ways with red cases (unit), plus the live router and spy (int). G3-02 has a compiler CONTROL that compiles, three negative probes and a red fixture. G3-03 has a self-check of the G-15 shapes, a red fixture and stale-entry checks. Test names match their assertions. I found no overclaim beyond the DV01 comment.

### Strengths (keep these)
- One decorator (`@RoleWrite()`) attaches both the flag marker and the shared quota, so neither can be forgotten alone. The literal `ROLE_WRITE_ROUTES` table is audited both directions.
- The flag guard fails closed on anything other than a literal `true`.
- The `ValidatedCapabilities` brand is checked with the real TypeScript compiler, including a passing control. That is the right kind of proof for a type-level guarantee.
- Refusal-as-value plus post-commit emission is a clean answer to "event inside a tx that may roll back".
- `roleCreateData` is a tiny writer with core-domain as its only import. Mass assignment is impossible by construction, not by a whitelist setting.
- The real-Redis order test is exactly the behavioural proof MUT-11 needs, beyond the static order check.

### Questions to route (not guessed)
- @devops: should 5xx alerting exclude `ROLE_WRITES_DISABLED` during rollout, or should backend downgrade its log level? (Low above.)
- @backend-api/@devops: who lands the R3-08 CI floor, given ci.yml currently has another agent's uncommitted edits? This blocks merge per architecture §14.

---

## Fix round 1 (lead, 2026-11-21)

| Finding | Status | Change |
|---|---|---|
| **Medium (must-fix)** — no CI floor for `f003-role-create` (R3-08) | ✅ fixed | `ci.yml` integration-api guard: `--require test/f003-role-create.e2e.int.test.ts=18` + `test/f003-role-reads.e2e.int.test.ts=13` (it had none either) · `--min-passed 231 → 262`. **Still to verify: the CI log of the PR shows both files ran.** oasdiff likewise runs in CI only (local Docker pull failed). |
| Low — unbounded `name` normalised under the lock | ✅ fixed | `ROLE_NAME_RAW_MAX_LENGTH = 200` in `parseCreateRoleBody` → `VALIDATION_FAILED fieldErrors.name` at the shape step (order unchanged). Test red → green. |
| Low — G3-02 sees only the literal brand cast | ✅ fixed | leg 1b: `roleCreateData(` callable only from `roles.service.ts`; `as never / as any / as unknown` in its argument = red · new fixture `g3-02-escape-cast.fixture` + non-vacuity. |
| Low — DV01 comment overclaims | ✅ fixed | `boot-env.ts` now lists the readers that still use `process.env`. |
| Low — flag-off 503 logged at ERROR | ✅ fixed | `DomainExceptionFilter`: `ROLE_WRITES_DISABLED` logs at warn without stack; other 5xx unchanged. Test red → green. |
| Info — one holder can spend the shop's `roleWrite` quota | accepted (by design, arch §10) | — |

Re-run after fixes: api unit 1068 pass · typecheck/lint clean · int `f003-role-create` 18/18 on real DB.
