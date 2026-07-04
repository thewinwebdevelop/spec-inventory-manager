# F-006 Mobile App Shell

> สถานะ: `gate1-approved` · Phase: 0 · ขึ้นกับ (depends on): F-000 (contract), F-001 (auth), F-002 (org), F-003 (capability), F-007 (tier) · เจ้าของ: frontend (Flutter) · UX/tokens: ux
> **Platform:** mobile · **ขนาดงาน:** full (technical foundation — ทุกจอมือถือต่อยอด)

---

# ══ Gate 1 — Requirement ══

## 1. ภาพรวม (Overview)
- **ปัญหา/เป้าหมาย:** ฐาน Flutter ที่จอมือถือทุกตัวเสียบเข้า — auth/session, org context, API client, permission/tier UI, push, theme/i18n, observability · mobile = client หลัก (parity-first) shell ต้องแข็งตั้งแต่แรก
- **ผู้ใช้:** ทุก role (ทางอ้อม — ใช้แอป), frontend dev (สร้างจอต่อยอด), System
- **คุณค่า:** จอใหม่ทุกจอได้ auth/org/permission/error/i18n ฟรีจาก shell ไม่ต้องทำซ้ำ · ประสบการณ์สม่ำเสมอ + ปลอดภัย

## 2. User stories & Acceptance criteria

- **US-1 (Auth/session):** ในฐานะผู้ใช้มือถือ ฉันต้องการ **คงสถานะล็อกอินอย่างปลอดภัยและไม่ต้องล็อกอินบ่อย**
  - [ ] AC: token เก็บใน **secure storage** (Keychain/Keystore) เท่านั้น
  - [ ] AC: 401 → **refresh เงียบๆ** (queue request ระหว่าง refresh) · refresh ไม่ได้ → "เซสชันหมดอายุ เข้าสู่ระบบใหม่" + ไป login
  - [ ] AC: detect refresh-reuse → logout ทั้งสาย (F-001) · logout ลบ token จาก device

- **US-2 (Org context):** ในฐานะผู้ใช้ที่มีหลาย license ฉันต้องการ **สลับ org และทำงานในบริบทที่ถูก**
  - [ ] AC: active org เป็น state กลางของ shell + มี **org switcher**
  - [ ] AC: **ทุก API call แนบ active org อัตโนมัติ** (client ลืมไม่ได้ — กฎทอง 3 ฝั่ง client)
  - [ ] AC: ถูก revoke จาก active org → 403 → เด้งเลือก org อื่น/ออก

- **US-3 (API client + error):** ในฐานะจอใดๆ ฉันต้องการ **client + การจัดการ error ที่สม่ำเสมอ**
  - [ ] AC: Dart client generate จาก OpenAPI (F-000)
  - [ ] AC: **error mapping จุดกลาง** — backend `code`+`message` → ข้อความผู้ใช้ผ่าน i18n + action ที่ถูก (401→login, 403→สิทธิ์/อัปเกรด, network→ลองใหม่, 500→ขัดข้องชั่วคราว)

- **US-4 (Permission/Tier UI):** ในฐานะจอใดๆ ฉันต้องการ **render ตามสิทธิ์+tier**
  - [ ] AC: หลัง login/สลับ org → ดึง capability (F-003) + entitlement (F-007) มา cache
  - [ ] AC: มี `<FeatureGate>` (โชว์+ล็อก+อัปเกรด) + ซ่อน/disable ปุ่มตาม capability
  - [ ] AC: client ซ่อน/ล็อก = UX เท่านั้น · **server enforce เสมอ**

- **US-5 (Push):** ในฐานะระบบ ฉันต้องการ **plumbing ของ push พร้อมใช้**
  - [ ] AC: register FCM/APNs token · ขอ permission · route tap → จอที่เกี่ยว · logout ลบ token
  - [ ] AC: **content/triggers ของ notification = F-028** (shell แค่วางท่อ)

- **US-6 (Theme/i18n):** ในฐานะผู้ใช้ ฉันต้องการ **UI ไทยที่อ่านง่ายและสลับภาษาได้**
  - [ ] AC: design tokens → Flutter theme · ฟอนต์ไทย · format เลข/เงิน/วันที่แบบไทย
  - [ ] AC: **i18n framework** — UI copy เป็น key · **default ไทย** · **สลับภาษาเองใน settings** (ไม่ auto-detect)
  - [ ] AC: ไทยครบ · **config รองรับอังกฤษ** (เติม progressive — forward-commitments)
  - [ ] AC: **loading = Skeleton shimmer** (reusable widget จาก design system — ดู docs/design-system.md) ไม่ใช่ spinner
  - [ ] AC: ทุกจอมีครบ state: empty / loading(skeleton) / error + Thai copy (ผ่าน ux/thai-ux)

- **US-7 (Platform/resilience):** ในฐานะผู้ใช้เน็ตไม่ดี ฉันต้องการ **แอปไม่พังเวลาเน็ตหลุด**
  - [ ] AC: detect offline → แสดง state · retry/backoff อัตโนมัติ · cache read ล่าสุดให้ดูได้
  - [ ] AC: **force-update / min-version** — client เก่าเกินกว่า contract รองรับ → บล็อก + "กรุณาอัปเดตแอป"
  - [ ] AC: multi-env (dev/staging/prod) + crash reporting

## 3. ขอบเขต (Scope)

| อยู่ใน scope (In — F-006) | ไม่อยู่ใน scope (Out / ภายหลัง) |
|---|---|
| auth/token/refresh, org context+switcher, Dart client, error mapping i18n | **biometric app-lock** → F-061 |
| FeatureGate + capability UI, push register+routing | **full offline-write sync** → F-061 |
| theme/tokens, i18n (ไทยครบ+สลับ settings), skeleton loading | **deep-link เต็ม, store submission, perf, dark mode** → F-061 |
| force-update/min-version, multi-env, crash, network-resilient พื้นฐาน | **คำแปลอังกฤษครบ** → phase หลัง · push **content** → F-028 |

## 4. Business rules & edge cases
- token ไม่หลุดออกนอก secure storage · ทุก request ผูก active org
- client ไม่ทำ money math บน float — แสดงค่าที่ server คำนวณ (กฎทอง Gate D)
- UI ไม่บิดความจริงโมเดล (SellableSku ไม่โชว์เหมือนมีสต๊อกเอง)
- Thai copy ทุก state ผ่าน ux/thai-ux (i18n key)
- edge: contract version ใหม่ที่ client เก่าไม่รองรับ → force-update
- edge: push permission ถูกปฏิเสธ → แอปยังใช้ได้ (degrade) + เตือนเปิดใน settings

> ✋ **Gate 1 sign-off:** user + product เคาะแล้ว → `gate1-approved`

---

# ══ Gate 2 — Design ══
> _TODO: shell architecture · navigation · i18n setup · token/refresh interceptor · test plan_
