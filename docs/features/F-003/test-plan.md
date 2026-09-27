---
doc: test-plan
owner: "@qa"
signoff: approved     # user 2026-09-28
---
# [F-003] Test plan  (เจ้าภาพ: qa — ร่างตอน Gate 2 จาก AC)

> ที่มา: AC ใน [F-003.md](F-003.md) §2 (G1✓ 2026-09-27) · สัญญาที่ล็อกแล้ว: [architecture.md](architecture.md) (**§13 เป็นแหล่งหลัก**) · [data-model.md](data-model.md) · [api-spec.md](api-spec.md) ·
> [security-review.md](security-review.md) SR-F003-01..19 · D-032 · D-033 · D-034 (+Addendum, Addendum 2) · D-035 (+Addendum) · D-036 · D-037
> ข้อยกเว้นที่อ้าง: F-002 test-plan G-05/06/09/11/12/13/15 · I-45 · §9 (regression pack) · โค้ดเทสต์ที่มีจริงใน `apps/api/test/`, `role-capability-write-tripwire.test.ts`, `security-events.service.test.ts`

## Contract summary (≤20 บรรทัด — ทีม consumer อ่านแค่ส่วนนี้)
- **AC ครบ 60 ข้อ (รวม 3.9b · 5.4b · 5.5b) มีเทสต์อัตโนมัติ 58 ข้อ** · ไม่มีเทสต์อัตโนมัติเต็ม 2 ข้อ (AC-8.2, AC-9.7) พร้อมเหตุผลและหลักฐานทดแทน (§1) · AC-7.4 ส่วน `role ∩ tier` เป็นของ F-007
- **★ (auth/สิทธิ์ · tenant) ทุกเส้นทางเขียน role / มอบ / เชิญ / reissue / ยกเลิก / accept / reset** · F-003 ไม่แตะเงินและสต๊อก (ไม่มี ledger) แต่ใช้ matrix `money-stock` แบบเต็มในส่วน atomicity, tenant isolation และ concurrency
- **ชั้น (จำนวน test ID):** unit core-domain 36 · unit api/service 18 · int (DB จริง) 57 + concurrency 8 + migration 7 · static gate 18 · ทะเบียนเทสต์เดิมที่ต้องแก้ 8 · client unit 14 · E2E 24 (web 13 · Flutter 11) · manual 7 · Track 2 3 · perf 3
- **หลักฐานหลักของ D-034 และ SR-16/17:** property single-step ทุก op ของ actor ที่ไม่ใช่ Owner ทุกคน + control c1–c4 ที่ต้องแดง + BFS 2 actor ลึก 4 (U-RB-18..20)
- **regression ที่ระบุชื่อตรง ๆ ของ route ที่ ship แล้ว:** AC-5.4b (I3-25..27, I3-32) · AC-5.5b (I3-35/36, เทียบ 404 ทุกไบต์ + `Content-Length`) · D-035 (I3-38) · SR-19 (I3-30) · กฎเข้มไม่อยู่หลัง flag (I3-44)
- **Owner ≥ 1 ต้องพิสูจน์ได้ว่าแดงจริง:** U-OI matrix · spy ทุกทางเขียนที่ enumerate จาก DMMF · ตัว decider แบบปล่อยทุกอย่าง → `409 LAST_OWNER` (ไม่ใช่ 500) · trigger ของ DB · migration harness
- **`escalation_denied` = 8 operation** (ไม่ใช่ 6 — ตรวจแล้วใน §5.3) · ครอบ 15 ช่อง (route × reason) · union ของ event = **25** (4 + 15 + 6) · **กลับด้าน (backend ยืนยัน 2026-09-27):** route GET ที่คำนวณ `viewer.*` ยิง **0** event (I3-57) · PATCH role no-op = 200 ไม่เทียบ version ไม่ emit (I3-08 · api-spec §2 · arch §2 ขั้น 4b)
- **AC-10.1 เป็นงานจริง:** G-06/09/11/12 และ I-45 int **ยังไม่มีใน repo** ⇒ ต้อง merge **ก่อนหรือใน PR เดียวกับ** route เขียน role ตัวแรก และ CI ต้องพิสูจน์ว่ารันจริงผ่าน `assert-tests-ran --require` (§6)
- **G-15 ถูกแทนด้วย 3 ชั้น (G3-01..03) ใน PR เดียวกับกฎ ⊆** · ทะเบียน NEW-10 ใน regression pack ย้ายจาก tripwire ไปผูกกับเทสต์จริง (G3-12)
- **ข้อกำหนดกันเทสต์หลอก:** ทุกเทสต์ ★ ต้องมี red run ในรายการ mutation (§9 MUT-01..16) · ทุก gate มี fixture แดง + self-check สองทาง + non-vacuity · fixture ของ client บันทึกจาก response จริงของ server (G3-14)
- **มือถือ (user ตัดสิน 2026-09-27):** sheet เปลี่ยนบทบาทสมาชิกรายคนอยู่ใน F-003 (AC-2.2 · CM3-08 · EM3-08..11) · **out of scope = F-002b:** ถอดสมาชิก / ยกเลิกคำเชิญบนมือถือ · ปุ่ม reset รหัสผ่าน — ไม่มีเทสต์ใน F-003
- **Track:** ทุกอย่างใน §2–§6 และ E2E = **Track 1** (hard gate) · Track 2 = persona 3 flow (ไม่บล็อก) · manual = หลักฐานตอน QA stage
- **ต้องแก้เทสต์/kit เดิมก่อน migration F-003 จะผ่าน:** seed scenario `custom-role-null-key` สร้าง role ที่ `capabilities: []` ซึ่งขัด CHECK ใหม่ (R3-03)

---

## 0. กติกาของเอกสารนี้

| รหัส | ชั้น | ที่อยู่ (คาด) | Track |
|---|---|---|---|
| `U-RB-xx` · `U-OI-xx` · `U-CFG3-xx` | unit pure fn | `packages/core-domain/src/rbac/**` · `orgs/owner-invariant.test.ts` · `packages/config` | 1 |
| `U-API3-xx` | unit service/guard (fake tx, fake Redis, clock seam) | `apps/api/src/**` | 1 |
| `I3-xx` · `IC3-xx` | int บน Postgres + Redis จริง (int lane) | `apps/api/test/*.int.test.ts` | 1 |
| `M3-xx` | migration harness + backfill | `packages/db/test/*.int.test.ts` | 1 |
| `G-06/09/11/12` · `G3-xx` | static gate + fixture แดง (G-05) | ตามแต่ละตัว | 1 |
| `R3-xx` | เทสต์/kit เดิมที่ต้องแก้ (ไม่ใช่เทสต์ใหม่) | ตามแต่ละตัว | 1 |
| `CW3-xx` · `CM3-xx` | client unit/widget (web vitest · flutter test) | `apps/web` · `apps/mobile/test` | 1 |
| `EW3-xx` · `EM3-xx` | E2E Playwright · Flutter `integration_test` | `apps/web/e2e` · `apps/mobile/integration_test` | 1 |
| `MAN3-xx` | manual (QA stage) | หลักฐานแนบใน QA report | — |
| `T2-xx` | agentic persona (scheduled) | Track 2 | 2 |
| `P3-xx` | perf smoke | int lane | 1 (full tier) |

- **Persona ที่ใช้ทั้งเอกสาร (seed §7):** `OWN` Owner · `OWN2` Owner คนที่สอง · `ADM_A` / `ADM_B` Admin preset · `STF` Staff · `MR` = `{manage_roles, manage_orders, manage_products}` (ไม่มี `manage_members` — "M" ของ SR-17) · `MM` = `{manage_members, manage_products}` ("A" ของ SR-17) · `T` ถือ `R_T = {manage_orders}` · `MMS` = Staff + `manage_members` (ตัดกันไม่ครอบกับ `R_BILL`) · `REV` สมาชิก revoked
- **เทสต์ที่ชื่อบอกว่า ★ หรืออ้าง AC/SR** ต้องใส่รหัส (`AC-5.4b`, `SR-F003-17`, `I3-27`) ในชื่อเทสต์ เพื่อให้ regression pack ผูกด้วย marker ได้ (G3-12)
- **"ไม่เปลี่ยน" = assert จริง:** ทุกเคสที่ถูกปฏิเสธต้อง assert ว่าแถว (`Role.capabilities` · `name` · `version` · `Membership.roleId` · refresh token) **ไม่เปลี่ยน** และ **ไม่มี event สำเร็จ** ไม่ใช่ดูแค่ status code

---

## 1. AC → test (ครบทุก AC · ไม่มีช่องว่าง)

