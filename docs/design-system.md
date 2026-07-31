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

### 1.0 กติกาเชิงโครงสร้างของ theme (บังคับ — D-031 ข้อ 7)

> ที่มา: **บั๊กจริงที่เจอตอนรีวิว mockup F-002** ไม่ใช่กฎเชิงทฤษฎี — ทั้งสองข้อล้มแบบ "เงียบ"
> (ไม่มี error, เห็นก็ต่อเมื่อเปิดของจริงดู) จึงต้องเป็นกฎของ design system ไม่ใช่การแก้ทีละจุด

1. **theme token + base style (font / color / background) ต้องประกาศที่ `:root` / `body` เท่านั้น — ห้ามผูกไว้กับ container ของหน้า**
   modal / toast / dropdown / sheet ที่ portal ออกไป `document.body` (Next.js `createPortal`, Radix Portal)
   หรือ Flutter `Overlay` **อยู่นอก subtree ของ container** ⇒ หลุด font/สี/ธีมทันที
   (ของจริงที่เจอ: dialog ได้ฟอนต์ Times + ตัวอักษรสีดำ + token ชุด dark โผล่บนหน้า light)
2. **สลับธีมด้วย `data-theme` ที่ `<html>`** ไม่ใช่ที่ wrapper · บล็อกที่ต้องล็อกธีมเฉพาะจุด (เช่น ตัวอย่างสี
   ในเอกสาร) ต้อง **substitute token ใหม่ที่ตัวมันเอง** — `color` สืบทอดลงมาเป็น **ค่า computed** ไม่ใช่ `var()`
   ที่จะ resolve ใหม่ตามบริบท
3. **utility ที่แปลว่า "ซ่อน" ต้องชนะเสมอ** — ถ้ากฎอื่นที่ specificity เท่ากันประกาศทีหลัง จะทับได้เงียบ ๆ
   (ของจริง: `.hidden` ประกาศก่อน `.modal` ⇒ ซ่อน modal ไม่ได้เลย และไม่มีสัญญาณเตือนอะไรทั้งสิ้น) ·
   web/Tailwind = ระวังลำดับ `@layer` · Flutter = **ใช้เงื่อนไขตอน build widget** ไม่ใช่ `opacity: 0`/`Visibility` ซ้อนกัน

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
| `color.info.bg` | `#E7EFEC` | พื้น `Banner` tone **info** — "กลาง / ให้ข้อมูล" ไม่ใช่สีสถานะ |
| `color.info.border` | `#CFDCD7` | เส้นขอบ `Banner` tone info |
| `color.info.text` | `#112320` | ตัวอักษรใน `Banner` tone info (= ข้อความปกติ โดยเจตนา) |
| `color.badge.current.bg` | `#E7F3EC` | พื้น badge "อุปกรณ์นี้" |
| `color.badge.current.text` | `#1F5D3D` | ตัวอักษร badge "อุปกรณ์นี้" |
| `color.badge.neutral.bg` | `#E7EFEC` | พื้น `Badge` variant `neutral` (สถานะเป็นกลาง เช่น "ยกเลิกแล้ว") |
| `color.badge.neutral.text` | `#566B65` | ตัวอักษร `Badge` variant `neutral` |
| `color.surface` | `#FFFFFF` | พื้น card ฟอร์ม, row session, dialog |
| `color.surface.muted` | `#E7EFEC` | พื้นรอง (skeleton base, hover row) |
| `color.bg` | `#F3F7F5` | พื้นหลังหน้า (behind card, web) |
| `color.text` | `#112320` | ตัวอักษรหลัก (heading/body) |
| `color.text.muted` | `#566B65` | helper text, last-active, subtitle |
| `color.border.default` | `#CFDCD7` | field border ปกติ, เส้นคั่น row |
| `color.overlay` | `#0B1614` @ 45% | ฉากมืดหลัง modal (web) |

> **`color.info.*` เป็น role แยก ทั้งที่ค่าเท่ากับ `surface.muted` / `border.default` / `text` โดยเจตนา** —
> เพื่อให้เปลี่ยนหน้าตาแถบ info ทีหลังได้โดยไม่ลาก `surface.muted` ทั้งระบบไปด้วย ·
> **ไม่ใช้สีฟ้าเป็น info** แบบ UI kit ทั่วไป เพราะฟ้าจะแข่งกับ teal ที่เป็นสีแบรนด์ และ palette Calm Teal
> ไม่มีฟ้าอยู่เลย · แถบ info = ข้อมูลเสริม **ไม่ควรแย่งความสนใจกับเนื้อหาหลัก** (D-031 ข้อ 6)

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
| `color.info.bg` / `.border` / `.text` | `#2A2D2C` / `#363A38` / `#E9EEEB` | `Banner` tone info (dark) — เป็นกลาง ไม่ใช่สีสถานะ |
| `color.badge.neutral.bg` / `.text` | `#2A2D2C` / `#98A29D` | `Badge` variant `neutral` (dark) |
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

