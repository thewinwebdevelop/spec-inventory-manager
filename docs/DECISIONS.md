# Decision Ledger (D-XXX)

> บันทึกการตัดสินใจข้ามทีมแบบ **append-only** — สะท้อนกฎทอง "ledger immutable"
> เปลี่ยนใจ = เพิ่ม entry ใหม่ status `superseded-by` ไม่แก้ของเดิม
> เจ้าของการ log = PM (orchestrator) ตอน route BLOCKED จนได้คำตอบ (ดู [WEB_TEAM.md](../WEB_TEAM.md))

## Format

### D-XXX · YYYY-MM-DD · F-XXX

Q: <คำถามเดียว ชัดๆ>
Asked by: @<agent> Owner: @<agent|user>
Decision: <สิ่งที่เคาะ>
Rationale: <เหตุผล>
Affects: contract / data-model / UX / AC ...
Status: decided # decided | superseded-by D-0xx

> **tag `[auto]`** ท้ายบรรทัด Decision = PM ตัดสินเองตาม Decision protocol (WEB_TEAM §2 —
> Type 2: ย้อนได้ถูก) โดยไม่รอ user · user audit ย้อนหลังได้ ไม่เห็นด้วย = เพิ่ม entry supersede
> Type 1 (ย้อนยาก/แพง) ห้ามใช้ `[auto]` — ต้องมี user เป็น Owner เสมอ

---

### D-000 · 2026-06-29 · —

Q: ตัวอย่าง seed — ledger นี้ใช้รูปแบบไหน?
Asked by: @product Owner: @user
Decision: ใช้ format ด้านบน · 1 entry ต่อ 1 การตัดสินใจข้ามทีม · อ้าง D-XXX ใน spec/PR/commit
Rationale: decision ไม่หายในแชต + กันถามซ้ำ
Affects: workflow
Status: decided

---

### D-001 · 2026-07-02 · F-000

