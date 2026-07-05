# WEB_TEAM.md

คู่มือการทำงานของทีม AI สำหรับ OmniStock — กติกากลางที่ทุก agent ยึดร่วมกัน
อ่านไฟล์นี้คู่กับ [CLAUDE.md](CLAUDE.md) (กฎทอง + โมเดลแกน) และ
[.claude/agents/README.md](.claude/agents/README.md) (รายละเอียดแต่ละ agent)

> เป้าหมายของไฟล์นี้: ไม่ต้องอธิบายระบบใหม่ทุกครั้ง — AED รู้ทันทีว่าทีมนี้
> ทำงานแบบไหน ใครตัดสินใจอะไร และงานจะถือว่า "เสร็จ" เมื่อไหร่

---

## 1. Team Mission — เราสร้างเว็บแบบไหน

เราสร้าง **OmniStock** — แพลตฟอร์มรวม Inventory + Marketplace Sync
(Shopee/Lazada/TikTok) + Thai Cloud Accounting แบบ **multi-tenant**
(dogfood ก่อน แล้วเปิดขาย)

หลักการที่กำหนดรูปร่างของทุกหน้าจอและทุก API:

- **Source of truth = ระบบเรา** — platform เป็นปลายทางที่เรา push ไป ไม่ใช่ที่มาของความจริง
- **ความถูกต้องของเงินและสต๊อกมาก่อนความเร็ว** — โค้ดที่แตะเงิน/สต๊อกต้องพิสูจน์ได้ด้วยเทสต์
- **ledger เป็น immutable** — แก้ยอดด้วยการเพิ่ม `StockMovement` ใหม่ ไม่ใช่ทับของเดิม
- **ทุกอย่าง scope ด้วย `organizationId`** — หนึ่ง deployment เสิร์ฟหลายองค์กร ห้ามข้าม tenant
- **UI ต้องพูดความจริงของโมเดล** — เช่น SellableSku ไม่มีสต๊อกของตัวเอง
  (`available = min(floor(item.available / qty))`) ห้ามทำให้ผู้ใช้เข้าใจผิด
- **ภาษาไทยเป็นภาษาหลักของผู้ใช้** — copy/microcopy ต้องชัดและเป็นธรรมชาติ

### Language policy (กติกาภาษา — ใช้ร่วมทุก agent)

ภาษาของไฟล์ instruction ไม่ใช่ตัวกำหนดภาษาที่ agent ต้องผลิต — ยึดตามนี้:

| สิ่งที่ผลิต                                                | ภาษา                                                                                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| สื่อสารกับผู้ใช้ (คำอธิบาย, คำถาม, สรุป)                   | **ไทย**                                                                                                                              |
| UI copy / microcopy / error message ที่ผู้ใช้เห็น          | **i18n: ไทย (default) + อังกฤษ** — copy เป็น key, ไทยครบก่อน, อังกฤษ progressive (ดู [docs/design-system.md](docs/design-system.md)) |
| spec ฝั่ง user-facing (user story, AC ที่อ่านร่วมกับ user) | **ไทย**                                                                                                                              |
| โค้ด, identifier, ชื่อไฟล์, type/field name                | **อังกฤษ**                                                                                                                           |
| OpenAPI contract, schema, enum value                       | **อังกฤษ**                                                                                                                           |
| commit message, branch name, changelog, code comment       | **อังกฤษ**                                                                                                                           |
| ไฟล์ instruction ของ agent (`.claude/agents/*.md`)         | **อังกฤษ** (token-lean)                                                                                                              |

เหตุผล: โมเดลอ่านไทย/อังกฤษแม่นเท่ากัน แต่ instruction ที่โหลดบ่อยใช้อังกฤษเพื่อ
ประหยัด token; ส่วน output ที่ผู้ใช้สัมผัสต้องเป็นไทยเสมอ ไม่ว่า prompt จะภาษาอะไร

วิธีทำงานคือ **feature-driven**: งานแตกเป็น feature `F-XXX` แต่ละตัวไหลผ่าน
workflow เดียวกัน (ดูส่วนที่ 3)

---

## 2. Agent Roles — ใครรับผิดชอบอะไร