| AC | สิ่งที่ต้องพิสูจน์ | test ID | หมายเหตุ |
|---|---|---|---|
| AC-1.1 | ร้านใหม่ได้ 3 role ตาม preset (ไม่มี Accountant) | I3-55 · U-RB-01 · EW3-01 | |
| AC-1.2 | Admin ที่ seed ใหม่มี `manage_roles` | I3-55 · U-RB-01 (pin blueprint) | |
| AC-1.3 | backfill ตรง preset เป๊ะ · idempotent · Owner/Staff ไม่เปลี่ยน | M3-04 · M3-05 · M3-01 | ★ Owner ≥ 1 ท้าย migration |
| AC-1.4 | custom `key=null` · ส่ง `key` มาใน body แล้วถูกตัดทิ้ง | I3-01 · U-API3-18 · I3-56 | |
| AC-1.5 | ชื่อที่ร้านตั้งชนะคำแปล · Owner แปลเสมอ | I3-06 · I3-54 · CW3-02 · CM3-02 · EW3-13 · G3-08 | |
| AC-2.1 | 1 role หลายคน · 1 คน 1 role ต่อร้าน · ต่างร้านต่าง role | I3-18 | |
| AC-2.2 | dropdown แสดง custom role · role ที่มอบไม่ได้ = disabled + เหตุผล (web + mobile) | I3-22 · CW3-03 · CM3-03 · CM3-08 · EW3-03 · EM3-02 · EM3-08 · EM3-09 · EM3-10 · EM3-11 | มือถือ: dropdown ของจอเชิญ + **sheet เปลี่ยนบทบาทรายคน** (ตัวเลือกชุดเดียวกัน · แถว `viewerCanManage=false` = เหตุผล ไม่มีปุ่ม) · ถอด/ยกเลิก/reset บนมือถือ = F-002b |
| AC-2.3 | server ตัดสิน — ส่ง role ที่มอบไม่ได้โดยข้าม UI → ปฏิเสธ | I3-20 · MAN3-03 | ★ |
| AC-2.4 | แก้ role มีผลที่ request ถัดไป ไม่ต้อง logout | I3-21 · EW3-10 | |
| AC-2.5 | gate `manage_members` ของ route สมาชิก/คำเชิญไม่เปลี่ยน · `manage_roles` มอบไม่ได้ | I3-19 | ★ |
| AC-3.1 | สร้างจาก checklist ที่ไม่ถูกซ่อนด้วย tier | I3-01 · I3-12 · EW3-01 · EM3-01 | |
| AC-3.2 | โคลน = ฟอร์มที่เติมค่าไว้ + "สำเนาของ …" · ไม่มีปุ่มโคลน Owner | I3-13 (`canClone`) · I3-17 · EW3-01 · EM3-01 | ไม่มี endpoint clone (api §1) |
| AC-3.3 | แก้ Admin/Staff/custom ได้ · Owner ไม่ได้ | I3-06 · I3-14 | |
| AC-3.4 | ชื่อไม่ซ้ำ (trim + ไม่สนตัวพิมพ์) · 1–50 code point | U-RB-07 · I3-02 | |
| AC-3.5 | ห้ามชนชื่อที่แสดงของ system role | U-RB-08 · I3-03 · G3-08 | |
| AC-3.6 | ≥ 1 capability · key ที่ไม่มีใน registry ไม่ลง DB | U-RB-06 · I3-04 · I3-16 | ★ assert จำนวนแถวไม่เปลี่ยน |
| AC-3.7 | เพดาน 30 (รวม system) env-tunable | I3-05 · U-CFG3-02 | |
| AC-3.8 | ลบได้เมื่อไม่มี active/pending · `409 ROLE_IN_USE` + จำนวนเท่านั้น | I3-09 · EW3-07 · EM3-05 | |
| AC-3.9 | pending ที่หมดอายุนับด้วย | I3-09 | |
| AC-3.9b | role ที่เหลือแค่ประวัติลบได้ · ประวัติยังอ่านชื่อได้ | I3-10 · G3-04 · I3-11 | |
| AC-3.10 | client เตือนก่อนเสียสิทธิ์ตัวเอง · server ไม่บล็อก | U-RB-09 · CW3-01 · CM3-01 · EW3-06 · EM3-04 · I3-06 (เคส self-lockout = 200) | |
| AC-3.11 | "มีผลกับสมาชิก N คน" โดย N มาจาก server | I3-13 (`usage`) · EW3-01 · EM3-01 | |
| AC-3.12 | แก้ชนกัน → `409 ROLE_CHANGED` · ห้าม last-write-wins | I3-07 · IC3-01 · CW3-05 · CM3-05 · EW3-08 · EM3-06 | SR-14 ฝั่ง client |
| AC-4.1 | Owner แก้/เปลี่ยนชื่อ/ลบไม่ได้ทุกเส้นทาง (รวม Owner เอง) | I3-14 · I3-16 · U-RB-12 | ★ |
| AC-4.2 | `full_access` มีได้เฉพาะ Owner · ไม่อยู่ใน checklist | U-RB-06 · I3-04 · I3-12 · I3-16 · I3-17 · CW3-04 | ★ |
| AC-4.3 | ตัวตรวจ Owner ≥ 1 ใน tx ทุกเส้นทางเขียน role **และแดงได้จริง** | U-OI-01..12 · U-API3-01 · I3-15 · I3-16 · M3-01 · MUT-07 | ★ หลักฐานหลัก §2.2 |
| AC-4.4 | กฎ F-002 (Owner-only, `LAST_OWNER`) คงเดิมทุกไบต์ | I3-28 · I3-29 · regression pack F-002 (C-1 ฯลฯ) | |
| AC-5.1 | ⊆ ก่อน/หลังแก้ · role ที่มีผู้ถืออื่น: ⊊ + ต้องมี `manage_members` · rename-only อยู่ใต้กฎ | U-RB-12 · U-RB-13 · I3-20 · I3-31 · I3-33 | ★ |
| AC-5.2 | role ที่เกินตัว = อ่านอย่างเดียว · 3 เหตุผลแยกกัน · สถานะมาจาก server | I3-13 · I3-23 · I3-34 · CW3-03 · CM3-03 · EW3-03/04/05 · EM3-02 | |
| AC-5.3 | ทุกเส้นทางมอบใช้กฎเดียวจาก core-domain · accept ตรวจซ้ำ 3 เงื่อนไข · ผู้เชิญ = `issuedByUserId` | U-RB-10 · G3-05 · I3-20 · I3-38 · I3-39 · I3-40 · IC3-06 | ★ D-035 |
| AC-5.4 | สองแกน: target ⊊ · grant ⊆ · ยกเลิกคำเชิญ ⊆ · การกระทำต่อตัวเอง | U-RB-10 · U-RB-21 · I3-25..28 | ★ D-034 |
| AC-5.4b | regression ที่ระบุชื่อ + ลำดับโจมตี 3 request (ทาง member และทางแก้ role) ล้มที่ขั้นแรก | I3-25 · I3-26 · I3-27 · I3-32 · EW3-04 · EM3-09 · EM3-10 · R3-04 | ★ route ที่ ship |
| AC-5.5 | reset ได้เฉพาะเป้าหมาย ⊊ · 404 รูปเดิม | U-RB-14 · I3-35 · I3-36 · I3-37 | ★ |
| AC-5.5b | regression 4 กรณีที่ระบุชื่อ + 404 ไม่เป็น oracle | I3-35 · I3-36 · R3-04 · MAN3-04 (timing) | ★ route ที่ ship |
| AC-5.6 | Owner ผ่าน ⊆ แต่ยังติด `FULL_ACCESS_RESERVED` | U-RB-10 · U-RB-12 · I3-17 · I3-31 (แถว 11/21) | |
| AC-5.7 | ใช้สิทธิ์ ณ ตอนเขียน อ่านใน tx | U-API3-02 · IC3-03 · IC3-04 · IC3-06 | ★ |
| AC-5.8 | matrix บังคับทุกแถว (สองแกน · role write × ผู้ถือ · floor `manage_members` · collusion · accept) | U-RB-10..13 · U-RB-18..20 · I3-31 · I3-33 · I3-38 | ★ |
| AC-6.1 | ทุก route ใหม่ประกาศ capability → 403 ก่อนแตะข้อมูล | I-02 เดิม (enumerate ครอบ route ใหม่) · I3-13 · I3-19 | |
| AC-6.2 | capability ที่ route อ้างต้องอยู่ใน registry | U-API3-15 (+ fixture พิมพ์ผิด) | |
| AC-6.3 | scope ร้าน · leak test ทุก route ใหม่ | I3-52 · I3-24 · I3-53 | ★ กฎทอง 3 |
| AC-6.4 | `GET /roles` ไม่ส่ง `capabilities` · รายละเอียดต้องมี `manage_roles` · verdict ไม่เป็น oracle | I3-22 · I3-13 · I3-34 · I3-57 | ★ |
| AC-6.5 | ไม่มี cache · แก้แล้ว request ถัดไปเห็นผล | I3-21 · MUT-13 | |
| AC-7.1 | registry ที่เดียว · client ไม่ hard-code | U-RB-01 · I3-12 · G3-09 · CW3-04 · CM3-04 | |
| AC-7.2 | key ใหม่ = default deny · Owner ได้อัตโนมัติ | U-RB-03 · U-RB-04 (fixture registry) | |
| AC-7.3 | `manage_X ⇒ view_X` ที่ guard และที่ UI | U-RB-03..05 · CW3-04 · CM3-04 | ⚠️ ไม่มีคู่จริงใน F-003 (dm §1) ⇒ พิสูจน์ด้วย fixture registry/catalog เท่านั้น |
| AC-7.4 | tier `full` ซ่อน + สร้าง/แก้ไม่ได้ | I3-12 · I3-04 · U-RB-06 | การบังคับ `role ∩ tier` = F-007 (ไม่ทดสอบใน F-003) |
| AC-7.5 | upcoming แสดง "เร็ว ๆ นี้" · ติ๊กได้ · ⊆ นับด้วย | I3-12 · I3-04 · I3-31 (Admin เพิ่ม `manage_billing` = `ROLE_EXCEEDS_ACTOR`) · EW3-01 | |
| AC-8.1 | ไม่มี capability ข้ามร้าน | U-RB-01 (`scope==="org"` ทุก entry · ไม่มี prefix `platform_`/`cross_`) | |
| AC-8.2 | super-admin ไม่ใช่ Role/Membership · ไม่มีโค้ดสร้าง actor แบบนี้ | **ไม่มีเทสต์อัตโนมัติเต็ม** — ดูหมายเหตุ ① | review evidence |
| AC-9.1 | `org.role.created/updated/deleted` post-commit · payload ตามสเปก | U-API3-10 · I3-48 | |
| AC-9.2 | การปฏิเสธ US-5 ยิง event · reset ที่ถูกปฏิเสธยิง event แยก | I3-49 · I3-57 (GET ยิง 0) · I3-35 · I3-38 | |
| AC-9.3 | backfill บันทึกว่าเป็น System | M3-04 | |
| AC-9.4 | ตัวนับ event ที่ pin ถูกอัปเดตโดยตั้งใจใน PR เดียวกัน | R3-01 · U-API3-10 | |
| AC-9.5 | payload ไม่มีอีเมล/ชื่อคน | U-API3-10 · I3-50 | |
| AC-9.6 | "แก้ไขล่าสุดโดย … เมื่อ …" (คุณ / ชื่อบทบาทปัจจุบัน / อดีตสมาชิก / ค่าเริ่มต้นของระบบ) | U-API3-06 · I3-08 · I3-13 · I3-53 · EW3-01 · EM3-01 | |
| AC-9.7 | ใช้ security-events (log) เป็นที่เก็บ audit ชั่วคราว | **ไม่มีเทสต์อัตโนมัติ** — ดูหมายเหตุ ② | |
| AC-10.1 | G-06/09/11/12 ตัวจริง + fixture แดง · merge ก่อน/พร้อม route เขียน role | G-06 · G-09 · G-11 · G-12 · I3-56 · G3-13 · §6 | ★ งานจริง |
| AC-10.2 | G-15 ถูกแทนด้วยเทสต์จริงใน PR เดียวกับกฎ | G3-01 · G3-02 · G3-03 · R3-02 · G3-12 | |
| AC-10.3 | `isElevatedRole` นับ `manage_roles` | U-RB-16 · I3-41 | |
| AC-10.4 | คำเชิญเดิมที่ role ถูกแก้จนสูง → อายุตามสิทธิ์ปัจจุบัน | U-RB-17 · I3-42 · I3-43 | |

- **① AC-8.2** — การ "ไม่มีโค้ด" พิสูจน์ด้วยเทสต์ไม่ได้ครบ (ไม่มีรูปแบบของสิ่งที่ยังไม่มีให้ grep ได้ครบ) · หลักฐานทดแทน: (ก) U-RB-01 pin ว่าทุก capability มี `scope: "org"` และ type เป็น literal (ข) `system-prisma-allowlist.test.ts` เดิม ยืนยันว่า `RolesService` ใช้แค่ `ORG_PRISMA` (ค) security-reviewer ตรวจตอน build ว่าไม่มี actor ที่ข้ามร้าน · บันทึกผลใน QA report
- **② AC-9.7** — เป็นการยอมรับนโยบาย (log-only จนกว่า F-005) ไม่ใช่พฤติกรรม · ส่วนที่ทดสอบได้อยู่ใน AC-9.1/9.4 แล้ว (ทุก event ผ่าน `SecurityEventsService` และ `collectSecurityEvents`) · ข้อจำกัด "process ตายหลัง commit ก่อน emit ⇒ event หาย" (arch §7) = ความเสี่ยงที่รับไว้ ไม่ทดสอบ

---

## 2. Unit — `core-domain` (Track 1)

### 2.1 registry · การขยาย · การตรวจค่า

| ID | สิ่งที่ทดสอบ | red/control |
|---|---|---|
| **U-RB-01** | invariant ของ registry: key ไม่ซ้ำ · `implies` ชี้ key ที่มีจริง ไม่มี cycle รูป `manage_X → view_X` ชั้นเดียว · `selectable=false` มีตัวเดียว (`full_access`) · ทุก entry `scope==="org"` · ไม่มี key ขึ้นต้น `platform_`/`cross_` · `access_accounting` เป็น tier `full` · `SYSTEM_ROLE_BLUEPRINT` ⊆ registry · **pin preset เป๊ะ** (Owner `["full_access"]` · Admin 8 ตัวรวม `manage_roles` · Staff 3 ตัว) | fixture registry ที่ละเมิดทีละข้อต้องแดง |
| **U-RB-02** | snapshot เส้น `implies` ที่ ship (SR-11): ลบเส้น = แดง · เพิ่มเส้นได้ · ข้อความ error ต้องบอกว่าต้องทำ data migration | ⚠️ F-003 ไม่มีเส้นจริง ⇒ snapshot ว่าง · **ต้องพิสูจน์กลไกด้วย fixture registry ที่มี 1 เส้นแล้วลบ → แดง** ไม่งั้นเทสต์นี้เขียวโดยไม่ได้ตรวจอะไร |
| **U-RB-03** | `expandCapabilities`: `full_access` → ทุก key (รวม upcoming และ tier `full`) · `manage_X` → + `view_X` (fixture) · key ที่ไม่รู้จัก **คงอยู่** · ผลเหมือนเดิมเมื่อขยายซ้ำ · **AC-7.2:** เพิ่ม key ใหม่ใน fixture registry → Admin/Staff ไม่มี, Owner มี | control: ถ้า unknown key หายไป ⊆ ของ non-Owner จะผ่าน = แดง |
| **U-RB-04** | `hasCapability` วิ่งผ่าน expand (ผู้ถือ `manage_X` ผ่าน `view_X` ที่ guard) · signature เดิม · call site ของ F-001/F-002 ยังผ่าน | MUT-12 |
| **U-RB-05** | `canonicalizeCapabilities`: dedupe · ตัด key ที่ถูก imply · เรียงตาม key · **property ทุกคู่ใน matrix:** `isSubset(canon(a), x) === isSubset(a, x)` | |
| **U-RB-06** | `validateRoleCapabilities` ลำดับตายตัว: `[]` → `ROLE_EMPTY` · มี `full_access` (แม้มี key มั่วด้วย) → `FULL_ACCESS_RESERVED` · key มั่ว / `access_accounting` / `selectable=false` → `UNKNOWN_CAPABILITY` · upcoming ผ่าน · ผลเป็น `ValidatedCapabilities` | type-level: `@ts-expect-error` เมื่อสร้าง brand เอง |
| **U-RB-07** | `validateRoleName`: NFC → trim → ยุบ `\s+` · ปฏิเสธ Cc/Cf **หลัง** normalize · 1–50 code point (ไทยที่มีสระ/วรรณยุกต์ซ้อน · emoji astral = 1 · 50 ผ่าน / 51 ไม่ผ่าน · ว่างหลัง trim ไม่ผ่าน) · fixture 4 ตัวของ dm §2.1: `"เจ้า​ของร้าน"` `"‮นาหร"` `"พนัก⁠งาน"` → reject · `"Owner﻿"` → ยุบเป็น `"Owner"` (ไม่ reject) | |
| **U-RB-08** | `reservedRoleNames`: `เจ้าของร้าน` เสมอ · `ผู้ดูแล`/`พนักงาน` เฉพาะเมื่อ role นั้น live และ `nameCustomized=false` · ยกเว้นคำแปลของ key ตัวเอง · เทียบ exact หลัง normalize + lower | |
| **U-RB-09** | `lostCapabilities(before, after)` = `expand(before) \ expand(after)` · **golden vectors** `rbac/fixtures/lost-capabilities.vectors.json` ≥ 8 เคส (รวม implies · `full_access` · ไม่เสียอะไร) — ไฟล์เดียวกันถูกอ่านโดย CW3-01 และ CM3-01 | |

### 2.2 Owner ≥ 1 (AC-4.3 · arch §13.1)

| ID | รูป | กรณี | ผล |
|---|---|---|---|
| U-OI-01 | 3 `role_capabilities_change` | Owner 1 คน ถอด `full_access` จาก role ของเขา | throw |
| U-OI-02 | 3 | **Owner 2 คน role เดียวกัน ถอด `full_access` ทั้ง role** | throw |
| U-OI-03 | 3 | Owner 2 คนคนละ role ถอดจาก role หนึ่ง | ผ่าน |
| U-OI-04 | 3 | role ที่ไม่มี Owner ถือ | ผ่าน |
| U-OI-05 | 3 | ร้านที่ Owner = 0 อยู่แล้ว | throw |
| U-OI-06 | 4 `role_delete` | ลบ role ที่ไม่มีใครถือ | ผ่าน |
| U-OI-07 | 4 | ลบ role ที่ Owner คนเดียวถือ | throw |
| U-OI-08 | 4 | ลบ role ที่ Owner ถือ แต่มี Owner อีกคนใน role อื่น | ผ่าน |
| U-OI-09 | 4 | ร้านที่ Owner = 0 อยู่แล้ว | throw |
| U-OI-10 | 4 | ลบ role ที่มี membership `revoked` ที่เคยเป็น Owner | ผ่าน (นับเฉพาะ active) |
| U-OI-11 | 1/2 เดิม | matrix `role_change`/`revoke` ของ F-002 ทั้งชุดยังได้ผลเดิม | regression |
| U-OI-12 | type | `OwnerMembership.roleId` required (`@ts-expect-error` เมื่อขาด) · membership ของ role ที่ถูกแก้ต้องอยู่ใน input (fixture ที่ลืมใส่ → U-OI-02 ต้องแดง) | non-vacuity ของ input contract |

### 2.3 กฎสองแกน · role write · reset · คำเชิญ (D-034 · D-035)