> ⛔ **หมายเหตุกันเข้าใจผิด (อย่า "แก้" ให้เท่ากัน):** `color.primary` (ลิงก์ / ไอคอน / focus ring) กับ
> `btn.bg` (พื้นปุ่มหลัก) **เท่ากันในธีมสว่าง (`#0C6155`) แต่ต้องต่างกันในธีมมืด** (`#2FBBA6` vs `#0A5A45`) —
> วัดแล้ว: บังคับให้เท่ากันในธีมมืดจะได้ผลลัพธ์อย่างใดอย่างหนึ่งที่ยอมรับไม่ได้ คือ **ลิงก์ contrast 1.91:1**
> (อ่านไม่ออก) หรือ **ปุ่มมิ้นต์พาสเทลที่ D-026 ปฏิเสธไปแล้ว** · นี่คือเจตนาของ D-026 ไม่ใช่ความไม่สอดคล้อง

#### 1.1c-1 Focus ring (D-031 ข้อ 4)

| token / กติกา | ค่า |
|---|---|
| `focus.ring.color` | `color.primary` (light `#0C6155` · dark `#2FBBA6`) |
| `focus.ring.w` | `2.5px` |
| `focus.ring.offset` | `2px` — **จำเป็น** เพราะปุ่มหลักมีพื้นเป็น `color.primary` สีเดียวกับ ring; offset 0 = ring หายกลืนไปกับพื้นปุ่ม |
| แสดงเมื่อไหร่ | **`:focus-visible` เท่านั้น** (คลิกเมาส์ไม่ขึ้น ring) · Flutter = `FocusableActionDetector` / `WidgetState.focused` ที่มาจาก **keyboard traversal** — พฤติกรรมเดียวกัน |
| ⛔ ห้าม | ใช้ ring แทนการทำ "ปุ่มเด่น" · โชว์ ring ค้าง · ลบ ring ทิ้งโดยไม่ใส่ของแทน · **ลำดับความสำคัญของปุ่มสื่อด้วย `variant` เท่านั้น** |
| mockup | ห้ามวาด ring ค้างในภาพนิ่ง — ใช้ป้ายกำกับ "ภาพจำลอง `:focus-visible`" คู่กับภาพสถานะพัก |

#### 1.1c-2 ปุ่ม/ลิงก์ที่อยู่ **ใน** `Banner` — ใช้โทนของกล่องนั้น (D-031 ข้อ 3)

> ที่มา: ปุ่ม "ลองใหม่" ใน `ErrorBanner` เดิมเป็น outline โทนกลาง (ตัวอักษร `color.text` + ขอบเทา) วางบนพื้น
> `danger.bg` ⇒ ดูเหมือนของที่ลอยมาจากที่อื่น ไม่ใช่ส่วนหนึ่งของกล่อง

| กติกา | ค่า |
|---|---|
| ตัวอักษรปุ่ม | `currentColor` = `<tone>.text` ของ banner นั้น (danger `#8F291F` / warning `#7E5008` / success `#1F5D3D` / info `color.text`) |
| ขอบปุ่ม | `color-mix(in srgb, currentColor 65%, transparent)` — ผ่าน ≥3:1 บนพื้น `<tone>.bg` ทั้ง light + dark (ตรวจแล้ว) · สูตรเดียวกับปุ่ม outline ด้านบน แต่ยึดกับ fg ของ tone แทน `text.muted` |
| hover | ขอบ `currentColor` เต็ม + พื้น `color-mix(in srgb, currentColor 10%, transparent)` |
| ⛔ ห้าม | ปุ่ม fill (`primary` / `destructive`) ในกล่องโทน **danger / warning / success** — แย่ง hierarchy กับปุ่มหลักของจอ และสีปุ่มชนกับพื้นสถานะ |
| ยกเว้น | กล่องโทน **info** (เป็นกลาง) ใช้ปุ่ม `primary` ได้ **1 ปุ่ม** ถ้าเป็น CTA หลักของการ์ดนั้น · ถ้าเป็นแค่คำแนะนำ ใช้ `secondary` / `tertiary` |

