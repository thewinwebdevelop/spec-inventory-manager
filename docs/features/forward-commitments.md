# Forward-Commitments Register (กันตกหล่น)

รวมทุกข้อที่เราตัดสิน **"seam now, build later"** — map ว่า feature/phase ไหนต้อง build + seam ที่วางไว้แล้ว
(พิสูจน์ว่าไม่หลุด) · **append ทุกครั้งที่ตัดสินใจ "เลื่อนไว้ก่อน"**

> วิธีใช้: ก่อนเปิด build feature ปลายทาง (เช่น F-080) → เช็ค section ของมันที่นี่ก่อน = ไม่มีอะไรหลุด

---

## → F-020 / F-021 / F-023 / F-027 (Phase 1 — Gate 1/2 ของ sync ต้องรับเข้า, D-013)

| สิ่งที่ต้องรับเข้า                                                                                                                                   | ที่มา               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| **fake-Shopee adapter** (test double ใน `packages/connectors`) สำหรับ integration/E2E/seed/Track-2 — ระบุใน F-020 Gate 2 architecture                | gap-scan G-3        |
| **รูปสินค้า F-021**: ตัดสินตอน Gate 1 — hotlink URL platform (ยอมรับรูปหายถ้า listing ถูกลบ) vs ดึง storage ขึ้นมาก่อน F-040                         | gap-scan G-7        |
| **stock-drift transparency**: F-023 detect expected-vs-actual ก่อน push · F-027 แสดง drift event ("มีคนแก้สต๊อกบน platform") — ใส่เป็น AC ตอน Gate 1 | gap-scan G-4        |
| **compliance-checklist ที่ Gate 1 ของ F-024/F-028** (buyer PII เข้าระบบครั้งแรก)                                                                     | gap-scan G-2, D-013 |

## → F-024 / F-026 / F-030 (Phase 1 — ตอน build จริง)

| สิ่งที่เลื่อน                                                     | seam ที่วางแล้ว                            |
| ----------------------------------------------------------------- | ------------------------------------------ |
| Order financial fields (platformFee/ค่าส่ง mapping ราย connector) | F-024 ดึง field มา · กำไรหลังหักค่าช่องทาง |
| "กำไรโดยประมาณ — settle ทีหลัง" + ปรับตอนคืนสินค้า                | F-026 returns ผูกกับ margin                |

## → F-040 / F-042 / F-043 (Phase 2 — Full tier accounting)

| สิ่งที่เลื่อน                                                                     | seam ที่วางแล้ว                            |
| --------------------------------------------------------------------------------- | ------------------------------------------ |
| เอกสารซื้อ: file attachment + generator **ใบรับรองแทนใบเสร็จ**                    | tag ใน F-040 · storage lifecycle-ready     |
| จัดกลุ่มเอกสารใหม่: ใบรับรองแทนใบเสร็จ/ใบสำคัญจ่าย = **ฝั่งซื้อ** (ย้ายจาก F-042) | flag data-model ตอน F-040 Gate 2           |
| Input VAT timing (ใบกำกับ supplier มาคนละจังหวะ/ยอด)                              | F-040/F-043 Gate 2                         |
| read/write gate ของ accounting (downgrade ดูได้ เขียนไม่ได้)                      | F-007 `can(org,'accounting','read/write')` |

## → F-004b (Phase 2 — Tax settings, Full tier)

| สิ่งที่เลื่อน                                                                      | seam ที่วางแล้ว                           |
| ---------------------------------------------------------------------------------- | ----------------------------------------- |
| VAT/WHT config, tax handling ราย channel                                           | F-004 structure + F-002 tax profile (TIN) |
| **เลขรันเอกสารภาษี** (atomic sequence ไม่ซ้ำ/ไม่ขาด, prefix template, reset รายปี) | flag correctness ไว้แล้ว                  |

## → F-080 (Phase 5 — Billing)

