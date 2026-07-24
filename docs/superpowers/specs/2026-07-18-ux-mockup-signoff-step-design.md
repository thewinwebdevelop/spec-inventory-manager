# Design — Gate 2 UX/UI Mockup Sign-off Step

> วันที่: 2026-07-18 · สถานะ: approved (brainstorming) · เจ้าของ process: PM + ux
> เป้าหมาย: แทรก step ทำ **mockup หน้าจอจริง (high-fidelity static HTML)** ให้ user
> เห็น + เซ็น **ก่อน build** เพื่อกันปัญหา "implement เสร็จแล้วของจริงไม่ตรงที่ต้องการ →
> เขียนใหม่เสียเวลา"

## 1. Problem

ทุกวันนี้ Gate 2 ฝั่ง UX ผลิต `ux-wireframe.md` (ASCII wireframe) + `ui.md` (visual
spec) แล้ว user เซ็นจาก **เอกสาร/กล่อง ASCII** — แต่ ASCII สื่อ layout ได้ ไม่สื่อ
"หน้าตาจริง". ผลคือเซ็นผ่าน แต่พอ frontend build เสร็จเห็นของจริงถึงรู้ว่าไม่ตรง →
rework. ต้นทุนของ misalignment ถูกจ่ายหลัง build แทนที่จะจ่ายก่อน

## 2. Solution (สรุป)

แทรก artifact ใหม่ใน Gate 2: **mockup HTML สมจริง ครบ state** ที่ user เปิดดูใน
เบราว์เซอร์แล้วเซ็น **แทนการเซ็นจาก ASCII**. mockup เก็บใน repo เป็น source of truth
และเป็น reference ที่ `frontend` ใช้ตอน build

**Decisions (จาก brainstorming 2026-07-18):**

| # | Decision | เลือก |
|---|----------|-------|
| D1 | Fidelity ของสิ่งที่ user เซ็น | **right-size ตามความเสี่ยงของ flow**: จอเดี่ยว/CRUD ง่าย = ภาพนิ่งครบ state · flow ซับซ้อน/หลายสเต็ป = **clickable prototype** (interactivity เป็น mock ล้วน ไม่ port) |
| D2 | Reuse seam ไป implement | **repo = source of truth + push component reuse ได้ เข้า Claude Design** |
| D3 | ASCII wireframe (`ux-wireframe.md`) | **ลดเป็น optional** — sketch โครงเร็ว ๆ ระหว่างคิด ไม่บังคับ; mockup HTML คือ artifact ที่ต้องเซ็น |
| D4 | copy ใน mockup | **i18n key ตั้งแต่แรก + `messages.th.json` แนบ** → implement = revise text config อย่างเดียว |

## 3. ตัว mockup — spec

- **รูปแบบ:** ไฟล์ HTML static, self-contained (inline CSS/JS, ไม่มี external fetch)
- **สร้างบน design system กลาง:** ใช้ tokens/component จาก `docs/design-system.md` +
  `thai-ux` — ห้ามตีสไตล์ one-off; หน้าตา = ของจริง
- **copy = i18n key ตั้งแต่แรก (ไม่ hardcode):** mockup อ้าง copy ทุกจุดเป็น **i18n key**
  แล้ว render เป็นค่าไทยผ่าน **text config แนบข้าง** `docs/features/F-XXX/mockup/messages.th.json`
  (key → ค่าไทย). ผลตอน implement: frontend เอา `messages.th.json` ไปต่อระบบ i18n จริงตรง ๆ →
  **revise แค่ text config ไม่ต้องรื้อ markup**. ตรงกับ design-system §3 (key-based, default ไทย)
- **ครบทุก state ต่อจอ:** empty / loading / error / success วางเป็น frame ติดป้ายกำกับ
  ในหน้าเดียว (เลื่อนดู/วางเทียบได้) — ตรงกับ Gate D "ครบทุก state"
- **ยึดความจริงของโมเดล:** ไม่ทำให้ SellableSku ดูเหมือนมีสต๊อกเอง, stock edit = "บันทึก
  movement" ไม่ใช่ "ทับตัวเลข" (เหมือนกฎ ux เดิม)
