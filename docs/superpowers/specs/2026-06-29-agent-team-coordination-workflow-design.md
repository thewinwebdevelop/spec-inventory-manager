# Design Spec — Agent Team Coordination Workflow (OmniStock)

> สถานะ: **draft ให้ user รีวิว** — ยังไม่ commit, ยังไม่แตะ `WEB_TEAM.md`/ไฟล์ production
> วันที่: 2026-06-29 · เจ้าภาพ design: PM (orchestrator) · scope: รื้อ coordination layer + skill map

## 1. บริบทและเป้าหมาย

รื้อ **coordination layer** ของทีม AI agent ใหม่ โดย **คงโครง workflow 2-gate เดิมไว้**
(skeleton ถูกต้องแล้วเพราะถูกบังคับด้วย money/stock + external connector + immutable ledger)
สิ่งที่รื้อจริงคือ: กลไกประสานงานระหว่างทีม + การ map skill ทั้งคลังที่เพิ่งติดตั้ง

**Decision ที่ผู้ใช้เคาะแล้ว (locked):**
- โครงทีม: **5 ทีมหลัก** (product / ux / frontend / backend-api / qa) **+ 2 สนับสนุน** (devops / release)
- **PM = orchestrator** (main session): รับ requirement → dispatch → route → integrate → gate
- สาย skill default = **superpowers** (เลิกใช้ `tdd`/`debug-mantra`/`diagnosing-bugs` ใน flow หลัก คงไว้แต่ skill เฉพาะโปรเจกต์)
- Browser Use (skill `qa`) = **Track 2 scheduled** (nightly + ก่อน release, ไม่บล็อก merge)
- UI design ผ่าน **Claude Design** (DesignSync) เป็น seam ระหว่าง ux → frontend
- target user = **SME ไทยไม่เก่ง tech** — ใช้ได้โดยไม่ยาก/ซับซ้อนเกินไป
- **product เสนอ best practice เชิงรุก** ให้ user ที่ Gate 1 (ดู §2.1)
- มี **Task Breakdown ข้ามทีม + T-XXX** หลัง G1 → PM จ่าย T-ID ตาม dependency (ดู §3.F)
- **Central Design System** 1 ชุด — feature reuse + contribute-back (ดู §8.A)

---

## 2. PM Loop — วงจรที่ PM เดินทุก feature

```
① INTAKE → ② DECOMPOSE → ③ DISPATCH → ④ ROUTE ⇄ → ⑤ INTEGRATE → ⑥ GATE
 (รับจาก user) (แตก+RACI)  (ส่ง agent)  (คุมคำถาม)   (รวม artifact)  (เคาะ/loopback)
        ▲                                    │                            │
        └──────────── loopback ◄─────────────┴────────────────────────────┘
```

| จังหวะ | PM ทำอะไร | output | กติกาเหล็ก |
|--------|-----------|--------|------------|
| ① Intake | รับโจทย์ → invoke `superpowers:brainstorming` → สรุปกลับ 1 ย่อหน้า + platform + right-size | intake note | กำกวม = ถาม user ไม่เดา |
| ② Decompose | หลัง G1✓ → นำ **Task Breakdown ข้ามทีม** (§3.F) + แปะ RACI + เปิด status front-matter | task board (T-XXX) + RACI | ไม่ตัดสิน scope/AC เอง (→ product) |
| ③ Dispatch | จ่าย **T-ID** ให้ agent เจ้าของ + context + skill — **เช็ค dependency ก่อน** (task ที่ deps ไม่ครบ = ยังไม่ส่ง) | subagent task | dispatch เฉพาะ task ที่ deps = done |
| ④ Route | รับ `🚧 BLOCKED` → หา owner → เรียก owner ตอบ → log Decision Ledger → ป้อนกลับ | decision entry | คำถามนอกโดเมน PM route เท่านั้น **ไม่ตอบแทน** |
| ⑤ Integrate | รวม artifact หลายทีม เช็คต่อกันได้ (api↔ux↔test) | consolidated spec/PR | เจอขัดกัน → ส่งกลับเจ้าของทั้งคู่ ไม่ประนีประนอมเอง |
| ⑥ Gate | รัน `quality-gate` → เขียว=เสนอ user เคาะ / แดง=loopback | go/no-go | **ไม่ override fail** |

