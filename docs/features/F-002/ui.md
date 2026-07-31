---
doc: ui
owner: "@ux"
signoff: approved   # user 2026-07-29 (หลัง mockup sign-off D-026/D-031)
---
# [F-002] UI / visual

> design token (สี/typography/spacing) + visual spec ที่ใช้ร่วม web↔mobile — ระบุเฉพาะส่วนที่ต่างกันต่อ platform
> · flow/copy เต็มอยู่ที่ [ux-wireframe.md](ux-wireframe.md) · **reuse design system กลางก่อนเสมอ**
> ([docs/design-system.md](../../design-system.md)) ของใหม่ contribute-back ที่ §7

## Contract summary (≤20 บรรทัด — ทีม consumer อ่านแค่ส่วนนี้)

1. **ไม่มีสีใหม่ ไม่มีฟอนต์ใหม่** — F-002 ใช้ token Calm Teal (D-026) ตาม design-system §1.1–1.1c ครบ ทั้ง light + dark
2. **component ใหม่เข้า DS กลาง 7 ตัว:** `EmptyState` (+preset `ForbiddenPanel`) · `Banner` (tone info/warning/success/danger) · `Badge` (สถานะ) · `SectionCard` · `CopyField` · `RadioCardGroup` · `ListRow` — ทุกตัว feature-agnostic + org-agnostic
3. **component ระดับ feature (ไม่เข้า DS):** `AppShell` + `OrgSwitcher` + `CopyLinkPanel` + `MemberRow`/`InvitationRow` (org-aware/invite-specific)
4. **แก้ของเดิมแบบ additive 2 จุด:** `ConfirmDialog` รับ `body` เป็นหลายบรรทัด + prop `focusCancel` (default = true เมื่อ `variant="destructive"`) · `Button` เพิ่ม variant `tertiary` + size `sm` + state `confirmed` — ไม่ breaking
5. **token ใหม่ (ค่าใหม่ล้วน ไม่ทับของเดิม):** `size.sidebar.w` 240 · `size.dialog.max-w` 480 · `size.list-row.min-h` 56 · `color.badge.neutral.*` · **`color.info.bg/.border/.text`** (tone info ของ `Banner` — เดิมประกาศ component แต่ไม่มี token) · **`focus.ring.w/.offset/.color`** · **`size.icon.sm/md/lg/xl` + `icon.stroke`** — รายการเต็ม + เหตุผล §7
5ก. **ทุกอย่างที่กดได้สูง ≥ `size.tap-target.min` (44px) ไม่มีข้อยกเว้น** — `Button size="sm"` = แน่นที่ตัวอักษร/ระยะข้าง **ไม่ใช่** เตี้ยลง (§2.5)
5ข. **ไอคอน = `Phosphor` (MIT · weight regular) — เคาะแล้ว D-031** outline/stroke เท่านั้น · grid 24 · stroke 2 · `currentColor` · ห้าม emoji/รูป/ไอคอนทึบ · **โค้ดอ้าง `icon.<role>` ตาม design-system §1.6.2 (ตารางชื่อไอคอนจริง web+Flutter) ไม่ import ชื่อ vendor ตรง ๆ**
6. **4 states ทุกจอ** ตาม DS §2 (skeleton ตาม layout จริง, ไม่ใช่ spinner) — ตาราง §4
7. **ป้ายสถานะห้ามสื่อด้วยสีอย่างเดียว** — `Badge` มีข้อความไทยเสมอ (a11y + WCAG AA ทุกคู่สี)
8. **i18n namespace `org.*`** — copy ทั้งหมดเป็น key (DS §3) ตาราง §3 · **ห้าม hardcode "7 วัน"/"24 ชั่วโมง"** ทุกที่ (ใช้ `expiresAt`)
9. **web = desktop-first + tablet** (DS §8) **ยกเว้นจอเดียว: `/invite` ต้องดีบนเบราว์เซอร์มือถือ** (ลิงก์ถูกส่งทางแชต)
10. **mobile:** confirm ใช้ `confirm_dialog.dart` เดิม (ไม่บังคับเปลี่ยนเป็น sheet ใน F-002 — pattern sheet เป็นของ F-006) · bottom sheet ใช้กับ **ตัวสลับร้าน** + **เมนูการกระทำของแถว** (`showModalBottomSheet`, ไม่มี dependency ใหม่)
11. **ไม่มีปุ่มอัปโหลดโลโก้** (contract รับได้แค่ `null` จนถึง F-040) → avatar = ตัวย่อชื่อร้านบนพื้น `surface.muted`
12. **mockup sign-off ตาม D-026: ต้องมี** — 5 จอ (§8): AppShell+OrgSwitcher · สมาชิก · แผ่นลิงก์คำเชิญ+ยืนยันออกลิงก์ใหม่ · ข้อมูลร้าน/บล็อกภาษี · `/invite`
13. **sync-back:** §7 มี diff ที่ต้องเติมเข้า `docs/design-system.md` หลัง sign-off (ux เป็นคนเติม — ไม่ใช่ frontend)
14. **copy ที่ผูกกับ contract amend #4 (ไม่มี component ใหม่):** `409` + `details.reason="busy"` → ข้อความกลาง `org.common.error.busy` · เลขผู้เสียภาษีเต็มมาจาก `POST …/tax-profile/reveal` เท่านั้น (ปุ่ม "แสดงเลขเต็ม" = ยิง API + มี copy ของ `429`) · **S13 = ข้อความชุดเดียวครอบ 2 เคสที่ถูกปฏิเสธ** (D-028/C-2 + D-030/NEW-1) — **ห้ามแตกเป็นหลายข้อความ**
15. **แถบ "ตั้งเจ้าของร้านสำรอง" (D-030)** = `Banner` tone **info** บนจอสมาชิก + ข้อ 3 ของการ์ด "เริ่มต้นใช้งาน" บน S4 — reuse ล้วน ไม่มี token/component ใหม่

---

## 1. Screen inventory

| # | หน้าจอ | Path (web) | Mobile | Reuse / ใหม่ |
|---|---|---|---|---|
| S1 | เลือกร้าน | `/select-org` | route `/select-org` (full-screen) | ใหม่: `ListRow` (DS) + `EmptyState` (DS) |
| S2 | สร้างร้านใหม่ | `/orgs/new` | full-screen | reuse `TextField` + `Button` + `Banner`(info) |
| S3 | โครงหน้าจอ + ตัวสลับร้าน | `app/o/[orgId]/layout` | AppBar + bottom sheet | ใหม่ (feature): `AppShell`, `OrgSwitcher` |
| S4 | ข้อมูลร้าน (หน้าแรกของร้าน) | `/o/{orgId}/settings/org` | full-screen | ใหม่: `SectionCard` (DS) |
| S5 | ข้อมูลผู้เสียภาษี | dialog | full-screen | ใหม่: `RadioCardGroup` (DS) + reuse `TextField` |
| S6 | สมาชิก | `/o/{orgId}/settings/members` | full-screen | ใหม่: `Badge` (DS), `ListRow` (DS), `MemberRow`/`InvitationRow` (feature) |
| S7 | เชิญสมาชิก | dialog | full-screen | reuse `TextField` + `RadioCardGroup` + `Banner` |
| S8 | ลิงก์คำเชิญ / ออกลิงก์ใหม่ | dialog | full-screen + confirm | ใหม่: `CopyField` (DS) + `CopyLinkPanel` (feature) + reuse `ConfirmDialog` |
| S9 | เปลี่ยนสิทธิ์ | dialog | bottom sheet เปิดฟอร์ม → dialog | reuse `RadioCardGroup` + `Banner` |
| S10 | ถอด / ออกจากร้าน | `ConfirmDialog` | `confirm_dialog.dart` | reuse (+`focusCancel`) |
| S11 | รับคำเชิญ `/invite` | `/invite` | — (ไม่มีในแอป, F-006 deep link) | reuse `AuthCard` + `Banner` + `EmptyState`(preset error) |
| S12 | 403 สองแบบ | ทุก route | ทุก route | reuse `Banner`(warning) + `EmptyState` preset `ForbiddenPanel` |
| S13 | copy ตั้งรหัสผ่านใหม่ให้สมาชิก — 2 เคสถูกปฏิเสธ ข้อความเดียว (ฝากให้ F-004) | — | — | reuse `Banner`(info ก่อนกด / warning ตอนล้มเหลว) + `PasswordField` |

---

## 2. Component spec

### 2.1 ของใหม่ที่ contribute-back เข้า design system กลาง