| ID | สิ่งที่ทดสอบ | ขนาด |
|---|---|---|
| **U-RB-10** | **matrix `decideMemberAuthority`** (arch §13.6): relation ∈ {⊂ แท้ · = · ⊃ · ตัดกันไม่ครอบ · target/grant ว่าง · actor ถือ `full_access` · มี key ที่ถูก imply · role มี key ที่ไม่รู้จัก} × op 8 ตัว · **แถว "=" ต้องเห็นผลต่างกันของสองแกน:** `change_role`/`remove`/`reset_password`/`write_held_role` ปฏิเสธ (`relation="equal"`) · `invite_create`/`invite_reissue`/`invite_cancel`/`invite_accept_recheck` ผ่าน · unknown key: Owner ผ่าน, non-Owner ไม่ผ่าน · `actorIsTarget=true`: `change_role` grant ⊆ ผ่าน / grant ⊄ ปฏิเสธ · `remove` ผ่าน · `reset_password` **ไม่ผ่อน** · floor `manage_members` ทุก op (รวม `invite_accept_recheck` ของ D-035 P2) | ≈ 8 × 8 + 6 = 70 เคส |
| **U-RB-11** | ลำดับตายตัว: floor → owner_only → bypass `full_access` → target → grant (เคสที่ผิดสองแกนได้ reason ของแกน target) · `relation` ถูก (`equal`/`superset`/`incomparable`) · `excess` = `expand(target) \ expand(actor)` (ว่างเมื่อ `equal`) | |
| **U-RB-12** | **matrix `decideRoleWrite`** = arch §13.6 แถว 1–21 ในรูป unit + floor `manage_roles` (SR-08 → `forbidden`) · `isSystem`/`full_access` → `role_locked` (รวม actor = Owner) · Owner bypass (AC-5.6) · create/clone ไม่มีผู้ถือ · `otherActiveHolders` = 0 / 1 / มาก · rename-only และ no-op อยู่ใต้กฎ (แถว 4, 5, 14) | 21 แถว + 8 |
| **U-RB-13** | ลำดับ reason ใน `decideRoleWrite`: floor → `role_locked` → bypass → `exceeds_actor` → `requires_manage_members` → `target_not_below_actor` (แถว 16/17 พิสูจน์ลำดับ) · `otherActiveHolders` **required** (`@ts-expect-error` เมื่อไม่ส่ง) | |
| **U-RB-14** | `decideAdminReset`: map `owner_only` → `target_is_owner` (เดิม) · `target_not_below_actor` → `target_not_proper_subset` · refusal เดิมทุกตัวคงลำดับ · **ไม่มีการเทียบ ⊊ ในไฟล์นี้เอง** (G3-05) · `decideAdminResetVisible`: type ไม่รับ input C-2 · **property: visible ปฏิเสธ ⇒ `decideAdminReset` ปฏิเสธ** ทุกคู่ | |
| **U-RB-15** | `canAssignRole(...) === decideMemberAuthority(...).ok` ทุกคู่ (wrapper ไม่มี logic ของตัวเอง) · ถ้าลบใน PR เดียวกันตามสเปก เทสต์นี้ลบตาม | |
| **U-RB-16** | `isElevatedRole`: `full_access` / `manage_members` / **`manage_roles`** = elevated · Staff = ไม่ · ผ่าน `hasCapability` (imply ครอบ) · **ไม่อ่าน `key`** (fixture role ที่ key=`admin` แต่ caps = Staff → ไม่ elevated) | |
| **U-RB-17** | `canAcceptInvitation` expiry = `min(expiresAt, tokenIssuedAt + ttl(caps ปัจจุบัน))`: role กลายเป็น elevated หลังออกลิงก์ 30 ชม. → หมดอายุ · ลดลงแล้วไม่ยืด · ไม่รู้เรื่องผู้เชิญ (type ไม่มี field ผู้เชิญ) | |
| **U-RB-21** | property (fixture registry ทุกคู่): `¬(T ⊊ A) ∧ A ไม่ถือ full_access ∧ ¬actorIsTarget ⇒ change_role/remove/reset_password ปฏิเสธทุก grant` (arch §1.1) | ทุกคู่ของ subset |

### 2.4 lemma — property single-step + control + BFS (SR-16 · SR-17 · หลักฐานหลักของ arch §1.3)

- **U-RB-18 property single-step:** fixture registry `{manage_members, manage_roles, X, Y}` + `full_access` ของ Owner · enumerate **ทุก state** ของร้านที่มี Owner 1 + non-Owner 3 คน (role จาก subset ของ fixture, ใช้ role ร่วมกันได้, active/revoked, คำเชิญ pending 0–1) × **ทุก op ของทุก actor ที่ไม่ใช่ Owner รวม op ต่อตัวเอง** (PATCH member คนอื่น/ตัวเองทุก grant · DELETE member คนอื่น/ตัวเอง · role create/clone · role update ทุก after รวม role ที่ actor ถือ + rename-only/no-op · role delete · invite create/reissue/cancel · accept ผ่าน re-check D-035 · reset) → ตัดสินด้วย **fn จริงของ core-domain** (`decideRoleWrite` · `decideMemberAuthority` · `canAcceptInvitation` + re-check · `decideAdminReset`) → op ที่ผ่านคำนวณ state ถัดไป
  - **assert 1:** `∀ T ∈ U(s), T ≠ actor, T ยัง active ใน s′ ⇒ T ∈ U(s′)`
  - **assert 2 (เชื่อม `U` กับ reset จริง):** `∀ T ∈ U(s), ∀ Y non-Owner ⇒ decideAdminReset(Y, T)` ปฏิเสธ
  - **non-vacuity:** พิมพ์จำนวน op ที่ผ่านแยกตามชนิด — **ทุกชนิด > 0** · จำนวน state ที่ `U` ไม่ว่าง > 0 · ถ้าชนิดใดได้ 0 = แดง (model ไม่ได้ครอบ op นั้นจริง)
  - **ห้าม** จำลองกฎในเทสต์ — ต้อง import fn จริง (ไม่งั้นเทสต์พิสูจน์แค่ว่า model เห็นด้วยกับตัวเอง)
- **U-RB-19 control c1–c4 (ต้องแดง + พิมพ์ตัวอย่างค้าน):** ทำด้วย **wrapper ในเทสต์ที่เปลี่ยน refusal reason ตัวเดียวเป็น ok** (ไม่ต้องมี seam ใน production)
  - c1 ปิด before ⊊ ของ `decideRoleWrite` (`target_not_below_actor` บน update/delete) → ตัวอย่างค้านต้องเป็น actor **คนเดียว** ลด role ที่เท่ากัน
  - c2 ปิดแกน target ของ `change_role` → ตัวอย่างค้านต้องมี PATCH-ลด แล้ว reset
  - c3 ปิด floor `manage_members` ของ `write_held_role` → ตัวอย่างค้านต้องมี **non-Owner 2 คนที่ต่างกัน** (รูป M/A)
  - c4 ให้ PATCH ตัวเองข้ามแกน grant → ตัวอย่างค้านต้องมี actor ยกตัวเอง
  - **assert รูปของตัวอย่างค้าน** ไม่ใช่แค่ "แดง" — control ที่แดงด้วยเหตุผลอื่นไม่ได้พิสูจน์ว่ากฎข้อนั้นเป็นขาที่ lemma ใช้
- **U-RB-20 BFS:** actor ที่ไม่ใช่ Owner 2 คน (A, M) + T · op ชุดเดียวกับ U-RB-18 · ความลึก **4** · assert ไม่มีสถานะที่ reset T ผ่าน สำหรับทุกจุดเริ่มที่ T ∈ `U` · control c1–c3 ต้องเจอเส้นทางที่ความลึก ≤ 3 · พิมพ์จำนวน state ที่เยี่ยม
- ค่าใช้จ่าย: ถ้าเกิน 60 วินาทีใน CI ให้ย้าย U-RB-20 ไป full tier แต่ **U-RB-18/19 อยู่ smoke** (เป็นหลักฐานหลัก)

### 2.5 config (U-CFG3)
- **U-CFG3-01** `ROLE_WRITES_ENABLED`: ไม่ตั้ง = false · `"true"` = true · `"TRUE"`, `"1"`, `"yes"`, `" true"` = **false** · อ่านครั้งเดียวตอน boot
- **U-CFG3-02** `MAX_ROLES_PER_ORG=30` · `MAX_DELETED_ROLES_PER_ORG=500` pin กับตาราง arch §10 · ค่าที่ไม่ใช่ตัวเลข → boot ล้ม
- **U-CFG3-03** `ORG_RATE_LIMIT_ROLE_WRITE_PER_HOUR=60` · `…MEMBER_WRITE_PER_HOUR=120` pin · window 1 ชม. คงที่ (pattern U-CFG-05/06 ของ F-002)

---

## 3. Unit — `apps/api` service / guard (Track 1)

| ID | สิ่งที่ทดสอบ | seam |
|---|---|---|
| **U-API3-01** ★ | `RolesService` update/delete/create: **spy ทุกทางเขียน** บน fake tx (`role.create/update/updateMany/upsert/delete/deleteMany` · `invitation.updateMany` · `$executeRaw(Unsafe)` · `$queryRaw(Unsafe)`) ด้วย call log ร่วม · assert `indexOf(assertOwnerRemains) < indexOf(write แรก)` · refusal ⇒ write = 0 · **ฉีด `ROLE_WRITE_DECIDER` ที่ปล่อยทุกอย่าง + แก้ role Owner → `LAST_OWNER` + write = 0** · control: decider ปล่อย + role ที่ไม่มี Owner → write 1 ครั้ง · **non-vacuity:** enumerate method เขียนของ delegate `role`/`invitation`/`membership` จาก Prisma DMMF — ถ้า fake tx มี method เขียนที่ไม่อยู่ใน spy list = แดง | `ROLE_WRITE_DECIDER` · `OrgOwnershipGuard` |
| U-API3-02 | สิทธิ์ผู้ทำอ่านจาก tx ไม่ใช่ ALS: ALS บอกมี `manage_roles` แต่ tx บอกไม่มี → `FORBIDDEN` + write 0 · เช่นเดียวกันกับ `manage_members` เมื่อ role มีผู้ถืออื่น → `requires_manage_members` | fake tx |
| U-API3-03 | นับผู้ถือ: query ผ่าน `tx` (ORG_PRISMA) หลังได้ org lock · argument มี `organizationId`, `roleId`, `status:'active'`, `userId:{not: actor}` ครบ (ขาดข้อใด = แดง) | spy |
| U-API3-04 | clamp: `!elevated(before) ∧ elevated(after)` → `updateMany` คำเชิญ pending ของ role นั้นด้วย `LEAST` · ไม่ elevated → ไม่เรียก · ลดสิทธิ์ → ไม่ยืด | |
| U-API3-05 | no-op PATCH: canonical เท่าเดิม → 200 · ไม่ bump version · ไม่ยิง event · **การเทียบ no-op เกิดหลังกฎสิทธิ์ทั้งหมด** (role ที่ติดกฎ → 403 ไม่ใช่ 200) | |
| U-API3-06 | `lastEditedAt/ByUserId`: เขียนตอน create และ PATCH ที่ชื่อหรือ caps เปลี่ยนจริง · ไม่เขียนตอน no-op / delete / backfill / seed · `kind` derive: `me` / `member` / `former_member` (รวม membership ไม่มีหรือ User ถูกลบ) | |
| U-API3-07 | `nameCustomized`: เป็น true เมื่อชื่อหลัง normalize ต่างจากเดิม · ไม่กลับเป็น false (แม้เปลี่ยนกลับเป็นชื่อเดิม) · บน wire = `key === null \|\| column` | |
| U-API3-08 | `InvitationsService.reissueLink` เขียน `issuedByUserId = actor` **ใน update เดียวกับ** `tokenHash/tokenIssuedAt/expiresAt` (assert call เดียว, data มีครบ 4 field) · create เขียน `issuedByUserId = actor` | spy |
| U-API3-09 | accept re-check: เรียก **หลัง** `canAcceptInvitation` ได้ `ok` เท่านั้น (refusal เดิม 6 ชนิดไม่ไปถึง) · อ่าน `COALESCE(issuedByUserId, invitedByUserId)` · null ทั้งคู่ → `inviter_not_active` · ไม่ผ่าน → `status='cancelled'` ใน tx เดียวกัน แล้วตอบ `INVITATION_CANCELLED` · event หลัง commit | fake tx |
| U-API3-10 ★ | security events: `F003_SECURITY_EVENT_TYPES` **toEqual ตามลำดับ** 6 ตัว · F-002 list 15 **ไม่แตะ** · union = **25** ไม่ซ้ำ · `_UNION_IS_EXHAUSTIVE` · `SECURITY_EVENT_PAYLOAD_KEYS` ครบ 6 ตัว strict · **ไม่มี key ชื่อ `email`/`name` ของคน** (ยกเว้น `name` ของ role) · rollback → ไม่มี event | test sink เดิม |
| U-API3-11 | dedupe `escalation_denied` (fake Redis + clock): key เดียวกัน 3 ครั้งใน 5 นาที = 1 event · หลังหมดหน้าต่าง event ถัดไป `suppressedCount=2` · Redis โยน error = ยิงทุกครั้ง · `targetUserId` ต่างกัน = ยิงแยก · ใช้กับ `escalation_denied` เท่านั้น | clock · Redis token |
| U-API3-12 | `ESCALATION_CHECKED_OPERATIONS` export = 8 ค่า (ชุดใน §5.3) · reason ที่เป็นไปได้ = 4 ค่า | |
| U-API3-13 | `RoleWritesEnabledGuard`: registry ของ guard **set-equal** กับ `ROLE_WRITE_ROUTES` · วางหลัง `CapabilityGuard` (ลำดับใน metadata) | |
| U-API3-14 | rate limit key: `roleWrite` = `organizationId` · `memberWrite` = `userId+organizationId` · action ครอบ route ตาม arch §10 | |
| U-API3-15 | `ROUTE_CAPABILITIES` +6 ทุกตัว ∈ registry และ `status==="live"` (AC-6.2) · fixture route ที่อ้าง `manage_rolez` → แดง · `ORG_LOCK_REQUIRED_OPERATIONS` +3 · `ANY_ACTIVE_MEMBER_ROUTES` **ไม่เปลี่ยน** (G-13 เดิมยังเขียว) | |
| U-API3-16 | verdict = fn เดียวกับตอนเขียน (property ทุกคู่ viewer × row จาก fixture): `MemberRow.viewerCanManage === decideMemberAuthority(change_role, แกน target).ok` · `viewerCanResetPassword === decideAdminResetVisible(...)` · `RoleDetail.viewer.canEdit/canDelete` = `decideRoleWrite` ด้วยจำนวนผู้ถือจาก `usage` · ลำดับ reason ตาม api §3 · `writes_disabled` มาก่อนทุก reason | |
| U-API3-17 | `ERROR_CODES` มี code ใหม่ 12 ตัว (api §5) พร้อม HTTP status · `DomainExceptionFilter` map ถูก · `error-code-contract.test.ts` เดิมอัปเดต | |
| U-API3-18 | DTO: `CreateRoleRequest` ตัด `key`/`isSystem`/`version` (whitelist) · `capabilities` > 64 รายการ หรือ item > 64 ตัว → 422 · `UpdateRoleRequest` ต้องมี `version` (int ≥ 1) และมี `name` หรือ `capabilities` อย่างน้อยหนึ่งตัว | |

