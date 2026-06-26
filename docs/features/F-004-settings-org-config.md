# F-004 Settings & Org Config (ops)

> สถานะ: `gate1-approved` · Phase: 0 · ขึ้นกับ (depends on): F-002, F-003 · เจ้าของ: product
> **Platform:** both (web เต็ม · มือถือดู/แก้พื้นฐาน) · **ขนาดงาน:** light (CRUD ภายใน — ไม่แตะ external/money-stock ในสไลซ์นี้)
>
> หมายเหตุ: tax settings (VAT/WHT/เลขรันเอกสาร/tax handling ราย channel) แยกเป็น **F-004b (Phase 2, Full tier)** — ดู forward-commitments

---

# ══ Gate 1 — Requirement ══

## 1. ภาพรวม (Overview)
- **ปัญหา/เป้าหมาย:** ที่ตั้งค่าระดับ org สำหรับงาน ops — โปรไฟล์ร้าน, คลัง (เดียว), ค่า default ของ allocation/สต๊อก — เป็นฐานให้ inventory/sync (Phase 1) ทำงาน
- **ผู้ใช้:** Owner/Admin (`manage_org_settings`)
- **คุณค่า:** ปรับระบบให้เข้ากับร้านได้เองโดยไม่ต้องพึ่ง dev · ค่า default ที่ดีลด friction

## 2. User stories & Acceptance criteria

- **US-1:** ในฐานะ Owner/Admin ฉันต้องการ **ตั้งค่าโปรไฟล์องค์กร**
  - [ ] AC: แก้ ชื่อร้าน, โลโก้, ข้อมูลติดต่อ, timezone, สกุลเงิน (default THB)
  - [ ] AC: ต้องมีสิทธิ์ `manage_org_settings` ถึงแก้ได้ (ไม่มี = อ่านอย่างเดียว/403)

- **US-2:** ในฐานะ Owner/Admin ฉันต้องการ **จัดการคลังเริ่มต้น**
  - [ ] AC: org สร้าง → มี default warehouse 1 ตัวอัตโนมัติ (เชื่อม F-002)
  - [ ] AC: แก้ชื่อ/ข้อมูลคลัง default ได้
  - [ ] AC: **Phase 0 = คลังเดียว** — สร้างหลายคลัง/โอนข้ามคลัง → F-090+ (forward-commitments)

- **US-3:** ในฐานะ Owner/Admin ฉันต้องการ **ตั้งค่า default ของ ops**
  - [ ] AC: ตั้ง allocation default (FULL/BUFFER/FIXED/DYNAMIC) ของ listing ใหม่
  - [ ] AC: ตั้ง low-stock threshold ตั้งต้น + นโยบายเตือนสต๊อก
  - [ ] AC: เปลี่ยน default → มีผลกับของใหม่ · ของเดิมคงเดิม (ไม่ย้อนหลัง)

- **US-4:** ในฐานะระบบ ฉันต้องการ **โครง settings ที่ขยายได้**
  - [ ] AC: เพิ่ม config key ใหม่ได้โดย **ไม่ migrate** (settings registry — typed group + ปลายเปิด)
  - [ ] AC: config ใหม่มี default ปลอดภัย · setting ผูก `organizationId` เสมอ

- **US-5:** ในฐานะระบบ ฉันต้องการ **audit การเปลี่ยน setting**
  - [ ] AC: เปลี่ยน setting สำคัญ → เขียน audit (F-005) พร้อม actor + ค่าเก่า/ใหม่

## 3. ขอบเขต (Scope)

| อยู่ใน scope (In — Phase 0) | ไม่อยู่ใน scope (Out / ภายหลัง) |
|---|---|
| org profile, default warehouse (เดียว), allocation default, inventory defaults | tax/VAT/WHT/เลขเอกสาร → **F-004b (Phase 2)** |
| settings registry แบบขยายได้ | CRUD หลายคลัง + TRANSFER → **F-090+** |
| gate `manage_org_settings` + audit | allocation override ราย listing → F-023 |

## 4. Business rules & edge cases
- gate ทุกการแก้ด้วย `manage_org_settings` (F-003) · ผูก `organizationId` (กฎทอง 3)
- เปลี่ยน default = forward-only (ไม่กระทบของเดิม) — bulk-apply ถ้าจำเป็นทำทีหลัง
- edge: Phase 0 มีคลังเดียว → แก้ได้แต่ลบไม่ได้
- การเปลี่ยน setting สำคัญ → audit (F-005)

> ✋ **Gate 1 sign-off:** user + product เคาะแล้ว → `gate1-approved`

---

# ══ Gate 2 — Design ══
> _TODO: data-model (settings registry, Warehouse) · API · UX · test plan_
