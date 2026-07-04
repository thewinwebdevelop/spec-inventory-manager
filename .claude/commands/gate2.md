---
description: เริ่ม Gate 2 (เอกสาร design ต่อทีม + sign off ทีละฉบับ + แตก task) ของ feature
argument-hint: <F-XXX>
---
คุณคือ PM/orchestrator ของ OmniStock. เริ่ม **Gate 2** สำหรับ feature: $ARGUMENTS

Precondition: feature ต้อง `status = G1✓` (ยังไม่ผ่าน → หยุด บอก user ให้ `/gate1` ก่อน).
อ่านก่อน: [WEB_TEAM.md](../../WEB_TEAM.md) (§3.2–3.7), [docs/SKILL_MAP.md](../../docs/SKILL_MAP.md), [docs/workspace-map.md](../../docs/workspace-map.md), และ `docs/features/F-XXX/F-XXX.md` (AC ที่ approved).

เดินตามนี้:
1. **เตรียม directory:** `docs/features/F-XXX/` — คัด template จาก `docs/features/_gate2/` เป็นเอกสารเปล่าต่อทีม.
2. **Dispatch ตาม dependency:**
   - `backend-api` → `architecture.md` (เฉพาะ full: push/idempotency/retry/reconciliation — skill `connector-design`; `money-stock` ถ้าแตะเงิน/สต๊อก) → `data-model.md` → `api-spec.md` (OpenAPI). ก่อน lock contract **ต้อง consult ux + qa**.
   - **หลัง contract นิ่ง → ขนาน** (skill `superpowers:dispatching-parallel-agents`):
     - `ux` → `ux-wireframe.md` + `ui.md` (skill `thai-ux`; reuse design-system กลางก่อน; Claude Design → `/design-sync`).
     - `qa` → `test-plan.md` (skill `feature-spec` + `money-stock` matrix; test data: seed ≥2 org + isolation + state via `StockMovement`).
3. **ระหว่างทำ:** subagent เจอคำถามนอกโดเมน = 🚧 BLOCKED กลับหาคุณ → route หา owner → log D-XXX → ป้อนกลับ. ห้ามเดา.
4. **Sign off ทีละฉบับ:** เอกสารเสร็จ → review เจ้าของส่วน → เสนอ user → user เคาะ → set `signoff: approved` ในไฟล์นั้น.
5. **✋ ครบทุกฉบับ → Gate 2 commit:** commit เอกสารทั้ง directory, set `status: G2✓`.
6. **แตก task:** สร้าง `docs/features/F-XXX/tasks.md` — block ต่อ task (id/desc/ref/deps/status/updated_by) ตาม WEB_TEAM §3.4. แต่ละทีมเสนอ task ของตัวเอง + ผูก dependency + ระบุ target path (apps/api, apps/web…).
7. **พร้อม Build:** เสนอ user ว่าจะ dispatch task (subagent-driven-development) ต่อไหม.

กติกา: ไม่มี agent เดาแทนกัน · contract = seam BE↔FE/ux · เจ้าของ task update status เอง.
