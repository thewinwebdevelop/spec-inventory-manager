# 02 — Architecture

## 1. Tech stack

| ส่วน | เลือกใช้ | เหตุผล |
|------|---------|--------|
| Monorepo | **Turborepo + pnpm** | แชร์ type/โค้ดระหว่าง api/web, build cache เร็ว |
| Backend API | **NestJS (TypeScript)** | modular/DDD-friendly เหมาะกับ connector หลายตัว, DI, testable |
| Database | **PostgreSQL** | transaction จริง — จำเป็นกับ inventory + accounting |
| ORM | **Prisma** | schema ชัด, migration ดี, type-safe |
| Queue / async | **BullMQ (Redis)** | sync jobs, retry, scheduling (auto-promote ทุก 4 ชม.) |
| Cache / lock | **Redis** | cache + distributed lock กัน race ตอน sync |
| Web | **Next.js + TypeScript + Tailwind + shadcn/ui** | admin UI ใช้ง่าย, SSR |
| Mobile | **Flutter (Dart)** | ตามที่กำหนด — consume REST ผ่าน OpenAPI client |
| API contract | **OpenAPI** | generate client ให้ Flutter + web อัตโนมัติ → สัญญาเดียว |
| Auth | own (JWT access + refresh) | ต้องคุม subscription/permission เอง |
| Billing | Stripe + ช่องทางไทย (Omise/2C2P) | subscription |
| Docs/PDF | PDF lib + ฟอนต์ไทย | ใบกำกับ/ใบเสร็จ |
| Infra (เริ่ม) | Docker + PaaS (Railway/Fly.io) → AWS ECS | เริ่มเร็ว ค่อย scale |
| DB hosting | Managed Postgres (Neon/RDS) | |
| Observability | OpenTelemetry + Sentry | trace sync pipeline |

> mobile เป็น Dart จึงไม่แชร์ type โดยตรงกับ backend → ใช้ **OpenAPI เป็นสัญญากลาง** generate Dart client เพื่อกันคลาดเคลื่อน

## 2. โครงสร้าง monorepo

```
/
├── apps/
│   ├── api/            # NestJS — REST + webhooks + workers (tenant /... + /admin/...)
│   ├── web/            # Next.js — Tenant app (ลูกค้าจัดการร้านตัวเอง, กรอง org)
│   ├── mobile/         # Flutter — Tenant app (client หลักฝั่ง use)
│   └── back-office/    # Next.js — Back-office Console (พวกเรา, ข้าม org, internal) ดู §5
├── packages/
│   ├── core-domain/    # business logic บริสุทธิ์: inventory math, COGS, allocation (มี test หนัก)
│   ├── db/             # Prisma schema + client + migrations
│   ├── connectors/     # ChannelConnector interface + shopee/lazada/tiktok adapters
│   ├── ai/             # (Phase 5) AI provider port + adapters — core-domain ห้ามรู้จัก
│   ├── contracts/      # OpenAPI spec + generated TS types/clients
│   └── config/         # eslint, tsconfig, env schema (zod)
└── docs/
```

> `packages/core-domain` ต้อง **ไม่พึ่ง framework/DB โดยตรง** — เป็น pure function ที่ test ง่าย (inventory & accounting อยู่ที่นี่)

## 3. โมดูลฝั่ง API (NestJS modules)

```
auth · organizations · users-permissions · billing
products · inventory · warehouses · stock-ledger
channels · channel-accounts · listings · sync
orders · dashboard
accounting · documents
ops (label-print, promotions, alerts)
notifications (line)
entitlements · usage-metering · back-office   // (Phase 5 — ดู §7)
ai   // (Phase 5 — บาง ผูก packages/ai, ทุก call เป็น job ผ่าน BullMQ)
```

## 4. Connector abstraction (เสียบ platform ใหม่ได้)

