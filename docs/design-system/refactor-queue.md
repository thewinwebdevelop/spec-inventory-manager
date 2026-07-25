# Design-system → code refactor queue (D-026)

> คิวงานเอา **design system ใหม่ "Calm Teal (deep)"** (เคาะจาก mockup — [foundation](mockup/foundation.html) +
> [components](mockup/components.html)) ลงโค้ดจริง web/mobile ให้ตรงกัน · source of truth = [../design-system.md](../design-system.md) §1
> · อัปเดตสถานะเมื่อทำเสร็จ (`todo→done`) · **web = พักรอ restart** (apps/web/CLAUDE.md — mobile-parity-first)

## สถานะต่อ element × platform

| Design element | design-system.md | web | mobile | หมายเหตุ |
|---|---|---|---|---|
| Color tokens (teal E) — light | ✅ §1.1 | ✅ tokens.css | ✅ AppColors | — |
| Dark theme (neutral charcoal) | ✅ §1.1b | 🅦 restart | ✅ AppColorsDark + ThemeExtension | web dark ยกไป restart |
| Accent (apricot) | ✅ §1.1 | ✅ | ✅ | additive |
| Primary button — light | ✅ §1.1c | ✅ | ✅ | btn = primary |
| Primary button — **dark** (เขียวเข้ม `#0A5A45` solid + เงา) | ✅ §1.1c | 🅦 restart | ✅ `btn.*` tokens | — |
| Outline/secondary button border (`mix(text-muted 60%, border)`) | ✅ §1.1c | 🅦 restart | ✅ `outlinedButtonTheme` (btnBorder) | — |
| **Destructive button — dark** (แดงเข้ม `#A32D22` solid + เงา) | ✅ §1.1c | 🅦 restart | ✅ `btnDanger*` → confirm_dialog + session_list | DS-Q1 done 2026-07-21 |
| **Skeleton = sweeping shimmer** (แถบไล่แสงวิ่ง, ไม่ใช่ opacity pulse) + โครงตาม layout | ✅ §2 | 🅦 restart | ✅ skeleton.dart (gradient sweep + row-shaped) | DS-Q2 done 2026-07-21 |
| PasswordField show/hide toggle (eye/eye-off) | ✅ | 🅦 restart | ✅ มีอยู่แล้ว | — |
| **ScreenHeader / AppBar (+back)** — nav shell | ✅ §7 (spec ล่วงหน้า) | ⏳ F-006 | ⏳ **F-006** | จอย่อยยังไม่มี back (F-001 = inline flow); shell จริง = F-006 (go_router) → contribute-back component เข้า DS ตอนนั้น · mockup §09 |
| **Responsive (web)** — desktop-first → tablet | ✅ §8 (breakpoint + กติกา) | ⏳ **web restart** | n/a (native จอเดียว) | scope เคาะ: รองรับ ≥768px (tablet), phone browser out-of-scope · AppShell/DataTable/Form มีกติกา md/lg แล้ว |
| Typography (Sarabun) · spacing (4-pt) | ✅ §1.2/1.3 | ✅ | ✅ | ไม่เปลี่ยน |

`✅ done` · `⏳ todo` · `🅦 web restart` (queued, apps/web จ่อ refactor ใหญ่ — ทำพร้อมกันตอน restart)

## คิวงาน — ทำได้เลย (mobile track, priority)

> ทุก task ทำแบบ TDD + `flutter analyze`/`test`/boundary gate เขียวก่อนปิด (D-014)
> **✅ DS-Q1–Q3 เสร็จแล้ว 2026-07-21** (analyze clean · flutter test 229/229) — mobile ตรง mockup ครบ

1. **DS-Q1 · Destructive button dark**
   - design-system.md §1.1c: เพิ่ม `btn.danger.bg` (light `#C0362C` · dark `#A32D22`) + hover + เงา (reuse `btn.shadow`)
   - mobile: `AppColorsX`/`AppColorsDark` เพิ่ม `btnDanger*` → `confirm_dialog.dart` (destructive) + `session_list.dart` (logout-all) ใช้ token นี้แทน `danger`
   - test: dark destructive ใช้ btnDanger (widget/theme test)
2. **DS-Q2 · Skeleton sweeping shimmer**
   - design-system.md §2: อัปเดตนิยาม skeleton = แถบไล่แสงวิ่งผ่าน (`--shimmer-hi`) + โครงตาม layout ของแต่ละจอ
   - mobile: `skeleton.dart` เปลี่ยน `FadeTransition` opacity → `AnimatedBuilder` + `ShaderMask`/gradient sweep (`LinearGradient` เลื่อน) · `SessionListSkeleton` ให้โครงตามแถวจริง (วงกลม + 2 บรรทัด)
   - test: widget test skeleton animate + โครงถูก
3. **DS-Q3 · Outline button border**
   - mobile: `OutlinedButton` theme ใช้ border = `mix(textMuted 60%, borderDefault)` (§1.1c) แทน default — confirm_dialog + session_list_item

## คิวงาน — web (queued, ทำตอน restart)

- ทั้งหมดข้างบน (DS-Q1–Q3) + **dark theme เต็มชุด** (dark token override + toggle + `btn.*` ใน `tokens.css`)
- ผูกกับ [../architecture/refactor-plan.md](../architecture/refactor-plan.md) §5 (web restart) — เพิ่ม "adopt design-system dark + component deltas (D-026)" เป็น task ของ restart

## อ้างอิง
- decision: [../DECISIONS.md](../DECISIONS.md) D-026 · tokens: [../design-system.md](../design-system.md) §1
- mockups: [foundation.html](mockup/foundation.html) · [components.html](mockup/components.html)