---

## 4. Integration — DB จริง (Track 1 · int lane)

> ทุกเคสยิงผ่าน HTTP บน app จริง (supertest) + Postgres/Redis จริง · seed ผ่าน kit (§7) · เคสที่ปฏิเสธ assert "ไม่เปลี่ยน" ตาม §0

### 4.1 Role CRUD และการตรวจค่า
- **I3-01** POST สร้าง custom role: 201 · `key=null` แม้ body ส่ง `key:"owner"`, `isSystem:true` · caps canonical เรียงแล้ว · `version=1` · `nameCustomized=true` · `lastEdited.by.kind="me"`
- **I3-02** ชื่อ: `"  admin "` / `"ADMIN"` ชนกับ `Admin` → 409 `ROLE_NAME_TAKEN` · 50 code point ผ่าน / 51 → 422 · fixture Cc/Cf 3 ตัว → 422 `VALIDATION_FAILED` `fieldErrors.name` · `"Owner﻿"` → 409 `ROLE_NAME_TAKEN` · ชื่อของ role ที่ถูกลบแล้วใช้ซ้ำได้
- **I3-03** คำสงวน: `"เจ้าของร้าน"` → 409 เสมอ · `"ผู้ดูแล"` → 409 ตอน Admin ยังไม่เปลี่ยนชื่อ · หลัง Admin เปลี่ยนชื่อเป็น "หัวหน้าร้าน" → สร้าง `"ผู้ดูแล"` ได้ · Admin เปลี่ยนชื่อกลับเป็น `"ผู้ดูแล"` เองได้ (ยกเว้นคำแปลของ key ตัวเอง)
- **I3-04** caps: `[]` → 422 `ROLE_EMPTY` · `["full_access"]` → 422 `FULL_ACCESS_RESERVED` + event `full_access_reserved` (ผู้เรียกเป็น Owner ก็ถูกปฏิเสธ) · `["bogus"]` / `["access_accounting"]` → 422 `UNKNOWN_CAPABILITY` + `details.capabilities` · **จำนวนแถว Role ไม่เปลี่ยน** · key upcoming (`manage_billing`) โดย Owner → 201 · 65 รายการ → 422
- **I3-05** เพดาน (ลด `MAX_ROLES_PER_ORG` ใน env ของเทสต์): system 3 ตัวนับด้วย · role ที่ลบแล้วไม่นับ · เกิน → 409 `ROLE_LIMIT_REACHED` `details.limit` · `viewer.canCreate.reason` และ `canClone.reason` = `role_limit_reached`
- **I3-06** PATCH แก้ชื่อ/caps ของ Admin · Staff · custom → 200 · `version+1` · event before/after · Admin ที่เปลี่ยนชื่อได้ `nameCustomized=true` และยังเป็น true หลังเปลี่ยนกลับ · **self-lockout (AC-3.10):** Admin คนเดียวในร้านถอด `manage_roles` จาก role ตัวเอง → 200 · request ถัดไปไป `/role-details` → 403
- **I3-07** version เก่า → 409 `ROLE_CHANGED` `details.currentVersion` · แถวไม่เปลี่ยน · ไม่มี event
- **I3-08** no-op (ส่งค่าเดิม, ส่ง key ซ้ำ) → 200 · version/`lastEdited` ไม่เปลี่ยน · ไม่มี event · **version เก่า + ค่าเท่าปัจจุบัน → 200 no-op ไม่เทียบ version** (ไม่ใช่ 409 `ROLE_CHANGED`) · `version`/`capabilities`/`name`/`lastEdited` ไม่เปลี่ยน · sink ได้ **0 event** (ไม่มี `org.role.updated` และไม่มี `escalation_denied`) — ตาม [api-spec §2](api-spec.md) + [architecture §2 ขั้น 4b](architecture.md) (backend ยืนยัน 2026-09-27) · control: no-op เดียวกันบน role ที่ติดกฎสิทธิ์ → 403 ตามกฎ (no-op เทียบหลังกฎสิทธิ์ — U-API3-05) · control: version เก่า + ค่าต่างจากปัจจุบัน → 409 `ROLE_CHANGED` (I3-07) — ถ้าไม่มี control นี้ เคส no-op เขียวได้แม้ไม่ตรวจ version เลย
- **I3-09** DELETE role ที่ไม่มีคนใช้ → 200 `DeletedRole` · Staff ที่มีสมาชิก active 2 + คำเชิญ pending 1 (**หมดอายุแล้ว**) → 409 `ROLE_IN_USE` `details={activeMembers:2, pendingInvitations:1}` · body ทั้งก้อนไม่มีอีเมล/userId/ชื่อคน (สแกน JSON) · `GET /members?roleId=` และ `GET /invitations?roleId=` ได้จำนวนเท่ากับ details
- **I3-10** ลบ role ที่เหลือแค่ประวัติ (สมาชิก revoked + คำเชิญ accepted + cancelled) → 200 · `GET /members` (revoked) และ `GET /invitations` (accepted/cancelled) ยังแสดงชื่อ role · live read ทุกตัว (`GET /roles`, `/role-details`, `/roles/{id}` → 404, เพดาน 30, คำสงวน) ไม่เห็น · PATCH member / เชิญด้วย roleId นี้ → คำตอบเดียวกับ roleId ที่ไม่มีอยู่
- **I3-11** ลด `MAX_DELETED_ROLES_PER_ORG` → ลบครบ → 409 `ROLE_HISTORY_LIMIT_REACHED` · role ยัง live
- **I3-12** `GET /capabilities`: ไม่มี entry tier `full` (`access_accounting`) · `full_access` มี `selectable=false, group=null` · 7 key เป็น `upcoming` · `manage_roles` เป็น `live` · org-scoped (Staff → 403)
- **I3-13** `GET /role-details` · `GET /roles/{id}`: `usage` ถูก · `lastEdited=null` หลัง seed · `viewer.canEdit/canDelete/canClone` ถูกทุก reason (`role_locked`, `exceeds_your_permissions`, `in_use_requires_manage_members`, `equal_permissions_in_use`, `in_use`, `owner_role`) · ผู้ไม่มี `manage_roles` (STF, MM) → 403

### 4.2 Owner lock และ Owner ≥ 1
- **I3-14** PATCH (rename / caps / no-op) และ DELETE role Owner โดย OWN → 409 `ROLE_LOCKED` **ไม่มี event** · โดย ADM_A → `ROLE_LOCKED` + `escalation_denied` reason `role_locked` (SR-13)
- **I3-15** ★ override provider `ROLE_WRITE_DECIDER` ด้วยตัวปล่อยทุกอย่าง → PATCH และ DELETE role Owner → **409 `LAST_OWNER` ไม่ใช่ 500** · แถวไม่เปลี่ยน · error log `role_invariant_violation`
- **I3-16** ชั้น DB ผ่าน `SYSTEM_PRISMA`: UPDATE `name`/`capabilities`/`deletedAt` ของแถว `isSystem` → ถูกปฏิเสธ · custom `SET "isSystem"=true, capabilities='{full_access}'` → ถูกปฏิเสธ (SR-07) · INSERT system role ที่สองของร้าน → unique · custom ที่มี `full_access` → CHECK · `capabilities='{}'` → CHECK · **เปลี่ยน `key` ของแถว system ได้** (I-45 ต้องใช้)
- **I3-17** OWN สร้าง role ที่มีทุก key ที่เลือกได้ → 201 · ใส่ `full_access` → `FULL_ACCESS_RESERVED` (AC-5.6)

### 4.3 การมอบ · gate · wire (AC-2.x · AC-6.4)
- **I3-18** 1 role มอบให้ 3 คน · 1 คนมี 1 membership ต่อร้าน · user เดียวกันเป็น Admin ใน A และ Staff ใน B
- **I3-19** ★ AC-2.5: MR → PATCH/DELETE member · invite create/reissue/cancel = `403 FORBIDDEN` **ไบต์เดียวกับ F-002** · MM → route role ทั้ง 6 = 403 · MM มอบ role ที่ ⊆ ตัวเองได้
- **I3-20** ★ AC-2.3: PATCH member / invite / reissue ด้วย role ⊄ ผู้ทำ (ข้าม UI) → `403 ROLE_EXCEEDS_ACTOR` **ไม่มี details** · event `exceeds_actor` + `excessCapabilities` · ไม่มีอะไรถูกเขียน
- **I3-21** AC-2.4 / AC-6.5: STF ใช้ access token เดิม · OWN ถอด `manage_orders` จาก Staff → request ถัดไปที่ต้องใช้ cap นั้น = 403 · ใส่คืน → 200 · ย้าย STF ไป role อื่น → request ถัดไปเห็นผล (ไม่มี login ใหม่ในเทสต์)
- **I3-22** ★ AC-6.4: `GET /roles` ของทั้ง 5 persona **ไม่มี key `capabilities`** (ตรวจ key ใน JSON) · `viewerCanAssign` มีเฉพาะผู้ถือ `manage_members` · `MemberRow.viewerCanManage/viewerCanResetPassword` **absent** สำหรับ MM (ไม่มี `manage_roles`) และมีสำหรับ ADM_A · `Invitation.viewerCanManage` มีเฉพาะผู้ถือ `manage_members` · **บันทึก response เป็น golden fixture ให้ client** (G3-14)
- **I3-23** verdict ⇔ write: ทุก verdict ที่เป็น false ใน seed → ยิง write จริงแล้วได้ code ที่ตรง (`owner_only`→`FORBIDDEN` · `equal_permissions`/`exceeds_your_permissions` บน MemberRow→`TARGET_NOT_BELOW_ACTOR` · บน Invitation→`ROLE_EXCEEDS_ACTOR` · `in_use_requires_manage_members`→`ROLE_HELD_REQUIRES_MANAGE_MEMBERS` · `equal_permissions_in_use`→`TARGET_NOT_BELOW_ACTOR`) · และทุก verdict true → write ผ่าน (ยกเว้น C-2 ของ reset)
- **I3-24** role ของร้าน A ใช้กับสมาชิก/คำเชิญของร้าน B → คำตอบเดียวกับ roleId ที่ไม่มีอยู่ · แถวของทั้งสองร้านไม่เปลี่ยน

### 4.4 D-034 บน route ที่ ship (AC-5.4 · AC-5.4b) — ชื่อเทสต์ต้องมี "AC-5.4b"
- **I3-25** ★ "AC-5.4b: Admin เปลี่ยน role ของ Admin อีกคนที่สิทธิ์เท่ากัน = 403 `TARGET_NOT_BELOW_ACTOR` (F-002 เดิม = 200)"
- **I3-26** ★ "AC-5.4b: Admin ถอด Admin อีกคนที่สิทธิ์เท่ากัน = 403 `TARGET_NOT_BELOW_ACTOR`"
- **I3-27** ★ ลำดับโจมตี 3 request (ADM_A, ADM_B ร้านเดียว — B ไม่อยู่ร้านอื่น ⇒ C-2 ไม่ช่วย): (1) PATCH B→Staff = 403 · B `roleId`/`version` ไม่เปลี่ยน · **refresh token ของ B ยังใช้ได้** (2) reset B = 404 (3) ไม่มีอะไรให้ยก
- **I3-28** control บน route สมาชิก: ADM_A เปลี่ยน/ถอด STF = 200 · ถอดตัวเอง (`DELETE /members/{ตัวเอง}`) = 200 · PATCH ตัวเองเป็น Staff = 200 · PATCH ตัวเองเป็น role ⊄ = 403 `ROLE_EXCEEDS_ACTOR` · เป้าหมาย superset/ตัดกัน = 403 `TARGET_NOT_BELOW_ACTOR` · OWN เปลี่ยน role OWN2 = 200 (`LAST_OWNER` คุม) · ADM_A ยกเลิกคำเชิญ Admin = 200 · **ADM_A ยกเลิกคำเชิญ Owner = 403 `FORBIDDEN` (พฤติกรรมใหม่ — api §4.3)**
- **I3-29** AC-4.4: ADM_A PATCH/DELETE OWN → `403 FORBIDDEN` body เท่ากับ golden ของ F-002 (หลังแทน traceId) · Admin → Owner พร้อม grant ⊄ ก็ยังได้ `FORBIDDEN` (owner_only มาก่อนกฎใหม่) · Owner คนสุดท้ายออก/ถูกถอด → 409 `LAST_OWNER`
- **I3-30** ★ SR-19 คู่ no-op: (a) ADM_A PATCH STF ไป role เดิม → **200 + `org.member.role_changed` 1 ตัว (from = to)** (b) ADM_A PATCH ADM_B ไป role เดิม → 403 + `escalation_denied` 1 ตัว · (a) แดงเมื่อใครเพิ่ม no-op short-circuit (MUT-08)

