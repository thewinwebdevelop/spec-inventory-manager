# Apply Agent Team Coordination Workflow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ผลิตไฟล์ production ที่ทำให้ workflow coordination ใน spec มีผลจริง (PM loop, RACI, Decision Ledger, task board, per-feature Gate-2 docs, QA 2-track, UX friendliness, skill map).

**Architecture:** งานเอกสารล้วน — ไม่มีโค้ด/เทสต์รันไทม์. แหล่งเนื้อหา verbatim = spec ที่ commit แล้ว `docs/superpowers/specs/2026-06-29-agent-team-coordination-workflow-design.md` (อ้างเป็น **SPEC §x** ในแต่ละ task). สร้างไฟล์ reference ก่อน (Phase A) แล้วค่อยแก้ hub docs ที่ลิงก์ไปหามัน (Phase C) เพื่อไม่ให้ลิงก์เสีย.

**Tech Stack:** Markdown docs + YAML front-matter. ตรวจด้วย `git`, `grep`, `ls`.

## Global Constraints
- ภาษา: prose ไทย · identifier/field/path อังกฤษ (WEB_TEAM Language policy) — คงสไตล์ไฟล์เดิม
- ห้ามแก้ไฟล์ production นอกรายการนี้ · commit ทีละ task · ทำบน branch `docs/phase-0-feature-specs`
- อ้างเนื้อหาจาก SPEC โดย **copy ข้อความ/ตาราง verbatim** จาก section ที่ระบุ — อย่าคิดใหม่
- ลิงก์ภายในทุกอันต้อง resolve (task สุดท้ายตรวจ)
- **Reconciliation ที่ต้องเคารพ** (ไฟล์เดิมมีของอยู่แล้ว):
  - `docs/design-system.md` **มีอยู่แล้ว** → extend เท่านั้น
  - `thai-ux/SKILL.md` มี glossary concept→Thai อยู่แล้ว (`Sellable SKU → รายการขาย (SKU)`) → **ใช้ term เดิม** ห้ามใส่ term ใหม่ที่ชนกัน
  - `_TEMPLATE.md` มี prose status อยู่แล้ว → เพิ่ม YAML front-matter คู่กัน ไม่ลบของเดิม

---

### Task 1: Decision Ledger — `docs/DECISIONS.md`

**Files:**
- Create: `docs/DECISIONS.md`

**Interfaces:**
- Produces: ไฟล์ที่ WEB_TEAM / README / CLAUDE / task 9–11 จะลิงก์ไปหา (`docs/DECISIONS.md`)

- [ ] **Step 1: เขียนไฟล์** เนื้อหาจาก **SPEC §3.B** (format block + กติกา append-only) + เพิ่ม header อธิบายและ seed entry `D-000`:

```md
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
```

- [ ] **Step 2: verify** — `ls docs/DECISIONS.md` และ `grep -c "^### D-" docs/DECISIONS.md` ต้องได้ ≥1
- [ ] **Step 3: commit**

```bash
git add docs/DECISIONS.md
git commit -m "docs: add Decision Ledger (D-XXX) append-only decision log"
```

---

### Task 2: Skill Map — `docs/SKILL_MAP.md`

**Files:**
- Create: `docs/SKILL_MAP.md`

**Interfaces:**
- Produces: `docs/SKILL_MAP.md` (README task 10 จะชี้มาแทนตาราง skill เดิม)

- [ ] **Step 1: เขียนไฟล์** — copy **verbatim** จาก **SPEC §6 (Skill Map)** ทั้งหมด **และ** **SPEC §7 (Skill Map แยกรายทีม)** จาก console summary… ใช้เวอร์ชันใน SPEC เป็นหลัก. โครงไฟล์:

