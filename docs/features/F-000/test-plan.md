---
doc: test-plan
owner: "@qa"
signoff: approved
---

# F-000 — Test Plan (Gate 2)

> Verifies: [F-000-project-setup.md](../F-000-project-setup.md) §3 (16 AC — the source of truth
> for "correct"). Grounds against backend-api's [architecture.md](./architecture.md) (trigger,
> depcruise, contracts codegen) and [data-model.md](./data-model.md) (concrete schema). Enforcement
> mandate = [DECISIONS.md](../../DECISIONS.md) D-002; scope resolutions = D-004.
>
> **Rule:** each of the 16 AC maps to at least one concrete pass/fail check — a command + expected
> output, an introspection query with an asserted result set, or a negative test that must fail the
> way we expect. qa owns the verdict; qa does **not** redefine the AC to make a check pass.

---

## 0. Scope boundary of this test plan (read before expecting a check)

F-000 proves **structural enablers only**. This plan asserts that the _scaffolding, schema shapes,
and guardrails_ exist and physically bite. It deliberately does **NOT** assert money/stock
**behavioral** correctness — that matrix belongs to later features and their own test-plans:

| Behavior                                                  | Owner feature           | NOT tested in F-000                      |
| --------------------------------------------------------- | ----------------------- | ---------------------------------------- |
| weighted-average `avgUnitCost` math                       | F-011 (write primitive) | correctness of the running average       |
| `available = min(floor(item.available / qty))` end-to-end | F-010+                  | the runtime projection value             |
| `onHand − reserved` projection maintenance                | F-011                   | that the ledger write updates StockLevel |
| oversell / concurrency / atomic partial-failure           | F-011 / F-002+          | transaction + ledger atomicity           |
| cross-tenant read/write isolation (runtime)               | F-002 / F-003           | that a query is actually org-filtered    |

In F-000 the org-scope path is a **pass-through stub** (architecture §5) — so "isolation works" is
**out of scope here** and must not be silently expected. What F-000 _does_ assert on the money/stock
side is purely structural: the columns have the right SQL type (AC7), the ledger is physically
immutable (AC8), core-domain can hold a _pure_ money/stock function that unit-tests without a DB
(AC10), and every domain table has the `organizationId` seam column (AC6). The AC10 sample function
is validated for its own pure output only — it is not the F-011 production formula.

**Legend:** `[auto]` = automated in F-000's CI/test suite. `[manual]` = executed by a human once
(screen-open, branch-protection UI). Money/stock-touching checks are marked ★.

---

## 1. Build / install (AC1, AC2, AC3)

### AC1 — clean install `[auto]`

- **Check:** from a clean clone (no `node_modules`, no pnpm store cache for this repo), run
  `pnpm install`.
- **Pass:** exit code `0`; lockfile (`pnpm-lock.yaml`) unchanged by the install (a
  `git diff --exit-code pnpm-lock.yaml` after install is clean — proves the lockfile is committed and
  authoritative).
- **Fail:** non-zero exit, or lockfile drift.

### AC2 — `turbo build` covers every workspace `[auto]`

- **Check:** `pnpm turbo build`.
- **Pass:** exit `0`, AND the turbo summary lists **every** workspace
  (`apps/{api,web,mobile,back-office}` + `packages/{core-domain,db,connectors,contracts,config}`) with
  a task result — none silently absent.
- **Assertion (guards "skip mobile เงียบ"):** run `pnpm turbo build --dry-run=json` and assert the
  task set contains a `build` (or explicitly-declared no-op) entry for the mobile workspace. A missing
  mobile entry = **fail**, even if `turbo build` itself exits 0. This is the concrete guard the AC
  demands ("summary shows mobile not silently skipped").
- **Fail:** non-zero exit, or any in-scope workspace missing from the dry-run task graph.

### AC3 — dev runs (api / web / mobile) `[auto]` + `[manual]`

- **api `[auto]`:** boot `apps/api`; `GET /health` → HTTP `200` with body asserting `status: "ok"`
  (exact JSON contract; see AC15 for the redis field). Automated as an e2e/supertest hit.
