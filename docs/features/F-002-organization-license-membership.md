# F-002 Organization, License & Membership

> สถานะ: `gate1-approved` · Phase: 0 · ขึ้นกับ (depends on): F-001 · เจ้าของ: product
> **Platform:** both (จัดการเต็มบน web · มือถือ: สร้าง/สลับ org + จัดการสมาชิกพื้นฐาน) · **ขนาดงาน:** full
> **แก้หลัง sign-off:** US-3/US-4 ปรับตาม **D-012** (invite = copy link ใน MVP — ไม่มี email infra จนถึง F-081)
> **แก้รอบ Gate 2 (2026-07-27):** US-3/US-4/US-5 ปรับตาม **D-027** (hash-at-rest ทำให้ copy ลิงก์เดิมซ้ำไม่ได้ · revoke = ตัดสิทธิ์ที่ membership) ·
> US-3/US-5/US-6 เพิ่มข้อจำกัดตาม **D-028** (security review: Owner-only, invitation hardening, PDPA field-level) ·
> US-5 เพิ่ม "ออกจากร้านเอง" ตาม **D-029** · **UI ใช้คำว่า "ร้าน" แทน "องค์กร"** (D-029 — code/API ยังเป็น `organization`)

---

# ══ Gate 1 — Requirement ══

## 1. ภาพรวม (Overview)
- **ปัญหา/เป้าหมาย:** วางกล่อง tenant ของระบบ — ข้อมูลทุกอย่างสังกัด **Organization** หนึ่ง org = หนึ่ง license = หนึ่งหน่วยธุรกิจ (ถ้าทำบัญชี = หนึ่ง TIN) · ให้หลายคนทำงานในร้านเดียว และให้ 1 คนถือได้หลาย license
- **ผู้ใช้:** Owner (สร้าง/คุมสมาชิก/license), Admin (เชิญ/จัดการสมาชิก), ทุก role (เป็นสมาชิก)
- **คุณค่า:** เจ้าของเปิด workspace ของกองสต๊อกตัวเอง + เพิ่มทีมงาน + แยกข้อมูลขาดจากร้านอื่น · รองรับคนที่รันหลายธุรกิจ/หลายนิติบุคคลด้วยหลาย license

**กรอบ tenancy:**
```
1 License ─ binds ─► 1 Organization  (tenant boundary, ผูก entitlements F-007/F-082)
                          │
                          ├─ Membership: หลาย User + role/permission (F-002 + F-003)
                          └─ หลายร้าน marketplace + platform → ChannelAccount (F-020+)
```

## 2. User stories & Acceptance criteria

- **US-1:** ในฐานะผู้ใช้ ฉันต้องการ **สร้างองค์กร (license)** เพื่อเริ่มใช้ระบบ
  - [ ] AC: สร้าง org → ผู้สร้างเป็น **Owner** อัตโนมัติ + org ผูก `OrgEntitlement` หนึ่งชุดเสมอ (invariant — F-007)
  - [ ] AC: dogfood/internal org → ผูก comp plan (Full tier) ผ่าน back-office/seed · ลูกค้า → ผูก plan จาก license ที่ซื้อ (F-080/082) — ไม่แจก free อัตโนมัติให้ทุกคน
  - [ ] AC: org เริ่มที่ tier ตาม plan ที่ผูก · default warehouse 1 ตัว (Phase 0 = คลังเดียว)
  - [ ] AC: ข้อมูลทุกอย่างที่สร้างหลังจากนี้ผูก `organizationId` นี้

- **US-2:** ในฐานะผู้ใช้ที่ถือหลาย license ฉันต้องการ **สลับองค์กรที่กำลังทำงาน**
  - [ ] AC: ผู้ใช้เห็นรายการ org ที่ตนเป็นสมาชิก → เลือก active org ได้ (web + mobile)
  - [ ] AC: ข้อมูลที่เห็น/แก้ทั้งหมดเป็นของ active org เท่านั้น — ไม่ปนข้าม org
  - [ ] AC: เรียกข้อมูล org ที่ตนไม่ได้เป็นสมาชิก → 403

