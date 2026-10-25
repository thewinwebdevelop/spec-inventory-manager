---
doc: ui
owner: "@ux"
signoff: approved     # user 2026-09-28
---
# [F-003] UI / visual
> design token (สี/typography/spacing) + visual spec ที่ใช้ร่วม web↔mobile
> — **ระบุเฉพาะส่วนที่ต่างกันต่อ platform** (navigation, ความสามารถเฉพาะ) · flow/copy → [ux-wireframe.md](ux-wireframe.md)

## Contract summary (≤20 บรรทัด — ทีม consumer อ่านแค่ส่วนนี้)
> token/component ที่ frontend ต้องยึด: reuse อะไร, add ใหม่อะไรเข้า design system
- **ไม่มีสีใหม่ ไม่มี hex ใหม่** — ทุกอย่าง map ไป token ที่มีอยู่ (§1.1/§1.1b/§1.1c ของ design-system)
- **reuse (§1):** `ListRow` · `Badge` (neutral) · `Banner` (info/warning/danger/success) · `RadioCardGroup` · `ConfirmDialog` · `EmptyState` + `ForbiddenPanel` · `TextField` · `Button` · `Skeleton` · `Toast` · `ThrottleBanner` · `SectionCard`
- **ใหม่ในส่วนกลาง (§2 — contribute-back ตอน Gate B):** `Checkbox` + `CheckboxRow` · `Disclosure` (หัวข้อพับได้) · `StickyActionBar` (แถบปุ่มติดล่าง)
- **token ใหม่ (§4):** `size.checkbox` 20px · `radius.checkbox` 4px · `checkbox.border.w` 2px · icon role ใหม่ `icon.roles` (`ShieldCheck` / `shieldCheck`) · ขยายการใช้ `icon.lock` = "ดูได้อย่างเดียวตามสิทธิ์"
- **Checkbox (§2.1):** ติ๊ก = พื้น `btn.bg` + ขอบ `color.primary` + เครื่องหมาย `btn.fg` · ว่าง = พื้น `color.surface` + ขอบสูตรปุ่ม outline · ล็อก/disabled = พื้น `surface.muted` + ขอบ `border.default` + เครื่องหมาย `text.muted` · **ห้ามใช้ opacity แทนสถานะ**
- **ของระดับ feature (§3 — ไม่เข้า DS):** `CapabilityChecklist` · `CapabilityReadList` · `RoleListRow` · `RoleMetaLine` · `RoleReasonBanner` (= Banner info + `icon.lock`) · `RoleChangedBanner`
- **tap target:** ทุกแถวที่กดได้ ≥ `size.list-row.min-h` 56px · ทั้งแถว CheckboxRow คือพื้นที่แตะ (ไม่ใช่แค่กล่อง 20px) · D-031 ไม่มีข้อยกเว้น
- **read-only (R4) ไม่ใช่ checkbox ที่ disabled** — ใช้ `CapabilityReadList` (✓ `icon.check` / "ไม่ได้ให้")
- **platform (§5):** web = หน้าเต็ม `size.content.narrow-max-w` 640px, กลุ่มไม่พับ, sidebar item ใหม่ · mobile = push เต็มจอ, กลุ่มพับได้ (`Disclosure`), `StickyActionBar` ปุ่มเต็มกว้าง + safe-area
- **R10 mobile เปลี่ยนบทบาทรายคน (user ตัดสิน 2026-09-27 · §3/§5):** แถวสมาชิกที่แตะได้ = `ListTile` เดิม + `icon.chevron-right` · แตะไม่ได้ = ไม่มี › + บรรทัดเหตุผล `icon.lock` sm `text.muted` (ไม่จาง ไม่ใช้ opacity) · sheet = modal bottom sheet native (ไม่ใช่ของกลางใหม่) พื้น `color.surface` มุมบน `radius.card` + `RadioCardGroup` + `StickyActionBar` · R10a = `ConfirmDialog` `destructive` + `focusCancel` · **ไม่มี token ใหม่** · ถอด/ยกเลิกคำเชิญ/รีเซ็ตรหัสบน mobile = F-002b
- **sync-back:** diff ที่เสนอต่อ `docs/design-system.md` อยู่ใน §7 — **ux ไม่แก้เอง** apply ตอน Gate B
- อ้าง: D-026 (Calm Teal) · D-031 (icon/tap/focus/banner) · D-037 (ข้อความ registry มาจาก server)

