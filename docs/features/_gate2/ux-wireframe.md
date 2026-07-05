---
doc: ux-wireframe
owner: "@ux"
signoff: pending      # pending | approved
---
# [F-XXX] UX wireframe & flow
> เจ้าภาพ: `ux` · ออกแบบบน constraint ของ API ที่นิ่งแล้ว

## Contract summary (≤20 บรรทัด — ทีม consumer อ่านแค่ส่วนนี้)
> จอทั้งหมด + flow หลัก, component ที่ reuse/เพิ่มใหม่, D-XXX ที่อ้าง
- ...

- flow map ภาพรวม (หน้าจอที่เกี่ยวข้อง + การกระทำหลัก)

## ต่อ 1 screen — ทำครบทุกจอ
> **บังคับ (ทุก feature เสมอ):** ทุก screen ต้องมี **wireframe sketch (low-fidelity)**
> **ประกบกับรายละเอียดของจอนั้น** — วาง sketch ไว้ **ติดกัน** ในหัวข้อของ screen เดียวกัน
> (ไม่แยกไปกองรวมท้ายไฟล์ · ผู้อ่านต้องเห็นภาพ + รายละเอียดของจอพร้อมกัน)

### <ชื่อจอ> (`/path`)
- **Wireframe:** low-fi ASCII/box-drawing — วางองค์ประกอบจริง (header, fields, buttons, banner, list rows, dialog)
- องค์ประกอบ + การกระทำหลัก
- state: empty / loading / error / success + **Thai copy**
- platform note: web (centered card) vs mobile (full-screen) — ถ้าต่าง