- **US-3:** ในฐานะ Owner/Admin ฉันต้องการ **เชิญสมาชิก**
  - [ ] AC: เชิญด้วย email + **บังคับเลือก role ตอนเชิญ** → Invitation สถานะ `pending` + วันหมดอายุ (เช่น 7 วัน)
  - [ ] AC (**D-012 — MVP ไม่มี email infra**): ระบบสร้าง **invite link** ให้ Owner/Admin **copy ส่งเอง**
        (LINE/แชต) — ไม่มีการส่ง email อัตโนมัติ (email = identifier ของคำเชิญ ไม่ใช่ช่องทางส่ง) ·
        ส่งอัตโนมัติ → F-081/SMTP (forward-commitments)
  - [ ] AC (**D-027**): ระบบแสดง invite link ให้ copy ได้ **ครั้งเดียวตอนสร้าง** — token ถูกเก็บเป็น **hash เท่านั้น**
        (D-018) จึงย้อนดู/copy ลิงก์เดิมซ้ำไม่ได้
  - [ ] AC (**D-027**): re-send = ปุ่ม **"ออกลิงก์ใหม่"** บนคำเชิญที่ค้าง → ได้ลิงก์ใหม่ + **ลิงก์เดิมใช้ไม่ได้ทันที**
        · UI ต้องเตือน/ยืนยันก่อน และ**ห้ามใช้คำว่า "คัดลอกลิงก์เดิม"** · email/role ไม่เปลี่ยน ·
        **อายุนับใหม่ 7 วัน**จากเวลาที่ออกลิงก์ · ทุกครั้งที่ออกลิงก์ใหม่ต้องบันทึกเหตุการณ์ (สืบเคสลิงก์หลุด)
  - [ ] AC: ยกเลิกคำเชิญที่ค้างได้ → ลิงก์ทุกใบของคำเชิญนั้นใช้ไม่ได้
  - [ ] AC: เชิญ email ที่เป็นสมาชิกอยู่แล้ว → ปฏิเสธ · มี pending invite อยู่ → แจ้งว่าค้าง (ไม่สร้างซ้ำ)
        **→ เสนอทางออกให้ "ออกลิงก์ใหม่" หรือ "ยกเลิก" ตรงนั้นเลย** (D-027 — ไม่ปล่อยผู้ใช้ตัน)
  - [ ] AC: email normalize (lowercase, trim) ก่อนเทียบ · invite token = ความลับ (สุ่มพอ, **เก็บแบบ hash เท่านั้น**,
        หมดอายุ, ผูกกับ email ที่เชิญ)
  - [ ] AC (**D-028**): เฉพาะ **Owner** เท่านั้นที่เชิญด้วย role `Owner` ได้ · คำเชิญที่ให้ role สูง (Owner/Admin)
        อายุสั้นลงเหลือ **24 ชม.**
  - [ ] AC (**D-028**): ⚠️ Phase 0 ระบบ**ยืนยัน email ไม่ได้** (ไม่มี SMTP จนถึง F-081) → การผูกคำเชิญกับ email
        เป็น defense-in-depth ไม่ใช่ control · ชดเชยด้วย: ผู้เชิญเห็นว่า**ใครรับไปแล้วเมื่อไหร่** + บันทึกว่า
        บัญชีที่รับถูกสร้างก่อนหรือหลังคำเชิญ

- **US-4:** ในฐานะผู้ถูกเชิญ ฉันต้องการ **ตอบรับคำเชิญ**
  - [ ] AC: มีบัญชีแล้ว → กดรับ → ได้ Membership ด้วย role ที่กำหนดทันที
  - [ ] AC: ยังไม่มีบัญชี → สมัครด้วย email เดียวกัน แล้วคำเชิญผูกให้อัตโนมัติ
  - [ ] AC: คำเชิญหมดอายุ/ถูกยกเลิกแล้วกดรับ → แจ้ง expired/invalid
  - [ ] AC (**D-027**): ล็อกอิน/สมัครด้วย email **คนละตัว**กับที่ถูกเชิญ แล้วกดรับ → แจ้งชัดว่า
        "คำเชิญนี้ออกให้ `u***@example.com` กรุณาเข้าสู่ระบบด้วยบัญชีนั้น" (ไม่เผย email เต็ม)
  - [ ] AC (**D-028**): เคยถูกถอดจาก org นี้ แล้วกดรับคำเชิญที่ออก**ก่อน**ถูกถอด → ปฏิเสธ
        (กลับเข้ามาได้ต้องถูกเชิญใหม่หลังถูกถอดเท่านั้น) · การกลับเข้ามาต้องบันทึกเป็นเหตุการณ์แยก

