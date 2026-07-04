# F-007 Tier & Entitlements Core

> สถานะ: `gate1-approved` · Phase: 0 · ขึ้นกับ (depends on): F-002 · ถูกอ้างโดย: F-003, F-004, accounting (F-040+), F-080/082/083 · เจ้าของ: backend-api (ตะเข็บสถาปัตยกรรม)
> **Platform:** — (core/backend · client บริโภคผ่าน `<FeatureGate>` pattern) · **ขนาดงาน:** full (cross-cutting)

---

# ══ Gate 1 — Requirement ══

## 1. ภาพรวม (Overview)
- **ปัญหา/เป้าหมาย:** มี **จุดเดียว** ที่ตอบว่า "org นี้ใช้ feature ไหนได้" (`can`) และ "เพิ่ม resource ได้อีกไหม" (`canAdd`) — ตะเข็บที่ปลดล็อก tier model (Sync/Full), gate accounting, capability ที่อิง tier (F-003), รองรับ add-on อนาคต
- **ผู้ใช้:** System (หลัก) · indirectly ทุก role (ถูก gate) · internal/back-office (provision)
- **คุณค่า:** เพิ่ม/ปิด feature ตาม plan โดยไม่แตะโค้ด feature เดิม · ขาย tier/add-on อนาคตได้โดยสถาปัตยกรรมรองรับตั้งแต่วันแรก · ต้นทุน (storage) คุมได้

**3 ชั้นการ gate (อย่าปนกัน):**
```
ทำ action ได้ ⇔ เป็นสมาชิก org (F-002) ∧ role มี capability (F-003) ∧ can(org, feature) (F-007)
```

## 2. User stories & Acceptance criteria

- **US-1:** ในฐานะระบบ ฉันต้องการให้ **ทุก org มี entitlement เสมอ**
  - [ ] AC: สร้าง org (F-002) → ผูก `OrgEntitlement` หนึ่งชุดเสมอ (invariant, `@@unique([organizationId])`)
  - [ ] AC: dogfood/internal → ผูก `comp_full` (ทุก feature, unlimited) ผ่าน seed/back-office
  - [ ] AC: ที่มาของ plan = "provisioning source" (internal-comp ตอนนี้ · purchased-license = F-080 อนาคต)

- **US-2:** ในฐานะ feature ใดๆ ฉันต้องการถาม **`can(org, feature)` จุดเดียว**
  - [ ] AC: `can(orgId, featureKey)` คืน true/false จาก resolved entitlement
  - [ ] AC: **feature code ห้ามอ่าน plan/features ตรงๆ** — ผ่าน `can()` เท่านั้น (กฎสถาปัตยกรรม)
  - [ ] AC: gate **แยก read/write** สำหรับ tier feature — `can(org,'accounting','write')` ปิดได้ แต่ `..,'read'` เปิด (รองรับ downgrade ไม่ลบข้อมูล)

- **US-3:** ในฐานะระบบ ฉันต้องการ **`canAdd(org, resource)`** เพื่อคุมเพดานแบบนับ row
  - [ ] AC: `canAdd(orgId, resourceKey)` = เทียบ count ปัจจุบัน vs cap ใน entitlement
  - [ ] AC: เรียกที่จุดเพิ่ม resource (เชิญสมาชิก F-002, เชื่อมร้าน F-020) ตอน build feature นั้น
  - [ ] AC: dogfood `comp_full` = unlimited → ไม่เด้ง

- **US-4:** ในฐานะ entitlement ฉันต้องการ **grant แบบ itemized + source** เพื่อรองรับ add-on
  - [ ] AC: grant เก็บเป็นรายการ แต่ละบรรทัดมี `feature`, `value`, `source` (plan|addon|comp|grandfather), `ref?`
  - [ ] AC: resolved entitlement = พับ grants ทับ plan.features
  - [ ] AC: ตอบได้ว่า "org มี add-on อะไร มาจากไหน" (ไม่ใช่ blob ทึบ)

- **US-5:** ในฐานะ client ฉันต้องการ **pattern แสดงผลตาม entitlement**
  - [ ] AC: มี component กลาง `<FeatureGate feature>` — `can()`=false → render paywall (โชว์+ล็อก+อัปเกรด) ไม่ซ่อน
  - [ ] AC: **server enforce 403 เสมอ** ไม่ว่า client ทำอะไร
  - [ ] AC: feature ที่ gated ถูกห่อ `<FeatureGate>` ตั้งแต่ build (กัน retrofit)

