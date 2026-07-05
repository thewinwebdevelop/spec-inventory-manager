---
doc: architecture
owner: "@backend-api"
signoff: pending      # pending | approved
---
# [F-XXX] Architecture / Technical design  (เฉพาะ full)
> เจ้าภาพ: `backend-api` · ทำก่อน data-model/api/UX สำหรับงานที่แตะ external service

## Contract summary (≤20 บรรทัด — ทีม consumer อ่านแค่ส่วนนี้)
> สิ่งที่ทีมอื่นต้องรู้/ยึด: seam, การตัดสินใจสำคัญ + เหตุผลย่อ, D-XXX ที่อ้าง
- ...

- **Sync strategy:** push vs poll · webhook vs polling (กฎทอง: เราเป็น source of truth → push เป็นหลัก)
- **Idempotency:** key อะไร, กันทำซ้ำยังไง
- **Rate-limit / retry:** ข้อจำกัด platform, backoff, จัดคิวด้วย BullMQ ยังไง
- **Reconciliation & partial failure:** เมื่อ platform กับเราไม่ตรง / ล้มกลางคัน
- **Mapping:** `ChannelListing` ↔ platform/account
- **Capacity expectations:** ปริมาณ/อัตราที่ออกแบบรับ (เช่น orders/วัน, sync jobs/ชม., payload size) + จุดที่จะพังก่อนถ้าเกิน
- **ผลต่อสถาปัตยกรรมรวม:** sync กลับ [docs/02-architecture.md](../02-architecture.md) ถ้าเป็น decision ระดับระบบ
