# Features — backlog & workflow

ที่นี่คือศูนย์รวม feature ทั้งหมด แต่ละ feature มีโฟลเดอร์/ไฟล์ spec ของตัวเอง

## Workflow ต่อ 1 feature
ทำทีละ feature ตามลำดับนี้ (ห้ามข้าม — โดยเฉพาะ step 2 review):

```
1. draft     เขียน spec จาก _TEMPLATE.md  (overview, user stories, AC, scope)
2. reviewed  user ยืนยัน user stories + AC ว่าเข้าใจตรงกัน  ✅ ด่านสำคัญ
3. design    เติม data model / API / UI ลง spec + sync กลับ docs/01,02
4. tasks     แตก implementation task list + test plan (unit + E2E)
5. build     ลงมือ: backend → API → UI พร้อมเขียน test
6. verify    รัน unit + E2E ผ่าน → mark done
```

> spec แต่ละ feature **รวมทุกมิติไว้ในไฟล์เดียว** (data model/API/UI/test/tasks) ตาม [_TEMPLATE.md](_TEMPLATE.md)
> ส่วนกลางที่กระทบหลาย feature (เช่น schema รวม) ให้ sync กลับไปที่ [docs/01-data-model.md](../01-data-model.md) / [docs/02-architecture.md](../02-architecture.md)

## Backlog (เรียงตาม phase)
สถานะ: ⬜ ยังไม่เริ่ม · 🟡 draft · 🔵 reviewed · 🟢 done

### Phase 0 — Foundation
| ID | Feature | สถานะ | ขึ้นกับ |
|----|---------|-------|---------|
| F-001 | Authentication (สมัคร/เข้าสู่ระบบ, JWT + refresh) | ⬜ | — |
| F-002 | Organization & membership (หลายผู้ใช้ต่อองค์กร) | ⬜ | F-001 |
| F-003 | Roles & permissions (RBAC) | ⬜ | F-002 |
| F-004 | Settings & org config (VAT, เลขรันเอกสาร, allocation default, warehouse) | ⬜ | F-002 |

### Phase 1 — Core Inventory & Sync
| ID | Feature | สถานะ | ขึ้นกับ |
|----|---------|-------|---------|
| F-010 | Product & Sellable SKU management | ⬜ | F-003 |
| F-011 | Inventory Item, Warehouse, Stock level + Ledger | ⬜ | F-003 |
| F-012 | Bundle composition (BOM) | ⬜ | F-010, F-011 |
| F-013 | Stock adjustment & ledger view | ⬜ | F-011 |
| F-020 | Channel account connect (Shopee OAuth) | ⬜ | F-003 |
| F-021 | Product import จาก Shopee | ⬜ | F-010, F-020 |
| F-022 | Channel listing mapping | ⬜ | F-021 |
| F-023 | Stock sync (push) + allocation | ⬜ | F-022, F-012 |
| F-024 | Order sync (inbound) | ⬜ | F-022 |
| F-025 | Oversell protection (lock/reserved/reconciliation) | ⬜ | F-023, F-024 |
| F-026 | Returns & cancellations (คืนสต๊อก + ปรับบัญชี) | ⬜ | F-024 |
| F-027 | Sync health & connection status (งาน fail, token re-auth) | ⬜ | F-023, F-024 |
| F-028 | Notifications & Alerts center (push/LINE infra, low-stock, re-auth) | ⬜ | F-024 |
| F-029 | Price management & per-channel price sync | ⬜ | F-022 |
| F-030 | Dashboard ยอดขาย/สต๊อก เบื้องต้น | ⬜ | F-024 |

### Phase 2 — Cloud Accounting
| ID | Feature | สถานะ | ขึ้นกับ |
|----|---------|-------|---------|
| F-040 | Purchase document → stock-in + cost | ⬜ | F-011 |
| F-041 | COGS & P&L | ⬜ | F-040, F-024 |
| F-042 | Sales documents (invoice/receipt/voucher/substitute) | ⬜ | F-024 |
| F-043 | ภาษีไทย (VAT, WHT) + รายงาน | ⬜ | F-042 |
| F-031 | Reporting & export (P&L ราย account/platform/ช่วงเวลา, export นักบัญชี) | ⬜ | F-041 |

### Phase 3 — Ops Boosters
| ID | Feature | สถานะ | ขึ้นกับ |
|----|---------|-------|---------|
| F-050 | พิมพ์ใบแปะหน้า (เริ่ม Shopee → ขยายทุก platform ตาม connector) | ⬜ | F-024 |
| F-051 | Shopee auto-promote ทุก 4 ชม. | ⬜ | F-020 |
| F-052 | แจ้งเตือนค่าส่งผิดปกติ | ⬜ | F-024 |

