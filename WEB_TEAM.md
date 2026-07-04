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

| สิ่งที่ผลิต | ภาษา |
|-----------|------|
| สื่อสารกับผู้ใช้ (คำอธิบาย, คำถาม, สรุป) | **ไทย** |
| UI copy / microcopy / error message ที่ผู้ใช้เห็น | **i18n: ไทย (default) + อังกฤษ** — copy เป็น key, ไทยครบก่อน, อังกฤษ progressive (ดู [docs/design-system.md](docs/design-system.md)) |
| spec ฝั่ง user-facing (user story, AC ที่อ่านร่วมกับ user) | **ไทย** |
| โค้ด, identifier, ชื่อไฟล์, type/field name | **อังกฤษ** |
| OpenAPI contract, schema, enum value | **อังกฤษ** |
| commit message, branch name, changelog, code comment | **อังกฤษ** |
| ไฟล์ instruction ของ agent (`.claude/agents/*.md`) | **อังกฤษ** (token-lean) |

เหตุผล: โมเดลอ่านไทย/อังกฤษแม่นเท่ากัน แต่ instruction ที่โหลดบ่อยใช้อังกฤษเพื่อ
ประหยัด token; ส่วน output ที่ผู้ใช้สัมผัสต้องเป็นไทยเสมอ ไม่ว่า prompt จะภาษาอะไร

วิธีทำงานคือ **feature-driven**: งานแตกเป็น feature `F-XXX` แต่ละตัวไหลผ่าน
workflow เดียวกัน (ดูส่วนที่ 3)

---

## 2. Agent Roles — ใครรับผิดชอบอะไร

ทีมมี 7 agent แต่ละตัว **มีสิทธิ์ตัดสินใจเฉพาะในโดเมนของตัวเอง** นอกโดเมน =
หยุดแล้วถามเจ้าของ (ดู Escalation ท้ายส่วนนี้)

| Agent | ตัดสินใจ (โดเมน) | ไม่ตัดสินใจ — ส่งต่อให้ |
|-------|------------------|------------------------|
| **product** | scope, F-XXX backlog, user stories, **acceptance criteria**, business rules | UI→ux · feasibility/contract→backend-api · timing→release |
| **ux** (UX/UI) | user flows, IA, wireframes, interaction, **Thai copy**, accessibility, **visual design + design tokens** (shared web↔mobile) | scope/rules→product · data shape→backend-api · code/token-impl→frontend |
| **backend-api** | NestJS, Prisma schema, core-domain logic, **OpenAPI contract**, **technical/architecture design** (right-sized), transaction, ledger, multi-tenant | scope→product · UI→ux/frontend · infra→devops |
| **frontend** | Next.js (web) + Flutter (mobile), client state, consume API client | contract→backend-api · flow/copy→ux · scope→product |
| **devops** | Turborepo/pnpm, CI/CD, Docker, env/secrets, hosting, Redis+BullMQ ops, observability | features→product · schema→backend-api · release policy→release |
| **qa** | test strategy, unit/E2E plan, verify vs AC, quality gate verdict | "ถูกคืออะไร"→product+backend-api · CI wiring→devops · ship-decision→release |
| **release** | versioning, changelog, branch/merge, phase/release gating, rollout & rollback | scope→product · pass/fail→qa · deploy mechanism→devops |

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

---

## 3. Workflow — Portfolio → Spec (2 gates) → Build → QA → Release

งานไหล 2 ระดับ: **Portfolio** (วางแผนรวม ทำเป็นรอบ) แล้วจึง **per-feature**
(หยิบทีละตัวจาก backlog) แต่ละด่านมี "ของที่ส่งต่อ" (handoff artifact)

### Portfolio — วางแผนรวม (เจ้าภาพ: `product`)
1. **Epic** — list feature หลักทั้งหมด
2. **แตกเป็น feature ย่อย + tag platform** (web / mobile / both) — *ไม่* แตกเป็น
   คนละ feature ต่อ platform; ส่วนที่ใช้ร่วม (contract / data-model / business rule)
   เขียนครั้งเดียว แยกเฉพาะ UX/UI + navigation + ความสามารถเฉพาะ platform
