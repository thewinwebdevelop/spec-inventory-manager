---
doc: infra
owner: "@devops"
signoff: approved
---

# F-000 — Infra / Tooling (Gate 2)

> Scope contract = [F-000-project-setup.md](../F-000-project-setup.md) §2/§3 (16 AC).
> Schema/trigger/contracts design this pipeline must run =
> [architecture.md](./architecture.md) + [data-model.md](./data-model.md) (@backend-api).
> Stack = [docs/02-architecture.md](../../02-architecture.md) §1. Pre-commit hooks
> mandate = [docs/DECISIONS.md](../../DECISIONS.md) D-004.

**This doc is the HOW.** It does not redesign schema, triggers, or contracts —
those are backend-api's (Gate 2, already written). It wires them into a pipeline
that makes every infra-facing AC (1-4, 9, 11-16) mechanically checkable, and
confirms the assumptions backend-api's architecture.md made about devops's job
(§7 cross-domain notes).

---

## 1. Turborepo pipeline (`turbo.json`)

### 1.1 Task graph

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build", "db:generate"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "db:generate": {
      "inputs": ["prisma/schema.prisma"],
      "outputs": ["src/generated/client/**"],
      "cache": true
    },
    "lint": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^build", "db:generate", "gen:contracts"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "gen:contracts": {
      "inputs": ["openapi/openapi.yaml"],
      "outputs": ["src/generated/ts/**", "../../apps/mobile/api_client/**"],
      "cache": true
    },
    "depcruise": {
      "dependsOn": ["^build"],
      "outputs": []
    }
  }
}
```

Design notes:

- `db:generate` (Prisma client generation) and `gen:contracts` (OpenAPI codegen) are
  named tasks, not hidden inside `build`, so both are independently cacheable and
  independently re-runnable in the "regen-and-diff" drift checks (§3).
- `build`/`typecheck` depend on `^build` (topological — a workspace only builds
  after its internal deps) **and** on `db:generate`/`gen:contracts` so a schema or
  spec change invalidates the right downstream caches without a manual `clean`.
- `mobile` (Flutter) is a Turborepo workspace member for graph/caching purposes
  only — its `build`/`lint`/`test` tasks shell out to `flutter` (§7 flags the
  cost/tradeoff). This is what makes AC2 ("covers all workspaces, doesn't skip
  mobile silently") real: `turbo build` must show `apps/mobile#build` in its
  summary, not silently prune it.
