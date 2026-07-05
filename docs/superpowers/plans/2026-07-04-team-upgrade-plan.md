# Team Upgrade Plan — จาก PM/AI-engineering review (2026-07-04)

> **ที่มา:** session review workflow/agent team/skill ทั้งระบบ (branch `claude/unruffled-galileo-3c718d`)
> **วิธีใช้:** session ที่มาทำต่อ อ่านไฟล์นี้ + CLAUDE.md + WEB_TEAM.md ก็เริ่มได้ — ไม่ต้องพึ่งบทสนทนาเดิม
> ทำเสร็จข้อไหน → ติ๊ก checkbox + ใส่วันที่ · decision ข้ามทีม → log D-XXX ตามเดิม · **ห้าม commit/push เองจนกว่า user สั่ง**
> **Batch A** = ✅ ทำครบแล้ว 2026-07-04 (user สั่งทำทันที; scheduled run 16:50 ถูก disable แล้ว) · **Batch B** = ผูก trigger อนาคต

---

## สิ่งที่ทำไปแล้วใน session นี้ (บริบทให้ session ใหม่ — อย่าทำซ้ำ)
- `backend-reviewer` → **`security-reviewer`** (full-stack: + client-side token/XSS/CSP/secure-storage/deep-link) — [.claude/agents/security-reviewer.md](../../../.claude/agents/security-reviewer.md)
- **★ risk-marker** (money/stock/auth/token/tenant-isolation/concurrency) = dispatch opus + security-reviewer บังคับก่อน merge — WEB_TEAM §3.4/§3.6 + review-before-merge matrix
- **Contract summary ≤20 บรรทัด** หัวทุกเอกสาร Gate 2 (templates `_gate2/*` มี stub แล้ว) · **Context brief** ตอน dispatch (อ่าน canon+AC+ref+D-XXX เท่านั้น ห้ามไล่ `docs/features/` ของ feature อื่น)
- **Sync-back = hard gate** ใน Gate B (WEB_TEAM §4 + quality-gate skill: "Silent drift = fail")
- **PM plain-summary ≤10 บรรทัด + reviewer verdict** ประกบ sign-off เอกสารเทคนิค (gate2 step 4)
- canon [docs/01-data-model.md](../../01-data-model.md) sync แล้ว: RefreshToken + familyId/tokenHash/familyExpiresAt (D-007/D-011)

---

## Batch A — execute ทันที

### A1. ★ retro-tag F-001 tasks ✅ 2026-07-04
**File:** [docs/features/F-001/tasks.md](../../features/F-001/tasks.md)
เติม `★ ` หน้าข้อความคอลัมน์ "งาน" ของ **T-001-05, T-001-07, T-001-16, T-001-17** (refresh service, auth endpoints, web token flow, mobile secure storage — ทั้งหมดเข้านิยาม ★ auth/token)
หมายเหตุใต้ตาราง: ★ ตามเกณฑ์ WEB_TEAM §3.4 (retro-tag 2026-07-04) — T-001-01 มี ★ อยู่แล้ว

### A2. Feature backlog gap scan ✅ 2026-07-04 → รายงาน: [2026-07-04-backlog-gap-scan.md](2026-07-04-backlog-gap-scan.md) (10 ข้อ — G-1/G-2 รอ user เคาะ)
อ่าน [docs/features/README.md](../../features/README.md) + F-000..F-007 spec + [capability-matrix.md](../../features/capability-matrix.md) + [forward-commitments.md](../../features/forward-commitments.md) แล้วประเมิน gap → **เขียนรายงานเสนอ user** (อย่าแก้ backlog เอง — scope เป็นของ product+user) มุมที่ต้องเช็คอย่างน้อย:
1. **PDPA / data subject rights** — ลบ/export ข้อมูลส่วนบุคคล (ทั้งของ user เราและ *ลูกค้าของ tenant* ที่ไหลมากับ order) — ตอนนี้ไม่มี F ไหนถือเลย
2. **CSV import (F-092, icebox)** — ร้านจริงมีข้อมูลเดิม; ไม่มี import = onboarding blocker → ควรดึงขึ้นก่อน public launch ไหม
3. **Stock take (F-093, icebox)** — ความเชื่อมั่นสต๊อกเป็น core value prop; พิจารณาดึงขึ้น Phase 3
4. **Email/SMTP infra** — ผูกไว้ที่ F-081 (Phase 5) แต่ reset/verify/alert อาจต้องการก่อน → ยืนยัน timing
5. **Backup/restore & DR** — เป็น infra ล้วนหรือควรมี feature-level (org-level export)?
6. **Status page / service health ให้ลูกค้าเห็น** — ก่อนขายจริง
7. **Sync-conflict UX** — F-025 คุม oversell แต่ "platform แก้ข้อมูลเองแล้วเราทับ" มี UX แจ้งเตือน/ยืนยันไหม
8. **Connector sandbox/test tooling** — dev/QA ทดสอบ Shopee ยังไงโดยไม่ยิงร้านจริง (กระทบ F-020+)
9. dependency chain ใน backlog ครบ/ถูกไหม (เช่น F-050 ควรพึ่ง F-024 อย่างเดียวพอ?)