ทีมมี 7 agent แต่ละตัว **มีสิทธิ์ตัดสินใจเฉพาะในโดเมนของตัวเอง** นอกโดเมน =
หยุดแล้วถามเจ้าของ (ดู Escalation ท้ายส่วนนี้)

| Agent           | ตัดสินใจ (โดเมน)                                                                                                                                   | ไม่ตัดสินใจ — ส่งต่อให้                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **product**     | scope, F-XXX backlog, user stories, **acceptance criteria**, business rules                                                                        | UI→ux · feasibility/contract→backend-api · timing→release                   |
| **ux** (UX/UI)  | user flows, IA, wireframes, interaction, **Thai copy**, accessibility, **visual design + design tokens** (shared web↔mobile)                       | scope/rules→product · data shape→backend-api · code/token-impl→frontend     |
| **backend-api** | NestJS, Prisma schema, core-domain logic, **OpenAPI contract**, **technical/architecture design** (right-sized), transaction, ledger, multi-tenant | scope→product · UI→ux/frontend · infra→devops                               |
| **frontend**    | Next.js (web) + Flutter (mobile), client state, consume API client                                                                                 | contract→backend-api · flow/copy→ux · scope→product                         |
| **devops**      | Turborepo/pnpm, CI/CD, Docker, env/secrets, hosting, Redis+BullMQ ops, observability                                                               | features→product · schema→backend-api · release policy→release              |
| **qa**          | test strategy, unit/E2E plan, verify vs AC, quality gate verdict                                                                                   | "ถูกคืออะไร"→product+backend-api · CI wiring→devops · ship-decision→release |
| **release**     | versioning, changelog, branch/merge, phase/release gating, rollout & rollback                                                                      | scope→product · pass/fail→qa · deploy mechanism→devops                      |

**Escalation protocol** — subagent คุยกันเองตรงๆ ไม่ได้ เมื่อชนคำถามนอกโดเมน
ให้พ่น block นี้แล้ว **หยุด** (orchestrator จะ route ให้ตัวที่ถูกต้อง):

```
🚧 BLOCKED — needs a decision from: @<agent>
Question: <คำถามเดียว ชัดๆ>
Why I stopped: outside my domain (<agent> owns <X> only)
Options I see (if any): <a / b / c + trade-off>
What I'll do once answered: <ขั้นต่อไป>
```

หลักเหล็ก: **ถ้าไม่ใช่การตัดสินใจของฉัน ฉันหยุดแล้วถาม — ไม่เดา**

**Tie-break ladder** (เมื่อ 2 owner ขัดกัน): 1) ในโดเมนใคร → คนนั้นชี้ขาด · 2) scope/กฎธุรกิจ →
`product` · 3) feasibility/contract → `backend-api` · 4) trade-off ไม่มีเจ้าของชัด → **PM สรุป
options ส่ง user เคาะ** (ไม่ประนีประนอมเอง) · ทุกการ resolve → log [docs/DECISIONS.md](docs/DECISIONS.md) (D-XXX, append-only)

**Decision protocol — ประตูอยู่ที่ความ irreversible ไม่ใช่ความสำคัญ:**

- **Type 1 — ย้อนยาก/แพง** (schema/contract ที่ ship แล้ว, ตัด scope, เงิน, ความปลอดภัย, ลบข้อมูล,
  อะไรก็ตามที่ออกนอกระบบ): ✋ **รอ user เสมอ** — เสนอเป็น recommendation + ผลถ้าผิด + ย้อนยังไง
- **Type 2 — ย้อนได้ถูก** (ชื่อ internal, โครงไฟล์, ลำดับ task, เลือก lib ที่สลับได้, รายละเอียด
  ภายใต้ AC ที่เคาะแล้ว): **PM ตัดสินเองแล้วเดินต่อ** + log D-XXX พร้อม tag `[auto]` —
  user audit ย้อนหลังได้ ไม่เห็นด้วย = เพิ่ม entry ใหม่ supersede (ไม่ block งานระหว่างรอ)
- ก้ำกึ่ง = Type 1 · หลักนี้ใช้กับ PM เท่านั้น — subagent ยังใช้ 🚧 BLOCKED ตามเดิม

---

## 3. Workflow — Portfolio → Spec (2 gates) → Build → QA → Release

