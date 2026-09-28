# F-003 Runbook — `ROLE_WRITES_ENABLED` + rollback (devops)

> ร่างตาม `docs/features/F-003/architecture.md` §12/§14, `data-model.md` §4, `docs/features/forward-commitments.md` (หมวด "จาก F-003 Gate 2")
> ยังไม่ผ่านการซ้อม (drill) จริง — ใช้เป็น draft ปฏิบัติการ ไม่ใช่ SOP อนุมัติแล้ว

## Contract summary (≤10 บรรทัด)

- **flag `ROLE_WRITES_ENABLED`**: env boolean, default `false`, อ่านครั้งเดียวตอน boot (`packages/config`) — ปิดเฉพาะ 3 route เขียน `Role` (POST/PATCH/DELETE) เป็น `503`; กฎความปลอดภัยอื่นของ F-003 (⊆/แกน target/reset ⊊/accept re-check) **ไม่ได้อยู่หลัง flag** — เปิดทันทีที่ instance F-003 ขึ้น
- **เปิด flag ได้ต่อเมื่อครบ 3 ข้อ** (§3 ด้านล่าง) — devops เป็นคนตั้งค่า, **release** เป็นเจ้าของจังหวะ/ประกาศ
- **rollback โค้ด F-003 → F-002 ปลอดภัยเฉพาะกรณี** flag ไม่เคยเปิด **และ** query ตรวจ (§1) = 0 แถว — มิฉะนั้น forward-fix เท่านั้น (ห้าม rollback)
- **ปิด flag ด่วน** (แก้ env + restart) ไม่เท่ากับ rollback โค้ด — ปลอดภัยเสมอ ไม่แตะ role ที่มีอยู่แล้ว
- **bridge trigger `role_f003_admin_bridge`**: ถอดใน migration ถัดไปหลังยืนยันไม่มี instance F-002 เหลือ (checkpoint เดียวกับเปิด flag) — บังคับด้วย gate G-12 (`removeBy` ใน allowlist)

---

## 1. Query ตรวจก่อน rollback โค้ด (มี role ถูกสร้าง/แก้/ลบแล้วหรือยัง)

รันก่อนตัดสินใจ rollback F-003 → F-002 **ทุกครั้ง** (แม้ flag จะยังไม่เคยเปิดตามที่จำได้ — เช็คด้วยข้อมูลจริง ไม่เชื่อความจำ):

```sql
SELECT count(*) FROM "Role"
 WHERE key IS NULL OR "lastEditedAt" IS NOT NULL OR "deletedAt" IS NOT NULL;
```

- **เหตุผล:** backfill (`f003_backfill_manage_roles`) ไม่เขียน `lastEditedAt` ⇒ ไม่ถูกนับเป็น false positive — ผลลัพธ์ที่ > 0 แปลว่ามี custom role, role ที่ถูกแก้ หรือ role ที่ถูก soft-delete แล้วจริง
- **ผลตรวจ = 0 และ flag ไม่เคยเปิด:** ✅ rollback โค้ดปลอดภัย — กลับสู่ baseline F-002 (รวมช่อง Admin→Admin ที่ F-002 มีอยู่แล้ว โดยไม่มีอะไรใหม่ให้โค้ดเก่าตีความผิด)
- **ผลตรวจ > 0 (ไม่ว่า flag เคยเปิดหรือไม่):** ⛔ **ห้าม rollback โค้ด** — F-002 ไม่มีตรรกะ ⊆ (subset check) และไม่กรอง `deletedAt` ⇒ Admin จะมอบ custom role ที่เกินสิทธิ์ตัวเองให้ตัวเองได้ (ช่องโหว่ NEW-10 กลับมา) — ทางออกคือ **forward-fix เท่านั้น**
- อ้างอิง: `architecture.md` §12 ตาราง rollback, `data-model.md` §4.3

## 2. ปิด flag ด่วน — mitigation ทันที (ไม่ใช่ rollback)

เมื่อพบปัญหาที่เส้นทางเขียน role (เช่น bug ในกฎ ⊆/แกน target ที่หลุดผ่าน CI) และต้องหยุดความเสียหายทันที:

1. แก้ค่า env `ROLE_WRITES_ENABLED` → `false` (หรือไม่ตั้งค่า — ค่าเริ่มต้น/ค่าที่ไม่ใช่ `"true"` ตรงตัว = false) ต่อ environment ที่ได้รับผลกระทบ
2. restart process ที่เสิร์ฟ route `Role` (rolling restart ปกติ — ช่วงที่บาง instance on/off จะเห็น `503` ชั่วคราวเท่านั้น ไม่มีผลด้านความปลอดภัย)
3. ยืนยันผล: `GET/POST/PATCH/DELETE` บน route เขียน role ตอบ `503 ROLE_WRITES_DISABLED` (ผู้ใช้ที่ไม่มี `manage_roles` ยังได้ `403` ตามเดิม ไม่ใช่ `503` — guard `RoleWritesEnabledGuard` วางหลัง `CapabilityGuard`) · route อ่าน (`GET /capabilities`, `/role-details`, `/roles/{id}`) ยังทำงานปกติ
4. **นี่ไม่ใช่ rollback** — โค้ดยังเป็น F-003, role ที่มีอยู่แล้ว (ถูกสร้าง/แก้/ลบไปก่อนหน้า) **ไม่ถูกแตะ** และยังมีผลตามกฎ F-003 เดิม (เช่น Owner ≥ 1 invariant, `deletedAt` filter) — ปลอดภัยเสมอ ไม่ต้องเช็ค query ข้อ 1 ก่อนทำ
5. แจ้ง release + backend-api ทันทีเพื่อวางแผน forward-fix — การปิด flag ซื้อเวลาเท่านั้น ไม่แก้ต้นเหตุ

