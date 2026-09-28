---
doc: data-model
owner: "@backend-api"
signoff: approved     # user 2026-09-27 (+ รับ D-036/D-037)
---
# [F-003] Data model (ส่วนที่ feature นี้เพิ่ม/แก้)
> **amendment 2026-09-29 (build · security review ของ T-003-B04 — เจตนาเดิมของ SR-04 ไม่เปลี่ยน):** ชุดอักขระที่ชื่อ role ห้ามมี ขยายจาก `Cc ∪ Cf`
> เป็น **`Cc ∪ Cf ∪ Default_Ignorable_Code_Point ∪ Co ∪ Cs ∪ {U+115F, U+1160, U+3164, U+FFA0, U+2800}`** (ค่าคงที่เดียว `ROLE_NAME_FORBIDDEN_CHARACTER` ใน core-domain ·
> DB CHECK สร้างจากชุดเดียวกันด้วยเครื่อง · parity gate G3-07) — review probe พบว่าอักขระมองไม่เห็นที่ไม่ใช่ Cf (Hangul filler, braille blank, CGJ, variation selector, private use)
> เลี่ยงคำสงวน "เจ้าของร้าน" ได้ ⇒ "ความเสี่ยงคงเหลือที่รับ" เรื่อง U+3164/U+2800 ใน §2.1 **ไม่มีแล้ว** · ที่ยังรับ: Thai homoglyph/วรรณยุกต์ซ้อน (ux ไม่ fuzzy — forward-commitments) · ผลข้างเคียง: emoji ที่ใช้ U+FE0F/ZWJ ตั้งเป็นชื่อ role ไม่ได้ · ทุกที่ในเอกสารนี้ที่เขียน "Cc/Cf" ให้อ่านเป็นชุดนี้
> **amendment 2026-09-29 (build · review ของ T-003-B10):** CHECK ชื่อ (§3.1) และ pre-flight (§4.1) **ไม่ใช้ `btrim()`/`\s` ของ Postgres** (ตัดแค่ U+0020 / ขึ้นกับ ctype) —
> ใช้ชุด whitespace ของ JS `\s` ที่สร้างด้วยเครื่อง: ห้ามหัว/ท้าย · ห้ามซ้อน · **ห้าม whitespace อื่นนอก U+0020 ทุกตำแหน่ง** (ค่าที่ service เขียนผ่านเสมอเพราะ normalize ยุบเป็น U+0020 แล้ว — CHECK กันเฉพาะ raw SQL/เส้นทางที่ข้าม normalize) ·
> migration ตั้ง `SET lock_timeout = '5s'` · ข้อจำกัดคงเหลือ: `lower()` ใต้ `LC_CTYPE=C` fold เฉพาะ ASCII (ไทยไม่มีตัวพิมพ์ — service ยังจับได้) → forward-commitments (devops)
> อ้างอิง/ต่อยอดจาก [docs/01-data-model.md](../../01-data-model.md) + schema ที่ ship จริง (`packages/db/prisma/schema.prisma`)
> ต่อจาก [architecture.md](architecture.md) · data-model ขับ [api-spec.md](api-spec.md) · D-028 · D-030 · D-032 · D-033 · D-034 · D-035
> รอบ 3 (2026-09-27): แก้ตาม security-review SR-03/04/06/07/09/10/12 — ตารางรวมที่ architecture §15
> รอบ 4 (2026-09-27): D-034 Addendum (นับผู้ถือ role — ไม่มี schema ใหม่) · D-035 Addendum (`issuedByUserId` = ผู้ออกลิงก์ล่าสุด · แก้คำอ้าง "fail-closed" ระหว่าง rolling ใน §5)
> รอบ 5 (2026-09-27): D-034 Addendum 2 (floor `manage_members` เมื่อแก้/ลบ role ที่มีผู้ถืออื่น — ตรรกะล้วน **ไม่มี schema ใหม่**) · N-2 = known risk พร้อมเหตุผล (§5)

## Contract summary (≤20 บรรทัด — ทีม consumer อ่านแค่ส่วนนี้)
- **Capability registry ไม่อยู่ใน DB** — ค่าคงที่ใน `core-domain/src/rbac/registry.ts` · entry = `{ key, scope:"org", labelTh, descriptionTh, group, tier, status, implies, selectable }` (§1) · เพิ่ม key = แก้ไฟล์นี้ ไม่ migrate (AC-7.2) · **เส้น `implies` ที่ ship ห้ามลบ** (snapshot test)
- **`Role` เพิ่ม 6 column** (default/nullable — additive): `version` · `nameCustomized` · `lastEditedAt` · `lastEditedByUserId` · `deletedAt` · `deletedByUserId`
- **`Invitation` เพิ่ม 1 column** `issuedByUserId?` (ผู้ออกลิงก์ล่าสุด — create **และ reissue** เขียนใน statement เดียวกับ token · accept re-check D-035 + Addendum ใช้ `COALESCE(issuedByUserId, invitedByUserId)`) · `Membership`/`User` ไม่เปลี่ยน · **การนับผู้ถือ role (D-034 Addendum + Addendum 2) ใช้ index `Membership(roleId)` เดิม — ไม่มี index/column ใหม่**
- **ลบ role = soft-delete** (`deletedAt`) — ประวัติยัง join ชื่อ role ได้ (AC-3.9b) · live read กรองผ่าน helper เดียว + gate · **แถวที่ลบ ≤ 500/ร้าน**
- **ชื่อ (AC-3.4/3.5):** NFC + trim + ยุบช่องว่าง → **ห้าม code point หมวด Cc/Cf** (zero-width, bidi — SR-04) ทั้ง core-domain และ DB CHECK · unique `("organizationId", lower(name)) WHERE "deletedAt" IS NULL` · คำสงวน `เจ้าของร้าน`/`ผู้ดูแล`/`พนักงาน` exact หลัง normalize
- **DB เป็นตาข่ายชั้นสุดท้าย:** CHECK `full_access ⇒ isSystem` · caps ≥ 1 · system ลบไม่ได้ · ชื่อไม่มี Cc/Cf · trigger ล็อกแถว system · **ห้าม `isSystem` false→true + 1 system role/ร้าน** (SR-07) · trigger กัน reference ที่ live ชี้ role ที่ลบ — **อ่าน Role FOR SHARE** (SR-06)
- **Backfill `manage_roles` → Admin (AC-1.3):** SQL **แหล่งเดียว** · `key='admin'` **และ** caps ตรงชุด F-002 · idempotent · Owner ≥ 1 RAISE · **bridge trigger มีเจ้าของ (backend-api) + วันถอดที่ G-12 บังคับ** (§4.2)
- **rolling/stop-start:** schema เข้ากับโค้ด F-002 ทั้งสองแบบ — **แต่ความปลอดภัยของกฎใหม่เริ่มเมื่อ instance F-002 หมด** · การสร้าง role ปิดด้วย `ROLE_WRITES_ENABLED` จนถึงตอนนั้น (§4.4) · rollback โค้ดปลอดภัยเฉพาะเมื่อ flag ไม่เคยเปิด (§4.3)
- **capabilities เก็บแบบ canonical** — ค่าที่เขียนต้องเป็น `ValidatedCapabilities` (branded)
- **`lastEdited.by` บน wire** = `{ kind, roleName?, roleKey?, roleNameCustomized? }` (AC-9.6 ตาม user 2026-09-27) · join ผ่าน ORG_PRISMA เท่านั้น (SR-09)
- **sync-back docs/01:** diff ที่เสนอใน §6 (ห้ามแก้เอง — protected)