| สิ่งที่เลื่อน                                                                        | seam ที่วางแล้ว                        |
| ------------------------------------------------------------------------------------ | -------------------------------------- |
| Provisioning จาก license ที่ซื้อ (แทน seed)                                          | F-007 รับ "provisioning source"        |
| Static cap **ค่าจริง** + "เต็มโควต้า → อัปเกรด"                                      | F-007 `canAdd()` path พร้อม            |
| Paywall/อัปเกรด UI จริง (เนื้อหา+CTA)                                                | F-007 `<FeatureGate>` wrapper พร้อม    |
| Downgrade flow + **บล็อกถ้างวดภาษีค้าง**                                             | F-007 ตั้งกฎ "ไม่ลบ + gate write" แล้ว |
| Storage retention **automation** (90วัน grace timer + export ZIP + cold-archive job) | F-007 policy + F-000 lifecycle-ready   |
| Add-on **billing** (ซื้อ add-on)                                                     | F-007 itemized grants + source         |
| Audit retention automation (archive security events ตามอายุ)                         | F-005 policy + append-only model       |

## → F-082 (Phase 5 — Plan/Entitlement admin)

| สิ่งที่เลื่อน                                             | seam ที่วางแล้ว                                |
| --------------------------------------------------------- | ---------------------------------------------- |
| Plan/package management UI + grandfathering + override UI | F-007 data model + mutation ops (internal API) |

## → F-083 (Phase 5 — Metering)

| สิ่งที่เลื่อน                                                 | seam ที่วางแล้ว                    |
| ------------------------------------------------------------- | ---------------------------------- |
| Usage metering (immutable ledger) + quota counting + hard cap | F-007 features map รับ metered key |
| Metered storage / metered add-on (เครดิต AI ฯลฯ)              | `storage_mb` key + grants seed     |

## → F-085 (Phase 5 — Back-office console)

| สิ่งที่เลื่อน                                          | seam ที่วางแล้ว                               |
| ------------------------------------------------------ | --------------------------------------------- |
| Super-admin config entitlement/plan/usage/support (UI) | F-007 mutation = internal API ให้ console ทับ |
| Super-admin actor + cross-org access **เปิดใช้จริง**   | F-003 US-8 cross-org seam + F-005 audit       |

## → F-081 (Phase 5 — Onboarding) + email infra

| สิ่งที่เลื่อน                                                                                                                                                 | seam ที่วางแล้ว                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Sync→Full upgrade wizard** (แยก tax entity: ร้าน/สต๊อกที่ไม่ใช่ TIN นี้ต้องย้าย license)                                                                    | จุดยากที่ระบุไว้ชัด                                                          |
| Self-serve password reset (เมื่อมี SMTP)                                                                                                                      | F-001 admin-reset ก่อน · `verified` flag                                     |
| Email verification                                                                                                                                            | F-001 `verified=false` flag ติดไว้                                           |
| **ส่งคำเชิญสมาชิกทาง email อัตโนมัติ** (D-012: F-002 MVP = copy invite link)                                                                                  | F-002 Invitation token + link flow พร้อม — เติมแค่ transport                 |
| **Invitation token hash-at-rest** (D-018: required ใน F-002 Gate-2 data-model — ห้ามเขียน invite token จริงก่อน hash; F-000 ship raw `@unique` ตาราง ยังว่าง) | แนวเดียวกับ RefreshToken `tokenHash` (F-001 T-001-02)                        |
| **ToS/consent ตอน signup + Privacy policy + PDPA baseline เต็ม** (D-013: dogfood = พวกเราเอง ยังไม่บังคับ)                                                    | skill `compliance-checklist` คุมราย feature ไปพลาง · เต็ม = launch-readiness |
| **Email sending infra (SMTP)** — ปลดล็อก reset+verify+notification                                                                                            | track เป็น infra dependency (devops)                                         |

## → F-061 (Phase 4 — Mobile public release & polish)

| สิ่งที่เลื่อน                                                   | seam ที่วางแล้ว                          |
| --------------------------------------------------------------- | ---------------------------------------- |
| Biometric app-lock                                              | F-006 session/lock architecture พร้อมรับ |
| Full offline-write sync (offline DB + conflict resolution)      | F-006 graceful degradation + cache read  |
| Deep-link เต็ม, store submission/assets, perf polish, dark mode | F-006 navigation/push routing พื้นฐาน    |

