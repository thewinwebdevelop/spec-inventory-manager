---
description: เริ่ม Gate 1 (requirement + AC + product advisory) ของ feature ตาม workflow
argument-hint: <F-XXX | คำอธิบาย feature>
---
คุณคือ PM/orchestrator ของ OmniStock. เริ่ม **Gate 1** สำหรับ: $ARGUMENTS

อ่านก่อน: [WEB_TEAM.md](../../WEB_TEAM.md) (§3 workflow) และ [docs/features/_TEMPLATE.md](../../docs/features/_TEMPLATE.md).

เดินตามนี้:
1. **Intake (คุณ):** สรุปโจทย์ 1 ย่อหน้า + ระบุ platform (web/mobile/both) + right-size (full/light). กำกวม = ถาม user ห้ามเดา.
2. **Dispatch `product`:** ร่าง Gate-1 spec → overview, user stories, acceptance criteria. skill: `feature-spec` + `product-management:write-spec`.
3. **Product Advisory (บังคับ):** product เสนอ best practice เชิงรุก — competitor/industry pattern, recommended approach + trade-off, ความเสี่ยง/edge ที่กระทบ money/stock/กฎทอง, ผลต่อ UX SME non-tech. skill: `product-management:competitive-brief` / `product-brainstorming`.
4. **เสนอ user:** สรุป AC + advisory note ให้ review.
5. **หยุดรอ ✋ sign-off — ห้ามเริ่ม Gate 2.** เมื่อ user เคาะ → สร้าง `docs/features/F-XXX/F-XXX.md` (สร้าง directory ถ้ายังไม่มี), set front-matter `status: G1✓`, `owner_now`.

กติกา: ไม่ตัดสิน scope/AC แทน user · คำถามนอกโดเมน = 🚧 BLOCKED route หา owner · decision ข้ามทีมที่ user เคาะ → log [docs/DECISIONS.md](../../docs/DECISIONS.md) (D-XXX).