```md
# Skill Map — step × team × skill (สาย superpowers)

> agent เรียก skill ผ่าน Skill tool · **core** = ใช้ทุกครั้ง · **sit** = เมื่อเข้าเงื่อนไข
> default line = superpowers (เลิกใช้ tdd/debug-mantra/diagnosing-bugs ใน flow หลัก)
> คู่กับ [WEB_TEAM.md](../WEB_TEAM.md) (ใคร decide) และ [.claude/agents/README.md](../.claude/agents/README.md)

<< วางเนื้อหาจาก SPEC §6 ทั้งหมด: PM/Orchestrator, Portfolio, Gate 1, Gate 2,
   Build, QA, Release, DevOps, On-demand utility — copy ตารางมาตรง ๆ >>
```

  เนื้อหาที่ต้อง copy อยู่ใน SPEC §6 (ตารางครบทุกด่าน) — คัดมาให้ครบ ไม่ตัด
- [ ] **Step 2: verify** — `grep -c "superpowers:" docs/SKILL_MAP.md` ≥5 และมีหัวข้อครบ: `grep -E "Portfolio|Gate 1|Gate 2|Build|QA|Release|DevOps" docs/SKILL_MAP.md`
- [ ] **Step 3: commit**

```bash
git add docs/SKILL_MAP.md
git commit -m "docs: add full skill map (step x team x skill, superpowers line)"
```

---

### Task 3: Gate-2 doc templates — `docs/features/_gate2/`

**Files:**
- Create: `docs/features/_gate2/architecture.md`
- Create: `docs/features/_gate2/data-model.md`
- Create: `docs/features/_gate2/api-spec.md`
- Create: `docs/features/_gate2/ux-wireframe.md`
- Create: `docs/features/_gate2/ui.md`
- Create: `docs/features/_gate2/test-plan.md`
- Create: `docs/features/_gate2/tasks.md`

**Interfaces:**
- Consumes: Gate-2 section content จาก `docs/features/_TEMPLATE.md` §5–§11 (แยกออกมาเป็นไฟล์ต่อทีม) + **SPEC §2.2** (directory layout) + **SPEC §3.F** (task board format)
- Produces: ชุด template ที่ทุก feature Gate-2 คัดไปใส่ `docs/features/F-XXX/`

- [ ] **Step 1: architecture.md** (owner: backend-api, full only) — คัดหัวข้อจาก `_TEMPLATE.md` §5 (Sync strategy / Idempotency / Rate-limit-retry / Reconciliation / Mapping) ใส่ front-matter:

```md
---
doc: architecture
owner: "@backend-api"
signoff: pending      # pending | approved
---
# [F-XXX] Architecture / Technical design  (เฉพาะ full)
<< หัวข้อจาก _TEMPLATE.md §5 >>
```

- [ ] **Step 2: data-model.md** (owner: backend-api) — จาก `_TEMPLATE.md` §6, front-matter `doc: data-model` `owner: "@backend-api"`
- [ ] **Step 3: api-spec.md** (owner: backend-api) — จาก `_TEMPLATE.md` §7 (ตาราง endpoint + schema), front-matter `doc: api-spec` `owner: "@backend-api"`
- [ ] **Step 4: ux-wireframe.md** (owner: ux) — จาก `_TEMPLATE.md` §8, front-matter `doc: ux-wireframe` `owner: "@ux"`
- [ ] **Step 5: ui.md** (owner: ux) — จาก `_TEMPLATE.md` §9 + เพิ่มบรรทัด "reuse design system กลางก่อน; ของใหม่ contribute-back (ดู [docs/design-system.md](../../design-system.md))", front-matter `doc: ui` `owner: "@ux"`
- [ ] **Step 6: test-plan.md** (owner: qa) — จาก `_TEMPLATE.md` §11, front-matter `doc: test-plan` `owner: "@qa"`
- [ ] **Step 7: tasks.md** — copy task board **block format verbatim จาก SPEC §3.F** (block ต่อ task + ฟิลด์ `desc`/`ref`/`deps`/`status`/`updated_by` + กติกา):