หลักการ: PM **ประกาศจังหวะปัจจุบันเสมอ** ("กำลัง Dispatch BE สำหรับ data-model ของ F-021")

### 2.1 Product Advisory ที่ Gate 1 (บังคับ)
product **ไม่ใช่แค่ถาม requirement** — ต้อง **เสนอ best practice เชิงรุกอย่างละเอียด** ให้ user
ประกอบการตัดสินใจ *ก่อน* เคาะ AC:
- **industry/competitor pattern** — คนอื่นทำ feature นี้ยังไง อะไรเป็นมาตรฐาน (`product-management:competitive-brief`)
- **recommended approach + เหตุผล** — เสนอตัวเลือก พร้อม trade-off และตัวที่ product แนะนำ
- **ความเสี่ยง/edge case ที่ user อาจมองข้าม** — โดยเฉพาะที่กระทบ money/stock/กฎทอง
- **ผลต่อ UX สำหรับ SME ไม่สาย tech** (ผูกกับ §7)

รูปแบบ: product สรุปเป็น "advisory note" ใน Gate-1 spec → user อ่านแล้วเคาะ
ทุก recommendation ที่ user รับ/ปฏิเสธ ที่เป็น cross-cutting → log เป็น **D-XXX**

---

## 3. Coordination Spine

### 3.A RACI ต่อ step
R=ลงมือ · A=ชี้ขาด/รับผิดชอบ · C=ต้องถามก่อนเดิน · I=แจ้งให้รู้

| Step | product | ux | BE | FE | qa | devops | release | PM | user |
|------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Portfolio / prioritize | A/R | C | C | I | I | I | C | drives | A |
| G1 req + AC | A/R | C | C | – | C | – | – | drives | C |
| **G1 sign-off** ✋ | A/R | I | I | I | I | – | – | drives | **A** |
| Task breakdown (T-XXX) | C | C | C | C | C | C | I | **A/R** | I |
| G2 architecture | C | – | A/R | I | C | C | – | drives | I |
| G2 data-model→contract | C | C | A/R | C | C | – | – | drives | I |
| G2 UX/UI + Thai copy | C | A/R | C | C | I | – | – | drives | I |
| G2 test plan | C | I | C | – | A/R | – | – | drives | I |
| **G2 commit sign-off** ✋ | C | C | C | C | C | I | I | drives | **A** |
| Build backend + unit test | I | – | A/R | I | C | C | – | drives | I |
| Build frontend | I | C | C | A/R | C | C | – | drives | I |
| Build infra/pipeline | – | – | C | C | **C** | A/R | C | drives | I |
| QA verify + gate | C | I | C | C | A/R | C | C | drives | I |
| **Release go/no-go** ✋ | C | – | I | I | C | C | A/R | drives | **A** |

> คอลัมน์ **C** = "ก่อน owner เดิน step นี้ ต้อง consult คนพวกนี้ล่วงหน้า" ไม่ใช่รอชน BLOCKED
> user เป็น **A** แค่ 4 จุด = human gate เท่านั้น

### 3.B Decision Ledger — `docs/DECISIONS.md` (append-only)
สะท้อนกฎทอง "ledger immutable" มาใช้กับ *การตัดสินใจ* — เปลี่ยนใจ = เพิ่ม entry ใหม่ที่ supersede

```md
### D-001 · 2026-06-29 · F-021
Q: <คำถามเดียว ชัดๆ>
Asked by: @<agent>   Owner: @<agent|user>
Decision: <สิ่งที่เคาะ>
Rationale: <เหตุผล>
Affects: contract / data-model / UX / AC ...
Status: decided          # decided | superseded-by D-0xx
```
**กติกา:** ทุกครั้งที่ PM route BLOCKED จนได้คำตอบ → log 1 entry · spec/PR/commit อ้าง `D-XXX` ได้

