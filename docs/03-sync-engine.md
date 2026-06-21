# 03 — Sync Engine

ส่วนที่ยากและสำคัญที่สุดของระบบ เป้าหมาย: **สต๊อกตรงทุก channel + oversell ใกล้ 0**

## 1. หลักการ
- **Source of truth = warehouse กลางของเรา** ทุก channel คือ "ภาพสะท้อน" ที่เรา push ไป
- **ทุก channel เห็นสต๊อกเท่ากันเสมอ** (ของกองเดียว โชว์ซ้ำหลายจอ) — การ "แบ่งเลข" เกิดเฉพาะโหมด FIXED เท่านั้น
- การเปลี่ยนสต๊อกที่กระทบจริงต้องผ่าน `StockMovement` (ledger) → trigger งาน push
- ทุกงานคุย external = async ผ่าน **BullMQ** + idempotent + retry/backoff

### oversell เกิดจากอะไร (เข้าใจให้ถูก)
ไม่ได้เกิดจาก "เลขรวมหลาย channel ดูเกิน" — นั่นปกติ (ของกองเดียวโชว์ซ้ำ)
เกิดจาก **sync lag**: ช่วงเวลาระหว่าง "ลูกค้ากดซื้อ" → webhook มาถึงเรา → ตัดสต๊อก → push เลขใหม่กลับทุก channel
ถ้ามีคนซื้อหลาย channel **พร้อมกันในช่วง lag นั้น** ทั้งคู่ยังเห็นของ → รับออเดอร์เกิน

> **Insight หลัก:** oversell เกิดเกือบเฉพาะตอนของ "ใกล้หมด" (เหลือน้อย คู่เดียวก็เกิน) ตอนของเยอะแทบไม่มีทางเกิด
> → ดีไซน์จึง **ทุ่มการป้องกันไปที่ช่วงของใกล้หมด** และปล่อยให้ขายเต็มที่ตอนของเยอะ

## 2. ทิศทางการ sync

### Inbound: order → ตัดสต๊อก
```
webhook (order) ─▶ verify+parse ─▶ enqueue ─▶ worker:
  upsert Order (unique externalOrderId = idempotency)
  for each OrderItem:
     ChannelListing → SellableSku → BundleComponent[]
     for each component: SALE_OUT movement (qty × component.qty)  [ใน transaction]
  ─▶ enqueue recompute+push สำหรับทุก sellable/listing ที่กระทบ
```

### Outbound: stock → push ทุก channel
```
StockMovement เปลี่ยน inventoryItem
  ─▶ หา sellable ทั้งหมดที่ใช้ item นี้ (ผ่าน BundleComponent)
  ─▶ หา ChannelListing ทั้งหมดของ sellable เหล่านั้น
  ─▶ คำนวณ available + allocation ต่อ listing
  ─▶ ถ้าต่างจาก lastSyncedStock → enqueue pushStock(listing, qty)
```

> **ราคา** ใช้กลไก push เดียวกัน: ราคา = `priceOverride ?? basePrice` ต่อ listing → ถ้าต่างจาก `lastSyncedPrice` ก็ enqueue `pushPrice` (ดู F-029)
> ต่างกับสต๊อกตรงที่ราคาไม่มีปัญหา oversell — push ตรงไปได้เลย

---

## 3. Defense in depth — กัน oversell หลายชั้น
ไม่มีวิธีเดียวกันได้ 100% (ตราบใดที่ platform ถือ truth ของตัวเอง + มี lag) → ใช้หลายชั้นรวมกัน