### Phase 4 — Channels
| ID | Feature | สถานะ | ขึ้นกับ |
|----|---------|-------|---------|
| F-060 | LINE bot (แจ้งเตือน/เช็คสต๊อก/ยอด) | ⬜ | F-030 |
| F-061 | Mobile app (Flutter) | ⬜ | F-030 |
| F-070 | Lazada connector | ⬜ | F-025 |
| F-071 | TikTok Shop connector | ⬜ | F-025 |

### Phase 5 — Productize
> หมายเหตุ scope: กลุ่มนี้คือ "ขายจริง" หลัง full feature launch (จบ Phase 2) — entitlements/quota/back-office/AI add-on
> **architecture เผื่อไว้ตั้งแต่ Phase 0** (ดู note ท้ายไฟล์) แต่ build จริงที่นี่

| ID | Feature | สถานะ | ขึ้นกับ |
|----|---------|-------|---------|
| F-082 | Entitlements & plan definitions — `PlanDefinition` + limits map (ปลายเปิด เพิ่ม meter ใหม่ได้), **apply package → org**, override ราย org, grandfathering | ⬜ | F-003, F-004 |
| F-083 | Usage metering & **quota counting** — `UsageEvent` **immutable ledger** (กฎทอง 2), นับราย meter, reserve→commit, **hard cap** กันใช้ทะลุ, cost เป็น Decimal | ⬜ | F-082 |
| F-084 | **Quota alerts** — แจ้งเตือนใกล้หมด/เกินโควต้า บน **web + app** (ต่อยอด infra จาก F-028) | ⬜ | F-083, F-028 |
| F-085 | **Platform Back-office / super-admin** — จัดการ org · plan · usage · support, **query ข้าม-org** (ข้อยกเว้นเดียวของ multi-tenant) + audit log + RBAC เข้ม | ⬜ | F-003, F-082, F-083 |
| F-080 | Subscription billing & payment — บัตร(recurring)+PromptPay QR, webhook→apply auto, upgrade ทันที/downgrade สิ้นรอบ, grace+dunning, credit pack purchase (ดู docs/02 §7.1) | ⬜ | F-082 |
| F-081 | Self-serve onboarding | ⬜ | F-080 |
| F-086 | **AI add-on** — *post-launch* (ตั้งชื่อ/description = text แจก quota, generate รูป = credit/มิเตอร์เข้ม, provider port สลับได้) | ⬜ | F-082, F-083, F-085 |

### Icebox (เก็บไว้พิจารณาภายหลัง)
| ID | Feature | หมายเหตุ |
|----|---------|----------|
| F-090 | โอนสต๊อกข้าม warehouse (TRANSFER) | เมื่อมีหลายคลัง |
| F-091 | Physical assembly (จัดเซตจริงเก็บเป็นชิ้น) | ต่อยอดจาก virtual bundle |
| F-092 | Bulk import/export CSV (สินค้า/สต๊อก) | ช่วยร้านที่มีข้อมูลเดิมเยอะ |

> หมายเหตุ: งาน infra (monorepo scaffold, CI, Prisma setup) ไม่ใช่ feature — เป็น setup task ทำตอนเริ่ม Phase 0 ก่อน F-001

> **สถาปัตยกรรมเผื่อ scale (วางตะเข็บตั้งแต่ Phase 0 — enforcement จริงอยู่ F-082..F-086):**
> ของพวกนี้ปะทีหลังแพง เพราะแทรกลึกถึง data model + billing + multi-tenant boundary จึง **กันที่ไว้แต่ยังไม่ build เต็ม**
> - **Entitlements service** — จุดเดียวตอบ `can(orgId, action)` ฟีเจอร์ห้ามอ่าน plan ตรงๆ (ตอนนี้ limits มีแค่ orders/sync)
> - **data-model stub**: `PlanDefinition` (limits = map ปลายเปิด) · `OrgEntitlement` (plan + override) · `UsageEvent` (immutable, มี `organizationId` + cost Decimal) → ใส่ลง [docs/01](../01-data-model.md) ระดับ stub
> - **AI = module แยก** (`packages/ai`) + provider port (text/image) + ทุก AI call เป็น job ผ่าน BullMQ — core-domain ห้ามรู้จัก AI provider
> - **audit + cross-org boundary** สำหรับ back-office วางใน RBAC (F-003) ตั้งแต่แรก ดู [docs/02](../02-architecture.md)