```md
# [F-XXX] Task Board
> เจ้าของ task update status ของตัวเอง (`todo→in_progress→done`) + ลงชื่อ updated_by
> PM ดูบอร์ด → dispatch task ที่ deps=done ครบ · ดู [WEB_TEAM.md](../../../WEB_TEAM.md)

## T-XXX-01 · <team> · <ชื่อสั้น>
- desc: <ทำอะไรคร่าวๆ 1 บรรทัด>
- ref: <เอกสาร Gate-2 ที่ต้องอ้างอิง เช่น api-spec.md, data-model.md, ux-wireframe.md>
- deps: <T-… / G2✓ / —>   · status: todo   · updated_by: —
```

- [ ] **Step 8: verify** — `ls docs/features/_gate2/` เห็นครบ 7 ไฟล์ · `grep -l "signoff: pending" docs/features/_gate2/*.md | wc -l` = 6
- [ ] **Step 9: commit**

```bash
git add docs/features/_gate2/
git commit -m "docs: add per-team Gate-2 doc templates + task board template"
```

---

### Task 4: Central design system — extend `docs/design-system.md`

**Files:**
- Modify: `docs/design-system.md` (append section)

**Interfaces:**
- Consumes: existing `docs/design-system.md` (มี §1–§5 อยู่แล้ว)
- Produces: reuse/contribute-back rule ที่ ux.md / _gate2/ui.md อ้าง

- [ ] **Step 1: append section** — เพิ่มท้ายไฟล์ เนื้อหาจาก **SPEC §8.A**:

```md
## 6. Reuse-first & contribute-back (central design system)
design system นี้เป็นของ **กลาง 1 ชุด ไม่ใช่ต่อ feature** — โตขึ้นเรื่อย ๆ
- **แหล่งความจริงเดียว:** Claude Design project (visual) + ไฟล์นี้ (spec/usage) + `thai-ux` tokens (code) — ux ดูแลให้ sync กัน
- **reuse-first:** ทุก feature เช็ค component/token ที่ reuse ได้ก่อน — ห้ามสร้างซ้ำ/one-off
- **contribute-back:** ต้องการของใหม่ → ux เพิ่มเข้า design system กลาง (ไม่ฝังเฉพาะ feature) → feature หลัง reuse
- task design ใน Gate 2 มี 2 แบบ: `reuse` หรือ `add ใหม่เข้า design system`
- token เปลี่ยนแบบ breaking → ux แจ้ง frontend + log D-XXX
- **Claude Design → Flutter:** port ได้แค่ token; component HTML ต้องแปลเป็น Flutter widget เอง
```

- [ ] **Step 2: verify** — `grep -c "contribute-back" docs/design-system.md` ≥1
- [ ] **Step 3: commit**

```bash
git add docs/design-system.md
git commit -m "docs: add reuse-first + contribute-back rule to design system"
```

---

### Task 5: Feature template — `docs/features/_TEMPLATE.md`

**Files:**
- Modify: `docs/features/_TEMPLATE.md:1` (add front-matter above `# [F-XXX]`)

- [ ] **Step 1: เพิ่ม YAML front-matter** ที่บรรทัดแรกสุด (เหนือ `# [F-XXX] <ชื่อ feature>`):

```md
---
status: draft        # draft→G1→G1✓→G2→G2✓→build→qa✓→release→done
owner_now: "@product"
waiting_on: null     # เช่น "D-007 (product)" หรือ null
platform: both       # web | mobile | both
size: full           # full | light
---
```

- [ ] **Step 2: เพิ่มโน้ต Gate 2 directory** — ใต้บรรทัด `# ══ Gate 2 — Design ══` เพิ่ม 1 บรรทัด:
  `> feature full: แยกเอกสาร Gate 2 เป็นไฟล์ต่อทีมใน docs/features/F-XXX/ (คัดจาก docs/features/_gate2/) — sign off ทีละฉบับ`
- [ ] **Step 3: verify** — `head -8 docs/features/_TEMPLATE.md | grep -c "status:"` = 1
- [ ] **Step 4: commit**

```bash
git add docs/features/_TEMPLATE.md
git commit -m "docs: add status front-matter + Gate-2 directory note to feature template"
```

---

### Task 6: thai-ux skill — friendliness + reconcile glossary

**Files:**
- Modify: `.claude/skills/thai-ux/SKILL.md` (append 2 sections after existing glossary §"Terminology glossary")