| Component | หน้าที่ | Visual spec (token เท่านั้น) | ใช้ซ้ำได้ที่ไหนอีก |
|---|---|---|---|
| `EmptyState` | สถานะว่าง/ผิดพลาด/ไม่มีสิทธิ์ เต็มพื้นที่เนื้อหา — ไอคอน + หัวข้อ + คำอธิบาย + ปุ่ม (0–2 ปุ่ม) | จัดกึ่งกลาง max-w 400px · ไอคอน `size.icon.xl` (40, stroke 1.5) `color.text.muted` · หัวข้อ `type.heading.sm` · เนื้อ `type.body.md` `color.text.muted` · ปุ่มห่าง `space.6` | ทุก list ทั้งระบบ (F-010+) · preset `ForbiddenPanel` (ไอคอนกุญแจ) ใช้กับทุก route ที่ RBAC ปฏิเสธ (F-003) |
| `Banner` | แถบแจ้งเหนือเนื้อหา 4 โทน: `info` / `warning` / `success` / `danger` | radius `radius.card` · padding `space.4` · ไอคอน `size.icon.md` (20) + ข้อความ `type.body.sm` · info = **`color.info.bg/.border/.text`** (ใหม่ §7) · warning/success/danger = `<role>.bg/.border/.text` · **ปุ่มในกล่องใช้โทนของกล่อง** (§2.6) | ทุก feature · `ErrorBanner`/`ThrottleBanner` เดิม **คงไว้ตามเดิม** (ThrottleBanner = Banner tone warning + countdown) |
| `Badge` | ป้ายสถานะ pill พร้อม**ข้อความเสมอ** 4 variant: `success` / `warning` / `neutral` / `danger` | `radius.badge` · padding `space.1` แนวตั้ง / `space.2` แนวนอน · `type.body.sm` 500 · คู่สีตาม role เดิม + `color.badge.neutral.*` (ใหม่) | สถานะทุกโดเมนหลังจากนี้ (ออเดอร์/ซิงก์/เอกสาร) — generalize จาก `badge.current` ของ F-001 |
| `SectionCard` | การ์ดเนื้อหา: หัวข้อ + ปุ่ม action มุมขวา + แถวข้อมูล label→value | พื้น `color.surface` · `radius.card` · `elevation.card` (web) / ไม่มีเงา (mobile) · padding `space.6` (web) `space.4` (mobile) · แถวข้อมูล label `type.label.sm` `text.muted`, value `type.body.md` | ทุกหน้า settings/detail (F-004, F-007, F-020) |
| `CopyField` | กล่องข้อความ read-only + ปุ่มคัดลอก + ฟีดแบ็ก "คัดลอกแล้ว" | พื้น `surface.muted` · border `border.default` · `radius.button` · ข้อความ `type.body.sm` ตัดบรรทัดได้ (`break-all`) · ปุ่มคัดลอก `Button variant=secondary` | ทุกที่ที่มีค่าให้คัดลอก (webhook URL F-023, API key F-085) |
| `RadioCardGroup` | ตัวเลือกแบบการ์ด: หัวข้อ + คำอธิบาย + สถานะ disabled พร้อมเหตุผล | การ์ดเรียงตั้ง gap `space.2` · เลือกอยู่ = border `color.primary` 2px + พื้น `surface` · disabled = opacity 60% + helper `type.body.sm` `text.muted` · tap ทั้งการ์ด (≥`size.tap-target.min`) | เลือก role (F-003), เลือกแพ็กเกจ (F-007), เลือกวิธีปรับสต๊อก (F-013) |
| `ListRow` | 1 แถวรายการ: avatar/ไอคอน + บรรทัดหลัก + บรรทัดรอง + slot ขวา (badge/ปุ่ม/`›`) | สูงขั้นต่ำ `size.list-row.min-h` (56px) · padding `space.4` · เส้นคั่น `border.default` · hover (web) = `surface.muted` | ทุก list ที่ไม่ใช่ DataTable (F-013/F-024 บน mobile) |

### 2.2 ของใหม่ระดับ feature (อยู่ใน `features/org/` — **ไม่**เข้า DS)

| Component | เหตุผลที่ไม่เข้า DS | Visual |
|---|---|---|
| `AppShell` (web) | org-aware (ผูก `/o/[orgId]`) — DS ต้อง org-agnostic (web.md rule 3) | sidebar กว้าง `size.sidebar.w` (240px) พื้น `color.surface` เส้นขวา `border.default` · เมนู item สูง 44px, active = พื้น `surface.muted` + ตัวอักษร `color.primary` · tablet (md) → drawer |
| `OrgSwitcher` | org-aware | web: ปุ่มกล่องบนสุดของ sidebar (ตัวย่อร้าน + ชื่อ + `▾`) → dropdown `elevation.dialog`, แถวมี ✓ + สิทธิ์ · mobile: แตะชื่อร้านบน AppBar → bottom sheet รายการเดียวกัน |
| `CopyLinkPanel` | ผูกกับกติกา "ลิงก์แสดงครั้งเดียว" ของ D-027 | `CopyField` + `Banner`(warning "แสดงครั้งเดียว") + `Banner`(info วันหมดอายุ) + ปุ่มปิด · **แถบเตือนคือด่านเดียว ไม่มี dialog กันปิด** (user เคาะ 2026-07-28) · ปุ่มปิดเป็น `secondary` ก่อนคัดลอก → `primary` หลังคัดลอก (ทางออกปลอดภัยแล้ว) |
| `MemberRow` / `InvitationRow` | ผูก schema ของ F-002 | `ListRow` + `Badge` + เมนู `⋯` (web) / แตะเปิด sheet (mobile) |

### 2.3 Reuse ตรง ๆ จาก F-001 (ไม่แก้)

`Button` (primary/secondary/destructive + loading) · `TextField` · `PasswordField` (เฉพาะ S13) · `ErrorBanner` · `ThrottleBanner` (429 ทุกจุด) · `Skeleton` (shimmer) · `Toast` · `AuthCard` (S11 `/invite`) · `ConfirmDialog` (ดู §2.4) · mobile: `labeled_text_field.dart`, `error_banner.dart`, `skeleton.dart`, `app_toast.dart`, `confirm_dialog.dart`

### 2.4 การแก้ `ConfirmDialog` (additive — ไม่ breaking)

| เปลี่ยนอะไร | ทำไม |
|---|---|
| `body` รับได้ทั้ง `string` และ **หลายบรรทัด/รายการ** | S10 ต้องบอกผลลัพธ์เป็นข้อ ๆ (4 ข้อ) — ยัดใน string เดียวอ่านไม่ออก |
| เพิ่ม prop `focusCancel?: boolean` (default = `variant === "destructive"`) | S8.2 "ออกลิงก์ใหม่" ไม่ใช่ปุ่มแดง แต่ผลลัพธ์ย้อนไม่ได้ ⇒ ต้อง default focus ที่ "ยกเลิก" ด้วย |
| ไม่เปลี่ยน: props เดิม, focus trap, Escape = cancel | ★ พฤติกรรม a11y ที่ F-001 ผ่าน review แล้ว |

### 2.5 การแก้ `Button` (additive) + กติกา tap target

> **ที่มา:** รอบ mockup แรก F-002 สร้าง `btn-sm` (สูง 40px) และ `tlink` (สูง 31px) ขึ้นใช้เองโดยไม่ประกาศ
> ⇒ มี **27 องค์ประกอบที่กดได้ต่ำกว่า `size.tap-target.min` (44px)** ในจอเดียว · F-002 tag = `both` และ `/invite`
> ต้องดีบนมือถือ ⇒ แก้ที่นิยาม ไม่ใช่แก้ทีละจุด

| variant / size | Visual spec (token เท่านั้น) | ใช้เมื่อไหร่ |
|---|---|---|
| `size="md"` (เดิม, default) | `type.button.md` (16/24/600) · padding `space.3`/18px · **min-height `size.tap-target.min` (44px)** | ปุ่มทั่วไป |
| `size="sm"` *(ประกาศใหม่)* | **`type.button.sm` (14/20/600 — token ใหม่)** · padding แนวนอน `space.3` (12px) · **min-height ยังเป็น 44px** | ปุ่มรองในแถวรายการ/แถวข้อมูล/กล่องสถานะ ที่ต้องไม่แย่งสายตาปุ่มหลักของจอ |
| `variant="tertiary"` *(ประกาศใหม่ — เดิมคือ `tlink`)* | ไม่มีพื้น/ไม่มีขอบ · ตัวอักษร **`color.primary` เสมอ** (ห้าม `text.muted`) · `type.button.sm` · ไม่มีเส้นใต้ตอนพัก, **มีเส้นใต้ + พื้น `surface.muted` ตอน hover/focus** · padding ข้าง `space.2` (ชดเชยด้วย margin ติดลบให้ตัวอักษรยังชิดขอบเดิม) · **min-height 44px** | การกระทำรองสุด: "ดูคำเชิญที่หมดอายุ", "ไว้ทีหลัง", "ออกจากร้านนี้", "ใช้บัญชีอื่น" |
| `state="confirmed"` *(ประกาศใหม่)* | `success.bg` + `success.border` + `success.text` + ไอคอน check — โชว์ 2 วินาทีแล้วกลับสถานะเดิม | ปุ่ม "คัดลอกลิงก์" → "คัดลอกแล้ว" |

- ⛔ **`size="sm"` = ความหนาแน่นของ *ตัวอักษรและระยะข้าง* ไม่ใช่พื้นที่แตะ** — ความสูงต่ำกว่า 44px **ไม่มีในระบบนี้ทุก platform**
  (ทางเลือก "ยกเว้นบริบท pointer-only" ถูก**ปฏิเสธ**: web รองรับถึง tablet ที่เป็น touch จริง (DS §8) และ Flutter ใช้ token ชุดเดียวกัน ⇒ ข้อยกเว้นจะรั่วแน่นอน และเป็นข้อยกเว้นที่ทดสอบไม่ได้)
- **`tertiary` ≠ ลิงก์ในเนื้อความ** — ลิงก์ที่อยู่ในย่อหน้า (`Link`) **ต้องมีเส้นใต้ตลอดเวลา** ส่วน `tertiary` เป็นปุ่มที่ยืนเดี่ยว ใช้เส้นใต้เฉพาะ hover/focus
- **"ออกจากร้านนี้" ใช้ `tertiary` สี primary ไม่ใช่สีแดง** — น้ำหนักของ destructive อยู่ที่ `ConfirmDialog` ที่ตามมา ไม่ใช่ที่ทางเข้าซึ่งอยู่ท้ายทุกหน้าร้าน

### 2.6 ปุ่ม/ลิงก์ที่อยู่ **ใน** `Banner` — ใช้โทนของกล่องนั้น

> **ที่มา:** ปุ่ม "ลองใหม่" ใน `ErrorBanner` เดิมเป็น outline โทนกลาง (ตัวอักษร `color.text` + ขอบเทา) วางบนพื้น
> `danger.bg` ⇒ ดูเหมือนของที่ลอยมาจากที่อื่น ไม่ใช่ส่วนหนึ่งของกล่อง

| กติกา | ค่า |
|---|---|
| ตัวอักษรปุ่ม | `currentColor` = `<tone>.text` ของ banner นั้น (danger `#8F291F` / warning `#7E5008` / success `#1F5D3D` / info `color.text`) |
| ขอบปุ่ม | `color-mix(in srgb, currentColor 65%, transparent)` — ผ่าน ≥3:1 บนพื้น `<tone>.bg` ทั้ง light + dark (ตรวจแล้ว) · เป็นสูตรเดียวกับ DS §1.1c แต่ยึดกับ fg ของ tone แทน `text.muted` |
| hover | ขอบ `currentColor` เต็ม + พื้น `color-mix(in srgb, currentColor 10%, transparent)` |
| **ห้าม** | ปุ่ม fill (`primary`/`destructive`) ในกล่องโทน **danger/warning/success** — แย่ง hierarchy กับปุ่มหลักของจอ และสีปุ่มชนกับพื้นสถานะ |
| **ยกเว้น** | กล่องโทน **info** (เป็นกลาง) ใช้ปุ่ม `primary` ได้ **1 ปุ่ม** ถ้าเป็น CTA หลักของการ์ดนั้น (เช่น "กรอกข้อมูลผู้เสียภาษี" บน S4) — ถ้าเป็นแค่คำแนะนำ ใช้ `secondary`/`tertiary` (เช่นแถบ D-030 บน S6) |