---

## 1. Capability registry (AC-7.1 · 7.2 · 7.3 · 7.4 · 7.5 · US-8)

**ที่อยู่:** `packages/core-domain/src/rbac/registry.ts` (pure data + frozen) — **ไม่ใช่ตาราง DB** เพราะ (1) สิทธิ์ใหม่มาพร้อมโค้ดของ feature เสมอ (2) default deny ต้องจริงโดยไม่ต้อง migrate (3) route guard ต้องตรวจ key ตอน compile/test ได้

```ts
export type CapabilityKey = typeof CAPABILITY_REGISTRY[number]["key"];   // union ของ literal
export type CapabilityGroup = "team" | "shop" | "catalog_stock" | "channels" | "orders" | "finance";

export interface CapabilityDef {
  readonly key: string;                 // snake_case · ห้ามเปลี่ยน/ลบเมื่อ ship (ข้อมูลใน Role.capabilities อ้างถึง)
  readonly scope: "org";                // US-8: literal เดียว — capability ข้ามร้าน = แก้ type = ผ่าน review
  readonly labelTh: string;             // ป้าย — copy เจ้าของ = ux (เสนอ D-037 ที่ ux รับ: ux แก้ไฟล์นี้ได้ + copy-lint ครอบไฟล์นี้)
  readonly descriptionTh: string;       // 1 ประโยค "ทำอะไรได้จริง" (เงื่อนไข ux — lint ตรวจ ≤ 1 ประโยค)
  readonly group: CapabilityGroup | null; // null = ไม่อยู่ใน checklist (full_access)
  readonly tier: "all" | "full";        // full = ซ่อน + สร้าง/แก้ไม่ได้ จน F-007 (AC-7.4)
  readonly status: "live" | "upcoming"; // upcoming = "เร็ว ๆ นี้" ติ๊กล่วงหน้าได้ (AC-7.5)
  readonly implies: readonly string[];  // manage_X → [view_X] เมื่อ view_X มีอยู่ (AC-7.3)
  readonly selectable: boolean;         // false = ห้ามอยู่ใน request (full_access)
}
```

**ค่า ณ F-003** (ป้ายไทยเป็นร่างจาก F-003 §4.1 — ux เคาะ):

| key | group | tier | status | implies | selectable |
|---|---|---|---|---|---|
| `full_access` | null | all | live | — (wildcard ใน `expandCapabilities`) | ❌ |
| `manage_members` | team | all | live | — | ✅ |
| `manage_roles` **ใหม่** | team | all | live | — | ✅ |
| `manage_org_settings` | shop | all | live | — | ✅ |
| `manage_billing` | shop | all | upcoming | — | ✅ |
| `manage_products` | catalog_stock | all | upcoming | — | ✅ |
| `manage_stock` | catalog_stock | all | upcoming | — | ✅ |
| `manage_channels` | channels | all | upcoming | — | ✅ |
| `manage_orders` | orders | all | upcoming | — | ✅ |
| `view_financials` | finance | all | upcoming | — | ✅ |
| `access_accounting` | finance | **full** | upcoming | — | ✅ (แต่ซ่อนด้วย tier) |

- **`implies` ว่างทุกตัวใน F-003** — กลไกต้องมีและทดสอบด้วย **fixture registry** (unit) · คู่แรกเกิดเมื่อ feature แรกเพิ่ม `view_*`
- **ข้อความที่ยังอยู่ฝั่ง client (เงื่อนไข ux ของเสนอ D-037):** "เร็ว ๆ นี้" · "มาพร้อมสิทธิ์จัดการ" · fallback ของ key/group/status ที่ไม่รู้จัก
- **invariant ที่ unit test pin:** key ไม่ซ้ำ · `implies` ชี้ key ที่มีจริง + ไม่มี cycle + รูป `manage_X → view_X` + **ชั้นเดียว** · `selectable=false` ตัวเดียวคือ `full_access` · ทุก entry `scope==="org"` · `SYSTEM_ROLE_BLUEPRINT` ⊆ registry · **ทุก capability ใน `ROUTE_CAPABILITIES` ∈ registry และ `status==="live"`** · **snapshot เส้น implies ที่ ship แล้ว — ลบเส้น = แดง** (SR-11: role เก็บแบบ canonical ⇒ ลบเส้นทำให้ผู้ถือเสีย `view_X` เงียบ ๆ; ถ้าจำเป็นต้องลบ ต้องมี data migration เติม `view_X` คืนก่อน)
- `CAPABILITY_MANAGE_ROLES = "manage_roles"` ใหม่ · ค่าคงที่เดิม re-export จาก registry — ค่า string ไม่เปลี่ยน