### 3.C Escalation Bus + Tie-break ladder
```
agent ชน BLOCKED → return หา PM → PM ระบุ owner จาก RACI
  → dispatch owner พร้อมคำถามเดียว → owner ตอบ
  → PM log D-XXX → ป้อนกลับ agent เดิม → เดินต่อ
```
**Tie-break ladder** (2 owner ขัดกัน):
1. ในโดเมนใคร → คนนั้นชี้ขาด
2. ข้ามโดเมน + scope/กฎธุรกิจ → **product ชี้ขาด**
3. ข้ามโดเมน + feasibility/contract → **backend-api ชี้ขาด**
4. trade-off จริงไม่มีเจ้าของชัด → **PM สรุป options ส่ง user เคาะ** (ไม่ประนีประนอมเอง)

รูปแบบ BLOCKED block:
```
🚧 BLOCKED — needs a decision from: @<agent|user>
Question: <one precise question>
Why I stopped: outside my domain (<agent> owns <X> only)
Options I see (if any): <a / b / c + trade-off>
What I'll do once answered: <next step>
```

### 3.D Status Tracker — front-matter ใน spec แต่ละ F-XXX
```yaml
status: G2        # portfolio→G1→G1✓→G2→G2✓→build→qa✓→release→done
owner_now: "@backend-api"
waiting_on: "D-007 (product)"   # หรือ null
```
PM sync บรรทัดนี้ทุกครั้งที่เปลี่ยนจังหวะ → user เปิดไฟล์เดียวเห็นว่างานค้างใคร

### 3.E Concurrency lane — contract เป็นเส้นแบ่ง
```
G2:  [architecture]→[data-model→contract] ═╗
                                           ╚═► contract นิ่ง: [UX/UI] ∥ [test plan]
Build: [backend+unit] ∥ [infra/pipeline] ═══► contract นิ่ง → [frontend]
```
อะไรที่อยู่หลัง contract lock และไม่ขึ้นต่อกัน → PM dispatch ขนานด้วย `superpowers:dispatching-parallel-agents`

### 3.F Task Breakdown & Live Tracking (T-XXX)
**ใหม่** — F-XXX แตกเป็น **task list ของแต่ละทีม** → ทุกคน track ความคืบหน้าจากบอร์ดเดียว

**(1) แตก task — หลัง G1 sign-off (จังหวะ ② Decompose):**
- **PM นำการแตก** โดยให้แต่ละทีม (design/backend/frontend/qa + devops) เสนอ task ของตัวเอง
- เป้าหมาย: เห็นชัดว่า **agent team ไหนต้องทำอะไรบ้าง ครบถ้วนไหม** + **task ไหนรอ dependency จากใคร**
- ได้ **task list ผูก dependency เป็น DAG** → เก็บใน `docs/features/F-XXX-tasks.md`
- *default ที่เสนอ:* แตกรอบเดียวครอบทุกทีม (build/qa task ค่อยละเอียดขึ้นหลัง design land) · T-ID = ต่อ feature (`T-021-01`)

**(2) dispatch — PM จ่าย T-ID ตาม dependency:**
- PM dispatch เฉพาะ task ที่ **deps = done ครบ** (dependency-gated) — กันทีมเริ่มงานที่ของยังไม่พร้อม

**(3) track — เจ้าของ task update status ของตัวเอง:** ⭐ หัวใจของการ track
- agent team ที่ทำ task เสร็จ → **update status `done` ที่ T-ID ของตัวเอง** ในไฟล์ task board (เริ่มงาน → `in_progress`)
- PM อ่านบอร์ด → task ใหม่ที่ deps เพิ่งครบ → dispatch ต่อ → วนจนทุก task `done`
- บอร์ดนี้ = **single source of truth ของความคืบหน้าระดับ task** (คู่กับ status front-matter §3.D ที่เป็นระดับ feature)

