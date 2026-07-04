# PM Workflow — command-by-command สั่งงาน feature ตั้งแต่ Gate 1 ถึง Release

> ใช้ไฟล์นี้ทีละขั้นตอน ไม่ต้องจำ

---

## 🟦 GATE 1 — Requirement + AC (session ใหม่)

### ก่อน dispatch

1. **อ่าน brief feature** — ดู backlog ใน [docs/features/README.md](../features/README.md) หาแถว F-XXX
2. **ตรวจ forward-commitments** — ดู [docs/features/forward-commitments.md](../features/forward-commitments.md) มีสัญญาค้างไหม (ผูก เข้า scope discussion)
3. **สร้าง directory** — ถ้ายังไม่มี: `mkdir docs/features/F-XXX`
4. **ทำความเข้าใจ scope** — คิดเองว่า:
   - **ปัญหา** — คนจะแก้ปัญหาอะไร (1 ประโยค)
   - **ผู้ใช้** — ใครใช้ (role)
   - **platform** — web / mobile / both
   - **right-size** — full (แตะ external/money-stock) หรือ light

### dispatch — `/gate1 F-XXX` (ใช้ skill gate1)

```
สั่ง: /gate1 F-XXX

brief ที่ PM ส่งควรมี (PM ทำเอง ไม่ให้ agent คิด):
- ปัญหา (1 ประโยค)
- ผู้ใช้ (role)
- platform (web/mobile/both)
- right-size (full/light)
- ถ้ามี forward-commitments ค้าง → ระบุ
- ถ้า concern PDPA → "แตะ buyer PII / personal data"
```

ระหว่างสอง PM อยู่บ้าน:
- agent `product` จะ grill คำถาม (ถาม AC by AC, platform, tier, edge cases)
- product จะ draft spec + advisory
- product จะส่งกลับให้ PM สรุปไปเสนอคุณ

### ปิด gate 1

- **PM ตรวจ:** spec อ่านได้ไหม, AC ชัดไหม, advisory ยุติธรรมไหม
- **ส่งคุณ:** spec + advisory ให้คุณ review (แต่ PM อ่านเอง ตรวจความสมเหตุสมผล ก่อน)
- **รอคุณเคาะ:** "ตกลง / ต้องแก้" + ระบุข้อไหน
- **ปิด session** — จด D-XXX ถ้ามีการตัดสินใจข้าม feature ในระหว่าง grill

---

## 🟩 GATE 2 — Design docs + Task breakdown (session ใหม่)

### ก่อน dispatch

1. **ทำความเข้าใจ scope จาก G1** — อ่าน spec ที่เคาะแล้ว
2. **copy templates** — `cp docs/features/_gate2/*.md docs/features/F-XXX/`
3. **เตรียม context brief** — list ไฟล์ที่ agent ต้องอ่าน (ระดับ section, ไม่ใช่ทั้งไฟล์):
   - Gate 1 spec
   - canon docs ที่เกี่ยว (ส่วนใหญ่ 01-data-model §ที่เกี่ยว)
   - D-XXX ที่อ้าง ใน spec
   - ref ตามที่แต่ละ template ระบุ
4. **check ว่าต้อง security-review ไหม** — "auth / token / money / stock / tenant-isolation / concurrency"?
   - ใช่ → flag ว่ารอ security-reviewer จะ review ก่อน user sign-off
   - ไม่ → ไปต่อ

### dispatch — `/gate2 F-XXX` (ใช้ skill gate2)

```
สั่ง: /gate2 F-XXX

brief เตรียมให้ agent:
- ref: ไฟล์ที่ต้องอ่าน (section-level, เช่น "01-data-model §3 InventoryItem, §5 SellableSku")
- AC: ทั้งหมดจาก G1 spec
- platform: web/mobile/both
- full/light indicator
- ถ้าต้อง security-review: "security-reviewer จะ review ก่อน sign-off"
```

**ระหว่างสอง:** agent ต่างๆ (backend-api, ux, qa, devops) จะร่าง docs ต่างๆ:
- architecture (ถ้า full)
- data-model
- API spec
- wireframe + UI
- test plan

**ทำนองเดียวกัน:** ตัวต่อตัว review + กลับแก้ → user sign-off รอบเดียว