## 2. `Role` — ส่วนที่เพิ่ม/แก้

```prisma
model Role {
  // …เดิม: id, organizationId, name, isSystem, capabilities, key, createdAt, updatedAt
  version            Int       @default(1)      // NEW — optimistic concurrency (AC-3.12)
  nameCustomized     Boolean   @default(false)  // NEW — AC-1.5 (มีความหมายเฉพาะ key ≠ null)
  lastEditedAt       DateTime?                  // NEW — AC-9.6 (null = ค่าเริ่มต้นของระบบ)
  lastEditedByUserId String?                    // NEW — no FK (pattern เดียวกับ revokedByUserId)
  deletedAt          DateTime?                  // NEW — soft delete (AC-3.8/3.9b)
  deletedByUserId    String?                    // NEW — no FK

  // REMOVED: @@unique([organizationId, name])  → แทนด้วย expression partial unique (raw SQL, §3)
  // NEW (raw SQL, §3.2): partial unique ("organizationId") WHERE "isSystem" — 1 system role ต่อร้าน (SR-07)
  @@unique([organizationId, key])   // เดิม
  @@unique([organizationId, id])    // เดิม (B-1 composite FK target)
  @@index([organizationId])         // เดิม
}
```

### 2.1 ตาม checklist "Gate 2 ต้องครอบ" ของ F-003.md

| หัวข้อ | การตัดสิน | เหตุผล |
|---|---|---|
| **version สำหรับ 409** | `version Int @default(1)` · PATCH ต้องส่ง `version` · `updateMany where {id, version}` + `increment` · 0 แถว ⇒ `409 ROLE_CHANGED` | ไม่ใช้ `updatedAt` เป็น token (ms ชนได้ + trigger/backfill ขยับโดยไม่เปลี่ยนความหมาย) · backfill **bump version** |
| **ธง "ชื่อถูกเปลี่ยน" (AC-1.5)** | `nameCustomized` = `true` เมื่อ PATCH เปลี่ยนชื่อ (หลัง normalize ต่างจากเดิม) · ไม่กลับเป็น false · **บน wire** ส่ง `nameCustomized = key === null \|\| column` ⇒ client: `nameCustomized ? name : (แปล key ?? name)` | เก็บ "สิ่งที่ผู้ใช้ทำ" ไม่ derive จาก `name ≠ blueprint` |
| **แก้ไขล่าสุดโดย/เมื่อ (AC-9.6)** | เขียน `lastEditedAt/ByUserId` เมื่อ: สร้าง · PATCH ที่ชื่อ**หรือ** capabilities เปลี่ยนจริง · **ไม่เขียน**: no-op · ลบ · backfill · seed · สถานะผู้แก้ derive ตอนอ่าน: `me` / `member` / `former_member` · **projection (user ตัดสิน 2026-09-27):** `by { kind, roleName?, roleKey?, roleNameCustomized? }` — "คุณ" / ชื่อบทบาทปัจจุบัน / "อดีตสมาชิก" · `roleName` = join `Membership(active, userId = lastEditedByUserId) → Role` **ผ่าน ORG_PRISMA (org ถูกฉีด) เท่านั้น** ณ ตอนอ่าน (SR-09 — ห้าม raw/SYSTEM_PRISMA: ลืมกรอง org = ชื่อ role ของร้านอื่นรั่ว) | ไม่มี FK ไป `User` (PDPA) · `User` ไม่มีชื่อที่แสดง · **ไม่มี `displayName?` ใน F-003** (api-spec §3 — เพิ่มแบบ additive เมื่อมี feature profile) · **รับทราบ (SR-09):** role ที่มีผู้ถือคนเดียว + `usage.activeMembers=1` ข้างกัน ⇒ ผู้ดูที่มี `manage_roles` อนุมานตัวคนได้ในร้านเล็ก (product ลงไว้ใน F-003 §5 แล้ว) |
| **สถานะ live/upcoming (AC-7.5)** | อยู่ใน registry ไม่อยู่ใน DB · กฎ ⊆ นับ key upcoming เหมือนปกติ | สถานะเปลี่ยนพร้อมโค้ด feature |
| **registry entry shape** | §1 | — |
| **unique ชื่อ case-insensitive (AC-3.4) + อักขระต้องห้าม (SR-04)** | `normalizeRoleName` (core-domain) = `normalize("NFC")` → `trim()` → ยุบ `\s+` เป็น U+0020 ตัวเดียว · **แล้ว** `validateRoleName` ปฏิเสธถ้าเหลือ code point ที่ `/[\p{Cc}\p{Cf}]/u` match (ZWSP/ZWNJ/ZWJ U+200B–200D · LRM/RLM U+200E–200F · bidi U+202A–202E/U+2066–2069 · WORD JOINER U+2060 · soft hyphen U+00AD ฯลฯ) → `422 VALIDATION_FAILED` `fieldErrors.name` · ลำดับนี้ทำให้ tab/newline/U+FEFF (ซึ่ง JS `\s` จับ) **ถูกยุบเป็นช่องว่าง** ไม่ใช่ถูกปฏิเสธ — พฤติกรรมเดิมของร่างรอบ 2 · CHECK ใน DB (§3.1) ตรงกัน · unique index `"Role_org_name_ci_live_key" ON "Role" ("organizationId", lower(name)) WHERE "deletedAt" IS NULL` · P2002 → `409 ROLE_NAME_TAKEN` · **gate Unicode parity (unit):** enumerate ทุก code point 0..0x10FFFF ที่ `/[\p{Cc}\p{Cf}]/u` ของ Node ที่รัน CI match → ต้องเท่ากับชุดที่ parse ได้จาก character class ใน migration SQL ทุกตัว (set-equality — Node อัปเกรด Unicode แล้วมี Cf ใหม่ = แดง ⇒ ต้องออก migration เติม) · non-vacuity: ชุดต้องมี U+200B และ U+202E · **unit fixture ต่อ code point:** `"เจ้า​ของร้าน"`, `"‮นาหร"`, `"พนัก⁠งาน"`, `"Owner﻿"` (ต้องถูกยุบ/ตัดเป็น `"Owner"` แล้วชน unique) | ไม่มี column `nameKey` (โค้ด F-002 ระหว่าง rolling จะ insert โดยไม่ใส่ค่า) · expression index ไม่ต้องให้ใครเขียนค่า · partial = ชื่อของ role ที่ลบแล้วใช้ซ้ำได้ · ให้ DB ตัดสิน unique ที่เดียว · Cc/Cf ปฏิเสธ ไม่ใช่ตัดทิ้ง: ตัดทิ้งเงียบ ๆ ทำให้ชื่อที่ผู้ใช้เห็นในฟอร์มต่างจากที่เก็บ และ "ไม่จับคำคล้าย" ของ ux ไม่ถูกละเมิด — นี่คือชื่อที่**แสดงผลเหมือนกันทุกประการ** |
| **ชนคำแปล system role (AC-3.5)** | `SYSTEM_ROLE_LABELS = { owner: "เจ้าของร้าน", admin: "ผู้ดูแล", staff: "พนักงาน" }` · `reservedRoleNames({ liveSystemRoles, selfKey })` = `เจ้าของร้าน` เสมอ ∪ คำแปลของ `admin`/`staff` ที่ยัง live และ `nameCustomized=false` · ยกเว้นคำแปลของ key ตัวเอง · **exact หลัง normalize** `lower(normalizeRoleName(x))` · **ผลของ SR-04:** เพราะ Cc/Cf ถูกปฏิเสธก่อนขั้นนี้ รูปที่มองไม่เห็นของ "เจ้าของร้าน" ไปไม่ถึงการเทียบคำสงวน ⇒ ชุดคำสงวนไม่ต้องขยาย และการเทียบ exact ยังพอ · ตรวจใน tx ใต้ org lock · **gate i18n 2 client** (web `i18n.ts` + mobile `app_th.arb` = `SYSTEM_ROLE_LABELS` + fixture ต่างต้องแดง + parse 0 ค่า = แดง) | ชื่อ "Owner"/"Admin"/"Staff" ที่เก็บจริงถูก unique คุมอยู่แล้ว — fn นี้คุมชื่อที่ client แสดง · **ความเสี่ยงคงเหลือที่รับ:** อักขระ "ว่าง" ที่ไม่ใช่ Cf (U+3164, U+2800) และสระ/วรรณยุกต์ไทยซ้อน — ux ตัดสินไม่จับคำคล้าย |
| **backfill (AC-1.3)** | §4.2 | — |
| **ลบ role ที่เหลือแค่ประวัติ (AC-3.9b)** | §2.2 | — |