### 4.5 D-034 Addendum + Addendum 2 — แก้/ลบ role ที่มีผู้ถืออื่น
- **I3-31** ★ ตาราง arch §13.6 แถว 1–21 เป็นเคสแยก ชื่อ `D034-R01`…`D034-R21` · แต่ละแถว assert code + แถว R/version ไม่เปลี่ยนเมื่อปฏิเสธ + event ตามตาราง (แถว 13–16 **ไม่มี security event** แต่มี log warn `role_write_refused` reason `requires_manage_members`) · แถวที่ต้องระวังเป็นพิเศษ: R04 (rename-only = 403 · N-1) · R05/R14 (no-op = 403) · R06 (ยกจาก ⊊ เป็น = → 200) · R09/R15 (403 มาก่อน `ROLE_IN_USE`) · R12/R18 (ผู้ถืออื่นเป็น revoked หรือมีแค่คำเชิญ pending → ไม่นับ) · **เพิ่ม:** ADM_A เพิ่ม `manage_billing` ให้ role Admin → `ROLE_EXCEEDS_ACTOR` (§4.4 edge · AC-7.5)
- **I3-32** ★ "AC-5.4b (ทางแก้ role)": (ก) custom `R_B` = caps ของ A ที่ B ถือ (ข) role `Admin` ในร้านที่มี Admin 2 คน — ทั้งสองแบบ: (1) PATCH R ลด cap = 403 · `R.capabilities`/`version` ไม่เปลี่ยน (2) reset B = 404 (3) ไม่มีอะไรให้แก้คืน · control: OWN ทำขั้น 1 ผ่าน · A แก้ role ที่ถือคนเดียวผ่าน
- **I3-33** ★ ลำดับร่วมมือ 2 คน (SR-17, AC-5.8): MR, MM, T (`R_T={manage_orders}`) ร้านเดียว: (1) MR PATCH `R_T` → `{manage_products}` = **403 `ROLE_HELD_REQUIRES_MANAGE_MEMBERS`** · `R_T` ไม่เปลี่ยน (2) MM reset T = 404 (3) ไม่มีอะไรให้แก้คืน · control: MR′ (= MR + `manage_members`) ขั้น 1 ผ่าน
- **I3-34** verdict ของ MR: role ที่มีผู้ถืออื่น → `canEdit/canDelete.reason = in_use_requires_manage_members` · `canClone.allowed=true` · **ใน JSON เดียวกันมี `usage.activeMembers` และ `myMembership` พอให้คำนวณ reason ซ้ำได้** (assert ว่าไม่มีบิตใหม่) · MR ไม่ได้รายชื่อสมาชิก (`GET /members` = 403)

### 4.6 Admin reset (AC-5.5 · AC-5.5b) — ชื่อเทสต์ต้องมี "AC-5.5b"
- **I3-35** ★ 4 กรณีที่ระบุชื่อ: "Admin→Admin เท่ากัน = 404" · "Admin→Staff ⊊ = 200" · "ตัดกันไม่ครอบ (MMS → ผู้ถือ `R_BILL`) = 404" · "Owner→Owner = 200" · + superset = 404 · event `auth.password.admin_reset_blocked_privilege` บน refusal ใหม่ · เป้าหมายเป็น Owner ยังยิง `…_owner_target` ตัวเดียว
- **I3-36** ★ ไม่เป็น oracle: caller เดียวกันยิง (ก) 404 "ไม่ใช่สมาชิก" (ข) 404 "⊊ ไม่ผ่าน" → status เท่ากัน · body เท่ากันหลังแทน traceId · **ชุด header เท่ากัน** · **`Content-Length` เท่ากัน** · traceId เป็น UUID v4 · C-2 (หลายร้าน) และ High-2 (reset ตัวเอง) ได้คำตอบเดิม · timing = MAN3-04
- **I3-37** `viewerCanResetPassword=false` ⇒ reset จริง = 404 ทุกแถวใน seed · `true` แต่เป้าหมาย active ร้านอื่น (C-2) → 404 (อนุญาตโดยสเปก)

### 4.7 D-035 accept re-check (AC-5.3) — ชื่อเทสต์ต้องมี "D-035"
- **I3-38** ★ (arch §13.7) แต่ละข้อเป็นเคสแยก:
  - (a) ผู้เชิญถูกลดเป็น Staff → accept คำเชิญ Admin = `409 INVITATION_CANCELLED` **ไบต์เดียวกับคำเชิญที่ OWN ยกเลิกเอง** (หลังแทน traceId) · แถว `cancelled` · ไม่มี membership ใหม่ · event 1 ครั้ง reason `inviter_exceeds`
  - (b) ผู้เชิญถูกถอด / ออกเอง → `inviter_not_active`
  - (c) role ของผู้เชิญถูกแก้ถอด cap (membership ไม่ถูกแตะ) → ปฏิเสธ
  - (d) OWN เชิญ → ผ่านเสมอ
  - (e) ADM_A สร้าง → ADM_A ถูกลด → **OWN reissue** → accept ผ่าน
  - (f) อีเมลไม่ตรง + ผู้เชิญถูกลด → `INVITATION_EMAIL_MISMATCH` และคำเชิญ **ยัง pending**
  - (g) `already_member` + ผู้เชิญถูกลด → `ALREADY_MEMBER` เดิม
  - (h) แถวที่ `issuedByUserId` และ `invitedByUserId` เป็น null → ปฏิเสธ (fail-closed)
  - (i) ผู้เชิญถูกย้ายไป role ที่ไม่มี `manage_members` แต่ยัง ⊇ role คำเชิญ (คำเชิญ Staff) → ปฏิเสธ reason `inviter_not_authorized` · control: ผู้เชิญยังมี `manage_members` → ผ่าน
  - (j) OWN สร้าง → ADM_A reissue → ADM_A ถูกลด → accept **ปฏิเสธ** (ประเมินผู้ออกลิงก์ล่าสุด)
  - (k) control: ผู้เชิญยังมีสิทธิ์พอ → accept ผ่าน
- **I3-39** reissue โดย X ⇒ แถวใน DB มี `issuedByUserId = X` · `invitedByUserId` ไม่เปลี่ยน · `issuedByUserId` ไม่อยู่บน wire (สแกน JSON)
- **I3-40** preview ไม่ re-check: preview ได้ pending → accept ได้ `INVITATION_CANCELLED` (copy เดิม)

### 4.8 อายุคำเชิญ (AC-10.3 · AC-10.4)
- **I3-41** เชิญด้วย role ที่มี `manage_roles` (ไม่มี `manage_members`) → TTL 24 ชม. · Staff → TTL เดิม
- **I3-42** คำเชิญ Staff อายุยาว → OWN เพิ่ม `manage_members` ให้ Staff → `expiresAt = min(เดิม, tokenIssuedAt+24h)` · event `invitationsShortened=1` · ลดกลับ → ไม่ยืด
- **I3-43** ชั้น 2: kit ตั้ง `expiresAt` ยาวข้าม clamp + role elevated + `tokenIssuedAt` เก่ากว่า 24 ชม. → accept = `INVITATION_EXPIRED`

### 4.9 flag · rate limit · เพดาน
- **I3-44** ★ flag ปิด: POST/PATCH/DELETE role → 503 `ROLE_WRITES_DISABLED` สำหรับผู้ถือ `manage_roles` · **STF ได้ 403 `FORBIDDEN` ไม่ใช่ 503** · GET ทั้ง 3 ตัว 200 · `viewer.*.reason = writes_disabled` · **กฎเข้มบน route ที่ ship ไม่อยู่หลัง flag:** ขณะ flag ปิด ADM_A PATCH ADM_B = 403 `TARGET_NOT_BELOW_ACTOR` · reset ⊊ = 404 · accept re-check ทำงาน
- **I3-45** flag เปิด (toggle ในเทสต์เดียวกัน ด้วยการ boot app ใหม่) → เส้นทางเดียวกันได้ผลปกติ
- **I3-46** `roleWrite` (ลด limit): POST+PATCH+DELETE รวมกันครบ → 429 `RATE_LIMITED` + `Retry-After` เป็นจำนวนเต็ม ≥ 1 · Admin 2 คนร้านเดียวใช้โควตาร่วม · ร้าน B ไม่กระทบ
- **I3-47** `memberWrite` (ลด limit): PATCH/DELETE member + DELETE invitation รวมกัน → 429 · key `userId+org` (อีกคนในร้านเดียวกันไม่กระทบ) · invite create/reissue ใช้ limit เดิม

### 4.10 events
- **I3-48** `org.role.created/updated/deleted`: payload keys strict · `before/after` ถูก · `affectedActiveMembers` · `invitationsShortened` · **post-commit:** บังคับให้ tx ล้มหลัง write (ใช้ trigger soft-delete guard ใน race หรือ decider seam) → ไม่มี event
- **I3-49** ★ `escalation_denied` ยิงครบ **15 ช่อง route × reason** (ตาราง §5.3) แต่ละช่อง 1 เคส · payload มี `operation`/`reason` ถูก · **set-equality:** `ESCALATION_CHECKED_OPERATIONS` = operation ของ **route ที่ไม่ใช่ GET** ที่ spy เห็นเรียก `decideRoleWrite`/`decideMemberAuthority` ระหว่าง sweep (ไม่นับ accept/reset ที่มี event ของตัวเอง · ไม่นับ route GET ที่เรียก decider เพื่อคำนวณ verdict) · ไม่ยิงสำหรับ: Owner โดน `ROLE_LOCKED` · `requires_manage_members` · `ROLE_EMPTY` · `UNKNOWN_CAPABILITY` · ชื่อซ้ำ · `ROLE_CHANGED` · 503
- **I3-51** dedupe บน Redis จริง: `escalation_denied` key เดียวกัน 3 ครั้งติดกัน → sink ได้ 1 event · metric `security_event_suppressed_total{type}` เพิ่ม 2 · key ต่างกัน (targetUserId ต่าง) → 2 event (กรณี Redis ล่ม = U-API3-11)
- **I3-57** ★ กลับด้านของ I3-49 (backend ยืนยัน: route อ่านไม่ยิง `escalation_denied` — arch §7 ปิดชุด 8 operation): sweep **route GET ทุกเส้นที่คำนวณ `viewer.*`** (`GET /roles` · `/role-details` · `/roles/{id}` · `/members` · `/invitations` — enumerate จาก router ด้วยเงื่อนไข "method GET และ spy เห็นเรียก `decideRoleWrite`/`decideMemberAuthority`/`decideAdminResetVisible`" ไม่ใช่ลิสต์พิมพ์มือ) × persona ที่ได้ verdict = false อย่างน้อยหนึ่งแถว (ADM_A · MR · MMS) → sink ได้ **0 event ทุกชนิด** (ไม่ใช่แค่ `escalation_denied`) · Redis ไม่มี dedupe key ใหม่ · **non-vacuity:** จำนวน route ที่ sweep ≥ 5 · จำนวน verdict=false ที่เห็นใน response รวม > 0 (ไม่งั้น 0 event เขียวเพราะไม่มีอะไรถูกปฏิเสธ) · control: ยิง write ที่ตรงกับ verdict=false ตัวหนึ่งหลัง sweep → sink ได้ 1 event (พิสูจน์ว่า sink ต่ออยู่)
- **I3-50** สแกน payload ของทุก event ที่เก็บได้ตลอด int suite ของ F-003: ไม่มี substring ของอีเมลใด ๆ ที่ seed ไว้ · ไม่มี key ของชื่อคน (AC-9.5)

### 4.11 tenant และ scope (กฎทอง 3)
- **I3-52** ★ leak kit: route ใหม่ enumerate จาก `ROUTE_CAPABILITIES` (**ไม่ใช่ลิสต์พิมพ์มือ**) · 5 persona (รวม `underprivilegedInA`) · roleId ของร้าน B บน path ร้าน A → 404 **ไบต์เดียวกับ** roleId ที่ไม่มี และ role ที่ถูกลบ · แถวของ B ไม่เปลี่ยน · `?roleId=<ของ B>` บน `/members` และ `/invitations` → 200 หน้าว่าง · non-vacuity: kit พิมพ์จำนวน route ที่ตรวจ (≥ 6) และมี outcome สำเร็จ ≥ 1
- **I3-53** `lastEdited.by` (SR-09): ผู้แก้ถูกถอดจาก A แต่ active ใน B → `GET /roles/{id}` ของ A ได้ `kind="former_member"` · **JSON ทั้งก้อนไม่มีชื่อหรือ key ของ role ใดในร้าน B** (seed role ของ B ให้ชื่อไม่ซ้ำกับ A) · ผู้แก้คือผู้ดู → `me` · ผู้แก้ active → `member` + ชื่อบทบาทปัจจุบัน · ผู้แก้เปลี่ยน role ภายหลัง → แสดงชื่อ role ใหม่
- **I3-54** AC-1.5 บน wire: `roleNameCustomized?` ตรงกันทั้ง 6 schema (`MemberRow`, `Invitation`, `InvitationPreview`, `AcceptedMembership`, `OrgMyMembership`, `MyOrganizationMembership`) หลังเปลี่ยนชื่อ Staff · `RoleRow.nameCustomized`

### 4.12 provisioning และ I-45
- **I3-55** `POST /organizations` → 3 role พอดี · caps canonical เท่ากับ preset (Admin มี `manage_roles`) · Owner `["full_access"]` `isSystem=true` · key `owner/admin/staff` · ไม่มี Accountant
- **I3-56** ★ **I-45 int (AC-10.1)** — ใช้ `setRoleKey` ของ kit: สลับ key Staff↔Owner + ตั้ง `key=null` ให้ Owner แล้วยิง (1) **ชุด Owner-only ของ F-002 ทั้งหมด** (PATCH member เป็น Owner · DELETE Owner · เชิญด้วย role Owner) → STF ได้ 403 ทุกเส้น · OWN ทำได้ทุกเส้น (2) **เส้น F-003:** STF (key=`owner`) แก้ role ไม่ได้ (403) · role Owner ที่ key=`staff` ยังได้ `ROLE_LOCKED` · custom role ที่ถูกตั้ง key=`owner` ไม่ได้ `ROLE_LOCKED` · TTL คำเชิญ (`isElevatedRole`) และ verdict ไม่ขยับตาม key · backfill ไม่ให้ `manage_roles` แก่ Staff ที่ถูกตั้ง key=`admin` (M3-04) · key มีผลแค่ป้ายชื่อ

