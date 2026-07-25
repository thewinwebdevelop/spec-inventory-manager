---
doc: F-000 architecture — monorepo scaffold (schema-only, golden-rule guards, contracts codegen)
owner: "@backend-api"
signoff: approved
---

# F-000 — Architecture (Gate 2)

> Scope contract = [F-000-project-setup.md](../F-000-project-setup.md) §2 (16 AC).
> Golden-rule enforcement mandate = [DECISIONS.md](../../DECISIONS.md) D-002.
> Scope resolutions (auth tables IN, Dart wired-only, write-primitive→F-011,
> object-storage stub) = D-004. Authoritative model = [docs/01-data-model.md](../../01-data-model.md).
> Monorepo layout / connector iface / multi-tenant = [docs/02-architecture.md](../../02-architecture.md) §2/§4/§5.

**This is a schema-only scaffold. No business logic ships in F-000.** Derived
values (`available`, `onHand−reserved`, weighted-average, COGS, entitlement
resolution) are NOT columns and NOT generated — they land in `core-domain`
(F-010+) per the schema-vs-logic rule (spec §2.1). The one legit stored,
non-derived column is `StockMovement.balanceAfter` (audit snapshot per movement).

---

## 1. Prisma-in-`packages/db` strategy

### 1.1 Single schema source

- **One and only one** Prisma schema: `packages/db/prisma/schema.prisma`. No other
  package or app declares a `schema.prisma`. This is the single source of truth for
  the physical data model (satisfies AC5/AC6/AC7 introspection targets).
- Generator output goes to a package-internal path, e.g.
  `generator client { provider = "prisma-client-js"; output = "../src/generated/client" }`,
  so the generated client is versioned as part of `@omnistock/db` rather than
  leaking into a root `node_modules/.prisma` that other packages reach into.
- `packages/db` exports a thin barrel (`packages/db/src/index.ts`) that re-exports
  the generated `PrismaClient`, the model types, and enums. **Consumers import from
  `@omnistock/db` only** — never from a raw generated path. This keeps the physical
  location of the generated client an implementation detail we can move.

### 1.2 How other packages consume the client

- `apps/api` (NestJS) wraps `PrismaClient` in an injectable `PrismaService`
  (`onModuleInit → $connect`, `enableShutdownHooks`). All DB access in the API goes
  through DI, never `new PrismaClient()` scattered around.
- `apps/web` / `apps/back-office` do **not** import `PrismaClient` at all — they talk
  to the API via the generated contracts client (§4). This keeps the DB dependency
  server-side only.
- `packages/core-domain` **must not** import `@omnistock/db` (enforced in §3). It
  operates on plain value objects/interfaces, not Prisma models. Where a pure
  function needs a shape, `core-domain` declares its own interface; the API maps
  Prisma rows → that interface.
- `packages/connectors` may import `@omnistock/db` types for mapping but performs no
  writes in F-000 (write primitive deferred to F-011, D-004).

### 1.3 Migration strategy

- **Authoring:** migrations are generated locally with `prisma migrate dev` and
  committed under `packages/db/prisma/migrations/`. They are checked into git as the
  ordered, immutable history.
- **Apply (CI / any non-dev env):** `prisma migrate deploy` only. Never
  `migrate dev`, never `db push` outside a throwaway local sandbox. `migrate deploy`
  applies exactly the committed migration files, in order, and is idempotent
  (already-applied migrations are skipped). This is what AC4 exercises against an
  empty Postgres.
- **Drift gate (AC4):** after `migrate deploy` from zero, CI runs
  `prisma migrate status` and asserts "Database schema is up to date" / in-sync. Any
  drift (a model change not captured as a migration, or a manual DB edit) makes the
  command report pending/failed → CI red. devops owns wiring this into the pipeline;
  see cross-domain note at the end.
- **Raw-SQL migrations:** the ledger-immutability trigger (§2) is shipped as a
  hand-authored migration (a `.sql` file inside a normal migration folder), because
  triggers are outside Prisma's declarative schema. Prisma still tracks it in
  `_prisma_migrations`, so `migrate deploy`/`status` cover it like any other
  migration — no separate apply step.

---

## 2. Ledger immutability trigger (AC8)

Two-layer defense. **Layer 1 (app guard):** a Prisma client extension / repository
rule that simply has no `update`/`delete`/`updateMany`/`deleteMany` path exposed for
`StockMovement` and `UsageEvent` (the ledger repositories expose `create`/`createMany`

- reads only). This is convenience/fail-fast, **not** the guarantee. **Layer 2 (DB
  trigger, the actual guarantee):** even a raw query, a psql session, or a future buggy
  service physically cannot mutate a ledger row. AC8 tests Layer 2 directly.

### 2.1 Trigger/function SQL design