### 2.7 Focus ring + ไอคอน (ของที่ DS ยังไม่เคยกำหนด)

**Focus ring** — DS เดิมเขียนแค่ "`color.primary` ใช้เป็น focus ring" แต่ไม่เคยกำหนดหน้าตา ⇒ mockup เดาค่าเอง + โชว์ค้างจนดูเหมือนมีปุ่มหลัก 2 ปุ่มแข่งกัน:

| token / กติกา | ค่า |
|---|---|
| `focus.ring.color` | `color.primary` (light `#0C6155` · dark `#2FBBA6`) |
| `focus.ring.w` | `2.5px` |
| `focus.ring.offset` | `2px` — **จำเป็น** เพราะปุ่มหลักมีพื้นเป็น `color.primary` สีเดียวกับ ring; offset 0 = ring หายไปกับพื้นปุ่ม |
| แสดงเมื่อไหร่ | **`:focus-visible` เท่านั้น** (คลิกเมาส์ไม่ขึ้น ring) · Flutter = `FocusableActionDetector` / `WidgetState.focused` ที่มาจาก keyboard traversal — พฤติกรรมเดียวกัน |
| ⛔ ห้าม | ใช้ ring แทน "ปุ่มเด่น" · โชว์ค้าง · ลบ ring โดยไม่ใส่ของแทน · ลำดับความสำคัญของปุ่มสื่อด้วย **variant เท่านั้น** |
| mockup | ห้ามวาด ring ค้าง — ใช้ป้ายกำกับ "ภาพจำลอง `:focus-visible`" คู่กับภาพสถานะพัก (S8-3 ทำแล้ว) |

**ไอคอน** — DS ไม่เคยมีนโยบายไอคอนเลย (พูดถึงแค่ "icon-button tap 44px" กับสีของ icon) ⇒ mockup รอบแรกใช้ emoji 9 ตัว:

| กติกา | ค่า |
|---|---|
| สไตล์ | **outline / stroke เท่านั้น** — ห้าม emoji, ห้ามไอคอนทึบ (filled/duotone), ห้ามรูปประกอบสี, ห้าม raster |
| grid / stroke | 24×24 · `icon.stroke` = **2** · cap + join = round |
| ขนาด | `size.icon.sm` 16 (ในบรรทัดข้อความ) · `size.icon.md` **20** (banner, ปุ่ม, แถวรายการ — ค่า default) · `size.icon.lg` 24 (nav, AppBar, icon-button) · `size.icon.xl` 40 (`EmptyState`, stroke ลดเป็น 1.5 กันหนาเกิน) |
| สี | **`currentColor` เสมอ** (รับสีจาก role ของกล่องที่มันอยู่) · ระบุสีเองได้เฉพาะ 2 กรณี: `EmptyState` (`color.text.muted`) และเครื่องหมายสำเร็จเต็มจอ (`color.success`) |
| ความหมาย | ไอคอน **ห้ามเป็นตัวสื่อความหมายเดี่ยว ๆ** — ต้องมีข้อความไทยคู่เสมอ · `aria-hidden="true"` เมื่อมีข้อความอยู่แล้ว · `aria-label` ไทยเมื่อเป็น icon-button |
| i18n | **ห้ามฝังสัญลักษณ์ไว้ใน i18n string** (`"+ เชิญสมาชิก"` → key เหลือ `"เชิญสมาชิก"` แล้วให้ component ใส่ไอคอน plus) — §3 แก้แล้ว 2 key |
| ship | web = component ที่ tree-shake ได้จาก package ของชุดที่เลือก (**ไม่ใช้ icon font / ไม่ fetch sprite**) · Flutter = `IconData` จาก package คู่ของชุดเดียวกัน · mockup = inline SVG |
| ชื่อกลาง | ux เป็นเจ้าของตาราง mapping `icon.<role>` → ชื่อไอคอนของชุดที่เลือก (warn / info / error / check / check-circle / mail / users / clock / hourglass / more / chevron-right / chevron-down / plus / circle / menu / close / lock / copy) — **เปลี่ยนชุดได้โดยจอไม่เปลี่ยนความหมาย** |

> **ชุดไอคอนจริง = การตัดสินระดับ design system → รอ user เคาะ** (3 ตัวเลือก + trade-off ที่ §7 ข้อ 5) ·
> mockup วาดเป็น "รูปกลาง" ที่ทั้ง 3 ชุดมีเหมือนกัน จึงเปลี่ยนชุดทีหลังได้โดยไม่ต้องรื้อจอ

---

## 3. Thai copy — i18n keys (namespace `org.*`)

> ทุก string เป็น key (DS §3) · ไทยเป็น default · frontend ห้าม hardcode ข้อความหรือ**ตัวเลขอายุลิงก์**

### 3.1 ร่วม (`org.common.*`)

| Key | ข้อความไทย |
|---|---|
| `org.common.role.owner` | เจ้าของร้าน |
| `org.common.role.admin` | ผู้ดูแล |
| `org.common.role.staff` | พนักงาน |
| `org.common.role.owner.desc` | ทำได้ทุกอย่าง รวมถึงตั้ง/ถอดเจ้าของร้านคนอื่น |
| `org.common.role.admin.desc` | จัดการทีมงานและงานประจำวันได้ แต่ตั้งเจ้าของร้านไม่ได้ |
| `org.common.role.staff.desc` | ทำงานประจำวัน ไม่เห็นรายชื่อทีมงานและข้อมูลผู้เสียภาษี |
| `org.common.you` | (คุณ) |
| `org.common.retry` | ลองใหม่ |
| `org.common.cancel` | ยกเลิก |
| `org.common.save` | บันทึก |
| `org.common.saving` | กำลังบันทึก... |
| `org.common.load_more` | โหลดเพิ่ม |
| `org.common.error.generic` | เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง |
| `org.common.error.forbidden` | คุณไม่มีสิทธิ์ทำรายการนี้ ติดต่อเจ้าของร้านให้เปิดสิทธิ์ให้ |
| `org.common.error.busy` *(ใหม่)* | ระบบกำลังทำรายการอื่นของร้านนี้อยู่ กรุณารอสักครู่แล้วลองใหม่อีกครั้ง |
| `org.common.error.owner_only` | เฉพาะเจ้าของร้านเท่านั้นที่ตั้งหรือแก้สิทธิ์ของเจ้าของร้าน |
| `org.common.expires_at` | ลิงก์ใช้ได้ถึง {datetime} (อีกประมาณ {remaining}) |
| `org.common.expired` | หมดอายุแล้ว |

### 3.2 เลือกร้าน / สร้างร้าน (`org.select.*`, `org.create.*`)

| Key | ข้อความไทย |
|---|---|
| `org.select.title` | เลือกร้านที่จะเข้าใช้งาน |
| `org.select.subtitle` | คุณเป็นสมาชิกอยู่ {n} ร้าน |
| `org.select.create_cta` | สร้างร้านใหม่ *(ไอคอน plus ใส่โดย component — ห้ามฝัง "+" ใน string, §2.7)* |
| `org.select.empty.title` | คุณยังไม่ได้อยู่ในร้านไหน |
| `org.select.empty.body` | สร้างร้านของคุณเอง หรือถ้ามีคนชวนคุณเข้าร้าน ให้ขอลิงก์คำเชิญจากเจ้าของร้าน |
| `org.select.error` | โหลดรายการร้านไม่สำเร็จ |
| `org.select.revoked_banner` | คุณไม่ได้เป็นสมาชิกของร้าน "{orgName}" แล้ว — เลือกร้านอื่นด้านล่าง หรือติดต่อเจ้าของร้านถ้าคิดว่าไม่ถูกต้อง |
| `org.create.title` | สร้างร้านใหม่ |
| `org.create.name.label` | ชื่อร้าน |
| `org.create.name.placeholder` | เช่น ร้านหอมกรุ่นเบเกอรี่ |
| `org.create.name.helper` | ตั้งชื่อที่คุณเรียกร้านตัวเอง เปลี่ยนทีหลังได้ |
| `org.create.info` | เมื่อสร้างเสร็จ คุณจะเป็นเจ้าของร้านนี้ และระบบจะเตรียม "คลังหลัก" ให้ 1 คลัง · ใช้สกุลเงินบาท (฿) และเวลาประเทศไทย |
| `org.create.submit` | สร้างร้าน |
| `org.create.submit.loading` | กำลังสร้างร้าน... |
| `org.create.error.name_invalid` | กรอกชื่อร้าน (ไม่เกิน 120 ตัวอักษร) |
| `org.create.error.limit_reached` | คุณสร้างร้านครบ {limit} ร้านแล้ว หากต้องการเพิ่ม กรุณาติดต่อทีมงาน OmniStock |
| `org.create.error.unavailable` | ตอนนี้ระบบยังเปิดร้านใหม่ให้ไม่ได้ (ไม่ใช่ความผิดของคุณ) ลองใหม่อีกครั้ง หรือติดต่อทีมงาน OmniStock |
| `org.create.error.generic` | สร้างร้านไม่สำเร็จ กรุณาลองใหม่อีกครั้ง |
| `org.create.success_toast` | สร้างร้าน "{orgName}" เรียบร้อย |
| `org.switcher.title` | สลับร้าน |
| `org.switcher.error` | โหลดรายการร้านไม่สำเร็จ |

### 3.3 ข้อมูลร้าน + ภาษี (`org.profile.*`, `org.tax.*`)