#### 1.1c-3 `Button` — variant / size / state (D-031 ข้อ 2 + 5)

| variant / size | Visual spec (token เท่านั้น) | ใช้เมื่อไหร่ |
|---|---|---|
| `size="md"` (default) | `type.button.md` (16/24/600) · padding `space.3` / 18px · **min-height `size.tap-target.min` (44px)** | ปุ่มทั่วไป |
| `size="sm"` | **`type.button.sm` (14/20/600)** · padding แนวนอน `space.3` (12px) · **min-height ยังเป็น 44px** | ปุ่มรองในแถวรายการ / แถวข้อมูล / กล่องสถานะ ที่ต้องไม่แย่งสายตาปุ่มหลักของจอ |
| `variant="tertiary"` | ไม่มีพื้น/ไม่มีขอบ · ตัวอักษร **`color.primary` เสมอ** (ห้าม `text.muted`) · `type.button.sm` · **hover/focus = พื้น `surface.muted` — ห้ามขีดเส้นใต้** · padding ข้าง `space.2` · **min-height 44px** | การกระทำรองสุด ("ไว้ทีหลัง", "ออกจากร้านนี้", "ใช้บัญชีอื่น") |
| `state="confirmed"` | `success.bg` + `success.border` + `success.text` + ไอคอน `icon.check` — โชว์ ~2 วินาทีแล้วกลับสถานะเดิม | ฟีดแบ็กชั่วคราวหลังกด ("คัดลอกลิงก์" → "คัดลอกแล้ว") |

- ⛔ **`size="sm"` = ความหนาแน่นของ *ตัวอักษรและระยะข้าง* ไม่ใช่พื้นที่แตะ** — ดู `size.tap-target.min` ที่ §1.3
- **`tertiary` ห้ามขีดเส้นใต้ตอน hover** — ปุ่มไม่ใช่ลิงก์ จึงไม่ควรมีสัญญะของลิงก์ · affordance ใช้พื้นหลัง `surface.muted` แทน
- **`Link` ในเนื้อความ (ในย่อหน้า) แยกตัวด้วย `color.primary`** ไม่ใช่เส้นใต้ — ตรงกับ §1.1 ที่ระบุอยู่แล้วว่า
  `color.primary` = สีของลิงก์ · วัดแล้ว: ต่างจากข้อความรอบข้าง 2.22:1 · อ่านบนพื้นกล่อง 6.29:1 (ผ่าน AA) ·
  **`tertiary` ≠ `Link`** — `tertiary` เป็นปุ่มที่ยืนเดี่ยว, `Link` อยู่ในประโยค
- **แถวปุ่มห้ามใช้ negative margin ของ `tertiary`** — margin ติดลบ (ที่มีไว้จัดขอบตัวอักษรเวลาปุ่มอยู่เดี่ยวใน
  คอลัมน์) จะไปกินระยะ `gap` จนปุ่มดูติดกัน (gap 10px − margin 8px = เหลือจริง **2px**) ⇒ ในแถวปุ่มให้
  `margin: 0` + `gap` `space.3` (12px) · **แก้ที่รากแบบนี้ ห้ามชดเชยด้วยการเพิ่ม gap ให้ใหญ่เกินจริง**

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
| `type.button.md` | 16 / 24 / 600 | ตัวอักษรบนปุ่ม (default) |
| `type.button.sm` | 14 / 20 / 600 | ตัวอักษรบนปุ่ม `size="sm"` และ `variant="tertiary"` (§1.1c-3) — **ตัวอักษรเล็กลง ปุ่มไม่เตี้ยลง** |
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
| `size.tap-target.min` | 44px | **ความสูงขั้นต่ำของทุกอย่างที่กดได้** (ดูกติกาใต้ตาราง) |
| `size.dialog.max-w` | 480px | ความกว้างสูงสุดของ dialog / การ์ดกึ่งกลางทั่วไป (web) — **คนละตัวกับ** `size.auth-card.max-w` (400px) |
| `size.sidebar.w` | 240px | sidebar ของ AppShell (web ≥lg) |
| `size.list-row.min-h` | 56px | ความสูงขั้นต่ำของแถวรายการ / แถวเมนู (ทั้ง web + mobile) |
| `size.icon.sm` | 16px | ไอคอนในบรรทัดข้อความ |
| `size.icon.md` | 20px | **ค่า default** — banner, ปุ่ม, แถวรายการ |
| `size.icon.lg` | 24px | nav, AppBar, icon-button |
| `size.icon.xl` | 40px | `EmptyState` (ที่ขนาดนี้ `icon.stroke` ลดเป็น `1.5` กันหนาเกิน) |
| `icon.stroke` | 2 | ความหนาเส้นไอคอน (grid 24) — ดู §1.6 |
| `focus.ring.color` | `color.primary` | สี focus ring (§1.1c-1) |
| `focus.ring.w` | 2.5px | ความหนา focus ring |
| `focus.ring.offset` | 2px | ระยะห่างจากขอบองค์ประกอบ — **ห้ามเป็น 0** (ring จะกลืนกับพื้นปุ่มหลัก) |

