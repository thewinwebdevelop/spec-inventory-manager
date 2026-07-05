# apps/api — CLAUDE.md

แนวทางสำหรับ AI agent ที่แก้ `apps/api` · อ่าน [root CLAUDE.md](../../CLAUDE.md) + [workspace-map](../../docs/workspace-map.md) ก่อน

## นี่คืออะไร

NestJS API service ของ OmniStock — ปลายทาง HTTP/domain logic ฝั่ง server
**เจ้าของ:** `backend-api` · สร้างใน F-000 T-000-08 (skeleton)

## Stack

NestJS 11 · TypeScript · รันด้วย `tsx` (dev) · consume `@omnistock/db` + `@omnistock/contracts` + `@omnistock/config`

## โครงสร้าง (`src/`)

- `main.ts` — bootstrap; เรียก `loadEnv()` จาก `@omnistock/config` **ก่อน** import NestFactory (fail-fast ถ้า env ไม่ครบ — AC14)
- `app.module.ts` — root module
- `health/` — `GET /health` (AC3) + probe Postgres (`SELECT 1`) และ Redis/BullMQ (`PING` + queue) แบบ bounded timeout (AC15); คืน 503 เมื่อ dependency ล่ม; response type sync กับ `HealthResponse` ใน contract
- `prisma/` — `PrismaService`: **client เดียว** ที่ `$extends(ledgerGuardExtension)` เสมอ (กฎทอง 2 — ห้ามสร้าง `new PrismaClient()` เปล่าในแอป)
- `tenancy/` — `withOrgScope` seam + `OrgContext`/guard stub (กฎทอง 3 org-scoping); runtime resolution เต็ม → F-002/F-003 (ปัจจุบันเป็น no-op ที่ label ชัดว่าเป็น stub)

## กฎเมื่อแก้

- ทุก query โดเมนต้องผ่าน `withOrgScope`/กรอง `organizationId`
- อย่า bypass `PrismaService` (guarded client) เพื่อเขียน ledger
- เปลี่ยน request/response shape → แก้ที่ contract (`packages/contracts`) ก่อน แล้ว regen — อย่า hand-write
- โค้ดแตะเงิน/สต๊อก: logic อยู่ `packages/core-domain` (pure) + ต้องมี unit test

## คำสั่ง (source nvm→node22 + `corepack` ก่อน)

`pnpm --filter api build|typecheck|lint` · dev boot ต้องมี Postgres+Redis (`pnpm db:up`)