- **US-5:** ในฐานะ Owner/Admin ฉันต้องการ **จัดการ/ถอดสมาชิก**
  - [ ] AC (**D-027**): ถอดสมาชิก = Membership เป็น **`revoked`** (ไม่ลบ user) → **request ถัดไปของ org นี้ 403 ทันที**
        (ระบบตรวจสิทธิ์จาก membership สดทุก request — ไม่มีช่วงเวลา cache ที่ยังทำงานได้)
        · session/การล็อกอินของผู้ใช้**ไม่ถูกทำลาย** เพราะ session ไม่ผูกกับ org (auth เป็น org-agnostic)
  - [ ] AC (**D-027**): org ที่ถูกถอด **หายจากรายการ/org switcher ของผู้ใช้คนนั้นทันที** และระบบพากลับไปหน้าเลือก org
  - [ ] AC (**D-028**): ถอดสมาชิก → **ยกเลิกคำเชิญที่ค้างของ email นั้นใน org นี้อัตโนมัติ** (ในรายการเดียวกัน)
  - [ ] AC: ชื่อสมาชิกที่ถูกถอด **ยังโผล่ในประวัติเก่าได้** (ledger/audit ไม่พัง — กฎทอง 2)
  - [ ] AC: ดูรายชื่อสมาชิก + สถานะ (active/invited/revoked) + role
        — **(D-028)** รายชื่อสมาชิก + email = ต้องมีสิทธิ์ `manage_members` (PDPA: ไม่เปิดให้ทุกคนในองค์กร)
  - [ ] AC: สมาชิกที่ถูกถอด ยังล็อกอินได้และเห็น org อื่นที่ตนสังกัด
  - [ ] AC (**D-029** — ช่องที่ Gate 1 พลาด, ux จับได้): สมาชิก**ทุก role ออกจาก org ด้วยตัวเองได้**
        (ไม่ต้องมี `manage_members` — authz แยกจากการถอดคนอื่น) · ยังติดกฎ **Owner คนสุดท้ายออกไม่ได้**

- **US-6:** ในฐานะ Owner ฉันต้องการ **คุมความเป็นเจ้าของ**
  - [ ] AC: ต้องมี Owner ≥ 1 เสมอ — ถอด/ลดสิทธิ์ Owner คนสุดท้ายไม่ได้
  - [ ] AC: Owner ยกระดับสมาชิกอื่นเป็น Owner ได้ (มีได้หลาย Owner)
  - [ ] AC (**D-028** — ยืนยันเจตนา **Owner-only**): เฉพาะ Owner เท่านั้นที่ (ก) มอบ/เชิญด้วย role `Owner`
        (ข) เปลี่ยน role หรือถอด membership ที่**ปัจจุบันเป็น Owner** · Admin (`manage_members`) ทำกับสมาชิกที่ไม่ใช่
        Owner ได้ตามปกติ แต่ยกตัวเอง/ผู้อื่นเป็น Owner ไม่ได้ (กัน Admin ยึด org)

- **US-7:** ในฐานะ org ที่ต้องการทำบัญชี ฉันต้องการ **ประกาศนิติฐานะ (TIN)** เพื่อเปิด Full tier
  - [ ] AC: เปิด accounting → **บังคับ**กรอก tax profile: ประเภท (บุคคล/นิติบุคคล) + เลขผู้เสียภาษี 13 หลัก + จด VAT (bool) + รหัสสาขา (optional)
  - [ ] AC: 1 org มี tax profile **1 ชุดเท่านั้น** (1 TIN)
  - [ ] AC: ยังไม่ประกาศ TIN → ใช้ได้เฉพาะ Sync tier (ออกเอกสารภาษีไม่ได้)
  - [ ] AC (**D-028** — PDPA): **เลขผู้เสียภาษีเต็ม** เห็นได้เฉพาะผู้มีสิทธิ์ `manage_org_settings` ·
        สมาชิกอื่นเห็นแบบ mask (4 ตัวท้าย) หรือเห็นแค่สถานะว่าประกาศแล้ว/ยัง
        — เหตุผล: 13 หลักของ "บุคคลธรรมดา" = เลขบัตรประชาชนของเจ้าของ