**Interfaces:**
- Consumes: existing glossary (concept→Thai) — **ต้องใช้ term เดิม** (`Sellable SKU → รายการขาย (SKU)`)

- [ ] **Step 1: เพิ่ม Friendliness checklist** — จาก **SPEC §7.A** (ปรับให้ไม่ซ้ำ voice/tone ที่มีอยู่):

```md
## Friendliness checklist (SME ไทยไม่สาย tech — ผ่านทุกข้อก่อนปิด UX)
- ภาษาคน ไม่ใช่ภาษาระบบ — ห้ามโชว์ identifier ดิบ (SellableSku/StockMovement) ใช้ term ใน glossary
- progressive disclosure — ซ่อนความซับซ้อน ขยายเมื่อผู้ใช้ขอ
- default ฉลาด — ลดการตัดสินใจ/การกรอก
- forgiving — undo / ยืนยันก่อนทำสิ่งย้อนไม่ได้ / กันพลาด
- ทุก state บอก "ขั้นต่อไป" ไม่ใช่แค่บอกว่าเกิดอะไร
- mobile-first — ปุ่มใหญ่พอแตะ
```

- [ ] **Step 2: เพิ่ม Reconcile rule** — จาก **SPEC §7.C**:

```md
## Friendly ปะทะ "UI พูดความจริงของโมเดล" — reconcile
**friendly = แปลความจริงให้เข้าใจง่าย ไม่ใช่ปิดบัง/โกหก**
เช่น available = min(floor(item.available/qty)) → แสดง "ขายได้อีก 12 ชิ้น" + แตะดู *ทำไม* ได้
(ห้ามซ่อนความจริงจนผู้ใช้เข้าใจผิดเรื่องสต๊อก/เงิน)
```

- [ ] **Step 3: เพิ่ม 1 คอลัมน์ใน glossary เดิม** — ที่ตาราง "Terminology glossary" เพิ่มแถวสำหรับ identifier ที่ห้ามโชว์ดิบ โดย **ใช้ Thai term เดิม** (ห้ามใส่ term ใหม่ที่ชนของเดิม):
  - `InventoryItem (raw)` มีแล้ว (`วัตถุดิบ/ชิ้นส่วน`) — คงไว้
  - เพิ่มเฉพาะที่ยังไม่มี เช่น `ChannelListing → สินค้าบนช่องทาง (Shopee/…)`, `sync failed → อัปเดตไปช่องทางไม่สำเร็จ`
- [ ] **Step 4: verify** — `grep -c "Friendliness checklist" .claude/skills/thai-ux/SKILL.md` = 1 · `grep -c "รายการขาย (SKU)" .claude/skills/thai-ux/SKILL.md` ≥1 (term เดิมยังอยู่)
- [ ] **Step 5: commit**

```bash
git add .claude/skills/thai-ux/SKILL.md
git commit -m "docs(thai-ux): add friendliness checklist + friendly-not-lying rule"
```

---

### Task 7: ux agent — north-star + design system reuse

**Files:**
- Modify: `.claude/agents/ux.md` (add to "Design constraints" + "Working method" + "Skills")

- [ ] **Step 1: เพิ่ม north-star** — ใต้หัวข้อ `## Design constraints from the domain` เพิ่ม bullet แรก:
  `- **Target user = SME ไทยไม่เก่ง tech** — ทุก flow ผ่านเกณฑ์ "แม่ค้าไม่เคยใช้ ERP เปิดมาใช้เป็นโดยไม่ต้องอ่านคู่มือ, ไม่ยาก/ซับซ้อนเกินไป". friendly = แปลความจริงให้ง่าย ไม่ใช่ปิดบัง (ดู skill thai-ux)`
- [ ] **Step 2: เพิ่ม central design system** — ใต้ bullet visual design ใน `## You DECIDE` เพิ่ม:
  `- **Central design system กลาง 1 ชุด**: feature reuse-first; ของใหม่ contribute-back เข้า [docs/design-system.md](../../docs/design-system.md). Claude Design → sync ผ่าน DesignSync (web ตรง, Flutter ได้แค่ token).`
