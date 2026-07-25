# Backend Architecture (definitive) — apps/api + packages/* สำหรับ backlog เต็ม ~40+ features

> **สถานะ: proposed (2026-07-11)** — ผลของรอบ "architecture deep-design" ตาม
> [design-brief.md](design-brief.md) §4 · ออกแบบจากศูนย์ (เสมือนมีแค่ F-001) แล้วค่อยเทียบกับโค้ดจริง (§6)
> ครอบคลุม `apps/api` (NestJS) + `packages/core-domain` + `packages/db` + `packages/connectors` +
> `packages/contracts` — ทั้งหมดที่ backend-api เป็นเจ้าของตาม [workspace-map](../workspace-map.md)
> ใช้คู่กับ: [docs/01-data-model.md](../01-data-model.md) · [docs/02-architecture.md](../02-architecture.md) ·
> [docs/03-sync-engine.md](../03-sync-engine.md) · [docs/04-accounting.md](../04-accounting.md) ·
> [architecture/mobile.md](mobile.md) + [architecture/web.md](web.md) (client ที่ contract นี้ต้อง serve)

---

## §1 Design goals + เคสจาก design-brief ที่ต้องตอบ

### 1.1 แรงกดดันจริงที่โครงต้องรับ

1. **Backend คือคนเดียวที่ถือความจริงเรื่องเงิน/สต๊อก** — client ทั้งสองถูกออกแบบให้ "ไม่มี math"
   (mobile §4.3, web §4.3): ทุกตัวเลขมาจาก server → ความถูกต้องของ ledger, weighted-average,
   availability, VAT ต้องพิสูจน์ได้ด้วย test ฝั่งนี้ที่เดียว ไม่มีตาข่ายชั้นที่สอง
2. **Connector คือความเสี่ยงอันดับหนึ่ง** (design-brief A1/A2) — platform ภายนอกเปลี่ยน spec บ่อย,
   ทำได้ไม่เท่ากัน, ล่มได้, โกหกได้ → ต้องกักความผันผวนไว้ใน `packages/connectors` ทั้งก้อน
   โดย core/sync engine ไม่รู้จัก Shopee เลยแม้แต่ type เดียว
3. **ทีมที่ build คือ AI agents ปั๊มทีละ feature** — pattern ที่ถูกลอกบ่อยสุด (write primitive,
   org scoping, module ใหม่) ต้อง "ลืมแล้วพัง CI" ไม่ใช่ "จำได้ก็รอด" และต้องมี exemplar ลอกได้ทันที
4. **Deploy เดียววันนี้ แต่ split-ready** (docs/02 §7.2, F-087) — API กับ sync workers อยู่ process
   เดียวตอน dogfood แต่ต้องแยก deployable ได้โดยไม่ย้ายไฟล์ (แค่เปลี่ยน env)
5. **Contract คือสัญญาที่ client 2 ภาษา (TS/Dart) generate จากไฟล์เดียว** — ทุก convention ระดับ wire
   (error envelope, pagination, org header, job resource) ต้องนิยามครั้งเดียวใน `packages/contracts`
   และตรงกับ `ApiFailure` taxonomy ที่ mobile/web ล็อกไปแล้ว

### 1.2 ตาราง case coverage (design-brief §2 — กลุ่มที่ backend ต้องตอบ)

| Case | คำตอบเชิงโครง (ชี้ §) |
|---|---|
| **A1** เพิ่ม platform = adapter 1 ตัว + capability declaration | `ChannelConnector` port + `ConnectorCapabilities` + registry — playbook §5.4 (zero core edits) (§3.2) |
| **A2** platform spec เปลี่ยนบ่อย | anti-corruption: DTO ภายนอกอยู่ได้เฉพาะ `packages/connectors/<platform>/mapping/`, mapping = โค้ด, endpoint/rate-limit/retry = config, contract test ต่อ adapter + FakePlatform (§3.2) |
| **A3** feature ใหม่ = module ใหม่ | module-per-feature-area ใน apps/api + bright-line rule "อะไรอยู่ไหน" (§2.1) + playbook §5.3 |
| **A4** เพิ่ม client/transport ใหม่ | logic อยู่ core-domain + service layer; controller เป็นชั้นบาง; back-office = `/admin/**` audience แยก guard แยก (§2.2, §3.3) |
| **A5** เพิ่ม document type/ภาษีใหม่ | document type registry + numbering series ต่อ type + VAT/WHT เป็น pure fn (§3.7) |
| **A6** เพิ่ม notification channel | `NotificationChannelPort` + adapter ต่อช่องทาง, ผู้เรียกยิง event ไม่รู้ช่องทาง (§3.8) |
| **A7** payment gateway / AI provider | idiom port+adapter เดียวกัน: `PaymentGatewayPort` (billing), `packages/ai` (docs/02 §7 ล็อกแล้ว) (§3.8) |
| **B1** ทุก query ผูก organizationId | `OrgContextMiddleware` (ALS) → `OrgPrisma` (org-scoped client extension) เป็น**ทางเดียว**ที่ domain module ได้ DB client + CI gate ห้าม inject `PrismaService` ตรง (§3.3) |
| **B2/B3** entitlements ↔ RBAC ไม่ปนกัน | `@RequireFeature()` (tier, 403 `ENTITLEMENT_REQUIRED`) แยกจาก `@RequireCapability()` (role, 403 `FORBIDDEN`) — client แยก `EntitlementFailure`/`ForbiddenFailure` ได้จาก code (§3.3, §3.5) |
| **B4** ledger + transaction ผ่าน primitive เดียว | `ledgerWrite()` — §3.1 ทั้ง section + grep gate ห้าม `stockMovement.create` นอก primitive (§5.2) |
| **B5** Decimal/int/THB/UTC | schema `Decimal(18,4)` + stock Int (มีแล้ว), core-domain รับ `Money = string \| Decimal`, seam rule "Prisma Decimal → `.toString()` ห้าม `Number()`" (§2.4) |
| **B6** error taxonomy กลาง | envelope `{ error: { code, message, ... } }` mapping 1:1 กับ `ApiFailure` ของ client + exception filter กลาง (§3.5) |
| **B7** audit log seam | `@Audited()` interceptor + `AuditService.record()` — feature enroll ด้วย decorator เดียว (§3.3) |
| **B8** testability | functional core / imperative shell + DI ทุกชั้น + int lane แยก (§5) |
| **C1** external = async queue เสมอ | BullMQ queue naming/ownership convention + worker-mode assembly (§2.3, §4) |
| **C2** idempotency ทุก inbound | unique keys ใน schema + `IdempotencyRecord`/`LedgerCommand` + webhook event dedupe (§3.1, §4.2) |
| **C3** serialize ต่อ resource | DB row lock (`SELECT … FOR UPDATE` เรียง key กัน deadlock) = ความถูกต้อง; queue dedupe/limiter = ประสิทธิภาพ — สองชั้นแยกหน้าที่ (§3.1, §4.3) |
| **C4** reconciliation + drift transparency | reconcile job ต่อ account + `SyncDrift` บันทึกทุกครั้งที่แก้ (§4.4) |
| **C5** rate-limit ต่อ platform ต่อ account | limiter สองชั้น: BullMQ limiter ต่อ queue + token bucket ต่อ account ใน worker, ค่าอยู่ใน connector config (§4.3) |
| **C6** partial failure ราย listing | push job ต่อ listing + สถานะบน `ChannelListing`/`SyncJobLog` — retry เฉพาะตัวที่ fail (§4.3) |
| **C7** token lifecycle | `TokenVault` (encrypt at rest) + auto-refresh ใน connector client + `NEEDS_REAUTH` → notification (§3.2, §4.5) |
| **E1** contract เดียว + evolution | spec-first ยืนยัน + pagination/job/error components กลาง + oasdiff CI gate (§3.6) |
| **E2** versioning ภายใน connector | `mapping/v2/`, `mapping/v3/` ต่อ adapter — ไม่รั่วออกนอก package (depcruise rule) (§3.2) |
| **E3** schema evolution | expand→migrate→contract + ledger ห้ามแตะ (skill prisma-migration) — หมายเหตุใน §5.2 |
| **F1** token/secret at rest | `authData` เข้ารหัส AES-256-GCM ผ่าน `TokenVault` seam เดียว (§3.2) |
| **F2** tenant isolation ทุกชั้น | `OrgPrisma` + back-office เป็น `SystemPrisma` เส้นแยก มี super-admin guard + audit บังคับ (§3.3) |
| **F3** PDPA | buyer PII อยู่บน `Order` เท่านั้น + retention/export/delete seam ใน orders module (§2.2 หมายเหตุ) |
| **F4** webhook signature + replay | `verifyWebhook` ต่อ connector + `WebhookEvent` unique dedupe + timestamp window (§4.2) |

---

## §2 Target topology

### 2.1 Bright-line rule: โค้ดชิ้นนี้อยู่ที่ไหน (กติกาที่ agent ใช้ตัดสินได้ใน 10 วินาที)

ถามเรียงตามลำดับ — ข้อแรกที่ตอบ "ใช่" คือคำตอบ:

1. **เป็นการตัดสินใจ/คำนวณที่รับ data เข้า คืนค่าออก โดยไม่แตะ I/O เลยใช่ไหม?**
   → `packages/core-domain` (pure fn, test ด้วย in-memory data ล้วน) — availability, allocation,
   weighted-average, COGS, VAT/WHT, movement plan, reuse-decision, entitlement resolve, push-decision
2. **เป็น schema / Prisma client / guard ระดับ data-access / ledger-write mechanism ใช่ไหม?**
   → `packages/db` — ใช้ Prisma ได้ ห้ามใช้ NestJS (เพื่อให้ deployable ไหนก็ใช้ได้ตอน split F-087)
3. **เป็นการคุยกับ marketplace ภายนอก (HTTP/webhook/signing/mapping) ใช่ไหม?**
   → `packages/connectors` — framework-free (ไม่มี Nest/Prisma) เพื่อ contract-test ได้เพียว
4. **เป็น shape ของ request/response/error/pagination ที่ client เห็นใช่ไหม?**
   → `packages/contracts` (OpenAPI YAML — แก้ที่นี่ก่อนเสมอ แล้ว regen)