### A3. เพิ่ม skills ใหม่ 8 ตัว ✅ 2026-07-04 (สร้างครบ + wire เข้า agent files/SKILL_MAP/README แล้ว)
สร้าง `.claude/skills/<name>/SKILL.md` สไตล์เดียวกับ [money-stock](../../../.claude/skills/money-stock/SKILL.md) (token-lean, สั่งเป็นเกณฑ์ตรวจได้, อ้าง golden rules ไม่ restate) แล้ว **wire เข้า** agent file ("Skills" section ของเจ้าของ) + [docs/SKILL_MAP.md](../../SKILL_MAP.md) + `.claude/agents/README.md` ตาราง skill:

| skill | เจ้าของ | แกนเนื้อหา |
|---|---|---|
| `contract-evolution` | backend-api | contract หลังมี client จริง: **additive-only**, optional-first ตอนเพิ่ม field, deprecate ≥1 minor ก่อนลบ, breaking = version bump + D-XXX + release เป็นเจ้าภาพ sequencing, มือถือบน store update ช้า = ถือเป็น client เก่าเสมอ, CI `openapi-diff` (devops wire) |
| `prisma-migration` | backend-api | **expand→migrate→contract**, ห้าม destructive (DROP/rename) บนตารางมีข้อมูลใน migration เดียวกับ code deploy, additive ก่อน-backfill-ค่อย constraint, ledger/`StockMovement` = ห้าม ALTER ที่ทำลาย append-only, ทุก migration มี rollback path + ทดสอบบน seed ≥2 org |
| `client-security` | frontend | web: access token in-memory เท่านั้น (ห้าม localStorage), refresh = httpOnly cookie, CSRF header, ห้าม secret/token ใน URL/log, sanitize ทุก HTML injection point, CSP baseline · mobile: Keychain/Keystore เท่านั้น, clear-on-logout, deep-link validate, ปิด screenshot บนจอ sensitive (พิจารณา), webview ห้ามรับ token |
| `ux-heuristic-review` | ux | ดู A5 |
| `regression-curation` | qa | เกณฑ์เข้า regression pack ถาวร: ทุก test จาก defect จริง + ทุก ★ matrix + golden-path ต่อ feature · จัด tier: smoke (ทุก PR) / full (nightly) · budget เวลา CI, test flaky = ซ่อมหรือถอดพร้อมเหตุผล ห้าม skip เงียบ |
| `observability-standard` | devops | ต่อ feature full: structured log (orgId เสมอ, ห้าม PII/token), metric ต่อ queue (depth, fail rate, age), alert threshold + ผู้รับ, health check, runbook 5 บรรทัด "พังแล้วดูอะไร" — เป็น input ของ architecture template section ใหม่ (B6) |
| `backup-dr` | devops | นโยบาย backup PG (frequency, retention, PITR), **restore drill เป็น procedure มี schedule**, RTO/RPO เป้าหมาย, encrypted off-site, ครอบ object storage ด้วย |
| `compliance-checklist` | product | PDPA: ระบุ personal data ที่ feature แตะ (รวมข้อมูลลูกค้าของ tenant จาก order), lawful basis, retention, สิทธิ์ลบ/export, ไม่เก็บเกิน purpose · ใช้เป็น sit-skill ตอน Gate 1 ของ feature ที่แตะ personal data |

