# apps/api — CLAUDE.md

แนวทางสำหรับ AI agent ที่แก้ `apps/api` **และ `packages/{core-domain,db,connectors,contracts}`**
(backend-api เป็นเจ้าของทั้งหมด) · อ่าน [root CLAUDE.md](../../CLAUDE.md) + [workspace-map](../../docs/workspace-map.md) ก่อน

## นี่คืออะไร

NestJS API service ของ OmniStock — HTTP + webhooks + BullMQ workers (deploy เดียว, split-ready ผ่าน `APP_ROLE`)

> **Architecture authority: [docs/architecture/backend.md](../../docs/architecture/backend.md)** —
> module map เต็ม + pattern หลัก (§3) + playbook feature/connector (§5.3–5.4) + gap plan (§6)

## Stack

NestJS 11 · TypeScript · Prisma/PostgreSQL · Redis + BullMQ · `tsx` (dev) · spec-first OpenAPI ที่ `packages/contracts`

## อะไรอยู่ไหน (bright-line — ไล่ตามลำดับ ข้อแรกที่ใช่คือคำตอบ)

1. คำนวณ/ตัดสินใจ ไม่แตะ I/O → `packages/core-domain` (pure fn — ห้าม import Prisma/Nest/I-O ทุกชนิด,
   รับ `now: Date` เป็น argument; purity gate จับ)
2. schema / Prisma / ledger mechanics → `packages/db` (ห้ามใช้ NestJS ในนี้)
3. คุยกับ marketplace → `packages/connectors` (ห้าม NestJS/Prisma; DTO platform ห้ามหลุดออกนอก package)
4. shape ของ API → `packages/contracts` (แก้ YAML ก่อนเสมอ → `pnpm gen:contracts` — ห้าม hand-write type)
5. ที่เหลือ (orchestration/guard/controller/worker) → `apps/api/src/<feature-module>/`
   **exemplar: `src/auth/`** (edge patterns) · `packages/core-domain/src/cost/` (pure fn + test matrix)

## โครงสร้างปัจจุบัน (`src/`)

- `main.ts` — env-first bootstrap (`loadEnv()` ก่อน NestFactory, fail-fast) — KEEP
- `auth/` (F-001, hardened) · `health/` (probe PG/Redis, bounded timeout) · `prisma/` (**client เดียว**
  `$extends(ledgerGuardExtension)` — ห้าม `new PrismaClient()` เปล่า) · `tenancy/` (`withOrgScope` seam +
  OrgContextStore — enforcement จริงเติมที่ F-002/003)

## กฎเหล็ก (CI จับ — รันก่อนส่งงาน: test + lint + typecheck + depcruise; int lane เมื่อแตะ DB)

1. ทุก query โดเมนผ่าน `withOrgScope`/กรอง `organizationId` — cross-org leak test เป็น int-lane บังคับ
   ของทุก feature ใหม่
2. write เงิน/สต๊อกอยู่ใน DB transaction + เขียน ledger เสมอ — ห้าม update/delete `StockMovement`
   (guard+trigger จับ) · ห้าม bypass `PrismaService`
3. เงิน = Decimal(18,4)/string ตลอดสาย — ห้าม `Number()` กับเงิน · สต๊อก = int · เวลาเก็บ UTC
4. งานคุย external = enqueue BullMQ เสมอ (queue naming ตาม backend.md §2.3) — ห้ามเรียก connector
   ใน HTTP handler (ยกเว้น OAuth exchange)
5. error ใน feature ใหม่: โยน typed error — **ห้ามลอก pattern throw envelope inline ของ auth/**
   (เป็นข้อยกเว้นยุคก่อน filter กลาง — ดู target ด้านล่าง) · error code ที่ ship แล้วห้ามเปลี่ยนค่า
6. list = cursor pagination `{ items, nextCursor }` · งานยาว = `202` + `GET /jobs/:id` ·
   mutating ที่กระทบเงิน/สต๊อก = รองรับ `Idempotency-Key` · inbound (webhook/poll) ต้องซ้ำได้เสมอ (unique key)
7. throttle inline ใน auth controller = ข้อยกเว้นเฉพาะ auth — feature ทั่วไปใช้ org rate-limit guard กลาง
8. **ทุก task มี unit test ประกบ** (D-014) · เงิน/สต๊อก = test matrix ตาม skill `money-stock` ·
   int lane ต้องเขียวใน CI `integration-api` ก่อนอ้างว่าผ่าน (green locally ≠ tested)

## Target patterns — เมื่อ build feature ที่แตะเรื่องนี้ **ให้ implement ตาม arch doc ห้ามคิด pattern เอง**

| เรื่อง | ตาม | เกิดที่ |
|---|---|---|
| `DomainExceptionFilter` + error-code registry (envelope `{error:{code,message,details?,fieldErrors?,traceId?}}` → ApiFailure ของ client) | backend.md §3.5 | **ก่อน feature โดเมนแรก Phase 1** |
| `OrgContextMiddleware` (ALS) + `ORG_PRISMA`/`SYSTEM_PRISMA` — feature module inject `ORG_PRISMA` เท่านั้น; `SYSTEM_PRISMA` เฉพาะ auth/admin (+`@Audited`) | backend.md §3.3 | F-002/F-003 |
| guards 3 แกนแยกกัน: `@RequireCapability` (RBAC) · `@RequireFeature` (tier/entitlements `can()`/`canAdd()`) · `@Audited` | backend.md §3.4 | F-003 · F-007 · F-005 |
| ⭐ `ledgerWrite(client, ctx, plan)` primitive — pure fn ผลิต `LedgerPlan` → idempotent insert → sorted `SELECT…FOR UPDATE` → projection → transactional outbox · `stockMovement.create` ถูกกฎหมายไฟล์เดียว (grep gate) — ห้ามมี write เงิน/สต๊อกเส้นอื่นเกิดก่อน | backend.md §3.1 | F-011 |
| connectors: `core/` (ChannelConnector port + `ConnectorCapabilities` + typed `ConnectorError` + registry) + **`fake/` เกิดพร้อม core/ วันแรก** + `shopee/` (DTO jail `mapping/vN/`; config=endpoint/limit/retry, code=mapping) · ห้าม `if (key === 'shopee')` นอก package | backend.md §3.2 | F-020–025 |
| service รูปเดียวของ feature โดเมน: อ่าน (ORG_PRISMA) → pure fn ได้ plan → `ledgerWrite` — ห้ามคำนวณใน tx callback | backend.md §3.1 | F-011+ |
| jobs resource + worker assembly (`APP_ROLE=api\|worker\|all`) | backend.md §2.3, §3.6 | F-021/F-023 |
| `DocumentSequence` gapless per-org (`UPDATE…RETURNING` ใน tx เดียวกับ insert) + 50-way concurrency test | backend.md §3.7 | F-004b/F-040 |

## ห้ามตัดสินเอง (escalate)

business rule/scope/AC → product · จอ/flow → ux/frontend · env/CI/DB hosting → devops ·
migration บนตารางมีข้อมูล → skill `prisma-migration` · contract ที่ ship แล้ว → skill `contract-evolution` ·
★ auth/token/webhook-verify → security-reviewer

## คำสั่ง (source nvm→node22 + `corepack` ก่อน)

`pnpm --filter api build|typecheck|lint|test` · dev boot ต้องมี Postgres+Redis (`pnpm db:up`)