5. **ที่เหลือทั้งหมด (orchestration: อ่าน → เรียก core-domain → เขียน → enqueue, guard, controller,
   worker, DI)** → `apps/api` module ของ feature นั้น

Litmus สั้น: **"ไฟล์นี้ต้องการ DI หรือ DB ไหม?"** ไม่ต้องการทั้งคู่ = core-domain ·
**"ไฟล์นี้รู้จักชื่อ Shopee ไหม?"** รู้ = connectors เท่านั้น

### 2.2 Module map ของ apps/api (รองรับ backlog เต็ม Phase 0–5)

```
apps/api/src/
├── main.ts                  # bootstrap — env validate ก่อน import Nest (มีแล้ว, KEEP)
├── app.module.ts            # ประกอบ module ตาม APP_ROLE (§2.3)
├── common/                  # cross-cutting เชิง HTTP: DomainExceptionFilter + error codes,
│   │                        #   @Idempotent() interceptor, org rate-limit guard, request logging,
│   │                        #   pagination helper (cursor encode/decode), force-update guard (426)
├── prisma/                  # PrismaService (guarded client — มีแล้ว) + OrgPrisma/SystemPrisma providers
├── tenancy/                 # OrgContextMiddleware (ALS) + OrgScopeGuard + OrgContextStore (§3.3)
├── health/                  # มีแล้ว — โตเป็น /health/queues + metrics endpoint (§4.6)
├── jobs/                    # async-job resource กลาง: GET /jobs/:id (ทุก queue-backed feature ใช้ร่วม, §3.6)
│
├── auth/                    # F-001 ✅ (มีแล้ว) — org-agnostic โดยตั้งใจ
├── orgs/                    # F-002 organization/license/membership/invitation (+ /orgs/:orgId paths)
├── rbac/                    # F-003 roles + capability registry + @RequireCapability guard
├── entitlements/            # F-007 can()/canAdd() + @RequireFeature guard + resolved cache
├── settings/                # F-004 (+F-004b tax settings ภายหลัง)
├── audit/                   # F-005 append-only AuditLog + @Audited() interceptor + cross-org read seam
│
├── catalog/                 # F-010/F-012 Product + SellableSku + BundleComponent (BOM)
├── inventory/               # F-011/F-013/F-014 InventoryItem/Warehouse/StockLevel/ledger view
│   │                        #   + LedgerWriteService (Nest wrapper ของ primitive §3.1) + AvailabilityService
├── channels/                # F-020/021/022/029 ChannelAccount (OAuth+TokenVault), listings, import,
│   │                        #   ConnectorRegistry provider, webhook controller (§4.2)
├── sync/                    # F-023/025/027 stock push + allocation apply + oversell defense +
│   │                        #   reconciliation + sync health — เจ้าของ queue `sync.*` (§4)
├── orders/                  # F-024/F-026 order inbound + returns/cancellations (+PDPA seam)
├── dashboard/               # F-030 aggregate reads (กำไรหลังหักค่าช่องทาง)
│
├── documents/               # F-040/F-042 เอกสารซื้อ/ขาย + DocumentSequence + PDF jobs (queue `docs.*`) (§3.7)
├── accounting/              # F-041/F-043/F-031 P&L, VAT/WHT reports, export
│
├── ops/                     # F-050/051/052 shipping labels, auto-promote (repeatable job), fee alerts
├── notifications/           # F-028 alert center + NotificationChannelPort (push/LINE/email) — queue `notify.*`
├── bulk/                    # F-092 CSV import/export (queue `bulk.*`, เข้าออกผ่าน ledgerWrite เสมอ)
│
├── billing/                 # F-080 subscription + PaymentGatewayPort + payment webhook (Phase 5)
├── metering/                # F-083 UsageEvent emit + quota (reserve→commit) (Phase 5; seam จาก F-007)
└── admin/                   # F-085 back-office endpoints /admin/** — SuperAdminGuard + SystemPrisma
                             #   + audit บังคับทุก action (ห้ามใช้ tenancy/OrgPrisma เส้นเดียวกับ tenant)
```

กติกา dependency **ภายใน apps/api** (บังคับด้วย dependency-cruiser config ชุดที่สาม — §5.2):

1. feature module import กันได้เฉพาะผ่าน **exported providers** ของ module นั้น (Nest DI) — ห้าม deep-import
   ไฟล์ภายใน module อื่น (`src/<a>/**` ห้าม import `src/<b>/internal/**`; ให้ import จาก `src/<b>/index.ts`)
2. `common/`, `tenancy/`, `prisma/`, `jobs/` = ชั้นกลาง ใครก็ใช้ได้ · ห้าม import feature module กลับ (leaf-ward)
3. `@omnistock/connectors` import ได้เฉพาะ `channels/` + `sync/` + `ops/` (โมดูลที่คุย platform จริง) —
   โมดูลอื่นเห็นแค่ normalized types ที่ re-export ผ่าน channels
4. Prisma generated client (`@omnistock/db` model types) ใช้ได้ทุก module **แต่ instance ต้องมาจาก
   `OrgPrisma`/`SystemPrisma` provider เท่านั้น** — ห้าม `new PrismaClient()` และห้าม inject `PrismaService`
   ตรงใน feature module (allowlist: prisma/, tenancy/, health/, auth/ — ดู §3.3)
5. `admin/` ห้าม import provider จาก tenant feature module ที่ผูก OrgContext — เส้น cross-org แยกทั้งสาย

### 2.3 Workers: deploy เดียววันนี้ / split-ready (F-087) — ตัดสินด้วย env ไม่ใช่ย้ายไฟล์

BullMQ **processor อยู่ใน module เดียวกับ domain ของมัน** (sync processor อยู่ `sync/`, PDF อยู่
`documents/`) — ไม่มีโฟลเดอร์ `workers/` กลาง เพราะจะกลายเป็นกอง orchestration ที่ห่างจาก logic
การแยก deployable ทำที่ **การประกอบ module**:

```ts
// app.module.ts — APP_ROLE: "api" | "worker" | "all" (default "all" ช่วง dogfood)
const httpModules = [AuthModule, OrgsModule, CatalogModule, /* controllers + queue producers */ ...];
const workerModules = [SyncWorkerModule, DocsWorkerModule, NotifyWorkerModule, /* processors */ ...];

@Module({ imports: [
  PrismaModule, TenancyModule, HealthModule, JobsModule,
  ...(role !== "worker" ? httpModules : []),
  ...(role !== "api" ? workerModules : []),
]})
export class AppModule {}
```

แต่ละ feature module ที่มี queue จึงแตกภายในเป็น `xxx.module.ts` (HTTP + producer) กับ
`xxx-worker.module.ts` (processor) — ไฟล์ logic ชุดเดียวกัน ใช้ producer/consumer ร่วม DI
→ F-087 แยก deployable = รัน image เดิม 2 ใบด้วย `APP_ROLE=api` / `APP_ROLE=worker` จบ

**Queue naming/ownership convention** (Redis key จริง = ชื่อนี้ — ห้ามตั้งนอกตาราง):

| Queue | เจ้าของ module | งาน | หมายเหตุ |
|---|---|---|---|
| `sync.recompute` | sync | stock change → หา listing ที่กระทบ + ตัดสินใจ push | dedupe ต่อ inventoryItem |
| `sync.push-stock` / `sync.push-stock-hot` | sync | push เลขไป platform (hot = ของใกล้หมด/0, docs/03 ชั้น A) | limiter ต่อ platform (§4.3) |
| `sync.push-price` | sync | F-029 | กลไกเดียวกับ stock |
| `sync.pull-orders` | sync | polling fallback ต่อ account (repeatable) | docs/03 ชั้น A |
| `sync.reconcile` | sync | เทียบความจริงต่อ account (repeatable) | §4.4 |
| `orders.inbound` | orders | webhook/poll event → upsert order + ตัดสต๊อก | idempotent (§4.2) |
| `docs.render-pdf` | documents | PDF ฟอนต์ไทย | ผล → job resource |
| `notify.send` | notifications | ส่งผ่าน channel port | retry/backoff ของมันเอง |
| `bulk.import` / `bulk.export` | bulk | CSV | progress → job resource |
| `ops.promote` | ops | Shopee auto-promote ทุก 4 ชม. (repeatable) | |
| `billing.webhook-apply` | billing | payment webhook → entitlement apply | idempotent ด้วย gatewayPaymentId |
| `ai.generate` | (packages/ai ผ่าน module ai) | Phase 5 | reserve quota ก่อน enqueue (docs/02 §7) |

กฎ: **ห้ามคุย external API ใน HTTP request handler** — handler ทำได้แค่ validate + enqueue + คืน job id
(C1) ยกเว้น OAuth exchange (F-020) ที่เป็น interactive flow สั้นและ user รออยู่ — อนุญาตแบบระบุชื่อ

### 2.4 packages/core-domain — โครงภายในเมื่อโต + seam กับ imperative shell

```
packages/core-domain/src/
├── shared/          # Money (string|Decimal — มีแล้วใน cost), Quantity guards, rounding helpers
├── auth/            # ✅ มีแล้ว (F-001) — exemplar ของทั้ง package
├── inventory/       # availability.ts (min(floor(avail/qty))), movement-plan.ts (คำสั่งซื้อ→SALE_OUT plan,
│                    #   adjust plan, return plan), low-stock.ts (threshold/mode-switch decision)
├── cost/            # ✅ weighted-average.ts (มีแล้ว) + cogs.ts (Σ component.avgUnitCost × qty)
├── allocation/      # FULL/BUFFER/FIXED/DYNAMIC → เลขที่ push ต่อ listing + concentration decision
├── sync/            # push-decision.ts (target ≠ lastSynced → push?), reconcile-diff.ts (เทียบ 3 ค่า → action)
├── orders/          # order-line resolve (listing→sellable→components), returns math
├── accounting/      # vat.ts (include/exclude, ปัดเศษ), wht.ts, document-number.ts (format เลขรัน —
│                    #   ตัว allocate อยู่ DB §3.7), pnl.ts
└── entitlements/    # resolve.ts (พับ grants ทับ plan.features), quota.ts (นับ vs cap)
```