**ไม่ทำตอนนี้ (ตาม D-001 logic — รอโค้ดจริง):** `flutter-feature` → B4

### A4. Performance gate (แก้ "ไม่มี perf ในทุก gate") ✅ 2026-07-04
1. **WEB_TEAM §4 Gate C** + **quality-gate skill Gate C** เพิ่มข้อ: *"query ใหม่บนตารางที่โตตามข้อมูล (movements, orders, listings, usage) ต้องระบุ index รองรับ + อธิบายว่า query bound ยังไง (ไม่มี unbounded scan/N+1) — เป็นส่วนหนึ่งของ data-model review"*
2. **template `_gate2/architecture.md`** เพิ่มบรรทัด: *"**Capacity expectations:** ปริมาณ/อัตราที่ออกแบบรับ (orders/วัน, sync jobs/ชม., payload size) + จุดที่จะพังก่อนถ้าเกิน"*
3. **template `_gate2/test-plan.md`** เพิ่มบรรทัด (full เท่านั้น): *"perf smoke: endpoint list หลักตอบใน budget บน seed ใหญ่ (เช่น 10k movements) — right-size, ไม่ใช่ load test เต็ม"*
4. **load test เต็มรูปแบบ** = อยู่ B7 (launch-readiness) — อย่าลากเข้า Phase 0/1

### A5. ux → opus + skill `ux-heuristic-review` ✅ 2026-07-04
1. [.claude/agents/ux.md](../../../.claude/agents/ux.md) frontmatter `model: sonnet` → `model: opus` (+ อัปเดต model-pinning note ใน `.claude/agents/README.md` — เหตุผล: UX คือ differentiator, user เป็น non-tech ตรวจเชิงลึกแทนไม่ได้)
2. skill ใหม่ `ux-heuristic-review` (ux, ใช้**ก่อนเสนอ user ทุกครั้ง**): (ก) **SME persona walkthrough** — เดิน flow เป็น "แม่ค้าที่ไม่เคยใช้ ERP" ทีละจอ: รู้ไหมว่าต้องกดอะไรต่อ, ศัพท์เข้าใจไหม (เทียบ glossary ใน thai-ux), พลาดแล้วกู้ยังไง (ข) **heuristic checklist**: state ครบ 4 (design-system §2), error บอกทางแก้, ไม่มี dead-end, การกระทำทำลายมี confirm+consequence, ความจริงของโมเดลไม่ถูกบิด (SellableSku ฯลฯ), จำนวน step ต่อ task หลัก ≤ ที่จำเป็น (ค) output: ตาราง finding + fix ก่อน submit — แนบท้าย ux-wireframe.md
3. wire: ux.md Skills section + SKILL_MAP (Gate 2 แถว ux) + gate2.md step ux (เพิ่ม "ผ่าน ux-heuristic-review ก่อนเสนอ")

### A6. Build discipline — กติกาคุม subagent ตอน build ✅ 2026-07-04
7 กติกา (user เคาะ "เอา"): (1) verify-don't-trust — done ต้องมี runnable proof + PM รัน test/lint ซ้ำเอง
(2) test integrity — ห้าม skip/ลบ/ลดความเข้ม test เพื่อให้ผ่าน, ★ ต้องมี red→green evidence
(3) fail-loud บน money/stock — ห้าม catch-all กลืน error (4) dependency ใหม่ = ขอ PM + เหตุผล, API ไม่แน่ใจ = อ่าน types ห้ามเดา
(5) task sizing ≈ ครึ่งวัน/≤400 บรรทัด diff (6) protected paths (`.claude/**`, CLAUDE.md, WEB_TEAM.md,
docs/00–05, DECISIONS.md) = PM/user เท่านั้น (7) reviewer ได้ diff+AC+spec — ไม่ได้ self-summary ของ builder
ลงที่: WEB_TEAM §3.4/§3.6 (block "Build discipline") + Gate C (fail-loud) + Gate E (proof/integrity) ·
quality-gate SKILL (Gate C/E + diff hygiene) · docs/05 §8 · `_gate2/tasks.md` (sizing+proof note)

