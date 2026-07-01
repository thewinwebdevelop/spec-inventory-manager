---
status: gate1-approved
owner_now: "@backend-api"   # next: Gate 2 (schema/contracts/CI) — backend-api + devops
waiting_on: null
platform: none              # infra, no end-user UI
size: full                  # infra but substantial (schema + guards + CI + contracts)
---

# F-000 — Project setup / monorepo scaffold

> สถานะ: `gate1-approved` · Phase: 0 · ขึ้นกับ: — · เจ้าของ: backend-api + devops
> **Platform:** — (no end-user UI) · **ขนาดงาน:** full (infra) · **Tier:** ⚙️ core/infra
> Gate 1 ผ่าน review 3 ทีม (backend-api/devops/qa) + user sign-off (2026-07-02) · scope calls → D-004

---

# ══ Gate 1 — Requirement ══

## 1. ภาพรวม (Overview)
- **ปัญหา/เป้าหมาย:** repo มีแต่ `docs/` — ยังไม่มีโค้ด/โฟลเดอร์จริง ทุก feature ตั้งแต่ F-001 ต้องมี "บ้าน" ให้ลงโค้ด (monorepo, Prisma schema, contracts codegen, CI, env, dev env) ก่อนเริ่ม build ได้ · F-000 = scaffold ฐานทั้งหมดครั้งเดียว
- **ใครใช้:** agent/ทีมทุกตัว + ทุก feature ถัดไป — **ไม่ใช่ end user** (ไม่มี user story → วัดด้วย Definition of Done §3)
- **คุณค่า:** (1) `clone → install → build → dev` ได้ทันที (Node + Flutter) · (2) โครงบังคับ **กฎทองเชิงโครงสร้าง** ตั้งแต่วันแรก · (3) guardrail อัตโนมัติ (CI) ที่ **block merge จริง** เมื่อแดง

## 2. ขอบเขต (Scope)

### 2.1 เส้นแบ่ง schema-vs-logic (rule — บังคับทั่ว AC หมวด DB)
- **schema (F-000) = tables + columns + enums + constraints (unique/FK) + indexes เท่านั้น**
- **derived value = core-domain (F-010+), ห้ามเป็น column/generated:** `available = min(floor(item.available/qty))` · `onHand − reserved` · weighted-average `avgUnitCost` · COGS · entitlement resolution
- **ข้อยกเว้น (stored column ถูกต้อง ไม่ใช่ derived):** `StockMovement.balanceAfter` = audit snapshot ต่อ movement (docs/01 §2)

### 2.2 In scope (F-000 ส่งมอบ)

**Monorepo & tooling**
- Turborepo + pnpm workspace; โฟลเดอร์ตาม [docs/02 §2](../02-architecture.md): `apps/{api,web,mobile,back-office}` + `packages/{core-domain,db,connectors,contracts,config}` (skeleton ที่ build ได้)
- `pnpm-workspace.yaml`, `turbo.json` (pipeline build/lint/typecheck/test + caching), version pin (`.nvmrc` + `packageManager`), Flutter SDK pin
- `packages/config`: shared eslint + prettier + tsconfig base + env schema (zod)
- `.env.example` ครบทุกตัวแปรจำเป็น (ไม่มี secret จริง)
- **git pre-commit hooks** (lint/format) — *[D-004: user เคาะให้มี]*

**Database (`packages/db`) — schema เท่านั้น (§2.1)**
- Prisma schema + migrations ที่ `packages/db` ที่เดียว · ทุก domain table มี `organizationId` · เงิน=`numeric` · qty/สต๊อก=`integer`
- **Table ที่ต้องมี** (structure ตาม docs/01 §2):
  - Tenancy/Auth: `User`, `Organization`, `Membership`, **`Role`, `RefreshToken`, `Invitation`** *(D-004: สร้างใน F-000 กัน FK ลอย)*
  - Product 5-layer: `Product`, `SellableSku`, `InventoryItem`, `BundleComponent`
  - Stock: `Warehouse`, `StockLevel`, `StockMovement`
  - Channel: `Channel`, `ChannelAccount`, `ChannelListing`
  - Scale-seam stub (structure จริง): `PlanDefinition`, `OrgEntitlement`, `UsageEvent`
- **Ledger immutability trigger** (D-002 + backend-api ruling): migration ติดตั้ง DB trigger reject `UPDATE`+`DELETE` บน `StockMovement` และ `UsageEvent` (ไม่บล็อก `INSERT`)
- **Object storage — stub interface เท่านั้น** *(D-004: concrete → F-040)* — ประกาศ interface, ยังไม่ผูก backend จริง

**Contracts (`packages/contracts`)**
- source OpenAPI spec (seed เช่น `/health`) + validate · **TS client codegen → green** (typecheck จาก api/web) · **Dart client — wired เท่านั้น** *(D-004: green → F-006)*

**Runtime infra**
- Docker/dev: Postgres + Redis (compose) · Redis + BullMQ boot + health check (bootstrap ว่าง)

**CI**
- CI: lint + typecheck + test (Node) — required, **block merge เมื่อแดง** · **Flutter CI job แยก** (analyze + test) required · dependency-boundary check (core-domain purity) เป็น CI-blocking

**Docs (D-001)**
- `apps/{api,web,mobile}/CLAUDE.md` (เขียนจากโครงจริงหลัง scaffold)