- [ ] **Step 3: เพิ่ม skill** — ที่ `## Skills` เพิ่ม:
  `- \`/design-sync\` + \`DesignSync\` — sync Claude Design ↔ repo component library (ร่วมกับ frontend).`
- [ ] **Step 4: verify** — `grep -c "SME ไทย" .claude/agents/ux.md` ≥1 · `grep -c "design-sync" .claude/agents/ux.md` ≥1
- [ ] **Step 5: commit**

```bash
git add .claude/agents/ux.md
git commit -m "docs(ux): add SME non-tech north-star + central design system"
```

---

### Task 8: product agent — Gate-1 Advisory

**Files:**
- Modify: `.claude/agents/product.md` (add to "Working method" step + "Skills")

- [ ] **Step 1: เพิ่ม Advisory step** — ใน `## Working method` ที่ "Per feature (Gate 1…)" แทรกเป็นข้อ 2.5 (ระหว่าง draft AC กับ get sign-off):
  `2.5. **Product Advisory (บังคับ):** เสนอ best practice เชิงรุกให้ user ก่อนเคาะ AC — competitor/industry pattern, recommended approach + trade-off, ความเสี่ยง/edge ที่กระทบ money/stock/กฎทอง, ผลต่อ UX SME non-tech. สรุปเป็น advisory note ใน Gate-1 spec; recommendation ที่ cross-cutting → log D-XXX.`
- [ ] **Step 2: เพิ่ม skill** — ที่ `## Skills` เพิ่ม:
  `- \`product-management:competitive-brief\` / \`product-management:product-brainstorming\` — Gate-1 advisory (best practice + ตัวเลือก+trade-off).`
- [ ] **Step 3: verify** — `grep -c "Advisory" .claude/agents/product.md` ≥1
- [ ] **Step 4: commit**

```bash
git add .claude/agents/product.md
git commit -m "docs(product): add mandatory Gate-1 best-practice advisory"
```

---

### Task 9: WEB_TEAM.md — rewrite workflow + gates (hub)

**Files:**
- Modify: `WEB_TEAM.md` §2 (escalation), §3 (workflow), §4 (Gate D/E)

**Interfaces:**
- Consumes: SPEC §2 (PM loop), §2.1 (advisory), §2.2 (Gate-2 doc flow), §3.A–§3.F, §3.5 (build), §4 (QA 2-track), §7 (UX friendly)
- Produces: hub ที่ลิงก์ไป DECISIONS / SKILL_MAP / design-system

- [ ] **Step 1: §2 เพิ่ม Tie-break ladder** — ใต้ "Escalation protocol" (หลัง code block BLOCKED) แทรกจาก **SPEC §3.C**:

```md
**Tie-break ladder** (2 owner ขัดกัน): 1) ในโดเมนใคร→คนนั้น · 2) scope/กฎธุรกิจ→product ·
3) feasibility/contract→backend-api · 4) trade-off ไม่มีเจ้าของ→PM สรุป options ส่ง user
ทุกการ resolve → log ที่ [docs/DECISIONS.md](docs/DECISIONS.md)
```