- **web `[auto]`:** boot `apps/web` dev server; HTTP `GET /` → `200`.
- **mobile `[auto]`:** `flutter analyze` exit `0` (see AC13) AND `flutter build <target> --debug`
  exit `0`.
- **mobile screen-open `[manual]`:** launch the debug build on a simulator and confirm the shell
  screen actually renders. Stated explicitly as **manual** per the AC ("จอเปิดจริง = manual") — this
  step is reported as done/skipped truthfully in the QA run, never auto-claimed.
- **`[auto]` status note (PM decision, final whole-branch review 2026-07-05):** the api `/health`
  200 + web `GET /` 200 + flutter analyze/build checks above are marked `[auto]` in this plan, but
  for F-000 they are **not yet wired as an automated CI job** — they were verified locally with live
  evidence during the F-000 build (see the T-000 progress ledger / PR evidence). CI does run
  `flutter analyze` + `flutter test` (flutter-ci job, AC13) and Node `build`/`typecheck`/`test`/`lint`
  (node-ci job), but there is no supertest-style e2e hit on a _running_ api/web process yet. Adding
  that e2e-in-CI job is deferred to F-001 (see
  [forward-commitments.md](./forward-commitments.md)), once `apps/api` has real endpoints worth
  booting a full e2e smoke against. This does not weaken AC3 for F-000's own gate — it was satisfied
  by manual/local verification — it only clarifies that the automation is not yet a standing CI gate.

---

## 2. Schema — migration & drift (AC4)

### AC4 — deploy-from-zero + no drift `[auto]`

- **Check (against an ephemeral empty Postgres):**
  1. `prisma migrate deploy` — expect exit `0`; expect the raw-SQL ledger-immutability migration
     (architecture §2.2) to apply in the same run without a separate step.
  2. `prisma migrate status` — expect the "up to date / no pending migrations" in-sync result.
- **Drift assertion:** re-run `prisma migrate status` after deploy; any `Following migration(s) have
not yet been applied` / drift report = **fail**. This also catches a schema edit that wasn't
  captured as a migration.
- **Determinism note:** `migrate deploy` (never `migrate dev`/`db push`) is what CI runs — confirmed
  with backend-api architecture §1.3. devops wires the ephemeral-Postgres job (cross-domain, §9).

---

## 3. Schema — introspection (positive) (AC5, AC7)

These read the live schema after `migrate deploy` (via `information_schema` /
`pg_catalog`) — they assert against the physical DB, not against `schema.prisma` text, so a schema
that lies about itself can't pass.

### AC5 — all 19 tables + required @@unique constraints exist `[auto]` ★(schema of money/stock tables)

**5a — table presence.** Query:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
```

- **Pass:** the result set ⊇ these **19** domain tables:
  `User, Organization, Membership, Role, RefreshToken, Invitation, Product, SellableSku,