### 4.13 concurrency (IC3 · barrier จริง · ผลต้องตรงลำดับ commit ทั้งสองทิศ)
- **IC3-01** PATCH role 2 ตัวด้วย version เดียวกันพร้อมกัน → 200 หนึ่งตัว + 409 `ROLE_CHANGED` หนึ่งตัว · caps สุดท้าย = ของตัวที่ 200
- **IC3-02** SR-05: tx A (reset) ค้างหลัง Membership FOR SHARE ‖ tx B PATCH member ของเป้าหมาย → B รอจน A commit (ตรวจจาก `pg_locks` หรือลำดับ commit) · กลับทิศ: B commit ก่อน → A อ่าน `roleId` ใหม่
- **IC3-03** SR-08: request ผ่าน guard แล้วค้างก่อนได้ lock ‖ OWN ถอด `manage_roles` ของ role ผู้ทำแล้ว commit → request เดินต่อ → 403 `FORBIDDEN` + ไม่มี write
- **IC3-04** Addendum 2: barrier เดียวกัน OWN ถอด `manage_members` ระหว่างรอ → `403 ROLE_HELD_REQUIRES_MANAGE_MEMBERS` · กลับทิศ: role ไม่มีผู้ถือตอนเปิดจอ แต่ C ถูกย้ายเข้าก่อน edit ได้ lock → edit 403
- **IC3-05** tx1 edit `R` (= A, ไม่มีผู้ถืออื่น) ‖ tx2 PATCH ย้าย C เข้า `R`: tx1 ก่อน → tx2 อ่าน caps ใหม่แล้วตัดสินใหม่ · tx2 ก่อน → tx1 นับ C แล้วปฏิเสธ
- **IC3-06** accept คำเชิญของ `R` ‖ edit `R` และ accept ‖ PATCH ลดผู้เชิญ (D-035 (9)) → ผลตรงกับลำดับ commit ทั้งสองทิศ
- **IC3-07** ลบ role ‖ เชิญด้วย role นั้น: เชิญก่อน → 409 `ROLE_IN_USE` · ลบก่อน → 422 `ROLE_INVALID` · **SR-06:** ทำซ้ำด้วย SQL ตรงที่ข้าม org lock ทั้งสองทิศ → trigger ปฏิเสธฝั่งที่มาทีหลัง · `provolatile = 'v'` ของ 2 function
- **IC3-08** ถือ org lock ค้างเกิน timeout → 3 operation ใหม่ได้ 409 `CONFLICT {reason:"busy"}`

### 4.14 migration + backfill (M3 · `packages/db/test`)
- **M3-01** ★ harness: migrate ถึง `20260807000000_f002_role_org_composite_fk` → seed ร้านที่ Owner active = 0 → apply F-003 → **exit ≠ 0** + stderr มี `f003_owner_invariant_violation org=<id>` · control: ร้านปกติ → ผ่าน
- **M3-02** pre-flight ล้มทีละกรณี: ชื่อซ้ำแบบ `lower(btrim)` · ชื่อมี U+200B · ร้านมี `isSystem` 2 แถว · caps ว่าง · role ที่ไม่ใช่ system ถือ `full_access`
- **M3-03** apply `f003_role_expand` สองรอบ (รวมกรณีหยุดกลางทาง) + `prisma migrate diff` ว่าง
- **M3-04** ★ backfill: seed ร้านแบบ F-002 → migrate → caps ของ 3 role = preset เป๊ะ · `backfill:f003` สองรอบ → รอบสอง **0 แถว และ version ไม่ขยับ** · `key='admin'` ที่ caps ไม่ตรงชุด → ไม่ได้ `manage_roles` + WARNING · Staff ที่ถูกตั้ง key=`admin` → ไม่ได้ · มี NOTICE `f003_backfill actor=system org=… role=…` ต่อแถวที่แก้ (อ่านผ่าน notice handler) · ไม่มี event ผ่าน `SecurityEventsService` · `lastEditedAt` ยัง null
- **M3-05** bridge trigger: INSERT Admin แบบชุด F-002 → ได้ `manage_roles` (canonical) · INSERT Admin ที่มีอยู่แล้ว → ไม่ซ้ำ · custom `key=null` → ไม่แตะ · UPDATE ไม่ถูกแตะ
- **M3-06** script `backfill:f003` execute ข้อความเดียวกับไฟล์ migration (เทียบ hash)
- **M3-07** query ตรวจก่อน rollback (arch §12) = 0 บนฐานที่เพิ่ง migrate และ flag ไม่เคยเปิด · > 0 หลังสร้าง role 1 ตัว (หลักฐานให้ runbook ของ devops)

---

## 5. Regression ของพฤติกรรมที่เปลี่ยนบน route ที่ ship + static gate

### 5.1 ทุกแถวของ api-spec §4.3 มี regression (oasdiff มองไม่เห็นแถวเหล่านี้)

| route | พฤติกรรมใหม่ | test |
|---|---|---|
| `PATCH /members/{userId}` | target ⊊ · grant ⊆ · no-op ถูกตรวจ · `memberWrite` | I3-25 · I3-27 · I3-28 · I3-30 · I3-20 · I3-47 |
| `DELETE /members/{userId}` | target ⊊ (ยกเว้นตัวเอง) · `memberWrite` | I3-26 · I3-28 · I3-47 |
| `POST /invitations` | grant ⊆ · role ที่ลบ = 422 | I3-20 · I3-10 · IC3-07 |
| `POST …/invitations/{id}/link` | grant ⊆ · TTL นับ `manage_roles` · เขียน `issuedByUserId` | I3-20 · I3-41 · I3-39 |
| `DELETE …/invitations/{id}` | Owner → `FORBIDDEN` · ⊆ · `memberWrite` | I3-28 · I3-49 · I3-47 |
| `POST /invitations/accept` | re-check 3 เงื่อนไข · clamp | I3-38 · I3-43 |
| `POST /invitations/preview` | ไม่ re-check | I3-40 |
| `POST …/reset-password` | ⊊ · 404 รูปเดิม | I3-35 · I3-36 |
| `GET /orgs/{orgId}` | Admin มี `manage_roles` | I3-55 · M3-04 |
| `@RequireCapability` ทุก route | + imply | U-RB-04 |

### 5.2 static gate (Track 1 · ทุกตัว: fixture แดง (G-05) + self-check สองทาง + non-vacuity นับ match > 0)

**AC-10.1 — gate ของ F-002 ที่ยังไม่มีในโค้ด (ตรวจ repo 2026-09-27: ไม่มี implementation ของทั้ง 4 ตัว)**

| ID | กฎ (นิยามตาม F-002 test-plan §10) | fixture แดง |
|---|---|---|
| **G-06** | ไม่มี write path ใดเขียน `status: "invited"` (รวม raw SQL) | `membership.update({ data: { status: "invited" } })` |
| **G-09** | ไม่มี dependency หรือโค้ดส่งอีเมล (SMTP/mailer) ใน `apps/api` (`package.json` + import) | fixture import `nodemailer` |
| **G-11** | ไม่มี `toLowerCase()`/`trim()` บนอีเมลเอง — ต้องเรียก `normalizeEmail` | `email.trim().toLowerCase()` |
| **G-12** ★ | ห้ามใช้ `key`/`roleKey` ตัดสินสิทธิ์: `role.key ===`/`!==`/`==` · `roleKey ===` · `key === "owner"\|"admin"\|"staff"` (ทุกแบบ quote) · `[...].includes(role.key)` · `switch (roleKey)` ใน `apps/api` + `apps/web` + `apps/mobile` (Dart) · allowlist เฉพาะไฟล์ presentation (รายไฟล์) · **ขยาย (SR-10):** scan `packages/db/prisma/migrations/**/migration.sql` เฉพาะตัว `CREATE [OR REPLACE] FUNCTION … $$…$$` ที่อ้าง `key = '(owner\|admin\|staff)'` → แดง เว้นแต่อยู่ใน allowlist ที่มี `removeBy` · `role_f003_admin_bridge` อยู่ใน allowlist `removeBy = วัน merge PR build + 60 วัน` · **เลยวันแล้วยังถูกสร้างโดยไม่มี drop ตามหลัง = แดง** (ทดสอบด้วย clock seam) · backfill `UPDATE` ไม่ใช่ function ⇒ ไม่นับ | TS 5 รูป · Dart 2 รูป · SQL function 1 รูป · allowlist หมดอายุ 1 รูป |

**F-003 — ตัวแทน G-15 และ gate ใหม่**

| ID | กฎ | fixture / non-vacuity |
|---|---|---|
| **G3-01** (G-15 ก) | `@RoleWrite()` enumerate จาก Nest router **set-equal** กับ `ROLE_WRITE_ROUTES` · ต่อ route: spy ว่าเรียก `decideRoleWrite` **และ** `assertOwnerRemains` **และ** มี `RoleWritesEnabledGuard` | route ที่ลืม decorator · decorator ที่ไม่อยู่ในลิสต์ (สองทิศ) |
| **G3-02** (G-15 ข) | `ValidatedCapabilities` สร้างได้จาก `validateRoleCapabilities` เท่านั้น · grep ห้าม `as ValidatedCapabilities` นอก `rbac/` · **type-level: fn ที่เขียน `Role.capabilities` ใน `RolesService`/provisioning รับ `ValidatedCapabilities` เท่านั้น** (`@ts-expect-error` เมื่อส่ง `string[]`) — ถ้าไม่มีข้อนี้ brand ไม่ได้กันอะไร | fixture cast · fixture ส่ง `string[]` |
| **G3-03** (G-15 ค) | `RAW_ROLE_WRITE` + `ROLE_WRITE` เดิม · allowlist = {`orgs/roles.service.ts`, `orgs/system/org-provisioning.service.ts`} รายไฟล์ พร้อมเหตุผล · `CAPABILITIES_FROM_INPUT` เปลี่ยนความหมายเป็น "ค่าจาก input ต้องผ่าน `validateRoleCapabilities` ใน call path เดียวกัน" · self-check เดิม 5+2+4 รูปยังแดง · allowlist ไม่มีรายการค้าง | snippet ของไฟล์ใหม่ที่เขียน Role |
| **G3-04** | `LIVE_ROLE_WHERE` (dm §2.2): regex `\.role\.(findFirst\|findFirstOrThrow\|findUnique\|findUniqueOrThrow\|findMany\|count\|aggregate\|groupBy)\(` + raw `FROM\s+"Role"`/`JOIN\s+"Role"` · ต่อ call site ต้องมี `LIVE_ROLE_WHERE` ใน argument หรือคอมเมนต์ `// role-read: history — <เหตุผล>` บรรทัดก่อนหน้า | fixture `findUniqueOrThrow` · `groupBy` · raw `FROM "Role"` · คู่กับ I3-10 |
| **G3-05** | single copy: `isProperSubset(` ถูกเรียกเฉพาะ `rbac/member-authority.ts` (≥ 1 call) · `member-authz`/`admin-reset-authz` ไม่มี logic ⊆/⊊ ของตัวเอง | fixture เรียก `isProperSubset` ในไฟล์อื่น |
| **G3-06** | `hasCapability(… full_access)` นอก `rbac/` ไม่ถูกใช้แทนการเทียบชุด | fixture |
| **G3-07** | Unicode parity (SR-04): ชุด code point 0..0x10FFFF ที่ `/[\p{Cc}\p{Cf}]/u` ของ Node ใน CI match **set-equal** กับชุดที่ parse จาก character class ใน migration SQL ทุกตัว · ชุดต้องมี U+200B และ U+202E | fixture SQL ที่ขาด U+2060 |
| **G3-08** | i18n ของคำแปล system role: web `i18n.ts` + mobile `app_th.arb` = `SYSTEM_ROLE_LABELS` · parse ได้ 0 ค่า = แดง | fixture คำแปลต่างกัน |
| **G3-09** | capability-lint ของ F-002 ขยาย: client ไม่ hard-code key หรือป้ายภาษาไทยของ capability (ป้ายมาจาก `GET /capabilities` — D-037) · ข้อความที่ยอมให้อยู่ client มี 3 ตัว (arch §11) | fixture ป้าย hard-code ใน web และ Dart |
| **G3-10** | backfill SQL แหล่งเดียว: glob ได้ 1 ไฟล์พอดี · ใน `src/` ไม่มี literal `'manage_roles'` คู่กับ `UPDATE "Role"` | fixture |
| **G3-11** | `org-lock-callsites.test.ts` ขยาย: ทุก call site ที่เขียน `Membership.roleId` หรือ `status → 'active'` อยู่ใน operation ของ `ORG_LOCK_REQUIRED_OPERATIONS` (+3 operation ใหม่) | fixture call site นอก lock |
| **G3-12** | regression pack: ทะเบียน `NEW-10` ย้ายจาก pin tripwire (G-15) ไปผูก U-RB-10/12, I3-20, I3-31, G3-01..03 · เพิ่มแถว SR-F003-01..19 + AC-5.4b/5.5b/D-035 (§8) · marker ต้องพบในไฟล์ | gate เดิมของ `regression-pack.test.ts` |
| **G3-13** | CI floors (**devops wire · qa กำหนด**): `assert-tests-ran --require` ของไฟล์ int F-003 ทุกไฟล์ (รวมไฟล์ของ I3-56) และ `--min-passed` ขยับขึ้น · job `node-ci` ต้องรัน gate G-06/09/11/12 จริง (นับเคส > 0 ใน JSON report) | ลบไฟล์ int → job แดง |
| **G3-14** | fixture ของ client (web + Flutter) = response ที่ I3-22/I3-13 บันทึกจาก server จริง (4 persona) · ไฟล์ใน client ต่างจากที่บันทึก = แดง (กัน "mock shaped to the client") | แก้ fixture ฝั่ง client ด้วยมือ |

- **oasdiff + route↔spec parity + `openapi-parity` + redocly lint** (มีอยู่แล้ว) ต้องเขียว: path ใหม่ 6 · optional response prop · optional query 2 · 0 breaking

### 5.3 `escalation_denied` — 8 ไม่ใช่ 6 (ตรวจแล้ว)