| Key | ข้อความไทย |
|---|---|
| `org.profile.title` | ข้อมูลร้าน |
| `org.profile.onboarding.title` | เริ่มต้นใช้งาน |
| `org.profile.onboarding.invite` | ชวนทีมงานเข้าร้าน |
| `org.profile.onboarding.invite_cta` | เชิญสมาชิก |
| `org.profile.onboarding.tax` | ประกาศข้อมูลผู้เสียภาษี เพื่อออกใบกำกับภาษีได้ |
| `org.profile.onboarding.tax_cta` | กรอกข้อมูล |
| `org.profile.onboarding.backup_owner` *(ใหม่ · D-030)* | ตั้งเจ้าของร้านสำรองไว้อีก 1 คน เผื่อวันหนึ่งคุณเข้าระบบไม่ได้ |
| `org.profile.onboarding.backup_owner_cta` *(ใหม่)* | เชิญเจ้าของร้าน |
| `org.profile.name.label` | ชื่อร้าน |
| `org.profile.locale.label` | เวลา/สกุลเงิน |
| `org.profile.locale.value` | เวลาไทย · บาท (฿) |
| `org.profile.team.label` | ทีมงาน |
| `org.profile.team.value` | สมาชิก {n} คน |
| `org.profile.team.value_with_invites` | สมาชิก {n} คน · คำเชิญค้าง {m} ใบ |
| `org.profile.edit_name.title` | แก้ไขชื่อร้าน |
| `org.profile.edit_name.success_toast` | บันทึกชื่อร้านแล้ว |
| `org.profile.error` | เปิดข้อมูลร้านไม่สำเร็จ |
| `org.tax.section_title` | ข้อมูลผู้เสียภาษี |
| `org.tax.entity.label` | ประเภทผู้เสียภาษี |
| `org.tax.entity.personal` | บุคคลธรรมดา |
| `org.tax.entity.company` | นิติบุคคล |
| `org.tax.entity.personal.helper` | สำหรับบุคคลธรรมดา เลข 13 หลักนี้คือเลขบัตรประชาชนของเจ้าของกิจการ — ระบบเปิดให้เห็นเฉพาะผู้ที่ดูแลข้อมูลร้าน |
| `org.tax.id.label` | เลขประจำตัวผู้เสียภาษี (13 หลัก) |
| `org.tax.id.reveal` | แสดงเลขเต็ม |
| `org.tax.id.hide` | ซ่อนเลข |
| `org.tax.id.reveal.loading` *(ใหม่)* | กำลังขอเลข... |
| `org.tax.id.reveal.audit_note` *(ใหม่)* | การกดดูเลขเต็มถูกบันทึกไว้เพื่อความปลอดภัยของร้าน |
| `org.tax.vat.label` | จดทะเบียน VAT |
| `org.tax.vat.yes` | จดทะเบียน VAT |
| `org.tax.vat.no` | ไม่ได้จดทะเบียน |
| `org.tax.branch.label` | รหัสสาขา (ถ้ามี) |
| `org.tax.branch.helper` | เว้นว่าง = สำนักงานใหญ่ (00000) |
| `org.tax.privacy_note` | ข้อมูลนี้เปิดให้เห็นเฉพาะผู้ที่ดูแลข้อมูลร้าน |
| `org.tax.not_declared.manage` | ยังไม่ได้ประกาศข้อมูลผู้เสียภาษี — ตอนนี้ร้านนี้ยังออกใบกำกับภาษีไม่ได้ |
| `org.tax.not_declared.cta` | กรอกข้อมูลผู้เสียภาษี |
| `org.tax.not_declared.readonly` | ร้านนี้ยังไม่ได้ประกาศข้อมูลผู้เสียภาษี |
| `org.tax.declared.readonly.vat` | ร้านนี้ประกาศข้อมูลผู้เสียภาษีแล้ว · จดทะเบียน VAT |
| `org.tax.declared.readonly.novat` | ร้านนี้ประกาศข้อมูลผู้เสียภาษีแล้ว · ไม่ได้จดทะเบียน VAT |
| `org.tax.declared.readonly.hint` | รายละเอียดเปิดให้เฉพาะผู้ที่ดูแลข้อมูลร้าน |
| `org.tax.replace_confirm.title` | เปลี่ยนข้อมูลผู้เสียภาษีของร้านนี้? |
| `org.tax.replace_confirm.body` | ร้าน 1 ร้านมีข้อมูลผู้เสียภาษีได้ชุดเดียว ข้อมูลใหม่จะแทนที่ของเดิม |
| `org.tax.replace_confirm.confirm` | บันทึกทับ |
| `org.tax.error.tax_id_invalid` | เลขผู้เสียภาษีไม่ถูกต้อง — ต้องเป็นตัวเลข 13 หลัก และตรวจสอบเลขหลักสุดท้ายอีกครั้ง |
| `org.tax.error.branch_invalid` | รหัสสาขาต้องเป็นตัวเลข 5 หลัก |
| `org.tax.error.generic` | บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง |
| `org.tax.error.reveal_rate_limited` *(ใหม่)* | ขอดูเลขเต็มบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่ · เหลือ {mm}:{ss} |
| `org.tax.error.reveal_rate_limited.hint` *(ใหม่)* | ระหว่างนี้ยังแก้ไขข้อมูลอื่นของร้านได้ตามปกติ |
| `org.tax.error.reveal_generic` *(ใหม่)* | ขอดูเลขเต็มไม่สำเร็จ กรุณาลองใหม่อีกครั้ง |
| `org.tax.edit.reveal_blocked_note` *(ใหม่)* | ตอนนี้ระบบยังไม่ให้ดูเลขเดิม — ถ้าต้องการบันทึกข้อมูลชุดนี้ ให้พิมพ์เลขผู้เสียภาษี 13 หลักใหม่อีกครั้ง |
| `org.tax.success_toast` | บันทึกข้อมูลผู้เสียภาษีแล้ว — ร้านนี้ออกใบกำกับภาษีได้แล้ว |

### 3.4 สมาชิก + คำเชิญ (`org.members.*`, `org.invite.*`)

