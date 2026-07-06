# Design System — cross-cutting standards (web ↔ mobile)

> เจ้าของ: **ux** (ผ่าน skill `thai-ux`) · consumed by **frontend** (Next.js + Flutter)
> ไฟล์นี้บันทึก **มาตรฐานออกแบบที่ใช้ร่วมทั้งระบบ** — รายละเอียด token/visual เต็ม ux เติมตอน Gate 2
> seed มาจาก F-000-TOKENS + การตัดสินใจช่วง Phase 0 spec

## 1. Design tokens (shared)

- **color / typography / spacing** เป็น token ชุดเดียว แปลงเป็น Next.js (Tailwind/shadcn CSS vars) + Flutter `ThemeData`/`ColorScheme`
- ฟอนต์ไทยที่ render ชัด · format เลข/เงิน/วันที่แบบไทย
- **ค่าจริงเติมโดย F-001 (feature UI แรก)** — token เหล่านี้คือ **สัญญากลาง** ที่ `frontend` map
  เข้า Tailwind theme + Flutter theme (**ห้าม off-token / ห้าม hardcode สี-spacing; ห้าม web↔mobile drift**).
  ถ้า token ตัวไหนใช้ในโค้ดไม่ได้/ขาด → `frontend` แจ้ง `@ux` ขอแก้ ไม่เลือกค่าเอง (ดู §6).
- naming convention: `namespace.role[.variant]` (เช่น `color.warning.bg`, `space.4`) — platform-neutral,
  frontend ตั้งชื่อ CSS var / Dart const ให้ตรง role นี้

### 1.1 Color (semantic roles — hex กลาง, light theme)

> เลือกให้ contrast ผ่าน WCAG AA บนข้อความไทย (ตัวอักษรไทยเล็ก ต้องระวังเป็นพิเศษ — §7).
> `.fg`/`.bg`/`.border` = สีตัวอักษร/พื้นหลัง/เส้นขอบของ role นั้น. ทุก status pair (fg-on-bg) ผ่าน AA.

| Token | Hex | ใช้ที่ไหน |
|---|---|---|
| `color.primary` | `#1F6FEB` | ปุ่มหลัก, ลิงก์, focus ring (สีแบรนด์หลัก) |
| `color.primary.fg` | `#FFFFFF` | ตัวอักษรบนปุ่มหลัก |
| `color.primary.hover` | `#1A5FCC` | hover/pressed ปุ่มหลัก |
| `color.danger` | `#D92D20` | ปุ่ม destructive, border field ผิด |
| `color.danger.fg` | `#FFFFFF` | ตัวอักษรบนปุ่ม destructive |
| `color.danger.bg` | `#FEF3F2` | พื้น `ErrorBanner` |
| `color.danger.border` | `#FDA29B` | เส้นขอบ `ErrorBanner`, field ผิด |
| `color.danger.text` | `#B42318` | ตัวอักษรใน `ErrorBanner` (บนพื้นอ่อน — ผ่าน AA) |
| `color.warning.bg` | `#FFFAEB` | พื้น `ThrottleBanner` — เหลืองอ่อน "รอได้ ไม่ใช่หายนะ" |
| `color.warning.border` | `#FEC84B` | เส้นขอบ `ThrottleBanner` |
| `color.warning.text` | `#B54708` | ตัวอักษร/countdown ใน `ThrottleBanner` (ผ่าน AA บนพื้นเหลืองอ่อน) |
| `color.success.bg` | `#ECFDF3` | พื้น toast สำเร็จ |
| `color.success.text` | `#067647` | ตัวอักษร/ไอคอน toast สำเร็จ |
| `color.badge.current.bg` | `#ECFDF3` | พื้น badge "อุปกรณ์นี้" (เขียวอ่อน) |
| `color.badge.current.text` | `#067647` | ตัวอักษร badge "อุปกรณ์นี้" |
| `color.surface` | `#FFFFFF` | พื้น card ฟอร์ม, row session, dialog |
| `color.surface.muted` | `#F9FAFB` | พื้นรอง (skeleton base, hover row) |
| `color.bg` | `#F2F4F7` | พื้นหลังหน้า (behind card, web) |
| `color.text` | `#101828` | ตัวอักษรหลัก (heading/body) |
| `color.text.muted` | `#667085` | helper text, last-active, subtitle |
| `color.border.default` | `#D0D5DD` | field border ปกติ, เส้นคั่น row |
| `color.overlay` | `#101828` @ 40% | ฉากมืดหลัง modal (web) |

