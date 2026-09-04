# Changelog

รูปแบบตาม [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · เวอร์ชันตาม [SemVer](https://semver.org/lang/th/)

> **ยังไม่มีอะไรถูก release** — repo นี้ยังไม่มี git tag และยังไม่มี deploy target (Phase 0/1)
> ทุกอย่างจึงอยู่ใต้ `[Unreleased]` จนกว่า `release` จะตัดเวอร์ชันแรกตอนปิด Phase 1
>
> **⚠️ เวอร์ชันในไฟล์ยังไม่ตรงกัน:** ทุก workspace ของ npm เป็น `0.0.0` แต่
> `apps/mobile/pubspec.yaml` เขียน `1.0.0+1` (ค่า default ของ `flutter create` ที่ไม่มีใครแก้)
> — `release` ต้องตัดสินว่าจะให้ mobile ตามเลขเดียวกับ monorepo หรือเดินเลขของตัวเอง
> (store build number มีข้อบังคับของมันเอง) **ก่อน** ตัดเวอร์ชันแรก

## [Unreleased]

### Added

- **F-002 — องค์กร · สิทธิ์ · สมาชิก** (Organization · License · Membership)
  - สร้างร้าน · สลับร้าน · โปรไฟล์ร้าน · ข้อมูลผู้เสียภาษี (ประกาศ/ดู/เปิดเผยเลขเต็ม)
  - สมาชิก: เชิญด้วยลิงก์ (ไม่มีอีเมล — D-012) · ออกลิงก์ใหม่ · เปลี่ยนสิทธิ์ · ถอด · ออกจากร้านเอง
  - multi-tenant enforcement: `OrgContextMiddleware` + `OrgScopeGuard` default-deny +
    `CapabilityGuard` ครอบทุก method รวม `GET`
  - 17 endpoint ใหม่ใน OpenAPI · client TS + Dart regenerate แล้ว
  - mobile: จอเลือกร้าน/สร้างร้าน/สลับร้าน/สมาชิก/เชิญ/โปรไฟล์ร้าน + การ์ดภาษี (อ่าน + เปิดเผย)
    · เข้าถึงได้จริงผ่าน **เปลือกชั่วคราว** `app/shop_shell.dart` (B-18) — F-006 เป็นเจ้าของ navigation จริง
      และควร**ลบ**ไฟล์นั้นทิ้ง ไม่ใช่ต่อยอด
- **F-001 — บัญชีผู้ใช้และการเข้าสู่ระบบ** · **F-000 — โครงโปรเจกต์**
  (ทั้งคู่ merge ไปก่อนหน้าและยังไม่เคยถูก tag)

### Security

- เลขผู้เสียภาษี (ซึ่งอาจเป็น**เลขบัตรประชาชน**) ไม่เคยอยู่ใน response ไหนเลย
  ยกเว้น `POST /orgs/{orgId}/tax-profile/reveal` ซึ่ง rate-limit 20 ครั้ง/ชม. และบันทึกทุกครั้ง
- token ของคำเชิญเก็บเป็น **hash ทางเดียว** (D-018) — คอลัมน์ plaintext ถูกลบทิ้ง
- mobile: การ์ดภาษีถือเลขไว้ใน state ของจอเท่านั้น · ออกจากจอ/พับแอป/สลับร้าน/ออกจากระบบ = เลขหาย ·
  คลิปบอร์ดถูก mark `EXTRA_IS_SENSITIVE` (Android 13+) และ `localOnly`+หมดอายุ 120 วิ (iOS)

### Fixed

- `full_access` เป็น **wildcard** ไม่ใช่สมาชิกของเซ็ต — client ทั้งสองฝั่งเคยตีความผิดรวม 6 จุด
  ทำให้**เจ้าของร้านมองไม่เห็นเมนูของตัวเอง**
- `POST …/tax-profile/reveal` เคยตอบ `415` ทุกครั้ง (POST ไม่มี body หลัง `JsonOnlyGuard`)
- `type: boolean` + `enum:` ใน contract ทำให้ dart-dio สร้าง enum แบบ string ⇒ **signup บนมือถือพังทุกครั้ง**
- F-002 ฝั่ง mobile ไม่เคยถูก wire เข้า composition root — ฟีเจอร์รันไม่ได้นอก harness ของเทสต์
- `dev`/`start` ของ API รันไม่ได้ทั้งคู่ (config ship TS source · `tsx` ไม่ emit decorator metadata)
- ทั้งแอปมือถือเข้าร้านด้วย capability **ว่างเปล่า** — เจ้าของร้านตัวจริงถูกปฏิบัติเหมือนไม่มีสิทธิ์
- client เขียน capability set ของตัวเอง (`{'full_access'}`) จากข้อมูลที่ `201` ไม่เคยส่งมา
- `/` ยังเป็น placeholder ของ F-000 — เปิดโดเมนเปล่าเจอ shell ไม่ว่าจะล็อกอินอยู่หรือไม่
  · ตอนนี้: ยังไม่ล็อกอิน→`/login` · ล็อกอินแล้ว→`/select-org` · ระหว่างที่ยังไม่รู้→รอ (ไม่เด้ง)
- แถวคำเชิญที่ **ยกเลิก/รับไปแล้ว** ยังขึ้นว่า "ลิงก์ใช้ได้ถึง … (อีกประมาณ 7 วัน)"
  · ตอนนี้มีป้ายสถานะตาม ux-wireframe §7: `รอตอบรับ · หมดอายุแล้ว · ยกเลิกแล้ว · รับแล้วเมื่อ {วันเวลา}`
  · `acceptedAt` ถูกอ่านขึ้นจอเป็นครั้งแรก — "ใครรับเมื่อไหร่" ตอบได้แล้ว
- **ทั้งแอปเว็บไม่มีปุ่ม "ออกจากระบบ"** — ทางเดียวที่ออกได้คือ "ออกจากระบบทุกอุปกรณ์"
  ซึ่งจบทุก session ทุกเครื่องของคนนั้น · ตอนนี้มีแถวออกจากระบบใน sidebar ตามที่ ux-wireframe §S2 วาดไว้
- แอปมือถือ **ชี้ไป API ไหนไม่ได้เลย** — `main.dart` ฮาร์ดโค้ด `localhost` (= ตัวเครื่องเอง)
  และ `--dart-define=API_BASE_URL` ที่ทั้ง CI และ runbook ส่งเข้าไปถูกอ่านโดยไฟล์เทสต์เท่านั้น
- **มือถือ: จอของ F-002 ทั้งชุดไม่มีทางเข้าถึงในแอปจริง** — `app.dart` จบที่จอความปลอดภัยของ F-001
  และ `signedIn()` ไม่เคยถูกเรียกจากที่ไหนเลย ⇒ `switchOrg` เขียนอะไรไม่ได้ (แตะร้านแล้วเงียบ)
  · ตอนนี้ปลายทางมาจาก `SessionState` จริง + เปลือก 3 แท็บ (ข้อมูลร้าน · สมาชิก · ความปลอดภัย)
  · มือถือมีปุ่ม **"ออกจากระบบ"** แล้ว (เดิมมีแต่ "ออกจากระบบทุกอุปกรณ์" เหมือนฝั่งเว็บ)

### Changed

- **contract:** ถอด `default:` ออกจาก request field (`CreateOrganizationRequest.timezone`,
  `LoginRequest.tokenTransport`) — `openapi-typescript` ปั๊ม field ที่มี default เป็น **required**
  และ dart-dio อัดค่าไว้ใน builder ⇒ default ฝั่ง server แตะไม่ถึง
  **oasdiff ยืนยัน: ไม่ใช่ breaking change** (client เก่ายังส่งค่าเดิมได้)
- **contract:** `RoleRow.grantsOwnership` (optional, additive) — ให้ client ที่ไม่ใช่ Owner
  ระบุ role ที่เป็นเจ้าของได้โดยไม่ต้องเผยแพร่ `capabilities`

[Unreleased]: https://github.com/thewinwebdevelop/spec-inventory-manager/commits/chore/agent-definitions