- **fidelity right-size ตามความเสี่ยง (D1) — 2 tier:**
  - **Static** (default): จอเดี่ยว/CRUD ง่าย → หลายจอ/หลาย state วางเป็น frame ติดป้าย
    ตอบ "หน้าตาถูกไหม / ครบ state ไหม"
  - **Clickable prototype**: flow ซับซ้อน/หลายสเต็ป (wizard, connector OAuth, bulk action
    หลายขั้น) → กดเดินผ่าน flow ได้จริงด้วย **inline JS + state mock (hardcode ไม่ต่อ
    backend)** ตอบ "**ลำดับ/flow ลื่นไหม**". **interactivity เป็น mock ล้วน — frontend
    ไม่ port JS ปลอม** ใช้แค่ flow intent + markup + state. ux เลือก tier ตอนทำ mockup
    (เหมือน full/light) — ไม่ทำ clickable กับจอที่ static ก็พอ (กันลงแรงกับของทิ้ง)

### 3.1 Platform (web vs Flutter)

mockup เป็น HTML → ตรงกับ **web** โดยธรรมชาติ. สำหรับ feature tag `mobile`/`both`
mockup HTML ทำหน้าที่เป็น **visual + flow intent** ที่ Flutter ยึด — frontend แปล
layout+token เป็น Flutter widget เอง (ตรงกับกฎเดิม "Claude Design → Flutter: port ได้แค่
token"). ไม่ทำ mockup แยกสอง platform เว้นแต่ layout ต่างกันจริงจนจอเดียวสื่อไม่ได้

## 4. ที่เก็บ + การดู + reuse seam

- **repo (source of truth):** `docs/features/F-XXX/mockup/` — commit ลง git พร้อมเอกสาร
  Gate 2 ตัวอื่น. เป็น artifact ที่ user เซ็น และเป็น reference ที่ `frontend` อ่านตรงตอน build
- **วิธี user ดูเพื่อเซ็น:** publish ไฟล์เดียวกันเป็น **Artifact** (หน้า hosted, เปิดลิงก์
  ได้เลย ไม่ต้องรัน server, แชร์ได้) — โหลด skill `artifact-design` ก่อนสร้างเสมอ
- **push เข้า Claude Design (D2):** เฉพาะ **component ใหม่ที่ reuse ได้** ที่ mockup
  แนะนำ → contribute-back ผ่าน `/design-sync` + `DesignSync` (ตรงกับ design-system §6
  reuse-first/contribute-back — แค่เลื่อน trigger มาเกิดตอนทำ mockup). **หน้าจอเฉพาะ
  feature ไม่ push** — อยู่ใน repo อย่างเดียว

## 5. Workflow integration

### 5.1 ตำแหน่งใน Gate 2

```
data-model → api-spec → [ux-wireframe.md (ASCII optional) + ui.md]
  → 🆕 mockup HTML (docs/features/F-XXX/mockup/) → ux-heuristic-review บน mockup
  → publish Artifact → ✋ user เซ็นจากหน้าจอที่ render → commit → build
```

### 5.2 Ownership

- **`ux` เป็นเจ้าของ mockup** (visual authority) — เขียน HTML บน design system, copy ไทย
- **`frontend` เป็น consult** — ยืนยันว่า port ได้จริง (web ตรง / Flutter แปลได้), flag
  ถ้า mockup วาด layout ที่ implement ไม่ไหว **ก่อน** เซ็น (ไม่ใช่ไปเจอตอน build)
- **`ux-heuristic-review`** (skill เดิม) รันบน mockup ที่ render แล้วด้วย ไม่ใช่แค่ ASCII

### 5.3 Right-size

feature **light** (CRUD ภายในเล็ก, แก้ UI เล็ก) → mockup ทำเฉพาะจอที่เปลี่ยน/จอใหม่ ไม่
ต้องครบทั้ง feature. feature **full** → ครบทุกจอหลัก × ทุก state. gate ต้องไม่หนักถ่วงงานง่าย

## 6. Deliverables — ไฟล์ที่ต้องแก้/สร้าง

> ทั้งหมดเป็น **protected paths** (WEB_TEAM/.claude/**/docs canon) → PM/user แก้เท่านั้น

1. **สร้าง skill `ux-mockup`** (`.claude/skills/ux-mockup/SKILL.md`, ≤100 บรรทัด) —
   วิธีทำ mockup สมจริงบน design system: **เลือก tier (static vs clickable) ตามความเสี่ยง flow**,
   โครง HTML, ใช้ token กลาง, layout frame ต่อ state, clickable = inline JS + mock state
   (ไม่ port), copy เป็น i18n key + `messages.th.json`, model-truth checklist, publish Artifact,
   เกณฑ์ sign-off, เมื่อไหร่ push component
   เข้า Claude Design. (เหตุผลที่เป็น skill: §3.8 rule-budget — กติกาใหม่ลง skill ไม่ใช่ CLAUDE.md)
2. **`WEB_TEAM.md`** — (a) §3.2 เพิ่ม mockup ในลำดับ artifact Gate 2 · (b) §3.3 RACI แถว
   "G2 UX/UI" ระบุ mockup (ux=A/R, frontend=C) · (c) Gate D checklist เพิ่มบรรทัด mockup +
   แก้บรรทัด ASCII wireframe เป็น optional
3. **`.claude/agents/ux.md`** — เพิ่ม mockup เป็น artifact ที่ ux เป็นเจ้าของ + working method
   ข้อใหม่ + skill `ux-mockup`; ปรับ standing rule ASCII เป็น optional
4. **`.claude/commands/gate2.md`** — เพิ่ม mockup ใน output ของ ux + ลำดับก่อน sign-off
5. **`docs/SKILL_MAP.md`** — Gate 2 table เพิ่มแถว `ux-mockup` (owner ux)
6. **`docs/features/_TEMPLATE.md`** + template `docs/features/_gate2/` — เพิ่ม mockup artifact
   ในโครง Gate 2

## 7. Acceptance criteria

- [ ] มี skill `ux-mockup` (≤100 บรรทัด) อธิบายวิธีทำ + เกณฑ์ sign-off ครบ
- [ ] Gate 2 flow ใน WEB_TEAM.md แสดง mockup step ก่อน user sign-off ชัดเจน
- [ ] Gate D checklist: mockup เป็น required artifact (right-sized), ASCII เป็น optional
- [ ] ux.md + gate2.md ระบุ ux เป็นเจ้าของ mockup + frontend เป็น consult ก่อนเซ็น
- [ ] `_TEMPLATE.md`/`_gate2` มีช่อง mockup
- [ ] reuse seam ชัด: repo = source of truth (`docs/features/F-XXX/mockup/`), push เฉพาะ
      component reuse ได้ เข้า Claude Design
- [ ] ไม่มีเอกสารไหนยัง "บังคับ" ASCII wireframe (consistency กับ D3)
- [ ] mockup ใช้ i18n key + มี `messages.th.json` แนบ → implement = revise text config อย่างเดียว
- [ ] skill ระบุเกณฑ์เลือก tier: static (จอง่าย) vs clickable prototype (flow ซับซ้อน), interactivity = mock ไม่ port

## 8. Non-goals (YAGNI)

- ❌ Clickable prototype กับจอ static ง่าย ๆ (ใช้เฉพาะ flow ซับซ้อน — D1)
- ❌ port โค้ด interactivity/JS ปลอม จาก prototype ไป production (เป็น mock ล้วน)
- ❌ Mockup แยกต่อ platform (web/Flutter) เว้นแต่ layout ต่างจริง
- ❌ Figma / external design tool integration
- ❌ push หน้าจอเฉพาะ feature เข้า Claude Design (push เฉพาะ component reuse ได้)
- ❌ auto-generate production code จาก mockup (frontend ยัง build เอง โดยใช้ mockup เป็น ref)