> ### ⛔ กติกา tap target — 44px คือขั้นต่ำ **ไม่มีข้อยกเว้น** (D-031 ข้อ 2)
>
> **ทุกองค์ประกอบที่กดได้ ทุก platform ต้องสูง ≥ `size.tap-target.min` (44px)** รวมถึงปุ่มในแถวรายการ,
> icon-button, ปุ่ม `size="sm"`, `variant="tertiary"` และลิงก์ที่ทำหน้าที่เป็นปุ่ม
> - **"ปุ่มเล็ก" = ตัวอักษรและระยะข้างแน่นขึ้น ไม่ใช่เตี้ยลง** — ถ้าต้องการให้ดูเบา ให้ลด `variant`/น้ำหนักสี
>   ไม่ใช่ลดพื้นที่แตะ
> - **ข้อเสนอ "ยกเว้นบริบท pointer-only" ถูกปฏิเสธแล้ว** — web รองรับลงถึง tablet ที่เป็น touch จริง (§8)
>   และ Flutter ใช้ token ชุดเดียวกัน ⇒ ข้อยกเว้นจะรั่วแน่นอน และเป็นข้อยกเว้นที่ทดสอบไม่ได้
> - ที่มา: mockup รอบแรกของ F-002 มี **27 องค์ประกอบกดได้ต่ำกว่า 44px ในจอเดียว** เพราะไม่มีกฎข้อนี้เขียนไว้ ⇒
>   นับ tap target เป็นรายการบังคับในเช็คลิสต์ก่อน sign-off mockup (§8.2)

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

### 1.6 Iconography (D-031 ข้อ 1)

> **ชุดไอคอน = `Phosphor` (MIT) น้ำหนัก `regular`** — เคาะ 2026-07-28 (D-031) ·
> web: `@phosphor-icons/react` · Flutter: `phosphor_flutter`
> **เหตุผลที่เลือกเหนือ Lucide / Material Symbols:** เป็นชุดเดียวที่ **ผู้ดูแลรายเดียวกันทำทั้ง web และ Flutter**
> ⇒ ความเสี่ยง "ไอคอนสองฝั่งไม่ตรงกัน" ต่ำสุด ซึ่งเป็นความเสี่ยงที่แพงที่สุดของโปรเจกต์ที่ ship 2 client จาก
> design system เดียว · มุมโค้งนุ่มเข้ากับโทน "เป็นมิตรกับแม่ค้า" ของ Calm Teal

#### 1.6.1 นโยบายไอคอน (บังคับทุก feature)

| กติกา | ค่า |
|---|---|
| สไตล์ | **outline / stroke เท่านั้น** (Phosphor weight `regular`) — ⛔ ห้าม emoji · ⛔ ห้ามไอคอนทึบ (fill/duotone) · ⛔ ห้ามรูปประกอบสี/ภาพ raster |
| grid / stroke | 24×24 · `icon.stroke` = **2** · cap + join = round |
| ขนาด | `size.icon.sm` 16 · `size.icon.md` **20 (default)** · `size.icon.lg` 24 · `size.icon.xl` 40 (stroke ลดเป็น 1.5) — §1.3 |
| สี | **`currentColor` เสมอ** (รับสีจาก role ของกล่องที่มันอยู่) · ระบุสีเองได้เฉพาะ 2 กรณี: `EmptyState` (`color.text.muted`) และเครื่องหมายสำเร็จเต็มจอ (`color.success`) |
| ความหมาย | **ไอคอนห้ามเป็นตัวสื่อความหมายเดี่ยว ๆ** — ต้องมีข้อความไทยคู่เสมอ · `aria-hidden="true"` เมื่อมีข้อความอยู่แล้ว · `aria-label` **ภาษาไทย** เมื่อเป็น icon-button |
| i18n | **ห้ามฝังสัญลักษณ์ไว้ใน i18n string** — `"+ เชิญสมาชิก"` ผิด · key ต้องเป็น `"เชิญสมาชิก"` แล้วให้ component ใส่ `icon.plus` เอง (ไม่งั้นแปลภาษาอื่นจะลากสัญลักษณ์ไปด้วย และเปลี่ยนชุดไอคอนไม่ได้) |
| ship | web = **component ที่ tree-shake ได้** จาก `@phosphor-icons/react` — ⛔ ไม่ใช้ icon font · ⛔ ไม่ fetch sprite ภายนอก · Flutter = `IconData` จาก `phosphor_flutter` (ชุดเดียวกัน) · mockup = inline SVG ที่วาดตามรูปของชุดนี้ |
| tap | icon-button ต้องสูง ≥ `size.tap-target.min` (44px) แม้ไอคอนข้างในจะ 20–24px (§1.3) |

