# Workspace Map — ทีมไหน implement ที่ไหน (monorepo)

> โครง monorepo เต็ม (apps/packages tree) อยู่ที่ [02-architecture.md §2](02-architecture.md) —
> ไฟล์นี้ map **agent team → ตำแหน่ง code** เพื่อให้แต่ละ agent รู้ว่าต้องเขียนงานลงที่ไหน
> โครง: **Turborepo + pnpm (monorepo เดียว)** · decision: อยู่ monorepo ต่อในช่วง Phase 0/dogfood
> (เหตุผล: contract เปลี่ยนบ่อย + แชร์ core-domain/tokens + ทีมเล็ก → polyrepo/submodule ยังไม่คุ้ม)

## 1. ทีม → ตำแหน่ง implement

| Agent team | เขียนงานที่ | หมายเหตุ |
|-----------|-------------|----------|
| **backend-api** | `apps/api/` (NestJS) + `packages/core-domain` + `packages/db` + `packages/connectors` + `packages/contracts` | core-domain = **pure** (กฎทอง 6) · contracts = **OpenAPI seam** |
| **frontend** (web) | `apps/web/` (Next.js + Tailwind + shadcn) | consume **generated TS client** จาก `packages/contracts` — ห้าม reshape data เอง |
| **frontend** (mobile) | `apps/mobile/` (Flutter) | consume **generated Dart client** จาก OpenAPI |
| **ux** | *ไม่เขียน app code* — authors [design-system.md](design-system.md) + tokens (skill `thai-ux`) | token → map เข้า Tailwind/shadcn (web) + `ThemeData` (Flutter); ห้าม off-token |
| **devops** | root: `turbo.json`, `pnpm-workspace.yaml`, `packages/config`, Docker, CI/CD, env (zod) | จัด infra + pipeline ให้ทุก app/package |
| **qa** | test อยู่ **colocate** ในแต่ละ app/package (`apps/api/**/*.spec.ts`, `packages/core-domain/**/*.test.ts`, Flutter `test/`) | verdict + quality gate |
| **product** | `docs/features/**` (spec) | ไม่มี app code |
| **release** | version/changelog/branch — **ทั้ง monorepo (1 repo = 1 version line)** | |

## 2. ของกลาง — แชร์ ห้าม duplicate (กฎทอง)

| ของ | อยู่ที่ | เจ้าของ |
|-----|--------|---------|
| money/stock logic (5-layer, COGS, allocation) | `packages/core-domain` (pure, framework-free) | backend-api |
| OpenAPI contract + generated client | `packages/contracts` = **seam BE↔FE/mobile** | backend-api |
| Prisma schema + migrations | `packages/db` | backend-api |
| ChannelConnector + adapters (shopee/…) | `packages/connectors` | backend-api |
| design tokens (สี/typography/spacing) | authored ใน [design-system.md](design-system.md) → map ทั้ง web+mobile | ux (frontend map) |

> **invariant:** business logic อยู่ `core-domain` ที่เดียว · web + mobile กิน **contract เดียว** ผ่าน generated client
> (ดู [02-architecture.md §7.2](02-architecture.md))

## 3. Mapping กับ 3 GitHub repo (พักไว้เป็น split อนาคต)

ตอนนี้อยู่ monorepo — 3 repo ที่สร้างไว้ = **จุด split เมื่อทีมโต/ต้อง deploy แยก** (ค่อยแตก `apps/*` ออกไปแต่ละ repo)

| GitHub repo | ปลายทาง (โฟลเดอร์ monorepo) |
|-------------|------------------------------|
| `inventory-manager-service` | `apps/api/` |
| `inventory-manager-web` | `apps/web/` |
| `inventory-manager-mobile` | `apps/mobile/` |
| *(back-office — ยังไม่ทำ)* | `apps/back-office/` (Phase 5, ดู [02 §5](02-architecture.md)) |

## 4. ผูกกับ workflow (coordination)

- **task board (§3.F):** ฟิลด์ `ref` ของ task ควรระบุ **target path** ด้วย (เช่น `ref: api-spec.md → apps/api`, `ux-wireframe.md → apps/web`)
- **Build order:** `backend-api` ทำ `apps/api` + `packages/*` ก่อน → **contract/client พร้อม** → `frontend` ทำ `apps/web` + `apps/mobile` (dependency ปลดด้วย generated client)
- โฟลเดอร์จริงจะถูก scaffold ตอน **F-000 (monorepo setup)** — ไฟล์นี้บอก *ปลายทาง* ล่วงหน้า