กติกาที่ล็อก (ต่อยอด purity gate ที่มีอยู่):

- **ไม่มี Prisma type ใน core-domain เด็ดขาด** — ทุก fn ประกาศ input/output interface ของตัวเอง
  (แบบ `WeightedAverageInput` ที่ทำแล้ว) · service ฝั่ง apps/api เป็นคน map Prisma row → input shape
  ตรง call site (mapping ตื้น ๆ ไม่ต้องมี mapper layer พิธีการ)
- **Money ข้าม boundary เป็น `string | Decimal`** (decimal.js pinned 10.4.3) — Prisma `Decimal` →
  `.toString()` ที่ seam · **ห้าม `Number()` กับเงินทุกกรณี** · ผลลัพธ์คืน `Decimal` ให้ caller
  ตัดสินการปัด (pattern เดียวกับ weighted-average ปัจจุบัน — ถูกแล้ว อย่าเปลี่ยน)
- **"Functional core, imperative shell" — seam อยู่ที่ service method:** service อ่าน DB (ผ่าน OrgPrisma)
  → ประกอบ input → เรียก pure fn ได้ **แผนงาน (plan/decision object)** → service เอา plan ไปเขียนใน
  `ledgerWrite` — pure fn ไม่มีวันได้เห็น tx และ tx callback ไม่มีสูตรคำนวณ:

```ts
// apps/api/src/inventory/stock.service.ts — รูปที่ถูกลอกทุก feature เงิน/สต๊อก
async adjustStock(cmd: AdjustStockCommand) {
  const item = await this.orgPrisma.inventoryItem.findUniqueOrThrow({ where: { id: cmd.itemId } });
  const plan = buildAdjustmentPlan({ /* core-domain: ตัดสิน movement type/qty/policy */ });
  return this.ledger.write({ actorId: cmd.actorId, idempotencyKey: cmd.idempotencyKey }, plan);
}
```

- ข้อยกเว้นเดียวที่ core-domain "แตะเวลา": รับ `now: Date` เป็น argument เสมอ (แบบ token-lifetime
  ของ F-001) — ห้าม `new Date()` ข้างใน

### 2.5 packages/db — ขยายจาก guard ไปเป็นบ้านของ primitive

```
packages/db/src/
├── ledger-guard.ts       # ✅ Layer-1 guard (มีแล้ว) + trigger migration = Layer-2 (มีแล้ว)
├── tenancy.ts            # ✅ withOrgScope seam (มีแล้ว — stub) → เติม enforcement จริง (§3.3)
├── ledger-write.ts       # ★ ใหม่ (F-011): ledgerWrite primitive — กลไกล้วน ไม่พึ่ง Nest (§3.1)
├── org-models.ts         # ★ ใหม่: รายชื่อ model ที่ org-scoped + allowlist org-agnostic
│                         #   (generate/ตรวจจาก schema — source เดียวที่ tenancy.ts ใช้)
└── outbox.ts             # ★ ใหม่ (F-023): append OutboxEvent ใน tx + sweeper query helpers
```

Schema เพิ่มที่ออกแบบไว้ล่วงหน้า (สร้างจริงตาม feature ที่มาถึง — expand→migrate→contract เสมอ):
`Order`/`OrderItem` (F-024) · `OutboxEvent` (F-023) · `LedgerCommand` + `IdempotencyRecord` (F-011) ·
`WebhookEvent` (F-024) · `SyncDrift`/`SyncJobLog` (F-025/027) · `DocumentSequence`/`AccountingDocument`
(F-004b/040/042) · `AuditLog` (F-005) · `Notification` (F-028) · เพิ่ม `version Int @default(0)` บน
`StockLevel` (optimistic guard ชั้นเสริมตาม docs/03 ชั้น C) + composite index
`(organizationId, inventoryItemId, createdAt)` บน `StockMovement` สำหรับ ledger view

---

## §3 Key patterns (พร้อม code sketch)

### 3.1 The transactional write primitive — `ledgerWrite` (กฎทอง 2+5, pattern ที่ถูกลอกมากที่สุด)

**ปัญหา:** ทุก write เงิน/สต๊อกต้อง (ก) อยู่ใน DB transaction (ข) append ledger (ค) update projection
(ง) กัน race บน balanceAfter (จ) idempotent (ฉ) ปล่อย event ให้ sync engine — ถ้าปล่อยให้แต่ละ feature
ประกอบเอง 6 อย่างนี้ จะมีสัก feature ทำครบ 5

**ตำแหน่ง:** กลไกอยู่ `packages/db/src/ledger-write.ts` (function รับ client — ใช้ได้ทั้ง api และ
worker deployable ตอน split) · apps/api มี `LedgerWriteService` (inventory module) ห่อบาง ๆ เติม
OrgContext + actor + enqueue หลัง commit

**API shape:**

```ts
// packages/db/src/ledger-write.ts
export interface MovementEntry {
  inventoryItemId: string;
  warehouseId: string;
  type: StockMovementType;          // PURCHASE_IN | SALE_OUT | ADJUST | ...
  quantity: number;                 // int, +/- ; ห้ามเป็น 0
  unitCost?: string;                // money string (Decimal ที่ caller stringify แล้ว)
  refType?: string; refId?: string;
  allowNegative?: boolean;          // นโยบายจาก core-domain plan (backorder D-lever) — default false
}
export interface ReservationEntry { inventoryItemId: string; warehouseId: string; reservedDelta: number; }
export interface LedgerPlan {       // ← ผลลัพธ์จาก pure fn ใน core-domain
  movements: MovementEntry[];
  reservations?: ReservationEntry[];
  costUpdates?: { inventoryItemId: string; newAvgUnitCost: string }[];   // จาก weightedAverageCost
  events?: { topic: string; payload: unknown }[];                        // outbox topics เพิ่มเติม
}

export async function ledgerWrite(
  client: GuardedPrismaClient,
  ctx: { organizationId: string; actorId: string | null; idempotencyKey?: string },
  plan: LedgerPlan,
): Promise<LedgerWriteResult> {
  return client.$transaction(async (tx) => {
    // 0) idempotency: INSERT LedgerCommand(orgId, key) — unique violation → อ่านผลเดิมคืน (no-op)
    if (ctx.idempotencyKey) { /* insert-or-return-previous */ }

    // 1) lock StockLevel ทุกแถวที่แตะ — เรียง (warehouseId, inventoryItemId) กัน deadlock
    //    SELECT ... FOR UPDATE (สร้างแถว StockLevel ถ้ายังไม่มี แล้วค่อย lock)
    const levels = await lockStockLevels(tx, ctx.organizationId, keysOf(plan));

    // 2) ต่อ movement: newOnHand = onHand + quantity; ถ้า < 0 และไม่ allowNegative → InsufficientStockError
    //    append StockMovement { ..., balanceAfter: newOnHand, createdBy: ctx.actorId }
    //    update StockLevel.onHand (+ reserved ตาม reservations) + version++
    // 3) apply costUpdates → InventoryItem.avgUnitCost (Decimal string)
    // 4) append OutboxEvent: stock.changed ต่อ inventoryItem ที่กระทบ + plan.events
    // 5) return { movementIds, affectedItemIds }
  }, { isolationLevel: "ReadCommitted" });   // ถูกต้องเพราะทุกอย่างอยู่หลัง row lock
}
```

**การตัดสินใจสำคัญ + ทางเลือกที่เทียบ:**

| เรื่อง | เลือก | ทางเลือกที่ตัดทิ้ง + เหตุผล |
|---|---|---|
| serialize `balanceAfter` | **row lock บน StockLevel (`FOR UPDATE`) เรียง key** — ความถูกต้องอยู่ใน DB, ข้าม process ได้ฟรี, ตายแล้วปล่อย lock เอง | Redis distributed lock: เป็น advisory (clock skew/TTL หมดกลางคัน = เขียนชนได้) — ใช้เป็น optimization ชั้น queue ได้ ห้ามเป็น guarantee · pg advisory lock: ได้เหมือนกันแต่ต้อง discipline เรื่อง key hashing และไม่ผูกกับแถวจริง — row lock ตรง semantics กว่า · queue-per-key อย่างเดียว: กันได้เฉพาะ path ที่มาทาง queue, HTTP adjust ตรง ๆ หลุด |
| `balanceAfter` นิยาม | onHand ของ `(inventoryItemId, warehouseId)` หลัง apply — snapshot เพื่อ audit (schema ระบุแล้ว) | balance รวมทุก warehouse: คำนวณได้จาก projection ไม่ต้อง snapshot |
| `reserved` ผ่าน ledger ไหม | **ไม่ append movement** — reserved คือ allocation state ไม่ใช่ความจริงของของ (ledger = onHand เท่านั้น) แต่ต้องแก้**ผ่าน primitive เดียวกัน** (อยู่ใน tx, ปล่อย event, audit ได้) | reserved เป็น movement type: ทำ ledger เป็นสองความหมายปนกัน — ยอด onHand จะ derive ไม่ได้ตรง ๆ |
| idempotency | `LedgerCommand(orgId, key)` unique ใน tx เดียวกัน — ผู้เรียกส่ง key เมื่อ retry ได้ (webhook/queue: key = `order:{externalOrderId}:cut`) | unique บน movement เอง: 1 คำสั่ง = หลาย movement (bundle) — dedupe ระดับแถวไม่ตอบ |
| event emission | **transactional outbox** — แถว `OutboxEvent` ใน tx เดียวกับ movement + หลัง commit enqueue ทันที (best-effort) + sweeper (repeatable job) กวาดแถวที่ยังไม่ published ทุก ~15s | enqueue-หลัง-commit อย่างเดียว: crash ระหว่าง commit→enqueue = push หาย จนกว่า reconciliation รอบถัดไป (นานเกินสำหรับของใกล้หมด) · enqueue-ใน-tx: enqueue สำเร็จแต่ tx rollback = push เลขผี — แย่กว่าทุกแบบ |

**กฎบังคับใช้:** `stockMovement.create` ปรากฏได้ไฟล์เดียวคือ `packages/db/src/ledger-write.ts`
(grep gate ใน CI — §5.2) · Layer-1 ledger guard + DB trigger (มีแล้ว) กัน update/delete อยู่แล้ว
→ ครบสามชั้น: สร้างได้ที่เดียว, แก้ไม่ได้จากแอป, แก้ไม่ได้จาก psql