### ปิด gate 2

- **PM ตรวจ:** เอกสารครบไหม, สังเคราะห์อ่านได้ไหม, sync-back ทำแล้วไหม
  (เอกสารที่ 2 feature ใช้ร่วม → sync กลับ docs/01 / docs/02 / design-system)
- **security-review:** ถ้าต้อง → security-reviewer ผ่านแล้วไหม (verdict ประกบ)
- **ส่งคุณ:** เอกสาร + summary ≤10 บรรทัด
- **รอคุณเคาะ:** approve + commit เอกสาร
- **PM commit:** branch ที่นี่ (เอกสาร finalized)
- **ปิด session** — ไปสร้าง task board

### แตก task board

หลังจากคุณเคาะ Gate 2:
1. ดู `docs/features/_gate2/tasks.md` template
2. copy → `docs/features/F-XXX/tasks.md`
3. แตก task ตาม:
   - ต่อทีม (backend-api / ux / devops / frontend / qa)
   - ★ mark งานที่แตะ money/stock/auth/token
   - ref = section-level, ไม่ใช่ทั้งไฟล์
   - deps = ระบุ T-XXX-ID ก่อนหน้า / G2✓
   - sizing: 1 task ≈ ครึ่งวัน (~≤400 diff)
4. PM เตรียม "context brief" ต่อ task (อ่านไป dispatch)

---

## 🟨 BUILD — Implement (multiple sessions, ทีละ batch)

### dispatch task (ทีละ batch / ทีละทีม)

```
brief ต่อ builder:

Task: T-XXX-NN
Do: <งาน 3 บรรทัด>
Ref: (section-level ไฟล์ที่ต้องอ่าน)
AC: (ข้อที่ task นี้ต้องผ่าน)
Deps: (T-XXX ที่ต้อง done ก่อน)
---
Format:
✅/🟡 T-XXX-NN — <งาน>
ทำอะไร: <≤3 บรรทัด>
Proof:   <คำสั่ง + output จริง>
ตัดสินเอง: <decision ระหว่างงาน — หรือ "ไม่มี">
เบี่ยงจาก spec: <จุดที่ต่างจาก ref — หรือ "ไม่มี">
เพิ่ม dependency: <package + เหตุผล — หรือ "ไม่มี">
🚧 BLOCKED: <ถ้ามี>
```

### รับ report กลับ

- **PM อ่าน:** ดู proof (คำสั่ง + output จริง) เทียบกับ AC
- **รัน `pnpm verify`** (หรือ `pnpm verify --filter=<workspace>`) ที่ root
  - ทำให้ proof ของ builder อ้างคำสั่งเดียวกันกับที่ CI รัน
  - ไม่มีความลับ: ทั้งคู่ run command เดียวกัน
- **ตรวจ deviation:** เบี่ยงจาก spec เพราะอะไร? ยอมรับได้ไหม?
- **ตรวจ BLOCKED:** ถ้ามี → escalate หาเจ้าของช่วย

### ระหว่าง dispatch

- **friction log:** เจอปัญหา process → จด 1 บรรทัด + @agent tag ใน [docs/RETRO.md](../RETRO.md) ทันที
  (เช่น "2026-07-XX · @frontend · bounce ครั้งที่ 2 เพราะ ref ไม่ชี้ design token · Gate D")

### ปิด build batch / feature

- **PM ตรวจ diff ทั้งหมด:**
  - ไม่มี merge conflict ใหม่
  - protected paths (`.claude/**`, CLAUDE.md, WEB_TEAM.md, docs/00–05, DECISIONS.md) ไม่มีใครแตะ
  - dependency ใหม่มี approval ใน report
- **ส่ง review** (ถ้า ★ task) → security-reviewer ผ่านก่อน merge
- **commit** เมื่อคุณสั่ง (PM จด commit message ของเอกสาร + code review findings)

---

## 🟪 QA — Verify + Gate (session ใหม่)

### dispatch qa verification

```
สั่ง: qa verify F-XXX against Gate 2 test-plan

brief:
- test-plan file path (docs/features/F-XXX/test-plan.md)
- AC ครบไหม
- state ครบ 4 (empty/loading/error/success)
- money/stock code มี unit test ผ่านไหม
- CI green ไหม
- รายงาน PASS/FAIL + defect list (ถ้ามี)
```

