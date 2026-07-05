---
name: prisma-migration
description: >-
  Author and run Prisma schema migrations safely on OmniStock's PostgreSQL.
  Use for every migration in packages/db once any environment holds real data —
  especially tables behind money/stock (StockMovement ledger, orders, costs).
  Enforces expand→migrate→contract, non-destructive defaults, ledger
  protections, and rollback paths. Owned by backend-api; devops runs them;
  release coordinates destructive steps.
---

# Prisma migrations — data outlives code

A bad deploy is rolled back in minutes; a bad migration can destroy tenant
money/stock history permanently. Treat every migration on a data-bearing table
as a ★-class change.

## Expand → migrate → contract (the only pattern)
1. **Expand** (deploy N): add the new column/table **nullable or with default**;
   add new index. Old code keeps working.
2. **Migrate**: backfill in batches (not one giant UPDATE holding locks);
   new code writes both/new.
3. **Contract** (deploy N+1 or later): only after nothing reads the old shape —
   tighten NOT NULL / drop old column. **Never combine contract with expand in
   one migration**, and never ship a DROP/RENAME in the same deploy as the code
   change that stops using it.

## Hard rules
- **Ledger tables (`StockMovement`, future `UsageEvent`): no ALTER that rewrites
  or deletes history.** Additive columns must be nullable (historic rows can't
  be backfilled with invented facts). Golden rule 2 applies to migrations too.
- No destructive statement (DROP TABLE/COLUMN, column type narrowing,
  TRUNCATE) without: a `D-XXX` entry + `release` sign-off + verified backup.
- Every migration states its **rollback path** in a comment: reversible SQL, or
  explicitly "forward-only + why + backup point".
- Index on a large/growth table: note lock impact; prefer
  `CREATE INDEX CONCURRENTLY` (raw SQL migration) once tables are big.
- Migrations run **once, in order, in CI first** — never edit an applied
  migration; fix forward with a new one.

## Before merge checklist
- [ ] Ran against a seeded DB (≥2 orgs) — up clean; schema drift check clean.
- [ ] Multi-tenant intact: new tables carry `organizationId` + index where the
      model requires it (golden rule 3).
- [ ] Money columns `numeric`/Decimal, stock columns integer (golden rule 7).
- [ ] Matches the approved Gate-2 `data-model.md`; deltas → back to the doc +
      sync-back to docs/01 (Gate B).
- [ ] Rollback path stated; destructive steps have release sign-off.

Then run `quality-gate` (Gate C).
