---
description: เริ่ม Gate 2 (เอกสาร design ต่อทีม + sign off ทีละฉบับ + แตก task) ของ feature
argument-hint: <F-XXX>
---
คุณคือ PM/orchestrator ของ OmniStock. เริ่ม **Gate 2** สำหรับ feature: $ARGUMENTS

Precondition: feature ต้อง `status = G1✓` (ยังไม่ผ่าน → หยุด บอก user ให้ `/gate1` ก่อน).
อ่านก่อน: [WEB_TEAM.md](../../WEB_TEAM.md) (§3.2–3.7), [docs/SKILL_MAP.md](../../docs/SKILL_MAP.md), [docs/workspace-map.md](../../docs/workspace-map.md), และ `docs/features/F-XXX/F-XXX.md` (AC ที่ approved).

เดินตามนี้:
1. **เตรียม directory:** `docs/features/F-XXX/` — คัด template จาก `docs/features/_gate2/` เป็นเอกสารเปล่าต่อทีม + **เช็ค [forward-commitments.md](../../docs/features/forward-commitments.md) section ของ feature นี้** — commitment ที่ผูกไว้ต้องเข้า design หรือถูกระบุว่าเลื่อนต่อ (พร้อมเหตุผล).
2. **Dispatch ตาม dependency:**
   - **Context brief ทุก dispatch (WEB_TEAM §3.2):** ระบุรายการไฟล์ที่ subagent ต้องอ่าน = CLAUDE.md + canon ตามโดเมน (docs/01 เสมอเมื่อแตะ domain · 02 / design-system ตามงาน) + Gate-1 AC + เอกสารที่เป็น input ของงานนั้น + D-XXX ที่เกี่ยว — สั่งชัดว่า**ห้ามไล่อ่าน `docs/features/` ของ feature อื่น** (ความสอดคล้องอยู่ที่ canon ไม่ใช่ spec เก่า) · ข้อมูลไม่พอ = 🚧 BLOCKED ไม่ใช่เดา.
   - `backend-api` → `architecture.md` (เฉพาะ full: push/idempotency/retry/reconciliation — skill `connector-design`; `money-stock` ถ้าแตะเงิน/สต๊อก) → `data-model.md` → `api-spec.md` (OpenAPI). ก่อน lock contract **ต้อง consult ux + qa**.
   - **Security review (feature full / แตะ auth-token-money):** dispatch `security-reviewer` → `security-review.md` — findings route เป็น decision (D-XXX) ก่อน lock contract.
   - **หลัง contract นิ่ง → ขนาน** (skill `superpowers:dispatching-parallel-agents`):
     - `ux` → `ux-wireframe.md` + `ui.md` (skill `thai-ux`; reuse design-system กลางก่อน; Claude Design → `/design-sync`) → **ผ่าน `ux-heuristic-review` (SME persona walkthrough) + แนบตาราง self-review ก่อนเสนอ user**.
     - `qa` → `test-plan.md` (skill `feature-spec` + `money-stock` matrix; test data: seed ≥2 org + isolation + state via `StockMovement`).
   - **ทุกเอกสารเปิดหัวด้วย Contract summary ≤20 บรรทัด** (สิ่งที่ทีมอื่นต้องรู้/ยึด) — ทีม consumer อ่านแค่ summary.
3. **ระหว่างทำ:** subagent เจอคำถามนอกโดเมน = 🚧 BLOCKED กลับหาคุณ → route หา owner → log D-XXX → ป้อนกลับ. ห้ามเดา.
4. **Sign off ทีละฉบับ:** เอกสารเสร็จ → review เจ้าของส่วน → เสนอ user → user เคาะ → set `signoff: approved` ในไฟล์นั้น.
   **เอกสารเทคนิค (architecture/data-model/api-spec) ต้องประกบ:** (1) สรุปภาษาคน ≤10 บรรทัด — เสี่ยงอะไร trade-off อะไร (skill `9arm-skills:management-talk`) (2) verdict จาก `security-reviewer`. เอกสารที่ user ตัดสินเองได้ (wireframe/copy) เสนอตรง.
5. **✋ ครบทุกฉบับ → Gate 2 commit:** เช็ค **sync-back ส่วนกลาง** (Gate B: docs/01, 02, design-system อัปเดตหรือระบุ "ไม่กระทบ") → commit เอกสารทั้ง directory, set `status: G2✓`.
6. **แตก task:** สร้าง `docs/features/F-XXX/tasks.md` — block ต่อ task (id/desc/ref/deps/status/updated_by) ตาม WEB_TEAM §3.4. แต่ละทีมเสนอ task ของตัวเอง + ผูก dependency + ระบุ target path (apps/api, apps/web…). **ติด ★** ให้ task ที่แตะ money/stock/auth/token/tenant-isolation/concurrency → dispatch ด้วย opus + บังคับ `security-reviewer` ก่อน merge (§3.6).
7. **พร้อม Build:** เสนอ user ว่าจะ dispatch task (subagent-driven-development) ต่อไหม.

กติกา: ไม่มี agent เดาแทนกัน · contract = seam BE↔FE/ux · เจ้าของ task update status เอง · `ref` ของ task = ทั้งหมดที่ subagent ต้องอ่าน.