งานไหล 2 ระดับ: **Portfolio** (วางแผนรวม ทำเป็นรอบ) แล้วจึง **per-feature**
(หยิบทีละตัวจาก backlog) แต่ละด่านมี "ของที่ส่งต่อ" (handoff artifact)

### Portfolio — วางแผนรวม (เจ้าภาพ: `product`)

1. **Epic** — list feature หลักทั้งหมด
2. **แตกเป็น feature ย่อย + tag platform** (web / mobile / both) — _ไม่_ แตกเป็น
   คนละ feature ต่อ platform; ส่วนที่ใช้ร่วม (contract / data-model / business rule)
   เขียนครั้งเดียว แยกเฉพาะ UX/UI + navigation + ความสามารถเฉพาะ platform
3. **เรียง priority** → ได้ backlog ([docs/features/README.md](docs/features/README.md))

### Per-feature — หยิบจากบนสุดของ backlog

```
Gate 1 ──► Gate 2 ──► ✋commit ──► Build ──► QA ──► Release
(req)      (design)    (คุณ)      (impl)
```

1. **Gate 1 — Requirement** (`product`) — _ถูก เปลี่ยนง่าย_
   เริ่มด้วย **requirement elicitation (grill)** — ถาม user เป็นชุดจนเข้าใจครบ (ground กับ docs)
   → สรุปความเข้าใจให้ยืนยัน → จึงร่าง req spec · use case · user story · **AC** + advisory
   → ✋ **คุณ + product เคาะก่อน** ไม่ผ่านไม่ไป Gate 2 (กันเขียน design แล้วทิ้ง)

2. **Gate 2 — Design** (ต่อยอดจาก Gate 1 ที่อนุมัติแล้ว)
   - **Architecture / tech design** — `backend-api`
     _เฉพาะ feature ที่แตะ external service / sync / queue / money-stock ซับซ้อน
     — feature ภายในง่ายๆ ข้ามได้_ ครอบคลุม: push vs poll, idempotency,
     rate-limit, retry/backoff (BullMQ), reconciliation, partial-failure,
     mapping `ChannelListing`
   - **Data model → API design** — `backend-api` (data-model ขับ api)
   - **UX wireframe → UI** — `ux` (ออกแบบบน constraint ของ api ที่นิ่งแล้ว)
   - **Test plan** จาก AC — `qa`
     → **review เจาะจงเจ้าของแต่ละส่วน** (ไม่ใช่ทุกคน review ทุกอย่าง):
     architecture/api/data-model → `backend-api` · wireframe/UI → `ux` ·
     testability → `qa` · infra impact → `devops` · scope/AC → `product`

3. **✋ commit — คุณอนุมัติ**
   เอกสารผ่าน review ครบ → **คุณเคาะ → commit เอกสารทั้งหมดบน branch**
   = human gate ก่อนเขียนโค้ด

4. **Build** — `backend-api` → `frontend` (+ `devops`)
   `backend-api` ทำ contract/core-domain ตาม design + **unit test ไปพร้อมโค้ด**
   (กฎทองข้อ 4 ไม่ดองไว้ทีหลัง) → `frontend` consume client + build UI
   (ห้าม reshape data เอง — ขอ backend-api) → `devops` pipeline/env/queue

5. **QA** — `qa`
   automated (unit + integration + E2E) **+ manual** → verify vs AC + quality
   gate → ออก **verdict + defect list** route กลับเจ้าของโค้ด (รายงานตามจริง)

6. **Release** — `release`
   version · changelog · rollout (**dogfood ก่อน**) · **rollback plan** → go/no-go

> **Right-size:** feature ที่แตะ external/money-stock/cross-cutting = ทำเอกสารเต็ม;
> CRUD ภายใน/แก้ UI เล็ก = ข้าม architecture + ลดเอกสาร อย่าให้ gate หนักถ่วงงานง่าย
> **Loopback:** QA แดง → กลับ Build · review ขัดแย้ง / AC กำกวม → กลับ gate ก่อนหน้า
> ไม่มีด่านไหน "เดาแทน" ด่านก่อน — กำกวมเมื่อไหร่ใช้ escalation block

### 3.1 PM Loop — วงจรที่ PM (orchestrator) เดินทุก feature