- reuse design system กลางก่อน; ของใหม่ contribute-back (ดู [docs/design-system.md](../../design-system.md))
- **sync-back:** token/component ใหม่ → อัปเดต [docs/design-system.md](../../design-system.md) (หรือระบุ "ไม่กระทบส่วนกลาง")

---

## 1. Reuse — ของกลางที่ใช้ และใช้ที่ไหน

| ของกลาง (design-system §9.1) | ใช้ที่ | variant / การตั้งค่า |
|---|---|---|
| `ListRow` | R1 แถวบทบาท · ทางเข้า mobile ใน "ข้อมูลร้าน" | slot ซ้าย: ไม่มี (R1) / `icon.roles` (ทางเข้า) · บรรทัดหลัก `type.body.md` · รอง `type.body.sm` `text.muted` · slot ขวา `icon.chevron-right` · สูง ≥ 56px |
| `Badge` variant `neutral` | "ล็อก" · "ดูได้อย่างเดียว" · "เร็ว ๆ นี้" | ข้อความเสมอ · ไม่มีไอคอนใน badge |
| `Banner` tone `info` | แถบ `writes_disabled` (`icon.info`) · แถบเหตุผลอ่านอย่างเดียว (`icon.lock`) · แถบกรองตามบทบาท R6 (`icon.info`) | ปุ่มในแถบ = `secondary` โทนของกล่อง (§1.1c-2) · มีได้ 1 ปุ่ม "ทำสำเนาเป็นบทบาทใหม่" |
| `Banner` tone `warning` | R3a "คุณจะเสียสิทธิ์เหล่านี้ทันที" (อยู่ใน body ของ ConfirmDialog) · R3b แก้ชนกัน | ปุ่มในแถบ = `secondary` โทน warning · **ห้ามปุ่ม fill** |
| `Banner` tone `success` | R6 "ไม่มีใครใช้บทบาทนี้แล้ว" | ปุ่ม `secondary` โทน success |
| `ErrorBanner` (= Banner danger) | error ตอนส่งฟอร์ม · catalog โหลดไม่สำเร็จ · R10 sheet (โหลดบทบาทไม่สำเร็จ / error ตอนส่ง) | + ปุ่ม "ลองใหม่" โทน danger (เฉพาะ error โหลด) |
| `RadioCardGroup` | R2 เลือกต้นแบบ · R8 ตัวเลือกบทบาท · R10 sheet | disabled + `disabledReason` (มีอยู่แล้ว) |
| `ConfirmDialog` | R3a · R5 (ก) · "ทิ้งการแก้ไขนี้?" · R10a เปลี่ยนบทบาทตัวเอง | R5/ทิ้งการแก้ไข/R10a = `destructive` (`focusCancel` default) · R3a ปกติ = `primary`; มีเสียสิทธิ์ตัวเอง = `destructive` + `focusCancel` · body รับหลายบรรทัด/รายการ · mobile แคบ = ปุ่มเรียงแนวตั้งเต็มกว้าง |
| `EmptyState` / `ForbiddenPanel` | error โหลด · 404 บทบาท · ไม่มี `manage_roles` | ForbiddenPanel = `icon.lock` |
| `TextField` | ชื่อบทบาท | + ตัวนับ "{n}/50" ชิดขวาใต้ช่อง (`type.body.sm` `text.muted`; เกิน = `danger.text`) |
| `Button` | ทุกปุ่ม | primary: "สร้างบทบาท"/"บันทึก"/"ถัดไป" · secondary: "ทำสำเนาเป็นบทบาทใหม่"/"ลบบทบาทนี้"/"ยกเลิก" · tertiary: "ไปหน้าสมาชิก"/"จัดการบทบาท"/"ดูว่าแต่ละบทบาททำอะไรได้บ้าง" · `size="sm"` ในแถบ banner · สูง ≥ 44px ทุกตัว |
| `Skeleton` | R1 / R3 / R4 loading · R10 sheet (การ์ด 3 ใบ) | โครงตามจอ (ux-wireframe) |
| `Toast` | สร้าง/บันทึก/ลบสำเร็จ · R10 เปลี่ยนบทบาทสำเร็จ | success |
| `ThrottleBanner` | `429 RATE_LIMITED` (รวม R10 `memberWrite`) | countdown `type.numeric.tabular` |
| `StickyActionBar` (ใหม่ §2.3) | + R10 sheet: ปุ่ม "บันทึกบทบาท" เต็มกว้าง | ใน sheet: บวก safe-area ล่าง · ไม่มีปุ่มยกเลิก (✕ ที่หัว sheet) |
| `SectionCard` | web R3/R4: กรอบกลุ่ม "การจัดการอื่น" | ไม่มี action มุมขวา |

