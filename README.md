# OmniStock (working name)

แพลตฟอร์ม **Omni-channel Inventory + Marketplace Sync + Thai Cloud Accounting** รวมจบในที่เดียว
สำหรับร้านค้าที่ขายหลาย marketplace (Shopee, Lazada, TikTok Shop) หลาย account พร้อมระบบบัญชีรายรับ-รายจ่ายตามมาตรฐานไทย

> สถานะ: **Phase 0 — Foundation / Spec** · กลยุทธ์: dogfood ก่อน, สถาปัตยกรรม multi-tenant ตั้งแต่วันแรก

## เอกสาร (อ่านตามลำดับ)

| # | ไฟล์ | เนื้อหา |
|---|------|---------|
| 00 | [docs/00-overview.md](docs/00-overview.md) | วิสัยทัศน์ ขอบเขต ฟีเจอร์ และ roadmap แบ่ง phase |
| 01 | [docs/01-data-model.md](docs/01-data-model.md) | โมเดลสินค้า 5 ชั้น (Product → Sellable SKU → Inventory Item) + bundle + ledger |
| 02 | [docs/02-architecture.md](docs/02-architecture.md) | tech stack, โครงสร้าง monorepo, services, multi-tenant, ความปลอดภัย |
| 03 | [docs/03-sync-engine.md](docs/03-sync-engine.md) | sync engine, กัน oversell, allocation, idempotency, Shopee connector |
| 04 | [docs/04-accounting.md](docs/04-accounting.md) | บัญชีไทย, COGS, เอกสารรายรับ-รายจ่าย, ภาษี |
| 05 | [docs/05-conventions.md](docs/05-conventions.md) | coding conventions + วิธีทำงานกับ AI agent |
| 06 | [docs/06-clients.md](docs/06-clients.md) | ขอบเขตของ web / mobile / LINE — แต่ละ surface ทำอะไรได้ |
| — | [docs/features/](docs/features/README.md) | backlog + spec รายตัวของแต่ละ feature (workflow: spec → review → design → tasks → build) |

## หลักการที่พลาดไม่ได้ (golden rules)

1. **Source of truth = warehouse กลางของเราเสมอ** — platform เป็นปลายทางที่เรา push ไป
2. **Inventory math & accounting ต้องมี test คลุมทุกครั้ง** — สองส่วนนี้ผิดไม่ได้
3. **Inventory ledger เป็น immutable** — แก้ยอดด้วยการเพิ่ม movement ใหม่ ไม่ใช่ update
4. **ทุก mutation ผูก `organizationId`** — กันข้อมูลข้าม tenant

ดูรายละเอียดใน [CLAUDE.md](CLAUDE.md)
