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
> **แบรนด์: "Calm Teal (deep)"** — เขียว-teal เข้ม (เชื่อใจ+calm) + apricot อุ่น (เป็นมิตร) บนพื้น
> near-neutral · เคาะ 2026-07-19 จาก mockup [mockup/foundation.html](mockup/foundation.html) (ทิศทาง E) →
> D-026 · แทนที่ชุดฟ้า `#1F6FEB` เดิม (F-000/F-001) — โค้ด F-001 ต้อง refactor ตาม (Phase 2)

| `color.primary` | `#0C6155` | ปุ่มหลัก (light), ลิงก์, focus ring (แบรนด์ teal เข้ม) |
| `color.primary.fg` | `#FFFFFF` | ตัวอักษรบนปุ่มหลัก |
| `color.primary.hover` | `#094E45` | hover/pressed ปุ่มหลัก |
| `color.accent` | `#F2A65A` | เน้น "มูลค่า/เงิน" · highlight (apricot อุ่น) |
| `color.accent.soft` | `#FBEBD6` | พื้น chip/แถบเน้นอ่อน |
| `color.accent.text` | `#9A631A` | ตัวอักษรบนพื้น accent อ่อน (ผ่าน AA) |
| `color.danger` | `#C0362C` | ปุ่ม destructive, border field ผิด |
| `color.danger.fg` | `#FFFFFF` | ตัวอักษรบนปุ่ม destructive |
| `color.danger.bg` | `#FBEDEB` | พื้น `ErrorBanner` |
| `color.danger.border` | `#EAB6B0` | เส้นขอบ `ErrorBanner`, field ผิด |
| `color.danger.text` | `#8F291F` | ตัวอักษรใน `ErrorBanner` (บนพื้นอ่อน — ผ่าน AA) |
| `color.warning` | `#B5730E` | ไอคอน/เส้น warning เข้ม |
| `color.warning.bg` | `#FBF1DF` | พื้น `ThrottleBanner` — "รอได้ ไม่ใช่หายนะ" |
| `color.warning.border` | `#EBCB8A` | เส้นขอบ `ThrottleBanner` |
| `color.warning.text` | `#7E5008` | ตัวอักษร/countdown ใน `ThrottleBanner` (ผ่าน AA) |
| `color.success` | `#2F7D57` | ไอคอน success เข้ม |
| `color.success.bg` | `#E7F3EC` | พื้น toast สำเร็จ |
| `color.success.border` | `#B7DCC6` | เส้นขอบ success |
| `color.success.text` | `#1F5D3D` | ตัวอักษร/ไอคอน toast สำเร็จ |
| `color.badge.current.bg` | `#E7F3EC` | พื้น badge "อุปกรณ์นี้" |
| `color.badge.current.text` | `#1F5D3D` | ตัวอักษร badge "อุปกรณ์นี้" |
| `color.surface` | `#FFFFFF` | พื้น card ฟอร์ม, row session, dialog |
| `color.surface.muted` | `#E7EFEC` | พื้นรอง (skeleton base, hover row) |
| `color.bg` | `#F3F7F5` | พื้นหลังหน้า (behind card, web) |
| `color.text` | `#112320` | ตัวอักษรหลัก (heading/body) |
| `color.text.muted` | `#566B65` | helper text, last-active, subtitle |
| `color.border.default` | `#CFDCD7` | field border ปกติ, เส้นคั่น row |
| `color.overlay` | `#0B1614` @ 45% | ฉากมืดหลัง modal (web) |

### 1.1b Color — Dark theme (semantic roles เดียวกัน, ค่าต่าง)

> ธีมมืดเปิดผ่าน `prefers-color-scheme` + toggle (`data-theme`) · พื้น **neutral charcoal** (ไม่อมเขียว
> จัด) เพื่อให้ปุ่ม/สีแบรนด์ป็อป · status ปรับให้อ่านบนพื้นมืด

