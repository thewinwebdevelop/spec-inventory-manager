# 00 — Overview, Scope & Roadmap

## 1. ปัญหาที่แก้

ร้านค้าที่ขายหลาย marketplace หลาย account เจอปัญหา:
- สต๊อกไม่ตรงกันระหว่าง platform → **ขายเกิน (oversell)** หรือสต๊อกค้าง
- ทำบัญชีรายรับ-รายจ่ายแยกจากการขายจริง → กำไร/ขาดทุนไม่แม่น
- สินค้าเป็น **เซต/bundle** (เช่น เสื้อ+กระโปรง) แต่ซื้อเข้าแยกชิ้น แยก supplier → ต้นทุนคิดยาก
- งานซ้ำซ้อน: อัปสต๊อก/พิมพ์ใบแปะหน้า/ทำโปรโมชัน ทีละ platform ทีละ account

## 2. คุณค่าหลัก (ทำไมต้องเรา)

ตลาดส่วนใหญ่แยกกัน: เครื่องมือ sync สต๊อก **ทำบัญชีจริงไม่ได้** / โปรแกรมบัญชี **ไม่ต่อ marketplace**
จุดต่างของเรา = **รวมจบ + รองรับ bundle ระดับ component + บัญชีไทยถูกต้อง**

## 3. กลุ่มผู้ใช้

- **Owner / Admin** — เจ้าของร้าน (ไม่ต้องเก่ง tech) เห็น dashboard, จัดการสต๊อก, ออกเอกสาร
- **Staff** — แพ็คของ, พิมพ์ใบแปะหน้า, อัปเดตสต๊อก (จำกัดสิทธิ์)
- **Accountant** — ดูเอกสารบัญชี, export งบ
- เป้าหมาย UX: admin ที่ไม่ใช่สาย tech ใช้งานได้เอง

## 4. ฟีเจอร์หลัก (full scope)

| กลุ่ม | ฟีเจอร์ |
|------|---------|
| **บัญชีระบบ** | Auth ของเราเอง, subscription/package, billing |
| **องค์กร** | Organization, role & permission, หลายผู้ใช้ต่อองค์กร |
| **Marketplace** | เชื่อมหลาย account หลาย platform (Shopee/Lazada/TikTok + scale ได้) |
| **สินค้า & สต๊อก** | warehouse กลาง, โมเดล 5 ชั้น + bundle, import จาก platform, sync stock สองทาง |
| **ออเดอร์** | sync order ทุก account/platform |
| **Dashboard** | ยอดขาย/เงินเข้า/กำไร-ขาดทุน รวมและแยกราย account/platform |
| **ปฏิบัติการ** | พิมพ์ใบแปะหน้าทุก platform, Shopee auto-promote ทุก 4 ชม., แจ้งเตือนค่าส่งผิดปกติ |
| **บัญชี (Cloud Accounting)** | เอกสารซื้อเข้า→สต๊อก+ต้นทุน, COGS, ใบ invoice/ใบสำคัญจ่าย/ใบรับรองแทนใบเสร็จ, ภาษีไทย |

## 4.1 Product tier (Sync / Full)
ระบบขายเป็น 2 tier (gated ด้วย entitlements — ดู [features/F-007](features/F-007-tier-entitlements-core.md)):
- **Sync** = ops + สต๊อก + multi-channel sync + ต้นทุน/COGS/**กำไรหลังหักค่าช่องทาง** (ไม่มีเอกสารภาษี)
- **Full** = Sync + ประกาศ TIN + เอกสารซื้อ-ขาย + VAT/WHT + กำไรสุทธิ

**1 License = 1 Org = (Full) 1 TIN** · 1 User ถือได้หลาย license
backlog ที่ resequence แบบ **tier-aware + mobile-parity-first** (web พักไว้) อยู่ที่ [features/README.md](features/README.md)

## 5. Roadmap (ตัดสโคปเด็ดขาด — dogfood ขับเคลื่อน)

> หลักการ: แต่ละ phase ต้อง "ใช้งานจริงกับร้านของเราได้" ก่อนไป phase ถัดไป

### Phase 0 — Foundation
Monorepo, CI, auth, organization + permission, DB schema (โมเดล 5 ชั้น + ledger), Shopee connector skeleton (OAuth)

### Phase 1 — Core Inventory & Sync (หัวใจ)
- warehouse กลาง + Inventory Item + Sellable SKU + bundle composition
- import สินค้าจาก Shopee (1 account) → สร้าง/ผูก Inventory Item
- คำนวณสต๊อก sellable แบบสด + push stock กลับ Shopee
- รับ order webhook → ตัดสต๊อก component → reconcile
- กัน oversell + allocation policy
- dashboard ยอดขายเบื้องต้น
- **ขยาย: เพิ่ม account ที่ 2 และ platform Lazada/TikTok**

### Phase 2 — Cloud Accounting
เอกสารซื้อเข้า → เพิ่มสต๊อก+ต้นทุน, COGS อัตโนมัติ, P&L แม่น, ออกใบกำกับ/ใบเสร็จ/ใบสำคัญจ่าย/ใบรับรองแทนใบเสร็จ, VAT/หัก ณ ที่จ่าย

### Phase 3 — Ops Boosters
พิมพ์ใบแปะหน้า (ทุก platform), Shopee auto-promote ทุก 4 ชม., แจ้งเตือนค่าส่งผิดปกติ, bulk operations

### Phase 4 — Channels
LINE bot (Messaging API + LIFF) สำหรับแจ้งเตือน/เช็คสต๊อก/ดูยอด, Mobile app (Flutter)

### Phase 5 — Productize
Subscription/billing เต็มรูปแบบ, onboarding self-serve, multi-tenant hardening, เปิดขาย

## 6. ตัวชี้วัดความสำเร็จ (เริ่มต้น)

- สต๊อกระหว่าง warehouse กับทุก channel ตรงกัน > 99.9% (วัดจาก reconciliation)
- oversell = 0 ในสภาวะปกติ
- กำไร/ขาดทุนใน dashboard ตรงกับบัญชีจริง
- admin สร้างสินค้า + bundle + sync ได้เองโดยไม่ต้องให้ dev ช่วย
