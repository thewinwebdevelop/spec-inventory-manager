# 01 — Data Model (core domain)

เอกสารนี้คือ **แกนกลาง** ของทั้งระบบ ทุก feature อ้างอิงโมเดลนี้

## 1. โมเดลสินค้า 5 ชั้น

```
Channel listing   →   Sellable SKU   →   Bundle composition   →   Inventory item
(ราย platform/acc)    (สิ่งที่ขาย)        (สูตรตัดสต๊อก)            (ของจริง: สต๊อก+ต้นทุน)
        ↑
     Product (กลุ่มสินค้าธุรกิจ)
```

| ชั้น | Entity | คำอธิบาย | เก็บสต๊อก? | เก็บต้นทุน? |
|------|--------|----------|-----------|------------|
| 1 | `Product` | กลุ่มสินค้าธุรกิจ (SPU) เช่น "A01 ชุดเสื้อผ้า" | ❌ | ❌ |
| 2 | `SellableSku` | variant ที่ขายได้ เช่น `A01-เสื้อ+กระโปรง` | ❌ (คำนวณสด) | ❌ |
| 3 | `BundleComponent` | บรรทัดสูตร: sellable ตัดอะไรกี่ชิ้น | — | — |
| 4 | `InventoryItem` | ของจริงที่นับสต๊อก เช่น `เสื้อ A01` | ✅ | ✅ |
| 5 | `ChannelListing` | แมป sellable → account บน platform (external IDs) | ❌ | ❌ |

### กฎเหล็ก
1. **ทุก SellableSku มี composition เสมอ** แม้ตัวเดี่ยว (`A01-เฉพาะเสื้อ` = เสื้อ A01 ×1) → โค้ดเส้นทางเดียว ไม่มี special case
2. **SellableSku ไม่เก็บตัวเลขสต๊อก** → `available = min(floor(inventoryItem.available / qty))` ของทุก component
3. **InventoryItem ↔ SellableSku เป็น many-to-many** ผ่าน `BundleComponent` (component ใช้ซ้ำข้าม sellable/product ได้)
4. **ต้นทุนอยู่ที่ InventoryItem เท่านั้น** (weighted-average) → COGS ของ sellable = Σ(component.unitCost × qty)
5. **Bundle เป็น virtual** (default) — ตัด component ตอนขาย ไม่ต้องมีสต๊อก "เซต" จริง

## 2. Entities (ร่าง schema — Prisma-style, PostgreSQL)

> ทุก entity ในโดเมนผูก `organizationId` (multi-tenant) ยกเว้น entity ระดับ platform/แพ็กเกจ

### Tenancy & Auth
> **1 License = 1 Organization = (ถ้าทำบัญชี) 1 TIN** · 1 User → หลาย Org ได้ (org switcher) · ดู F-001/F-002/F-003/F-007
```
Organization   id, name, logo?, timezone, currency (THB), createdAt
               taxProfile?: { entityType (personal|company), taxId(13), vatRegistered(bool), branchCode? }
                            // optional — บังคับเมื่อเปิด Full tier (accounting). 1 org = 1 TIN
User           id, email, passwordHash, verified(bool), ...
               // identifier นามธรรม (เผื่อ phone+OTP); auth ไม่ผูก organizationId
Membership     id, organizationId, userId, roleId, status (active|invited|revoked)
               // role/permission เป็นของราย org (ผ่าน roleId) — deactivate ไม่ delete
Role           id, organizationId, name, isSystem (Owner=ล็อก), capabilities[]  // editable ราย org
               // capability registry (open-ended): full_access, manage_members, manage_org_settings,
               // manage_billing, manage_products, manage_stock, manage_channels, manage_orders,
               // view_financials, access_accounting(Full tier) ...
Invitation     id, organizationId, email, roleId, status (pending|accepted|expired), token, expiresAt
RefreshToken   id, userId, deviceId, familyId, tokenHash (HMAC, unique), rotatedFrom?, revokedAt?,
               expiresAt, familyExpiresAt (login+90d cap — D-007), lastUsedAt?
               // rotation + reuse detection (+60s leeway D-011) — รายละเอียด: features/F-001/data-model.md (G2✓)
```