| Token | Hex (dark) | หมายเหตุ |
|---|---|---|
| `color.primary` | `#2FBBA6` | ลิงก์/focus/ไอคอน/โลโก้บนพื้นมืด (สว่างพอให้อ่านออก — **ไม่ใช่สีปุ่ม**, ดู §1.1c) |
| `color.primary.hover` | `#45C7B3` | hover ลิงก์/ghost |
| `color.accent` | `#EEB073` | highlight/chip (apricot หรี่) |
| `color.accent.soft` | `#33291B` | พื้น chip เน้นอ่อน |
| `color.accent.text` | `#F1C48C` | ตัวอักษรบน accent.soft |
| `color.danger` / `.bg` / `.border` / `.text` | `#E9897F` / `#2C1A18` / `#5A322D` / `#F0A79E` | error (dark) |
| `color.warning` / `.bg` / `.border` / `.text` | `#E0B25A` / `#2A2213` / `#544321` / `#EBC981` | throttle (dark) |
| `color.success` / `.bg` / `.border` / `.text` | `#6FC194` / `#16261D` / `#2C4636` / `#8FD3AD` | success (dark) |
| `color.surface` | `#212423` | พื้น card/dialog |
| `color.surface.muted` | `#2A2D2C` | พื้นรอง |
| `color.bg` | `#171918` | พื้นหลังหน้า (neutral charcoal) |
| `color.text` | `#E9EEEB` | ตัวอักษรหลัก |
| `color.text.muted` | `#98A29D` | helper/subtitle |
| `color.border.default` | `#363A38` | เส้นคั่น/field border |

### 1.1c Interaction tokens (ปุ่ม — token แยกจาก `color.primary`)

- **ปุ่มหลักมี token ปุ่มของตัวเอง** (`btn.bg`/`btn.fg`/`btn.hover`/`btn.border`/`btn.shadow`) เพราะบนพื้นมืด
  `color.primary` ต้องสว่าง (สำหรับตัวอักษร/ลิงก์) แต่ปุ่มต้องเข้มทึบ:
  - **light:** `btn.bg = color.primary` (`#0C6155`) · `btn.fg = #FFFFFF` (fallback — ไม่ override)
  - **dark:** `btn.bg = #0A5A45` (เขียวป่าลึก solid) · `btn.hover = #0C6B52` · `btn.fg = #FFFFFF` ·
    `btn.shadow = 0 3px 8px rgba(0,0,0,.55)` (ยกตัวจากการ์ด — **ไม่ใช้ขอบมินต์สว่าง** กันดูพาสเทล)
- **ปุ่มรอง/outline border** = `color-mix(in srgb, color.text.muted 60%, color.border.default)` ทั้ง 2 ธีม —
  border.default เดี่ยว ๆ (contrast ~1.35 vs surface) จางเกินสำหรับปุ่ม; mix นี้ผ่าน ~3:1 ทั้ง light/dark
- **ปุ่ม destructive มี token แยกเช่นกัน** (`btn.danger.bg`/`.hover`) เพราะ `color.danger` ในโหมดมืดเป็นสี
  สว่าง (salmon สำหรับ icon/text) ใช้เป็นพื้นปุ่มจะดูซีด:
  - **light:** `btn.danger.bg = #C0362C` (= color.danger)
  - **dark:** `btn.danger.bg = #A32D22` (แดงอิฐเข้ม solid) + `btn.fg = #FFFFFF` (white 7.1:1) + `btn.shadow`
    (โครงเดียวกับปุ่มหลัก dark — solid + เงา ไม่ใช้ขอบสว่าง)
- **WCAG:** ทุกคู่ fg-on-bg + ปุ่ม fill vs surface ผ่าน AA · ข้อยกเว้นจงใจ: ปุ่ม dark เข้มสุด boundary
  ~1.9:1 vs surface อาศัย shadow + label ขาว (8.2:1) พยุง (เป็น design intent ไม่ใช่ bug)

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
| **loading** | **Skeleton shimmer** (reusable widget) — *ไม่ใช่ spinner* · แถบไล่แสง (`shimmerHi` เหนือ `surface.muted`) **วิ่งผ่าน** (ไม่ใช่ opacity pulse — มองไม่เห็นว่า animate) · โครง skeleton **ตาม layout จริงของจอนั้น** |
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