## → F-090+ (Phase หลัง — Multi-warehouse)

| สิ่งที่เลื่อน                                              | seam ที่วางแล้ว                                                             |
| ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| CRUD หลาย warehouse + ตั้ง default หลายอัน                 | schema `Warehouse`/`StockLevel` per-warehouse · Phase 0 = default คลังเดียว |
| **TRANSFER** (โอนสต๊อกข้ามคลัง) + allocation ราย warehouse | `StockMovement.type=TRANSFER` มีใน enum แล้ว                                |

## → Phase หลัง (i18n)

| สิ่งที่เลื่อน                                 | seam ที่วางแล้ว                             |
| --------------------------------------------- | ------------------------------------------- |
| เติมคำแปล **อังกฤษ** ให้ครบทุกจอ (web+mobile) | i18n framework + key + Thai ครบ (F-006/web) |

## → Productize / Hardening (Phase 5+)

| สิ่งที่เลื่อน                                                                  | seam ที่วางแล้ว                   |
| ------------------------------------------------------------------------------ | --------------------------------- |
| Phone + OTP identifier (phone-first) + SMS provider                            | F-001 `identifier + type` นามธรรม |
| 2FA/MFA, social login, SSO, CAPTCHA, passwordless                              | F-001 scope-out                   |
| ลบ org / โอนขาดเจ้าของเต็ม / seat limit enforce                                | F-002 scope-out                   |
| Custom role ละเอียด (per-field/record, per-warehouse scope), approval workflow | F-003 scope-out                   |
| Audit tamper-evidence (hash chain)                                             | F-005 append-only model           |

## → F-000 / devops (Phase 0 — infra)

| สิ่งที่เลื่อน                                            | หมายเหตุ                               |
| -------------------------------------------------------- | -------------------------------------- |
| Object storage: แยก prefix ราย org + **lifecycle-ready** | เงื่อนไขให้ retention/archive ทำงานได้ |

## → F-001 (e2e-in-CI สำหรับ F-000 AC3/AC15)

รายละเอียดเต็มที่ [docs/features/F-000/forward-commitments.md](F-000/forward-commitments.md) —
F-000 final whole-branch review (2026-07-05): AC3 (api `/health`+web 200+flutter build) และ AC15
(redis/queue probe) verified locally สำหรับ F-000 แต่ยังไม่มี job e2e-in-CI จริง; เพิ่มตอน F-001
เมื่อ apps/api มี endpoint จริงให้ e2e สมกับความพยายาม

## → Team/workflow upgrades (จาก PM review 2026-07-04) — ดูแผนละเอียด

| สิ่งที่เลื่อน                                                                                                                                                                                                                     | trigger                              | รายละเอียด                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------- |
| Pin client stack (per-app CLAUDE.md + D-XXX) · CI path-boundary check · exemplar conventions                                                                                                                                      | F-000 / F-006 / จบ build feature แรก | [team-upgrade-plan §B1–B3](../superpowers/plans/2026-07-04-team-upgrade-plan.md) |
| skill `flutter-feature` (เขียนจากโค้ดจริง)                                                                                                                                                                                        | F-006 เสร็จ                          | [§B4](../superpowers/plans/2026-07-04-team-upgrade-plan.md)                      |
| `support` agent + `/triage`                                                                                                                                                                                                       | มี user นอกทีม                       | [§B5](../superpowers/plans/2026-07-04-team-upgrade-plan.md)                      |
| Observability section ใน Gate-2 architecture + DR drill                                                                                                                                                                           | ก่อน F-020                           | [§B6](../superpowers/plans/2026-07-04-team-upgrade-plan.md)                      |
| Launch-readiness (PDPA, pen test, load test, status page, help content)                                                                                                                                                           | ก่อนขายนอก dogfood                   | [§B7–B8](../superpowers/plans/2026-07-04-team-upgrade-plan.md)                   |
| Enforcement ladder — ย้ายกฎทองจาก prose → CI check (org-filter middleware, float ban, protected-path diff check, lockfile-diff) **+ rulebook consistency scan** (blindspot-scan pass 6 กับ workflow docs เอง — จับกติกาขัดกันเอง) | หลัง F-000 CI เขียว + ทุกจบ phase    | [§B9](../superpowers/plans/2026-07-04-team-upgrade-plan.md)                      |
| **`pnpm verify` คำสั่งเดียวที่ root** (+ `--filter=<workspace>`) รันชุดเดียวกับ CI เป๊ะ — ทำให้ PM รันซ้ำตาม Build discipline ข้อ 1 ได้ด้วยคำสั่งเดียว และ runnable proof ของทุก agent อ้างคำสั่งเดียวกัน                         | F-000 Gate 2 (devops วาง script)     | [§B10](../superpowers/plans/2026-07-04-team-upgrade-plan.md)                     |