Q: ควรเขียน per-app CLAUDE.md (tech stack + folder structure ต่อ app) ตอนนี้เลยไหม?
Asked by: @user Owner: @user
Decision: **เลื่อนไปทำพร้อม F-000** — สร้าง `apps/{api,web,mobile}/CLAUDE.md` (nested, auto-load) ตอน scaffold จริง
Rationale: Phase 0 ยังไม่มีโค้ด/โฟลเดอร์ — เขียน structure ตอนนี้ = เดา แล้ว drift · เขียนจากของจริงตอน F-000
Affects: F-000 scope · apps/*/CLAUDE.md
Status: decided

---

### D-002 · 2026-07-02 · F-000

Q: enforce กฎทอง (ledger immutable, core-domain purity, org scoping) ด้วย "เครื่อง" ตั้งแต่ F-000 ไหม?
Asked by: @product Owner: @user
Decision: ใช่ — F-000 วางกลไก enforce ด้วยเครื่อง: ledger immutable ที่ระดับ DB, lint dependency-boundary กัน core-domain import framework/DB, org-filter middleware stub — ตั้งแต่ scaffold (กลไก/tooling = devops+backend-api ตัดสินตอน Gate 2)
Rationale: กฎทอง 2/3/6 กระทบทุก feature เงิน/สต๊อก — enforce ด้วยวินัยพังเงียบ ต้องมีฟันจริง
Affects: F-000 AC8/AC9/org-scoping · ทุก feature money/stock ถัดไป
Status: decided

---

### D-003 · 2026-07-02 · F-000

Q: สร้าง packages/ai skeleton ตอน F-000 เลยไหม?
Asked by: @product/@devops Owner: @user
Decision: ไม่ — เลื่อนไป Phase 5 (YAGNI)
Rationale: AI เป็น Phase 5; skeleton เปล่าตอนนี้ = ของค้างไม่ใช้
Affects: F-000 scope (out)
Status: decided

---

### D-004 · 2026-07-02 · F-000

Q: หลัง 3-team review, F-000 scope calls 6 ข้อ (right-size, Dart client, git hooks, write primitive, object storage, auth tables) เคาะยังไง?
Asked by: @product (from @backend-api/@devops/@qa review) Owner: @user
Decision: schema ครบ + golden-rule guard ครบ · **สร้าง** Role/RefreshToken/Invitation ใน F-000 (กัน FK ลอย) · **มี** git pre-commit hooks · **defer:** Dart client green→F-006, object storage concrete→F-040, transaction/ledger write primitive→F-011
Rationale: เก็บ guard/schema seam ให้แน่นตั้งแต่แรก (D-002) แต่ defer runtime ที่ยังไม่มี feature เรียกใช้ (YAGNI)
Affects: F-000 scope/AC · forward-commitments (F-006/F-011/F-040)
Status: decided

---

### D-005 · 2026-07-02 · F-001

Q: solo owner (org มี owner คนเดียว) พิมพ์รหัสผิดจนโดน throttle แล้วไม่มีทาง reset (self-serve email = F-081, ไม่มี owner อื่นให้ reset) — ปิด gap นี้ยังไงใน MVP?
Asked by: @backend-api Owner: @product
Decision: **รับเป็น MVP gap (Option 1)** — throttle ใช้ exponential backoff ที่ self-heal ~15 นาที = "ชั่วคราว" ผ่านกฎ "ห้ามล็อกตัวเองออกถาวร" อยู่แล้ว · **ไม่** ดึง F-081/SMTP เข้า F-001 · **ไม่** ทำ break-glass ใน F-001 (→ F-085) · UX ต้องแสดง countdown/ข้อความเวลารอ (ห้ามให้เดา) · F-081 (self-serve email reset) = **prioritized fast-follow** ดึงขึ้นก่อนได้ถ้า customer risk สูง
Rationale: gap กระทบเฉพาะ solo owner ที่ลืม+โดน throttle พร้อมกัน — ช่วง dogfood คือพวกเราเอง, รอ 15 นาทีทนได้ · ดึง SMTP/onboarding (Phase 5) เข้า Phase 0 = scope ใหญ่เกินเหตุสำหรับ edge นี้ · break-glass = attack surface ใหม่ ควรอยู่กับ back-office · ห้ามถอด account-level rate-limit (brute-force) เด็ดขาด
Affects: F-001 AC (US-5) · architecture (backoff self-heal ตามเดิม—compliant) · UX (countdown) · roadmap priority F-081
Status: decided

---

### D-006 · 2026-07-03 · F-001

Q: 3 open items ที่ api-spec.md §4 ค้างไว้ก่อน lock — (1) auto-login หลัง signup? (2) reuse-detection wire response? (3) per-device logout ของ session ที่ไม่ใช่เครื่องปัจจุบัน เป็น MVP ไหม?
Asked by: @backend-api (routed via qa test-plan) Owner: @ux (within-domain, grounded in Gate-1 AC)
Decision: (1) **ไม่ auto-login** — signup สำเร็จ → 201 → พาไปหน้า login พร้อมเติมอีเมลไว้ (signup ≠ session-issuance, ลด friction พอ) · (2) **reuse → generic `401 INVALID_REFRESH` บน wire** — ไม่ tip attacker; UX จัดการเหมือน session หมดอายุ (silent retry → เด้ง login), audit event distinct ฝั่ง server เท่านั้น · (3) **per-device logout = interactive (อยู่ใน MVP)** — ทุก row ที่ไม่ใช่เครื่องปัจจุบันมีปุ่มเรียก `/auth/logout {familyId}`
Rationale: (1)+(2) ยืนตาม backend default, ไม่มีเหตุ UX ให้พลิก · (3) Gate-1 AC US-3 ระบุ "logout รายเครื่องได้" ตรงๆ — read-only จะไม่ตอบ AC + เป็น trust action สำคัญตอนสงสัยบัญชีโดนเข้าถึง
Affects: api-spec §2.1/§2.3/§2.6 · ux-wireframe §0/§2/session-list · test-plan (US-1 no-auto-login, US-3 generic 401, US-4 per-device familyId)
Status: decided

---

### D-007 · 2026-07-03 · F-001

Q: (M-4) rotation ให้ `expiresAt` ใหม่ 60 วันทุกครั้งที่ refresh → เครื่องที่ refresh อย่างน้อย 1 ครั้ง/60วัน ล็อกอินอยู่ได้ **ตลอดไป** (sliding, unbounded) — ยอมรับ หรือใส่ absolute cap?
Asked by: @backend-reviewer (routed via backend-review.md) Owner: @product
Decision: **ใส่ absolute family-lifetime cap** — `familyExpiresAt = login + 90 วัน` (สุดเพดาน band 30–90 ของ US-3); rotation ที่เลย cap → ปฏิเสธ → บังคับ re-login (ไม่ถือเป็น reuse, เป็น expiry ปกติ → wire response แบบ session หมดอายุตาม D-006(2)). `expiresAt` ของแต่ละ token ยังหมุนได้ตามเดิม แต่ห้ามเกิน `familyExpiresAt` ของสาย
Rationale: auth เป็นรากความปลอดภัยของทั้งระบบ — sliding-forever = session บนเครื่องที่ถูกขโมยแต่ไม่ถูกสังเกต **ไม่มีวันหมดอายุเอง** ยอมรับไม่ได้แม้ช่วง dogfood · 90 วันยังตอบเจตนา US-3 "คงล็อกอินไว้นานๆ" (นานพอสำหรับมือถือ) โดยมีเพดาน · plain reading ของ US-3 (~30–90 วัน) = bounded อยู่แล้ว, cap นี้ทำให้ spec ตรงกับ AC
Affects: **api-spec + data-model (adds `familyExpiresAt` — backend-api ต้องรับเข้า contract/schema)** · F-001 US-3 AC (tighten) · architecture (rotation guard)
Status: decided

---

### D-008 · 2026-07-03 · F-001

Q: (M-5) ไม่มี self-serve change-own-password endpoint + admin ตั้งรหัสเอง (`{newPassword}`) → admin รู้รหัส **global** ของสมาชิกไปเรื่อยๆ จนกว่า F-081 — change-password อยู่ใน scope F-001 ไหม?
Asked by: @backend-reviewer (routed via backend-review.md) Owner: @product
Decision: **อยู่ใน scope F-001** — เพิ่ม `POST /auth/change-password { currentPassword, newPassword }` (auth: Bearer; verify current; ผ่านนโยบายรหัส ≥8/NIST เดิม; สำเร็จ → เพิกถอน refresh family อื่นทั้งหมด ยกเว้นเครื่องปัจจุบัน) · เพิ่ม US-6 ใน Gate-1
Rationale: org-agnostic, เล็ก, เข้ากับราก auth ตรงๆ — ไม่ต้องรอ F-081 · ปิดหน้าต่างที่ admin รู้รหัสสมาชิกหลัง reset (บรรเทา residual ของ H-2 ด้วย: สมาชิกที่ถูก reset หมุนรหัสเองได้ทันทีเป็นค่าที่ admin ไม่รู้) · `mustChangePassword` nudge อย่างเดียวไม่พอ เพราะ user ยังไม่มีปุ่มให้หมุนจริง
Affects: **api-spec §1 (adds endpoint — backend-api ต้องรับเข้า contract)** · F-001 US-6 (ใหม่) + §3 scope · test-plan (verify-current, revoke-other-families)
Status: decided

---

### D-009 · 2026-07-03 · F-001

Q: (M-6) Gate-1 §3 In-scope สัญญา "identifier นามธรรม (`identifier + type`)" แต่ 3 design docs hard-wire `User.email` ทั้งหมด — ทำ seam ตอนนี้ หรือถอดออก scope?
Asked by: @backend-reviewer (routed via backend-review.md) Owner: @product
Decision: **ทำ minimal service-layer seam ตอนนี้** — abstraction `identifier { type, value }` ที่ชั้น service/core-domain โดย `email` เป็น type เดียวใน MVP; **schema/DB คงเดิม** (`User.email` column ตามเดิม, ไม่มี Identifier table), throttle key/normalize ผ่าน seam นี้ · phone+OTP ยัง out-of-scope (→ productize)
Rationale: ตัดสินตอนนี้ถูก (แค่จัดชั้น service); retrofit หลังมี user จริง = data migration · เก็บ seam ให้สัญญา §3 เป็นจริงโดยไม่แบก Identifier table เปล่าตอนที่มี type เดียว (YAGNI ที่ระดับ schema, seam ที่ระดับ code)
Affects: architecture + data-model (service-layer note; **ไม่แตะ schema/contract** — ไม่เพิ่ม API surface) · F-001 §3 (คงไว้ พร้อม clarify "seam ที่ service-layer, schema เดิม")
Status: decided

---

### D-010 · 2026-07-03 · F-001

Q: (H-2 residual) หลัง fix active-status hole แล้ว — admin ที่ reset สมาชิก **active** ที่ใช้ร่วมกัน ยังได้ credential ที่ใช้ได้ใน org **อื่น** ของสมาชิกด้วย (`User.passwordHash` เป็น global) — ยอมรับ+log หรือ mitigate เพิ่ม?
Asked by: @backend-reviewer (routed via backend-review.md) Owner: @product
Decision: **ยอมรับเป็น known multi-tenant trade-off ช่วง dogfood + log** — ไม่ทำ mitigation เชิงโครงสร้างเพิ่มใน F-001 · บรรเทาที่มีแล้ว: (a) D-008 change-password ให้สมาชิกหมุนรหัสเองเป็นค่าที่ admin ไม่รู้ได้ทันทีหลัง reset, (b) admin-reset จำกัดเฉพาะ target ที่ `status=active` ใน org นั้น (H-2 fix ของ backend-api) · **structural fix = F-081 self-serve email reset** (สมาชิกกู้รหัสเองโดย admin ไม่ต้องรู้เลย) — คง F-081 เป็น prioritized fast-follow (ตาม D-005)
Rationale: รากของปัญหาคือ `User.passwordHash` เป็น global (1 credential/หลาย org) = โครงสร้าง auth≠membership ที่ตั้งใจ — แก้จริงต้องมี self-serve reset ไม่ใช่ admin-set · ช่วง dogfood admin ทุก org คือพวกเราเอง, blast-radius ยอมรับได้ · การ over-engineer per-org credential ตอนนี้ = ขัด model แกน
Affects: F-001 §4 business rules (เพิ่ม note trade-off) · roadmap F-081 (structural fix) · ไม่เพิ่ม API surface
Status: decided

---

### D-011 · 2026-07-03 · F-001

Q: (จาก backend security review M-2) strict rotation แบบ zero reuse-grace ทำให้ retry ที่ถูกต้อง (มือถือ response หาย → retry, web multi-tab แข่ง refresh) กลายเป็น family revocation → forced logout ขัด US-3 — เอายังไง?
Asked by: @backend-reviewer (advisory) Owner: @backend-api (in-domain decision)
Decision: **Option (a) — bounded ~60s reuse-leeway window.** presenting immediate-predecessor token ภายใน ~60 วินาทีหลัง rotation = benign retry → ตอบ generic `401 INVALID_REFRESH` **โดยไม่ revoke family**; token ที่เก่ากว่า 60 วิ หรือ ancestor ลึกกว่า immediate-predecessor ยัง trip full family revocation ตามเดิม
Rationale: strict zero-grace เปลี่ยน 2 pattern ที่ถูกต้อง (lost-response retry, multi-tab race) เป็น logout ทั้งที่ทิศทาง fail ปลอดภัย · window แคบ absorb เคสพวกนี้ได้ ขณะที่ attacker replay token เก่า/ไม่ใช่ immediate ยังถูกจับ · industry pattern (Auth0)
Affects: architecture §3.5(new)/§3.1/§3.3/§11 · data-model §2.4 · api-spec §2.3 · qa test (leeway benign-retry case)
Status: decided

---

### D-012 · 2026-07-04 · F-002

Q: (gap-scan G-1) F-002 สัญญาเชิญสมาชิกทาง email (+re-send) แต่ email infra อยู่ F-081 (Phase 5) — MVP ส่งคำเชิญยังไง?
Asked by: @claude (PM gap-scan) Owner: @user (delegate ให้ PM เลือกตามสมควร)
Decision: **MVP = copy invite link** — ระบบสร้างลิงก์ให้ Owner/Admin copy ส่งเองทาง LINE/แชต · email เป็น identifier ของคำเชิญ ไม่ใช่ช่องทางส่ง · re-send = copy ลิงก์เดิม · ส่งอัตโนมัติ → F-081/SMTP
Rationale: ตรงกับความจริงของ infra (ไม่มี SMTP จนถึง Phase 5) · dogfood ส่งลิงก์ทางแชตธรรมชาติกว่า email อยู่แล้ว · ดึง SMTP เข้า Phase 0 = scope บวมแบบเดียวกับที่ D-005 ปฏิเสธ
Affects: F-002 US-3/US-4 AC + scope table · ux flow (จุด copy link) · forward-commitments (F-081)
Status: decided

---

### D-013 · 2026-07-04 · —

Q: gap-scan 2026-07-04 ข้อ G-2..G-9 (docs/superpowers/plans/2026-07-04-backlog-gap-scan.md) รับข้อไหนบ้าง?
Asked by: @claude (PM gap-scan) Owner: @user (delegate ให้ PM เลือกตามสมควร)
Decision: **G-2 (PDPA/ToS):** ยังไม่ build ตอนนี้ — `compliance-checklist` บังคับใน /gate1 สำหรับ feature แตะ personal data (มีผลตั้งแต่ F-024) · ToS/consent + PDPA เต็ม = launch-readiness ก่อนรับ user นอกทีม · **G-3:** fake-Shopee adapter → เข้า F-020 Gate 2 (forward-commitments) · **G-4:** drift-transparency AC → F-023/F-027 Gate 1 (forward-commitments) · **G-5:** F-092 CSV import icebox→Phase 3 + mark launch-blocker · **G-6:** F-093 stock take icebox→Phase 3 · **G-7:** รูปสินค้า F-021 = ตัดสิน hotlink-vs-storage ตอน Gate 1 (forward-commitments) · **G-8:** แก้ backlog deps F-004 = F-002,F-003 · **G-9:** ประกาศ THB-only ใน docs/05
Rationale: ทุกข้อเป็น seam/ordering ที่ตัดสินตอนนี้ถูก แต่ build ตามจังหวะเดิม — ไม่ดึงงานเข้า Phase 0 เพิ่ม (ยกเว้นการแก้เอกสาร) · dogfood users = พวกเราเอง จึงเลื่อน ToS/consent ได้โดยความเสี่ยงต่ำ
Affects: backlog README (F-092/F-093/F-004) · forward-commitments (F-020/F-021/F-023/F-027/F-081/PDPA) · docs/05 · /gate1 command
Status: decided

---

### D-014 · 2026-07-05 · —

Q: กฎทอง 4 เดิมบังคับ unit test เฉพาะโค้ดเงิน/สต๊อก — โค้ดส่วนอื่นไม่มีกลไกบังคับ test ประกบ (test script หลาย workspace เป็น `echo ok` = ไม่มีวันรัน) ยกระดับไหม?
Asked by: @user Owner: @user
Decision: **บังคับ unit test ประกบทุกงาน implement** — (1) โครงสร้างโค้ดต้องออกแบบให้ testable (pure fn / DI / seam — ตามแนวกฎทอง 6) (2) ทุก task ที่ implement ต้องส่ง unit test มาพร้อมโค้ดเสมอ ไม่ใช่แค่เงิน/สต๊อก (เงิน/สต๊อกยังเป็นขั้นต่ำห้ามแหกเหมือนเดิม) (3) CI รัน unit test เสมอเป็น required check — ไม่ all-pass = merge ไม่ได้ (4) test script ของทุก workspace ต้องเป็นตัวจริง ห้าม `echo ok`; workspace ที่ยังไม่มี test ใช้ `vitest run --passWithNoTests` (โครงพร้อม, ไม่หลอกเขียว)
Rationale: user เคาะ 2026-07-05 · ปิด gap ที่ process-only enforcement พึ่งความจำ agent · echo-ok script อันตรายกว่าไม่มี script (test ที่เขียนแล้วไม่ถูกรัน)
Affects: CLAUDE.md กฎทอง 4 · WEB_TEAM.md Gate E · apps/*/CLAUDE.md · test script ทุก workspace · (CI node-ci/flutter-ci เป็น required อยู่แล้ว — ไม่ต้องแก้)
Status: decided