- No task has `"cache": false` by default — Turborepo's content-hash caching
  (inputs → outputs) is on for everything except tasks with real side effects
  (there are none in F-000's task set; `dev` is excluded from this table entirely
  since it's long-running/non-cacheable by definition).

### 1.2 Caching — local now, remote later

- **Now (F-000):** local filesystem cache only (`.turbo/`, gitignored). No remote
  cache token/config shipped in F-000 — nothing to misconfigure or leak.
- **Later:** Vercel Remote Cache or self-hosted `turborepo-remote-cache` once CI
  minutes matter (Phase 1+). Wiring point is `turbo.json`'s `remoteCache` field +
  a `TURBO_TOKEN`/`TURBO_TEAM` env pair — deferred, not designed here, so it isn't
  scope creep on F-000.
- **AC2 proof:** CI step asserts `turbo build --dry=json` lists all expected
  workspace package names (`@omnistock/{core-domain,db,connectors,contracts,config}`,
  `api`, `web`, `mobile`, `back-office`) before running the real build — a
  workspace silently missing from the graph fails CI rather than passing quietly.

---

## 2. CI (GitHub Actions)

Chosen over alternatives (CircleCI/GitLab CI) because the repo already lives on
GitHub-shaped tooling assumptions (PR-based gates, branch protection) and needs
no extra vendor. No reason found to deviate.

### 2.1 Job map

| Job               | Triggers on                                               | Blocks merge    | Purpose                                                                                          |
| ----------------- | --------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------ |
| `node-ci`         | PR, push to main                                          | yes (required)  | pnpm install, lint, typecheck, test (Node workspaces)                                            |
| `db-migrate`      | PR, push to main                                          | yes (required)  | ephemeral Postgres, `migrate deploy` + `migrate status` drift gate, negative ledger trigger test |
| `depcruise`       | PR, push to main                                          | yes (required)  | core-domain purity, standalone from ESLint                                                       |
| `flutter-ci`      | PR, push to main                                          | yes (required)  | `flutter analyze` + `flutter test` (mobile shell only, §6.2)                                     |
| `contracts-drift` | PR, push to main                                          | yes (required)  | regen-and-diff for Prisma client + TS/Dart contracts clients                                     |
| `ci-smoke`        | manual/scheduled, on a deliberately-broken fixture branch | n/a (proof job) | AC12 evidence — see §5                                                                           |

Each is a **separate GitHub Actions job** (not steps inside one job), each with
its own required-status-check entry in branch protection. This satisfies
backend-api's ask (architecture.md §3.3/§7): depcruise is not a step nested
inside `node-ci` where a green `node-ci` could mask a red depcruise — it is its
own top-level job with its own pass/fail, and its own branch-protection entry.

### 2.2 `node-ci` job

```yaml
node-ci:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version-file: ".nvmrc"
    - uses: pnpm/action-setup@v4 # version resolved from packageManager field
    - run: pnpm install --frozen-lockfile
    - run: pnpm turbo lint typecheck test --filter='!./apps/mobile'
```

- `--filter='!./apps/mobile'` excludes the Flutter workspace from this job —
  mobile has its own job (§2.4) because `flutter analyze`/`flutter test` need the
  Flutter SDK, not Node, and mixing them into one job would make one failure mode
  obscure the other (violates "Flutter CI job แยก" AC13 intent even before
  considering required-check wiring).
- `--frozen-lockfile` — CI never mutates the lockfile; a lockfile drift (someone
  forgot to commit `pnpm-lock.yaml` after adding a dep) fails fast here rather
  than silently reinstalling something different than what's committed.

### 2.3 `db-migrate` job (AC4, AC8)

```yaml
db-migrate:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:16
      env:
        POSTGRES_USER: omnistock
        POSTGRES_PASSWORD: omnistock
        POSTGRES_DB: omnistock_ci
      ports: ["5432:5432"]
      options: >-
        --health-cmd pg_isready
        --health-interval 5s
        --health-timeout 5s
        --health-retries 10
  env:
    DATABASE_URL: postgresql://omnistock:omnistock@localhost:5432/omnistock_ci
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version-file: ".nvmrc" }
    - uses: pnpm/action-setup@v4
    - run: pnpm install --frozen-lockfile
    - name: migrate deploy (from zero, incl. ledger-trigger migration)
      run: pnpm --filter @omnistock/db exec prisma migrate deploy
    - name: drift gate — assert no pending/failed migrations
      run: pnpm --filter @omnistock/db exec prisma migrate status
    - name: ledger immutability negative test (AC8)
      run: pnpm --filter @omnistock/db test:ledger-trigger
```

- Postgres is a GitHub Actions **service container** — fresh/empty for every run,
  which is exactly what AC4 needs ("`prisma migrate deploy` จาก 0 ... บน Postgres
  เปล่า"). No seed data, no prior migrations.
- `migrate deploy` applies every committed migration in
  `packages/db/prisma/migrations/` in order — **including** backend-api's
  hand-authored ledger-trigger `.sql` migration (architecture.md §2.2). Because
  it's tracked in `_prisma_migrations` like any other migration, it needs no
  separate apply step; `migrate deploy` alone covers it. **Confirmed** (§8).
- `prisma migrate status` after deploy is the drift gate: any model change not
  captured as a migration, or the schema not matching migration history, makes
  this command exit non-zero / report pending — CI goes red. This is the whole
  of AC4's second half.
- `test:ledger-trigger` is a small script/test (qa authors the assertion matrix
  per architecture.md §7; devops wires it to run in this job post-deploy) that
  connects to the same ephemeral Postgres and asserts: `INSERT` succeeds,
  `UPDATE`/`DELETE`/`updateMany`/`deleteMany` all throw, on both `StockMovement`
  and `UsageEvent`. If qa/backend-api decide TRUNCATE is in scope (architecture.md
  §7 flags this to qa), the same job covers it — no separate infra needed, it's
  just another assertion in the same script against the same live trigger.

### 2.4 `flutter-ci` job (AC13)

```yaml
flutter-ci:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: subosito/flutter-action@v2
      with:
        flutter-version-file: "apps/mobile/.flutter-version"
        channel: "stable"
    - run: flutter pub get
      working-directory: apps/mobile
    - run: flutter analyze
      working-directory: apps/mobile
    - run: flutter test
      working-directory: apps/mobile
```

- Own job, own required-check entry — satisfies AC13 literally ("Flutter analyze
  - test เป็น required check ... แยกจาก AC12").
- Pinned via `apps/mobile/.flutter-version` (§6), read by
  `subosito/flutter-action`, mirroring how `.nvmrc` pins Node.
- **Generated Dart client scope (confirms architecture.md §4.3):** F-000's
  `flutter analyze`/`flutter test` run over the hand-written Flutter shell only.
  The generated client is a sibling package at `apps/mobile/api_client/` (moved
  out of `lib/` during the T-000-09 build: a Dart package nested inside another
  package's `lib/` makes the CFE resolve its built_value library files and their
  `.g.dart` parts at different language versions, breaking `flutter test`/`build`).
  It is either (a) excluded
  from `analyze` via `analysis_options.yaml`'s `exclude:` globs, or (b) present
  but the job does not fail on its analyzer warnings until F-006 turns it green.
  Chosen approach: **(a) exclude via analysis_options.yaml**, because a silent
  "allowed to fail" step defeats the purpose of a required check — an excluded
  path is auditable (one line in `analysis_options.yaml`, visibly says "not yet
  covered, see F-006") whereas an allow-failure step invites bit-rot nobody
  notices. `flutter test` correspondingly has no test files under the generated
  path in F-000 (there's nothing hand-written to test there yet).

### 2.5 `depcruise` job (AC9)

```yaml
depcruise:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version-file: ".nvmrc" }
    - uses: pnpm/action-setup@v4
    - run: pnpm install --frozen-lockfile
    - run: pnpm turbo build --filter=@omnistock/core-domain # tsPreCompilationDeps needs built types
    - name: depcruise — core-domain purity
      run: pnpm depcruise packages/core-domain --config packages/config/depcruise/.dependency-cruiser.cjs
    - name: negative fixture proof (AC9)
      run: pnpm depcruise:assert-fixture-fails
```

- Standalone job per backend-api's ask (architecture.md §3.3) — different tool,
  different job, different required-check entry from ESLint; an `eslint-disable`
  anywhere cannot touch this job's outcome.
- `depcruise:assert-fixture-fails` is a thin wrapper script: runs depcruise
  against `packages/core-domain/src/__purity_fixtures__/violation.ts` and asserts
  **non-zero exit + `core-domain-is-pure` in the report**. If the guard ever stops
  catching the fixture (e.g., someone loosens the rule), this step itself goes
  red — proving the guard is live, not decorative (per architecture.md §3.4).
- The fixture directory is excluded from the app `build`/`typecheck` tasks
  (tsconfig `exclude`) so it never affects the real build, but is not excluded
  from the depcruise invocation used by this proof step.

### 2.6 `contracts-drift` job (Prisma + OpenAPI regen-diff)

```yaml
contracts-drift:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version-file: ".nvmrc" }
    - uses: pnpm/action-setup@v4
    - run: pnpm install --frozen-lockfile
    - name: regenerate Prisma client
      run: pnpm --filter @omnistock/db exec prisma generate
    - name: regenerate TS + Dart contracts clients
      run: pnpm turbo gen:contracts
    - name: fail on uncommitted diff
      run: |
        git diff --exit-code -- packages/db/src/generated \
                                packages/contracts/src/generated \
                                apps/mobile/api_client \
          || (echo "::error::generated client(s) are stale — run gen commands and commit the diff" && exit 1)
    - name: OpenAPI spec validation (AC11)
      run: pnpm --filter @omnistock/contracts exec redocly lint openapi/openapi.yaml
    - name: TS client typecheck-green (AC11)
      run: pnpm turbo typecheck --filter=api --filter=web
```

- One job covers both drift checks backend-api asked about (architecture.md
  §4.2's Prisma-client-drift spirit + §4.2's contracts regen-diff) — same
  mechanism (`git diff --exit-code` after a clean regen), so no reason to split
  into two jobs.
- Committing generated output (Prisma client under `packages/db/src/generated`,
  TS/Dart clients under their respective paths) is a deliberate choice
  (architecture.md §1.1/§4.2 already assume this) — it means normal `pnpm install`
  - `turbo build` works without a generation step for anyone who isn't touching
    schema/spec, at the cost of this drift job existing to catch staleness.
- `redocly lint` failing here is what makes AC11's "validate ผ่าน" a gate rather
  than a suggestion.
- The Dart client output path is included in the diff check (it must match what
  the generator produces even though it isn't analyzer-green yet, §2.4) — drift
  detection and "green" are separate concerns; we still want the committed Dart
  source to be exactly what codegen produces today.

### 2.7 Branch protection (required checks)

`node-ci`, `db-migrate`, `depcruise`, `flutter-ci`, `contracts-drift` are all
added as required status checks on the default branch's protection rule. `main`
disallows direct pushes; merge requires all five green. This is the concrete
mechanism behind AC12/AC13/AC9's "required check" language.

---

## 3. DB in CI — summary

Already detailed in §2.3; cross-referenced here because AC4/AC5/AC6/AC7/AC8 are
all exercised against the **same** ephemeral Postgres instance in the same job,
in this order: `migrate deploy` → `migrate status` (AC4) → introspection queries
against `information_schema` for table/column/constraint/type shape (AC5/6/7,
qa-authored assertions, devops runs them in `db-migrate`) → ledger trigger
negative test (AC8). Running them in one job against one ephemeral DB (rather
than spinning up Postgres per-AC) keeps the job graph simple and keeps the
"empty Postgres → fully migrated → introspectable → trigger-armed" causal chain
in one place.

---

## 4. Docker dev environment

`docker-compose.yml` (repo root):

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: omnistock
      POSTGRES_PASSWORD: omnistock
      POSTGRES_DB: omnistock_dev
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U omnistock -d omnistock_dev"]
      interval: 5s
      timeout: 5s
      retries: 10
  redis:
    image: redis:7
    ports: ["6379:6379"]
    volumes: ["redisdata:/data"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  pgdata:
  redisdata:
```

> Healthchecks added during the T-000-02 build to match the CI `db-migrate`
> job's service-container healthcheck pattern (§2.3), so `pnpm dev` waits for
> Postgres/Redis to be ready before `migrate deploy` / `turbo dev`.

- `pnpm dev` (documented root script) is: `docker compose up -d` →
  `pnpm --filter @omnistock/db exec prisma migrate deploy` → `turbo dev`. This is
  the local path AC4 ("Postgres เปล่า") and AC15 (Redis/BullMQ boot) run against
  outside CI — same migration command as CI, different Postgres instance, so
  dev/CI never diverge on _how_ migrations apply.
- Local dev intentionally uses `migrate deploy`, not `migrate dev`, for anyone
  pulling latest and starting the stack (matches architecture.md §1.3 — `migrate
dev` stays a schema-authoring-time command run explicitly by whoever is
  changing the schema, committed as a new migration folder).
- No named volumes are wiped automatically — a developer who wants a truly clean
  slate runs `docker compose down -v` explicitly; default `docker compose up`
  preserves data across restarts.

---

## 5. CI-blocks-red smoke (AC12)

Proof, not a permanent pipeline fixture:

1. A throwaway branch/PR introduces a deliberate break — cheapest reliable choice:
   a one-line change in `packages/core-domain` that violates the purity rule
   (`import { PrismaClient } from '@omnistock/db'` in a real, non-fixture file),
   or alternatively a failing unit test committed on purpose. Either exercises a
   **real** required job (`depcruise` or `node-ci`), not a synthetic "always-fail"
   step, so the proof is honest.
2. Open the PR against `main`. Expected: the relevant required job goes red,
   GitHub's merge button is disabled ("Required statuses must pass"), and
   attempting `gh pr merge` fails.
3. Screenshot/log both the red check and the blocked-merge state as the AC12
   evidence artifact, then close the PR without merging (or revert before
   merging if opened directly against a protected ancestor).
4. This is run once as part of Gate-2→Build verification, not kept as a
   recurring CI job — its job is to prove branch protection is wired correctly,
   not to run every PR.

---

## 6. Version pinning

- **Node:** `.nvmrc` at repo root (`22`, matching current LTS at time of scaffold)
  - `"packageManager": "pnpm@<pinned-version>"` in root `package.json` (Corepack
    reads this — `corepack enable` gives everyone the exact same pnpm without a
    separate global install step).
- **Flutter:** `apps/mobile/.flutter-version` (consumed by
  `subosito/flutter-action` in CI, §2.4) + the same value documented in
  `apps/mobile/CLAUDE.md` (AC16) so a human setting up locally doesn't have to
  reverse-engineer it from the Action config.
- **pnpm workspace:** `pnpm-workspace.yaml` lists `apps/*` and `packages/*`.
  `mobile` is listed too (Turborepo/pnpm treat it as a workspace member for
  graph purposes, §7), even though its actual package management is `pub`, not
  `pnpm` — it needs a `package.json` stub (name + turbo-script passthroughs to
  `flutter analyze`/`flutter test`/`flutter build`) purely so Turborepo can see
  it in the graph.

## 7. Flutter-in-JS-monorepo tradeoff (flagged explicitly)

Running Flutter as a Turborepo workspace member buys **one task graph, one CI
summary, one place AC2 checks "did we skip a workspace"** — worth it for a small
team where "mobile silently not building" is a real failure mode (that's
literally AC2's wording). The cost, stated plainly:

- **No real caching benefit from Turborepo for Flutter tasks** — `flutter
analyze`/`flutter test`/`flutter build` have their own toolchain and their own
  (separate) build cache; Turborepo's content-hash cache around them only saves
  the "should I even invoke Flutter" decision, not Dart compilation itself.
  Actual Flutter build acceleration would come from Flutter's own incremental
  build / `flutter_gen` caching, or CI-level `actions/cache` keyed on
  `pubspec.lock` — neither is Turborepo's job.
- **Slightly awkward workspace shape** — a `package.json` exists in
  `apps/mobile` solely as a Turborepo adapter, not because mobile has any real
  Node dependency. This is a deliberate, small, documented shim, not an attempt
  to make Flutter "a JS package."
- **Alternative considered and rejected for F-000:** keep Flutter fully outside
  Turborepo/pnpm (its own top-level CI job with no `turbo.json` entry at all).
  Rejected because it would make AC2's "covers all workspaces" claim not
  mechanically checkable via `turbo build --dry=json` — we'd be trusting a
  human to remember mobile exists. The chosen approach costs a package.json
  shim; the rejected one costs an audit blind spot. Kept as noted here in case
  a future devops iteration wants to revisit once the team/CI-cost tradeoff
  shifts.

---

## 8. `.env.example` + zod boot validation (AC14) / pre-commit hooks (D-004) / shared config

### 8.1 `.env.example`

Lives at repo root, lists every variable the api needs to boot (`DATABASE_URL`,
`REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PORT`, `NODE_ENV`, plus
placeholders for anything backend-api's F-001+ already knows it will need) with
placeholder (non-secret) values. No real secret ever committed — this file is
the shape contract, not a credential source.

### 8.2 zod boot validation

`packages/config/src/env.ts` exports a zod schema; `apps/api`'s bootstrap
(`main.ts`, before Nest's `NestFactory.create`) calls `envSchema.parse(process.env)`
and on failure prints the offending variable name(s) to stderr and calls
`process.exit(1)`.

- **AC14 negative:** CI/manual step removes a required var (e.g., unsets
  `DATABASE_URL`) and asserts the process exits non-zero with that var's name in
  stderr.
- **AC14 positive:** boot with a `.env` copied from `.env.example` (all vars
  present, placeholder values are still schema-valid, e.g. valid-shaped
  connection strings) asserts a clean boot (exit only on healthy shutdown, not
  on validation).
- This is a small script under `apps/api/scripts/` or a Jest/vitest test that
  spawns the boot process with a mutated env — devops owns the runner, the zod
  schema's actual required-variable list is filled in as backend-api's features
  land (F-000 ships the mechanism + the vars already known today).

### 8.3 git pre-commit hooks (D-004)

- **Tool: `husky` + `lint-staged`** (root `package.json`), because it's the
  de-facto standard for a pnpm/Turborepo monorepo, needs no per-developer global
  install, and installs itself via `prepare` script on `pnpm install`.
- Hook runs `lint-staged` → ESLint `--fix` + Prettier `--write` on staged
  `*.{ts,tsx,js,json,md}` files, scoped to changed files only (fast, not a full
  `turbo lint`). This is local, fast feedback — it does **not** replace the CI
  `lint` job, which still runs full-repo and is the actual gate.
- No commit-blocking test/typecheck in the hook (kept fast); those stay CI's job.

### 8.4 Shared eslint/prettier (`packages/config`)

- `packages/config/eslint/base.js` (or flat-config equivalent) — shared ESLint
  rules extended by every workspace's local `eslint.config.js`.
- `packages/config/prettier/index.js` — shared Prettier config, referenced from
  root `package.json`'s `"prettier"` field or each workspace's own config file.
- `packages/config/tsconfig/base.json` — shared `tsconfig.base.json` extended by
  every workspace (this is also what dependency-cruiser's
  `options.tsConfig.fileName` points at, architecture.md §3.2).
- `packages/config/depcruise/.dependency-cruiser.cjs` — backend-api's rule file
  (architecture.md §3.2), lives here because it's a shared/config artifact, run
  by the `depcruise` CI job (§2.5).

---

## 9. Redis + BullMQ boot + health probe (AC15)

- `apps/api` gets a `HealthModule` with a `GET /health` handler aggregating:
  process liveness, Postgres reachability (`SELECT 1` via `PrismaService`), and
  Redis reachability (a `PING` via the same ioredis connection BullMQ uses).
- BullMQ boot in F-000 is intentionally minimal: one `Queue` instance
  constructed against the Redis connection at module init (no real job/worker
  logic yet — that's F-0xx feature-specific), enough to prove the connection is
  live end to end. The health probe checks the **connection**, not a queue's
  job-processing correctness (there's nothing to process yet).
- `/health` response shape: `{ status: "ok" | "error", checks: { db: "ok"|"fail", redis: "ok"|"fail" } }`.
  (`status` here is the contract's authoritative `HealthResponse` enum,
  packages/contracts/openapi/openapi.yaml — the contract wins over this doc's
  wording; the service's internal "ok"|"degraded" result collapses to
  "ok"|"error" on the wire, see health.controller.ts.) AC3's
  `GET /health → 200 {status:"ok"}` is the happy path; AC15 additionally
  asserts the `redis` key is present and `"ok"` when the compose Redis is up.
- Local dev: Redis comes from `docker-compose.yml` (§4). CI: `db-migrate`-style
  ephemeral service container pattern is available if a job ever needs live
  Redis (not required for AC15 as specified — AC15 is verified against the dev
  compose stack + optionally a dedicated `redis:` service block on the
  `node-ci` job if we want it CI-asserted too; **recommendation: add a Redis
  service container to `node-ci`** so `/health`'s redis check has an automated
  assertion rather than only a manual dev-time check — flagged as a small scope
  addition, not a blocker, easy to fold into §2.2 without new job creation).

---

## 10. Confirmation / pushback on backend-api's devops-facing assumptions (architecture.md §7)

Going through architecture.md §7's "devops (migration/CI feasibility)" list:

1. **"Pipeline runs `prisma migrate deploy` then `prisma migrate status` against
   an ephemeral empty Postgres (AC4), and the raw-SQL trigger migration applies
   cleanly in that job."**
   **Confirmed.** §2.3's `db-migrate` job does exactly this — GitHub Actions
   Postgres service container, fresh per run, `migrate deploy` then
   `migrate status`, no separate step for the trigger migration since it's a
   normal migration folder Prisma already tracks.

2. **"`depcruise` runs as its own required, merge-blocking status check,
   separate from ESLint."**
   **Confirmed.** §2.5/§2.7 — standalone job, standalone required-check entry.

3. **"The Flutter job (AC13) treats the generated Dart client as
   wired-not-green (excluded from `analyze` until F-006)."**
   **Confirmed, with a specific mechanism.** §2.4 — excluded via
   `analysis_options.yaml` `exclude:` glob rather than an allow-failure step,
   so the deferral is visible/auditable in the repo rather than silently
   tolerated by CI config. If backend-api/qa prefer the allow-failure-step
   approach instead (e.g., because they want the analyzer to actually run and
   just not block), that's a one-line change in §2.4 — flagging the choice
   explicitly in case there's a preference either way.

4. **"Regen-and-diff drift checks for both Prisma and contracts codegen fit the
   CI model you're building."**
   **Confirmed, one job.** §2.6 — same `git diff --exit-code` mechanism covers
   Prisma client, TS contracts client, and Dart contracts client in a single
   `contracts-drift` job; no structural mismatch with the rest of the pipeline.

**One addition flagged back (not a blocker, a proposal):** §9 recommends adding
a Redis service container to `node-ci` so AC15's `/health` redis check has an
automated CI assertion, not just a dev-compose manual check. If backend-api/qa
want this as a formal AC15 test rather than a "nice to have," say so and it
folds into §2.2 with no new job.

---

## 11. Summary of files this doc implies (for Build phase)

```
turbo.json
pnpm-workspace.yaml
.nvmrc
.env.example
docker-compose.yml
.github/workflows/ci.yml            # node-ci, db-migrate, depcruise, flutter-ci, contracts-drift
packages/config/eslint/base.js
packages/config/prettier/index.js
packages/config/tsconfig/base.json
packages/config/depcruise/.dependency-cruiser.cjs   # backend-api's rule, devops wires the job
packages/config/src/env.ts          # zod schema
apps/mobile/.flutter-version
apps/mobile/package.json            # turbo adapter shim only
apps/api/src/health/*               # /health aggregating db + redis
.husky/pre-commit                   # lint-staged
```
