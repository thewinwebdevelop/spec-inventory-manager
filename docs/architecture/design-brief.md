# Architecture Design Brief — ภาพใหญ่ของระบบ + เคสที่ทุก platform ต้องออกแบบเผื่อ

> **สถานะ: working draft (2026-07-11)** — เอกสารตั้งต้นสำหรับรอบ "architecture deep-design"
> ต่อ platform (mobile / web / backend) เพื่อให้ agent ที่ออกแบบเห็นภาพใหญ่ก่อนลงมือ
> ที่มา: สังเคราะห์จาก docs/00–06, docs/features/README.md (backlog เต็ม), DECISIONS.md, โค้ดจริงใน repo
> **เอกสารนี้ไม่ใช่ spec** — เป็น brief ให้ผู้ออกแบบ; ผลออกแบบจริงอยู่ที่ `docs/architecture/{mobile,web,backend}.md`

---

## 1. ระบบเราจะมีอะไรบ้าง (capability inventory — จาก backlog เต็ม Phase 0–5)

### 1.1 Foundation (Phase 0 — บางส่วน build แล้ว)
- **Auth ของเราเอง** — email+password, JWT access + refresh rotation/reuse-detection, multi-device sessions (F-001 ✅ built)
- **Organization / License / Membership** — 1 license = 1 org = 1 TIN · 1 user หลาย org (org switcher) (F-002)
- **Tier & entitlements core** — `can(org, feature)` / `canAdd(org, resource)` จุดเดียว, Sync/Full tier, FeatureGate ทุก surface (F-007)
- **Roles & permissions** — editable role ราย org + capability registry ปลายเปิด (F-003)
- **Settings & org config** (F-004) · **Audit log** append-only + cross-org seam (F-005)
- **Mobile app shell** — navigation, org switcher, push wiring, FeatureGate, force-update (F-006)

### 1.2 Core Inventory & Sync (Phase 1 — หัวใจของ product)
- โมเดล 5 ชั้น: Product → SellableSku → BundleComponent → InventoryItem + ChannelListing
- Warehouse + StockLevel + **StockMovement ledger (immutable)** (F-010–F-014)
- **Marketplace connectors**: Shopee ก่อน → Lazada, TikTok (Phase 4) → platform อื่นๆ อนาคต (F-020, F-070, F-071)
- Product import จาก platform, listing mapping (F-021, F-022)
- **Sync engine**: stock push + allocation (FULL/BUFFER/FIXED/DYNAMIC), order sync inbound
  (webhook-first + polling fallback), oversell defense หลายชั้น, reconciliation (F-023–F-025)
- Returns/cancellations, sync health, price sync per-channel (F-026, F-027, F-029)
- Notifications & alerts center (push/LINE, low-stock, re-auth) (F-028)
- Dashboard: ยอดขาย/สต๊อก/COGS/กำไรหลังหักค่าช่องทาง (F-030)

### 1.3 Cloud Accounting ไทย (Phase 2 — Full tier)
- Purchase document → PURCHASE_IN + weighted-average cost (F-040)
- Sales documents: ใบกำกับภาษี/ใบเสร็จ/ใบสำคัญจ่าย/ใบรับรองแทนใบเสร็จ — เลขรันต่อเนื่อง atomic, PDF ฟอนต์ไทย (F-042)
- VAT 7% / WHT / ภ.พ.30 / ภ.ง.ด.3/53 · P&L เต็ม · export นักบัญชี (F-041, F-043, F-031, F-004b)

### 1.4 Ops Boosters (Phase 3)
- พิมพ์ใบแปะหน้า (ทุก platform), Shopee auto-promote ทุก 4 ชม. (repeatable job), แจ้งเตือนค่าส่งผิดปกติ (F-050–F-052)
- Bulk CSV import/export (launch-blocker), stock take / cycle count (F-092, F-093)

### 1.5 Channels & Productize (Phase 4–5)
- LINE bot (command/shortcut layer) (F-060) · mobile store release + offline/deep-link/perf polish (F-061)
- Subscription billing (บัตร recurring + PromptPay), usage metering (`UsageEvent` immutable), quota alerts,
  plan admin, **back-office console (แอปแยก, cross-org)**, AI add-on (provider port), edge & scale hardening
  (API gateway, แยก sync workers) (F-080–F-087)

### 1.6 Client surfaces (docs/06)
- **Mobile (Flutter) = client หลักฝั่ง use** — mobile-parity-first: ต้องเปิดร้าน/ขายของจบในเครื่องเดียว
  (สร้างสินค้า, sync, เอกสาร, แพ็ค/สแกน/พิมพ์, dashboard) + กล้อง/บาร์โค้ด/push + เน็ตไม่นิ่ง