---

### D-015 · 2026-07-05 · F-000

Q: generated Dart client เดิมอยู่ `apps/mobile/lib/generated/api` ชน nested-package language-version กับ Flutter shell (ทำให้ `flutter test`/`build` พัง) — ย้ายที่ไหน + gen pipeline ต้องเปลี่ยนยังไง?
Asked by: @frontend (escalation) Owner: @user
Decision: **ย้าย generated Dart client ไป `apps/mobile/api_client`** (แยก package เต็ม ไม่ nested ใต้ `lib/`) · `gen:contracts:dart` รัน `openapi-generator` แล้วต่อด้วย `build_runner` แล้ว **commit `*.g.dart`** (built_value companions) เข้า git · Flutter pin `3.27.3` ผ่าน FVM + `.flutter-version` (เครื่อง dev เดิมมี `2.10.5` เก่าเกินไปสำหรับ dart-dio client ที่ generate ออกมา) · decided "แก้เดี๋ยวนี้" ไม่เลื่อน
Rationale: nested-package language-version conflict ทำให้ mobile shell build/test พังทั้งก้อน — บล็อก AC3/AC13 ตรงๆ · แยก package ระดับ root ของ apps/mobile ให้ pub/analyzer เห็นเป็นคนละ package version constraint ได้จริง
Affects: apps/mobile/api_client (ใหม่), turbo.json (gen:contracts outputs), CI contracts-drift + flutter-ci jobs, apps/mobile/.flutter-version, docs (architecture.md/test-plan.md path refs)
Status: decided