### 3.2 Connector architecture — port + capability + anti-corruption (A1/A2)

```
packages/connectors/src/
├── core/
│   ├── connector.ts        # ChannelConnector port (refine จาก docs/02 §4)
│   ├── capabilities.ts     # ConnectorCapabilities
│   ├── types.ts            # normalized types: ExternalProduct/ExternalOrder/WebhookEvent/PushResult
│   ├── errors.ts           # ConnectorError: Transient | RateLimited(retryAfter) | AuthExpired |
│   │                       #   NotFoundOnPlatform | Permanent(reason) — sync engine ตัดสิน retry จาก type นี้
│   ├── registry.ts         # ConnectorRegistry: Map<ChannelKey, ChannelConnector>
│   └── testing/            # runConnectorContractTests() + fixtures loader
├── fake/                   # FakePlatformConnector — in-memory platform (stock/orders/webhook จำลอง)
│                           #   ใช้โดย contract tests + sync-engine integration tests + dev seed
├── shopee/
│   ├── shopee.connector.ts # implements ChannelConnector — ตัวเดียวที่ export ออก
│   ├── client.ts           # signed HTTP (partner_id/key), auto token refresh, timeout/retry ตาม config
│   ├── config.ts           # ShopeeConfig: baseUrl, endpoints, rateLimit, retryPolicy, apiVersion
│   │                       #   ← จุดที่ "เปลี่ยนบ่อย" เป็น config (A2) — override ได้จาก env/DB
│   ├── mapping/v2/         # ← DTO ดิบของ Shopee อยู่ได้ที่นี่ที่เดียว + แปลง ↔ normalized types
│   └── webhook.ts          # verify (HMAC) + parse → WebhookEvent
├── lazada/ … (F-070)       # โครงเดียวกัน
└── tiktok/ … (F-071)
```

```ts
// core/capabilities.ts — UI/engine ปรับตัวจากอันนี้ ไม่ hardcode per-platform (A1)
export interface ConnectorCapabilities {
  orderWebhook: boolean;              // false → sync engine เปิด polling เป็นทางหลักให้เอง
  shippingLabel: boolean;             // false → ปุ่มพิมพ์ใบแปะหน้าไม่ขึ้น (ส่งผ่าน capability API)
  priceSync: boolean;
  stockPush: { maxBatchSize: number };
  rateLimit: { requestsPerSecond: number; perAccount: boolean };
  tokenRefresh: "auto" | "reauth-only";
}

// core/connector.ts — ทุก method รับ/คืน normalized types เท่านั้น (anti-corruption line)
export interface ChannelConnector {
  readonly key: ChannelKey;
  readonly capabilities: ConnectorCapabilities;
  getAuthUrl(state: string): string;
  exchangeCode(code: string, shopRef?: string): Promise<NormalizedAuthData>;
  refreshToken(auth: NormalizedAuthData): Promise<NormalizedAuthData>;
  fetchProducts(auth: NormalizedAuthData, cursor?: string): Promise<Page<ExternalProduct>>;
  pushStock(auth: NormalizedAuthData, updates: StockUpdate[]): Promise<PushResult[]>;  // ราย listing (C6)
  pushPrice?(auth: NormalizedAuthData, updates: PriceUpdate[]): Promise<PushResult[]>;
  fetchOrders(auth: NormalizedAuthData, since: Date, cursor?: string): Promise<Page<ExternalOrder>>;
  fetchStock(auth: NormalizedAuthData, externalSkuIds: string[]): Promise<PlatformStock[]>; // reconcile ใช้
  verifyWebhook(headers: Record<string, string>, rawBody: Buffer): boolean;
  parseWebhook(rawBody: Buffer): WebhookEvent[];
  getShippingLabel?(auth: NormalizedAuthData, externalOrderId: string): Promise<Buffer>;
}
```

การตัดสินใจ:

- **mapping = โค้ดในโฟลเดอร์ versioned, ไม่ใช่ config** (design-brief A2 ระบุเองว่า config-only mapping
  เปราะเกิน) · สิ่งที่เป็น config: endpoint URL, rate limit, retry/backoff, API version ที่ active
- **platform API version = โฟลเดอร์ `mapping/vN/`** สลับด้วย config ต่อ environment/account — ตอน
  Shopee ประกาศ v3: เพิ่ม `mapping/v3/` ข้าง v2, contract test รันทั้งสอง, ทยอยสลับ, ลบ v2 เมื่อไม่มี
  account ค้าง — **นอก package ไม่มี diff แม้บรรทัดเดียว** (พิสูจน์ด้วย depcruise rule: import DTO
  ดิบได้เฉพาะภายใน `packages/connectors/<platform>/**`)
- **token เข้ารหัสที่ rest (F1):** connector ไม่รู้เรื่อง encryption — `channels/` module มี `TokenVault`
  (AES-256-GCM, key จาก env → KMS ภายหลัง) แปลง `ChannelAccount.authData` ↔ `NormalizedAuthData`
  จุดเข้ารหัส/ถอดรหัสมีที่เดียว · refresh fail ถาวร → status `NEEDS_REAUTH` + notification (C7)
- **contract test kit (`core/testing/`):** ชุด test มาตรฐานที่ทุก adapter ต้องผ่าน — (ก) mapping
  round-trip กับ fixture จริงที่บันทึกจาก sandbox (ข) error mapping: 429 → `RateLimited`,
  token expired → `AuthExpired` (ค) webhook verify กับ signature จริง/ปลอม · ส่วน **FakePlatformConnector**
  เป็น in-memory platform เต็มตัว (ถือ stock/orders, ยิง webhook ได้) ให้ sync-engine integration test
  วิ่งจบ loop โดยไม่แตะเน็ต — commitment ตาม G-3/D-013
- **NestJS-free ทั้ง package:** adapter เป็น class ธรรมดา สร้างผ่าน factory ที่รับ config —
  apps/api `channels/` module ประกอบเข้า `ConnectorRegistry` provider (DI จุดเดียว)

### 3.3 Org enforcement — ทำให้ "ลืมแล้วพัง" (B1/B2/B3/F2)

**Convention ระดับ wire (ตอบ client ทั้งสองที่ standardize แล้ว):** org-scoped endpoint ทุกตัวรับ
**header `X-Organization-Id`** (mobile orgDio / web useOrgApiClient ส่งอยู่แล้ว) · path `/orgs/:orgId/**`
สงวนไว้เฉพาะ resource ที่ "org เป็นตัว resource เอง" (org profile, members, invitations — F-001 endpoint 8
อยู่รูปนี้แล้ว ถูกต้อง) · ถ้ามีทั้ง header และ path param → guard บังคับว่าตรงกัน ไม่ตรง = 403

**Chain ภายใน (เติมของจริงลงตะเข็บ F-000 ที่ขุดไว้แล้ว):**

```
OrgContextMiddleware (ใหม่ — ตาม note ใน org-scope.guard.ts: guard wrap ALS ไม่ได้, middleware ทำได้)
  อ่าน Bearer → userId · อ่าน X-Organization-Id → ตรวจ Membership active → โหลด capabilities +
  entitlements (cache Redis TTL 60s) → OrgContextStore.run({ organizationId, userId, capabilities,
  entitlements }, next)
OrgScopeGuard (เติม body จริง)   → route ที่ mark org-scoped: ไม่มี context = 401/403
@RequireCapability("manage_stock") → RBAC guard อ่าน context (B3) → 403 { code: "FORBIDDEN" }
@RequireFeature("accounting")      → Entitlement guard ถาม EntitlementsService.can() (B2)
                                     → 403 { code: "ENTITLEMENT_REQUIRED", details: { feature } }
@Audited("stock.adjust")           → interceptor append AuditLog (actor/org/action/target) — B7
```

**ชั้น data-access — จุดที่ "ลืมไม่ได้" จริง:** เทียบ 3 ทาง

| ทางเลือก | ตัดสิน |
|---|---|
| (ก) วินัย: ทุก query ใส่ `where: { organizationId }` เอง | ตกรอบ — คือสิ่งที่ design-brief สั่งให้เลิก |
| **(ข — เลือก) Prisma client extension ต่อ request:** `OrgPrisma` provider (REQUEST-scoped หรือ factory จาก ALS) คืน `withOrgScope(prisma.client, ctx)` ที่ **inject `organizationId` ลง where/data ทุก operation** ของ model ที่อยู่ใน `org-models.ts` (org-agnostic models = allowlist ระบุชื่อ: User, RefreshToken, Channel, PlanDefinition) | seam มีแล้ว (F-000 ขุดไว้) แค่เติม body · `$extends` เป็น proxy เบา สร้างต่อ request ได้ · ครอบทุก path รวม raw ที่พลาด model ไม่ได้ → ห้าม `$queryRaw` ใน feature module (gate) |
| (ค) Postgres RLS (`SET app.org_id` + policy ต่อ table) | แข็งแรงสุดแต่แพง: ผูก session state กับ pooling (pgbouncer transaction mode ต้อง SET ทุก tx), migration ซับซ้อนขึ้นทุกตาราง — **จดเป็น hardening option ของ F-087** ไม่ใช่วันนี้ (ชั้น ข ทดสอบอัตโนมัติได้ครบก่อน) |

การบังคับที่ทำให้ระบบพังตอน CI ถ้า agent เลี่ยง: (1) depcruise + lint rule — feature module ห้าม import
`PrismaService`/`@omnistock/db` client โดยตรง (allowlist: `prisma/`, `tenancy/`, `auth/`, `health/`)
ต้อง inject token `ORG_PRISMA` (2) integration test มาตรฐาน "cross-org leak" ใน test kit: seed 2 org
→ ยิงทุก endpoint ใหม่ด้วย org B ต้องไม่เห็นข้อมูล org A (template ใน playbook §5.3)

**Back-office (F2):** `admin/` module ใช้ `SystemPrisma` (client เดิมไม่ห่อ org-scope) + `SuperAdminGuard`
(audience/role แยกจาก tenant RBAC) + `@Audited` **บังคับทุก endpoint** — ไม่ผ่าน `withOrgScope` และห้าม
tenant module import `SystemPrisma` (depcruise)