```
① Intake → ② Decompose → ③ Dispatch → ④ Route ⇄ → ⑤ Integrate → ⑥ Gate
 (รับจาก user)  (วาง doc/task) (ส่ง agent)  (คุมคำถาม)   (รวม artifact)  (เคาะ/loopback)
```

PM = main session · **ไม่ทำงานในโดเมน** แต่ **แตกงาน + dispatch เจ้าของ + route คำถาม + รวมผล + คุมประตู**

- ④ Route: agent พ่น 🚧 BLOCKED → PM หา owner (จาก RACI) → owner ตอบ → log D-XXX → ป้อนกลับ
- PM ประกาศจังหวะปัจจุบันเสมอ · ไม่ตอบแทนเจ้าของ · ไม่ override fail

### 3.2 Gate 2 — เอกสารต่อทีม (per-feature directory)

feature **full** ที่ถึง Gate 2 → โปรโมตเป็น directory `docs/features/F-XXX/` แต่ละทีม gen เอกสารของตน:

```
docs/features/F-XXX/
  F-XXX.md (Gate1: AC — product) · architecture.md / data-model.md / api-spec.md (backend-api)
  ux-wireframe.md / ui.md (ux) · test-plan.md (qa) · security-review.md (security-reviewer, ถ้า full)
  tasks.md (task board — PM)
```

ลำดับ: dispatch ตาม dependency (architecture→data-model→api-spec → **security-reviewer** review spec
(feature full/แตะ auth-token-money) → ขนาน ux ∥ qa) · สงสัย = BLOCKED
ห้ามเดา · เสร็จ → **user sign off ทีละฉบับ** → ครบ → commit → **แตก task** → Build
(template: `docs/features/_gate2/`)

**กติกาเอกสาร + sign-off (บังคับ):**

- **Contract summary ≤20 บรรทัด** เปิดหัวทุกเอกสาร Gate 2: สิ่งที่ทีมอื่นต้องรู้/ยึด
  (seam, การตัดสินใจสำคัญ, D-XXX ที่อ้าง) — ทีม consumer อ่านแค่ summary; เนื้อเต็มมีไว้ให้เจ้าของ + reviewer
- **Context brief ตอน dispatch:** subagent อ่าน = CLAUDE.md (+ per-app CLAUDE.md auto-load) ·
  **canon ตามโดเมนที่ agent charter ระบุ** (docs/01 เสมอเมื่อแตะ domain · 02 / design-system ตามงาน) ·
  Gate-1 AC · ไฟล์ใน `ref` · D-XXX ที่ spec อ้าง — **ห้ามไล่อ่าน `docs/features/` ของ feature อื่น**:
  ความสอดคล้องข้าม feature อยู่ที่ canon (updated ผ่าน sync-back, Gate B) ไม่ใช่ spec เก่า
  (อาจถูก D-XXX ทับแล้ว) · ref ไม่พอ = 🚧 BLOCKED ไม่ใช่เดา
- **Sign-off เอกสารเทคนิค** (architecture/data-model/api-spec): PM ต้องประกบ
  (1) **สรุปภาษาคน ≤10 บรรทัด** — อะไรเสี่ยง อะไร trade-off ตัดสินใจอะไรแทน user ไม่ได้
  (skill `9arm-skills:management-talk`) + (2) **verdict ของ security-reviewer** ก่อนเสนอ user เคาะ
  · เอกสารที่ user ตัดสินเองได้ (AC, wireframe, copy) เสนอตรงตามเดิม

### 3.3 RACI ต่อ step (R=ลงมือ · A=ชี้ขาด · C=ถามก่อนเดิน · I=แจ้ง)

| Step                                | product |   ux    |   BE    |   FE    |   qa    | devops  | release |
| ----------------------------------- | :-----: | :-----: | :-----: | :-----: | :-----: | :-----: | :-----: |
| G1 req + AC + advisory              | **A/R** |    C    |    C    |    –    |    C    |    –    |    –    |
| G2 architecture→data-model→contract |    C    |    C    | **A/R** |    C    |    C    |    –    |    –    |
| G2 UX/UI (wireframe+ui)             |    C    | **A/R** |    C    |    C    |    I    |    –    |    –    |
| G2 test plan                        |    C    |    I    |    C    |    –    | **A/R** |    –    |    –    |
| Build backend + unit test           |    I    |    –    | **A/R** |    I    |    C    |    C    |    –    |
| Build frontend                      |    I    |    C    |    C    | **A/R** |    C    |    C    |    –    |
| Build infra/pipeline                |    –    |    –    |    C    |    C    |  **C**  | **A/R** |    C    |
| QA verify + gate                    |    C    |    I    |    C    |    C    | **A/R** |    C    |    C    |

