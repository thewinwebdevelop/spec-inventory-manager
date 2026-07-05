---
status: draft        # draft→G1→G1✓→G2→G2✓→build→qa✓→release→done
owner_now: "@product"
waiting_on: null     # เช่น "D-007 (product)" หรือ null
platform: both       # web | mobile | both
size: full           # full | light
---

# [F-XXX] <ชื่อ feature>

> สถานะ: `draft` | `gate1-approved` | `designed` | `in-progress` | `done`
> Phase: <0-5> · ขึ้นกับ (depends on): <F-XXX, ...> · เจ้าของ: <ใคร>
> **Platform:** web | mobile | both  ·  **ขนาดงาน (right-size):** full | light
>
> _full_ = แตะ external service / sync / queue / money-stock ซับซ้อน / cross-cutting → ทำเอกสารครบ
> _light_ = CRUD ภายใน / แก้ UI เล็ก → ข้ามหัวข้อ 5 (Architecture) และลดรายละเอียด

---

# ══ Gate 1 — Requirement ══
> *ถูก เปลี่ยนง่าย* — ส่วนนี้คือหัวใจของการ review **ต้องให้ user เคาะก่อนไป Gate 2**

## 1. ภาพรวม (Overview)
- **ปัญหา/เป้าหมาย:** feature นี้แก้อะไร ทำไมต้องมี
- **ผู้ใช้:** Owner / Admin / Staff / Accountant / System
- **คุณค่า:** ผู้ใช้ได้อะไร / ธุรกิจได้อะไร

## 2. User stories & Acceptance criteria
> เขียนเป็นภาษาคน (ไทย) เพื่อ "เช็คความเข้าใจตรงกัน"

- **US-1:** ในฐานะ `<role>` ฉันต้องการ `<ทำอะไร>` เพื่อ `<ได้ผลอะไร>`
  - [ ] AC: เงื่อนไขที่ต้องเป็นจริง (ทดสอบได้)
  - [ ] AC: ...
- **US-2:** ...

## 3. ขอบเขต (Scope)
| อยู่ใน scope (In) | ไม่อยู่ใน scope (Out / ภายหลัง) |
|---|---|
| ... | ... |

## 4. Business rules & edge cases
- กฎสำคัญ (อ้างกฎทองใน [CLAUDE.md](../../CLAUDE.md) ถ้าเกี่ยว)
- edge cases ที่ต้องรองรับ + พฤติกรรมที่คาดหวัง

> ✋ **Gate 1 sign-off:** user + product ยืนยัน user-stories/AC → เปลี่ยนสถานะเป็น
> `gate1-approved` ก่อนเริ่มเขียนส่วน Design ด้านล่าง

---

# ══ Gate 2 — Design ══
> *ต่อยอดจาก Gate 1 ที่อนุมัติแล้ว* — review เจาะจงเจ้าของแต่ละส่วน แล้ว ✋ user
> อนุมัติ + commit เอกสารทั้งหมด **ก่อน** implement
> feature **full**: แยกเอกสาร Gate 2 เป็นไฟล์ต่อทีมใน `docs/features/F-XXX/` (คัดจาก
> `docs/features/_gate2/`) — sign off ทีละฉบับ (ดู [WEB_TEAM.md](../../WEB_TEAM.md))

## 5. Architecture / Technical design  _(เฉพาะ full — light ข้ามได้)_
> เจ้าภาพ: `backend-api` · ทำก่อน data-model/api/UX สำหรับงานที่แตะ external service

- **Sync strategy:** push vs poll · webhook vs polling (กฎทอง: เราเป็น source of truth → push เป็นหลัก)
- **Idempotency:** key อะไร, กันทำซ้ำยังไง
- **Rate-limit / retry:** ข้อจำกัด platform, backoff, จัดคิวด้วย BullMQ ยังไง
- **Reconciliation & partial failure:** เมื่อ platform กับเราไม่ตรง / ล้มกลางคัน
- **Mapping:** `ChannelListing` ↔ platform/account
- **ผลต่อสถาปัตยกรรมรวม:** sync กลับ [docs/02-architecture.md](../02-architecture.md) ถ้าเป็น decision ระดับระบบ

## 6. Data model (ส่วนที่ feature นี้เพิ่ม/แก้)
> อ้างอิง/ต่อยอดจาก [docs/01-data-model.md](../01-data-model.md) — data-model ขับ API

- entity/field ที่เพิ่ม (ชื่อ, ชนิด, ความสัมพันธ์, constraint, index)
- migration ที่ต้องมี

## 7. API design
> สัญญาผ่าน OpenAPI ([docs/02](../02-architecture.md)) — **seam กลาง FE↔BE**

| Method | Path | คำอธิบาย | Auth/Permission |
|--------|------|----------|-----------------|
| POST | /... | ... | ... |

- request/response schema (ย่อ), error cases, validation, pagination

## 8. UX wireframe & flow
> เจ้าภาพ: `ux` · ออกแบบบน constraint ของ API ที่นิ่งแล้ว

- flow + หน้าจอที่เกี่ยวข้อง (list ชื่อหน้า + การกระทำหลัก)
- state สำคัญ (empty / loading / error / success) + **Thai copy**
- (แนบ mockup/wireframe ถ้ามี)

## 9. UI / visual
> design token (สี/typography/spacing) + visual spec ที่ใช้ร่วม web↔mobile
> — **ระบุเฉพาะส่วนที่ต่างกันต่อ platform** (navigation, ความสามารถเฉพาะ)

## 10. Dependencies & impact
- feature/โมดูลอื่นที่ต้องมีก่อน
- ผลกระทบต่อ feature อื่น (เช่น เปลี่ยน schema/contract กระทบใคร)

## 11. Test plan  _(เจ้าภาพ: qa — ร่างตอน Gate 2 จาก AC)_
**Unit (core-domain / service):**
- [ ] ...

**Integration / API:**
- [ ] ...

**E2E (user flow) + manual:**
- [ ] ...

> ✋ **Gate 2 sign-off:** review เจ้าของแต่ละส่วน + user อนุมัติ → commit เอกสาร →
> สถานะ `designed` → เริ่ม implement

---

# ══ Build & Verify ══

## 12. Implementation task list
> แตกเป็น task ย่อยที่ทำได้จริง เรียงลำดับ (backend → API → UI) **unit test ไปพร้อมโค้ด**

- [ ] T1: ...
- [ ] T2: ...
- [ ] T-test: unit test ของ business logic (เขียนระหว่าง implement — กฎทองข้อ 4)
- [ ] T-e2e: E2E ของ flow หลัก