### A7. ถอดกระบวนการคิด fable → 3 thinking skills ✅ 2026-07-04
user ขอ "ถอดแนวคิด fable เป็น skill ให้ model อื่นคิดใกล้เคียง": สร้าง
`adversarial-review` (วิธีรีวิว — own model ก่อนอ่าน claim, ล่าสิ่งที่**ขาด**, falsify ทุก claim,
rank ตาม blast radius, calibration guard) · `blindspot-scan` (วิธีหาจุดบอด — 6 passes:
promise-vs-owner, follow-the-data, walk-the-user's-day, timeline collision, absence catalog,
cross-artifact diff — อ้าง gap-scan 2026-07-04 เป็น worked example) · `decompose-plan`
(วิธีแตกแพลน — outcome-first, seam-cut, ★-mark ก่อน dispatch, sizing, Batch A/B trigger-bound)
wire: SKILL_MAP (PM/Portfolio/review rows) + agents README + product/qa/security-reviewer
**ขีดจำกัดที่บันทึกไว้:** skill ถ่ายทอด*กระบวนการ*ได้ ~70-80% แต่ถ่ายทอด*วิจารณญาณ*ไม่ได้ —
จึงยังคง model pinning (fable/opus) ที่จุดตัดสินสูงสุดตาม README

### A8. PM effectiveness (R1–R4, user เคาะ "เอาทั้งหมด") ✅ 2026-07-04
- **R2 Decision protocol** ✅: WEB_TEAM §2 — Type 1 (ย้อนยาก/แพง) = ✋ user เสมอ · Type 2 (ย้อนได้ถูก)
  = PM ตัดสินเอง + log D-XXX tag `[auto]` (อธิบาย tag ใน DECISIONS.md header) · ก้ำกึ่ง = Type 1
- **R3 Micro-retro** ✅: `docs/RETRO.md` (append-only, 5 บรรทัด/feature) + checkbox ใน Gate F
  (WEB_TEAM + quality-gate skill) + SKILL_MAP Release · pattern ซ้ำ 2 feature = เสนอแก้ workflow
  · **เสริม (user ขอ 2026-07-04): friction log** — PM จด 1 บรรทัด**ทันทีที่เจอ**อาการ process
  มีปัญหา (ตาราง 7 signals ใน RETRO.md: กติกาไม่ถูกอ่าน, bounce, BLOCKED ถามของที่มีใน ref,
  proof ปลอม, กติกาไม่กันของที่ควรกัน ฯลฯ) · micro-retro สังเคราะห์จาก log ไม่ใช่ความจำ ·
  จังหวะ report: ทันที (block/เสี่ยงเงิน-ข้อมูล) → จบ feature → ซ้ำ×2 → จบ phase
- **R1 `pnpm verify`** → Batch B10 (trigger: F-000 Gate 2) — ทำให้ verify-don't-trust ถูกจริง
- **R4 Rulebook consistency scan** → ผนวกเข้า B9 (blindspot-scan pass 6 กับ workflow docs ทุกจบ phase)
- ที่เสนอแล้วตัดทิ้ง (บันทึกกันเสนอซ้ำ): process metrics แบบเก็บตัวเลข (overhead ไม่คุ้มจนกว่ารันหลาย
  feature ขนาน) · formalize session-handoff เพิ่ม (plan files + task board + memory พิสูจน์แล้วว่าพอ)

### A9. Token economy (T1–T5, user เคาะ "เอา") ✅ 2026-07-04
- **T1 ref ระดับ section** ✅: `ref` ชี้ `ไฟล์ §section` ไม่ใช่ทั้งไฟล์ (WEB_TEAM §3.4 + tasks template) + วินัยอ่านเป็นช่วง (conventions §8, §3.8)
- **T2 task report format ≤30 บรรทัด** ✅: ทำอะไร/proof/ตัดสินเอง/เบี่ยงจาก spec/dep ใหม่/BLOCKED (WEB_TEAM §3.6 + conventions §8) — free-form ยาว = ตีกลับ
- **T3 cheap tier** ✅: งานช่างล้วน → qwen-agent/haiku ในตาราง model ต่อ task + SKILL_MAP — ห้าม ★/logic
- **T4 session hygiene** ✅: WEB_TEAM §3.8 — 1 session ≈ 1 gate/1 build batch, session ใหม่เริ่มจากไฟล์
- **T5 rule-budget guard** ✅: CLAUDE.md แช่แข็งขนาด · skill ≤100 บรรทัด · rulebook scan (B9) เสนอตัดกติกาที่ไม่เคยจับอะไร (agents README + §3.8)
- **หลักที่ประกาศไว้:** นี่คือชุด proactive ชุดสุดท้าย — การจูน process ต่อจากนี้ต้องมาจากข้อมูล retro (R3/RETRO.md) ไม่ใช่จากการคิดเพิ่มเอง