3. **เรียง priority** → ได้ backlog ([docs/features/README.md](docs/features/README.md))

### Per-feature — หยิบจากบนสุดของ backlog

```
Gate 1 ──► Gate 2 ──► ✋commit ──► Build ──► QA ──► Release
(req)      (design)    (คุณ)      (impl)
```

1. **Gate 1 — Requirement** (`product`) — *ถูก เปลี่ยนง่าย*
   req spec · use case · user story · **AC**
   → ✋ **คุณ + product เคาะก่อน** ไม่ผ่านไม่ไป Gate 2 (กันเขียน design แล้วทิ้ง)

2. **Gate 2 — Design** (ต่อยอดจาก Gate 1 ที่อนุมัติแล้ว)
   - **Architecture / tech design** — `backend-api`
     *เฉพาะ feature ที่แตะ external service / sync / queue / money-stock ซับซ้อน
     — feature ภายในง่ายๆ ข้ามได้* ครอบคลุม: push vs poll, idempotency,
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
  ux-wireframe.md / ui.md (ux) · test-plan.md (qa) · tasks.md (task board — PM)
```
ลำดับ: dispatch ตาม dependency (architecture→data-model→api-spec → ขนาน ux ∥ qa) · สงสัย = BLOCKED
ห้ามเดา · เสร็จ → **user sign off ทีละฉบับ** → ครบ → commit → **แตก task** → Build
(template: `docs/features/_gate2/`)

### 3.3 RACI ต่อ step (R=ลงมือ · A=ชี้ขาด · C=ถามก่อนเดิน · I=แจ้ง)
| Step | product | ux | BE | FE | qa | devops | release |
|------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| G1 req + AC + advisory | **A/R** | C | C | – | C | – | – |
| G2 architecture→data-model→contract | C | C | **A/R** | C | C | – | – |
| G2 UX/UI (wireframe+ui) | C | **A/R** | C | C | I | – | – |
| G2 test plan | C | I | C | – | **A/R** | – | – |
| Build backend + unit test | I | – | **A/R** | I | C | C | – |
| Build frontend | I | C | C | **A/R** | C | C | – |
| Build infra/pipeline | – | – | C | C | **C** | **A/R** | C |
| QA verify + gate | C | I | C | C | **A/R** | C | C |
> user = **A** ที่ human gate: G1 sign-off · G2 sign-off (ทีละฉบับ) · Release · Portfolio
> map skill ต่อ step: [docs/SKILL_MAP.md](docs/SKILL_MAP.md)

### 3.4 Task board — `docs/features/F-XXX/tasks.md` (block ต่อ task, หลัง G2✓)
เจ้าของ task **update status ของตัวเอง** (`todo→in_progress→done` + `updated_by`) → PM dispatch task ที่ deps=done ครบ
```
## T-XXX-01 · backend · <ชื่อสั้น>
- desc: <ทำอะไร> · ref: <เอกสาร Gate-2 + target path (apps/api…)> · deps: <T-…/G2✓> · status: todo · updated_by: —
```

### 3.5 Concurrency — contract = เส้นแบ่ง
หลัง contract นิ่ง: `ux` ∥ `qa` · Build: `backend-api` ∥ `devops` → contract/client พร้อม → `frontend`

### 3.6 Build execution — ตำแหน่งเขียนดู [workspace-map.md](docs/workspace-map.md)
`backend-api` (`apps/api`+`packages/*`, TDD+money-stock) ∥ `devops` → `frontend` (`apps/web`/`apps/mobile`, consume client, /design-sync)
→ ทุกทีม review ก่อน merge + ปิด T-ID ของตัวเอง · FE ห้าม reshape data เอง · money/stock unit test เขียวก่อน merge

### 3.7 QA automation — 2 track
- **Track 1 scripted** (unit+contract+integration+E2E Playwright/Flutter) → CI ทุก PR → **hard gate** บล็อก merge
- **Track 2 agentic** (skill `qa` + Browser Use, คะแนน 1–5, persona SME non-tech) → **scheduled** (nightly + ก่อน release) → report ไม่บล็อก, เปิด loopback
- test data: seed ≥2 org + isolation test + state ผ่าน append `StockMovement` (ไม่ insert balance ตรง)

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
- [ ] เอกสาร review โดยเจ้าของแต่ละส่วนแล้ว
- [ ] ✋ **user อนุมัติ + commit เอกสารบน branch ก่อน implement**

### Gate C — Domain & Data (เจ้าภาพ: backend-api)
- [ ] ทุก query โดเมนกรอง `organizationId` (multi-tenant) — มีเทสต์ isolation
- [ ] write ที่กระทบสต๊อก/เงินอยู่ใน DB transaction **และ** เขียน `StockMovement`
- [ ] ปรับสต๊อกแบบ append-only — ไม่มี update/delete ยอดเดิม
- [ ] business logic แกนอยู่ใน `packages/core-domain` เป็น pure function
- [ ] เงินใช้ Decimal/numeric (ไม่มี float), สต๊อกเป็น integer
- [ ] OpenAPI contract อัปเดต + client generate ใหม่แล้ว

### Gate D — Experience (เจ้าภาพ: ux + frontend)
- [ ] ครบทุก state: empty / loading / error + Thai copy ชัดเจน
- [ ] UI ไม่บิดความจริงของโมเดล (เช่น ไม่ทำให้ SellableSku ดูเหมือนมีสต๊อกเอง)
- [ ] frontend ไม่มี money math บน float — แสดงค่าที่ server คำนวณมา
- [ ] ผ่าน **Friendliness checklist** (skill `thai-ux`) + ไม่มี jargon ดิบบนจอ + reuse design system กลาง (target: SME ไทยไม่สาย tech)

### Gate E — Quality (เจ้าภาพ: qa)
- [ ] **โค้ดที่แตะเงิน/สต๊อกมี unit test ผ่านก่อน merge** (กฎทองข้อ 4)
- [ ] unit + E2E เขียวทั้งหมด, lint ผ่าน — รายงานผลตามจริง (fail ก็บอกว่า fail)
- [ ] **CI Track 1** (unit+contract+integration+E2E-scripted) เขียว = hard gate ก่อน merge · Track 2 (Browser Use, scheduled) = report ไม่บล็อก
- [ ] regression สำคัญไม่พัง
- [ ] verdict เป็นลายลักษณ์: เขียว/แดง + defect ที่ค้าง (ถ้ามี)

### Gate F — Release (เจ้าภาพ: release)
- [ ] version bump + changelog
- [ ] merge/branch ตามนโยบาย, ทำบน branch (commit/push เมื่อ user สั่งเท่านั้น)
- [ ] มี rollback plan ชัดเจนก่อน go
- [ ] go/no-go อ้างอิงจาก qa เขียว + devops env พร้อม (ไม่ override fail เพื่อ ship)

---

### อ้างอิง
- กฎทอง 7 ข้อ + โมเดลแกน 5 ชั้น → [CLAUDE.md](CLAUDE.md)
- รายละเอียด agent + ownership matrix → [.claude/agents/README.md](.claude/agents/README.md)
- data model (อ่านก่อนแตะสินค้า/สต๊อกเสมอ) → [docs/01-data-model.md](docs/01-data-model.md)
- backlog + feature workflow → [docs/features/README.md](docs/features/README.md)
- decision ข้ามทีม (append-only) → [docs/DECISIONS.md](docs/DECISIONS.md)
- skill ต่อ step × team → [docs/SKILL_MAP.md](docs/SKILL_MAP.md)
- ทีมไหน implement ที่ไหน → [docs/workspace-map.md](docs/workspace-map.md)