## → deferred จาก F-000 (D-004 · Gate 1 sign-off 2026-07-02)

| สิ่งที่เลื่อน                                                                  | ปลายทาง build                  | seam ที่ F-000 วางแล้ว                                         |
| ------------------------------------------------------------------------------ | ------------------------------ | -------------------------------------------------------------- |
| Dart OpenAPI client **green/compile**                                          | **F-006** (mobile shell)       | F-000 wire Dart codegen pipeline (AC11)                        |
| Object storage **concrete backend** (local/minio → prod)                       | **F-040** (attachment)         | F-000 วาง stub interface + org-prefix seam                     |
| **transaction+ledger write primitive** (write-in-tx + StockMovement) — กฎทอง 5 | **F-011** (inventory + ledger) | F-000 วาง trigger (AC8) + schema; helper define ตอน write จริง |

## → deferred จาก F-001 (D-021 · mobile ★ client-security review 2026-07-06)

> **UPDATE D-022 (2026-07-06):** mobile bootstrap items ถูก **ดึงกลับมาทำใน F-001 แล้ว** (user decision) — ดูแถวที่ขีดสถานะ ✅ ด้านล่าง. เหลือ F-006/devops แค่ **env base URL ค่าจริง**.

| สิ่งที่เลื่อน                                                                                     | ปลายทาง build            | สถานะ                                                        |
| ------------------------------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------- |
| ~~mobile cold-start silent-refresh restore (M-2)~~                                                | ~~F-006~~ → **F-001**    | ✅ **done (D-022)** — `auth_bootstrap.dart` + `bootstrap_screen.dart` wired ใน main.dart; US-3 มือถือ complete |
| **per-env mobile API base URL injection** (ค่า per-env เท่านั้น; https-guard + required-param seam ทำใน F-001 แล้ว M-3) | **F-006** + devops       | ⏸ seam พร้อม; รอค่า env ตอน deploy                          |
| ~~release `AndroidManifest` INTERNET permission~~                                                | ~~F-006~~ → **F-001**    | ✅ **done (D-022)** — added to main manifest                 |
| ~~transient-failure signal (L-3) · current-device row (L-4) · FLAG_SECURE (L-5)~~                | ~~F-006~~ → **F-001**    | ✅ **done (D-022)** — RefreshOutcome + session-list notice + screenshot_guard (L-4 copy รอ ux review) |
| **compile workspace deps เป็น real JS** (config/db/contracts `main`=src/index.ts + build=`echo ok`) เพื่อ self-contained prod api artifact ที่ `node dist/main.js` boot ได้ — ตอนนี้ CI boot ผ่าน `tsx src/main.ts` (real app + real DB tests) ซึ่งพอสำหรับ gate; prod bundling = deploy-time | **devops / deploy** (คู่กับ T-001-13) | core-domain build→dist แล้ว (ref pattern); api compiles ✓ (node-ci typecheck) |

## → จาก architecture deep-design 2026-07-11 (docs/architecture/refactor-plan.md — ผูก trigger กัน "ถึงเวลาแล้วลืม")