Task board format (`docs/features/F-021-tasks.md`):
```md
# F-021 Task Board
| id | team | task | deps | status | updated_by |
|----|------|------|------|--------|------------|
| T-021-01 | backend  | architecture (push/idempotency/retry) | G1✓            | done        | @backend-api |
| T-021-02 | backend  | data-model→contract                   | T-021-01       | in_progress | @backend-api |
| T-021-03 | design   | Claude Design component + token        | T-021-02       | blocked(dep)| —            |
| T-021-04 | qa       | test plan from AC                      | T-021-02       | blocked(dep)| —            |
| T-021-05 | backend  | impl push + unit test                  | T-021-02, G2✓  | todo        | —            |
| T-021-06 | frontend | implement sync UI                      | T-021-03,T-021-05 | todo     | —            |
```
กติกา:
- task list เป็น **living** — task build/qa ละเอียดขึ้นหลัง design ของมัน land
- task ข้ามทีมที่ขึ้นต่อกัน → **artifact (contract/design) คือตัวปลด dependency**
- status: `todo → in_progress → done` · ติดขัด: `blocked(dep)` หรือ `blocked(D-XXX)`
- **เจ้าของ task เท่านั้นที่ update status ของ task ตัวเอง** + ลงชื่อใน `updated_by` (PM ไม่อัปแทน — PM แค่อ่านเพื่อ dispatch ต่อ)
- T-ID อ้างใน commit/PR ได้ → trace กลับว่า code นี้มาจาก task ไหนของ feature ไหน

---

## 3.5 Build / Implement Execution (BE + FE)

หลัง ✋ G2 commit → PM `superpowers:writing-plans` → `superpowers:executing-plans` →
dispatch task ตาม board (**dependency-gated**) เจ้าของ task implement + ปิด T-ID เอง

```
① backend-api implement ═╗ (ขนานกับ devops)
   • core-domain pure fn + unit test (TDD + money-stock)
   • Prisma migration + NestJS module/endpoint ตาม contract
   • BullMQ job (push/retry) · regenerate OpenAPI client
② devops ════════════════╣
   • wire queue + env/secrets + pipeline
                          ╚═► contract+client พร้อม + design synced →
③ frontend implement
   • consume generated client · /design-sync component (web ตรง · Flutter แปล token)
   • build screen + client state + form · unit test (TDD)
④ ทุกทีม: requesting-code-review → receiving-code-review ก่อน merge
⑤ ทุกทีม: update T-ID ของตัวเอง = done ⭐
```

**กติกาเหล็กตอน implement:**
- FE **ห้าม reshape data เอง** → ขอ BE แก้ contract (BLOCKED → D-XXX)
- **ไม่มี money math บน float ฝั่ง client** — แสดงค่าที่ server คำนวณ
- โค้ดแตะเงิน/สต๊อก = **unit test เขียวก่อน merge** (กฎทองข้อ 4 — test ไปพร้อมโค้ด ไม่ดอง)
- business logic แกนอยู่ `packages/core-domain` เป็น pure function
- write ที่กระทบสต๊อก/เงิน อยู่ใน DB transaction + เขียน `StockMovement` เสมอ
- เจ้าของ task ปิด T-ID เมื่อเสร็จ → PM เห็นบอร์ด → dispatch task ถัดไปที่ dep ครบ

| step | owner | skill |
|------|-------|-------|
| logic + unit test (test-first) | backend-api | `superpowers:test-driven-development` · `money-stock` |
| connector impl | backend-api | `connector-design` |
| queue/pipeline/env | devops | (infra) |
| consume client + UI + state | frontend | `thai-ux` · `superpowers:test-driven-development` |
| sync design component | ux+frontend | `/design-sync` + `DesignSync` |
| verify แอปจริง | frontend/qa | `run` · `verify` · `mcp__Claude_Preview__*` |
| **scrutinize แผน** ก่อนลงมือ | PM/qa | `anthropic-skills:scrutinize` (จับ over-engineering ก่อนเขียนโค้ด) |
| review ก่อน merge | ทุกทีม | `superpowers:requesting-code-review` · `receiving-code-review` · `code-review` · `review` |
| **scrutinize งาน high-stakes** ก่อน merge | qa/PM | `anthropic-skills:scrutinize` (ไล่ path จริงว่า money/stock logic ทำตาม AC) |

> **scrutinize vs code-review:** code-review/`review` อ่าน diff หา bug+ตรง spec · **scrutinize**
> ตั้งคำถามแนวทาง (มีวิธีง่ายกว่าไหม) + ไล่ code path จริงว่า "ทำในสิ่งที่อ้าง" — ใช้คู่กัน
> โดยเฉพาะโค้ดแตะเงิน/สต๊อก/connector

---

## 4. QA Automation Layer

