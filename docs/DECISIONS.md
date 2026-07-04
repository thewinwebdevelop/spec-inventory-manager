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

---

### D-001 · 2026-07-02 · F-000
Q: ควรเขียน per-app CLAUDE.md (tech stack + folder structure ต่อ app) ตอนนี้เลยไหม?
Asked by: @user   Owner: @user
Decision: **เลื่อนไปทำพร้อม F-000** — สร้าง `apps/{api,web,mobile}/CLAUDE.md` (nested, auto-load) ตอน scaffold จริง
Rationale: Phase 0 ยังไม่มีโค้ด/โฟลเดอร์ — เขียน structure ตอนนี้ = เดา แล้ว drift · เขียนจากของจริงตอน F-000
Affects: F-000 scope · apps/*/CLAUDE.md
Status: decided

---

### D-002 · 2026-07-02 · F-000
Q: enforce กฎทอง (ledger immutable, core-domain purity, org scoping) ด้วย "เครื่อง" ตั้งแต่ F-000 ไหม?
Asked by: @product   Owner: @user
Decision: ใช่ — F-000 วางกลไก enforce ด้วยเครื่อง: ledger immutable ที่ระดับ DB, lint dependency-boundary กัน core-domain import framework/DB, org-filter middleware stub — ตั้งแต่ scaffold (กลไก/tooling = devops+backend-api ตัดสินตอน Gate 2)
Rationale: กฎทอง 2/3/6 กระทบทุก feature เงิน/สต๊อก — enforce ด้วยวินัยพังเงียบ ต้องมีฟันจริง
Affects: F-000 AC8/AC9/org-scoping · ทุก feature money/stock ถัดไป
Status: decided

---

### D-003 · 2026-07-02 · F-000
Q: สร้าง packages/ai skeleton ตอน F-000 เลยไหม?
Asked by: @product/@devops   Owner: @user
Decision: ไม่ — เลื่อนไป Phase 5 (YAGNI)
Rationale: AI เป็น Phase 5; skeleton เปล่าตอนนี้ = ของค้างไม่ใช้
Affects: F-000 scope (out)
Status: decided

---

### D-004 · 2026-07-02 · F-000
Q: หลัง 3-team review, F-000 scope calls 6 ข้อ (right-size, Dart client, git hooks, write primitive, object storage, auth tables) เคาะยังไง?
Asked by: @product (from @backend-api/@devops/@qa review)   Owner: @user
Decision: schema ครบ + golden-rule guard ครบ · **สร้าง** Role/RefreshToken/Invitation ใน F-000 (กัน FK ลอย) · **มี** git pre-commit hooks · **defer:** Dart client green→F-006, object storage concrete→F-040, transaction/ledger write primitive→F-011
Rationale: เก็บ guard/schema seam ให้แน่นตั้งแต่แรก (D-002) แต่ defer runtime ที่ยังไม่มี feature เรียกใช้ (YAGNI)
Affects: F-000 scope/AC · forward-commitments (F-006/F-011/F-040)
Status: decided

---

### D-005 · 2026-07-02 · F-001
Q: solo owner (org มี owner คนเดียว) พิมพ์รหัสผิดจนโดน throttle แล้วไม่มีทาง reset (self-serve email = F-081, ไม่มี owner อื่นให้ reset) — ปิด gap นี้ยังไงใน MVP?
Asked by: @backend-api   Owner: @product
Decision: **รับเป็น MVP gap (Option 1)** — throttle ใช้ exponential backoff ที่ self-heal ~15 นาที = "ชั่วคราว" ผ่านกฎ "ห้ามล็อกตัวเองออกถาวร" อยู่แล้ว · **ไม่** ดึง F-081/SMTP เข้า F-001 · **ไม่** ทำ break-glass ใน F-001 (→ F-085) · UX ต้องแสดง countdown/ข้อความเวลารอ (ห้ามให้เดา) · F-081 (self-serve email reset) = **prioritized fast-follow** ดึงขึ้นก่อนได้ถ้า customer risk สูง
Rationale: gap กระทบเฉพาะ solo owner ที่ลืม+โดน throttle พร้อมกัน — ช่วง dogfood คือพวกเราเอง, รอ 15 นาทีทนได้ · ดึง SMTP/onboarding (Phase 5) เข้า Phase 0 = scope ใหญ่เกินเหตุสำหรับ edge นี้ · break-glass = attack surface ใหม่ ควรอยู่กับ back-office · ห้ามถอด account-level rate-limit (brute-force) เด็ดขาด
Affects: F-001 AC (US-5) · architecture (backoff self-heal ตามเดิม—compliant) · UX (countdown) · roadmap priority F-081
Status: decided

---

### D-006 · 2026-07-03 · F-001
Q: 3 open items ที่ api-spec.md §4 ค้างไว้ก่อน lock — (1) auto-login หลัง signup? (2) reuse-detection wire response? (3) per-device logout ของ session ที่ไม่ใช่เครื่องปัจจุบัน เป็น MVP ไหม?
Asked by: @backend-api (routed via qa test-plan)   Owner: @ux (within-domain, grounded in Gate-1 AC)
Decision: (1) **ไม่ auto-login** — signup สำเร็จ → 201 → พาไปหน้า login พร้อมเติมอีเมลไว้ (signup ≠ session-issuance, ลด friction พอ) · (2) **reuse → generic `401 INVALID_REFRESH` บน wire** — ไม่ tip attacker; UX จัดการเหมือน session หมดอายุ (silent retry → เด้ง login), audit event distinct ฝั่ง server เท่านั้น · (3) **per-device logout = interactive (อยู่ใน MVP)** — ทุก row ที่ไม่ใช่เครื่องปัจจุบันมีปุ่มเรียก `/auth/logout {familyId}`
Rationale: (1)+(2) ยืนตาม backend default, ไม่มีเหตุ UX ให้พลิก · (3) Gate-1 AC US-3 ระบุ "logout รายเครื่องได้" ตรงๆ — read-only จะไม่ตอบ AC + เป็น trust action สำคัญตอนสงสัยบัญชีโดนเข้าถึง
Affects: api-spec §2.1/§2.3/§2.6 · ux-wireframe §0/§2/session-list · test-plan (US-1 no-auto-login, US-3 generic 401, US-4 per-device familyId)
Status: decided

---

### D-007 · 2026-07-03 · F-001
Q: (M-4) rotation ให้ `expiresAt` ใหม่ 60 วันทุกครั้งที่ refresh → เครื่องที่ refresh อย่างน้อย 1 ครั้ง/60วัน ล็อกอินอยู่ได้ **ตลอดไป** (sliding, unbounded) — ยอมรับ หรือใส่ absolute cap?
Asked by: @backend-reviewer (routed via backend-review.md)   Owner: @product
Decision: **ใส่ absolute family-lifetime cap** — `familyExpiresAt = login + 90 วัน` (สุดเพดาน band 30–90 ของ US-3); rotation ที่เลย cap → ปฏิเสธ → บังคับ re-login (ไม่ถือเป็น reuse, เป็น expiry ปกติ → wire response แบบ session หมดอายุตาม D-006(2)). `expiresAt` ของแต่ละ token ยังหมุนได้ตามเดิม แต่ห้ามเกิน `familyExpiresAt` ของสาย
Rationale: auth เป็นรากความปลอดภัยของทั้งระบบ — sliding-forever = session บนเครื่องที่ถูกขโมยแต่ไม่ถูกสังเกต **ไม่มีวันหมดอายุเอง** ยอมรับไม่ได้แม้ช่วง dogfood · 90 วันยังตอบเจตนา US-3 "คงล็อกอินไว้นานๆ" (นานพอสำหรับมือถือ) โดยมีเพดาน · plain reading ของ US-3 (~30–90 วัน) = bounded อยู่แล้ว, cap นี้ทำให้ spec ตรงกับ AC
Affects: **api-spec + data-model (adds `familyExpiresAt` — backend-api ต้องรับเข้า contract/schema)** · F-001 US-3 AC (tighten) · architecture (rotation guard)
Status: decided

---

### D-008 · 2026-07-03 · F-001
Q: (M-5) ไม่มี self-serve change-own-password endpoint + admin ตั้งรหัสเอง (`{newPassword}`) → admin รู้รหัส **global** ของสมาชิกไปเรื่อยๆ จนกว่า F-081 — change-password อยู่ใน scope F-001 ไหม?
Asked by: @backend-reviewer (routed via backend-review.md)   Owner: @product
Decision: **อยู่ใน scope F-001** — เพิ่ม `POST /auth/change-password { currentPassword, newPassword }` (auth: Bearer; verify current; ผ่านนโยบายรหัส ≥8/NIST เดิม; สำเร็จ → เพิกถอน refresh family อื่นทั้งหมด ยกเว้นเครื่องปัจจุบัน) · เพิ่ม US-6 ใน Gate-1
Rationale: org-agnostic, เล็ก, เข้ากับราก auth ตรงๆ — ไม่ต้องรอ F-081 · ปิดหน้าต่างที่ admin รู้รหัสสมาชิกหลัง reset (บรรเทา residual ของ H-2 ด้วย: สมาชิกที่ถูก reset หมุนรหัสเองได้ทันทีเป็นค่าที่ admin ไม่รู้) · `mustChangePassword` nudge อย่างเดียวไม่พอ เพราะ user ยังไม่มีปุ่มให้หมุนจริง
Affects: **api-spec §1 (adds endpoint — backend-api ต้องรับเข้า contract)** · F-001 US-6 (ใหม่) + §3 scope · test-plan (verify-current, revoke-other-families)
Status: decided

---

### D-009 · 2026-07-03 · F-001
Q: (M-6) Gate-1 §3 In-scope สัญญา "identifier นามธรรม (`identifier + type`)" แต่ 3 design docs hard-wire `User.email` ทั้งหมด — ทำ seam ตอนนี้ หรือถอดออก scope?
Asked by: @backend-reviewer (routed via backend-review.md)   Owner: @product
Decision: **ทำ minimal service-layer seam ตอนนี้** — abstraction `identifier { type, value }` ที่ชั้น service/core-domain โดย `email` เป็น type เดียวใน MVP; **schema/DB คงเดิม** (`User.email` column ตามเดิม, ไม่มี Identifier table), throttle key/normalize ผ่าน seam นี้ · phone+OTP ยัง out-of-scope (→ productize)
Rationale: ตัดสินตอนนี้ถูก (แค่จัดชั้น service); retrofit หลังมี user จริง = data migration · เก็บ seam ให้สัญญา §3 เป็นจริงโดยไม่แบก Identifier table เปล่าตอนที่มี type เดียว (YAGNI ที่ระดับ schema, seam ที่ระดับ code)
Affects: architecture + data-model (service-layer note; **ไม่แตะ schema/contract** — ไม่เพิ่ม API surface) · F-001 §3 (คงไว้ พร้อม clarify "seam ที่ service-layer, schema เดิม")
Status: decided

---

### D-010 · 2026-07-03 · F-001
Q: (H-2 residual) หลัง fix active-status hole แล้ว — admin ที่ reset สมาชิก **active** ที่ใช้ร่วมกัน ยังได้ credential ที่ใช้ได้ใน org **อื่น** ของสมาชิกด้วย (`User.passwordHash` เป็น global) — ยอมรับ+log หรือ mitigate เพิ่ม?
Asked by: @backend-reviewer (routed via backend-review.md)   Owner: @product
Decision: **ยอมรับเป็น known multi-tenant trade-off ช่วง dogfood + log** — ไม่ทำ mitigation เชิงโครงสร้างเพิ่มใน F-001 · บรรเทาที่มีแล้ว: (a) D-008 change-password ให้สมาชิกหมุนรหัสเองเป็นค่าที่ admin ไม่รู้ได้ทันทีหลัง reset, (b) admin-reset จำกัดเฉพาะ target ที่ `status=active` ใน org นั้น (H-2 fix ของ backend-api) · **structural fix = F-081 self-serve email reset** (สมาชิกกู้รหัสเองโดย admin ไม่ต้องรู้เลย) — คง F-081 เป็น prioritized fast-follow (ตาม D-005)
Rationale: รากของปัญหาคือ `User.passwordHash` เป็น global (1 credential/หลาย org) = โครงสร้าง auth≠membership ที่ตั้งใจ — แก้จริงต้องมี self-serve reset ไม่ใช่ admin-set · ช่วง dogfood admin ทุก org คือพวกเราเอง, blast-radius ยอมรับได้ · การ over-engineer per-org credential ตอนนี้ = ขัด model แกน
Affects: F-001 §4 business rules (เพิ่ม note trade-off) · roadmap F-081 (structural fix) · ไม่เพิ่ม API surface
Status: decided

---

### D-011 · 2026-07-03 · F-001
Q: (จาก backend security review M-2) strict rotation แบบ zero reuse-grace ทำให้ retry ที่ถูกต้อง (มือถือ response หาย → retry, web multi-tab แข่ง refresh) กลายเป็น family revocation → forced logout ขัด US-3 — เอายังไง?
Asked by: @backend-reviewer (advisory)   Owner: @backend-api (in-domain decision)
Decision: **Option (a) — bounded ~60s reuse-leeway window.** presenting immediate-predecessor token ภายใน ~60 วินาทีหลัง rotation = benign retry → ตอบ generic `401 INVALID_REFRESH` **โดยไม่ revoke family**; token ที่เก่ากว่า 60 วิ หรือ ancestor ลึกกว่า immediate-predecessor ยัง trip full family revocation ตามเดิม
Rationale: strict zero-grace เปลี่ยน 2 pattern ที่ถูกต้อง (lost-response retry, multi-tab race) เป็น logout ทั้งที่ทิศทาง fail ปลอดภัย · window แคบ absorb เคสพวกนี้ได้ ขณะที่ attacker replay token เก่า/ไม่ใช่ immediate ยังถูกจับ · industry pattern (Auth0)
Affects: architecture §3.5(new)/§3.1/§3.3/§11 · data-model §2.4 · api-spec §2.3 · qa test (leeway benign-retry case)
Status: decided