| operation | route | reason ที่เกิดได้ |
|---|---|---|
| `create_role` | POST `/roles` | `exceeds_actor` · `full_access_reserved` |
| `update_role` | PATCH `/roles/{id}` | `exceeds_actor` · `target_not_below_actor` · `full_access_reserved` · `role_locked` |
| `delete_role` | DELETE `/roles/{id}` | `exceeds_actor` · `target_not_below_actor` · `role_locked` |
| `change_member_role` | PATCH `/members/{userId}` | `target_not_below_actor` · `exceeds_actor` |
| `remove_member` | DELETE `/members/{userId}` | `target_not_below_actor` |
| `invite_create` | POST `/invitations` | `exceeds_actor` |
| `invite_reissue` | POST `…/{id}/link` | `exceeds_actor` |
| `invite_cancel` | DELETE `…/invitations/{id}` | `exceeds_actor` |

- **ผล:** 8 operation · 15 ช่อง · ตรงกับ arch §7 ("บน 8 เส้นทาง") และ §13.4 ("ยิงครบ 8 เส้นทาง") · api-spec §4.3 เพิ่มกฎ ⊆ บน **ยกเลิกคำเชิญ** และ D-034 เพิ่มแกน target บน **DELETE member** ⇒ 6 เป็นชุดก่อนสองการเปลี่ยนนี้ (role CRUD 3 + PATCH member + invite create + reissue) · accept (`accept_blocked_inviter`) และ reset (`admin_reset_blocked_privilege`) มี event ของตัวเอง ไม่นับ · `requires_manage_members` ไม่ยิง event
- **ข้อจำกัดของการตรวจ:** `ESCALATION_CHECKED_OPERATIONS` และ `decideMemberAuthority` **ยังไม่มีในโค้ด** ⇒ ยืนยันจากเอกสารที่ล็อกแล้วเท่านั้น · U-API3-12 + I3-49 จะ pin เลข 8 และ set-equality ตอน build

---

## 6. AC-10.1 — งานจริงและลำดับ merge (ไม่ใช่ checkbox)

1. **PR-gates (ก่อนหรือใน PR เดียวกับ route เขียน role ตัวแรก):** G-06 · G-09 · G-11 · G-12 (รวมส่วน migrations + `removeBy`) พร้อม fixture แดงและ self-check · **I3-56 (I-45 int)** · G3-13 (CI floors ของไฟล์ I3-56 และ job ที่รัน G-xx)
2. **PR ที่เปิด route เขียน role:** ห้าม merge ถ้า CI log ของ commit นั้นไม่แสดงว่า G-06/09/11/12 + I3-56 **รันจริง** (จำนวนเคส > 0 ใน JSON report · `assert-tests-ran` ผ่าน) — int suite ที่ self-skip เพราะไม่มี `TEST_DATABASE_URL` ต้องแดง ไม่ใช่เขียว
3. **PR เดียวกับกฎ ⊆:** ปลด G-15 → G3-01..03 + U-RB-10/12 + I3-20/31 + G3-12 (อัปเดตทะเบียน NEW-10) · ห้ามลบ `role-capability-write-tripwire.test.ts` ก่อนตัวแทนเขียว
4. **PR เดียวกับการเปลี่ยนพฤติกรรม route ที่ ship:** I3-25..30, I3-35/36, I3-38 และ R3-04 (เทสต์เดิมที่ assert พฤติกรรม F-002) — ห้ามแยก regression ไป PR ถัดไป
5. **ก่อนเปิด `ROLE_WRITES_ENABLED` ใน environment ใด (arch §12 เงื่อนไข 3):** QA ตรวจว่าใน commit ที่ deploy มี G-12 (fixture แดง + non-vacuity + allowlist ของ bridge ที่มี `removeBy`) และ I3-56 และ CI log ของ commit นั้นมีจำนวนเคส > 0 · ไม่มี = verdict แดงสำหรับการเปิด flag (ความเสี่ยงอื่นของ rollout = devops/release)

---

## 7. Test data

- **seed kit F-003 (ต่อยอด `f002-seed.kit.ts`):** `createCustomRole({name, capabilities, key?})` · `softDeleteRole` · `setRoleVersion` · `setLastEdited` · `createInvitation({ issuedByUserId })` · `setInvitationExpiry` (ข้าม clamp สำหรับ I3-43) · scenario ใหม่ `f003-personas` · ห้าม restate กฎ production ใน kit (ใช้ `SYSTEM_ROLE_BLUEPRINT` และ `validateRoleCapabilities` จริง)
- **ร้าน A (`f003-personas`):** OWN · OWN2 · ADM_A · ADM_B · STF · MR · MM · T (`R_T`) · MMS (Staff + `manage_members`) · REV (revoked ถือ `R_HIST`) · custom role: `R_B` (= caps ของ Admin, ADM_B ถือ) · `R_T` · `R_BILL` (`manage_billing` + `manage_orders`) · `R_HIST` (มีแค่ประวัติ) · คำเชิญ: pending · pending หมดอายุ · accepted · cancelled · ออกโดย ADM_A · reissue โดย OWN
- **ร้าน B:** โครงเดียวกัน · **ชื่อ custom role ไม่ซ้ำกับ A** (ให้ I3-53 ตรวจการรั่วได้) · user `activeInBoth` เป็น Admin ใน A และ Staff ใน B · ผู้แก้ role ของ A ที่ย้ายไปอยู่ B
- **isolation:** ทุกเคสใช้ label ของ kit แยก · `cleanup()` ลบเฉพาะแถวที่สร้าง · เคสที่เปลี่ยน env (limit, flag) boot app ของตัวเอง
- **ไม่เกี่ยวกับสต๊อก:** F-003 ไม่มี `StockMovement` · state ทั้งหมดอยู่ใน `Role`/`Membership`/`Invitation`

---

## 8. regression pack (permanent) — tier

- **smoke (ทุก PR):** U-RB-10 · U-RB-12 · U-RB-18 · U-RB-19 · U-OI-01/02/07 · U-API3-01 · I3-15 · I3-19 · I3-22 · I3-25 · I3-26 · I3-27 · I3-30 · I3-32 · I3-33 · I3-35 · I3-36 · I3-38(a)(i)(j) · I3-44 · I3-52 · I3-56 · I3-57 · M3-01 · G-12 · G3-01..05
- **full:** ที่เหลือทั้งหมด (รวม U-RB-20 BFS, IC3, P3)
- **ทะเบียนใหม่ใน `REGRESSION_PACK` (G3-12):** SR-F003-01..19 ทุกข้อผูกกับเทสต์ตาม §10 · SR-15 = `noTest` (ส่งต่อ product ไม่มีพื้นผิวใน F-003) · NEW-10 เปลี่ยนจาก tripwire เป็นเทสต์จริง
- **flaky policy:** IC3 ใช้ barrier ไม่ใช้ sleep · ห้าม `retry` · เคสที่ flaky ถูก quarantine ได้เฉพาะเมื่อมี issue + owner และ **ห้ามอยู่ใน smoke** (ถ้าเป็นเคส smoke ต้องแก้ ไม่ใช่ quarantine)

### 8.1 เทสต์/kit เดิมที่ต้องแก้ (R3 — regression ที่ตั้งใจ)
- **R3-01** `security-events.service.test.ts`: union 19 → **25** · เพิ่มการตรวจ `F003_SECURITY_EVENT_TYPES` · F-002 15 ไม่แตะ (AC-9.4 — ต้องอยู่ใน PR เดียวกับ event ใหม่)
- **R3-02** `role-capability-write-tripwire.test.ts` (G-15): ถูกแทนด้วย G3-01..03 · ทะเบียน NEW-10 ใน `regression-pack.ts` ต้องเปลี่ยน pin ในคอมมิตเดียวกัน (ไม่งั้น gate ของ pack แดง)
- **R3-03** ⚠️ `f002-seed.kit.ts` scenario `custom-role-null-key` สร้าง `Custom B` ที่ `capabilities: []` → **ขัด CHECK `Role_capabilities_nonempty` และ pre-flight ของ `f003_role_expand`** ⇒ ต้องเปลี่ยนเป็น caps ที่ไม่ว่าง (เช่น `["manage_orders"]`) โดยที่ I-44(c)/I-45 ยังหมายความเหมือนเดิม · ไล่ scenario อื่นที่สร้าง role เอง (ต้องไม่มี `full_access` บน role ที่ไม่ใช่ system)
- **R3-04** เทสต์เดิมที่ assert พฤติกรรม F-002 ซึ่งเปลี่ยนโดยตั้งใจ (Admin→Admin PATCH/DELETE/reset สำเร็จ · Admin ยกเลิกคำเชิญ Owner สำเร็จ · preset Admin ไม่มี `manage_roles`) → กลับด้าน assertion พร้อมอ้าง AC-5.4b/5.5b/api §4.3 ในชื่อเทสต์ · **ห้าม skip**
- **R3-05** `roles.service.test.ts` I-45 unit คงไว้ · เทสต์ของ `GET /roles` เพิ่ม optional field แต่ยัง assert ว่าไม่มี `capabilities`
- **R3-06** web `member-actions.ts`/test: ใช้ verdict เมื่อมี · fallback แบบ F-002 เมื่อ field absent (CW3-03)
- **R3-07** `error-code-contract.test.ts` · `openapi-parity` · `route-registry` ขยายให้ครอบ route/code ใหม่
- **R3-08** CI floors ใน `ci.yml` (`--require`/`--min-passed`) ขึ้นตามไฟล์ใหม่ (G3-13)

---

## 9. red run — หลักฐานว่าเทสต์แดงได้จริง (บทเรียน "test name overclaims")

PR ที่มีเทสต์ ★ ต้องแนบหลักฐาน red run (CI run หรือ log ที่เห็นว่า int lane เปิด) ของ mutation ต่อไปนี้ · mutation ที่ไม่ทำให้เทสต์ที่ระบุแดง = เทสต์นั้นอ้างเกินจริง ต้องแก้ก่อน merge

| MUT | mutation | ต้องแดงที่ |
|---|---|---|
| 01 | ลบแกน target ของ `change_role` | U-RB-10 · U-RB-21 · I3-25 · I3-27 · U-RB-18 |
| 02 | ลบ before ⊊ ใน `decideRoleWrite` | U-RB-12 (R01/R03/R04/R05/R09) · I3-31 · I3-32 · U-RB-18 |
| 03 | ลบ floor `manage_members` ของ `write_held_role` | U-RB-12 (R13–R16) · I3-33 · U-RB-18 |
| 04 | PATCH ตัวเองข้ามแกน grant | U-RB-10 (self) · I3-28 · U-RB-18 |
| 05 | accept re-check ใช้ `invitedByUserId` แทน `issuedByUserId` | I3-38(e)(j) |
| 06 | accept re-check ตัด floor `manage_members` | I3-38(i) · U-RB-10 |
| 07 | ย้าย `assertOwnerRemains` ไปหลัง write / ลบทิ้ง | U-API3-01 · I3-15 |
| 08 | ใส่ no-op short-circuit ใน `MembersService.updateRole` | I3-30(a) |
| 09 | refusal ⊊ ของ reset ตอบ 403 หรือ body ต่าง | I3-35 · I3-36 |
| 10 | ลบ `LIVE_ROLE_WHERE` ออกจาก `GET /roles` | G3-04 · I3-10 |
| 11 | วาง flag guard ก่อน `CapabilityGuard` | I3-44 (STF ได้ 503) |
| 12 | `hasCapability` ไม่ผ่าน `expandCapabilities` | U-RB-04 |
| 13 | memoize membership ต่อ access token | I3-21 |
| 14 | `GET /roles` ส่ง `capabilities` | I3-22 |
| 15 | `isElevatedRole` อ่าน `key === "admin"` | U-RB-16 · I3-56 · G-12 |
| 16 | ใส่ `ROLE_WRITES_ENABLED` คุมกฎเข้มบน route สมาชิก | I3-44 |
| 17 | ให้การคำนวณ `viewer.*` บน route GET เรียก path ที่ยิง `escalation_denied` | I3-57 |
| 18 | PATCH role เทียบ `version` ก่อนตรวจ no-op (no-op + version เก่า → 409) | I3-08 |

---

## 10. SR-F003-01..19 → เทสต์ที่พิสูจน์ตอน build

| SR | test |
|---|---|
| 01 High | U-RB-10 · U-RB-21 · I3-25..28 · I3-31 · I3-32 |
| 02 Medium | I3-38 · I3-39 · IC3-06 · U-API3-08/09 |
| 03 Medium | U-CFG3-01 · I3-44 · I3-45 · M3-07 · §6 ข้อ 5 · MAN3-05 |
| 04 Medium | U-RB-07 · I3-02 · G3-07 · M3-02 |
| 05 Low | IC3-02 |
| 06 Low | IC3-07 |
| 07 Low | I3-16 |
| 08 Low | U-RB-12 (floor) · U-API3-02 · IC3-03 |
| 09 Low | I3-53 |
| 10 Low | G-12 (migrations + `removeBy`) · M3-05 |
| 11 Low | U-RB-02 · U-RB-03 · U-RB-10 (unknown key) |
| 12 Low | I3-11 · I3-46 · I3-47 · U-API3-11 · U-CFG3-02/03 |
| 13 Info | I3-14 · I3-49 |
| 14 Info | CW3-05 · CM3-05 · EW3-08 · EM3-06 |
| 15 Info | ไม่มีเทสต์ (ส่งต่อ product — ไม่มีพื้นผิวใน F-003) |
| 16 Low | U-RB-18 · U-RB-19 · U-RB-20 |
| 17 Low | U-RB-12 (R13–R20) · U-RB-19 c3 · I3-31 · I3-33 · IC3-04 |
| 18 Info | I3-31 (R04, R14) |
| 19 Info | I3-30 |

---

## 11. Client — unit/widget + E2E (web + Flutter · Track 1)

> ⚠️ `ui.md` / `ux-wireframe.md` ยัง signoff pending (ux กำลังเพิ่ม sheet เปลี่ยนบทบาทบนมือถือขนานกัน) ⇒ E2E ข้างล่างเขียนตามพฤติกรรม **ไม่ผูก selector/copy** · selector และ copy ถูก pin เมื่อ ux เซ็น · fixture ทุกตัวมาจาก G3-14 (บันทึกจาก server) ไม่ใช่เขียนมือ