### 4.A Test pyramid + ownership
| ชั้น | ครอบคลุม | เขียน | รันอัตโนมัติที่ | verdict |
|------|----------|-------|----------------|---------|
| Unit | core-domain, money/stock math | BE/FE (TDD) | pre-commit + CI | qa |
| Contract | OpenAPI ↔ impl | BE | CI ทุก PR | qa |
| Integration | API+DB+Redis/BullMQ, transaction+ledger | BE | CI | qa |
| **E2E-scripted** | flow ผู้ใช้จริง (Playwright/Flutter integration_test) | qa | CI nightly + ก่อน release | qa |
| **E2E-agentic** | Browser Use, คะแนน 1–5 + persona non-tech | qa (skill `qa`) | **scheduled** (nightly + ก่อน release) | qa |
| Regression | suite สะสมจาก defect | qa | CI ทุก PR + ก่อน release | qa |
| Manual/exploratory | edge ที่ automate ไม่คุ้ม | qa | on-demand | qa |

### 4.B Automation pipeline — 4 จุด
```
① pre-commit (local)   ② CI on PR              ③ scheduled (nightly)   ④ pre-release
unit+lint+typecheck    unit+contract+integ+    E2E-scripted เต็ม +      ทุกชั้น + E2E เต็ม +
(setup-pre-commit)     E2E-smoke+regression    E2E-agentic(Browser     regression เต็ม +
devops                 แดง=บล็อก merge          Use) → report+คะแนน      Browser Use sweep
                       devops(wire)+qa(suite)   ไม่บล็อก, เปิด loopback   qa→release
```

### 4.C กฎเหล็ก
- โค้ดแตะเงิน/สต๊อก = unit test เขียวก่อน merge (กฎทองข้อ 4) — CI บังคับ
- ทุก AC map ไป test case ≥1 (qa เช็คใน `feature-spec` test-plan)
- CI แดง = merge ไม่ได้ · release gate อ่าน CI ตรงๆ · PM ไม่ override
- automated ไม่แทน manual

### 4.D Coordination ของ QA
- qa เป็นเจ้าของ "design suite + verdict" · devops wire เข้า CI → consult กันที่ step infra/pipeline (RACI: qa=C)
- unit test ทีม build เขียน (TDD) แต่ qa ตัดสิน "พอ/ครบ" → ไม่พอ = loopback กลับ build (qa ไม่เขียนเอง)
- Browser Use track 2: trigger โดย PM หรือ scheduled-task; ผลต่ำกว่าเกณฑ์ = PM route loopback (คนตัดสิน ไม่บล็อกอัตโนมัติ)

---

## 5. Test Data / Fixtures / Seeding (multi-tenant)

จุดที่ระบบ multi-tenant + ledger พังบ่อยเวลาเทสต์ — ล็อกกติกา:

- **ทุก test seed ≥2 organization** แล้ว assert ว่า org A มองไม่เห็นข้อมูล org B (isolation test = บังคับ ตาม Gate C)
- **Factory ผูก `organizationId` เสมอ** — สร้าง Product/SellableSku/InventoryItem แบบ org-scoped, ห้ามมี entity ลอยไม่มี org
- **สร้าง state ของสต๊อกผ่านการ append `StockMovement` เท่านั้น** — ห้าม insert ยอด balance ตรงๆ ในเทสต์ (เคารพ immutable ledger เหมือน production)
- **เงินใน fixture เป็น Decimal/string** ไม่มี float
- **Seeding E2E = deterministic** — org รู้จัก, SKU รู้จัก, reset ระหว่าง test (truncate หรือ transaction rollback)
- **BullMQ/idempotency** — มี fixture "duplicate event" เพื่อพิสูจน์ว่า process ซ้ำแล้วไม่ตัดสต๊อกซ้ำ
- เจ้าของ: **backend-api** (เขียน factory/logic) + **qa** (verify coverage + isolation)

---

## 6. Skill Map (step × team × skill) — สาย superpowers

### PM/Orchestrator (cross-cutting)
| เมื่อไหร่ | skill |
|---------|-------|
| เริ่มงาน creative | `superpowers:brainstorming` |
| แตกงาน parallel | `superpowers:dispatching-parallel-agents` · `superpowers:subagent-driven-development` |
| หลัง G2 → ก่อน build | `superpowers:writing-plans` → `superpowers:executing-plans` |
| รายงาน user | `product-management:stakeholder-update` · `9arm-skills:management-talk` |
| งานช่างกลถูกๆ | `anthropic-skills:qwen-agent` |
| ก่อนเคาะเสร็จ | `superpowers:verification-before-completion` · `anthropic-skills:scrutinize` |