InventoryItem, BundleComponent, Warehouse, StockLevel, StockMovement, Channel, ChannelAccount,
ChannelListing, PlanDefinition, OrgEntitlement, UsageEvent`.
  (`_prisma_migrations` is expected extra and ignored.)
- **Negative boundary (spec §2.3 — deliberately absent):** assert **none** of
  `Order, OrderItem, PurchaseDocument, PurchaseItem, AccountingDocument, Subscription, Payment` exist.
  Their presence = fail (a reviewer must be able to audit the boundary).

**5b — required @@unique constraints.** For each constraint below, assert a UNIQUE constraint exists
over exactly that column set (introspect `information_schema.table_constraints` joined to
`key_column_usage`, or `pg_index` with `indisunique`):

| Table             | Required unique columns (AC5 / data-model)     |
| ----------------- | ---------------------------------------------- |
| `StockLevel`      | `(warehouseId, inventoryItemId)`               |
| `BundleComponent` | `(sellableSkuId, inventoryItemId)`             |
| `ChannelListing`  | `(channelAccountId, externalSkuId)`            |
| `Membership`      | `(organizationId, userId)`                     |
| `Role`            | `(organizationId, name)`                       |
| `Product`         | `(organizationId, code)`                       |
| `SellableSku`     | `(organizationId, code)`                       |
| `InventoryItem`   | `(organizationId, sku)`                        |
| `ChannelAccount`  | `(organizationId, channelKey, externalShopId)` |
| `OrgEntitlement`  | `(organizationId)`                             |
| `User`            | `(email)` · `Channel`                          | `(key)` · `Invitation` | `(token)` · `PlanDefinition` | `(key)` |

- **Pass:** every listed unique constraint is present with the exact column set (order-insensitive for
  the set membership, but all and only those columns).
- **Fail:** any missing, or column set differs. The first three rows are the AC5-named ones and are
  hard-blocking; the rest are the data-model's declared uniques and are asserted so the schema
  can't quietly drop tenant/idempotency guards.

### AC7 — money = numeric, stock = integer (no float creep) `[auto]` ★

Query `information_schema.columns` for `data_type`:

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public';
```

**7a — money set MUST be `numeric` (the 6 AC7-named, hard gate):**
`SellableSku.basePrice`, `InventoryItem.avgUnitCost`, `StockMovement.unitCost`, `UsageEvent.cost`,
plus `ChannelListing.priceOverride`, `ChannelListing.lastSyncedPrice`.

- **Pass:** `data_type = 'numeric'` for all six. (AC7 spec names the first four; the two
  ChannelListing money cols are added from the data-model's money list so no money column slips
  through as float.)
- Precision sanity: assert `numeric_precision`/`numeric_scale` are set (i.e. `Decimal(18,4)`, not an
  unconstrained numeric) — closes the "satang loss" gap noted in architecture §6.

**7b — stock set MUST be `integer` (the 6 AC7-named, hard gate):**
`StockLevel.onHand`, `StockLevel.reserved`, `BundleComponent.quantity`, `StockMovement.quantity`,
`StockMovement.balanceAfter`, `UsageEvent.quantity`.

- **Pass:** `data_type = 'integer'` for all six.

**7c — no-float sweep (defense in depth):**

- Assert **no** column in any of the 19 domain tables has `data_type IN ('double precision','real')`.
  A single float anywhere in the domain schema = **fail**. This catches a stray `Float` on a column
  neither list names (e.g. a future added quantity/price).
- Also assert the remaining declared `Int` columns are `integer`: `InventoryItem.lowStockThreshold`,
  `ChannelListing.allocationValue`, `ChannelListing.lastSyncedStock`.

---

## 4. Schema — organizationId scoping seam (positive + negative) (AC6)

### AC6 — every domain table carries `organizationId`, with an exact allowlist `[auto]` ★(tenant seam)

- **Confirmed no-org allowlist (with backend-api):** exactly
  **`{ User, Channel, PlanDefinition, RefreshToken }`**. `Role` and `Invitation` DO carry
  `organizationId` (per-org) and are therefore NOT allowlisted.
- **Check (introspection):**

```sql
SELECT t.table_name,
       EXISTS (
         SELECT 1 FROM information_schema.columns c
         WHERE c.table_schema = 'public' AND c.table_name = t.table_name
           AND c.column_name = 'organizationId'
       ) AS has_org
FROM information_schema.tables t
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
  AND t.table_name <> '_prisma_migrations';
```

- **Pass, two-sided:**
  1. Every table **not** in the allowlist has `has_org = true`. Any non-allowlisted table with
     `has_org = false` = **fail** (a domain table missing its tenant column).
  2. Every table **in** the allowlist has `has_org = false`. If an allowlisted table (e.g. `User`)
     _gains_ an `organizationId`, that's a **fail** too — the allowlist is exact, not "at least".
     This guards against silently re-tenanting an org-agnostic identity table.
- **Organization itself:** treated as satisfying the rule via its own `id` (it is the tenant root) —
  asserted as an allowed special case, not counted as a violation for lacking `organizationId`.