---

### D-016 · 2026-07-05 · F-000

Q: (T-000-05 security review Important-1) runtime DB role ที่ apps/api ใช้เป็นเจ้าของตาราง ledger + ตัว trigger เอง — connection ที่ถูก compromise สั่ง raw SQL ปิด/ลบ trigger ได้ ยอมรับความเสี่ยงนี้ไหมใน Phase 0?
Asked by: @devops (จาก security review, ผ่าน backend-api) Owner: @devops + @backend-api
Decision: **ยอมรับความเสี่ยงชั่วคราวสำหรับ Phase 0** (dogfood, ไม่มี external user) · **ก่อนขึ้น production ต้องมี**: least-privilege runtime role (ไม่มีสิทธิ์ DDL, ไม่ใช่ owner ของ trigger/ตาราง) + migration รันด้วย role แยกต่างหากจาก runtime role · ผูก milestone นี้กับ pre-prod gate ไม่ใช่ F-000
Rationale: Phase 0 ไม่มี user ภายนอก — blast radius ของ compromised runtime connection จำกัดอยู่ในทีมเราเอง · แยก role ตอนนี้เพิ่ม infra complexity ที่ยังไม่มี threat model จริงมารองรับ (YAGNI ระดับ infra) แต่ต้องล็อกเป็น pre-prod requirement ไม่ให้ลืม
Affects: packages/db (migration role setup — future), infra.md (future least-privilege role section), pre-prod launch checklist
Status: decided