## 7. ScreenHeader / AppBar (nav shell)

> **เจ้าของ implement = F-006** (navigation shell: go_router + AppBar + back + deep link — mobile.md §3.5)
> · spec นี้ออกแบบ **ล่วงหน้า** ให้ DS ครบ + กัน "จอย่อยไม่มีปุ่ม back" (F-001 เป็น placeholder inline flow
> ยังไม่มี chrome นี้) · mockup: [mockup/components.html](mockup/components.html) §09

- **สูง 56px** · พื้น `color.surface` · เส้นล่าง `color.border.default` · icon-button (back/action) **tap 44px**
- **title** = `type.heading.sm` (18/28/600) ชิดซ้าย · **back** = ไอคอนลูกศรซ้าย ชิดซ้ายสุด สี `color.text`
- **กติกา:** ทุก **จอย่อย (pushed route) ต้องมี back ซ้ายเสมอ** · จอ **root** (tab หลัก) ไม่มี back — โชว์แบรนด์/หัวข้อ
  + action ขวา (ถ้ามี เช่น help/เมนู)
- ทั้ง web/mobile ใช้ visual language เดียวกัน (web = header bar, mobile = AppBar) · F-006 สร้างเป็น
  reusable shell widget ให้ทุกจอเรียก แล้ว contribute-back component นี้เข้า DS

## 8. Responsive (web) — desktop-first → tablet

> posture (เคาะ 2026-07): web = **admin console จอใหญ่** (mobile app = client on-the-go) →
> **desktop-first + รองรับลงถึง tablet (~768px) · phone browser ไม่อยู่ใน scope** (คนใช้มือถือ → ใช้แอป)
> · web track **restart** implement ตามนี้ · mobile app (Flutter) ไม่เกี่ยว (จอเดียว native)

### 8.1 Breakpoints (align Tailwind default → frontend ใช้ `md:`/`lg:`/`xl:` ได้ตรง)

| token | ค่า | ช่วง | design target |
|---|---|---|---|
| (base) | `<768px` | phone browser | **out of scope** — ต้องไม่พังยับ แต่ไม่ optimize |
| `bp.md` | `768px` | tablet | รองรับ (condensed) |
| `bp.lg` | `1024px` | desktop | layout หลัก (เต็มรูป) |
| `bp.xl` | `1280px` | wide desktop | cap ความกว้างเนื้อหา |

- `size.content.max-w` = **1280px** (เนื้อหา centered; page เต็มกว้าง + padding)
- page padding: `space.6` (24px) ที่ ≥lg · `space.4` (16px) ที่ md

### 8.2 กติกา responsive ต่อ component (desktop → tablet)

| component | desktop (≥lg) | tablet (md 768–1023) |
|---|---|---|
| **AppShell nav** (org switcher + เมนู) | sidebar ถาวรซ้าย | ยุบเป็น top bar + drawer (hamburger) |
| **DataTable** | คอลัมน์เต็ม | `overflow-x:auto` ในกรอบ (เลื่อนแนวนอน) — คอลัมน์คีย์คงไว้ |
| **Form** | 1–2 คอลัมน์ตามเหมาะ | 1 คอลัมน์ |
| **Auth card** | centered `size.auth-card.max-w` (400px) | เหมือนกัน (ใช้ได้ทุกกว้าง) |
| **Header/ScreenHeader** (§7) | full bar | เหมือนกัน |

- **ทุกจอห้าม body scroll แนวนอน** — เนื้อกว้าง (table/chart/code) อยู่ในกรอบ `overflow-x:auto` ของตัวเอง
- **mockup ตั้งแต่นี้ไป: เช็ค responsive อย่างน้อย 2 จุด (desktop + tablet) ก่อน sign-off** (กัน gap แบบที่เพิ่งเจอ)