### 2.2 กลไกลบ role: **soft-delete** (AC-3.8 · AC-3.9 · AC-3.9b)

| ทางเลือก | ผล | ตัดสิน |
|---|---|---|
| hard delete ตรง ๆ | FK composite เป็น `ON DELETE RESTRICT` ⇒ **ลบไม่ได้** ทันทีที่มีประวัติชี้อยู่ — ขัด AC-3.9b | ❌ |
| hard delete + FK nullable | เสียการันตี B-1 (MATCH SIMPLE) · ประวัติอ่านชื่อ role ไม่ได้ | ❌ |
| hard delete + snapshot `roleName` | denormalize 2 ตาราง + ทุกเส้นทางต้องเขียน snapshot + ชื่อสองความจริง | ❌ |
| **soft-delete (`deletedAt`)** | FK ไม่แตะ · ประวัติ join ได้ตามเดิม · ต้นทุน: ทุก live read ต้องกรอง | ✅ |

**เงื่อนไขการลบ (ใน tx ใต้ org lock):** role live · ไม่ใช่ `isSystem` / ไม่ถือ `full_access` (`ROLE_LOCKED`) · ⊆ actor (`ROLE_EXCEEDS_ACTOR`) · `count(Membership{roleId, active}) = 0` และ `count(Invitation{roleId, pending}) = 0` — **นับ pending ที่หมดอายุแล้วด้วย** (AC-3.9) · ไม่ผ่าน ⇒ `409 ROLE_IN_USE { activeMembers, pendingInvitations }` · **`count(Role{deletedAt ≠ null}) < MAX_DELETED_ROLES_PER_ORG` (500 — SR-12)** ไม่ผ่าน ⇒ `409 ROLE_HISTORY_LIMIT_REACHED { limit }` · ผ่าน ⇒ `UPDATE SET deletedAt=now, deletedByUserId=actor, version=version+1` (ไม่แตะ `name`)
- **ทำไมเพดานอยู่ที่ DELETE ไม่ใช่ POST:** การงอกแถวไม่รู้จบต้องวน สร้าง→ลบ · กันที่ลบ = role ตัวสุดท้ายยัง live (ไม่มีอะไรเสีย, ร้านยังสร้างได้ถึง 30) · กันที่สร้าง = ร้านที่เคยลบเยอะสร้าง role ใหม่ไม่ได้เลย · 500 ≫ การใช้งานจริง (ร้าน 3–10 คน) · ร่วมกับ rate limit `roleWrite` 60/ชม. (architecture §10)

