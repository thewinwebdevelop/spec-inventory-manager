# Backlog gap scan — 2026-07-04 (PM review)

> สแกน F-000..F-007 (spec เต็ม) + backlog Phase 1–5 + icebox + capability-matrix + forward-commitments
> **รายงานนี้ = ข้อเสนอ** — scope เป็นของ product + user เคาะ · แต่ละข้อจบด้วย "ทางเลือก" ไม่ใช่คำสั่ง
> **สถานะ 2026-07-04: ✅ เคาะครบแล้ว** — user delegate ให้ PM เลือก → **G-1 = D-012** (copy invite link) ·
> **G-2..G-9 = D-013** (ดูรายละเอียดใน [DECISIONS.md](../../DECISIONS.md)) · เอกสารที่เกี่ยวถูกแก้แล้วทั้งหมด

## 🔴 สูง — ขัดแย้งภายใน หรือไม่มีเจ้าของทั้งที่ Phase 1 ต้องเจอ

### G-1 · F-002 เชิญสมาชิกด้วย email แต่ระบบส่ง email ไม่ได้จนถึง Phase 5 ⬜
F-002 US-3/US-4 สัญญา flow เชิญ→ตอบรับ + **re-send** + หมดอายุ 7 วัน แต่ SMTP/email infra ถูก
register ไว้ที่ **F-081 (Phase 5)** ใน forward-commitments — แปลว่าตอน build F-002 (Phase 0)
คำเชิญไม่มีทางถึงมือผู้ถูกเชิญทาง email เลย ("re-send" จะ re-send ไปที่ไหน?)
**ทางเลือก:** (a) เคาะให้ F-002 MVP = **copy invite link** (Owner ส่งเองทาง LINE/แชต — ไม่ต้องมี SMTP,
ต้องแก้ AC US-3 ให้ตรงความจริง + UX ออกแบบจุด copy) — แนะนำ, สอดคล้อง dogfood ·
(b) ดึง minimal SMTP (send-only, transactional) ขึ้นมาเป็น infra ของ Phase 0/1 — ปลดล็อก verify/reset/alert ด้วย แต่บวม scope
**กระทบ:** F-002 AC · ux flow · forward-commitments (F-081 entry)

### G-2 · PDPA / ข้อมูลส่วนบุคคล — ไม่มี feature ไหนถือ ทั้งที่ buyer PII ไหลเข้าตั้งแต่ F-024 (Phase 1) ⬜
Order sync ดึง **ชื่อ/ที่อยู่/เบอร์ผู้ซื้อ** ของลูกค้าทุก tenant เข้าระบบ = เราเป็น data processor ตาม PDPA
แต่ backlog ไม่มี: consent/ToS ตอน signup (F-001 ไม่มี AC), privacy policy, สิทธิ์ลบ/export รายบุคคล,
กติกา PII ใน log/export/LINE/AI
**ทางเลือก:** (a) บังคับใช้ skill `compliance-checklist` (สร้างแล้ว 2026-07-04) ที่ Gate 1 ของ
F-024/F-028/F-040/F-042/F-086 + เพิ่ม "PDPA baseline" เป็น item ใน launch-readiness (B7 ของ
team-upgrade-plan) — แนะนำขั้นต่ำ · (b) เปิด F-0XX "PDPA compliance" แยกใน Phase 5 (ToS/consent,
deletion/export tooling, DPA template)
**กระทบ:** F-024 Gate 1 (ที่จะเปิดเร็วๆ นี้) · F-001 (consent seam — retro เบา) · launch-readiness

## 🟡 กลาง — ควรตัดสินก่อนเปิด Phase 1/ก่อนขาย

### G-3 · Connector sandbox/mock — QA ของ Phase 1 sync ทั้งสาย ไม่มีที่ทดสอบ ⬜
F-020..F-025 คือหัวใจ Phase 1 แต่ไม่มีข้อไหนพูดถึง **test double ของ Shopee**: E2E + Track-2 agentic
จะยิงใส่อะไร (ร้านจริง = อันตราย, Shopee sandbox = จำกัด) conventions §3 พูดถึง "mock platform API"
ระดับ contract test เท่านั้น
**ทางเลือก:** ระบุใน F-020 Gate 2 architecture ให้ deliver **fake-Shopee adapter** (in-repo, ใช้กับ
integration/E2E/seed) เป็นส่วนหนึ่งของ `packages/connectors` — เป็น task ของ backend-api + qa
**กระทบ:** F-020 Gate 2 scope · test-plan ของทุก feature sync