- **Explicit expected sets encoded in the test** (so a schema change forces a conscious test update):
  - HAS org: `Organization*(via id), Membership, Role, Invitation, Product, SellableSku,
InventoryItem, BundleComponent, Warehouse, StockLevel, StockMovement, ChannelAccount,
ChannelListing, OrgEntitlement, UsageEvent`.
  - NO org (allowlist): `User, Channel, PlanDefinition, RefreshToken`.

---

## 5. Schema — ledger immutability (negative) (AC8)

### AC8 — StockMovement & UsageEvent are physically append-only `[auto]` ★

Tests **Layer 2** (the DB trigger, architecture §2) directly — via raw SQL / a psql session, NOT
through the app repository, so it proves the DB itself refuses mutation even when Prisma's convenience
guard is bypassed. Seed one row per table first.

For **each** of `StockMovement` and `UsageEvent`:

| Operation                                  | Expected   | Pass condition                                                                                                                   |
| ------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `INSERT` a valid row                       | succeeds   | row count increments; no exception ★                                                                                             |
| `UPDATE ... SET ...` any column            | **throws** | exception raised; `ERRCODE = restrict_violation`; message contains `ledger is immutable`; row **unchanged** (re-select confirms) |
| `DELETE FROM ...`                          | **throws** | exception raised; row still present                                                                                              |
| `UPDATE` via `updateMany` (bulk, app path) | **throws** | Prisma call rejects; no rows mutated                                                                                             |
| `DELETE` via `deleteMany` (bulk, app path) | **throws** | Prisma call rejects; no rows deleted                                                                                             |
| **`TRUNCATE <table>`**                     | **throws** | exception raised; table not emptied                                                                                              |

- **Atomicity assertion:** after each rejected UPDATE/DELETE, re-select the seeded row and assert it
  is byte-identical — proves `BEFORE ... FOR EACH ROW` aborts before any partial write.