### Portfolio (product)
`product-management:product-brainstorming` (core) · `synthesize-research` (sit) · `competitive-brief` (sit) · `roadmap-update` (core) · `sprint-planning` (sit)

### Gate 1 — Requirement + Product Advisory (product)
`feature-spec` G1 (**core**) · `product-management:write-spec` (core) · `domain-modeling` (sit: มีศัพท์ใหม่)
**Advisory (§2.1):** `product-management:competitive-brief` (best practice/competitor) · `product-management:product-brainstorming` (ตัวเลือก+trade-off) · `synthesize-research` (ถ้ามี feedback จริง)

### Gate 2 — Design
| step | owner | skill |
|------|-------|-------|
| architecture (แตะ external/queue/money-stock) | BE | `connector-design` · `money-stock` |
| interface/module ลึก เทสต์ง่าย | BE | `codebase-design` · `design-an-interface` (sit) |
| data-model→OpenAPI contract | BE | `feature-spec` G2 |
| wireframe→UI+Thai copy+tokens | ux | `thai-ux` |
| UI design (visual) | ux→FE | `/design-sync` + `DesignSync` (ดู §8) |
| test plan จาก AC | qa | `feature-spec` · `money-stock` |
| review เอกสาร | เจ้าของส่วน | `anthropic-skills:scrutinize` · `review` |

### Build
| step | owner | skill |
|------|-------|-------|
| logic + unit test (test-first) | BE | `superpowers:test-driven-development` · `money-stock` |
| connector impl | BE | `connector-design` |
| consume client + UI | FE | `thai-ux` · `superpowers:test-driven-development` |
| sync Claude Design ↔ repo | ux+FE | `/design-sync` + `DesignSync` |
| รัน/ส่องแอปจริง | FE | `run` · `verify` · `mcp__Claude_Preview__*` |
| isolation workspace | build | `superpowers:using-git-worktrees` (sit) |
| ขอ/รับ review ก่อน merge | build | `superpowers:requesting-code-review` · `superpowers:receiving-code-review` · `code-review` |
| ลดความซับซ้อน | build | `simplify` (sit) |
| debug | build | `superpowers:systematic-debugging` (sit) |

### QA (qa)
`quality-gate` (**core**) · `feature-spec`+`money-stock` (verify AC+matrix) · `qa` skill (Browser Use track 2) · `verify`·`run` · `security-review` (core เมื่อแตะ auth/token/เงิน) · `superpowers:systematic-debugging` · `anthropic-skills:post-mortem` (sit)

### Release (release)
`superpowers:finishing-a-development-branch` (core) · `quality-gate` (core) · `product-management:metrics-review` (sit หลัง dogfood)

### DevOps (สนับสนุน)
`setup-pre-commit` (sit) · `git-guardrails-claude-code` (sit) · `resolving-merge-conflicts` (sit)

> **On-demand utility (ไม่ผูก step):** `obsidian-vault`, `migrate-to-shoehorn`, doc-gen (`docx`/`pptx`/`xlsx`), `request-refactor-plan`

---

## 7. UX Friendliness Principles

**North-star:** ผู้ใช้หลัก = **SME ไทยไม่เก่ง tech** — ทุก flow ต้องผ่านเกณฑ์
"แม่ค้าที่ไม่เคยใช้ระบบ ERP เปิดมาแล้วใช้เป็นโดยไม่ต้องอ่านคู่มือ และไม่ยาก/ซับซ้อนเกินไป"

### 7.A Friendliness checklist (ux ต้องผ่านก่อนปิด UX section)
- ภาษาคน ไม่ใช่ภาษาระบบ — เลี่ยง jargon ดิบ (sync/SKU/ledger/bundle)
- progressive disclosure — ซ่อนความซับซ้อน ขยายเมื่อผู้ใช้ขอ
- default ฉลาด — ลดจำนวนการตัดสินใจ/การกรอก
- forgiving — undo / ยืนยันก่อนทำสิ่งที่ย้อนไม่ได้ / กันพลาด
- ทุก state (empty/loading/error) บอก "ขั้นต่อไป" ไม่ใช่แค่บอกว่าเกิดอะไร
- mobile-first — ปุ่มใหญ่พอแตะ

