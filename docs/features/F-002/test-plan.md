---
doc: test-plan
owner: "@qa"
signoff: approved   # user 2026-07-28
---
# [F-002] Test plan  (เจ้าภาพ: qa — ร่างตอน Gate 2 จาก AC)

> วัดจาก **AC ฉบับแก้แล้ว** ของ [F-002-organization-license-membership.md](../F-002-organization-license-membership.md)
> (D-027/D-028/**D-029**) · อ้าง [architecture.md](architecture.md) · [data-model.md](data-model.md) · [api-spec.md](api-spec.md) ·
> [security-review.md](security-review.md) · เกณฑ์ปิดงาน = [WEB_TEAM.md §4 Gate E](../../../WEB_TEAM.md)
>
> **รอบแก้ 2026-07-28 (amend #3 — หลัง `api-spec.md` LOCKED):** ตัดสิน **ข้อแย้ง 6 ข้อของ @backend-api (api-spec §6.3 ข้อ 1–6)**
> → **§20 (ท้ายไฟล์ ต่อจาก "ตอบ consult questions")** · เพิ่ม coverage ของ 2 endpoint ใหม่
> (`…/tax-profile/reveal`, `DELETE …/membership`), กฎ lock ใหม่ §5.1, `Role.key`, `traceId` ทุก error ·
> **AC เพิ่ม 1 ข้อ (AC-5.7 ออกจากร้านเอง — D-029) ⇒ 35/35**
>
> **รอบแก้ 2026-07-28 (amend #4 — หลัง delta review §H + D-030):** ตัดสิน **7 ข้อที่ @backend-api ส่งต่อ**
> ([api-spec §6.3 ข้อ 7](api-spec.md) · [architecture §13 ข้อ 21](architecture.md)) → **§21 (ท้ายไฟล์)** — **รับ 7/7 แต่ 5 ข้อรับแบบขยาย**
> · ของที่ขยับ: **G-13 เทียบราย tier + ตรวจ method ของแต่ละ tier** · **I-02/I-03/U-API-05 ครอบ read** (NEW-3) ·
> **U-API-07 8 เคส + I-30 ชุดที่สอง** (NEW-1/D-030) · **I-15(f)/I-23(f) reissue ผ่าน `canAssignRole`** (NEW-2) ·
> **I-35(b) + U-DB-11 `USER_SELECT` frozen** (NEW-8) · **I-C-13 + U-API-21 + U-DB-08(ง) lock timeout → 409 `busy`** (NEW-4) ·
> **U-CFG-07 pin `ORG_TX_TIMEOUTS`** · **I-17(g) rotate ห้ามล้างธง forensic** (NEW-9) · **U-API-20 pin รูปแบบ UUID v4** (NEW-7) ·
> **G-15 tripwire ของ NEW-10** · **§9 ขยายเป็นทะเบียนเต็ม 41 finding (เดิม 29 + ใหม่ 12)** ·
> **§11.1 ขยาย 2 → 6 รายการ** ("สัญญาไม่เปลี่ยนแต่ความหมายเปลี่ยน" ตาม architecture §15) ·
> **NEW-12 (dangling ref) แก้แล้ว — §20 มีจริงตั้งแต่ amend #3 และ §21 ถูกสร้างในรอบนี้** ·
> **AC ยังเป็น 35/35 (เต็ม 32 · partial 3) — ไม่มี AC ใหม่ใน amend #4**

## Contract summary (≤20 บรรทัด — ทีม consumer อ่านแค่ส่วนนี้)

1. **AC ทั้งหมด 35 ข้อ** (US-1..US-7 · +AC-5.7 จาก D-029) → มี test case ครบ **35/35** · **เต็ม 32 · partial 3** (AC-1.2 / AC-5.4 / AC-7.3 — ส่วนที่ขาดอยู่นอก scope F-002 โดยการออกแบบ, @product รับทราบแล้วผ่าน D-029(4) · §19) · ⚠️ D-029(4) เขียนตัวเลข **34/34** เพราะนับก่อน AC ใหม่ที่ D-029(2) เพิ่มเอง — **จำนวนที่ถูกคือ 35/35** (partial ยังเป็น 3 ตัวเดิม ไม่มีข้อใหม่ที่ทดสอบไม่ได้) ⇒ เป็นการ**นับใหม่ ไม่ใช่การเปลี่ยนเกณฑ์**
2. **money-stock skill = ไม่ applicable** — F-002 ไม่แตะ `StockMovement`/เงิน/สต๊อกแม้แต่คอลัมน์เดียว (data-model §1/§4.4 + security-review §E ข้อ 11) ⇒ ข้อความ template "state ผ่าน StockMovement" **ไม่ใช้กับ feature นี้** · แทนด้วย **G-08** (grep พิสูจน์ว่า diff ไม่แตะ ledger)
3. **★ จุดที่บังคับ test matrix เต็ม:** ★1 tenant isolation · ★2 privilege ภายใน org (Owner-only) · ★3 invitation token/hash-at-rest · ★4 concurrency + Owner ≥ 1 · ★5 PDPA field-level (**+ TIN reveal**) · ★6 regression ของ endpoint ที่ ship แล้ว (`adminResetPassword` + **`traceId`**) · **★7 self-service leave: ต้องแตะได้แค่ตัวเอง (D-029)**
4. **Track 1 (hard gate ก่อน merge):** unit 4 workspace (~150 เคส) + **int 45 เคสหลัก + concurrency 13 เคส** + contract lane + E2E web 13 + Flutter 1 + static gate **15 ตัว** (G-01..G-15)
5. **Track 2 (scheduled, ไม่บล็อก):** agentic persona SME ไทย 7 flow (§15)
6. **หัวใจของ hard gate = int lane** — cross-org leak **ทุก endpoint × 5 persona** (เพิ่ม Staff จาก 4 ของ M-8), route-registry capability test, PII/header/traceId/schema assertion กลาง 4 ตัว
7. **hash-at-rest พิสูจน์ด้วยของจริง** (I-14): อ่านแถวจาก DB แล้วค่า `tokenHash` ต้อง ≠ token ที่ API คืน · ห้ามเทียบด้วย hash ที่เทสต์คำนวณเอง — ต้องเรียก production fn (D-018)
8. **AC-5.1 "0 request"** (D-027) วัดเป็นจำนวน request ไม่ใช่เวลา: revoke commit → request ถัดไป **403 `ORG_ACCESS_DENIED`** ทันที (I-19)
9. **regression pack ถาวร = ทะเบียนเต็มของ finding ทั้ง 41 ข้อ** (เดิม 29 + delta review 12 ข้อ) — **ทุกข้อมีเทสต์ที่ pin ไว้ หรือมีเหตุผลเป็นลายลักษณ์ว่าทำไมไม่มี** (§9) · ข้อที่ **ไม่มีเทสต์โดยเจตนา** มี 4 ข้อและถูกแปลงเป็น *tripwire/forward-commitment* แทน: I-7 · NEW-5(ข) · NEW-10 (→ **G-15**) · NEW-12
10. **แย้ง/เพิ่มจาก architecture §12: 12 ข้อ** (§18) — ที่หนักที่สุด: ไม่มี E2E lane เลย · ไม่มี test ของ security event ทั้งที่ AC-3.4/AC-4.5 บังคับ "ต้องบันทึกเหตุการณ์" · ไม่มี test ว่า gate/kit **ยิงจริง** (gate ที่ไม่เคยแดง = ไม่มีค่า)
11. **silent-skip เป็นความเสี่ยงอันดับ 1 ของ verdict** — `*.int.test.ts` วันนี้ `describe.skip` เมื่อไม่มี `TEST_DATABASE_URL` ⇒ บังคับ **I-37** (บน CI ต้อง assert ว่า lane เปิดจริง) มิฉะนั้น "เขียว" ไม่มีความหมาย (บทเรียน F-001)
12. **ของที่ต้องมีก่อนเทสต์เดินได้** (ขอจาก @backend-api/@devops): seed kit + CLI · security-event test sink · export route/capability registry + `org-models` + rate-limit defaults · env ใหม่ 4 ตัว + `prisma db seed` ใน CI job `integration-api` (§19)
13. D-XXX ที่อ้าง: **D-012** (copy link) · **D-014** (unit ประกบทุก task, ห้าม `echo ok`) · **D-018** (hash-at-rest) · **D-025** (ApiFailure taxonomy/cursor/`X-Organization-Id`) · **D-027** (rotate + revoke semantics) · **D-028** (Owner-only/invite hardening/PDPA) · **D-029** (คำว่า "ร้าน" · leave · cap 50 · AC coverage)
14. **ข้อแย้ง 6 ข้อของ @backend-api (api-spec §6.3) — รับ 6/6 แต่ 3 ข้อรับ *แบบมีเงื่อนไข* ไม่ใช่รับตามตัวอักษร** (§20): I-08 เทียบหลังตัด `traceId` ได้ **แต่ต้องเทียบด้วย normalizer ที่มี allowlist ปิด + ยังบังคับว่าทั้งสองฝั่งต้องมี `traceId` และค่าต้องต่างกัน** · U-API-12/I-22(d) ย้ายไป §3.16 ได้ **แต่เคสเดิมไม่ถูกลบ — กลับด้านเป็น negative assertion ว่า `GET /orgs/{id}` ต้องไม่คืน `taxId` ให้ *ใครเลย* แม้ผู้มีสิทธิ์** · I-04 รับเต็ม + บังคับให้ allowlist มาจากโค้ด production และมีสมาชิก **1 เส้นเท่านั้น**
15. **ของใหม่ในรอบนี้ที่ถือเป็นส่วนหนึ่งของ verdict:** `…/tax-profile/reveal` (I-38/I-39/U-API-17) · `DELETE …/membership` (I-40..I-43 · **I-43 = พิสูจน์ว่าชี้ไปคนอื่นไม่ได้**) · lock/re-validate ครบ 7 operation (U-API-09 ขยาย) · I-C-11/I-C-12 · **`Role.key` พิสูจน์เชิงพฤติกรรม ไม่ใช่แค่ grep** (I-45: สลับ `key` ของ Staff เป็น `"owner"` ใน DB แล้วสิทธิ์ต้องไม่ขยับ) · **R-01: เทสต์เดิม 3 เคสใน `apps/api/src/common/domain-exception.filter.test.ts` ต้องกลับด้าน** (นับเป็น *regression ที่ต้องแก้* ไม่ใช่เทสต์ใหม่)
16. **6 อย่างที่ `oasdiff` เงียบแต่พฤติกรรมเปลี่ยน** มีเจ้าของเทสต์ชัดเจน ห้ามกำพร้า (§11.1 — ขยายจาก 2 ในรอบ amend #4 ตาม architecture §15): `reset-password` 200→404 เคส multi-org = **I-30(1)** · `traceId` ทุก error = **I-06 + R-01** · `reset-password` 200→404 **เคส Admin→Owner** = **I-30(2)** · `reissue` 200→403 เมื่อคำเชิญเป็น role Owner = **I-15(f)** · นิยามใหม่ของ `acceptedUserCreatedAfterInvite` = **I-17(g)** · `409 CONFLICT` + `details.reason="busy"` แทน 500 ตอนแย่ง lock = **I-C-13 + U-API-21**
17. verdict ของ F-002 ออกตามเกณฑ์ §17 — ข้อไหนไม่ครบ = แดง ไม่มี "เขียวแบบมีเงื่อนไข"
18. **(amend #4)** สิ่งที่เพิ่มเป็นส่วนหนึ่งของ verdict: **NEW-1 (Critical) ต้องมี red→green ทั้ง unit และ int และอยู่ smoke tier ถาวร** · **fail-closed ของ capability ต้องพิสูจน์บน `GET` ไม่ใช่แค่ mutating** · **ไม่มี `500`/SQLSTATE ดิบหลุดออก wire ตอนแย่ง lock** · **`USER_SELECT` ถูกบังคับเชิงโครงสร้าง ไม่ใช่แค่ grep**

---

## §0 ขอบเขตของแผนนี้ + สิ่งที่ประกาศว่า "ไม่ applicable"

| หัวข้อ | สถานะใน F-002 | เหตุผล |
|---|---|---|
| `money-stock` test matrix (append-only, atomicity ของ ledger, precision) | **ไม่ applicable** | F-002 ไม่แตะ `StockMovement`/`InventoryItem`/คอลัมน์เงินเลย · ยืนยันจาก data-model §1 + §4.4 checklist + security-review §E ข้อ 11 |
| "state ผ่าน append `StockMovement` ไม่ insert balance ตรง" (WEB_TEAM §3.7) | **ไม่ applicable** | ไม่มี state ของสต๊อกใน feature นี้ · **แต่ยังบังคับ G-08**: diff ของ F-002 ต้องไม่แตะไฟล์ ledger/StockMovement (กันการลอก pattern ผิดที่) |
| transaction discipline | **applicable แต่คนละเหตุผล** | ไม่ใช่เพราะเงิน/สต๊อก แต่เพราะ **invariant ข้ามแถว** (Owner ≥ 1, สร้าง org 5 แถว, revoke + cancel invite) — ทดสอบด้วย ★4 |
| tier gating (`entitled('accounting')`) | **ไม่ applicable (F-007)** | api-spec §3.5 ประกาศชัดว่า F-002 เก็บข้อมูล + เปิด flag เท่านั้น → กระทบ AC-7.3 (§19) |

**สิ่งที่แผนนี้ *ไม่* รับประกัน:** ความถูกต้องของหน้าจอในระดับ pixel/copy สุดท้าย — `ux-wireframe.md` และ `ui.md` ยังเป็นโครงว่าง
⇒ E2E ใน §12 เขียนจาก **AC + api-spec** (สิ่งที่ระบบต้องทำได้) ไม่ใช่จาก layout · เมื่อ ux ลงจอจริงแล้ว **E2E selector/copy assertion ต้องถูกเติมก่อนเริ่ม build ฝั่ง frontend** (บันทึกเป็นเงื่อนไขของ Gate D ไม่ใช่ Gate B)

---

## §1 เลน, เครื่องมือ และนิยาม "เขียว"

| lane | คำสั่ง | เครื่องมือ | Track | บล็อก merge |
|---|---|---|---|---|
| unit — core-domain | `pnpm --filter @omnistock/core-domain test` | vitest (in-memory ล้วน) | 1 | ✅ |
| unit — packages/db | `pnpm --filter @omnistock/db test` | vitest + Prisma extension probe (ไม่ต้องมี DB) | 1 | ✅ |
| unit — packages/config | `pnpm --filter @omnistock/config test` | vitest | 1 | ✅ |
| unit — apps/api | `pnpm --filter api test` | vitest + `@nestjs/testing` (mock ชั้นล่างผ่าน DI) | 1 | ✅ |
| int — DB/Redis จริง | `pnpm --filter api test:integration` | vitest + supertest + Postgres/Redis จริง (CI job `integration-api`) | 1 | ✅ |
| contract | `pnpm gen:contracts` + `contracts-drift` + `oasdiff` | CI ที่มีอยู่แล้ว | 1 | ✅ |
| static gate | `pnpm depcruise` + grep gates + purity gate | CI | 1 | ✅ |
| E2E web | Playwright | Playwright | 1 | ✅ |
| E2E mobile | `flutter test integration_test/` | Flutter | 1 | ✅ |
| perf smoke | script ใน int lane (แยก tag) | vitest + seed ใหญ่ | 1 | ✅ (budget §14) |
| manual | checklist §12.2 | คน | 1 | ✅ (ก่อนออก verdict) |
| agentic | skill `qa` + Browser Use | scheduled | 2 | ❌ (report + loopback) |

**นิยาม "เขียว" ที่ผมจะใช้ตอนออก verdict:**
1. ทุก lane Track 1 **all-pass บน CI จริง** — ไม่รับผลจากเครื่อง dev (บทเรียน F-001: green locally ≠ tested)
2. **จำนวนเทสต์ที่รันจริง > 0 ต่อ lane** และ int lane ต้อง assert ว่าตัวเองเปิดอยู่ (**I-37**) — `vitest run int.test` ที่ไม่ match ไฟล์ หรือ `describe.skip` ทั้งไฟล์ = **แดง ไม่ใช่เขียว**
3. ไม่มี test ถูก skip/ลบ/ลดความเข้ม โดยไม่มีเหตุผลเป็นลายลักษณ์ + reviewer เห็นชอบ (Gate E)
4. task ★ ทุกตัวมีหลักฐาน **red → green** (รัน test กับโค้ดก่อนแก้แล้วแดงจริง)

---

## §2 AC → test case mapping (Gate B: ทุก AC ต้องมีเทสต์)

> ✅ = ครอบเต็ม · 🟡 = ครอบเท่าที่ F-002 มีพื้นผิว (ส่วนที่เหลืออยู่นอก scope — ดู §19)

| AC | ใจความ | test case | สถานะ |
|---|---|---|---|
| **AC-1.1** | สร้าง org → ผู้สร้างเป็น Owner + ผูก `OrgEntitlement` เสมอ | U-API-08 · I-10 · I-32(`org.created`) | ✅ |
| **AC-1.2** | plan มาจาก server (comp/dogfood ผ่าน seed) — ไม่แจก free อัตโนมัติ | U-API-08 (DTO ไม่มี field plan) · U-CFG-03 (`DEFAULT_ORG_PLAN_KEY` required) · I-10b (plan หาย → 503, ไม่มี org เกิด) | 🟡 สาขา "ลูกค้า → plan จาก license" = F-080/F-082 |
| **AC-1.3** | tier ตาม plan + default warehouse 1 ตัว | I-10 · I-12 (partial unique) | ✅ |
| **AC-1.4** | ข้อมูลหลังจากนี้ผูก `organizationId` | U-DB-01/04/05 · **U-DB-11 (`USER_SELECT` frozen)** · I-01 · I-35 (C-3 **+ (b) nested read "ลงกลับ"** — NEW-8) · G-02 | ✅ |
| **AC-2.1** | เห็นรายการ org ที่ตนเป็นสมาชิก + เลือก active (web+mobile) | I-34 · E-02 · E-10 | ✅ |
| **AC-2.2** | เห็น/แก้เฉพาะ active org — ไม่ปนข้าม org | I-01 · I-25 · I-26 · U-DB-01 · **I-35(b)** | ✅ |
| **AC-2.3** | เรียก org ที่ไม่ได้เป็นสมาชิก → 403 | I-01 · I-08 · U-API-04 | ✅ |
| **AC-3.1** | เชิญด้วย email + **บังคับ role** → pending + วันหมดอายุ | U-CD-03 · I-14 · U-API-15 (`ROLE_INVALID`) · E-03 | ✅ |
| **AC-3.2** | (D-012) ได้ invite link ไป copy เอง — ไม่มี email อัตโนมัติ | I-14 (`token`+`inviteUrl` ใน 201) · G-09 (ไม่มี mailer/SMTP dependency) · E-03 | ✅ |
| **AC-3.3** | (D-027) แสดงลิงก์ครั้งเดียวตอนสร้าง · token เก็บเป็น hash | I-14 · I-04 · U-DB-09 · I-10c (`GET /invitations` ไม่มี token) | ✅ |
| **AC-3.4** | (D-027) "ออกลิงก์ใหม่" → ลิงก์เดิมตายทันที · email/role คงเดิม · **อายุนับใหม่** · บันทึกเหตุการณ์ · UI เตือน + ห้ามคำว่า "คัดลอกลิงก์เดิม" | I-15 (**+ (f) reissue ของคำเชิญ role Owner ต้องผ่าน `canAssignRole`** — NEW-2) · I-C-05 · I-32(`link_reissued`) · E-03 · **E-11 (copy lint)** | ✅ |
| **AC-3.5** | ยกเลิกคำเชิญค้าง → ลิงก์ทุกใบใช้ไม่ได้ | I-16 · I-C-06 | ✅ |
| **AC-3.6** | เชิญคนที่เป็นสมาชิก → ปฏิเสธ · มี pending → แจ้ง + เสนอ "ออกลิงก์ใหม่/ยกเลิก" | I-13 · I-C-03 · U-API-15 (`INVITATION_PENDING` + `details.invitationId`) · E-03 | ✅ |
| **AC-3.7** | normalize email · token สุ่มพอ/hash/หมดอายุ/ผูก email | U-CD-10 · U-DB-09 · U-CD-05 · I-17d | ✅ |
| **AC-3.8** | (D-028) Owner-only เชิญ role Owner · role สูง TTL 24 ชม. | U-CD-02 · U-CD-03 · I-23c · I-15b (TTL ตอน reissue) · **I-23f + I-15f (Owner-only ครอบ reissue ด้วย — call site ที่ 4 ของ `canAssignRole`)** | ✅ |
| **AC-3.9** | (D-028) ชดเชยเรื่อง verify email ไม่ได้: เห็นใครรับเมื่อไหร่ + บัญชีสร้างก่อน/หลัง | I-17e (`acceptedAt`/`acceptedByUserId`/`acceptedUserCreatedAfterInvite`) · **I-17g (rotate ลิงก์แล้วธงต้องไม่ถูกล้าง — NEW-9)** · I-32 · M-04 | ✅ |
| **AC-4.1** | มีบัญชีแล้ว → กดรับ → ได้ membership ทันที | I-17a · E-04 | ✅ |
| **AC-4.2** | ยังไม่มีบัญชี → สมัคร email เดียวกัน → ผูกอัตโนมัติ | I-17b · E-05 · G-10 (`/auth/signup` contract ไม่เปลี่ยน) | ✅ |
| **AC-4.3** | หมดอายุ/ยกเลิก → แจ้ง expired/invalid | U-CD-04 · U-CD-05 · I-16 · I-17c | ✅ |
| **AC-4.4** | (D-027) email คนละตัว → แจ้ง `u***@…` ไม่เผย email เต็ม | U-CD-08 · I-17d (assert response ไม่มี email เต็ม) · E-06 | ✅ |
| **AC-4.5** | (D-028) คำเชิญที่ออกก่อนถูกถอด → ปฏิเสธ · กลับเข้ามา = เหตุการณ์แยก | U-CD-04 · I-18 · I-C-04 · I-32(`org.member.reactivated`) | ✅ |
| **AC-5.1** | (D-027) ถอด = `revoked` → request ถัดไป **403 ทันที** · session ไม่ถูกทำลาย | I-19a · I-20 · U-API-04 · E-07 | ✅ |
| **AC-5.2** | (D-027) org หายจาก switcher ทันที + พากลับหน้าเลือก org | I-19b · I-34 · E-07 | ✅ |
| **AC-5.3** | (D-028) ถอด → ยกเลิกคำเชิญค้างของ email นั้นในรายการเดียวกัน | I-19c (อ่านจาก DB) · U-API-11 (tx เดียว) · I-C-04 | ✅ |
| **AC-5.4** | ชื่อสมาชิกที่ถูกถอดยังโผล่ในประวัติเก่า (ledger/audit ไม่พัง) | I-19d (แถวไม่ถูกลบ + โผล่ใน `?status=revoked` + `revokedAt/By` ครบ) | 🟡 Phase 0 ยังไม่มีพื้นผิว ledger/audit ให้ยิง (F-005/F-011) |
| **AC-5.5** | ดูรายชื่อ + สถานะ + role — ต้องมี `manage_members` | I-21 · I-04 · I-05 | ✅ |
| **AC-5.6** | ถูกถอดแล้วยังล็อกอินได้ + เห็น org อื่น | I-20 · I-19e | ✅ |
| **AC-5.7** ใหม่ | (**D-029**) สมาชิก**ทุก role ออกจากร้านเองได้** (ไม่ต้องมี `manage_members`) · ยังติดกฎ Owner คนสุดท้ายออกไม่ได้ | I-40 (ทุก role รวม Staff → 200) · I-41 (`409 LAST_OWNER`) · I-42 (ผลข้างเคียงครบ: 403 ทันที · หายจาก switcher · คำเชิญตัวเองถูก cancel · `org.member.left` · คืนโควตา cap) · **I-43 ★7 (ชี้ไปคนอื่นไม่ได้)** · I-C-11 · I-C-12 · U-API-18 · U-CD-01⑨ · E-13 | ✅ |
| **AC-6.1** | Owner ≥ 1 — ถอด/ลด Owner คนสุดท้ายไม่ได้ | U-CD-01 · I-24 · **I-C-01** | ✅ |
| **AC-6.2** | Owner ยกคนอื่นเป็น Owner ได้ (หลาย Owner) | U-CD-02⑥ · I-23a · I-C-08 | ✅ |
| **AC-6.3** | (D-028) Owner-only: มอบ/เชิญ Owner + แก้/ถอด membership ที่เป็น Owner **+ (D-030) ออกลิงก์ใหม่ของคำเชิญ Owner + รีเซ็ตรหัสของ Owner** | U-CD-02 (10 เคส) · I-23 (**+ (f) reissue**) · U-API-09 · **U-API-07(ฉ/ช) + I-30(2)** — ครบ **5 call site** ของ `canAssignRole` | ✅ |
| **AC-7.1** | เปิด accounting → บังคับ tax profile ครบชุด (13 หลัก + checksum) | U-CD-06/07 · I-22a · E-09 | ✅ |
| **AC-7.2** | 1 org = 1 tax profile | I-22b (`PUT` ทั้งชุด, เขียนทับได้, ไม่มีชุดที่สอง) | ✅ |
| **AC-7.3** | ยังไม่ประกาศ TIN → ใช้ได้เฉพาะ Sync tier (ออกเอกสารภาษีไม่ได้) | I-22c (`taxProfileComplete` ถูกต้องทุกเคส) | 🟡 **การ gate จริงเป็นของ F-007** — Phase 0 ไม่มี endpoint ออกเอกสารให้ทดสอบ (§19) |
| **AC-7.4** | (D-028 PDPA · **ux Q13 เข้มกว่า**) TIN เต็มเฉพาะ `manage_org_settings` — **ออกทาง `POST …/tax-profile/reveal` เส้นเดียว** · สมาชิกอื่นไม่เห็นตัวเลขใด ๆ แม้แต่ 4 ตัวท้าย | U-CD-09 · **U-API-12 (กลับด้าน: `GET /orgs/{id}` ไม่คืน `taxId` ให้ใครเลย)** · **I-22d (3 ระดับสิทธิ์)** · **I-38/I-39 (reveal: authz/404/event/header/rate limit)** · I-04 (มิติ `taxId`) · I-05 · U-API-17 · E-14 | ✅ |

**สรุป: 35/35 มีเทสต์ · เต็ม 32 · partial 3** (AC-1.2 / AC-5.4 / AC-7.3 — ทั้งสามคือ "พื้นผิวยังไม่เกิดใน Phase 0" ไม่ใช่ "ไม่มีคนเขียนเทสต์")

> **หมายเหตุการนับ (ให้ @product/PM เห็นตรงกัน):** D-029(4) รับ AC coverage ไว้ที่ **34/34** — ตัวเลขนั้นนับ *ก่อน* AC ใหม่
> ที่ D-029(2) เพิ่มเข้ามาเอง (AC-5.7) ⇒ ตัวเลขที่ถูกหลัง amend #3 คือ **35/35 (เต็ม 32 · partial 3)** ·
> **รายการ partial ไม่เปลี่ยน** และ AC-5.7 อยู่ในชั้น "เต็ม" ⇒ ไม่กระทบเงื่อนไข sign-off ที่ user เคาะไปแล้ว
>
> **AC-7.4 กับสิ่งที่ contract ทำจริง — ตรวจแล้วว่าไม่ขัดกัน:** AC เขียนว่าสมาชิกอื่น "เห็นแบบ mask (4 ตัวท้าย)
> **หรือ** เห็นแค่สถานะว่าประกาศแล้ว/ยัง" — ux Q13 เลือกทางหลัง (เข้มกว่า) และ backend รับเข้ามา ⇒ **ยังอยู่ในกรอบ AC**
> ⇒ ผมทดสอบตามทางที่เข้มกว่า และเพิ่มเทสต์ **ห้ามถอยกลับไปส่ง `taxIdMasked` ให้ Staff** (I-22d) เป็น regression ถาวร ·
> **ไม่ต้อง escalate @product**



---

## §3 Unit — `packages/core-domain` (pure fn, รับ `now: Date` เสมอ)

| id | ไฟล์ / fn | เคสขั้นต่ำ |
|---|---|---|
| **U-CD-01** ★4 | `orgs/owner-invariant.ts` `assertOwnerRemains` | owner 1 คนลดตัวเอง → block · owner 1 คนถอดตัวเอง → block · owner 2 คนลด 1 → ผ่าน · owner ที่ `revoked` ไม่ถูกนับ · `invited` ไม่ถูกนับ · non-owner → owner (เพิ่ม) ผ่าน · เปลี่ยน role ของ non-owner ผ่าน · **owner 2 คนแต่อีกคน `revoked` = เหลือ 1 → block** · **⑨ leave (D-029): Owner คนสุดท้ายออกเอง → block · Owner 1 ใน 2 คนออกเอง → ผ่าน · Staff/Admin ออกเอง → ผ่านเสมอ — ต้องเป็น `assertOwnerRemains` ตัวเดียวกัน ไม่มี fn ที่สองสำหรับ leave** (architecture §5 ระบุไว้ ⇒ ถ้าโค้ดเพิ่ม fn ที่สอง = ผิดแม้เทสต์เขียว ⇒ ผูกด้วย U-API-18) |
| **U-CD-02** ★2 | `orgs/member-authz.ts` `canAssignRole` | **8 เคสบังคับตาม data-model §6** (①–⑧) + 2 เคสเพิ่มของผม: ⑨ actor มี `full_access` + `manage_members` พร้อมกัน → true ทุกกรณี ⑩ `targetIsOwner=true` และ `newRoleIsOwner=true` (Owner → Owner ใบใหม่) actor=Admin → **false** |
| **U-CD-03** ★3 | `orgs/invitation-policy.ts` `invitationTtlHours` | `["full_access"]`→24 · `["manage_members",…]`→24 · `["manage_products"]`→168 · `[]`→168 · **capability ที่ไม่รู้จัก → 168 (ไม่ throw)** |
| **U-CD-04** ★3 | `orgs/invitation-policy.ts` `canAcceptInvitation` | ผลลัพธ์ครบ 7 ค่า + **ลำดับความสำคัญถูก pin**: expired มาก่อนทุกอย่าง → cancelled/accepted → email mismatch → role_unavailable → already_member → superseded · `revokedAt == tokenIssuedAt` พอดี → `superseded` (เลือกฝั่งปลอดภัย) · membership `invited` → `superseded` · **เคสผสม 3 ชั้น** (หมดอายุ + เป็นสมาชิกอยู่แล้ว + role ถูกลบ → `expired`) |
| **U-CD-05** | `orgs/invitation-status.ts` `resolveInvitationStatus` | `now` ก่อน/หลัง/**เท่ากับ** `expiresAt` พอดี (`<=` → expired) · `accepted`/`cancelled` ไม่ถูก override ด้วยเวลา |
| **U-CD-06** | `orgs/thai-tax-id.ts` `isValidThaiTaxId` | เลขบุคคลถูก · เลขนิติบุคคลถูก · check digit ผิด (ทุกตำแหน่ง ±1) · ไม่ครบ 13 · 14 หลัก · มีขีด/ช่องว่าง (normalize ก่อน) · มีตัวอักษร · `"0000000000000"` · `null`/`undefined`/`""` |
| **U-CD-07** | `isValidBranchCode` | `"00000"` ผ่าน · 5 หลักอื่นผ่าน · 4/6 หลักไม่ผ่าน · ไม่ใช่ตัวเลข · `undefined` ผ่าน (optional) |
| **U-CD-08** ★5 | `orgs/invitation-email.ts` `maskEmail` | ชื่อ 1 ตัวอักษร · ชื่อยาว · ชื่อ 2 ตัว · ไม่มี `@` → throw · **assert ว่าผลลัพธ์ไม่มี substring ของชื่อเต็มเกิน 1 ตัว** (กัน mask ที่ mask ไม่จริง) |
| **U-CD-09** ★5 | `orgs/tax-id-mask.ts` `maskTaxId` | 13 หลัก → เห็น 4 ตัวท้าย · `null` → `null` · ค่าสั้นกว่า 4 หลัก → mask ทั้งหมด ไม่ throw · **property test: ผลลัพธ์ต้องไม่มี 9 หลักแรกของ input เลย** |
| **U-CD-10** | `auth/email.ts` `normalizeEmail` (ของเดิม F-001) | regression: F-002 **ใช้ตัวเดียวกัน ไม่ fork** — เทียบ `"New@Example.com "` → `"new@example.com"` · G-11 grep ว่าไม่มี `toLowerCase()` บน email ในโค้ด F-002 |
| **U-CD-11** ★2 | `auth/capabilities.ts` `hasCapability` (ของเดิม) | regression pin: `full_access` = wildcard ครอบทุก capability · capability ที่ไม่มี → false · array ว่าง → false (กฎ Owner-only ทั้งชุดยืนอยู่บนพฤติกรรมนี้) |
| **U-CD-12** | purity | ไฟล์ใหม่ทุกตัวผ่าน `omnistock-purity-gate` · **ไม่มี `new Date()`/`Date.now()` ในโค้ด** (รับ `now` เป็น argument) — fixture ใน `__purity_fixtures__` |

---

## §4 Unit — `packages/db` (★1 — ชั้นที่ทั้งระบบพึ่ง)

| id | เคส |
|---|---|
| **U-DB-01** | `withOrgScope` ครบ **ทุกแถวของ architecture §2.2**: `findMany`/`findFirst`/`count`/`aggregate`/`groupBy` → AND `organizationId` · `create` inject · `createMany` inject ทุกแถว · `updateMany`/`deleteMany` → AND |
| **U-DB-02** ★ | **M-9 — พิสูจน์แถวต่อแถว:** `findUnique`/`update`/`delete` × แถวของ org อื่น → ต้องไม่คืน/ไม่แก้ (extendedWhereUnique) · **`upsert` แยกเป็นเคสของตัวเอง ทั้ง `where` และ `create`** — ถ้าไม่ผ่าน = **แก้ architecture §2.2 ก่อน merge** แล้วสลับไป fallback `findFirst`+`create/update` (ห้ามปล่อยเอกสารที่อ้างสิ่งที่ไม่จริง) |
| **U-DB-03** | caller ส่ง `organizationId` ที่ไม่ตรง ctx → **throw `OrgScopeViolationError`** (ไม่ silent override) · ส่งค่าที่ตรง → ผ่าน |
| **U-DB-04** | ไม่มี ctx (นอก `OrgContextStore`) → **throw `MissingOrgContextError`** ทุก operation (ไม่ใช่ query ที่ไม่มี filter) |
| **U-DB-05** | model org-agnostic (`User`/`RefreshToken`/`Channel`/`PlanDefinition`) → **ไม่ inject อะไรเลย** (พฤติกรรมที่ตั้งใจ) และ **ต้องมี comment/test ที่ผูกกับกติกา C-3** |
| **U-DB-06** | `org-models.ts` ↔ schema จริง **drift ทั้งสองทาง**: (ก) ทุก model ที่มีคอลัมน์ `organizationId` ต้องอยู่ในลิสต์ (ข) ทุกชื่อในลิสต์ต้องมีอยู่จริงใน schema → model ใหม่ในอนาคตที่ลืมประกาศ = **แดง** |
| **U-DB-07** | **operation-coverage completeness (เพิ่มจาก §12):** enumerate ชื่อ operation ทั้งหมดที่ Prisma client รองรับ แล้ว assert ว่าทุกตัวมีพฤติกรรมที่ประกาศไว้ใน §2.2 — **operation ที่ไม่รู้จัก (เช่น `findUniqueOrThrow`/`findFirstOrThrow`/`updateManyAndReturn`) = แดง** ⇒ Prisma อัปเกรดแล้วเพิ่ม operation = CI จับได้ทันที (ดูคำขอ §19 ข้อ 1) |
| **U-DB-08** ★4 | `lockCurrentOrganization`: (ก) รูป SQL = `SELECT id … FOR UPDATE` (ข) **อ่าน org จาก ctx ไม่ใช่ argument** (N-2) — ส่ง ctx คนละ org แล้วต้องล็อกตาม ctx (ค) เรียกนอก interactive tx → throw · **(ง) *ใหม่ amend #4 (NEW-4 · architecture §5.2):* คำสั่งแรกที่ helper ยิงคือ `SET LOCAL lock_timeout` แล้วค่อย `FOR UPDATE` (assert ทั้ง *ลำดับ* และ *ค่า*) และค่า **อ่านจาก `ORG_TX_TIMEOUTS.lockTimeoutMs` ไม่ใช่ตัวเลขฝังในโค้ด** — เปลี่ยน config แล้ว SQL ต้องเปลี่ยนตาม · ยิงนอก tx ที่ไม่ได้ตั้ง `SET LOCAL` = แดง** |
| **U-DB-09** ★3 | `hashInvitationToken`: deterministic · เปลี่ยน secret → hash เปลี่ยน · **ผลลัพธ์ไม่มี substring ของ token ดิบ** · ใช้ secret คนละตัวกับ JWT (ยิงด้วย secret ของ JWT แล้วต้องได้คนละค่า) · ความยาว token ที่ generate = 256-bit base64url · **สุ่มไม่ซ้ำใน 10k ครั้ง** |
| **U-DB-10** | `$transaction` (ทั้งรูป callback และรูป array) — client ที่ได้ยัง **สืบทอด extension** (unit ระดับ probe; ของจริงยืนยันซ้ำที่ I-25) |
| **U-DB-11** ★1 **ใหม่ (NEW-8 · architecture §2.2 กติกาข้อ 4)** | **`USER_SELECT` ต้องบังคับเชิงโครงสร้าง ไม่ใช่ความตั้งใจดี:** (ก) เป็น object ที่ `Object.isFrozen()` = true **และ nested ทุกชั้นก็ frozen** (ทดสอบด้วยการพยายาม mutate → throw ใน strict mode) (ข) **ไม่มี key ที่เป็น relation ของ `User`** — assert โดย **enumerate relation field ของ model `User` จาก DMMF จริง** แล้วยืนยันว่า intersection กับ key ของ `USER_SELECT` = ว่าง (เพิ่ม relation ใหม่ใน schema แล้วมีคนใส่ลง `USER_SELECT` = แดงทันที) (ค) ค่า = `{ id, email, createdAt }` เป๊ะ — **เพิ่ม/ลด field = แดง** (การเพิ่ม field ของ `User` ลง wire ต้องมีคนอธิบายใน PR) (ง) **`passwordHash` ไม่อยู่ใน `USER_SELECT` ไม่ว่ากรณีใด** (คู่กับ C-4) · **เหตุผลที่แยกจาก G-02:** grep เป็น textual — `const S = USER_SELECT; select: { user: { ...S, memberships: true } }` หลบ grep ได้ แต่หลบ (ก)+(ข) ไม่ได้ |

---

## §5 Unit — `packages/config`

| id | เคส |
|---|---|
| **U-CFG-01** | `INVITATION_TOKEN_SECRET`: ขาด → boot ล้ม · < 32 ตัว → ล้ม · **เท่ากับ `JWT_ACCESS_SECRET` หรือ `JWT_REFRESH_SECRET` → ล้ม** (key separation) |
| **U-CFG-02** | `WEB_APP_BASE_URL`: ไม่ใช่ URL → ล้ม · `http://` ใน production → ล้ม · `http://localhost` ใน development → ผ่าน |
| **U-CFG-03** | `DEFAULT_ORG_PLAN_KEY`: **required ไม่มี default** — ขาด → boot ล้ม (ห้าม fallback เงียบ) |
| **U-CFG-04** | `MAX_ORGS_PER_USER`: default `"50"` · ค่าไม่ใช่ตัวเลข → ล้ม · `"0"` → ล้ม (คุมขอบล่าง) |
| **U-CFG-05** | `ORG_RATE_LIMIT_*`: default ตรงตาราง architecture §8 ทุกแถว · ค่าไม่ใช่ตัวเลข → ล้ม |
| **U-CFG-06** | **pin ค่านโยบาย (ตอบ Q11):** test เทียบ default ที่โหลดได้กับตารางในเอกสาร — เปลี่ยนโควตาเงียบ ๆ = แดง (ส่วนเทสต์พฤติกรรมอ่านจาก config ไม่ hardcode) |
| **U-CFG-07** ★4 **ใหม่ (NEW-4 · architecture §5.2/§15 แถว 8)** | **`ORG_TX_TIMEOUTS` — แนวเดียวกับ Q11 (นโยบาย = pin ที่ config · พฤติกรรม = อ่านจาก config):** (ก) **pin default 3 ค่า**: `lockTimeoutMs=3000` · `txTimeoutMs=5000` · `maxWaitMs=2000` — ตรงตารางarchitecture §5.2 · เปลี่ยนเงียบ ๆ = แดง (ข) **invariant `lockTimeoutMs < txTimeoutMs` — ตั้งให้เท่ากันหรือมากกว่า ⇒ boot ไม่ขึ้น** (ไม่ใช่ warn) เพราะถ้า lock timeout ยาวกว่า tx timeout เราจะได้ `P2028` ที่กำกวมแทน `55P03` ที่แมปได้ (ค) ค่าไม่ใช่ตัวเลข/ติดลบ/`0` → ล้ม (ง) env-tunable จริง: ตั้งค่าใหม่ผ่าน env แล้ว `ORG_TX_TIMEOUTS` ที่ export ออกมาเปลี่ยนตาม — **เทสต์พฤติกรรม (U-API-21/I-C-13) ต้องอ่านค่าจากที่นี่ ห้าม hardcode 3000/5000** |

---

## §6 Unit — `apps/api`

| id | เคส |
|---|---|
| **U-API-01** ★1 | `OrgContextMiddleware` resolve order §1.2: header อย่างเดียว · path อย่างเดียว · ทั้งคู่ตรงกัน · **ทั้งคู่ไม่ตรง → `mismatch`** · ไม่มีทั้งคู่ → `none` |
| **U-API-02** ★1 | **I-3:** route `@UserScoped()`/`@Public()` + ส่ง `X-Organization-Id` ของ org ที่ผู้เรียกเป็นสมาชิกจริง → `OrgContextStore.get()` = **`undefined`** และ context เดิม (ถ้ามี) ถูกล้าง |
| **U-API-03** ★1 | **I-4:** middleware แนบ `req.orgAuth` ครบทุก outcome · guard **ไม่แตะ `req.user` เลย** (assert ด้วย getter ที่ throw เมื่อถูกอ่าน) |
| **U-API-04** ★1 | `OrgScopeGuard` — **failure matrix §1.4 ครบ 8 แถว** รวม: 401 (ไม่มี token / token ปลอม / หมดอายุ / `typ` ผิด) · 422 `ORG_CONTEXT_REQUIRED` · 422 `ORG_MISMATCH` · 403 `ORG_ACCESS_DENIED` (ไม่มี membership / `revoked` / `invited` / org ไม่มีจริง) |
| **U-API-05** ★2 **(ขยาย amend #4 — NEW-3)** | `CapabilityGuard`: มี metadata + มี capability → ผ่าน · ขาด capability → 403 `FORBIDDEN` + event · `full_access` ผ่านทุก capability · route ที่ mark `@AnyActiveMember()` → ผ่านโดยไม่ต้องมี capability · **fail-closed by omission ต้องพิสูจน์ *ราย method* ไม่ใช่เหมาเป็นกลุ่ม:** ตาราง table-driven `method ∈ {GET, HEAD, POST, PATCH, PUT, DELETE}` × "org-scoped + ไม่มี metadata เลย" → **403 `FORBIDDEN` + log `capability_metadata_missing` ทุกแถว** · **แถว `GET`/`HEAD` คือของใหม่ที่ต้องมีหลักฐาน red→green** (ร่างเดิมของ guard ปล่อย read ผ่าน ⇒ รันเทสต์นี้กับ guard ที่กรองเฉพาะ mutating ต้อง **แดง**) · **assert เชิงลบ:** guard ต้องไม่มีเงื่อนไขที่อ้างอิง `method` ในเส้นทาง fail-closed (ตรวจด้วยผลลัพธ์ 6 แถวข้างบน ไม่ใช่การอ่านโค้ด) · `@UserScoped()`/`@Public()` ไม่ถูกกระทบ (ยังผ่านโดยไม่ต้องมี metadata — ไม่ใช่ org-scoped) |
| **U-API-06** | org rate-limit guard: นับต่อ key ถูก · เกิน → 429 + `Retry-After` (วินาที, > 0) · **IPv6 2 address ใน /64 เดียวกัน = key เดียวกัน (N-3)** · IPv4 ไม่เปลี่ยนพฤติกรรม · **Redis ล่ม → ปล่อยผ่าน + emit event** · โควตาอ่านจาก config |
| **U-API-07** ★6 **(ขยาย amend #4 — NEW-1/D-030 = Critical ⇒ red→green บังคับ)** | `adminResetPassword` fail-closed **2 เงื่อนไข · เมทริกซ์ 8 เคส** (7 เคสของ architecture §3.3 + 1 ของผม): **C-2 (เงื่อนไขที่ 1):** (ก) target อยู่ org นี้อย่างเดียว + ไม่ใช่ Owner → สำเร็จเหมือนเดิม (ข) target active ใน org อื่นด้วย → **404 + `user.update` ไม่ถูกเรียก** (ค) target มี membership org อื่นแต่ `revoked` → สำเร็จ (ง) caller ไม่มี capability → 404 เหมือนเดิม (จ) เคส (ข) emit `auth.password.admin_reset_blocked_multi_org` · **NEW-1 (เงื่อนไขที่ 2 — ใหม่):** **(ฉ) target เป็น Owner (`full_access`) + caller มีแค่ `manage_members` → `404` รูปเดิม + `user.update` **ไม่ถูกเรียก** + emit `auth.password.admin_reset_blocked_owner_target`** · **(ช) target เป็น Owner + caller มี `full_access` → สำเร็จ** (เคสควบคุม — กันการ "ผ่าน" ด้วยการทำ endpoint พังทั้งเส้น) · **(ซ) *ที่ผมเพิ่มเอง เพราะ 404 อย่างเดียวไม่พอ:* ในเคส (ฉ) ต้อง assert ว่า **`refresh.revokeAllForUser` และ `clearAccount`/ปลด backoff ไม่ถูกเรียกด้วย** — ถ้าเส้นทางที่ถูกปฏิเสธยังเดินไปถึงการล้าง session/backoff ของ Owner แปลว่า Admin ยัง **เตะ Owner ออกจากระบบซ้ำ ๆ ได้ด้วย request ที่ "ถูกบล็อก"** (DoS ที่ status 404 มองไม่เห็น)** · **เงื่อนไขข้ามทุกเคส:** (1) การนับ/การอ่าน role ของ target/การเขียน **อยู่ใน `tx` เดียวกัน** — spy identity ว่าทุก read ใช้ object เดียวกับ `tx` และมี `SELECT … FOR UPDATE` บนแถว `User` เป็นคำสั่งแรก (NEW-5ก · รูปเดียวกับ M-2) (2) มีการ **นับซ้ำหลังเขียน** และถ้าค่าเปลี่ยน ⇒ rollback + 404 (3) payload ของ event ทั้งสองใบ **ไม่มีรหัส/hash** · **(4) 404 ของทุกสาเหตุต้อง byte-identical หลัง `stripVolatile` (ไม่ใช่สมาชิก / multi-org / Owner-target) — ไม่งั้นเราสร้าง oracle ใหม่ว่า "คนนี้เป็น Owner"** |
| **U-API-08** | `createOrganization` service: ลำดับ insert 5 แถวใน tx เดียว · plan resolve ไม่ได้ → **503 และ tx ไม่เริ่ม** · cap ถึง → 409 ก่อนเข้า tx · DTO ไม่มี field plan/currency |
| **U-API-09** ★4 | **M-2 (spy identity):** `countActiveOwners` และการอ่าน role ปัจจุบันของ target ถูกเรียกด้วย **object เดียวกับ `tx`** ที่ส่งเข้าไป ไม่ใช่ client ที่ inject มา · `lockCurrentOrganization` ถูกเรียก **เป็นคำสั่งแรก** ของ tx · **ขยายตาม architecture §5.1 (amend #3): บังคับกับ *ครบทั้ง 7 operation*** — `PATCH members/{userId}` · `DELETE members/{userId}` · **`DELETE /orgs/{id}/membership` (leave)** · `POST /invitations/accept` · `POST …/invitations` · `POST …/invitations/{id}/link` · `DELETE …/invitations/{id}` · **เขียนเป็น table-driven test ที่ enumerate จากลิสต์ที่ backend export** (`ORG_LOCK_REQUIRED_OPERATIONS`) — เพิ่ม service method ใหม่ที่แตะ membership/invitation แล้วไม่อยู่ในลิสต์ = **แดง** (ถ้า enumerate เองในเทสต์ ลิสต์จะ drift เงียบ) |
| **U-API-09b** ★4 | **re-validate after lock (§5.1 กฎข้อ 2):** `accept` ต้องเรียก `canAcceptInvitation()` **ด้วยข้อมูลที่อ่านผ่าน `tx` หลัง lock** (spy identity ของ `tx` + ลำดับ: lock → re-read invitation ด้วย `tokenHash` → re-read membership → เรียก pure fn) · **assert เชิงลบ:** ผลของการอ่าน *นอก* tx ต้องไม่ถูกส่งเข้า `canAcceptInvitation` (ให้ stub การอ่านนอก tx คืนค่าที่ "ผ่าน" แต่ค่าใน tx คือ "ถูกถอดแล้ว" → ต้องได้ `INVITATION_SUPERSEDED`) — นี่คือเทสต์ที่ทำให้ I-C-04 ไม่กลายเป็นเทสต์ที่ผ่านโดยบังเอิญ |
| **U-API-10** ★2 | **I-9:** accept ที่พบ membership `active` → 409 `ALREADY_MEMBER` และ **`membership.update` ไม่ถูกเรียก** · invitation ถูก mark `cancelled` (ไม่ใช่ `accepted`) |
| **U-API-11** | **I-1:** `revokeMember` เรียก `invitation.updateMany(status: pending → cancelled)` **ด้วย tx เดียวกัน** และอยู่ก่อน commit · `cancelledInvitations` ในผลลัพธ์ = จำนวนจริง |
| **U-API-12** ★5 **(เขียนใหม่ amend #3 — รับข้อแย้ง §6.3 ข้อ 2/3 แบบมีเงื่อนไข)** | mapper ของ org profile (`GET`/`PATCH /orgs/{id}` และ response ของ `PUT …/tax-profile`) — **3 ระดับตาม api-spec §3.3:** (ก) **ไม่ว่าผู้เรียกจะมีสิทธิ์อะไร key `taxId` ต้องไม่มีอยู่ใน object เลย** (ไม่ใช่ `null`/`undefined` — เดิมเคสนี้ assert ตรงข้าม ⇒ **กลับด้าน**) (ข) มี `manage_org_settings` → มี `entityType` + `taxIdMasked` + `vatRegistered` + `branchCode` (ค) **สมาชิก active ที่ไม่มี capability นั้น → มีแค่ `vatRegistered` เท่านั้น — ไม่มี `taxIdMasked`/`entityType`/`branchCode`** (ux Q13) (ง) `taxProfile = null` เมื่อยังไม่ประกาศ ทุกระดับ · (จ) `taxProfileComplete` อยู่ที่ root และเห็นได้ทุกระดับ · **assert เชิงโครงสร้าง:** serialize object แล้ว string ต้องไม่มี TIN เต็มของ fixture (กัน field ที่ลืมชื่อ) · **(ฉ) *เพิ่ม amend #4 — pin M-4:* `PATCH /orgs/{id}` ที่ส่ง `logo` เป็นค่าอื่นที่ไม่ใช่ `null` → `422` (api-spec §3.4 รับเฉพาะ `null` จนกว่าจะมี F-040) — ไม่มีเทสต์นี้ = ช่อง SSRF/stored-XSS ในอนาคตเปิดกลับได้เงียบ ๆ** |
| **U-API-13** ★1 | `orgs/system/*`: ทุก method บังคับ `userId` หรือ `tokenHash` เป็นตัวจำกัดขอบเขต · **ไม่มี path ไหนอ่าน `X-Organization-Id`** (ส่ง header org อื่นเข้าไป → ผลลัพธ์ไม่เปลี่ยนแม้แต่ field เดียว) · `tenancy/` อ่านได้เฉพาะ `Membership`/`Role` ของคู่ที่ resolve มา (ห้ามเขียน, ห้าม model อื่น) |
| **U-API-14** ★3 | logger config: redact `token`/`tokenHash`/`taxId`/`password*` · **ไม่ log query string ของ `/invitations/*`** · ไม่ log body ของ preview/accept — assert ด้วยการยิง log จริงแล้วอ่าน output |
| **U-API-15** | `ERROR_CODES` registry: **18 code ใหม่ครบ** · HTTP status ตรงตาราง api-spec §4 · map → `ApiFailure` ตาม D-025 (**`ORG_MISMATCH` = 422/Validation ไม่ใช่ Forbidden — N-1**) · `ORG_ACCESS_DENIED` ≠ `FORBIDDEN` (I-5) · code ที่ ship แล้วไม่ถูกเปลี่ยนค่า |
| **U-API-16** **(แก้จำนวน amend #4)** | security event: ทุก operation emit event ตาม architecture §9 (**15 ค่าใน union** — เพิ่ม **`auth.password.admin_reset_blocked_owner_target`** ตาม architecture §15 แถว 4 · **assert จำนวนสมาชิกของ union = 15 เป๊ะ** เพื่อให้การเพิ่ม/ลบ event ต้องมีคนอธิบาย) · **`…blocked_owner_target` ≠ `…blocked_multi_org` — ห้ามใช้ใบเดียวกันสองเหตุ** (ถ้ากลืนกัน = สืบไม่ได้ว่าเป็นความพยายามยึดบัญชี Owner) และ payload ทั้งสองใบ = `{ actorUserId, orgId, targetUserId }` **ไม่มีรหัส/hash** · **emit หลัง commit เท่านั้น** (tx rollback → ไม่ emit) · payload ของ `org.tax_profile.set` มี `taxIdPresent` แต่ **ไม่มีค่า TIN แม้บางส่วน** (M-7ค) · `org.member.role_changed` มี `grantsFullAccess` · **ใหม่:** `org.member.left` (userId/organizationId/roleId/`cancelledInvitationIds[]`) **≠** `org.member.revoked` — leave ต้อง**ไม่** emit `member.revoked` และ revoke ต้อง**ไม่** emit `member.left` (ถ้ากลืนกัน = แดง) · `org.tax_profile.revealed` มี `actorUserId`+`organizationId` และ **payload ทั้งก้อน serialize แล้วต้องไม่มี substring ใดของ TIN ยาว ≥ 4 ตัว** |
| **U-API-17** ★5 | `revealTaxProfile` service: มี `manage_org_settings` + ประกาศแล้ว → คืนเลขเต็มจาก DB · ไม่มี capability → `403 FORBIDDEN` **และไม่อ่านค่า TIN จาก DB เลย** (spy: repo ไม่ถูกเรียก — กัน "อ่านมาแล้วค่อยตัดทิ้ง" ซึ่งทำให้ค่าไปโผล่ใน log/heap dump) · ยังไม่ประกาศ → `404 NOT_FOUND` · **emit `org.tax_profile.revealed` ทุกครั้งที่สำเร็จ** และ**ไม่ emit เมื่อ 403/404** · `revealedAt` = เวลาที่ server ออก ไม่ใช่ค่าจาก client |
| **U-API-18** ★7 | `leaveOrganization` service (D-029): target = `ctx.userId` **เสมอ** — เมธอด **ไม่มี parameter ที่ระบุ user ได้** (assert ที่ signature/type-level ด้วย type test + assert ว่า controller ไม่ส่งค่าใดจาก `req.params`/`req.body` เข้าไป) · ใช้ `assertOwnerRemains` **ตัวเดียวกับ revoke** (spy) → Owner คนสุดท้าย = `409 LAST_OWNER` และ tx rollback · เรียก `invitation.updateMany(pending→cancelled)` ของ **email ตัวเอง** ด้วย `tx` เดียวกัน · `lockCurrentOrganization` เป็นคำสั่งแรก (ผ่าน U-API-09) |
| **U-API-19** | `Role.key` (ux Q4): mapper คืน `roleKey` **คู่กับ `roleName` ทุกจุด** (`Membership`/`MemberRow`/`Invitation`/`InvitationPreview`/`RoleRow`) — เขียนเป็น test ที่ enumerate DTO จาก schema ที่ generate แล้ว: **มี `roleName` ที่ไหนแต่ไม่มี `roleKey` = แดง** · system role ที่สร้างตอน `POST /organizations` ได้ `owner\|admin\|staff` **คงที่** (pin เป็นค่าคงที่ในเทสต์ — เปลี่ยน = breaking change ต่อ client) · role ที่ `key = null` ต้อง serialize เป็น `null` ไม่ใช่หายไปจาก object |
| **U-API-20** ★6 **(เพิ่ม NEW-7 amend #4)** | **`traceId` ที่ชั้น filter (คู่กับ R-01):** ทุก `ApiFailure` ที่ผ่าน `domain-exception.filter` มี `error.traceId` ไม่ว่าง · **server เป็นคนออกค่าเสมอ** — ส่ง `X-Request-Id` ปลอมจาก client (รวมค่าที่มี PII/`\n`/ยาว 10k) → ค่าใน `error.traceId` **ต้องไม่ใช่ค่านั้น** (ค่าจาก client ไปอยู่ที่ `upstreamRequestId` ใน log เท่านั้น) · response echo `X-Request-Id` = ค่าที่ server ออก · 2 ครั้งติดกันได้คนละค่า · **NEW-7 — pin รูปแบบ:** ค่าตรง regex ของ **UUID v4** (version nibble = `4`, variant ∈ `8|9|a|b`) · **สุ่ม ไม่เรียงลำดับ:** ยิง 1,000 ครั้งแล้ว (ก) ไม่ซ้ำเลย (ข) **เรียงตามเวลาแล้วไม่ monotonic** (ถ้าเรียงขึ้นเสมอ = counter/timestamp ปลอมตัว ⇒ แดง) (ค) ไม่มี substring ของ `orgId`/`userId`/email/`Date.now()` ในค่า |
| **U-API-21** ★4 **ใหม่ (NEW-4 · architecture §5.2)** | **การแมป error ของ tx ที่คว้า lock → `409` ไม่ใช่ `500` (ชั้น unit — เร็วและไม่ flaky ต่างจาก I-C-13):** table-driven **4 ชนิด** ที่ §5.2 ระบุ: `55P03 lock_not_available` · `40P01 deadlock_detected` · `P2028` (tx เกิน `timeout`) · pool timeout (เกิน `maxWait`) → **ทุกชนิดต้องออกเป็น `ApiFailure` code `CONFLICT` + HTTP `409` + `details.reason === "busy"`** · **assert เชิงลบที่สำคัญกว่า status:** (ก) `message`/`details`/`fieldErrors` ที่ออก wire **ต้องไม่มี** สตริง `40P01`/`55P03`/`40001`/`P2028`/`prisma`/ชื่อ table/ชื่อ constraint (รั่ว schema internals) (ข) **error ชนิดอื่นทั้งหมดต้องไม่ถูกกลืนเป็น 409** — ยิง `P2002`(unique) / `P2025`(not found) / `Error` ธรรมดา ผ่าน mapper เดียวกันแล้วต้องได้ผลเดิมของมัน (409 ที่กว้างเกินไป = ซ่อนบั๊กจริงทั้งหมดไว้ใต้ "ลองใหม่") (ค) เคส `40P01` ต้อง **log ระดับ `error` + เพิ่ม metric `org_tx_lock_timeout_total{reason}`** ส่วน `55P03` ไม่ต้องระดับ error (deadlock = สัญญาณว่ามีคนเขียน tx ผิดกติกา ตาม §5.2) (ง) **ไม่มี auto-retry ที่ server** — spy ว่า service ถูกเรียกครั้งเดียว (retry เงียบบน write ที่ยังไม่มี `Idempotency-Key` = เสี่ยงทำซ้ำ) |

---

## §7 Integration (Track 1 — hard gate) · `apps/api/test/*.kit.ts` + `*.int.test.ts`

### 7.1 Kit กลาง (เขียนครั้งเดียว ใช้ได้ทุก feature ถัดไป)

| id | เคส |
|---|---|
| **I-01** ★1 | **cross-org leak — ทุก endpoint × 5 persona** (ขยายจาก 4 ของ M-8): (ก) สมาชิก active ของ **org B** (ข) user ที่ **ไม่มี membership ที่ไหนเลย** (ค) `revoked` ใน org A (ง) `invited` ใน org A (dead state) (จ) **สมาชิก active ของ org A แต่เป็น Staff** → ต้องได้ `403 FORBIDDEN` ไม่ใช่ `ORG_ACCESS_DENIED` · (ก)–(ง) ต้องไม่เห็น/ไม่แก้ข้อมูลของ A ได้เลยแม้แต่เส้นเดียว · **ครอบทั้ง read และ mutating route** |
| **I-02** ★2 **(ขยาย amend #4 — NEW-3: fail-closed ครอบ read แล้ว)** | **route-registry capability test (I-2):** enumerate route ทั้งหมดจาก Nest router → **org-scoped *ทุกเส้นไม่ว่า method ใด รวม `GET`/`HEAD`*** ที่ไม่มี metadata `@RequireCapability`/`@AnyActiveMember` = **แดง** · **เงื่อนไขของผมต่อการขยายนี้ (ไม่ใช่แค่ลบตัวกรอง `method`):** (ก) เทสต์ต้อง **แยกนับ read/mutating แล้วยืนยันว่า *ทั้งสองกลุ่มมีสมาชิก > 0*** — ถ้ากลุ่ม read enumerate ได้ 0 เส้น แปลว่า registry มองไม่เห็น route อ่าน แล้วเทสต์จะเขียวหลอกเหมือนเดิมทุกประการ (ข) ต้องมี **fixture ของ I-09 ที่เป็น `GET` โดยเฉพาะ** (ค) รายงานจำนวน route ที่ตรวจไปทั้งหมดใน output ของเทสต์ (ให้คนอ่าน CI เห็นว่าไม่ได้ตรวจ 0 เส้น) · **ครอบ route ของ F-001 ด้วย** (ทุก route ต้องถูกจัดชั้นชัดเจน: org-scoped / `@UserScoped` / `@Public`) · **`@AnyActiveMember()` = การประกาศที่ถูกต้อง ไม่ใช่ "ลืมประกาศ"** แต่เป็นชั้นที่อ่อนที่สุด ⇒ ต้องอยู่ใน **`ANY_ACTIVE_MEMBER_ROUTES` ที่ import จาก production** และ **เทียบราย tier** (`mutating` 1 เส้น · `read` 2 เส้น) · route ใหม่ที่ใส่ `@AnyActiveMember()` โดยไม่แก้ลิสต์ = **แดง** → คู่กับ **G-13** |
| **I-03** ★2 **(ขยาย amend #4 — NEW-3)** | ยิง **ทุก endpoint ที่ต้องมี capability ด้วย token ของ Staff** → 403 `FORBIDDEN` ทุกเส้น (ยกเว้นเส้นที่อยู่ใน `ANY_ACTIVE_MEMBER_ROUTES`) · **ไม่จำกัดที่ mutating อีกต่อไป:** ต้องรวม **`GET /orgs/{orgId}/members` และ `GET /orgs/{orgId}/invitations`** (email directory = ของที่แพงที่สุดของ F-002 ตาม NEW-3) · **enumerate จาก `ROUTE_CAPABILITIES` ไม่ใช่ลิสต์ที่เขียนมือ** — endpoint ใหม่ที่มี capability แล้วไม่ถูกยิงด้วย persona Staff = แดง |
| **I-04** ★5 **(เพิ่มมิติ `taxId` — รับข้อแย้ง §6.3 ข้อ 3 เต็ม)** | **PII assertion กลาง (C-4):** response body ของทุก endpoint ไม่มี key `passwordHash` / `tokenHash` · `token` อนุญาตเฉพาะ 2 เส้นใน `TOKEN_RESPONSE_ALLOWLIST` (`POST …/invitations`, `POST …/invitations/{id}/link`) · **`taxId` (ทั้ง key และ *ค่า* 13 หลักของ fixture ในรูป string ที่ไหนก็ตามของ body) อนุญาตเฉพาะ `POST …/tax-profile/reveal` เส้นเดียว** — เส้นอื่นมี = แดง · **3 เงื่อนไขของ allowlist:** (ก) ทั้งสอง allowlist ต้อง **import จากโค้ด production** ห้ามประกาศซ้ำในเทสต์ (ข) `TAX_ID_RESPONSE_ALLOWLIST` ต้องมีสมาชิก **= 1 เส้นพอดี** และ `TOKEN_RESPONSE_ALLOWLIST` **= 2 เส้นพอดี** (เพิ่มเส้นใหม่โดยไม่มีคนคุย = แดง) (ค) allowlist เป็น **รายการ endpoint ที่ระบุชัด ไม่ใช่ regex/prefix** · **สแกนทั้ง body รวม nested + array ไม่ใช่แค่ key ชั้นบน** |
| **I-05** ★5 | **header assertion กลาง (เพิ่มจาก §12):** route ที่คืน token/email/TIN ต้องมี `Cache-Control: no-store` + `Pragma: no-cache` · route คำเชิญ **และ `POST …/tax-profile/reveal`** ต้องมี `Referrer-Policy: no-referrer` — ตารางว่าเส้นไหนต้องมี **import จาก `RESPONSE_HEADER_POLICY` ของ production** (ห้าม kit ประกาศเอง) · **assert 2 ทาง:** เส้นที่อยู่ในนโยบายแล้วขาด header = แดง **และ** เส้นที่คืน token/email/TIN แต่ไม่อยู่ในนโยบาย = แดง (กันนโยบายที่ลืมอัปเดตพร้อม endpoint ใหม่) |
| **I-06** | **traceId assertion กลาง (ตอบ Q12 · หนึ่งใน 2 behavior change ที่ `oasdiff` เงียบ — §11):** ทุก error response (401/403/404/409/415/422/429/**500 จริงจาก fixture ที่ทำให้ handler โยน**) ของ **ทุก route ในระบบ รวม `/auth/*` ของ F-001** มี `error.traceId` ที่ไม่ว่าง · **ค่าไม่ซ้ำข้าม request** (ยิง 50 ครั้ง ค่าไม่ซ้ำเลย) · ปรากฏใน log บรรทัดเดียวกัน + ตรงกับ header `X-Request-Id` · **ค่าต้องไม่บอกอะไรเกี่ยวกับ tenant/user** (ไม่มี substring ของ `orgId`/`userId`/email) |
| **I-07** | **schema validation (เพิ่มจาก §12):** ทุก response ที่ int test ได้รับถูก validate กับ OpenAPI ที่ generate ออกมา — เช่น `taxId` เป็น optional จริง, `nextCursor` nullable, envelope error ตรงรูป |
| **I-08** ★1 **(แก้ถ้อยคำ amend #3 — รับข้อแย้ง §6.3 ข้อ 1 *แบบมีเงื่อนไข*)** | **I-5 ไม่มี existence oracle:** `orgId` ที่ไม่มีจริง vs org ของคนอื่น → **status เท่ากัน** และ **body ตรงกันทุก byte หลัง normalize** · **นิยาม normalize (ปิดตาย ห้ามขยายโดยไม่มี D-XXX):** ตัดเฉพาะ `error.traceId` และ header `X-Request-Id`/`Date` เท่านั้น — ทำผ่าน helper กลาง `stripVolatile(res)` ที่มี **allowlist ปิด** (ไม่ใช่ deep-diff แบบ "ข้าม key ที่ต่างกัน" ซึ่งจะกลืน oracle จริงไปด้วย) · **4 เงื่อนไขที่ยังบังคับหลัง normalize:** (ก) ทั้งสอง response **ต้องมี `traceId` ทั้งคู่และไม่ว่างทั้งคู่** — ขาดฝั่งใดฝั่งหนึ่ง = แดง (ข) **ค่า `traceId` ของสองฝั่งต้องต่างกัน** (พิสูจน์ว่าไม่ได้ผ่านเพราะค่าคงที่/ว่าง) (ค) `code`/`message`/`details`/`fieldErrors` เท่ากันทุกไบต์ (ง) **จำนวน key ของ `error` เท่ากัน** ⇒ ฝั่งใดแอบเพิ่ม field = แดง · **สิ่งที่แผนนี้ไม่รับประกัน (ประกาศไว้ตรง ๆ):** timing oracle — ผมไม่ทดสอบความต่างของเวลาตอบ เพราะ CI runner ผันผวนเกินกว่าจะได้เทสต์ที่เชื่อได้ ⇒ บันทึกเป็นความเสี่ยงที่รับไว้ (§19.3) ไม่ใช่ช่องที่ปิดแล้ว |
| **I-09** **(ขยาย amend #4)** | **meta-test ของ kit เอง (เพิ่มจาก §12):** fixture ที่จงใจผิด → kit ต้อง **แดง** · ป้องกัน kit ที่ enumerate ได้ 0 route แล้วเขียวหลอก · **ชุด fixture บังคับ (ทุกตัวต้องทำให้ kit ที่เกี่ยวข้องแดงจริง):** (ก) controller **`POST`** ที่ลืม `@RequireCapability` (ข) **controller `GET` ที่ลืม `@RequireCapability` — ของใหม่ NEW-3** (ถ้า fixture นี้ไม่ทำให้ I-02 แดง แปลว่าการ "ขยายให้ครอบ read" ไม่ได้เกิดขึ้นจริง) (ค) route ที่ใส่ `@AnyActiveMember()` โดยไม่อยู่ใน allowlist — **ทั้งแบบ mutating และแบบ read** (ต้องแดงที่ G-13 แยกกันคนละ tier) (ง) mapper ที่ปล่อย `passwordHash` (จ) route ที่ลืม `no-store` (ฉ) mapper ที่ใส่ `taxId` ในเส้นที่ไม่อยู่ใน allowlist (ช) **`select: { user: { … } }` ที่ไม่ใช่ `USER_SELECT`** (NEW-8) |

### 7.2 Flow ตาม feature

| id | เคส |
|---|---|
| **I-10** | สร้าง org: (a) 5 แถวเกิดครบใน tx เดียว (Organization/Role×3/Membership/OrgEntitlement/Warehouse) + `org.created` (b) plan resolve ไม่ได้ → **503 และ DB ไม่มีแถวใดเกิดขึ้นเลย** (c) `GET /orgs/{id}/invitations` ไม่คืน token/`tokenHash` |
| **I-11** | cap org/user (I-10 finding): 50 org active → ใบที่ 51 = `409 ORG_LIMIT_REACHED` + `details.limit` · 50 org แต่ 10 ใบ `revoked` → สร้างได้ · **Redis ดับ → cap ยังบังคับ (fail-closed)** |
| **I-12** | partial unique `Warehouse (organizationId) WHERE isDefault` → insert default ใบที่สอง = DB error |
| **I-13** | partial unique `Invitation (organizationId,email) WHERE status='pending'` → สร้างซ้ำ = `409 INVITATION_PENDING` + `details.invitationId` ตรงกับใบที่ค้าง |
| **I-14** ★3 | **hash-at-rest พิสูจน์ได้ (D-018):** สร้างคำเชิญ → อ่านแถวจาก DB ตรง ๆ → `tokenHash` **≠** `token` ที่ API คืน และ ≠ ทุก substring ของมัน · lookup ด้วย `token` ที่ได้ทำงานได้ · **hash ที่เทสต์ใช้เทียบต้องมาจาก production fn** ไม่ใช่ hash ที่เขียนใหม่ในเทสต์ · `inviteUrl` ขึ้นต้นด้วย `WEB_APP_BASE_URL` |
| **I-15** ★3 ★2 **(เพิ่ม (f) amend #4 — NEW-2)** | reissue: (a) token เดิม → `404 INVITATION_INVALID` **ทันทีหลัง 200 ของ `/link`** (b) `expiresAt` = now + TTL(role) **นับใหม่** (role สูง = 24 ชม.) (c) `email`/`roleId` ไม่เปลี่ยน (d) emit `org.invitation.link_reissued` (e) คำเชิญที่ไม่ใช่ `pending` → 409 · **(f) *ใหม่ — `canAssignRole` ที่ call site ที่ 4:* Admin (`manage_members` ไม่มี `full_access`) กด `POST …/invitations/{id}/link` บนคำเชิญที่เป็น **role Owner** → `403 FORBIDDEN` · เงื่อนไขที่ต้อง assert เพิ่มจาก status: (i) **DB ไม่เปลี่ยนแม้แต่ field เดียว** — `tokenHash`/`tokenIssuedAt`/`expiresAt` ต้องเป็นค่าเดิมเป๊ะ (ถ้า rotate แล้วค่อย 403 = ประตูถูกเปิดไปแล้ว และผู้โจมตีอ่าน token จาก DB/log ไม่ได้ก็จริง แต่ **ลิงก์ที่ Owner ตัวจริงถืออยู่ตายไปแล้ว** = DoS ต่อ Owner) (ii) **token เดิมยังใช้ได้จริง** (ยิง preview ด้วย token เดิมหลังโดน 403 → ยังผ่าน) (iii) **ไม่ emit `org.invitation.link_reissued`** แต่ **emit `org.access.capability_denied` ที่มี reason `owner_only`** (iv) **เคสควบคุม:** Owner กด reissue ใบเดียวกัน → `200` และ Admin กด reissue คำเชิญ role Staff → `200` (พิสูจน์ว่าไม่ได้ปิดทั้งเส้น) · **(v) หมายเหตุการตัดสิน:** ข้อเสนอเสริมของ reviewer "reissue ใบที่หมดอายุ → 409" **backend ไม่รับพร้อมเหตุผล ผมเห็นด้วย** ⇒ ผมจึง **ไม่มีเทสต์ที่บังคับ 409** และ (e) ยังยืนตามเดิม (คำเชิญ `pending` ที่หมดอายุแล้ว reissue ได้) |
| **I-16** | cancel: token ตายทันที (`409 INVITATION_CANCELLED` ที่ preview / accept) · cancel ซ้ำ → 409 |
| **I-17** ★3 | accept — 3 ทางแยกของ US-4 + edge: (a) มีบัญชีแล้ว → membership active + role ตามคำเชิญ (b) ยังไม่มีบัญชี: preview → `/auth/signup` (contract เดิม) → login → accept สำเร็จ (c) หมดอายุ/ยกเลิก/รับไปแล้ว → 409 แยก code (d) **email คนละตัว → `403 INVITATION_EMAIL_MISMATCH` + `details.emailMasked` และ response ไม่มี email เต็มที่ไหนเลย** (e) `acceptedAt`/`acceptedByUserId`/`acceptedUserCreatedAfterInvite` ถูกบันทึกและโผล่ใน `GET /invitations` (f) `roleId` ที่ถูกลบ → `409 INVITATION_ROLE_UNAVAILABLE` · **(g) *ใหม่ amend #4 — NEW-9: rotate ต้องล้างสัญญาณ forensic ไม่ได้*** — ลำดับเวลาที่ต้องสร้างจาก seed kit: `Invitation.createdAt` = T0 → **สมัครบัญชีด้วย email ที่ถูกเชิญ** ที่ T1 → **กด "ออกลิงก์ใหม่"** ที่ T2 (`tokenIssuedAt` = T2 > T1) → accept ⇒ **`acceptedUserCreatedAfterInvite` ต้องเป็น `true`** (เทียบกับ `createdAt` ไม่ใช่ `tokenIssuedAt`) · **เคสกลับด้าน:** บัญชีมีอยู่ก่อน T0 → ต้องเป็น `false` · **นี่คือเทสต์ที่แดงกับ implementation เดิม** (ที่เทียบ `tokenIssuedAt`) ⇒ ต้องมีหลักฐาน red→green · **เหตุผลที่ยอมให้เป็นแค่ธง ไม่ใช่การบล็อก:** §7.6 ประกาศเองว่า Phase 0 ยืนยัน email ไม่ได้ ⇒ ธงนี้คือ compensating control **ตัวเดียวที่เหลือ** ของ I-7 หลัง NEW-2 ปิดทาง reissue — ถ้าธงโกหกได้ I-7 ก็ไม่เหลืออะไรเลย |
| **I-18** ★3 | **I-1:** (a) ถูกถอด → accept ด้วยคำเชิญที่ออกก่อนถอด → `409 INVITATION_SUPERSEDED` (b) เชิญใหม่**หลัง**ถอด → accept ได้ + emit `org.member.reactivated` แยกใบ (c) กด "ออกลิงก์ใหม่" บนคำเชิญเก่าหลังถอด → ใช้ได้ (`tokenIssuedAt` ใหม่ > `revokedAt`) |
| **I-19** ★1 | **AC US-5 ครบชุด:** (a) revoke commit → request ถัดไปของ org นั้น = **403 `ORG_ACCESS_DENIED` (request ที่ 1 ไม่ใช่หลัง TTL)** (b) `GET /me/organizations` ไม่มี org นั้นทันที (c) คำเชิญ `pending` ของ email นั้นกลายเป็น `cancelled` — **อ่านจาก DB ไม่ใช่จาก response** (d) แถว membership ยังอยู่ + โผล่ใน `?status=revoked` พร้อม `revokedAt`/`revokedByUserId` (e) org อื่นของ user คนเดียวกันยังใช้งานได้ปกติ |
| **I-20** | หลังถูกถอด: ยัง `POST /auth/refresh` ได้ · ยัง login ได้ · access token เดิมยังใช้กับ org อื่นได้ (session ไม่ถูกทำลาย — AC-5.1/5.6) |
| **I-21** ★5 | `GET /orgs/{id}/members` + `/invitations` ต้องมี `manage_members` → Staff = `403 FORBIDDEN` (ไม่ใช่ `ORG_ACCESS_DENIED`) · Admin/Owner ผ่าน · response มี `isOwner`/`isMe` ถูกต้อง |
| **I-22** ★5 **(แก้ (d) amend #3)** | tax profile: (a) TIN checksum ผิด → `422 TAX_ID_INVALID` + `fieldErrors.taxId` · กรอกครึ่งชุด → 422 (b) `PUT` ซ้ำ = ทับชุดเดิม ไม่เกิดชุดที่สอง (c) `taxProfileComplete` ถูกทุกเคส (ยังไม่ประกาศ/ประกาศครบ) **(d) 3 ระดับสิทธิ์บน `GET /orgs/{id}` + response ของ `PUT`:** ผู้มี `manage_org_settings` → มี `taxIdMasked` แต่ **ไม่มี key `taxId`** · **Staff → ไม่มีทั้ง `taxId` และ `taxIdMasked` และไม่มี `entityType`/`branchCode` — มีแค่ `vatRegistered`** (ux Q13) · ทุกระดับได้ `taxProfileComplete` · **`PUT` ไม่สะท้อนค่า `taxId` ที่เพิ่งส่งมากลับ** (e) log ไม่มีค่า TIN แม้ตอน 422 (ค่าที่ผู้ใช้พิมพ์ผิดก็เป็น PII) |
| **I-23** ★2 **(เพิ่ม (f)/(g) amend #4)** | **Owner-only (C-1) ยิงผ่าน HTTP จริง — ต้องครบ *ทุก call site ของ `canAssignRole`*:** (a) Owner ยกคนอื่นเป็น Owner → 200 (b) **Admin ยกตัวเองเป็น Owner → 403 `FORBIDDEN` และ DB ไม่เปลี่ยน** (c) Admin เชิญด้วย role Owner → 403 (d) Admin ลด/ถอด Owner → 403 (e) Admin แก้ Staff → 200 (ไม่ถดถอย) · **(f) *ใหม่ — NEW-2:* Admin ออกลิงก์ใหม่ของคำเชิญ role Owner → 403** (รายละเอียด assertion ที่ I-15f) · **(g) *เทสต์ที่ทำให้ "ครบ" พิสูจน์ได้ ไม่ใช่เชื่อว่าครบ:* enumerate call site ของ `canAssignRole` จากโค้ด production (spy/mock ที่ระดับ module) แล้ว assert ว่า **จำนวน call site = 5** และตรงกับลิสต์ที่ architecture §3.2 ประกาศ (`PATCH members` · `DELETE members` · create invite · **reissue** · **admin-reset**) — เพิ่มเส้นทางที่แตะ role/credential แล้วไม่เรียก `canAssignRole` = แดง · **นี่คือชั้นที่กัน NEW-1/NEW-2 ไม่ให้เกิดซ้ำในรูปที่สาม** (ทั้งสอง finding เกิดจาก "กฎถูก แต่ลืม call site") |
| **I-24** ★4 | `409 LAST_OWNER`: Owner คนสุดท้ายลดตัวเอง · ถอดตัวเอง · ถูกคนอื่นถอด → 409 และ DB ไม่เปลี่ยน |
| **I-25** ★1 | **`$transaction` สืบทอด org extension** — ทั้งรูป callback และรูป array: ภายใน tx เขียน/อ่านข้าม org ไม่ได้ · **pin ไว้: Prisma เปลี่ยนพฤติกรรมเมื่อไหร่ = CI แดงทันที** |
| **I-26** ★1 | **I-3 ระดับ HTTP:** `POST /invitations/accept` (+ `POST /organizations`, `GET /me/organizations`) พร้อม `X-Organization-Id` ของ org อื่น → **ผลลัพธ์เหมือนไม่ส่ง header ทุก field** และ membership ที่เกิดอยู่ใน org ของคำเชิญเสมอ |
| **I-27** | **M-3:** 100 pending ที่หมดอายุแล้ว → ยังเชิญได้ · 100 pending ที่ยังไม่หมดอายุ → `409 INVITATION_LIMIT_REACHED` |
| **I-28** | pagination กลาง (D-025): `nextCursor` opaque + เดินหน้าได้ครบไม่ซ้ำไม่ข้าม · `limit` > 100 → 422 หรือถูก clamp ตามสัญญา · `withTotal=true` เท่านั้นที่ได้ `total` · sort `createdAt desc, id desc` เสถียรเมื่อ `createdAt` ชนกัน |
| **I-29** | rate limit: เกินโควตา (ตั้งค่าต่ำผ่าน env) → 429 + `Retry-After` · คนละ org/คนละ user ไม่กวนกัน · **Redis ดับ → ปล่อยผ่าน + emit `fail_open` event** |
| **I-30** ★6 **(2 ชุด — ชุดที่ 2 ใหม่ใน amend #4: NEW-1/D-030 = Critical)** | **endpoint ที่ ship แล้ว, ยิงผ่าน HTTP จริง · ทั้ง 2 ชุดเข้า smoke tier ถาวรและต้องมี red→green:** **(1) C-2 ข้าม org:** seed 2 org, user เดียว active ทั้งคู่ → Admin ของ B เรียก reset → **404 รูปเดิม** + **รหัสเดิมยัง login ได้จริง** + emit `…blocked_multi_org` · เคสควบคุม: target อยู่ org เดียวและไม่ใช่ Owner → ยังสำเร็จเหมือนเดิม · **(2) *ใหม่ — NEW-1 ภายใน org เดียวกัน:*** org เดียว, `Owner = U1` (สังกัดร้านนี้ร้านเดียว = เคสที่พบบ่อยที่สุดของ dogfood), `Admin = A` → **A เรียก `POST /orgs/X/members/U1/reset-password` → `404` รูปเดิม** · assert ต่อ: (i) **รหัส *เดิม* ของ U1 ยังล็อกอินได้จริง** และ **รหัสใหม่ที่ A ตั้ง ล็อกอินไม่ได้** (พิสูจน์ว่าไม่มีการเขียนทับ ไม่ใช่แค่ status สวย) (ii) **refresh token เดิมของ U1 ยังใช้ได้** (เส้นทางที่ถูกบล็อกต้องไม่ล้าง session ของ Owner — คู่กับ U-API-07(ซ)) (iii) emit **`auth.password.admin_reset_blocked_owner_target`** ใบเดียว **ไม่ใช่** `…blocked_multi_org` (iv) **เคสควบคุม: Owner อีกคนเรียก reset ใส่ Owner → `200` และรหัสใหม่ล็อกอินได้** (กันการ "ผ่าน" ด้วยการทำ endpoint พังทั้งเส้น) (v) **404 ของ (1) และ (2) ต้อง byte-identical หลัง `stripVolatile`** — ถ้าต่างกัน = oracle บอกว่า target เป็น Owner |
| **I-31** | migration: `prisma migrate deploy` บน DB ว่าง → สะอาด, `migrate status` ไม่มี drift · **precondition:** ใส่ 1 แถวใน `Invitation` แล้วรัน `f002_drop_invitation_token` → ต้อง **abort พร้อมข้อความ** ไม่ใช่ผ่านเงียบ |
| **I-32** | security event ครบตาม §9 (ผ่าน test sink): `org.created` · `invitation.created/link_reissued/cancelled/accepted` · `member.reactivated` · `member.role_changed` (`grantsFullAccess`) · `member.revoked` (`cancelledInvitationIds[]`) · `tax_profile.set` · `access.denied` · `access.capability_denied` — **และ tx ที่ rollback ต้องไม่ emit** |
| **I-33** | N+1: `GET /orgs/{id}/members` ใช้ query ≤ 3 ต่อ request (นับด้วย Prisma event) |
| **I-34** | **M-10:** `/me/organizations?status=all` — แถว `revoked` คืนเฉพาะ id/ชื่อ/สถานะ **ไม่มี `roleId`/`roleName`/`entitlement`** · `status=active` (default) ไม่มีแถว revoked เลย |
| **I-35** ★1 **(ขยาย amend #4 — NEW-8)** | **C-3 + nested read "ลงกลับ":** (a) **C-3 เดิม:** จาก context org B เรียก `user.findUnique + include memberships` → **ต้องไม่คืนแถวของ org A** (หรือถูกบล็อกโดยกติกา/gate) — เทสต์นี้ต้องอยู่ต่อไปแม้อนาคตจะเปลี่ยนวิธีแก้ · **(b) *ใหม่ — NEW-8 "ลงกลับ":*** จาก context org B เรียก **`membership.findMany({ select: { user: { select: { memberships: { … } } } } })`** (ตั้งต้นถูกที่ model org-scoped แต่ traverse **ผ่าน `User`** กลับลงมาที่ `Membership` ของ **org A**) → **ต้องไม่มีแถวของ org A โผล่ในผลลัพธ์** · เคสคู่ที่ต้องแดงเหมือนกัน: `…user.select.refreshTokens` (session ของ user ข้าม tenant) · **(c) เงื่อนไขของผมต่อวิธีปิดที่ backend เลือก (`USER_SELECT` frozen):** เทสต์นี้ **ไม่รับ "ผ่านเพราะไม่มีใครเขียนโค้ดแบบนั้น"** — ต้องพิสูจน์อย่างใดอย่างหนึ่ง: **(i) query แบบ (b) รันแล้วไม่คืนข้อมูลข้าม org จริง** หรือ **(ii) มันเป็นไปไม่ได้เชิงโครงสร้าง** คือ compile ไม่ผ่าน/`USER_SELECT` ใส่ relation ไม่ได้ (**U-DB-11**) **และ** grep gate แดง (**G-02**) **และ** meta-fixture I-09(ช) แดง — **ทั้ง 3 ชั้น ไม่ใช่ชั้นใดชั้นหนึ่ง** เพราะ grep เดี่ยว ๆ หลบได้ด้วย alias/destructure (คำเตือนของ reviewer เอง) · **(d)** ถ้าอนาคตเลือกทาง "ให้ extension inject ให้ nested ด้วย" → (a)/(b) ต้องยังอยู่และเปลี่ยนจาก "ถูกบล็อก" เป็น "คืนเฉพาะแถวของ ctx" |
| **I-36** | **concurrency suite** → §8 |
| **I-37** | **lane-enabled guard:** เมื่อ `process.env.CI` เป็นจริง แต่ไม่มี `TEST_DATABASE_URL`/`TEST_REDIS_URL` → **fail ทันที** (ไม่ใช่ skip) · และ suite assert ว่าจำนวนไฟล์ int ที่รัน > 0 |

### 7.3 ของใหม่จาก amend #3 (2 endpoint ใหม่ + `Role.key`)

| id | เคส |
|---|---|
| **I-38** ★5 **(เพิ่ม (a2) amend #4 — pin NEW-11)** | **`POST /orgs/{orgId}/tax-profile/reveal` — authz + lifecycle:** (a) Owner/ผู้มี `manage_org_settings` + ประกาศแล้ว → `200` และ `taxId` **ตรงกับค่าที่ `PUT` ไปเป๊ะ** · **(a2) *pin การตัดสินของ D-030(2):* **Admin** (มี `manage_org_settings` ไม่มี `full_access`) → **`200` โดยเจตนา** — เขียนเป็นเทสต์ที่ **ยืนยันขอบเขตที่ตั้งใจเปิด** พร้อมคอมเมนต์อ้าง D-030(2) ⇒ วันหนึ่งถ้ามีคนอยากแคบลงเหลือ Owner-only ต้องมาแก้เทสต์นี้และมี D-XXX ใหม่ (ไม่ใช่เปลี่ยนเงียบทั้งสองทาง) · **และเงื่อนไขที่แลกมาต้องมีจริงทุกครั้งที่ (a2) ผ่าน:** emit `org.tax_profile.revealed` (e) + header ครบ (f) + rate limit (I-39) — ถ้าตัวคุมข้อใดหาย แต่ Admin ยังอ่านได้ = แดง (b) **Staff → `403 FORBIDDEN`** (ไม่ใช่ `ORG_ACCESS_DENIED`) (c) สมาชิก org อื่น / ไม่มี membership / `revoked` → **`403 ORG_ACCESS_DENIED`** (d) ยังไม่ประกาศ tax profile → **`404 NOT_FOUND`** (และ 404 นี้ต้องไม่ต่างกันระหว่าง "org ไม่มีจริง" กับ "org มีแต่ยังไม่ประกาศ" ตามกติกา I-08) (e) **emit `org.tax_profile.revealed` เมื่อสำเร็จเท่านั้น** — 403/404 ต้องไม่ emit (อ่านจาก test sink) และ payload ที่ sink ได้ **serialize แล้วไม่มี TIN แม้บางส่วน** (f) header ครบ `no-store` + `Pragma: no-cache` + `Referrer-Policy: no-referrer` (ผ่าน I-05) (g) **ค่า TIN ไม่โผล่ใน log ทุกบรรทัดของ request นี้** — จับ log จริงทั้งสตรีมแล้ว grep หา 13 หลักของ fixture (ไม่ใช่แค่ดู field ที่ถูก redact) (h) body ที่ส่งมาเกินมา (`{ userId: … }`, `{ orgId: อื่น }`) ต้องถูกเพิกเฉย — ผลลัพธ์ผูกกับ path/ctx เท่านั้น |
| **I-39** | **rate limit ของ reveal = 20/ชม. ต่อ `(userId, orgId)`** (ตั้งค่าต่ำผ่าน env แล้วยิงไม่กี่ครั้ง — ห้าม hardcode 20 ในเทสต์พฤติกรรม, ค่าจริง pin ที่ U-CFG-05/06): เกิน → `429 RATE_LIMITED` + `Retry-After` **integer ≥ 1** · **key แยกจริง:** user เดียวกันคนละ org ไม่กวนกัน · คนละ user ใน org เดียวกันไม่กวนกัน · **โควตาที่หมดแล้วไม่ทำให้ `GET /orgs/{id}` (เส้นที่ไม่มี TIN) พังไปด้วย** · Redis ล่ม → fail-open + emit event (เหมือน I-29) |
| **I-40** ★7 | **`DELETE /orgs/{orgId}/membership` — ทุก role ออกเองได้ (AC-5.7):** Staff / Admin / Owner (ที่ไม่ใช่คนสุดท้าย) → `200` + body ตรงรูป `{ organizationId, status:"revoked", revokedAt, cancelledInvitations }` · **Staff ต้องผ่านทั้งที่ไม่มี `manage_members`** (นี่คือแก่นของ D-029 — ถ้าเคสนี้ได้ 403 = design ถูก implement ผิด) · DB: `status='revoked'`, `revokedAt` ไม่ null, **`revokedByUserId` = ตัวเอง** · **`403 FORBIDDEN` ต้องไม่เกิดบนเส้นนี้เลยไม่ว่าเงื่อนไขใด** (api-spec §3.17) |
| **I-41** ★4 | **Owner คนสุดท้ายออกเองไม่ได้:** org ที่มี Owner active 1 คน → Owner กด leave = **`409 LAST_OWNER`** และ **DB ไม่เปลี่ยนแม้แต่ field เดียว** (membership ยัง active, ไม่มี invitation ถูก cancel — พิสูจน์ว่า rollback ทั้ง tx ไม่ใช่แค่คืน status) · org ที่มี Owner 2 คน → คนแรก leave สำเร็จ, คนที่สอง leave = 409 · **Owner ที่มี org อื่นด้วย: leave org A แล้ว org B ไม่กระทบ** |
| **I-42** | **ผลข้างเคียงครบชุดของ leave (เทียบกับ I-19 ของ revoke ทีละข้อ):** (a) request ถัดไปของ org นั้น = **`403 ORG_ACCESS_DENIED` ที่ request ที่ 1** (b) org หายจาก `GET /me/organizations` (default) ทันที และโผล่ใน `?status=all` เป็นรูปย่อ (M-10) (c) **คำเชิญ `pending` ของ email ตัวเองใน org นี้กลายเป็น `cancelled` — อ่านจาก DB** และ `cancelledInvitations` = จำนวนจริง (d) **emit `org.member.left` และ *ไม่* emit `org.member.revoked`** (e) session ไม่ถูกทำลาย: ยัง `POST /auth/refresh`/login ได้ และ token เดิมยังใช้กับ org อื่นได้ (f) **คืนโควตา cap 50:** user ที่มี 50 org → leave 1 org → `POST /organizations` สำเร็จ (พิสูจน์ว่า cap นับเฉพาะ membership `active`) (g) กลับเข้ามาได้ต่อเมื่อถูกเชิญใหม่ *หลัง* `revokedAt` — คำเชิญที่ออกก่อน = `409 INVITATION_SUPERSEDED` (h) กด leave ซ้ำหลังออกไปแล้ว → `403 ORG_ACCESS_DENIED` (ไม่ใช่ 404/500) |
| **I-43** ★7 ★1 | **พิสูจน์ว่าเส้นนี้แตะคนอื่นไม่ได้ (confused deputy — เหตุผลหลักที่ D-029 เลือก endpoint แยก):** (a) **enumerate จาก route registry ว่าเส้นนี้ไม่มี path param ที่ระบุ user เลย** (ไม่ใช่แค่เชื่อเอกสาร) (b) ยัด `userId`/`membershipId`/`targetUserId` ใน **body** และ **query string** → ต้องถูกเพิกเฉยทั้งหมด: หลังยิง **membership ของคนอื่นทุกคนใน org ยัง `active` ครบ** (นับจาก DB ก่อน/หลัง) และคนที่ออกคือผู้เรียกเสมอ (c) ลอง path traversal/variant (`/orgs/{orgId}/membership/{otherUserId}`, trailing slash, `%2F`) → `404` route ไม่มีอยู่จริง ไม่ใช่ 200 (d) ส่ง `X-Organization-Id` ของ org B พร้อม path org A → **`422 ORG_MISMATCH`** และ **ไม่มี membership ใดถูกแตะทั้งสอง org** (e) Staff ของ org A ยิงเส้นนี้ที่ path ของ **org B** (ไม่ได้เป็นสมาชิก) → `403 ORG_ACCESS_DENIED` และ membership ใน B ไม่ขยับ |
| **I-44** | **`Role.key` ตามสัญญา (ux Q4 · data-model §5.2):** (a) org ที่เพิ่งสร้าง → `GET /orgs/{id}/roles` ได้ 3 แถว key = `owner`/`admin`/`staff` **เป๊ะ** + `isSystem` ตรงตาราง (b) **`roleKey` โผล่คู่ `roleName` ในทุก response ที่มี role** (`/me/organizations`, `POST /organizations`, `/members`, `/invitations`, `/invitations/preview`, `/invitations/accept`, `GET /orgs/{id}.myMembership`) (c) แถวที่ `key = null` (จำลอง custom role ของ F-003 ด้วยการ insert ตรง) → API คืน `"roleKey": null` ไม่ใช่ field หาย และ **ทุก endpoint ยังทำงานปกติ** (ไม่มีที่ไหน assume non-null) (d) `@@unique([organizationId, key])`: insert `key='owner'` ซ้ำใน org เดียว → DB error · **สอง org ต่างกันมี `key='owner'` ได้ทั้งคู่** · หลาย row `key = null` ใน org เดียวกันอยู่ร่วมกันได้ |
| **I-45** ★2 **(เทสต์ที่ grep gate ทำแทนไม่ได้)** | **`key` ต้องไม่มีอำนาจตัดสินสิทธิ์ — พิสูจน์เชิงพฤติกรรม:** seed org แล้ว **สลับค่า `key` ในDB**: role ของ Staff → `key='owner'` และ role ของ Owner → `key='staff'` (capabilities ไม่แตะ) → จากนั้นยิงชุด Owner-only ทั้งหมด (`PATCH members` ยกเป็น Owner · `DELETE members` ที่ target เป็น Owner · เชิญด้วย role Owner) → **Staff ยังได้ `403` ทุกเส้น และ Owner ยังทำได้ทุกเส้น** · เพิ่ม: ตั้ง `key=null` ให้ role Owner → สิทธิ์ต้องไม่เปลี่ยน (capabilities เท่านั้นที่ตัดสิน) · **เหตุผลที่ต้องมีทั้ง I-45 และ G-12:** grep จับได้แค่รูปแบบที่เดาไว้ (`role.key ===`) แต่จับ `ROLE_KEYS.includes(...)`/การส่ง key เข้า fn อื่นไม่ได้ ⇒ **grep = ชั้นเร็ว, I-45 = ชั้นที่พิสูจน์จริง** |

---

## §8 Concurrency matrix (★4 — int lane, ทุกเคส **20 รอบ** และ assert invariant ท้ายรอบ ไม่ใช่แค่ status code)

> **ข้อยกเว้นเดียวของ "20 รอบ" (amend #4):** **I-C-13** รัน **3 รอบ** เพราะแต่ละรอบต้องยึด lock ค้างจริงตามเวลา `lock_timeout`
> — การรัน 20 รอบไม่ได้เพิ่มความเชื่อมั่น แต่เพิ่มเวลาและโอกาส flake · ชั้นที่บล็อก merge ของ NEW-4 คือ **U-API-21 (unit)**

| id | สองสิ่งที่ชนกัน | ผลที่ต้องได้ |
|---|---|---|
| **I-C-01** | ลด Owner A ‖ ถอด Owner B (org มี owner 2 คน) | สำเร็จ 1 · อีกอัน `409 LAST_OWNER` · **`COUNT(active owner) = 1` เสมอ** |
| **I-C-02** | accept ‖ accept (token เดียว) | membership **1 แถว** · สำเร็จ 1 · อีกอัน 409 (`ALREADY_ACCEPTED`/`ALREADY_MEMBER`) · invitation ไม่ค้าง `pending` |
| **I-C-03** | เชิญ email เดียวกัน ‖ 2 request | สำเร็จ 1 · อีกอัน `409 INVITATION_PENDING` (ไม่ใช่ 500 จาก unique violation) |
| **I-C-04** ใหม่ | **revoke ‖ accept** (คำเชิญค้างของคนที่กำลังถูกถอด) | ผลเดียวเท่านั้น: ถ้า revoke ชนะ → accept ได้ `409 INVITATION_SUPERSEDED`/`INVITATION_CANCELLED` · ถ้า accept ชนะ → revoke สำเร็จตามปกติและสุดท้าย **membership = `revoked`** · **ห้ามจบที่ "ทั้งถอดทั้งกลับเข้ามา"** |
| **I-C-05** ใหม่ | reissue ‖ accept ด้วย token เก่า | accept ด้วย token ก่อน rotate → `404 INVITATION_INVALID` · ไม่มีเคสที่ทั้งสอง token ใช้ได้พร้อมกัน |
| **I-C-06** ใหม่ | cancel ‖ accept | สำเร็จอย่างใดอย่างหนึ่ง · ไม่มี membership เกิดหลัง cancel commit |
| **I-C-07** ใหม่ | `PATCH` role ‖ `DELETE` บน target เดียวกัน | ทั้งคู่คว้า org lock → serialize · สถานะสุดท้ายสอดคล้อง (ไม่มีแถวที่ `status=revoked` แต่ `roleId` ถูกเปลี่ยนหลัง revoke โดยไม่ถูกบันทึก) |
| **I-C-08** ใหม่ | 2 request ยกคนละคนเป็น Owner | สำเร็จทั้งคู่ (ไม่ผิด invariant) · **owner count = 3** (ไม่มี lost update) |
| **I-C-09** ใหม่ | สร้าง org 2 request ขนาน ตอนอยู่ที่ 49 | ได้ ≤ 51 org · **ไม่มี 500** · เอกสาร §6.3 ยอมรับ overshoot 1 ใบ ⇒ เทสต์ยืนยันขอบเขตนี้ ไม่ใช่ยืนยันความแม่นระดับใบ |
| **I-C-10** ใหม่ | revoke ‖ revoke (target เดียวกัน) | 1 สำเร็จ (200) · อีกอัน **`404 NOT_FOUND` ไม่ใช่ 500** · `revokedAt` ถูกเขียนครั้งเดียว · **และห้ามมี deadlock (`40P01`) ปรากฏใน log ของ suite เลยแม้แต่ครั้งเดียว** (architecture §5.1 อ้างว่า "ลำดับคว้า lock เหมือนกันทุกเส้นทาง ⇒ ไม่มี deadlock" — I-C-10 คือเทสต์ที่ทำให้คำอ้างนั้นพิสูจน์ได้) |
| **I-C-11** ใหม่ (D-029) | **leave ‖ revoke** บนคนเดียวกัน (สมาชิกกดออกเอง พร้อมกับ Admin กดถอด) | สำเร็จ **1** · อีกอันได้ `404 NOT_FOUND` (ฝั่ง revoke) หรือ `403 ORG_ACCESS_DENIED` (ฝั่ง leave ที่มาทีหลัง) — **ไม่ใช่ 500** · membership `revoked` **ครั้งเดียว** (`revokedAt` เขียนครั้งเดียว) · **emit event ใบเดียว** — ห้ามได้ทั้ง `member.left` และ `member.revoked` สำหรับการถอดครั้งเดียวกัน (ถ้าได้ 2 ใบ = audit เท็จ) |
| **I-C-12** ใหม่ (D-029) | **leave ‖ leave** โดย Owner **2 คน** ที่เป็น Owner ทั้งหมดของ org | สำเร็จ **1** · อีกอัน `409 LAST_OWNER` · **`COUNT(active owner) = 1` เสมอ** — เคสนี้คือทางใหม่ที่ D-029 เปิดให้ org ล็อกตัวเองออกได้ถ้ากฎ lock ไม่ครอบ leave (`DELETE …/membership` ต้องคว้า anchor เดียวกับ `DELETE …/members/{userId}` — architecture §5.1) |
| **I-C-13** ★4 **ใหม่ amend #4 (NEW-4 · architecture §5.2)** | **lock ถูกยึดค้าง ‖ request ปกติของ org เดียวกัน** — ฝั่งเทสต์เปิด connection แยกแล้ว `BEGIN; SELECT … FROM "Organization" WHERE id=$1 FOR UPDATE; SELECT pg_sleep(N);` ค้างไว้ (N > `lockTimeoutMs`) แล้วยิง `PATCH /orgs/{A}/members/{u}` | **`409 CONFLICT` + `details.reason === "busy"` — ห้ามเป็น `500` และห้ามค้างเกิน `lockTimeoutMs` + margin (~3 s + 1 s)** · **assert เพิ่มที่สำคัญเท่ากับ status:** (ก) **ไม่มี `40P01`/`40001`/`55P03`/`P2028`/ชื่อ table หลุดใน body/`message`/`details` เลย** (ผู้เรียกได้แค่ "ลองใหม่") — คู่กับ U-API-21(ก) (ข) response ยังมี `traceId` ตามปกติ (I-06) (ค) **DB ไม่เปลี่ยนแม้แต่ field เดียว** (tx ที่ timeout ต้อง rollback ทั้งก้อน ไม่ใช่เขียนครึ่ง) (ง) **ไม่มี security event ออก** (การกระทำไม่เกิดขึ้นจริง ⇒ audit ต้องไม่บอกว่าเกิด) (จ) **เคสควบคุมที่ทำให้เทสต์นี้มีความหมาย: request ของ *org อื่น* ในเวลาเดียวกัน → `200` ตามปกติ** (พิสูจน์ว่า lock ไม่ข้าม tenant และ pool ไม่ตันทั้ง instance — คือแก่นของ NEW-4 ที่เป็น noisy-neighbour ไม่ใช่แค่ error mapping) (ฉ) **หลังปล่อย lock แล้ว request ถัดไปสำเร็จ** (ไม่มีสถานะค้าง) · **ข้อบังคับกันเทสต์งอแง:** ค่า timeout อ่านจาก `ORG_TX_TIMEOUTS` (ตั้งต่ำผ่าน env ในlane นี้ได้ — U-CFG-07(ง)) · รันแค่ **3 รอบ ไม่ใช่ 20** และ **อยู่ full tier ไม่ใช่ smoke** เพราะเป็นเคสที่ผูกกับเวลา — **ชั้นที่บล็อก merge จริงคือ U-API-21 (unit) ซึ่งพิสูจน์ *การแมป* โดยไม่พึ่งจังหวะ** |

**ข้อบังคับของ suite นี้:** ต้องยิงด้วย connection pool ที่มี ≥ จำนวน request ขนาน (ไม่งั้น "ขนาน" กลายเป็น serial ที่ระดับ pool แล้วเทสต์ผ่านแบบไม่มีความหมาย) · ห้ามใช้ `setTimeout` เพื่อ "จัดจังหวะ" — ใช้ `Promise.all` + assert invariant

**กติกาข้ามทุกเคส (เพิ่ม amend #3 — ผูกกับคำอ้างของ architecture §5.1):**
1. **ห้ามมี `500` โผล่ในทุกเคสของ suite นี้** (assert ที่ระดับ suite ไม่ใช่รายเคส) — 500 จาก race = บั๊ก ไม่ใช่ "ผลที่ยอมรับได้"
   · **รวมถึง I-C-13 ที่จงใจสร้างสภาวะแย่ง lock: ผลที่ถูกคือ `409` ไม่ใช่ `500`** (NEW-4)
2. **ห้ามมี deadlock `40P01` / serialization failure `40001` ใน log ของ suite** — ถ้ามีแม้ครั้งเดียว = แดง และเป็นสัญญาณว่า
   ลำดับการคว้า lock ไม่เหมือนกันทุกเส้นทางจริงตามที่ §5.1 อ้าง (ทางแก้เป็นของ @backend-api ไม่ใช่การ retry ในเทสต์)
   · **ข้อยกเว้นเดียวที่ amend #4 เพิ่ม (เขียนไว้ให้ชัดเพื่อไม่ให้กฎนี้ถูกผ่อนทั้งข้อทีหลัง):** **I-C-13 คาดหวัง `55P03 lock_not_available`
   ในlog ของ *server* ได้ 1 ครั้งต่อรอบ** เพราะเป็นสภาวะที่เทสต์สร้างขึ้นเอง — **แต่ `40P01`/`40001` ยังห้ามเด็ดขาดแม้ในเคสนี้**
   และ **ไม่ว่า SQLSTATE ใดก็ห้ามหลุดออก wire** (ห้ามอยู่ใน body/`message`/`details` — I-C-13(ก) + U-API-21(ก))
3. **ทุกเคสที่จบด้วย "สำเร็จ 1" ต้อง assert จำนวน security event ที่ออก = 1 ใบ** — race ที่ทำให้ audit เพี้ยนเป็นบั๊กที่ status code มองไม่เห็น
   · **และเคสที่จบด้วย `409` ทุกชนิด (รวม `busy`) ต้อง assert ว่า security event = 0 ใบ** — การกระทำที่ไม่เกิด ต้องไม่ทิ้งร่องรอยว่าเกิด

---

## §9 Regression pack — ทะเบียนเต็มของ finding ทั้ง 41 ข้อ (ห้ามย้อนกลับได้เงียบ ๆ)

> **เปลี่ยนสถานะใน amend #4:** ตารางนี้เดิมลิสต์เฉพาะข้อที่ผมเลือกมา (18 แถว) ⇒ **ไม่มีใครรู้ว่าข้อที่เหลือมีเทสต์หรือไม่**
> — ซึ่งเป็นรูปเดียวกับที่ delta review จับ NEW-1 ได้ (finding ที่ "ปิดแล้ว" แต่ปิดไม่ครบ) · ต่อจากนี้ตารางนี้
> **ไล่ครบทั้ง 41 ข้อ (เดิม 29 + delta 12)** และ **ข้อที่ไม่มีเทสต์ต้องเขียนเหตุผลไว้ ไม่ปล่อยช่องว่าง**

### 9.0 finding เดิม 29 ข้อ (security-review §A–§D · สถานะจาก §H.1)

| finding | เทสต์ที่ pin ไว้ | tier |
|---|---|---|
| **C-1** Admin ยกตัวเองเป็น Owner | U-CD-02 · **I-23b** · **I-23g (call site = 5 เส้นครบ)** | smoke |
| **C-2** admin-reset ข้าม org | U-API-07(ข/จ) · **I-30(1)** | smoke |
| **C-3** query ตั้งต้นจาก model org-agnostic | U-DB-05 · I-35(a) · G-02 | smoke |
| **C-4** `passwordHash` ขึ้น wire | I-04 · G-02 (`include: { user:`) · **U-DB-11(ง)** | smoke |
| **I-1** accept คำเชิญที่ออกก่อนถูกถอด | U-CD-04 · **I-18a** · I-19c · I-C-04 | smoke |
| **I-2** ลืม `@RequireCapability` = รั่ว | **I-02 (รวม read)** · I-03 · U-API-05 (6 method) · G-13 | smoke |
| **I-3** org context บน route user-scoped | U-API-02 · **I-26** | smoke |
| **I-4** guard พึ่ง `req.user` | U-API-03 · U-API-04 (401 บน `@UserScoped` + token ปลอม) | smoke |
| **I-5** `ORG_ACCESS_DENIED` ≠ `FORBIDDEN` | U-API-15 · I-08 · I-21 | smoke |
| **I-6** token ใน query string | api มี `POST /invitations/preview` เท่านั้น (I-07 schema) · U-API-14 · I-05 · E-12 | full |
| **I-7** email binding ไม่มีฐานใน Phase 0 | ⚠️ **ปิดไม่ได้ใน F-002 (ไม่มี SMTP) — ทดสอบได้เฉพาะ compensating control ทั้ง 4:** U-CD-03 (TTL 24 ชม.) · U-CD-02 + I-23c (Owner-only ตอนเชิญ) · **I-15f/I-23f (Owner-only ตอน reissue — NEW-2)** · **I-17g (ธง forensic ไม่ถูกล้าง — NEW-9)** · **control จริง = email verification ที่ F-081** ⇒ ผมไม่ประกาศว่าข้อนี้ "ปิด" | full |
| **I-8** TIN เปิดให้สมาชิกทุกคน | **I-22d** · U-API-12(ก/ค) · I-04 (มิติ `taxId`) · I-38 | smoke |
| **I-9** accept แก้ role ของ membership active | U-API-10 · I-C-02 | smoke |
| **I-10** cap org/user fail-closed | I-11 · I-C-09 · I-42f | full |
| **M-1** `tenancy/` ใน allowlist + ขอบเขต | **U-API-13** (อ่านได้เฉพาะ `Membership`/`Role` ของคู่ที่ resolve · ห้ามเขียน) · G-01/G-02 | full |
| **M-2** count ต้องใช้ `tx` | U-API-09 (spy identity) · U-API-09b · **U-API-07(เงื่อนไข 1)** | full |
| **M-3** cap นับคำเชิญหมดอายุ | I-27 | full |
| **M-4** `logo` เป็น string อิสระ | **U-API-12(ฉ)** (`logo ≠ null` → 422) · I-07 (schema) | full |
| **M-5** env ใหม่ต้องเข้า zod | U-CFG-01..**07** | full |
| **M-6** role หายระหว่าง pending | **I-17f** (`INVITATION_ROLE_UNAVAILABLE`) · U-CD-04 (ลำดับความสำคัญ) | full |
| **M-7** security event ขาด/กำกวม | U-API-16 (union = 15 ค่า) · I-32 · **U-API-16 (`…blocked_owner_target` แยกใบ)** | full |
| **M-8** persona ของ leak kit | **I-01 (5 persona)** · G-06 (`invited` ไม่มี write path) | smoke |
| **M-9** `upsert`/extendedWhereUnique | U-DB-02 | smoke |
| **M-10** `status=all` คืนรูปย่อ | I-34 | full |
| **M-11** cache header / retention | I-05 (`no-store`/`Referrer-Policy` 2 ทาง) · **retention ของ email คำเชิญ = ไม่มีเทสต์โดยเจตนา** (F-002 ไม่มี job ลบ ⇒ forward-commitment PDPA — ทดสอบสิ่งที่ยังไม่มีไม่ได้) | full |
| **N-1** `ORG_MISMATCH` = 422 | U-API-15 · U-API-04 · I-43d | full |
| **N-2** lock อ่าน org จาก ctx | **U-DB-08(ข)** | full |
| **N-3** IPv6 /64 | U-API-06 | full |
| **N-4** สิทธิ์อ่าน member list | **I-21** · I-03 (Staff ยิง `GET /members` → 403) | smoke |

### 9.1 finding ใหม่ 12 ข้อจาก delta review (§H.2) — **ทุกข้อต้องมีเทสต์กันย้อนกลับ**

| finding | ระดับ | เทสต์ที่ pin ไว้ | tier |
|---|---|---|---|
| **NEW-1** admin-reset ยึดบัญชี Owner ใน org เดียวกัน | 🔴 Critical | **U-API-07(ฉ/ช/ซ)** + **I-30(2)** — **บังคับ red→green ทั้งสองชั้น** (รันกับโค้ดปัจจุบันของ `auth.service.ts` แล้วต้องแดง) | **smoke ถาวร** |
| **NEW-2** reissue ไม่ผ่าน `canAssignRole` | 🟠 Important | **I-15(f)** · **I-23(f)** · I-23(g) (นับ call site) · U-CD-02 | smoke |
| **NEW-3** fail-closed ไม่ครอบ read | 🟠 Important | **U-API-05 (ตาราง 6 method)** · **I-02 (แยกนับ read/mutating > 0)** · **I-03 (Staff ยิง read route)** · **G-13 ราย tier** · I-09(ข)(ค) | smoke |
| **NEW-4** ไม่มีนโยบาย tx/lock timeout | 🟡 Medium | **U-API-21 (แมป 4 ชนิด → 409, ไม่กลืนชนิดอื่น)** · **U-DB-08(ง)** · **U-CFG-07** · **I-C-13** (int, full) | smoke (unit) / full (int) |
| **NEW-5(ก)** TOCTOU นอก tx | 🟡 Medium | **U-API-07 เงื่อนไข (1)+(2)** — ทุก read ใช้ `tx` เดียวกัน + `FOR UPDATE` เป็นคำสั่งแรก + นับซ้ำหลังเขียน | smoke |
| **NEW-5(ข)** ไม่มี force-change password | 🟡 Medium | ❌ **ไม่มีเทสต์ — และผมไม่รับว่ามันปิดแล้ว:** ช่องนี้ *ยังเปิดอยู่จริง* (Admin ที่รีเซ็ตรหัสให้พนักงานวันนี้ยังรู้รหัสนั้นเมื่อพนักงานไปสังกัด org อื่นภายหลัง) ⇒ **ไม่มีพฤติกรรมที่ถูกต้องให้ assert** · สิ่งที่ผมทำแทน: บันทึกเป็น **ความเสี่ยงที่รับไว้อย่างเปิดเผย (§19.3 ข้อ 4)** + ผูกกับ forward-commitment F-081 · **เงื่อนไขของผม:** F-081 ต้องมีเทสต์ "หลัง admin-reset ต้องบังคับเปลี่ยนรหัส" ตอนนั้น ไม่ใช่ตอนนี้ | — |
| **NEW-6** data-model §3.3 ขัด api-spec (TIN) | 🟡 Medium | เป็น **doc drift** ⇒ เทสต์ที่กันผลของมันคือ **U-API-12(ก/ค)** · **I-22d** · **I-04** · **G-14** (implementer ที่ทำตามเอกสารเก่าจะแดงทันที) — ผมไม่มีเทสต์ที่อ่านเอกสาร แต่มีเทสต์ที่ทำให้ "โค้ดตามเอกสารที่ผิด" ผ่านไม่ได้ | smoke |
| **NEW-7** `traceId` ไม่ pin รูปแบบ | 🔵 Minor | **U-API-20 (UUID v4 + ไม่ monotonic + server-issued)** · I-06 | smoke |
| **NEW-8** C-3 ไม่ครอบ nested read "ลงกลับ" | 🔵 Minor | **I-35(b)(c)** · **U-DB-11** · G-02 (`select: { user:` ที่ไม่ใช่ `USER_SELECT`) · I-09(ช) | smoke |
| **NEW-9** rotate ล้างธง forensic | 🔵 Minor | **I-17(g)** (เทียบกับ `Invitation.createdAt` · มี red→green) · I-18c (ไม่ทับกัน) | full |
| **NEW-10** `canAssignRole` ไม่กัน privilege-superset | 🔵 Minor | ⚠️ **ทดสอบไม่ได้ใน F-002 โดยธรรมชาติ** — role คงที่ 3 ตัว ไม่มี role CRUD ⇒ ไม่มีพื้นผิวให้ยิง · **สิ่งที่ผมทำแทน = tripwire ไม่ใช่คำสัญญา: G-15** (route/service ใดที่เปิดให้เขียน `Role.capabilities` โผล่ขึ้นมาเมื่อไหร่ = CI แดง จนกว่าจะมีกฎ privilege-superset + เทสต์ของมัน) ⇒ F-003 จะ *ถูกบังคับ* ให้ทำ ไม่ใช่ *ควรจะ* ทำ | full |
| **NEW-11** reveal เปิดถึง Admin (ยืนยันตามเดิม) | 🔵 Minor | **I-38(a2)** — pin ว่า Admin ได้ `200` **โดยเจตนาตาม D-030(2)** พร้อมตัวคุมครบ (event + header + rate limit) ⇒ การเปลี่ยนทิศทางใดทิศทางหนึ่งต้องแก้เทสต์ + มี D-XXX | smoke |
| **NEW-12** dangling ref `§20` ในไฟล์นี้ | ⚪ Nit | ✅ **แก้แล้วในรอบนี้** — §20 มีอยู่จริงตั้งแต่ amend #3 (ตอนที่ reviewer อ่าน ไฟล์ยังไม่มี) และ **§21 ที่หัวไฟล์อ้างถึงถูกสร้างในรอบนี้** · **ไม่มีเทสต์ (เป็นเอกสาร)** — ชั้นที่กันจริงคือ link/anchor check ของ docs lane ซึ่ง**ยังไม่มีในโปรเจกต์** ⇒ ผมขึ้นทะเบียนเป็นข้อเสนอเล็ก ๆ ให้ @devops (§19.1 ข้อ 12) ไม่ใช่เงื่อนไขของ verdict F-002 | — |

### 9.2 ของที่ pin เพิ่มจากการตัดสิน (ไม่ใช่ finding แต่ห้ามถอยเหมือนกัน)

| เรื่อง | เทสต์ที่ pin ไว้ | tier |
|---|---|---|
| **ux Q13** Staff ไม่ได้แม้แต่ `taxIdMasked` | **I-22d** · U-API-12(ค) · I-04 | smoke |
| **§3.16** TIN เต็มออกทางเส้นเดียว + มี event | **I-04 (`TAX_ID_RESPONSE_ALLOWLIST` = 1 เส้น)** · I-38 | smoke |
| **D-029** leave ต้องแตะได้แค่ตัวเอง | **I-43** · U-API-18 | smoke |
| **D-029** Owner คนสุดท้ายออกเองไม่ได้ | I-41 · I-C-12 | smoke |
| **ux Q4** `key` ห้ามตัดสินสิทธิ์ | **I-45** · G-12 | smoke |
| **Q12** `traceId` ทุก error | I-06 · U-API-20 · **R-01** | smoke |
| **§5.1** lock + re-validate ครบ 7 operation | U-API-09 · U-API-09b · I-C-04..07 | smoke |
| **§5.2** timeout/deadlock → `409` ไม่ใช่ 500 | **U-API-21** · U-DB-08(ง) · I-C-13 | smoke (unit) |

### 9.3 Regression ของเทสต์ที่ *มีอยู่แล้ว* และต้องถูกแก้ (ไม่ใช่เทสต์ใหม่)

| id | ไฟล์ | ต้องทำอะไร |
|---|---|---|
| **R-01** ★6 | **`apps/api/src/common/domain-exception.filter.test.ts`** | **3 เคสที่ปัจจุบัน assert ว่า "ไม่มี `traceId`" เมื่อไม่มี correlation id ต้องกลับด้าน** → assert ว่า **มี** `traceId` ที่ server ออกเองเสมอ · **กติกาที่ผมบังคับ:** (ก) แก้ **ในคอมมิตเดียวกับโค้ด** (ห้ามลบเคสทิ้งแล้วค่อยเขียนใหม่ทีหลัง — เคสที่หายไประหว่างทาง = ช่องที่ไม่มีใครดู) (ข) **ห้าม `.skip`/ลบ** — การกลับด้านต้องเห็นใน diff ว่าเป็นการเปลี่ยน *ความคาดหวัง* อย่างตั้งใจ (ค) ต้องมีหลักฐาน **red→green**: รันเทสต์ที่กลับด้านแล้วกับโค้ดเดิม → แดง (ง) นับเป็น **ราคาที่ประกาศไว้ของ Q12** ไม่ใช่ "เทสต์เดิมพัง" — บันทึกไว้ให้ reviewer ไม่ตกใจ |
| **R-02** | เทสต์ใด ๆ ของ F-001 ที่เทียบ **error body ทั้งก้อน** (snapshot/`toEqual`) | ต้องปรับให้ผ่าน `stripVolatile()` ตัวเดียวกับ I-08 · **ห้ามแก้ด้วยการเปลี่ยนเป็น `toMatchObject` แบบหลวม ๆ** (จะกลืน field ที่งอกมาในอนาคต) · หา call site ด้วย grep ก่อนเริ่ม build แล้วรายงานจำนวนจริงใน PR |

---

## §10 Static / CI gate ที่ qa นับเป็นส่วนหนึ่งของ verdict

| id | gate | หมายเหตุ |
|---|---|---|
| **G-01** | depcruise ชุด `apps/api` (feature module ห้าม import `PrismaService`/`@omnistock/db` ตรง · `SYSTEM_PRISMA` เฉพาะ allowlist) | wiring = @devops · เกณฑ์ = @backend-api |
| **G-02** **(ขยาย amend #4 — NEW-8)** | grep gates: `SYSTEM_PRISMA` นอก allowlist · `$queryRaw` ใน feature module · `orgPrisma.<org-agnostic model>.` · `include: { user:` · `new PrismaClient(` · **ใหม่: `select: { user: {` / `include: { user:` ใน `apps/api/src/**` ที่ไม่ใช่ `user: USER_SELECT` = แดง** · **ใหม่: `$transaction(` ในเส้นทางที่แตะ `membership`/`invitation` ที่ไม่ได้ส่ง `{ timeout, maxWait }`= แดง** (NEW-4 · architecture §15 แถว 6b) | C-3/C-4/**NEW-8/NEW-4** · ⚠️ **ทั้งสองบรรทัดใหม่เป็นชั้นเร็วเท่านั้น** — ชั้นที่พิสูจน์จริงคือ U-DB-11/I-35 และ U-API-21/U-DB-08(ง) |
| **G-03** | `omnistock-purity-gate` (core-domain ใหม่ทั้งหมด) | กฎทอง 6 |
| **G-04** | `contracts-drift` + `oasdiff` — **ต้องไม่มี breaking change** (ถ้ามี = ผิดตามคำประกาศ api-spec §5) | D-025 |
| **G-05** **(ขยาย amend #4)** | **meta: ทุก gate ใน G-01..G-04, G-06, G-08 **และ G-12..G-15** ต้องมี fixture ที่ทำให้มันแดง** (แนวเดียวกับ `__purity_fixtures__` ที่มีอยู่) — gate ที่ไม่เคยแดง = gate ที่ไม่มีใครรู้ว่าทำงาน · **G-13 ต้องมี fixture 2 ตัว (mutating 1 · read 1)** เพราะการเทียบราย tier จะไร้ความหมายถ้าพิสูจน์ได้แค่ tier เดียว | เพิ่มจาก §12 · amend #4 |
| **G-06** | grep: **ไม่มี write path ไหนเขียน `status: "invited"`** (dead state — data-model §18) | |
| **G-07** | ไม่มี `echo ok` / `--passWithNoTests` ในเวิร์กสเปซที่มีเทสต์แล้ว · ไม่มี `.skip`/`.only` ค้างใน diff (D-014) | |
| **G-08** | diff ของ F-002 ไม่แตะไฟล์ ledger/`StockMovement`/คอลัมน์เงิน | แทนที่ข้อกำหนด money-stock ที่ไม่ applicable |
| **G-09** | ไม่มี dependency/โค้ดส่ง email (SMTP/mailer) ใน F-002 (D-012) | |
| **G-10** | contract ของ `/auth/*` ไม่เปลี่ยน (`oasdiff` + snapshot ของ `POST /auth/signup`) | AC-4.2 |
| **G-11** | ไม่มีการ normalize email ด้วยมือใน F-002 (ต้องเรียก `normalizeEmail` เดิม) | AC-3.7 |
| **G-12** ใหม่ | **grep gate ที่ backend ขอ (ux Q4 · data-model §5.2):** ห้ามใช้ `key`/`roleKey` ในเส้นทางตัดสินสิทธิ์ — จับรูปแบบ: `role.key ===`/`!==`/`==` · `roleKey ===` · `key === "owner"\|"admin"\|"staff"` (และ `'…'`/backtick) · `[...].includes(role.key)` · `switch (roleKey)` · ครอบ **`apps/api` + `apps/web` + `apps/mobile` (Dart)** · **allowlist มีได้เฉพาะชั้น presentation** (ไฟล์ i18n/label map) และต้องระบุเป็นรายไฟล์ · **มี fixture ที่ทำให้ gate แดงจริง (G-05)** · ⚠️ gate นี้ **ไม่พอเดี่ยว ๆ** — คู่บังคับคือ **I-45** ที่พิสูจน์เชิงพฤติกรรม |
| **G-13** **(เขียนใหม่ amend #4 — NEW-3: เทียบ *ราย tier* ไม่ใช่ก้อนเดียว)** | **`@AnyActiveMember()` allowlist ราย tier:** route ที่ประกาศ `@AnyActiveMember()` ต้องอยู่ใน **`ANY_ACTIVE_MEMBER_ROUTES` ที่ import จาก production** (architecture §3.1/§12.2 ข้อ 7) และเทียบ **แยก 2 ลิสต์**: **`mutating` = `DELETE /orgs/{orgId}/membership` (1 เส้น)** · **`read` = `GET /orgs/{orgId}` + `GET /orgs/{orgId}/roles` (2 เส้น)** · **4 assertion (ไม่ใช่แค่ตัวเลขรวม):** (ก) สมาชิกของแต่ละ tier **ตรงเป๊ะรายเส้น** (set equality กับสิ่งที่ registry enumerate ได้ ไม่ใช่แค่ `length`) (ข) **ขนาดของแต่ละ tier ถูก pin แยกกัน (1 · 2)** — ⚠️ นี่คือเหตุผลที่ต้องแยก: ถ้าเทียบรวม "3 เส้น" การเพิ่ม read route ที่อ่อนที่สุดจะถูกกลบด้วยการลด mutating ไป 1 เส้น (ค) **tier ต้องตรงกับ HTTP method จริงจาก route registry** — เส้น `POST/PATCH/PUT/DELETE` ที่ไปนั่งในลิสต์ `read` = **แดง** (กันการลักไก่เอา mutating route ไปซ่อนในโควตาที่หลวมกว่า) (ง) route ใหม่ที่ใส่ decorator นี้โดยไม่แก้ลิสต์ = **แดงทั้งสอง tier** · มี fixture ที่ทำให้แดงจริงทั้ง 2 tier (G-05 · I-09ค) | คู่กับ I-02 — กันไม่ให้ชั้นที่อ่อนที่สุดกลายเป็นทางลัดของคนที่รีบ · **แก้ความขัดกันระหว่างร่างเดิมของ G-13 (1 เส้น) กับ architecture §3.1 ที่สั่งให้ read mark `@AnyActiveMember` — reviewer จับถูก (NEW-3)** |
| **G-14** ใหม่ | **grep: ไม่มี `taxId`/`tokenHash` ใน DTO/mapper ของ response นอก allowlist** (สแกน type ของ response DTO ที่ generate จาก contract) · และ **ไม่มีการ `console.log`/`logger.*` ที่รับ object ของ tax profile ทั้งก้อน** | ชั้นเร็วคู่กับ I-04/I-38g |
| **G-15** **ใหม่ amend #4 — tripwire ของ NEW-10** | **ห้าม F-002 มีเส้นทางที่เขียน `Role.capabilities` หรือสร้าง/แก้ role:** registry + grep — (ก) ไม่มี route ใน `ROUTE_CAPABILITIES` ที่ mutate `Role` (ข) ไม่มี `role.create(`/`role.update(`/`role.updateMany(`/`capabilities:` ที่เป็น write นอก `POST /organizations` (การ seed system role 3 ตัวตอนสร้าง org — allowlist รายไฟล์) · **เหตุผลที่ผมเพิ่ม gate นี้แทนที่จะปล่อยเป็น forward-commitment เฉย ๆ:** NEW-10 ("มอบ capability ที่ตัวเองไม่มี") **ทดสอบไม่ได้ใน F-002 เพราะไม่มีพื้นผิว** — แต่ถ้าใครเปิดพื้นผิวนั้นขึ้นมา (F-003 หรือใครก็ตามที่รีบ) **ต้องมีอะไรดังขึ้น** ไม่ใช่หวังว่าจะมีคนอ่าน forward-commitments · การปลด gate นี้ต้องมาพร้อมกฎ privilege-superset + เทสต์ของมัน (มี D-XXX) | NEW-10 · D-030 · **ต้องมี fixture ที่ทำให้แดงจริง (G-05)** |

---

## §11 Contract lane (ผลต่อ consumer)

- `pnpm gen:contracts` แล้ว **diff ต้องว่าง** ใน CI (`contracts-drift`)
- **error code registry ↔ api-spec §4 ตรงกัน 18 ตัว** (U-API-15) — เอกสารกับโค้ดเป็นแหล่งเดียวกัน · **amend #3 และ #4 ไม่เพิ่ม code ใหม่** (endpoint ใหม่ 2 เส้นใช้ code เดิม · `409 busy` ของ NEW-4 ใช้ `CONFLICT` เดิม + `details.reason` ที่เป็น field optional ในซองอยู่แล้ว) ⇒ **ตัวเลข 18 ไม่ขยับ — U-API-15 ต้อง assert = 18 เป๊ะ เพื่อให้การแอบเพิ่ม code ตอน implement lock timeout เป็นสีแดง** **แต่ U-API-15 ต้องเพิ่ม assertion ว่า `LAST_OWNER` ถูกใช้โดยเส้น leave ด้วย** (mapping code → route ไม่ใช่แค่ code → status)
- **`roleKey` lint ของ contract:** มี `roleName` ที่ไหน ต้องมี `roleKey` ที่นั่น — ทำเป็นเทสต์บน OpenAPI ที่ bundle แล้ว (U-API-19) ไม่ใช่ "กฎในใจตอน review"
- client ทั้งสองฝั่ง regen แล้ว build/test ผ่าน (TS + Dart)

### 11.1 ทะเบียน "สัญญาไม่เปลี่ยน แต่พฤติกรรมเปลี่ยน" — `oasdiff` เงียบทั้ง **6** รายการ ⇒ ต้องมีเทสต์ประกบและมีเจ้าของ

> **ขยายจาก 2 → 6 ใน amend #4** ให้ตรงกับ [architecture §15 ท้ายตาราง](architecture.md) · **กติกา: ทุกแถวต้องมี "เทสต์ที่เป็นหลักฐาน"
> ที่ยิงผ่าน wire จริง** — เพราะ `oasdiff`/`contracts-drift` มองไม่เห็นแถวเหล่านี้เลยแม้แต่แถวเดียว ⇒ **เทสต์คือสัญญาฉบับเดียวที่เหลือ**

| # | สิ่งที่เปลี่ยนจริง | เทสต์ที่เป็นหลักฐาน | tier | ถ้าไม่มี = เสียอะไร |
|---|---|---|---|---|
| 1 | `POST …/members/{userId}/reset-password` — target ที่เป็นสมาชิก active ของ org อื่นด้วย: **เคย `200` → เป็น `404`** (D-028/C-2) | **I-30(1)** (int, ยิงผ่าน HTTP + "รหัสเดิมยัง login ได้" + เคสควบคุม) · U-API-07(ข) (`user.update` ไม่ถูกเรียก) | **smoke ถาวร** | ไม่มีอะไรกันการ "แก้กลับให้ผ่าน" ในอนาคต — และ FE จะเจอ 404 ที่อธิบายไม่ได้โดยไม่มีเอกสารรองรับ |
| 2 | **error body ของ *ทุก* endpoint ในระบบ** มี `error.traceId` เพิ่ม (เดิมมีเฉพาะเมื่อ gateway ส่ง correlation id) ⇒ body ไม่ byte-identical กับของเดิม | **I-06** (ทุก status × ทุก route รวม `/auth/*`) · **U-API-20** (server ออกค่าเอง, ไม่รับจาก client, UUID v4) · **R-01** (กลับด้านเทสต์เดิม 3 เคส) · **R-02** (เทสต์ที่เทียบ body ทั้งก้อน) · **I-08** (นิยาม normalize) | **smoke ถาวร** | เทสต์เดิมของ F-001 จะแดงแบบไม่มีคำอธิบาย แล้วมีคนแก้ด้วยการทำให้ `traceId` optional จริง ๆ = Q12 ตายเงียบ |
| **3** *(ใหม่ — NEW-1/D-030)* | `POST …/members/{userId}/reset-password` — **Admin รีเซ็ตรหัสให้ Owner ใน org เดียวกัน: เคย `200` → เป็น `404`** · ไม่มี code/status ใหม่ ⇒ `oasdiff` เงียบสนิท | **I-30(2)** (int — 404 + รหัสเดิมของ Owner ยัง login ได้ + refresh token เดิมยังใช้ได้ + เคสควบคุม Owner→Owner = 200) · **U-API-07(ฉ/ช/ซ)** | **smoke ถาวร · red→green บังคับ** | **นี่คือ Critical ที่ delta review จับได้** — ถ้าไม่มีเทสต์ถาวร มันจะถูก "แก้กลับเพื่อความสะดวก" ตอนมีคนบ่นว่ารีเซ็ตรหัสให้เจ้าของร้านไม่ได้ และไม่มีอะไรดังขึ้นเลย |
| **4** *(ใหม่ — NEW-2)* | `POST …/invitations/{id}/link` — ผู้มี `manage_members` ที่ไม่มี `full_access` **เคยผ่านทุกใบ → `403` เมื่อคำเชิญเป็น role Owner** (`403` ประกาศไว้ที่ §3.12 แล้ว ⇒ ไม่มี status ใหม่) | **I-15(f)** (+ token เดิมยังใช้ได้ + ไม่ emit `link_reissued`) · **I-23(f)/(g)** | smoke | ประตู Owner ที่ทำสำเนากุญแจได้ไม่จำกัดจะเปิดกลับมาโดย `oasdiff` ไม่พูดอะไรเลย |
| **5** *(ใหม่ — NEW-9)* | `acceptedUserCreatedAfterInvite` — **เปลี่ยนนิยาม** (เทียบ `Invitation.createdAt` แทน `tokenIssuedAt`) ⇒ ชื่อ/ชนิด field เท่าเดิม แต่ธงเป็น `true` ในเคสที่มากกว่าเดิม | **I-17(g)** (ลำดับ T0 createdAt → T1 signup → T2 rotate → accept ⇒ `true`) + เคสกลับด้าน | full | compensating control ตัวสุดท้ายของ I-7 กลายเป็นธงที่โกหกได้ด้วยการกดปุ่มเดียว |
| **6** *(ใหม่ — NEW-4)* | ทุก endpoint ที่คว้า org lock **อาจคืน `409 CONFLICT` + `details.reason="busy"` ในสภาวะแย่ง lock (เดิมสภาวะนี้ = `500`)** · `409` ประกาศไว้ทุกเส้นในกลุ่มนี้แล้ว ⇒ ไม่มี status ใหม่ | **U-API-21** (แมป 4 ชนิด · ไม่กลืนชนิดอื่น · ไม่รั่ว SQLSTATE) · **I-C-13** (ของจริง + org อื่นยัง 200) · U-DB-08(ง) · U-CFG-07 | smoke (unit) / full (int) | client ที่ treat 409 = "ข้อมูลชนกัน ห้ามลองใหม่" จะแสดงข้อความผิดถาวร · และถ้าการแมปหาย เราจะกลับไปเป็น 500 ที่ผู้ใช้เห็นตอนระบบมีคนใช้เยอะพอดี |

> **ผลต่อ consumer ที่ต้องประกาศด้วยคน (PM/@release สื่อสาร):** client เดิม **ไม่พัง** (field เพิ่ม, schema ยัง optional)
> แต่ **เทสต์ฝั่ง client ที่ snapshot error body จะแดง** ⇒ FE/mobile ต้องรู้ล่วงหน้า ไม่ใช่เจอเองตอน CI แดง
> · **เพิ่ม amend #4:** แถว 3 กระทบ **การใช้งานจริงของ dogfood** (Admin ช่วยเจ้าของร้านรีเซ็ตรหัสไม่ได้อีก) และแถว 6 ต้องมี
> copy ของ client ที่แยก "ลองใหม่ได้" ออกจาก Conflict ปกติ ⇒ **ทั้งสองแถวเป็นงานสื่อสาร ไม่ใช่แค่งานเทสต์** (architecture §14 ผูก `apps/web|mobile/CLAUDE.md` ไว้แล้ว)

---

## §12 E2E + manual

### 12.1 E2E (Track 1)

| id | flow | assert หลัก |
|---|---|---|
| **E-01** | web: signup → สร้าง org → เข้าใช้งาน org ใหม่ | เข้า org ได้โดยไม่ต้องยิง `/me/organizations` ซ้ำ (api-spec Q5) |
| **E-02** | web: org switcher (user มี 2 org) | สลับแล้วข้อมูลเปลี่ยนตาม org · ไม่มีข้อมูลปนข้าม |
| **E-03** | web: เชิญสมาชิก → คัดลอกลิงก์ → เชิญซ้ำ → "ออกลิงก์ใหม่" | ลิงก์แสดงครั้งเดียว · dialog เตือนก่อน rotate · เมื่อเจอ `INVITATION_PENDING` มีปุ่ม "ออกลิงก์ใหม่"/"ยกเลิก" ตรงนั้น (ไม่ตัน) · แสดง `expiresAt` จริง (ไม่ hardcode 7 วัน) |
| **E-04** | web: ผู้ถูกเชิญที่มีบัญชีแล้วกดรับ | เข้าเป็นสมาชิก role ตามคำเชิญ |
| **E-05** | web: ผู้ถูกเชิญยังไม่มีบัญชี → preview → signup → accept | ถือ token ตลอด flow · สำเร็จ |
| **E-06** | web: ล็อกอินคนละ email แล้วกดรับ | ข้อความ "คำเชิญนี้ออกให้ `u***@…`" · **ไม่มี email เต็มบนหน้าจอหรือใน network response** |
| **E-07** | web: ถูกถอดกลางคัน (ยิง revoke จาก session อื่นระหว่างใช้งาน) | request ถัดไป 403 → พากลับหน้าเลือก org → switcher ไม่มี org นั้น |
| **E-08** | web: Staff กดปุ่ม/เข้า URL ที่ไม่มีสิทธิ์ | toast "ไม่มีสิทธิ์" + **อยู่หน้าเดิม** (ไม่ถูกเตะออก) — พิสูจน์ว่า client ไม่รวม 2 code เป็น handler เดียว (I-5) |
| **E-09** | web: กรอก TIN ผิด checksum แล้วแก้ให้ถูก | `fieldErrors.taxId` แสดงตรงช่อง · Staff เห็นเลข mask เท่านั้น |
| **E-10** | mobile (Flutter): สร้าง/สลับ org + ดูสมาชิก + ถูกถอดกลางคัน | พฤติกรรมเดียวกับ web ในส่วนที่ mobile รองรับ (AC-2.1) |
| **E-11** | **copy lint (static):** source ของ web+mobile ต้องไม่มีสตริง "คัดลอกลิงก์เดิม" หรือคำที่สื่อว่าลิงก์เดิมยังใช้ได้ | AC-3.4 (D-027) — เทสต์ถูกที่สุดที่บังคับ AC เชิงถ้อยคำได้ |
| **E-12** ★ | web: หน้า `/invite?token=` ถอด token ออกจาก URL ทันที + ไม่เก็บใน `localStorage`/`sessionStorage` | I-6ข (★-task ของ @frontend) |
| **E-13** ใหม่ (D-029) | web: **Staff กด "ออกจากร้านนี้"** → dialog ยืนยัน → ออกสำเร็จ → ถูกพากลับหน้าเลือกร้าน · switcher ไม่มีร้านนั้น · **เคสที่สอง: Owner คนสุดท้ายกดออก → เห็นข้อความของ `409 LAST_OWNER` ที่บอกทางออก (ตั้ง Owner คนใหม่ก่อน) ไม่ใช่ error ดิบ** | AC-5.7 · api-spec §3.17 |
| **E-14** ★ ใหม่ | web: หน้าโปรไฟล์ร้าน → กด **"แสดงเลขเต็ม"** → เห็น TIN → กด **"ซ่อนเลข"** → **ค่าถูกทิ้งจริง**: (ก) ไม่มีเลขเต็มใน DOM หลังกดซ่อน (ข) ไม่มีใน `localStorage`/`sessionStorage`/IndexedDB (ค) reload แล้วต้องกดขอใหม่ (ง) **network tab: `GET /orgs/{id}` ไม่เคยมีเลขเต็มเลย** (จ) Staff ไม่เห็นแม้แต่ปุ่ม และยิงตรงได้ 403 | §3.16 + ★-task ของ @frontend (architecture §13 ข้อ 19) |

### 12.2 Manual (ทำก่อนออก verdict)

- **M-01** copy ลิงก์จริงแล้วส่งผ่าน LINE บนมือถือจริง → เปิดแล้ว flow ต่อได้ (D-012 คือ flow หลักของ MVP — ห้ามพิสูจน์แค่ใน CI)
- **M-02** อ่านข้อความตอน admin-reset ล้มเหลว (404 ที่ไม่อธิบาย) แล้วประเมินว่า Owner ทำอะไรต่อได้ (C-2 ราคาที่ยอมจ่าย)
  · **เพิ่ม amend #4 (D-030/NEW-1 — ราคาที่หนักกว่าเดิมมาก):** ทดลองเคส **"Admin กดรีเซ็ตรหัสให้เจ้าของร้าน"** แล้วประเมินว่า
  ผู้ใช้เข้าใจไหมว่าเกิดอะไรขึ้น · และเคส **"เจ้าของร้านคนเดียวลืมรหัส"** — บันทึกตรง ๆ ว่า **Phase 0 ไม่มีทางกู้** (ต้องรอ F-081) ·
  **นี่คือ manual ที่ผมถือว่าสำคัญที่สุดของรอบนี้** เพราะเป็นราคาที่ user เคาะรับไว้ใน D-030 แต่ยังไม่มีใครเห็นของจริงบนจอ
  ⇒ ผลของ M-02 = ข้อมูลให้ @ux/@product ตัดสินเรื่อง copy **ก่อน** release ไม่ใช่หลังมีคนติดต่อมา
- **M-03** คำเชิญ role Owner/Admin แสดงว่า 24 ชม. ตรงกับ `expiresAt` จริง
- **M-04** ผู้เชิญเห็นว่าใครรับไปแล้วเมื่อไหร่ + ธง "บัญชีถูกสร้างหลังออกลิงก์" อ่านแล้วไม่กลายเป็นคำกล่าวหา (AC-3.9)
- **M-05** Thai copy ของ error 18 ตัวอ่านรู้เรื่องสำหรับ SME (คู่กับ skill `thai-ux`) · **เพิ่ม (D-029): ทุกข้อความใช้คำว่า "ร้าน" ไม่ใช่ "องค์กร"** — ไล่จอจริงทั้ง web+mobile ไม่ใช่ไล่แค่ไฟล์ i18n (ข้อความที่ hardcode ในคอมโพเนนต์คือที่ที่มันหลุด)
- **M-06** (ใหม่) **Owner คนสุดท้ายกดออกจากร้าน** — อ่านข้อความ `409 LAST_OWNER` แล้วรู้ไหมว่าต้องทำอะไรต่อ (ตั้ง Owner ใหม่ก่อน) · ประเมินว่าผู้ใช้จะตันไหม เพราะ **F-002 ไม่มี "ลบร้าน"** (architecture §13 ข้อ 17 — ราคาที่ประกาศไว้)
- **M-07** (ใหม่) **กด "แสดงเลขเต็ม" บนมือถือจริง** — เลขอ่านได้/คัดลอกได้ตามที่ ux ตั้งใจ และหลังกดซ่อนแล้วสลับแอปกลับมาไม่มีเลขค้างบนจอ (screenshot/app switcher preview)

---

## §13 Test data & fixtures

- **seed ขั้นต่ำของทุก int test: ≥ 2 org** (A, B) + user 6 คน: Owner A · Owner A คนที่สอง · Admin A · Staff A · สมาชิก org B · user ที่ไม่มี membership เลย + user ที่ `revoked` ใน A + user ที่ `invited` ใน A (dead state)
- **เพิ่ม amend #3:** (ก) org ที่มี **Owner active เพียง 1 คน** (สำหรับ I-41/I-C-12) และ org ที่มี **Owner 2 คน** (I-C-12) (ข) org ที่**ประกาศ tax profile แล้ว** + org ที่**ยังไม่ประกาศ** (I-38a/d) (ค) ความสามารถ **`seedRole({ key })` / แก้ `key` ของ role ที่มีอยู่** เพื่อทำ I-44(c)/I-45 (custom role `key=null` + สลับ key) — เขียนลง DB ตรง ๆ ผ่าน kit ได้ ไม่ต้องมี endpoint (ง) helper `stripVolatile(res)` (I-08/R-02) อยู่ใน kit กลางที่เดียว
- **เพิ่ม amend #4 (ของที่ 7 ข้อใหม่ต้องใช้ — ทั้งหมดอยู่ในkit ไม่มี test-only endpoint):**
  (ก) **org ที่ Owner สังกัดร้านนี้ร้านเดียว + มี Admin 1 คน** (I-30(2)/U-API-07ฉ — เคสของ NEW-1 คือเคส *ปกติ* ของ dogfood ไม่ใช่เคสประหลาด)
  (ข) **คำเชิญ role Owner ที่ค้าง `pending`** (`--scenario=high-role-invite`) สำหรับ I-15f/I-23f
  (ค) **helper ยึด lock ค้าง** สำหรับ I-C-13: เปิด connection แยกจาก pool ของแอป (`pg` client ตรง) แล้ว `BEGIN; SELECT … FOR UPDATE; pg_sleep(N)`
  — **ต้องอยู่ในkit ของเทสต์ ไม่ใช่ endpoint/flag ใน `src/`** และต้องมี `finally` ที่ `ROLLBACK` เสมอ (เทสต์ที่ทิ้ง lock ค้าง = ทำ suite ที่เหลือพังทั้งไฟล์)
  (ง) **ตั้ง `ORG_TX_TIMEOUTS` ต่ำผ่าน env เฉพาะไฟล์ของ I-C-13** (เช่น lock 300 ms / tx 800 ms) เพื่อให้เทสต์เร็วและไม่ผูกกับค่า production —
  ค่าจริง pin ที่ U-CFG-07 (แยก **นโยบาย** ออกจาก **พฤติกรรม** ตาม Q11)
  (จ) **ลำดับเวลาสำหรับ NEW-9:** ตั้ง `Invitation.createdAt` < `User.createdAt` < `tokenIssuedAt` ได้อิสระ (I-17g) — kit ต้องเขียน `User.createdAt` ลงแถวได้ด้วย
- **`PlanDefinition` ต้องถูก seed ก่อน int lane** — ไม่งั้น `POST /organizations` = 503 ทุกเคส ⇒ **CI job `integration-api` ต้องมีขั้น `prisma db seed`** (คำขอ §19)
- **fixture ที่ขอจาก @backend-api (ตอบ Q8):** `apps/api/test/f002-seed.kit.ts` — `seedOrg` · `seedMember({status, revokedAt})` · `seedInvitation({email, roleCaps, status, expiresAt, tokenIssuedAt})` → คืน `{ rawToken, tokenHash }`
  - **บังคับ:** `tokenHash` ต้องคำนวณด้วย **production fn** (`hashInvitationToken`) — ถ้า kit hash เอง เทสต์จะพิสูจน์ "kit กับ kit ตรงกัน" ไม่ใช่ระบบถูก
  - เวลา: เขียน `expiresAt`/`tokenIssuedAt`/`revokedAt` ลงแถวตรง ๆ · **ห้ามใช้ fake timer** (ไม่ครอบ `now()` ฝั่ง Postgres)
  - **ไม่เอา test-only endpoint** — endpoint ที่ ship ไปกับ production build = attack surface ใหม่ ขัดหลัก default-deny ของ F-002 เอง
- **isolation ระหว่างเทสต์:** ทุกไฟล์ int ใช้ prefix ของตัวเอง + ล้างข้อมูลใน `beforeEach` (รูปเดียวกับ `auth.e2e.int.test.ts`) — ห้ามพึ่งลำดับการรัน
- **env ใหม่ที่ int/E2E lane ต้องมี:** `INVITATION_TOKEN_SECRET` (≥32, ต่างจาก JWT ทั้งสอง) · `WEB_APP_BASE_URL` · `DEFAULT_ORG_PLAN_KEY` · (optional) `MAX_ORGS_PER_USER`, `ORG_RATE_LIMIT_*`

---

## §14 Perf smoke (full เท่านั้น — right-size ไม่ใช่ load test)

| id | สถานการณ์ | budget | หมายเหตุ |
|---|---|---|---|
| **P-01** | 1 org × **200 members** × 100 pending invites → `GET /members?limit=25` | p95 **< 200 ms** | ตาม architecture §10 |
| **P-02** | user ที่มี **50 org** → `GET /me/organizations` | p95 **< 150 ms** | |
| **P-03** | overhead ของ membership lookup ต่อ request (เทียบ route org-scoped กับ `@Public`) | **< 5 ms** | ยืนยันราคาของ "ไม่ cache" (§1.5) |
| **P-04** | `GET /invitations?limit=25` บน 100 ใบ | p95 < 200 ms | |

**กติกาการอ่านผล:** perf smoke รันบน CI runner ที่ผันผวน ⇒ ใช้เป็น **สัญญาณถดถอย** (เทียบกับ baseline ครั้งก่อน ±50%) ไม่ใช่ตัวเลขสัมบูรณ์ · เกิน budget = ต้องมีคำอธิบาย ไม่ใช่ retry จนผ่าน

---

## §15 Track 2 — agentic (scheduled, ไม่บล็อก merge)

persona: **เจ้าของร้าน SME ไทย ไม่สาย tech** (+ persona ที่สอง: พนักงานรายวันที่เป็น Staff) · คะแนน 1–5 ต่อ flow

1. **สร้าง org แรก + เชิญพนักงาน 1 คน** — เข้าใจไหมว่าต้อง copy ลิงก์ส่งเอง (ไม่มี email) หรือรอ email อยู่?
2. **"ออกลิงก์ใหม่"** — ผู้ใช้เข้าใจไหมว่าลิงก์เดิมตายทันที (คำเตือนแรงพอไหม) — **flow ที่คุ้มที่สุดใน Track 2** เพราะเป็นจุดที่ AC ยอมแหกความคาดหวังเดิมของผู้ใช้
3. **เชิญซ้ำคนเดิม** → เจอ `INVITATION_PENDING` → หาทางออกเจอเองไหม (D-027 บอกว่าห้ามตัน)
4. **ถูกถอดกลางคัน** — ผู้ใช้เข้าใจไหมว่าเกิดอะไรขึ้น หรือคิดว่าแอปพัง
5. **Staff เจอ 403** ในเมนูที่ยังมองเห็น — สับสนไหม (ผูกกับ Q13 ของ ux)
6. **กรอก TIN ผิด** — ข้อความ error พาไปแก้ได้ไหม (SME กรอกเลข 13 หลักจากกระดาษ)
7. **admin reset รหัสให้พนักงานที่อยู่หลาย org แล้วได้ 404** — ผู้ใช้ตันแค่ไหน (C-2 ราคาที่จ่าย) — ผลจาก flow นี้ = ข้อมูลให้ product ตัดสินว่าต้องมี copy เพิ่มไหม

---

## §16 Regression curation & flaky policy

- **smoke tier (รันทุก PR, เป้า < 5 นาที):** I-01 · I-02 · I-04 · I-08 · I-14 · I-19 · I-23b · I-26 · **I-30 (ทั้ง 2 ชุด)** · I-C-01 · I-C-02 · U-CD-02 · U-CD-04 · U-DB-02 · **U-API-07 (8 เคส)** · **+ amend #3: I-22d · I-38 · I-41 · I-43 · I-45 · I-C-12 · R-01** · **+ amend #4: I-15f · I-23f · I-35(b) · U-DB-11 · U-API-05 (แถว `GET`) · U-API-21 · U-CFG-07** — ทั้งหมดคือ "ถ้าอันนี้พัง = ข้อมูลรั่ว/สิทธิ์หลุด/ยึดบัญชี Owner/ล็อกตัวเองออกจากร้าน"
  - **ที่ *ไม่* เอาเข้า smoke (ตัดสินใจแล้ว ไม่ใช่ลืม):** I-39 (rate limit — ช้าและผูกกับ Redis) · I-44 (สัญญาเชิงรูป จับได้ที่ contract lane อยู่แล้ว) · I-42 (ยาว, ครอบด้วย I-19 ที่เป็นเส้นทางฝาแฝด) · I-C-11 · **I-C-13 (ผูกกับเวลา + ต้องยึด lock จริง ⇒ ราคาแพงและมีโอกาส flake สูงที่สุดในชุด — ชั้นที่บล็อก merge แทนคือ U-API-21 ซึ่งพิสูจน์ *การแมป* ได้โดยไม่ต้องแข่งจังหวะ)** · **I-17g (NEW-9 — ต้อง seed ลำดับเวลา 3 จุด, ช้า)** → ทั้งหมดอยู่ full tier
  - **หมายเหตุการจัดชั้นของ NEW-1:** ทั้ง **U-API-07** และ **I-30** อยู่ smoke **ถาวร** ตามเงื่อนไข Q16 + D-030 — **การย้ายออกจาก smoke หรือลบ ต้องมี D-XXX** (ไม่ใช่การตัดสินใจของคนที่กำลังทำ CI ให้เร็วขึ้น)
- **full tier (รันทุก PR ที่แตะ apps/api|packages/db|packages/core-domain + nightly):** ทุกอย่างที่เหลือ + perf smoke
- **เข้าห้ามพัก (permanent pack):** ทุกเทสต์ใน §9 — ห้ามลบแม้โค้ดที่มันคุ้มถูก refactor · การลบต้องมี D-XXX
- **flaky policy:** เทสต์ที่แดงสลับเขียว **ห้าม `.skip` เงียบ** — ต้อง (ก) เปิด defect (ข) mark `it.fails`/quarantine ที่มองเห็นในรายงาน (ค) มีเจ้าของ + เส้นตาย · **concurrency test ที่ flake มักแปลว่าโค้ดผิดจริง (M-2)** ไม่ใช่เทสต์งอแง — ห้ามลดรอบจาก 20 เพื่อให้ผ่าน
- **pruning:** เทสต์ที่ซ้ำกับ kit กลาง (เช่นเขียน cross-org ราย endpoint ซ้ำอีกรอบ) ให้ตัดออกและพึ่ง kit — ยกเว้นเคสที่ §9 pin ไว้

---

## §17 Quality gate — เกณฑ์ verdict ของ F-002 (qa เป็นเจ้าของ)

จะประกาศ **เขียว** ได้ต่อเมื่อครบทุกข้อ (ข้อใดไม่ครบ = แดง ไม่มีเขียวแบบมีเงื่อนไข):

1. AC **35** ข้อมีเทสต์ที่ **รันจริงและผ่าน** — 3 ข้อ partial มี ack แล้วจาก **D-029(4)** (§19.2) · AC-5.7 ต้องเขียวแบบ "เต็ม" ไม่มี partial
2. lane Track 1 ทั้งหมดเขียวบน **CI** (ไม่ใช่เครื่อง dev) · int lane พิสูจน์ว่าเปิดจริง (I-37)
3. **★1–★7 ครบทุก matrix** (แก้ตัวเลขใน amend #4 — ★7 self-service leave มีมาตั้งแต่ amend #3 แต่ข้อนี้ยังเขียน ★1–★6) · regression pack §9 ครบทุกแถว **ทั้ง 41 finding**
4. gate §10 ทั้งหมดเขียว **และ G-05 พิสูจน์ว่า gate แดงได้จริง**
5. `oasdiff` ไม่มี breaking change · `contracts-drift` ว่าง · client 2 ฝั่ง regen แล้ว build ผ่าน
6. manual §12.2 ทำครบและบันทึกผล
7. perf smoke อยู่ใน budget หรือมีคำอธิบายที่ยอมรับได้
8. ไม่มี test ถูก skip/ลด/ลบเพื่อให้ผ่าน · ★-task มีหลักฐาน red→green
9. defect ที่ค้างถูกจัดชั้น (blocker / non-blocker) และ **blocker = 0**
10. **(amend #3 · แก้ตัวเลขใน amend #4)** ทะเบียน §11.1 ครบทั้ง **6** รายการมีเทสต์ที่ผ่านจริง · **R-01/R-02 ถูกแก้ในคอมมิตเดียวกับโค้ด ไม่ใช่ถูก skip** · gate ใหม่ G-12/G-13/G-14/**G-15** เขียว **และมี fixture ที่ทำให้แดงได้จริง** (G-05 — **G-13 ต้องมี fixture ทั้ง 2 tier**)
11. **(amend #4)** เงื่อนไขที่ผมเพิ่มเป็นเกณฑ์ verdict ของรอบนี้:
    (ก) **§9 ครบทั้ง 41 finding** — ทุกข้อมีเทสต์ **หรือ** มีเหตุผลเป็นลายลักษณ์ในตาราง (ช่องว่าง = แดง)
    (ข) **NEW-1 มีหลักฐาน red→green ทั้ง unit (U-API-07 ฉ/ช/ซ) และ int (I-30(2))** — แดงจริงกับโค้ดก่อนแก้ทั้งคู่ ·
    ถ้ามีแค่ "เขียวหลังแก้" ผมถือว่า **ยังไม่มีหลักฐานว่าเทสต์จับของจริงได้** (บทเรียนตรงกับ NEW-1 เอง: กฎที่ดูเหมือนปิดแล้วแต่ปิดไม่ครบ)
    (ค) **fail-closed ของ capability ต้องพิสูจน์บน `GET`** — I-09(ข) ต้องทำให้ I-02 แดงจริง มิฉะนั้นถือว่า NEW-3 ยังไม่ถูกปิด
    (ง) **ไม่มี `500` และไม่มี SQLSTATE ดิบออก wire ในสภาวะแย่ง lock** (U-API-21 + I-C-13)
    (จ) **`USER_SELECT` พิสูจน์ได้ 3 ชั้น** (U-DB-11 + G-02 + I-09ช) ไม่ใช่ชั้นใดชั้นหนึ่ง
    (ฉ) **G-15 เขียวและมี fixture** — tripwire ของ NEW-10 ต้องทำงานจริง ไม่ใช่บรรทัดในเอกสาร

---

## §18 แย้ง/เพิ่มจาก architecture §12 (ผมเป็นเจ้าของ verdict เรื่อง "ทดสอบพอหรือยัง")

§12 ที่ backend ร่างไว้ **ครอบชั้น unit/int ได้ดีมาก** แต่ยังไม่พอสำหรับ verdict — 12 ข้อที่ผมเพิ่ม/แย้ง:

1. **ไม่มี E2E lane เลย** ทั้งที่ Gate E บังคับ และ US-4 เป็น flow ข้ามหน้า/ข้ามบัญชี → เพิ่ม §12 (E-01..E-12)
2. **ไม่มีเทสต์ของ security event** ทั้งที่ **AC-3.4 และ AC-4.5 บังคับว่า "ต้องบันทึกเหตุการณ์"** ⇒ ถ้าไม่ทดสอบ = AC สองข้อไม่มีหลักฐาน → เพิ่ม I-32 + U-API-16 (**และต้องขอ test sink จาก backend** §19)
3. **ไม่มี meta-test ว่า kit/gate ยิงจริง** — kit ที่ enumerate route ได้ 0 เส้นจะเขียวสนิท → เพิ่ม I-09 + G-05 (นี่คือข้อที่ผมถือว่าสำคัญที่สุดในรายการนี้)
4. **ไม่มี lane-enabled guard** — วันนี้ `*.int.test.ts` `describe.skip` เมื่อ env หาย และ `test:integration` = `vitest run int.test` ที่ไม่ match ไฟล์ก็ยังเขียว ⇒ **บทเรียน F-001 กำลังจะเกิดซ้ำ** → เพิ่ม I-37
5. **persona ขาดตัวที่ 5** — Staff ของ org A (สมาชิกจริงแต่ไม่มีสิทธิ์) เป็นตัวเดียวที่พิสูจน์ว่า `FORBIDDEN` ไม่ถูกกลืนกับ `ORG_ACCESS_DENIED` (I-5) → เพิ่มใน I-01
6. **ไม่มี header/PII assertion** สำหรับ `Cache-Control: no-store` / `Referrer-Policy` ทั้งที่ api-spec §1 สัญญาไว้ → เพิ่ม I-05
7. **ไม่มี traceId assertion** (ตอบ Q12) → เพิ่ม I-06
8. **ไม่มี schema validation ของ response** — `taxId` optional (I-8) เป็นสิ่งที่ FE จะพังถ้าผิด → เพิ่ม I-07
9. **`withOrgScope` matrix ไม่ครบ operation จริงของ Prisma** — §2.2 ไม่มี `findUniqueOrThrow`/`findFirstOrThrow`/`updateManyAndReturn` ⇒ **มีช่องที่ไม่มีใครบอกว่าถูกหรือผิด** → เพิ่ม U-DB-07 (enumeration) + คำขอแก้เอกสาร §19 ข้อ 1
10. **concurrency ขาด 7 เคส** (I-C-04..I-C-10) — โดยเฉพาะ revoke ‖ accept, reissue ‖ accept, PATCH ‖ DELETE ซึ่งเป็นคู่ที่ทั้งคู่แตะ invariant เดียวกัน
11. **ไม่มีเทสต์ migration/precondition และ partial unique index** ในตาราง lane (มีกระจายอยู่ใน data-model §3.1) → รวมเป็น I-12/I-13/I-31 ให้เป็นของที่มีเจ้าของ
12. **ไม่มีการทดสอบพฤติกรรม rate limit** (มีแค่ unit ของ IPv6 key) — 429/`Retry-After`/fail-open เป็นสิ่งที่ client ต้องพึ่ง → เพิ่ม I-29

**สิ่งที่ผมรับตามเดิมโดยไม่แก้:** โครง lane 4 ชั้น · เคส (ก)–(ญ) ของ int · matrix ของ pure fn ทั้งหมด (data-model §6 ละเอียดกว่าที่ผมจะเขียนเอง) · perf smoke ตาม §10

---

## §19 ความเสี่ยง, สิ่งที่ยังทดสอบไม่ได้ และคำขอ

### 19.1 ขอจาก @backend-api (ถ้าไม่มี = ทดสอบข้อที่ระบุไม่ได้จริง)

| # | คำขอ | ถ้าไม่มีจะเสียอะไร |
|---|---|---|
| 1 | **เติมแถวที่ขาดใน architecture §2.2** (`findUniqueOrThrow`, `findFirstOrThrow`, `updateManyAndReturn` และประกาศนโยบาย "operation ที่ไม่อยู่ในตาราง = throw") | U-DB-07 ไม่มีเกณฑ์ตัดสิน ⇒ มี operation ที่ไม่มีใครรู้ว่ารั่วหรือไม่ |
| 2 | **seed kit + CLI** (`f002-seed.kit.ts` + คำสั่งที่ E2E เรียกได้) ตาม §13 | สร้าง state "คำเชิญหมดอายุ"/"ออกก่อนถูกถอด" ไม่ได้ → AC-4.3/AC-4.5 ทดสอบไม่ได้ |
| 3 | **test sink ของ `SecurityEventsService`** (in-memory, อ่านได้จาก int test) | AC-3.4 / AC-4.5 ("ต้องบันทึกเหตุการณ์") ไม่มีหลักฐาน |
| 4 | **export ให้เทสต์ import ได้:** route/capability registry · `org-models.ts` · rate-limit defaults | เทสต์ต้องประกาศตารางซ้ำ = drift เงียบ (ตารางในเทสต์ถูก ตารางในโค้ดผิด) |
| 5 | **`traceId` ในทุก error response** (ตอบ Q12) | I-06 ทำไม่ได้ · bug report ไม่มีตัวผูกกับ log |
| 6 | (@devops คู่กัน) **CI job `integration-api`: เพิ่ม env ใหม่ 4 ตัว + ขั้น `prisma db seed`** | int lane ทั้งก้อน boot ไม่ขึ้น / `POST /organizations` = 503 ทุกเคส |
| **7** (ใหม่ amend #3) | **export `ORG_LOCK_REQUIRED_OPERATIONS`** — ลิสต์ service operation ที่ §5.1 บังคับให้ขึ้นต้น tx ด้วย `lockCurrentOrganization` | U-API-09 ต้อง enumerate ลิสต์เองในเทสต์ ⇒ operation ใหม่ที่ลืม lock จะไม่มีใครจับได้ (ลิสต์ในเทสต์ drift จากโค้ดเงียบ ๆ) |
| **8** (ใหม่) | **export `TAX_ID_RESPONSE_ALLOWLIST`** (backend รับไว้แล้วใน §6.2 ข้อ 4 — ขอย้ำว่าต้อง **แข็งเป็นรายการ endpoint** ไม่ใช่ regex) + **`ANY_ACTIVE_MEMBER_ROUTES`** (สำหรับ I-02/G-13) | I-04 มิติ `taxId` และ G-13 ทำไม่ได้จริง |
| **9** (ใหม่) | **seed kit ต้องสร้าง/แก้ `Role.key` ได้** (custom role `key=null` และการสลับ key) | I-44(c)/**I-45** ทำไม่ได้ ⇒ ข้อห้าม "ห้ามใช้ `key` ตัดสินสิทธิ์" เหลือแค่ grep ซึ่งเลี่ยงได้ |
| **10** (ใหม่) | **500-fixture ที่ตั้งใจ** (route/flag ที่ทำให้ handler โยน error ที่ไม่ใช่ `ApiFailure`) ใช้ได้เฉพาะใน test build | I-06 พิสูจน์ `traceId` บน **500** ไม่ได้ — ซึ่งเป็น status ที่ support ต้องใช้ traceId มากที่สุด |

> **สถานะข้อ 7–10 (amend #4):** @backend-api **รับครบทั้ง 4 ข้อ** พร้อมระบุที่มา/รูปแบบไว้ที่ [architecture §12.2 ข้อ 6–9](architecture.md)
> (`ORG_LOCK_REQUIRED_OPERATIONS` 7 รายการ · `TAX_ID_RESPONSE_ALLOWLIST` 1 เส้น + **`ANY_ACTIVE_MEMBER_ROUTES` = `{ mutating: [1], read: [2] }`** ·
> seed kit แก้ `Role.key` ได้ · 500-fixture ที่ compile เฉพาะโปรไฟล์ test) ⇒ **ปิดคำขอ 7–10** · ที่เหลือด้านล่างเป็นของใหม่ในรอบนี้

| # | คำขอ (ใหม่ amend #4) | ถ้าไม่มีจะเสียอะไร |
|---|---|---|
| **11** | **`ORG_TX_TIMEOUTS` ต้อง env-tunable จริงและ export จาก `@omnistock/config`** (architecture §15 แถว 8 รับแล้ว) + **`lockCurrentOrganization` ต้องอ่านค่าจากที่นั่น ไม่ใช่ค่าคงที่ในไฟล์** | U-CFG-07/U-DB-08(ง) กลายเป็นการ assert ตัวเลขที่ hardcode ทั้งสองฝั่ง (เทสต์ตรงกับโค้ดเพราะลอกกันมา) · และ **I-C-13 จะต้องรอ 3 วินาทีจริงทุกรอบ** = เคสที่คนจะ skip ภายในเดือนแรก |
| **12** (@devops · **ไม่บล็อก verdict F-002**) | **anchor/link check ของ `docs/**`** ใน CI (เช่น `lychee`/`markdown-link-check` โหมด internal-only) | NEW-12 (dangling ref `§20`) เป็น nit ที่ **มนุษย์จับได้ช้ากว่า CI มาก** — รอบนี้มี reviewer จับให้ รอบหน้าจะไม่มี · ผมเสนอเป็นงาน 1 ชั่วโมงของ docs lane ไม่ใช่เงื่อนไขของ F-002 |

### 19.2 ต้องให้ @product รับทราบก่อน sign-off Gate B (ไม่ใช่คำถามให้ผมตัดสิน)

> **สถานะหลัง D-029:** ข้อ 1–3 ด้านล่าง **ได้ ack แล้ว** ผ่าน **D-029(4)** (partial 3 ข้อเดิม ไม่บล็อก Gate B) ·
> เก็บข้อความไว้เพื่อไม่ให้เหตุผลหาย · **สิ่งเดียวที่เพิ่มมา = การนับ 34 → 35** (AC-5.7 จาก D-029(2)) ซึ่งเป็นการนับใหม่ ไม่ใช่เกณฑ์ใหม่

1. **AC-7.3** ("ยังไม่ประกาศ TIN → ใช้ได้เฉพาะ Sync tier / ออกเอกสารภาษีไม่ได้") — F-002 **ไม่ทำ tier gating** ตาม api-spec §3.5 และ Phase 0 ไม่มี endpoint ออกเอกสารให้ยิง ⇒ ผมทดสอบได้แค่ `taxProfileComplete` ถูกต้อง · ขอ ack ว่า AC ข้อนี้ **ปิดจริงที่ F-007** (ผมจะไม่ประกาศเขียวให้ข้อนี้ในฐานะ "บังคับใช้แล้ว")
2. **AC-1.2** สาขา "ลูกค้า → plan จาก license ที่ซื้อ" = F-080/F-082 · F-002 ทดสอบได้เฉพาะ dogfood/comp + fail-closed
3. **AC-5.4** "ชื่อสมาชิกที่ถูกถอดยังโผล่ในประวัติเก่า" — Phase 0 ยังไม่มี ledger/audit ที่แสดงชื่อคน ⇒ ทดสอบได้แค่ "แถวไม่ถูกลบ + ข้อมูลครบ" (F-005/F-011 จะปิดของจริง)
4. **E2E ระดับจอยังผูกกับ `ux-wireframe.md`** — selector/copy assertion ของ E-01..E-14 จะถูกเติมตอน Gate D · ถ้า ux เปลี่ยน flow จำนวน E2E จะเปลี่ยน แต่ AC coverage ไม่เปลี่ยน

### 19.3 ความเสี่ยงที่ผม **รับไว้อย่างเปิดเผย** (ทดสอบไม่ได้/ไม่คุ้มที่จะทดสอบใน Phase 0)

| # | ช่องที่ยังเปิด | ทำไมไม่ทดสอบ | ถ้าจะปิดต้องทำอะไร |
|---|---|---|---|
| 1 | **timing oracle** ของ I-08 (org ไม่มีจริง vs org คนอื่น อาจตอบไม่เท่ากันเชิงเวลา) | CI runner ผันผวนเกินกว่าจะแยกสัญญาณจาก noise ⇒ ได้เทสต์ flaky ที่คนจะ skip ภายในสองสัปดาห์ (แย่กว่าไม่มี) | วัดใน environment ที่คุมได้ + สถิติหลายพันครั้ง — เป็นงานของ security review รอบถัดไป ไม่ใช่ของ lane นี้ |
| 2 | **`Membership.status='invited'` เป็น dead state** — เราทดสอบว่า "ถูกปฏิเสธ" แต่ไม่มี write path จริงให้ยิง | ไม่มีโค้ดสร้างสถานะนี้ (G-06 กันการเกิดใหม่) | ถ้า F-003 เปิด write path เมื่อไหร่ ต้องกลับมาทำ matrix ใหม่ทั้งชุด |
| 3 | **การพิสูจน์ว่า `@frontend` ไม่ persist ค่า TIN** ครอบได้แค่ web (E-14) — ฝั่ง mobile ทดสอบได้แค่ระดับ manual (M-07) | Flutter integration test เข้าถึง storage/native ได้จำกัดใน Phase 0 | เพิ่ม lane ของ mobile storage assertion ตอนที่จอ tax profile ลง mobile จริง (ยังไม่มีใน F-002) |
| **4** *(ใหม่ amend #4 — NEW-5ข)* | **รหัสที่ Admin ตั้งให้พนักงานวันนี้ (ถูกกฎ, org เดียว) ยังใช้ได้เมื่อพนักงานคนนั้นไปสร้างร้านของตัวเอง/ถูกเชิญเข้าร้านอื่นภายหลัง** — ตัวกรองของ D-028/C-2 มองไม่เห็นอดีต | **ไม่ใช่ "ไม่คุ้มที่จะทดสอบ" แต่คือ "ไม่มีพฤติกรรมที่ถูกต้องให้ assert"** — ระบบ*ตั้งใจ*ไม่มี force-change-password ใน Phase 0 ⇒ เทสต์ที่เขียนตอนนี้จะเป็นการ pin ช่องโหว่ไว้ว่าถูกต้อง | **F-081**: "must change password on next login" หลัง admin-reset + self-serve reset · **เงื่อนไขของผมตอน F-081:** ต้องมีเทสต์ int ว่า "รหัสที่ admin ตั้ง ใช้ล็อกอินได้ครั้งเดียวแล้วถูกบังคับเปลี่ยน" — ผมจะไม่รับ F-081 ที่ไม่มีเคสนี้ |
| **5** *(ใหม่ amend #4 — NEW-10)* | **ผู้มี `manage_members` มอบ capability ที่ตัวเองไม่มีได้** เมื่อ F-003 เปิด custom role | F-002 ไม่มี role CRUD ⇒ **ไม่มีพื้นผิวให้ยิง** (เทสต์ที่เขียนตอนนี้จะทดสอบโค้ดที่ยังไม่มี) | **G-15 เป็น tripwire ที่ทำให้ช่องนี้เปิดเงียบไม่ได้** — ใครเปิดพื้นผิว role-write เมื่อไหร่ CI แดงทันที · กฎ privilege-superset + เทสต์ = ของ F-003 |

---

## ตอบ consult questions → @backend-api

> ตอบครบ 6 ข้อ (Q8–Q12, Q16) — lock contract ได้จากฝั่ง qa

**Q8 — test-only seeding fixture: ต้องการ ใช่ และ "seed helper ใน int-test kit" คือคำตอบที่ถูก แต่ยังไม่พอตามที่ร่าง**
- ✅ รับข้อเสนอ **seed helper ใน kit ไม่ใช่ endpoint** — test-only endpoint ที่ ship ไปกับ production build = attack surface ใหม่ และขัดหลัก default-deny ของ F-002 เอง (ผมไม่รับแม้จะ guard ด้วย env)
- **เพิ่ม 3 เงื่อนไข:** (ก) `tokenHash` ใน helper ต้องคำนวณด้วย **production fn** — ถ้า kit hash เอง I-14 จะพิสูจน์แค่ "kit ตรงกับ kit" (ข) helper ต้องเซ็ต `expiresAt`/`tokenIssuedAt`/`revokedAt` ได้อิสระ เพื่อสร้าง 3 สถานะที่ต่างกันของ I-1: `revokedAt > tokenIssuedAt` / `<` / `==` (ค) **ห้ามใช้ fake timer** เป็นทางแก้ — `now()` ฝั่ง Postgres ไม่ถูกครอบ
- **ยังไม่พอสำหรับ E2E:** Playwright/Flutter เรียก vitest kit ไม่ได้ ⇒ ขอเพิ่ม **CLI บาง ๆ** ที่เรียก kit เดียวกัน (`--scenario=expired-invite|superseded-invite|two-orgs|fifty-orgs`) เขียน state ลง test DB แล้วพิมพ์ id/token ออก stdout · 1 ไฟล์ ใช้ทั้ง E2E web และ mobile
- สถานะที่ต้องสร้างได้ครบ: membership `active|revoked|invited` × invitation `pending|accepted|cancelled|expired(derived)|superseded(สภาพ)` — ยืนยันว่า `invited` ต้องสร้างได้ **เพื่อพิสูจน์ว่ามันถูกปฏิเสธ** (dead state) แม้ไม่มี write path จริง

**Q9 — เคส concurrency ที่ขาด: ขาด 7 เคส**
- 3 เคสที่คุณจะเขียนอยู่แล้ว (owner คนสุดท้าย, accept ซ้ำ, invite ซ้ำ) + **revoke ‖ accept** ที่คุณเพิ่มมาเอง = **ถูกต้องและจำเป็น** (I-C-01..04)
- **เพิ่ม:** **I-C-05 reissue ‖ accept ด้วย token เก่า** (rotate = ต้องไม่มีช่วงที่ 2 token ใช้ได้พร้อมกัน — เป็นแก่นของ AC-3.4) · **I-C-06 cancel ‖ accept** · **I-C-07 `PATCH` role ‖ `DELETE`** บน target เดียวกัน (สองเส้นทางที่คว้า lock เดียวกัน — ถ้า lock ไม่ครอบ call site ใดจะโผล่ตรงนี้) · **I-C-08 ยกคนละคนเป็น Owner พร้อมกัน** (ตรวจ lost update ฝั่งเพิ่ม ไม่ใช่ฝั่งลด) · **I-C-09 สร้าง org ที่ขอบ cap 49** (ยืนยัน overshoot ≤ 1 ตามที่ §6.3 ยอมรับ และไม่ใช่ 500) · **I-C-10 revoke ‖ revoke**
- **กติกาที่ขอให้ยึดทุกเคส:** 20 รอบ · assert **invariant ท้ายรอบ** (เช่น `COUNT(active owner) ≥ 1`, membership 1 แถว) ไม่ใช่แค่ status code · pool ต้องมี connection ≥ จำนวน request ขนาน (ไม่งั้นขนานปลอม) · ห้าม `setTimeout` จัดจังหวะ

**Q10 — cross-org kit: อัตโนมัติจาก route registry (เห็นด้วยเต็มที่) · 3 อย่างที่เพิ่มมา "ถูกทั้งหมดแต่ยังขาด 5"**
- ✅ อัตโนมัติ — "เขียนราย endpoint" แพ้ตั้งแต่ต้นเพราะปัญหาที่เรากลัวคือ *การลืม* ไม่ใช่ *การเขียนผิด*
- ✅ (ก) 4 persona ถูก — **แต่ขอเพิ่มตัวที่ 5: Staff ของ org A** (สมาชิกจริง สิทธิ์ไม่พอ) เพราะเป็นตัวเดียวที่พิสูจน์ I-5 ว่า `FORBIDDEN` กับ `ORG_ACCESS_DENIED` ไม่ถูกกลืนกัน
- ✅ (ข) route-registry capability test ถูก — **ขอให้ enumerate route ของ F-001 ด้วย** (ทุก route ต้องถูกจัดชั้น org-scoped/`@UserScoped`/`@Public` อย่างชัดเจน; ไม่มีชั้น = แดง) และครอบ **read route** ด้วย ไม่ใช่แค่ mutating
- ✅ (ค) assertion `passwordHash`/`tokenHash` ถูก — ขอ allowlist ของ `token` เป็น **รายการ endpoint ที่ระบุชัด 2 เส้น** ไม่ใช่ regex
- **ขาด 5 อย่าง:** (ง) header assertion `Cache-Control: no-store` + `Referrer-Policy` (จ) `traceId` ทุก error (ฉ) org ไม่มีจริง vs org คนอื่น **ตรงกันทุก byte** (ช) validate response กับ OpenAPI schema (ซ) **meta-fixture ที่ทำให้ kit แดงจริง** — ถ้า kit enumerate ได้ 0 route มันจะเขียวสนิทและเราจะไม่มีทางรู้ (ข้อนี้ผมถือว่าสำคัญที่สุดในชุด)

**Q11 — env-tunable + เทสต์อ่านจาก config (เห็นด้วย) + ขอเพิ่ม 1 อย่าง**
- ✅ ไม่ล็อกค่านโยบายไว้ในเทสต์พฤติกรรม — int test ตั้งโควตาต่ำผ่าน env แล้วยิงไม่กี่ครั้ง (ไม่ต้องยิง 30 ครั้งจริง)
- **แต่ขอ test ที่ pin ค่า default** ไว้ 1 ตัวใน `packages/config` (U-CFG-06): เทียบ default ที่โหลดได้กับตาราง §8 ⇒ เปลี่ยนโควตาเงียบ ๆ = แดง และมีคนต้องอธิบายใน PR · แยกกันชัด: **นโยบาย = pin ที่ config · พฤติกรรม = อ่านจาก config**
- ขอให้ `Retry-After` เป็นวินาที > 0 เสมอ (client mobile คำนวณ backoff จากค่านี้)

**Q12 — ใช่ บังคับ `traceId` ทุก error**
- ทุก error response (401/403/404/409/415/422/429/500) ต้องมี `error.traceId` ที่ไม่ว่าง — kit assert ให้ (I-06)
- เงื่อนไข: (ก) ค่าไม่ซ้ำข้าม request (ข) **ไม่มี PII/ไม่บอกอะไรเกี่ยวกับ tenant** (ค) ปรากฏใน log บรรทัดเดียวกันเพื่อให้ QA/support ผูกได้
- ใน OpenAPI คงเป็น **optional** ต่อไปได้ (ไม่ breaking ต่อ client เดิม) — เราบังคับที่ **พฤติกรรม + test** ไม่ใช่ที่ schema

**Q16 — เอาทั้งคู่ (เห็นด้วยกับที่คุณเอน) + เพิ่ม 3 เงื่อนไข**
- unit (U-API-07) **4 เคสตาม §3.3 + เคสที่ 5: emit `auth.password.admin_reset_blocked_multi_org`** · ที่สำคัญคือ assert ว่า **`user.update` ไม่ถูกเรียก** (ไม่ใช่แค่ status 404 — 404 ได้จากหลายเหตุ)
- int (I-30) **บังคับ** เพราะนี่คือการ *ลดความสามารถ* ของ endpoint ที่ ship แล้วซึ่ง `oasdiff` มองไม่เห็น ⇒ ต้อง assert เพิ่มว่า **รหัสเดิมยังล็อกอินได้** (พิสูจน์ว่าไม่มีการเขียนทับจริง) และเคสควบคุม "target อยู่ org เดียว → ยังสำเร็จ" ต้องอยู่ด้วย ไม่งั้นเราอาจ pass ด้วยการทำ endpoint พังทั้งเส้น
- **3 เงื่อนไขเพิ่ม:** (ก) ทั้งคู่เข้า **smoke tier ถาวร** (§9) ห้ามลบโดยไม่มี D-XXX (ข) ★-task ต้องมีหลักฐาน **red→green** (รันกับโค้ดก่อนแก้แล้วแดงจริง) (ค) เพิ่มบรรทัดใน `docs/features/F-001-authentication.md` ตาม architecture §14 — ไม่งั้นคนอ่าน spec F-001 จะเข้าใจพฤติกรรมผิดและ "แก้กลับ" ให้ผ่านในอนาคต

---

## §20 คำตัดสินต่อข้อแย้งของ @backend-api (api-spec §6.3 — amend #3, 2026-07-28)

> ผมเป็นเจ้าของ verdict เรื่อง "ทดสอบพอหรือยัง" ⇒ ข้อแย้งทุกข้อถูก **ตัดสิน** ไม่ใช่รับอัตโนมัติ ·
> **สรุป: รับ 6/6 — แต่ 3 ข้อแรกรับ *แบบมีเงื่อนไข*** เพราะถ้ารับตามตัวอักษรล้วน ๆ เทสต์จะอ่อนลงกว่าเดิม

| # | ข้อแย้ง | คำตัดสิน | เงื่อนไข / สิ่งที่ผมไม่ยอมทิ้ง |
|---|---|---|---|
| **1** | I-08 "ตรงกันทุก byte" ชนกับ Q12 (`traceId` ต้องไม่ซ้ำ) ⇒ ขอเทียบหลังตัด `traceId` | **✅ รับ — คุณถูก** ข้อความเดิมของผมทำให้เทสต์แดงตลอดโดยที่ระบบถูก (เป็นความขัดแย้งที่ผมสร้างเองจาก Q12) | **แต่ห้ามเป็น "diff แบบข้าม key ที่ต่างกัน"** ⇒ ต้องใช้ `stripVolatile()` ที่มี **allowlist ปิด = `error.traceId` + header `X-Request-Id`/`Date` เท่านั้น** · ยังบังคับ 4 อย่างหลัง normalize: มี `traceId` **ทั้งสองฝั่ง** · ค่า **ต่างกัน** · `code/message/details/fieldErrors` เท่ากันทุกไบต์ · **จำนวน key ของ `error` เท่ากัน** (ไม่งั้น "ตัดของที่ต่าง" จะกลายเป็นเครื่องมือกลบ oracle) → **I-08 ฉบับแก้** · timing channel = ประกาศเป็นความเสี่ยงที่รับไว้ (§19.3) ไม่ใช่ช่องที่ปิดแล้ว |
| **2** | U-API-12 / I-22(d) อิงสมมติฐานเก่า "ผู้มีสิทธิ์เห็น `taxId` เต็มใน `GET /orgs/{id}`" ⇒ ย้ายไป §3.16 | **✅ รับ — สมมติฐานผมล้าสมัยจริง** (ux Q13 + §3.16 มาทีหลัง) และเพิ่มเคสของ reveal ครบตามที่ขอ (I-38/I-39/U-API-17/E-14) | **แต่ผมไม่ "ย้าย" — ผม *กลับด้าน*:** เคสเดิมยังอยู่ที่ `GET /orgs/{id}` โดยเปลี่ยนเป็น **negative assertion ว่าเส้นนั้นต้องไม่คืน `taxId` ให้ใครเลย แม้ผู้มี `manage_org_settings`** · เหตุผล: การลบเคสทิ้งแล้วไปเขียนที่เส้นใหม่ = ไม่มีอะไรกันการที่วันหนึ่งมีคน "เพิ่ม `taxId` กลับเข้า `GET /orgs/{id}` เพื่อความสะดวกของ FE" · **ของที่เคยรั่วได้ ต้องมีเทสต์เฝ้าที่จุดเดิมเสมอ** |
| **3** | I-04 ต้องเพิ่มมิติ `taxId` (allowlist เส้นเดียว) | **✅ รับเต็ม + ทำให้เข้มขึ้น** | allowlist ต้อง **import จาก production** (`TAX_ID_RESPONSE_ALLOWLIST`) · **assert ว่ามีสมาชิก = 1 เส้นพอดี** (การเพิ่มเส้นที่สองต้องทำให้เทสต์แดงก่อน ไม่ใช่ผ่านเงียบ) · สแกน **ค่า** TIN ของ fixture ทั้ง body แบบ nested ไม่ใช่แค่ key ชั้นบน · และ Staff ต้องไม่ได้แม้แต่ `taxIdMasked` (I-22d ฉบับแก้ — ตรงกับ ux Q13 ที่เข้มกว่า D-028) |
| **4** | เคสใหม่ของ D-029 (`DELETE …/membership`) | **✅ รับ + ขยาย** | ครบตามที่ขอ (I-40/I-41/I-42) **บวกของที่คุณไม่ได้ขอแต่จำเป็น:** **I-43** (พิสูจน์เชิงโครงสร้างว่าชี้ไปคนอื่นไม่ได้ — เพราะนี่คือเหตุผลที่คุณเลือกทำ endpoint แยก ⇒ ต้องมีเทสต์ที่ยืนยันเหตุผลนั้น ไม่ใช่เชื่อว่า "ไม่มี param ก็ปลอดภัยแล้ว") · **I-42(f) คืนโควตา cap 50** · **I-C-11 leave ‖ revoke** (event ต้องออกใบเดียว) · **I-C-12 Owner 2 คน leave พร้อมกัน** — D-029 เปิดทางใหม่ให้ org ล็อกตัวเองออกได้ถ้า leave ไม่คว้า anchor เดียวกัน |
| **5** | route-registry (I-02) ต้องรู้จัก `@AnyActiveMember()` ว่าเป็นการประกาศที่ถูกต้อง | **✅ รับ — แต่ไม่ให้เป็นทางลัด** | `@AnyActiveMember()` = ชั้นที่อ่อนที่สุดในระบบ default-deny ⇒ รับว่าเป็นการประกาศที่ถูกต้อง **แต่ต้องอยู่ใน allowlist ที่ pin ไว้** (วันนี้ 1 เส้น) · route ใหม่ที่ใส่ decorator นี้โดยไม่แก้ allowlist = **แดง** (I-02 + **G-13**) · ถ้าไม่ทำแบบนี้ เรากำลังเปลี่ยน "ลืมประกาศ = แดง" ให้กลายเป็น "ประกาศให้อ่อนที่สุด = เขียว" |
| **6** | F-001 regression: `domain-exception.filter.test.ts` 3 เคสต้องกลับด้าน | **✅ รับ — และผมจัดชั้นให้ชัดว่าเป็น *regression ที่ต้องแก้* ไม่ใช่เทสต์ใหม่** | ขึ้นทะเบียนเป็น **R-01 (§9.3 — เดิม §9.1 ก่อนที่ amend #4 จะขยาย §9 เป็นทะเบียนเต็ม)** พร้อมกติกา: แก้ในคอมมิตเดียวกับโค้ด · ห้าม `.skip`/ลบ · ต้องมีหลักฐาน red→green · **บวก R-02**: เทสต์ F-001 อื่นที่เทียบ error body ทั้งก้อนต้องถูกไล่ด้วย grep ก่อนเริ่ม build และรายงานจำนวนจริงใน PR (ห้ามแก้ด้วยการเปลี่ยนเป็น matcher หลวม ๆ) |

**สิ่งที่ผมขอเพิ่มจาก @backend-api เพื่อให้คำตัดสินข้างบนทำได้จริง:** §19.1 ข้อ **7–10**
(`ORG_LOCK_REQUIRED_OPERATIONS` · `TAX_ID_RESPONSE_ALLOWLIST`/`ANY_ACTIVE_MEMBER_ROUTES` · seed kit แก้ `Role.key` ได้ · 500-fixture)
— **4 ข้อนี้เป็น export/fixture ล้วน ไม่กระทบ contract ที่ LOCKED แล้วแม้แต่บรรทัดเดียว** · **รับครบทั้ง 4 แล้วใน amend #4** (architecture §12.2 ข้อ 6–9)

---

## §21 คำตัดสินต่อ 7 ข้อที่ @backend-api ส่งต่อหลัง delta review (api-spec §6.3 ข้อ 7 · architecture §13 ข้อ 21 — amend #4, 2026-07-28)

> ผมเป็นเจ้าของ verdict เรื่อง "ทดสอบพอหรือยัง" ⇒ ทุกข้อถูก **ตัดสิน** ไม่ใช่รับอัตโนมัติ ·
> **สรุป: รับ 7/7 — แต่ 5 ข้อรับ *แบบขยาย*** เพราะถ้ารับตามตัวอักษร เทสต์จะพิสูจน์ *status code* ได้ แต่พิสูจน์ *สิ่งที่ finding กลัวจริง ๆ* ไม่ได้ ·
> **ไม่มีข้อไหนที่ผมไม่รับ** — ทั้ง 7 ข้อเป็นการปิดช่องที่ผมเห็นด้วยว่ามีอยู่จริง

| # | สิ่งที่ backend ขอ | คำตัดสิน | สิ่งที่ผมเพิ่ม / ไม่ยอมทิ้ง |
|---|---|---|---|
| **1** | **G-13** เทียบ `ANY_ACTIVE_MEMBER_ROUTES` **ราย tier** (mutating 1 · read 2) | **✅ รับ + ขยาย** — และผมยอมรับว่า **ร่างเดิมของ G-13 (pin 1 เส้น) ขัดกับ architecture §3.1 จริง**; reviewer จับถูก | ไม่ใช่แค่ "นับแยก 2 ช่อง": ต้อง **set-equality รายเส้น** (ไม่ใช่ `length`) + **pin ขนาดแยก tier** + **ตรวจว่า tier ตรงกับ HTTP method จริง** (mutating route ที่ไปนั่งในลิสต์ `read` = แดง — ไม่งั้นการแยก tier จะกลายเป็นช่องซ่อนของที่หลวมกว่า) + **fixture 2 ตัว (G-05)** |
| **2** | **I-02** ต้องครอบ **read route** ด้วย | **✅ รับ + ขยาย** | การ "ลบตัวกรอง `method`" ออกจากเทสต์**พิสูจน์ไม่ได้ว่าอะไรถูกตรวจเพิ่ม** ⇒ บังคับ: **แยกนับ read/mutating แล้วยืนยันว่าทั้งสองกลุ่ม > 0** · รายงานจำนวน route ที่ตรวจใน output · **I-09 ต้องมี fixture ที่เป็น `GET` โดยเฉพาะ** · และเพิ่มชั้น runtime ที่ **U-API-05 (ตาราง 6 method)** + ชั้น persona ที่ **I-03 (Staff ยิง `GET /members`)** — 3 ชั้น เพราะ NEW-3 คือช่องที่ "ตรวจครบแต่ตรวจผิดชั้น" |
| **3** | **U-API-07 / I-30** เพิ่มเคส NEW-1 (Critical · red→green · smoke ถาวร) | **✅ รับเต็ม + ขยาย 2 เคส** | รับทั้ง (ฉ)(ช) ของ architecture §3.3 · **เพิ่ม (ซ) ของผมเอง: เส้นทางที่ถูกบล็อกต้องไม่เรียก `revokeAllForUser`/`clearAccount`** — 404 ที่ยัง "ล้าง session + ปลด backoff" ให้ Admin เตะ Owner ออกจากระบบซ้ำ ๆ ได้ = DoS ที่ status code มองไม่เห็น · **เพิ่มเงื่อนไข 404 byte-identical ทุกสาเหตุ** (multi-org / Owner-target / ไม่ใช่สมาชิก) มิฉะนั้นเราปิด Critical แล้วเปิด oracle ใหม่ว่า "คนนี้เป็น Owner" · **I-30(2) ต้อง assert รหัสใหม่ล็อกอิน*ไม่*ได้ด้วย** ไม่ใช่แค่รหัสเดิมยังได้ |
| **4** | **I-15/I-23** reissue ผ่าน `canAssignRole` (NEW-2) | **✅ รับ + ขยาย** | เพิ่มนอกเหนือจาก 403: **DB ต้องไม่ขยับเลย** (`tokenHash`/`tokenIssuedAt`/`expiresAt` เดิม) + **token เดิมยังใช้ได้จริง** — ถ้า rotate ก่อนแล้วค่อย 403 ผู้ใช้ที่ถูกบล็อกยัง **ฆ่าลิงก์ของ Owner ตัวจริงได้** (DoS) · ไม่ emit `link_reissued` · **เคสควบคุม 2 ตัว** (Owner reissue ใบ Owner = 200 · Admin reissue ใบ Staff = 200) · **+ I-23(g): นับ call site ของ `canAssignRole` = 5** เพราะ NEW-1 และ NEW-2 เกิดจากสาเหตุเดียวกันเป๊ะ (กฎถูก แต่ลืม call site) ⇒ ต้องมีเทสต์ที่จับ "call site ที่หก" ไม่ใช่ไล่แก้ทีละใบ · **ข้อเสนอ "reissue ใบหมดอายุ → 409" ที่ backend ไม่รับ — ผมเห็นด้วยและไม่เขียนเทสต์บังคับ 409** |
| **5** | **I-35** nested read "ลงกลับ" + `USER_SELECT` frozen (NEW-8) | **✅ รับ + ขยาย** | **ผมไม่รับ "ผ่านเพราะไม่มีใครเขียนโค้ดแบบนั้น"** ⇒ ต้องพิสูจน์ทางใดทางหนึ่ง: query แบบ `Membership → User → memberships` รันแล้วไม่ข้าม org **จริง** หรือ **เป็นไปไม่ได้เชิงโครงสร้าง** · เพิ่ม **U-DB-11**: frozen ทุกชั้น + **enumerate relation ของ `User` จาก DMMF** แล้ว intersection ต้องว่าง (relation ใหม่ในอนาคตถูกจับอัตโนมัติ) + ค่าคงที่ `{id,email,createdAt}` เป๊ะ · เพิ่มเคสคู่ `user.refreshTokens` · **บังคับ 3 ชั้น (U-DB-11 + G-02 + I-09ช)** ตามคำเตือนของ reviewer เองว่า grep หลบได้ด้วย alias |
| **6** | **§8** เพิ่มเคส lock timeout → `409 busy` (NEW-4) | **✅ รับ — แต่ย้ายน้ำหนักการพิสูจน์** | int เคสเดียว (**I-C-13**) **ไม่พอและอันตรายที่จะให้บล็อก merge** เพราะผูกกับเวลา/pool ⇒ **ชั้นที่บล็อก merge = U-API-21 (unit)** ที่พิสูจน์ *การแมป 4 ชนิด* โดยไม่แข่งจังหวะ · I-C-13 อยู่ **full tier รัน 3 รอบ** พร้อมเคสควบคุม **"org อื่นต้องยัง 200"** (แก่นของ NEW-4 คือ noisy neighbour ไม่ใช่แค่ error mapping) · **เพิ่มที่ backend ไม่ได้ขอแต่ต้องมี:** (ก) **ห้าม SQLSTATE/ชื่อ table/`prisma` หลุดออก wire** (ข) **ห้ามกลืน error ชนิดอื่นเป็น 409** — 409 ที่กว้างเกินไปจะซ่อนบั๊กจริงทั้งหมดไว้ใต้คำว่า "ลองใหม่" (ค) DB ไม่เปลี่ยน + ไม่มี event (ง) ไม่มี auto-retry ที่ server · **และผมแก้ความขัดกันในกฎของ §8 เอง:** กฎ "ห้ามมี SQLSTATE ผิดปกติใน log" เดิมจะทำให้ I-C-13 แดงตลอด ⇒ **ยกเว้น `55P03` เฉพาะ I-C-13 · `40P01`/`40001` ยังห้ามเด็ดขาดทุกเคส** |
| **7** | **U-CFG** pin `ORG_TX_TIMEOUTS` | **✅ รับเต็ม** (แนวเดียวกับ Q11: นโยบาย = pin · พฤติกรรม = อ่านจาก config) | **U-CFG-07**: pin 3 ค่า (3000/5000/2000) + **invariant `lockTimeout < txTimeout` ⇒ boot ไม่ขึ้น** (ไม่ใช่ warn — ถ้า lock timeout ยาวกว่า tx timeout เราจะได้ `P2028` ที่กำกวมแทน `55P03` ที่แมปได้ = เหตุผลทางเทคนิคของ §5.2 หายไปเงียบ ๆ) + env-tunable จริง (I-C-13 พึ่งข้อนี้) ⇒ **คำขอ §19.1 ข้อ 11** |

**ของแถมที่ผมทำเพิ่มในรอบนี้ (ไม่ได้ถูกขอ แต่มาจากการไล่ตรวจ §H ทั้งฉบับ):**

1. **NEW-9 → I-17(g)** — rotate ต้องล้างธง `acceptedUserCreatedAfterInvite` ไม่ได้ · backend แก้ที่ §7.6 แล้วแต่ **ไม่มีใครระบุเทสต์**
   และธงนี้คือ compensating control **ตัวสุดท้ายที่เหลือ** ของ I-7 หลัง NEW-2 ปิดทาง reissue ⇒ ถ้าธงโกหกได้ I-7 ไม่เหลืออะไรเลย (มี red→green)
2. **NEW-7 → U-API-20** — pin **UUID v4 + ไม่ monotonic** (ค่าที่เรียงลำดับได้บอกปริมาณทราฟฟิกและเดา traceId ของคนอื่นได้ — เทสต์เดิมของผมจับไม่ได้)
3. **NEW-10 → G-15 (gate ใหม่)** — แปลง forward-commitment ที่ "หวังว่าจะมีคนอ่าน" ให้เป็น **tripwire ที่ดังเอง** เมื่อมีใครเปิดพื้นผิว role-write
4. **NEW-11 → I-38(a2)** — pin ว่า **Admin อ่าน TIN เต็มได้โดยเจตนา (D-030 ข้อ 2)** พร้อมตัวคุมครบชุด ⇒ การเปลี่ยน**ทั้งสองทิศทาง**ต้องมี D-XXX
5. **§9 → ทะเบียนเต็ม 41 finding** — เดิมลิสต์เฉพาะที่ผมเลือกมา 18 ข้อ ⇒ **ไม่มีใครรู้ว่าอีก 11 ข้อมีเทสต์ไหม** ซึ่งเป็นรูปเดียวกับที่ทำให้ NEW-1 หลุดรอบที่แล้ว ·
   ผลของการไล่: เติมเทสต์ที่มีอยู่แล้วแต่ไม่ได้ผูก (M-1/M-5/M-6/M-7/M-8/M-11/N-2/N-4/I-8) · **พบช่องจริง 1 จุด: M-4 (`logo`) ไม่มีเทสต์ที่ไหนเลย → เพิ่ม U-API-12(ฉ)**
6. **§11.1 → 6 รายการ** — "สัญญาไม่เปลี่ยนแต่ความหมายเปลี่ยน" เพิ่มจาก 2 เป็น 6 ให้ตรง architecture §15 · ทุกแถวมีเจ้าของเทสต์ ห้ามกำพร้า

**ข้อที่ผม *ไม่* รับ (เพื่อความชัดเจน — ไม่มีในรอบนี้):** ไม่มี · **สิ่งที่ผมประกาศว่าปิดไม่ได้ในF-002 และไม่แสร้งว่าปิด:**
**I-7** (ไม่มี SMTP) · **NEW-5(ข)** (ไม่มี force-change password — §19.3 ข้อ 4) · **NEW-10** (ไม่มีพื้นผิว — §19.3 ข้อ 5, กันด้วย G-15) ·
**NEW-12** (เอกสาร — เสนอ link-check เป็นงานของ docs lane, §19.1 ข้อ 12)

**NEW-12 · สถานะ dangling reference:** ตรวจแล้ว — **`§20` มีอยู่จริงในไฟล์นี้ตั้งแต่ amend #3** (ตอน reviewer อ่าน mtime 06:29 ยังไม่มี ⇒
เขาเห็นสภาพจริงในขณะนั้น ไม่ใช่เข้าใจผิด) · ส่วนการอ้าง **`§21`** ที่หัวไฟล์ **ถูกทำให้เป็นจริงในรอบนี้ (หัวข้อนี้เอง)** ·
ไล่การอ้างอิงข้ามไฟล์ที่เหลือแล้ว: architecture §3.1 อ้าง "เงื่อนไขของ qa ที่ §20 ข้อ 5" → **ตรงกับ §20 แถว 5 จริง** ⇒ ไม่มี dangling ref เหลือ
