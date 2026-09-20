---
doc: data-model
owner: "@backend-api"
signoff: approved   # user 2026-07-28
---
# [F-002] Data model (ส่วนที่ feature นี้เพิ่ม/แก้)

> ต่อยอดจาก [docs/01-data-model.md](../../01-data-model.md) §2 "Tenancy & Auth" + "Entitlements (stub)" ·
> ตัดสินใจเชิงโครงอยู่ที่ [architecture.md](architecture.md) — เอกสารนี้คือรูปที่ลงดินจริง

> **รอบแก้ 2026-07-27 (amend #2):** ปรับตาม **D-027/D-028** + finding C-1/C-3/C-4/I-1/I-9/M-3/M-6/M-8/M-9/M-10
> ของ [security-review.md](security-review.md)

> **รอบแก้ 2026-07-28 (amend #3 — รอบสุดท้าย):** เพิ่ม **`Role.key`** ตามคำขอของ ux (Q4 — UI ต้องแปลชื่อ role
> เป็นไทยโดยไม่ผูกกับ `name` ที่ F-003 จะเปิดให้แก้) · รับ **D-029** (ออกจากร้านเอง = เขียน `revoked` ด้วยตัวเอง —
> **ไม่ต้องแก้ schema**, ใช้คอลัมน์ `revokedAt/revokedByUserId` ชุดเดิม)

> **รอบแก้ 2026-07-28 (amend #4 — ปิดเงื่อนไข delta review §H):** **ไม่มี delta ของ schema/migration แม้แต่บรรทัดเดียว** ·
> ที่แก้คือ **เอกสารที่เคยขัดกับ contract ที่ LOCKED** และ **กติกาการอ่าน/เขียน**: **NEW-6** §3.3 TIN → reveal-only
> (ของเดิมสอนผิด) · **NEW-1/D-030** §3.5 + §6 เพิ่มเงื่อนไข Owner-target ของ admin-reset · **NEW-8** §3.5 กติกา
> nested read "ลงกลับ" + `USER_SELECT` · **NEW-9** นิยามธง `acceptedUserCreatedAfterInvite` (เทียบ `createdAt`)

## Contract summary (≤20 บรรทัด — ทีม consumer อ่านแค่ส่วนนี้)

1. **ไม่มี entity ใหม่** — F-002 ใช้ตารางที่ F-000 สร้างไว้แล้วทั้งหมด (Organization / Role / Membership / Invitation / OrgEntitlement / Warehouse) แล้ว "เติมของจริง"
2. **`Invitation.token` (raw, unique) → `Invitation.tokenHash` (HMAC-SHA-256 keyed, unique)** — **D-018 required** · ทำได้ตอนนี้เพราะตารางว่างทุก env
3. `Invitation` เพิ่ม: `invitedByUserId` · `tokenIssuedAt` · `acceptedAt` / `acceptedByUserId` / **`acceptedUserCreatedAt`** · `cancelledAt` · `updatedAt` · enum เพิ่มค่า **`cancelled`**
4. **`expired` เป็นสถานะที่คำนวณตอนอ่าน** (pending && `expiresAt` < now) — ไม่มี job ไล่เขียนสถานะ ไม่มี cron · **cap นับเฉพาะที่ยังไม่หมดอายุ** (M-3)
5. `Membership` เพิ่ม: `revokedAt` · `revokedByUserId` · `activatedAt` — `revokedAt` ถูกใช้เป็น **กติกาความปลอดภัย** ไม่ใช่แค่หลักฐาน: accept ที่คำเชิญออกก่อน `revokedAt` ถูกปฏิเสธ (I-1)
6. `Organization` เพิ่ม: `createdByUserId` (nullable) — ที่เหลือของ tax profile **ใช้ 4 คอลัมน์เดิมที่ F-000 วางไว้** ไม่แตกตารางใหม่
7. **`taxId` ไม่ unique ระดับระบบ** (มีแค่ index) — unique ข้าม tenant = oracle ข้าม tenant · เหตุผลเต็ม §3.4 · **เลขเต็มออกทาง `POST …/tax-profile/reveal` เส้นเดียวเท่านั้น** (ต้องมี `manage_org_settings` + event + rate limit) · **`GET /orgs/{orgId}` ไม่คืน `taxId` ให้ใครเลย** และผู้ที่ไม่มี `manage_org_settings` **ไม่ได้แม้แต่ค่า mask** — §3.3 (D-028/I-8 + ux Q13 + D-030 · แก้ตาม NEW-6)
8. `Warehouse` ได้ **partial unique index** `(organizationId) WHERE isDefault` → org หนึ่งมี default ได้ใบเดียว (กฎระดับ DB)
9. `Invitation` ได้ **partial unique index** `(organizationId, email) WHERE status='pending'` → กัน pending ซ้ำระดับ DB ไม่ใช่ระดับ if
10. index ใหม่ตาม query จริงทุกเส้น (§3.5) — ทุก query ของ F-002 มี bound ที่อธิบายได้ (Gate C)
11. **2 migration** ในชุดเดียว: `f002_expand` (เพิ่มทุกอย่าง) → `f002_drop_invitation_token` (ทิ้งคอลัมน์เดิม) — §4
12. destructive ที่ทำได้อย่างปลอดภัย **ตอนนี้เท่านั้น**: drop `Invitation.token` (ตารางว่างทุก env, ยังไม่มี prod) — §4.1 มี precondition check
13. **seed ใหม่ (dev/dogfood): `PlanDefinition` 4 แถว** (`comp_full`/`full`/`sync`/`free`) — org ใหม่ต้องผูก plan เสมอ (invariant AC US-1)
14. system roles ที่ถูกสร้างพร้อม org: **Owner / Admin / Staff** (ค่า capabilities §5.2) · **"เป็น Owner" = role มี `full_access`** (ไม่ใช่เทียบชื่อ ไม่ใช่เทียบ `key`) — ใช้ทั้งกฎ Owner-only และ TTL คำเชิญ
15. **`Role.key` (ใหม่ amend #3):** `owner\|admin\|staff` สำหรับ role ที่ระบบสร้าง · **`null` สำหรับ custom role ของ F-003** · `@@unique([organizationId, key])` · มีไว้ให้ UI **แปลคำ** เท่านั้น — ⛔ **ห้ามใช้ตัดสินสิทธิ์เด็ดขาด**
16. pure fn ใหม่ใน `packages/core-domain`: `owner-invariant` · **`member-authz` (`canAssignRole` — C-1/D-028)** · **`invitation-policy` (`invitationTtlHours` 24/168 ชม. + `canAcceptInvitation`)** · `thai-tax-id` · `invitation-status` · `invitation-email`
17. **กติกา query ที่บังคับกับทุก feature ถัดไป:** ห้ามตั้งต้น query จาก model org-agnostic (`User`/`RefreshToken`/`Channel`/`PlanDefinition`) — C-3 · แตะ `User` ได้ทางเดียวคือ **`select: USER_SELECT` (frozen จาก `packages/db`)** ห้าม `include` และห้ามเขียน select เอง — C-4 + **NEW-8: ห้าม traverse ผ่าน model org-agnostic กลับลงมาที่ model org-scoped** (§3.5)
18. **ไม่แตะ** `StockMovement` / `UsageEvent` / โมเดล 5 ชั้น เลยแม้แต่คอลัมน์เดียว
19. `Membership.status='invited'` = **dead state ใน Phase 0** (ไม่มี write path เขียนค่านี้) — ต้องถูกปฏิเสธเหมือน `revoked` ทุกจุด
20. sync-back ที่ต้องทำกับ docs/01 → §7

---

## §1 สรุป delta ต่อ model

| Model | เปลี่ยนอะไร | ทำไม |
|---|---|---|
| `Organization` | + `createdByUserId String?` | ที่มาของ tenant (back-office/support ต้องตอบได้ว่าใครสร้าง) — nullable เพราะ F-085 อาจสร้างแทน |
| `Membership` | + `revokedAt DateTime?` · `revokedByUserId String?` · `activatedAt DateTime?` · index `(userId, status)` · index `(organizationId, status, createdAt)` | AC US-5 "ชื่อสมาชิกที่ถูกถอดยังโผล่ในประวัติเก่าได้" = ไม่ลบแถว + ต้องรู้ว่าใครถอดเมื่อไหร่ · index ตาม query จริง §3.5 |
| `Role` | **+ `key String?`** · `@@unique([organizationId, key])` | **ux Q4:** UI ห้ามโชว์ "Owner/Admin/Staff" ให้ SME ⇒ ต้อง map เป็น "เจ้าของร้าน/ผู้ดูแล/พนักงาน" · map จาก `name` เปราะเพราะ F-003 เปิดให้เปลี่ยนชื่อ role ⇒ ต้องมี **identifier ที่นิ่ง** · nullable เพราะ custom role ของ F-003 ไม่มี key (Postgres มองหลาย `NULL` เป็นค่าต่างกัน ⇒ unique index ไม่ขวาง) · CRUD ยังเป็นของ F-003 |
| `Invitation` | **`token` → `tokenHash` (unique)** · + `invitedByUserId` `tokenIssuedAt` `acceptedAt` `acceptedByUserId` **`acceptedUserCreatedAt`** `cancelledAt` `updatedAt` · index `(organizationId, status, createdAt)` · index `(organizationId, email, status)` · **partial unique** `(organizationId, email) WHERE status='pending'` | D-018 (hash-at-rest) + lifecycle ตาม US-3/US-4 + กัน pending ซ้ำที่ระดับ DB · `acceptedUserCreatedAt` = สัญญาณ "บัญชีถูกสร้างก่อน/หลังคำเชิญ" ที่ AC US-3 (D-028) สั่งให้บันทึก · index `(organizationId,email,status)` รองรับการ **ยกเลิกคำเชิญค้างตอนถอดสมาชิก** (I-1) |
| `InvitationStatus` (enum) | + `cancelled` (คงค่า `expired` ไว้แต่ **ไม่มีโค้ดเขียนลงไป** — derived) | AC US-3 "ยกเลิกคำเชิญที่ค้างได้" |
| `Warehouse` | + **partial unique index** `(organizationId) WHERE isDefault` | invariant "1 org = 1 default warehouse" (Phase 0 คลังเดียว) |
| `OrgEntitlement` | ไม่เปลี่ยน schema (มี `@@unique([organizationId])` แล้ว) | F-002 แค่ **เขียนแถวให้ทุก org ที่สร้าง** = ทำ invariant ให้เป็นจริง |
| `PlanDefinition` | ไม่เปลี่ยน schema | F-002 เพิ่ม **seed** เท่านั้น |
| `User` / `RefreshToken` | **ไม่แตะเลย** | auth เป็น org-agnostic ตาม docs/01 + F-001 as-built (เหตุผลเต็ม architecture §4) |

---

## §2 รูป schema หลังแก้ (เฉพาะส่วนที่เปลี่ยน — Prisma style)

```prisma
enum InvitationStatus {
  pending
  accepted
  expired     // RESERVED — ไม่มี write path เขียนค่านี้; "หมดอายุ" คำนวณจาก expiresAt ตอนอ่าน (§3.2)
  cancelled   // NEW (F-002) — ยกเลิกโดย Owner/Admin
}

model Organization {
  // ... คงเดิมทุกฟิลด์ (name, logo, timezone, currency, taxEntityType, taxId, vatRegistered, taxBranchCode)
  createdByUserId String?   // NEW — ผู้สร้าง (nullable: back-office อาจสร้างแทนภายหลัง)

  @@index([taxId])          // NEW — back-office/support ค้นจาก TIN ได้ (ไม่ unique — §3.4)
}

model Role {
  // ... คงเดิม (id, organizationId, name, isSystem, capabilities, createdAt, updatedAt)
  key String?   // NEW (amend #3 · ux Q4) — slug ที่นิ่งสำหรับ "แปลชื่อบนจอ" เท่านั้น
                //   system role ที่สร้างพร้อม org: "owner" | "admin" | "staff"  (ค่าคงที่ = ส่วนหนึ่งของ API contract)
                //   custom role ที่ F-003 สร้าง: null  (key เป็น namespace ของระบบ ไม่ใช่ของผู้ใช้)
                //   ⛔ ห้ามใช้ตัดสินสิทธิ์ทุกกรณี — "เป็น Owner ไหม" = capabilities มี full_access (§5.2)

  @@unique([organizationId, key])   // NEW — กัน key ซ้ำใน org เดียว; หลาย NULL อยู่ร่วมกันได้ตามพฤติกรรม Postgres
}

model Membership {
  // ... คงเดิม (id, organizationId, userId, roleId, status, createdAt, updatedAt)
  activatedAt     DateTime? // NEW — เวลาที่กลายเป็น active (สร้าง org / accept invite)
  revokedAt       DateTime? // NEW — AC US-5 หลักฐานการถอด (ไม่ลบแถว)
  revokedByUserId String?   // NEW — ใครถอด (seam ก่อน F-005 audit log)

  @@unique([organizationId, userId])              // เดิม — คือกุญแจของ org-context resolution
  @@index([organizationId])                        // เดิม
  @@index([userId])                                // เดิม
  @@index([roleId])                                // เดิม
  @@index([userId, status])                        // NEW — GET /me/organizations
  @@index([organizationId, status, createdAt])     // NEW — member list + count active owners
}

model Invitation {
  id             String           @id @default(cuid())
  organizationId String
  email          String                              // normalized (lowercase+trim) เสมอ
  roleId         String
  status         InvitationStatus @default(pending)
  tokenHash      String           @unique            // CHANGED — HMAC-SHA-256(INVITATION_TOKEN_SECRET, token) (D-018)
  tokenIssuedAt  DateTime         @default(now())    // NEW — ออก/หมุน token ครั้งล่าสุดเมื่อไหร่
                                                     //       (ใช้เทียบกับ Membership.revokedAt ตอน accept — I-1)
  expiresAt      DateTime                            // เดิม — now + invitationTtlHours(role) : 168 ชม. ปกติ / 24 ชม.
                                                     //       ถ้า role มี full_access|manage_members (D-028) ·
                                                     //       **rotate ลิงก์ = นับใหม่จากเวลาที่ออกลิงก์ (D-027)**
  invitedByUserId String?                            // NEW — ใครเชิญ
  acceptedAt      DateTime?                          // NEW
  acceptedByUserId String?                           // NEW — user ที่กดรับ (ควรตรงกับ email ที่เชิญ)
  acceptedUserCreatedAt DateTime?                    // NEW (D-028/I-7) — User.createdAt ของคนที่กดรับ ณ เวลา accept
                                                     //   ⇒ ตอบได้ว่า "บัญชีนี้ถูกสร้างหลังคำเชิญถูกออกหรือไม่"
                                                     //   snapshot ไม่ใช่ join: User อาจถูกลบ/anonymize ภายหลัง (PDPA)
  cancelledAt     DateTime?                          // NEW
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt         // NEW

  organization Organization @relation(fields: [organizationId], references: [id])
  role         Role         @relation(fields: [roleId], references: [id])

  @@index([organizationId])                          // เดิม
  @@index([email])                                   // เดิม
  @@index([organizationId, status, createdAt])       // NEW — invitation list ของ org
  @@index([organizationId, email, status])           // NEW — ยกเลิกคำเชิญค้างของ email นั้นตอนถอดสมาชิก (I-1)
  // + partial unique index (raw SQL ใน migration — Prisma ยังไม่รองรับ partial unique ใน DSL):
  //   UNIQUE (organizationId, email) WHERE status = 'pending'
}

model Warehouse {
  // ... คงเดิม
  // + partial unique index (raw SQL): UNIQUE (organizationId) WHERE "isDefault"
}
```

> **หมายเหตุ FK:** `invitedByUserId` / `acceptedByUserId` / `revokedByUserId` / `createdByUserId` เก็บเป็น
> **string ไม่ผูก FK** ตามแนวเดียวกับ `StockMovement.createdBy` ที่ F-000 ทำไว้ — เพื่อไม่ให้ tenant table
> ผูกแข็งกับ `User` (org-agnostic) และให้ลบ/anonymize user ในอนาคต (PDPA) ไม่ล็อกทั้งตาราง

---

## §3 Invariants, สถานะ และ query bound

### 3.1 Invariants ที่ต้องเป็นจริงเสมอ (พร้อมชั้นที่บังคับ)

| Invariant | บังคับที่ไหน | test |
|---|---|---|
| org ทุกใบมี `OrgEntitlement` 1 แถว | tx เดียวตอนสร้าง org (architecture §6.1) + `@@unique([organizationId])` | int: สร้าง org แล้ว entitlement ต้องมี · unit: plan หาไม่เจอ → ไม่มี org เกิด |
| org ทุกใบมี **Owner ที่ active ≥ 1** | `SELECT … FOR UPDATE` แถว Organization + pure fn `assertOwnerRemains` (architecture §5) | int concurrency 2 ขนาน × 20 รอบ |
| org ทุกใบมี default warehouse ใบเดียว | tx สร้าง org + **partial unique index** | int: insert default ใบที่สองต้องพัง |
| 1 (org, user) มี membership ได้แถวเดียว | `@@unique([organizationId, userId])` (เดิม) | int: accept ซ้ำพร้อมกัน → 1 แถว |
| 1 (org, email) มี pending invitation ได้ใบเดียว | **partial unique index** | int: สร้างซ้ำพร้อมกัน 2 request → สำเร็จ 1 |
| invitation token ไม่ถูกเก็บเป็น plaintext | คอลัมน์ `tokenHash` + code path เดียว (`hashInvitationToken`) | int: อ่านแถวจาก DB แล้วค่าต้อง ≠ token ที่ API คืน · grep gate: ไม่มีคำว่า `token:` ที่เขียนลง Invitation |
| ทุก query โดเมนกรอง `organizationId` | `withOrgScope` enforcement (architecture §2.2) + **กติกา C-3** (ห้ามตั้งต้นจาก model org-agnostic) | int cross-org leak ทุก endpoint × **5 persona** (M-8 + Staff ที่ qa เพิ่ม) + เคส nested include จาก `User` |
| **การมี Owner ต้องมาจากผู้ที่มี `full_access` เท่านั้น** (C-1) | pure fn `canAssignRole` + เรียกใน tx เดียวกับ lock (architecture §3.2) — **ครบ 5 call site หลัง amend #4** | unit matrix §6 + int: Admin ยกตัวเองเป็น Owner → 403 · **Admin ออกลิงก์ใหม่ของคำเชิญ role Owner → 403 (NEW-2)** |
| **บัญชีของ Owner ต้องถูกยึดผ่านเส้นทาง credential ไม่ได้** (NEW-1/D-030) | `adminResetPassword` เรียก `canAssignRole` ใน tx เดียวกับ `user.update` → ไม่ผ่าน = **404 รูปเดิม** + event แยก (architecture §3.3) | unit 7 เคส §3.3 + **int: Admin รีเซ็ตรหัส Owner → 404 และรหัสเดิมของ Owner ยังล็อกอินได้จริง** |
| **ถอดสมาชิกแล้วต้องไม่มีคำเชิญ `pending` ของ email นั้นเหลือใน org** (I-1) | `updateMany` ใน **tx เดียวกับ** การ revoke | int: revoke → คำเชิญกลายเป็น `cancelled` ทันที (อ่านจาก DB ไม่ใช่จาก response) |
| **membership ที่ถูกถอดจะกลับมาได้ด้วยคำเชิญที่ออก *หลัง* `revokedAt` เท่านั้น** (I-1) | pure fn `canAcceptInvitation` (เทียบ `revokedAt` กับ `tokenIssuedAt`) | unit matrix §6 + int: accept ด้วย token เก่า → 409 `INVITATION_SUPERSEDED` |
| **accept ไม่มีทางเปลี่ยน role ของ membership ที่ active อยู่** (I-9 ⇒ ทำให้ "accept ลด owner ไม่ได้" เป็นจริงเชิงโครงสร้าง) | service ปฏิเสธด้วย `409 ALREADY_MEMBER` ก่อนแตะแถว | unit: `membership.update` ไม่ถูกเรียก · int: Owner คนสุดท้าย accept คำเชิญ role Staff → 409 และยังเป็น Owner |
| **`passwordHash`/`tokenHash` ไม่มีทางขึ้น wire** (C-4) | `select` ระบุคอลัมน์เสมอบน `User` + grep gate `include: { user:` | assertion กลางใน int-test kit (ทุก response ของทุก endpoint) |

### 3.2 สถานะที่ derive (ไม่เก็บ)

```ts
// packages/core-domain/src/orgs/invitation-status.ts   (pure fn, รับ now: Date)
resolveInvitationStatus(inv: { status; expiresAt }, now: Date):
  'pending' | 'accepted' | 'cancelled' | 'expired'
  // stored=pending && expiresAt <= now → 'expired'
```
เหตุผลที่ไม่มี cron ไล่ mark expired: สถานะที่เก็บแล้ว "จริงช้ากว่าเวลา" คือแหล่งบั๊กคลาสสิก (คนกดรับตอน
job ยังไม่วิ่ง = รับได้ทั้งที่หมดอายุ) · การคำนวณตอนอ่าน = ถูกเสมอ 0 ต้นทุน · ถ้าอนาคตต้องการล้างข้อมูลเก่า
ค่อยเพิ่ม housekeeping job ที่ **ลบ/archive** ไม่ใช่ที่กำหนดความจริง

### 3.3 Tax profile (US-7)

- คงรูป **flattened 4 คอลัมน์บน `Organization`** ตามที่ docs/01 + F-000 วางไว้ (ไม่แตกตาราง `TaxProfile` เพราะ
  AC บังคับ 1 org = 1 ชุดอยู่แล้ว — ตารางแยกจะเพิ่ม join โดยไม่ได้ความสามารถอะไรกลับมา)
- **กฎ atomicity:** ต้องกรอกครบชุด (`taxEntityType` + `taxId` + `vatRegistered`) หรือว่างทั้งชุด —
  ไม่มีสถานะกรอกครึ่ง ๆ (บังคับที่ DTO + service; `PUT` แทน `PATCH` ในสัญญา API)
- `taxProfileComplete` = derived (`taxEntityType != null && taxId != null && vatRegistered != null`)
  → เป็น field ที่ API คืน และเป็น **seam ที่ F-007 `entitled('accounting')` จะอ่าน** (F-002 ไม่ gate เอง)
- **field-level authorization (D-028/I-8 + ux Q13 + D-030 — PDPA) · รูปสุดท้ายที่ตรงกับ [api-spec §3.3/§3.16](api-spec.md) ที่ LOCKED:**

  | ผู้เรียก | `GET /orgs/{orgId}` | `POST /orgs/{orgId}/tax-profile/reveal` |
  |---|---|---|
  | มี `manage_org_settings` (Owner + Admin) | `entityType` · **`taxIdMasked`** (4 ตัวท้าย) · `vatRegistered` · `branchCode` — **ไม่มี `taxId` เต็ม** | **`taxId` เต็ม** (+ event + rate limit 20/ชม.) |
  | สมาชิก active อื่น (เช่น Staff) | **`vatRegistered` เท่านั้น** — ไม่มี `taxIdMasked`/`entityType`/`branchCode` | `403 FORBIDDEN` |
  | ทุกคน | `taxProfileComplete` (bool) ที่ระดับ root | — |

  - ⚠️ **แก้ตาม NEW-6 (amend #4):** ย่อหน้าเดิมของหัวข้อนี้เขียนว่า "`taxId` เต็มคืนได้เฉพาะผู้มี `manage_org_settings` ·
    ผู้ใช้อื่นได้ค่า mask" ซึ่ง **ขัดกับ contract ที่ LOCKED** (เลขเต็ม **ไม่ออกทาง `GET` ให้ใครเลย** และผู้ที่ไม่มี
    `manage_org_settings` **ไม่ได้แม้แต่ mask**) — เอกสารที่สอนผิด 1 ย่อหน้าคือทางกลับไปหา I-8 เพราะ implementer
    อ่านไฟล์นี้คู่กับ schema มากที่สุด
  - เหตุผลที่ต้องเข้มขนาดนี้: `entityType='personal'` ⇒ TIN 13 หลัก **คือเลขบัตรประชาชนของเจ้าของร้าน**
    (4 ตัวท้ายยังใช้ยืนยันตัวตนได้ในหลายบริการ)
  - การ mask ทำที่ **mapper ชั้นเดียว** (pure fn `maskTaxId` ใน core-domain) ไม่ใช่กระจายตาม controller ·
    เลขเต็มออกได้จาก **เส้นเดียว** ที่ถูก pin ด้วย `TAX_ID_RESPONSE_ALLOWLIST` (สมาชิก = 1 เส้นพอดี, CI บังคับ)
  - **ห้าม log `taxId` ทุกกรณี** แม้แบบ mask (architecture §9, M-7ค) — event `org.tax_profile.set` เก็บแค่ `taxIdPresent`
    และ `org.tax_profile.revealed` **ไม่มีค่า TIN เลย**
- **แก้ TIN ได้อิสระตราบใดที่ยังไม่มีเอกสารภาษี** — Phase 0 ยังไม่มี `AccountingDocument` เลยจึงยังไม่ต้อง lock ·
  F-004b/F-040 เป็นเจ้าของกฎ "ออกเอกสารแล้วห้ามเปลี่ยน TIN" (บันทึกเป็น seam ไม่ implement ตอนนี้)

### 3.4 `taxId` unique ระดับระบบไหม — **ไม่** (ตัดสิน + เหตุผล)

| ทางเลือก | ผล |
|---|---|
| `@unique` ระดับระบบ | ❌ **cross-tenant oracle**: ผู้ใช้ org A กรอก TIN ของบริษัทอื่นแล้วได้ 409 = รู้ทันทีว่า "บริษัทนี้ใช้ระบบเราอยู่" — เป็นการรั่วข้อมูลลูกค้าข้าม tenant · ❌ บล็อกเคสจริง (นิติบุคคลเดียวเปิดหลาย license เพื่อแยกกองสต๊อก/ทีม ซึ่ง Gate 1 ไม่ได้ห้าม) · ❌ org ทดสอบ/สร้างซ้ำหลังลบ จะชนกันเอง |
| **index ธรรมดา (เลือก)** | ✅ ค้นเร็วสำหรับ back-office/support · ✅ ไม่รั่วข้าม tenant · ตรวจ TIN ซ้ำเป็นงานของ **F-085 back-office** (เห็นข้ามองค์กรได้อยู่แล้วโดยชอบ) ไม่ใช่ของ tenant API |

ทิศทางย้อนกลับถูกเสมอ: ถ้าวันหนึ่งธุรกิจต้องการ unique จริง → เพิ่ม unique index ทีหลังเป็น migration แบบ expand ได้
(และตอนนั้นค่อยตัดสินเรื่อง error message ที่ไม่รั่ว) — ตรงข้ามกับการใส่ตอนนี้แล้วต้องถอด ซึ่งแพงกว่า

### 3.5 Query bound (Gate C — ทุก query ที่โตตามข้อมูลต้องมี index + ขอบเขต)

| query (ที่ไหน) | filter/sort | index ที่รองรับ | bound |
|---|---|---|---|
| org context resolution (**ทุก request**) | `where (organizationId, userId)` | `@@unique([organizationId, userId])` (เดิม) | 1 แถว, O(1) |
| `GET /me/organizations` | `where userId, status=active` sort `createdAt desc, id desc` | `@@index([userId, status])` | ≤ 50 org/user (cap fail-closed — architecture §6.3), cursor limit 25 |
| **cap org ต่อ user (ก่อนสร้าง org — I-10)** | `count where userId, status=active` | `@@index([userId, status])` | 1 count, O(log n) |
| `GET /orgs/{id}/members` | `where organizationId (+status?)` sort `createdAt desc, id desc` | `@@index([organizationId, status, createdAt])` | ≤ 200 สมาชิก/org, cursor limit 25 (max 100) |
| count active owners (ทุกครั้งที่ลด owner) | `where organizationId, status=active` + role ที่มี `full_access` | `@@index([organizationId, status, createdAt])` + join `roleId` | ≤ จำนวนสมาชิก org, **อ่านผ่าน `tx` ใต้ row lock เท่านั้น (M-2)** |
| `GET /orgs/{id}/invitations` | `where organizationId (+status)` sort `createdAt desc, id desc` | `@@index([organizationId, status, createdAt])` | cap pending 100/org, cursor limit 25 |
| lookup invitation by token (preview/accept) | `where tokenHash` | `@unique` | 1 แถว, O(1) |
| ตรวจ pending ซ้ำตอนเชิญ | `where organizationId, email, status=pending` | partial unique index | 1 แถว |
| **cap pending invite (M-3)** | `count where organizationId, status=pending, expiresAt > now` | `@@index([organizationId, status, createdAt])` | ≤ 100 (ไม่นับใบที่หมดอายุ) |
| **ยกเลิกคำเชิญค้างตอนถอดสมาชิก (I-1)** | `updateMany where organizationId, email, status=pending` | `@@index([organizationId, email, status])` | ≤ 1 แถว (partial unique การันตี), อยู่ใน tx เดียวกับ revoke |
| **admin-reset fail-closed เงื่อนไข 1 (C-2, อยู่ใน `auth/`)** | `count where userId=target, status=active, organizationId != orgId` | `@@index([userId, status])` | 1 count, O(log n) · **อยู่ใน tx เดียวกับ `user.update` และถูกนับซ้ำหลังเขียน (NEW-5ก)** |
| **admin-reset fail-closed เงื่อนไข 2 (NEW-1/D-030)** | `findUnique (organizationId, userId) select { role: { select: { capabilities } } }` | `@@unique([organizationId, userId])` | 1 แถว O(1) · อ่านผ่าน `tx` เท่านั้น → ป้อนให้ `canAssignRole({ targetIsOwner, newRoleIsOwner:false })` |
| `GET /orgs/{id}/roles` | `where organizationId` | `@@index([organizationId])` (เดิม) | ≤ 20 role/org (F-003 คุมต่อ) |
| `GET /orgs/{id}` | `where id` + join entitlement/plan | PK + `@@unique([organizationId])` บน OrgEntitlement | 1 แถว |

**N+1 discipline (แก้ตาม C-4 — ร่างแรกเขียนผิดจนอันตราย):** member list ดึงข้อมูลชุดเดียว **ด้วย `select` ที่ระบุคอลัมน์เสมอ**
— ห้าม `include: { user: true }` เด็ดขาด (`User` มี `passwordHash` ⇒ mapper แบบ spread หรือ DTO หลุด 1 field
= argon2 hash ของสมาชิกทุกคนขึ้น wire = brute-force offline ได้ + เป็น credential ระดับ global ตาม C-2):

```ts
membership.findMany({
  where: { /* organizationId ถูก inject โดย withOrgScope */ },
  select: {
    id: true, status: true, activatedAt: true, revokedAt: true, createdAt: true,
    user: { select: USER_SELECT },                      // ← ทางเดียวที่แตะ User ได้ (frozen: id/email/createdAt)
    role: { select: { id: true, name: true, key: true } },
  },
  orderBy: [{ createdAt: "desc" }, { id: "desc" }],
});
```

- ห้าม query ใน loop · int test นับจำนวน query บน hot path (`≤ 3` ต่อ request ของ member list)
- **C-3:** query นี้ตั้งต้นจาก `Membership` (org-scoped) แล้ว `select` ขึ้นไปหา `User` — **ห้ามกลับด้าน**
  (`user.findUnique({ include: { memberships: … } })` จะไม่ถูก inject `organizationId` เลยทั้งสาย = cross-org leak)
- **NEW-8 (amend #4) — ห้าม "ลงกลับ" ด้วย:** ตั้งต้นถูกแล้วก็ยังรั่วได้ถ้า traverse **ผ่าน** `User` (org-agnostic)
  กลับลงมาที่ model org-scoped: `select: { user: { select: { memberships: … } } }` คืน membership ของ **org อื่น**
  ⇒ **บังคับด้วยโครงสร้าง: `user: { select: USER_SELECT }` เท่านั้น** (`USER_SELECT` เป็น frozen object ที่
  `packages/db` export และ **ไม่มี key ที่เป็น relation**) — เขียน select ของ `User` เองแบบ inline = CI แดง
- grep gate: `include: { user:` · `orgPrisma.user.` นอก allowlist · **`select: { user: {` ที่ไม่ใช่ `USER_SELECT`**
  = CI แดง (architecture §2.3) · int: เคส nested read "ลงกลับ" ใน `org-leak.kit.ts` (I-35)

---

## §4 Migration plan (skill `prisma-migration`)

### 4.1 สถานะข้อมูลจริงตอนนี้ — และอะไร destructive ได้อย่างปลอดภัย

- **ทุกตารางที่ F-002 แตะว่างเปล่าในทุก environment**: มีแค่ dev เครื่องเรา + CI (`integration-api` สร้าง/ล้างทุกครั้ง)
  — **ยังไม่มี production/staging** (backlog ยังไม่มี feature deploy ด้วยซ้ำ — forward-commitments ระบุ gap นี้ไว้แล้ว)
- ⇒ **drop `Invitation.token` ปลอดภัยตอนนี้เท่านั้น** และเป็นเวลาที่ถูกที่สุดตาม D-018 (ยิ่งช้ายิ่งแพง)
- **precondition ที่ migration ต้องเช็คเอง** (ไม่พึ่งความเชื่อ):
  ```sql
  DO $$ BEGIN
    IF (SELECT count(*) FROM "Invitation") > 0 THEN
      RAISE EXCEPTION 'F-002 migration aborted: Invitation table is not empty — token→tokenHash needs a backfill plan';
    END IF;
  END $$;
  ```
  ถ้าเจอข้อมูล = migration **หยุด** และต้องกลับมาออกแบบ backfill (ซึ่งทำไม่ได้จริง เพราะ hash ย้อนกลับไม่ได้ →
  ทางเดียวคือ invalidate คำเชิญค้างทั้งหมด ซึ่งต้องให้ product เคาะ)

### 4.2 ลำดับ migration (2 ไฟล์ ใน PR เดียว — expand ก่อน contract เสมอ)

**`f002_expand`** (ไม่ทำลายอะไรเลย, ย้อนกลับได้)
1. `ALTER TYPE "InvitationStatus" ADD VALUE 'cancelled';` *(ต้องอยู่ migration ของตัวเองหรือ commit ก่อนถูกใช้ — Postgres ไม่ให้ใช้ค่า enum ใหม่ใน tx เดียวกับที่เพิ่ม)*
2. `Organization`: `ADD COLUMN createdByUserId text NULL` · `CREATE INDEX ON "Organization"("taxId")`
3. `Membership`: `ADD COLUMN activatedAt/revokedAt timestamptz NULL, revokedByUserId text NULL` ·
   `CREATE INDEX ON "Membership"("userId","status")` · `CREATE INDEX ON "Membership"("organizationId","status","createdAt")`
4. `Invitation`: `ADD COLUMN tokenHash text NULL` (ชั่วคราว nullable) · `tokenIssuedAt timestamptz NOT NULL DEFAULT now()` ·
   `invitedByUserId/acceptedByUserId text NULL` · `acceptedAt/cancelledAt/acceptedUserCreatedAt timestamptz NULL` ·
   `updatedAt timestamptz NOT NULL DEFAULT now()` ·
   `CREATE UNIQUE INDEX ON "Invitation"("tokenHash")` ·
   `CREATE INDEX ON "Invitation"("organizationId","status","createdAt")` ·
   `CREATE INDEX ON "Invitation"("organizationId","email","status")` ·
   `CREATE UNIQUE INDEX "Invitation_org_email_pending_key" ON "Invitation"("organizationId","email") WHERE status = 'pending'`
5. `Warehouse`: `CREATE UNIQUE INDEX "Warehouse_org_default_key" ON "Warehouse"("organizationId") WHERE "isDefault"`
6. **`Role` (amend #3):** `ADD COLUMN "key" text NULL` · `CREATE UNIQUE INDEX "Role_org_key_key" ON "Role"("organizationId","key")`
   — **ไม่ต้อง backfill** (ตาราง `Role` ว่างทุก env เพราะยังไม่มี org; role ถูกสร้างตอนสร้าง org เท่านั้น) ·
   ถ้าวันหนึ่งมีข้อมูลจริงต้อง backfill จาก `name` → key ก่อน ⇒ ใส่ precondition แบบเดียวกับ §4.1

**`f002_drop_invitation_token`** (destructive — แยกไฟล์ ให้ review/ย้อนได้เป็นเอกราช)
6. precondition check §4.1
7. `ALTER TABLE "Invitation" ALTER COLUMN "tokenHash" SET NOT NULL;`
8. `ALTER TABLE "Invitation" DROP COLUMN "token";` *(unique index ของมันหายไปพร้อมกัน)*

> ทำไมยังแยกสองไฟล์ทั้งที่ตารางว่าง: (ก) วินัย expand→contract ต้องไม่ถูกละเมิดแม้ในเคสง่าย เพราะ agent ตัวถัดไป
> จะลอก pattern (ข) ถ้า precondition ล้ม เรายัง apply เฉพาะ expand ได้แล้วหยุด — ไม่ใช่ล้มทั้งชุด

### 4.3 Rollback path

| migration | rollback |
|---|---|
| `f002_expand` | ย้อนได้จริง: drop คอลัมน์/index ที่เพิ่ม (ยังไม่มีโค้ดพึ่งพาก่อน deploy) |
| `f002_drop_invitation_token` | **forward-only** — คอลัมน์ `token` ที่ทิ้งแล้วสร้างกลับได้ (empty) แต่ข้อมูลเดิมไม่มีให้กู้อยู่แล้ว (ตารางว่าง) · ถ้าต้องย้อนจริง: สร้างคอลัมน์ `token text NULL` กลับ + drop NOT NULL ของ `tokenHash` · **enum value `cancelled` ถอดไม่ได้** ใน Postgres (ยอมรับ — ค่า enum ที่ไม่ถูกใช้ไม่มีผลเสีย) |

### 4.4 Before-merge checklist (ตาม skill)

- [ ] รันกับ DB ที่ seed ≥ 2 org — up สะอาด, `prisma migrate status` ไม่มี drift
- [ ] multi-tenant ครบ: ทุกตารางที่แตะยังมี `organizationId` + index ตาม §3.5
- [ ] ไม่มีคอลัมน์เงิน/สต๊อกถูกแตะ (F-002 ไม่แตะ ledger เลย — grep ยืนยัน)
- [ ] `pnpm --filter @omnistock/db test` + `apps/api test:integration` เขียวใน CI จริง (green locally ≠ tested)
- [ ] rollback path เขียนเป็นคอมเมนต์ในไฟล์ migration ทั้งสอง
- [ ] **M-9:** unit test ของ `withOrgScope` ผ่านครบทุก operation รวม `upsert` — ถ้าแถวไหนไม่ผ่าน **ต้องแก้เอกสาร
      architecture §2.2 ก่อน merge** (ห้ามปล่อยตารางที่อ้างสิ่งที่ไม่จริงไว้ให้ feature ถัดไปเชื่อ)
- [ ] **C-3/C-4 gate เขียว:** grep gate (`orgPrisma.<org-agnostic model>.`, `include: { user:`) + assertion กลาง
      "ไม่มี `passwordHash`/`tokenHash` ใน response ใด ๆ"

---

## §5 Seed (ของที่ต้องมีก่อนระบบทำงานได้)

### 5.1 `PlanDefinition` — `packages/db/prisma/seed.ts` (ใหม่, idempotent `upsert` by `key`)

| key | tierLabel | features (jsonb) ตั้งต้น | ใช้เมื่อไหร่ |
|---|---|---|---|
| `comp_full` | Full (comp) | `{ accounting: true, marketplace_sync: true, max_users: 20, max_channel_accounts: 5 }` | dogfood/internal (ค่าเริ่มของ `DEFAULT_ORG_PLAN_KEY`) |
| `full` | Full | `{ accounting: true, marketplace_sync: true, max_users: 10, max_channel_accounts: 3 }` | ลูกค้าที่ซื้อ Full (F-080) |
| `sync` | Sync | `{ accounting: false, marketplace_sync: true, max_users: 5, max_channel_accounts: 2 }` | ลูกค้า Sync tier |
| `free` | Free | `{ accounting: false, marketplace_sync: false, max_users: 2 }` | **ไม่ผูกอัตโนมัติให้ใคร** (AC US-1) — มีไว้ให้ F-007/F-080 ใช้ตอน downgrade |

> ค่าตัวเลข cap เป็น **ค่าตั้งต้นเพื่อให้ระบบเดินได้** — ความหมายเชิงธุรกิจและการบังคับใช้เป็นของ **F-007/F-082**
> (F-002 ไม่อ่าน `features` เลยแม้แต่ key เดียว)

### 5.2 System roles ที่ถูกสร้าง **ตอนสร้าง org** (ไม่ใช่ seed ระดับระบบ — role เป็นราย org)

| name | **`key`** | `isSystem` | capabilities |
|---|---|---|---|
| `Owner` | **`owner`** | `true` (ล็อก แก้/ลบไม่ได้ ตาม docs/01) | `["full_access"]` |
| `Admin` | **`admin`** | `false` | `["manage_members","manage_org_settings","manage_products","manage_stock","manage_channels","manage_orders","view_financials"]` |
| `Staff` | **`staff`** | `false` | `["manage_products","manage_stock","manage_orders"]` |

- ชื่อ capability ทั้งหมดมาจาก **registry ปลายเปิดใน docs/01 §2** — F-002 ไม่คิดชื่อใหม่เอง
- F-002 **บังคับใช้จริงแค่ 2 ตัว** (`manage_members`, `manage_org_settings`) ที่เหลือคือค่าที่รอ F-003+ มาใช้
- `Owner.isSystem = true` ⇒ F-003 ต้องห้ามแก้/ลบ role นี้ (บันทึกเป็นข้อกำหนดส่งต่อ)
- **นิยามที่กฎความปลอดภัยใช้ (สำคัญ — อย่าเปลี่ยนเป็นเทียบชื่อ):**
  - **"role นี้เป็น Owner"** ⇔ `capabilities` มี **`full_access`** → ใช้โดย `canAssignRole` (C-1), `assertOwnerRemains` (US-6)
  - **"role นี้เป็น role สูง"** ⇔ `capabilities` มี `full_access` **หรือ** `manage_members` → ใช้โดย `invitationTtlHours` (24 ชม., D-028)
  - เหตุผล: F-003 จะเปิดให้เปลี่ยนชื่อ role/สร้าง custom role ⇒ เทียบ `name === "Owner"` จะพังเงียบทันทีที่มี
    custom role ที่ถือ `full_access` แต่ชื่ออื่น · เทียบที่ capability = กฎยังถูกโดยไม่ต้องแก้โค้ดตอน F-003
  - ⛔ **และห้ามเทียบ `key === "owner"` ด้วยเหตุผลเดียวกัน** — `key` ถูกเพิ่มเพื่อ **แปลคำบนจอ** (ux Q4) ล้วน ๆ ·
    ต้องมี **grep gate** ที่ทำให้การใช้ `role.key`/`roleKey` ในเส้นทางตัดสินสิทธิ์ (ทั้ง api และ client) เป็น CI แดง
    มิฉะนั้นภายใน 2 feature จะมีคนเขียน `if (roleKey === 'owner')` แล้วช่อง C-1 กลับมาโดยไม่มีใครรู้
- **`key` ของ system role เป็นส่วนหนึ่งของ API contract** — เปลี่ยนค่า = breaking change ต่อ client
  (ต่างจาก `name` ที่เป็นแค่ข้อความ) · custom role ของ F-003 = `null` เสมอใน Phase 0

---

## §6 Pure functions ใหม่ใน `packages/core-domain` (กฎทอง 6 — พร้อม test ประกบ)

| ไฟล์ | หน้าที่ | test matrix ขั้นต่ำ |
|---|---|---|
| `src/orgs/owner-invariant.ts` | `assertOwnerRemains({ owners, change })` — ตัดสินว่าการเปลี่ยน role/revoke จะทำให้ owner active เหลือ 0 หรือไม่ | owner 1 คนลดตัวเอง / ถอดตัวเอง / owner 2 คน / owner ที่ `revoked` ไม่นับ / `invited` ไม่นับ / non-owner → owner / เปลี่ยน role ของ non-owner (ต้องผ่าน) |
| **`src/orgs/member-authz.ts`** *(ใหม่ — C-1/D-028 · call site ครบ **5 เส้น** หลัง amend #4: `PATCH`/`DELETE` members · create invite · **reissue (NEW-2)** · **admin-reset (NEW-1/D-030)**)* | `canAssignRole({ actorCapabilities, targetIsOwner, newRoleIsOwner })` — **ต้องมี `full_access` เท่านั้น** จึงจะ (ก) มอบ/เชิญด้วย role ที่มี `full_access` (ข) แก้/ถอด membership ที่ปัจจุบันมี `full_access` **(ค) ออกลิงก์ใหม่ของคำเชิญ role Owner (ง) รีเซ็ตรหัสของสมาชิกที่เป็น Owner** | **8 เคสบังคับ** (pure fn ตัวเดิม — ไม่เพิ่ม parameter, call site ใหม่แค่ป้อนค่าให้ถูก)**:** ① actor=Admin, target=Staff, newRole=Staff → **true** ② actor=Admin, target=Staff, newRole=Owner → **false** (ยกคนอื่นเป็น Owner) ③ actor=Admin, target=**ตัวเอง**, newRole=Owner → **false** (ยกตัวเอง — เคสหลักของ C-1) ④ actor=Admin, target=Owner, newRole=Staff → **false** (ลดสิทธิ์ Owner) ⑤ actor=Admin, target=Owner, revoke (`newRoleIsOwner=false`) → **false** (ถอด Owner) ⑥ actor=Owner ทำ ②–⑤ ทั้งหมด → **true** ⑦ actor มี `manage_members` แต่ไม่มี `full_access` + role ใหม่มี `full_access` (custom role ที่ไม่ได้ชื่อ Owner) → **false** ⑧ actorCapabilities ว่าง → **false** ทุกกรณี |
| **`src/orgs/invitation-policy.ts`** *(ใหม่ — I-1/I-9/M-6/D-028)* | `invitationTtlHours(roleCapabilities)` → `24` ถ้ามี `full_access`/`manage_members` มิฉะนั้น `168` · `canAcceptInvitation({ invitation, membership, roleExistsInOrg, now })` → `'ok' \| 'expired' \| 'cancelled' \| 'already_accepted' \| 'already_member' \| 'superseded' \| 'role_unavailable'` | **TTL:** `["full_access"]`→24 · `["manage_members",…]`→24 · `["manage_products"]`→168 · `[]`→168 · **accept:** ไม่มี membership → `ok` · membership `active` → `already_member` (I-9) · membership `revoked` ที่ `revokedAt > tokenIssuedAt` → `superseded` (I-1) · membership `revoked` ที่ `revokedAt < tokenIssuedAt` → `ok` (เชิญใหม่หลังถอด) · `revokedAt` เท่ากับ `tokenIssuedAt` พอดี → `superseded` (เลือกฝั่งปลอดภัย) · membership `invited` → `superseded` (dead state ต้องไม่ผ่าน) · `roleExistsInOrg=false` → `role_unavailable` (M-6) · `expiresAt` ผ่านมาแล้ว → `expired` (ตรวจก่อนทุกอย่าง) · invitation `cancelled`/`accepted` → ตามสถานะ · **ลำดับความสำคัญของผลลัพธ์ต้องถูก pin ด้วย test** (คำเชิญหมดอายุ + เป็นสมาชิกอยู่แล้ว → `expired`) |
| `src/orgs/thai-tax-id.ts` | `isValidThaiTaxId(value)` — 13 หลัก + **checksum mod-11**: `check = (11 - (Σ dᵢ×(13−i) for i=0..11) mod 11) mod 10` | เลขถูกต้อง (บุคคล/นิติบุคคล) / check digit ผิด / ไม่ครบ 13 / มีขีดหรือช่องว่าง (normalize ก่อน) / มีตัวอักษร / ทั้งหมดเป็น 0 |
| `src/orgs/thai-tax-id.ts` | `isValidBranchCode(value)` — 5 หลัก (`"00000"` = สำนักงานใหญ่) | ครบ 5 หลัก / สั้น-ยาว / ไม่ใช่ตัวเลข / undefined ผ่าน (optional) |
| `src/orgs/invitation-status.ts` | `resolveInvitationStatus(inv, now)` (§3.2) | pending ก่อน/หลัง/ตรง `expiresAt` พอดี · accepted/cancelled ไม่ถูก override |
| `src/orgs/invitation-email.ts` | `maskEmail(email)` → `u***@example.com` | ชื่อสั้น 1 ตัว / ชื่อยาว / ไม่มี `@` (โยน) |
| **`src/orgs/tax-id-mask.ts`** *(ใหม่ — I-8/D-028)* | `maskTaxId(taxId)` → `•••••••••4567` (เห็น 4 ตัวท้าย) | 13 หลักปกติ / `null` → `null` / ค่าที่สั้นกว่า 4 หลัก (ข้อมูลผิดรูปใน DB) → mask ทั้งหมด ไม่ throw / ไม่คืนค่าเต็มในทุกกรณี |

> **หมายเหตุ checksum:** ถ้า dogfood เจอเลขจริงที่ผ่านสรรพากรแต่ตกเช็ค checksum ของเรา → **อย่าปลดเช็คเงียบ ๆ**
> ให้ log ตัวอย่าง แล้วออก D-XXX เพื่อผ่อนเป็น "13 หลักอย่างเดียว" — จุดนี้จงใจให้ตรวจเข้มไว้ก่อนเพราะ TIN ผิด
> = ใบกำกับภาษีผิด = ต้นทุนแก้สูงกว่ามาก

---

## §7 sync-back (ต้องแก้ docs กลาง — PM ทำหลัง user เคาะ)

**กระทบส่วนกลาง** — [docs/01-data-model.md](../../01-data-model.md) §2 "Tenancy & Auth":

```
Role           id, organizationId, name, isSystem, capabilities,
               key?          // ← F-002/amend#3: "owner|admin|staff" สำหรับ system role · custom (F-003) = null
                             //   @@unique([organizationId, key]) · ใช้แปลชื่อบนจอเท่านั้น
                             //   ⛔ ห้ามใช้ตัดสินสิทธิ์ — สิทธิ์ = capabilities (full_access)
Membership     id, organizationId, userId, roleId, status (active|invited|revoked),
               activatedAt?, revokedAt?, revokedByUserId?          // ← F-002: deactivate ไม่ delete
               // สมาชิกออกจาก org เองได้ (D-029): เขียน revoked + revokedByUserId = ตัวเอง (event org.member.left)
               // 'invited' = dead state ใน Phase 0 (ไม่มี write path) — ต้องถูกปฏิเสธเหมือน revoked
               // revokedAt ถูกใช้เป็นกติกาความปลอดภัย: accept คำเชิญที่ออกก่อน revokedAt ไม่ได้ (F-002/D-028)
Invitation     id, organizationId, email, roleId,
               status (pending|accepted|cancelled),                 // ← F-002: +cancelled; expired = derived
               tokenHash (HMAC keyed, unique), tokenIssuedAt, expiresAt,   // ← F-002/D-018: hash-at-rest
               invitedByUserId?, acceptedAt?, acceptedByUserId?, acceptedUserCreatedAt?, cancelledAt?
               // expiresAt = now + 24 ชม. ถ้า role มี full_access|manage_members มิฉะนั้น 7 วัน (D-028)
               // "ออกลิงก์ใหม่" = rotate tokenHash + นับอายุใหม่จากเวลาที่ออก (D-027)
               //   · ต้องผ่าน canAssignRole เหมือนตอนเชิญ (คำเชิญ role Owner = Owner เท่านั้น) — F-002/NEW-2
               // ธง "บัญชีถูกสร้างหลังคำเชิญ" เทียบ acceptedUserCreatedAt กับ **createdAt** (ไม่ใช่ tokenIssuedAt
               //   ซึ่ง rotate เขียนทับได้ = ล้างสัญญาณ forensic) — F-002/NEW-9
               //   ส่วนกฎ INVITATION_SUPERSEDED ยังเทียบ revokedAt กับ tokenIssuedAt ตามเดิม (เจตนาต่างกัน)
Organization   ... , createdByUserId?
               // taxId มี index แต่ NOT unique ข้าม org (กัน cross-tenant oracle) — F-002 §3.4
               // taxId เต็มออกทาง POST /orgs/{id}/tax-profile/reveal เส้นเดียว (manage_org_settings + event
               //   + rate limit 20/ชม.); GET /orgs/{id} ไม่คืน taxId ให้ใครเลย และผู้ที่ไม่มี manage_org_settings
               //   ไม่ได้แม้แต่ค่า mask (PDPA — D-028 + ux Q13 + D-030) — F-002 §3.3
               // สร้าง org = Organization + system Roles(Owner/Admin/Staff) + Membership(Owner,active)
               //            + OrgEntitlement + default Warehouse ใน transaction เดียว (F-002)
               // cap 50 org ต่อ user (fail-closed ที่ service) — F-002 architecture §6.3
Warehouse      ... , @@unique([organizationId]) WHERE isDefault      // ← F-002: 1 org = 1 default
```

[docs/02-architecture.md](../../02-architecture.md) §5 — เพิ่มบรรทัดกลไกจริงของ multi-tenant
(`X-Organization-Id` → `OrgContextMiddleware` ALS → `ORG_PRISMA` = `withOrgScope`; `SYSTEM_PRISMA` allowlist ระดับไฟล์)
· **+ ข้อจำกัดที่ต้องเขียนไว้:** ชั้นนี้ไม่ครอบ nested read และไม่ครอบ query ที่ตั้งต้นจาก model org-agnostic
(กติกา C-3) — ถ้าไม่บันทึก feature ถัดไปจะเชื่อว่า "ได้ org scoping ฟรี" แบบไม่มีเงื่อนไข
· รายละเอียดเต็มอยู่ [architecture.md §14](architecture.md)
