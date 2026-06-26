# F-003 Roles & Permissions (RBAC)

> สถานะ: `gate1-approved` · Phase: 0 · ขึ้นกับ (depends on): F-002, F-007 (tier), F-005 (audit) · เจ้าของ: product
> **Platform:** both (จัดการ role เต็มบนมือถือด้วย — checklist แนวตั้ง) · **ขนาดงาน:** full (cross-cutting — บังคับใช้ทุก API)

---

# ══ Gate 1 — Requirement ══

## 1. ภาพรวม (Overview)
- **ปัญหา/เป้าหมาย:** คุมว่าใครใน org ทำอะไรได้ ผ่าน **role ที่ใช้ซ้ำได้ + แก้เองได้ราย org** เจ้าของร้านมอบงานให้ทีมได้ปลอดภัย + วาง **cross-org seam** สำหรับ back-office (F-085) ตั้งแต่แรก
- **ผู้ใช้:** Owner/Admin (จัดการ role + assign), ทุก role (ถูก enforce), System, Super-admin/back-office (ข้อยกเว้น cross-org — ยังไม่เปิดใช้ Phase 0)
- **คุณค่า:** ปลอดภัย + ยืดหยุ่นพอสำหรับร้านจริง โดย UI ไม่ซับซ้อนเกิน (capability กลุ่มหยาบ ติ๊ก checkbox)

## 2. User stories & Acceptance criteria

- **US-1:** ในฐานะ org ใหม่ ฉันต้องการ **role มาตรฐานติดมาให้**
  - [ ] AC: สร้าง org → seed 4 role: **Owner, Admin, Staff, Accountant** (ตาม preset §4)
  - [ ] AC: Owner เป็น **system role ล็อก** (แก้/ลบไม่ได้, มี `full_access` เสมอ) · อีก 3 role org แก้/ลบ/โคลนได้

- **US-2:** ในฐานะ Owner/Admin ฉันต้องการ **กำหนด role ให้สมาชิก (ใช้ซ้ำได้)**
  - [ ] AC: assign 1 role ให้สมาชิกหลายคนได้ — `Membership.roleId`
  - [ ] AC: แก้ capability ใน role → มีผลกับทุกคนที่ถือ role นั้นทันที (request ถัดไป)
  - [ ] AC: role เป็นของราย org — user คนเดียวเป็น role ต่างกันในแต่ละ org ได้

- **US-3:** ในฐานะ Owner/Admin ฉันต้องการ **สร้าง/โคลน/แก้/ลบ role พร้อมติ๊กสิทธิ์**
  - [ ] AC: สร้าง role = ตั้งชื่อ + ติ๊ก capability จาก checklist (§4)
  - [ ] AC: โคลน role เดิมแล้วแก้ได้
  - [ ] AC: ชื่อ role ไม่ซ้ำใน org เดียวกัน
  - [ ] AC: **ลบ role ที่มีสมาชิกถืออยู่ไม่ได้** จนกว่าจะย้ายสมาชิกไป role อื่นก่อน
  - [ ] AC: role ต้องมี **อย่างน้อย 1 capability** (ไม่มี role เปล่า)

- **US-4:** ในฐานะระบบ ฉันต้องการ **กฎกันล็อกตัวเอง**
  - [ ] AC: ต้องมีสมาชิกที่เป็น Owner ≥ 1 เสมอ (สอดคล้อง F-002)
  - [ ] AC: Admin จัดการ role/สมาชิกได้ แต่ **แตะ Owner role / ยกคนเป็น Owner ไม่ได้** (เฉพาะ Owner)

- **US-5:** ในฐานะระบบ ฉันต้องการ **บังคับสิทธิ์ที่ทุก API ฝั่ง server**
  - [ ] AC: ทุก endpoint โดเมนผูกกับ capability ที่ต้องใช้ → ไม่มีสิทธิ์ = 403 ก่อนแตะข้อมูล
  - [ ] AC: enforce ฝั่ง server เสมอ (UI ซ่อนปุ่ม = UX ไม่ใช่ security)
  - [ ] AC: ตรวจสิทธิ์อยู่ใน scope active org เท่านั้น (กฎทอง 3)

- **US-6:** ในฐานะระบบ ฉันต้องการ **capability registry ที่ขยายได้**
  - [ ] AC: เพิ่ม feature ใหม่ = เพิ่ม capability key (ไม่ migrate)
  - [ ] AC: capability ใหม่ → role เดิม **default deny** · role ที่มี `full_access` ได้อัตโนมัติ

