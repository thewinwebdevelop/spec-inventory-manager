# Features — backlog & workflow

ที่นี่คือศูนย์รวม feature ทั้งหมด แต่ละ feature มีโฟลเดอร์/ไฟล์ spec ของตัวเอง

## Workflow ต่อ 1 feature
> **workflow เต็ม (Portfolio → 2 gates → Build → QA → Release) + เจ้าภาพแต่ละด่าน
> + quality gate อยู่ใน [WEB_TEAM.md](../../WEB_TEAM.md) ส่วนที่ 3-4** ที่นี่คือฉบับย่อ

ทำทีละ feature จากบนสุดของ backlog ตามลำดับนี้ (ห้ามข้าม — โดยเฉพาะ 2 จุดที่ user เคาะ):

```
1. draft           เขียน Gate 1 จาก _TEMPLATE.md  (overview, user stories, AC, scope)
2. gate1-approved  ✋ user + product เคาะ user-stories/AC  ← กันเขียน design แล้วทิ้ง
3. designed        Gate 2: architecture(ถ้า full) → data-model → api → UX/UI → test plan
                   → review เจาะจงเจ้าของแต่ละส่วน → ✋ user อนุมัติ → commit เอกสาร
4. in-progress     build: backend → API → UI พร้อม unit test (กฎทองข้อ 4)
5. qa              automated (unit+integration+E2E) + manual → verdict vs AC
6. done            ผ่าน quality gate → release
```

> **Right-size:** _full_ (external/sync/queue/money-stock/cross-cutting) ทำเอกสารครบ
> รวม architecture; _light_ (CRUD ภายใน/UI เล็ก) ข้าม architecture + ลดเอกสาร
> **Platform:** 1 feature tag web/mobile/both — ไม่แตกเป็นคนละ feature ต่อ platform
> spec รวมทุกมิติไว้ในไฟล์เดียวตาม [_TEMPLATE.md](_TEMPLATE.md); ส่วนกลางที่กระทบหลาย
> feature sync กลับ [docs/01-data-model.md](../01-data-model.md) / [docs/02-architecture.md](../02-architecture.md)

## โมเดลการส่งมอบ: 3 tracks (FE/BE แยก · mobile-first ฝั่ง use)
backend ใช้ร่วมกัน — contract เดียว, ไม่แยก backend ต่อ client (ดู [docs/02 §7.2](../02-architecture.md)).
งานทุก feature แตกเป็น 3 track:

```
TRACK A — Backend/API (shared)   prerequisite ของทั้ง 2 client — เรียงตาม domain dependency
TRACK B — Mobile (Flutter)        client หลักฝั่ง "use / ปฏิบัติการ" — ทำทันทีที่ A พร้อม 🎯
TRACK C — Web admin (Next.js)     ฝั่ง "setup / config / บัญชี" — เดินขนานกับ B
```

**กฎลำดับต่อ feature:**
1. **A (backend) มาก่อนเสมอ** — client ทั้งคู่กิน contract เดียวกัน
2. feature **ปฏิบัติการ (ใช้ทุกวัน)** → **mobile ก่อน (B)**, web ตามทีหลัง
3. feature **setup / ฟอร์มหนัก / OAuth / บัญชี** → **web ก่อน (C)**, mobile ถ้าจำเป็น
4. C เดินขนานกับ B ได้เลย — setup ไม่บล็อก operate

**อ่าน Platform tag ในตาราง:** `both` = ทำ B+C (ถ้า operational → mobile ก่อน) · `web` = C เป็นหลัก ·
`mobile` = B เป็นหลัก · `—` = A ล้วน (ไม่มี UI ตรง) | **Size:** `full` (external/sync/money-stock/
cross-cutting, เอกสารครบ) · `light` (CRUD/UI เล็ก) · `infra`

**ลำดับรวม = dogfood-driven:** critical path คือ **Phase 1 (core inventory + Shopee sync)** —
แต่ละ phase ต้อง "ใช้กับร้านเราได้จริง" ก่อนไปต่อ

