# F-000 Task Board

> เจ้าของ task update status ของตัวเอง (`todo→in_progress→done`) + ลงชื่อ `updated_by`
> PM dispatch task ที่ `deps=done` ครบ · ref = เอกสาร Gate-2 + target path
> ที่มา: architecture.md · data-model.md · infra.md · test-plan.md (sign off ครบ 2026-07-02)

## T-000-01 · devops · monorepo skeleton
- desc: Turborepo+pnpm workspace, โฟลเดอร์ apps/* + packages/*, turbo.json task graph+caching, version pin (.nvmrc/packageManager/flutter), packages/config (eslint/prettier/tsconfig/depcruise)
- ref: infra.md · → apps/*, packages/config, turbo.json
- deps: G2✓   · status: todo   · updated_by: —

## T-000-02 · devops · docker dev + env
- desc: docker-compose (Postgres+Redis), .env.example, zod env validation (pos/neg AC14), dev scripts
- ref: infra.md · → root, packages/config
- deps: T-000-01   · status: todo   · updated_by: —

## T-000-03 · devops · git hooks
- desc: husky + lint-staged pre-commit (lint/format) — D-004
- ref: infra.md · → root
- deps: T-000-01   · status: todo   · updated_by: —

## T-000-04 · backend-api · Prisma schema (19 tables)
- desc: schema.prisma ครบตาม data-model.md (5-layer+ledger+auth+channel+scale-stub), org column, Decimal/Int, FK/@@unique/@@index, enums; `migrate deploy` + status in-sync (AC4/5/6/7)
- ref: data-model.md · → packages/db
- deps: T-000-01   · status: todo   · updated_by: —

## T-000-05 · backend-api · ledger immutability trigger
- desc: raw-SQL Prisma migration ติดตั้ง plpgsql trigger reject UPDATE/DELETE/TRUNCATE บน StockMovement+UsageEvent (INSERT ผ่าน) + app-repo guard layer 1 (AC8)
- ref: architecture.md · → packages/db
- deps: T-000-04   · status: todo   · updated_by: —

## T-000-06 · backend-api · core-domain package + purity gate
- desc: packages/core-domain (pure), sample money/stock fn + unit test (AC10), dependency-cruiser rule + negative fixture (AC9)
- ref: architecture.md · → packages/core-domain, packages/config
- deps: T-000-01   · status: todo   · updated_by: —

## T-000-07 · backend-api · contracts codegen
- desc: packages/contracts OpenAPI source (+/health) + validate, openapi-typescript TS client (green), Dart client wired-only (green→F-006) (AC11)
- ref: architecture.md · → packages/contracts
- deps: T-000-01   · status: todo   · updated_by: —

## T-000-08 · backend-api · apps/api skeleton
- desc: NestJS skeleton, GET /health (200 {status:ok} + redis/bullmq probe AC15), org-scope seam stub (withOrgScope), consume packages/db + contracts
- ref: architecture.md, infra.md · → apps/api
- deps: T-000-04, T-000-07   · status: todo   · updated_by: —

## T-000-09 · frontend · app shells (web + mobile)
- desc: apps/web Next.js placeholder (consume TS client, dev 200) + apps/mobile Flutter placeholder (analyze/build, consume Dart client wired) (AC3)
- ref: infra.md, workspace-map.md · → apps/web, apps/mobile
- deps: T-000-07   · status: todo   · updated_by: —

## T-000-10 · devops · CI pipeline (5 jobs)
- desc: node-ci, db-migrate (ephemeral PG + migrate+status+trigger negative), depcruise (standalone+fixture), flutter-ci, contracts-drift — required merge-blocking + branch protection + CI-blocks-red smoke (AC2/9/11/12/13)
- ref: infra.md, test-plan.md · → .github/workflows
- deps: T-000-04, T-000-06, T-000-07, T-000-08   · status: todo   · updated_by: —

## T-000-11 · qa · AC verification suite
- desc: implement checks จาก test-plan.md — introspection (AC5/6/7), negative tests (AC8/9), env (AC14), wire ให้ CI รัน; verdict vs 16 AC
- ref: test-plan.md · → packages/db (tests), CI
- deps: T-000-05, T-000-10   · status: todo   · updated_by: —

## T-000-12 · backend-api+frontend · per-app CLAUDE.md
- desc: apps/{api,web,mobile}/CLAUDE.md เขียนจากโครงจริง (tech + folder structure) — D-001 (AC16)
- ref: workspace-map.md, D-001 · → apps/{api,web,mobile}
- deps: T-000-08, T-000-09   · status: todo   · updated_by: —