### 1.2 Typography

> ฟอนต์: **Sarabun** — Thai glyph coverage เต็ม, render คมทั้ง web + Flutter, มี tabular-lining
> numerals (เลขความกว้างเท่ากันทุกตัว → countdown ไม่กระตุก/ขยับ — สำคัญกับ `ThrottleBanner`).
> Fallback stack: `Sarabun, "Noto Sans Thai", system-ui, sans-serif`.
> line-height เผื่อ ascender/descender ไทย (ไม้เอก-โท-ตรี + สระบน/ล่าง) จึงสูงกว่า Latin ปกติ.

| Token | size / line-height / weight | ใช้ที่ไหน |
|---|---|---|
| `type.heading.md` | 24 / 32 / 600 | หัวข้อหน้า (สมัคร/เข้าสู่ระบบ/อุปกรณ์ที่เข้าสู่ระบบ), หัวข้อ dialog |
| `type.heading.sm` | 18 / 28 / 600 | หัวข้อ section (เปลี่ยนรหัสผ่าน) |
| `type.body.md` | 16 / 26 / 400 | body หลัก, เนื้อหา dialog, subtitle |
| `type.body.sm` | 14 / 22 / 400 | helper text ใต้ field, `last_active`, banner helper |
| `type.label.sm` | 14 / 20 / 500 | field label |
| `type.button.md` | 16 / 24 / 600 | ตัวอักษรบนปุ่ม |
| `type.numeric.tabular` | (feature) `font-variant-numeric: tabular-nums` / Flutter `FontFeature.tabularFigures()` | countdown `{mm}:{ss}` / `{N}` ใน `ThrottleBanner` — บังคับ tabular กัน layout ขยับทุกวินาที |

> **เลข/เงิน/วันที่แบบไทย** (จาก `thai-ux`): เงิน "฿1,250.00" (2 ตำแหน่ง, คั่นหลักพัน, display เท่านั้น),
> สต๊อก = จำนวนเต็ม, วันที่ "23 มิ.ย. 2026, 14:30", ไม่มี plural inflection ใช้ classifier ("12 รายการ").

### 1.3 Spacing / radius (4-pt grid)

| Token | ค่า | ใช้ที่ไหน |
|---|---|---|
| `space.1` | 4px | gap เล็กสุด (icon↔text) |
| `space.2` | 8px | gap label↔input, helper↔field |
| `space.3` | 12px | padding ภายในปุ่ม (แนวตั้ง) |
| `space.4` | 16px | `space.form.gap` (ระหว่างฟิลด์ในฟอร์ม auth), padding row session |
| `space.5` | 20px | — |
| `space.6` | 24px | `space.card.padding` (web auth card), `space.screen.padding` (mobile full-screen) |
| `space.8` | 32px | ระยะ header↔ฟอร์ม |
| `radius.button` | 8px | มุมโค้งปุ่ม, input field |
| `radius.card` | 12px | มุมโค้ง auth card, dialog, banner |
| `radius.badge` | 9999px (pill) | badge "อุปกรณ์นี้" |
| `size.auth-card.max-w` | 400px | max-width auth card (web); mobile ไม่ใช้ (เต็มจอ) |
| `size.tap-target.min` | 44px | ปุ่ม/icon-button ขั้นต่ำ (mobile tap, ปุ่มตาแสดง/ซ่อนรหัสผ่าน) |