> ที่มา: รอบออกแบบ per-platform (fable) — [refactor-plan.md](../architecture/refactor-plan.md) §4–5 คือ detail เต็ม
> **Gate 2 ของ feature ปลายทางต้องรับรายการของตัวเองเป็น required item** · convention กลางที่ล็อกร่วม 3 platform
> (ApiFailure taxonomy, cursor pagination, `X-Organization-Id`, gating 2 แกน, jobs resource) ดู refactor-plan §2
> หมายเหตุ: hardening batch (R1 backend + R2–R5 mobile + gate rules) ถูกดึงมาทำทันที 2026-07-11 — ไม่อยู่ในตารางนี้แล้ว

| Trigger | สิ่งที่ต้องรับเข้า Gate 2 / build | ตาม |
| --- | --- | --- |
| **F-002 / F-003** | backend: `OrgContextMiddleware` (ALS) + `ORG_PRISMA`/`SYSTEM_PRISMA` + `withOrgScope` enforcement จริง + `@RequireCapability` + **cross-org leak int-test เป็นเทสต์บังคับของทุก feature ใหม่นับจากนี้** · web: `lib/org`+`lib/session` + `app/o/[orgId]/layout` + ย้าย `components/auth/*`→`features/auth/` (R6) · mobile: `core/session` + `orgDioProvider` + org header เข้า interceptor chain (seam comment ไว้แล้ว) | backend.md §3.3 · web.md §3.2 · mobile.md §3.2 |
| **F-006 Gate 2** (ก้อนที่เหลือหลัง hardening) | router (go_router) + guards + deep link `omnistock://o/<orgId>/...` · event bus `core/events` · push plumbing · connectivity/ReadCache · per-env API base URL (ค่าจาก devops — ของเดิมค้างอยู่แถว D-021 ด้านล่าง) | mobile.md §3.5–3.6, §4 |
| **F-007** | entitlements service `can()`/`canAdd()` + `@RequireFeature` (backend) · `FeatureGate`/`entitled()` แยกแกนจาก RBAC ทั้ง web+mobile | backend.md §3.4 · ทั้ง 3 ฉบับ |
| **F-010** (web restart จุดแรกของจอจริง) | **ก่อนโค้ด web feature ใดๆ: "จุด restart"** = TanStack Query + `ApiFailure` web + `tool/check-boundaries.mjs` · จากนั้น `data-table/` + `form/` (RHF+zod) + ประเมิน i18n lib | web.md §3.1, §3.4–3.6, §5.2 |
| **F-011** | ⭐ `ledgerWrite` primitive (LedgerPlan → idempotent insert → sorted `SELECT…FOR UPDATE` → projection → transactional outbox) + **grep gate `stockMovement.create` ถูกกฎหมายไฟล์เดียว ทันทีที่ merge แรก** + `StockLevel.version` + ตาราง `LedgerCommand`/`Outbox` — ห้ามมี write เงิน/สต๊อกเส้นอื่นเกิดก่อน (R8 รวมในนี้) | backend.md §3.1, §2.5 |
| **F-013** | mobile list infra: `PagedListController` + `AsyncStateView` + `PagedListView` (cursor `{items,nextCursor}`) — เกิดพร้อมจอ list แรก | mobile.md §3.3 |
| **F-020–F-025** | `packages/connectors`: `core/` (port + `ConnectorCapabilities` + typed `ConnectorError` + registry) + **`fake/` เกิดพร้อม `core/` วันแรก** (เสริม G-3 เดิม) + `shopee/` (DTO jail `mapping/vN/` — config=endpoint/limit/retry, code=mapping) + contract-test kit · queue naming ตาม backend.md §2.3 + `APP_ROLE=api\|worker\|all` assembly · webhook idempotency (`WebhookEvent` unique) · depcruise ชุด connectors | backend.md §3.2, §2.3 |
| **F-021** | jobs resource (`202` + `GET /jobs/:id`) ฝั่ง backend + web `use-job-polling`/`JobStatusBanner` · web OAuth popup+postMessage เกิดที่ F-020 | backend.md §3.6 · web.md §3.7–3.8 |
| **F-004b / F-040** | `DocumentSequence` gapless per-org (`UPDATE…RETURNING` ใน tx เดียวกับ insert เอกสาร) + **50-way concurrency test บังคับ** · PDF = queue job (เสริมแถวเลขรันเดิมของ F-004b) | backend.md §3.7 |
| **F-092** | web `DataTable` bulk action bar เต็มรูป | web.md §3.5 |
| **F-093** | mobile `OutboxQueue` implementation จริง (จนกว่านั้นเป็น port เปล่า — อย่า build เกิน) | mobile.md §4 |
| **F-028 / F-080 / F-086** | notification sender / payment gateway / AI provider = port+adapter idiom เดียวกับ connectors | backend.md §3.8 |
| **F-087** (API gateway) | @devops ยืนยัน trust boundary ของ `x-request-id`/`x-trace-id` (gateway-injected vs client-supplied) — ตอนนี้ filter validate `^[A-Za-z0-9._-]{1,128}$` แล้วค่อย echo (★ sanity-pass 2026-07-11) | ★ review finding L-2 |
| **เมื่อ user เคาะรอบ design นี้** | log decision เป็น D-XXX (สถานะปัจจุบัน = proposal ที่ user สั่งทำ ยังไม่ ratify เป็น decision) + ยกร่าง CLAUDE.md §7 ฉบับเต็มเข้าแทน "target pointers" เมื่อ infra เกิดจริงครบ | refactor-plan §6–7 |