### 7.B Glossary: ศัพท์ระบบ → คำที่ผู้ใช้เข้าใจ (ux เป็นเจ้าของ)
| โมเดล/โค้ด | บนหน้าจอ (ไทย friendly) |
|---|---|
| SellableSku | สินค้าที่ขาย |
| ChannelListing | สินค้าบนร้าน Shopee |
| StockMovement | ประวัติสต๊อกเข้า-ออก |
| available | ขายได้อีก N ชิ้น |
| sync failed | อัปเดตไป Shopee ไม่สำเร็จ — แตะเพื่อลองใหม่ |

### 7.C Reconcile: friendly ปะทะ "UI ต้องพูดความจริงของโมเดล"
> **friendly = แปลความจริงให้เข้าใจง่าย ไม่ใช่ปิดบัง/โกหก**
> เช่น `available = min(floor(item.available/qty))` → แสดง "ขายได้อีก 12 ชิ้น" + แตะดู *ทำไม* ได้

### 7.D บังคับใน gate
- Gate D เพิ่ม: ผ่าน Friendliness checklist + ไม่มี jargon ดิบ + ศัพท์แปลตาม glossary
- Browser Use track 2 เพิ่มมิติคะแนน "persona SME non-tech" — ทดสอบ "ทำงานสำเร็จโดยไม่มีใครสอน" ทำไม่ได้/งง = หักคะแนน → loopback

---

## 8. Claude Design Integration (UI design seam)

Claude Design = **seam ของชั้น visual** เหมือน OpenAPI contract เป็น seam ของชั้น data

```
[ux] ออกแบบใน claude.ai/design (visual+variants+tokens)
      │  /design-sync + DesignSync (sync ทีละ component ไม่ wholesale)
      ▼
   repo: local component library (HTML/CSS) = handoff artifact
      │
      ▼
[frontend] implement: Next.js(shadcn) ใช้ตรง · Flutter แปล token+spec เป็น widget
      │  verify ด้วย mcp__Claude_Preview__*
```

| ของ | owner |
|-----|-------|
| Claude Design project (visual authority) | ux |
| design tokens — ตรงกับ `thai-ux` token system | ux (reconcile ทั้งคู่) |
| รัน `DesignSync` เข้า repo | ux + frontend |
| production component (web/mobile) | frontend |
| verify visual แอปจริง | frontend/qa |

**กติกาล็อก:**
1. เริ่มหลัง contract นิ่งเท่านั้น (component bind data จริง)
2. sync ทีละ component
3. token ใน Claude Design = แหล่งเดียวกับ `thai-ux`

**⚠️ ข้อจำกัด web+Flutter:** Claude Design ผลิต HTML/CSS → web consume ตรง,
Flutter consume HTML ไม่ได้ → port ได้แค่ **tokens** (สี/typography/spacing),
ตัว component ต้อง **แปลเป็น Flutter widget เอง** — sync ไม่ได้ mobile ฟรี

### 8.A Central Design System & Token (reuse + contribute-back)
design system **เป็นของกลาง 1 ชุด ไม่ใช่ต่อ feature** — ใช้ซ้ำข้าม feature และโตขึ้นเรื่อยๆ

- **แหล่งความจริงเดียว:** Claude Design project (visual) + `docs/design-system.md` (spec/usage) + `thai-ux` tokens (code) — ux ดูแลให้ทั้งสาม sync กัน
- **กติกา reuse-first:** ทุก feature เริ่มจาก **เช็ค design system กลางก่อน** ว่ามี component/token ที่ใช้ซ้ำได้ — ห้ามสร้างของซ้ำซ้อน/one-off
- **contribute-back:** ถ้า feature ต้องการ component/token ใหม่ → ux **เพิ่มเข้า design system กลาง** (ไม่ใช่ฝังเฉพาะ feature นั้น) → feature หลังๆ ได้ reuse
- **task ใน breakdown (§3.F)** ของ design มี 2 แบบเสมอ: `reuse จาก design system` หรือ `add ใหม่เข้า design system (+ feature ใช้)`
- เวอร์ชัน token เปลี่ยน = กระทบทุก feature → ux แจ้ง frontend + log `D-XXX` ถ้าเป็น breaking