**Live reads (ต้องกรอง `deletedAt: null` — ผ่าน helper `LIVE_ROLE_WHERE` ตัวเดียว):** `GET /roles` · `GET /role-details` · `GET /roles/{id}` · PATCH/DELETE role · `MembersService.updateRole` (role ใหม่) · `InvitationsService.create` · reissue · accept (`roleExistsInOrg` → `INVITATION_ROLE_UNAVAILABLE`) · นับเพดาน 30 · `reservedRoleNames`
**History reads (ห้ามกรอง):** `GET /members` (revoked) · `GET /invitations` (accepted/cancelled) · `OrgContextMiddleware` (ถ้าเจอ = fail-closed + error log) · **นับเพดาน soft-delete** (กรอง `deletedAt IS NOT NULL` — `// role-read: history — deleted-row cap`)
**gate `LIVE_ROLE_WHERE` (Q-QA-3):**
- **regex ครอบ:** `\.role\.(findFirst|findFirstOrThrow|findUnique|findUniqueOrThrow|findMany|count|aggregate|groupBy)\(` · raw SQL ที่มี `FROM\s+"Role"` หรือ `JOIN\s+"Role"` · relation include/select ของ `role:` จากตารางอื่น **ไม่นับ** (history read โดยนิยาม)
- **ราย call site:** (ก) มี `LIVE_ROLE_WHERE` ใน argument ของ call หรือ (ข) คอมเมนต์ `// role-read: history — <เหตุผล>` บรรทัดก่อนหน้า · ไม่มีทั้งคู่ = แดง
- **self-check สองทาง + non-vacuity** · fixture ครอบ `findUniqueOrThrow` + `groupBy` + raw `FROM "Role"`
- **int test คู่:** ลบ role → live read ทุกตัวไม่เห็น · history read ยังเห็นชื่อสุดท้าย

**ผลต่อ wire:** ไม่มี `roleDeleted` (ux Q-UX-3)

## 3. ข้อบังคับระดับ DB (defense-in-depth — raw SQL ใน migration)

```sql
-- 3.1 CHECK
ALTER TABLE "Role" ADD CONSTRAINT "Role_capabilities_nonempty" CHECK (cardinality(capabilities) >= 1);          -- AC-3.6
ALTER TABLE "Role" ADD CONSTRAINT "Role_full_access_system_only"
  CHECK (NOT ('full_access' = ANY(capabilities)) OR "isSystem");                                                -- AC-4.2
ALTER TABLE "Role" ADD CONSTRAINT "Role_system_not_deleted" CHECK (NOT ("isSystem" AND "deletedAt" IS NOT NULL)); -- AC-4.1
ALTER TABLE "Role" ADD CONSTRAINT "Role_name_shape"
  CHECK (name = btrim(name) AND name !~ '\s{2}' AND char_length(name) BETWEEN 1 AND 50
         AND name !~ '[\u0001-\u001F\u007F-\u009F­؀-؅؜۝܏࢐-࢑࣢᠎​-‏‪-‮⁠-⁤⁦-⁯﻿￹-￻\U000110BD\U000110CD\U00013430-\U0001343F\U0001BCA0-\U0001BCA3\U0001D173-\U0001D17A\U000E0001\U000E0020-\U000E007F]');
  -- AC-3.4 + SR-04 · character class = Cc ∪ Cf — ค่าที่ commit จริงสร้าง/ตรวจด้วย gate Unicode parity (§2.1) ไม่ใช่พิมพ์มือ
  -- ครอบ tab/newline เดิม (Cc) · Postgres ARE รองรับ \uXXXX/\UXXXXXXXX · DB encoding UTF-8

-- 3.2 unique
CREATE UNIQUE INDEX "Role_org_name_ci_live_key" ON "Role" ("organizationId", lower(name)) WHERE "deletedAt" IS NULL;
DROP INDEX "Role_organizationId_name_key";
CREATE UNIQUE INDEX "Role_one_system_per_org" ON "Role" ("organizationId") WHERE "isSystem";                     -- SR-07

-- 3.3 trigger
-- role_system_row_lock: BEFORE UPDATE ON "Role" WHEN OLD."isSystem"
--   → RAISE ถ้า name / capabilities / "isSystem" / "deletedAt" เปลี่ยน   (AC-4.1 ที่ DB)
--   ⚠ จงใจไม่ล็อก `key` — I-45 ต้องสลับ key ได้ · key ไม่ใช่ข้อมูลสิทธิ์
-- role_system_flag_guard (SR-07): BEFORE UPDATE OF "isSystem" ON "Role" WHEN (NOT OLD."isSystem" AND NEW."isSystem")
--   → RAISE เสมอ (custom role กลายเป็น system ไม่ได้ ⇒ ปิดทาง `SET "isSystem"=true, capabilities='{full_access}'`
--     ที่ CHECK full_access⇒isSystem ปล่อยผ่าน) · INSERT system role ที่สองของร้าน → unique §3.2 ปฏิเสธ
-- role_soft_delete_guard: BEFORE UPDATE OF "deletedAt" ON "Role" WHEN NEW."deletedAt" IS NOT NULL AND OLD."deletedAt" IS NULL
--   → RAISE ถ้ามี Membership(roleId, status='active') หรือ Invitation(roleId, status='pending')
-- role_live_reference_guard: BEFORE INSERT OR UPDATE OF "roleId", status ON "Membership" (NEW.status='active')
--                           และ ON "Invitation" (NEW.status='pending')
--   → SELECT "deletedAt" FROM "Role" WHERE ("organizationId", id) = (NEW."organizationId", NEW."roleId") FOR SHARE
--     RAISE ถ้า "deletedAt" IS NOT NULL                                                          ← SR-06
```
- **write-skew (SR-06):** FK check ใช้ `FOR KEY SHARE` ซึ่ง**ไม่ชน**กับ `UPDATE deletedAt` (NO KEY UPDATE) ⇒ ถ้า trigger อ่าน Role แบบไม่ล็อก tx สร้าง membership กับ tx ลบ role ที่ commit พร้อมกันจะผ่านทั้งคู่ · `FOR SHARE` **ชน**กับ NO KEY UPDATE ⇒ (ก) ลบก่อน: insert รอ แล้วอ่านแถวล่าสุดที่ commit (READ COMMITTED + FOR SHARE อ่าน version ล่าสุด) → เห็น `deletedAt` → RAISE (ข) insert ก่อน: UPDATE ของการลบรอจน insert commit แล้ว `role_soft_delete_guard` อ่าน Membership ด้วย snapshot ใหม่ → เห็นแถว active → RAISE · **เงื่อนไขของ (ข): trigger function ต้องเป็น `VOLATILE` (ค่า default — ห้ามประกาศ `STABLE`/`IMMUTABLE`)** เพราะ function STABLE ใช้ snapshot ของ statement ผู้เรียกซึ่งถ่ายก่อนรอล็อก · test: grep `provolatile = 'v'` ของ 2 function ใน int + int concurrency 1 เคสต่อทิศ (barrier)
- **ไม่มี deadlock ใหม่:** Membership/Invitation(แถวใหม่) → Role (SHARE) · role delete ถือ Role แล้วอ่าน Membership แบบไม่ล็อก — ไม่มีขอบย้อน (architecture §3)
- ชื่อ index/constraint ให้ Prisma introspect ตรง (`prisma migrate diff` ว่างหลัง migration)
- **ทำไม trigger ไม่ใช่แค่ service check:** service check ใต้ org lock คือตัวหลัก (error code สวย) · trigger คือ "ลืมแล้วพัง" สำหรับเส้นทางอนาคต — pattern เดียวกับ ledger trigger · error จาก trigger → 500 `INTERNAL` + error log
- Prisma schema: CHECK/trigger/expression index ประกาศไม่ได้ใน DSL → คอมเมนต์ใน `schema.prisma` ชี้ migration