**client unit — web (CW3) / Flutter (CM3) · ต้องมีคู่กันทุกข้อ**
- **CW3-01 / CM3-01** คำเตือนเสียสิทธิ์ตัวเองใช้ golden vectors ไฟล์เดียวกับ U-RB-09 (อ่านไฟล์ ไม่คัดลอกค่า)
- **CW3-02 / CM3-02** กติกาแสดงชื่อ `nameCustomized ? name : (แปล key ?? name)` · Owner แปลเสมอ · key ที่ไม่รู้จัก → `name`
- **CW3-03 / CM3-03** ★ UI ตาม verdict ของ server ทั้งสองทิศ (บทเรียน "client-invented server facts"): verdict=false + caps ในเครื่องบอกว่าได้ → **disabled** · verdict=true + caps ในเครื่องบอกว่าไม่ได้ → **enabled** · verdict absent → พฤติกรรม F-002 · dropdown role ที่ `viewerCanAssign=false` = disabled + เหตุผล ไม่ซ่อน · ไม่มีโค้ดเทียบชุด ⊆/⊊ ฝั่ง client
- **CW3-04 / CM3-04** checklist จาก `GET /capabilities`: กลุ่ม · ป้าย "เร็ว ๆ นี้" · ไม่มี `full_access` · imply-lock (ใช้ catalog fixture ที่มีคู่ `manage_X → view_X` และผ่าน schema ของ OpenAPI) · key/group/status ที่ไม่รู้จัก → ข้อความกลาง
- **CW3-05 / CM3-05** `409 ROLE_CHANGED`: เรียก re-fetch · **mutation ถูกเรียก 1 ครั้งเท่านั้น** (ไม่มี resubmit อัตโนมัติด้วย `currentVersion` — SR-14)
- **CW3-06 / CM3-06** map error → copy ครบทุก code ใหม่ · code ที่ไม่รู้จัก → ข้อความกลาง · `ROLE_HELD_REQUIRES_MANAGE_MEMBERS` **อยู่ในจอเดิม** · `FORBIDDEN` ออกจากจอ role
- **CM3-08** ★ (Flutter widget · AC-2.2) sheet เปลี่ยนบทบาทสมาชิกรายคน ด้วย fixture G3-14: ตัวเลือก role = **ชุดเดียวกับจอเชิญ** (widget/แหล่งข้อมูลเดียวกัน · `viewerCanAssign=false` → disabled + เหตุผล ไม่ซ่อน · มี custom role) · role ปัจจุบันของสมาชิกถูกเลือกไว้ · แถว `viewerCanManage=false` → **แสดงเหตุผลตาม `viewerManageReason` และไม่มี action เปิด sheet** (assert ว่าไม่มี widget ที่ tap ได้ ไม่ใช่แค่ disabled) · ทั้งสองทิศของ CM3-03 (verdict ชนะ caps ในเครื่อง) · verdict absent → พฤติกรรม F-002 · **ไม่มี action ถอดสมาชิก / reset รหัสผ่าน / ยกเลิกคำเชิญ** ในแถวหรือ sheet (F-002b) · error `TARGET_NOT_BELOW_ACTOR`/`ROLE_EXCEEDS_ACTOR` → ข้อความเฉพาะของ code (CM3-06) · role บนแถวไม่เปลี่ยน · mutation ถูกเรียก 1 ครั้ง
- **CM3-07** tap target ≥ 44 (D-031) ของ checklist, ปุ่มบันทึกติดล่าง, dropdown item

**E2E web (Playwright)**
- **EW3-01** OWN: เข้าจอบทบาทจากเมนู → โคลน Staff (ชื่อ "สำเนาของ …") → ติ๊ก checklist (ไม่มี `full_access`/`access_accounting` · มีป้าย "เร็ว ๆ นี้") → dialog "มีผลกับสมาชิก N คน" ที่ N = ค่าจาก server → บันทึก → รายการแสดง "แก้ไขล่าสุดโดย คุณ" · role ที่ไม่เคยแก้แสดง "ค่าเริ่มต้นของระบบ"
- **EW3-02** OWN มอบ custom role ผ่านจอเปลี่ยน role สมาชิก และจอเชิญ (dropdown มี custom role)
- **EW3-03** ADM_A เปิด `R_BILL` → ไอคอนล็อก + เหตุผล · ปุ่มแก้/ลบ/โคลนเป็น disabled · dropdown มี `R_BILL` แบบ disabled + เหตุผล
- **EW3-04** ร้านที่มี Admin 2 คน: role `Admin` แก้/ลบไม่ได้ (เหตุผล "สิทธิ์เท่ากัน") แต่โคลนได้ · แถวสมาชิก ADM_B: เปลี่ยน role/ถอด/รีเซ็ต disabled + เหตุผล (AC-5.4b ฝั่ง client)
- **EW3-05** MR: role ที่มีผู้ถือ → disabled + เหตุผล "ต้องมีสิทธิ์จัดการสมาชิก" · โคลนได้ · ไม่มีเมนูสมาชิก
- **EW3-06** ADM_A (Admin คนเดียว) ถอด `manage_roles` จาก role ตัวเอง → คำเตือนบอกสิทธิ์ที่จะเสีย → ยืนยัน → จอบทบาทแสดงข้อความ forbidden
- **EW3-07** ลบ Staff ที่มีคนใช้ → จำนวนสมาชิก/คำเชิญ + ลิงก์ไปจอสมาชิกและคำเชิญที่กรองตาม role แล้ว
- **EW3-08** 2 context แก้ role เดียวกัน → context ที่สองเห็นข้อความขัดแย้ง + ค่าล่าสุด · network capture: PATCH ของ context ที่สองถูกส่ง 1 ครั้ง
- **EW3-09** flag ปิด: ปุ่มเขียนทั้งหมด disabled ด้วยเหตุผลเดียว (`writes_disabled`)
- **EW3-10** STF อยู่บนจอ แล้ว OWN ถอดสิทธิ์ → action ถัดไปได้ข้อความ forbidden เดิม + สิทธิ์ถูก refresh
- **EW3-11** ★ เข้าถึงได้จริง (บทเรียน "unreachable but tested"): เมนูนำไปจอบทบาทสำหรับผู้ถือ `manage_roles` · STF ไม่เห็นเมนู · STF เปิด URL ตรง → หน้า forbidden
- **EW3-12** accept หลังผู้เชิญถูกลดสิทธิ์ → ข้อความของ `INVITATION_CANCELLED`
- **EW3-13** เปลี่ยนชื่อ Staff เป็น "พนักงานแพ็คของ" → แสดงชื่อนี้ในรายการสมาชิก, dropdown, คำเชิญ, ตัวสลับร้าน

**E2E Flutter (`integration_test`)**
- **EM3-01** flow หลักบนมือถือ: เมนู → รายการ → โคลน → checklist แนวตั้งพับกลุ่มได้ → ปุ่มบันทึกติดล่าง → impact count → มอบ role
- **EM3-02** read-only 3 เหตุผล + dropdown disabled + เหตุผล
- **EM3-03** `writes_disabled`
- **EM3-04** คำเตือนเสียสิทธิ์ตัวเอง
- **EM3-05** `ROLE_IN_USE` + ทางไปจอสมาชิก/คำเชิญ
- **EM3-06** `ROLE_CHANGED` → re-fetch ไม่ส่งซ้ำ
- **EM3-07** ★ เข้าถึงจอบทบาทจาก navigation จริง (ไม่ใช่ push route ในเทสต์)
- **EM3-08** ★ sheet เปลี่ยนบทบาทสำเร็จ (AC-2.2): ADM_A เปิดรายการสมาชิกจาก navigation จริง → แถว STF → sheet → ตัวเลือกตรงกับจอเชิญ (มี custom role · `R_BILL` disabled + เหตุผล) → เลือก custom role ที่ ⊆ → ยืนยัน → แถวแสดงชื่อ role ใหม่ · ยืนยันฝั่ง server ด้วย `GET /members` (ไม่เชื่อแค่จอ)
- **EM3-09** ★ แถวที่ถูกบล็อก (AC-2.2 · AC-5.4b ฝั่งมือถือ): ร้านที่มี Admin 2 คน → แถว ADM_B และแถว OWN แสดงเหตุผล · **ไม่มีทางเปิด sheet** · แถว STF เปิดได้ (control)
- **EM3-10** ★ error `TARGET_NOT_BELOW_ACTOR`: ADM_A เปิด sheet ของ STF → (ระหว่างนั้น OWN ย้าย STF เป็น Admin ผ่าน API) → ยืนยัน → ข้อความของ code นี้ · role ของ STF ใน DB = Admin (ไม่ถูกเขียนทับ) · PATCH ถูกส่ง 1 ครั้ง
- **EM3-11** ★ error `ROLE_EXCEEDS_ACTOR`: ADM_A เปิด sheet ของ STF และเลือก role ที่ ⊆ ตอนเปิด → (OWN ถอด cap นั้นจาก role ของ ADM_A ผ่าน API) → ยืนยัน → ข้อความของ code นี้ · role ของ STF ไม่เปลี่ยน · PATCH ถูกส่ง 1 ครั้ง
- **out of scope (F-002b — ไม่มีเทสต์ใน F-003):** ถอดสมาชิกบนมือถือ · ยกเลิกคำเชิญบนมือถือ · ปุ่ม reset รหัสผ่านบนมือถือ · CM3-08 assert แค่ว่า action เหล่านี้ **ไม่ปรากฏ** (กันหลุดเข้ามาโดยไม่มีเทสต์)

- **CI:** web E2E ผ่าน `assert-playwright-ran.mjs` (floor ของไฟล์ใหม่) · Flutter integration test ต้องมีหลักฐานว่ารันจริง (จำนวนเคส > 0) — devops wire

---

## 12. Manual pass (QA stage — หลักฐานใน QA report · ไม่ใช่ CI)
- **MAN3-01** copy ไทยทุก reason/error บน web + mobile ตรงกับ ux (ร่วมกับ ux)
- **MAN3-02** มือถือจอเล็ก: checklist 11 key + พับกลุ่ม + คีย์บอร์ดไม่บังปุ่มบันทึก
- **MAN3-03** ลองยกสิทธิ์โดยแก้ request ตรง (devtools/proxy) ทุกเส้นทางเขียน 8 operation + accept + reset — ต้องปฏิเสธทั้งหมด
- **MAN3-04** timing ของ 404 reset: review ว่าไม่มี early-return ใหม่ (refusal อยู่หลัง argon2 จุดเดียวกับ `target_is_owner`) + วัด median สองกรณีแบบไม่เป็นทางการ
- **MAN3-05** rehearsal บน staging: flag ปิด → 503 · QA ตรวจว่ามีหลักฐานเงื่อนไข arch §12 ก่อนให้ verdict การเปิด flag (การเก็บหลักฐานเป็นของ devops)
- **MAN3-06** `backfill:f003` บนสำเนาข้อมูล staging หลัง migrate = 0 แถว
- **MAN3-07** screen reader อ่านเหตุผลของไอคอนล็อกและปุ่ม disabled ได้

## 13. Track 2 (agentic persona SME ไทย · scheduled · ไม่บล็อก)
- **T2-01** เจ้าของร้านสร้างบทบาท "พนักงานแพ็คของ" จากการโคลน โดยไม่มีคำแนะนำ
- **T2-02** Admin เจอบทบาทที่แก้ไม่ได้ — เข้าใจเหตุผลและรู้ว่าต้องให้ใครทำ (3 เหตุผล)
- **T2-03** เข้าใจ "มีผลกับสมาชิก N คน" และคำเตือนเสียสิทธิ์ตัวเองก่อนกดยืนยัน

## 14. Perf smoke (right-size · Track 1 full tier · pattern เดียวกับ `perf-smoke.int.test.ts`)
- **P3-01** `GET /role-details` บนร้านที่มี role live 30 + ที่ลบแล้ว 500 + สมาชิก 2,000 + คำเชิญ 300
- **P3-02** `GET /members?roleId=` บนสมาชิก 2,000
- **P3-03** `GET /orgs/{orgId}` (middleware resolve สิทธิ์ทุก request) — median ต่างจาก baseline ของ F-002 ไม่เกินเกณฑ์ (ยืนยันว่า `expandCapabilities` ไม่เพิ่มต้นทุน hot path)
- budget = สัญญาณ regression เทียบรอบก่อน ±50% · ไม่ retry · พิมพ์ค่าทุกครั้ง · load test เต็ม = launch-readiness ไม่ใช่งานนี้

## 15. Quality gate ของ F-003 (สิ่งที่ต้องเขียวก่อน verdict ผ่าน)
1. Track 1 ทั้งหมดเขียวใน CI · int lane รันจริง (floors ผ่าน) · ไม่มีเคส skip ใน smoke
2. §6 ครบ (AC-10.1 · ลำดับ merge) · G-15 ถูกแทนแล้ว · ทะเบียน regression pack อัปเดต
3. §9 red run ครบ 18 mutation และแนบหลักฐาน
4. ตาราง §1 ทุกแถวมีเทสต์ที่ผ่าน หรือมีหลักฐานทดแทนตามหมายเหตุ ①②
5. manual §12 ทำแล้ว (ข้อที่ข้ามต้องระบุว่าข้าม) · Track 2 ส่งรายงาน (ไม่บล็อก)
6. security-reviewer pass บนโค้ด (★ ทุกเส้นทางเขียน role/assign/invite/reissue/reset)

## 16. คำถามที่ปิดแล้ว (log)
- **ถึง backend-api — ปิด 2026-09-27:** (1) route อ่านที่คำนวณ `viewer.*` ยิง `escalation_denied` หรือไม่ → **ไม่ยิง** (arch §7 ปิดชุด 8 operation) ⇒ I3-57 · MUT-17 (2) PATCH role no-op + version เก่า = 200 หรือ 409 → **200 ไม่เทียบ version ไม่ emit** (api-spec §2 · arch §2 ขั้น 4b — user อนุมัติ) ⇒ I3-08 · MUT-18
- **ถึง user — ปิด 2026-09-27:** sheet เปลี่ยนบทบาทรายคนบนมือถืออยู่ใน F-003 ⇒ CM3-08 · EM3-08..11 · ถอด/ยกเลิกคำเชิญ/reset บนมือถือ = F-002b
