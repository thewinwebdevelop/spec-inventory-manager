# F-005 Audit Log

> สถานะ: `gate1-approved` · Phase: 0 · ขึ้นกับ (depends on): F-002, F-003 · ถูกอ้างโดย: เกือบทุก feature · เจ้าของ: backend-api (append-only) + product (policy)
> **Platform:** both (view/filter web + mobile) · **ขนาดงาน:** full (cross-cutting, append-only, security)

---

# ══ Gate 1 — Requirement ══

## 1. ภาพรวม (Overview)
- **ปัญหา/เป้าหมาย:** มี **"ใครทำ action อะไรในระบบ"** ที่ตรวจย้อนได้ — สำหรับ security, governance, support, compliance · เป็นเลนส์ governance ที่**แยกจาก domain ledger** (สต๊อก/usage)
- **ผู้ใช้:** Owner/Admin (ดู audit ของ org ตน), System (เขียน), Super-admin (cross-org — viewer UI = F-085)
- **คุณค่า:** สืบเหตุได้เมื่อมีปัญหา, โปร่งใส (เห็น support เข้าถึง), เป็นฐาน compliance

**audit log ≠ domain ledger (กันซ้ำซ้อน):**

| record | บันทึกอะไร |
|---|---|
| `StockMovement` (F-011) | ผลต่อสต๊อก/ต้นทุน (domain ledger) — ประวัติสต๊อกรายสินค้าอยู่ที่นี่ |
| `UsageEvent` (F-083) | การใช้ตามมิเตอร์ (usage ledger) |
| `AuditLog` (F-005) | "ใครทำ action อะไร" (governance) — อ้างอิง movement/เอกสาร ไม่ copy ตัวเลข |

## 2. User stories & Acceptance criteria

- **US-1:** ในฐานะระบบ ฉันต้องการ **บันทึก action สำคัญแบบ append-only**
  - [ ] AC: เขียน AuditLog เมื่อเกิด action กลุ่ม: auth/security, membership/access, entitlement/tier, settings, money/stock (ระดับสูง), back-office
  - [ ] AC: **append-only** — ห้าม edit/delete (วิญญาณกฎทอง 2)
  - [ ] AC: แต่ละ entry: actor (user/super-admin), action, targetType+targetId, before/after diff, organizationId, source (web/mobile/api/system/back-office), timestamp
  - [ ] AC: action list เป็น **registry ปลายเปิด** — เพิ่ม action ใหม่ไม่ migrate

- **US-2:** ในฐานะระบบ ฉันต้องการ **ไม่ทำซ้ำกับ domain ledger**
  - [ ] AC: action สต๊อก/เงิน → audit บันทึก "การกระทำ + **ref ไป StockMovement/เอกสาร**" ไม่ copy ตัวเลข
  - [ ] AC: ประวัติสต๊อกรายสินค้า **อยู่ที่ ledger (F-011/F-013)** ไม่ใช่ audit log

- **US-3:** ในฐานะ Owner/Admin ฉันต้องการ **ดู/กรอง audit ของ org ตัวเอง**
  - [ ] AC: view/filter ตาม actor/action/ช่วงเวลา/target (web + mobile)
  - [ ] AC: ดู audit ต้องมีสิทธิ์ (MVP ผูก `manage_org_settings` — แยก `view_audit` ได้อนาคตผ่าน registry)
  - [ ] AC: เห็นเฉพาะ org ตน (กฎทอง 3)

- **US-4:** ในฐานะ tenant ฉันต้องการ **เห็นเมื่อ support/back-office เข้าถึง org ฉัน**
  - [ ] AC: super-admin action ต่อ org → ปรากฏใน audit ที่ tenant ดูได้ (transparency)
  - [ ] AC: actor เป็น super-admin (แยกจาก membership — F-003 US-8)

- **US-5:** ในฐานะ security ฉันต้องการ **บันทึก auth events รวมที่ล้มเหลว**
  - [ ] AC: login สำเร็จ/**ล้มเหลว**, เปลี่ยน/รีเซ็ตรหัส, revoke token → audit (คู่กับ throttle F-001)

## 3. ขอบเขต (Scope)

| อยู่ใน scope (In — Phase 0) | ไม่อยู่ใน scope (Out / ภายหลัง) |
|---|---|
| AuditLog append-only + action registry + diff | back-office audit viewer UI → **F-085** |
| capture กลุ่ม action (ref ledger ไม่ copy) | tamper-evidence (hash chain) → hardening |
| tenant view/filter audit ของตน + เห็น back-office access | retention **automation** → **F-080-era** |
| cross-org seam (บันทึก super-admin action) | advanced search/export เชิงลึก → F-031 |

## 4. Business rules & edge cases
- **append-only** · ผูก `organizationId` · actor ระบุได้เสมอ (รวม system/super-admin)
- **เขียน async แต่ reliable** — ไม่อยู่ใน hot transaction money/stock (ledger การันตี integrity แล้ว) แต่ห้ามหล่นหาย
- **Retention policy (ตัดสินตอนนี้ · automation เลื่อน):** สาย money/stock/compliance เก็บยาว ~5 ปี (align เอกสารภาษี) · security/auth events สั้นกว่าได้ (~1 ปี)
- index ตาม org/actor/action/time สำหรับ filter
- ทุก feature ที่อ้าง "→ audit" ต้องยิง event ตอน build (F-002/003/004/007/040/042...)
- edge: action โดย system/automation (sync job) → actor = `system` ระบุชัด

> ✋ **Gate 1 sign-off:** user + product เคาะแล้ว → `gate1-approved`

---

# ══ Gate 2 — Design ══
> _TODO: data-model (AuditLog append-only) · async write design · API · UX (view/filter) · test plan_
