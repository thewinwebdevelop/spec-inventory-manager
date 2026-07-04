# 05 — Conventions & การทำงานกับ AI Agent

โปรเจกต์นี้พัฒนาโดย AI agent เป็นหลัก → ต้องมี guardrail ชัดเพื่อกัน drift

## 1. กฎทอง (ห้ามแหก)
1. **Source of truth = ระบบเรา** — platform คือปลายทาง
2. **Inventory ledger immutable** — แก้ยอดด้วย movement ใหม่เท่านั้น
3. **ทุก query โดเมนกรอง `organizationId`**
4. **เงิน & สต๊อก ต้องมี test** ก่อน merge — ไม่มี test = ไม่ผ่าน
5. **write ที่กระทบสต๊อก/เงิน อยู่ใน DB transaction + เขียน ledger**
6. business logic แกน อยู่ใน `packages/core-domain` (pure, ไม่พึ่ง framework/DB)

## 2. โครงสร้าง & naming
- entity/identifier เป็น **ภาษาอังกฤษ** (`SellableSku`, `InventoryItem`, `BundleComponent`)
- เงิน/ต้นทุนใช้ `numeric`/Decimal — **ห้ามใช้ float** กับเงิน
- จำนวนสต๊อกเป็น integer (หน่วยชิ้น)
- เวลาเก็บ UTC, แสดงผล timezone `Asia/Bangkok`
- **สกุลเงิน = THB เดียวทั้งระบบ** — multi-currency อยู่นอก scope ถาวรจนกว่าจะมี D-XXX ใหม่ (D-013: ห้ามเผื่อ abstraction ที่ไม่มีใครขอ)

## 3. Testing
- core-domain (inventory math, COGS, allocation, VAT): **unit test คลุมทุกเคส + edge**
- connector: contract test ด้วย mock platform API
- sync: integration test เคส concurrent / idempotency
- ก่อนเสนอว่า "เสร็จ": รัน test จริง แล้วรายงานผลตามจริง (fail ก็บอก)

## 4. Git & workflow
- ทำงานบน branch ไม่ใช่ default โดยตรง
- commit/push เมื่อผู้ใช้สั่งเท่านั้น
- commit message สื่อความหมาย, อ้าง phase/feature

## 5. Environment & secrets
- env ผ่าน schema (zod) validate ตอน start
- secrets/token ไม่ commit; token marketplace เข้ารหัสก่อนเก็บ DB

## 6. UX principle
- กลุ่มผู้ใช้คือ admin ที่ไม่ใช่สาย tech → ทุก flow ต้อง "เข้าใจได้เอง"
- ศัพท์ในหน้าจอเป็นภาษาไทยที่ร้านค้าคุ้น (สต๊อก, ออเดอร์, ใบกำกับ ฯลฯ)

## 7. ก่อนเริ่ม implement แต่ละ feature ให้ agent
1. อ่าน docs ที่เกี่ยวข้อง (โดยเฉพาะ 01 data-model)
2. ยืนยันว่าไม่ละเมิดกฎทอง
3. เขียน/อัปเดต test ของ business logic ก่อนหรือคู่กับโค้ด
4. รัน test + lint แล้วรายงานผลตามจริง