> user = **A** ที่ human gate: G1 sign-off · G2 sign-off (ทีละฉบับ) · Release · Portfolio
> map skill ต่อ step: [docs/SKILL_MAP.md](docs/SKILL_MAP.md)

### 3.4 Task board — `docs/features/F-XXX/tasks.md` (table แยกต่อทีม, หลัง G2✓)

เจ้าของ task **update status ของตัวเอง** (`todo→in_progress→done` + `updated_by`) → PM dispatch task ที่ deps=done ครบ
แยก section ต่อทีม (backend-api / ux / devops / frontend / qa) · 1 แถว = 1 task:

```
## <team>
| ID | งาน | ref → target | deps | status | updated_by |
|----|-----|--------------|------|--------|------------|
| T-XXX-01 | ★ <ทำอะไร> | <Gate-2 doc + target path (apps/api…)> | <T-…/G2✓> | todo | — |
```

**★ = risk marker** (PM ติดตอนแตก task): task ที่แตะ **money / stock / auth / token /
tenant-isolation / concurrency** — มีผล 2 อย่าง: (1) dispatch ด้วย **opus** เสมอ (model
override รายครั้ง แม้ agent นั้น pin sonnet) (2) ต้องผ่าน **security-reviewer** ก่อน merge
(ดู §3.6) · `ref` = ทุกอย่างที่ subagent ต้องอ่าน (context brief §3.2) และชี้เป็น **`ไฟล์ §section`
ไม่ใช่ทั้งไฟล์** (เช่น `01-data-model §3 InventoryItem` — PM เป็นคนตัดตอนแตก task; อ่านเฉพาะ
section ที่ระบุ + Grep เพิ่มเมื่อจำเป็น) ·
**sizing: 1 task ≈ ครึ่งวัน / diff ~≤400 บรรทัด** — ใหญ่กว่า = แตกก่อน (§3.6 Build discipline)

### 3.5 Concurrency — contract = เส้นแบ่ง

หลัง contract นิ่ง: `ux` ∥ `qa` · Build: `backend-api` ∥ `devops` → contract/client พร้อม → `frontend`

### 3.6 Build execution — ตำแหน่งเขียนดู [workspace-map.md](docs/workspace-map.md)

`backend-api` (`apps/api`+`packages/*`, TDD+money-stock) ∥ `devops` → `frontend` (`apps/web`/`apps/mobile`, consume client, /design-sync)
→ ทุกทีม review ก่อน merge + ปิด T-ID ของตัวเอง · FE ห้าม reshape data เอง · **ทุก task ส่ง unit test ประกบโค้ดเสมอ** (D-014; money/stock = ขั้นต่ำห้ามแหก) เขียวก่อน merge

**Model ต่อ task (opus คิด → sonnet ทำ → คนละ model review):**

- task **★** (§3.4) → dispatch **opus** เสมอ · task ธรรมดา → model ที่ agent pin ไว้
- **งานช่างล้วน** (rename, boilerplate, format, สรุป log, scaffold ตาม pattern ที่มีแล้ว —
  ไม่มี judgment) → tier ถูกสุด: `qwen-agent` (claude-9arm) หรือ haiku — **ห้ามใช้กับ ★
  หรืองานที่มี business logic** และยังต้องผ่าน runnable proof + review ตามปกติ
- spec ละเอียด + test บังคับ + review = เงื่อนไขที่ทำให้ sonnet ทำงาน build ได้ปลอดภัย —
  ขาดข้อใดข้อหนึ่ง = อัพเป็น opus

**Review-before-merge matrix (right-size — review โดย model คนละตัวกับผู้เขียน):**

| ประเภทงาน                                 | Review ก่อน merge                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| ★ money/stock/auth/token/tenant-isolation | **บังคับ** `security-reviewer` (fable) เต็มรูปแบบ — threat model + golden rules |
| backend อื่น / contract change            | reviewer ระดับ medium (`code-review` หรือ security-reviewer ย่อ)                |
| UI ทั่วไป / copy / style                  | `code-review` low หรือ CI + test พอ                                             |