- **US-7:** ในฐานะระบบ ฉันต้องการ **capability ที่อิงกับ tier**
  - [ ] AC: capability ของ Full tier (เช่น `access_accounting`) โผล่เฉพาะ org ที่ entitlement เปิด (F-007)
  - [ ] AC: สิทธิ์จริง = capability ของ role **∩** สิ่งที่ tier ปลดล็อก

- **US-8:** ในฐานะระบบ ฉันต้องการวาง **cross-org boundary สำหรับ back-office**
  - [ ] AC: มี **super-admin actor แยกขาด**จาก Membership ภายใน org (ยังไม่เปิดใช้ Phase 0)
  - [ ] AC: query ข้าม org = ข้อยกเว้นที่ประกาศชัด + ผ่าน audit (F-005) · default ทุก query กรอง org

## 3. ขอบเขต (Scope)

| อยู่ใน scope (In) | ไม่อยู่ใน scope (Out / ภายหลัง) |
|---|---|
| seed 4 default role + Owner ล็อก | per-user permission override (ตัดออก — role ล้วน) |
| สร้าง/โคลน/แก้/ลบ custom role ราย org | per-field/per-record permission ละเอียด |
| capability registry (กลุ่มหยาบ) + extensible | per-warehouse/per-channel scoped role |
| enforce ทุก API ฝั่ง server + tier-aware | back-office console จริง → F-085 |
| cross-org seam (ยังไม่ build) | approval workflow / time-based access |

## 4. Business rules & edge cases

**Capability registry (เริ่มต้น 10 ตัว — open-ended):**

| key | ป้ายไทย | tier |
|---|---|---|
| `full_access` | เข้าถึงทุกอย่าง | ทุก tier |
| `manage_members` | จัดการสมาชิก & บทบาท | ทุก tier |
| `manage_org_settings` | ตั้งค่าองค์กร | ทุก tier |
| `manage_billing` | จัดการ license & การจ่ายเงิน | ทุก tier |
| `manage_products` | จัดการสินค้า & SKU | ทุก tier |
| `manage_stock` | จัดการสต๊อก/คลัง | ทุก tier |
| `manage_channels` | จัดการร้าน marketplace | ทุก tier |
| `manage_orders` | จัดการออเดอร์ & แพ็ค | ทุก tier |
| `view_financials` | ดูข้อมูลการเงิน/กำไร | ทุก tier |
| `access_accounting` | เข้าถึงบัญชี | **Full เท่านั้น** |

**Preset default roles (seed — org แก้ต่อได้ ยกเว้น Owner):**

| capability | Owner🔒 | Admin | Staff | Accountant |
|---|:--:|:--:|:--:|:--:|
| full_access | ✅ | | | |
| manage_members | ✅ | ✅ | | |
| manage_org_settings | ✅ | ✅ | | |
| manage_billing | ✅ | | | |
| manage_products | ✅ | ✅ | | |
| manage_stock | ✅ | ✅ | ✅ | |
| manage_channels | ✅ | ✅ | | |
| manage_orders | ✅ | ✅ | ✅ | 🟡 ดู |
| access_accounting | ✅ | ✅ | | ✅ |
| view_financials | ✅ | ✅ | | ✅ |

**กฎ & edge cases:**
- **กฎทอง 3:** enforce ทุก capability ภายใต้ active org scope
- สิทธิ์จริง = `role.capabilities ∩ tier.unlocked` (`full_access` = ผ่านทุกอย่างที่ tier เปิด)
- edge: non-owner แก้ role ตัวเองจนหลุด `manage_members` → เตือนก่อนยืนยัน · Owner กันด้วยกฎ Owner-คนสุดท้าย
- edge: role ถูกแก้ระหว่าง session → ใช้สิทธิ์ใหม่ request ถัดไป (token สั้น 15น. — F-001)
- edge: org downgrade Full→Sync ทั้งที่ role ติ๊ก `access_accounting` → capability ถูกพับอัตโนมัติ (tier ปิด) ไม่ error
- ทุก action ไวต่อสิทธิ์ → เขียน audit (F-005)
- **UX (ส่ง ux Gate 2):** จอเล็ก = capability เรียงแนวตั้ง (checklist) จัดกลุ่มหัวข้อ ให้ scan ง่าย

> ✋ **Gate 1 sign-off:** user + product เคาะแล้ว → `gate1-approved`

---

# ══ Gate 2 — Design ══
> _TODO: data-model (Role per org, capability registry) · API · UX (checklist แนวตั้ง) · test plan (multi-tenant isolation)_