### ชั้น A — ลด lag ให้สั้นที่สุด (โจมตีต้นเหตุ, ทำก่อนเสมอ)
- **Webhook-first**: รับ order ผ่าน webhook (push) ไม่ใช่ polling ถามเป็นรอบ → รู้ทันที
- **Polling fallback**: webhook ของ platform หายได้บ่อย → มี cron poll สำรองคอยจับ order/สถานะที่ตกหล่น
- **Priority queue**: เหตุการณ์ที่ทำให้ของใกล้หมด/หมด ดันขึ้นคิวด่วนกว่างานทั่วไป
- **Batch push เคารพ rate limit**: รวมหลายอัปเดตส่งทีเดียว แต่ "ของเหลือ 0" ส่งก่อนเสมอ

### ชั้น B — ป้องกันพิเศษตอนของใกล้หมด (ได้ผลสูงสุด) ⭐
- **Low-stock threshold** (ตั้งค่าต่อ org/สินค้า เช่น ≤ 3): เข้าสู่ "โหมดระวัง" เปลี่ยนพฤติกรรมอัตโนมัติ
- **Dynamic mode switching**:
  - ของเยอะ → `FULL` (ขายเต็มที่ ความเสี่ยงต่ำ)
  - แตะ threshold → สลับเป็น `FIXED`/ลด buffer/หรือ concentration อัตโนมัติ
- **Stock concentration**: ของใกล้หมด → ถอนออกจาก channel รอง ยุบไปโชว์ที่ channel หลักช่องเดียว → ตัดความเสี่ยง "ซื้อพร้อมกันหลายที่" ทิ้งไปเลย
- **Auto-deactivate**: เหลือ 0 → ปิด/ซ่อน listing ทันที กัน order หลุดเข้ามา

### ชั้น C — ความถูกต้องเชิงเทคนิคภายในระบบเรา
- **Idempotency**: order เดิมเข้าซ้ำไม่ตัดซ้ำ (unique `(channelAccountId, externalOrderId)`)
- **Serialize ต่อ inventoryItem**: distributed lock (Redis) หรือ queue แยกตาม key สินค้า → งานของสินค้าตัวเดียวกันทำทีละอัน ไม่คำนวณชนกัน
- **Reserved stock**: `available = onHand − reserved`; ออเดอร์ที่ยังไม่ส่งจอง reserved กันนับซ้ำภายใน
- **Optimistic version** บน StockLevel: กันเขียนทับกรณีอัปเดตพร้อมกัน
- **Reconciliation loop**: cron เทียบ `lastSyncedStock` กับค่าจริง + ดึงเลขจาก platform มาเทียบเป็นรอบ → push แก้ถ้า drift

### ชั้น D — business lever (ตัวเลือกที่ admin เปิด/ปิดได้)
บางครั้ง "กันสุดทาง" ทำให้เสียโอกาสขายมากกว่าที่ควร — เปิดให้เลือกตามนโยบายร้าน
- **ยอม oversell นาน ๆ ครั้ง + flow ยกเลิก/คืนเงิน/แจ้งลูกค้าอัตโนมัติ** (ดีกว่ากัน buffer เยอะจนขายไม่ออก)
- **Backorder / pre-order**: ขายเกินได้พร้อมระบุวันของเข้า (เหมาะสินค้าผลิต/สั่งเข้าเรื่อย ๆ)

---

## 4. Allocation policy (ต่อ ChannelListing)
**สำคัญ:** FULL/BUFFER = ทุก channel ยังเห็นเลขเท่ากัน (ของกองเดียว) ต่างกันแค่ buffer สำรอง
มีแต่ FIXED ที่แบ่งของจริงเป็นโควตา

| mode | พฤติกรรม | เห็นเท่ากันทุก channel? |
|------|----------|------------------------|
| `FULL` | push เต็ม available ทุก channel | ✅ |
| `BUFFER` | push `available − buffer` (เช่น กันไว้ 2) — ช่วง lag ยังมีของสำรอง | ✅ |
| `FIXED` | จองสต๊อกตายตัวต่อ channel (เช่น Shopee 25 / Lazada 15 / TikTok 10) → ขายเกินไม่ได้ แต่ของอาจค้างบางช่อง | ❌ (แบ่งโควตา) |
| `DYNAMIC` (อนาคต) | ระบบเกลี่ยตามยอดขายจริง + สลับโหมดตาม low-stock อัตโนมัติ | ขึ้นกับสถานะ |