| Key | ข้อความไทย |
|---|---|
| `org.members.title` | สมาชิก |
| `org.members.invite_cta` | เชิญสมาชิก *(ไอคอน plus ใส่โดย component — ห้ามฝัง "+" ใน string, §2.7)* |
| `org.members.pending_section` | คำเชิญที่รอตอบรับ ({n}) |
| `org.members.list_section` | สมาชิกในร้าน ({n}) |
| `org.members.status.active` | ใช้งานอยู่ |
| `org.members.status.revoked` | ถูกถอดแล้ว |
| `org.members.show_revoked` | แสดงสมาชิกที่ถูกถอดออกแล้ว |
| `org.members.hide_revoked` | ซ่อนสมาชิกที่ถูกถอดออกแล้ว |
| `org.members.menu.change_role` | เปลี่ยนสิทธิ์ |
| `org.members.menu.remove` | ถอดออกจากร้าน |
| `org.members.menu.leave` | ออกจากร้านนี้ |
| `org.members.menu.owner_locked` | เฉพาะเจ้าของร้านเท่านั้นที่แก้สิทธิ์ของเจ้าของร้านคนอื่นได้ |
| `org.members.empty.solo` | ตอนนี้มีคุณอยู่คนเดียวในร้านนี้ — ชวนทีมงานเข้ามาช่วยกันได้เลย |
| `org.members.error.members` | โหลดรายชื่อสมาชิกไม่สำเร็จ |
| `org.members.error.invitations` | โหลดคำเชิญไม่สำเร็จ |
| `org.members.forbidden.title` | หน้านี้เปิดให้เฉพาะผู้ที่ดูแลทีมงาน |
| `org.members.forbidden.body` | ถ้าคุณต้องใช้หน้านี้ ให้เจ้าของร้านเปิดสิทธิ์ให้คุณ |
| `org.members.forbidden.cta` | กลับหน้าแรกของร้าน |
| `org.members.role.title` | เปลี่ยนสิทธิ์ของ {email} |
| `org.members.role.current` | (สิทธิ์ปัจจุบัน) |
| `org.members.role.owner_warning` | ร้านนี้ต้องมีเจ้าของอย่างน้อย 1 คนเสมอ |
| `org.members.role.submit` | บันทึกสิทธิ์ |
| `org.members.role.success_toast` | เปลี่ยนสิทธิ์ของ {email} เป็น {role} แล้ว |
| `org.members.error.last_owner` | ร้านนี้ต้องมีเจ้าของอย่างน้อย 1 คน — ตั้งคนอื่นเป็นเจ้าของร้านก่อน แล้วค่อยเปลี่ยนสิทธิ์นี้ |
| `org.members.error.role_invalid` | สิทธิ์ที่เลือกใช้ไม่ได้แล้ว กรุณาเลือกใหม่อีกครั้ง |
| `org.members.error.not_member` | คนนี้ไม่ได้เป็นสมาชิกของร้านนี้แล้ว |
| `org.members.remove.title` | ถอด {email} ออกจากร้าน? |
| `org.members.remove.body1` | เขาจะเข้าถึงข้อมูลของร้านนี้ไม่ได้ทันที |
| `org.members.remove.body2` | ประวัติการทำรายการที่เขาเคยทำไว้ยังอยู่ครบ |
| `org.members.remove.body3` | ถ้ามีคำเชิญของอีเมลนี้ค้างอยู่ ระบบจะยกเลิกให้ด้วย |
| `org.members.remove.body4` | ให้กลับเข้ามาใหม่ได้ด้วยการเชิญใหม่เท่านั้น |
| `org.members.remove.confirm` | ถอดออกจากร้าน |
| `org.members.remove.success_toast` | ถอด {email} ออกจากร้านแล้ว |
| `org.members.remove.success_toast.with_invites` | ถอด {email} ออกจากร้านแล้ว · ยกเลิกคำเชิญที่ค้างอยู่ {n} ใบด้วย |
| `org.members.remove.owner_only` | เฉพาะเจ้าของร้านเท่านั้นที่ถอดเจ้าของร้านคนอื่นได้ |
| `org.members.leave.title` | ออกจากร้าน "{orgName}"? |
| `org.members.leave.body` | คุณจะเข้าถึงข้อมูลของร้านนี้ไม่ได้อีก จนกว่าจะมีคนเชิญคุณกลับเข้ามาใหม่ · ร้านอื่นของคุณไม่ได้รับผลกระทบ |
| `org.members.leave.confirm` | ออกจากร้านนี้ |
| `org.members.leave.success_toast` | คุณออกจากร้าน "{orgName}" แล้ว |
| `org.members.leave.last_owner` *(ใหม่ · D-029)* | คุณเป็นเจ้าของร้านคนเดียวของร้านนี้ — ตั้งคนอื่นเป็นเจ้าของร้านก่อน แล้วจึงออกจากร้านนี้ได้ |
| `org.members.leave.last_owner.cta` *(ใหม่)* | ไปหน้าสมาชิก |
| `org.members.solo_owner.banner` *(ใหม่ · D-030)* | ตอนนี้ร้านนี้มีเจ้าของร้านคนเดียวคือคุณ — ถ้าวันหนึ่งคุณเข้าระบบไม่ได้ จะไม่มีใครในร้านช่วยตั้งรหัสผ่านใหม่ให้ได้ แนะนำให้ตั้งคนที่คุณไว้ใจอีก 1 คนเป็นเจ้าของร้านไว้ |
| `org.members.solo_owner.cta` *(ใหม่)* | เชิญเจ้าของร้านอีกคน |
| `org.members.solo_owner.dismiss` *(ใหม่)* | ไว้ทีหลัง |
| `org.invite.title` | เชิญสมาชิก |
| `org.invite.email.label` | อีเมลของคนที่จะเชิญ |
| `org.invite.email.placeholder` | เช่น malee@shop.com |
| `org.invite.role.label` | ให้สิทธิ์เป็น |
| `org.invite.role.owner_disabled` | เฉพาะเจ้าของร้านเท่านั้นที่ตั้งเจ้าของร้านคนใหม่ได้ |
| `org.invite.ttl_hint` | สิทธิ์ระดับนี้ ลิงก์คำเชิญจะมีอายุสั้นกว่าปกติเพื่อความปลอดภัย |
| `org.invite.no_email_hint` | ระบบยังไม่ส่งอีเมลให้อัตโนมัติ — คุณจะได้ลิงก์ไว้ส่งเองทางแชต (เช่น LINE) |
| `org.invite.submit` | สร้างลิงก์คำเชิญ |
| `org.invite.submit.loading` | กำลังสร้างลิงก์... |
| `org.invite.error.email_invalid` | รูปแบบอีเมลไม่ถูกต้อง |
| `org.invite.error.already_member` | อีเมลนี้เป็นสมาชิกของร้านอยู่แล้ว |
| `org.invite.error.already_member.link` | ดูในรายชื่อสมาชิก |
| `org.invite.pending.title` | อีเมลนี้มีคำเชิญค้างอยู่แล้ว |
| `org.invite.pending.body` | คำเชิญเดิม: สิทธิ์ {role} · ลิงก์ใช้ได้ถึง {datetime} |
| `org.invite.pending.reissue` | ออกลิงก์ใหม่ |
| `org.invite.pending.cancel` | ยกเลิกคำเชิญเดิม |
| `org.invite.pending.back` | กลับไปแก้อีเมล |
| `org.invite.error.limit_reached` | มีคำเชิญที่รอตอบรับค้างอยู่มากเกินไป — ยกเลิกคำเชิญที่ไม่ใช้แล้วก่อน จึงจะเชิญคนใหม่ได้ |
| `org.invite.error.forbidden_role` | คุณไม่มีสิทธิ์เชิญสมาชิกด้วยสิทธิ์ระดับนี้ — เฉพาะเจ้าของร้านเท่านั้นที่ตั้งเจ้าของร้านคนใหม่ได้ |
| `org.invite.error.generic` | สร้างคำเชิญไม่สำเร็จ กรุณาลองใหม่อีกครั้ง |
| `org.invite.link.title` | ลิงก์คำเชิญพร้อมแล้ว |
| `org.invite.link.desc` | ส่งลิงก์นี้ให้ {email} ทางแชต (เช่น LINE) — ระบบไม่ได้ส่งอีเมลให้อัตโนมัติ |
| `org.invite.link.copy` | คัดลอกลิงก์ |
| `org.invite.link.copied` | คัดลอกแล้ว |
| `org.invite.link.copied_toast` | คัดลอกลิงก์แล้ว |
| `org.invite.link.copy_failed` | คัดลอกอัตโนมัติไม่สำเร็จ — กดค้างที่ลิงก์เพื่อคัดลอกเอง |
| `org.invite.link.once_warning` | ลิงก์นี้แสดงครั้งเดียว — ปิดหน้านี้แล้วเปิดดูซ้ำไม่ได้ ถ้าทำลิงก์หาย กด "ออกลิงก์ใหม่" ที่รายการคำเชิญ |
| `org.invite.link.done` | เสร็จแล้ว |
| ~~`org.invite.link.close_guard.*`~~ | **ยกเลิก 4 key (user เคาะ 2026-07-28)** — ไม่มี dialog กันปิดก่อนคัดลอกแล้ว เหลือแถบเตือน `once_warning` เป็นด่านเดียว |
| `org.invite.reissue.title` | ออกลิงก์ใหม่? |
| `org.invite.reissue.body1` | ลิงก์เดิมที่ส่งไปแล้วจะใช้ไม่ได้ทันที ถ้าคุณส่งลิงก์เดิมให้ใครไว้ ต้องส่งลิงก์ใหม่ให้เขาแทน |
| `org.invite.reissue.body2` | อีเมลและสิทธิ์ของคำเชิญไม่เปลี่ยน ({email} · {role}) |
| `org.invite.reissue.confirm` | ออกลิงก์ใหม่ |
| `org.invite.reissue.success_toast` | ออกลิงก์ใหม่แล้ว ลิงก์เดิมใช้ไม่ได้แล้ว |
| `org.invite.cancel.title` | ยกเลิกคำเชิญนี้? |
| `org.invite.cancel.body` | ลิงก์ที่ส่งไปแล้วจะใช้ไม่ได้ทันที ({email} · {role}) |
| `org.invite.cancel.keep` | ไม่ยกเลิก |
| `org.invite.cancel.confirm` | ยกเลิกคำเชิญ |
| `org.invite.cancel.success_toast` | ยกเลิกคำเชิญแล้ว |
| `org.invite.error.not_pending` | คำเชิญนี้ไม่ได้รออยู่แล้ว (อาจถูกรับหรือยกเลิกไปแล้ว) |
| `org.invite.status.pending` | รอตอบรับ |
| `org.invite.status.expired` | หมดอายุแล้ว |
| `org.invite.status.cancelled` | ยกเลิกแล้ว |
| `org.invite.status.accepted` | รับแล้วเมื่อ {datetime} |
| `org.invite.show_history` | ดูคำเชิญที่หมดอายุ/ยกเลิกแล้ว |
| `org.invite.reinvite` | เชิญใหม่อีกครั้ง |
| `org.invite.accepted_flag` | บัญชีที่กดรับถูกสร้างขึ้นหลังจากออกลิงก์ ตรวจสอบว่าเป็นคนที่คุณตั้งใจเชิญ |

### 3.5 รับคำเชิญ (`org.accept.*`) + 403 (`org.denied.*`) + S13 (`org.reset.*`)

| Key | ข้อความไทย |
|---|---|
| `org.accept.title` | คำเชิญเข้าร่วมร้าน |
| `org.accept.headline` | {orgName} ชวนคุณเข้าร่วมเป็น "{role}" |
| `org.accept.for_email` | คำเชิญนี้ออกให้ {emailMasked} |
| `org.accept.login_cta` | เข้าสู่ระบบเพื่อรับคำเชิญ |
| `org.accept.signup_cta` | สมัครบัญชีใหม่ |
| `org.accept.same_email_note` | ใช้อีเมลเดียวกับที่ถูกเชิญเท่านั้น |
| `org.accept.join_cta` | เข้าร่วมร้านนี้ |
| `org.accept.join_cta.loading` | กำลังเข้าร่วม... |
| `org.accept.current_account` | คุณกำลังใช้บัญชี {email} |
| `org.accept.switch_account` | ใช้บัญชีอื่น |
| `org.accept.mismatch.title` | บัญชีไม่ตรงกับคำเชิญ |
| `org.accept.mismatch.body` | คำเชิญนี้ออกให้ {emailMasked} · ตอนนี้คุณเข้าสู่ระบบด้วย {email} — กรุณาเข้าสู่ระบบด้วยบัญชีที่ถูกเชิญ |
| `org.accept.mismatch.cta` | ออกจากระบบแล้วเข้าด้วยบัญชีนั้น |
| `org.accept.invalid.title` | ลิงก์คำเชิญนี้ใช้ไม่ได้ |
| `org.accept.invalid.body` | ลิงก์อาจถูกคัดลอกมาไม่ครบ หรือถูกยกเลิกไปแล้ว — ขอลิงก์ใหม่จากเจ้าของร้าน |
| `org.accept.expired.title` | ลิงก์คำเชิญหมดอายุแล้ว |
| `org.accept.expired.body` | ขอให้เจ้าของร้านกด "ออกลิงก์ใหม่" แล้วส่งลิงก์ใหม่ให้คุณ |
| `org.accept.cancelled.title` | คำเชิญนี้ถูกยกเลิกแล้ว |
| `org.accept.cancelled.body` | ติดต่อเจ้าของร้านถ้าคุณยังต้องการเข้าร่วม |
| `org.accept.used.title` | คำเชิญนี้ถูกใช้ไปแล้ว |
| `org.accept.used.body` | ถ้าคุณเป็นคนกดรับเอง ให้เข้าสู่ระบบแล้วเลือกร้านนี้ได้เลย |
| `org.accept.already_member.title` | คุณเป็นสมาชิกของร้านนี้อยู่แล้ว |
| `org.accept.already_member.body` | เข้าใช้งานได้เลย — สิทธิ์เดิมของคุณไม่ถูกเปลี่ยน |
| `org.accept.already_member.cta` | เข้าใช้งานร้านนี้ |
| `org.accept.superseded.title` | คำเชิญนี้ใช้ไม่ได้แล้ว |
| `org.accept.superseded.body` | คำเชิญนี้ถูกออกก่อนที่คุณจะถูกถอดออกจากร้าน — ขอคำเชิญใหม่จากเจ้าของร้าน |
| `org.accept.role_unavailable.body` | สิทธิ์ที่ระบุในคำเชิญถูกเปลี่ยนไปแล้ว — ขอลิงก์ใหม่จากเจ้าของร้าน |
| `org.accept.error.generic` | เปิดคำเชิญไม่สำเร็จ |
| `org.accept.success.title` | เข้าร่วม "{orgName}" เรียบร้อย |
| `org.accept.success.role` | สิทธิ์ของคุณ: {role} |
| `org.accept.success.cta` | เริ่มใช้งานร้านนี้ |
| `org.accept.success.app_hint` | ถ้าคุณใช้แอปบนมือถือ เปิดแอปแล้วสลับมาที่ร้านนี้ได้เลย |
| `org.denied.banner` | (= `org.select.revoked_banner`) |
| `org.reset.blocked_note` *(ใหม่ — แทน `org.reset.multi_org_note` ที่ยกเลิก)* | บางบัญชีระบบจะไม่ให้คุณตั้งรหัสผ่านใหม่ให้ เพื่อความปลอดภัยของเจ้าของบัญชี — ถ้าเจอกรณีนั้น ต้องให้เจ้าตัวติดต่อทีมงาน OmniStock เอง |
| `org.reset.failed` *(ข้อความใหม่)* | ตั้งรหัสผ่านใหม่ให้บัญชีนี้ไม่ได้ เพื่อความปลอดภัยของเจ้าของบัญชี — ให้เจ้าตัวติดต่อทีมงาน OmniStock เพื่อขอความช่วยเหลือ |
| `org.reset.owner_self_help` *(ใหม่ · D-030)* | ถ้าคุณเป็นเจ้าของร้านและลืมรหัสผ่านของตัวเอง เวอร์ชันนี้ยังไม่มีการตั้งรหัสใหม่เองทางอีเมล — ติดต่อทีมงาน OmniStock เพื่อขอความช่วยเหลือ |