**Build discipline — กติกาคุม subagent ตอน build (บังคับทุก task):**

1. **Verify-don't-trust:** builder รายงาน "done" ต้องแปะ **คำสั่ง + output จริง** (test/lint) มาด้วย
   และ **PM รัน test+lint ซ้ำเอง** ก่อนปิด task — done ที่ไม่มี runnable proof = ไม่ done
2. **Test integrity:** diff ของ test ถูก review เข้มเท่าโค้ด · **ห้าม skip/ลบ/ลดความเข้ม** test ที่
   fail เพื่อให้ผ่าน (ทำได้เฉพาะมีเหตุผลใน PR + reviewer เห็นชอบ) · task ★ ต้องแสดงหลักฐาน
   **red→green** (test fail เมื่อไม่มี fix) ไม่ใช่ส่ง test ที่เกิดมาเขียว
3. **Fail-loud บน money/stock:** error บนเส้นทางเงิน/สต๊อก = โยนต่อ/ล้ม transaction เสมอ —
   **ห้าม catch-all กลืน error / คืนค่า default เงียบๆ** (พบ = review fail ทันที)
4. **Dependency ใหม่ = ขอ PM:** เพิ่ม package ต้องระบุเหตุผลใน task report ให้ PM อนุมัติ ·
   ไม่แน่ใจ API ของ lib → อ่าน types/docs จริงใน node_modules **ห้ามเดา**
5. **Task sizing:** 1 task ≈ ครึ่งวัน / diff ~≤400 บรรทัด — ใหญ่กว่านั้น PM แตกก่อน dispatch
   (model เล็กคุณภาพตกตามความยาว context)
6. **Protected paths:** `.claude/**` · `CLAUDE.md` · `WEB_TEAM.md` · `docs/00–05*.md` ·
   `docs/DECISIONS.md` = **PM/user แก้เท่านั้น** — diff ของ subagent ที่แตะ path เหล่านี้ = reject
   (กัน agent แก้กติกาที่คุมตัวมันเอง — CI check ตอน F-000: ดู team-upgrade-plan B2)
7. **Reviewer อ่าน diff ไม่อ่านคำบรรยาย:** dispatch review แนบ **diff + AC + spec เท่านั้น** —
   ไม่ส่ง self-summary ของ builder ให้ reviewer (กัน bias "ผู้เขียนบอกว่าถูก")

**Task report format (builder รายงานกลับ — ≤30 บรรทัด, เกินต้องมีเหตุผล):**

```
✅/🟡 T-XXX-NN — <งาน>
ทำอะไร: <≤3 บรรทัด>
Proof:   <คำสั่ง + output จริง (ท่อนท้าย)>
ตัดสินเอง: <decision ที่ทำระหว่างงาน — หรือ "ไม่มี">
เบี่ยงจาก spec: <จุดที่ทำต่างจาก ref/AC + เหตุผล — หรือ "ไม่มี">   ← ห้ามจมไว้ในเนื้อ
เพิ่ม dependency: <package + เหตุผล (รอ PM อนุมัติ) — หรือ "ไม่มี">
🚧 BLOCKED: <ถ้ามี — ใช้ format กลาง>
```

PM แนบ format นี้ในทุก dispatch — รายงาน free-form ยาวๆ = ตีกลับ

### 3.7 QA automation — 2 track

- **Track 1 scripted** (unit+contract+integration+E2E Playwright/Flutter) → CI ทุก PR → **hard gate** บล็อก merge
- **Track 2 agentic** (skill `qa` + Browser Use, คะแนน 1–5, persona SME non-tech) → **scheduled** (nightly + ก่อน release) → report ไม่บล็อก, เปิด loopback
- test data: seed ≥2 org + isolation test + state ผ่าน append `StockMovement` (ไม่ insert balance ตรง)

### 3.8 Session & token hygiene (PM)

- **1 session ≈ 1 gate หรือ 1 build batch** — จบแล้วปิด session; session ใหม่เริ่มจาก **ไฟล์**
  (plan, task board, D-XXX, RETRO) ไม่ใช่ transcript เดิม · state ทุกอย่างต้องอยู่ในไฟล์อยู่แล้ว
  (session ยาวจนโดน compaction = จ่าย token 2 เด้ง: สรุป + อ่านกลับ)
