# [F-XXX] <ชื่อ feature>

> สถานะ: `draft` | `reviewed` | `in-progress` | `done`
> Phase: <0-5> · ขึ้นกับ (depends on): <F-XXX, ...> · เจ้าของ: <ใคร>

---

## 1. ภาพรวม (Overview)
- **ปัญหา/เป้าหมาย:** feature นี้แก้อะไร ทำไมต้องมี
- **ผู้ใช้:** Owner / Admin / Staff / Accountant / System
- **คุณค่า:** ผู้ใช้ได้อะไร / ธุรกิจได้อะไร

## 2. User stories & Acceptance criteria
> เขียนเป็นภาษาคน เพื่อ "เช็คความเข้าใจตรงกัน" — ส่วนนี้คือหัวใจของการ review

- **US-1:** ในฐานะ `<role>` ฉันต้องการ `<ทำอะไร>` เพื่อ `<ได้ผลอะไร>`
  - [ ] AC: เงื่อนไขที่ต้องเป็นจริง (ทดสอบได้)
  - [ ] AC: ...
- **US-2:** ...

## 3. ขอบเขต (Scope)
| อยู่ใน scope (In) | ไม่อยู่ใน scope (Out / ภายหลัง) |
|---|---|
| ... | ... |

## 4. Business rules & edge cases
- กฎสำคัญ (อ้างกฎทองใน CLAUDE.md ถ้าเกี่ยว)
- edge cases ที่ต้องรองรับ + พฤติกรรมที่คาดหวัง

## 5. Data model (ส่วนที่ feature นี้เพิ่ม/แก้)
> อ้างอิง/ต่อยอดจาก [docs/01-data-model.md](../01-data-model.md)

- entity/field ที่เพิ่ม (ชื่อ, ชนิด, ความสัมพันธ์, constraint, index)
- migration ที่ต้องมี

## 6. API design
> สัญญาผ่าน OpenAPI ([docs/02](../02-architecture.md))

| Method | Path | คำอธิบาย | Auth/Permission |
|--------|------|----------|-----------------|
| POST | /... | ... | ... |

- request/response schema (ย่อ), error cases, validation, pagination

## 7. UI design
- หน้าจอ/flow ที่เกี่ยวข้อง (list ชื่อหน้า + การกระทำหลัก)
- state สำคัญ (empty / loading / error / success)
- หมายเหตุ UX สำหรับ admin ที่ไม่ใช่สาย tech
- (แนบ mockup/wireframe ถ้ามี)

## 8. Dependencies & impact
- feature/โมดูลอื่นที่ต้องมีก่อน
- ผลกระทบต่อ feature อื่น (เช่น เปลี่ยน schema กระทบใคร)

## 9. Test plan
**Unit (core-domain / service):**
- [ ] ...

**Integration / API:**
- [ ] ...

**E2E (user flow):**
- [ ] ...

## 10. Implementation task list
> แตกเป็น task ย่อยที่ทำได้จริง เรียงลำดับ (backend → API → UI → test)

- [ ] T1: ...
- [ ] T2: ...
- [ ] T-test: เขียน unit test ของ business logic
- [ ] T-e2e: เขียน E2E ของ flow หลัก
