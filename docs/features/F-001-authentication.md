# F-001 Authentication

> สถานะ: `gate2-approved` · Phase: 0 · ขึ้นกับ (depends on): F-000 · เจ้าของ: product
> **Platform:** both (Gate-1 ใช้ร่วม mobile ผ่าน F-006) · **ขนาดงาน:** full (cross-cutting/security)

---

# ══ Gate 1 — Requirement ══

## 1. ภาพรวม (Overview)
- **ปัญหา/เป้าหมาย:** ระบบต้องมีบัญชีผู้ใช้ของเราเอง (ไม่พึ่ง marketplace) เป็นประตูเข้าทุก surface (web/mobile) และเป็นรากของ multi-tenant — ไม่มี auth ก็ผูก `organizationId` กับใครไม่ได้
- **ผู้ใช้:** ทุก role (Owner/Admin/Staff/Accountant) + System
- **คุณค่า:** เข้าใช้งานปลอดภัย, session ต่อเนื่องบนมือถือโดยไม่ต้องล็อกอินบ่อย, รากความปลอดภัยของทั้งระบบ

## 2. User stories & Acceptance criteria

- **US-1:** ในฐานะผู้ใช้ใหม่ ฉันต้องการ **สมัครบัญชีด้วยอีเมล + รหัสผ่าน** เพื่อเริ่มใช้ระบบ
  - [ ] AC: สมัครด้วยอีเมล + รหัสผ่าน → ได้บัญชีและล็อกอินได้ทันที
  - [ ] AC: อีเมลซ้ำกับที่มีอยู่ → ปฏิเสธ พร้อมข้อความไทยชัดเจน (ไม่รั่ว privacy เกินจำเป็น)
  - [ ] AC: รหัสผ่านไม่ผ่านนโยบายขั้นต่ำ (< 8 ตัว) → ปฏิเสธพร้อมเหตุผล
  - [ ] AC: รหัสผ่านถูกเก็บแบบ hash (ไม่เก็บ plain text)
  - [ ] AC: สมัคร = ได้ user เท่านั้น (สร้าง/รับเชิญ org เป็นคนละสเต็ป — F-002); ตั้ง flag `verified=false` (ไม่ verify ใน MVP)

- **US-2:** ในฐานะผู้ใช้ ฉันต้องการ **ล็อกอิน** เพื่อเข้าใช้งาน
  - [ ] AC: อีเมล+รหัสถูก → ได้ access token + refresh token
  - [ ] AC: รหัสผิด → ปฏิเสธด้วยข้อความกลางๆ (ไม่บอกว่าผิดที่อีเมลหรือรหัส — กัน account enumeration)
  - [ ] AC: ผิดซ้ำเกินเกณฑ์ (เช่น 5 ครั้งติด) → throttle/exponential backoff (กัน brute-force, ไม่ hard-lock ถาวร)
  - [ ] AC: rate-limit ระดับ IP + ระดับ account

- **US-3:** ในฐานะผู้ใช้มือถือ ฉันต้องการ **คงสถานะล็อกอินไว้นานๆ** เพื่อไม่ต้องกรอกรหัสทุกครั้ง
  - [ ] AC: access token (~15 นาที) หมดอายุ → ใช้ refresh token ขอใหม่ได้โดยไม่ต้องล็อกอินซ้ำ
  - [ ] AC: refresh token หมุน (rotate) ทุกครั้งที่ใช้ — ตัวเก่าใช้ไม่ได้อีก
  - [ ] AC: **session (refresh family) มีเพดานอายุสัมบูรณ์ = login + 90 วัน (D-007)** — refresh หมุนต่อได้ภายในเพดานนี้; เลย 90 วันนับจาก login → บังคับล็อกอินใหม่ (ไม่ใช่ sliding-forever) · แสดงผลฝั่ง client แบบ session หมดอายุปกติ
  - [ ] AC: ตรวจพบ refresh token reuse → เพิกถอนทั้งสาย (กัน token ถูกขโมย)
  - [ ] AC: ผูก refresh token กับ device/session (เห็นเข้าจากกี่เครื่อง, logout รายเครื่องได้)

- **US-4:** ในฐานะผู้ใช้ ฉันต้องการ **ออกจากระบบ** เพื่อความปลอดภัย
  - [ ] AC: logout → refresh token ปัจจุบันใช้ไม่ได้อีก + รองรับ logout ทุกเครื่อง
  - [ ] AC: (มือถือ) token ถูกลบจาก secure storage