### 3.4 Idempotency-key middleware (mutating endpoints)

Header `Idempotency-Key` (client gen UUID ต่อ action) บน POST ที่สร้างผลเงิน/สต๊อก/เอกสาร —
`@Idempotent()` interceptor: มี key → lookup `IdempotencyRecord(orgId, key, endpoint, requestHash)`
· hit + จบแล้ว → replay response เดิม (status + body snapshot) · hit + กำลังทำ → 409 `IN_PROGRESS` ·
miss → ทำงานแล้วบันทึก · TTL 24 ชม. — ตัวนี้กัน "กดซ้ำ/เน็ตสะดุด retry" ระดับ HTTP; ส่วน `ledgerWrite`
มี `LedgerCommand` ของตัวเองกันระดับ domain (webhook/queue ไม่ผ่าน HTTP interceptor) — สองชั้นตั้งใจ

### 3.5 Error contract — envelope เดียว mapping 1:1 กับ `ApiFailure` ของ client (B6)

Wire envelope (ต่อยอด `ErrorResponse` เดิมแบบ **additive** — field ใหม่ optional ทั้งหมด):

```yaml
ErrorResponse:
  error:
    code: string          # UPPER_SNAKE machine code — client switch จากตัวนี้ (ห้ามเปลี่ยนค่าที่ ship แล้ว)
    message: string       # user-facing ไทย (client มี fallback กลางของตัวเองเสมอ)
    details?: object      # เช่น { feature: "accounting" } สำหรับ ENTITLEMENT_REQUIRED
    fieldErrors?: { [field]: string }   # 422 — map ลงฟอร์ม (ValidationFailure.fieldErrors)
    traceId?: string      # correlation สำหรับ support/log (§4.6)
```

ตาราง mapping ที่ล็อกกับ client taxonomy (mobile §3.4 / web §3.4):

| HTTP + code | client failure |
|---|---|
| (ต่อไม่ติด/timeout — ไม่มี response) | `NetworkFailure` |
| 429 + `RATE_LIMITED` + `Retry-After` header | `ThrottledFailure(retryAfter)` |
| 401 (ทุก code หลัง refresh แล้ว) | `AuthExpiredFailure` |
| 403 + `FORBIDDEN` | `ForbiddenFailure` (RBAC) |
| 403 + `ENTITLEMENT_REQUIRED` + `details.feature` | `EntitlementFailure` (tier — CTA อัปเกรด) |
| 422 + `VALIDATION_FAILED`/specific + `fieldErrors` | `ValidationFailure` |
| 409 + code เฉพาะ (`DUPLICATE_*`, `CONFLICT`, `IN_PROGRESS`) | `ConflictFailure` |
| 404 + `NOT_FOUND` | `NotFoundFailure` |
| 5xx | `ServerFailure` |
| 426 + `APP_UPDATE_REQUIRED` | `ForceUpdateFailure` (guard กลางอ่าน `X-App-Version` — F-006 seam) |

ในโค้ด:

- **core-domain โยน typed error ที่ไม่รู้จัก HTTP** — `InsufficientStockError`, `InvalidCompositionError`,
  `QuotaExceededError` ฯลฯ (class ธรรมดาใน core-domain, มี machine code ติดตัว)
- **`DomainExceptionFilter` (global, `common/`)** ถือ registry `errorClass → { status, code }` —
  ที่เดียวที่รู้ว่า `InsufficientStockError` = 409 `INSUFFICIENT_STOCK` · error ไม่รู้จัก → 500
  `INTERNAL` + log เต็ม (ไม่ leak รายละเอียด)
- **Validation ที่ edge: คง class-validator** (ตัดสิน) — เหตุผล: ValidationPipe ปัจจุบันผ่าน security
  review แล้ว (415/422 semantics, whitelist strip), Nest-idiomatic, และ business validation จริงอยู่
  core-domain อยู่แล้ว — เปลี่ยนเป็น zod ทั้ง API ได้ consistency กับ config แต่ต้อง re-review edge
  ทั้งหมดโดยไม่ได้คุณค่าใหม่ · **กัน drift กับ contract ด้วย type-level check:** DTO/response ประกาศ
  `satisfies components["schemas"]["X"]` จาก generated `schema.d.ts` → contract เปลี่ยนแล้วโค้ดไม่ตาม
  = typecheck แดง (แรงกว่าตาคน) · ปรับ ValidationPipe ให้ส่ง `fieldErrors` ครบทุก field (additive จาก
  พฤติกรรม first-constraint ปัจจุบัน)

### 3.6 Contract conventions (E1) — spec-first ยืนยัน + ของกลางที่ต้องเพิ่ม

- **Spec-first YAML (ยืนยันของเดิม):** 3 consumers (api TS, web TS, mobile Dart) — spec เป็นกลางกว่า
  code-first (nestjs/swagger จะทำให้ "สิ่งที่ implement" กลายเป็นสัญญาโดยพฤตินัย + Dart ต้อง gen จาก
  spec อยู่ดี) · เมื่อไฟล์โต: แตกเป็น `openapi/paths/<domain>.yaml` + `openapi/components/*.yaml`
  แล้ว `redocly bundle` ก่อน gen (โครง redocly มีแล้ว) — เริ่มแตกเมื่อ >~2,000 บรรทัด (Phase 1 แน่นอน)
- **Pagination convention เดียว (D3 ของ client):** cursor-based —
  `GET /stock-items?cursor=<opaque>&limit=25&sort=name:asc&filter[status]=active` →
  `{ items: [...], nextCursor: string|null, total?: number }` · limit default 25 max 100 · cursor เป็น
  opaque base64 (id+sort key) ห้าม client แกะ · `total` เป็น optional — จอ admin table ขอได้
  (`?withTotal=true`, count แพงให้ cap) ส่วน mobile infinite scroll ไม่ขอ — สอดคล้อง mobile §4.1
  (บังคับ cursor) และ web DataTable (TanStack Table รองรับ `pageCount` unknown)
- **Async-job resource (ตอบ job-progress polling ของ client ทั้งสอง):** endpoint ที่งานยาว → `202`
  `{ job: { id } }` · `GET /jobs/{id}` → `{ id, kind, status: queued|running|succeeded|failed,`
  `progress: { done, total?, percent? }, result?: object, error?: ErrorBody, createdAt, finishedAt? }`
  · `jobs/` module map จาก BullMQ state + `JobRecord` table (org-scoped — เห็นเฉพาะ job ของ org ตัวเอง)
  · ใช้ร่วมทุก feature: import (F-021), bulk (F-092), PDF (F-042), report (F-031)
- **Evolution rules:** additive-only หลัง client ship · ลบ/เปลี่ยน = deprecate ก่อน (มี `deprecated: true`
  + วันตาย) → ค่อย remove ตาม skill contract-evolution · **CI diff gate: เพิ่ม job `oasdiff`**
  (breaking-change detector เทียบ base branch) คู่กับ `contracts-drift` (regen-match) ที่มีอยู่ —
  ของเดิมจับ "ลืม regen", ตัวใหม่จับ "แก้แบบ breaking"
- error schema componentized แล้ว (ErrorResponse อ้างทุก path — ถูกต้อง คงไว้) — เพิ่ม `PageMeta`,
  `Job`, `IdempotencyKey` header component ให้ทุก path อ้างแบบเดียวกัน

### 3.7 Accounting subsystem (A5) — type registry + เลขรัน atomic + PDF async

- **Document type registry** (`documents/` module): `DocumentTypeDefinition { code, titleTh,`
  `numberingSeries, vatBehavior, pdfTemplate, requiredFields }` — invoice/receipt/payment_voucher/
  substitute_receipt/purchase_doc เป็น entry ของ registry · เพิ่ม e-Tax/type ใหม่ = เพิ่ม entry +
  template ไม่แตะ flow กลาง (A5)
- **เลขรันต่อเนื่อง atomic (จุดยากที่รู้ล่วงหน้า — ออกแบบเลย):**

```sql
-- DocumentSequence(id, organizationId, seriesKey, period, current)  @@unique([organizationId, seriesKey, period])
UPDATE "DocumentSequence" SET current = current + 1
WHERE "organizationId" = $1 AND "seriesKey" = $2 AND period = $3
RETURNING current;   -- row lock serialize; อยู่ใน tx เดียวกับ INSERT AccountingDocument
```

  - อยู่ **tx เดียวกับการสร้างเอกสาร** → rollback = เลขถอยกลับด้วย = **ไม่มี gap ไม่มีซ้ำ** (ข้อกำหนด
    เอกสารภาษีไทย docs/04 §7) · เทียบ Postgres `SEQUENCE`: ไม่ per-org, ไม่ gapless (nextval ไม่ rollback)
    — ตกรอบ · throughput ต่อ series ถูก serialize — ยอมรับ (ร้านหนึ่งไม่ออกใบกำกับพันใบ/วินาที)
  - concurrency test บังคับ: ยิงขนาน 50 → เลขต่อเนื่อง 1..50 ไม่ซ้ำไม่ข้าม (§5.1)
- **VAT/WHT = pure fn ใน core-domain/accounting** — include/exclude, ปัดเศษสตางค์ (นโยบายปัดระบุชัด
  ใน fn + ให้นักบัญชีจริง review ก่อน production ตาม docs/04) · ภ.พ.30/ภ.ง.ด. = aggregate query +
  pure formatter
- **PDF = job `docs.render-pdf`** (ฟอนต์ไทย embed) — HTTP ตอบ job id, ไฟล์เก็บ object storage,
  `GET /documents/{id}/pdf` redirect/stream เมื่อเสร็จ

### 3.8 Ports สำหรับ external services (A6/A7) — idiom เดียวทั้งระบบ

Idiom: **interface + injection token อยู่ module ผู้ใช้ · adapter เป็น provider ที่ bind ตอน module
ประกอบ · ทุก call จริงห่อใน BullMQ job** (ยกเว้น interactive สั้น):