- **Web (Next.js) = admin console ฝั่ง setup + งานหนัก** — bulk, ตารางใหญ่, รายงานลึก, OAuth connect, บัญชี
- **Back-office (Next.js แยกแอป)** — พวกเราใช้, ข้าม org, audit ทุก action
- **LINE bot** — เฟสท้าย

---

## 2. เคสที่ต้องออกแบบเผื่อ (design-for cases) — ทุก platform ต้องตอบข้อที่เกี่ยวกับตัวเอง

### กลุ่ม A — Extensibility (เพิ่มของใหม่โดยไม่รื้อของเก่า)
- **A1. เพิ่ม marketplace platform ใหม่** ต้องเป็น "เขียน adapter 1 ตัว + ประกาศ capability" —
  ห้ามกระทบ core/sync engine/UI เดิม · แต่ละ platform ทำได้ไม่เท่ากัน (บางเจ้าไม่มี webhook,
  ไม่มี label API) → ต้องมี **capability declaration ต่อ connector** ให้ UI/engine ปรับตัวอัตโนมัติ
- **A2. spec ของ platform เปลี่ยนบ่อย** (API version, field เปลี่ยน, endpoint deprecated) —
  ต้องมี anti-corruption layer: DTO ภายนอกห้ามรั่วเข้า domain, mapping แยกไฟล์/แยก version,
  contract test ต่อ adapter, จุดที่เปลี่ยนบ่อยเป็น **configurable** (endpoint/rate-limit/retry policy)
  ส่วน mapping logic เป็นโค้ดใน adapter (config-only mapping = เปราะเกิน)
- **A3. เพิ่ม feature ใหม่ = เพิ่มโฟลเดอร์/module ใหม่** ไม่แตะของเก่า (feature-first ทุก platform) —
  backlog มี ~40+ features; โครงต้องรับ 10+ features/phase โดย pattern ปั๊มซ้ำได้และคุณภาพไม่หลุด
- **A4. เพิ่ม client/transport ใหม่** (LINE bot, back-office, BFF, gateway) โดย business logic ไม่ย้ายที่ —
  logic อยู่ core-domain ที่เดียว, transport เป็นชั้นบางที่เติมได้ (docs/02 §7.2)
- **A5. เพิ่ม document type / ภาษีรูปแบบใหม่ / e-Tax** — accounting ต้อง extensible ที่ระดับ type registry
- **A6. เพิ่ม notification channel ใหม่** (push → LINE → email → in-app) — sender เป็น port, ผู้เรียกไม่รู้ช่องทาง
- **A7. เพิ่ม payment gateway / AI provider** — port + adapter เหมือน connector (Phase 5 แต่ตะเข็บต้องมี)

### กลุ่ม B — Cross-cutting invariants (ทุก feature ต้องได้ฟรีจากโครง ไม่ใช่จำเอง)
- **B1. Multi-tenant**: ทุก query/call ผูก `organizationId` — โครงต้องทำให้ "ลืมแล้วพัง CI" ไม่ใช่ "จำได้ก็รอด"
- **B2. Entitlements/FeatureGate**: จอ/ปุ่ม/endpoint ถูก gate ด้วย `can()` แบบ declarative ทุก surface
- **B3. RBAC capability check** ราย membership — ประกอบกับ B2 โดยไม่ปนกัน
- **B4. Ledger immutability + transaction**: ทุก write เงิน/สต๊อกผ่าน primitive กลางตัวเดียว (ห้าม ad-hoc)
- **B5. Money = Decimal, stock = int, THB-only, เวลา UTC + แสดง Asia/Bangkok**
- **B6. Error taxonomy กลาง + ภาษาไทย**: error จาก API → user-facing message ที่สม่ำเสมอทุกจอ
- **B7. Audit log** สำหรับ action สำคัญ — เป็น seam ที่ feature ใหม่ enroll ได้ง่าย
- **B8. Testability (D-014)**: ทุกชั้นมีรอยต่อ inject/override ได้ — test ไม่แตะ network/DB จริง (ยกเว้น integration lane)

### กลุ่ม C — Reliability & sync correctness (หัวใจ backend)
- **C1. ทุกงานคุย external = async ผ่าน queue** + idempotent + retry/backoff + DLQ — ไม่ inline ใน request
- **C2. Idempotency ทุก inbound** (webhook ซ้ำ, retry) — unique key + upsert pattern
- **C3. Serialize ต่อ resource** (ต่อ inventoryItem/ต่อ account) — lock/queue-per-key กัน race
- **C4. Reconciliation loops** — ทุก integration ต้องมี "ตัวเทียบความจริง" เป็นรอบ + drift transparency
- **C5. Rate-limit ต่อ platform ต่อ account** — เคารพ limit ของเขา + จัดคิวของเรา
- **C6. Partial failure**: push 3 channel สำเร็จ 2 fail 1 — สถานะต้อง track ราย listing + retry เฉพาะที่ fail
- **C7. Token lifecycle ของ channel account** — auto-refresh, NEEDS_REAUTH, แจ้งเตือน

