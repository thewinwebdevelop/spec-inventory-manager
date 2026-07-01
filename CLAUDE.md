# CLAUDE.md

แนวทางสำหรับ AI agent ที่ทำงานในโปรเจกต์นี้ อ่านก่อนเริ่มทุกครั้ง

> **กติกาการทำงานของทีม AI อยู่ใน [WEB_TEAM.md](WEB_TEAM.md)** — mission, agent roles,
> workflow (Brief→UX→Build→QA→Release) และ quality gate ก่อนถือว่างานเสร็จ
> รายละเอียดแต่ละ agent: [.claude/agents/README.md](.claude/agents/README.md)

## โปรเจกต์นี้คืออะไร
OmniStock — แพลตฟอร์มรวม **Inventory + Marketplace Sync (Shopee/Lazada/TikTok) + Thai Cloud Accounting**
multi-tenant, dogfood ก่อนแล้วเปิดขาย รายละเอียดทั้งหมดอยู่ใน [docs/](docs/) — เริ่มที่ [docs/00-overview.md](docs/00-overview.md)

## Stack
Turborepo + pnpm · NestJS (API) · PostgreSQL + Prisma · Redis + BullMQ · Next.js (web) · Flutter (mobile) · OpenAPI เป็นสัญญากลาง
โครงสร้าง monorepo + เหตุผล: [docs/02-architecture.md](docs/02-architecture.md)
**ทีมไหน implement ที่ไหน** (agent ต้องรู้ก่อนเขียนโค้ด): [docs/workspace-map.md](docs/workspace-map.md)

## กฎทอง (ห้ามแหก)
1. **Source of truth = ระบบเรา** — platform เป็นปลายทางที่เรา push ไป
2. **Inventory ledger เป็น immutable** — แก้ยอดด้วยการเพิ่ม `StockMovement` ใหม่ ไม่ใช่ update/delete
3. **ทุก query โดเมนต้องกรอง `organizationId`** (multi-tenant)
4. **โค้ดที่แตะเงินหรือสต๊อก ต้องมี unit test** ก่อน merge
5. **write ที่กระทบสต๊อก/เงิน อยู่ใน DB transaction + เขียน ledger เสมอ**
6. business logic แกนอยู่ใน `packages/core-domain` (pure function ไม่พึ่ง framework/DB)
7. เงินใช้ Decimal/numeric — **ห้าม float**; สต๊อกเป็น integer

## โมเดลแกน (ต้องเข้าใจก่อนแก้สินค้า/สต๊อก)
5 ชั้น: `Product → SellableSku → BundleComponent → InventoryItem` + `ChannelListing` (แมป platform/account)
- SellableSku ไม่เก็บสต๊อก → `available = min(floor(item.available / qty))`
- ต้นทุนอยู่ที่ InventoryItem (weighted-average); COGS ของ sellable = Σ(component cost × qty)
- bundle เป็น virtual (ตัด component ตอนขาย)
รายละเอียด: [docs/01-data-model.md](docs/01-data-model.md)

## สถานะปัจจุบัน
Phase 0 — Foundation/Spec (ยังไม่มีโค้ด app) connector ตัวแรก = **Shopee**
roadmap: [docs/00-overview.md](docs/00-overview.md)

## วิธีทำงาน: feature-driven
ทีมและ workflow เต็ม (Brief→UX→Build→QA→Release + quality gate) อยู่ใน [WEB_TEAM.md](WEB_TEAM.md)
งานแตกเป็น feature (F-XXX) ดู backlog + workflow ที่ [docs/features/README.md](docs/features/README.md)
ต่อ 1 feature (2 gates): **Gate 1** req/use-case/user-story/AC → ✋ user เคาะ → **Gate 2** architecture(ถ้าแตะ external/money-stock) → data-model → API → UX/UI → test plan → review เจาะจงเจ้าของ → ✋ user อนุมัติ + commit เอกสาร → build (unit test ไปพร้อมโค้ด) → QA → release
spec แต่ละตัวใช้ [docs/features/_TEMPLATE.md](docs/features/_TEMPLATE.md) · right-size: full vs light · 1 feature tag platform (web/mobile/both)

## เมื่อจะลงมือ
1. อ่าน docs ที่เกี่ยว (เสมอ: 01 data-model) + spec ของ feature นั้น
2. เช็คว่าไม่ละเมิดกฎทอง
3. เขียน/อัปเดต test ของ business logic
4. รัน test + lint แล้ว **รายงานผลตามจริง**
5. commit/push เมื่อผู้ใช้สั่งเท่านั้น, ทำบน branch