- **Friction log:** เจออาการ process มีปัญหา (ตาราง signal ใน [docs/RETRO.md](docs/RETRO.md)) →
  จด 1 บรรทัดลง RETRO **ทันที** ไม่รอจบ feature — micro-retro ตอน Gate F สังเคราะห์จาก log นี้
  ไม่ใช่จากความจำ (ความจำข้าม session ไม่มีอยู่จริง)
- **อ่านเป็น section:** ทั้ง PM และ subagent อ่านเฉพาะ section ที่ `ref` ชี้ (Grep → อ่านช่วง)
  ไม่ load ทั้งไฟล์ canon
- **Rule-budget guard — rulebook ต้องหดได้ ไม่ใช่โตข้างเดียว:**
  (1) **CLAUDE.md แช่แข็งขนาด** — เป็นไฟล์เดียวที่ auto-load ทุก agent ทุก dispatch; กติกาใหม่ลง
  skill/WEB_TEAM เท่านั้น เว้นแต่ universal จริง
  (2) **skill ≤ ~100 บรรทัด** — ยาวกว่า = แตกหรือตัด
  (3) ตอน rulebook scan ทุกจบ phase (team-upgrade-plan B9): กติกาไหน**ไม่เคยจับอะไรได้เลย** =
  เสนอตัดทิ้ง (Type 1 — user เคาะ)

---

## 4. Quality Gate — checklist ก่อนถือว่า "เสร็จ"

งานจะปิดได้ต่อเมื่อ **ผ่านครบทุกข้อ** ข้อไหนไม่ผ่าน = ยังไม่เสร็จ ห้าม merge

### Gate A — Requirement / Gate 1 (เจ้าภาพ: product)

- [ ] มี user stories + acceptance criteria ที่ **user เคาะแล้ว** ก่อนเริ่ม design
- [ ] ระบุ **platform** (web/mobile/both) + **right-size** (full / light)

### Gate B — Design & sign-off / Gate 2 (เจ้าภาพ: backend-api + ux + qa)

- [ ] (ถ้าแตะ external/sync/queue/money-stock) มี **architecture/tech design**:
      push vs poll, idempotency, rate-limit, retry/backoff, reconciliation, mapping
- [ ] data-model + API design + wireframe/UI ครบ (data-model ขับ api, api ขับ UX)
- [ ] **test plan จาก AC** ครบ (qa) — ทุก AC มี test case รองรับ
- [ ] เอกสาร review โดยเจ้าของแต่ละส่วนแล้ว (feature full/แตะ auth-token-money: มี verdict จาก `security-reviewer`)
- [ ] **sync-back ส่วนกลาง:** schema/contract/token ที่กระทบหลาย feature อัปเดตกลับ
      [docs/01-data-model.md](docs/01-data-model.md) / [docs/02-architecture.md](docs/02-architecture.md) /
      [docs/design-system.md](docs/design-system.md) แล้ว — หรือระบุชัดว่า "ไม่มีผลกระทบส่วนกลาง"
- [ ] ✋ **user อนุมัติ + commit เอกสารบน branch ก่อน implement** (เอกสารเทคนิค: มีสรุปภาษาคน + reviewer verdict ประกบ — §3.2)

### Gate C — Domain & Data (เจ้าภาพ: backend-api)

- [ ] ทุก query โดเมนกรอง `organizationId` (multi-tenant) — มีเทสต์ isolation
- [ ] write ที่กระทบสต๊อก/เงินอยู่ใน DB transaction **และ** เขียน `StockMovement`
- [ ] ปรับสต๊อกแบบ append-only — ไม่มี update/delete ยอดเดิม
- [ ] business logic แกนอยู่ใน `packages/core-domain` เป็น pure function
- [ ] เงินใช้ Decimal/numeric (ไม่มี float), สต๊อกเป็น integer
- [ ] **query bound:** query ใหม่บนตารางที่โตตามข้อมูล (movements/orders/listings/usage)
      มี index รองรับ + อธิบายว่า bound ยังไง (ไม่มี unbounded scan / N+1) — ตรวจตอน data-model review