## 4. Migration plan (skill `prisma-migration` — ตารางมีข้อมูลจริงแล้ว)

### 4.1 `f003_role_expand` (schema — additive ต่อโค้ด F-002)
1. **pre-flight (DO block, RAISE ถ้าผิด):** ไม่มีชื่อซ้ำแบบ `lower(btrim(name))` ในร้าน · ไม่มี role ไม่ใช่ system ที่ถือ `full_access` · ไม่มี caps ว่าง · ทุกชื่อผ่านรูป §3.1 (ยาว 1–50, ไม่มีช่องว่างหัวท้าย/ซ้อน, **ไม่มี Cc/Cf**) · **ทุกร้านมีแถว `isSystem` ≤ 1** (SR-07) — ข้อมูลวันนี้ = Owner/Admin/Staff × N ⇒ คาดผ่าน; ไม่ผ่าน = ข้อมูลถูกแก้นอกระบบ ต้องให้คนดู
2. `ADD COLUMN` 6 ตัวบน `Role` + `ADD COLUMN "issuedByUserId" TEXT` บน `Invitation` (nullable — insert ของโค้ด F-002 ยังผ่าน)
3. §3.1 CHECK · §3.2 index ใหม่ **ก่อน** drop index เดิม · §3.3 trigger
4. ไม่ต้อง `CONCURRENTLY` — Role ≤ 30 แถว/ร้าน (+ ≤ 500 ที่ลบ) · `Invitation` ADD COLUMN nullable ไม่มี default = metadata-only
5. **re-apply ได้:** `ADD COLUMN IF NOT EXISTS` · `CREATE UNIQUE INDEX IF NOT EXISTS` · `DROP INDEX IF EXISTS` · CHECK ผ่าน `DO` block เช็ค `pg_constraint` · `CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS` ⇒ apply ครึ่งทางแล้ว apply ใหม่ = apply ครั้งเดียว (int: apply สองรอบ + `migrate diff` ว่าง)

**ทำไม expand+contract (drop unique เดิม) อยู่ migration เดียวได้:** ไม่มีโค้ด F-002 พึ่ง `Role_organizationId_name_key` และ index ใหม่เข้มกว่าสำหรับแถว live

### 4.2 `f003_backfill_manage_roles` (data — AC-1.3 · AC-4.3 · AC-9.3)

**SQL แหล่งเดียว:** ไฟล์ `packages/db/prisma/migrations/<ts>_f003_backfill_manage_roles/migration.sql` · script `backfill:f003` (`packages/db/src/backfill-f003.ts`) **อ่านไฟล์นั้นแล้ว execute ใน 1 tx** · gate: glob ได้ 1 ไฟล์พอดี + ใน `src/` ไม่มี literal `'manage_roles'` คู่กับ `UPDATE "Role"`

```sql
UPDATE "Role" SET capabilities = (SELECT array_agg(c ORDER BY c) FROM unnest(array_append(capabilities, 'manage_roles')) c),
                  version = version + 1, "updatedAt" = now()
 WHERE key = 'admin' AND "deletedAt" IS NULL
   AND NOT ('manage_roles' = ANY(capabilities))
   AND (SELECT array_agg(c ORDER BY c) FROM unnest(capabilities) c)
       = ARRAY['manage_channels','manage_members','manage_org_settings','manage_orders',
               'manage_products','manage_stock','view_financials'];
-- + RAISE NOTICE ต่อแถว: 'f003_backfill actor=system org=<id> role=<id> added=manage_roles'
-- + RAISE WARNING นับแถว key='admin' ที่ไม่ตรงชุด (fail closed)
-- + ท้าย migration: RAISE EXCEPTION 'f003_owner_invariant_violation org=%' ถ้าร้านใด Owner active = 0
-- + CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS + CREATE TRIGGER role_f003_admin_bridge
```