- **US-5:** ในฐานะผู้ใช้ที่ลืมรหัส ฉันต้องการ **กู้บัญชี** เพื่อกลับเข้าใช้งาน
  - [ ] AC: MVP = Owner/Admin รีเซ็ตรหัสให้สมาชิกได้ (ไม่ต้องมี email infra)
  - [ ] AC: self-serve reset ผ่านอีเมล = fast-follow เมื่อมี email infra (ดู forward-commitments → F-081)
  - [ ] AC: **ห้ามมีเคสล็อกตัวเองออกถาวร** — throttle/backoff ต้อง self-heal เสมอ (ชั่วคราว ไม่ใช่ถาวร); ห้ามมีสถานะที่ต้อง action จากคนอื่นถึงจะกลับเข้าได้เป็นทางเดียว
  - [ ] AC: **เคส solo owner (org มี owner คนเดียว) ลืม/พิมพ์รหัสผิดจนโดน throttle:** ยอมรับว่า MVP ต้อง **รอ backoff หายเอง (~15 นาที)** เป็นทางกลับเข้า — ถือว่า "ชั่วคราว" ผ่านกฎห้ามล็อกถาวร · UX ต้องแสดงเวลานับถอยหลัง/ข้อความว่ารอได้กี่นาที (ห้ามให้ผู้ใช้เดา) → ส่งต่อ `ux`
  - [ ] AC: self-serve email reset (F-081) = **prioritized fast-follow** ปิดช่องนี้ให้ solo owner ไม่ต้องรอ — ดึงขึ้นก่อนได้ถ้า customer risk สูง (ผูกกับการมี SMTP infra)

- **US-6:** ในฐานะผู้ใช้ที่ล็อกอินอยู่ ฉันต้องการ **เปลี่ยนรหัสผ่านของตัวเอง** เพื่อหมุนรหัส (โดยเฉพาะหลัง admin reset ให้) โดยไม่ต้องรอ email infra *(เพิ่มจาก D-008)*
  - [ ] AC: `POST /auth/change-password { currentPassword, newPassword }` (auth: Bearer) — ต้องยืนยัน `currentPassword` ถูกก่อน
  - [ ] AC: `newPassword` ต้องผ่านนโยบายเดิม (≥8 / NIST list รหัสรั่ว) มิฉะนั้นปฏิเสธพร้อมเหตุผล
  - [ ] AC: เปลี่ยนสำเร็จ → เพิกถอน refresh family อื่นทั้งหมด (ยกเว้นเครื่องปัจจุบัน) — กันเครื่องที่รู้รหัสเก่า (รวมกรณี admin ที่ตั้งรหัสให้) ค้าง session
  - [ ] AC: `currentPassword` ผิด → ปฏิเสธด้วยข้อความกลางๆ (ไม่รั่ว) — ไม่กระทบ session ปัจจุบัน

## 3. ขอบเขต (Scope)

| อยู่ใน scope (In) | ไม่อยู่ใน scope (Out / ภายหลัง) |
|---|---|
| สมัคร/ล็อกอิน/ล็อกเอาต์ ด้วยอีเมล+รหัส | Social login (Google/Facebook/LINE) → productize |
| JWT access + refresh (rotation + reuse detection) | 2FA/OTP → hardening |
| throttle/backoff + rate-limit | SSO/SAML → productize |
| password hashing (argon2id, เคาะ Gate 2) + นโยบายรหัส ≥8 | email verification → F-081 (`verified` flag ติดไว้) |
| Admin reset (recovery MVP) | self-serve password reset → F-081 (เมื่อมี SMTP) |
| **self-serve change-own-password** (verify current → หมุนรหัส, D-008) | — |
| identifier นามธรรม (`identifier + type`) — **seam ที่ service-layer, schema เดิม `User.email`** (D-009) | Identifier table / phone + OTP + SMS provider → productize |

## 4. Business rules & edge cases
- **Auth แยกจาก membership:** 1 User ล็อกอินได้แม้ยังไม่สังกัด org ใด — User เป็น entity ระดับระบบ ไม่ผูก `organizationId`
- รหัสผ่าน hash ด้วย argon2id; นโยบายแบบ NIST 800-63B (ไม่บังคับกฎพิลึก, เช็ค list รหัสรั่ว/ยอดฮิต)
- refresh token reuse → ถือว่า compromise → เพิกถอนทั้ง family
- edge: ขอ reset ด้วยอีเมลที่ไม่มีในระบบ → ตอบแบบเดียวกับมี (ไม่รั่วว่ามีบัญชีไหม)
- edge: token ของ user ที่ถูกถอดออกจากทุก org → ล็อกอินได้แต่ไม่เห็นข้อมูล org (เชื่อม F-002/003)
- normalize email (lowercase, trim) ก่อนเทียบ
- **admin-reset ต้อง target ที่ `status=active` ใน org นั้นเท่านั้น** (fix H-2) — กัน ex-member (`revoked`/`invited`) ถูก reset ข้าม-tenant
- **known multi-tenant trade-off (D-010):** `User.passwordHash` เป็น global (1 credential/หลาย org) → admin ที่ reset สมาชิก active ที่ใช้ร่วมกัน จะรู้ credential ที่ใช้ได้ใน org อื่นของสมาชิกด้วย · ยอมรับช่วง dogfood · บรรเทาด้วย change-password (US-6) ให้สมาชิกหมุนเองทันที · structural fix = F-081 self-serve reset

> ✋ **Gate 1 sign-off:** user + product เคาะ user-stories/AC แล้ว → `gate2-approved`

---

# ══ Gate 2 — Design ══
> _TODO: ทำหลัง Gate 1 (architecture token security · data-model · API · UX · test plan)_
