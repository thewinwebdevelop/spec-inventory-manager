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

วิธีทำงานคือ **feature-driven**: งานแตกเป็น feature `F-XXX` แต่ละตัวไหลผ่าน
workflow เดียวกัน (ดูส่วนที่ 3)

---

## 2. Agent Roles — ใครรับผิดชอบอะไร

ทีมมี 7 agent แต่ละตัว **มีสิทธิ์ตัดสินใจเฉพาะในโดเมนของตัวเอง** นอกโดเมน =
หยุดแล้วถามเจ้าของ (ดู Escalation ท้ายส่วนนี้)

| Agent | ตัดสินใจ (โดเมน) | ไม่ตัดสินใจ — ส่งต่อให้ |
|-------|------------------|------------------------|
| **product** | scope, F-XXX backlog, user stories, **acceptance criteria**, business rules | UI→ux · feasibility/contract→backend-api · timing→release |
| **ux** | user flows, IA, wireframes, interaction, **Thai copy**, accessibility | scope/rules→product · data shape→backend-api · prod code→frontend |
| **backend-api** | NestJS, Prisma schema, core-domain logic, **OpenAPI contract**, transaction, ledger, multi-tenant | scope→product · UI→ux/frontend · infra→devops |
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

---

## 3. Workflow — Brief → UX → Build → QA → Release

งานทุก feature ไหลตามลำดับนี้ แต่ละด่านมี "ของที่ส่งต่อ" (handoff artifact)
ที่ด่านถัดไปใช้เป็นสัญญา

```
Brief ──► UX ──► Build ──► QA ──► Release
(product)(ux)  (backend-api    (qa)   (release)
              + frontend
              + devops)
```

1. **Brief — `product`**
   อ่าน docs ที่เกี่ยว (เสมอ: [docs/01-data-model.md](docs/01-data-model.md)) →
   ร่าง spec จาก [docs/features/_TEMPLATE.md](docs/features/_TEMPLATE.md):
   user stories + **acceptance criteria**
   → **ต้องให้ user review user-stories/AC ก่อนไปด่านถัดไป**
   **ส่งต่อ:** AC ที่ตกลงแล้ว = สัญญาของ scope

2. **UX — `ux`**
   เปลี่ยน AC เป็น flow + wireframe + Thai copy ครบทุก state
   (empty/loading/error) ระบุ data dependency ทุกตัว ไม่ชัวร์เรื่องข้อมูล →
   ถาม backend-api ก่อน
   **ส่งต่อ:** UX spec ที่ frontend นำไป implement ได้

3. **Build — `backend-api` → `frontend` (+ `devops`)**
   - `backend-api` ออกแบบ/ขยาย **OpenAPI contract ก่อน** (seam กลาง) →
     เขียน domain logic ใน `packages/core-domain` เป็น pure function +
     unit test → write ผ่าน transaction + เขียน ledger เสมอ
   - `frontend` generate API client → build ตาม UX spec + contract
     (ห้าม reshape data เอง — ถ้าต้องการ field/endpoint ใหม่ = ขอ backend-api)
   - `devops` เตรียม pipeline/env/queue ให้รันได้
   **ส่งต่อ:** โค้ดที่ build + test ผ่าน local

4. **QA — `qa`**
   map ทุก AC → test case, รัน unit + E2E, ตรวจ golden rules
   (money/stock มีเทสต์, ledger append-only, org isolation, Decimal/integer)
   → ออก **verdict + defect list** route กลับเจ้าของโค้ด
   **ส่งต่อ:** เขียว/แดง พร้อมหลักฐาน (รายงานตามจริงเสมอ)

5. **Release — `release`**
   เช็ค scope นิ่ง (product) + qa เขียว + devops env พร้อม → bump version,
   เขียน changelog, กำหนด merge/rollout + **rollback plan** → go/no-go
   **ส่งต่อ:** release ที่ย้อนกลับได้ (dogfood ก่อน แล้วค่อยลูกค้านอก)

> ไหลย้อนได้: ถ้า QA เจอ defect → กลับ Build; ถ้า AC กำกวม → กลับ Brief
> ไม่มีด่านไหน "เดาแทน" ด่านก่อนหน้า — กำกวมเมื่อไหร่ ส่ง escalation ขึ้นไป

---

## 4. Quality Gate — checklist ก่อนถือว่า "เสร็จ"

งานจะปิดได้ต่อเมื่อ **ผ่านครบทุกข้อ** ข้อไหนไม่ผ่าน = ยังไม่เสร็จ ห้าม merge

### Gate A — Scope & Spec (เจ้าภาพ: product)
- [ ] มี user stories + acceptance criteria ที่ user review แล้ว
- [ ] ทุก AC มี test case รองรับ (ตรวจร่วมกับ qa)

### Gate B — Domain & Data (เจ้าภาพ: backend-api)
- [ ] ทุก query โดเมนกรอง `organizationId` (multi-tenant) — มีเทสต์ isolation
- [ ] write ที่กระทบสต๊อก/เงินอยู่ใน DB transaction **และ** เขียน `StockMovement`
- [ ] ปรับสต๊อกแบบ append-only — ไม่มี update/delete ยอดเดิม
- [ ] business logic แกนอยู่ใน `packages/core-domain` เป็น pure function
- [ ] เงินใช้ Decimal/numeric (ไม่มี float), สต๊อกเป็น integer
- [ ] OpenAPI contract อัปเดต + client generate ใหม่แล้ว

### Gate C — Experience (เจ้าภาพ: ux + frontend)
- [ ] ครบทุก state: empty / loading / error + Thai copy ชัดเจน
- [ ] UI ไม่บิดความจริงของโมเดล (เช่น ไม่ทำให้ SellableSku ดูเหมือนมีสต๊อกเอง)
- [ ] frontend ไม่มี money math บน float — แสดงค่าที่ server คำนวณมา

### Gate D — Quality (เจ้าภาพ: qa)
- [ ] **โค้ดที่แตะเงิน/สต๊อกมี unit test ผ่านก่อน merge** (กฎทองข้อ 4)
- [ ] unit + E2E เขียวทั้งหมด, lint ผ่าน — รายงานผลตามจริง (fail ก็บอกว่า fail)
- [ ] regression สำคัญไม่พัง
- [ ] verdict เป็นลายลักษณ์: เขียว/แดง + defect ที่ค้าง (ถ้ามี)

### Gate E — Release (เจ้าภาพ: release)
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