> **2 audience:** 3 track ข้างบนคือฝั่ง **Tenant** (ลูกค้า). **Back-office Console**
> (พวกเราใช้, ข้าม org, web-only, แอปแยก `apps/back-office` — ดู [docs/02 §5](../02-architecture.md))
> เป็นอีก audience ไม่อยู่ใน 3 track นี้. รายละเอียด feature ต่อ surface →
> [capability-matrix.md](capability-matrix.md)

### Mobile delivery — ส่งมอบทีละจอตามที่ backend พร้อม (ไม่รอ Phase 4)
- **F-006 Mobile app shell** (Phase 0) = ฐาน Flutter: auth, navigation, Dart client, push
- จอ operational ส่งมอบ **พร้อม feature ของมันใน Phase 1+**: dashboard (F-030) · สต๊อก (F-013) ·
  ออเดอร์ (F-024) · แจ้งเตือน (F-028) · sync health (F-027) · ใบแปะหน้า (F-050) · quota alerts (F-084)
- **F-061** (Phase 4) = ปล่อยขึ้น store + ขัดเกลา cross-cutting (offline, deep-link, perf)
> **milestone M-mobile ("operate ผ่านมือถือได้"):** F-006 + backend&mobile ของ
> F-011/F-013/F-024/F-028/F-030 เสร็จ → ใช้ร้านบนมือถือได้ (setup ยังทำบน web)
> **ทางลัด:** LINE bot (F-060) = mobile value ราคาถูกที่ได้ก่อน full app — ดึงขึ้นได้ถ้าอยากเร็ว

## Backlog (เรียงตาม phase)
สถานะ: ⬜ ยังไม่เริ่ม · 🟡 draft · 🔵 gate1-approved · 🟣 designed · 🟢 done

### Phase 0 — Foundation
| ID | Feature | Platform | Size | สถานะ | ขึ้นกับ |
|----|---------|----------|------|-------|---------|
| F-000 | Project setup (monorepo scaffold, CI, Prisma + schema โมเดล 5 ชั้น + ledger, env) | — | infra | ⬜ | — |
| F-001 | Authentication (สมัคร/เข้าสู่ระบบ, JWT + refresh) | web | full | ⬜ | F-000 |
| F-002 | Organization & membership (หลายผู้ใช้ต่อองค์กร) | web | full | ⬜ | F-001 |
| F-003 | Roles & permissions (RBAC) | web | full | ⬜ | F-002 |
| F-004 | Settings & org config (VAT, เลขรันเอกสาร, allocation default, warehouse) | web | full | ⬜ | F-002 |
| F-005 | Audit log (action สำคัญ: แก้สต๊อก/ออกเอกสาร/back-office — วางตั้งแต่แรก) | web | full | ⬜ | F-003 |
| F-006 | Mobile app shell — ฐาน Flutter ที่ทุกจอมือถือต่อจากนี้: auth + secure token/refresh, navigation/shell, Dart client gen (OpenAPI), push (FCM/APNs), theme/design tokens, env + crash reporting | mobile | full | ⬜ | F-001 |

