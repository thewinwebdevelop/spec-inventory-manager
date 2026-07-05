# Capability matrix — features ต่อ surface

feature แต่ละตัวอยู่บน surface ไหนบ้าง — ใช้คู่กับ [backlog](README.md)

**2 audience / 3 client:**
- **Tenant** (ลูกค้า): **Web use** (Next.js `apps/web`) + **Mobile** (Flutter `apps/mobile`) —
  ตั้งเป้า **parity** (มือถือจัดการได้เท่าเว็บ)
- **Back-office** (พวกเรา): Console แยก (Next.js `apps/back-office`, web-only, ข้าม org) — ดู [docs/02 §5](../02-architecture.md)

> **Tier:** F-004b/F-040/F-041/F-042/F-043/F-031 = 🟣 Full (gated `can(org,'accounting')`) · ที่เหลือ = 🔵 Sync (ทุก tier) — ดู [README](README.md)
> ✅ full manage · 🟡 มือถือ: ดู/แก้แบบเบา (งานหนัก—ฟอร์มยาว/พิมพ์/export—ทำบน web สะดวกกว่า
> แต่ยังทำบนมือถือได้) · 🔧 backend (ไม่มี UI ตรง) · ➖ ไม่มีบน surface นี้

## Tenant — Web use + Mobile
| Feature | Web use | Mobile | หมายเหตุ |
|---------|:------:|:------:|----------|
| F-001 Auth / login | ✅ | ✅ | |
| F-002 Organization & membership | ✅ | ✅ | |
| F-003 Roles & permissions (RBAC) | ✅ | ✅ | |
| F-004 Settings & org config (ops) | ✅ | ✅ | tax settings → F-004b (Full) |
| F-005 Audit log (ของ org ตัวเอง) | ✅ | ✅ | view/filter |
| F-006 Mobile app shell | ➖ | ✅ | ฐานแอป (auth/nav/Dart client/push/theme/i18n) — ทุกจอ mobile ต่อจากนี้ |
| F-007 Tier & entitlements core | 🔧 | 🔧 | tier engine — client ใช้ผ่าน FeatureGate (ไม่มี UI ตรง) |
| F-010 Product & Sellable SKU | ✅ | ✅ | |
| F-011 Inventory item / warehouse / ledger | ✅ | ✅ | |
| F-012 Bundle composition | ✅ | 🟡 | หลาย component — มือถือหลายสเต็ป |
| F-013 Stock adjustment & ledger | ✅ | ✅ | core mobile |
| F-014 Stock-in (light) + cost | ✅ | ✅ | รับเข้า+ต้นทุน (Sync tier) |
| F-020 Shopee connect (OAuth) | ✅ | 🟡 | มือถือผ่าน webview; setup นานๆครั้ง |
| F-021 Product import | ✅ | ✅ | trigger + review |
| F-022 Channel listing mapping | ✅ | 🟡 | ตารางจับคู่เยอะ → web สะดวก |
| F-023 Stock sync (push) + allocation | 🔧✅ | 🔧✅ | config/monitor |
| F-024 Order sync (ดู/แพค) | ✅ | ✅ | core mobile |
| F-025 Oversell protection | 🔧✅ | 🔧✅ | config |
| F-026 Returns & cancellations | ✅ | ✅ | |
| F-027 Sync health & connection status | ✅ | ✅ | |
| F-028 Notifications & alerts center | ✅ | ✅ | |
| F-029 Price management & per-channel sync | ✅ | 🟡 | รายตัวบนมือถือได้; bulk → web |
| F-030 Dashboard | ✅ | ✅ | |
| F-004b Tax settings (VAT/WHT/เลขเอกสาร) | ✅ | 🟡 | **Full tier** · ฟอร์มยาว → web |
| F-040 Purchase document → stock-in | ✅ | 🟡 | **Full tier** · เอกสารฟอร์มยาว → web |
| F-041 COGS & P&L | ✅ | 🟡 | รายงานจอใหญ่ดีกว่า; มือถือดูสรุป |
| F-042 Sales documents (ใบกำกับ/เสร็จ) | ✅ | 🟡 | ออก+พิมพ์ → web; มือถือออกเร็ว+แชร์ PDF |
| F-043 ภาษีไทย (VAT/WHT) + รายงาน | ✅ | 🟡 | รายงาน/export → web |
| F-031 Reporting & export | ✅ | 🟡 | export/ตารางใหญ่ → web; มือถือดู+แชร์ |
| F-050 พิมพ์ใบแปะหน้า | ✅ | ✅ | มือถือ = แชร์/พิมพ์ผ่านเครื่องพิมพ์มือถือ |
| F-051 Shopee auto-promote | ✅ | ✅ | toggle/schedule |
| F-052 แจ้งเตือนค่าส่งผิดปกติ | ✅ | ✅ | |
| F-070 Lazada connect / F-071 TikTok connect | ✅ | 🟡 | เหมือน F-020 (OAuth) |
| F-080 Subscription billing & payment | ✅ | ✅ | **PromptPay QR เหมาะมือถือมาก** |
| F-081 Self-serve onboarding | ✅ | ✅ | |
| F-083 Usage metering | 🔧 | 🔧 | backend; tenant เห็นผ่าน quota/alert |
| F-084 Quota alerts | ✅ | ✅ | |
| F-086 AI add-on (ใช้งาน) | ✅ | ✅ | ตั้งชื่อ/generate รูป |

> **LINE bot (F-060)** = channel ภายนอก ไม่ใช่ surface ในตารางนี้ (แจ้งเตือน/เช็คสต๊อก/ยอดผ่าน LINE)

## Back-office Console (web-only, internal — พวกเรา)
> แอปแยก `apps/back-office` · ข้าม org · audit ทุก action · ไม่เปิด public

| ความสามารถ | เกี่ยวกับ feature |
|-----------|-------------------|
| จัดการ organizations — ดู/ระงับ/ช่วย support | F-085 |
| Plan definitions — สร้าง/แก้ plan + limits map, apply package→org, override, grandfathering | F-082 (admin side) |
| Usage & metering — ดู usage ราย org/meter, ตรวจ quota/hard-cap | F-083 (view) |
| Billing oversight — ดู payment/subscription, ปรับ manual (ผ่าน audit) | F-080 (admin side) |
| AI provider/credit — จัดการ provider port, credit pack | F-086 (admin side) |
| Audit log (cross-org) — ทุก action ของ back-office + action สำคัญข้าม org | F-085 |
| System config / feature flags | F-085 |

> tenant **ไม่เห็น** back-office; เห็นเฉพาะ "ฝั่งลูกค้า" ของ feature เดียวกัน (เช่น F-082 → ลูกค้าเห็น
> plan ตัวเอง, F-080 → ลูกค้าจ่ายเงิน, F-083 → ลูกค้าเห็น quota)