> รายละเอียด VAT/เลขรันเอกสาร/config ภาษีลึก → F-004b · กลไก plan/tier → F-007/F-082 · enforce permission → F-003

## 3. ขอบเขต (Scope)

| อยู่ใน scope (In) | ไม่อยู่ใน scope (Out / ภายหลัง) |
|---|---|
| สร้าง org + ผูก entitlement, 1 user หลาย org, org switcher | ลบ org ถาวร / โอนขาดเจ้าของแบบเต็ม → productize |
| เชิญ/ตอบรับ/re-send/ยกเลิก/ถอน (revoke) สมาชิก — **invite ผ่าน copy link (D-012)** | **ส่ง email คำเชิญอัตโนมัติ → F-081/SMTP** · seat limit enforcement → F-082 |
| Owner ≥1 + ยกเป็น Owner ได้ | ทีม/แผนก/สาขาย่อยหลายชั้นใน org |
| ประกาศ tax profile (1 TIN) เพื่อเปิด Full tier | per-warehouse/per-channel scoped membership |
| tax profile optional (Sync tier ไม่ต้องมี) | หลาย TIN ใน org เดียว (ตัดสินแล้ว: คนละ license) |

## 4. Business rules & edge cases
- **กฎทอง 3:** ทุก query โดเมนกรอง `organizationId` — F-002 คือจุดกำเนิด org context
- **1 License = 1 Org** · ถ้าทำบัญชี = **1 Org = 1 TIN** (เคสหลายนิติบุคคล = หลาย license)
- **"หลายร้านค้า/หลาย platform"** ภายใน org = หลาย `ChannelAccount` → จัดการที่ F-020+ ไม่ใช่ F-002
- **หลาย warehouse** ต่อ org รองรับใน schema; **Phase 0 = default คลังเดียว** (multi-warehouse + TRANSFER → F-090) — ทุก warehouse อยู่ใต้ TIN เดียว
- **Deactivate ไม่ delete:** user/membership ที่เคยมี movement/เอกสาร ต้องคงไว้เป็นหลักฐาน
- Membership ถือ `roleId` (ราย org); user คนเดียวเป็น role ต่างกันต่อ org ได้ (logic = F-003)
- edge: user ถูก revoke ขณะใช้งาน → request ถัดไปของ org นั้น 403, พากลับไปเลือก org
- edge: Owner คนเดียวพยายามลดตัวเอง/ออก → บล็อกด้วยกฎ Owner-คนสุดท้าย
- edge: เปลี่ยน tier Full→Sync ทั้งที่มีเอกสารภาษีออกไปแล้ว → ดู F-007 (ไม่ลบข้อมูล) + F-080 (บล็อกถ้างวดค้าง)
- **(D-028) ผลย้อนกลับไปที่ F-001:** `admin reset password` เป็นการเขียนทับ credential **ระดับผู้ใช้ ไม่ใช่ระดับ org** —
  พอ F-002 ทำให้ "1 user หลาย org" เป็นจริง endpoint นี้จึงกลายเป็นช่องยึดบัญชีข้ามองค์กร →
  **ปฏิเสธการ reset เมื่อ target เป็นสมาชิก active ของ org อื่นด้วย** (คืน 404 รูปเดิม ไม่แตะ contract) ·
  ทางแก้ถาวร = self-serve reset (F-081)

> ✋ **Gate 1 sign-off:** user + product เคาะแล้ว → `gate1-approved`

---

# ══ Gate 2 — Design ══
> _TODO: data-model (Org.taxProfile, Membership.roleId, Invitation) · API · UX · test plan_