---

## Batch B — ผูก trigger (จาก priority list ข้อ 5–11 ของ review)

### B1. Pin client-side stack — **trigger: F-000 (web) / F-006 (mobile) Gate 2** ⬜
ตัดสิน**ครั้งเดียว** แล้ว log D-XXX + เขียนลง `apps/web/CLAUDE.md`, `apps/mobile/CLAUDE.md`:
web: data-fetching (แนะนำ TanStack Query) · state (Zustand หรือเทียบเท่า — ตัวเดียว) · form (react-hook-form+zod) · error boundary pattern
mobile: state (Riverpod หรือ Bloc — ตัวเดียว) · navigation (go_router หรือเทียบเท่า) · error/i18n pattern
เหตุผล: frontend agent เกิดใหม่ทุก dispatch — ไม่ pin = แต่ละ feature เลือกคนละตัว

### B2. CI path-boundary check — **trigger: F-000 (ตอนวาง CI)** ⬜
script ใน CI: map team/task-prefix → allowed paths ตาม [workspace-map.md](../../workspace-map.md) (เช่น งาน frontend แตะ `packages/db` = fail) + per-app CLAUDE.md เขียน "ห้ามแตะ" ชัด (`apps/web`: never edit `packages/db|core-domain` — request via backend-api) · เสริม D-002 (enforce ด้วยเครื่อง)

### B3. Exemplar conventions — **trigger: จบ build feature แรกของแต่ละ app (F-001 backend / จอแรก web / F-006 mobile)** ⬜
per-app CLAUDE.md ชี้ module ต้นแบบแทนเอกสารยาว: "NestJS module ใหม่ทำตามโครง `apps/api/src/auth`" ฯลฯ — ประหยัด token + LLM ลอก pattern จากโค้ดจริงแม่นกว่าคำบรรยาย

### B4. skill `flutter-feature` — **trigger: F-006 build เสร็จ** ⬜
เขียนจากโค้ดจริง (โครง widget/screen/state ตามที่ F-006 วาง) — เขียนก่อน = เดาแล้ว drift (เหตุผลเดียวกับ D-001)

### B5. `support` agent + `/triage` — **trigger: มี user นอกทีม (dogfood ปลาย Phase 1)** ⬜
agent ADVISORY สไตล์ security-reviewer: อ่าน GitHub issues → reproduce → จำแนก bug/question/feature → bug = defect report route เข้า Build loop · feature = ส่ง product เข้า backlog · **ไม่ตัดสิน scope เอง** · + command `/triage` เดินวงจรนี้ · พิจารณา schedule รายวัน

### B6. Observability section ใน Gate 2 — **trigger: ก่อน F-020 (connector แรก = ระบบ background sync จริงตัวแรก)** ⬜
เพิ่ม section "Observability & runbook" ใน `_gate2/architecture.md` (owner: devops เป็น C ใน RACI): log/metric/alert/runbook ต่อ feature — เนื้อหาตาม skill `observability-standard` (A3) · + DR drill แรกก่อน dogfood ข้อมูลจริง

### B7. Launch-readiness (feature ใหม่ Phase 5 — เสนอ product/user เปิด F-XXX) — **trigger: ก่อนเปิดขายนอก dogfood** ⬜
checklist ตายตัว: PDPA audit (skill A3) · pen test (จ้างหรือ agentic) · **load test เต็ม** (multi-org concurrent sync) · DR drill ผ่าน · status page · support SLA + `/triage` พร้อม (B5) · Terms/Privacy ไทย · help content ไทยครบทุก feature หลัก (ux สะสมตั้งแต่ Phase 1 — ดู B8)
> B5–B7 แตะ scope/backlog → ต้องผ่าน product + user เคาะ ไม่ใช่ทำเงียบ