**qa call on TRUNCATE (backend-api flagged this):** **TRUNCATE is IN scope for AC8.** Rationale: the
golden rule is "ledger is immutable / append-only" — a wipe is the most destructive mutation, and
without a `BEFORE TRUNCATE` guard the row-level trigger leaves an obvious bypass (one `TRUNCATE` erases
the entire audit trail the immutability rule exists to protect). It is cheap (one statement-level
trigger on the same function, architecture §2.1). **Decision: require the TRUNCATE-block trigger and
the TRUNCATE negative test above.** This is a testability/coverage call (qa's domain); if backend-api
sees a functional reason `TRUNCATE` must remain allowed (none identified), that's a domain-logic
escalation back to them — but the recommendation already came from backend-api, so this is a confirm,
not a conflict.

- **Fail (any of):** an UPDATE/DELETE/updateMany/deleteMany/TRUNCATE that _succeeds_; an INSERT that
  _fails_; or a rejection that leaves the row partially modified.

---

## 6. core-domain purity (negative + positive) (AC9, AC10)

### AC9 — importing Prisma/Nest into core-domain fails CI, un-bypassably `[auto]`

Uses backend-api's **dependency-cruiser** decision (architecture §3) — chosen precisely because it
runs as its own CLI/exit-code and cannot be silenced by `eslint-disable`.

**9a — the guard fires on a real violation (fixture negative test):**

- A fixture `packages/core-domain/src/__purity_fixtures__/violation.ts` contains
  `import { PrismaClient } from '@omnistock/db'` (and a second variant with
  `import type { ... } from '@omnistock/db'` to exercise `tsPreCompilationDeps`).
- **Check:** run `pnpm depcruise` (or the CI `depcruise` job) with the fixture present.
- **Pass:** non-zero exit AND the report names the `core-domain-is-pure` rule on the offending edge.
  A green result here = **fail of the test** (a guard that never catches is worthless).

**9b — the guard is clean on real code:**

- With the fixture **removed/excluded from the graph**, `pnpm depcruise` over `packages/core-domain`
  exits `0`. The AC10 real pure function must pass this clean.

**9c — un-bypassable (guards the escape hatch):**

- Assert `eslint-disable` has **no effect** on the depcruise result: add an `// eslint-disable` above
  the violating import in a fixture and confirm depcruise still reports the violation (different tool,
  different exit).
- Assert the `dependency-cruiser-disable` pragma is **banned inside `packages/core-domain`**: a
  fixture containing that pragma must be rejected by the second forbidden rule / grep guard
  (architecture §3.3). If the pragma silences the check, that's a **fail**.

**9d — CI-blocking:** `depcruise` is a **separate required status check** (not one ESLint rule). That
it blocks merge is proven jointly with AC12 (§7) and confirmed via branch-protection `[manual]`; devops
wires it (§9).

### AC10 — a pure money/stock sample fn with a passing unit test `[auto]` ★

- **Check:** `packages/core-domain/src/` contains at least one **pure** function on a money **or**
  stock path — e.g. a `weightedAverage(prevQty, prevCost, inQty, inCost)` returning a `Decimal`, or a
  `sellableAvailable(components)` computing `min(floor(item.available / qty))` — with a colocated unit
  test.
- **Pass:**
  1. `pnpm turbo test --filter=@omnistock/core-domain` (or equivalent) exits `0` with the sample's
     assertions green.
  2. The test runs **without a DB / without Nest** (proves testability-without-DB — golden rule 6
     dividend) — evidenced by the file passing the AC9 depcruise clean.
  3. **Type discipline asserted in the test:** money assertions use `Decimal` (no JS `number`
     arithmetic on money) and stock assertions are integer — a test that does float math on the money
     path = **fail of the sample's intent**.
- **Scope reminder:** this proves _pure + typed + DB-free_, NOT that the formula is the production
  weighted-average. The behavioral matrix is F-011's test-plan (see §0).

---

## 7. Contracts codegen (AC11)

### AC11 — OpenAPI validates; TS client typechecks from api & web; Dart wired `[auto]`

Grounded in architecture §4.

**11a — spec validates:** `redocly lint` (or `swagger-cli validate`) over
`packages/contracts/openapi/openapi.yaml` exits `0`. A malformed spec = **fail**.

**11b — TS client typecheck-green from BOTH consumers:**

- The generated TS client (`packages/contracts/src/generated/ts/`, exported from `@omnistock/contracts`)
  is imported by `apps/api` and `apps/web`.
- **Check:** `pnpm turbo typecheck --filter=@omnistock/api --filter=@omnistock/web` (plus the
  contracts package) exits `0`. If the generated types don't compile where imported = **fail**.

**11c — codegen determinism (drift):** re-run `pnpm turbo gen:contracts` and assert there is no
uncommitted diff — via a `git status --porcelain` check (not `git diff --exit-code`, which misses
**new/untracked** generated files such as a brand-new endpoint's new Dart model) over
`packages/contracts/src/generated` and `apps/mobile/api_client`. Drift, including newly-generated
untracked files, = **fail** (same spirit as the Prisma drift gate).

**11d — Dart client IS green in F-000 (supersedes D-004 boundary, see D-015):** F-000 originally
scoped the Dart client as "wired, not green" (deferred to F-006, D-004) — this was superseded during
the build (D-015) because the generated client had to be relocated to its own package
(`apps/mobile/api_client`, not nested under `apps/mobile/lib/generated/api/`) to fix a
language-version conflict that broke the Flutter shell's own `test`/`build`. As a side effect of that
fix, the generated client's `build_runner` output (`*.g.dart`) is generated, compiles, and is
committed. Assert: the Dart generation command runs `build_runner` and produces committed `*.g.dart`
companions under `apps/mobile/api_client/`; the AC13 Flutter job continues to scope `flutter analyze`
to the hand-written shell (the generated `api_client` package has its own `analysis_options`
boundary), but the generated client is no longer merely "wired" — it builds green as part of F-000.

---

## 8. CI gate, config & infra (AC12, AC13, AC14, AC15, AC16)

### AC12 — CI blocks a deliberately-broken PR `[auto]` + `[manual]` ★(proves the whole gate has teeth)

- **Check (smoke):** open a PR whose diff intentionally breaks a gate — e.g. a type error in
  `apps/api`, OR the AC9 core-domain violation import, OR a failing core-domain unit test.
- **Pass:**
  1. CI goes **red** on that PR (the relevant required job fails). `[auto]` — observable from the
     CI run.
  2. Merge is **blocked** while red. `[manual]` — confirmed via GitHub branch-protection (required
     checks must pass; no admin-merge shortcut for the smoke). devops owns the branch-protection
     wiring (§9); qa confirms the observed behavior on the smoke PR.
- **Fail:** CI green on a knowingly-broken PR, or a red PR that is still mergeable.
- This is the capstone that makes AC8/AC9/AC11/AC13 _enforced_ rather than advisory.

### AC13 — Flutter analyze + test is a required check `[auto]` + `[manual]`

- **`[auto]`:** a **separate** CI job runs `flutter analyze` (exit 0 over the hand-written shell,
  generated Dart client excluded per 11d) and `flutter test` (exit 0).
- **`[manual]`:** confirm in branch protection that the Flutter job is a **required** status check,
  distinct from the Node CI job (AC12). Not-required = **fail** of AC13 even if the job passes.

### AC14 — env zod schema: negative + positive `[auto]`

- **Negative:** remove a required env var (per `.env.example` / the zod schema), boot the app.
  - **Pass:** process exits **non-zero** AND stderr names the missing var. A silent boot with a
    missing required var = **fail**.
- **Positive:** with a complete `.env` derived from `.env.example`, boot.
  - **Pass:** boot proceeds past env validation (no zod error).
- **Hygiene assertion:** `.env.example` contains no real secret values (placeholder-only) — grep for
  obvious secret shapes; a committed real secret = **fail**.

### AC15 — Redis / BullMQ boot + health probe `[auto]`

- **Check:** with Postgres + Redis up (compose), boot `apps/api`; hit `GET /health`.
- **Pass:** `/health` returns `200` and its body reports Redis/queue connectivity as healthy (e.g.
  `redis: "ok"` / `queue: "ready"`) — proving BullMQ is actually connected to Redis, not just the
  process booting. A `/health` that is 200 while Redis is down = **fail** (the probe must reflect the
  real dependency).
- **Negative (recommended):** with Redis stopped, `/health` reports redis unhealthy (non-ok field or
  degraded status). Confirms the probe isn't hard-coded green.
- **`[auto]` status note (PM decision, final whole-branch review 2026-07-05):** as with AC3, this
  redis/queue probe check is marked `[auto]` here but is **not yet an automated CI job** for F-000 —
  verified locally with live evidence (boot api against compose Postgres+Redis, hit `/health`, stop
  Redis, hit again). Wiring a real e2e-in-CI job that boots the compose stack and asserts this
  probe is deferred to F-001, tracked in
  [forward-commitments.md](./forward-commitments.md).

### AC16 — per-app CLAUDE.md written from the real scaffold `[auto]` (presence) + `[manual]` (content) `[D-001]`

- **`[auto]` presence:** assert `apps/api/CLAUDE.md`, `apps/web/CLAUDE.md`, `apps/mobile/CLAUDE.md`
  each exist and are non-empty. (`apps/back-office/CLAUDE.md` is deliberately deferred to Phase 5 —
  its absence is expected, spec §2.4, not a fail.)
- **`[manual]` content:** a human confirms each describes that app's actual tech stack + folder
  structure (written from the scaffold that F-000 produced, not guessed — D-001). Content accuracy is
  a judgment call, hence manual.

---

## 9. Cross-domain wiring this plan depends on (not qa-owned)

qa **defines** what must be green; qa does **not** wire it. These are stated so the verdict isn't
blocked on ambiguity and devops knows what the gate requires:

- **devops:** ephemeral empty-Postgres job for AC4/AC5/AC6/AC7/AC8; `depcruise`, Node CI, and the
  Flutter job as **separate required, merge-blocking** status checks (AC9/AC12/AC13); Prisma + contracts
  regen-and-diff drift jobs (AC4/AC11c). Branch-protection config is devops'; qa confirms observed
  blocking behavior on the AC12 smoke PR.
- **backend-api:** owns any defect these checks surface in schema/trigger/purity (red loops back to
  them, not to qa "adjusting the AC").

---

## 10. AC → check coverage matrix

| AC   | Check(s)                                                          | Auto / Manual                  | Money/stock ★ |
| ---- | ----------------------------------------------------------------- | ------------------------------ | :-----------: |
| AC1  | §1 install + lockfile clean                                       | auto                           |               |
| AC2  | §1 turbo build + dry-run mobile-not-skipped                       | auto                           |               |
| AC3  | §1 api /health, web 200, flutter analyze+build; screen-open       | auto + manual                  |               |
| AC4  | §2 migrate deploy + status no-drift                               | auto                           |               |
| AC5  | §3 19-table presence + boundary-absent + @@unique set             | auto                           |       ★       |
| AC6  | §4 org-scope two-sided allowlist introspection                    | auto                           |       ★       |
| AC7  | §3 numeric/integer type + no-float sweep + precision              | auto                           |       ★       |
| AC8  | §5 INSERT ok / UPDATE·DELETE·bulk·TRUNCATE throw + unchanged      | auto                           |       ★       |
| AC9  | §6 depcruise fixture fires + clean + un-bypassable                | auto (+manual: required-check) |               |
| AC10 | §6 pure money/stock fn unit test, DB-free, typed                  | auto                           |       ★       |
| AC11 | §7 spec validate + TS typecheck api&web + drift + Dart wired-only | auto                           |               |
| AC12 | §8 broken PR → CI red → merge blocked                             | auto + manual                  |               |
| AC13 | §8 Flutter analyze+test required check                            | auto + manual                  |               |
| AC14 | §8 env zod negative + positive + no-secret                        | auto                           |               |
| AC15 | §8 /health redis+queue probe (+ negative)                         | auto                           |               |
| AC16 | §8 per-app CLAUDE.md presence + content                           | auto + manual                  |               |

**Verdict rule:** F-000 passes its quality gate only when every `[auto]` check is green in CI AND
every `[manual]` check is confirmed-done (not skipped) in the QA run. Any red `[auto]` or unconfirmed
`[manual]` → **fail**, defect routed to the owning agent (schema/trigger/purity → backend-api;
CI/branch-protection/compose → devops), red loops back to Build. qa reports results truthfully —
skipped manual steps are reported as skipped, not assumed passed.

---

## 11. qa confirmations to backend-api (architecture §7 / data-model asks)

1. **AC6 allowlist — CONFIRMED.** Exactly `{ User, Channel, PlanDefinition, RefreshToken }`.
   `Role` and `Invitation` **DO** carry `organizationId` and are **not** allowlisted — matches this
   plan's AC6 expected sets. The AC6 test asserts the allowlist as **exact** (allowlisted tables must
   also _lack_ org).
2. **AC8 TRUNCATE — CONFIRMED IN SCOPE (qa call).** Add the `BEFORE TRUNCATE` statement-level trigger;
   the AC8 matrix requires a TRUNCATE negative test on both `StockMovement` and `UsageEvent`.
   Rationale in §5.
3. **AC7 type sets — CONFIRMED, with a widened safety net.** The 6 numeric + 6 integer columns you
   enumerated are the hard gate (§3 7a/7b). This plan additionally asserts (7c) that **no** domain
   column is `double precision`/`real`, and pins the other declared `Int`/`Decimal` columns
   (`ChannelListing.priceOverride`/`lastSyncedPrice`/`allocationValue`/`lastSyncedStock`,
   `InventoryItem.lowStockThreshold`) — so no money/stock column outside the named six can leak as a
   float. No conflict with your enumeration; strictly a superset guard.