- **US-6:** ในฐานะระบบ ฉันต้องการ **เพิ่ม feature ใหม่โดยไม่รื้อ**
  - [ ] AC: `features` เป็น map ปลายเปิด — เพิ่ม key ใหม่ไม่ migrate
  - [ ] AC: feature/cap ใหม่ → role/entitlement เดิม **default deny** · `full_access`/comp ได้อัตโนมัติ

- **US-7:** ในฐานะธุรกิจ ฉันต้องการ **retention policy ตอน downgrade** เพื่อคุมต้นทุน storage
  - [ ] AC: DB records (เอกสาร/ledger/ตัวเลข) **เก็บตลอด ห้ามลบ** ตอน downgrade
  - [ ] AC: file blobs → read-only **grace 90 วัน** + ปุ่ม **Export ทั้งหมด (ZIP)** → หมด grace ย้าย **cold archive**
  - [ ] AC: `storage_mb` เป็น feature key (seed) — รองรับเป็น cap/add-on ภายหลัง
  - [ ] AC: ไฟล์เก็บใน object storage แยก prefix ราย org + **lifecycle-ready** (จาก F-000)

- **US-8:** ในฐานะ back-office ฉันต้องการ **mutation ผ่าน internal API**
  - [ ] AC: entitlement-mutation (provision/เปลี่ยน plan/เพิ่ม grant) เป็น internal service สะอาด — consumed by seed ตอนนี้ · back-office (F-085) ทับ UI ภายหลัง
  - [ ] AC: ทุก mutation ผ่าน audit (F-005)

## 3. ขอบเขต (Scope)

| อยู่ใน scope (In) | ไม่อยู่ใน scope (Out) |
|---|---|
| `PlanDefinition` + `OrgEntitlement` (ทำ stub เป็นจริง) | Plan/package management UI + grandfathering เต็ม → **F-082** |
| `can()` + `canAdd()` + read/write gate + cache | Usage metering (immutable ledger) + quota counting + hard cap → **F-083** |
| itemized grants + source (โครงสร้าง) | Billing/payment/license purchase → **F-080** |
| boolean feature gate + static cap | Self-serve upgrade/downgrade flow + grace/archive automation → **F-080/081** |
| provision internal/seed (comp_full) | metered/charge storage จริง |
| retention **policy (rule)** + storage seam | retention **automation** (timer/archive job) → F-080-era |
| `<FeatureGate>` client pattern + entitlement-mutation internal API | plan/usage display UI ฝั่งลูกค้า → F-082 |

## 4. Business rules & edge cases

**Seed เริ่มต้น:**

| plan key | tierLabel | accounting | marketplace_sync | caps | ใช้ |
|---|---|:--:|:--:|---|---|
| `comp_full` | internal | ✅ | ✅ | unlimited | dogfood |
| `full` | Full | ✅ | ✅ | ตามแพ็ก | ขายอนาคต |
| `sync` | Sync | ❌ | ✅ | ตามแพ็ก | ขายอนาคต |
| `free` | Sync | ❌ | ✅ | ต่ำ | funnel |

- **gate ที่ feature key รายตัว** ไม่ใช่ที่ string tier — `tierLabel` เป็นแค่ป้าย UX
- **gate ล็อก "write/new-action" ไม่ล็อก "read ข้อมูลที่ org สร้างไว้"** (หลักทั่วไป — ข้อมูลเป็นของ org เสมอ)
- **downgrade Full→Sync:** ไม่ลบข้อมูล · accounting เขียนใหม่ไม่ได้ · ดู/export เดิมได้ · บล็อก-ถ้า-งวดภาษีค้าง → F-080
- การเปลี่ยน plan/grant = action ไว → **audit (F-005)** · เปลี่ยน entitlement → invalidate cache ราย org
- edge: feature key ที่ code เรียกแต่ไม่มีใน map → default deny + log เตือน dev
- dogfood = `comp_full` unlimited → ไม่เจอ state ล็อก/cap/downgrade (forward-design ทั้งหมด)

> ✋ **Gate 1 sign-off:** user + product เคาะแล้ว → `gate1-approved`

---

# ══ Gate 2 — Design ══
> _TODO: data-model (PlanDefinition, OrgEntitlement, grants) · can()/canAdd() API · cache strategy · test plan_
