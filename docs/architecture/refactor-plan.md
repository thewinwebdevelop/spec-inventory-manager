# Refactor / Implement Plan — สรุปรวมจากรอบ architecture deep-design (2026-07-11)

> สังเคราะห์จาก [mobile.md](mobile.md) · [web.md](web.md) · [backend.md](backend.md) (ออกแบบจากศูนย์
> โดย fable agent ต่อ platform แล้ว gap-analysis กับโค้ดจริง @ 0e5b3c1) + [design-brief.md](design-brief.md)
> เอกสารนี้คือ "แผนปฏิบัติ" — ใครทำอะไร เมื่อไหร่ เก็บอะไร รื้ออะไร

## 1. Verdict ใหญ่: **ไม่มี REBUILD แม้แต่รายการเดียว**

ทั้ง 3 platform ได้ข้อสรุปตรงกันโดยอิสระ: ของที่ build แล้ว (F-000 seams + F-001 auth ทั้ง 3 ฝั่ง)
**ถูกทาง** — ช่องว่างเกือบทั้งหมดคือ *ชั้นที่ยังไม่ถูกสร้าง* (จองที่ไว้แล้วโดย D-004/D-023) ไม่ใช่ *ของที่สร้างผิด*
สิ่งที่ต้องระวังจริงคือ **pattern อันตรายจำนวนหนึ่งที่ "ยังไม่ผิดวันนี้" แต่จะกลายเป็นหนี้ก้อนโตทันทีที่
feature ที่ 2..30 ลอกไป** — แผนนี้จึงเรียงตาม "ปิดก่อนถูกลอก" ไม่ใช่ตามความง่าย

## 2. Convention กลางที่ล็อกร่วมกัน 3 platform (contract-level — เปลี่ยนคือแก้ 3 ที่)

| Convention | ค่าที่ล็อก | ระบุใน |
|---|---|---|
| Error taxonomy | sealed/discriminated `ApiFailure`: Network / Throttled / AuthExpired / Forbidden (RBAC) / Entitlement (tier) / Validation / Conflict / Server / ForceUpdate — wire envelope `{ error: { code, message, details?, fieldErrors?, traceId? } }` | backend §3.5 · mobile §3.4 · web §3.4 |
| Pagination | cursor เดียวทั้งระบบ: `{ items, nextCursor, total? }` | backend §3.6 · mobile/web list infra |
| Org scoping | header `X-Organization-Id` (canonical) · client ผูก org ที่ *ชั้นสร้าง client* (mobile: `orgDioProvider` · web: `useOrgApiClient` + org ใน URL `/o/[orgId]`) → ลืมไม่ได้เชิงโครงสร้าง | backend §3.3 · mobile §3.2 · web §3.2 |
| Gating 2 แกนแยกกัน | RBAC `can(capability)` (ซ่อน/disable) ≠ tier `entitled(feature)` (โชว์+ล็อก+ชวนอัปเกรด) — server enforce เสมอ, client = UX | ทั้ง 3 ฉบับ |
| งานยาว/queue-backed | `202 + jobId` → `GET /jobs/{id}` → client polling pattern เดียว | backend §3.6 · web §3.7 |
| เงิน/สต๊อกฝั่ง client | pessimistic เสมอ · ไม่คำนวณ · จอสต๊อก = "บันทึก movement" ไม่ใช่ "แก้ตัวเลข" | ทั้ง 3 ฉบับ |
| Enforcement | boundary gate ต่อ platform รันใน CI (mobile: `check_boundaries.dart` ขยาย rule 6–7 · web: `check-boundaries.mjs` ใหม่ (depcruise) · backend: depcruise + grep gates + oasdiff) | §5 ของแต่ละฉบับ |

## 3. สิ่งที่ **เก็บ (KEEP)** — ห้ามรื้อ ห้าม "ปรับปรุง" โดยไม่มีเหตุ

