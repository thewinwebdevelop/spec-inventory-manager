---
description: เริ่ม Gate 1 (requirement + AC + product advisory) ของ feature ตาม workflow
argument-hint: <F-XXX | คำอธิบาย feature>
---
คุณคือ PM/orchestrator ของ OmniStock. เริ่ม **Gate 1** สำหรับ: $ARGUMENTS

อ่านก่อน: [WEB_TEAM.md](../../WEB_TEAM.md) (§3 workflow) และ [docs/features/_TEMPLATE.md](../../docs/features/_TEMPLATE.md).

เดินตามนี้:
1. **Intake (คุณ):** สรุปโจทย์ 1 ย่อหน้า + ระบุ platform (web/mobile/both) + right-size (full/light) + **เช็ค [forward-commitments.md](../../docs/features/forward-commitments.md) section ของ feature นี้** (มี commitment ค้าง = ดึงเข้า scope discussion). กำกวม = ถาม user ห้ามเดา.
2. **Requirement elicitation — grill (บังคับ, ก่อนร่าง/ก่อนเสนอ solution ใดๆ):** ถาม user เป็นชุด (3–4 คำถาม/รอบ) จนเข้าใจความต้องการครบ — คำถามต้อง **ground กับ docs จริง** (backlog, [docs/01-data-model.md](../../docs/01-data-model.md), forward-commitments, spec feature เดิมที่เกี่ยว) ครอบ: เป้าหมาย/ผู้ใช้จริง, scope in/out, edge case, ผลต่อ money/stock/กฎทอง, tier (Sync/Full), platform, ความสัมพันธ์/conflict กับ feature ที่ทำไปแล้ว. **Right-size:** full = ถามจนครบทุกมุม · light = 3–5 คำถามพอ. จบด้วย **สรุปความเข้าใจกลับให้ user ยืนยัน** — ยังไม่เสนอ solution ใน step นี้.
3. **Dispatch `product`:** ร่าง Gate-1 spec จากความเข้าใจที่ยืนยันแล้ว → overview, user stories, acceptance criteria. skill: `feature-spec` + `product-management:write-spec` · **แตะ personal data** (บัญชี, ข้อมูลผู้ซื้อจาก order, เอกสาร, notification, export, AI) → ใช้ `compliance-checklist` แนบ Compliance note ใน spec.
4. **Product Advisory (บังคับ):** product เสนอ best practice เชิงรุก — competitor/industry pattern, recommended approach + trade-off, ความเสี่ยง/edge ที่กระทบ money/stock/กฎทอง, ผลต่อ UX SME non-tech. skill: `product-management:competitive-brief` / `product-brainstorming`.
5. **เสนอ user:** สรุป AC + advisory note ให้ review.
6. **หยุดรอ ✋ sign-off — ห้ามเริ่ม Gate 2.** เมื่อ user เคาะ → สร้าง `docs/features/F-XXX/F-XXX.md` (สร้าง directory ถ้ายังไม่มี), set front-matter `status: G1✓`, `owner_now`.

กติกา: ไม่ตัดสิน scope/AC แทน user · คำถามนอกโดเมน = 🚧 BLOCKED route หา owner · decision ข้ามทีมที่ user เคาะ → log [docs/DECISIONS.md](../../docs/DECISIONS.md) (D-XXX).