- **idempotent:** รันซ้ำ = 0 แถว **และ `version` ไม่ bump** · ไม่แตะ Owner/Staff · ผลเรียงเป็น canonical เท่ากับแถวที่ provisioning F-003 เขียน
- **ทำไมใช้ `key` ได้ที่นี่:** backfill ไม่ใช่การตัดสินสิทธิ์ใน request แต่เป็นการระบุแถวที่ provisioning F-002 สร้างจาก blueprint `admin` · และ**ต้องตรงชุด capability เป๊ะ** ⇒ key ที่ถูกสลับ (I-45) ไม่ได้ `manage_roles`
- **AC-1.3 test (int — qa):** seed ร้านแบบ F-002 → migrate → caps 3 role = preset เป๊ะ · `backfill:f003` สองรอบ → รอบสอง 0 แถว + version เท่าเดิม · key=admin แต่ caps ไม่ตรง → ไม่ได้ + warning
- **bridge trigger `role_f003_admin_bridge`:** `BEFORE INSERT ON "Role"` — `NEW.key='admin'` และ caps เรียงแล้ว = ชุด F-002 เป๊ะ → append `manage_roles` (canonical) · ครอบร้านที่โค้ด F-002 สร้างระหว่าง rollout · F-003 insert Admin ที่มี `manage_roles` แล้ว ⇒ no-op · custom `key=null` ⇒ no-op · ไม่แตะ UPDATE · unit/int 3 กรณี
  - **เป็นกฎ runtime ที่อ่าน `key` (SR-10) ⇒ มีเจ้าของและวันถอด:** owner = **backend-api** · ถอดด้วย migration `f003_drop_admin_bridge` (`DROP TRIGGER IF EXISTS … ; DROP FUNCTION IF EXISTS …`) ใน **release ถัดไปหลัง devops ยืนยันไม่มี instance F-002 เหลือ** (checkpoint เดียวกับเปิด `ROLE_WRITES_ENABLED` — architecture §12) · **บังคับด้วย G-12 ที่ขยายไปครอบ migrations** (architecture §14): bridge อยู่ใน allowlist ที่มี `removeBy` — เลยวันแล้ว function ยังถูกสร้างใน migration ใดที่ไม่มี drop ตามหลัง = CI แดง · ไม่ใช่ "feature ถัดไปที่แตะ Role" ลอย ๆ อีกต่อไป
  - ความเสี่ยงระหว่างที่ยังอยู่: ฟีเจอร์ในอนาคตที่ insert Admin แบบชุด F-002 จะได้ `manage_roles` เงียบ ๆ — G-12 ขยายจับฟีเจอร์นั้นไม่ได้ แต่ `removeBy` จำกัดอายุช่องนี้ และไม่มีโค้ดรุ่น F-003+ ที่ insert ชุด F-002
- **migration-fail harness (Q-QA-1):** `packages/db/test/migration-harness.int.test.ts` — migrations ≤ `20260807000000_f002_role_org_composite_fk` → seed ร้าน Owner active = 0 → เพิ่ม F-003 → deploy **exit ≠ 0** + stderr มี `f003_owner_invariant_violation org=<id>` · control ผ่าน · ใช้ harness เดียวกันพิสูจน์ pre-flight §4.1 (ชื่อซ้ำ · ชื่อมี U+200B · 2 แถว `isSystem` → ล้ม)

### 4.3 Rollback (แก้ตาม SR-03 — ส่วนโค้ดอ้าง architecture §12)

| ถอยอะไร | ทำได้? | หมายเหตุ |
|---|---|---|
| โค้ด F-003 → F-002 ขณะ `ROLE_WRITES_ENABLED` **ไม่เคยเปิด** และ query ตรวจ = 0 (`key IS NULL OR lastEditedAt IS NOT NULL OR deletedAt IS NOT NULL`) | ✅ | กลับสู่ baseline F-002 · column ใหม่ถูกเมิน · `manage_roles` ใน Admin ไม่มีผล · `issuedByUserId` ถูกเมิน |
| โค้ด F-003 → F-002 **หลัง**มี role ใดถูกสร้าง/แก้/ลบ | ⛔ **ไม่ปลอดภัย** | F-002 ไม่มี ⊆ ⇒ Admin มอบ custom role ที่เกินตัวเองให้ตัวเองได้ (NEW-10 กลับมา) · ไม่กรอง `deletedAt` · **forward-fix เท่านั้น** (ต่างจากร่างรอบ 2 ที่ระบุแค่ "หลังการลบ") |
| หยุดการสร้าง/แก้ role ด่วน | ✅ | ปิด flag — โค้ดยังเป็น F-003 |
| bridge trigger (down) | ✅ | `DROP TRIGGER IF EXISTS` |
| migration schema (down) | ✅ มีเงื่อนไข | drop trigger/CHECK/index ใหม่ → สร้าง `@@unique([organizationId, name])` คืน **ล้มถ้ามีชื่อซ้ำจาก role ที่ลบ** ⇒ down ต้อง rename แถวที่ลบก่อน · drop column (ข้อมูล lastEdited/deleted/issuedBy หาย — ยอมรับ) · ทำได้เฉพาะหลัง rollback โค้ดที่ปลอดภัยตามแถวแรก |
| backfill (down) | ไม่ทำ | ลดสิทธิ์คนจริงเงียบ ๆ — Owner แก้ผ่าน UI |

### 4.4 rolling vs stop-start (devops ยังไม่ตัดสิน — แก้คำอ้างตาม SR-03)

- **สิ่งที่จริง:** migration ถูก**ออกแบบให้ schema เข้ากับโค้ด F-002** ทั้งสองแบบ (additive, re-apply ได้, bridge trigger) — **ไม่ใช่** "ปลอดภัยทั้งสองแบบ" ในความหมายของกฎความปลอดภัย
  - **stop→migrate→start:** ไม่มีช่วงโค้ดสองรุ่น ⇒ กฎใหม่มีผลทันทีที่ start · migration ล้มกลางทาง = re-apply ได้ · flag ยังต้องเปิดแยก (เงื่อนไข AC-10.1)
  - **rolling:** ช่วงที่ instance F-002 ยังรับ request = กฎ F-002 (ไม่มี ⊆ / แกน target / reset ⊊ / accept re-check / กรอง `deletedAt`) · **ช่องที่ SR-03 ชี้ (Admin ยกตัวเองเข้า custom role ผ่าน instance เก่า) ถูกปิดด้วย flag ปิดการสร้าง role** — ไม่มี custom role ให้ใช้ ⇒ instance เก่าให้ผลเท่ากับ F-002 วันนี้ · Admin→Admin reset/เปลี่ยน role ผ่าน instance เก่า = baseline ที่ ship อยู่ (หายเมื่อ instance เก่าหมด) · ร้านใหม่จาก F-002 ได้ `manage_roles` ผ่าน bridge · `backfill:f003` หลัง rollout = ตัวตรวจ (คาด 0 แถว)