- ตั้ง **default ทั้ง org** ได้ (แนะนำ `BUFFER`) และ **override รายช่อง** ได้ ผสมกันในสินค้าเดียวได้
- ค่า config อยู่บน `ChannelListing` (`allocationMode`, `allocationValue`)

---

## 5. ลำดับการสร้าง (build order — ไม่ใช่การเลือกตัดทิ้ง)
**ทุกชั้น (A–D) อยู่ในดีไซน์สุดท้ายทั้งหมด** — defense in depth คือซ้อนหลายชั้นพร้อมกัน ไม่มีกลุ่มไหนกัน oversell ได้ 100% ตัวเดียว
ลำดับด้านล่างคือ "สร้างอะไรก่อน-หลัง" ตามความคุ้มค่า ไม่ได้แปลว่าตัดชั้นที่อยู่ท้าย ๆ ทิ้ง

| ลำดับ | ชั้น | สถานะในดีไซน์ |
|-------|------|----------------|
| 1 | **A** — webhook-first + polling fallback + priority queue | บังคับมี (ฐานหลัก) |
| 1 | **C** — idempotency + serialize + reserved + reconciliation | บังคับมี (ฐานหลัก) |
| 2 | **B** — low-stock threshold + dynamic switching + concentration | บังคับมี (กันจุดเสี่ยงจริง) |
| 2 | **BUFFER** เป็น default ของ allocation | บังคับมี |
| 3 | **D** — backorder / ยอม oversell + auto-cancel | **เปิด/ปิดได้** ตามนโยบายร้าน (ไม่บังคับเปิด) |

> สรุป: A, C, B + BUFFER = "บังคับมี" · D = "มีในระบบ แต่ admin เลือกเปิดเอง" — ไม่มีชั้นไหนถูกตัดทิ้ง
> trade-off แกน: ขายได้สูงสุด (FULL) ↔ กัน oversell (FIXED) — ปรับตามมูลค่า/ความขาดของสินค้า
> เป้าหมายดีไซน์: **ของเยอะขายเต็มที่ · ของใกล้หมดระบบเข้มขึ้นเอง**

## 6. Shopee connector (ตัวแรก)
- **Shopee Open Platform** — OAuth (shop authorization), partner_id/key signing
- ใช้จริง: `get_item_list` / `get_model_list` (variant), `update_stock`, `get_order_list` + push webhook, `get_shipping_document` (ใบแปะหน้า)
- เก็บ token + auto-refresh ใน `ChannelAccount.authData` (encrypted); token หมด/refresh fail → mark `NEEDS_REAUTH` + แจ้งเตือน
- เคารพ rate-limit ของ Shopee (queue concurrency ต่อ account)
- Phase 3: auto-promote (boost ทุก 4 ชม. ผ่าน BullMQ repeatable job), แจ้งเตือนค่าส่งผิดปกติ (เทียบ shippingFee กับ baseline)

> รายละเอียด API จริง/เวอร์ชัน ต้องเช็คเอกสาร Shopee ตอน implement (เปลี่ยนได้) — adapter ห่อความต่างนี้ไว้

## 7. สิ่งที่ต้องมี test
- order เข้า bundle → ตัด component ครบถูกจำนวน
- order ซ้ำ (idempotency) → ไม่ตัดซ้ำ
- คำนวณ available + allocation ทุก mode (FULL/BUFFER/FIXED)
- ขายพร้อมกัน (concurrent) → ไม่ติดลบ; ทดสอบ serialize/lock ได้ผล
- low-stock threshold → trigger dynamic switching/concentration ถูกต้อง
- reconciliation จับ drift ได้
- webhook หาย → polling fallback จับ order ที่ตกหล่น