---

### D-017 · 2026-07-05 · F-001

Q: (จาก fable pre-build review M-5) refresh-token family ต่อ user ไม่มี cap — login ถี่ๆ/credential-stuffing ที่เดารหัสถูกทำให้ row โตไม่หยุด + ขัด claim ของ api-spec §3 ว่า sessions list มีขอบเขต — cap ไหม?
Asked by: @security-reviewer (advisory) Owner: @user
Decision: **cap live family = 20 ต่อ user** — login ที่จะมิ้นท์ family เกิน cap → revoke family เก่าสุด (LRU) อัตโนมัติ · consumed/revoked rows มี pruning ตาม arch §3.4 (job จริง → phase หลัง)
Rationale: 20 เหลือเฟือสำหรับผู้ใช้จริง (หลายเครื่อง+หลาย browser) · ปิด unbounded growth + ทำให้ sessions list bounded ตาม spec · พฤติกรรม revoke-oldest เข้าใจง่ายและ fail ปลอดภัย
Affects: architecture §3 · api-spec §2.2 (login) / §3 (sessions) · data-model (query bound) · T-001-05 · test-plan (เคส cap+LRU)
Status: decided

---

### D-018 · 2026-07-05 · F-002 (forward)

Q: (fable review as-built check #8) `Invitation.token` เก็บ raw + @unique มาตั้งแต่ F-000 (spec-conformant, hash-at-rest ถูก defer) — แต่ตอนนี้ไม่มีเอกสารไหนเป็นเจ้าของ hash-at-rest เลย ใครทำ?
Asked by: @security-reviewer (advisory) Owner: @user (delegate ให้ PM ตามสมควร)
Decision: **มอบให้ F-002 Gate 2 (data-model) เป็น required item** — ก่อนโค้ดใดๆ เขียน invitation token จริง ต้อง hash-at-rest (แนวเดียวกับ RefreshToken tokenHash) · บันทึกใน forward-commitments แล้ว
Rationale: F-002 คือ feature แรกที่เขียน/อ่าน invitation จริง (invite flow) — เป็นจุด enforce ที่ถูกต้อง; แก้ schema ตอนตารางยังว่างถูกกว่าแก้ทีหลัง
Affects: F-002 Gate-2 data-model · docs/features/forward-commitments.md
Status: decided

---

### D-019 · 2026-07-06 · F-001

Q: (จาก client-security review) locked C-1 ให้ทั้ง `omni_rt` และ `omni_csrf` เป็น `Path=/auth` — แต่ `omni_csrf` เป็น non-httpOnly ที่ JS ต้องอ่านจาก app page (`/login`, `/settings/security`, `/`) ซึ่งอยู่นอก `/auth` → `document.cookie` path-matching อ่านไม่ได้ → cookie transport ตายในเบราว์เซอร์จริง (client อ่าน CSRF token มา echo ใส่ `X-CSRF-Token` ไม่ได้) · แก้ยังไง?
Asked by: @security-reviewer (client-security, advisory) Owner: @user (approved Option A)
Decision: **แยก path 2 คุกกี้ (Option A):** `omni_rt` (httpOnly, refresh) คง **`Path=/auth`** (ส่งไป browser `/auth/*` routes เท่านั้น) · `omni_csrf` (non-httpOnly, double-submit) ย้ายเป็น **`Path=/`** ให้อ่านได้จากทุก page · auth endpoints เข้าถึงที่ browser path `/auth/*` (web dev proxy rewrite `/auth/:path*` → API `/auth/:path*`; API คงเสิร์ฟ auth ที่ `/auth/*`) — converged contract แชร์ verbatim กับ @devops + @frontend
Rationale: `omni_csrf` **ไม่มี secret** — defense คือ `SameSite=Strict` + value-match กับ header ซึ่ง **path-independent** ทั้งคู่ → ขยาย path ไม่เสียอะไร แต่ทำให้ transport ใช้ได้จริง · single-path เดิม unworkable เพราะ `/api` proxy prefix + document-path rule (cross-artifact defect ที่ client-security review จับได้) · amends locked C-1 เฉพาะส่วน `omni_csrf` (ไม่ revert `omni_rt`=`/auth`)
Affects: apps/api/src/auth/{auth.constants,cookies}.ts · api-spec §0 (C-1 block, §2.2/§2.4/§5) · architecture §12 · apps/web + next.config.mjs (@frontend/@devops — proxy + document.cookie read) · test-plan (Set-Cookie path assertions — @qa)
Status: decided

### D-020 · 2026-07-06 · F-001

Q: workspace-map ระบุ web stack = **Next.js + Tailwind + shadcn** แต่ Tailwind/shadcn ไม่เคยถูก scaffold — F-001 frontend build ด้วย plain CSS custom properties (token 1:1 จาก design-system, 121 tests green) · จะ adopt Tailwind ตอนนี้ หรือ ratify plain-CSS?
Asked by: @frontend (deviation flag) Owner: @user
Decision: **Adopt Tailwind+shadcn ตอนนี้** — scaffold Tailwind v4 + shadcn ใน apps/web แล้ว remap component/token ที่มีอยู่ให้ตรง workspace-map ก่อน feature UI อื่นจะ build บน plain-CSS เพิ่ม
Rationale: align stack ให้ตรง spec แต่เนิ่นๆ ลด drift · token value ไม่เปลี่ยน (design-system §1 เป็น source of truth) → เป็น mechanical remap ไม่ใช่ redesign · ทำเป็น follow-up **หลัง** correctness fixes (D-019 + client-security Importants) land แล้ว
Affects: apps/web (postcss/tailwind config, components/ui/*, components/auth/*, styles/tokens.css → tailwind theme) · design-system.md (token → tailwind theme mapping note) · **ไม่แตะ** contract/API/logic (lib/*.ts คงเดิม)
Status: **done** — migrated 2026-07-06 (mechanical remap, same token values; 17 test files / 121 tests green, typecheck+lint+build clean — see design-system.md §1.5 for the token → Tailwind theme mapping)