```ts
interface ChannelConnector {
  key: 'shopee' | 'lazada' | 'tiktok';
  // auth
  getAuthUrl(orgId): string;
  exchangeCode(code): Promise<AuthData>;
  refreshToken(auth): Promise<AuthData>;
  // products
  fetchProducts(acc, cursor?): Promise<ExternalProduct[]>;
  // stock
  pushStock(acc, listing, qty): Promise<void>;
  // orders
  fetchOrders(acc, since): Promise<ExternalOrder[]>;
  verifyWebhook(req): boolean;
  parseWebhook(req): WebhookEvent;
  // ops
  getShippingLabel(acc, orderId): Promise<Buffer>;
}
```
เพิ่ม platform ใหม่ = เขียน adapter ใหม่ 1 ตัว โดยไม่แตะ core

## 5. Multi-tenant & security

- **ทุก query กรอง `organizationId`** — บังคับผ่าน Prisma middleware / repository layer (กันลืม)
- token marketplace **เข้ารหัสก่อนเก็บ** (`ChannelAccount.authData`)
- RBAC: role + fine-grained permission ต่อ membership
- audit log สำหรับ action สำคัญ (แก้สต๊อก, ออกเอกสาร, **back-office ทุก action**)
- secrets ผ่าน env (zod-validated) ไม่ commit
- rate-limit ฝั่งเราต่อ org + เคารพ rate-limit ของแต่ละ platform
- **Back-office / super-admin = ข้อยกเว้นเดียวที่ query ข้าม `organizationId`** → ต้องเป็น role แยก (นอก RBAC ของ tenant), บังคับผ่าน guard เฉพาะ + audit ทุกครั้ง ไม่ใช้ Prisma middleware เส้นเดียวกับ tenant
- **แยกเป็นแอปต่างหาก** (`apps/back-office`, Next.js) ไม่ใช่แค่ซ่อนเมนูใน tenant app —
  คนละ deploy / คนละ domain / จำกัด IP-VPN-SSO ภายใน, endpoint ใต้ `/admin/...` มี
  super-admin guard เฉพาะ → ลด blast radius (บั๊ก tenant รั่วข้าม org ไม่ได้). tenant app
  (web + mobile) กับ back-office เป็น **2 audience** แต่ใช้ **API + core-domain ตัวเดียวกัน**

## 6. หลักการออกแบบ
- **Source of truth = ระบบเรา** เสมอ, platform = ปลายทาง
- write path ที่กระทบสต๊อก/เงิน ต้องอยู่ใน DB transaction + เขียน ledger
- งานคุยกับ external API = async ผ่าน queue (retry/idempotent) ไม่ทำใน request หลัก
- core business logic แยกจาก I/O → test ได้โดยไม่ต้องต่อ DB/เน็ต