### รับ verdict

- **PM รันเอง:** `pnpm verify` + `pnpm test` (ดู CI logs ด้วย)
- **ตรวจ AC coverage:** ทุก AC มี test case ที่ pass ไหม
- **defect list:** ถ้ามีให้นับตัว (backlog หรือ fix ขณะนี้?)

### quality-gate checklist

PM ใช้ skill `/quality-gate` ก่อน ปิด feature:
- [ ] Gate A — requirement sound
- [ ] Gate B — design + sync-back done
- [ ] Gate C — domain/data (org filter, tx, ledger, Decimal/integer)
- [ ] Gate D — UX (states, Thai copy, model truth)
- [ ] Gate E — tests green + money/stock covered
- [ ] Gate F — version/rollback plan ready + micro-retro written

---

## 🟥 RELEASE — Go (session ใหม่)

### ก่อน release

- **PM ตรวจ:**
  - [ ] version bumped (ตาม semver)
  - [ ] CHANGELOG.md updated
  - [ ] branch ของเราชัด (เตรียม rollback branch ด้วย)
  - [ ] devops env พร้อม
  - [ ] QA gate pass ✓
  - [ ] security-reviewer pass ✓ (ถ้า ★)
  - [ ] micro-retro 5 บรรทัด เขียน docs/RETRO.md แล้ว

### dispatch release

```
/release F-XXX

brief:
- version (vX.Y.Z)
- CHANGELOG ขอบเขต
- rollback plan (ถ้ามี)
- env rollout sequence (dev → staging → prod)
```

### ปิด release

- **PM ตรวจ release checklist:**
  - [ ] commit ผ่าน (tag ถูก)
  - [ ] deployment logs ดู
  - [ ] health check green
  - [ ] ปิด task board (T-XXX ทั้งหมด mark done)
- **ลง RETRO.md:** micro-retro (ช้าที่ไหน, กติกาขาด, review จับพลาด, model fit, ทำซ้ำ-เลิก)
- **pattern ซ้ำ 2 feature?** → ยกเสนอแก้ workflow เข้า team-upgrade-plan
- **จบ session**

---

## 📋 Quick reference — common commands

```bash
# ตอนเริ่ม session ใหม่ — ส่วนใหญ่อ่านไฟล์ ไม่ต้องสั่ง agent
/gate1 F-XXX    # Gate 1 (ถ้ามี brief ประกอบ)
/gate2 F-XXX    # Gate 2 (อ่านไฟล์ก่อน)

# ตอน build — ส่งไปเจาะจง task
<ส่ง brief ให้ backend-api ด้วย task โค้ดไป>
<ส่งไปให้ ux ร่าง design มา>
<ส่งไปให้ frontend implement>

# ทำตัวเอง — PM สั่งไม่ได้
pnpm verify                  # รัน test+lint ระหว่าง build
pnpm verify --filter=<app>  # ราย app

# ตอน verify/review — PM dispatch แต่ต้องอ่านไฟล์ก่อน
/quality-gate F-XXX         # checklist ก่อนปิด

# memory ที่ต้องติดตัว PM ทุกตัว
docs/features/F-XXX/        # spec + task board + retro (after)
docs/DECISIONS.md           # decision log
docs/RETRO.md               # friction + lessons
WEB_TEAM.md                 # workflow rules
docs/01-data-model.md       # truth on product model
```

---

## 🔴 Rules PM จะต้องทำเอง ห้ามให้ agent ทำ

- **ตัด ref เป็น section-level** — ไม่ให้ agent อ่านไฟล์ทั้งไฟล์
- **รัน `pnpm verify` ซ้ำ** — verify-don't-trust (ไม่เชื่อ report โดยลำพัง)
- **จด friction log ทันที** — เจอปัญหา process ใจปล่อย
- **commit เมื่อคุณสั่งเท่านั้น** — ไม่ auto-commit
- **retro ตอน feature ปิด** — synthesize จาก log ไม่ใช่ความจำ
- **decision ตัด Type 1 ถามคุณเสมอ** — schema/contract/scope/เงิน (ไม่มี [auto] tag)