- [ ] **Step 2: §3 แทรก PM Loop** — ใต้ header "## 3. Workflow" ก่อน "### Portfolio" แทรกบล็อก PM Loop จาก **SPEC §2** (ตาราง ①–⑥) + ประโยค "PM = orchestrator; ไม่มี agent เดาแทน"
- [ ] **Step 3: §3 แทรก Gate-2 doc flow** — ในส่วน Per-feature ที่ "Gate 2 — Design" แทน bullet เดิมด้วยเนื้อหา **SPEC §2.2** (directory ต่อ feature + แต่ละทีม gen doc + sign off ทีละฉบับ) — คง right-size note เดิม
- [ ] **Step 4: §3 แทรก RACI + Task Breakdown + Concurrency** — เพิ่มหัวข้อย่อยหลัง workflow diagram: ตาราง RACI (**SPEC §3.A**), Task Breakdown/T-XXX + live tracking (**SPEC §3.F**), Concurrency lane (**SPEC §3.E**)
- [ ] **Step 5: §3 เพิ่ม §3.5 Build execution** — คัด **SPEC §3.5** (BE∥devops→FE + กติกาเหล็ก)
- [ ] **Step 6: เพิ่ม §3.6 QA automation** — คัด **SPEC §4** (pyramid + pipeline 4 จุด + Track 1 scripted gate / Track 2 Browser Use scheduled)
- [ ] **Step 7: §4 Gate D** — เพิ่มข้อ: "ผ่าน Friendliness checklist (thai-ux) + ไม่มี jargon ดิบ + reuse design system กลาง"
- [ ] **Step 8: §4 Gate E** — เพิ่มข้อ: "CI (unit+contract+integration+E2E-scripted) เขียว = hard gate ก่อน merge; Track 2 Browser Use (scheduled) เป็น report ไม่บล็อก"
- [ ] **Step 9: §อ้างอิง** — เพิ่มลิงก์ `docs/DECISIONS.md` และ `docs/SKILL_MAP.md`
- [ ] **Step 10: verify** — `grep -E "PM Loop|RACI|Task Breakdown|Tie-break|Browser Use|DECISIONS|SKILL_MAP" WEB_TEAM.md | wc -l` ≥6
- [ ] **Step 11: commit**

```bash
git add WEB_TEAM.md
git commit -m "docs: rewrite workflow with PM loop, RACI, Gate-2 doc flow, task board, QA 2-track"
```

---

### Task 10: agents/README.md — point to skill map + ledger

**Files:**
- Modify: `.claude/agents/README.md` ("Skills" section)

- [ ] **Step 1: แทนตาราง Skills เดิม** — เก็บย่อหน้าอธิบาย "skills define how", แทนตาราง 5 แถวด้วยประโยค:
  `ตารางเต็ม step × team × skill อยู่ที่ [docs/SKILL_MAP.md](../../docs/SKILL_MAP.md). สาย default = superpowers.`
- [ ] **Step 2: เพิ่มลิงก์ Decision Ledger** — ใน "Escalation protocol" เพิ่มบรรทัด:
  `การ resolve ทุกครั้ง PM log ที่ [docs/DECISIONS.md](../../docs/DECISIONS.md) (append-only).`
- [ ] **Step 3: verify** — `grep -c "SKILL_MAP.md" .claude/agents/README.md` ≥1 · `grep -c "DECISIONS.md" .claude/agents/README.md` ≥1
- [ ] **Step 4: commit**

```bash
git add .claude/agents/README.md
git commit -m "docs(agents): point skills to SKILL_MAP + link Decision Ledger"
```

---

### Task 11: CLAUDE.md — wire the new docs

**Files:**
- Modify: `CLAUDE.md` ("วิธีทำงาน: feature-driven" section)

- [ ] **Step 1: เพิ่มลิงก์ + วิธีเรียก** — ใต้ส่วน "วิธีทำงาน: feature-driven" เพิ่ม 1 บรรทัด:
  `เริ่มงาน: **/gate1 \<F-XXX\>** (req+AC+advisory) → **/gate2 \<F-XXX\>** (เอกสารต่อทีม+task) · decision → [docs/DECISIONS.md](docs/DECISIONS.md) · skill ต่อ step → [docs/SKILL_MAP.md](docs/SKILL_MAP.md)`
- [ ] **Step 2: verify** — `grep -c "DECISIONS.md" CLAUDE.md` ≥1 · `grep -c "SKILL_MAP.md" CLAUDE.md` ≥1
- [ ] **Step 3: commit**

```bash
git add CLAUDE.md
git commit -m "docs: link Decision Ledger, skill map, Gate-2 dirs from CLAUDE.md"
```

---

### Task 12a: Slash command — `/gate1`

**Files:**
- Create: `.claude/commands/gate1.md`

- [ ] **Step 1: เขียนไฟล์**

