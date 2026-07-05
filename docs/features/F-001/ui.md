---
doc: ui
owner: "@ux"
signoff: approved     # pending | approved
---

# F-001 Authentication — UI / visual

> design token (สี/typography/spacing) + visual spec ที่ใช้ร่วม web↔mobile
> — reuse design system กลางก่อน; ของใหม่ contribute-back เข้า
> [docs/design-system.md](../../design-system.md) (ดูที่นี่: **ใหม่ทั้งหมด**, F-001 เป็น
> feature แรกที่ต้อง "เติมค่าจริง" ให้ token ที่ยังเป็น TODO — บันทึกไว้ที่นี่ *และ*
> contribute-back เข้า design-system.md §1 ตาม §7 ด้านล่าง).

---

## 1. Screen inventory

| # | หน้าจอ | Path (web) | Path (mobile, F-006) | Reuse หรือใหม่ |
|---|---|---|---|---|
| 1 | สมัครใช้งาน | `/signup` | Signup screen | ใหม่ — `AuthForm` component |
| 2 | เข้าสู่ระบบ | `/login` | Login screen | reuse `AuthForm` (จาก #1) |
| 3 | ลืมรหัสผ่าน (static help) | `/login/help` หรือ dialog | Help sheet/screen | ใหม่ — เนื้อหา static, ไม่มีฟอร์ม |
| 4 | อุปกรณ์ที่เข้าสู่ระบบ | `/settings/sessions` | Settings → Sessions screen | ใหม่ — `SessionListItem` component |
| 5 | Confirm dialog: ออกจากอุปกรณ์ / ออกจากระบบทุกอุปกรณ์ | modal | bottom sheet / alert | reuse `ConfirmDialog` (design-system กลาง — ถ้ายังไม่มี ให้ contribute-back ตอนนี้) |
| 6 | Confirm dialog: รีเซ็ตรหัสผ่าน (spec ให้ F-004 ใช้) | modal (ใน F-004) | — | reuse `ConfirmDialog` + `PasswordField` |
| 7 | Throttle banner (login/signup) | inline บนหน้า login/signup | inline บนหน้าเดียวกัน | ใหม่ — `ThrottleBanner` component (contribute-back) |
| 8 | เปลี่ยนรหัสผ่าน (US-6, D-008) | `/settings/security` (section, ติดกับ session list) | Settings → Security screen | reuse `PasswordField` + `AuthForm`-style layout + `ThrottleBanner` — ไม่มี component ใหม่ |

---

## 2. Key components (reuse-first)

### 2.1 คอมโพเนนต์ใหม่ที่ F-001 ต้องการ contribute-back เข้า design-system กลาง

| Component | หน้าที่ | ใช้ซ้ำที่ไหนได้อีก |
|---|---|---|
| `AuthForm` | ฟอร์ม email+password พร้อม inline validation, loading state, error banner slot | ใช้ได้กับทุกฟอร์ม auth ในอนาคต (เช่น F-081 self-serve reset) |
| `PasswordField` | input password + ปุ่มตาแสดง/ซ่อน + helper text slot | ทุกที่ที่รับรหัสผ่าน (signup, admin-reset ใน F-004, F-081) |
| `ThrottleBanner` | banner สีเหลือง/เตือน + countdown แบบ real-time จาก `Retry-After`, disable ฟอร์มระหว่างรอ | ทุก endpoint ที่มี rate-limit ในอนาคต ไม่จำกัดแค่ auth |
| `ErrorBanner` | banner แดงเหนือฟอร์ม สำหรับ error ทั่วไป (แยกจาก inline field error) | ใช้ทุกฟอร์มทั่วระบบ — เสนอเป็น token กลางใน design-system §2 |
| `SessionListItem` | 1 row ของ session: ไอคอนอุปกรณ์ + label + last-active + badge "อุปกรณ์นี้" + ปุ่ม action | อาจ reuse pattern เดียวกันกับ device/API-key list ในอนาคต |
| `ConfirmDialog` | dialog ยืนยัน 2 ปุ่ม (ยกเลิก/ยืนยัน) รองรับ variant `default` และ `destructive` (สีแดง) | ใช้ทั่วทั้งระบบ (ลบสินค้า, ยกเลิก order ฯลฯ) — **เช็คก่อนว่า design-system มีอยู่แล้วหรือยัง**; ถ้ามีแล้ว reuse ตรง ไม่สร้างใหม่ |

> **Reuse-first check:** ก่อน `frontend` implement, เช็ค `docs/design-system.md` + Claude Design project
> ว่ามี `ConfirmDialog` / `ErrorBanner` จาก feature ก่อนหน้าหรือยัง (F-001 เป็น feature ที่ 2
> ที่แตะ UI หลัง F-000 ซึ่งเป็น infra-only — สันนิษฐานว่ายังไม่มี component เหล่านี้เลย
> F-001 จึงเป็นผู้ contribute ชุดแรก).

### 2.1.1 Change password (US-6, D-008) — reuse only, ไม่มี component ใหม่

หน้า "เปลี่ยนรหัสผ่าน" (ux-wireframe §9) ประกอบจาก component ที่มีอยู่แล้ว 100%:

| ใช้ component | บทบาทในหน้านี้ |
|---|---|
| `PasswordField` × 2 | ฟิลด์ "รหัสผ่านปัจจุบัน" + "รหัสผ่านใหม่" (ตาแสดง/ซ่อน + helper slot สำหรับ policy copy) |
| `AuthForm`-style layout | โครงฟอร์ม 2 ฟิลด์ + ปุ่มหลัก + slot สำหรับ `ErrorBanner`/`ThrottleBanner` เหนือฟอร์ม — ไม่ได้ literally reuse `AuthForm` component เดิม (นั้นผูกกับ signup/login field-set) แต่ reuse **โครงสร้าง/token เดียวกัน** (spacing, banner slot, ปุ่ม loading state) |
| `ThrottleBanner` | reuse ตรงตัว ไม่มีการปรับแต่งใดๆ — 429 บน `/auth/change-password` ใช้ backoff เดียวกับ login (api-spec §2.7 N-2) จึงต้องเป็น component/copy เดียวกันเป๊ะ (`auth.throttle.*`) |
| `ErrorBanner` | reuse ตรงตัว — error 401/5xx |

**ไม่มี contribute-back ใหม่จากหน้านี้** (ต่างจาก signup/login/session-list ที่ contribute
component ชุดแรก) — นี่คือหลักฐานว่า design-system ชุดแรกของ F-001 ครอบคลุมพอสำหรับ flow ใหม่
ที่มาทีหลัง (reuse-first ทำงานได้จริง).

### 2.2 States ที่ทุก component ต้องมี (ตาม design-system.md §2)

| Component | loading | empty | error | success/data |
|---|---|---|---|---|
| `AuthForm` (signup/login submit) | ปุ่ม → spinner เล็ก + disabled | n/a | `ErrorBanner` เหนือฟอร์ม + inline field error | redirect ตาม flow |
| `SessionListItem` list | skeleton shimmer 2-3 แถว | ไม่ออกแบบ (ไม่ควรเกิด, ดู ux-wireframe §4) | ข้อความ + ปุ่ม "ลองใหม่" | รายการ session ปกติ |
| `ThrottleBanner` | n/a (banner เองคือ state) | n/a | n/a | หายไปเมื่อนับถอยหลังครบ |
| Change-password form (ux-wireframe §9) | ปุ่ม → spinner เล็ก + disabled | n/a | `ErrorBanner` (401/5xx) + inline field error (422) + `ThrottleBanner` (429) | เคลียร์ฟิลด์ + toast สำเร็จ (§3.9) |

---

## 3. Thai copy table — i18n keys

> **หลัก:** ทุก string เป็น i18n key, **ไทยเป็น default** (design-system.md §3) ตาราง
> ด้านล่างคือ key + คำแปลไทยที่ frontend ต้อง wire ตรง (ไม่มี hardcode string ในโค้ด)
> Namespace: `auth.*`

### 3.1 Signup (`auth.signup.*`)

| Key | ข้อความไทย |
|---|---|
| `auth.signup.title` | สมัครใช้งาน OmniStock |
| `auth.signup.subtitle` | เริ่มต้นจัดการสต๊อกและบัญชีร้านค้าของคุณ |
| `auth.signup.email.label` | อีเมล |
| `auth.signup.email.placeholder` | เช่น somchai@shop.com |
| `auth.signup.password.label` | รหัสผ่าน |
| `auth.signup.password.placeholder` | อย่างน้อย 8 ตัวอักษร |
| `auth.signup.password.helper` | ใช้ตัวอักษร ตัวเลข หรือวลีที่จำง่าย — ไม่ต้องมีอักขระพิเศษก็ได้ |
| `auth.signup.submit` | สมัครใช้งาน |
| `auth.signup.submit.loading` | กำลังสมัคร... |
| `auth.signup.link_to_login` | มีบัญชีอยู่แล้ว? เข้าสู่ระบบ |
| `auth.signup.success_toast` | สมัครสำเร็จ! เข้าสู่ระบบเพื่อเริ่มใช้งาน |
| `auth.signup.error.email_invalid` | รูปแบบอีเมลไม่ถูกต้อง |
| `auth.signup.error.password_too_short` | รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 8 ตัวอักษร |
| `auth.signup.error.password_breached` | รหัสผ่านนี้ถูกใช้งานทั่วไปมาก ไม่ปลอดภัย ลองตั้งรหัสผ่านที่คาดเดายากขึ้น |
| `auth.signup.error.email_taken` | อีเมลนี้มีผู้ใช้งานแล้ว |
| `auth.signup.error.email_taken.login_link` | เข้าสู่ระบบ |
| `auth.signup.error.generic` | เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง |

### 3.2 Login (`auth.login.*`)

| Key | ข้อความไทย |
|---|---|
| `auth.login.title` | เข้าสู่ระบบ |
| `auth.login.email.label` | อีเมล |
| `auth.login.password.label` | รหัสผ่าน |
| `auth.login.submit` | เข้าสู่ระบบ |
| `auth.login.submit.loading` | กำลังเข้าสู่ระบบ... |
| `auth.login.forgot_password` | ลืมรหัสผ่าน? |
| `auth.login.link_to_signup` | ยังไม่มีบัญชี? สมัครใช้งาน |
| `auth.login.error.invalid_credentials` | อีเมลหรือรหัสผ่านไม่ถูกต้อง |
| `auth.login.error.generic` | เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง |

### 3.3 Throttle (`auth.throttle.*`) — ใช้ร่วมทั้ง login/signup

| Key | ข้อความไทย |
|---|---|
| `auth.throttle.banner.long` (>60s) | ลองเข้าสู่ระบบถี่เกินไป กรุณารอสักครู่แล้วลองใหม่ · เหลือ {mm}:{ss} นาที |
| `auth.throttle.banner.short` (≤60s) | รอสักครู่แล้วลองใหม่ · เหลือ {N} วินาที |
| `auth.throttle.helper` | เพื่อความปลอดภัยของบัญชีคุณ ระบบจะให้ลองใหม่ได้เองเมื่อครบเวลา |

> **ห้ามมี key ใดที่มีคำว่า "ล็อก" / "ระงับ" / "ถูกแบน" ในบริบท throttle** (D-005) — ถ้า
> frontend หรือ backend เห็น error message ที่มีคำเหล่านี้หลุดมาจาก server ให้แจ้ง `@ux`
> ทันที ไม่ใช่ pass-through ตรงๆ

### 3.4 ลืมรหัสผ่าน / help (`auth.help.*`)

| Key | ข้อความไทย |
|---|---|
| `auth.help.title` | ลืมรหัสผ่าน? |
| `auth.help.body` | ตอนนี้ระบบยังไม่รองรับการขอรีเซ็ตรหัสผ่านด้วยตัวเอง กรุณาติดต่อเจ้าของร้าน/ผู้ดูแลระบบ (Owner/Admin) ในทีมของคุณ เพื่อให้ตั้งรหัสผ่านใหม่ให้ |
| `auth.help.body_solo_owner` | หากคุณเป็นเจ้าของร้านเพียงคนเดียวและลืมรหัสผ่าน กรุณารอสักครู่แล้วลองพิมพ์รหัสผ่านที่คิดว่าถูกต้องอีกครั้ง (ระบบจะไม่ล็อกบัญชีคุณถาวร) |
| `auth.help.back_to_login` | กลับไปเข้าสู่ระบบ |

### 3.5 Session list (`auth.sessions.*`)

| Key | ข้อความไทย |
|---|---|
| `auth.sessions.title` | อุปกรณ์ที่เข้าสู่ระบบ |
| `auth.sessions.subtitle` | รายการอุปกรณ์ที่กำลังเข้าใช้งานบัญชีของคุณอยู่ |
| `auth.sessions.badge_current` | อุปกรณ์นี้ |
| `auth.sessions.last_active` | ใช้งานล่าสุด: {relativeTime} |
| `auth.sessions.device_unknown` | อุปกรณ์ไม่ทราบชื่อ |
| `auth.sessions.action.logout_device` | ออกจากอุปกรณ์นี้ |
| `auth.sessions.action.logout_all` | ออกจากระบบทุกอุปกรณ์ |
| `auth.sessions.error.load_failed` | โหลดรายการอุปกรณ์ไม่สำเร็จ |
| `auth.sessions.action.retry` | ลองใหม่ |
| `auth.sessions.toast.device_logged_out` | ออกจากอุปกรณ์แล้ว |
| `auth.sessions.toast.device_logout_failed` | ออกจากอุปกรณ์ไม่สำเร็จ กรุณาลองใหม่ |

### 3.6 Confirm dialogs (`auth.confirm.*`)

| Key | ข้อความไทย |
|---|---|
| `auth.confirm.logout_device.title` | ออกจากอุปกรณ์นี้? |
| `auth.confirm.logout_device.body` | อุปกรณ์นี้จะต้องเข้าสู่ระบบใหม่อีกครั้ง |
| `auth.confirm.logout_device.cancel` | ยกเลิก |
| `auth.confirm.logout_device.confirm` | ออกจากอุปกรณ์นี้ |
| `auth.confirm.logout_all.title` | ออกจากระบบทุกอุปกรณ์? |
| `auth.confirm.logout_all.body` | ทุกอุปกรณ์ที่เข้าสู่ระบบอยู่ (รวมเครื่องนี้) จะถูกออกจากระบบทันที และต้องเข้าสู่ระบบใหม่ทุกเครื่อง |
| `auth.confirm.logout_all.cancel` | ยกเลิก |
| `auth.confirm.logout_all.confirm` | ออกจากระบบทุกอุปกรณ์ |
| `auth.confirm.logout_all.toast` | ออกจากระบบทุกอุปกรณ์แล้ว |

### 3.7 Admin reset (`auth.admin_reset.*`) — spec ให้ F-004 ใช้

| Key | ข้อความไทย |
|---|---|
| `auth.admin_reset.title` | รีเซ็ตรหัสผ่านให้ {memberName}? |
| `auth.admin_reset.body` | สมาชิกจะหลุดออกจากทุกอุปกรณ์ที่ล็อกอินอยู่ และต้องเข้าสู่ระบบใหม่ด้วยรหัสผ่านที่คุณตั้งให้ |
| `auth.admin_reset.password.label` | รหัสผ่านใหม่ |
| `auth.admin_reset.password.helper` | แจ้งรหัสผ่านนี้ให้สมาชิกทราบนอกระบบ (เช่น บอกปากเปล่า/ข้อความส่วนตัว) — ระบบยังไม่ส่งอีเมลแจ้งอัตโนมัติ |
| `auth.admin_reset.cancel` | ยกเลิก |
| `auth.admin_reset.confirm` | รีเซ็ตรหัสผ่าน |
| `auth.admin_reset.toast.success` | ตั้งรหัสผ่านใหม่ให้ {memberName} แล้ว |
| `auth.admin_reset.error.forbidden` | คุณไม่มีสิทธิ์ทำรายการนี้ |
| `auth.admin_reset.error.not_found` | ไม่พบสมาชิกนี้ในองค์กร |

### 3.8 Session expiry / kicked-out (`auth.session_expired.*`)

| Key | ข้อความไทย |
|---|---|
| `auth.session_expired.toast` | เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง |

### 3.9 Change password (`auth.change_password.*`) — US-6, D-008

> เพิ่มระหว่าง Gate 2 (D-008) — ux-wireframe §9. Throttle บนหน้านี้ reuse key `auth.throttle.*`
> (§3.3) ตรงตัว **ไม่สร้าง key ใหม่ซ้ำซ้อน** (`auth.throttle.banner.long/short`, `auth.throttle.helper`).

| Key | ข้อความไทย |
|---|---|
| `auth.change_password.section_title` | เปลี่ยนรหัสผ่าน |
| `auth.change_password.current.label` | รหัสผ่านปัจจุบัน |
| `auth.change_password.new.label` | รหัสผ่านใหม่ |
| `auth.change_password.new.placeholder` | อย่างน้อย 8 ตัวอักษร |
| `auth.change_password.new.helper` | ใช้ตัวอักษร ตัวเลข หรือวลีที่จำง่าย — ไม่ต้องมีอักขระพิเศษก็ได้ |
| `auth.change_password.submit` | เปลี่ยนรหัสผ่าน |
| `auth.change_password.submit.loading` | กำลังเปลี่ยนรหัสผ่าน... |
| `auth.change_password.error.invalid_current` | รหัสผ่านปัจจุบันไม่ถูกต้อง |
| `auth.change_password.error.password_too_short` | รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 8 ตัวอักษร |
| `auth.change_password.error.password_breached` | รหัสผ่านนี้ถูกใช้งานทั่วไปมาก ไม่ปลอดภัย ลองตั้งรหัสผ่านที่คาดเดายากขึ้น |
| `auth.change_password.error.generic` | เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง |
| `auth.change_password.success_toast` | เปลี่ยนรหัสผ่านแล้ว · อุปกรณ์อื่นถูกออกจากระบบเพื่อความปลอดภัย |

> **reuse (ไม่ใช่ key ใหม่):** throttle บนฟอร์มนี้ = `auth.throttle.banner.long` /
> `auth.throttle.banner.short` / `auth.throttle.helper` (§3.3, D-005 ห้ามคำว่า "ล็อก"/"ระงับ"
> ใช้กฎเดียวกัน); error เครือข่ายทั่วไปใช้ pattern เดียวกับ `auth.signup.error.generic` /
> `auth.login.error.generic` (คัดลอก copy ไว้เป็น key ของตัวเองเพื่อไม่ผูก namespace ข้าม
> feature โดยไม่จำเป็น — ค่าข้อความเหมือนกันทุกตัวอักษร).

---

## 4. Design tokens — reference to central design-system

> F-001 เป็น feature UI แรก (F-000 = infra ไม่มี UI) — token ด้านล่าง**เติมค่าจริง**ให้
> `docs/design-system.md` §1 (ซึ่งยังเป็น TODO) ตาม §7 (contribute-back). Frontend
> implement จาก token เหล่านี้ *ผ่าน* central design-system ไม่ใช่จากไฟล์นี้ตรงๆ — ไฟล์นี้
> เป็นที่มาของค่า, design-system.md เป็นที่เก็บค่าจริงหลัง sync.

### 4.1 Color (semantic roles — ค่า hex สุดท้ายเคาะใน `/design-sync`)

| Token role | ใช้ที่ไหนใน F-001 | หมายเหตุ |
|---|---|---|
| `color.primary` | ปุ่มหลัก (สมัคร/เข้าสู่ระบบ/ยืนยัน) | สีแบรนด์หลัก |
| `color.danger` | `ErrorBanner`, border field ผิด, ปุ่ม destructive (ออกจากระบบทุกอุปกรณ์) | แดง |
| `color.warning` | `ThrottleBanner` | เหลือง/ส้มอ่อน — **ตั้งใจไม่ใช้ `color.danger`** เพื่อสื่อว่า "รอได้ ไม่ใช่หายนะ" (D-005 เจตนา) |
| `color.success` | toast สำเร็จ (signup, logout, reset) | เขียว |
| `color.surface` | พื้นหลัง card ฟอร์ม / row session list | |
| `color.border.default` / `color.border.danger` | field border ปกติ/ผิด | |
| `color.badge.current` | badge "อุปกรณ์นี้" | เขียวอ่อน (ไม่ใช่สีเตือน) |

### 4.2 Typography

| Token | ใช้ที่ไหน |
|---|---|
| `type.heading.md` | หัวข้อหน้า (สมัคร/เข้าสู่ระบบ/อุปกรณ์ที่เข้าสู่ระบบ) |
| `type.body.md` | คำอธิบายรอง, เนื้อหา dialog |
| `type.body.sm` | helper text ใต้ฟิลด์, `auth.sessions.last_active` |
| `type.label.sm` | field label |
| ฟอนต์ไทย | ตาม design-system.md §1 — ต้อง render เลข/countdown ชัดที่ font-weight ปกติ (countdown เปลี่ยนเลขทุกวินาที ต้องไม่กระตุก/ชิด) |

### 4.3 Spacing / layout

| Token | ใช้ที่ไหน |
|---|---|
| `space.form.gap` | ระยะห่างระหว่างฟิลด์ในฟอร์ม auth |
| `space.card.padding` | padding ของ auth card (web) / เต็มจอ (mobile ใช้ `space.screen.padding`) |
| `radius.card` | มุมโค้ง card ฟอร์ม, dialog |
| `radius.button` | มุมโค้งปุ่ม |
| max-width web auth card | ~400px (ตาม ux-wireframe §2) |

### 4.4 Elevation

| Token | ใช้ที่ไหน |
|---|---|
| `elevation.dialog` | `ConfirmDialog` shadow (web) |
| `elevation.card` | auth card shadow เบาๆ (web); mobile ไม่ใช้ elevation (full-screen ไม่มี card) |

---

## 5. Platform-specific notes (สรุปจาก ux-wireframe §8 — เฉพาะมุม visual)

| ประเด็น | Web | Mobile |
|---|---|---|
| Auth card container | มี card + shadow (`elevation.card`), max-width 400px, centered | เต็มจอ ไม่มี card/shadow, ใช้ `space.screen.padding` |
| ปุ่มแสดง/ซ่อนรหัสผ่าน | icon button ในฟิลด์ (คลิก, hover state) | icon button ในฟิลด์ (แตะ, ไม่มี hover — ต้องมี active/pressed state แทน) |
| ConfirmDialog | modal กลางจอ | bottom sheet (ตาม native pattern ของ F-006) — เนื้อหา/copy เหมือนกันทุกตัวอักษร ต่างแค่ container |
| Toast | มุมขวาบน/ล่าง (ตาม design-system toast placement) | ด้านล่างจอ เหนือ safe-area |

---

## 6. Accessibility notes

- ทุกฟิลด์มี `label` ผูกกับ input จริง (ไม่ใช่ placeholder-only)
- error banner + inline field error ต้องประกาศผ่าน `aria-live="polite"` (web) เพื่อ screen reader อ่านทันทีที่ error โผล่
- ปุ่มตาแสดง/ซ่อนรหัสผ่านต้องมี label สำหรับ screen reader: "แสดงรหัสผ่าน" / "ซ่อนรหัสผ่าน" (toggle)
- Focus order: signup/login → email → password → (helper/error ไม่ intercept tab) → submit button
- Throttle countdown ต้องประกาศซ้ำผ่าน `aria-live` แบบไม่ถี่เกินไป (เช่น ทุก 10 วินาที ไม่ใช่ทุกวินาที — กัน screen reader spam)
- Confirm dialog (`ConfirmDialog`) focus trap ภายใน dialog, ปุ่ม "ยกเลิก" ไม่ใช่ default focus สำหรับ variant `destructive` (ป้องกันกด Enter พลาด) — default focus ควรอยู่ที่ "ยกเลิก" จริงๆ เพื่อความปลอดภัย (สอดคล้อง pattern มาตรฐาน "destructive action ไม่ควรเป็น default focus")

---

## 7. Contribute-back checklist (design-system.md)

หลัง Gate 2 sign-off ของเอกสารนี้ ux ต้อง sync กลับเข้า `docs/design-system.md`:

- [ ] §1 Design tokens: เติมค่าจาก §4 ด้านบน (color/typography/spacing) แทนที่ TODO
- [ ] เพิ่ม `ErrorBanner`, `ThrottleBanner`, `ConfirmDialog`, `PasswordField`, `AuthForm`,
      `SessionListItem` เข้ารายการ component กลาง (ถ้ายังไม่มีไฟล์ registry แยก ให้เพิ่ม
      section ใหม่ใน design-system.md หรือเปิด `/design-sync`)
- [ ] ยืนยันกับ `frontend` ว่า token เหล่านี้ map เข้า Tailwind/Flutter ThemeData ได้ตรง
      (ไม่มี off-token color เช่น สีเหลืองของ `ThrottleBanner` ต้องเป็น token ไม่ใช่ hardcode)
- [ ] log ใน `docs/DECISIONS.md` ถ้ามี breaking token change (design-system.md §6)