### Product / Inventory (โมเดล 5 ชั้น)
```
Product         id, orgId, code (A01), name, status
SellableSku     id, orgId, productId, code (A01-เสื้อ+กระโปรง), name, barcode?,
                basePrice (numeric)              // ราคาขายตั้งต้น (override ต่อ channel ได้)
InventoryItem   id, orgId, sku (เสื้อ-A01), name,
                avgUnitCost (numeric), trackStock (bool),
                lowStockThreshold (int?)        // แตะแล้วเข้าโหมดระวัง/dynamic switching (docs/03)
BundleComponent id, orgId, sellableSkuId, inventoryItemId, quantity (int)
                @@unique([sellableSkuId, inventoryItemId])

Warehouse       id, orgId, name, isDefault
StockLevel      id, orgId, warehouseId, inventoryItemId,
                onHand (int), reserved (int)        // available = onHand - reserved
                @@unique([warehouseId, inventoryItemId])
```

### Stock ledger (immutable — audit trail)
```
StockMovement   id, orgId, inventoryItemId, warehouseId,
                type (PURCHASE_IN | SALE_OUT | ADJUST | TRANSFER | RETURN | ASSEMBLY),
                quantity (+/-), unitCost?, refType, refId,   // เช่น refType=ORDER refId=...
                balanceAfter (int), createdAt, createdBy
```
> **ห้าม update/delete** movement — แก้ยอดด้วยการเพิ่ม `ADJUST` ใหม่ `StockLevel` เป็น projection ที่ derive จาก movement

### Channel (marketplace)
```
Channel         id, key (shopee|lazada|tiktok), displayName     // master ระดับระบบ
ChannelAccount  id, orgId, channelKey, shopName, externalShopId,
                authData (encrypted: access/refresh token, expiry), status
ChannelListing  id, orgId, channelAccountId, sellableSkuId,
                externalItemId, externalSkuId, externalStatus,
                allocationMode (FULL | BUFFER | FIXED | DYNAMIC), allocationValue?,
                priceOverride (numeric?),         // ราคาเฉพาะ channel นี้ (ว่าง = ใช้ basePrice)
                lastSyncedStock (int), lastSyncedPrice (numeric?), lastSyncedAt
                @@unique([channelAccountId, externalSkuId])
```

### Orders
```
Order       id, orgId, channelAccountId, externalOrderId, status,
            buyerName, total, shippingFee, platformFee, paidAt, ...
            @@unique([channelAccountId, externalOrderId])   // idempotency
OrderItem   id, orderId, sellableSkuId?, externalSkuId, qty, unitPrice
```
> ตอน order เข้า: หา ChannelListing → SellableSku → BundleComponent → สร้าง `SALE_OUT` movement ต่อ component

### Accounting (ดูรายละเอียด docs/04)
```
PurchaseDocument / PurchaseItem        // ซื้อเข้า → PURCHASE_IN + อัปเดต avgUnitCost
AccountingDocument                     // invoice | receipt | payment_voucher | substitute_receipt
```

