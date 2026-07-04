# F-001 Authentication

> สถานะ: `gate1-approved` · Phase: 0 · ขึ้นกับ (depends on): F-000 · เจ้าของ: product
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
  - [ ] AC: access token (~15 นาที) หมดอายุ → ใช้ refresh token (~30–90 วัน) ขอใหม่ได้โดยไม่ต้องล็อกอินซ้ำ
  - [ ] AC: refresh token หมุน (rotate) ทุกครั้งที่ใช้ — ตัวเก่าใช้ไม่ได้อีก
  - [ ] AC: ตรวจพบ refresh token reuse → เพิกถอนทั้งสาย (กัน token ถูกขโมย)
  - [ ] AC: ผูก refresh token กับ device/session (เห็นเข้าจากกี่เครื่อง, logout รายเครื่องได้)

- **US-4:** ในฐานะผู้ใช้ ฉันต้องการ **ออกจากระบบ** เพื่อความปลอดภัย
  - [ ] AC: logout → refresh token ปัจจุบันใช้ไม่ได้อีก + รองรับ logout ทุกเครื่อง
  - [ ] AC: (มือถือ) token ถูกลบจาก secure storage

- **US-5:** ในฐานะผู้ใช้ที่ลืมรหัส ฉันต้องการ **กู้บัญชี** เพื่อกลับเข้าใช้งาน
  - [ ] AC: MVP = Owner/Admin รีเซ็ตรหัสให้สมาชิกได้ (ไม่ต้องมี email infra)
  - [ ] AC: self-serve reset ผ่านอีเมล = fast-follow เมื่อมี email infra (ดู forward-commitments → F-081)
  - [ ] AC: **ห้ามมีเคสล็อกตัวเองออกถาวร**

## 3. ขอบเขต (Scope)

| อยู่ใน scope (In) | ไม่อยู่ใน scope (Out / ภายหลัง) |
|---|---|
| สมัคร/ล็อกอิน/ล็อกเอาต์ ด้วยอีเมล+รหัส | Social login (Google/Facebook/LINE) → productize |
| JWT access + refresh (rotation + reuse detection) | 2FA/OTP → hardening |
| throttle/backoff + rate-limit | SSO/SAML → productize |
| password hashing (argon2id, เคาะ Gate 2) + นโยบายรหัส ≥8 | email verification → F-081 (`verified` flag ติดไว้) |
| Admin reset (recovery MVP) | self-serve password reset → F-081 (เมื่อมี SMTP) |
| identifier นามธรรม (`identifier + type`) เผื่อ phone+OTP | phone + OTP + SMS provider → productize |

## 4. Business rules & edge cases
- **Auth แยกจาก membership:** 1 User ล็อกอินได้แม้ยังไม่สังกัด org ใด — User เป็น entity ระดับระบบ ไม่ผูก `organizationId`
- รหัสผ่าน hash ด้วย argon2id; นโยบายแบบ NIST 800-63B (ไม่บังคับกฎพิลึก, เช็ค list รหัสรั่ว/ยอดฮิต)
- refresh token reuse → ถือว่า compromise → เพิกถอนทั้ง family
- edge: ขอ reset ด้วยอีเมลที่ไม่มีในระบบ → ตอบแบบเดียวกับมี (ไม่รั่วว่ามีบัญชีไหม)
- edge: token ของ user ที่ถูกถอดออกจากทุก org → ล็อกอินได้แต่ไม่เห็นข้อมูล org (เชื่อม F-002/003)
- normalize email (lowercase, trim) ก่อนเทียบ

> ✋ **Gate 1 sign-off:** user + product เคาะ user-stories/AC แล้ว → `gate1-approved`

---

# ══ Gate 2 — Design ══
> _TODO: ทำหลัง Gate 1 (architecture token security · data-model · API · UX · test plan)_
