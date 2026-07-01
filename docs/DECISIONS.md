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

---

### D-002 · 2026-07-02 · F-000
Q: enforce กฎทอง (ledger immutable, core-domain purity, org scoping) ด้วย "เครื่อง" ตั้งแต่ F-000 ไหม?
Asked by: @product   Owner: @user
Decision: ใช่ — F-000 วางกลไก enforce ด้วยเครื่อง: ledger immutable ที่ระดับ DB, lint dependency-boundary กัน core-domain import framework/DB, org-filter middleware stub — ตั้งแต่ scaffold (กลไก/tooling = devops+backend-api ตัดสินตอน Gate 2)
Rationale: กฎทอง 2/3/6 กระทบทุก feature เงิน/สต๊อก — enforce ด้วยวินัยพังเงียบ ต้องมีฟันจริง
Affects: F-000 AC8/AC9/org-scoping · ทุก feature money/stock ถัดไป
Status: decided

---

### D-003 · 2026-07-02 · F-000
Q: สร้าง packages/ai skeleton ตอน F-000 เลยไหม?
Asked by: @product/@devops   Owner: @user
Decision: ไม่ — เลื่อนไป Phase 5 (YAGNI)
Rationale: AI เป็น Phase 5; skeleton เปล่าตอนนี้ = ของค้างไม่ใช้
Affects: F-000 scope (out)
Status: decided

---

### D-004 · 2026-07-02 · F-000
Q: หลัง 3-team review, F-000 scope calls 6 ข้อ (right-size, Dart client, git hooks, write primitive, object storage, auth tables) เคาะยังไง?
Asked by: @product (from @backend-api/@devops/@qa review)   Owner: @user
Decision: schema ครบ + golden-rule guard ครบ · **สร้าง** Role/RefreshToken/Invitation ใน F-000 (กัน FK ลอย) · **มี** git pre-commit hooks · **defer:** Dart client green→F-006, object storage concrete→F-040, transaction/ledger write primitive→F-011
Rationale: เก็บ guard/schema seam ให้แน่นตั้งแต่แรก (D-002) แต่ defer runtime ที่ยังไม่มี feature เรียกใช้ (YAGNI)
Affects: F-000 scope/AC · forward-commitments (F-006/F-011/F-040)
Status: decided