### Phase 1 — Core Inventory & Sync (หัวใจ / dogfood critical path)
| ID | Feature | Platform | Size | สถานะ | ขึ้นกับ |
|----|---------|----------|------|-------|---------|
| F-010 | Product & Sellable SKU management | web | full | ⬜ | F-003 |
| F-011 | Inventory Item, Warehouse, Stock level + Ledger | web | full | ⬜ | F-003 |
| F-012 | Bundle composition (BOM) | web | full | ⬜ | F-010, F-011 |
| F-013 | Stock adjustment & ledger view | both | full | ⬜ | F-011 |
| F-020 | Channel account connect (Shopee OAuth) | web | full | ⬜ | F-003 |
| F-021 | Product import จาก Shopee | web | full | ⬜ | F-010, F-020 |
| F-022 | Channel listing mapping | web | full | ⬜ | F-021 |
| F-023 | Stock sync (push) + allocation | — | full | ⬜ | F-022, F-012 |
| F-024 | Order sync (inbound) | both | full | ⬜ | F-022 |
| F-025 | Oversell protection (lock/reserved/reconciliation) | — | full | ⬜ | F-023, F-024 |
| F-026 | Returns & cancellations (คืนสต๊อก + ปรับบัญชี) | web | full | ⬜ | F-024 |
| F-027 | Sync health & connection status (งาน fail, token re-auth) | both | full | ⬜ | F-023, F-024 |
| F-028 | Notifications & Alerts center (push/LINE infra, low-stock, re-auth) | both | full | ⬜ | F-024 |
| F-029 | Price management & per-channel price sync | web | full | ⬜ | F-022 |
| F-030 | Dashboard ยอดขาย/สต๊อก เบื้องต้น | both | full | ⬜ | F-024 |

### Phase 2 — Cloud Accounting
| ID | Feature | Platform | Size | สถานะ | ขึ้นกับ |
|----|---------|----------|------|-------|---------|
| F-040 | Purchase document → stock-in + cost | web | full | ⬜ | F-011 |
| F-041 | COGS & P&L | web | full | ⬜ | F-040, F-024 |
| F-042 | Sales documents (invoice/receipt/voucher/substitute) | web | full | ⬜ | F-024 |
| F-043 | ภาษีไทย (VAT, WHT) + รายงาน | web | full | ⬜ | F-042 |
| F-031 | Reporting & export (P&L ราย account/platform/ช่วงเวลา, export นักบัญชี) | web | full | ⬜ | F-041 |

### Phase 3 — Ops Boosters
| ID | Feature | Platform | Size | สถานะ | ขึ้นกับ |
|----|---------|----------|------|-------|---------|
| F-050 | พิมพ์ใบแปะหน้า (เริ่ม Shopee → ขยายทุก platform ตาม connector) | both | full | ⬜ | F-024 |
| F-051 | Shopee auto-promote ทุก 4 ชม. | web | full | ⬜ | F-020 |
| F-052 | แจ้งเตือนค่าส่งผิดปกติ | both | full | ⬜ | F-024 |

### Phase 4 — Channels & Mobile
| ID | Feature | Platform | Size | สถานะ | ขึ้นกับ |
|----|---------|----------|------|-------|---------|
| F-060 | LINE bot (แจ้งเตือน/เช็คสต๊อก/ยอด) — *cheap mobile value, ดึงขึ้นก่อนได้* | — | full | ⬜ | F-028, F-030 |
| F-061 | Mobile app — public release (stores) + cross-cutting polish (offline, deep-link, perf) — *จอ operational ส่งมอบไปแล้วใน Phase 1+ ผ่าน F-006 + feature `both`* | mobile | full | ⬜ | F-006, F-030 |
| F-070 | Lazada connector | web | full | ⬜ | F-025 |
| F-071 | TikTok Shop connector | web | full | ⬜ | F-025 |

### Phase 5 — Productize
> หมายเหตุ scope: กลุ่มนี้คือ "ขายจริง" หลัง full feature launch (จบ Phase 2) — entitlements/quota/back-office/AI add-on
> **architecture เผื่อไว้ตั้งแต่ Phase 0** (ดู note ท้ายไฟล์) แต่ build จริงที่นี่

