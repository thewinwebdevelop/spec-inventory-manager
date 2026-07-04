---
doc: architecture
owner: "@backend-api"
signoff: pending      # pending | approved
---
# [F-XXX] Architecture / Technical design  (เฉพาะ full)
> เจ้าภาพ: `backend-api` · ทำก่อน data-model/api/UX สำหรับงานที่แตะ external service

- **Sync strategy:** push vs poll · webhook vs polling (กฎทอง: เราเป็น source of truth → push เป็นหลัก)
- **Idempotency:** key อะไร, กันทำซ้ำยังไง
- **Rate-limit / retry:** ข้อจำกัด platform, backoff, จัดคิวด้วย BullMQ ยังไง
- **Reconciliation & partial failure:** เมื่อ platform กับเราไม่ตรง / ล้มกลางคัน
- **Mapping:** `ChannelListing` ↔ platform/account
- **ผลต่อสถาปัตยกรรมรวม:** sync กลับ [docs/02-architecture.md](../02-architecture.md) ถ้าเป็น decision ระดับระบบ