- **Backend:** `main.ts` bootstrap · `auth/` module ทั้งก้อน (exemplar) · guarded PrismaService ·
  ledger guard 2 ชั้น (extension+trigger) · `tenancy/` seam · schema 5 ชั้น · core-domain `auth/`+`cost/`
  (exemplar) · contracts pipeline (spec-first + drift gate) · CI lanes ทั้งหมด · validation stack
  (class-validator ที่ edge — ตัดสินแล้ว ไม่ย้าย zod ทั้ง API)
- **Mobile:** โครง feature-first 4 ชั้น + Riverpod (ยืนยัน D-023) · boundary gate · `RefreshCoordinator`
  (ตัว logic) · TokenStore/SecureStorage (★) · theme/tokens · auth feature + เทสต์ 127 ตัว (exemplar)
- **Web:** `auth-client.ts`/`csrf.ts`/`token-store.ts`/`api-base.ts` (★ — KEEP verbatim) ·
  `next.config.mjs` proxy · Tailwind v4 + shadcn + tokens (D-020) · vitest/tsconfig · contracts client wrapper

## 4. REFACTOR ที่ต้องปิด "ก่อนถูกลอก" (เรียงตามลำดับเวลา — นี่คือหัวใจของแผน)

| # | งาน | Platform | ทำเมื่อ (trigger) | Effort |
|---|---|---|---|---|
| R1 | `DomainExceptionFilter` + error-code registry กลาง (เลิก throw envelope inline) | backend | **ก่อน feature โดเมนแรกของ Phase 1** (F-010/F-011 เริ่ม) | S–M |
| R2 | ยก refresh wiring จาก per-repo `requestWithRefresh` → Dio `QueuedInterceptor` + interceptor chain เต็ม (auth attach/org header/retry/error map) | mobile | **F-006 Gate 2** | M |
| R3 | Error taxonomy กลาง `ApiFailure` (mobile sealed class · web discriminated union) — ของ auth เดิมกลายเป็น layer เฉพาะทางซ้อนบน | mobile + web | mobile: F-006 · web: ก่อน F-010 (จุด restart web track) | M×2 |
| R4 | i18n mobile: const class → `gen_l10n` ARB | mobile | F-006 (AC บังคับสลับภาษา) | M |
| R5 | `authRepositoryProvider` type เป็น abstract (ไม่ใช่ concrete impl) | mobile | F-006 (mechanical) | S |
| R6 | ย้าย `components/auth/*` → `features/auth/` (feature-first web) | web | F-002 (ตอน org switcher มาอยู่ข้างๆ) | S |
| R7 | rewrite `apps/{api,web,mobile}/CLAUDE.md` ตาม §7 ของแต่ละฉบับ | ทั้ง 3 | **รอบนี้** (แบบ "จริงวันนี้ + target ชี้ arch doc") — ดู §6 ด้านล่าง | S |
| R8 | ledger `balanceAfter`/serialization: `SELECT … FOR UPDATE` sorted = ความจริงเดียว (Redis lock = optimization) + grep gate `stockMovement.create` ที่เดียว | backend | F-011 พร้อม primitive | รวมใน A1 |

## 5. ADD — ชั้นใหม่ ผูกกับ feature เดิมใน backlog (ไม่สร้าง phase ใหม่)

**Backend (ลำดับ = dependency จริง):**
1. **F-002/F-003** — `OrgContextMiddleware` (ALS) + `ORG_PRISMA`/`SYSTEM_PRISMA` + `withOrgScope`
   enforcement จริง + `@RequireCapability` + cross-org leak test เป็น int-lane บังคับ
2. **F-007** — entitlements service (`can`/`canAdd`) + `@RequireFeature`
3. **F-011** — ⭐ `ledgerWrite` primitive (`LedgerPlan` จาก pure fn → idempotent insert → row lock →
   projection → transactional outbox → after-commit enqueue) — **ชิ้นสำคัญที่สุดของ Phase 1**;
   ห้ามมี write เงิน/สต๊อกเส้นอื่นเกิดก่อน