### กลุ่ม D — Client experience (mobile เป็นหลัก, web รอง)
- **D1. เน็ตไม่นิ่ง (mobile)**: retry, optimistic UI ที่ปลอดภัย (ห้าม optimistic กับเงิน/สต๊อก), offline queue seam
  (F-093 stock take), sync-on-reconnect
- **D2. Real-time-ish updates**: order ใหม่/สต๊อกเปลี่ยน/sync fail สะท้อนบนจอโดยไม่ refresh ทั้งแอป —
  ต้องเลือกกลไก (poll/push-driven invalidation) + state layer ที่รองรับ
- **D3. List ใหญ่**: สินค้า/ออเดอร์หลักพัน-หมื่น — pagination มาตรฐานเดียวทั้งระบบ, infinite scroll (mobile),
  data table + bulk selection (web), virtualization
- **D4. Form หนัก + validation ไทย** — pattern ฟอร์มที่ปั๊มซ้ำได้ (สินค้า/เอกสารบัญชี/settings)
- **D5. Org switcher กระทบทุกจอ** — เปลี่ยน org แล้ว state ทุก feature invalidate ถูกต้อง ไม่รั่วข้าม org
- **D6. Push notification → deep link เข้าจอที่ถูก** พร้อม org context ที่ถูก
- **D7. กล้อง/สแกน/พิมพ์** (mobile) — hardware seam แยกจาก logic
- **D8. Skeleton/empty/error/loading 4 states** ทุกจอ ตาม design-system + Thai copy ผ่าน i18n กลาง
- **D9. Performance**: startup time (mobile), bundle split (web), image caching, list rebuild cost,
  RSC/streaming (web) — กำหนด budget + pattern ที่ทำให้เร็ว by default

### กลุ่ม E — Contract & evolution
- **E1. OpenAPI contract เดียว** → generated client TS + Dart — additive-only หลัง client ship,
  deprecation ก่อน removal, CI diff gate (skill contract-evolution)
- **E2. Versioning ภายใน connector** — platform API version ต่อ adapter ไม่รั่วออกนอก package
- **E3. Schema evolution** — expand→migrate→contract, ledger ห้ามแตะ (skill prisma-migration)

### กลุ่ม F — Security & compliance
- **F1. Token/secret**: channel token เข้ารหัสที่ rest, client token ตาม client-security skill
- **F2. Tenant isolation ที่ทุกชั้น** + back-office cross-org เป็นข้อยกเว้นเดียวที่มี guard+audit แยก
- **F3. PDPA**: personal data (ชื่อ/ที่อยู่ผู้ซื้อ) — retention/export/delete seam
- **F4. Webhook signature verification ต่อ platform** + replay protection

---

## 3. Constraints ที่ล็อกแล้ว (ไม่ใช่หัวข้อออกแบบใหม่)

- Stack: Turborepo+pnpm · NestJS · PostgreSQL+Prisma · Redis+BullMQ · Next.js · Flutter · OpenAPI contract กลาง
- กฎทอง 7 ข้อ (CLAUDE.md) — โดยเฉพาะ core-domain pure, ledger immutable, org-scope ทุก query
- Monorepo เดียว ช่วง dogfood (workspace-map §3 มี split seam ไว้แล้ว)
- ไม่กระโดด microservices ก่อนเวลา — transport แตกเป็นชั้นตาม metric จริง (docs/02 §7.2)
- THB-only (D-013) · ไม่เผื่อ abstraction ที่ไม่มีใครขอ
- ลำดับส่งมอบ: mobile-parity-first, tenant web พักไว้, backend build เต็มต่อ feature

## 4. สิ่งที่รอบออกแบบนี้ต้องส่งมอบ (ต่อ platform)

1. **Target architecture** — layer, โครงโฟลเดอร์, design patterns, state/DI, error/i18n, performance practices
   ที่ตอบเคสในข้อ 2 ทั้งหมดที่เกี่ยวกับ platform ตัวเอง (คิดจากศูนย์ ไม่ anchor กับของเดิม)
2. **Gap analysis vs โค้ดจริงปัจจุบัน** — ต่อส่วน: **KEEP / REFACTOR / REBUILD** พร้อมเหตุผลและราคา
3. **ร่าง guideline** สำหรับ `apps/<app>/CLAUDE.md` — กติกา+pattern+exemplar ที่ subagent รุ่นถัดไปทำตามได้ทันที