#### 1.6.2 `icon.<role>` → ชื่อไอคอนจริง (web / Flutter)

> **ux เป็นเจ้าของตารางนี้** — โค้ดอ้าง **role** ไม่ใช่ชื่อไอคอนของ vendor ⇒ เปลี่ยนชุดทีหลังได้โดยจอไม่เปลี่ยนความหมาย
> · Flutter API ที่อ้างถึง = `phosphor_flutter` v2 (`PhosphorIconsRegular.<name>`; รูปแบบ
> `PhosphorIcons.<name>(PhosphorIconsStyle.regular)` ก็ให้ไอคอนตัวเดียวกัน — **ห้ามใช้ style อื่นนอกจาก `regular`**)

| `icon.<role>` | web (`@phosphor-icons/react`) | Flutter (`phosphor_flutter`) | ใช้ที่ไหน |
|---|---|---|---|
| `icon.warn` | `<Warning />` | `PhosphorIconsRegular.warning` | `Banner` tone warning, `ThrottleBanner` |
| `icon.info` | `<Info />` | `PhosphorIconsRegular.info` | `Banner` tone info, helper สำคัญ |
| `icon.error` | `<WarningCircle />` | `PhosphorIconsRegular.warningCircle` | `Banner` tone danger, `ErrorBanner` |
| `icon.check` | `<Check />` | `PhosphorIconsRegular.check` | รายการที่เลือกอยู่, `Button state="confirmed"` |
| `icon.check-circle` | `<CheckCircle />` | `PhosphorIconsRegular.checkCircle` | สถานะสำเร็จ, `Banner` tone success, จอสำเร็จ |
| `icon.mail` | `<Envelope />` | `PhosphorIconsRegular.envelope` | แถวคำเชิญ (อีเมลผู้ถูกเชิญ) |
| `icon.users` | `<Users />` | `PhosphorIconsRegular.users` | เมนู/หัวข้อ "สมาชิก", `EmptyState` ของรายชื่อ |
| `icon.clock` | `<Clock />` | `PhosphorIconsRegular.clock` | เวลา/วันหมดอายุ |
| `icon.hourglass` | `<Hourglass />` | `PhosphorIconsRegular.hourglass` | สถานะ "รอตอบรับ" / รอเวลา |
| `icon.more` | `<DotsThree />` | `PhosphorIconsRegular.dotsThree` | เมนูการกระทำของแถว (`⋯`) |
| `icon.chevron-right` | `<CaretRight />` | `PhosphorIconsRegular.caretRight` | แถวที่กดเข้าไปต่อได้ (`ListRow` slot ขวา) |
| `icon.chevron-down` | `<CaretDown />` | `PhosphorIconsRegular.caretDown` | ตัวเปิด dropdown / org switcher |
| `icon.plus` | `<Plus />` | `PhosphorIconsRegular.plus` | ปุ่มสร้าง/เพิ่ม (เชิญสมาชิก, สร้างร้าน) |
| `icon.circle` | `<Circle />` | `PhosphorIconsRegular.circle` | จุดหัวข้อ/ตัวเลือกที่ยังไม่เลือก (`RadioCardGroup`) |
| `icon.menu` | `<List />` | `PhosphorIconsRegular.list` | hamburger เปิด drawer (tablet) |
| `icon.close` | `<X />` | `PhosphorIconsRegular.x` | ปิด dialog / sheet / แผ่นข้อมูล |
| `icon.lock` | `<Lock />` | `PhosphorIconsRegular.lock` | `EmptyState` preset `ForbiddenPanel`, ของที่ล็อกตาม tier (§5) |
| `icon.copy` | `<Copy />` | `PhosphorIconsRegular.copy` | ปุ่มคัดลอกใน `CopyField` |
| `icon.back` | `<ArrowLeft />` | `PhosphorIconsRegular.arrowLeft` | ปุ่มย้อนกลับของ `ScreenHeader`/AppBar (§7) |
| `icon.eye` | `<Eye />` | `PhosphorIconsRegular.eye` | ปุ่มแสดงค่าที่ถูกปิดบัง (รหัสผ่าน, เลขผู้เสียภาษี) |
| `icon.eye-off` | `<EyeSlash />` | `PhosphorIconsRegular.eyeSlash` | ปุ่มซ่อนค่ากลับ |

