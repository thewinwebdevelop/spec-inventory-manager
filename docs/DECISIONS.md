# Decision Ledger (D-XXX)

> บันทึกการตัดสินใจข้ามทีมแบบ **append-only** — สะท้อนกฎทอง "ledger immutable"
> เปลี่ยนใจ = เพิ่ม entry ใหม่ status `superseded-by` ไม่แก้ของเดิม
> เจ้าของการ log = PM (orchestrator) ตอน route BLOCKED จนได้คำตอบ (ดู [WEB_TEAM.md](../WEB_TEAM.md))

## Format
### D-XXX · YYYY-MM-DD · F-XXX
Q: <คำถามเดียว ชัดๆ>
Asked by: @<agent>   Owner: @<agent|user>
Decision: <สิ่งที่เคาะ>
Rationale: <เหตุผล>
Affects: contract / data-model / UX / AC ...
Status: decided          # decided | superseded-by D-0xx

---

### D-000 · 2026-06-29 · —
Q: ตัวอย่าง seed — ledger นี้ใช้รูปแบบไหน?
Asked by: @product   Owner: @user
Decision: ใช้ format ด้านบน · 1 entry ต่อ 1 การตัดสินใจข้ามทีม · อ้าง D-XXX ใน spec/PR/commit
Rationale: decision ไม่หายในแชต + กันถามซ้ำ
Affects: workflow
Status: decided