> "ปุ่ม `secondary` สำหรับ **ลบบทบาทนี้**" โดยเจตนา: ปุ่มสีแดงทึบบนหน้าที่ผู้ใช้มาเพื่อ "แก้" จะแย่งสายตาจากปุ่มบันทึก · ความเป็นอันตรายสื่อที่ ConfirmDialog (`destructive`) ซึ่งเป็นจุดตัดสินใจจริง

## 2. ของใหม่ในส่วนกลาง (contribute-back → design-system §9.1)

### 2.1 `Checkbox` + `CheckboxRow`
เหตุผลที่เป็นของกลาง: ทุก feature ที่มี "เลือกหลายข้อ" (bulk select สินค้า F-092, ตั้งค่าช่องทาง, ตัวกรอง) ต้องใช้ · ถ้าสร้างเป็นของ F-003 feature ถัดไปจะลอกแล้ว drift

**`Checkbox` (กล่องอย่างเดียว — ไม่ใช้เดี่ยว ๆ ต้องมี label เสมอ)**

| สถานะ | พื้น | ขอบ (`checkbox.border.w` 2px) | เครื่องหมาย |
|---|---|---|---|
| ว่าง | `color.surface` | `color-mix(in srgb, color.text.muted 60%, color.border.default)` (สูตรเดียวกับปุ่ม outline §1.1c — ≥3:1 ทั้งสองธีม) | — |
| ติ๊ก | `btn.bg` (light `#0C6155` · dark `#0A5A45`) | `color.primary` (light `#0C6155` · dark `#2FBBA6`) — **ขอบสว่างในธีมมืดจำเป็น** เพราะพื้น `#0A5A45` vs surface ≈1.9:1 ไม่ถึง 3:1 (WCAG 1.4.11) | `icon.check` สี `btn.fg` (#FFF) ขนาด 14px ในกล่อง |
| ล็อก (imply) / disabled-ติ๊ก | `color.surface.muted` | `color.border.default` | `icon.check` สี `color.text.muted` |
| disabled-ว่าง | `color.surface.muted` | `color.border.default` | — |
| hover (web, ใช้ได้) | ขอบเป็น `color.primary` | | |
| focus | **`:focus-visible` ring ที่แถว (`CheckboxRow`) ไม่ใช่ที่กล่อง** — `focus.ring.*` | | |

- ขนาด `size.checkbox` 20px · มุม `radius.checkbox` 4px · ไม่มีสถานะ indeterminate ใน F-003 (ไม่ประกาศจนมีคนใช้)
- ⛔ ห้ามสื่อ "disabled" ด้วย `opacity` — ข้อความเหตุผลต้องอ่านได้เต็ม (AA)

**`CheckboxRow` (กล่อง + ป้าย + คำอธิบาย + badge + เหตุผล — แตะได้ทั้งแถว)**
```
┌────────────────────────────────────────────────────────────┐  min-h size.list-row.min-h (56)
│ [■]  ป้าย (type.body.md, color.text)   [Badge: เร็ว ๆ นี้]   │  padding space.3 (บน/ล่าง) · space.4 (ข้าง)
│      คำอธิบาย (type.body.sm, color.text.muted)               │  gap กล่อง↔ข้อความ space.3
│      (lock) เหตุผล (type.body.sm, color.text.muted)          │  icon size.icon.sm · gap space.1
└────────────────────────────────────────────────────────────┘
```
- กล่องชิดบนของบรรทัดป้าย (ไม่กึ่งกลางแนวตั้ง — คำอธิบายยาว 2 บรรทัดแล้วกล่องจะลอย)
- ป้ายของแถวที่ disabled/ล็อก **คง `color.text`** (ไม่จาง) — อ่านได้ว่าเป็นสิทธิ์อะไร · สถานะสื่อที่กล่อง + บรรทัดเหตุผล
- web hover (แถวที่ใช้ได้) = พื้น `color.surface.muted` · pressed mobile = ripple/highlight มาตรฐานของ platform บนพื้นเดียวกัน
- semantics: web `<label>` ครอบทั้งแถว + `<input type="checkbox">` จริง · disabled = `aria-disabled="true"` **ยังโฟกัสได้** (ให้ screen reader อ่านเหตุผล — ux-wireframe §A) · คำอธิบาย/เหตุผลผูกด้วย `aria-describedby` · Flutter = `CheckboxListTile`-เทียบเท่าที่ map token ตามตาราง (ไม่ใช้สี Material default) + `Semantics(enabled: false, …)` ที่ยังรับโฟกัส

### 2.2 `Disclosure` (หัวข้อพับได้)
เหตุผลที่เป็นของกลาง: checklist ยาวบนมือถือ (F-003) · ตั้งค่าช่องทาง (F-020) · รายละเอียดออเดอร์ (F-024) — pattern เดียวกัน
```
┌────────────────────────────────────────────────────────────┐  min-h 56 · ทั้งแถวเป็นปุ่มเดียว
│ ▾  ทีมงาน (type.button.md, color.text)     เลือก 0 จาก 2    │  ตัวนับ type.body.sm text.muted ชิดขวา
└────────────────────────────────────────────────────────────┘
```
- ไอคอน `icon.chevron-down` `size.icon.md` — **เปิด = 0°, ปิด = หมุน −90°** (ชี้ขวา) · ไม่เพิ่ม icon role ใหม่ · เคลื่อนไหว 150ms ease-out · `prefers-reduced-motion` / Flutter `MediaQuery.disableAnimations` = ไม่หมุนแบบ animate
- เส้นคั่นล่างหัวข้อ `color.border.default` · เนื้อหาใต้หัวข้อเยื้องเท่า padding ข้างของหัวข้อ (ไม่เยื้องเพิ่ม)
- semantics: `button` + `aria-expanded` + `aria-controls` · ป้ายที่อ่าน = "{ชื่อกลุ่ม}, เลือก {n} จาก {m}"
- ค่าเริ่มต้นเปิดหรือปิด = การตัดสินของแต่ละจอ (F-003: เปิดทุกกลุ่ม)

### 2.3 `StickyActionBar` (แถบปุ่มติดล่าง)
เหตุผลที่เป็นของกลาง: ทุกฟอร์มยาวบนมือถือ (สินค้า F-010, ปรับสต๊อก F-011) ต้องมีปุ่มบันทึกที่นิ้วโป้งถึงเสมอ
```
mobile ┌──────────────────────────────┐   web ┌──────────────────────────── คอลัมน์เนื้อหา ─┐
       │ [        บันทึก          ]   │       │                      [ยกเลิก]  [บันทึก]      │
       └──────────────────────────────┘       └──────────────────────────────────────────┘
```
- พื้น `color.surface` · เส้นบน `color.border.default` 1px · padding `space.3` (บน/ล่าง) + `space.4` (ข้าง) · **mobile บวก safe-area inset ล่าง**
- mobile: ปุ่มหลัก 1 ปุ่ม เต็มกว้าง (ปุ่มรองไปอยู่ที่ AppBar/เนื้อหา) · web: แถวปุ่มชิดขวา gap `space.3` (margin 0 — §1.1c-3) ภายใน `size.content.narrow-max-w`
- web = `position: sticky; bottom: 0` ในคอลัมน์ (ไม่ใช่ fixed ทั้งหน้าต่าง) · ไม่ใช้ z-index เพิ่ม (ลำดับ DOM) — ⛔ ห้ามตั้งเลข z เอง (§1.3)
- เนื้อหาด้านบนต้องเว้นระยะล่างเท่าความสูงแถบ ไม่งั้นแถวสุดท้ายของ checklist ถูกบัง
- ไม่มีเงา (ธีมมืดเงาไม่เห็น + เส้นบนพอแยกชั้น)

## 3. ของระดับ feature (F-003 — ไม่เข้า DS · design-system §9.2)

| Component | ประกอบจาก | หน้าที่ |
|---|---|---|
| `CapabilityChecklist` | `Disclosure` (mobile) / หัวข้อกลุ่มแบบคงที่ (web) + `CheckboxRow` + `Badge` | R3 — กลุ่ม/แถว/imply-lock/"คุณไม่มีสิทธิ์นี้"/fallback "อื่น ๆ" |
| `CapabilityReadList` | รายการ + `icon.check` | R4 — ✓ "ให้" / "–" + "ไม่ได้ให้" · การ์ด `full_access` ของเจ้าของร้าน |
| `RoleListRow` | `ListRow` + `Badge` + `RoleMetaLine` | R1 |
| `RoleMetaLine` | ข้อความ `type.body.sm` `text.muted` | "สมาชิก n คน · คำเชิญ… · แก้ไขล่าสุดโดย…" (กติกา ux-wireframe §0.2) |
| `RoleReasonBanner` | `Banner` info + `icon.lock` (+ 1 ปุ่ม secondary) | R4 แถบเหตุผล (map reason → copy ux-wireframe §0.3) |
| `RoleChangedBanner` | `Banner` warning + รายการ diff + 2 ปุ่ม secondary/tertiary | R3b |
| `MemberRowReason` | ข้อความ `type.body.sm` `text.muted` + `icon.lock` `size.icon.sm` gap `space.1` | บรรทัดเหตุผลใต้แถวสมาชิก — web R7 + mobile R10 (สเปกเดียวกัน) |
| `ChangeRoleSheet` (mobile) | modal bottom sheet native + `RadioCardGroup` + `ErrorBanner`/`ThrottleBanner` + `StickyActionBar` | R10 — คู่ของ ChangeRoleDialog (web) |

- หัวข้อกลุ่มบน web (ไม่พับ): `type.label.sm` `color.text.muted` + เส้นคั่น `border.default` · ระยะเหนือหัวข้อ `space.6` · ใต้หัวข้อ `space.2`
- การ์ด `full_access` (R4 เจ้าของร้าน): พื้น `color.surface.muted` · `radius.card` · padding `space.4` · `icon.check` + ป้าย `type.body.md` + คำอธิบาย `type.body.sm`
- **`ChangeRoleSheet` (R10):** Flutter `showModalBottomSheet` (`isScrollControlled`, `showDragHandle`) — elevation ตาม native pattern (design-system `elevation.dialog` หมายเหตุ mobile) · พื้น `color.surface` · มุมบน `radius.card` · padding ข้าง `space.4` · หัว: ชื่อ `type.heading.sm` + อีเมล `type.body.sm` `text.muted` (1 บรรทัด ตัดท้าย) + ✕ `icon.close` 44px · สูงตามเนื้อหา สูงสุด 90% ของจอ แล้วเลื่อนรายการได้ (หัว + `StickyActionBar` คงที่) · scrim ตาม native · ระหว่างส่ง: `isDismissible`/`enableDrag` = false · **ไม่เป็นของกลาง:** design-system ยังไม่ประกาศ bottom sheet (ปล่อยให้ F-006 ที่เป็นเจ้าของ org switcher) — ถ้า F-006 ประกาศแล้ว R10 ต้องย้ายไปใช้ตัวนั้น
- **แถวสมาชิก mobile (R10):** แตะได้ = `icon.chevron-right` `size.icon.md` `text.muted` ชิดขวา + ripple มาตรฐาน · แตะไม่ได้ = ไม่มี › ไม่มี ripple + `MemberRowReason` · ⛔ ห้ามจางแถวที่แตะไม่ได้ (การจาง = "ถูกถอดแล้ว" ตามของเดิม F-002 — ใช้ความหมายเดียว)
- `CapabilityReadList` แถว "ไม่ได้ให้": ป้าย `color.text.muted` + ข้อความ "ไม่ได้ให้" ชิดขวา (ไม่พึ่งสี) · สูงตามเนื้อหา (ไม่ใช่สิ่งที่กดได้ จึงไม่ต้อง 44px)

## 4. Token + icon ใหม่

| token | ค่า | ใช้ที่ไหน |
|---|---|---|
| `size.checkbox` | 20px | กล่อง `Checkbox` (พื้นที่แตะมาจาก `CheckboxRow` ≥ 56px) |
| `radius.checkbox` | 4px | มุมกล่อง `Checkbox` — เล็กกว่า `radius.button` (8px) เพราะกล่อง 20px มุม 8px จะอ่านเป็นวงกลม (ชนกับ radio) |
| `checkbox.border.w` | 2px | ขอบกล่องทุกสถานะ |

| `icon.<role>` | web | Flutter | ใช้ที่ไหน |
|---|---|---|---|
| **`icon.roles`** (ใหม่) | `<ShieldCheck />` | `PhosphorIconsRegular.shieldCheck` | เมนู/แถวทางเข้า "บทบาทและสิทธิ์" (web sidebar, mobile "ข้อมูลร้าน") |
| `icon.lock` (ขยายการใช้) | `<Lock />` | `PhosphorIconsRegular.lock` | + **เหตุผล "ดูได้อย่างเดียว" ตามสิทธิ์** (แถบ R4, บรรทัดเหตุผลแถวสมาชิก/คำเชิญ, แถว checklist ที่ disabled/ติ๊กล็อก) |

- ไม่มีสีใหม่ · ไม่มี typography ใหม่ · ไม่มี spacing ใหม่
- ⛔ ไม่ใช้ `icon.copy` กับปุ่ม "ทำสำเนาเป็นบทบาทใหม่" — `icon.copy` = คัดลอกไปคลิปบอร์ด (ห้ามใช้ไอคอนคนละความหมาย §1.6.2) · ปุ่มนี้เป็นข้อความล้วน

## 5. ต่างกันต่อ platform (นอกนั้นเหมือนกันทุกอย่าง)

| เรื่อง | web (desktop → tablet) | mobile (Flutter) |
|---|---|---|
| ทางเข้า | sidebar `NavItem` "บทบาทและสิทธิ์" (`icon.roles`) ต่อจาก "สมาชิก" · แสดงเมื่อ `can("manage_roles")` | `ListRow` ในจอ "ข้อมูลร้าน" + ปุ่ม tertiary "จัดการบทบาท" ในจอสมาชิก · **ไม่เพิ่มแท็บล่าง** (งานไม่บ่อย — แท็บเป็นของงานประจำวัน) |
| ความกว้าง | `size.content.narrow-max-w` 640px (หน้าตั้งค่า อ่านคอลัมน์เดียว) · tablet เหมือนกัน | เต็มจอ `space.screen.padding` 24px |
| R2 เลือกต้นแบบ | dialog `size.dialog.max-w` | push เต็มจอ + `StickyActionBar` |
| checklist | หัวกลุ่มคงที่ ไม่พับ | `Disclosure` พับได้ เปิดทุกกลุ่มเป็นค่าเริ่มต้น |
| ปุ่มบันทึก/สร้าง | `StickyActionBar` ชิดขวา มี "ยกเลิก" | `StickyActionBar` ปุ่มเดียวเต็มกว้าง · ยกเลิก = ← AppBar |
| ออกทั้งที่มีของค้าง | in-app navigation guard + `beforeunload` | `PopScope` (← และ back gesture) |
| R5/R3a dialog | modal `size.dialog.max-w` | dialog `size.dialog.inline-w` · ปุ่มเรียงแนวตั้งเต็มกว้างเมื่อไม่พอ |
| R6 กรองตามบทบาท | query `?roleId=` บนจอสมาชิกเดิม | push จอใหม่ (widget เดียวกับแท็บสมาชิก) |
| R7 เหตุผลบนแถวสมาชิก/คำเชิญ | มี (แถวสมาชิก + คำเชิญ) | แถวสมาชิกเท่านั้น (R10) · แถวคำเชิญไม่มี (ไม่มีการกระทำบน mobile — F-002b) |
| เปลี่ยนบทบาทสมาชิกรายคน | ChangeRoleDialog เดิม (เมนู ⋯ บนแถว) | แตะแถว → `ChangeRoleSheet` (R10) · ยืนยันตัวเอง R10a = dialog |
| ถอดสมาชิก / ยกเลิก-ออกลิงก์คำเชิญ / รีเซ็ตรหัส | ของเดิม F-002 (รีเซ็ตรหัส = F-002b) | ไม่มีใน F-003 — F-002b · บรรทัดท้ายส่วน "ทำได้ที่เว็บ" |
| R9 `/invite` | ใช่ (public, ใช้ได้ที่ ~390px — §8.3) | — |

## 6. นับ tap target (เช็คลิสต์ §8.4 ข้อ 2 — mockup ต้องนับจริง)
| องค์ประกอบ | สูงขั้นต่ำ |
|---|---|
| `RoleListRow` · `CheckboxRow` · หัว `Disclosure` · `ListRow` ทางเข้า · แถวสมาชิก mobile ที่แตะได้ (R10) | 56px (`size.list-row.min-h`) |
| ทุก `Button` (รวม `size="sm"` ในแถบ banner และ `tertiary`) | 44px |
| ← AppBar / ✕ ปิด dialog (icon-button) | 44px |
| ตัวเลือกใน `RadioCardGroup` (R2/R8/R10) | ทั้งการ์ด ≥ 44px |
| ✕ หัว `ChangeRoleSheet` | 44px |
| กล่อง `Checkbox` 20px | **ไม่ใช่พื้นที่แตะ** — แถวคือพื้นที่แตะ |

## 7. Sync-back → `docs/design-system.md` (diff ที่เสนอ — **ux ไม่แก้เอง** · apply ตอน Gate B)

```diff
 ### 1.3 Spacing / radius (4-pt grid)
 | `radius.badge` | 9999px (pill) | badge "อุปกรณ์นี้" |
+| `radius.checkbox` | 4px | มุมกล่อง `Checkbox` — เล็กกว่า `radius.button` เพราะกล่อง 20px มุม 8px จะอ่านเป็นวงกลม (ชนกับ radio) |
 ...
 | `size.list-row.min-h` | 56px | ความสูงขั้นต่ำของแถวรายการ / แถวเมนู (ทั้ง web + mobile) |
+| `size.checkbox` | 20px | กล่อง `Checkbox` — **ไม่ใช่พื้นที่แตะ** (แถว `CheckboxRow` ≥ `size.list-row.min-h` คือพื้นที่แตะ) |
+| `checkbox.border.w` | 2px | ขอบกล่อง `Checkbox` ทุกสถานะ |

 #### 1.6.2 `icon.<role>` → ชื่อไอคอนจริง (web / Flutter)
-| `icon.lock` | `<Lock />` | `PhosphorIconsRegular.lock` | `EmptyState` preset `ForbiddenPanel`, ของที่ล็อกตาม tier (§5) |
+| `icon.lock` | `<Lock />` | `PhosphorIconsRegular.lock` | `EmptyState` preset `ForbiddenPanel`, ของที่ล็อกตาม tier (§5), **เหตุผล "ดูได้อย่างเดียว" ตามสิทธิ์** (F-003: แถบ, บรรทัดเหตุผลใต้แถว, แถว checklist ที่ล็อก) |
+| `icon.roles` | `<ShieldCheck />` | `PhosphorIconsRegular.shieldCheck` | เมนู/แถวทางเข้า "บทบาทและสิทธิ์" |
+
+- **ไอคอนพับ/กาง (`Disclosure`) ใช้ `icon.chevron-down` ตัวเดียว** — เปิด 0° · ปิด หมุน −90° · ไม่มี role `chevron-up`/`chevron-left` แยก

 ### 9.1 ของกลาง (reuse ได้ทุก feature)
-| `Banner` | F-002 | 4 tone: `info` / `warning` / `success` / `danger` · ปุ่มในกล่องใช้โทนของกล่อง (§1.1c-2) |
+| `Banner` | F-002 (+F-003) | 4 tone: `info` / `warning` / `success` / `danger` · ปุ่มในกล่องใช้โทนของกล่อง (§1.1c-2) · **ไอคอนตั้งต้นตาม tone (`icon.info`/`icon.warn`/`icon.check-circle`/`icon.error`); override ได้เฉพาะ role จาก §1.6.2 — ที่ประกาศแล้ว: tone `info` + `icon.lock` = "ดูได้อย่างเดียวตามสิทธิ์"** |
+| `Checkbox` | F-003 | กล่อง `size.checkbox` / `radius.checkbox` / `checkbox.border.w` · 4 สถานะ: ว่าง (ขอบสูตรปุ่ม outline) · ติ๊ก (`btn.bg` + ขอบ `color.primary` + `icon.check` สี `btn.fg`) · disabled-ติ๊ก/ล็อก และ disabled-ว่าง (`surface.muted` + ขอบ `border.default`, เครื่องหมาย `text.muted`) · ⛔ ไม่ใช้ opacity · ⛔ ไม่ใช้เดี่ยว ๆ — อยู่ใน `CheckboxRow` เสมอ · ยังไม่มี indeterminate |
+| `CheckboxRow` | F-003 | กล่อง + ป้าย (`type.body.md`) + คำอธิบาย (`type.body.sm` `text.muted`) + `Badge` + บรรทัดเหตุผล (`icon.lock` sm) · **แตะได้ทั้งแถว ≥ `size.list-row.min-h`** · focus ring ที่แถว · disabled ยังโฟกัสได้ (`aria-disabled`) เพื่อให้อ่านเหตุผล · ป้ายไม่จางเมื่อ disabled |
+| `Disclosure` | F-003 | หัวข้อพับได้ · ทั้งแถวเป็นปุ่ม ≥ 56px · `type.button.md` + ตัวนับ `type.body.sm` ชิดขวา · `icon.chevron-down` (ปิด = −90°) · `aria-expanded` · เคารพ reduced-motion |
+| `StickyActionBar` | F-003 | แถบปุ่มติดล่าง · พื้น `surface` + เส้นบน `border.default` · padding `space.3`/`space.4` + safe-area · mobile = ปุ่มหลักเดียวเต็มกว้าง · web = sticky ในคอลัมน์ ปุ่มชิดขวา gap `space.3` · ไม่มีเงา · ไม่ตั้ง z เอง |

 ### 9.2 ของระดับ feature
+| `CapabilityChecklist` · `CapabilityReadList` · `RoleListRow` · `RoleMetaLine` · `RoleReasonBanner` · `RoleChangedBanner` | F-003 | ผูก schema `CapabilityCatalog`/`RoleDetail` + กติกา reason ของ F-003 (ประกอบจาก `CheckboxRow` `Disclosure` `ListRow` `Badge` `Banner` ซึ่งเป็นของกลาง) |
```

- **ไม่กระทบส่วนกลางนอกจากนี้:** สี (§1.1/§1.1b/§1.1c) · typography (§1.2) · elevation (§1.4) · Tailwind mapping (§1.5 — frontend เพิ่ม utility ของ 3 token ใหม่เอง ตามรูปแบบเดิม)
- Claude Design sync: push `Checkbox` `CheckboxRow` `Disclosure` `StickyActionBar` (อยู่ §9.1) · ของ §9.2 ไม่ push