- **trigger ให้ devops ตัดสิน:** ตอนตั้ง deploy pipeline production ครั้งแรก · ไม่ว่าเลือกแบบไหน: เปิด `ROLE_WRITES_ENABLED` ตามเงื่อนไข architecture §12 เท่านั้น

## 5. Entity อื่น

- **`Invitation`:** + `issuedByUserId String?` (no FK — pattern เดียวกับ `invitedByUserId`) · **เขียน:** create (= actor) · reissue (= actor, พร้อม `tokenHash/tokenIssuedAt/expiresAt` ใน UPDATE เดียว) · **อ่าน:** accept re-check `COALESCE(issuedByUserId, invitedByUserId)` (architecture §6.1) · **ไม่อยู่บน wire** (`invitedByUserId` ที่ ship คงความหมาย "ใครเชิญ") · ไม่ backfill: null = fallback ไป `invitedByUserId` · **known risk (N-2 — ปิดแล้วตาม security delta review):** ระหว่าง rolling instance F-002 ที่ reissue ไม่อัปเดต column ⇒ re-check ใช้ผู้ออก**ก่อนหน้า** (ไม่ใช่ fail-closed) แต่ไม่เปิดช่องจริง: reissue ของ F-002 แตะแค่ `tokenHash/tokenIssuedAt/expiresAt` — **อีเมลและ role ของคำเชิญเปลี่ยนไม่ได้** (ยังเป็นค่าที่ผู้ออกก่อนหน้าอนุมัติ) และ**ช่องเล็กกว่าช่อง rolling เดิม** (accept บน instance F-002 ไม่ re-check เลย) · ไม่เพิ่ม column `issuedForTokenIssuedAt` · เหตุผลเต็มที่ architecture §6.1 · **Membership (D-034 Addendum + Addendum 2):** ไม่เปลี่ยน schema — role update/delete นับ `status='active' ∧ roleId ∧ userId ≠ actor` ใน tx ใต้ org lock → ผล > 0 ⇒ ผู้แก้ต้องถือ `manage_members` + before ⊊ (architecture §1.3) · พฤติกรรมอื่น: `expiresAt` ถูก**ย่น**ใน tx ของ role update เมื่อ role กลายเป็น elevated · accept re-check ไม่ผ่าน ⇒ `status='cancelled'`, `cancelledAt=now` ใน tx ของ accept
- **`Membership`:** ไม่เปลี่ยน schema
- **`User`:** ไม่เปลี่ยน · ชื่อที่แสดงจริง = feature profile ในอนาคต → เพิ่ม `lastEdited.by.displayName` แบบ additive ตอนนั้น (forward-commitment F-003 §7 — trigger: Gate 1 ของ feature นั้น)
- **`SYSTEM_ROLE_BLUEPRINT`:** Admin + `manage_roles` · literal เปลี่ยนเป็นค่าคงที่จาก registry · provisioning เขียน default
- **ไม่มีตาราง audit** — event เป็น log (AC-9.7); ร่องรอยถาวร = `lastEditedAt/By` + `deletedAt/By`

## 6. Sync-back → `docs/01-data-model.md` (diff ที่เสนอ — **ห้ามแก้เอง**, protected path; PM/owner apply ตอน G2✓)

```diff
 Role           id, organizationId, name, key?, isSystem (Owner=ล็อก), capabilities[]  // editable ราย org
+               version, nameCustomized, lastEditedAt?, lastEditedByUserId?, deletedAt?, deletedByUserId?   // ← F-003
                // key = owner|admin|staff สำหรับ system role · custom role (F-003) = null
-               // @@unique([organizationId, key]) · ⚠ ห้ามใช้ key ตัดสินสิทธิ์ — สิทธิ์ = capabilities
-               // capability registry (open-ended): full_access, manage_members, manage_org_settings,
-               // manage_billing, manage_products, manage_stock, manage_channels, manage_orders,
-               // view_financials, access_accounting(Full tier) ...
+               // @@unique([organizationId, key]) · ชื่อ unique แบบไม่สนตัวพิมพ์ เฉพาะ role ที่ยังไม่ลบ · ชื่อห้ามมีอักขระควบคุม/มองไม่เห็น (Cc/Cf)
+               // ⚠ ห้ามใช้ key ตัดสินสิทธิ์ — สิทธิ์ = capabilities (หลังขยาย: full_access=ทุก key · manage_X⇒view_X)
+               // ลบ = soft-delete (deletedAt) — ประวัติ (สมาชิก revoked / คำเชิญ accepted) ยังอ้างถึงได้ (F-003)
+               // full_access มีได้เฉพาะ role Owner (isSystem, ล็อก, 1 แถวต่อร้าน) — D-032
+               // แตะคน (เปลี่ยน role/ถอด/reset) ต้อง role เป้าหมาย ⊊ ผู้ทำ · มอบ role ต้อง ⊆ ผู้ทำ — D-034
+               // capability registry = core-domain rbac/registry.ts (ไม่ใช่ตาราง): key · group · tier(all|full)
+               //   · status(live|upcoming) · implies — full_access, manage_members, manage_roles, manage_org_settings,
+               //   manage_billing, manage_products, manage_stock, manage_channels, manage_orders,
+               //   view_financials, access_accounting(Full tier) ... · ต้นทุน/กำไรทุกจอ gate view_financials (D-033)
 Invitation     …
+               issuedByUserId?   // ผู้ออกลิงก์ปัจจุบัน (create/reissue) — accept ตรวจสิทธิ์ของคนนี้ซ้ำ (D-035)
```
- ส่วน "สร้าง org = … system Roles(Owner/Admin/Staff)" คงเดิม
- **Organization / Membership / User:** ไม่กระทบส่วนกลาง