## → BOUND TRIGGERS สำหรับงานที่ยังเปิดค้าง (firm-up 2026-07-06 — กัน "มี owner แต่ไม่มี trigger")

> ⚠️ **GAP ที่ต้อง user/product เคาะ:** backlog **ไม่มี feature "production deploy / hosting"** เลย (F-000 = scaffold เท่านั้น). งาน 2 ตัวล่างพึ่ง target นั้น → **ต้องสร้าง feature ใหม่ (เสนอ: `F-009 Production deploy & hosting`, tier ⚙️ infra)** ให้เป็นเจ้าของ, ไม่งั้นมันจะลอยจริง. จนกว่าจะมี feature นั้น = ผูกไว้ที่ **launch-readiness bucket** (ก่อนขายนอก dogfood).

| งานเปิดค้าง | เจ้าของ | **TRIGGER (เมื่อไหร่ทำ)** | binding |
| --- | --- | --- | --- |
| **T-001-13** global `/auth/*` request ceiling (L-4, กัน dummy-verify CPU-DoS) + **prod api artifact** (แถวบน) | devops | **เมื่อ spec feature deploy/hosting (F-009 เสนอ) เข้า Gate-1** — ต้องเป็น AC/checklist ของ feature นั้น · หรืออย่างช้า = ก่อน first non-dev deploy | ต้องเข้า Gate-1 ของ F-009 (ถ้าสร้าง) · ระหว่างนี้อยู่ launch-readiness bucket |
| **T-001-19** agentic Track-2 (Browser Use SME ไทย, non-blocking) | qa + devops | **TRIGGER ปลดแล้ว** (dep T-001-15 = done) → **actionable ทันที**; งาน = wire scheduled workflow (`.github/workflows` cron) + เขียน persona flow | ไม่ block F-001 merge · หยิบเป็น task แยกได้เลย (spawn เป็น chip แล้ว) |
| **native compile lane ใน CI** (Kotlin/Swift ไม่ถูก compile — flutter-ci = analyze+test เท่านั้น; FLAG_SECURE handlers + AppDelegate ship uncompiled, edit พังเงียบ → guard degrade เป็น no-op) | devops | ก่อน mobile feature ถัดไป (F-006) หรือก่อน first mobile release | เพิ่ม `flutter build apk --debug` (+ iOS `--no-codesign` เมื่อมี mac runner) เข้า flutter-ci · **แยกจาก F-001 merge** เพราะ native build อาจเผย scaffold issue อื่น |