```ts
// notifications/ports/notification-channel.port.ts (F-028)
export interface NotificationChannelPort {
  readonly key: "push" | "line" | "email";
  send(msg: NotificationMessage): Promise<SendResult>;
}
// ผู้เรียกทั่วระบบไม่รู้จัก port ด้วยซ้ำ — ยิง NotificationsService.notify(orgId, event) →
// service ตัดสิน channel ตาม preference → enqueue notify.send → worker เลือก adapter จาก key (A6)
```

- `PaymentGatewayPort` (billing, Phase 5): `createCheckout / verifyWebhookEvent / cancelSubscription` —
  entitlement เปลี่ยนเฉพาะใน webhook handler ที่ verify แล้ว + idempotent ด้วย `Payment.gatewayPaymentId`
  (docs/02 §7.1 ล็อกไว้แล้ว — โครงนี้แค่ชี้ว่า handler อยู่ `billing/`, queue `billing.webhook-apply`)
- AI: `packages/ai` ตาม docs/02 §7 (text/image แยก meter, reserve→commit) — ไม่ออกแบบซ้ำที่นี่
- ต่างจาก connectors ยังไง: connector มี lifecycle/capability/registry เต็มรูปเพราะมีหลาย instance
  ต่อ org (หลาย account) — port พวกนี้เป็น singleton config ระดับระบบ จึงไม่ต้องมี registry ต่อ org

---

## §4 Sync engine placement & performance

### 4.1 Event flow (docs/03 → ตำแหน่งจริงในโครง)

```
ledgerWrite commit (inventory/)                      [ทุก path: order, adjust, purchase, return, CSV]
  └─ OutboxEvent stock.changed{orgId, inventoryItemId}
       └─ dispatcher (หลัง commit + sweeper) → queue sync.recompute (dedupe jobId = item)
            └─ recompute worker (sync/):
                 BundleComponent → sellables ที่ใช้ item → ChannelListing ทั้งหมด (batch query, ไม่มี N+1)
                 core-domain: availability + allocation ต่อ listing → target
                 target ≠ lastSyncedStock → enqueue sync.push-stock (hot ถ้า available ≤ threshold หรือ 0)
                      └─ push worker: connector.pushStock (batch ตาม capability.maxBatchSize)
                           สำเร็จ → update lastSyncedStock/lastSyncedAt (ราย listing — C6)
                           RateLimited → delay ตาม retryAfter · Transient → backoff retry → DLQ
                           AuthExpired → ChannelAccount NEEDS_REAUTH + notify (C7) — ไม่ retry
```

- **Push job = trigger ไม่ใช่ payload:** worker คำนวณค่าล่าสุด ณ ตอนรัน (อ่าน StockLevel ปัจจุบัน)
  → เลขเก่าที่ค้างคิวไม่มีวันถูก push ทับเลขใหม่ + dedupe ต่อ listing ทำให้ 10 movements ติดกัน = push เดียว
- **Defense layer B (docs/03):** low-stock decision (`core-domain/inventory/low-stock.ts`) รันใน
  recompute worker — แตะ threshold → สลับ mode/concentration ตาม policy + available 0 →
  auto-deactivate listing เป็น push แบบพิเศษ (hot queue เสมอ)

### 4.2 Inbound (orders) — webhook-first + polling fallback + idempotency (C2)

- `POST /webhooks/:channelKey` (channels/ — public, ไม่มี org header): อ่าน raw body →
  `connector.verifyWebhook` (F4) → `parseWebhook` → insert `WebhookEvent(channelAccountId, eventId)`
  unique = **replay protection** (ซ้ำ → 200 เงียบ ๆ) → enqueue `orders.inbound` → ตอบ 200 ทันที
  (ห้ามทำงานหนักใน handler)
- order worker: resolve org จาก account → upsert `Order` (`@@unique(channelAccountId, externalOrderId)`)
  → mapping ผ่าน listing → `buildSaleOutPlan` (core-domain, bundle → component cuts + COGS snapshot) →
  `ledgerWrite(..., { idempotencyKey: "order:{id}:cut" })` — ต่อให้ event มาซ้ำสองทาง (webhook + poll)
  ก็ตัดครั้งเดียว (unique สองชั้น)
- polling fallback: `sync.pull-orders` repeatable ต่อ account (ถี่ขึ้นอัตโนมัติถ้า connector ประกาศ
  `orderWebhook: false` หรือ webhook เงียบผิดปกติ) — ยิงเข้า pipeline เดียวกับ webhook

### 4.3 Serialization + rate limit (C3/C5)

- **ความถูกต้อง** อยู่ที่ row lock ใน `ledgerWrite` (§3.1) — ขนานกันแค่ไหนก็ไม่ทะลุ/ไม่ negative
- **ประสิทธิภาพ/ลำดับ** อยู่ที่ queue: `sync.recompute` dedupe ต่อ item (งานเดียวกันไม่ต่อแถวซ้ำ),
  `sync.push-stock` limiter ต่อ platform (BullMQ limiter) + token bucket ต่อ account ใน worker
  (ค่าจาก `capabilities.rateLimit` — perAccount) · Redis lock ใช้ได้เป็น optimization กันงานชนเท่านั้น
  ห้ามเป็นเงื่อนไขความถูกต้อง
- rate limit ฝั่งเรา (ต่อ org ต่อ endpoint กลุ่ม): guard ใน `common/` ใช้ Redis sliding window
  (ยก pattern จาก `throttle.service` ของ F-001) — 429 + `Retry-After` ตรง contract · ที่ edge จริง
  = API gateway ตอน F-087

### 4.4 Reconciliation + drift transparency (C4)

`sync.reconcile` repeatable ต่อ account (เช่นทุก 30 นาที + on-demand จากจอ sync health):
ดึง `connector.fetchStock` ราย listing → เทียบ 3 ค่า (platform จริง / lastSyncedStock / computed
target) ด้วย `core-domain/sync/reconcile-diff.ts` → drift → บันทึก `SyncDrift(listingId, expected,
found, action, at)` + corrective push + metric — จอ F-027 อ่านตารางนี้ตรง ๆ (โปร่งใส ไม่แก้เงียบ)
· order-side: poll เทียบ order ที่มีบน platform แต่ไม่มีในเรา (webhook หาย) → เข้า pipeline inbound

### 4.5 Token lifecycle (C7)

connector `client.ts` auto-refresh ก่อนหมดอายุ (leeway) ผ่าน `TokenVault` → refresh fail ชั่วคราว =
Transient retry · fail ถาวร = `NEEDS_REAUTH` → notification (F-028) + จอ sync health + งาน push ของ
account นั้น pause (ไม่เผา retry ใส่ 401)

### 4.6 Observability & ops

- **Structured logging: nestjs-pino** (JSON) — enrich อัตโนมัติจาก ALS: `traceId`, `organizationId`,
  `userId` · worker: `queue`, `jobId`, attempt — correlation ครบทั้ง request→outbox→job chain
  (`traceId` ส่งต่อใน outbox payload) · `traceId` โผล่ใน error envelope ให้ user แจ้ง support ได้
- **Metrics** (align observability-standard skill — ไม่ redefine): queue depth + oldest-job age ต่อ queue ·
  sync lag (movement.createdAt → push completed) p50/p95 · drift count/รอบ · push failure rate ต่อ
  platform · ledgerWrite duration + lock wait · expose `/metrics` (Prometheus) + OTel trace ตาม docs/02
- health: ของเดิม (Postgres/Redis/queue probe) ครบแล้ว — เพิ่ม readiness แยก role (worker ไม่ probe HTTP)

### 4.7 Performance decisions

- **Availability: คำนวณตอนอ่าน ไม่ precompute เป็น column** — math คือ min/floor บน component ไม่กี่ตัว
  (ถูกมาก) ที่แพงคือ I/O → `AvailabilityService.forSellables(ids)` ยิง **2 query คงที่** (components ทั้ง
  ชุด + StockLevel aggregate ทั้งชุด) แล้วเข้า pure fn — ไม่มี N+1 ทุกขนาด list · ตัวที่ต้อง "จำ" มีอยู่แล้ว
  โดยธรรมชาติ: `lastSyncedStock` (ต่อ listing) และ StockLevel (projection ของ ledger) · ถ้า metric ชี้ว่า
  จอ list ใหญ่ช้า ค่อยเพิ่ม cache สั้น (30s) ที่ระดับ service — ห้าม cache ในจุดที่เลขไป platform
- **Caching allowlist (นอกนี้ = ห้าม):** resolved entitlements + capabilities ต่อ (org,user) TTL 60s +
  invalidate ตอนแก้ role/plan · PlanDefinition/Channel master · connector config — **ห้าม cache**:
  StockLevel, availability ที่ใช้ตัดสินใจ push, ยอดเงินทุกชนิด
- **N+1 discipline:** service method รับ id array เสมอ (แบบ `forSellables`) · ห้าม query ใน loop —
  reviewer จับ + integration test ใช้ Prisma query event นับจำนวน query บน hot path (assert ≤ N คงที่)
- pagination cap ที่ 100 (§3.6) กันทั้ง payload และ query cost · queue throughput สมมติฐานเริ่มต้น:
  ~10 orders/min/org, spike ตอน flash sale — recompute dedupe + batch push ทำให้ push jobs โตช้ากว่า
  movement เสมอ; วัดจริงก่อนถึง F-087

---

## §5 Testing & enforcement

### 5.1 Test lanes (D-014 — unit ประกบโค้ดเสมอ)