- **ต้องการ role ใหม่ = contribute-back** (§6/§9) — เพิ่มแถวในตารางนี้ก่อน แล้วค่อยใช้ · ⛔ ห้าม
  import ไอคอน Phosphor ตรง ๆ ในโค้ด feature โดยไม่มี role · ⛔ ห้ามใช้ไอคอนคนละความหมายกับ role
- ถ้า Phosphor **ไม่มี**ไอคอนที่ตรงกับ role ที่ต้องการ → แจ้ง `@ux` (ห้าม dev เลือกเอง / ห้ามวาดเอง)

## 2. UI states มาตรฐาน (ทุกจอต้องมีครบ)
ทุกหน้าจอออกแบบครบ 4 state ไม่ใช่แค่ตอนมีข้อมูล:

| state | มาตรฐาน |
|---|---|
| **loading** | **Skeleton shimmer** (reusable widget) — *ไม่ใช่ spinner* · แถบไล่แสง (`shimmerHi` เหนือ `surface.muted`) **วิ่งผ่าน** (ไม่ใช่ opacity pulse — มองไม่เห็นว่า animate) · โครง skeleton **ตาม layout จริงของจอนั้น** |
| **empty** | ข้อความ + CTA เริ่มต้น (เช่น "ยังไม่มีสินค้า เริ่มเพิ่มชิ้นแรก") |
| **error** | ข้อความ (จาก error mapping i18n) + ปุ่ม "ลองใหม่" |
| **success/data** | แสดงข้อมูลปกติ |

> Skeleton shimmer = มาตรฐาน loading **ทั้ง web + mobile** · F-006 ทำเป็น reusable widget ใน shell ให้ทุกจอเรียกใช้

- **จอที่โหลดข้อมูลจาก 2 แหล่ง (หรือมากกว่า) บนหน้าเดียว ต้องมี loading + error แยกต่อส่วน** — แหล่งหนึ่งพัง
  ต้องไม่ทำให้ทั้งจอกลายเป็นหน้า error (เช่น หน้าสมาชิก: "คำเชิญที่รอตอบรับ" โหลดไม่ได้ ต้องยังเห็นรายชื่อ
  สมาชิกและทำงานต่อได้) · ปุ่ม "ลองใหม่" อยู่ใน **ส่วนที่พัง** ไม่ใช่ที่หัวจอ
- การกระทำที่มีขอบเขตแค่ปุ่มเดียว (เช่น ขอค่าที่ถูกปิดบัง) ให้แสดง loading/error **ในตัวปุ่มหรือในการ์ดนั้น**
  ไม่ยกทั้งจอเป็น error

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

### 6.1 นิยามของคำว่า **"ประกาศแล้ว"** (D-031 ข้อ 8)

> บทเรียนจาก F-002: mockup สร้าง `btn-sm` · `tlink` · `banner.info` · `focusring` ขึ้นใช้เองโดยไม่ประกาศ ⇒
> ไม่มีใน design system, **ไม่มีใครเป็นเจ้าของค่า** และหลุด review ไปได้เพราะ "บนจอดูดี"

**ถ้า variant / ขนาด / สถานะ / ค่าสี ตัวไหน ไม่มีชื่ออยู่ในไฟล์นี้ = ยังไม่มีเจ้าของ ⇒ ต้อง contribute-back ก่อน sign-off**

- ใช้ได้กับทั้ง **mockup, โค้ด web และโค้ด Flutter** เท่ากันหมด — "มีอยู่ใน mockup แล้ว" ไม่นับว่าประกาศแล้ว
- §9 (Component library) + ตาราง token §1.1–§1.6 คือ **รายชื่อของที่ประกาศแล้วทั้งหมด**
- ต้องการของใหม่ระหว่างทำ mockup/build → หยุด แล้วให้ `@ux` เติมเข้าไฟล์นี้ก่อน (ใช้เวลาไม่กี่นาที ถูกกว่า
  การไล่แก้ทุก feature ที่ลอก pattern ไปแล้ว)