### B8. Help content ไทย ต่อ feature — **trigger: เริ่ม Phase 1 (สะสมทีละ feature)** ⬜
deliverable เพิ่มของ ux ต่อ feature ที่มี UI: help article สั้นภาษาไทย — กันต้องย้อนเขียน 30 features ตอน launch

### B9. Enforcement ladder — ย้ายกฎจาก prose → CI check — **trigger: หลัง F-000 CI เขียว, ไต่ต่อเนื่อง** ⬜
หลักคิด: *กฎที่ model เล็กแหกไม่ได้ = กฎที่ CI บล็อกทางกายภาพ* — ทำตารางติดตามว่ากฎทองแต่ละข้อ
enforce ที่ชั้นไหน (prose → review checklist → CI/machine) แล้วไต่ขึ้นเมื่อมีโอกาส:
| กฎ | สถานะตอน F-000 | เป้าถัดไป |
|---|---|---|
| ข้อ 2 ledger immutable | ✅ CI (DB trigger — F-000 AC8) | — |
| ข้อ 6 core-domain pure | ✅ CI (dependency-cruiser — AC9) | — |
| contract ไม่ break | ✅ CI (`openapi-diff` — skill contract-evolution) | — |
| ข้อ 3 org filter ทุก query | prose + isolation test ราย feature | Prisma client extension บังคับ where org + eslint rule ห้าม raw query ตรง |
| ข้อ 7 เงินห้าม float | prose + schema check (AC7) | eslint ban `parseFloat`/`Number()` บน money fields + typecheck Decimal |
| protected paths (A6 ข้อ 6) | prose + review | CI diff-check (รวมกับ B2 path-boundary) |
| dependency ใหม่ต้องขอ (A6 ข้อ 4) | prose + review | CI: lockfile-diff แจ้งเตือน dep ใหม่ใน PR |
เจ้าของ: devops (CI) + backend-api (Prisma/eslint) · review ตารางนี้ทุกครั้งที่จบ phase
**+ R4 (user เคาะ 2026-07-04):** จังหวะเดียวกันทุกจบ phase — รัน `blindspot-scan` **pass 6
(cross-artifact diff) กับ workflow docs เอง** (CLAUDE.md, WEB_TEAM, skills, conventions, gate
commands, agent files ~12+ ไฟล์): กติกาที่ขัดกันเอง = agent ทำตามไฟล์ที่บังเอิญอ่าน — จับก่อนสอนผิด

### B10. `pnpm verify` คำสั่งเดียวทั้ง repo — **trigger: F-000 Gate 2 (devops)** ⬜
script ที่ root: `pnpm verify` = lint + typecheck + test ชุด**เดียวกับที่ CI รันเป๊ะ** ·
`pnpm verify --filter=<workspace>` ราย app · เหตุผล: Build discipline ข้อ 1 (PM รันซ้ำเองทุก task)
จะแพงจนไม่มีใครทำจริง ถ้าต้องรู้ toolchain ของ 3 apps + N packages — คำสั่งเดียว = ตรวจได้จริงทุกครั้ง
และ runnable proof ของ builder อ้างคำสั่งเดียวกัน เทียบ output กันได้ตรงๆ (user เคาะ 2026-07-04)

---

## คำถามที่ user เคาะแล้ว / ยังค้าง
- ✅ **grill ใน Gate 1** — user confirm 2026-07-04 → เพิ่ม step 2 "Requirement elicitation (grill)" ใน `/gate1` แล้ว (ถามเป็นชุด ground กับ docs · full=ครบทุกมุม, light=3–5 ข้อ · สรุปความเข้าใจให้ยืนยันก่อนร่าง) + compliance-checklist ใน step 3 + forward-commitments check ใน gate1/gate2
- ✅ **gap-scan ทั้ง 10 ข้อ** — user delegate → เคาะเป็น D-012 (G-1 invite copy-link) + D-013 (G-2..G-9) และ apply ครบแล้ว
- ⬜ **grill ระหว่าง agent ตอน build** — PM แนะนำ**ไม่**เป็น default (token แพง + คำถามควรจบที่ design); ข้อยกเว้นที่เสนอ: consult ก่อน contract lock ของ feature ★ แบบ grill-style — **user ยังไม่เคาะ**