| ID | Feature | Platform | Size | สถานะ | ขึ้นกับ |
|----|---------|----------|------|-------|---------|
| F-082 | Entitlements & plan definitions — `PlanDefinition` + limits map (ปลายเปิด เพิ่ม meter ใหม่ได้), **apply package → org**, override ราย org, grandfathering | web | full | ⬜ | F-003, F-004 |
| F-083 | Usage metering & **quota counting** — `UsageEvent` **immutable ledger** (กฎทอง 2), นับราย meter, reserve→commit, **hard cap** กันใช้ทะลุ, cost เป็น Decimal | — | full | ⬜ | F-082 |
| F-084 | **Quota alerts** — แจ้งเตือนใกล้หมด/เกินโควต้า บน **web + app** (ต่อยอด infra จาก F-028) | both | full | ⬜ | F-083, F-028 |
| F-085 | **Back-office Console** — **แอปแยก `apps/back-office`** (Next.js, internal, web-only): จัดการ org · plan · usage · support, **query ข้าม-org** (ข้อยกเว้นเดียว) + audit ทุก action + super-admin guard (ดู docs/02 §5) | back-office | full | ⬜ | F-003, F-082, F-083 |
| F-080 | Subscription billing & payment — บัตร(recurring)+PromptPay QR, webhook→apply auto, upgrade ทันที/downgrade สิ้นรอบ, grace+dunning, credit pack purchase (ดู docs/02 §7.1) | web | full | ⬜ | F-082 |
| F-081 | Self-serve onboarding | web | light | ⬜ | F-080 |
| F-086 | **AI add-on** — *post-launch* (ตั้งชื่อ/description = text แจก quota, generate รูป = credit/มิเตอร์เข้ม, provider port สลับได้) | web | full | ⬜ | F-082, F-083, F-085 |
| F-087 | **Edge & scale hardening** — API Gateway (TLS/auth/rate-limit ต่อ org/WAF) + แยก sync/connector workers เป็น deployable + multi-tenant hardening (ดู docs/02 §7.2) | — | full | ⬜ | F-025 |

### Icebox (เก็บไว้พิจารณาภายหลัง)
| ID | Feature | Platform | หมายเหตุ |
|----|---------|----------|----------|
| F-090 | โอนสต๊อกข้าม warehouse (TRANSFER) | web | เมื่อมีหลายคลัง |
| F-091 | Physical assembly (จัดเซตจริงเก็บเป็นชิ้น) | web | ต่อยอดจาก virtual bundle |
| F-092 | Bulk import/export CSV (สินค้า/สต๊อก) | web | ช่วยร้านที่มีข้อมูลเดิมเยอะ |
| F-093 | Stock take / cycle count (นับสต๊อกจริง vs ระบบ → ปรับผ่าน ledger) | both | เพิ่มความเชื่อมั่นสต๊อก; ต่อ F-013 |
| F-094 | Barcode/QR scan ตอนหยิบ-แพ็ก | mobile | ลดหยิบผิด; คู่กับ F-024/F-050 บนมือถือ |
| F-095 | Mobile BFF (แยก transport layer ให้มือถือ) | — | optional scale seam — เมื่อ mobile diverge หนัก/คนละทีม (ดู docs/02 §7.2) |

> หมายเหตุ: งาน setup (monorepo scaffold, CI, Prisma) ตอนนี้ track เป็น **F-000** ใน Phase 0 (ทำก่อน F-001)

> **สถาปัตยกรรมเผื่อ scale (วางตะเข็บตั้งแต่ Phase 0 — enforcement จริงอยู่ F-082..F-086):**
> ของพวกนี้ปะทีหลังแพง เพราะแทรกลึกถึง data model + billing + multi-tenant boundary จึง **กันที่ไว้แต่ยังไม่ build เต็ม**
> - **Entitlements service** — จุดเดียวตอบ `can(orgId, action)` ฟีเจอร์ห้ามอ่าน plan ตรงๆ (ตอนนี้ limits มีแค่ orders/sync)
> - **data-model stub**: `PlanDefinition` (limits = map ปลายเปิด) · `OrgEntitlement` (plan + override) · `UsageEvent` (immutable, มี `organizationId` + cost Decimal) → ใส่ลง [docs/01](../01-data-model.md) ระดับ stub
> - **AI = module แยก** (`packages/ai`) + provider port (text/image) + ทุก AI call เป็น job ผ่าน BullMQ — core-domain ห้ามรู้จัก AI provider
> - **audit + cross-org boundary** สำหรับ back-office วางใน RBAC (F-003) ตั้งแต่แรก ดู [docs/02](../02-architecture.md)