## 7. ScreenHeader / AppBar (nav shell)

> **เจ้าของ implement = F-006** (navigation shell: go_router + AppBar + back + deep link — mobile.md §3.5)
> · spec นี้ออกแบบ **ล่วงหน้า** ให้ DS ครบ + กัน "จอย่อยไม่มีปุ่ม back" (F-001 เป็น placeholder inline flow
> ยังไม่มี chrome นี้) · mockup: [mockup/components.html](mockup/components.html) §09

- **สูง 56px** · พื้น `color.surface` · เส้นล่าง `color.border.default` · icon-button (back/action) **tap 44px**
- **title** = `type.heading.sm` (18/28/600) ชิดซ้าย · **back** = ไอคอนลูกศรซ้าย ชิดซ้ายสุด สี `color.text`
- **กติกา:** ทุก **จอย่อย (pushed route) ต้องมี back ซ้ายเสมอ** (`icon.back`) · จอ **root** (tab หลัก) ไม่มี back — โชว์แบรนด์/หัวข้อ
  + action ขวา (ถ้ามี เช่น help/เมนู)
- **จอ root ของ mobile ที่เป็น org-scoped: title = ชื่อร้าน + `icon.chevron-down` และตัว title ทั้งก้อนคือ
  ตัวสลับร้าน (org switcher)** — แตะแล้วเปิด bottom sheet รายชื่อร้าน · ทำให้ "ตอนนี้อยู่ร้านไหน" อยู่ในสายตา
  ตลอดเวลาโดยไม่กินพื้นที่เพิ่ม และแก้ปัญหาผู้ใช้ทำรายการผิดร้าน · แถบทั้งก้อนต้องสูง ≥ `size.tap-target.min`
  (F-002 เป็นผู้ใช้รายแรก · F-006 เป็นผู้ implement shell)
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
- **mockup ตั้งแต่นี้ไป: เช็ค responsive อย่างน้อย 2 จุด (desktop + tablet) ก่อน sign-off** — ขยายเป็นเช็คลิสต์เต็มที่ **§8.4**

### 8.3 ข้อยกเว้น: route สาธารณะที่เปิดจากลิงก์ในแชต

> phone browser ยัง **out of scope** สำหรับ route ที่ต้องล็อกอิน (คนใช้มือถือ → ใช้แอป) — แต่มีข้อยกเว้นที่ประกาศไว้

- **route สาธารณะที่ผู้ใช้ภายนอกเปิดจากลิงก์ที่ถูกส่งทางแชต (เช่น `/invite` ของ F-002) ต้องออกแบบให้ใช้ได้ดี
  บนเบราว์เซอร์มือถือ** — คนกดลิงก์ยังไม่ใช่ลูกค้าเรา ไม่มีแอป และเปิดจาก LINE เกือบแน่นอน
- กติกาของ route กลุ่มนี้: การ์ดเดียว 1 คอลัมน์ · ปุ่มเต็มความกว้าง · ไม่มี layout 2 คอลัมน์ ·
  ทุกอย่างที่กดได้ ≥ `size.tap-target.min` · ตรวจที่ความกว้าง ~390px ด้วย

### 8.4 เช็คลิสต์ก่อน sign-off mockup (บังคับ)

1. **responsive อย่างน้อย 2 จุด: desktop + tablet** (+ ~390px ถ้าเป็น route ตาม §8.3)
2. **นับ tap target ทุกตัวว่า ≥ 44px** (`size.tap-target.min`) — นับจริง ไม่ใช่กะด้วยตา
   (รอบแรกของ F-002 หลุด **27 จุด** เพราะไม่มีขั้นตอนนี้)
3. **ตรวจครบทั้ง light + dark** (§1.1b) รวม overlay/dialog ที่ portal ออกไป (§1.0 ข้อ 1)
4. **ทุก variant/ขนาด/สถานะ/สีที่ใช้ในภาพ มีชื่ออยู่ใน design system แล้ว** (§6.1) — ถ้าไม่มี ให้ contribute-back ก่อนเซ็น
5. **ไม่มี emoji / ไอคอนทึบ / รูปภาพประกอบ** และไอคอนทุกตัวมาจากตาราง `icon.<role>` (§1.6.2)
6. **ไม่มี focus ring โชว์ค้าง** — ถ้าจะโชว์ต้องกำกับว่า "ภาพจำลอง `:focus-visible`" (§1.1c-1)

## 9. Component library (กลาง) — ทะเบียนของที่ "ประกาศแล้ว"