A single shared trigger function raises on any UPDATE or DELETE; INSERT is never
attached to the trigger, so inserts pass untouched.

```sql
-- migration: packages/db/prisma/migrations/<ts>_ledger_immutability/migration.sql
-- (this .sql lives inside a normal Prisma migration folder; migrate deploy applies it)

CREATE OR REPLACE FUNCTION omnistock_reject_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'ledger is immutable: % on table % is not allowed (append a new row instead)',
    TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

-- StockMovement — reject UPDATE and DELETE; INSERT is intentionally not covered.
DROP TRIGGER IF EXISTS trg_stock_movement_immutable ON "StockMovement";
CREATE TRIGGER trg_stock_movement_immutable
  BEFORE UPDATE OR DELETE ON "StockMovement"
  FOR EACH ROW
  EXECUTE FUNCTION omnistock_reject_ledger_mutation();

-- UsageEvent — same discipline (golden rule 2 applies to usage ledger too, docs/01 §2).
DROP TRIGGER IF EXISTS trg_usage_event_immutable ON "UsageEvent";
CREATE TRIGGER trg_usage_event_immutable
  BEFORE UPDATE OR DELETE ON "UsageEvent"
  FOR EACH ROW
  EXECUTE FUNCTION omnistock_reject_ledger_mutation();
```

Design notes:

- `BEFORE UPDATE OR DELETE` + `FOR EACH ROW`: fires before the mutation commits and
  aborts the statement, so nothing is ever partially applied. TRUNCATE is a separate
  event; if we want to also block it we add a `BEFORE TRUNCATE ... FOR EACH STATEMENT`
  trigger on the same function. **Recommendation: add the TRUNCATE guard too** so the
  ledger cannot be wiped — cheap and closes the obvious bypass. (Flagged for qa's AC8
  test matrix below.)
- `RAISE EXCEPTION` guarantees the whole transaction rolls back — an attacker/buggy
  path cannot swallow it and proceed.
- Table names are quoted (`"StockMovement"`) to match Prisma's default PascalCase
  identifiers. If devops later sets `@@map` to snake_case, the migration SQL must be
  regenerated against the mapped names — noted so the two stay in lockstep.
- The function is idempotent to (re)create (`CREATE OR REPLACE` + `DROP TRIGGER IF
EXISTS`), so re-running the migration on a partially-built DB is safe.

### 2.2 Shipping as a Prisma migration

Because Prisma's declarative `schema.prisma` cannot express triggers, we author a
dedicated migration folder containing the SQL above. Workflow:

1. `prisma migrate dev --create-only --name ledger_immutability` to scaffold an empty
   migration folder, then paste the trigger SQL into its `migration.sql`.
2. Commit the folder. `_prisma_migrations` now tracks it, so `migrate deploy`
   installs it and `migrate status` accounts for it (no drift, satisfies AC4).
3. AC8 negative test runs post-deploy against the real trigger.

---

## 3. core-domain purity enforcement (AC9)

### 3.1 Tool decision — **dependency-cruiser** (not eslint-plugin-boundaries)

Rationale:

- dependency-cruiser resolves the **actual module graph** (including transitive and
  dynamic imports) and runs as its own CLI step, independent of ESLint. That means it
  cannot be silenced by an inline `// eslint-disable` — a hard requirement of AC9
  ("กัน `eslint-disable` ผ่านเงียบ").
- It runs as a standalone CI job (`depcruise`) with its own non-zero exit, so it is
  a first-class **CI-blocking gate**, not one lint rule among many that a repo-wide
  disable could mask.
- It expresses "package X may not depend on Y" as a graph rule, which is exactly the
  boundary we need (`core-domain ↛ prisma/@omnistock/db/@nestjs/*`), and it emits a
  clear violation report naming the offending edge.

eslint-plugin-boundaries is viable but lives inside ESLint, sharing ESLint's disable
surface and config — weaker against the "un-bypassable" requirement. We keep ESLint
for code style; **dependency-cruiser owns the architectural boundary.**

### 3.2 Rule config approach

`packages/config/depcruise/.dependency-cruiser.cjs` (shared, referenced from root):

```js
module.exports = {
  forbidden: [
    {
      name: "core-domain-is-pure",
      comment: "core-domain must stay framework/DB-free (golden rule 6, D-002)",
      severity: "error",
      from: { path: "^packages/core-domain/src" },
      to: {
        path: [
          "^packages/db",
          "node_modules/@prisma/client",
          "node_modules/\\.prisma",
          "node_modules/@nestjs",
          "node_modules/prisma",
          "node_modules/express",
          "node_modules/bullmq",
          "node_modules/ioredis",
        ],
      },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.base.json" },
    tsPreCompilationDeps: true, // catch type-only imports too — a type import still couples
  },
};
```

