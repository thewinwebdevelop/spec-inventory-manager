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

---

### D-001 · 2026-07-02 · F-000
Q: ควรเขียน per-app CLAUDE.md (tech stack + folder structure ต่อ app) ตอนนี้เลยไหม?
Asked by: @user   Owner: @user
Decision: **เลื่อนไปทำพร้อม F-000** — สร้าง `apps/{api,web,mobile}/CLAUDE.md` (nested, auto-load) ตอน scaffold จริง
Rationale: Phase 0 ยังไม่มีโค้ด/โฟลเดอร์ — เขียน structure ตอนนี้ = เดา แล้ว drift · เขียนจากของจริงตอน F-000
Affects: F-000 scope · apps/*/CLAUDE.md
Status: decided