> **⛔ กติกาผูกกับ 3 key ด้านบน (D-028/C-2 + D-030/NEW-1 — ห้าม frontend แตกเป็นหลายข้อความ):**
> เคสที่ระบบปฏิเสธมี **2 เหตุ** (target สังกัดหลายร้าน · target เป็นเจ้าของร้านแต่ผู้กดไม่ใช่) แต่ server คืน
> **`404` รูปเดียวกัน** โดยเจตนา ⇒ **ห้าม** map เป็นข้อความต่างกัน ห้ามเดาเหตุจากข้อมูลอื่นที่ client มี
> (เช่น `roleKey` ของ target) และ **`org.reset.blocked_note` ต้องไม่อ้างถึงตัว target** —
> ถ้อยคำที่ผูกกับคนใดคนหนึ่ง = คำใบ้ว่าเงื่อนไขไหนตรง (oracle) · เหตุผลเต็ม → wireframe §12.3

> **Throttle (429):** reuse `auth.throttle.*` ของ F-001 ไม่สร้าง key ใหม่ ยกเว้นบรรทัดนำที่ต่างบริบท —
> `org.throttle.create_org` = "สร้างร้านถี่เกินไป กรุณารอสักครู่แล้วลองใหม่" · `org.throttle.invite` = "เชิญสมาชิกถี่เกินไป กรุณารอสักครู่แล้วลองใหม่" ·
> `org.throttle.invite_preview` = "เปิดลิงก์คำเชิญถี่เกินไป กรุณารอสักครู่แล้วลองใหม่" (countdown ใช้ component เดิม)

---

## 4. 4 states ต่อจอ (DS §2 — บังคับ)

| จอ | loading (skeleton) | empty | error | data/success |
|---|---|---|---|---|
| S1 เลือกร้าน | 3 แถว `ListRow` | `EmptyState` + ปุ่มสร้างร้าน | `Banner` danger + ลองใหม่ | รายการร้าน |
| S2 สร้างร้าน | — (ฟอร์มล้วน) | — | inline + `Banner` | toast + เข้าร้านใหม่ |
| S3 shell/switcher | โครง shell + skeleton ชื่อร้าน | — | error ในกล่อง switcher เท่านั้น | ชื่อร้าน + เมนู |
| S4 ข้อมูลร้าน | skeleton 2–3 `SectionCard` · **ปุ่ม "แสดงเลขเต็ม" = loading ในตัวปุ่ม** | — | เต็มพื้นที่ + ลองใหม่ · **reveal พลาด = `ThrottleBanner`/helper ในการ์ดภาษีเท่านั้น ไม่พังทั้งจอ** | การ์ดข้อมูล (+ลิงก์ "ออกจากร้านนี้" ท้ายจอ) |
| S5 ฟอร์มภาษี | โหลดค่าเดิม (reveal) = skeleton ฟิลด์ | — | inline field + `Banner` · **ขอเลขเดิมไม่ได้ → ฟิลด์ว่าง + helper (ฟอร์มยังใช้ได้)** | toast + กลับ S4 |
| S6 สมาชิก | 1 แถวคำเชิญ + 3 แถวสมาชิก | ซ่อนส่วนคำเชิญ · `EmptyState` เล็กเมื่อมีคนเดียว | error **แยกต่อส่วน** + ลองใหม่ | 2 ส่วน (+`Banner` info เจ้าของร้านคนเดียว เมื่อโหลดรายชื่อครบ) |
| S7 เชิญ | — | — | inline / แผงทางเลือก (409 pending) | → S8 |
| S8 ลิงก์ | — (เปิดเมื่อมีข้อมูลแล้ว) | — | copy ล้มเหลว → helper | ลิงก์ + วันหมดอายุ |
| S9/S10 | ปุ่ม loading | — | `Banner` ในกล่อง | toast + refetch |
| S11 `/invite` | skeleton การ์ด | — | `EmptyState` ต่อ error code (§11.4 ของ wireframe) | การ์ดสำเร็จ + CTA |

---

## 5. Responsive & platform (ต่างจาก DS §8 ตรงไหน)

| ประเด็น | Web | Mobile (Flutter) |
|---|---|---|
| breakpoint | desktop-first (lg 1024) → tablet (md 768) ตาม DS §8 | จอเดียว |
| **`/invite`** | **ข้อยกเว้นเดียวของ DS §8** — ต้องใช้ได้ดีบนเบราว์เซอร์มือถือ: การ์ดเดียว 1 คอลัมน์, ปุ่มเต็มความกว้าง, ไม่มี layout 2 คอลัมน์, แตะได้ ≥44px | ไม่มีจอนี้ (F-006 deep link) |
| AppShell | sidebar `size.sidebar.w` ถาวร (≥lg) → drawer (md) | AppBar 56px (DS §7) + ชื่อร้าน + `▾` |
| dialog | กว้างสุด `size.dialog.max-w` (480px) กึ่งกลาง + `elevation.dialog` | full-screen + AppBar back (ฟอร์ม) · `confirm_dialog.dart` เดิม (ยืนยัน) · `showModalBottomSheet` (ตัวสลับร้าน / เมนูแถว) |
| list | `SectionCard` + `ListRow` (ยังไม่ใช้ `DataTable` — จำนวนแถวเล็ก, DataTable = F-010) | `ListView` + `ListRow` widget เดียวกันเชิง visual |
| เมนูแถว | ปุ่ม `⋯` → dropdown | แตะแถว → bottom sheet |
| toast | มุมบนขวา | ล่างจอ เหนือ safe-area |
| dark mode | ทุกจอต้องผ่านทั้ง light + dark (DS §1.1b) — ตรวจใน mockup | เท่ากัน |

---

## 6. Accessibility (สรุปเชิง visual — รายละเอียด flow อยู่ที่ wireframe §14)

- ทุกคู่สีที่ใช้ผ่าน WCAG AA ตาม DS §1.1/§1.1c · คู่สีใหม่ใน F-002 = `color.info.*` (= ค่าเดิมของ `surface.muted`/`border.default`/`text` ⇒ ผ่านอยู่แล้ว) และขอบปุ่มใน `Banner` (`currentColor` 65% — ตรวจแล้ว ≥3:1 ทั้ง 2 ธีม)
- `Badge` **ต้องมีข้อความ** — ห้ามใช้จุดสี/แถบสีสื่อสถานะเดี่ยว ๆ · **ไอคอนก็ห้ามสื่อความหมายเดี่ยว ๆ** (§2.7)
- focus ring ตาม §2.7 (`focus.ring.*`, `:focus-visible` เท่านั้น, offset 2px)
- **ทุกองค์ประกอบที่กดได้สูง ≥ `size.tap-target.min` (44px) ทุก platform** รวม `Button size="sm"` และ `variant="tertiary"` (§2.5) — **ไม่มีข้อยกเว้น pointer-only**
- `CopyField` โฟกัสและเลือกข้อความได้ (ไม่ใช่ div ที่เลือกไม่ได้) · ปุ่มไอคอนมี aria-label ไทย
- `ConfirmDialog` (ทุกจุดใน F-002) focus trap + Escape = ยกเลิก + `focusCancel` ตาม §2.4
- ฟิลด์เลขผู้เสียภาษี: `inputmode=numeric`, ไม่ autofill, mask เป็นค่าตั้งต้นบนหน้าจอดู

---

## 7. Sync-back → `docs/design-system.md` (ux เป็นคนเติมหลัง sign-off)

