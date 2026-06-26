# Design System — cross-cutting standards (web ↔ mobile)

> เจ้าของ: **ux** (ผ่าน skill `thai-ux`) · consumed by **frontend** (Next.js + Flutter)
> ไฟล์นี้บันทึก **มาตรฐานออกแบบที่ใช้ร่วมทั้งระบบ** — รายละเอียด token/visual เต็ม ux เติมตอน Gate 2
> seed มาจาก F-000-TOKENS + การตัดสินใจช่วง Phase 0 spec

## 1. Design tokens (shared)
- **color / typography / spacing** เป็น token ชุดเดียว แปลงเป็น Next.js (Tailwind/shadcn) + Flutter theme
- ฟอนต์ไทยที่ render ชัด · format เลข/เงิน/วันที่แบบไทย
- _TODO (ux Gate 2): กำหนดค่า token จริง_

## 2. UI states มาตรฐาน (ทุกจอต้องมีครบ)
ทุกหน้าจอออกแบบครบ 4 state ไม่ใช่แค่ตอนมีข้อมูล:

| state | มาตรฐาน |
|---|---|
| **loading** | **Skeleton shimmer** (reusable widget) — *ไม่ใช่ spinner* |
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