| Lane | ครอบอะไร | เครื่องมือ | ห้าม |
|---|---|---|---|
| unit — core-domain | pure fn ทุกตัว: availability/allocation/cost/VAT ตาม matrix ใน skill `money-stock` (ศูนย์/ติดลบ/ปัดเศษ/ทศนิยมยาว/overflow) | vitest, in-memory ล้วน | mock DB (ไม่มี DB ให้ mock อยู่แล้ว) |
| unit — apps/api | guard/interceptor/filter/service ที่ mock ชั้นล่างผ่าน DI (pattern F-001 มีครบ) | vitest + @nestjs/testing | แตะ Postgres/Redis จริง |
| int — `*.int.test.ts` | (ก) `ledgerWrite`: concurrent adjust 20 ขนาน → onHand ถูก, balanceAfter เรียงถูก, ไม่ negative (ข) DocumentSequence ขนาน 50 → ไม่ซ้ำไม่ข้าม (ค) org-scope: 2 org seed แล้ว org B อ่าน/เขียนข้าม org ไม่ได้ทุก endpoint ใหม่ (ง) ledger trigger ปฏิเสธ UPDATE/DELETE (มีแล้ว AC8) | vitest + Postgres/Redis จริง (CI lane `integration-api` มีแล้ว) | ข้าม lane นี้แล้วอ้างว่า "เขียวแล้ว" (บทเรียน F-001 — MEMORY) |
| connector contract | ทุก adapter ผ่าน `runConnectorContractTests` + fixtures ที่บันทึกจาก sandbox · sync-engine e2e กับ `FakePlatformConnector` วิ่ง loop เต็ม (order เข้า → ตัด → push → reconcile) | vitest | เน็ตจริงใน CI (เน็ตจริง = manual lane ก่อน release connector) |
| concurrency/oversell | จำลอง docs/03 §7: ขายพร้อมกันหลาย channel ผ่าน FakePlatform + webhook ซ้ำ → ไม่ตัดซ้ำ ไม่ติดลบ, low-stock trigger ถูก | int lane | |

### 5.2 Boundary gates (ต่อยอด depcruise ที่มี — ไม่ใช่ CI concept ใหม่)

1. **core-domain purity** — มีแล้ว (`omnistock-purity-gate`) · คงไว้
2. **connectors-free-standing (ใหม่):** `packages/connectors` ห้าม import `@nestjs/*`, `@omnistock/db`,
   `@omnistock/contracts` · platform DTO (`<platform>/mapping/**`) ห้ามถูก import จากนอก platform folder
3. **apps/api boundaries (ใหม่ — config depcruise ชุดที่สาม):** กติกา §2.2 ข้อ 1–5 (deep-import,
   ORG_PRISMA allowlist, connectors เฉพาะ channels/sync/ops, admin แยกสาย)
4. **grep gates (script เล็กใน CI):** `stockMovement.create` เฉพาะ `ledger-write.ts` ·
   `new PrismaClient(` เฉพาะ `prisma.service.ts` + test setup · `$queryRaw` ห้ามใน feature module
   (allowlist health/db) · `usageEvent.create` เฉพาะ metering service
5. **contracts:** `contracts-drift` (มีแล้ว) + `oasdiff` breaking-change gate (ใหม่, §3.6)
6. **migrations:** ทุก migration ที่แตะตารางที่มีข้อมูล → ตาม skill `prisma-migration`
   (expand→migrate→contract) · migration ที่แตะ `StockMovement`/`UsageEvent` โครงสร้างเดิม = ต้องมี
   คำอธิบายพิเศษ + review (E3)

### 5.3 New feature playbook — ตัวอย่าง F-011 (Inventory Item + Stock level + Ledger)

```
1. อ่าน docs/01 + spec F-011 (Gate-2 docs) — ยืนยันไม่ชนกฎทอง
2. Contract ก่อน: packages/contracts/openapi — เพิ่ม paths /inventory-items, /warehouses,
   /stock-levels, /stock-movements (cursor pagination §3.6, ErrorResponse กลาง) → pnpm gen:contracts
   → ประกาศ contract change ใน handoff
3. Schema: packages/db/prisma — ตารางมีแล้วจาก F-000; เพิ่ม StockLevel.version + index ledger view
   → migration (prisma-migration skill) → LedgerCommand table
4. core-domain: packages/core-domain/src/inventory/{availability,movement-plan}.ts + test ประกบ
   (matrix money-stock skill)
5. packages/db: ledger-write.ts + int test (concurrency ตาม §5.1)
6. apps/api: src/inventory/ — module + controller (DTO `satisfies` schema) + service (รูป §2.4:
   อ่าน → pure fn → ledgerWrite) + LedgerWriteService wrapper + @RequireCapability("manage_stock")
   + @Audited("stock.adjust") + @Idempotent()
7. Test: unit (service mock ORG_PRISMA) + int (cross-org leak template + concurrent adjust)
8. รัน: pnpm --filter api test && test:integration && lint && typecheck && pnpm depcruise
   → รายงานตามจริง
```

### 5.4 New connector playbook — เพิ่ม platform X (A1 — zero core edits)

```
1. เพิ่มค่าใน enum ChannelKey (schema — additive migration) + seed แถว Channel
2. packages/connectors/src/<x>/ : connector.ts (implements ChannelConnector + ประกาศ capabilities
   ตามที่ platform ทำได้จริง) · client.ts (signing/refresh) · config.ts · mapping/v1/ · webhook.ts
3. บันทึก fixtures จาก sandbox → ผ่าน runConnectorContractTests(<x>) ครบ
4. ลงทะเบียน: apps/api/src/channels/connector.registry.ts เพิ่ม 1 บรรทัด (key → factory)
5. จบ — sync engine/orders/ops อ่าน capability เอง (label ไม่มีก็ไม่โชว์ปุ่ม, webhook ไม่มีก็ poll ถี่ขึ้น)
   ไฟล์ที่แตะนอก packages/connectors: enum + seed + 1 บรรทัด registry — ตรวจได้ใน PR diff
สเปคเปลี่ยน (A2): แก้เฉพาะใน <platform>/ (mapping vN ใหม่/config) + fixtures ใหม่ — depcruise
   การันตีว่านอก package ไม่มีทางพัง compile; contract tests การันตี behavior เดิม
```

---

## §6 Gap analysis vs โค้ดจริง (@ 0e5b3c1 — F-000 + F-001 คือทั้งหมดที่ build แล้ว)

ภาพรวมที่ต้องพูดตรง ๆ: **F-000/F-001 วางตะเข็บตรงกับ design จากศูนย์นี้เกือบทั้งหมด** — guarded client,
ledger trigger สองชั้น, `withOrgScope` seam ที่ note วิธี fill ถูกต้อง (รวม insight ว่า guard wrap ALS
ไม่ได้ ต้องเป็น middleware), env-first bootstrap, spec-first contract + drift gate, core-domain purity gate,
int lane จริงใน CI — ของพวกนี้คือของจริง ไม่ manufacture ความต่าง ช่องว่างเกือบทั้งหมดคือ **ชั้นที่ยังไม่ถูก
สร้าง** (primitive, connectors, sync, jobs) ซึ่ง F-000 ประกาศ defer ไว้ตรงตาม decision (D-004)
**ไม่มีรายการ REBUILD**

| Area | สภาพปัจจุบัน | Verdict | เหตุผล | Effort |
|---|---|---|---|---|
| `main.ts` bootstrap (env-first, trust-proxy, CORS allowlist, 422 envelope) | security-reviewed, ถูกต้อง | **KEEP** | ตรง design; ValidationPipe ต่อยอด additive (fieldErrors) ตอน generalize error | — |
| `auth/` ทั้ง module (F-001) | ครบ, hardened, test หนาแน่น (unit+int) | **KEEP (exemplar)** | เป็นแม่แบบ guard/service/typed-DTO/throttle — org-agnostic ถูกต้องตาม data model | — |
| error envelope ใน auth | `{ error: { code, message } }` **สร้าง inline ต่อ throw** กระจายใน controller/service | **REFACTOR (ก่อน Phase 1 feature แรก)** | pattern นี้ถ้าถูกลอก 30 features = code string หลุด sync — ต้องมี `DomainExceptionFilter` + error-code constants กลาง (§3.5) ก่อน F-010/F-011 เริ่ม; ของ auth เดิมทยอยย้ายได้ ไม่ด่วน | S–M |
| throttle orchestration inline ใน controller | ถูกต้องสำหรับ auth (แต่ละ endpoint มี dimension เฉพาะ) | **KEEP + อย่าลอก** | feature ทั่วไปใช้ org rate-limit guard กลาง (§4.3) — จดใน CLAUDE.md ว่า pattern inline เป็นข้อยกเว้นของ auth | S |
| `members.controller.ts` capability check inline ใน AuthService | ทำงานถูก (404-never-403, org-scoped path) | **KEEP จนถึง F-003** | F-003 แทนด้วย `@RequireCapability` — ไฟล์นี้ระบุเองว่ารอ RBAC จริง; ห้ามลอก inline check ไป feature ใหม่ | S (ตอน F-003) |
| `prisma/prisma.service.ts` (guarded client เดียว) | ตรง design | **KEEP** | เพิ่ม `ORG_PRISMA`/`SYSTEM_PRISMA` providers ข้าง ๆ ตอน F-002 (§3.3) | M (F-002/003) |
| `tenancy/` (OrgContextStore + no-op guard + note middleware) | stub ที่ขุดตะเข็บถูกจุด + เอกสารในโค้ดดีมาก | **KEEP + เติมจริง** | เติม `OrgContextMiddleware` + guard body + `withOrgScope` enforcement ตามแผน F-002/F-003 เดิม — design นี้ยืนยันทิศ (ALS + client extension ชนะ repository layer/RLS สำหรับตอนนี้) | M–L (F-002/003) |
| `packages/db` ledger-guard สองชั้น (extension + trigger) | ครบ, test ครบ, AC8 พิสูจน์ระดับ DB | **KEEP** | คือครึ่งแรกของกฎทอง 2 — ครึ่งหลังคือ primitive | — |
| ledger **write primitive** | ยังไม่มี (defer D-004 → F-011 ตามแผน) | **ADD (ชิ้นสำคัญที่สุดของ Phase 1)** | ออกแบบแล้วใน §3.1 — ต้องมาก่อน/พร้อม F-011 และห้ามมี write เงิน/สต๊อกเส้นอื่นเกิดก่อนมัน + grep gate ทันทีที่ mergeแรก | L (F-011) |
| `schema.prisma` (5 ชั้น + ledger + stubs entitlement) | ตรง docs/01, Decimal(18,4)/Int ถูก, unique/index ครบ | **KEEP + เติมราย feature** | เพิ่ม: StockLevel.version, index (org,item,createdAt) บน StockMovement, Order/Outbox/LedgerCommand/WebhookEvent/SyncDrift/DocumentSequence/AuditLog ตาม §2.5 — ทุกตัว additive | S–M/feature |
| `packages/db/tenancy.ts` (pass-through + compile-test) | seam พร้อม, type gymnastics มีเหตุผล+test pin | **KEEP + เติม enforcement** | เติม where/data injection + `org-models.ts` allowlist (§3.3) | M (F-002/003) |
| `packages/core-domain` (auth/ + cost/) | pure จริง, boundary types ถูก (`Money = string\|Decimal`), test หนัก, purity gate คุม | **KEEP (exemplar)** | โตตามโครง §2.4 — โฟลเดอร์ต่อ domain area; pattern weighted-average คือแม่แบบ | — |
| `packages/connectors` | placeholder ว่าง | **ADD** | สร้างตาม §3.2 เมื่อ F-020: core/ + fake/ + shopee/ + contract test kit — **fake/ ควรเกิดพร้อม core/ ตั้งแต่แรก** ไม่ใช่ตอนมี adapter ที่สอง | L (F-020–025) |
| `packages/contracts` (spec-first YAML + gen TS/Dart + drift CI) | pipeline ครบ ทำงานจริง; ErrorResponse componentized แล้ว | **KEEP + เติม convention** | เพิ่ม PageMeta/Job components + envelope fields (additive), แตกไฟล์ + `redocly bundle` เมื่อโต, เพิ่ม oasdiff gate (§3.6) | S–M |
| `health/` (+ Redis/queue probe, bounded timeout) | ครบตาม AC | **KEEP + โต** | เพิ่ม per-role readiness + `/metrics` ตอน sync features มาถึง (§4.6) | S |
| BullMQ | dependency มีแล้ว (health probe ใช้) แต่ยังไม่มี queue/worker จริง | **ADD** | โครง §2.3 (worker-mode assembly + naming table) เริ่มจริงที่ F-021/F-023 | M (ครั้งแรก) แล้ว S/queue |
| jobs resource (`GET /jobs/:id`) | ยังไม่มี | **ADD** | client ทั้งสอง design รอบ polling รอไว้แล้ว (web §3.7) — ต้องมาพร้อม queue-backed feature แรก (F-021 import) | M |
| validation stack (class-validator ที่ edge + zod ที่ config) | ใช้งานจริง ผ่าน review | **KEEP (ตัดสินแล้ว — ไม่ย้ายไป zod ทั้ง API)** | §3.5 + เพิ่ม `satisfies` contract-type check กัน drift | S |
| `turbo.json` / CI (`node-ci`, `db-migrate`, `depcruise`, `contracts-drift`, `integration-api`) | lanes ครบและเป็นของจริง (int lane รัน DB จริง) | **KEEP + เติม gate** | เพิ่ม: depcruise ชุด connectors + apps/api, grep gates, oasdiff (§5.2) | S |
| `apps/api/CLAUDE.md` | ถูกต้องแต่สั้น — ยังไม่มี pattern บังคับสำหรับ feature โดเมน (primitive/org/queue) | **REFACTOR (rewrite ตาม §7)** | ต้องเสร็จก่อน agent เริ่ม F-010/F-011 ไม่งั้น pattern สำคัญไม่ถูกลอก | S |