อ้างอิง: `architecture.md` §12 (ย่อหน้า `ROLE_WRITES_ENABLED`), ตาราง rollback แถว "หยุดการสร้าง/แก้ role ด่วน"

## 3. เงื่อนไขก่อนเปิด `ROLE_WRITES_ENABLED` (ต่อ environment)

ต้องครบทั้ง 3 ข้อ — ข้อไหนไม่ครบ **ห้ามเปิด** ไม่มีข้อยกเว้น "ตามมาทีหลัง":

1. **ไม่มี instance F-002 เหลือ — ต้องมีหลักฐาน ไม่ใช่คำยืนยันด้วยวาจา (SR-03 delta):**
   รวบรวมรายการ image digest / build SHA ของ **ทุก process** ที่เสิร์ฟ route `members` / `invitations` / `auth` ในทุก region — รวม canary, worker, job runner ใด ๆ ที่เรียก service เหล่านี้ — ต้องตรงกับ commit ของ F-003 ทั้งหมด แนบรายการนี้ไว้ใน release record ของ environment นั้น (เจ้าของหลักฐาน: **devops**)
2. **`backfill:f003` รายงาน 0 แถว** (idempotent — รันแล้วไม่มี role ที่ต้องเติม `manage_roles` เหลือ)
3. **G-06 / G-09 / G-11 / G-12 + I-45 (int) อยู่ในโค้ดของ commit ที่ deploy จริง และ CI log ของ commit นั้นแสดงว่ารันจริง** (นับจำนวนเทสต์ที่รันได้ > 0 — ห้ามเชื่อ "green locally")
   - **G-12 ขยายขอบเขตครอบ migration (SR-10):** ต้องมี fixture แดงจริง + non-vacuity + allowlist ที่มี `removeBy` สำหรับ `role_f003_admin_bridge` **อยู่ในโค้ดของ commit ที่ deploy** — ไม่พบ = ไม่เปิด flag (SR-10 ปิด "ในการออกแบบ" เท่านั้น จนกว่า G-12 จะอยู่ในโค้ดจริง)
   - ตรวจ repo ณ 2026-09-27: G-06/09/11/12 ยังไม่มี implementation, I-45 มีแค่ unit (ไม่มี int) — ต้องทำให้ครบก่อน PR แรกที่มี route เขียน role จึงจะเข้าเงื่อนไขนี้ได้

**ใครทำอะไร:**
- devops: ตั้ง `ROLE_WRITES_ENABLED=true` ต่อ environment หลังตรวจครบ 3 ข้อ + rolling restart F-003→F-003
- release: เป็นเจ้าของจังหวะเปิด — **ห้าม** ประกาศใน release note/changelog ว่า D-034/D-035 มีผลแล้ว จนกว่าข้อ 1 จะครบสำหรับ environment นั้น (ช่วงสองรุ่น = ยังเป็น baseline F-002)

อ้างอิง: `architecture.md` §12 (ย่อหน้า "ใครเปิด"), §14, `forward-commitments.md` แถว "เปิด `ROLE_WRITES_ENABLED`"

## 4. ถอด bridge trigger (`role_f003_admin_bridge`) เมื่อไหร่

- **เมื่อไหร่:** migration ถัดไปหลังยืนยันไม่มี instance F-002 เหลือ — **checkpoint เดียวกับข้อ 3.1 ด้านบน** (ไม่ใช่ "feature ถัดไปที่แตะ Role" แบบลอย ๆ)
- **เจ้าของการถอด:** backend-api (สร้าง migration `f003_drop_admin_bridge`: `DROP TRIGGER IF EXISTS … ; DROP FUNCTION IF EXISTS …`)
- **บทบาทของ devops:** เป็นผู้ยืนยัน checkpoint (ข้อ 3.1) ที่ trigger ให้ backend-api เริ่มงานถอด — ไม่ใช่ผู้ถอดเอง
- **การบังคับ (G-12 ขยายขอบเขต):** bridge อยู่ใน allowlist ที่มี `removeBy` (= วันที่ merge PR build ของ trigger + 60 วัน) — เลยวันแล้ว function ยังถูกสร้างใน migration ที่ไม่มี drop ตามหลัง ⇒ CI แดง (บังคับถอด อัตโนมัติผ่าน gate ไม่ใช่แค่ runbook)
- **ความเสี่ยงระหว่างที่ยังอยู่:** ฟีเจอร์ในอนาคตที่ insert Admin ด้วยชุด capability แบบ F-002 เป๊ะ จะได้ `manage_roles` เงียบ ๆ ผ่าน trigger — ยอมรับความเสี่ยงนี้ชั่วคราว เพราะ `removeBy` จำกัดอายุ และไม่มีโค้ดรุ่น F-003+ ที่ insert ชุด F-002 อีก

อ้างอิง: `data-model.md` §4.2 (`role_f003_admin_bridge`), `forward-commitments.md` แถว "ถอด bridge trigger ของ backfill"

## 5. เอกสารอ้างอิงเต็ม

- `docs/features/F-003/architecture.md` §12 (migration/deploy/rollout flag/rollback), §14 (เงื่อนไขเปิด flag)
- `docs/features/F-003/data-model.md` §4 (migration plan), §4.3 (rollback table)
- `docs/features/forward-commitments.md` หมวด "จาก F-003 Gate 2" (แถว `ROLE_WRITES_ENABLED` และ bridge trigger)