```md
---
description: เริ่ม Gate 1 (requirement + AC + product advisory) ของ feature ตาม workflow
argument-hint: <F-XXX | คำอธิบาย feature>
---
คุณคือ PM/orchestrator ของ OmniStock. เริ่ม **Gate 1** สำหรับ: $ARGUMENTS

อ่านก่อน: [WEB_TEAM.md](../../WEB_TEAM.md) (workflow) และ spec
docs/superpowers/specs/2026-06-29-agent-team-coordination-workflow-design.md (§2, §2.1).

เดินตามนี้:
1. **Intake (คุณ):** สรุปโจทย์ 1 ย่อหน้า + ระบุ platform (web/mobile/both) + right-size (full/light). กำกวม = ถาม user ห้ามเดา.
2. **Dispatch `product`:** ร่าง Gate-1 spec จาก docs/features/_TEMPLATE.md → overview, user stories, acceptance criteria. skill: feature-spec + product-management:write-spec.
3. **Product Advisory (บังคับ):** product เสนอ best practice เชิงรุก — competitor/industry pattern, recommended approach + trade-off, ความเสี่ยง/edge ที่กระทบ money/stock/กฎทอง, ผลต่อ UX SME non-tech. skill: product-management:competitive-brief / product-brainstorming.
4. **เสนอ user:** สรุป AC + advisory note ให้ review.
5. **หยุดรอ ✋ sign-off — ห้ามเริ่ม Gate 2.** เมื่อ user เคาะ → สร้าง docs/features/F-XXX/F-XXX.md (สร้าง directory ถ้ายังไม่มี), set front-matter status: G1✓, owner_now.

กติกา: ไม่ตัดสิน scope/AC แทน user · คำถามนอกโดเมน = 🚧 BLOCKED route หา owner · decision ข้ามทีมที่ user เคาะ → log docs/DECISIONS.md (D-XXX).
```

- [ ] **Step 2: verify** — `ls .claude/commands/gate1.md` และ `grep -c "Gate 1" .claude/commands/gate1.md` ≥1
- [ ] **Step 3: commit**

```bash
git add .claude/commands/gate1.md
git commit -m "feat: add /gate1 slash command (requirement + AC + advisory)"
```

---

### Task 12b: Slash command — `/gate2`

**Files:**
- Create: `.claude/commands/gate2.md`

- [ ] **Step 1: เขียนไฟล์**

```md
---
description: เริ่ม Gate 2 (เอกสาร design ต่อทีม + sign off ทีละฉบับ + แตก task) ของ feature
argument-hint: <F-XXX>
---
คุณคือ PM/orchestrator ของ OmniStock. เริ่ม **Gate 2** สำหรับ feature: $ARGUMENTS

Precondition: feature ต้อง status = G1✓ (ยังไม่ผ่าน → หยุด บอก user ให้ /gate1 ก่อน).
อ่านก่อน: [WEB_TEAM.md](../../WEB_TEAM.md), spec §2.2 (doc flow) §3.A (RACI) §3.E (concurrency) §3.F (task board), และ docs/features/F-XXX/F-XXX.md (AC ที่ approved).

เดินตามนี้:
1. **เตรียม directory:** docs/features/F-XXX/ — คัด template จาก docs/features/_gate2/ เป็นเอกสารเปล่าต่อทีม.
2. **Dispatch ตาม dependency:**
   - `backend-api` → architecture.md (เฉพาะ full: push/idempotency/retry/reconciliation — skill connector-design; money-stock ถ้าแตะเงิน/สต๊อก) → data-model.md → api-spec.md (OpenAPI). ก่อน lock contract **ต้อง consult ux + qa**.
   - **หลัง contract นิ่ง → ขนาน** (skill dispatching-parallel-agents):
     - `ux` → ux-wireframe.md + ui.md (skill thai-ux; reuse design-system กลางก่อน; Claude Design → /design-sync).
     - `qa` → test-plan.md (skill feature-spec + money-stock matrix; test data: seed ≥2 org + isolation + state via StockMovement).
3. **ระหว่างทำ:** subagent เจอคำถามนอกโดเมน = 🚧 BLOCKED กลับหาคุณ → route หา owner → log D-XXX → ป้อนกลับ. ห้ามเดา.
4. **Sign off ทีละฉบับ:** เอกสารเสร็จ → review เจ้าของส่วน → เสนอ user → user เคาะ → set signoff: approved ในไฟล์นั้น.
5. **✋ ครบทุกฉบับ → Gate 2 commit:** commit เอกสารทั้ง directory, set status: G2✓.
6. **แตก task:** สร้าง docs/features/F-XXX/tasks.md — block ต่อ task (id/desc/ref/deps/status/updated_by) ตาม §3.F. แต่ละทีมเสนอ task ของตัวเอง + ผูก dependency.
7. **พร้อม Build:** เสนอ user ว่าจะ dispatch task (subagent-driven-development) ต่อไหม.

กติกา: ไม่มี agent เดาแทนกัน · contract = seam BE↔FE/ux · เจ้าของ task จะ update status เอง.
```