- [ ] **fail-loud:** ไม่มี catch-all ที่กลืน error / คืน default เงียบบนเส้นทางเงิน/สต๊อก —
      error = โยนต่อ/ล้ม transaction (§3.6 Build discipline ข้อ 3)
- [ ] OpenAPI contract อัปเดต + client generate ใหม่แล้ว

### Gate D — Experience (เจ้าภาพ: ux + frontend)

- [ ] `ux-wireframe.md` มี **wireframe sketch ต่อ screen ประกบรายละเอียดของจอนั้น** ครบทุกจอ (inline paired, ไม่ใช่ appendix แยก)
- [ ] ครบทุก state: empty / loading / error + Thai copy ชัดเจน
- [ ] UI ไม่บิดความจริงของโมเดล (เช่น ไม่ทำให้ SellableSku ดูเหมือนมีสต๊อกเอง)
- [ ] frontend ไม่มี money math บน float — แสดงค่าที่ server คำนวณมา
- [ ] ผ่าน **Friendliness checklist** (skill `thai-ux`) + ไม่มี jargon ดิบบนจอ + reuse design system กลาง (target: SME ไทยไม่สาย tech)

### Gate E — Quality (เจ้าภาพ: qa)

- [ ] **ทุก task ที่ implement มี unit test ประกบและผ่านทั้งหมดก่อน merge** (กฎทองข้อ 4 / D-014) — เงิน/สต๊อกคือขั้นต่ำห้ามแหก
- [ ] **test script ทุก workspace เป็นตัวจริง** — ห้าม `echo ok`; workspace ที่ยังไม่มี test ใช้ `vitest run --passWithNoTests` (โครงพร้อมเขียน ไม่หลอกเขียว) · โค้ดใหม่ต้องออกแบบ testable (pure fn/DI/seam)
- [ ] unit + E2E เขียวทั้งหมด, lint ผ่าน — รายงานผลตามจริง (fail ก็บอกว่า fail)
- [ ] **runnable proof:** รายงาน "done" มีคำสั่ง+output จริงแนบ และ **PM รันซ้ำแล้วผลตรง** (§3.6 ข้อ 1)
- [ ] **test integrity:** ไม่มี test ถูก skip/ลบ/ลดความเข้มเพื่อให้ผ่าน (มี = ต้องมีเหตุผล+reviewer เห็นชอบ) ·
      task ★ มีหลักฐาน red→green · diff ไม่แตะ protected paths (§3.6 ข้อ 2/6)
- [ ] **CI Track 1** (unit+contract+integration+E2E-scripted) เขียว = hard gate ก่อน merge · Track 2 (Browser Use, scheduled) = report ไม่บล็อก
- [ ] regression สำคัญไม่พัง
- [ ] verdict เป็นลายลักษณ์: เขียว/แดง + defect ที่ค้าง (ถ้ามี)

### Gate F — Release (เจ้าภาพ: release)

- [ ] version bump + changelog
- [ ] merge/branch ตามนโยบาย, ทำบน branch (commit/push เมื่อ user สั่งเท่านั้น)
- [ ] มี rollback plan ชัดเจนก่อน go
- [ ] go/no-go อ้างอิงจาก qa เขียว + devops env พร้อม (ไม่ override fail เพื่อ ship)
- [ ] **micro-retro 5 บรรทัด** ลง [docs/RETRO.md](docs/RETRO.md) (PM) — pattern ซ้ำ 2 feature
      = เสนอแก้ workflow เข้า team-upgrade-plan

---

### อ้างอิง

- กฎทอง 7 ข้อ + โมเดลแกน 5 ชั้น → [CLAUDE.md](CLAUDE.md)
- รายละเอียด agent + ownership matrix → [.claude/agents/README.md](.claude/agents/README.md)
- data model (อ่านก่อนแตะสินค้า/สต๊อกเสมอ) → [docs/01-data-model.md](docs/01-data-model.md)
- backlog + feature workflow → [docs/features/README.md](docs/features/README.md)
- decision ข้ามทีม (append-only) → [docs/DECISIONS.md](docs/DECISIONS.md)
- skill ต่อ step × team → [docs/SKILL_MAP.md](docs/SKILL_MAP.md)
- ทีมไหน implement ที่ไหน → [docs/workspace-map.md](docs/workspace-map.md)