### 2.3 Out of scope — table ที่จงใจตัด (boundary auditable)
`Order`/`OrderItem` → F-024 · `PurchaseDocument`/`AccountingDocument` → Phase 2 · `Subscription`/`Payment` → Phase 5 (F-080)

### 2.4 Out of scope — logic & deferred (→ forward-commitments.md)
- business/feature logic ทั้งหมด (auth, inventory math, connector, entitlement resolution) · design token จริง → ux · UI จริง (มีแค่ shell) · runtime org-scoping middleware เต็ม → F-002/F-003 (F-000 วาง seam/stub) · `apps/back-office/CLAUDE.md` → Phase 5
- **Deferred (D-004):** Dart client green → **F-006** · object storage concrete → **F-040** · transaction+ledger write primitive (กฎทอง 5) → **F-011**

## 3. Acceptance Criteria = Definition of Done
(infra — ทุกข้อ checkable)

**Build & install**
- [ ] AC1 — `pnpm install` สำเร็จจาก clean clone
- [ ] AC2 — `turbo build` exit 0 และ **ครอบทุก workspace** (summary แสดงว่าไม่ skip mobile เงียบ)
- [ ] AC3 — dev รันได้: api `GET /health` → `200 {status:"ok"}` · web dev server 200 · mobile `flutter analyze` + `flutter build` (debug) ผ่าน (จอเปิดจริง = manual)

**Database / schema**
- [ ] AC4 — `prisma migrate deploy` (จาก 0) สำเร็จบน Postgres เปล่า และ `prisma migrate status` = in sync (ไม่มี drift)
- [ ] AC5 — introspect: ทุก table ใน §2.2 มีจริง พร้อม column + unique constraint ตาม docs/01 §2 (เช่น `StockLevel @@unique([warehouseId, inventoryItemId])`, `BundleComponent @@unique([sellableSkuId, inventoryItemId])`, `ChannelListing @@unique([channelAccountId, externalSkuId])`)
- [ ] AC6 — introspect `information_schema`: ทุก domain table มี `organizationId`; allowlist ที่จงใจไม่มี org = `User`, `Channel`, `PlanDefinition`, `RefreshToken` (Role/Invitation ตาม backend-api Gate 2) — นอก allowlist ที่ไม่มี org = fail
- [ ] AC7 — introspect type: money (`SellableSku.basePrice`, `InventoryItem.avgUnitCost`, `StockMovement.unitCost`, `UsageEvent.cost`) = `numeric` (ไม่มี float); stock/qty (`StockLevel.onHand`/`reserved`, `BundleComponent.quantity`, `StockMovement.quantity`/`balanceAfter`) = `integer`
- [ ] AC8 — **negative test (ledger):** trigger ติดตั้งแล้ว → `UPDATE`/`DELETE` บน `StockMovement` และ `UsageEvent` **throw ทั้งหมด**, `INSERT` **ผ่าน**

**core-domain purity (กฎทอง 6)**
- [ ] AC9 — **negative test:** import Prisma/NestJS เข้า `packages/core-domain` → dependency-boundary check (dependency-cruiser / eslint import-boundaries) **fail ใน CI** และเป็น CI-blocking (กัน `eslint-disable` ผ่านเงียบ)
- [ ] AC10 — core-domain มี pure fn ตัวอย่างที่ **แตะ money หรือ stock path** (เช่น weighted-average / `available=min(floor(...))` แบบ pure) + unit test ผ่าน (พิสูจน์ Decimal/integer + test-without-DB)

**Contracts**
- [ ] AC11 — OpenAPI source spec validate ผ่าน · TS client codegen แล้ว typecheck ผ่านเมื่อ import จาก api และ web · Dart client codegen **wired** (green → F-006)

**CI & config**
- [ ] AC12 — **CI-blocks-red smoke:** PR ที่จงใจ broken → CI **แดง** และ merge ถูก block (พิสูจน์ว่า gate กั้นจริง)
- [ ] AC13 — Flutter `analyze` + `test` เป็น **required check** ใน CI (แยกจาก AC12)
- [ ] AC14 — env zod: **negative** = ลบ var จำเป็น → boot exit non-zero + stderr ระบุชื่อ var; **positive** = `.env` ครบ (จาก `.env.example`) → boot ผ่าน

**Runtime infra**
- [ ] AC15 — Redis/BullMQ boot + health check: probe ยืนยัน queue เชื่อม Redis (เช่น `/health` รวมสถานะ redis)

**Docs (D-001)**
- [ ] AC16 — มี `apps/{api,web,mobile}/CLAUDE.md` เขียนจากโครงจริง (tech stack + folder structure ต่อ app)

## 4. Dependencies & impact
- **Upstream:** ไม่มี — F-000 คือ root ของ backlog
- **Downstream:** ทุก feature (F-001…F-095) ขึ้นกับ F-000 · จะตกผลึกหลัง F-000: [workspace-map.md](../workspace-map.md), per-app CLAUDE.md
- **forward-commitments:** Dart green (F-006), object storage (F-040), write primitive (F-011), + table/logic ที่ตัดออก → [forward-commitments.md](forward-commitments.md)

> ✋ **Gate 1 sign-off:** user เคาะแล้ว (2026-07-02) หลัง review 3 ทีม → สถานะ `gate1-approved`
> **Gate 2 (ถัดไป):** backend-api (schema/migration/trigger/contracts) + devops (CI Node+Flutter/Docker/turbo) + qa (test-plan จาก AC) — โปรโมตเป็น `docs/features/F-000/` เมื่อเริ่ม Gate 2