### 1.4 Elevation

| Token | ค่า | ใช้ที่ไหน |
|---|---|---|
| `elevation.card` | `0 1px 3px rgba(16,24,40,.10), 0 1px 2px rgba(16,24,40,.06)` | auth card shadow เบา (web); mobile = ไม่มี (full-screen ไม่มี card) |
| `elevation.dialog` | `0 20px 24px -4px rgba(16,24,40,.10), 0 8px 8px -4px rgba(16,24,40,.04)` | `ConfirmDialog` (web modal); mobile bottom-sheet ใช้ elevation ตาม native pattern (F-006) |
| `elevation.toast` | `0 8px 16px -4px rgba(16,24,40,.14)` | toast (web) |

> **breaking-change policy:** ตาราง §1.1–§1.4 คือค่ากลาง ถ้าจะเปลี่ยนแบบ breaking (rename/ลบ role,
> เปลี่ยนความหมาย) → ux แจ้ง frontend + log `D-XXX` ใน [DECISIONS.md](DECISIONS.md) ตาม §6.

### 1.5 Token → Tailwind theme mapping (web, D-020)

> `frontend` note (implementation detail, values still owned by `ux` — §1.1–§1.4 is
> the source of truth; this table only records *how* those values are wired into
> Tailwind v4). apps/web migrated from plain CSS custom properties + inline
> `style` to Tailwind v4 + shadcn/ui (D-020) — same token values, same semantic
> names, now expressed as a Tailwind v4 CSS-first `@theme` block
> (`apps/web/src/styles/tokens.css`) so every token doubles as a utility class.
> No value changed in this migration.

Tailwind v4 resolves theme keys by **CSS variable prefix**, so each §1 namespace maps to a
specific `--<prefix>-*` key and a family of utilities:

| design-system namespace | `@theme` key | Tailwind utility example |
|---|---|---|
| `color.*` | `--color-*` | `bg-primary`, `text-danger-text`, `border-warning-border` |
| `type.heading.md` / `.sm`, `type.body.md` / `.sm`, `type.label.sm`, `type.button.md` | `--text-*` (+ paired `--text-*--line-height`, `--text-*--font-weight`) | `text-heading-md`, `text-body-sm` (sets font-size + line-height + weight together) |
| `type.numeric.tabular` | n/a — kept as the existing `.tabular-nums` utility class (Tailwind's built-in `font-variant-numeric` utility) | `tabular-nums` |
| `space.form.gap`, `space.card.padding`, `space.screen.padding` | `--spacing-form-gap`, `--spacing-card-padding`, `--spacing-screen-padding` (named `--spacing-*` keys) | `mb-form-gap`, `p-card-padding` |
| `space.1`…`space.8` (generic 4-pt gaps not covered by a named alias above) | Tailwind's built-in numeric `--spacing` multiplier (4px) already matches this grid 1:1 | `p-3` = `space.3` (12px), `gap-4` = `space.4` (16px), … |
| `radius.button`, `radius.card`, `radius.badge` | `--radius-button`, `--radius-card`, `--radius-badge` | `rounded-button`, `rounded-card`, `rounded-badge` |
| `size.auth-card.max-w`, `size.tap-target.min` | plain `--size-*` custom properties (not a Tailwind-recognized prefix — referenced via arbitrary values) | `max-w-[var(--size-auth-card-max-w)]`, `min-h-[var(--size-tap-target-min)]` |
| `elevation.card`, `elevation.dialog`, `elevation.toast` | `--shadow-card`, `--shadow-dialog`, `--shadow-toast` | `shadow-card`, `shadow-dialog`, `shadow-toast` |
| Skeleton shimmer (§2) | `--animate-shimmer` (kept as its own named animation — Tailwind's built-in `animate-pulse` uses a different 2s/cubic-bezier timing, which would have changed the value) | `animate-shimmer` |

Naming stays 1:1 with §1's `namespace.role[.variant]` convention (`color.warning.bg` →
`--color-warning-bg` → `bg-warning-bg`), so a token gap is still a gap to raise with `ux`
(§6) — the Tailwind layer never invents an off-token utility or a hardcoded arbitrary value
in component code.

shadcn/ui primitives are added under `apps/web/src/components/ui/` as needed (`cn()` helper at
`components/ui/utils.ts`, kept out of `src/lib/**` since that directory is reserved for
security/business logic — token-store, auth-client, csrf, validation). `ConfirmDialog` stays a
hand-rolled overlay rather than the Radix `<Dialog>` primitive — its existing focus/Escape/role
wiring already satisfies every a11y + test requirement, and swapping it was out of scope for a
mechanical restyle.

## 2. UI states มาตรฐาน (ทุกจอต้องมีครบ)
ทุกหน้าจอออกแบบครบ 4 state ไม่ใช่แค่ตอนมีข้อมูล:

| state | มาตรฐาน |
|---|---|
| **loading** | **Skeleton shimmer** (reusable widget) — *ไม่ใช่ spinner* |
| **empty** | ข้อความ + CTA เริ่มต้น (เช่น "ยังไม่มีสินค้า เริ่มเพิ่มชิ้นแรก") |
| **error** | ข้อความ (จาก error mapping i18n) + ปุ่ม "ลองใหม่" |
| **success/data** | แสดงข้อมูลปกติ |

> Skeleton shimmer = มาตรฐาน loading **ทั้ง web + mobile** · F-006 ทำเป็น reusable widget ใน shell ให้ทุกจอเรียกใช้

## 3. i18n (internationalization)
- UI copy = **i18n key** (ไม่ใช่ string ตายตัว) · **default ไทย** · ผู้ใช้สลับภาษาเองใน settings (ไม่ auto-detect)
- **ไทยครบก่อน** · อังกฤษเติม progressive (forward-commitments)
- error message ก็เป็น i18n key (ดู error mapping ใน F-006)
- เจ้าของ copy = ux (ผลิตเป็น key + คำแปล) — frontend แค่ประกอบ

## 4. หลักที่ UI ต้องเคารพ (จาก WEB_TEAM Gate D)
- ครบทุก state + Thai copy ชัดเจน
- UI ไม่บิดความจริงของโมเดล (เช่น SellableSku ไม่ทำให้ดูเหมือนมีสต๊อกเอง)
- ไม่มี money math บน float ฝั่ง client — แสดงค่าที่ server คำนวณ

## 5. FeatureGate (tier paywall) — ดู F-007
- component กลาง `<FeatureGate feature>` — feature ที่ tier ไม่มี → โชว์+ล็อก+ปุ่มอัปเกรด (ไม่ซ่อน)
- visual ของ paywall/lock state = งาน ux (Gate 2)

## 6. Reuse-first & contribute-back (central design system)
design system นี้เป็นของ **กลาง 1 ชุด ไม่ใช่ต่อ feature** — โตขึ้นเรื่อย ๆ
- **แหล่งความจริงเดียว:** Claude Design project (visual) + ไฟล์นี้ (spec/usage) + `thai-ux` tokens (code) — ux ดูแลให้ sync กัน
- **reuse-first:** ทุก feature เช็ค component/token ที่ reuse ได้ก่อน — ห้ามสร้างซ้ำ/one-off
- **contribute-back:** ต้องการของใหม่ → ux เพิ่มเข้า design system กลาง (ไม่ฝังเฉพาะ feature) → feature หลัง reuse
- task design ใน Gate 2 มี 2 แบบ: `reuse` หรือ `add ใหม่เข้า design system`
- token เปลี่ยนแบบ breaking → ux แจ้ง frontend + log `D-XXX` ใน [DECISIONS.md](DECISIONS.md)
- **Claude Design → Flutter:** port ได้แค่ token; component HTML ต้องแปลเป็น Flutter widget เอง