> ## ✅ SYNCED แล้ว — 2026-07-31 (ux · T-002-X1 + T-002-X2)
> ข้อ 1–12 ด้านล่าง **ลงไฟล์กลาง `docs/design-system.md` ครบแล้ว** (additive ล้วน — ไม่แตะ token เดิมของ D-026) ·
> **แหล่งความจริงตั้งแต่นี้ไป = `docs/design-system.md`** ส่วน §7 นี้เก็บไว้เป็นบันทึกที่มา/เหตุผลของ diff เท่านั้น
> — ถ้าค่าสองที่ไม่ตรงกัน ให้ยึด design-system.md
>
> | diff ข้อ | ลงที่ section ไหนใน design-system.md |
> |---|---|
> | 1 (`color.info.*`, `color.badge.neutral.*`) | §1.1 + §1.1b (+ หมายเหตุเจตนา "info = กลาง ไม่ใช่สีสถานะ") |
> | 2 (`type.button.sm`) | §1.2 |
> | 3 (size/icon/focus token + กติกา tap-target) | §1.3 (+ กล่องกติกา 44px ไม่มีข้อยกเว้น) |
> | 4 (focus ring · ปุ่มใน Banner · Button variant) | §1.1c-1 / §1.1c-2 / §1.1c-3 (ใหม่) |
> | 5 (Iconography) | **§1.6 (หัวข้อใหม่)** — ชุดไอคอน = **Phosphor** ตาม D-031 (ไม่ค้างรอ user แล้ว) + §1.6.2 ตาราง `icon.<role>` → ชื่อจริง web/Flutter 21 role |
> | 6 (กฎเชิงโครงสร้าง: portal/theme + `.hidden`) | **§1.0 (หัวข้อใหม่ ก่อนตาราง token)** |
> | 7 (error/loading แยกต่อส่วน) | §2 |
> | 8 (Component library + นิยาม "ประกาศแล้ว") | **§9 (หัวข้อใหม่)** + §6.1 |
> | 9 (mobile root = org switcher) | §7 |
> | 10 (`/invite` + เช็คลิสต์ก่อน sign-off) | §8.3 + §8.4 |
> | 11 (Claude Design push เฉพาะของกลาง) | §9.2 (ท้ายหัวข้อ) |
> | 12 (tertiary hover / `Link` / แถวปุ่ม + หมายเหตุ `color.primary` vs `btn.bg`) | §1.1c-3 + หมายเหตุท้าย §1.1c |

> ไฟล์ design-system.md เป็นของกลาง — diff ที่เสนอ (บันทึกไว้เป็นที่มา · ลงไฟล์กลางแล้ว)
> **⚠️ รอบแก้ 2026-07-28:** รอบแรกประกาศไม่ครบ — mockup สร้าง `btn-sm` · `tlink` · `banner.info` · `focusring`
> ขึ้นมาใช้เองโดยไม่มีใครเป็นเจ้าของค่า (ขัด DS §6 ที่ ux เป็นเจ้าของกฎเอง) · ข้อ 2–6 ด้านล่างคือของที่หายไป

1. **§1.1 / §1.1b เพิ่ม role สี**
   - **badge (เดิม):** light `color.badge.neutral.bg` `#E7EFEC` (= `surface.muted`) · `.text` `#566B65` (= `text.muted`) — dark `#2A2D2C` / `#98A29D`
   - **info (ใหม่ — ของที่หายไป):** `Banner` ถูกประกาศไว้ว่ามี 4 tone ตั้งแต่ §2.1 แต่ **`info` ไม่เคยมี token** ⇒ mockup เดาค่าเอง
     - light: `color.info.bg` `#E7EFEC` · `color.info.border` `#CFDCD7` · `color.info.text` `#112320`
     - dark: `color.info.bg` `#2A2D2C` · `color.info.border` `#363A38` · `color.info.text` `#E9EEEB`
     - **เจตนา: info = "กลาง/ให้ข้อมูล" ไม่ใช่สีสถานะ** (ค่าเท่ากับ `surface.muted`/`border.default`/`text` แต่ **ตั้งเป็น role แยก** เพื่อให้เปลี่ยนทีหลังได้โดยไม่ลาก `surface.muted` ทั้งระบบไปด้วย)
     - *ทางเลือกที่พิจารณาแล้วไม่เอา:* เพิ่มสีฟ้าเป็น info เหมือน UI kit ทั่วไป — ฟ้าจะแข่งกับ teal ที่เป็นสีแบรนด์ และ palette Calm Teal ไม่มีฟ้าอยู่เลย
   - **ไม่ใช่ breaking** (เพิ่ม role ใหม่ ไม่แก้/ไม่ลบของเดิม) ⇒ ไม่ต้อง log D-XXX
2. **§1.2 เพิ่ม 1 type token:** `type.button.sm` = **14 / 20 / 600** (ตัวอักษรบนปุ่ม `size="sm"` — ของที่ `btn-sm` ใช้อยู่โดยไม่ประกาศ)
3. **§1.3 เพิ่ม size token**
   - `size.sidebar.w` = `240px` (AppShell sidebar, web ≥lg)
   - `size.dialog.max-w` = `480px` (dialog/การ์ดกึ่งกลางทั่วไป — คนละตัวกับ `size.auth-card.max-w` 400px)
   - `size.list-row.min-h` = `56px` (แถวรายการ/แถวเมนู ทั้ง web + mobile)
   - **`size.icon.sm/md/lg/xl`** = `16/20/24/40px` · **`icon.stroke`** = `2` (ที่ `xl` ลดเป็น `1.5`)
   - **`focus.ring.w`** = `2.5px` · **`focus.ring.offset`** = `2px` · **`focus.ring.color`** = `color.primary`
   - **+ กติกาข้างตาราง (สำคัญกว่าตัวเลข):** `size.tap-target.min` (44px) เป็น **ขั้นต่ำของทุกองค์ประกอบที่กดได้ ทุก platform ไม่มีข้อยกเว้น** —
     ปุ่ม "เล็ก" หมายถึงตัวอักษร/ระยะข้างแน่นขึ้น **ไม่ใช่เตี้ยลง** (เหตุผลเต็ม §2.5)
4. **§1.1c เพิ่ม 3 กติกา interaction ที่ DS ยังไม่เคยมี**
   - **focus ring:** หนา/offset/`:focus-visible` เท่านั้น + **ห้ามใช้ ring แทน "ปุ่มเด่น" / ห้ามโชว์ค้าง** (ตาราง §2.7) · Flutter ใช้ keyboard-traversal focus ให้ตรงกับ `:focus-visible`
   - **ปุ่มใน `Banner` ใช้โทนของกล่องนั้น:** ตัวอักษร `currentColor` · ขอบ `color-mix(in srgb, currentColor 65%, transparent)` · ห้ามปุ่ม fill ในกล่อง danger/warning/success · info ใช้ `primary` ได้ 1 ปุ่มถ้าเป็น CTA หลัก (ตาราง §2.6)
   - **`Button` เพิ่ม `variant="tertiary"` + `size="sm"` + `state="confirmed"`** — additive, ไม่แตะ variant เดิม (ตาราง §2.5) · `tertiary` แยกจาก `Link` ในเนื้อความ (ลิงก์ในย่อหน้าขีดเส้นใต้ตลอด)
5. **เพิ่ม §1.6 "Iconography" (ใหม่ทั้งหัวข้อ — DS ไม่เคยมีนโยบายไอคอน)** = ตารางใน §2.7 ทั้งหมด
   (outline เท่านั้น · grid 24 / stroke 2 · ขนาด 4 ระดับ · `currentColor` · ห้าม emoji/รูป · ห้ามฝังสัญลักษณ์ใน i18n string · ไอคอนต้องมีข้อความคู่)
   **✅ เคาะแล้ว (D-031 ข้อ 1) = ตัวเลือก C · Phosphor (MIT)** — ตาราง `icon.<role>` → ชื่อไอคอนจริงทั้ง web
   (`@phosphor-icons/react`) และ Flutter (`phosphor_flutter`) อยู่ที่ **design-system.md §1.6.2** ·
   ตารางตัวเลือกด้านล่างเก็บไว้เป็นบันทึกเหตุผลเท่านั้น:

   | ตัวเลือก | license | web | Flutter | ทำไมเลือก / ทำไมไม่ |
   |---|---|---|---|---|
   | **A · Lucide** | ISC | `lucide-react` (มาตรฐานของ shadcn/ui ที่ web เราใช้อยู่ — D-020) | `lucide_icons_flutter` (**community** ไม่ใช่ทีมเดียวกับต้นทาง) | ✅ ฝั่ง web ไร้แรงเสียดทานที่สุด · ⚠️ ฝั่ง Flutter พึ่ง package ที่คนอื่นดูแล — ถ้าเขาหยุด maintain เราจะ drift web↔mobile ซึ่งเป็นสิ่งที่ DS §1 ห้ามไว้ |
   | **B · Material Symbols (Outlined)** | Apache-2.0 | `@material-symbols/*` หรือ SVG ตรง | `material_symbols_icons` + Flutter มี `Icons.*` ในตัวอยู่แล้ว | ✅ ปลอดภัยที่สุดระยะยาว (Google ดูแลทั้ง 2 ฝั่ง) + ครอบคลุมมากสุด + มีแกน fill ให้ทำ "แท็บที่เลือกอยู่ = ทึบ" ฟรี · ⚠️ หน้าตา "เป็น Google" ไม่มีคาแรกเตอร์ และเรขาคณิตแข็งกว่าโทน friendly ของเรา |
   | **C · Phosphor (weight `regular`)** ⭐ *ผมเอนไปทางนี้* | MIT | `@phosphor-icons/react` | `phosphor_flutter` — **ทีมเดียวกับต้นทางดูแลเอง** | ✅ ชุดเดียวที่ "เจ้าของเดียวกันทั้ง web + Flutter" ⇒ กันwebกับmobile drift ได้จริง · มุมโค้งนุ่ม เข้ากับโทน "เป็นมิตรกับแม่ค้า" ของ Calm Teal · 9,000+ ไอคอน · ⚠️ ทีม dev คุ้นน้อยกว่า Lucide และต้องเพิ่ม dependency ฝั่ง web (ไม่ได้มากับ shadcn) |

   > ทุกตัวเลือกมีไอคอนครบ 18 role ที่ F-002 ใช้ · mockup วาดเป็น "รูปกลาง" ที่ทั้ง 3 ชุดเหมือนกัน ⇒ เปลี่ยนชุดทีหลังได้โดยจอไม่เปลี่ยนความหมาย
   > · **สรุป: ใช้ Phosphor · frontend อ้าง `icon.<role>` ไม่ import ชื่อไอคอนของ vendor ตรง ๆ ในโค้ด feature**