- [ ] **Step 2: verify** — `grep -c "Gate 2" .claude/commands/gate2.md` ≥1 · `grep -c "signoff: approved" .claude/commands/gate2.md` ≥1
- [ ] **Step 3: commit**

```bash
git add .claude/commands/gate2.md
git commit -m "feat: add /gate2 slash command (per-team docs + sign-off + task breakdown)"
```

---

### Task 12: Verify all links + consistency

**Files:** (none — verification only)

- [ ] **Step 1: หา broken internal link** — รันสคริปต์ตรวจว่าทุก `](...md)` ที่เป็น relative path มีไฟล์จริง:

```bash
grep -rhoE "\]\(([^)]+\.md)[^)]*\)" WEB_TEAM.md CLAUDE.md docs/ .claude/agents/ .claude/skills/thai-ux/ \
  | sed -E 's/.*\(([^)#]+).*/\1/' | sort -u \
  | while read p; do [ -e "$p" ] || [ -e "docs/$p" ] || echo "MISSING? $p"; done
```
Expected: ไม่มีบรรทัด `MISSING?` ที่เป็นไฟล์ใน 11 task นี้ (ลิงก์ข้ามโฟลเดอร์ที่ echo อาจ false-positive — เช็คด้วยตาว่าไฟล์มีจริง)

- [ ] **Step 2: consistency scan** — ยืนยันว่า path เดียวกันทั้งชุด: `grep -rn "F-XXX-tasks.md" .` ต้อง **ว่าง** (ใช้ `F-XXX/tasks.md` แล้ว); `grep -rn "หลัง G1" WEB_TEAM.md` ต้องไม่พูดว่า task breakdown อยู่หลัง G1
- [ ] **Step 3: git status สะอาด** — `git status --short` ไม่เหลือไฟล์ค้างที่ตั้งใจ commit
- [ ] **Step 4: (ถ้ามีแก้)** commit `docs: fix cross-references`

---

## Self-Review (ผู้เขียนแผนตรวจเอง)

**Spec coverage:** SPEC §2 PM loop→T9 · §2.1 advisory→T8 · §2.2 Gate-2 dir→T3,T5,T9 · §3.A RACI→T9 · §3.B ledger→T1 · §3.C tie-break→T9 · §3.D status→T5 · §3.E concurrency→T9 · §3.F task board→T3,T9 · §3.5 build→T9 · §4 QA→T9 · §5 test data→(อยู่ใน test-plan template T3 + WEB_TEAM T9) · §6 skill map→T2 · §7 UX friendly→T6,T7 · §8 Claude Design→T4,T7 · §8.A design system→T4.

**หมายเหตุ:** SPEC §5 (test data/fixtures multi-tenant) ยังไม่มีไฟล์เจ้าภาพชัด — รวมไว้ใน `_gate2/test-plan.md` (T3) เป็นหัวข้อ "test data: seed ≥2 org + isolation + state via StockMovement" และอ้างใน WEB_TEAM Gate E (T9 Step 8). ถ้าต้องการแยกเป็น convention doc ให้เพิ่ม task ภายหลัง.
