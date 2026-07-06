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

## → BOUND TRIGGERS สำหรับงานที่ยังเปิดค้าง (firm-up 2026-07-06 — กัน "มี owner แต่ไม่มี trigger")

> ⚠️ **GAP ที่ต้อง user/product เคาะ:** backlog **ไม่มี feature "production deploy / hosting"** เลย (F-000 = scaffold เท่านั้น). งาน 2 ตัวล่างพึ่ง target นั้น → **ต้องสร้าง feature ใหม่ (เสนอ: `F-009 Production deploy & hosting`, tier ⚙️ infra)** ให้เป็นเจ้าของ, ไม่งั้นมันจะลอยจริง. จนกว่าจะมี feature นั้น = ผูกไว้ที่ **launch-readiness bucket** (ก่อนขายนอก dogfood).

| งานเปิดค้าง | เจ้าของ | **TRIGGER (เมื่อไหร่ทำ)** | binding |
| --- | --- | --- | --- |
| **T-001-13** global `/auth/*` request ceiling (L-4, กัน dummy-verify CPU-DoS) + **prod api artifact** (แถวบน) | devops | **เมื่อ spec feature deploy/hosting (F-009 เสนอ) เข้า Gate-1** — ต้องเป็น AC/checklist ของ feature นั้น · หรืออย่างช้า = ก่อน first non-dev deploy | ต้องเข้า Gate-1 ของ F-009 (ถ้าสร้าง) · ระหว่างนี้อยู่ launch-readiness bucket |
| **T-001-19** agentic Track-2 (Browser Use SME ไทย, non-blocking) | qa + devops | **TRIGGER ปลดแล้ว** (dep T-001-15 = done) → **actionable ทันที**; งาน = wire scheduled workflow (`.github/workflows` cron) + เขียน persona flow | ไม่ block F-001 merge · หยิบเป็น task แยกได้เลย (spawn เป็น chip แล้ว) |