6. **เพิ่มกติกาโครงสร้าง (เข้า §1 ก่อนตาราง token) — ที่มา: บั๊กจริงที่เจอตอนรีวิว mockup รอบนี้**
   - **theme token + base style (font / color / background) ต้องประกาศที่ `:root`/`body` เท่านั้น ห้ามผูกกับ container ของหน้า** —
     modal/toast/dropdown ที่ portal ออกไป `document.body` (Next.js `createPortal`, Radix Portal) หรือ Flutter `Overlay`
     **อยู่นอก subtree ของ container** ⇒ จะหลุด font/สี/ธีมทันที (ใน mockup ได้ Times + สีดำ + token ชุด dark บนหน้า light)
   - **สลับธีมด้วย `data-theme` ที่ `<html>`** ไม่ใช่ที่ wrapper · บล็อกที่ล็อกธีมเฉพาะจุดต้อง **substitute token ใหม่ที่ตัวมันเอง** (`color` สืบทอดเป็นค่า computed ไม่ใช่ค่า `var()`)
   - **utility ที่แปลว่า "ซ่อน" ต้องชนะเสมอ** — ถ้ากฎอื่นที่ specificity เท่ากันประกาศทีหลังจะทับได้เงียบ ๆ (บั๊ก `.hidden` vs `.modal` ในรอบนี้) · บน Tailwind = ระวังลำดับ layer, บน Flutter = ใช้เงื่อนไข build ไม่ใช่ opacity
7. **§2 (UI states) เพิ่มบรรทัด:** จอที่โหลดข้อมูลจาก **2 แหล่งบนหน้าเดียว** ต้องมี error/loading **แยกต่อส่วน** ไม่พังทั้งจอ
8. **เพิ่ม §9 "Component library (กลาง)"** — ลงทะเบียน component พร้อม feature ต้นทาง:
   F-001: `AuthForm`, `PasswordField`, `TextField`, `Button`, `ErrorBanner`, `ThrottleBanner`, `ConfirmDialog`, `Skeleton`, `Toast`, `AuthCard`, `SessionListItem`
   **F-002 (ใหม่):** `EmptyState` (+preset `ForbiddenPanel`), `Banner`(4 tone), `Badge`(4 variant), `SectionCard`, `CopyField`, `RadioCardGroup`, `ListRow`
   **F-002 (แก้ของเดิมแบบ additive):** `Button` (+`tertiary` / +`sm` / +`confirmed`) · `ConfirmDialog` (+`body` หลายบรรทัด / +`focusCancel`)
   > **กติกาที่ควรเขียนไว้ในหัวข้อนี้ด้วย:** ตารางนี้คือ **นิยามของคำว่า "ประกาศแล้ว"** — ถ้า mockup/โค้ดมี variant, ขนาด, สถานะ หรือค่าสีที่ไม่มีชื่อในไฟล์นี้ = **ยังไม่มีเจ้าของ** ⇒ ต้อง contribute-back ก่อน sign-off (บทเรียนรอบนี้)
9. **§7 (ScreenHeader/AppBar):** เพิ่มหมายเหตุว่า **จอ root ของ mobile ที่เป็น org-scoped ให้แสดงชื่อร้าน + ไอคอน chevron-down เป็น org switcher** (F-002 เป็นผู้ใช้รายแรก, F-006 เป็นผู้ implement shell)
10. **§8 (Responsive):** เพิ่มข้อยกเว้นที่ประกาศไว้ — **route สาธารณะที่ผู้ใช้เปิดจากลิงก์ในแชต (`/invite`) ต้องออกแบบให้ใช้ได้ดีบนเบราว์เซอร์มือถือ** (phone browser ยัง out-of-scope สำหรับ route ที่ต้องล็อกอิน)
    · **+ เพิ่มบรรทัดเช็คลิสต์ก่อน sign-off mockup:** ตรวจ desktop + tablet **+ นับ tap target ทุกตัวว่า ≥44px** (รอบแรกหลุด 27 จุด)
11. **Claude Design (`/design-sync` + `DesignSync`):** push เฉพาะ 7 component ใน §2.1 (ของกลาง) — **ไม่ push** `AppShell`/`OrgSwitcher`/`CopyLinkPanel`/`MemberRow` (เฉพาะ feature)
12. **[PM ถอดความจาก D-031 ตอน sign-off 2026-07-29 — ux ทวนตอน sync-back]** 3 กฎที่ user เคาะระหว่างรีวิว mockup รอบสุดท้าย · **แก้ใน mockup แล้ว แต่ยังไม่ได้เขียนเป็นกฎที่นี่** ⇒ ถ้าไม่เติม frontend จะทำกลับไปเป็นแบบเดิมตอน build:
    - **`Button variant="tertiary"` — hover ห้ามขีดเส้นใต้** ใช้พื้นหลัง `surface.muted` เป็น affordance แทน (ปุ่มไม่ใช่ลิงก์ จึงไม่ควรมีสัญญะของลิงก์) · focus ยังใช้ `:focus-visible` ring ตามปกติ
    - **`Link` ในเนื้อความ — แยกตัวด้วย `color.primary` ไม่ใช่เส้นใต้** (เดิมเป็น `currentColor` + เส้นใต้ ⇒ ถ้าเอาเส้นใต้ออกเฉย ๆ ลิงก์จะกลืนกับข้อความจนแยกไม่ออก) · ตรงกับ DS §1.1 ที่ระบุอยู่แล้วว่า `color.primary` = สีของลิงก์ · วัดแล้ว: ต่างจากข้อความรอบข้าง 2.22:1 · อ่านบนพื้นกล่อง 6.29:1 (ผ่าน AA)
    - **แถวปุ่ม (`.acts`) ห้ามใช้ negative margin ของ tertiary button** — margin ติดลบ (ที่มีไว้จัดขอบตัวอักษรเวลาปุ่มอยู่เดี่ยวในคอลัมน์) ไปกินระยะ `gap` จนปุ่มดูติดกัน (gap 10px − margin 8px = เหลือจริง **2px**) ⇒ ในแถวปุ่มให้ `margin:0` + `gap` 12px (`space.3`) · **แก้ที่รากแบบนี้ ไม่ใช่เพิ่ม gap ให้ใหญ่เกินจริง**
    > หมายเหตุ: `color.primary` (ลิงก์/ไอคอน/focus) กับ `btn.bg` (พื้นปุ่ม) **เป็นสีเดียวกันในธีมสว่าง (`#0C6155`) แต่ต้องต่างกันในธีมมืด** (`#2FBBA6` vs `#0A5A45`) — ตรวจแล้ว: บังคับให้เหมือนกันในธีมมืดจะได้ลิงก์ contrast 1.91:1 (อ่านไม่ออก) หรือปุ่มมิ้นต์พาสเทลที่ D-026 ปฏิเสธไว้ · **นี่เป็นเจตนาของ D-026 §1.1c ไม่ใช่ความไม่สอดคล้อง — อย่า "แก้" ให้เท่ากัน**

---

## 8. Mockup sign-off (D-026) — **ต้องมี**

**ทำไมต้องมี:** D-026 เคาะแค่ **foundation** (สี/typography/spacing/dark/ปุ่ม) — **component-level ยังไม่ล็อก** และ F-002
เป็นฟีเจอร์แรกที่สร้าง **chrome ของแอปทั้งใบ** (AppShell + org switcher) + pattern รายการ/การ์ด/ป้ายสถานะ ที่ทุก feature
หลังจากนี้จะลอกต่อ ⇒ ถ้าเห็นของจริงแล้วไม่ตรงหลัง build จะต้องรื้อทั้งระบบ ไม่ใช่รื้อจอเดียว (ปัญหาเดิมที่ D-026 ตั้งใจปิด)

**จอที่คุ้มทำ mockup ก่อน build (5 จอ — ไม่ต้องครบ 13 จอ):**

| ลำดับ | จอ | เหตุผลที่ต้องเห็นของจริงก่อน | state ที่ต้องมีใน mockup |
|---|---|---|---|
| 1 | **S3 AppShell + OrgSwitcher** | chrome ที่ทุก feature ใช้ต่อ · ตัดสิน sidebar/nav/สวิตช์ร้าน ครั้งเดียวใช้ยาว | desktop + tablet(drawer) · switcher เปิด/ปิด · light + dark |
| 2 | **S6 สมาชิก** | pattern รายการ + `Badge` + เมนูแถว + 2 ส่วนบนจอเดียว (ตัดสิน visual ของ list ทั้งระบบ) | data / loading skeleton / empty(คนเดียว) / error รายส่วน · **+ `Banner` info "เจ้าของร้านคนเดียว" (D-030) — ต้องเห็นว่าเป็นคำแนะนำ ไม่ใช่คำเตือนภัย** |
| 3 | **S8 แผ่นลิงก์ + ยืนยันออกลิงก์ใหม่** | จุดเสี่ยงสูงสุดของ D-027 — ต้องเห็นว่าคำเตือน "แสดงครั้งเดียว" เด่นพอจริงบนจอ (**แถบเตือนคือด่านเดียว** — user เคาะ 2026-07-28 ให้ตัด dialog กันปิดออก) | ปกติ / หลังกดคัดลอก / คัดลอกอัตโนมัติล้มเหลว / dialog ยืนยันออกลิงก์ใหม่ (พัก + จำลอง focus) |
| 4 | **S4 ข้อมูลร้าน (บล็อกภาษี 3 แบบ)** | ตัดสิน `SectionCard` + การแสดง/ซ่อนเลขผู้เสียภาษีตามสิทธิ์ (PDPA — ผิดแล้วเป็นเรื่อง) | มีสิทธิ์+ประกาศแล้ว / มีสิทธิ์+ยังไม่ประกาศ / พนักงาน |
| 5 | **S11 `/invite`** | จอเดียวที่ผู้ใช้ภายนอกเห็นก่อนเป็นลูกค้า + ต้องดีบนมือถือ (ข้อยกเว้น DS §8) | ก่อนล็อกอิน / ล็อกอินถูกบัญชี / ผิดบัญชี / หมดอายุ / สำเร็จ · เช็คที่ความกว้าง ~390px ด้วย |

**ไม่ต้องทำ mockup:** S1/S2/S5/S7/S9/S10/S12/S13 — ประกอบจาก component ที่ mockup 5 จอด้านบนล็อกไปแล้วทั้งหมด
(ทำเพิ่ม = ต้นทุนโดยไม่ลดความเสี่ยง) · **`frontend` เป็น consult** ยืนยันก่อนเซ็นว่า port เป็น Next.js + Flutter ได้จริง