---

## 9. แผนแก้ไฟล์จริง (Section 4 → apply เมื่อ user เคาะ spec นี้)

| ไฟล์ | การเปลี่ยน | ชนิด |
|------|-----------|------|
| `WEB_TEAM.md` | §3 เพิ่ม PM Loop + RACI + concurrency · §2 เพิ่ม escalation bus + tie-break · §4 Gate D (friendliness) + Gate E (CI+2-track E2E) · เพิ่ม §3.5 QA automation | rewrite บางส่วน |
| `docs/DECISIONS.md` | ไฟล์ใหม่ — ledger format + กติกา + seed D-000 | สร้างใหม่ |
| `docs/SKILL_MAP.md` | ไฟล์ใหม่ — skill map เต็ม | สร้างใหม่ |
| `docs/features/_TEMPLATE.md` | เพิ่ม front-matter status/owner_now/waiting_on | แก้เล็ก |
| `docs/features/_TASKBOARD_TEMPLATE.md` | ไฟล์ใหม่ — template task board (T-XXX + deps + status) §3.F | สร้างใหม่ |
| `docs/design-system.md` | สร้าง/ยืนยัน central design system + token + reuse/contribute-back rule §8.A | สร้าง/แก้ |
| `.claude/agents/product.md` | เพิ่มหน้าที่ Product Advisory ที่ Gate 1 §2.1 | แก้ |
| `.claude/agents/ux.md` | เพิ่ม friendliness north-star + glossary + reconcile rule + central design system | แก้ |
| `.claude/skills/thai-ux/SKILL.md` | เพิ่ม friendliness checklist + glossary | แก้ |
| `.claude/agents/README.md` | ตาราง Skills → ชี้ `docs/SKILL_MAP.md` + ลิงก์ DECISIONS | แก้เล็ก |
| `CLAUDE.md` | เพิ่มลิงก์ DECISIONS + SKILL_MAP | แก้ 2 บรรทัด |

> *ไม่แตะ:* `.claude/agents/*.md` ตัวอื่นรอบนี้ (follow-up ถ้าต้องการให้แต่ละ agent อ้าง skill ตัวเอง)

---

## 10. Appendix — Worked example: `F-021` "Push available → Shopee เมื่อสต๊อกเปลี่ยน"

*(both · full)* — เดินครบ PM Loop:

- **Intake:** PM `brainstorming` → right-size full, platform both
- **G1:** product `feature-spec`+`write-spec` เขียน AC → BLOCKED scope (latest-wins vs ordered) → user เคาะ → **D-001** → ✋ sign-off
- **G2:** BE `connector-design`+`money-stock` (architecture: push, idempotency `sku+listing+version`, BullMQ retry, reconciliation) → data-model→contract → BLOCKED ถาม ux field สถานะ → **D-002** → lock `GET /channel-listings/{id}/sync-status`
  - **ขนาน:** ux (Claude Design "sync status card", `thai-ux`) ∥ qa (test plan) → ux BLOCKED realtime vs poll → user เลือก poll → **D-003** → ✋ commit sign-off
- **Build:** BE logic+unit test (TDD+money-stock) ∥ devops BullMQ → contract นิ่ง → FE `/design-sync` + implement (web ตรง, Flutter แปล token)
- **QA:** Track 1 scripted เขียว (hard gate) · Track 2 Browser Use เจอ error_code ดิบไม่มี Thai copy → 3/5 → loopback → ux แก้ → 5/5 → `quality-gate` เขียว
- **Release:** release `finishing-a-development-branch` → dogfood + rollback plan (disable flag + reconciliation replay) → GO
- **ผลตกผลึก:** D-001/002/003 ใน ledger, status เดินครบ `→done`

**สิ่งที่พิสูจน์:** ไม่มี agent เดาแทนกัน · user ถูกถามแค่ 3 จุด · ขนานเมื่อขนานได้ · Browser Use จับสิ่งที่ scripted ไม่จับ