## 7. Scale seams — entitlements / metering / AI (Phase 5, กันที่ไว้ตั้งแต่ Phase 0)
> ไม่ build ตอนนี้ แต่ออกแบบไม่ให้ปะทีหลังต้องรื้อ billing/write path ดู backlog **F-082..F-086** + data model [docs/01](01-data-model.md#) (stub `PlanDefinition`/`OrgEntitlement`/`UsageEvent`)

- **Entitlements service** = จุดเดียวตอบ `can(orgId, meter)` — ฟีเจอร์ห้ามอ่าน plan/limits ตรงๆ ทุกอย่างผ่าน service นี้ (resolved = plan.limits + org overrides)
- **Usage metering** = emit `UsageEvent` **immutable** ทุก action ที่อาจคิดเงิน (วันนี้: orders/sync · วันหน้า: ai.*) → ได้ COGS แยกบรรทัดฟรี
- **AI provider port** — interface กลางใน `packages/ai`, สลับผู้ให้บริการได้โดยไม่แตะ business logic; แยก text (ถูก) กับ image (แพง) เป็นคนละ meter
  ```ts
  interface AiTextProvider  { generate(prompt, opts): Promise<{ text: string; usage: TokenUsage }>; }
  interface AiImageProvider { generate(prompt, opts): Promise<{ images: Url[]; cost: Decimal }>; }
  ```
- **ทุก AI call = job ผ่าน BullMQ** (ช้า+flaky) ไม่ inline ใน request; flow: `check → reserve quota → enqueue → run → emit UsageEvent → commit`
- **Quota alerts** — เมื่อ usage แตะ threshold (เช่น 80%/100%) ยิงผ่าน notification infra เดิม (F-028) ออก web + app
- **Back-office** = console ฝั่งเรา จัดการ PlanDefinition / apply package → org / override / ดู usage / support — ดู §5 เรื่อง cross-org boundary

### 7.1 Billing & apply flow (decision — launch)
- **ช่องทางจ่าย launch: บัตร (recurring) + PromptPay QR** ผ่าน gateway (Stripe/Omise/2C2P) → **ยังไม่มีเลนโอน+สลิป** (ถ้าจะเพิ่มทีหลัง = ผ่าน back-office ยืนยันก่อน apply)
- **entitlement เปลี่ยนเฉพาะตอนได้ payment webhook ที่ verify แล้ว** (ไม่ใช่ตอนกดปุ่มซื้อ) — idempotent ด้วย `Payment.gatewayPaymentId`
  ```
  กดซื้อ → gateway → จ่ายสำเร็จ → webhook → verify → update OrgEntitlement/Subscription → ใช้ได้ทันที (auto)
  ```
- **apply policy:** Upgrade = **ทันที + prorate** · Downgrade = **สิ้นรอบบิล** (เก็บไว้ที่ `Subscription.pendingPlanId`)
- **credit pack (AI):** จ่ายครั้งเดียว → webhook → บวก credit เข้า entitlement ทันที
- **จ่ายไม่ผ่าน/หมดอายุ:** `active → past_due → grace (เช่น 7 วัน) → downgrade เป็น free` ไม่ตัดทันที

### 7.2 Client / transport evolution (decision — กันที่ไว้, contract เดียวก่อน)
> **invariant:** business logic อยู่ที่ `core-domain` ที่เดียว · transport (API/endpoint/
> gateway/BFF) บางและเติมเป็นชั้นตามโหลด — **ไม่แยก backend ต่อ client** และ **ไม่กระโดด
> microservices ก่อนเวลา** ตราบใดที่ logic ไม่รั่วออกจาก core ก็เปลี่ยนรูป transport ทีหลังได้เสมอ

mobile (Flutter) เป็น **client หลักฝั่ง use**; web (Next.js) เป็น admin console ฝั่ง setup —
ทั้งคู่กิน **OpenAPI contract เดียว** ผ่าน generated client (Dart/TS) วิวัฒนาการเป็นชั้น:

1. **ตอนนี้:** NestJS API เดียว + contract เดียว + BullMQ workers — ไม่มี proxy แยกต่อ client
2. **เมื่อ mobile chatty / payload หนัก:** เพิ่ม **mobile-tailored endpoint ใน API เดิม**
   (เช่น `GET /mobile/dashboard` aggregate ช็อตเดียว) — ได้ ~80% ของ BFF โดยไม่ deploy แยก
3. **เมื่อ scale (Productize):** + **API Gateway** ที่ edge (TLS, auth, rate-limit ต่อ org, WAF)
   + แยก **sync/connector workers** เป็น deployable ของตัวเอง (โหลด queue คนละ profile กับ
   request API) + multi-tenant hardening → **F-087**
4. **ถ้า mobile แตกต่างหนักจริง / คนละทีมดูแล:** ยก tailored layer เป็น **Mobile BFF** บางๆ ที่
   consume core services เดิม (ไม่มี logic ของตัวเอง) → **F-095** (icebox, optional)

> เงื่อนไขจะแยกจริง = วัดจาก **metric** (latency / round-trip / payload size) ไม่ใช่เดา;
> ตอนแยกทุกขั้น **`core-domain` ห้ามแตะ**