### G-4 · Stock drift transparency — ร้านแก้สต๊อกบน Shopee เอง แล้วเราเงียบๆ ทับ ⬜
กฎทอง 1 (เราเป็น source of truth, push ทับ) ถูกต้อง แต่ผู้ใช้จริงจะไปกดแก้ในแอป Shopee เป็นครั้งคราว
แน่นอน — ตอนนี้ไม่มี AC ไหนบอกว่าเราจะ **ตรวจจับ+แจ้ง** ("สต๊อกบน Shopee ไม่ตรงกับที่ระบบคาด
ก่อน push — มีคนแก้ที่โน่น") ถ้าทับเงียบ = ผู้ใช้งง + เลิกเชื่อระบบ
**ทางเลือก:** เพิ่ม AC ใน F-023 (detect expected-vs-actual ก่อน push) + F-027 (แสดง drift event) —
เบา เพราะ reconciliation loop มีอยู่แล้วใน architecture
**กระทบ:** F-023/F-027 Gate 1 AC (ยัง ⬜ ทั้งคู่ — แก้ตอนนี้ฟรี)

### G-5 · CSV import (F-092) อยู่ icebox — แต่มันคือประตูรับลูกค้าที่มีของอยู่แล้ว ⬜
ร้านที่จะย้ายเข้ามามีสินค้า/สต๊อกเดิมหลักร้อย-พัน SKU — ไม่มี import = พิมพ์มือทั้งหมด = drop-off
ตั้งแต่ onboarding · dogfood ร้านเราเองก็ต้องกรอกของเดิมเหมือนกัน
**ทางเลือก:** (a) ดึง F-092 ขึ้น **ปลาย Phase 1** (product+stock เท่านั้น, ผ่าน ledger ตามกฎทอง) ·
(b) คงไว้ก่อนแต่ mark เป็น **launch-blocker** ใน launch-readiness — อย่างน้อยต้องเลือกข้อใดข้อหนึ่ง
**กระทบ:** backlog ordering

### G-6 · Stock take (F-093) อยู่ icebox — ความเชื่อมั่นสต๊อกคือ value prop หลัก ⬜
ของจริงหาย/นับพลาดเสมอ ระบบที่ตัวเลขห่างของจริงจะถูกเลิกเชื่อใน 2-3 เดือน — cycle count คือกลไก
กู้ความเชื่อมั่น (และเข้ากฎทอง: ปรับผ่าน ledger movement `ADJUSTMENT`)
**ทางเลือก:** ยกจาก icebox → **Phase 3** (คู่ F-013 ที่มี ledger view แล้ว)
**กระทบ:** backlog ordering

## 🟢 ต่ำ — จดไว้ ตัดสินตอนถึงตัว

### G-7 · รูปสินค้าจาก F-021 (Phase 1) แต่ object storage concrete = F-040 (Phase 2) ⬜
Product import จาก Shopee ย่อมมีรูป — ถ้า MVP = **hotlink URL ของ platform** ต้องเขียนเป็น
ข้อตกลงใน F-021 Gate 1 (ยอมรับว่ารูปหายถ้า listing ถูกลบ) หรือดึง storage ขึ้นมา · แค่ต้องเลือกให้ชัด

### G-8 · Backlog table กับ spec header ไม่ตรงกัน (deps ของ F-004) ⬜
[README.md](../../features/README.md) ตาราง Phase 0: F-004 ขึ้นกับ "F-002" แต่ตัว spec ระบุ
"F-002, F-003" (ใช้ `manage_org_settings` จาก F-003 จริง) — แก้ตารางให้ตรง spec (1 บรรทัด)

### G-9 · สมมติฐาน THB-only ควรประกาศชัด ⬜
ทั้งระบบ hardcode THB (ถูกแล้วสำหรับ marketplace ไทย) — เสนอเขียน 1 บรรทัดใน docs/01 ว่า
"multi-currency = out of scope ถาวรจนกว่าจะมี D-XXX" กัน agent อนาคตเผื่อ abstraction ที่ไม่มีใครขอ

### G-10 · สิ่งที่เช็คแล้ว "ไม่ขาด" (บันทึกกันถามซ้ำ)
- dependency chain Phase 1–5 ไล่แล้วสอดคล้อง (นอกจาก G-8)
- fee/settlement estimate→actual มีใน forward-commitments (F-024/F-026/F-030) ✓
- oversell/reconciliation (F-025), sync health (F-027), force-update (F-006), retention/downgrade
  (F-007), cross-org seam (F-003 US-8 + F-005) ✓ — คิดมาครบกว่ามาตรฐาน
- observability ops-side + backup/DR + load test = ปิดด้วย team-upgrade-plan (A3/A4/B6/B7) แล้ว

---
**ขั้นต่อไป:** user เลือกทางต่อข้อ (โดยเฉพาะ G-1, G-2 ที่กระทบ Phase 0/1) → PM log D-XXX →
route การแก้ spec ให้ product ตาม workflow ปกติ