> ตารางนี้คือ **นิยามของคำว่าประกาศแล้ว** (§6.1) — ของที่ไม่มีชื่อที่นี่ = ยังไม่มีเจ้าของ ⇒ contribute-back ก่อนใช้
> · "feature ต้นทาง" = feature ที่สร้างของชิ้นนี้ขึ้นมาครั้งแรก (ไม่ใช่เจ้าของสิทธิ์ — ของทุกชิ้นเป็นของกลาง reuse ได้ทุก feature)

### 9.1 ของกลาง (reuse ได้ทุก feature)

| Component | feature ต้นทาง | หมายเหตุ / variant ที่ประกาศแล้ว |
|---|---|---|
| `AuthForm` | F-001 | โครงฟอร์ม auth |
| `AuthCard` | F-001 | การ์ดกึ่งกลาง `size.auth-card.max-w` |
| `TextField` | F-001 | label + helper + error inline |
| `PasswordField` | F-001 | ปุ่มตา `icon.eye` / `icon.eye-off` (tap 44px) |
| `Button` | F-001 (+F-002) | variant `primary` / `secondary` / `destructive` / **`tertiary`** · size `md` / **`sm`** · state `loading` / **`confirmed`** (§1.1c-3) |
| `ErrorBanner` | F-001 | = `Banner` tone `danger` เชิง visual — คงชื่อเดิมไว้ |
| `ThrottleBanner` | F-001 | = `Banner` tone `warning` + countdown (`type.numeric.tabular`) |
| `ConfirmDialog` | F-001 (+F-002) | focus trap + Escape = cancel · **`body` รับหลายบรรทัด/รายการ** · **prop `focusCancel`** (default = `variant === "destructive"`) |
| `Skeleton` | F-001 | shimmer วิ่งผ่าน (§2) — ไม่ใช่ spinner |
| `Toast` | F-001 | web = มุมบนขวา · mobile = ล่างจอเหนือ safe-area |
| `SessionListItem` | F-001 | แถวอุปกรณ์ + `color.badge.current.*` |
| `EmptyState` | F-002 | ไอคอน `size.icon.xl` + หัวข้อ + คำอธิบาย + ปุ่ม 0–2 · **preset `ForbiddenPanel`** (`icon.lock`) ใช้กับทุก route ที่ RBAC ปฏิเสธ |
| `Banner` | F-002 | 4 tone: `info` / `warning` / `success` / `danger` · ปุ่มในกล่องใช้โทนของกล่อง (§1.1c-2) |
| `Badge` | F-002 | 4 variant: `success` / `warning` / `neutral` / `danger` · **ต้องมีข้อความไทยเสมอ** (ห้ามสื่อด้วยสีอย่างเดียว) |
| `SectionCard` | F-002 | หัวข้อ + action มุมขวา + แถว label→value |
| `CopyField` | F-002 | read-only + ปุ่ม `icon.copy` + ฟีดแบ็ก `Button state="confirmed"` · ต้องโฟกัส/เลือกข้อความได้ |
| `RadioCardGroup` | F-002 | การ์ดตัวเลือก + คำอธิบาย + disabled พร้อมเหตุผล · แตะได้ทั้งการ์ด (≥44px) |
| `ListRow` | F-002 | avatar/ไอคอน + บรรทัดหลัก/รอง + slot ขวา · สูง ≥ `size.list-row.min-h` |

### 9.2 ของระดับ feature (**ไม่**อยู่ใน DS — ห้าม feature อื่นลากไปใช้ตรง ๆ)

| Component | feature | เหตุผลที่ไม่เข้า DS |
|---|---|---|
| `AppShell` · `OrgSwitcher` | F-002 | org-aware (ผูก `/o/[orgId]`) — ของกลางต้อง org-agnostic |
| `CopyLinkPanel` | F-002 | ผูกกับกติกา "ลิงก์แสดงครั้งเดียว" (D-027) |
| `MemberRow` · `InvitationRow` | F-002 | ผูก schema ของ F-002 (ประกอบจาก `ListRow` + `Badge` ซึ่งเป็นของกลาง) |

- **Claude Design sync (`/design-sync` + `DesignSync`):** push เฉพาะของใน **§9.1** เท่านั้น — ของใน §9.2 ไม่ push
- component ระดับ feature ที่ feature ที่ 2 อยากใช้ = สัญญาณให้ **generalize แล้วย้ายขึ้น §9.1** (ผ่าน `@ux`)
  ไม่ใช่ import ข้าม feature