- `tsPreCompilationDeps: true` catches `import type { PrismaClient } from ...`, so
  even a type-only leak from Prisma into core-domain is a violation.
- The `to.path` list is a denylist of framework/DB/infra packages. It is intentionally
  explicit; adding a new infra dep means consciously deciding whether core-domain may
  see it (answer: almost always no).

### 3.3 CI-blocking and un-bypassable

- Root script `pnpm depcruise` runs `depcruise packages/core-domain --config
packages/config/depcruise/.dependency-cruiser.cjs`. Exit code is non-zero on any
  `severity: error` violation.
- It is a **required status check** on the PR branch protection (devops wires this;
  see cross-domain note). Because it is its own job with its own exit code, a red
  result blocks merge (this is the AC9 half of the AC12 "gate really blocks" proof).
- No `eslint-disable` can affect it (different tool). dependency-cruiser does support
  its own inline `dependency-cruiser-disable` comments — **policy: those are banned in
  `packages/core-domain`**, and we add a second forbidden rule / a grep guard to
  reject the disable pragma inside core-domain so the escape hatch itself is closed.

### 3.4 Negative-test fixture (AC9)

- A fixture file (excluded from normal build, present only for the check) — e.g.
  `packages/core-domain/src/__purity_fixtures__/violation.ts` — contains
  `import { PrismaClient } from '@omnistock/db'`. A CI/unit assertion runs
  dependency-cruiser against it and **asserts a non-zero exit + the
  `core-domain-is-pure` violation is reported**. This proves the guard actually
  fires (a green guard that never catches anything is worthless).
- The fixture must not be imported by real code, so it never affects runtime build;
  it exists solely to be caught. AC10's real pure function (weighted-average /
  `available=min(floor(...))`) lives in normal `src/` with its own unit tests and
  must pass the same purity check clean.

---

## 4. Contracts codegen (AC11)

### 4.1 OpenAPI source location

- Single source spec: `packages/contracts/openapi/openapi.yaml` (hand-authored seed;
  in F-000 it declares `/health` only — enough to prove the codegen pipeline). This
  is the shared seam with frontend/ux going forward.
- Spec validation step: `redocly lint` (or `swagger-cli validate`) runs in CI and
  must pass before any client is generated (AC11 "validate ผ่าน"). A broken spec
  fails the pipeline.

### 4.2 TS client generator — must be typecheck-green

- Generator: `openapi-typescript` (types) + a light typed fetch wrapper, **or**
  `openapi-generator-cli typescript-fetch` — pick one and pin it in `packages/config`.
  Recommendation: `openapi-typescript` for types + `openapi-fetch` runtime, because it
  produces the smallest, fully-typed surface and no heavy runtime.
- Output: `packages/contracts/src/generated/ts/` (committed). Barrel-exported from
  `@omnistock/contracts`.
- **Green requirement (AC11):** the generated TS client is imported from both
  `apps/api` (for e2e/typed handlers) and `apps/web` (for calling `/health`), and
  `turbo typecheck` over those workspaces must pass. If the generated types don't
  compile where imported, CI is red.
- Determinism: `pnpm gen:contracts` regenerates; a CI check re-runs generation and
  fails if the committed output differs (prevents spec/client drift, same spirit as
  the Prisma drift gate).

### 4.3 Dart client — relocated + made green in F-000 (supersedes D-004 deferral, see D-015)

- Generator: `openapi-generator-cli dart-dio` (or `dart`), output to
  **`apps/mobile/api_client/`** (own package, not nested under `apps/mobile/lib/`).
- **Superseded plan:** F-000 originally scoped this as "wired, not green" (deferred to F-006,
  D-004). During the build, nesting the generated client under `apps/mobile/lib/generated/api/`
  produced a language-version conflict with the Flutter shell package that broke `flutter
test`/`build` outright — this had to be fixed immediately rather than deferred (D-015). The fix:
  move the generated client to its own top-level package (`apps/mobile/api_client`), run
  `build_runner` as part of `gen:contracts:dart` and commit the resulting `*.g.dart` files, and pin
  Flutter to `3.27.3` via FVM (`.flutter-version`) since the machine's stock Flutter (2.10.5) was too
  old for the generated dart-dio client.
- **F-000 scope now:** the Dart client is generated, compiles, and its `*.g.dart` companions are
  committed. AC13's Flutter `analyze`/`test` job runs against the shell (the `api_client` package is
  excluded from `flutter analyze`'s scope via `analysis_options`, per its own package boundary, but
  it does build/typecheck as part of `flutter pub get` + `build_runner` in CI).

---

## 5. organizationId scoping seam (F-000 places the seam, not the runtime)

Full runtime org-scoping middleware is **out of scope** (spec §2.4 → F-002/F-003).
F-000's job is to leave the hook in the right place so those features enforce without
re-plumbing.

