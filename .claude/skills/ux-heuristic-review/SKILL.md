---
name: ux-heuristic-review
description: >-
  Self-review pass the ux agent runs on its own wireframes/UI specs BEFORE
  presenting them to the user — an SME-persona walkthrough plus a heuristic
  checklist. Use after drafting ux-wireframe.md / ui.md for any feature, and
  after major revisions. Catches flow dead-ends, jargon, missing states, and
  model-truth violations while they're cheap. Owned by ux.
---

# UX heuristic review — walk it as แม่ค้า, not as the designer

The user signing off is non-technical and trusts our judgment; this pass is
the quality bar they can't check themselves. Run it **every time before
presenting** a UX doc — findings fixed first, then present.

## Part 1 — SME persona walkthrough
Persona: **เจ้าของร้านไทยที่ไม่เคยใช้ ERP, ขายบน Shopee, ใช้มือถือเป็นหลัก,
ใจร้อนตอนของกำลังจะหมด**. Walk every screen in the wireframe, in flow order,
asking at each step:
1. เปิดจอนี้มา **รู้ไหมว่าต้องทำอะไรต่อ** โดยไม่ต้องอ่านคู่มือ? (primary action ชัดเดียว)
2. **ศัพท์ทุกคำ** เป็นคำที่แม่ค้าใช้จริงไหม — ตรง glossary ใน `thai-ux`?
   (ห้ามสองคำไทยสำหรับ concept เดียว, ห้าม jargon ดิบ: SKU/sync/token ต้องมีคำไทยกำกับตามที่ glossary กำหนด)
3. ถ้า**กดผิด/พิมพ์ผิด** ตรงนี้ จะรู้ตัวยังไง แก้ยังไง — เส้นทางกู้คืนมีจริงไหม?
4. ถ้า**ข้อมูลยังไม่มี / โหลดช้า / เน็ตหลุด** จอนี้หน้าตาเป็นยังไง (4 states)?
5. จอนี้**ตอบ AC ข้อไหน** — มีจอ/ปุ่มที่ไม่ map กับ AC ไหม (scope creep)?

## Part 2 — heuristic checklist
- [ ] ครบ 4 states ทุกจอ (loading=skeleton, empty=CTA, error=สาเหตุ+ทางแก้,
      success) ตาม design-system §2 — copy ไทยจริง ไม่ใช่ placeholder.
- [ ] ไม่มี dead-end: ทุก error/empty มีทางไปต่อ; ปุ่ม back/cancel ไม่ทิ้งงานเงียบๆ.
- [ ] Destructive action: confirm ที่**บอกผลลัพธ์จริง** ("ลบแล้วย้อนกลับไม่ได้")
      ไม่ใช่ "แน่ใจหรือไม่".
- [ ] **Model truth** ไม่ถูกบิด: SellableSku ไม่มีสต๊อกตัวเอง (แสดงเป็นค่าคำนวณ),
      แก้สต๊อก = บันทึก movement ไม่ใช่ทับตัวเลข, org context ชัดเสมอ.
- [ ] จำนวน step ของ task หลัก = น้อยที่สุดที่ยังปลอดภัย; field ที่ขอ = จำเป็นจริง.
- [ ] Reuse-first: component ซ้ำกับ design system กลางไหม — ถ้าสร้างใหม่
      มีเหตุผล + จะ contribute-back.
- [ ] Mobile/web ต่างกันเฉพาะที่ประกาศไว้; ไม่มี interaction ที่ทำไม่ได้บนจอเล็ก.
- [ ] Wireframe ประกบรายละเอียดต่อจอ (standing rule) ครบทุกจอ.

## Output (append to ux-wireframe.md before presenting)
```
## UX self-review (ux-heuristic-review) — YYYY-MM-DD
| # | จอ/จุด | Finding | Fix ที่ทำแล้ว |
|---|--------|---------|----------------|
Persona walkthrough: <ผ่าน/สะดุดตรงไหน — 2-3 บรรทัด>
Unresolved (ถ้ามี — ต้องบอก user ตรงๆ): <ข้อที่แก้ไม่ได้เพราะ constraint + เหตุผล>
```
Fix everything fixable **before** presenting; what remains goes to the user as
an honest note, not buried. If a finding traces to AC ambiguity → escalate to
`product`; to a missing API field → `backend-api`. Don't design around it
silently.