### Entitlements & Usage metering (stub — Phase 5, ดู F-082..F-086)
> วาง **ตะเข็บ** ไว้ตั้งแต่ตอนนี้เพราะปะทีหลังแพง (แทรกถึง billing + ทุก write path) — schema จริงเติมตอน Phase 5
```
PlanDefinition  id, key (comp_full|full|sync|free), name, version, tierLabel,
                features (jsonb)      // map ปลายเปิด — 3 ชนิด:
                                      //  boolean: { "accounting": true, "marketplace_sync": true }
                                      //  static cap: { "max_users": 5, "max_channel_accounts": 3 }
                                      //  metered (นับจริง = F-083): { "orders_per_month": 1000, "storage_mb": 500 }
                                      // เพิ่ม feature ใหม่ = เพิ่ม key ไม่ migrate
OrgEntitlement  id, orgId, planDefinitionId,
                grants (jsonb?)       // itemized: [{ feature, value, source(plan|addon|comp|grandfather), ref? }]
                                      // resolved = พับ grants ทับ plan.features → ตอบได้ว่า add-on มาจากไหน
                @@unique([orgId])     // 1 org = 1 entitlement active
                // F-007 ทำ stub นี้เป็นจริง: can(org,feature) / canAdd(org,resource) จุดเดียว
                // gate แยก read/write (downgrade ไม่ลบข้อมูล) · feature code ห้ามอ่าน plan ตรงๆ

UsageEvent      id, orgId, meter (orders|sync|ai.text|ai.image|...),
                quantity (int), cost (numeric?),    // cost เป็น Decimal — ห้าม float (กฎทอง 7)
                refType, refId, occurredAt, createdBy

Subscription    id, orgId, planDefinitionId, status (active|past_due|grace|canceled),
                method (card|promptpay), currentPeriodEnd, pendingPlanId?,  // pendingPlanId = downgrade ที่รอสิ้นรอบ
                gatewayRef (customer/subscription id)
                @@unique([orgId])
Payment         id, orgId, subscriptionId?, kind (subscription|credit_pack),
                amount (numeric), status (pending|paid|failed),
                gatewayPaymentId, paidAt
                @@unique([gatewayPaymentId])        // idempotency — กัน apply ซ้ำ
```
> **UsageEvent เป็น immutable append** เหมือน `StockMovement` (กฎทอง 2) — ไม่ update/delete
> ยอดใช้ปัจจุบัน = aggregate UsageEvent ตามรอบ; quota check ถาม **entitlements service** จุดเดียว (`can(org, feature)` / `canAdd(org, resource)` — F-007)
> flow กันต้นทุนรั่ว: `check → reserve → ทำงาน → emit UsageEvent → commit` (reserve **ก่อน** ยิง provider)
> org ผูก plan ผ่าน `OrgEntitlement` เสมอ (invariant) — **core ทำจริงตั้งแต่ Phase 0 (F-007)** ไม่ใช่ Phase 5;
> Subscription/Payment/metering (F-080/083) ค่อยมาเติม productize

## 3. การคำนวณสำคัญ (ต้องมี unit test)

### สต๊อกที่ขายได้ของ SellableSku
```ts
available(sellable) = min(
  components.map(c => floor(stockLevel(c.inventoryItemId).available / c.quantity))
)
// ถ้าไม่มี component / component ใด trackStock=false → ข้ามจากการคำนวณตามนิยามที่ตกลง
```

### ต้นทุน weighted-average ตอนซื้อเข้า
```ts
newAvg = (onHand * oldAvg + qtyIn * unitCostIn) / (onHand + qtyIn)
```

### COGS ตอนขาย sellable 1 หน่วย
```ts
cogs(sellable) = sum(components.map(c => inventoryItem(c).avgUnitCost * c.quantity))
```

## 4. Import จาก platform (ทิศทางข้อมูล)
1. ดึง product/variant จาก Shopee (parent SKU + sub-SKU)
2. สร้าง `Product` + `SellableSku` ต่อ variant
3. **default: สร้าง InventoryItem 1 ตัวต่อ 1 sellable + composition ×1** (เคสปกติ)
4. ผู้ใช้ค่อยแก้ทีหลังให้ sellable ที่เป็นเซต ชี้ไป InventoryItem หลายตัว
5. สร้าง `ChannelListing` ผูก external IDs ไว้ sync

## 5. Edge cases ที่ต้องรองรับ
- component ใช้ซ้ำหลาย sellable (เปลี่ยนสต๊อก/ต้นทุนกระทบหลาย listing)
- ขายพร้อมกันหลาย channel → กัน oversell (docs/03)
- คืนสินค้า/ยกเลิกออเดอร์ → movement `RETURN` คืนสต๊อก
- (อนาคต) physical assembly: จัดเซตจริง = movement `ASSEMBLY` แปลง component → finished item
- หลาย warehouse (เริ่มจาก default เดียวก่อน)
