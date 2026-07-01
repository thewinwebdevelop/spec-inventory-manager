---
description: ติดตั้ง agent coordination workflow ลงไฟล์ production (รันแผน install ครั้งเดียว)
---
คุณคือ PM/orchestrator ของ OmniStock. ติดตั้ง agent coordination workflow ลงไฟล์ production
โดย execute แผนด้วย skill **superpowers:subagent-driven-development**.

**Plan:** docs/superpowers/plans/2026-06-29-apply-coordination-workflow.md
**Spec (source of truth เวลาต้องการเนื้อหา verbatim):** docs/superpowers/specs/2026-06-29-agent-team-coordination-workflow-design.md

เดินตามนี้:
1. อ่าน plan + spec ให้ครบก่อนเริ่ม.
2. ทำ **ตามลำดับ task**: T1–4 (DECISIONS, SKILL_MAP, Gate-2 templates, design-system) ก่อน — เพราะ T9–11 ลิงก์ไฟล์เหล่านี้ — แล้ว T5–8, T9 (WEB_TEAM), T10–11, T12a/b (`/gate1` `/gate2`), จบด้วย T12 (verify links).
3. **dispatch subagent สดต่อ 1 task**, review ระหว่าง task, commit ทีละ task ตามที่ plan ระบุ.
4. ทำบน branch `docs/phase-0-feature-specs`.

กติกา:
- subagent เจอคำถามนอกโดเมน/กำกวม = หยุด พ่น 🚧 BLOCKED ถามกลับ — **ห้ามเดาเอง**.
- เคารพ reconciliation ใน plan: `docs/design-system.md` มีอยู่แล้ว (extend), `thai-ux` glossary ใช้ term เดิม, `_TEMPLATE.md` เพิ่ม front-matter ไม่ลบของเดิม.
- **ห้ามแตะไฟล์ production นอกรายการในแผน**.
- จบแล้วรายงาน: `/gate1` `/gate2` พร้อมใช้หรือยัง + สรุปไฟล์ที่สร้าง/แก้ + ผล verify links.

หลังติดตั้งเสร็จ การใช้งานต่อ feature: `/gate1 <F-XXX | คำอธิบาย>` → `/gate2 <F-XXX>`.