**จุดเสี่ยงที่ต้องปิดก่อนถูกลอก (เรียงตามลำดับเวลา):**
1. **DomainExceptionFilter + error-code registry** — ก่อน feature โดเมนแรก (ไม่งั้น inline envelope ระบาด)
2. **`ORG_PRISMA` + enforcement จริงใน `withOrgScope`** — ที่ F-002/F-003 ตามแผนเดิม (ห้ามเลื่อน:
   ทุก feature Phase 1 พึ่งมัน)
3. **`ledgerWrite` + grep gate** — ที่ F-011 ก่อน write path เงิน/สต๊อกเส้นแรก
4. **connectors `core/` + `fake/` เกิดพร้อมกัน** — ที่ F-020 (fake ที่มาทีหลัง = sync engine ถูก test
   กับ Shopee จริงไปแล้ว = แพง)

**ลำดับปิด gap ผูกกับ backlog เดิม (ไม่สร้าง phase ใหม่):** F-002/003 (tenancy จริง + RBAC guards +
exception filter) → F-007 (entitlements + @RequireFeature) → F-010/011 (catalog/inventory + primitive +
availability + จอ list แรกใช้ pagination convention) → F-020–025 (connectors + sync engine + jobs
resource + webhook) → F-004b/040/042 (DocumentSequence + PDF queue) → Phase 5 ตาม seam ที่วางแล้ว

---

## §7 ร่าง guideline สำหรับ `apps/api/CLAUDE.md` (rewrite — คุม packages/* ที่ backend เป็นเจ้าของด้วย)

> ร่างนี้จะแทนที่ apps/api/CLAUDE.md เมื่อชิ้นส่วนใน §6 ลำดับ 1–3 เกิดจริง (กติกาต้องตรงกับโค้ด
> ไม่ใช่ความหวัง) — ส่วน stack/คำสั่ง/nvm ของเดิมคงไว้ · ไฟล์นี้คุมทั้ง `apps/api` และ
> `packages/{core-domain,db,connectors,contracts}` เพราะ backend-api เป็นเจ้าของทั้งหมด

```markdown
## อะไรอยู่ไหน (bright-line — ไล่ตามลำดับ ข้อแรกที่ใช่คือคำตอบ)

1. คำนวณ/ตัดสินใจ ไม่แตะ I/O → packages/core-domain (pure fn + test matrix ประกบ)
2. schema / Prisma / ledger mechanics → packages/db (ห้ามใช้ NestJS ในนี้)
3. คุยกับ marketplace → packages/connectors (ห้ามใช้ NestJS/Prisma ในนี้; DTO platform ห้ามหลุดออก)
4. shape ของ API → packages/contracts (แก้ YAML ก่อนเสมอ → pnpm gen:contracts → ห้าม hand-write type)
5. ที่เหลือ (orchestration/guard/controller/worker) → apps/api/src/<feature-module>/
   exemplar: src/auth/ (edge patterns) · src/inventory/ (โดเมนเงิน/สต๊อก — หลัง F-011)
   playbook เต็ม: docs/architecture/backend.md §5.3 (feature) / §5.4 (connector)

## กฎเหล็ก (CI จับ — รันก่อนส่งงาน: test + test:integration + lint + typecheck + depcruise)

1. write เงิน/สต๊อกทุกเส้นผ่าน ledgerWrite เท่านั้น — `stockMovement.create` นอก
   packages/db/src/ledger-write.ts = CI แดง · ห้าม update/delete ledger (guard+trigger จับ)
2. DB client ใน feature module = inject ORG_PRISMA เท่านั้น (org-scope ได้ฟรี) —
   ห้าม PrismaService ตรง, ห้าม new PrismaClient, ห้าม $queryRaw · SYSTEM_PRISMA ใช้ได้เฉพาะ
   auth/ กับ admin/ (super-admin + @Audited บังคับ)
3. เงิน = Decimal(18,4)/string ตลอดสาย (`Money = string | Decimal`) — ห้าม Number() กับเงิน ·
   สต๊อก = int · เวลาเก็บ UTC
4. งานคุย external = enqueue BullMQ เสมอ (ชื่อ queue ตามตาราง §2.3 ของ backend.md) —
   ห้ามเรียก connector ใน HTTP handler (ยกเว้น OAuth exchange ที่ระบุไว้)
5. core-domain: ห้าม import Prisma/Nest/I-O ทุกชนิด (purity gate จับ) · รับ now: Date เป็น argument
6. error: โยน typed error (core-domain หรือ error กลาง) — DomainExceptionFilter แปลงเป็น envelope
   { error: { code, message, ... } } เอง · ห้าม throw object envelope inline ใน feature ใหม่ ·
   code ที่ ship แล้วห้ามเปลี่ยนค่า
7. endpoint ใหม่: DTO/response ต้อง `satisfies` type จาก generated schema · list = cursor pagination
   ({ items, nextCursor }) · งานยาว = 202 + job id (GET /jobs/:id) · mutating ที่มีผลเงิน/สต๊อก =
   รองรับ Idempotency-Key

## Pattern บังคับต่อ feature โดเมน

- service รูปเดียว: อ่าน (ORG_PRISMA) → เรียก pure fn ได้ plan → ledgerWrite(ctx, plan) —
  ห้ามคำนวณใน tx callback, ห้าม I/O ใน pure fn
- guard ประกอบ 3 ชั้นแยกแกน: @RequireCapability (RBAC) · @RequireFeature (tier) · @Audited
  (action สำคัญ) — อย่ายุบรวม
- inbound ซ้ำได้เสมอ (webhook/retry/poll) → unique key + idempotencyKey ให้ ledgerWrite
- connector ใช้ผ่าน ConnectorRegistry + อ่าน capabilities — ห้าม if (key === "shopee") นอก
  packages/connectors

## เทสต์ (D-014 — ไม่มีข้อยกเว้น)

- unit ประกบทุกไฟล์ implement · เงิน/สต๊อก = matrix ตาม skill money-stock
- int lane (`*.int.test.ts`, ต้องมี DB จริง): ทุก feature ใหม่มี (ก) cross-org leak test
  (ข) concurrency test ถ้าแตะ ledger/เลขรัน — เขียวใน CI `integration-api` ก่อนอ้างว่าผ่าน
  (green locally ≠ tested)
- connector ใหม่/แก้ mapping → contract tests + fixtures ต้องผ่านทั้งชุด

## ห้ามตัดสินเอง (escalate)

- business rule/scope/AC → product · จอ/flow → ux/frontend · env/secret/CI/DB hosting → devops
- แตะ migration บนตารางมีข้อมูล → skill prisma-migration · contract ที่ ship แล้ว → skill
  contract-evolution · ★ auth/token/webhook-verify → security-reviewer pass
```

---

*อ้างอิง: [design-brief.md](design-brief.md) · docs/01–04 · [features/README.md](../features/README.md) ·
[architecture/mobile.md](mobile.md) · [architecture/web.md](web.md) · DECISIONS D-004/D-013/D-014 ·
skills: money-stock, connector-design, contract-evolution, prisma-migration, observability-standard ·
โค้ดจริง `apps/api/src/**`, `packages/**` @ 0e5b3c1*
