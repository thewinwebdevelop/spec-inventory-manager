---
name: thai-ux
description: >-
  Produce OmniStock's Thai UX writing and the shared design-token system. Use
  when writing any user-facing Thai copy (labels, buttons, errors, empty/loading
  states, confirmations), defining terminology, formatting numbers/currency/dates
  for Thai users, or specifying design tokens shared across web (Next.js +
  shadcn/Tailwind) and mobile (Flutter). Owned by ux.
---

# Thai UX writing & design tokens

The target user is a **non-technical Thai shop owner/admin**. Copy must feel
like a calm, competent Thai colleague — clear, polite, concrete. Visuals must be
**identical in meaning across web and mobile** via shared tokens.

## Voice & tone (Thai)
- Plain, friendly, respectful. Use **คุณ**; avoid slang and English jargon when a
  natural Thai word exists.
- Concise and concrete. Say what happened and what to do next.
- Action-oriented buttons: verb-first (**บันทึก**, **เพิ่มสินค้า**, **ซิงก์สต๊อก**),
  not vague (**ตกลง** only for true acknowledgements).
- Never blame the user. Errors describe the problem + the fix.

## Microcopy patterns
| Situation | Pattern (Thai) |
|-----------|----------------|
| Button (primary action) | verb + object — "บันทึกสินค้า", "ออกใบกำกับภาษี" |
| Empty state | what's missing + how to start — "ยังไม่มีสินค้า — เริ่มเพิ่มสินค้าชิ้นแรกได้เลย" |
| Loading | what's happening — "กำลังซิงก์สต๊อกกับ Shopee…" |
| Error (recoverable) | cause + action — "เชื่อมต่อ Shopee ไม่สำเร็จ ลองเชื่อมต่อใหม่อีกครั้ง" |
| Validation | which field + rule — "กรอกจำนวนเป็นตัวเลขจำนวนเต็ม" |
| Destructive confirm | name the consequence — "ลบสินค้านี้? การลบย้อนกลับไม่ได้" + ปุ่ม "ลบ"/"ยกเลิก" |
| Success | concrete result — "ซิงก์สต๊อกเรียบร้อย (12 รายการ)" |

## Domain framing rules (UI must tell the truth of the model)
- **Stock edits = recording a movement**, never "overwriting a number". Frame as
  "ปรับสต๊อก / บันทึกการเคลื่อนไหว" with reason, not an editable balance field.
- **SellableSku has no own stock** — show availability as **computed** ("ขายได้ N
  ชุด (คำนวณจากวัตถุดิบ)"), never as an editable stock field on the sellable.
- **Bundles are virtual** — make clear a set is assembled from components.
- Always within one organization's context.

## Terminology glossary (use consistently — pick one Thai term and keep it)
| Concept | Thai term to use |
|---------|------------------|
| Inventory / stock | สต๊อก |
| Warehouse | คลังสินค้า |
| Product | สินค้า |
| Sellable SKU | รายการขาย (SKU) |
| Bundle / set | ชุดสินค้า |
| Inventory Item (raw) | วัตถุดิบ/ชิ้นส่วน |
| Order | ออเดอร์ / คำสั่งซื้อ |
| Channel / marketplace | ช่องทางขาย / แพลตฟอร์ม |
| Sync | ซิงก์ |
| Cost / COGS | ต้นทุน / ต้นทุนขาย |
| Invoice (tax) | ใบกำกับภาษี |
Keep a living glossary in the spec; never use two different Thai words for the
same concept across screens.

## Formatting for Thai users
- **Currency**: บาท with thousands separators + 2 decimals — "฿1,250.00". Display
  only; never compute money on the client (server sends Decimal).
- **Numbers**: thousands separators; stock is whole numbers.
- **Dates**: Thai-friendly, unambiguous — e.g. "23 มิ.ย. 2026, 14:30". Consider
  Buddhist-era display where users expect it; store/transmit ISO/UTC.
- Pluralization: Thai has no plural inflection — use classifiers ("12 รายการ",
  "3 ชุด").

## Design tokens (single source, two platforms)
Define tokens once; map to both stacks. **No off-token values; web and Flutter
must not drift.**
- **Color**: semantic names (`color.primary`, `color.danger`, `color.surface`,
  `color.text`, `color.muted`, status `success/warning/error/info`). Map to
  Tailwind theme / shadcn CSS vars **and** a Flutter `ThemeData`/`ColorScheme`.
- **Typography**: a Thai-legible font with full Thai glyph coverage; scale
  (`text.xs…2xl`), line-height tuned for Thai ascenders/descenders.
- **Spacing/radius/elevation**: one numeric scale (e.g. 4-pt grid) shared.
- **Components**: shadcn/ui on web; the Flutter equivalent must match token values
  and states (default/hover/focus/disabled/loading) — specify states, not just
  the happy path.

## Accessibility
- Contrast meets WCAG AA on Thai text (small Thai glyphs need extra care).
- Logical focus order, keyboard paths (web), adequate tap targets (mobile).
- Don't encode meaning by color alone — pair with icon/text.

## Output of this skill
A UX/UI spec section the `frontend` agent implements against: flow + Thai copy for
every state + the token set + per-platform notes. If a flow needs data you can't
confirm exists, stop and ask `backend-api` — don't invent fields.

## Friendliness checklist (SME ไทยไม่สาย tech — ผ่านทุกข้อก่อนปิด UX)
Target user = **เจ้าของร้าน/แม่ค้า SME ไทยที่ไม่เก่ง tech** — เกณฑ์: "เปิดมาใช้เป็นโดยไม่ต้องอ่านคู่มือ, ไม่ยาก/ซับซ้อนเกินไป"
- ภาษาคน ไม่ใช่ภาษาระบบ — **ห้ามโชว์ identifier ดิบ** (SellableSku/StockMovement/ChannelListing) → ใช้ term ใน glossary
- progressive disclosure — ซ่อนความซับซ้อน ขยายเมื่อผู้ใช้ขอ
- default ฉลาด — ลดการตัดสินใจ/การกรอกให้เหลือน้อยสุด
- forgiving — undo / ยืนยันก่อนทำสิ่งย้อนไม่ได้ / กันพลาด
- ทุก state (empty/loading/error) บอก **"ขั้นต่อไป"** ไม่ใช่แค่บอกว่าเกิดอะไร
- mobile-first — ปุ่มใหญ่พอแตะ
- คำเพิ่มใน glossary: `ChannelListing → สินค้าบนช่องทาง (Shopee/…)` · `sync failed → อัปเดตไปช่องทางไม่สำเร็จ`

## Friendly ปะทะ "UI พูดความจริงของโมเดล" — reconcile
**friendly = แปลความจริงให้เข้าใจง่าย ไม่ใช่ปิดบัง/โกหก**
เช่น `available = min(floor(item.available/qty))` → แสดง **"ขายได้อีก 12 ชิ้น"** + แตะดู *ทำไม* ได้
(ห้ามซ่อนความจริงจนผู้ใช้เข้าใจผิดเรื่องสต๊อก/เงิน)