### 5.1 Where the hook goes

- **Prisma client extension seam:** `packages/db/src/tenancy.ts` exports a factory
  `withOrgScope(prisma, ctx)` that returns a Prisma client extended via
  `$extends({ query: { $allModels: { ... } } })`. In F-000 this is a **pass-through
  stub** — it does not inject `where: { organizationId }` yet, but it is the single,
  named place F-002/F-003 will implement the filter. Feature code that needs a scoped
  client already asks for it here, so turning on enforcement later is a one-file change
  plus tests, not a repo-wide refactor.
- **Request-context seam in the API:** `apps/api` gets an `OrgContext`
  (`AsyncLocalStorage`-backed) provider + a placeholder guard/interceptor that today
  just establishes the context slot. F-002/F-003 fill it (resolve org from
  membership/JWT) and feed it into `withOrgScope`.
- **Back-office exception is respected up front:** per docs/02 §5, the cross-org
  path is deliberately a _separate_ seam (`/admin/...` + super-admin guard), NOT the
  tenant `withOrgScope` extension. F-000 does not build it, but the tenant seam is
  named/narrow enough that back-office won't be tempted to reuse it.

### 5.2 What stub F-000 ships

- `withOrgScope` pass-through factory (typed, unit-tested as pass-through).
- `OrgContext` provider + no-op guard registered but not enforcing.
- A short `packages/db/README` note: "every domain repository must obtain its client
  via `withOrgScope`; F-002/F-003 make it enforce." This is the contract that keeps
  future features from bypassing the seam.

---

## 6. Money/stock typing rule at schema level

Reference: money-stock discipline + golden rule 7. Enforced physically in the schema
and asserted by AC7 introspection.

- **Money = `Decimal` (Prisma) → `numeric` (Postgres). No `Float`, ever.** Applies to
  `SellableSku.basePrice`, `InventoryItem.avgUnitCost`, `StockMovement.unitCost`,
  `ChannelListing.priceOverride`, `ChannelListing.lastSyncedPrice`, `UsageEvent.cost`.
  Use `@db.Decimal(18, 4)` (or org-standard precision) so we never lose satang.
- **Stock / quantity = `Int` (Prisma) → `integer` (Postgres).** Applies to
  `StockLevel.onHand`, `StockLevel.reserved`, `BundleComponent.quantity`,
  `StockMovement.quantity`, `StockMovement.balanceAfter`, `UsageEvent.quantity`.
- **No derived/computed/generated columns for derived values** (schema-vs-logic rule,
  spec §2.1): `available`, `onHand−reserved`, weighted-average `avgUnitCost`, COGS,
  resolved entitlements are all `core-domain` (F-010+), never columns.
- **`StockMovement.balanceAfter` is the sanctioned exception** — it is a stored
  _audit snapshot_ recorded at insert time, not a value the DB recomputes. It stays a
  plain `Int` column (never a Postgres `GENERATED` column), written by the ledger
  write path (F-011). Documented explicitly so a reviewer doesn't "optimize" it into a
  generated column and break the audit trail.

The concrete per-column types are specified in [data-model.md](./data-model.md).

---

## 7. Cross-domain notes to confirm (qa + devops)

Not blockers — F-000's design stands — but these are the seams qa/devops must
confirm when they author their slices:

- **qa (AC5/6/7/8 testability):**
  - AC8 test matrix should assert: `INSERT` succeeds; `UPDATE` throws; `DELETE`
    throws; `updateMany`/`deleteMany` throw; on **both** `StockMovement` and
    `UsageEvent`. Please confirm whether **TRUNCATE** is in-scope for AC8 — I
    recommend adding a TRUNCATE-block trigger (§2.1) and a TRUNCATE negative test.
  - AC6 allowlist assertion (introspect `information_schema.columns` for
    `organizationId`): confirm the allowlist is exactly {User, Channel, PlanDefinition,
    RefreshToken}; I additionally place `Role` and `Invitation` **with** org (see
    data-model) — please confirm that matches your AC6 test's expected set.
  - AC7 type assertion should read `data_type` from `information_schema.columns` and
    assert `numeric` for the money set and `integer` for the stock set enumerated in §6.

- **devops (migration/CI feasibility):**
  - Confirm the pipeline runs `prisma migrate deploy` then `prisma migrate status`
    against an ephemeral empty Postgres (AC4), and that the raw-SQL trigger migration
    applies cleanly in that job.
  - Confirm `depcruise` runs as its **own required, merge-blocking** status check
    (§3.3) separate from ESLint, and that the Flutter job (AC13) treats the generated
    Dart client as wired-not-green (excluded from `analyze` until F-006, §4.3).
  - Confirm the "regen-and-diff" drift checks for both Prisma and contracts codegen
    fit the CI model you're building.