4. **F-020–F-025** — `packages/connectors`: `core/` (port + `ConnectorCapabilities` + typed
   `ConnectorError` + registry) + **`fake/` เกิดพร้อม `core/` วันแรก** + `shopee/` (DTO jail ใน
   `mapping/vN/`, config = endpoints/limits/retry, code = mapping) + contract-test kit ·
   sync engine (queue naming ตาม backend §2.3, `APP_ROLE=api|worker|all` split-ready) ·
   jobs resource + webhook idempotency
5. **F-004b/F-040/F-042** — `DocumentSequence` gapless per-org (`UPDATE … RETURNING` ใน tx เดียวกับ
   insert เอกสาร) + 50-way concurrency test + PDF เป็น queue job
6. **CI gates เพิ่ม:** depcruise (connectors + apps/api) · grep gates · oasdiff — ทยอยตาม feature ที่เปิดใช้

**Mobile (F-006 Gate 2 = ก้อนใหญ่):** router (go_router) + guards + deep link `omnistock://o/<orgId>/...` ·
`core/session` (activeOrg + entitlements) · `orgDioProvider` · event bus `core/events` · connectivity/ReadCache ·
push plumbing · boundary gate rule 6–7 → จากนั้น F-013: `PagedListController` + `AsyncStateView` +
`PagedListView` · F-007/F-003: `FeatureGate` เต็ม · F-093: Outbox จริง · F-061: perf budget วัดจริง

**Web (จุด restart ของ track — ก่อน F-002/F-010):** TanStack Query + `lib/api/query-client.ts` ·
`tool/check-boundaries.mjs` · `ApiFailure` → จากนั้น F-002: `lib/org`+`lib/session`+`app/o/[orgId]/layout` ·
F-003/F-007: `RouteGuard`+`FeatureGate` · F-010: `data-table/` + `form/` (RHF+zod) + ประเมิน i18n lib ·
F-020/021: OAuth popup + job polling · F-092: bulk action bar

## 6. นโยบาย CLAUDE.md ต่อ app (ตัดสินรอบนี้)

ร่าง §7 ของทั้ง 3 ฉบับเตือนตรงกัน: *"กติกาต้องตรงกับโค้ด ไม่ใช่ความหวัง"* — จึงอัปเดตแบบ 2 ชั้น:
1. **กติกาที่จริงวันนี้** (โครงปัจจุบัน, boundary gate ที่มีจริง, exemplar ที่มีจริง) — เขียนเป็นกฎบังคับ
2. **Target pattern ที่ยังไม่มีของจริง** — เขียนเป็น *pointer บังคับ*: "เมื่อ build feature ที่แตะเรื่อง X
   ให้ implement ตาม docs/architecture/<app>.md §N — ห้ามคิด pattern เอง" (กัน agent ประดิษฐ์ทางเลือกใหม่
   โดยไม่หลอกว่า infra มีแล้ว) · เมื่อ infra เกิดจริง ค่อยยกร่าง §7 ฉบับเต็มเข้าแทน

## 7. ความเสี่ยงที่แผนนี้จับตา

- **ลำดับเวลาเป็นสาระ:** R1 (exception filter) มาก่อน F-010/011 · fake connector เกิดพร้อม core
  (fake ที่มาทีหลัง = sync engine ถูกเทสต์กับ Shopee จริง = แพง) · list infra เกิดพร้อมจอ list แรก
- **F-006 Gate 2 บวมขึ้น** (รับ R2/R3/R4/R5 + ADD ก้อน mobile) — ถูกต้องแล้วตาม D-021/D-022 ที่ชี้ว่า
  shell คือบ้านของงานพวกนี้ แต่ตอนแตก task ให้ตัดเป็น task ย่อยตาม decompose-plan
- **Web track พักอยู่** — ห้ามใครแอบ build web feature ก่อนทำ "จุด restart" (§5 web ข้อแรก) เสร็จ
- เอกสารนี้**ไม่ supersede** D-023/D-019/D-020 — มันต่อยอด; decision ใหม่ที่เกิดจากรอบนี้ควร log
  เป็น D-XXX ตอน user เคาะ (สถานะปัจจุบัน: ยังไม่ได้เคาะเป็น decision — เป็น proposal ที่ user สั่งให้ทำ)
