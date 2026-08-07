---
doc: architecture
owner: "@backend-api"
signoff: approved   # user 2026-07-28
---
# [F-002] Architecture / Technical design

> เจ้าภาพ: `backend-api` · อ้าง [backend.md](../../architecture/backend.md) เป็น architecture authority (D-025) —
> ทุก pattern ในเอกสารนี้คือการ **เติมของจริงลงตะเข็บที่ backend.md §3.3 ออกแบบไว้** ไม่ใช่ pattern ใหม่

> **รอบแก้ 2026-07-27 (amend #2):** ปรับตาม **D-027** (rotate ลิงก์ = อายุนับใหม่) + **D-028**
> (security review: Owner-only · admin-reset fail-closed · invitation hardening · PDPA field-level)
> และปิด finding C-3/C-4/I-2…I-10/M-1…M-11/N-1…N-4 ของ [security-review.md](security-review.md)

> **รอบแก้ 2026-07-28 (amend #3 — รอบสุดท้ายก่อน sign-off):** รับ **D-029** (ออกจากร้านเอง · cap 50 ยืนยัน ·
> UI ใช้คำว่า "ร้าน") + คำตอบ/คำแย้งของ [test-plan.md §18–§19](test-plan.md) ทั้ง 12 ข้อ + คำตอบของ
> [ux-wireframe.md](ux-wireframe.md) · **การแก้ที่เป็น *design* ไม่ใช่แค่เอกสาร: §5 ขยายกฎ row lock ให้ครอบ
> accept/cancel/reissue** (เคส `revoke ‖ accept` ของ qa พิสูจน์ว่าร่างเดิมมีช่องจริง) · เพิ่ม **§15 ผลต่อโค้ดที่ ship แล้ว**

> **รอบแก้ 2026-07-28 (amend #4 — ปิดเงื่อนไข delta review §H ของ [security-review.md](security-review.md)):**
> รับ **D-030** · **NEW-1** admin-reset ปฏิเสธเมื่อ target เป็น Owner และผู้เรียกไม่มี `full_access` (§3.3 — เงื่อนไข**ที่สอง**
> ต่อจาก C-2, ★-task เดียวกัน) · **NEW-2** reissue ต้องผ่าน `canAssignRole` (§3.2/§7.4) · **NEW-3** fail-closed ครอบ
> **org-scoped read** ด้วย ไม่ใช่แค่ mutating (§1.3/§1.4/§3.1) · **NEW-4** นโยบาย tx/lock timeout (§5.2) ·
> **NEW-5(ก)** admin-reset ทำในtx เดียว (§3.3) · **NEW-8** ห้าม traverse ผ่าน model org-agnostic กลับเข้า org-scoped (§2.2) ·
> **NEW-9** ธง `acceptedUserCreatedAfterInvite` คำนวณจาก `Invitation.createdAt` (§7.6) · **NEW-10/NEW-11** → §13/§14
> · **wire ไม่เปลี่ยน** — [api-spec.md](api-spec.md) ยัง **LOCKED** (การแก้ทั้งหมดเป็นการ *แคบลง* ของ authz + ถ้อยคำ
> ที่ชัดขึ้น ไม่มี code/status/schema ใหม่) · สิ่งที่ "สัญญาไม่เปลี่ยนแต่ความหมายเปลี่ยน" ถูกขึ้นทะเบียนที่ **ท้าย §15**

## Contract summary (≤20 บรรทัด — ทีม consumer อ่านแค่ส่วนนี้)

1. **F-002 = จุดกำเนิด org context ของทั้งระบบ** — หลังจากนี้ทุก feature ได้ org scoping ฟรีผ่าน `ORG_PRISMA` (เฉพาะ query ที่ **ตั้งต้นจาก model org-scoped** — §2.2 ข้อ C-3)
2. org เดินทางผ่าน **`X-Organization-Id` header** (D-025) · route ที่ org เป็น resource เองใช้ `/orgs/{orgId}/**` · มีทั้งคู่ต้องตรงกัน ไม่ตรง = **`422 ORG_MISMATCH`** (client bug ไม่ใช่ผลการ authorize — N-1)
3. route แบ่ง 3 ชั้น: **org-scoped** (default, ต้องมี membership `active`) · **user-scoped** (`@UserScoped()`) · **public** (`@Public()`) — route ที่ไม่ใช่ org-scoped **ไม่มี org context เลย** (I-3)
4. ไม่ใช่สมาชิก/ถูก revoke → **`403 ORG_ACCESS_DENIED`** · มี membership แต่ขาดสิทธิ์ → **`403 FORBIDDEN`** (แยก code เพื่อให้ client ตัดสินใจถูก — I-5) · **ไม่มี cache** (AC US-5)
5. **`ORG_PRISMA`** = client เดียวที่ feature module ฉีดได้ · **`SYSTEM_PRISMA`** = allowlist ระดับไฟล์ (`auth/`, `orgs/system/`, `tenancy/`, `health/`, `prisma/` — M-1) · บน `User` ใช้ `select` เสมอ ห้าม `include` (C-4)
6. **capability = `@RequireCapability()` metadata ตั้งแต่ F-002** + guard อ่าน ALS · **org-scoped route ทุกเส้น (รวม read) ที่ไม่ประกาศ `@RequireCapability`/`@AnyActiveMember` = ปฏิเสธ + CI แดง** (ลืม = พัง — I-2 · ขยายให้ครอบ read ใน amend #4 ตาม NEW-3) · registry/CRUD ยังเป็น F-003
7. **Owner-only (D-028/C-1 + D-030/NEW-1):** เฉพาะผู้มี `full_access` เท่านั้นที่ (ก) มอบ/เชิญด้วย role `Owner` (ข) แก้/ถอด membership ที่ปัจจุบันเป็น Owner (ค) **ออกลิงก์ใหม่ของคำเชิญที่เป็น role Owner** (ง) **รีเซ็ตรหัสของสมาชิกที่เป็น Owner** — บังคับด้วย pure fn `canAssignRole()` (§3.2/§3.3)
8. **Owner ≥ 1 + ทุก mutation ที่แตะ membership/invitation** ต้องเปิด tx ด้วย `SELECT … FOR UPDATE` บนแถว `Organization` **และตรวจเงื่อนไขซ้ำใน tx** (§5) · `countActiveOwners` อ่านผ่าน `tx` เท่านั้น (M-2) · **tx กลุ่มนี้มี `lock_timeout`/`timeout` ที่กำหนดชัด และ timeout/deadlock → `409 CONFLICT` ไม่ใช่ 500** (§5.2 — NEW-4)
9. **สร้าง org = 1 transaction** (Organization + system Roles + Membership(Owner) + OrgEntitlement + default Warehouse) · plan มาจาก **server เท่านั้น**, ไม่มี plan = ไม่สร้าง (fail closed)
10. **cap 50 org ที่ *สร้าง* ต่อ user แบบ fail-closed ที่ service** → `409 ORG_LIMIT_REACHED` (ไม่พึ่ง rate limit ที่ fail-open — I-10 · ขอบเขตแก้ตาม A-6: นับ `createdByUserId` ไม่ใช่ membership · accept ไม่ถูก cap)
11. **invite = copy link (D-012) + hash-at-rest (D-018)** ⇒ ปุ่ม **"ออกลิงก์ใหม่" (rotate token)** และ **อายุนับใหม่จากเวลาที่ออกลิงก์** (D-027 — เดิมร่างว่าคงอายุเดิม)
12. **TTL คำเชิญขึ้นกับ role:** role ที่มี `full_access`/`manage_members` = **24 ชม.** · ที่เหลือ 7 วัน (D-028/I-7)
13. **invitation hardening:** ถอดสมาชิก → ยกเลิก pending invite ของ email นั้น **ใน tx เดียวกัน** · accept ที่คำเชิญออก**ก่อน**ถูกถอด → ปฏิเสธ · accept ที่เจอ membership `active` → `409 ALREADY_MEMBER` (ไม่ทับ role — I-9)
14. **token ห้ามเดินทางใน query string:** preview เป็น **`POST /invitations/preview`** (body) · response ที่มี token/email/TIN ต้อง `Cache-Control: no-store` · ห้าม log query ของ `/invitations/*` (I-6)
15. **PDPA (D-028 + ux Q13 ที่เข้มขึ้นใน amend #3):** `GET /orgs/{orgId}/members` ต้องมี `manage_members` · **TIN เต็มออกทาง endpoint เดียว `POST …/tax-profile/reveal`** (มี event + rate limit) · `taxIdMasked` เฉพาะ `manage_org_settings` · **คนอื่นไม่ได้ตัวเลขใด ๆ เลย** (I-8/N-4)
16. **กระทบโค้ดที่ ship แล้ว (C-2 + D-030/NEW-1):** `POST /orgs/{orgId}/members/{userId}/reset-password` ต้องปฏิเสธ **2 เงื่อนไข** — (ก) target เป็นสมาชิก active ของ org อื่นด้วย (ข) **target เป็น Owner (`full_access`) และผู้เรียกไม่มี `full_access`** → คืน 404 รูปเดิมทั้งคู่ (wire ไม่เปลี่ยน — §3.3)
17. F-002 **ไม่ทำ** `entitled()`/tier gating (F-007) — เก็บ tax profile + expose `taxProfileComplete` เป็น seam · และสร้าง **org rate-limit guard กลาง** ใน `common/` (Redis sliding window, IPv6 ยุบ /64 — N-3); 429 + **`Retry-After` ≥ 1 วินาทีเสมอ**
18. เทสต์บังคับใหม่ของทุก feature: **cross-org leak int test (5 persona)** + **route-registry capability test** + **assertion กลาง `passwordHash`/`tokenHash`/`taxId`/header/`traceId`** + concurrency 10 เคส — **เจ้าของ verdict คือ @qa: [test-plan.md](test-plan.md) เป็น authority ของ lane/เคส, §12 ที่นี่บอกแค่ "ผมต้องส่งอะไรให้เทสต์เดินได้"**
19. **D-029:** เพิ่ม **`DELETE /orgs/{orgId}/membership`** (ออกจากร้านเอง — ไม่ต้องมี `manage_members`, ยังติด Owner คนสุดท้าย) · `MAX_ORGS_PER_USER = 50` ยืนยันแล้ว · UI ใช้คำว่า "ร้าน" — **code/API/schema ยังเป็น `organization`**
20. contract ใหม่ทั้งหมดอยู่ใน [api-spec.md](api-spec.md) (**LOCKED**) · schema delta + migration อยู่ใน [data-model.md](data-model.md) · **สิ่งที่ต้องแก้ในโค้ดที่ ship แล้ว → §15**

---

## §0 ขอบเขตทางเทคนิค: อะไรเกิดใน F-002 / อะไรไม่ใช่ของ F-002

forward-commitments แถว **F-002 / F-003** (จาก architecture deep-design 2026-07-11) สั่งของไว้หลายชิ้น —
ตารางนี้ผูกแต่ละชิ้นกับเจ้าของจริง เพื่อไม่ให้ F-002 บวมและไม่ให้อะไรตกหล่น

| ชิ้นงาน (forward-commitment) | เกิดที่ | เหตุผล |
|---|---|---|
| `OrgContextMiddleware` (ALS) | **F-002** | ตัวที่แปลง header → membership → context; ไม่มีมัน = ไม่มี tenancy |
| `ORG_PRISMA` / `SYSTEM_PRISMA` providers | **F-002** | client เดียวที่ feature module ใช้ได้ + boundary gate |
| `withOrgScope` **enforcement จริง** (แทน pass-through stub) | **F-002** | กฎทอง 3 กลายเป็นของจริงที่ระดับ data-access |
| **cross-org leak int-test = เทสต์บังคับของทุก feature ใหม่** | **F-002** (วาง kit + เขียนของตัวเอง) | template อยู่ที่ `apps/api/test/org-leak.kit.ts` ให้ feature ถัดไปลอก |
| **`@RequireCapability()` decorator + `CapabilityGuard` (อ่าน ALS)** | **F-002** *(เปลี่ยนจากร่างแรก — I-2)* | ถ้าเป็น helper ที่ต้องเรียกเอง "ลืม = รั่วเงียบ" ซึ่งขัดหลัก default-deny ของ §1.1 เอง · F-002 จึงต้องมีชั้นที่ **ลืมแล้วพัง** ตั้งแต่วันแรก (§3.1) |
| capability **registry** (รายชื่อ capability ทั้งระบบ) + role CRUD + custom role | **F-003** | RBAC เป็นโดเมน F-003 — F-002 ประกาศเฉพาะ capability ที่ตัวเองบังคับใช้จริง 2 ตัว |
| `@RequireFeature` / `can()` / `entitled()` | **F-007** | tier gating เป็นโดเมน F-007 — F-002 แค่ผูก `OrgEntitlement` + เก็บ tax profile |
| `@Audited` interceptor + `AuditLog` | **F-005** | F-002 emit security event ผ่าน seam ที่ F-001 วางไว้ (§9) |
| org rate-limit guard กลาง (`common/`) | **F-002** | จำเป็นจริงใน F-002 (invite token brute-force, spam invite/org) — ไม่ใช่การเผื่อ |
| D-018 invitation token **hash-at-rest** | **F-002 (required)** | F-002 คือ feature แรกที่เขียน invitation จริง; ตารางยังว่าง = migrate ตอนนี้ถูกที่สุด (§7) |

**ไม่อยู่ใน F-002:** ลบ org, โอนขาดเจ้าของเต็มรูป, seat-limit enforcement, custom role, ส่ง email อัตโนมัติ
(ตาม scope table Gate 1 + forward-commitments "Productize / Hardening" + F-081)

---

## §1 Org context resolution — end-to-end

### 1.1 จัดชั้น route (default-deny)

`OrgScopeGuard` เป็น **global guard** (F-000 register ไว้แล้ว) และถูกเปลี่ยนเป็น **default-deny**:
ทุก route ถือเป็น org-scoped **เว้นแต่** ถูก mark ไว้ชัดเจน

| ชั้น | mark | ตัวอย่างใน F-002 | เงื่อนไขผ่าน |
|---|---|---|---|
| **org-scoped** (default) | — | `/orgs/{orgId}` · `/orgs/{orgId}/members` · `/orgs/{orgId}/invitations` · `/orgs/{orgId}/roles` | access token valid **และ** `Membership.status = active` ใน org นั้น |
| **user-scoped** | `@UserScoped()` | `POST /organizations` · `GET /me/organizations` · `POST /invitations/accept` | มี access token valid เท่านั้น — **ไม่มี org context** (I-3) |
| **public** | `@Public()` | `GET /health` · `/auth/*` · **`POST /invitations/preview`** | ไม่ต้องมี token (แต่มี rate limit) — **ไม่มี org context** (I-3) |
| **system-scoped** | `@SystemScoped()` | — (F-085 `/admin/**`) | SuperAdminGuard + `@Audited` (ยังไม่มีใน F-002) |

**ทำไม default-deny:** ถ้า agent เพิ่ม route ใหม่แล้วลืม mark → route นั้นเรียกร้อง org context ทันที →
ไม่มี header/ไม่มี membership = **403 พัง** ไม่ใช่ "หลุดออกไปโดยไม่กรอง org" = "ลืมแล้วพัง ไม่ใช่ลืมแล้วรั่ว"

> **I-3 · ห้ามสร้าง org context บน route ที่ไม่ใช่ org-scoped (แก้ตาม security review):**
> ร่างแรกให้ middleware resolve org **ทุก request** ⇒ บน `POST /invitations/accept` (user-scoped) ผู้เรียก
> **เลือกได้เอง**ว่า ALS ctx จะเป็น org ไหน (org ใดก็ได้ที่ตนเป็นสมาชิก) — ถ้าโค้ดเส้นใดในเส้นทางนั้นเผลอใช้
> `ORG_PRISMA` (นับสมาชิก / อ่าน `role.name` / `membership.upsert`) มันจะทำงานกับ **org ที่ผู้เรียกเลือก**
> ไม่ใช่ org ของคำเชิญ = เขียนข้อมูลผิด org แบบไม่มีใครรู้ (FK `roleId` เป็นคีย์เดี่ยว DB ไม่ปฏิเสธให้)
> **กติกาใหม่:** route ที่ mark `@UserScoped()`/`@Public()` → middleware **ไม่สร้าง context เลย** (และล้างของเดิมทิ้ง)
> ⇒ แตะ `ORG_PRISMA` ในเส้นทางนั้นเมื่อไหร่ = `MissingOrgContextError` → 500 (แถวสุดท้ายของ §1.4 = พฤติกรรมที่ต้องการ)
> · เส้นทางที่ **ต้องการ** context จริง (accept) ให้ service เรียก `OrgContextStore.run({ organizationId: inv.organizationId, … })`
> **เองหลังอ่าน invitation ด้วย `SYSTEM_PRISMA`** — รูปเดียวกับ worker ใน §2.1 (ไม่มี pattern ที่สอง)
> · unit test บังคับ: `@UserScoped()` + `X-Organization-Id` ของ org ที่ผู้เรียกเป็นสมาชิก → `OrgContextStore.get()` ต้องเป็น `undefined`

> **ผลต่อ route ที่ ship แล้ว (F-001):** `/auth/*` ทั้งหมด mark `@Public()` และ
> `POST /orgs/{orgId}/members/{userId}/reset-password` mark `@UserScoped()` — **พฤติกรรมบน wire เปลี่ยน 1 จุดเท่านั้น**
> (แก้ข้อความเดิม "ไม่เปลี่ยนแม้แต่ status เดียว" ตอน build T-002-13 — ของเดิมไม่จริง)
> · **จุดที่เปลี่ยน:** request ที่ **ทั้งไม่มี token และ Content-Type ไม่ใช่ JSON** บน `reset-password`
> เดิมได้ `415` จาก `JsonOnlyGuard` ตอนนี้ได้ `401` เพราะ global guard ตอบก่อน controller guard เสมอ
> · body ของ 401 เหมือนกันทุกไบต์ทั้งสองทาง (`ERROR_CODES.UNAUTHENTICATED` เป็นแหล่งเดียว) และไม่มีเทสต์/สัญญาที่ ship แล้ว pin 415 บน endpoint นี้
> (เทสต์ L-2 ครอบ `/auth/signup` ซึ่งเป็น `@Public()` และยังคง 415-first เหมือนเดิม) · pin ไว้ที่ `org-scope.guard.test.ts`
> โดยเฉพาะ reset-password ที่คง capability check inline + **404-never-403 เดิม** (backend.md §6: "KEEP จนถึง F-003")
> เหตุผลที่ไม่ยกไปใช้ 403 แบบ F-002: จะเปลี่ยน status ของ endpoint ที่ ship แล้ว = ผิด contract-evolution

### 1.2 ลำดับการ resolve org (source order)

```
1) header  X-Organization-Id      ← ทางหลัก (D-025; web/mobile ส่งอยู่แล้ว)
2) path param :orgId              ← เมื่อไม่มี header (รองรับ endpoint F-001 ที่ ship ไปแล้วโดยไม่ต้องแก้ client)
3) มีทั้งคู่แต่ไม่ตรงกัน           → 422 ORG_MISMATCH  (ambiguity = ปฏิเสธ ไม่เลือกข้างใดข้างหนึ่ง · N-1)
```

### 1.3 Chain จริง (เติมลงตะเข็บ F-000)

```
OrgContextMiddleware  (ใหม่ — NestJS middleware ตาม note ใน org-scope.guard.ts ว่า guard wrap ALS ไม่ได้)
   ├ อ่าน Authorization: Bearer → AccessTokenService.verify()   (HS256/typ pinned, ไม่แตะ DB)
   │      ไม่มี/ไม่ผ่าน → ไม่ throw (401 เป็นหน้าที่ guard) แต่ **บันทึกผลลง req.orgAuth** (I-4)
   ├ route นี้ mark @Public()/@UserScoped() → **ไม่ resolve org, ไม่สร้าง context** แล้วจบ (I-3)
   ├ resolve organizationId ตาม §1.2 → ไม่มี → orgOutcome='none'
   ├ membership lookup: findUnique(organizationId_userId)
   │      select { id, status, roleId, role: { capabilities } }     ← select เสมอ ห้าม include (C-4)
   │      ไม่พบ → 'no_membership' · status='revoked' → 'revoked' · 'invited' → 'not_active'
   └ ผ่านทุกด่าน → OrgContextStore.run({ organizationId, userId, membershipId, roleId, capabilities }, next)

req.orgAuth  (middleware แนบเอง — guard **ห้ามพึ่ง req.user** ซึ่งยังไม่มีตอน global guard ทำงาน)
   { userId?: string; tokenValid: boolean;
     orgOutcome: 'ok' | 'none' | 'mismatch' | 'no_membership' | 'revoked' | 'not_active' | 'skipped' }

OrgScopeGuard (global, default-deny — เติม body จริงแทน stub · ตัดสินจาก req.orgAuth ล้วน)
   ├ @Public()      → ผ่าน
   ├ @UserScoped()  → tokenValid=false → 401 UNAUTHENTICATED · true → ผ่าน
   └ org-scoped     → tokenValid=false → 401 UNAUTHENTICATED
                      orgOutcome='none'                        → 422 ORG_CONTEXT_REQUIRED
                      orgOutcome='mismatch'                    → 422 ORG_MISMATCH        (N-1)
                      orgOutcome ∈ {no_membership,revoked,not_active} → 403 ORG_ACCESS_DENIED (I-5)

CapabilityGuard (global, หลัง OrgScopeGuard — I-2 · ขยายตาม NEW-3 ใน amend #4)
   ├ อ่าน metadata @RequireCapability(cap) (Reflector) + capabilities จาก ALS ctx
   ├ ไม่มี capability ที่ประกาศ                          → 403 FORBIDDEN + event org.access.capability_denied
   ├ @AnyActiveMember()  → ผ่าน (การประกาศที่ถูกต้อง — ไม่ใช่ "ลืม")
   └ org-scoped **ทุก method รวม GET/HEAD** + **ไม่มี metadata เลย**
                                                        → 403 FORBIDDEN + log `capability_metadata_missing` (fail-closed)
```

> **NEW-3 · "ลืม = พัง" ต้องครอบ *read* ด้วย (แก้ตาม delta review — Important):** ร่าง amend #3 จำกัด fail-closed
> ไว้ที่ `method ∈ {POST,PATCH,PUT,DELETE}` ⇒ **org-scoped read ที่ลืมประกาศจะตกเป็น "สมาชิก active คนไหนก็ได้" เงียบ ๆ**
> — และเส้นที่แพงที่สุดของ F-002 คือ read: `GET /orgs/{id}/members` = email ของทุกคนในองค์กร ·
> รีแฟกเตอร์ controller แล้ว decorator หล่นหาย = ย้อนกลับไปสภาพก่อน D-028 โดยไม่มีสัญญาณใด ๆ และ I-02 (ที่ตรวจเฉพาะ
> mutating) **ไม่แดง** · **กติกาใหม่: ทุก org-scoped route ต้องประกาศอย่างใดอย่างหนึ่งของ
> `@RequireCapability` / `@AnyActiveMember` — ไม่ประกาศ = 403 ที่ runtime + แดงที่ CI**
> · `@AnyActiveMember` ยังถูก pin ด้วย allowlist (§3.1) ⇒ "ประกาศให้อ่อนที่สุด" ไม่ใช่ทางลัดที่เขียว

**ทำไม middleware verify token เอง แทนรอ `JwtAuthGuard`:** ลำดับของ NestJS คือ middleware → guard → interceptor →
handler ดังนั้นตอน middleware ทำงาน guard ยังไม่รัน แต่ middleware ต้องใช้ `userId` แล้ว · verify HS256 ซ้ำ =
CPU ระดับไมโครวินาที ไม่มี I/O · ผลคือ **ไม่ต้องแก้ `JwtAuthGuard` เลย** และ error semantics ของ auth ยังอยู่ที่เดิม

> **I-4 · guard ห้ามพึ่ง `req.user` (แก้ตาม security review):** ร่างแรกเขียนว่า `@UserScoped()` = "ต้องมี `req.user`
> (JwtAuthGuard ทำงานตามปกติ)" — **ผิดตามลำดับจริงของ NestJS**: global guard รันก่อน controller guard และ
> `JwtAuthGuard` วันนี้ผูกที่ระดับ controller (`apps/api/src/auth/members.controller.ts:33`) ⇒ ตอน `OrgScopeGuard`
> ทำงาน `req.user` ยัง `undefined` เสมอ · ถ้าไม่แก้ ผลคือ route `@UserScoped()` ตอบ 401 ตลอด (ดี = จับได้ตอน test)
> หรือแย่กว่านั้นคือมีคน "แก้" ด้วยการให้ `@UserScoped()` ผ่านไปเลย = ไม่มีการตรวจ auth ที่ guard กลางอีกต่อไป
> **กติกา:** middleware แนบ `req.orgAuth` เอง แล้ว guard ตัดสินจากค่านั้น 100% · unit test บังคับ:
> `@UserScoped()` + token ปลอม/หมดอายุ → **401** (ไม่ใช่ 200) · `@UserScoped()` + ไม่มี header auth → 401

### 1.4 Failure matrix (test-plan ต้อง cover ครบ)

| สถานการณ์ | ผล | code |
|---|---|---|
| org-scoped, ไม่มี token / token ไม่ผ่าน | 401 | `UNAUTHENTICATED` |
| org-scoped, token ok, ไม่มีทั้ง header และ path `orgId` | 422 | `ORG_CONTEXT_REQUIRED` |
| header ≠ path param | **422** | `ORG_MISMATCH` (N-1 — client bug ไม่ใช่ผลการ authorize) |
| **org ไม่มีจริง** / ไม่ได้เป็นสมาชิก | 403 | **`ORG_ACCESS_DENIED`** (AC US-2) — **ค่าเดียวกันทั้งสองเคส** |
| membership `invited` / `revoked` | 403 | **`ORG_ACCESS_DENIED`** (AC US-5 — มีผลตั้งแต่ request ถัดไป) |
| สมาชิก active แต่ไม่มี capability ที่ประกาศ | 403 | `FORBIDDEN` |
| org-scoped (**รวม read**) ที่ **ไม่ประกาศ** `@RequireCapability`/`@AnyActiveMember` | 403 | `FORBIDDEN` + log `capability_metadata_missing` (I-2 · NEW-3) |
| **tx ของกลุ่ม membership/invitation ชน `lock_timeout`/deadlock** | **409** | `CONFLICT` + `details.reason='busy'` (**ไม่ใช่ 500** — §5.2 · NEW-4) |
| feature module เรียก `ORG_PRISMA` ใน route ที่ไม่มี context | 500 | `INTERNAL` (bug ของเรา — fail loud, ไม่รั่ว) |

> **จงใจต่างจาก F-001:** F-001 ใช้ 404-never-403 กัน enumeration; F-002 ใช้ **403** เพราะ (ก) AC US-2 เขียนตรง ๆ ว่า 403
> (ข) `organizationId` เป็น cuid เดาไม่ได้ → 403 ไม่เปิดเผยสิ่งที่ผู้เรียกยังไม่รู้ (ค) client taxonomy (D-025) แยก
> `ForbiddenFailure` เพื่อพากลับหน้าเลือก org ได้ ซึ่ง 404 ทำไม่ได้

> **I-5 · แยก `ORG_ACCESS_DENIED` ออกจาก `FORBIDDEN` (แก้ตาม security review):** ร่างแรกใช้ `FORBIDDEN` ตัวเดียว
> ทั้ง "ไม่ใช่สมาชิก org นี้" และ "ไม่มี capability" ⇒ client แยกไม่ออก แล้วจะทำผิดทางแน่นอนอย่างใดอย่างหนึ่ง:
> Staff กดปุ่มที่ไม่ควรเห็น → ถูกเตะกลับหน้าเลือก org ทั้งที่ยังเป็นสมาชิกดี ๆ **หรือ** ถูกถอดจริงแต่ค้างอยู่หน้าเดิม
> ยิง 403 รัว ๆ · กติกา: `ORG_ACCESS_DENIED` → client พากลับหน้าเลือก org + refresh `/me/organizations` ·
> `FORBIDDEN` → toast "ไม่มีสิทธิ์" อยู่หน้าเดิม
> **⛔ ห้ามแยกต่อ:** "org ไม่มีจริง" กับ "org มีอยู่แต่ไม่ได้เป็นสมาชิก" **ต้องคืนค่าเดียวกันเป๊ะ** (guard ตัดสินจากผล
> membership lookup ที่ว่างเหมือนกันทั้งคู่ — ห้ามยิง `organization.findUnique` เพิ่มเพื่อแยกสองเคสนี้ ไม่ว่าจะเพื่อ
> "ข้อความที่ดีขึ้น" ก็ตาม) มิฉะนั้นเปิด existence oracle ข้าม tenant ทันที · int test บังคับ: org id ที่ไม่มีจริง
> กับ org ของคนอื่น ต้องได้ **body + status ตรงกันทุก byte**

### 1.5 Cache — **ไม่ cache ใน F-002** (ตัดสินแล้ว)

- backend.md §3.3 อนุญาต cache (org,user) TTL 60 s แต่ **AC US-5 บังคับ "เข้าไม่ได้ทันที"** → cache 60 s = ผิด AC ตรง ๆ
- ต้นทุนที่แลก: **1 indexed query ต่อ request** บน `Membership @@unique([organizationId, userId])` (~0.2–0.5 ms)
  — ยอมรับได้เต็ม ๆ ที่ scale Phase 0–1 (§10)
- **seam สำหรับตอนที่จะ cache จริง (F-003/F-007 เมื่อ capabilities + entitlements ทำให้ resolve แพงขึ้น):**
  - key `orgctx:{organizationId}:{userId}` TTL ≤ 60 s
  - **invalidate เป็นข้อบังคับ** ในทุก path ที่แตะสิทธิ์: revoke member · change role · แก้ capabilities ของ role · เปลี่ยน plan
  - ชั้นสอง `orgEpoch:{organizationId}` (INCR ทุกครั้งที่ membership/role ของ org เปลี่ยน) ประกอบใน cache key
    → revoke คนเดียว = ล้ม cache ทั้ง org ด้วยคำสั่งเดียว ไม่ต้องไล่ลบราย user
  - ถ้า F-003 เปิด cache **ต้องมี test ว่า revoke แล้ว request ถัดไป 403 ทันที** ไม่งั้น AC US-5 พังเงียบ
  → บันทึกเป็น forward-commitment ของ F-003 (§14)

---

## §2 `ORG_PRISMA` vs `SYSTEM_PRISMA`

### 2.1 นิยาม

| token | คืออะไร | ใครฉีดได้ |
|---|---|---|
| `ORG_PRISMA` | `withOrgScope(prismaService.client, ctx จาก ALS)` — inject `organizationId` ให้ทุก query ของ model ที่ org-scoped **อัตโนมัติ** · ไม่มี context = **throw** `MissingOrgContextError` | **ทุก feature module** (ทางเดียวที่ปกติ) |
| `SYSTEM_PRISMA` | guarded client ตรง ๆ (ยังมี ledger guard) ไม่มี org filter | **allowlist ระดับไฟล์**: `src/auth/**`, `src/orgs/system/**`, **`src/tenancy/**`**, `src/health/**`, `src/prisma/**` (+ `src/admin/**` เมื่อ F-085 มา) |

> **M-1 · เติม `src/tenancy/**` ลง allowlist (แก้ตาม security review — เอกสารสองฉบับเคยไม่ตรงกัน):**
> `OrgContextMiddleware` ต้อง query `Membership` **ก่อน**ที่ context จะมีอยู่ (ปัญหาไก่กับไข่) จึงใช้ `ORG_PRISMA` ไม่ได้ ·
> ไฟล์นี้อยู่ที่ `apps/api/src/tenancy/` ตาม seam เดิมของ F-000 และ **backend.md §3.3 ระบุ `tenancy/` ไว้ใน allowlist อยู่แล้ว**
> ⇒ ร่างแรกของเอกสารนี้ตกไป 1 บรรทัด ถ้าไม่แก้ gate จะแดงหรือคนจะย้ายไฟล์ไปที่แปลก ๆ ·
> ขอบเขตที่อนุญาตใน `tenancy/`: **อ่าน `Membership`/`Role` ของคู่ (organizationId, userId) ที่ resolve มาเท่านั้น**
> — ห้ามเขียน, ห้าม query model อื่น (มี unit test พิสูจน์)

**การประกอบ `ORG_PRISMA`:** provider **singleton** ที่คืน Proxy — ทุกครั้งที่แตะ property (`orgPrisma.membership`)
จะอ่าน `OrgContextStore.get()` แล้ว **memoize scoped client ไว้บน object ของ context นั้น** (สร้าง `$extends` ครั้งเดียวต่อ request)
— เลือกทางนี้แทน `Scope.REQUEST` provider เพราะ request-scope ของ Nest "ติดเชื้อ" ขึ้นไปทั้งสาย DI
(controller/service กลายเป็น request-scoped ตาม) = ต้นทุน perf + เป็น trap ตอนใช้ใน worker/BullMQ ที่ไม่มี request

**ฝั่ง worker/job (อนาคต):** ไม่มี HTTP request → เรียก `OrgContextStore.run(ctx, fn)` เองที่หัว processor
(`ctx.organizationId` มาจาก payload ของ job) → `ORG_PRISMA` ใช้ได้เหมือนกันทุกประการ (ไม่มี pattern ที่สอง)

### 2.2 `withOrgScope` — สัญญาต่อ operation (แทน pass-through stub ของ F-000)

รายชื่อ model ที่ org-scoped อ่านจาก **`packages/db/src/org-models.ts`** (แหล่งเดียว, ตรวจกับ schema จริงด้วย test)
allowlist org-agnostic: `User`, `RefreshToken`, `Channel`, `PlanDefinition`

| operation | พฤติกรรม |
|---|---|
| `findMany` / `findFirst` / `count` / `aggregate` / `groupBy` | AND `where.organizationId = ctx.organizationId` |
| **`findFirstOrThrow`** *(เติมตาม qa §19.1 ข้อ 1)* | เหมือน `findFirst` + ไม่พบ → `P2025` → map `404 NOT_FOUND` (เท่ากับ "แถวของ org อื่น = ไม่มีอยู่จริง") |
| `findUnique` / `update` / `delete` | ใส่ `organizationId` ลง `where` ตรง ๆ (**extendedWhereUnique** — GA ตั้งแต่ Prisma 5, repo ใช้ 5.22) → แถวของ org อื่นให้ `P2025` → map เป็น `404 NOT_FOUND` · **ยังเป็นข้ออ้างที่ต้องพิสูจน์ — M-9** |
| **`findUniqueOrThrow`** *(เติมตาม qa)* | เหมือน `findUnique` + ไม่พบ/คนละ org → `P2025` → `404 NOT_FOUND` · **ห้ามให้ error message ต่างจากเคส "ไม่มีแถวนี้จริง ๆ"** (existence oracle — I-5) |
| `create` | inject `data.organizationId` |
| `createMany` | inject ทุกแถวใน `data[]` |
| **`createManyAndReturn`** *(Prisma ≥ 5.14 — มีจริงใน 5.22)* | inject ทุกแถวเหมือน `createMany` · แถวที่คืนกลับต้องเป็นของ ctx เท่านั้น |
| `updateMany` / `deleteMany` | AND `where.organizationId` |
| **`updateManyAndReturn`** *(ยังไม่มีใน Prisma 5.22 — ประกาศล่วงหน้า)* | เมื่อ Prisma อัปเกรดแล้วมี: AND `where.organizationId` + แถวที่คืนต้องเป็นของ ctx · **จนกว่าจะมีจริง = อยู่ในกลุ่ม "ไม่รู้จัก" ⇒ throw** (แถวสุดท้าย) |
| `upsert` | inject ทั้ง `where` และ `create` — **ข้อจำกัดของ `where` ใน `upsert` ต่างจาก `update` ⇒ M-9: ยังไม่ถือว่าจริงจนกว่าจะมี unit test** |
| caller ส่ง `organizationId` มาเองและ **ไม่ตรง** context | **throw `OrgScopeViolationError`** (ไม่ silently override — เขียนผิดต้องดัง) |
| nested **write** ข้าม model (`data: { child: { create … } }`) | extension ไม่ inject ให้ชั้นลูก → คอลัมน์ `organizationId` เป็น NOT NULL → DB ปฏิเสธ = fail loud · กติกา F-002: ใช้ sequential create ใน tx เดียวแทน nested write |
| nested **read** (`include`/`select` ของ relation ชั้นลูก) | **extension มองไม่เห็นเลย** — ไม่มีการ inject ใด ๆ ⇒ ต้องคุมด้วยกติกา C-3 ด้านล่าง (ไม่ใช่ด้วยกลไก) |
| `$queryRaw` / `$executeRaw` | extension ครอบไม่ได้ → **grep gate ห้ามใช้ใน feature module** (allowlist `health/`, `packages/db/`) |
| `$transaction(async tx => …)` | tx client **สืบทอด extension** — ต้องมี int test pin ข้อนี้ (Prisma เปลี่ยนพฤติกรรมเมื่อไหร่ = CI แดงทันที) |
| **operation ที่ไม่อยู่ในตารางนี้ (ทุกตัว)** | **`throw UnsupportedOrgScopeOperationError`** — ไม่ปล่อยผ่าน ไม่เดา (นโยบายใหม่ตาม qa §19.1 ข้อ 1) |

> **นโยบาย "operation นอกตาราง = throw" (ปิดช่องที่ qa จับได้ — §18 ข้อ 9):**
> ตารางนี้เดิมเป็น **allowlist ที่ไม่มี else** ⇒ operation ที่ไม่มีใครคิดถึง (`findUniqueOrThrow`,
> `findFirstOrThrow`, `createManyAndReturn`, และตัวที่ Prisma จะเพิ่มในเวอร์ชันหน้า) จะ **ผ่านไปโดยไม่ถูก inject
> `organizationId`** = cross-tenant leak เงียบ ๆ ที่ไม่มีเทสต์ไหนบอกว่าผิด เพราะไม่มีใครประกาศว่าถูกหรือผิด
> - **กติกา:** `withOrgScope` ถือ **map `operation → strategy` ที่ระบุครบ** · เจอ key ที่ไม่มีใน map → **throw ทันที**
>   (fail loud ตอนรัน + แดงตอนเทสต์) — ห้าม default เป็น pass-through เด็ดขาด
> - **ขอบเขต:** กติกานี้ครอบ **model-level operation** ที่ `$extends({ query: { $allModels: { $allOperations } } })`
>   ดักได้เท่านั้น · client-level (`$connect`/`$on`/`$transaction`/`$queryRaw`) มีกติกาของตัวเองอยู่แล้วในตาราง
> - **enumerate ได้จริง:** ชื่อ operation ทั้งหมดอ่านจาก Prisma runtime/DMMF ⇒ เทสต์ **U-DB-07** ของ qa
>   เทียบ "operation ที่ client รองรับ" กับ "key ใน map" — ขาดตัวใด = แดง ⇒ **อัปเกรด Prisma แล้วมี operation ใหม่
>   = CI จับได้ทันที ไม่ต้องหวังว่าจะมีคนอ่าน changelog**
> - map นี้ **export ออกจาก `packages/db`** (`ORG_SCOPE_OPERATION_STRATEGY`) เพื่อให้เทสต์ import แทนการประกาศซ้ำ (qa §19.1 ข้อ 4)

> **C-3 · `withOrgScope` ครอบไม่ถึง query ที่ตั้งต้นจาก model org-agnostic (แก้ตาม security review — Critical):**
> client extension เห็นเฉพาะ operation **ชั้นบนสุด** · ถ้า query เริ่มที่ model ใน allowlist org-agnostic
> (`User`/`RefreshToken`/`Channel`/`PlanDefinition`) จะไม่มีการ inject อะไรเลย **ทั้งสาย** —
> `orgPrisma.user.findUnique({ where:{id}, include:{ memberships:{ include:{ organization:true } } } })`
> คืน membership + ชื่อ org ของ **ทุก org** ที่ user คนนั้นสังกัด ให้ผู้เรียกที่อยู่ org เดียว = cross-tenant leak
> ที่ int test แบบ "ยิงด้วย token ของ org B" **จับไม่ได้** เพราะข้อมูลที่รั่วเป็นของ org ที่สาม ·
> ประโยค "หลังจากนี้ทุก feature ได้ org scoping ฟรี" จริงเฉพาะ query ที่ตั้งต้นจาก model org-scoped เท่านั้น
>
> **กติกา 4 ข้อ (บังคับตั้งแต่ F-002 เพราะ ~40 feature ถัดไปจะลอก pattern นี้):**
> 1. **ห้าม feature module ตั้งต้น query จาก model ใน org-agnostic allowlist** — ต้องตั้งต้นจาก model org-scoped
>    แล้ว `include` ขึ้นไปหา (`membership.findMany({ where:{…}, select:{ user:{ select:{ id:true, email:true } } } })`)
> 2. **grep gate (CI):** `orgPrisma.user.` / `orgPrisma.refreshToken.` / `orgPrisma.channel.` / `orgPrisma.planDefinition.`
>    นอก `src/orgs/system/`, `src/tenancy/`, `src/auth/` = **แดง** (คู่กับ depcruise §2.3)
> 3. **int test ใน `org-leak.kit.ts`:** จาก context org B เรียก `user.findUnique + include memberships` → ต้องไม่คืนแถวของ org A
>    (ต้องมี test นี้อยู่ดีแม้อนาคตจะเลือกทาง "ให้ extension inject ให้ nested ด้วย")
> 4. **(NEW-8 · amend #4) ห้าม traverse relation *ผ่าน* model org-agnostic แล้ว "ลงกลับ" เข้าสู่ model org-scoped**
>    — ไม่ว่า query จะตั้งต้นจากที่ใด · ตัวอย่างที่กติกาข้อ 1 ไม่ครอบและรั่วเท่ากับ C-3 เป๊ะ:
>    `membership.findMany({ select: { user: { select: { memberships: … } } } })` (ตั้งต้นถูก แต่วิ่งผ่าน `User`
>    กลับลงมาที่ `Membership` ของ **org อื่น**)
>
> **บังคับข้อ 4 เชิงโครงสร้าง ไม่ใช่ด้วย grep อย่างเดียว** (grep เป็น textual — alias/destructure หลบได้):
> - `packages/db` export **`USER_SELECT` = `{ id: true, email: true, createdAt: true }` (frozen object)** และ
>   **feature module ต้องใช้ค่านี้เท่านั้น** เวลาจะแตะ `User` — ห้ามเขียน `select` ของ `User` เองแบบ inline
>   ⇒ ไม่มีทางใส่ `memberships`/`refreshTokens` ลงไปได้ตั้งแต่แรก (ปิดทั้ง C-4 และ NEW-8 ด้วยของชิ้นเดียว)
> - grep gate เพิ่ม: `select: { user: {` / `include: { user:` ใน `apps/api/src/**` ที่ **ไม่ใช่** `user: USER_SELECT` = **แดง**
> - unit test ของ `USER_SELECT`: เป็น object ที่ freeze แล้ว (mutate ไม่ได้) + ไม่มี key ที่เป็น relation
> - เคสของ qa: **I-35 ต้องเพิ่มเคส "nested read ลงกลับ"** (`Membership → User → memberships`) ให้แดงเมื่อมีคนเขียน
>
> **C-4 · `select` เสมอบน `User` ห้าม `include`:** `User` มีคอลัมน์ `passwordHash` ⇒ `include:{ user:true }` +
> mapper แบบ spread = argon2 hash ขึ้น wire · กติกา: query ที่แตะ `User` ต้องระบุคอลัมน์เสมอ
> (`select:{ id:true, email:true }`) และมี **assertion กลางใน int-test kit** ว่า response body ของ **ทุก** endpoint
> ไม่มี key `passwordHash` / `tokenHash` / `token` (ยกเว้น `POST /orgs/{id}/invitations` + `…/link` ที่คืน `token` โดยเจตนา —
> ขึ้นทะเบียนเป็น explicit allowlist ในไฟล์ kit) — เขียนครั้งเดียวใช้ได้ทุก feature
>
> **M-9 · ข้ออ้าง extendedWhereUnique / `upsert` = unverifiable claim จนกว่าจะพิสูจน์:** ตาราง §2.2 ด้านบนเป็น
> **สมมติฐาน** ไม่ใช่ข้อเท็จจริงที่ยืนยันแล้ว · ต้องมี unit test **แถวต่อแถว** ใน `packages/db` (ทุก operation ×
> เคส "แถวของ org อื่น") ก่อนถือว่าจริง — โดยเฉพาะ **`upsert`** ซึ่ง accept flow เคยพึ่งพาโดยตรง ·
> **ถ้า `upsert` พิสูจน์ไม่ผ่าน** (Prisma ไม่ยอมให้ non-unique field ใน `where` ของ upsert) → fallback ที่ตัดสินไว้แล้ว:
> ห้ามใช้ `upsert` บน model org-scoped, ใช้ `findFirst` + `create`/`update` ใน tx เดียวแทน แล้วให้ `@@unique`
> เป็นตัวกันแข่ง (ซึ่ง §7.4 หลังแก้ I-9 ไม่ต้องใช้ upsert อยู่แล้ว)

### 2.3 Boundary gates (CI จับ)

1. **depcruise (apps/api ชุดที่สาม):** feature module ห้าม import `PrismaService`/`@omnistock/db` client ตรง —
   ต้อง inject `ORG_PRISMA` · `SYSTEM_PRISMA` import ได้เฉพาะ path ใน allowlist §2.1
2. **grep gate:** `SYSTEM_PRISMA` นอก allowlist = แดง · `$queryRaw` ใน feature module = แดง ·
   `new PrismaClient(` นอก `prisma.service.ts` = แดง (มีอยู่แล้ว) ·
   **`orgPrisma.<model org-agnostic>.` นอก allowlist = แดง (C-3 ข้อ 2)** · **`include: { user:` = แดง (C-4)** ·
   **`select: { user: {` ที่ไม่ใช่ `user: USER_SELECT` = แดง (NEW-8)**
3. **int test (บังคับ):** `org-leak.kit.ts` — seed org A + org B แล้วยิงทุก endpoint ของ F-002 (**ทั้ง read และ
   mutating**) **ด้วยผู้เรียก 5 ชนิด** (M-8 + ตัวที่ 5 ที่ qa เพิ่ม): (ก) สมาชิก active ของ org B (ข) user ที่**ไม่มี
   membership ที่ไหนเลย** (ค) user ที่ membership ใน org A เป็น `revoked` — พิสูจน์ AC US-5 **ราย endpoint**
   ไม่ใช่เทสต์เดียว (ง) user ที่ membership เป็น `invited` → (ก)–(ง) ต้องไม่เห็น/ไม่แก้ข้อมูลของ A ได้เลยแม้แต่เส้นเดียว
   · **(จ) Staff ของ org A** (สมาชิกจริง สิทธิ์ไม่พอ) → ต้องได้ **`403 FORBIDDEN` ไม่ใช่ `ORG_ACCESS_DENIED`**
   — เป็น persona เดียวที่พิสูจน์ว่าสอง code ไม่ถูกกลืนกัน (I-5)
   · **`invited` = dead state ใน F-002** (flow ของเราสร้าง membership ตอน accept เท่านั้น) — ประกาศไว้ชัดเพื่อไม่ให้ใคร
   คิดว่ามันคือ "รอรับคำเชิญ" แล้วเขียนโค้ดพึ่งพา; ยังคงค่าใน enum ไว้ (ถอดไม่ได้ใน Postgres) และ **ต้องถูกปฏิเสธ
   เหมือน revoked ทุกจุด**
4. **unit test ของ `withOrgScope` เอง:** ครบทุกแถว §2.2 (โดยเฉพาะ "caller ส่ง org อื่น → throw", "create ได้ org id จาก ctx",
   และ **M-9: `findUnique`/`update`/`delete`/`upsert` × แถวของ org อื่น**)
5. **route-registry capability test (บังคับ — I-2 · ขยายตาม NEW-3):** ตาราง `endpoint → capability` ประกาศครั้งเดียว
   **ในโค้ด production** (`ROUTE_CAPABILITIES`) แล้ว kit **import** ไปใช้ (ห้าม kit ประกาศซ้ำ) ·
   test (ก) ยิงทุก endpoint ที่ต้องมี capability ด้วย token ของ Staff → ต้อง 403 ทุกเส้น (ข) enumerate route ทั้งหมดจาก
   Nest router แล้ว **ทุก org-scoped route — รวม `GET` — ต้องมี metadata `@RequireCapability` หรือ `@AnyActiveMember`**
   — endpoint ใหม่ที่ลืมประกาศ = **test แดง** (ทำให้ "ลืม" กลายเป็น "พัง" ทั้งใน runtime ตาม §1.3 และใน CI) ·
   (ค) route ที่ใช้ `@AnyActiveMember` ต้องอยู่ใน **`ANY_ACTIVE_MEMBER_ROUTES`** ที่ pin ไว้ (§3.1) มิฉะนั้นแดง
6. **PII assertion กลาง (C-4):** kit มี assertion ตัวเดียวที่ทุก int test เรียก — response ต้องไม่มี key
   `passwordHash`/`tokenHash` (และ `token` นอก allowlist ที่ระบุใน §2.2)

> **ทำไมไม่ใช้ Postgres RLS ตอนนี้:** ตัดสินไปแล้วใน backend.md §3.3 (ผูก session state กับ pooling, migration ทุกตารางแพงขึ้น)
> → เป็น hardening option ของ F-087 · ชั้น client-extension ทดสอบอัตโนมัติได้ครบก่อน

### 2.4 จุดที่ **จำเป็นต้องใช้ `SYSTEM_PRISMA`** ใน F-002 (มี 3 จุด — ขังไว้ในโฟลเดอร์เดียว)

`apps/api/src/orgs/system/` — ไฟล์เดียวต่อกรณี, method น้อยที่สุด, มี security event ทุกเส้น:

| กรณี | ทำไม org scope ใช้ไม่ได้ | ขอบเขตที่อนุญาต |
|---|---|---|
| `POST /organizations` | ตอนเริ่ม tx ยังไม่มี org และยังไม่มี membership | เขียน `Organization/Role/Membership/OrgEntitlement/Warehouse` ของ **org ที่เพิ่งสร้างใน tx นี้เท่านั้น** |
| `GET /me/organizations` | query ข้าม org โดยธรรมชาติ (ของ user คนนี้) | อ่าน `Membership where userId = ctx.userId` — **บังคับใส่ userId เสมอ** (มี test) |
| invitation by token (preview / accept) | ผู้เรียกยังไม่ใช่สมาชิก จึงยังไม่มี org context | อ่าน `Invitation where tokenHash = …` แล้ว **`OrgContextStore.run({ organizationId: inv.organizationId, … })` ครอบงานที่เหลือ** (I-3) — ห้ามใช้ org จาก header เด็ดขาด |

กติกาเสริม: ทุก method ในโฟลเดอร์นี้ต้อง (ก) รับ `userId` หรือ `tokenHash` เป็นตัวจำกัดขอบเขตเสมอ
(ข) ไม่ export client ออกนอกไฟล์ (ค) มี unit test พิสูจน์ว่าไม่มี path ไหนอ่านข้าม user/token ได้
(ง) **ไม่อ่าน `X-Organization-Id` เลย** (I-3 — org ของ flow นี้มาจากแถว invitation เท่านั้น; มี unit test พิสูจน์ว่าส่ง
header ของ org อื่นเข้ามาแล้วผลลัพธ์ไม่เปลี่ยนแม้แต่ field เดียว)

---

## §3 Authorization ภายใน org (แนวตั้ง)

### 3.1 ชั้น capability — `@RequireCapability()` ตั้งแต่ F-002 (I-2, เปลี่ยนจากร่างแรก)

ร่างแรกวาง capability check เป็น **helper ที่ service ต้องเรียกเอง** (`requireCapability(ctx, cap)` บรรทัดแรกของ method)
· security review ชี้ถูก: **ลืมเรียก = ไม่มีอะไรพัง แต่รั่ว** — Staff ยิง `DELETE /orgs/X/members/<Owner คนที่สอง>` ผ่านหมด
ทุกด่าน (เป็นสมาชิก active, org เดียวกัน, ยังเหลือ owner) แล้วได้ 200 · ขัดหลัก "ลืมแล้วพัง" ที่ §1.1 ประกาศไว้เอง

**ทางที่เลือก (แข็งกว่า route-registry test อย่างเดียว): ประกาศเป็น metadata + guard อ่าน ALS**

```ts
@RequireCapability(CAPABILITY_MANAGE_MEMBERS)      // metadata ล้วน (SetMetadata) — ไม่มี logic
@Delete(":userId") revoke(...) { ... }
```

- `CapabilityGuard` (global, รันหลัง `OrgScopeGuard`) อ่าน metadata + `capabilities` จาก ALS ctx แล้วใช้
  **`hasCapability()` ของ `packages/core-domain/src/auth/capabilities.ts` ที่มีอยู่แล้ว** (semantics: `full_access`
  ครอบทุกอย่าง) — F-001 ใช้ตัวนี้อยู่แล้ว ⇒ ไม่มี pattern ใหม่ ไม่มี logic ซ้ำ
- **fail-closed by omission (ขยายตาม NEW-3 — amend #4):** org-scoped route **ทุกเส้นไม่ว่า method ใด (รวม `GET`)**
  ที่ไม่มี metadata → guard ปฏิเสธ (`403 FORBIDDEN`) + log `capability_metadata_missing` · route อ่านที่ตั้งใจให้
  สมาชิกทุกคนเข้าถึงได้ ต้อง mark ชัดด้วย `@AnyActiveMember()` (marker ว่างเปล่า — "ตั้งใจไม่ต้องมี capability")
  · **เหตุผลที่ต้องครอบ read:** ของที่แพงที่สุดของ F-002 คือ email directory (`GET …/members`) ไม่ใช่ mutation —
  ดู NEW-3 ที่ §1.3
- **สองชั้นคู่กัน:** runtime (ข้างบน) + CI (route-registry test §2.3 ข้อ 5) ⇒ ลืมประกาศ = พังทั้งตอนรันและตอน CI
- **ทำไมทำตั้งแต่ F-002 ทั้งที่ RBAC เป็นโดเมน F-003:** ตัว decorator = `SetMetadata` 3 บรรทัด + guard 20 บรรทัด
  (ไม่ใช่ registry, ไม่ใช่ role CRUD) · **wire ไม่เปลี่ยน** ตอน F-003 มาเติม registry — สิ่งที่ F-003 ทำคือ
  ให้ค่า capability มาจาก registry ที่ตรวจสอบได้ ไม่ใช่ string อิสระ
- capability ที่ F-002 **บังคับใช้จริง** มี **2 ตัว**: `manage_members` (เชิญ/ถอด**คนอื่น**/เปลี่ยน role/ดูรายชื่อสมาชิก) และ
  `manage_org_settings` (แก้โปรไฟล์ org + tax profile + **ขอดู TIN เต็มผ่าน `POST …/tax-profile/reveal`**) —
  ทั้งคู่อยู่ใน registry ปลายเปิดของ docs/01 §2

> **NEW-11 · `POST …/tax-profile/reveal` เปิดถึงระดับ Admin — เป็นการตัดสินที่ตั้งใจ (D-030 ข้อ 2) ไม่ใช่การตกหล่น:**
> `manage_org_settings` อยู่ในชุดของ **Admin** (data-model §5.2) ⇒ Admin ที่เพิ่งถูกเชิญเข้ามาอ่าน TIN เต็มของร้านได้
> (ซึ่งเมื่อ `entityType='personal'` = **เลขบัตรประชาชนของเจ้าของร้าน**) · security-reviewer ยกขึ้นมาถูกต้อง และ
> **user เคาะแล้วว่าคงตามที่ contract lock ไว้** เพราะคนที่ดูแลเอกสารภาษีต้องกรอก/ตรวจเลขนี้จริง และการซ่อนจาก Admin
> จะทำให้ Phase 2 (ออกเอกสารภาษี) ทำงานไม่ได้ ⇒ **ผ่อนทีหลังถูกกว่าบล็อกตอนนี้**
> · **ตัวคุมที่แลกมา (ทั้งหมดเป็นของ F-002 ไม่ใช่คำสัญญาลอย ๆ):** (ก) เส้นแยกที่ต้องกด **โดยตั้งใจ** ไม่ติดมากับ
> `GET /orgs/{orgId}` (ข) emit `org.tax_profile.revealed` **ทุกครั้ง** (ไม่มีค่า TIN ใน event) (ค) rate limit **20/ชม.
> ต่อ (userId, orgId)** (ง) `no-store` + `no-referrer` (จ) `TAX_ID_RESPONSE_ALLOWLIST` = **1 เส้นพอดี** ที่ CI บังคับ
> · **ที่ยังเปิดอยู่โดยรู้ตัว:** Owner ยังไม่มี *จอ* ที่เห็น event นี้จนกว่าจะมี **F-005** (ข้อเสนอ H.3 ของ reviewer) ⇒
> ขึ้นทะเบียนเป็น forward-commitment ของ F-005 ที่ §14 ไม่ใช่ปล่อยหาย
- **`@AnyActiveMember()` ไม่ใช่ "ยังไม่ได้ประกาศ" แต่คือ "ประกาศแล้วว่าไม่ต้องมี capability"** ·
  route-registry test ต้องนับ marker นี้เป็น "ประกาศถูกต้อง" ไม่ใช่ "ลืม" (test-plan I-02)
  **แต่ต้องอยู่ใน allowlist ที่ pin ไว้เสมอ** — มิฉะนั้น "ลืมประกาศ = แดง" จะกลายเป็น "ประกาศให้อ่อนที่สุด = เขียว"
  (เงื่อนไขของ qa ที่ §20 ข้อ 5 · G-13) · **แก้ความขัดกันระหว่าง §3.1 กับ G-13 (NEW-3):** allowlist ถูกแยกเป็น
  **2 ลิสต์** แล้ว export เป็นก้อนเดียวจาก production (`ANY_ACTIVE_MEMBER_ROUTES`) ให้ I-02/G-13 import:

  | ลิสต์ | สมาชิกวันนี้ (pin) | เหตุผลที่ปลอดภัยแม้ไม่มี capability |
  |---|---|---|
  | `ANY_ACTIVE_MEMBER_ROUTES.mutating` | **`DELETE /orgs/{orgId}/membership`** (leave — D-029) — **1 เส้น** | เส้นนี้ **ไม่มี `userId` ใน path** เป้าหมายคือ `ctx.userId` เสมอ ⇒ ไม่มี input ให้ชี้ไปที่คนอื่น (กัน confused deputy เชิงโครงสร้าง ไม่ใช่เชิง `if`) |
  | `ANY_ACTIVE_MEMBER_ROUTES.read` | **`GET /orgs/{orgId}`** · **`GET /orgs/{orgId}/roles`** — **2 เส้น** | ทั้งคู่คืนเฉพาะข้อมูลของ org ที่ผู้เรียกเป็นสมาชิกอยู่แล้ว และ **ไม่มี PII ของบุคคลอื่น** (`GET /orgs/{orgId}` ผ่าน mapper PDPA ของ §3.3 api-spec: ไม่มี TIN/รายชื่อ · `roles` = ชื่อ role ล้วน) |

  **เส้นใหม่ที่ใส่ `@AnyActiveMember()` โดยไม่แก้ลิสต์ = CI แดง ทั้งสองลิสต์** (G-13 ต้องเทียบราย tier ไม่ใช่นับรวม
  ⇒ การเพิ่ม read route ที่อ่อนที่สุดจะไม่ถูกกลบด้วยโควตาของ mutating)
- **สิทธิ์อ่าน (แก้ตาม D-028/I-8/N-4):** `GET /orgs/{orgId}` + `GET /orgs/{orgId}/roles` = `@AnyActiveMember()` (ตามตารางบน) ·
  **`GET /orgs/{orgId}/members` และ `GET /orgs/{orgId}/invitations` ต้องมี `manage_members`** (email ของทุกคนในองค์กร
  = PII ตาม PDPA ไม่ใช่เรื่อง UX) · **TIN เต็มออกทาง `POST …/tax-profile/reveal` เส้นเดียว** และ `taxIdMasked`
  เฉพาะ `manage_org_settings` (field-level — api-spec §3.3/§3.16 · **`GET /orgs/{orgId}` ไม่คืน `taxId` ให้ใครเลย**)
- system roles ที่ F-002 seed ตอนสร้าง org (ค่าเต็มดู [data-model §5](data-model.md)):
  `Owner` (`full_access`, `isSystem=true` — แก้/ลบไม่ได้) · `Admin` · `Staff`

### 3.2 ชั้น Owner-only — `canAssignRole()` (C-1 · D-028)

**ช่องที่ปิด:** `manage_members` (= Admin) เดิมพอสำหรับ "เปลี่ยน role ของใครก็ได้เป็นอะไรก็ได้" ⇒ Admin ยกตัวเอง
เป็น Owner แล้วถอดเจ้าของจริงออกได้ และ **ไม่มีทางกู้** ใน Phase 0 (back-office = F-085/Phase 5) ·
ทางอ้อมที่ให้ผลเดียวกัน: เชิญ email ของตัวเองด้วย role Owner แล้ว accept

**pure fn (กฎทอง 6) — `packages/core-domain/src/orgs/member-authz.ts`:**

```ts
canAssignRole({ actorCapabilities, targetIsOwner, newRoleIsOwner }): boolean
// true ต่อเมื่อ:  (targetIsOwner === false && newRoleIsOwner === false)
//                || actorCapabilities มี 'full_access'
```

| call site | ค่าที่ส่งเข้า | ผลเมื่อ false |
|---|---|---|
| `PATCH /orgs/{orgId}/members/{userId}` | `targetIsOwner` = role ปัจจุบันของ target มี `full_access` · `newRoleIsOwner` = role ใหม่มี `full_access` | `403 FORBIDDEN` |
| `DELETE /orgs/{orgId}/members/{userId}` | `targetIsOwner` = role ปัจจุบันของ target มี `full_access` · `newRoleIsOwner = false` | `403 FORBIDDEN` |
| `POST /orgs/{orgId}/invitations` | `targetIsOwner = false` · `newRoleIsOwner` = role ที่เชิญมี `full_access` | `403 FORBIDDEN` |
| **`POST /orgs/{orgId}/invitations/{id}/link` (reissue)** *(ใหม่ — NEW-2)* | `targetIsOwner = false` · `newRoleIsOwner` = **role ของคำเชิญใบนั้น**มี `full_access` (อ่านผ่าน `tx` หลังคว้า lock) | `403 FORBIDDEN` |
| **`POST /orgs/{orgId}/members/{userId}/reset-password`** *(F-001, ★ — NEW-1/D-030)* | `targetIsOwner` = role ปัจจุบันของ target มี `full_access` · `newRoleIsOwner = false` | **`404 NOT_FOUND` รูปเดิม** (คง 404-never-403 ของ F-001 — §3.3) |

> **NEW-2 · reissue ต้องผ่าน `canAssignRole` ด้วย (แก้ตาม delta review — Important):** ร่าง amend #3 ให้ reissue
> ผ่านแค่ `manage_members` ⇒ **Admin ออกโทเคนใหม่ของคำเชิญ role Owner ได้ไม่จำกัด** และ D-027 (อายุนับใหม่)
> ทำให้ประตูนั้น **เปิดค้างได้ตลอด** โดยที่ Owner ตัวจริงเห็นแค่ event ที่ยังไม่มีจอ (F-005) ·
> ช่องนี้เกิดจาก "Owner-only คุมประตูบานแรก (create) แต่ไม่คุมกุญแจที่ทำสำเนาได้ (reissue)"
> — `canAssignRole` ที่ reissue ปิดมันด้วย **code เดิม (`403 FORBIDDEN` ที่ §3.12 ประกาศไว้แล้ว) ⇒ ไม่แตะ wire**
>
> **ตัดสินข้อเสนอเสริมของ reviewer (H.3 ข้อ 3) — "reissue คำเชิญที่หมดอายุแล้ว → `409` ไปเลย": ❌ ไม่รับ**
> เหตุผล: (ก) เมื่อ `canAssignRole` อยู่ที่ reissue แล้ว คำเชิญ role สูงถูก re-mint ได้เฉพาะผู้มี `full_access`
> ⇒ สิ่งที่ข้อเสนอนี้ซื้อเพิ่มเหลือแค่ "Owner ต่ออายุคำเชิญของตัวเอง" ซึ่งเป็นการกระทำที่ชอบธรรม
> (ข) `POST /orgs/{id}/invitations` **ทำ reissue บนแถวเดิมอยู่แล้ว**เมื่อคำเชิญหมดอายุ (§7.4) ⇒ การปิดเส้น `…/link`
> จะได้แค่ทางตันบนจอที่ ux เซ็นไปแล้ว โดยความสามารถยังอยู่ครบทางเส้นอื่น = ความปลอดภัยเพิ่ม 0 แต่ UX เสีย
> (ค) contract LOCKED — ไม่แลกทางตันของผู้ใช้กับผลลัพธ์เชิงความปลอดภัยที่เป็นศูนย์
> · **สิ่งที่ทำแทน:** reissue **คำนวณ TTL ใหม่จาก capability ของ role เสมอ** (§7.5) ⇒ คำเชิญ role สูงยืดได้ทีละ 24 ชม.
> เท่านั้น และทุกครั้งมี `org.invitation.link_reissued` + rate limit 60/ชม./org

- **นิยาม "เป็น Owner" = role นั้นมี capability `full_access`** (ไม่ใช่เทียบชื่อ `name === "Owner"` ซึ่งเปราะเมื่อ F-003
  เปิดให้แก้ชื่อ/สร้าง custom role) — ทำให้กฎนี้ยังถูกหลัง F-003 โดยไม่ต้องแก้
- ตรวจ **หลัง** `CapabilityGuard` และ **ใน tx เดียวกับ `lockCurrentOrganization`** (อ่าน role ปัจจุบันของ target จาก `tx`) —
  ไม่งั้นเป็น TOCTOU กับการเปลี่ยน role พร้อมกัน
- test matrix เต็มอยู่ที่ [data-model §6](data-model.md) — Admin ยกตัวเอง / Admin ยกคนอื่น / Admin แก้ Owner /
  Admin ถอด Owner / Admin เชิญด้วย role Owner / Owner ทำทุกข้อ / Admin แก้ Staff (ต้องผ่าน)
- `403 FORBIDDEN` (ไม่เพิ่ม code ใหม่) — สำหรับผู้เรียก ความหมายคือ "คุณไม่มีสิทธิ์ทำสิ่งนี้" ตรงตัวอยู่แล้ว
  · **ยกเว้นเส้น admin-reset ของ F-001 ที่คืน `404` ตามแบบเดิมของ endpoint นั้น** (§3.3)

> **ขอบของกฎนี้ที่ *ยังไม่* ปิดใน F-002 (NEW-10 — ประกาศไว้ ไม่ใช่ลืม):** `canAssignRole` เทียบเฉพาะ `full_access`
> ⇒ เมื่อ **F-003** เปิด custom role, ผู้มี `manage_members` จะยัง **มอบ capability ที่ตัวเองไม่มี** ได้
> (เช่น สร้าง/มอบ role ที่มี `manage_org_settings` แล้วให้คนนั้นไปกด reveal TIN) · **เหตุผลที่ไม่ทำตอนนี้ (D-030):**
> F-002 **ยังไม่มี capability registry จริง** (เป็นของ F-003) จึงเทียบ "สิทธิ์สูงกว่า/superset" ไม่ได้อย่างถูกต้อง —
> เขียนกฎครึ่ง ๆ ตอนนี้จะได้กฎที่ผิดพอ ๆ กับไม่มี · **trigger:** feature ใดก็ตามที่เปิดให้ **สร้าง/แก้ capabilities ของ role**
> (วันนี้ = F-003) ต้อง implement กฎ **"actor มอบได้เฉพาะ capability ที่ตัวเองถืออยู่ (privilege-superset)"** พร้อมกัน
> ⇒ forward-commitment ที่ §14

### 3.3 กระทบโค้ดที่ ship แล้ว — admin-reset ต้อง fail-closed **2 เงื่อนไข** (C-2/D-028 + NEW-1/D-030) ★

**ปัญหาที่ 1 (C-2 — ข้าม org):** `POST /orgs/{orgId}/members/{userId}/reset-password` (F-001) เขียนทับ `User.passwordHash`
ซึ่งเป็น credential **ระดับ global** (`apps/api/src/auth/auth.service.ts` → `db.user.update` + `refresh.revokeAllForUser`) ·
F-002 คือ feature ที่ทำให้ "1 user หลาย org" เป็นจริง ⇒ Admin ของ org B รีเซ็ตรหัสของสมาชิกที่เป็น **Owner ของ org A**
แล้วล็อกอินเป็นคนนั้นได้ = ข้าม tenant boundary · เคสนี้อยู่ใน **persona ของ Gate 1 เอง** ("รับจ้างทำบัญชีให้ร้านอื่น")

**ปัญหาที่ 2 (NEW-1 — *ภายใน org เดียวกัน*, delta review จับได้ว่าเงื่อนไขแรกปิดไม่ครบ):**
ตัวกรอง multi-org **ไม่ทำงานเลย**ในเคสที่พบบ่อยที่สุดของ dogfood — เจ้าของร้านสังกัดร้านตัวเองร้านเดียว:

```
org X: Owner = U1 (สังกัด X ร้านเดียว) · Admin = A (manage_members)
1. A: POST /orgs/X/members/U1/reset-password → callerOk ✓ · targetOk ✓ · ตัวกรอง multi-org ผ่าน (U1 ไม่มี org อื่น)
   ⇒ 200 · เขียนทับ passwordHash ของ U1 · revoke ทุก session ของ U1
2. A ล็อกอินด้วย email ของ U1 + รหัสใหม่ → ได้ session ของ Owner ตัวจริง
3. A (ในร่าง U1) ยกตัวเองเป็น Owner / ถอด U1 → ยึดร้านเบ็ดเสร็จ · Phase 0 ไม่มีทางกู้
```
⇒ `canAssignRole` (§3.2) กันได้เฉพาะเส้นทาง **membership API** · เส้นนี้เดินผ่าน **credential** ⇒ ตราบใดที่ยังเปิดอยู่
กฎ "เฉพาะ `full_access` เท่านั้นที่แตะ Owner ได้" **เป็นจริงแค่บนกระดาษ**

**สิ่งที่ต้องแก้ (D-028 ทางเลือก (a) fail-closed + D-030 ข้อ 1 — เงื่อนไขที่สองบน endpoint เดียวกัน ★-task เดียวกัน):**

| ไฟล์ | ต้องแก้อะไร |
|---|---|
| `apps/api/src/auth/auth.service.ts` → `adminResetPassword()` **(ทั้งบล็อกอยู่ใน tx เดียว — NEW-5ก)** | เปิด `$transaction` ของ **`SYSTEM_PRISMA`** (`auth/` อยู่ใน allowlist §2.1 · เส้นนี้ไม่มี org context เพราะเป็น `@UserScoped()`) แล้วทำตามลำดับ: (1) `SELECT id FROM "User" WHERE id = target FOR UPDATE` (serialize กับ admin-reset ตัวอื่นของ user คนเดียวกัน) (2) **เงื่อนไข C-2:** `tx.membership.count({ where: { userId: target, status:'active', organizationId: { not: orgId } } }) > 0 ⇒ targetOk = false` (3) **เงื่อนไข NEW-1:** อ่าน membership ของ (orgId, target) พร้อม `role.capabilities` **ผ่าน `tx`** แล้ว `canAssignRole({ actorCapabilities, targetIsOwner: role ของ target มี full_access, newRoleIsOwner: false }) === false ⇒ targetOk = false` (4) เขียน `passwordHash` (5) **นับซ้ำข้อ (2) อีกครั้งหลังเขียน** — ถ้าเปลี่ยน ⇒ **rollback + 404** · ทุก read ใช้ `tx` ห้ามใช้ client ที่ inject มา (M-2 รูปเดียวกัน) |
| (ผลบน wire) | **ไม่เปลี่ยนอะไรเลย** — ยังเป็น 404 รูปเดิม, ไม่มี code ใหม่, ไม่มี status ใหม่ (คง **404-never-403**: ผู้เรียกแยกไม่ออกว่าเป็นเพราะ "ไม่ใช่สมาชิก" / "target อยู่หลาย org" / "target เป็น Owner") ⇒ `oasdiff` เงียบ · เท่ากับใช้ `canAssignRole` ตัวเดิม ไม่มีกฎที่สอง |
| `apps/api/src/auth/auth.service.ts` (event) | ปฏิเสธด้วยเหตุ C-2 → `auth.password.admin_reset_blocked_multi_org` · ปฏิเสธด้วยเหตุ NEW-1 → **`auth.password.admin_reset_blocked_owner_target`** *(ใหม่ — แยกใบเพื่อให้สืบได้ว่าเป็นการพยายามยึดบัญชี Owner ไม่ใช่เคส multi-org ธรรมดา)* · payload ทั้งคู่ = `{ actorUserId, orgId, targetUserId }` (ไม่มีรหัส ไม่มี hash) |
| `apps/api/src/auth/auth.service.test.ts` (unit) | **เมทริกซ์ 7 เคส:** (ก) target active เฉพาะ org นี้ + ไม่ใช่ Owner → **สำเร็จเหมือนเดิม** (ข) target active ใน org อื่นด้วย → **404 + `user.update` ไม่ถูกเรียก** (ค) target มี membership ใน org อื่นแต่ `revoked` → **สำเร็จ** (ง) caller ไม่มี capability → 404 เหมือนเดิม (จ) เคส (ข) ต้อง emit `…blocked_multi_org` · **(ฉ) *ใหม่*: target เป็น Owner (`full_access`) + caller มีแค่ `manage_members` → 404 + `user.update` ไม่ถูกเรียก + emit `…blocked_owner_target`** · **(ช) *ใหม่*: target เป็น Owner + caller มี `full_access` → สำเร็จ** (Owner รีเซ็ตให้ Owner ด้วยกันได้ — พิสูจน์ว่าไม่ได้ปิดทั้งเส้น) |
| `apps/api/src/auth/auth.e2e.int.test.ts` (int) | **บังคับ ไม่ใช่ทางเลือก** *(qa Q16)*: (1) C-2: seed 2 org, user เดียว active ทั้งคู่ → admin org B เรียก reset → **404 + รหัสเดิมยังล็อกอินได้จริง** + เคสควบคุม "target อยู่ org เดียวและไม่ใช่ Owner → ยังสำเร็จ" · **(2) NEW-1: org เดียว, Admin เรียก reset ใส่ Owner → 404 + รหัสเดิมของ Owner ยังล็อกอินได้จริง** + เคสควบคุม "Owner เรียก reset ใส่ Owner อีกคน → 200" (กันการ "ผ่าน" ด้วยการทำ endpoint พังทั้งเส้น) |
| เงื่อนไขของงานนี้ *(qa Q16)* | ทั้ง unit และ int เข้า **smoke tier ถาวร** (ลบต้องมี D-XXX) · ★-task ต้องมีหลักฐาน **red→green** (รันกับโค้ดก่อนแก้แล้วแดงจริง — **ทั้งสองเงื่อนไข**) · ต้องเพิ่มบรรทัดใน `docs/features/F-001-authentication.md` ตาม §14 |

- **ราคาที่จ่าย ข้อ 1 (C-2):** เจ้าของร้านที่มีพนักงานซึ่งบังเอิญเป็นสมาชิก active ของ org อื่นด้วย
  จะ **รีเซ็ตรหัสให้พนักงานคนนั้นไม่ได้** และได้ 404 ที่ไม่อธิบายอะไร (โดยเจตนา) → ทางแก้ถาวรคือ self-serve reset (F-081)
  · ระหว่างนี้ถ้าดังจริง ให้แก้ด้วย copy ในหน้าจอ ("ถ้าพนักงานใช้บัญชีนี้กับองค์กรอื่นด้วย ต้องให้เขารีเซ็ตเอง") ไม่ใช่ปลดเช็ค
- **ราคาที่จ่าย ข้อ 2 (NEW-1 — user รับแล้วใน D-030 และต้องเขียนไว้ให้ชัด):** **ร้านที่มี Owner คนเดียวแล้วลืมรหัส
  = กู้บัญชีเองไม่ได้เลยใน Phase 0** — ไม่มี Admin คนไหนช่วยรีเซ็ตให้ได้ (ได้ 404) และยังไม่มี self-serve reset
  ⇒ **ทางกู้เดียว = F-081 (SMTP + reset ด้วยตัวเอง)** · ขึ้นทะเบียนเป็น **forward-commitment ที่ผูก trigger ไว้** (§14)
  · จนกว่าจะถึงตอนนั้น การกู้ต้องทำด้วยมือที่ระดับ DB โดยผู้ดูแลระบบ (dogfood เท่านั้น — ไม่ใช่ฟีเจอร์)
- **ที่จงใจ *ไม่* ทำ:** กฎทั่วไป "ห้ามรีเซ็ตรหัสของคนที่สิทธิ์สูงกว่าหรือเท่าตัวเอง" — F-002 ยังไม่มี capability registry
  จริง (เป็นของ F-003) จึงเทียบ "สูงกว่า" ไม่ได้อย่างถูกต้อง ⇒ ผูกเป็นงานของ **F-003 พร้อม NEW-10** (D-030 ข้อ 1)
- **NEW-5 (ก) TOCTOU:** การนับ + การเขียนอยู่ **tx เดียวกัน** แล้ว (ตารางบน) และมีการนับซ้ำหลังเขียน ⇒ ช่องที่เหลือ
  แคบลงเหลือ "accept ของ org อื่น commit หลังการนับรอบสอง" ซึ่ง **เป็นความเสี่ยงชนิดเดียวกับ NEW-5 (ข)** พอดี
  (แอดมินรู้รหัส *ก่อน* target ไปสังกัด org อื่น) ⇒ ปิดจริงพร้อมกันที่ **F-081** ไม่ใช่ที่นี่ ·
  **ผมจงใจไม่เพิ่ม advisory lock ระดับ user** ที่ทุกเส้นทางสร้าง membership ต้องคว้าด้วย — มันจะเพิ่มกติกา lock-ordering
  ข้ามทั้งระบบเพื่อปิดหน้าต่างระดับมิลลิวินาที ที่ผู้โจมตีต้องคุมจังหวะการกด accept ของเหยื่อได้ (ราคาไม่คุ้ม
  และ **ทำให้ผิดกับสิ่งที่ §5 บังคับว่า `lockCurrentOrganization` ต้องเป็นคำสั่งแรกของ tx**)
- **NEW-5 (ข) ที่ยังเปิดอยู่โดยประกาศ:** ไม่มี "บังคับเปลี่ยนรหัสเมื่อล็อกอินครั้งถัดไป" ⇒ Admin ที่รีเซ็ตให้พนักงาน
  วันนี้ (ถูกกฎ, org เดียว) **ยังรู้รหัสนั้น**เมื่อพนักงานไปสร้างร้านของตัวเอง/ถูกเชิญเข้าร้านอื่นภายหลัง —
  ตัวกรองของ D-028 มองไม่เห็นอดีต ⇒ **forward-commitment F-081** (must-change-password / self-serve reset) ที่ §14
- นี่คือ **การลดความสามารถของ endpoint ที่ ship แล้ว รอบที่สอง** — PM ต้องแตกเป็น task ★ **ใบเดียว** ที่ทำทั้งสองเงื่อนไข
  (แยกจาก task อื่นของ F-002) เพราะทั้งคู่แก้ฟังก์ชันเดียวกันและต้องมี red→green ร่วมกัน

---

## §4 AC US-5 × โมเดล token — "ถอดสมาชิก → refresh token ในorg นี้ถูกเพิกถอน"

**ข้อเท็จจริง as-built:** `RefreshToken` ผูกกับ `userId` เท่านั้น — **ไม่มี `organizationId`** (docs/01 §2 เขียนไว้ว่า
"auth ไม่ผูก organizationId" และ F-001 build ตามนั้น) · access token ถือแค่ `{sub, iat, exp, jti, typ}` (M-9) ไม่มี org claim

**AC US-5 บังคับสองบรรทัดพร้อมกัน:**
- (ก) ถอดสมาชิก → "เข้าข้อมูล org นี้ไม่ได้ทันที + refresh token ในorg นี้ถูกเพิกถอน"
- (ข) "สมาชิกที่ถูกถอด **ยังล็อกอินได้และเห็น org อื่น**ที่ตนสังกัด"

(ข) แปลว่า **session ต้องรอด** → การ "เพิกถอน token" แบบตัวอักษร (ลบ token row) ทำให้ (ข) พังทันที
สองบรรทัดนี้อยู่ด้วยกันได้ทางเดียว: **"เพิกถอนสิทธิ์ใน org นี้" ไม่ใช่ "ทำลาย session"**

| ทางเลือก | ผล | ตัดสิน |
|---|---|---|
| **(A — เลือก) ตัดที่ membership: ทุก request org-scoped เช็ค `Membership.status='active'` สดจาก DB** | revoke แล้ว request ถัดไปของ org นั้น = 403 ทันที · org อื่นไม่กระทบเลย · ไม่ต้องแตะ token | ✅ ตอบ (ก) เชิงผลลัพธ์ + ตอบ (ข) เต็ม · ไม่แตะ contract auth ที่ ship แล้ว |
| (B) เพิ่ม `organizationId` ลง `RefreshToken` (1 session ต่อ org) | ต้อง login ใหม่ทุกครั้งที่สลับ org, session list บวมเป็น n × org, ขัด docs/01 + รื้อ F-001 ทั้ง module | ❌ แพงและขัดโมเดลแกน |
| (C) ใส่ org claim + epoch ลง access token แล้วเช็คจาก claim | ขัด M-9 (access token ต้อง minimal ไม่มี PII/org/role) · revoke มี lag เท่า TTL access token | ❌ แย่กว่า (A) ทั้งความปลอดภัยและความเร็ว |

**สิ่งที่ (A) ให้จริง:** ช่วงเวลาที่สมาชิกที่ถูกถอด "ยังทำอะไรได้" = **0 request** (ไม่ใช่ ≤ TTL) เพราะ authorization
อ่าน DB ทุก request — **แรงกว่า** การ revoke token ทั่วไปเสียอีก (revoke token ปกติยังปล่อยให้ access token เดิมใช้ได้จนหมดอายุ)

**ผลข้างเคียงที่ยอมรับ + วิธีคุม:**
- ไม่แตะ `RefreshToken` เลย → org อื่นของ user คนนั้นไม่สะดุด (คือสิ่งที่ (ข) ต้องการ)
- ถ้าอนาคตเปิด cache membership → **ต้อง invalidate ตอน revoke** (§1.5) ไม่งั้น (ก) พังเงียบ → forward-commitment ของ F-003 + test บังคับ
- ✅ **เคาะแล้ว: D-027** — การตีความนี้ถูกรับรองโดย user (security review §E ข้อ 2 พยายาม falsify แล้วยืนยันว่าถูก)

**AC ใหม่จาก D-027 ที่ต้องทำในเส้นนี้ด้วย: org ที่ถูกถอดต้อง *หายจากรายการทันที***

- `GET /me/organizations` (default `status=active`) query `Membership where userId, status='active'` ⇒
  แถวที่ถูก revoke หายจากผลลัพธ์ **ทันทีที่ commit** โดยอัตโนมัติ — ไม่มี cache, ไม่มี job (ตรงกับ §1.5)
- client flow ที่ contract รองรับ: request ถัดไปของ org นั้นได้ `403 ORG_ACCESS_DENIED` (I-5) → web/mobile
  พากลับหน้าเลือก org แล้ว **refetch `/me/organizations`** → org ที่ถูกถอดหายจาก switcher
- int test บังคับ: revoke แล้ว (ก) request ถัดไปของ org นั้น = 403 `ORG_ACCESS_DENIED` (ข) `GET /me/organizations`
  **ไม่มี** org นั้นในผลลัพธ์ (ค) org อื่นของ user คนเดียวกันยังอยู่ครบและยังใช้งานได้ปกติ

---

## §5 Owner ≥ 1 ภายใต้ concurrency (US-6)

**เคสที่ต้องกัน:** org มี Owner 2 คน · admin สองคนกดพร้อมกัน คนละ tx — "ลด Owner A เป็น Staff" กับ "ถอด Owner B"
→ ต่างฝ่ายต่างเห็นว่า "ยังเหลืออีกคน" → commit ทั้งคู่ → **org เหลือ 0 Owner** (ล็อกตัวเองออกถาวร กู้ไม่ได้จนกว่าจะมี F-085)

| ทางเลือก | ทำไม |
|---|---|
| read-then-write (count owner ก่อน update) | ❌ คือบั๊กที่กำลังพูดถึง |
| unique index / CHECK constraint | ❌ invariant นี้เป็น **cross-row aggregate** (COUNT ≥ 1) — SQL constraint แสดงไม่ได้ |
| trigger นับ owner หลัง update | ❌ ไม่ช่วยกรณี concurrent เพราะสอง tx เห็น snapshot คนละใบ (ReadCommitted) — ได้ 0 อยู่ดี · เป็นได้แค่ตาข่ายกันเคส single-thread |
| `SERIALIZABLE` + retry loop | 🔸 ถูกต้อง แต่ต้องมี retry ทุก call site + error 40001 โผล่สุ่ม = แพงเกินกว่าที่ปัญหานี้สมควรได้ |
| **`SELECT … FOR UPDATE` แถว `Organization` (serialization anchor) — เลือก** | ✅ ทุก tx ที่จะลด owner ต้องคว้า lock เดียวกันก่อน → serialize จริงที่ระดับ DB · กัน **phantom** ด้วย (owner ที่ถูก insert พร้อมกันก็ต้องรอ lock เดียวกัน) · contention จำกัดเฉพาะ operation ที่แตะความเป็นเจ้าของ ซึ่งนาน ๆ ครั้ง |

**รูปที่บังคับ (กลไกอยู่ `packages/db` ไม่ใช่ feature module — bright-line ข้อ 2 + `$queryRaw` ห้ามใน feature module):**

```ts
// packages/db/src/org-lock.ts  (ใหม่ — กลไกล้วน ไม่พึ่ง Nest)
// N-2: ไม่รับ organizationId เป็น argument จาก caller — อ่านจาก ALS ctx เพื่อไม่ให้ล็อกผิดแถว
export async function lockCurrentOrganization(tx, ctx: OrgScopeContext): Promise<void> {
  // ต้องอยู่ใน interactive transaction เสมอ; lock ถูกปล่อยตอน commit/rollback
  // NEW-4: ตั้งเพดานเวลารอ lock ไว้ใน tx นี้ก่อนเสมอ (SET LOCAL = ผลอยู่แค่ tx นี้)
  await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '${ORG_LOCK_TIMEOUT_MS}ms'`);
  await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${ctx.organizationId} FOR UPDATE`;
}
```
*(`SET LOCAL` อยู่ใน helper ตัวเดียวกัน ⇒ **"คำสั่งแรกใน tx คือ `lockCurrentOrganization`" ยังเป็นจริง**
และ U-API-09 ของ qa ไม่ต้องเปลี่ยนรูป — ที่เปลี่ยนคือข้างในของ helper ซึ่งมี unit test ของตัวเอง)*

**operation ที่บังคับต้อง `lockCurrentOrganization` เป็นบรรทัดแรกของ tx (ขยายในรอบ amend #3 — ดู §5.1):**
`PATCH …/members/{userId}` · `DELETE …/members/{userId}` · **`DELETE /orgs/{id}/membership` (leave — D-029)** ·
**`POST /invitations/accept`** · **`POST …/invitations` (create)** · **`POST …/invitations/{id}/link` (reissue)** ·
**`DELETE …/invitations/{id}` (cancel)**
→ หลัง lock จึงคำนวณ `countActiveOwners(after) ≥ 1`; ไม่ผ่าน → `409 LAST_OWNER` (rollback)

> **M-2 · ทุก read/write ในเส้นทางนี้ต้องใช้ `tx` client เท่านั้น:** ถ้า `countActiveOwners` (หรือการอ่าน role
> ปัจจุบันของ target สำหรับ `canAssignRole` §3.2) ถูกยิงด้วย `ORG_PRISMA` นอก tx จะอ่าน **snapshot คนละใบ**
> กับที่ lock คุ้มครองอยู่ = บั๊กเดิมกลับมาทั้งดุ้น และ concurrency test จะผ่านบ้างไม่ผ่านบ้าง (flake ที่ดูเหมือนเทสต์งอแง)
> · บังคับ: service method รับ `tx` เป็น parameter, unit test assert ว่า count/lookup ถูกเรียกด้วย object เดียวกับ `tx`
> ที่ส่งเข้าไป (spy identity) ไม่ใช่ client ที่ inject มา

**operation ที่ไม่ต้อง lock:** `PATCH /orgs/{id}` (ชื่อ/timezone) · `PUT /orgs/{id}/tax-profile` ·
`POST …/tax-profile/reveal` · ทุก read · **`POST /organizations`** (ยังไม่มี org ให้ล็อก — cap overshoot ≤ 1 ตาม §6.3)

### 5.1 ขยายกฎ lock: "แตะ membership/invitation = ต้องคว้า anchor เดียวกัน + ตรวจซ้ำใน tx" *(amend #3)*

**สิ่งที่ qa จับได้ (§18 ข้อ 10 · เคส I-C-04..07) และผมยืนยันว่าเป็นบั๊กของ design จริง ไม่ใช่แค่เทสต์ที่ขาด:**
ร่าง amend #2 ประกาศว่า **accept ไม่ต้อง lock** โดยอ้าง I-9 (accept ไม่แก้ role ของ membership ที่ active อยู่แล้ว
⇒ accept ลด owner ไม่ได้) — ข้ออ้างนั้น**ถูกเฉพาะเรื่อง owner invariant** แต่ **ไม่ครอบ invariant อื่น**:

```
เวลา →   revoke (tx-R)                          accept (tx-A)  [ไม่มี lock ในร่างเดิม]
  1                                             อ่าน invitation = pending, membership = active
  2      lock org · membership → revoked
         invitation(pending ของ email) → cancelled
  3      COMMIT
  4                                             UPDATE membership … (บล็อกอยู่ที่ขั้น 2, ปลดล็อกตอน 3)
                                                → Read Committed: re-evaluate บนแถวเวอร์ชันใหม่แล้ว "เขียนทับ"
                                                → membership กลับเป็น active + invitation = accepted
```
ผลลัพธ์ = **"ทั้งถูกถอด ทั้งกลับเข้ามา"** ซึ่งเป็นสิ่งที่ I-1 (D-028) ตั้งใจปิด — ปิดสำเร็จเชิง *ลำดับเวลา* (`revokedAt >
tokenIssuedAt`) แต่ **ไม่ปิดเชิง *การชนกันแบบขนาน*** เพราะ tx-A ตัดสินใจจาก snapshot ก่อน revoke commit ·
เคส `cancel ‖ accept` และ `reissue ‖ accept (token เก่า)` มีรูปเดียวกันเป๊ะ

**การแก้ (2 กฎ ใช้คู่กันเสมอ):**

1. **anchor เดียวกัน:** ทุก tx ที่ *เขียน* `Membership` หรือ `Invitation` ของ org ต้องเริ่มด้วย
   `lockCurrentOrganization(tx, ctx)` — รวม accept/create-invite/reissue/cancel/leave (ลิสต์ด้านบน) ·
   ผลข้างเคียงที่ได้ฟรี: **ลำดับการคว้า lock เหมือนกันทุกเส้นทาง (Organization → แถวอื่น) ⇒ ไม่มี deadlock ข้ามเส้นทาง**
   (ทางเลือกที่ทิ้ง: ล็อกแถว `Invitation` ก่อนแล้วค่อย `Membership` — ได้ลำดับสวนทางกับ revoke = deadlock 40P01 → 500
   ซึ่ง qa ห้ามไว้ตรง ๆ ใน I-C-10)
2. **ตรวจซ้ำใน tx (re-validate after lock):** ทุกเงื่อนไขที่ใช้ตัดสินใจต้อง **อ่านใหม่ผ่าน `tx` หลังคว้า lock** —
   สำหรับ accept คือ: lookup `Invitation` **ด้วย `tokenHash` เดิมอีกครั้ง** (จับ reissue ที่ rotate ไปแล้ว →
   `404 INVITATION_INVALID`), อ่าน `status` ปัจจุบัน (จับ cancel → `409 INVITATION_CANCELLED`),
   อ่าน `Membership` ปัจจุบัน + `revokedAt` (จับ revoke → `409 INVITATION_SUPERSEDED`) แล้วเรียก
   `canAcceptInvitation()` **อีกครั้ง** ⇒ การอ่านนอก tx มีหน้าที่เดียวคือ **"รู้ว่าเป็น org ไหน"** (§2.4)
   ห้ามใช้ผลนั้นตัดสินใจ

**ราคาที่จ่าย (บันทึกไว้ให้ตรวจสอบได้):** การเขียนที่แตะสมาชิก/คำเชิญของ **org เดียวกัน** ถูก serialize ·
ปริมาณจริง = ระดับ "ครั้งต่อวัน" ต่อ org (เชิญ/ถอด/เปลี่ยนสิทธิ์) ⇒ ยอมรับได้เต็มที่ · **read ทุกเส้นไม่ถูกล็อก**
และ **org อื่นไม่กระทบกันเลย** (lock เป็นแถวของ org นั้น) · ถ้าวันหนึ่งมี write ที่ถี่จริงบนสองตารางนี้
(เช่น bulk import สมาชิก) ให้แยก anchor ต่อ resource ตอนนั้น — **ไม่ optimize ล่วงหน้า**

**mapping เคส concurrency ของ qa → กลไกที่รองรับ (ทุกเคสต้องมีเจ้าของกลไก ไม่ใช่แค่ "เขียนเทสต์เพิ่ม"):**

| เคส (test-plan §8) | กลไกที่ทำให้ผ่าน | ผลที่ contract สัญญาไว้ |
|---|---|---|
| I-C-01 ลด Owner A ‖ ถอด Owner B | org lock + `assertOwnerRemains` ใน tx | 1 สำเร็จ · 1 × `409 LAST_OWNER` |
| I-C-02 accept ‖ accept | org lock + re-validate + `@@unique(organizationId,userId)` | membership 1 แถว · อีกอัน 409 |
| I-C-03 invite ซ้ำขนาน | org lock + partial unique `(orgId,email) WHERE pending` | 1 สำเร็จ · อีกอัน `409 INVITATION_PENDING` (ไม่ใช่ 500) |
| **I-C-04 revoke ‖ accept** | **กฎใหม่ทั้ง 2 ข้อ** (เดิมพัง) | revoke ชนะ → accept ได้ `SUPERSEDED`/`CANCELLED` · accept ชนะ → สุดท้าย membership = `revoked` · **ไม่มีเคส "ทั้งถอดทั้งกลับเข้ามา"** |
| **I-C-05 reissue ‖ accept (token เก่า)** | re-lookup ด้วย `tokenHash` **ใน tx** | `404 INVITATION_INVALID` · ไม่มีช่วงที่ 2 token ใช้ได้พร้อมกัน |
| **I-C-06 cancel ‖ accept** | org lock + อ่าน `status` ใน tx | ไม่มี membership เกิดหลัง cancel commit |
| **I-C-07 `PATCH` ‖ `DELETE` target เดียวกัน** | org lock ทั้งคู่ + ตรวจ `status='active'` ใน tx | serialize · คนที่มาทีหลังได้ `404 NOT_FOUND` (ไม่มี role ถูกเปลี่ยนหลัง revoke) |
| **I-C-08 ยกคนละคนเป็น Owner พร้อมกัน** | org lock (serialize) — invariant ฝั่งเพิ่มไม่ถูกบล็อก | สำเร็จทั้งคู่ · owner = 3 (ไม่มี lost update) |
| **I-C-09 สร้าง org ที่ขอบ cap 49** | **ไม่มี lock โดยเจตนา** (§6.3) | ≤ 51 org · ไม่มี 500 — เอกสารยอมรับ overshoot ≤ 1 อย่างเปิดเผย |
| **I-C-10 revoke ‖ revoke** | org lock + อ่าน `status` ใน tx | 1 × 200 · 1 × **404** (ไม่ใช่ 500) · `revokedAt` เขียนครั้งเดียว |

> **unit test ที่ผูกกฎนี้ไว้กับโค้ด (ไม่ใช่กับความตั้งใจ):** ทุก service method ในลิสต์ต้องถูก assert ว่า
> **คำสั่งแรกใน tx คือ `lockCurrentOrganization`** (spy ลำดับการเรียก — ขยายจาก U-API-09 ที่มีอยู่แล้ว)
> และ accept ต้องถูก assert ว่า **เรียก `canAcceptInvitation` ด้วยข้อมูลที่อ่านผ่าน `tx`** (spy identity — M-2)

> **I-9 · accept ต้องไม่แตะ role ของ membership ที่ active อยู่แล้ว (แก้ตาม security review):**
> ร่างแรกให้ accept เป็น `upsert` ที่เขียนทับ `roleId` ได้ ⇒ accept กลายเป็น operation ที่ **ลด owner ได้**
> (คนที่เป็น Owner คนสุดท้ายกดรับคำเชิญเก่าที่ให้ role Staff → org เหลือ 0 Owner) โดยไม่มี lock ขวาง ·
> ปัจจุบันกันไว้ด้วยการเช็ค `ALREADY_MEMBER` **ตอนสร้างคำเชิญ** ซึ่งเป็น TOCTOU ยาวเท่าอายุคำเชิญ
> **ตัดสิน: เลือกทาง (ข) — accept ที่พบ membership `active` อยู่แล้ว → `409 ALREADY_MEMBER` ไม่แตะ role**
> (แทนทาง (ก) lock+assert) เพราะ (1) ถูกกว่าและอ่านง่ายกว่า (2) ตัดความสามารถ "เปลี่ยน role ผ่านคำเชิญ" ทิ้ง
> ⇒ ปิดทางอ้อมของ C-1 ไปด้วยอีกทาง (3) ทำให้ประโยค "accept ไม่มีทางลด owner" **เป็นจริงเชิงโครงสร้าง**
> ไม่ใช่เชิงความเชื่อ
> · ⚠️ **แก้ใน amend #3:** ประโยคเดิมของย่อหน้านี้จบว่า *"⇒ accept ไม่ต้อง lock จริง ๆ"* — **ข้อสรุปนั้นผิด**
>   และถูกแทนที่ด้วย **§5.1** · ที่ถูกคือ: I-9 ทำให้ accept **ลด owner ไม่ได้** (จริงตามเดิม) แต่ **ไม่ได้** ทำให้ accept
>   ปลอดภัยจากการชนกับ `revoke`/`cancel`/`reissue` ⇒ **accept ต้องคว้า org lock และตรวจเงื่อนไขซ้ำใน tx**
>   (qa เคส I-C-04..06 เป็นคนจับ — ผมยืนยันแล้วว่าเป็นช่องจริง ไม่ใช่เทสต์ที่เข้มเกิน)
> · พร้อมกันนั้น invitation ใบนั้นถูก mark `cancelled` (+`cancelledAt`) ใน tx เดียวกัน เพื่อไม่ให้ค้างเป็น pending
>   ต่ออีกจนหมดอายุ (เลือก `cancelled` ไม่ใช่ `accepted` เพราะไม่มี membership ใดเกิดจากคำเชิญใบนี้ — ถ้า mark
>   `accepted` แล้วตั้ง `acceptedByUserId` จะเป็นการบันทึกประวัติที่ **เท็จ**)
> · unit test: membership active + accept → 409 และ `membership.update` **ไม่ถูกเรียก** · invitation กลายเป็น `cancelled`

**ตัวตัดสิน "ยังเหลือ owner ไหม" เป็น pure fn** — `packages/core-domain/src/orgs/owner-invariant.ts`
`assertOwnerRemains({ owners, change })` พร้อมเมทริกซ์ test: owner คนเดียวลดตัวเอง / ถอดตัวเอง /
**ออกจากร้านเอง (leave — D-029: ใช้ fn ตัวเดียวกัน ไม่มีกฎที่สอง)** / ถอดคนอื่น / มี owner 2 คน /
owner ที่ `revoked` ไม่ถูกนับ / `invited` ไม่ถูกนับ / เปลี่ยน role จาก non-owner → owner

**int test บังคับ (lane `integration-api`):** ยิงขนาน 2 request ที่พยายามลด owner คนละคนใน org ที่มี owner 2 คน
→ ต้องสำเร็จ **1** ล้ม **1** (`LAST_OWNER`) และ `COUNT(active owner) = 1` เสมอ · รันซ้ำ 20 รอบกัน flake

### 5.2 นโยบาย timeout ของ tx ที่คว้า lock (NEW-4 — ไม่มีนโยบายนี้ = คิวรอ lock กิน connection pool ข้าม tenant)

**ช่องที่ delta review จับได้:** §5.1 บังคับ lock ทุก write ที่แตะ membership/invitation แต่ **ทั้งเอกสารชุดนี้ไม่มีคำว่า
`timeout`/`maxWait`/`lock_timeout` เลย** · `POST /invitations/accept` เป็นเส้นที่ **ใครก็ตามที่ถือ token + ล็อกอินแล้ว**
ยิงได้ และตอนนี้มันคว้า row lock ของ org ⇒ คำขอที่รอ lock **ถือ DB connection ค้าง** และ pool เป็นของทั้งแอป
⇒ org เดียวทำให้ทั้งระบบช้า/ล้มได้ (noisy neighbour) · และเมื่อชน lock timeout/deadlock จริง Prisma จะโยน error
ที่ **ยังไม่มีใครแมป** ⇒ **500** ซึ่ง qa ห้ามไว้เองใน I-C-10

**นโยบายที่ตัดสิน (ค่าเป็น constant ใน `packages/config` + env-tunable, export เป็น `ORG_TX_TIMEOUTS`):**

| พารามิเตอร์ | ค่า | บังคับที่ไหน | ทำไมค่านี้ |
|---|---|---|---|
| `ORG_LOCK_TIMEOUT_MS` (Postgres `lock_timeout`) | **3,000 ms** | `SET LOCAL` ใน `lockCurrentOrganization` | เวลารอ lock ที่ยาวกว่านี้ = คำขอที่ผู้ใช้ละทิ้งไปแล้ว · ต้อง **น้อยกว่า** `timeout` ของ tx เพื่อให้ได้ error ที่ **แมปได้** (`55P03`) แทนที่จะไปตายที่ tx timeout ซึ่งกำกวมกว่า |
| Prisma `timeout` (อายุสูงสุดของ interactive tx) | **5,000 ms** | argument ของ `$transaction` ทุกเส้นในลิสต์ §5 | งานจริงในนี้คือ 3–6 query บน index ⇒ ปกติ < 20 ms · 5 s คือ "พังแน่แล้ว" ไม่ใช่ "ช้า" |
| Prisma `maxWait` (เวลารอ connection จาก pool) | **2,000 ms** | argument เดียวกัน | จำกัดคิวหน้า pool ไม่ให้คำขอกองจนทั้ง instance หยุดตอบ — ล้มเร็วดีกว่าล้มพร้อมกันทั้งระบบ |
| `connection_limit` ของ pool | **ค่าเป็นของ @devops** (§12.3) | `DATABASE_URL` | ต้อง ≥ จำนวน request ขนานที่เทสต์ concurrency ยิง (ไม่งั้น "ขนานปลอม" — qa Q9) |

**พฤติกรรมเมื่อ timeout (ห้ามให้ผู้ใช้เห็น 500 — บังคับด้วยเทสต์):**

| อาการจริง | Postgres/Prisma | ผลที่ต้องคืน |
|---|---|---|
| รอ row lock นานเกิน `lock_timeout` | `55P03 lock_not_available` (Prisma `P2034`/raw) | **`409 CONFLICT`** + `details.reason = "busy"` |
| deadlock | `40P01 deadlock_detected` | **`409 CONFLICT`** + `details.reason = "busy"` + **log ระดับ `error` + metric** (ตามการออกแบบ §5.1 ลำดับคว้า lock เหมือนกันทุกเส้น ⇒ **deadlock = สัญญาณว่ามีคนเขียน tx ที่ไม่ทำตามกติกา** ไม่ใช่เรื่องปกติ) |
| tx เกิน `timeout` / รอ connection เกิน `maxWait` | `P2028` / pool timeout | **`409 CONFLICT`** + `details.reason = "busy"` |

- **ทำไม `409 CONFLICT` ไม่ใช่ `503`:** ทุก endpoint ในลิสต์ §5 **ประกาศ `409` ไว้ในสัญญาอยู่แล้ว** (api-spec §3.8/§3.9/
  §3.11/§3.12/§3.13/§3.15/§3.17) ⇒ ไม่มี status ใหม่โผล่บนเส้นใด · `503` จะเป็นการ **เพิ่ม status ที่ไม่เคยประกาศ**
  บน endpoint ที่ contract **LOCKED** แล้ว · และ `ORG_PROVISIONING_UNAVAILABLE` (503 เดียวของ F-002) มีความหมายอื่น
  ⇒ ใช้ code `CONFLICT` ที่มีอยู่แล้ว **ไม่เพิ่ม code ใหม่** (registry ยังเป็น 18 code ใหม่ตามที่ qa pin ไว้ที่ U-API-15)
- **`details.reason = "busy"` คือสิ่งเดียวที่แยกมันออกจาก 409 ปกติ** — `details` เป็น field optional ที่มีอยู่ในซองแล้ว
  ⇒ additive ล้วน · client **ไม่ต้อง** รู้จักก็ยังทำงานถูก (เห็นเป็น Conflict → แสดงข้อความ + ให้ลองใหม่)
- **ยืนยันว่าไม่แตะ schema:** `error.code` ในสัญญาเป็น **string จาก registry กลาง ไม่ได้ enumerate รายเส้นใน OpenAPI**
  (`ErrorEnvelope` ตัวเดียวใช้ทุก endpoint — F-001 as-built) ⇒ การที่เส้นหนึ่งเริ่มคืน `CONFLICT` ได้
  **ไม่เปลี่ยน schema แม้แต่ byte เดียว** และ `oasdiff` เงียบ · สิ่งที่เปลี่ยนคือ *ความหมาย* ⇒ ขึ้นทะเบียนที่ท้าย §15
- **ห้าม retry อัตโนมัติที่ server** — write เหล่านี้ยังไม่มี `Idempotency-Key` (F-011) ⇒ retry เงียบ = เสี่ยงทำซ้ำ ·
  การลองใหม่เป็นการตัดสินใจของผู้ใช้/client (ux มี toast + ปุ่มลองใหม่อยู่แล้วสำหรับ Conflict)
- **metric + log:** `org_tx_lock_timeout_total{operation,reason}` + log บรรทัดเดียวกับ `traceId` ของ request นั้น
  ⇒ ถ้าค่านี้ขยับ = มี hot org จริง ค่อยไปแยก anchor ต่อ resource (ตาม §5.1 "ไม่ optimize ล่วงหน้า")
- **เคสที่ขอให้ qa เพิ่ม (1 เคส ตามที่ reviewer ระบุ):** ยึด lock ค้างไว้ใน tx หนึ่ง (`pg_sleep` ที่ฝั่งเทสต์)
  แล้วยิงอีก request ของ **org เดียวกัน** → ต้องได้ **409 ไม่ใช่ 500 และไม่ค้างเกิน ~3 s** · เคสควบคุม: request
  ของ **org อื่น** ในเวลาเดียวกัน → ต้อง **200 ตามปกติ** (พิสูจน์ว่า lock ไม่ข้าม tenant)

---

## §6 สร้าง org แบบ atomic + plan provisioning (US-1)

### 6.1 หนึ่ง transaction ได้ทั้งหมด (ไม่มีสถานะครึ่ง ๆ)

```
cap check (ก่อนเข้า tx — §6.3): นับ org ที่ user เป็นสมาชิก active ≥ MAX_ORGS_PER_USER → 409 ORG_LIMIT_REACHED
resolve plan (ก่อนเข้า tx): อ่าน PlanDefinition ตาม provisioning source (§6.2) — ไม่พบ → 503 ล้มก่อนเริ่ม
tx (SYSTEM_PRISMA — §2.4):
  1. INSERT Organization     (name, timezone=Asia/Bangkok, currency=THB)
  2. INSERT Role × 3         (Owner[full_access, isSystem=true] / Admin / Staff)
  3. INSERT Membership       (userId=ผู้สร้าง, roleId=Owner, status=active)
  4. INSERT OrgEntitlement   (organizationId, planDefinitionId)      ← invariant: org ผูก plan เสมอ
  5. INSERT Warehouse        (name="คลังหลัก", isDefault=true)        ← Phase 0 = คลังเดียว
commit → emit security event org.created (post-commit)
```

- ล้มขั้นไหนก็ตาม = **ไม่มี org เกิดขึ้นเลย** → ไม่มีทางมี org ที่ไม่มี Owner / ไม่มี entitlement / ไม่มีคลัง
- ไม่ใช้ nested write (§2.2) — insert ตามลำดับใน tx เดียว
- `Warehouse` ได้ **partial unique index** `(organizationId) WHERE isDefault` → "org หนึ่งมี default ได้ใบเดียว" เป็นกฎระดับ DB

### 6.2 plan มาจากไหนใน Phase 0 (AC US-1: ไม่แจก free อัตโนมัติ)

- **client ส่ง plan ไม่ได้เด็ดขาด** — `POST /organizations` ไม่มี field plan (กัน self-grant Full tier)
- server resolve ผ่าน seam เดียว `PlanProvisioningService.resolveForNewOrg({ userId })`
  - **Phase 0 (dogfood):** อ่าน key จาก env `DEFAULT_ORG_PLAN_KEY` (**ค่า** เป็นของ @devops; dogfood ตั้งใจให้เป็น `comp_full`)
  - **F-080/F-082:** เปลี่ยน implementation ของ seam นี้เป็น "อ่านจาก license/subscription ที่ซื้อ" — call site ไม่ต้องแก้
- `PlanDefinition` seed ผ่าน `packages/db/prisma/seed.ts` (`comp_full` / `full` / `sync` / `free`) — [data-model §5](data-model.md)
- **fail closed:** env ไม่ได้ตั้ง หรือหา `PlanDefinition` ตาม key ไม่เจอ → `503 ORG_PROVISIONING_UNAVAILABLE`
  **ห้าม fallback เป็น free เงียบ ๆ** (= การแจก plan โดยไม่ได้ตั้งใจ = ผิด AC)

### 6.3 cap จำนวน org ต่อ user — บังคับที่ service แบบ fail-closed (I-10)

§10 ประกาศ capacity bound "org ต่อ user ≤ 50" โดยมี "ตัวคุม = rate limit 10/ชม." — **ไม่จริง**:
10/ชม. = 240/วัน (ไม่ใช่ cap) และ §8 ประกาศ rate limit เป็น **fail-open** เมื่อ Redis ล่ม ⇒ ตอน Redis ล่มไม่มีอะไรคุมเลย
ประกอบกับยังไม่มี `Idempotency-Key` (F-011) และ **ไม่มี endpoint ลบ org** ⇒ org ขยะที่เกิดขึ้นล้างไม่ได้

- **กติกา (แก้ 2026-08-08 · security review A-6):** `POST /organizations` นับ
  `organization.count({ where: { createdByUserId: userId } })` **ก่อนเข้า tx**
  (`SYSTEM_PRISMA`, §2.4) — `>= MAX_ORGS_PER_USER` → **`409 ORG_LIMIT_REACHED`**
- ⚠️ **นี่คือ quota ของการ *สร้าง* ไม่ใช่ bound ของจำนวน membership** — ถ้อยคำเดิมของหัวข้อนี้บอกว่า
  "ผู้ใช้หนึ่งคนถือ active membership ได้ไม่เกิน 50" ซึ่ง**ไม่เคยจริง**: `POST /invitations/accept` สร้าง membership
  โดยไม่นับ และจะไม่นับต่อไปโดยเจตนา
- **ทำไม accept ไม่ถูก cap:** ภัยที่ I-10 พูดถึงคือ *"user คนเดียวยิง `POST /organizations` รัว ๆ ตอน Redis ล่ม"*
  — การสร้างเป็น**ฝ่ายเดียว** (คนเดียว request เดียว ไม่ต้องขอใคร) · การ accept ต้องมีผู้ถือ `manage_members`
  ของ**ร้านอื่น**ออกคำเชิญก่อน ⇒ ไม่ใช่คันโยกที่ผู้โจมตีคนเดียวดึงได้ · การ cap มันจะบล็อกผู้รับทำบัญชีที่ดูแล SME
  หลายสิบรายจริง ๆ โดยไม่ปิดช่องอะไรเลย
- **ทำไมเลิกนับ membership:** การนับแบบเดิมผิดสองทาง — (ก) คำเชิญของคนอื่นกิน quota ของเรา
  (ข) นับเฉพาะ `active` ⇒ **เสีย membership แล้วได้ quota คืน** ⇒ สร้างจนเต็ม cap → ให้ผู้สมรู้ร่วมคิดที่เราเชิญเป็น Owner
  ถอดเราออก (last-Owner guard ยอม เพราะยังเหลือ Owner 1 คน) → ทำซ้ำ · **ผู้สมรู้ร่วมคิด 1 คน = สร้างได้ไม่จำกัด**
  ในขณะที่ org ทุกใบยังอยู่ ซึ่งคือภัยเดียวกับที่ I-10 ต้องการกันพอดี
- `MAX_ORGS_PER_USER` = **50** — ✅ **ยืนยันโดย D-029 (3)** — เป็น constant ในโค้ด
  + override ได้ผ่าน env `MAX_ORGS_PER_USER` (optional, default 50) เพื่อให้ dogfood ปรับได้โดยไม่ต้อง deploy ใหม่
- **fail-closed จริง:** ถ้า count query ล้ม = ไม่สร้าง org (ไม่ใช่ "ปล่อยผ่านเพราะนับไม่ได้") — ต่างจาก rate limit โดยเจตนา
- ยังมีช่องเล็ก ๆ ที่ยอมรับ: กด 2 request พร้อมกันตอนอยู่ที่ 49 อาจได้ 51 (ไม่มี lock) — **ยอมรับ** เพราะสิ่งที่ cap นี้
  กันคือ "หลายพันใบ" ไม่ใช่ "เกินหนึ่งใบ" · ถ้าวันหนึ่งต้องแม่นระดับใบ ให้ใช้ advisory lock ต่อ user (บันทึกไว้เฉย ๆ)
- rate limit 10/ชม. **ยังอยู่** ในฐานะ abuse control ชั้นหน้า และยัง fail-open ได้ตามนโยบายเดิม เพราะไม่ใช่ชั้นที่บังคับ invariant อีกต่อไป
- int test: user ที่**สร้าง** 50 org → ใบที่ 51 = 409 · user ที่ถูก**เชิญ**เข้า 50 ร้านแต่ยังไม่เคยสร้าง → สร้างได้
  · user ที่สร้างแล้วถูกถอดออกจากร้านนั้น → **ไม่ได้ quota คืน** (ปิดลูปข้างบน)

### 6.4 env ใหม่ต้องเข้า zod schema ของ `packages/config` (M-5)

repo นี้ fail-closed ที่ boot ผ่าน `packages/config/src/env.ts` (`loadEnv` → `process.exit(1)`) — env ใหม่ของ F-002
**ต้องเข้า schema เดียวกันนี้ ไม่ใช่แค่ "ฝากบอก @devops"**:

| var | rule ใน zod | ทำไม |
|---|---|---|
| `INVITATION_TOKEN_SECRET` | `.string().min(32)` + `.refine` ว่า **ต่างจาก `JWT_ACCESS_SECRET` และ `JWT_REFRESH_SECRET` ทั้งคู่** | key separation (§7.3) — ถ้าใช้ค่าเดียวกับ auth การรั่วของฝั่งหนึ่งลามอีกฝั่งทันที · รูปเดียวกับ `.refine` ที่มีอยู่แล้วสำหรับ access≠refresh |
| `WEB_APP_BASE_URL` | `.string().url()` + `.refine(v => v.startsWith('https://'))` (ยกเว้น `NODE_ENV=development` ที่ยอม `http://localhost`) | ประกอบ `inviteUrl` — ถ้าเป็น http/โดเมนผิด = ส่งลิงก์คำเชิญไปที่ที่ไม่ควร |
| `DEFAULT_ORG_PLAN_KEY` | `.string().min(1)` **required ไม่มี default** | §6.2 ห้าม fallback เงียบ ๆ — ไม่ตั้ง = boot ไม่ขึ้น ดีกว่าแจก plan ผิด |
| `MAX_ORGS_PER_USER` | `.string().regex(/^\d+$/).default("50")` | §6.3 |
| `ORG_RATE_LIMIT_*` (§8) | `.regex(/^\d+$/)` + default ตามตาราง §8 | ปรับโควตาได้โดยไม่ deploy |

- **ผลข้างเคียงของการ rotate `INVITATION_TOKEN_SECRET` (ต้องรู้ตัวก่อนทำ):** `tokenHash` คำนวณจาก secret ⇒
  เปลี่ยน secret = **คำเชิญที่ค้างอยู่ทุกใบใช้ไม่ได้ทันทีและเงียบ** (ผู้ถูกเชิญเห็น `404 INVITATION_INVALID`
  เหมือน token มั่ว) · ไม่มี migration ให้ทำเพราะ hash ย้อนกลับไม่ได้ · **ขั้นตอนที่กำหนดไว้:** ก่อน rotate ให้
  (1) ยกเลิก pending invitation ทั้งหมด (2) แจ้ง Owner/Admin ให้ออกลิงก์ใหม่ · ถ้าจำเป็นต้อง rotate โดยไม่ทำลาย
  คำเชิญค้าง ต้องออกแบบ dual-secret (คำนวณ 2 hash ตอน lookup) ซึ่ง **ไม่อยู่ใน F-002**
- unit test ของ `packages/config`: ครบทุกแถว (ขาด → exit non-zero, `INVITATION_TOKEN_SECRET` = ค่าเดียวกับ JWT → ล้ม,
  `WEB_APP_BASE_URL` เป็น http ใน production → ล้ม)

---

## §7 Invitation lifecycle — D-018 (hash-at-rest) ปะทะ D-012 (copy link)

### 7.1 ความขัดแย้งจริง

- **D-018 (required, ผูกกับ F-002 Gate 2):** `Invitation.token` วันนี้เป็น **raw + `@unique`** → ต้อง hash-at-rest
  แนวเดียวกับ `RefreshToken.tokenHash` **ก่อนโค้ดใดเขียน invitation จริง**
- **D-012 + AC US-3 (ถ้อยคำ *ก่อน* D-027):** "re-send = เรียกดู/copy ลิงก์ของคำเชิญที่ค้างได้อีก (**token/อายุเดิม**)"
  — ถ้อยคำนี้ถูกแก้แล้วโดย D-027 (ดู §7.2); เก็บไว้ตรงนี้เพื่อให้เห็นที่มาของการตัดสิน
- hash เป็น one-way → **อ่าน token เดิมกลับมาไม่ได้** → สองข้อนี้อยู่ด้วยกันไม่ได้ตามตัวอักษร

### 7.2 ทางเลือกที่เทียบจริง

| # | ทางเลือก | ได้ | เสีย |
|---|---|---|---|
| **1 (เลือก · D-027)** | **hash-at-rest + ปุ่ม "ออกลิงก์ใหม่" ที่ rotate token และ *นับอายุใหม่* จากเวลาที่ออกลิงก์** | ทำตาม D-018 เต็ม · เจตนา AC ("ส่งลิงก์ให้คนนั้นได้อีก") ยังอยู่ · ลิงก์เก่าที่หลุดในแชตตายทันที = ดีต่อความปลอดภัย | ผิดถ้อยคำ AC เดิม ("token เดิม") · ถ้าเจ้าของเผลอกดออกลิงก์ใหม่หลังส่งไปแล้ว ลิงก์เดิมใช้ไม่ได้ → **UX ต้องเตือนก่อนกด** และปุ่มควรอ่านว่า "ออกลิงก์ใหม่" ไม่ใช่ "คัดลอกลิงก์" |
| 2 | เก็บ token แบบ **เข้ารหัสย้อนกลับได้** (AES-256-GCM, key จาก env — แนว TokenVault) | ตอบ AC ตามตัวอักษร 100% (คืน token เดิมได้) · ยังดีกว่า raw ที่เป็นอยู่มาก | **ไม่ใช่ hash-at-rest** ตามที่ D-018 สั่ง · key รั่ว = token ทุกใบรั่ว · เพิ่ม key management ชุดใหม่ (rotate/backup) ที่ยังไม่มีเจ้าภาพ |
| 3 | คืน token เฉพาะตอนสร้าง (one-time reveal) ไม่มีปุ่ม re-copy | ปลอดภัยที่สุด | ตัด "re-send ได้" ออกจาก AC ตรง ๆ · ทำลิงก์หาย = ต้องยกเลิก + เชิญใหม่ |
| 4 | hash + เก็บ plaintext ใน Redis TTL สั้น | ตอบ AC ได้ในกรอบเวลาสั้น | plaintext ยังนอน at rest (แค่ย้ายที่) · ซับซ้อนขึ้นโดยไม่ได้ความปลอดภัยจริง |

**เลือก #1** เพราะ D-018 เป็น decision ที่เจาะจงลงมาที่ F-002 โดยตรงและมาทีหลัง · ราคาที่จ่ายคือ **copy/UX**
(เตือนก่อน rotate) ไม่ใช่ความสามารถที่หายไป — Owner/Admin ยังส่งลิงก์ให้คนที่เชิญได้ไม่จำกัดครั้ง

✅ **เคาะแล้ว: D-027** — user รับทาง #1 และ **เลือกให้ "อายุนับใหม่จากเวลาที่ออกลิงก์"** (เดิมผมเสนอ "คงอายุเดิม")
เหตุผลที่ user/product ให้: สอดคล้องกับ reissue ตอนคำเชิญหมดอายุใน §7.4 ซึ่งออกอายุใหม่อยู่แล้ว และเลี่ยงเคส
"ออกลิงก์ใหม่แล้วเหลืออายุ 4 ชั่วโมง" ที่ผู้ใช้ไม่มีทางรู้ · **ผลด้านความปลอดภัยที่ต้องรับ:** ผู้เชิญยืดอายุคำเชิญได้
ไม่จำกัดด้วยการกดออกลิงก์ใหม่ซ้ำ ๆ — คุมด้วย (ก) rate limit 60/ชม./org (§8) (ข) ทุกครั้ง emit
`org.invitation.link_reissued` (§9) (ค) **TTL ของ role สูงสั้นลงเหลือ 24 ชม.** (§7.5) ⇒ คำเชิญที่อันตรายที่สุดยืดได้ทีละ 24 ชม.
(หมายเหตุ: security-review §E ข้อ 3 สนับสนุน "rotate แทน AES ย้อนกลับได้" — ส่วนนั้น **ไม่ถูกรื้อ**; D-027 แก้เฉพาะ
เรื่องอายุที่นับใหม่ ซึ่งเป็นการตัดสินของ user)

### 7.3 กลไก token + การเดินทางของ token (I-6)

- ค่า token = `randomBytes(32).toString("base64url")` (256-bit) — รูปแบบเดียวกับ `generateRefreshTokenValue()` ของ F-001
- เก็บ `tokenHash = HMAC-SHA-256(INVITATION_TOKEN_SECRET, token)` **unique** — keyed hash แบบเดียวกับ refresh token
  (DB dump อย่างเดียวยืนยัน token ไม่ได้) · **แยก secret คนละตัวกับ auth** (key separation) → env + zod schema ที่ §6.4
- lookup = คำนวณ HMAC ของค่าที่ส่งมา แล้ว `findUnique({ tokenHash })` → O(1) และไม่มี timing leak จากการค้น
- `inviteUrl` ที่ API คืน = `${WEB_APP_BASE_URL}/invite?token=…` — คืนทั้ง `token` และ `inviteUrl`
  เพื่อให้ web/mobile ไม่ต้องประกอบ URL เอง (คนละ base = drift)

> **I-6 · token คือความลับตัวเดียวที่กันคนนอกออกจาก org — ห้ามให้มันเดินทางใน query string ของ API:**
> ร่างแรกใช้ `GET /invitations/preview?token=…` ⇒ token ค้างใน access log / proxy log / browser history และหลุด
> ผ่าน `Referer` ถ้าหน้านั้นโหลด resource ข้าม origin (font/analytics/รูป) · หนักขึ้นเพราะ Phase 0 accept ไม่มีการ
> ยืนยัน email จริง (§7.6) ⇒ ใครได้ token = ยึดคำเชิญได้
>
> | มาตรการ | เจ้าของ | รายละเอียด |
> |---|---|---|
> | **`POST /invitations/preview` รับ token ใน body** (แทน GET + query) | @backend-api | ยัง `@Public()` + rate-limited ต่อ IP เหมือนเดิม · ไม่ cache ได้โดยธรรมชาติ |
> | **ห้าม log query string ของ `/invitations/*`** | @backend-api (+@devops ที่ชั้น proxy) | pino redact path/query ของ prefix นี้ + ห้าม log body ของ preview/accept ทั้งก้อน · มี unit test บน logger config |
> | **`Cache-Control: no-store` + `Referrer-Policy: no-referrer`** บน response ที่มี token/email/TIN | @backend-api | ครอบ §3.11/§3.12/§3.14/§3.15 + endpoint ที่คืน email (M-11) |
> | หน้าเว็บ `/invite?token=…` อ่าน token แล้ว `history.replaceState` ถอดออกจาก URL ทันที + เก็บใน memory ไม่ใช่ localStorage | **@frontend** (★-task, security-reviewer ต้อง review) | ลิงก์ที่ผู้ใช้เปิดยังเป็น URL อยู่ (จำเป็น — ต้อง copy ส่งได้) — ลดเวลาที่มันอยู่ใน URL bar ให้สั้นที่สุด |
>
> **ที่ยังเหลือความเสี่ยงโดยยอมรับ:** ตัวลิงก์ที่ผู้เชิญ copy ไปส่งใน LINE/แชต **ยังมี token ใน URL เสมอ**
> (นี่คือแก่นของ D-012 ไม่ใช่บั๊ก) — ปิดจริงเมื่อมี SMTP (F-081) แล้วส่งลิงก์ถึงเจ้าของ email โดยตรง

### 7.4 Lifecycle + edge cases

```
create   POST /orgs/{id}/invitations {email, roleId}
         → normalizeEmail (core-domain, lowercase+trim — ตัวเดียวกับ F-001)
         → role ที่เชิญมี full_access และผู้เรียกไม่มี full_access → 403 FORBIDDEN   (C-1 · canAssignRole §3.2)
         → เป็นสมาชิก active อยู่แล้ว       → 409 ALREADY_MEMBER
         → มี pending ที่ยังไม่หมดอายุ       → 409 INVITATION_PENDING + details.invitationId  (D-027 — ให้ UI เสนอ
                                              "ออกลิงก์ใหม่"/"ยกเลิก" ได้ทันที ไม่ปล่อยผู้ใช้ตัน)
         → มี pending ที่หมดอายุแล้ว         → reissue บนแถวเดิม (token ใหม่ + expiresAt ใหม่ + roleId ตามที่ส่ง)
         → membership เดิม status=revoked   → เชิญใหม่ได้ (คำเชิญ *ใบใหม่* ที่ออกหลังถูกถอดเท่านั้น — I-1)
         → cap: นับเฉพาะ pending && expiresAt > now (M-3) ≥ 100 → 409 INVITATION_LIMIT_REACHED
         → expiresAt = now + ttl(role)  (7 วัน / 24 ชม. — §7.5)
         → คืน { invitation, token, inviteUrl }
reissue  POST /orgs/{id}/invitations/{invId}/link
         → [ใน tx บรรทัดแรก] lockCurrentOrganization(tx, ctx)                        (§5.1)
         → [ใน tx] อ่านคำเชิญ + role.capabilities ซ้ำ แล้ว canAssignRole(...)          (NEW-2 · §3.2)
                   role ของคำเชิญมี full_access และผู้เรียกไม่มี → 403 FORBIDDEN
         → คำเชิญไม่ได้อยู่สถานะ pending (cancelled/accepted) → 409 CONFLICT
         → rotate token, **expiresAt = now + ttl(role)** (D-027 · คำนวณจาก capability ใหม่ทุกครั้ง — §7.5),
           tokenIssuedAt = now, คืน { token, inviteUrl, expiresAt }
           (คำเชิญที่ **หมดอายุแล้ว** ยัง reissue ได้ — เหตุผลที่ไม่ปิด → §3.2 ท้าย NEW-2)
cancel   DELETE /orgs/{id}/invitations/{invId}     → status=cancelled (soft, เก็บประวัติ)
expire   ไม่มี job — expired เป็น **derived** (pending && expiresAt < now) ตอนอ่าน/ตอน accept
preview  POST /invitations/preview {token}   (public, rate-limited, no-store — I-6)
         → { organizationName, roleName, emailMasked, expiresAt, status }
accept   POST /invitations/accept {token}   (ต้อง login แล้ว · ไม่มี org context — I-3)
         → [นอก tx] lookup invitation ด้วย tokenHash ผ่าน SYSTEM_PRISMA — **ใช้เพื่อรู้ organizationId เท่านั้น**
         → OrgContextStore.run({ organizationId: inv.organizationId }) → เปิด tx
         → [ใน tx บรรทัดแรก] lockCurrentOrganization(tx, ctx)                       (§5.1 — amend #3)
         → [ใน tx] lookup invitation ด้วย tokenHash **ซ้ำ** + อ่าน membership ปัจจุบัน แล้วตัดสินใหม่ทั้งหมด
                   (rotate ไปแล้ว → 404 INVITATION_INVALID · cancel แล้ว → 409 · revoke แล้ว → 409 SUPERSEDED)
         → email ผู้ใช้ ≠ invitation.email → 403 INVITATION_EMAIL_MISMATCH
         → roleId ของคำเชิญถูกลบไปแล้ว / ไม่ใช่ role ของ invitation.organizationId
                                           → 409 INVITATION_ROLE_UNAVAILABLE  (M-6)
         → membership เดิม status=active   → 409 ALREADY_MEMBER + mark invitation cancelled  (I-9)
         → membership เดิม status=revoked && revokedAt > invitation.tokenIssuedAt
                                           → 409 INVITATION_SUPERSEDED       (I-1 ข้อ ข)
         → tx: create/update Membership(active, roleId ตาม invitation, activatedAt=now)
               + invitation.status=accepted (+acceptedByUserId/acceptedAt/acceptedUserCreatedAt)
         → event: org.invitation.accepted · ถ้าเป็นการปลุก membership ที่ revoked → **org.member.reactivated เพิ่มอีกใบ**
```

> **I-1 · ถอดสมาชิกแล้วต้องไม่มีทางกลับเข้ามาด้วยคำเชิญค้าง (แก้ตาม security review · D-028):**
> ร่างแรกไม่มีใครยกเลิกคำเชิญตอนถอดสมาชิก ⇒ Admin ที่รู้ตัวว่ากำลังจะถูกถอด ออกคำเชิญให้ email ตัวเอง/พวกไว้ล่วงหน้า
> แล้วกดรับหลังถูกถอด = **การถอดไม่มีผลจริงตลอดอายุคำเชิญ** และ Owner ไม่เห็นสัญญาณอะไรเลย
> **มาตรการ 3 ชั้น (บังคับทั้งหมด):**
> 1. **`DELETE /orgs/{id}/members/{userId}` ต้องยกเลิกคำเชิญ `pending` ของ email นั้นใน org เดียวกัน — ใน tx เดียวกัน**
>    (`invitation.updateMany({ where:{ email: <email ของ target>, status:'pending' }, data:{ status:'cancelled', cancelledAt } })`
>    · `organizationId` มาจาก org scope อัตโนมัติ) — คนละ tx = มี window ให้ accept แทรก
> 2. **accept ปฏิเสธคำเชิญที่ออกก่อนการถอด**: มี membership `revoked` ที่ `revokedAt > invitation.tokenIssuedAt`
>    → `409 INVITATION_SUPERSEDED` ("คำเชิญนี้ออกก่อนที่คุณจะถูกถอดจากองค์กร — ต้องขอคำเชิญใหม่")
>    · เทียบกับ **`tokenIssuedAt` ไม่ใช่ `createdAt`** โดยเจตนา: การกด "ออกลิงก์ใหม่" หลังถอด = การเชิญกลับอย่างตั้งใจ
>      ซึ่งควรใช้ได้ (และ rotate = ผู้มี `manage_members` ตัดสินใจใหม่แล้ว)
> 3. **การปลุก membership กลับต้องเห็นได้**: emit `org.member.reactivated` **แยกใบ** ไม่กลืนใน `invitation.accepted` (§9)
> · int test: revoke → pending invite ของคนนั้นกลายเป็น `cancelled` ทันที · accept ด้วย token เก่า → 409 · เชิญใหม่หลังถอด → accept ได้ + มี event reactivated

### 7.5 TTL ตาม role — คำเชิญที่ให้อำนาจสูงต้องอายุสั้น (D-028 · I-7)

```ts
// packages/core-domain/src/orgs/invitation-policy.ts  (pure fn)
invitationTtlHours(roleCapabilities: readonly string[]): 24 | 168
// มี 'full_access' หรือ 'manage_members' → 24 ชม. · ที่เหลือ → 168 ชม. (7 วัน)
```

- ใช้ทั้งตอน **create** และตอน **reissue** (`expiresAt = now + ttl`) — ทั้งสองเส้นเรียก fn เดียวกัน
- **เกณฑ์เป็น capability ไม่ใช่ชื่อ role** (เหตุผลเดียวกับ §3.2) ⇒ F-003 สร้าง custom role ที่มี `manage_members`
  ก็ได้ TTL 24 ชม. อัตโนมัติโดยไม่ต้องแก้โค้ด
- UI ต้องแสดงวันหมดอายุจริงเสมอ (อย่า hardcode "7 วัน" ใน copy — จะโกหกสำหรับ role สูง) → บันทึกเป็นข้อกำหนดให้ ux

### 7.6 Threat model — **Phase 0 ยืนยัน email ไม่ได้** (I-7 · D-028)

**ข้อเท็จจริง as-built (ไม่ใช่การคาดเดา):** `POST /auth/signup` เขียน `verified: false` และ **login ไม่เคยเช็ค
`User.verified`** (`apps/api/src/auth/auth.service.ts`) · ไม่มี SMTP/flow ยืนยัน email จนถึง **F-081**

⇒ **การผูกคำเชิญกับ email (`normalizeEmail(user.email) === invitation.email`) เป็น defense-in-depth ไม่ใช่ control**:
ใครก็ตามที่ได้ลิงก์ สามารถ **สมัครบัญชีด้วย email ของผู้ถูกเชิญ** แล้ว accept ได้ทันที (preview คืน `emailMasked`
ซึ่งช่วยให้เดา email เต็มได้ง่ายขึ้นเมื่อรู้โดเมนบริษัท) · เขียนไว้ตรงนี้เพื่อไม่ให้ใครในทีมเข้าใจผิดว่า
"คำเชิญปลอดภัยเพราะผูกกับ email แล้ว"

**compensating control ที่ F-002 ทำจริง (ตาม D-028):**

| control | อยู่ที่ |
|---|---|
| TTL 24 ชม. สำหรับ role ที่มี `full_access`/`manage_members` (คำนวณใหม่ทุกครั้งที่ reissue) | §7.5 |
| Owner-only สำหรับการเชิญด้วย role Owner **และการออกลิงก์ใหม่ของคำเชิญ role Owner** *(ปิด NEW-2 — เดิมอ้อมได้ทาง reissue)* | §3.2 |
| token ไม่เดินทางใน query string ของ API + ไม่ถูก log | §7.3 |
| เก็บ `acceptedByUserId` + `acceptedUserCreatedAt` ⇒ ตอบได้ว่า **บัญชีที่รับถูกสร้างก่อนหรือหลังคำเชิญ** | data-model §2 · event §9 |
| ผู้เชิญเห็นในรายการคำเชิญว่า **ใครรับไปแล้วเมื่อไหร่** (+ ธง "บัญชีถูกสร้างหลังออกลิงก์") | api-spec §3.10 |
| rate limit preview/accept ต่อ IP | §8 |

> **NEW-9 · ธง forensic ต้องไม่ถูกล้างด้วยการกดปุ่ม (แก้ตาม delta review):** ร่างเดิมคำนวณ
> `acceptedUserCreatedAfterInvite` โดยเทียบ `User.createdAt` กับ **`tokenIssuedAt`** — ซึ่ง **rotate เขียนทับเป็น `now`**
> (D-027) ⇒ ผู้ที่สมัครบัญชีด้วย email ที่ถูกเชิญ เพียง *ขอให้ผู้เชิญกด "ออกลิงก์ใหม่"* ก็ทำให้ธงกลายเป็น `false`
> (ดูเหมือนบัญชีมีมาก่อน) = สัญญาณเดียวที่เรามีใน Phase 0 ถูกล้างโดยการกระทำที่ดูปกติที่สุด
> **แก้:** ธงนี้คำนวณจาก **`Invitation.createdAt`** (เวลาที่คำเชิญ *ใบนี้* ถูกสร้างครั้งแรก — rotate ไม่แตะ) ⇒
> `acceptedUserCreatedAfterInvite = acceptedUserCreatedAt > invitation.createdAt`
> · **ไม่เพิ่มคอลัมน์ `firstIssuedAt`** เพราะ `createdAt` ให้ความหมายเดียวกันอยู่แล้วและ reissue-on-expired ก็ยัง
> ทำบนแถวเดิม (§7.4) ⇒ `createdAt` = "ครั้งแรกที่เชิญ email นี้เข้ารอบนี้"
> · ⚠️ **ไม่กระทบกฎ I-1:** การตัดสิน `INVITATION_SUPERSEDED` ยังเทียบ `revokedAt` กับ **`tokenIssuedAt`** ตามเดิม
> (เจตนาต่างกัน: ที่นั่นต้องการ "ผู้มีสิทธิ์ตัดสินใจใหม่หลังถอด" — ที่นี่ต้องการ "เวลาที่เร็วที่สุดที่ลิงก์มีอยู่จริง")
> · **wire:** `acceptedUserCreatedAfterInvite` เป็น field เดิม ชนิดเดิม — เปลี่ยนแค่ *นิยาม* ให้เข้มขึ้น (ธงจะเป็น `true`
> ในเคสที่มากกว่าเดิม) ⇒ ขึ้นทะเบียนใน "สัญญาไม่เปลี่ยนแต่ความหมายเปลี่ยน" ท้าย §15

**ที่ *ไม่* ทำ (ปฏิเสธพร้อมเหตุผล):** ข้อเสนอ (ง) ของ reviewer — mark membership เป็น `needs_review` เมื่อบัญชีถูกสร้าง
หลัง `tokenIssuedAt` — **ไม่รับใน F-002** เพราะต้องเพิ่มค่า enum + สถานะที่ไม่มีใคร (จอ/สิทธิ์/flow) รองรับใน Phase 0
⇒ จะกลายเป็น dead state ที่หลอกคนอ่านโค้ด (แบบเดียวกับ `invited` ที่เราเพิ่งประกาศว่าเป็น dead state) ·
เก็บ **สัญญาณ** ไว้ครบแล้ว (`acceptedUserCreatedAt`) ⇒ ถ้าวันหนึ่งต้องการ flow review จริง ข้อมูลย้อนหลังมีให้ใช้
**ปิดจริงที่ F-081** (email verification) — บันทึกเป็น forward-commitment (§14)

**"ยังไม่มีบัญชี → สมัครแล้วผูกอัตโนมัติ" (AC US-4) — ทำโดยไม่แตะ signup:**
`/invite?token=` → เรียก **preview** (public) → ยังไม่ล็อกอิน → พาไป signup (ผู้ใช้กรอก email เอง) → login →
client เรียก `POST /invitations/accept` ด้วย token ที่ถือมาตลอด flow ·
**`POST /auth/signup` ไม่เปลี่ยนแม้แต่ field เดียว** → signup ไม่มีทางรั่วข้อมูล org
(ทางที่ตัดทิ้ง: ส่ง token เข้า signup แล้ว auto-join — ทำให้ endpoint **public** เขียน `Membership` ได้ = attack surface ใหม่ที่ไม่จำเป็น)

**Enumeration / timing / brute-force:**
- token ไม่รู้จัก → `404 INVITATION_INVALID` (ข้อความเดียว ไม่บอกว่าเคยมีหรือไม่)
- token **ถูกต้อง** แต่หมดอายุ/ถูกยกเลิก/รับไปแล้ว → บอกแยกได้ (`INVITATION_EXPIRED` / `INVITATION_CANCELLED` /
  `INVITATION_ALREADY_ACCEPTED`) — ไม่ใช่ leak เพราะผู้เรียก **ถือความลับอยู่แล้ว** และ AC US-4 ต้องการข้อความที่แยกออก
- `emailMasked` (`u***@example.com`) — พอให้เลือกบัญชีถูก แต่ไม่คืน email เต็มให้คนที่บังเอิญได้ลิงก์
- rate limit: preview/accept ต่อ IP · create invite ต่อ org · create org ต่อ user (§8)
- cap pending invite ต่อ org (§10) → `409 INVITATION_LIMIT_REACHED`
- accept ซ้ำพร้อมกัน 2 request → `@@unique([organizationId, userId])` บน `Membership` + สถานะ invitation ใน tx เดียว
  ⇒ ได้ membership เดียวเสมอ (int test บังคับ)

---

## §8 Rate limit / abuse control (ของกลางที่ F-002 ต้องสร้าง)

`common/org-rate-limit.guard.ts` — Redis sliding window (ยกรูปจาก `auth/throttle.service.ts` ซึ่ง backend.md ระบุว่า
เป็น **ข้อยกเว้นเฉพาะ auth ห้ามลอก inline**) → guard กลางตัวนี้คือทางที่ feature ทั่วไปใช้ตั้งแต่ F-002 เป็นต้นไป:

| action | มิติ (key) | โควตาเริ่มต้น (env-tunable) | เกิน → |
|---|---|---|---|
| `POST /organizations` | userId | 10 / ชม. | 429 + `Retry-After` |
| `POST /orgs/{id}/invitations` | organizationId | 30 / ชม. | 429 |
| `POST …/invitations/{id}/link` | organizationId | 60 / ชม. | 429 |
| **`POST /invitations/preview`** · `POST /invitations/accept` | IP (**IPv6 ยุบเป็น /64** — N-3) | 30 / ชม. | 429 |
| **`POST …/tax-profile/reveal`** *(ใหม่ amend #3)* | (userId, organizationId) | 20 / ชม. | 429 |

**กติกาเพิ่มจาก qa Q11 (รับทั้งสองข้อ):**
- **`Retry-After` = จำนวนวินาที integer ≥ 1 เสมอ** (ปัดขึ้นจากเวลาที่เหลือของ window; ห้าม `0`, ห้ามทศนิยม,
  ห้ามรูปแบบ HTTP-date) — mobile คำนวณ backoff จากค่านี้ตรง ๆ
- **แยกให้ชัด: นโยบาย pin ที่ config · พฤติกรรม อ่านจาก config** — โควตาทั้งหมดเป็น env-tunable
  (`ORG_RATE_LIMIT_*`, §6.4) และ **default ถูก export เป็นค่าคงที่เดียว `ORG_RATE_LIMIT_DEFAULTS` จาก
  `packages/config`** ⇒ (ก) zod schema ใช้ค่านี้เป็น default (ข) เทสต์ `U-CFG-06` ของ qa เทียบตารางนี้กับค่าที่โหลดได้จริง
  ⇒ ใครลดโควตาเงียบ ๆ = CI แดงและต้องอธิบายใน PR (ค) เทสต์พฤติกรรม (I-29) ตั้งโควตาต่ำผ่าน env แล้วอ่านจาก config
  **ห้าม hardcode ตัวเลขในเทสต์พฤติกรรม**

fail-open policy: Redis ล่ม → **ปล่อยผ่าน + emit security event** (`auth.throttle.fail_open` มี pattern อยู่แล้วใน F-001)
— เหตุผลเดิม: rate limit เป็น abuse control ไม่ใช่ authorization; authorization ยังคุมด้วย membership/capability อยู่แล้ว
· **หลังแก้ I-10 ข้ออ้างนี้แข็งขึ้นจริง**: invariant เชิงจำนวน (org ต่อ user) ย้ายไปบังคับที่ service แบบ fail-closed แล้ว (§6.3)
⇒ rate limit ไม่ได้เป็นชั้นที่ค้ำ bound ใด ๆ อีก

> **N-3 · IPv6 ต้องยุบเป็น /64 ก่อนทำ key:** ผู้ใช้ IPv6 หนึ่งรายมักได้ prefix /64 ขึ้นไป ⇒ ถ้า key ต่อ IP เต็ม
> เครื่องเดียวสร้าง key ได้ไม่จำกัด = rate limit ต่อ IP ไร้ผลกับ IPv6 ทั้งหมด · helper ต้องอยู่ที่เดียว
> (`common/client-ip.ts`) และ **`auth/throttle.service.ts` ที่ ship แล้วมีปัญหาเดียวกัน** — ปรับพร้อมกันในงานนี้
> (เป็น ★-task เล็ก ๆ ที่แตะโค้ด F-001; ไม่เปลี่ยน wire/contract) · unit test: 2 address ใน /64 เดียวกัน → key เดียวกัน,
> IPv4 ไม่เปลี่ยนพฤติกรรม, `TRUST_PROXY_HOPS` ยังเป็นตัวกำหนด IP ต้นทางเหมือนเดิม (security-review §E ข้อ 13)

---

## §9 Observability ขั้นต่ำ (seam → F-005)

ใช้ `SecurityEventsService` ที่ F-001 วางไว้ (emit **post-commit** เสมอ — กฎ H-3 เดิม) โดยเพิ่ม event type:

| event | payload | ทำไมต้องมี |
|---|---|---|
| `org.created` | actorUserId, organizationId, planKey | ที่มาของ tenant + plan ที่ผูก (กัน "ใครได้ Full tier มาได้ยังไง") |
| `org.invitation.created` | actorUserId, organizationId, emailMasked, roleId, invitationId | เชิญใครเข้ามาเมื่อไหร่ |
| `org.invitation.link_reissued` | actorUserId, organizationId, invitationId | ลิงก์เก่าตายเมื่อไหร่ (สืบเคสลิงก์หลุด) |
| `org.invitation.cancelled` | actorUserId, organizationId, invitationId | |
| `org.invitation.accepted` | userId, organizationId, invitationId, roleId, **acceptedByUserId, userCreatedAt, userCreatedAfterTokenIssued (bool)** | สมาชิกใหม่เข้ามาทางไหน + สืบย้อนเคส "บัญชีถูกสร้างขึ้นมาเพื่อรับลิงก์ที่หลุด" (I-7) |
| **`org.member.reactivated`** *(ใหม่ — I-1ค/M-7ข)* | userId, organizationId, invitationId, roleId, previousRevokedAt | accept ที่ **ปลุก membership ที่เคย `revoked`** ต้องมีสัญญาณแยก ไม่กลืนใน `invitation.accepted` |
| `org.member.role_changed` | actorUserId, organizationId, targetUserId, fromRoleId, toRoleId, **grantsFullAccess (bool)** | **การยกเป็น Owner = privilege escalation** ต้องเห็นและ query ได้ทันที |
| `org.member.revoked` | actorUserId, organizationId, targetUserId, **cancelledInvitationIds[]** | ผูกกับ I-1 ข้อ 1 — เห็นว่าการถอดยกเลิกคำเชิญใบไหนไปด้วย |
| **`org.member.left`** *(ใหม่ — D-029)* | userId, organizationId, roleId, cancelledInvitationIds[] | **สมัครใจออกเอง ≠ ถูกถอด** — ถ้ากลืนใน `member.revoked` จะตอบไม่ได้ว่า "ทีมหายไปเพราะเจ้าของไล่ออก หรือคนเดินออกเอง" ซึ่งเป็นสัญญาณคนละเรื่องทั้งเชิงธุรกิจและเชิงความปลอดภัย |
| `org.tax_profile.set` | actorUserId, organizationId, taxEntityType, vatRegistered, **`taxIdPresent: true`** | M-7ค: **ไม่ log TIN เลยแม้แต่บางส่วน** (ร่างแรกเขียน "mask 6 ตัวท้าย" ซึ่งกำกวมและไม่มีเหตุผลรองรับ — ค่าจริงอ่านจาก DB ได้อยู่แล้วเมื่อมีสิทธิ์) |
| **`org.tax_profile.revealed`** *(ใหม่ — ux Q7/Q13)* | actorUserId, organizationId (**ไม่มีค่า TIN แม้บางส่วน**) | การเปิดดูเลขบัตรประชาชนของเจ้าของร้านต้องตอบได้ว่า **ใครเปิดดูเมื่อไหร่** — นี่คือสิ่งที่ทำให้ "ให้สิทธิ์ดูได้" กับ "ดูโดยไม่มีใครรู้" ต่างกัน |
| `org.access.denied` | userId, organizationId, reason (`no_membership`/`revoked`/`not_active`/`mismatch`) | สัญญาณบุกรุก/บั๊ก client — **sample/throttle การ log** กัน flood |
| **`org.access.capability_denied`** *(ใหม่ — M-7ก)* | userId, organizationId, route, requiredCapability, reason (`missing_capability`/`metadata_missing`/`owner_only`) | ไม่มีอันนี้ = insider probing (Staff ไล่กดสิ่งที่ไม่ควรทำได้) มองไม่เห็นเลย · ครอบ `canAssignRole` ที่ปฏิเสธด้วย |
| **`auth.password.admin_reset_blocked_multi_org`** *(ใหม่ — C-2)* | actorUserId, orgId, targetUserId | การปฏิเสธของ §3.3 ต้องไม่เงียบ (ผู้เรียกเห็นแค่ 404) |
| **`auth.password.admin_reset_blocked_owner_target`** *(ใหม่ — NEW-1/D-030)* | actorUserId, orgId, targetUserId | **แยกใบจาก multi-org โดยเจตนา** — เคสนี้คือ "มีคนพยายามรีเซ็ตรหัสของเจ้าของร้าน" ซึ่งเป็นสัญญาณการพยายามยึดร้าน ไม่ใช่ผลข้างเคียงของ policy multi-org · ถ้ากลืนเป็นใบเดียวกันจะแยกไม่ออกตอนสืบเคส |

**Metrics (Prometheus, ตาม backend.md §4.6):** `org_context_denied_total{reason}` · `invitation_accept_total{outcome}` ·
`org_created_total` · `capability_denied_total{reason}` · histogram `org_context_resolve_duration_ms` ·
**`org_tx_lock_timeout_total{operation,reason}`** *(ใหม่ — §5.2/NEW-4: ถ้าค่านี้ขยับแปลว่ามี hot org จริง)*
**Log enrichment:** middleware ใส่ `organizationId`/`userId` ลง ALS → pino หยิบอัตโนมัติทุกบรรทัด (ทั้งระบบได้ฟรีหลัง F-002)

> F-005 จะ consume event เหล่านี้เป็น `AuditLog` โดย **ไม่ต้องแก้ call site** (เปลี่ยน sink ที่ service เดียว)

---

## §10 Capacity / perf ที่ออกแบบรับ

| มิติ | ค่าที่ออกแบบรับ | จะพังที่ไหนก่อนถ้าเกิน | ตัวคุม |
|---|---|---|---|
| org ต่อ user | ≤ 50 | จอ org switcher + `GET /me/organizations` (มี cursor แล้ว) | **cap fail-closed ที่ service (§6.3) → 409 `ORG_LIMIT_REACHED`** · rate limit 10/ชม. เป็นชั้นหน้าเท่านั้น |
| สมาชิกต่อ org | ≤ 200 (คาดจริง < 20) | member list — cursor + limit 25 (max 100) | — |
| pending invite ต่อ org | **cap 100 นับเฉพาะ `pending && expiresAt > now`** (M-3) → `409 INVITATION_LIMIT_REACHED` | ตาราง Invitation โตไม่มีขอบเขต | cap + cancel + partial unique |
| org-scoped request | **+1 indexed query / request** (membership lookup), งบ p95 +5 ms | RPS สูงมาก → เปิด cache ตาม seam §1.5 | metric `org_context_resolve_duration_ms` |
| invitation lookup | 1 query บน unique index `tokenHash` | — | rate limit ต่อ IP |
| owner change | serialize ต่อ org (lock แถว Organization) | เฉพาะ operation ที่แตะ owner — read/write อื่นของ org ไม่กระทบ | — |

**perf smoke ที่ต้องรันตอน build:** seed 1 org × 200 members × 100 pending invites → member list p95 < 200 ms ·
`GET /me/organizations` ของ user ที่มี 50 org p95 < 150 ms · overhead ของ membership lookup < 5 ms

> **M-3 · cap ต้องไม่นับคำเชิญที่หมดอายุ:** สถานะ `expired` เป็น derived (เก็บเป็น `pending` ตลอด — §3.2 ของ data-model)
> ⇒ ถ้า cap นับ `status='pending'` ดิบ ๆ org ที่มีคำเชิญหมดอายุค้าง 100 ใบจะ **เชิญใครไม่ได้อีกเลย** จนกว่าจะไล่กด
> cancel ทีละใบ (insider grief: ยิง 30/ชม. ~4 ชม. ก็เต็ม) · query ที่ถูกคือ
> `count({ where: { status:'pending', expiresAt: { gt: now } } })` — index `(organizationId, status, createdAt)` รองรับอยู่แล้ว
> · unit test: 100 pending ที่หมดอายุแล้ว + 0 ที่ยังไม่หมด → เชิญได้ · 100 ที่ยังไม่หมดอายุ → 409

---

## §11 Error contract (สรุป — รายละเอียดเต็ม [api-spec §4](api-spec.md))

ทุก error ออกทาง **`DomainExceptionFilter` + `ERROR_CODES` registry** ที่มีอยู่แล้ว (`apps/api/src/common/`) —
F-002 **เพิ่ม entry ใน registry เท่านั้น ห้าม throw envelope inline** (กฎเหล็ก apps/api §5)
code ใหม่ (18 ตัว): `ORG_CONTEXT_REQUIRED` `ORG_MISMATCH` **`ORG_ACCESS_DENIED`** **`ORG_LIMIT_REACHED`**
`LAST_OWNER` `ALREADY_MEMBER` `INVITATION_PENDING` `INVITATION_INVALID` `INVITATION_EXPIRED`
`INVITATION_CANCELLED` `INVITATION_ALREADY_ACCEPTED` `INVITATION_EMAIL_MISMATCH` `INVITATION_LIMIT_REACHED`
**`INVITATION_SUPERSEDED`** **`INVITATION_ROLE_UNAVAILABLE`** `TAX_ID_INVALID` `ROLE_INVALID` `ORG_PROVISIONING_UNAVAILABLE`
· `FORBIDDEN` (มีอยู่แล้ว) ใช้เฉพาะ **capability/Owner-only** ไม่ใช้กับ "ไม่ใช่สมาชิก" อีกต่อไป (I-5)

---

## §12 Test strategy — **เจ้าของ verdict = @qa** (D-014: unit ประกบโค้ดเสมอ)

> **amend #3 เปลี่ยนสถานะของหัวข้อนี้:** ร่างเดิมประกาศ lane/เคสเองแบบครึ่ง ๆ · [test-plan.md](test-plan.md)
> **แย้งมา 12 ข้อ ผมรับทั้ง 12** ⇒ ต่อจากนี้ **`test-plan.md` คือ authority ของ "ทดสอบอะไร/พอหรือยัง"**
> และหัวข้อนี้เหลือหน้าที่เดียว: **ประกาศว่า backend ต้องส่งมอบอะไรให้เทสต์เหล่านั้นเดินได้จริง** (ถ้าไม่มี = qa บล็อก)

### 12.1 สิ่งที่ผมรับจาก test-plan §18 (12/12) — สรุปสิ่งที่ *ผม* ต้องแก้ ไม่ใช่สิ่งที่ qa ต้องเขียน

| # | สิ่งที่ qa แย้ง | สิ่งที่เปลี่ยนฝั่ง design/โค้ด |
|---|---|---|
| 1 | ไม่มี E2E lane | qa เขียนเอง (§12 ของ test-plan) — ผมต้องส่ง **seed CLI** ให้ E2E เรียกได้ (12.2 ข้อ 2) |
| 2 | ไม่มีเทสต์ security event ทั้งที่ AC-3.4/AC-4.5 บังคับ "ต้องบันทึกเหตุการณ์" | ผมส่ง **test sink** (12.2 ข้อ 3) + event ครบตาม §9 (+2 ใบใหม่: `member.left`, `tax_profile.revealed`) |
| 3 | ไม่มี meta-test ว่า kit/gate ยิงจริง | **รับเต็ม** — kit ที่ enumerate ได้ 0 route แล้วเขียวคือรูปเดียวกับบทเรียน F-001 · ผมต้องทำ registry ให้ **enumerate ได้จริงและ import ได้** (12.2 ข้อ 4) เพื่อให้ fixture ที่จงใจผิดทำให้ kit แดงได้ |
| 4 | ไม่มี lane-enabled guard (`describe.skip` เงียบ) | **รับเต็ม** — เป็นเงื่อนไขของ "เขียว" ที่ผมยอมรับ: int lane ที่ไม่ได้รันไม่ใช่ผลลัพธ์ · ผูกกับคำขอ @devops (12.3) |
| 5 | persona ที่ 5 (Staff ของ org A) | ไม่กระทบ design — แต่ยืนยันว่า `FORBIDDEN` ≠ `ORG_ACCESS_DENIED` เป็นสัญญาที่ผมต้องรักษาราย endpoint (I-5) |
| 6 | ไม่มี header/PII assertion | ผม export **`RESPONSE_HEADER_POLICY`** (เส้นไหนต้องมี `no-store`/`Referrer-Policy`) แทนให้ kit ประกาศเอง |
| 7 | ไม่มี traceId assertion | **เปลี่ยนพฤติกรรมของโค้ดที่ ship แล้ว** → §15 ข้อ 3 |
| 8 | ไม่มี schema validation ของ response | ผมต้อง gen OpenAPI ให้ตรงจริง (optional/nullable ตามที่ api-spec เขียน) — `taxProfile` ทุก field optional, `roleKey` nullable |
| 9 | `withOrgScope` matrix ไม่ครบ operation | **แก้แล้วที่ §2.2** + นโยบาย "operation นอกตาราง = throw" + export map ให้เทสต์ |
| 10 | concurrency ขาด 7 เคส | **แก้ design จริงที่ §5.1** (ไม่ใช่แค่เพิ่มเทสต์) — ตาราง mapping ครบ 10 เคส |
| 11 | ไม่มีเทสต์ migration/precondition/partial unique | data-model §4 มีของครบอยู่แล้ว — ผมยืนยันว่า precondition ต้อง **abort ดัง** ไม่ใช่ผ่านเงียบ |
| 12 | ไม่มีเทสต์พฤติกรรม rate limit | §8 เพิ่มกติกา `Retry-After` ≥ 1 + export defaults ให้ pin ค่านโยบายแยกจากพฤติกรรม |

### 12.2 ของที่ backend ต้องส่งมอบให้เทสต์เดินได้ (test-plan §19.1 — **รับครบ 10 ข้อ** · ข้อ 7–10 เพิ่มใน amend #4)

| # | ของ | รูปที่ตกลง |
|---|---|---|
| 1 | **`withOrgScope` operation coverage** | §2.2 (เติม 4 แถว + นโยบาย throw) · export `ORG_SCOPE_OPERATION_STRATEGY` จาก `packages/db` |
| 2 | **seed kit + CLI** | `apps/api/test/f002-seed.kit.ts` (vitest import ตรง) + CLI บาง ๆ `apps/api/test/cli/f002-seed.ts` (`tsx`) ที่ **เรียก kit ตัวเดียวกัน** — `--scenario=expired-invite\|superseded-invite\|high-role-invite\|two-orgs\|fifty-orgs\|revoked-member\|invited-member` แล้วพิมพ์ `{ ids, rawToken }` เป็น JSON ออก stdout ให้ Playwright/Flutter อ่าน · **ข้อบังคับ:** (ก) `tokenHash` คำนวณด้วย **production fn** (`hashInvitationToken`) เท่านั้น (ข) เขียน `expiresAt`/`tokenIssuedAt`/`revokedAt`/`createdAt` ลงแถวได้อิสระ ⇒ สร้าง `revokedAt >` / `<` / `==` `tokenIssuedAt` ได้ครบ 3 แบบ (ค) **ไม่มี fake timer** (ง) `Membership.status='invited'` สร้างได้จาก kit เพื่อพิสูจน์ว่าถูกปฏิเสธ **แม้ไม่มี write path จริง** (จ) **ไม่มี test-only endpoint** — kit/CLI อยู่นอก `src/` ไม่ถูก compile เข้า production build และ CLI ปฏิเสธรันเมื่อ `NODE_ENV=production` |
| 3 | **test sink ของ security event** | **ไม่ต้องรื้ออะไร** — `apps/api/src/auth/security-events.service.ts` ที่ ship แล้ว **มี `EventEmitter` ในตัว** (`emitter.on("*")`) · ผมทำ 2 อย่าง: (ก) เพิ่ม event type ของ F-002 เข้า union (ข) helper `collectSecurityEvents(app)` ใน kit ที่ subscribe `"*"` แล้วคืน array ให้ assert (รวม assert ว่า **tx ที่ rollback ไม่ emit**) |
| 4 | **export ให้เทสต์ import (ห้ามให้เทสต์ประกาศตารางซ้ำ)** | `ROUTE_CAPABILITIES` + `enumerateRoutes(app)` (`apps/api/src/common/authz/`) · `orgScopedModels`/`orgAgnosticModels` + **`USER_SELECT`** จาก `@omnistock/db` · `ORG_RATE_LIMIT_DEFAULTS` + **`ORG_TX_TIMEOUTS`** จาก `@omnistock/config` · `RESPONSE_HEADER_POLICY` · `TOKEN_RESPONSE_ALLOWLIST` (2 เส้น) |
| 5 | **`traceId` ทุก error** | §1 ของ api-spec (พฤติกรรมบังคับ, schema optional) — **แตะโค้ดที่ ship แล้ว → §15 ข้อ 3** |
| **6** *(qa §19.1 ข้อ 7)* | **`ORG_LOCK_REQUIRED_OPERATIONS`** | **export จาก production** (`apps/api/src/common/authz/org-lock-operations.ts`) เป็น **ลิสต์ของ `{ operationKey, method, path, serviceMethod }`** ครบ 7 รายการตาม §5 (`PATCH members/{userId}` · `DELETE members/{userId}` · `DELETE …/membership` · `POST /invitations/accept` · `POST …/invitations` · `POST …/invitations/{id}/link` · `DELETE …/invitations/{id}`) · **ลิสต์นี้คือแหล่งเดียว** — service ที่แตะ `Membership`/`Invitation` แล้วไม่อยู่ในลิสต์ถูกจับด้วย **grep gate คู่กัน** (ชื่อ method ที่เรียก `tx.membership.`/`tx.invitation.` ต้อง map กับลิสต์) ⇒ U-API-09 enumerate จากลิสต์ ไม่ประกาศเอง |
| **7** *(qa §19.1 ข้อ 8)* | **`TAX_ID_RESPONSE_ALLOWLIST`** + **`ANY_ACTIVE_MEMBER_ROUTES`** | ทั้งคู่อยู่ที่ `apps/api/src/common/authz/` และเป็น **รายการ endpoint แบบตัวอักษร (frozen array) ไม่ใช่ regex** (เงื่อนไขของ qa) · `TAX_ID_RESPONSE_ALLOWLIST` = **1 เส้นพอดี** (`POST /orgs/{orgId}/tax-profile/reveal`) — I-04 assert ขนาด = 1 · `ANY_ACTIVE_MEMBER_ROUTES` = **object 2 ลิสต์** `{ mutating: [1 เส้น], read: [2 เส้น] }` ตาม §3.1 ⇒ G-13 เทียบ **ราย tier** (การเพิ่ม read route จะไม่ถูกกลบด้วยโควตาของ mutating) |
| **8** *(qa §19.1 ข้อ 9)* | **seed kit สร้าง/แก้ `Role.key` ได้** | `f002-seed.kit.ts` เปิด `roles: [{ name, key, capabilities, isSystem }]` ให้กำหนดเอง **รวม `key: null` (custom role) และการสลับ key ของ role ที่มีอยู่** (`setRoleKey(roleId, key\|null)`) + `--scenario=custom-role-null-key` ใน CLI ⇒ **I-44(c)/I-45** ทำได้จริง (ข้อห้าม "ห้ามใช้ `key` ตัดสินสิทธิ์" ไม่เหลือแค่ grep) · kit ต้อง **ไม่หลบ** `@@unique([organizationId, key])` (ตั้ง key ซ้ำ = ต้องพังจริง) |
| **9** *(qa §19.1 ข้อ 10)* | **500-fixture ที่ตั้งใจ** | `apps/api/test/fixtures/boom.controller.ts` — controller ที่ **register เฉพาะเมื่อ `NODE_ENV==='test'` และ env `ENABLE_TEST_FIXTURES=1`** (ประกอบใน `AppModule` ผ่าน conditional module, ไม่ถูก import ในโปรไฟล์อื่น) · มี 3 เส้น: โยน `Error` ธรรมดา (non-`ApiFailure`) · โยนใน handler ที่เป็น org-scoped (พิสูจน์ว่า filter ทำงานหลังมี context) · โยนใน `@Public()` · **grep gate: ห้าม import ไฟล์นี้จาก `src/**` นอก conditional block** และ smoke test 1 เคสว่า **โปรไฟล์ production ไม่มี route นี้** ⇒ I-06 พิสูจน์ `traceId` บน **500** ได้จริง |

### 12.3 prerequisite ของ @devops (ไม่มี = int/E2E lane ทั้งก้อนไม่มีความหมาย)

CI job **`integration-api`** ต้องเพิ่ม (test-plan §19.1 ข้อ 6):
1. **env ใหม่:** `INVITATION_TOKEN_SECRET` (≥32, ต่างจาก JWT ทั้งสอง) · `WEB_APP_BASE_URL` · `DEFAULT_ORG_PLAN_KEY` ·
   (optional) `MAX_ORGS_PER_USER`, `ORG_RATE_LIMIT_*` — **ไม่ตั้ง = boot ไม่ขึ้นโดยตั้งใจ** (§6.4 fail-closed)
2. **ขั้น `prisma db seed`** ก่อนรันเทสต์ — ไม่มี `PlanDefinition` ⇒ `POST /organizations` = **503 ทุกเคส** (ไม่ใช่บั๊ก, คือ fail-closed)
3. lane-enabled guard ของ qa (I-37) จะ **fail ทันที** ถ้า CI ไม่มี `TEST_DATABASE_URL`/`TEST_REDIS_URL` — ตั้งใจให้เป็นแบบนั้น

### 12.4 lane ฝั่ง backend (สรุปสั้น — รายละเอียดเคสอยู่ที่ test-plan §3–§8)

| lane | สิ่งที่ผมต้องเขียนประกบโค้ด |
|---|---|
| unit — core-domain | `owner-invariant` · `member-authz` (`canAssignRole`) · `invitation-policy` (`invitationTtlHours` + `canAcceptInvitation`) · `thai-tax-id` · `invitation-status` · `maskEmail` · `maskTaxId` — pure fn รับ `now` เสมอ |
| unit — packages/db | `withOrgScope` ครบทุกแถว §2.2 **รวมนโยบาย throw + M-9** · `org-models` ↔ schema · `lockCurrentOrganization` (N-2) · `hashInvitationToken` |
| unit — packages/config | env ใหม่ทุกตัว §6.4 + **pin `ORG_RATE_LIMIT_DEFAULTS`** |
| unit — apps/api | middleware/guard (I-3/I-4/failure matrix) · `CapabilityGuard` (+`@AnyActiveMember` · **รวมเคส read route ที่ไม่ประกาศ metadata → 403** — NEW-3) · **ลำดับคำสั่งใน tx: lock เป็นบรรทัดแรก (§5.1)** · **การแมป lock timeout/deadlock → `409` ไม่ใช่ 500 (§5.2)** · mapper PDPA (§3.3 ของ api-spec) · rate-limit guard (N-3) · **`adminResetPassword` fail-closed 7 เคส (§3.3 — C-2 + NEW-1)** |
| int (บังคับ) | ตาม test-plan §7–§8 — ผมมีหน้าที่ทำให้ **kit ทำงานได้** (12.2) และแก้โค้ดจนเคสเหล่านั้นผ่าน |
| perf smoke | ตาม §10 |

---

## §13 สิ่งที่ irreversible / ต้องให้ user เคาะก่อน build

**เคาะแล้ว (ปิดสมบูรณ์ — ไม่ต้องทำอะไรต่อ):**

1. ✅ **§7 rotate ลิงก์ + อายุนับใหม่** — **D-027** (user เลือกทางของ product; ผมเสนอคงอายุเดิม)
2. ✅ **§4 การตีความ AC US-5** (ตัดสิทธิ์ที่ membership ไม่ใช่ลบ token row) — **D-027** + AC ใหม่ "org หายจาก switcher ทันที"
3. ✅ **§3.2 Owner-only (`canAssignRole`)** — **D-028/C-1** (ยืนยันเจตนา AC US-6)
4. ✅ **§3.3 admin-reset fail-closed = ลดความสามารถของ endpoint ที่ ship แล้ว** — **D-028/C-2** (★-task → §15 ข้อ 1)
5. ✅ **§7.4/§7.5/§7.6 invitation hardening + TTL 24 ชม. + threat model email** — **D-028/I-1+I-7**
6. ✅ **PDPA field-level: TIN เต็มเฉพาะ `manage_org_settings` · member list ต้องมี `manage_members`** — **D-028/I-8+N-4**
   · **เข้มขึ้นอีกใน amend #3 ตามคำตอบ ux Q13/Q7:** TIN เต็มออกทาง `POST …/tax-profile/reveal` เท่านั้น (มี event + rate limit)
   และ Staff ไม่ได้แม้แต่ 4 ตัวท้าย — **ไม่ต้องเคาะเพิ่ม** เพราะเป็นการ *จำกัดให้แคบลง* จากสิ่งที่ D-028 อนุญาตไว้แล้ว
7. ✅ **`MAX_ORGS_PER_USER = 50`** (env-tunable) — **D-029 (3)** ยืนยันค่าที่ผมตั้งไว้ *(เดิมเป็นข้อ 11 ที่ยังค้าง)*
8. ✅ **มี endpoint "ออกจากร้าน" แยก: `DELETE /orgs/{orgId}/membership`** — **D-029 (2)**
   *(เดิมข้อ 12 เขียนว่า "ไม่มี endpoint แยก, ถอดตัวเองผ่าน `DELETE …/members/{me}`" — **ตกไปแล้ว**: ux ชี้ว่าพนักงาน
   ทำแบบนั้นไม่ได้เพราะติด `manage_members` · เหตุผลที่เลือก endpoint แยกแทนการผ่อน authz → api-spec §3.17)*
9. ✅ **UI ใช้คำว่า "ร้าน" · code/API/schema/enum ยังเป็น `organization`** — **D-029 (1)** ⇒ กระทบเฉพาะ `message`
   ภาษาไทยใน error envelope + i18n ของ client · **ไม่มีการ rename อะไรในสัญญา**
10. ✅ **AC coverage 34/34 (เต็ม 31 · partial 3)** — **D-029 (4)** (AC-1.2 → F-080/F-082 · AC-5.4 → F-005 · AC-7.3 → F-007)
10b. ✅ **admin-reset ปฏิเสธเมื่อ target เป็น Owner และผู้เรียกไม่มี `full_access`** — **D-030 (1)** (NEW-1 · §3.3 ★)
   · **ราคาที่ user รับแล้ว: ร้านที่มี Owner คนเดียวแล้วลืมรหัส = กู้เองไม่ได้จนกว่าจะมี F-081** → §14 forward-commitment
10c. ✅ **`POST …/tax-profile/reveal` เปิดถึง `manage_org_settings` (Owner + Admin)** — **D-030 (2)** ยืนยันตาม contract
   ที่ lock ไว้ (NEW-11) · เหตุผล + ตัวคุม 5 อย่าง → §3.1 ท้ายหัวข้อ

**ยังต้องให้ user/เจ้าของอื่นทำ หรือรับทราบก่อน build:**

11. **§1.4 ใช้ 403 (ไม่ใช่ 404) สำหรับ "ไม่ใช่สมาชิก"** — ตาม AC US-2 แต่ต่างจากแนว 404-never-403 ของ F-001
    (ตั้งใจ; security-review §E ข้อ 7 ยืนยันว่าไม่เปิด oracle) · **ไม่ต้องเคาะเพิ่มถ้าไม่มีใครค้าน**
12. **§6.2 ค่า `DEFAULT_ORG_PLAN_KEY`** — mechanism เป็นของ backend, **value เป็นของ @devops** ต้องตั้งก่อนขึ้น env ใด ๆ
13. **[data-model] `taxId` ไม่ unique ระดับระบบ** — ถ้า business ต้องการ unique ต้องเคาะ (§E ข้อ 4 สนับสนุนทางที่เลือก)
14. **env ใหม่ (§6.4) ที่ @devops ต้องเติม:** `INVITATION_TOKEN_SECRET` (≥32, ต่างจาก JWT ทั้งสอง) · `WEB_APP_BASE_URL` (https) ·
    `DEFAULT_ORG_PLAN_KEY` (required) · `MAX_ORGS_PER_USER` (optional, default 50) · `ORG_RATE_LIMIT_*` ·
    **+ ผลข้างเคียงของการ rotate `INVITATION_TOKEN_SECRET`** (คำเชิญค้างตายทั้งหมดแบบเงียบ)
15. **@devops — prerequisite ของ CI job `integration-api`** (จาก test-plan §19.1 ข้อ 6): เพิ่ม env ข้างบน + ขั้น
    **`prisma db seed`** · ถ้าไม่ทำ int lane จะ boot ไม่ขึ้น/ได้ 503 ทุกเคส และ lane-enabled guard (I-37) จะแดงทันที
16. **ราคาที่ผู้ใช้จะรู้สึกจาก C-2:** รีเซ็ตรหัสให้สมาชิกที่เป็นสมาชิก active ของ org อื่นด้วย **จะทำไม่ได้** (404 ที่ไม่อธิบาย)
    → copy อยู่ที่ ux §12.3 แล้ว · product รับทราบว่านี่คือผลตั้งใจ
17. **ราคาที่ผู้ใช้จะรู้สึกจาก D-029:** **Owner คนสุดท้ายออกจากร้านเองไม่ได้** (`409 LAST_OWNER`) และ F-002 ไม่มี
    "ลบร้าน" ⇒ คนที่สร้างร้านทิ้งไว้จะมีร้านค้างในรายการตลอด — ทางออกในเวอร์ชันนี้คือตั้ง Owner คนใหม่ก่อนออก ·
    **ต้องการให้มี "ลบ/เก็บร้าน" เมื่อไหร่ = feature ใหม่ (productize) ไม่ใช่ F-002**
18. **@frontend ★-task จาก I-6ข:** หน้า `/invite` ต้องถอด token ออกจาก URL ทันที + ไม่เก็บใน localStorage ·
    **@devops:** scrub query string ของ `/invitations/*` ที่ชั้น proxy/log
19. **@frontend (ใหม่ amend #3):** ค่า TIN ที่ได้จาก `POST …/tax-profile/reveal` เก็บใน memory ของหน้าจอเท่านั้น
    (ห้าม persist/log/analytics) และต้องมีปุ่ม "ซ่อนเลข" ที่ทิ้งค่าจริง
20. **ราคาที่ผู้ใช้จะรู้สึกจาก D-030/NEW-1 (product + ux ต้องรับทราบ):** **Admin รีเซ็ตรหัสให้ Owner ไม่ได้อีกต่อไป**
    (ได้ 404 ที่ไม่อธิบาย — โดยเจตนา คง 404-never-403) ⇒ (ก) copy ของหน้าจอ reset ควรบอกทางออก ("ให้เจ้าของร้าน
    รีเซ็ตด้วยตัวเองเมื่อมี F-081 / ติดต่อผู้ดูแลระบบ") — **เป็นงาน copy ของ @ux ไม่ใช่การปลดเช็ค**
    (ข) **ร้านที่มี Owner คนเดียวแล้วลืมรหัส = กู้เองไม่ได้ใน Phase 0** — เป็นข้อจำกัดที่ user รับแล้ว (D-030)
21. **@qa (ผลของ amend #4 ต่อ test-plan — ไฟล์ของ qa ผมไม่แก้):** (ก) **G-13** ต้องเทียบ `ANY_ACTIVE_MEMBER_ROUTES`
    **ราย tier** (`mutating` 1 เส้น · `read` 2 เส้น) แทนตัวเลขรวม 1 เส้น (ข) **I-02** ครอบ read route ด้วย
    (ค) **U-API-07** เพิ่ม 2 เคสของ NEW-1 (ฉ/ช) + **I-30** เพิ่มคู่ int ของ NEW-1 (ง) 1 เคสใหม่ของ §5.2 (lock timeout → 409)
    (จ) เคส `canAssignRole` ที่ **reissue** (I-15/I-23) (ฉ) เคส nested read "ลงกลับ" ที่ I-35
    (ช) **NEW-12 (dangling ref §20)** เป็นของ qa

---

## §14 sync-back (PM ทำหลัง user เคาะ — เอกสารกลางผมไม่แตะ)

| ไฟล์กลาง | ต้องแก้อะไร |
|---|---|
| `docs/01-data-model.md` §2 Tenancy & Auth | `Invitation`: `token` → **`tokenHash`** + `invitedByUserId, tokenIssuedAt, acceptedAt/By, **acceptedUserCreatedAt**, cancelledAt`; status เพิ่ม `cancelled` (expired = derived) · `Membership`: + `revokedAt/revokedByUserId/activatedAt` · **`Role`: + `key` (`owner\|admin\|staff` สำหรับ system role · custom role = `null` · `@@unique([organizationId, key])` · **ห้ามใช้ตัดสินสิทธิ์** — สิทธิ์ = capabilities)** · เพิ่มบรรทัด "สร้าง org = Organization + system Roles + Membership(Owner) + OrgEntitlement + default Warehouse ใน tx เดียว" · หมายเหตุ "`taxId` ไม่ unique ข้าม org (กัน cross-tenant oracle)" · หมายเหตุ "**`Membership.status='invited'` = dead state ใน Phase 0**" · หมายเหตุ "**สมาชิกออกจาก org เองได้ (D-029) — บันทึกเป็น `revoked` เหมือนถูกถอด แต่เป็นคนละ event**" · **(amend #4) หมายเหตุ "ธง `acceptedUserCreatedAfterInvite` เทียบกับ `Invitation.createdAt` ไม่ใช่ `tokenIssuedAt` (rotate ต้องล้างสัญญาณ forensic ไม่ได้ — NEW-9); `tokenIssuedAt` ยังใช้กับกฎ `INVITATION_SUPERSEDED` ตามเดิม"** |
| `docs/02-architecture.md` §5 Multi-tenant & security | ระบุกลไกจริง: `X-Organization-Id` → `OrgContextMiddleware` (ALS) → `ORG_PRISMA` (`withOrgScope` client extension) · `SYSTEM_PRISMA` allowlist ระดับไฟล์ (`auth/`, `orgs/system/`, **`tenancy/`**, `health/`, `prisma/`) · **ข้อจำกัดของชั้นนี้: ไม่ครอบ nested read / query ที่ตั้งต้นจาก model org-agnostic → กติกา C-3** · **(amend #4) + ข้อ 4 ของกติกา C-3: ห้าม traverse relation *ผ่าน* model org-agnostic กลับเข้าสู่ model org-scoped — บังคับด้วย `USER_SELECT` ที่ frozen (NEW-8)** · **+ "org-scoped route ทุกเส้นรวม read ต้องประกาศ capability/`@AnyActiveMember` — ไม่ประกาศ = 403" (NEW-3)** · back-office ยังเป็นเส้นแยกตามเดิม |
| `docs/architecture/backend.md` §3.3 | ยืนยัน allowlist ให้ตรงกัน (มี `tenancy/` อยู่แล้ว — ฉบับ F-002 เป็นฝ่ายตกหล่น, แก้แล้ว) · เพิ่มบรรทัดกติกา **"ห้ามตั้งต้น query จาก model org-agnostic ใน feature module"** เพื่อไม่ให้ ~40 feature ถัดไปลอกช่องโหว่ C-3 · **(amend #4) เพิ่ม 3 บรรทัดที่เป็นกติกาถาวรของทุก feature:** (ก) **default-deny ของ capability ครอบ `GET` ด้วย** (NEW-3) (ข) **แตะ `User` ได้ทางเดียวคือ `USER_SELECT`** (C-4 + NEW-8) (ค) **tx ที่คว้า row lock ต้องตั้ง `lock_timeout` และแมป timeout/deadlock เป็น `409` ไม่ใช่ 500** (NEW-4 · §5.2) |
| `docs/features/forward-commitments.md` | ปิดแถว D-018 (ทำจริงใน F-002) · **แก้เจ้าของ: `@RequireCapability` decorator+guard = F-002 · registry/role CRUD = F-003** · เพิ่มแถว F-003: ถ้าเปิด cache membership ต้อง invalidate ตอน revoke + มี test · **เพิ่มแถว F-081: email verification — จนกว่าจะมี, การผูกคำเชิญกับ email ไม่ใช่ control (§7.6)** · **เพิ่มแถว F-011 `Idempotency-Key`** · **เพิ่มแถว PDPA: retention/ลบ email ของคำเชิญที่ไม่เคยถูกรับ (M-11)** · **(amend #3) + แถว "ลบ/เก็บร้าน (archive org)"** — D-029 ทำให้ Owner คนสุดท้ายออกเองไม่ได้ และไม่มีทางกำจัดร้านร้างทิ้ง ⇒ ต้องมีเจ้าภาพ (productize) · **+ แถว F-003 "`Role.key` ของ custom role"** — F-002 ตอบว่า `null`, F-003 ตัดสินต่อว่าจะเปิดให้ตั้งเองไหม (ถ้าเปิด ต้องกันชนกับค่าสงวน `owner\|admin\|staff`) · **(amend #4 — เพิ่ม 3 แถว ดูรายละเอียดใต้ตาราง):** **F-081 = ทางกู้บัญชี Owner + force-change password** · **F-003 = privilege-superset (NEW-10)** · **F-005 = จอที่ Owner เห็น `org.tax_profile.revealed` (NEW-11)** |
| `apps/api/CLAUDE.md` (target patterns) | หลัง build: แถว `OrgContextMiddleware`/`ORG_PRISMA` เปลี่ยนจาก "เกิดที่ F-002/F-003" → "มีแล้ว, exemplar = `src/orgs/`" · เพิ่มกติกา `select` เสมอบน `User` — **ผ่าน `USER_SELECT` เท่านั้น** (C-4 + NEW-8) · เพิ่มกติกา **"tx ที่แตะ membership/invitation ต้องขึ้นต้นด้วย `lockCurrentOrganization` + ตรวจเงื่อนไขซ้ำใน tx" (§5.1)** · เพิ่ม **"operation ของ `withOrgScope` ที่ไม่อยู่ใน map = throw"** · **(amend #4) + "org-scoped route ทุกเส้น *รวม `GET`* ต้องมี `@RequireCapability` หรือ `@AnyActiveMember` (ที่อยู่ใน allowlist)" (NEW-3)** · **+ "ห้าม `$transaction` ที่คว้า lock โดยไม่กำหนด `timeout`/`maxWait`; timeout/deadlock ต้องออกเป็น `409` ไม่ใช่ 500" (§5.2)** |
| `apps/web/CLAUDE.md` · `apps/mobile/CLAUDE.md` | เพิ่มกติกาที่ผูกกับสัญญาใหม่: (ก) **client switch จาก `code` เท่านั้น ห้าม parse `message`** (ข) **`403 ORG_ACCESS_DENIED` ≠ `403 FORBIDDEN` — ห้ามรวม handler** (ค) **ห้าม hardcode "7 วัน"/"24 ชั่วโมง"** — คำนวณจาก `expiresAt` (ง) **`roleKey` อาจเป็น `null`/ค่าที่ไม่รู้จัก → fallback เป็น `roleName`** และ **ห้ามใช้ตัดสินสิทธิ์** (จ) TIN เต็มมาจาก `…/tax-profile/reveal` เท่านั้น เก็บใน memory (ฉ) **UI ใช้คำว่า "ร้าน" (D-029) — identifier ยังเป็น `organization`** · **(ช) *(amend #4)* `409 CONFLICT` ที่มี `details.reason === "busy"` = ชั่วคราว (ระบบกำลังประมวลผลคำขออื่นของร้านนี้) ⇒ ให้ผู้ใช้ "ลองใหม่" ได้ · client ที่ไม่รู้จัก `reason` ต้องยังทำงานถูก (แสดงเป็น Conflict ธรรมดา) — ห้ามใช้ค่านี้ตัดสินอย่างอื่น** |
| `docs/features/F-001-authentication.md` (หมายเหตุท้ายไฟล์) | บันทึก **3** อย่าง: (ก) **admin-reset ถูกลดความสามารถโดย D-028/C-2** (ปฏิเสธเมื่อ target อยู่หลาย org) (ข) **error envelope มี `traceId` ทุกครั้งตั้งแต่ F-002** (เดิมมีเฉพาะเมื่อมี correlation id จาก gateway) (ค) **(amend #4/D-030) admin-reset ถูกลดความสามารถ *รอบที่สอง*: ปฏิเสธเมื่อ target เป็น Owner (`full_access`) และผู้เรียกไม่มี `full_access`** → 404 รูปเดิม + event `auth.password.admin_reset_blocked_owner_target` — ไม่ให้คนอ่าน spec F-001 เข้าใจพฤติกรรมผิดแล้ว "แก้กลับ" ในอนาคต |

**แถวใหม่ที่ `docs/features/forward-commitments.md` ต้องมี (amend #4 — ผูก trigger ไว้ทุกแถว ไม่ใช่ "ไว้ค่อยดู"):**

| แถว | เนื้อหาที่ต้องเขียน | trigger (เมื่อไหร่ถึงต้องทำ) | ที่มา |
|---|---|---|---|
| **F-081 — ทางกู้บัญชี Owner (ทางเดียว)** | หลัง D-030/NEW-1 **ไม่มีใครในระบบรีเซ็ตรหัสให้ Owner ได้** (Admin ได้ 404) ⇒ ร้านที่มี Owner คนเดียวแล้วลืมรหัส **กู้เองไม่ได้** · F-081 ต้องส่งมอบ **self-serve password reset ทาง email** เป็นเงื่อนไขของการปิดแถวนี้ · **และ "must change password on next login" หลัง admin-reset** (ปิด NEW-5 ข: admin ที่รีเซ็ตให้พนักงานยังรู้รหัสนั้นเมื่อพนักงานไปสังกัด org อื่นภายหลัง) | **ทันทีที่มี SMTP ใช้ได้** — และ **บล็อกการเปิดขายจริง (non-dogfood)**: ระบบที่ผู้ใช้กู้บัญชีเองไม่ได้ ห้ามมีลูกค้าจริง | D-030 · NEW-1 · NEW-5(ข) |
| **F-003 — privilege-superset** | `canAssignRole` ของ F-002 เทียบเฉพาะ `full_access` ⇒ ต้องเพิ่มกฎ **"actor มอบได้เฉพาะ capability ที่ตัวเองถืออยู่"** พร้อม capability registry จริง · ครอบทั้ง role CRUD และการ assign role · **รวมถึงกฎ "ห้ามรีเซ็ตรหัสของคนที่สิทธิ์ ⊇ ตัวเอง"** ที่ F-002 ทำไม่ได้เพราะยังไม่มี registry | **feature ใดก็ตามที่เปิดให้สร้าง/แก้ `capabilities` ของ role** (วันนี้คือ F-003) | NEW-10 · D-030 |
| **F-005 — จอ audit ของ Owner** | event `org.tax_profile.revealed` / `org.member.role_changed` / `auth.password.admin_reset_blocked_*` ต้องมี **จอที่ Owner เห็นจริง** — Phase 0 มีแต่ log ที่ยังไม่มีใครอ่าน ⇒ "ให้สิทธิ์ Admin ดู TIN ได้แต่ตรวจสอบได้" ยังเป็นจริงแค่ครึ่งเดียวจนกว่าจะมีจอนี้ | เมื่อ F-005 (AuditLog) เริ่ม | NEW-11 (H.3 ข้อ 2) |

> **M-11 · retention / cache header (forward-commitment ที่ต้องเขียนไว้ ไม่ใช่ปล่อยเงียบ):**
> email ของผู้ถูกเชิญที่ไม่เคยรับ ค้างในตาราง `Invitation` ตลอดกาล (F-002 ไม่มี job ลบ) — เป็นข้อมูลส่วนบุคคลของ
> คนที่ **ไม่เคยเป็นผู้ใช้ระบบเรา** ⇒ ขอเป็น forward-commitment: housekeeping job ลบ/anonymize คำเชิญที่
> `status ∈ {cancelled, expired-derived}` และเก่ากว่า N เดือน (ค่า N = product/legal ตัดสินตอนทำ launch-readiness) ·
> ส่วน `Cache-Control: no-store` บน response ที่มี email/TIN/token = **ทำใน F-002 เลย** (§7.3 · api-spec §1)

---

## §15 ผลต่อโค้ดที่ ship แล้ว (F-000/F-001) — รายการเต็มสำหรับแตกเป็น ★-task

> เกณฑ์ที่ใช้คัด: **ไฟล์ที่มีอยู่แล้วและกำลังทำงานอยู่** ต้องถูกแก้ · แต่ละแถวมี (1) ไฟล์ (2) สิ่งที่ต้องแก้
> (3) **test บังคับ** · ทุกแถวที่ทำเครื่องหมาย ★ ต้องมีหลักฐาน **red→green** (รันเทสต์กับโค้ดก่อนแก้แล้วแดงจริง — qa Q16)
> · แถวที่เปลี่ยน *พฤติกรรมบน wire* ถูกทำเครื่องหมาย ⚠️ (oasdiff มองไม่เห็น ⇒ ต้องประกาศด้วยคน)

| # | ไฟล์ที่ ship แล้ว | ต้องแก้อะไร | test บังคับ |
|---|---|---|---|
| 1 ★⚠️ | `apps/api/src/auth/auth.service.ts` → `adminResetPassword()` **(งานใบเดียว 2 เงื่อนไข)** | **(ก) C-2 fail-closed** (§3.3): นับ membership active ของ target ใน org อื่น > 0 ⇒ `targetOk = false` → **404 รูปเดิม** · emit `…blocked_multi_org` · **(ข) NEW-1/D-030:** target เป็น Owner (`full_access`) และผู้เรียกไม่มี `full_access` ⇒ `targetOk = false` → **404 รูปเดิม** · emit **`…blocked_owner_target`** · **(ค) NEW-5(ก):** ทั้งบล็อกอยู่ใน **tx เดียว** (`User` row `FOR UPDATE` → นับ → ตรวจ Owner → เขียน → นับซ้ำ) | unit **7 เคส** (ก)–(ช) §3.3 · **int บังคับ 2 ชุด** (C-2: 2 org + รหัสเดิมยัง login ได้ + เคสควบคุม · **NEW-1: Admin→Owner ได้ 404 + รหัส Owner เดิมยัง login ได้ + เคสควบคุม Owner→Owner สำเร็จ**) · ทั้งหมดเข้า **smoke tier ถาวร** · red→green **ทั้งสองเงื่อนไข** |
| 2 ★⚠️ | `apps/api/src/common/domain-exception.filter.ts` (+ `.test.ts`) | **`traceId` ต้องมีทุก error response** (qa Q12) · **NEW-7 — pin รูปแบบ + ถ้อยคำให้ไม่กำกวม:** ค่าเป็น **UUID v4 สุ่ม opaque** (ห้ามเรียงลำดับ/counter/timestamp/ห้ามฝังข้อมูลของ request — ค่าที่เดาได้บอกปริมาณทราฟฟิกและเดา traceId ของคนอื่นได้) · **server ออกค่าเสมอทุกครั้ง** ⇒ header `X-Request-Id` ที่ตอบกลับ = **ค่าที่ server ออก ไม่ใช่การสะท้อนค่าจาก client** (ของเดิม `extractTraceId` รับค่าจาก client จริง — ต้องเลิก) · ค่าที่ client ส่งมาเก็บเป็น `upstreamRequestId` **ใน log เท่านั้น** ห้ามขึ้น response | **เทสต์เดิม 3 เคสต้องกลับด้าน** (ปัจจุบัน assert ว่า *ไม่มี* `traceId` เมื่อไม่มี correlation id) · ใหม่: ทุก status มี `traceId` ไม่ว่าง · **ตรงรูปแบบ UUID v4** · 2 request ติดกันได้คนละค่า · **ส่ง `X-Request-Id` ปลอมเข้ามา → ค่าใน body/header ต้องไม่ใช่ค่านั้น** (U-API-20) · ค่าโผล่ใน log บรรทัดเดียวกัน · **500 ก็ต้องมี** (ใช้ 500-fixture §12.2 ข้อ 9) |
| 3 ★ | `apps/api/src/auth/throttle.service.ts` + **ไฟล์ใหม่** `src/common/client-ip.ts` | **N-3:** ยุบ IPv6 เป็น **/64** ก่อนทำ key (ของเดิมใช้ IP เต็ม ⇒ rate limit ต่อ IP ไร้ผลกับ IPv6) · helper ต้องมีที่เดียวและถูกใช้ทั้ง F-001 และ guard ใหม่ของ F-002 | 2 address ใน /64 เดียวกัน → key เดียวกัน · IPv4 ไม่เปลี่ยนพฤติกรรม · `TRUST_PROXY_HOPS` ยังกำหนด IP ต้นทางเหมือนเดิม |
| 4 ★ | `apps/api/src/auth/security-events.service.ts` | **ขยาย `SecurityEventType` union** ด้วย event ของ F-002 (§9 — **15 ค่า** รวม `org.member.left`, `org.tax_profile.revealed`, **`auth.password.admin_reset_blocked_owner_target`**) · **ไม่รื้อ transport** (EventEmitter ที่มีอยู่คือ test sink ที่ qa ขอ) | unit: emit แล้ว subscriber `"*"` ได้ครบ · **post-commit เท่านั้น** (tx rollback → ไม่ emit) · payload ของ `tax_profile.*` ไม่มีค่า TIN · payload ของ `admin_reset_blocked_*` ไม่มีรหัส/hash |
| 5 ★ | `apps/api/src/tenancy/org-scope.guard.ts` · `org-context.ts` (stub ของ F-000) | เปลี่ยนเป็นของจริง: **default-deny** + `OrgContextMiddleware` (ALS) + `req.orgAuth` (I-4) + **ไม่สร้าง context บน `@UserScoped()`/`@Public()`** (I-3) | failure matrix §1.4 ครบทุกแถว **โดยไม่แตะ `req.user`** · U-API-02/03 |
| **5b ★** *(amend #4 — NEW-3)* | **ไฟล์ใหม่** `apps/api/src/common/authz/capability.guard.ts` + `route-capabilities.ts` | `CapabilityGuard` **fail-closed กับ org-scoped route ทุก method รวม `GET`** (ร่างเดิมครอบเฉพาะ mutating ⇒ read ที่ลืมประกาศตกเป็น "สมาชิกคนไหนก็ได้") · export `ROUTE_CAPABILITIES` · **`ANY_ACTIVE_MEMBER_ROUTES` = `{ mutating: [1], read: [2] }`** (§3.1) | unit: org-scoped `GET` ที่ไม่มี metadata → **403 + log `capability_metadata_missing`** · `@AnyActiveMember` → ผ่าน · **I-02/G-13 ของ qa ต้องเทียบ allowlist ราย tier** |
| 6 ★ | `packages/db/src/tenancy.ts` (`withOrgScope` pass-through stub) | implement จริงตาม §2.2 **รวมนโยบาย "operation นอกตาราง = throw"** + export `ORG_SCOPE_OPERATION_STRATEGY`, `orgScopedModels`/`orgAgnosticModels` · **+ (NEW-8) export `USER_SELECT` (frozen) ให้เป็นทางเดียวที่ feature module แตะ `User` ได้** | U-DB-01..07 (โดยเฉพาะ **M-9 แถวต่อแถว** และ **U-DB-07 enumeration**) — ถ้าแถวไหนพิสูจน์ไม่ผ่าน **ต้องแก้ §2.2 ก่อน merge** · **+ unit: `USER_SELECT` freeze จริง/ไม่มี relation key · + เคส nested read "ลงกลับ" (I-35)** |
| **6b ★** *(amend #4 — NEW-4)* | **ไฟล์ใหม่** `packages/db/src/org-lock.ts` (+ การเรียก `$transaction` ทุกเส้นในลิสต์ §5) | `lockCurrentOrganization` ตั้ง **`SET LOCAL lock_timeout`** ก่อน `FOR UPDATE` · ทุก `$transaction` ของกลุ่มนี้ส่ง `{ timeout, maxWait }` จาก **`ORG_TX_TIMEOUTS`** · **แมป `55P03`/`40P01`/`P2028`/pool-timeout → `409 CONFLICT` + `details.reason='busy'`** (ห้าม 500) · export **`ORG_LOCK_REQUIRED_OPERATIONS`** (7 รายการ — §12.2 ข้อ 6) | unit: helper ยิง `SET LOCAL` ก่อน `FOR UPDATE` · การแมป error 4 ชนิด → 409 ไม่ใช่ 500 · **int 1 เคส:** ยึด lock ค้างแล้วยิงซ้ำ org เดียวกัน → **409 ภายใน ~3 s** · เคสควบคุม org อื่น → 200 |
| 7 | `apps/api/src/auth/*.controller.ts` (`auth.controller.ts`, `members.controller.ts`) | **จัดชั้น route ให้ครบ:** `/auth/*` = `@Public()` · `reset-password` = `@UserScoped()` (คง 404-never-403 + capability inline เดิม **ไม่เปลี่ยน wire**) · ลงทะเบียนใน `ROUTE_CAPABILITIES` | **route-registry test ครอบ route ของ F-001 ด้วย** (qa Q10) — route ที่ไม่ถูกจัดชั้น = แดง |
| 8 | `packages/config/src/env.ts` | env ใหม่ 5 กลุ่ม (§6.4) + **export `ORG_RATE_LIMIT_DEFAULTS`** เป็นแหล่งเดียวของ default · **+ (NEW-4) `ORG_TX_TIMEOUTS` (`lockTimeoutMs=3000` · `txTimeoutMs=5000` · `maxWaitMs=2000`) env-tunable ด้วย `.regex(/^\d+$/)` + `.refine(lockTimeout < txTimeout)`** | U-CFG-01..06 (รวม **pin ค่านโยบาย** ตาม qa Q11) · **+ U-CFG: `lockTimeout ≥ txTimeout` ⇒ boot ไม่ขึ้น** |
| 9 ⚠️ | `packages/db/prisma/schema.prisma` + migration 2 ไฟล์ | delta ทั้งหมดของ [data-model §2/§4](data-model.md) **+ `Role.key`** (ux Q4) · `Invitation.token` → `tokenHash` (D-018) | I-31: `migrate deploy` สะอาด/ไม่มี drift · **precondition ต้อง abort ดังเมื่อ `Invitation` ไม่ว่าง** |
| 10 | `packages/db/prisma/seed.ts` | seed `PlanDefinition` 4 แถว (idempotent by `key`) — **ไม่มี = `POST /organizations` 503 ทุกเคส** | รัน seed 2 ครั้งติดกันแล้วผลเท่าเดิม (idempotent) |
| 11 ⚠️ | `packages/contracts/openapi/**` | เพิ่ม 17 endpoint + schema ใหม่ · **แตกไฟล์เป็น `paths/*.yaml` + `components/*.yaml` แล้ว `redocly bundle`** (ไฟล์เดียวจะทะลุ ~2,000 บรรทัด) · regen TS + Dart | `contracts-drift` ว่าง · **`oasdiff` ไม่มี breaking change** · client 2 ฝั่ง build ผ่าน |
| 12 | `apps/api/test/**` (ของใหม่ แต่ผูกกับ lane ที่มีอยู่) | `f002-seed.kit.ts` + CLI (**รวมการตั้ง/สลับ `Role.key` และ `key=null`** — §12.2 ข้อ 8) · `org-leak.kit.ts` · `route-registry` helper · assertion กลาง (PII/header/traceId/schema) · **500-fixture ที่ compile เฉพาะโปรไฟล์ test** (§12.2 ข้อ 9) — §12.2 | qa เป็นผู้ใช้ · ผมรับผิดชอบว่า **kit ทำงานจริงและแดงได้จริง** (meta-test I-09/G-05) · **+ smoke: โปรไฟล์ production ไม่มี route ของ 500-fixture** |
| 13 | **@devops** — CI job `integration-api` | env ใหม่ + ขั้น **`prisma db seed`** (§12.3) · **+ (NEW-4) `connection_limit` ของ `TEST_DATABASE_URL` ต้อง ≥ จำนวน request ขนานของ §8 (ไม่งั้นขนานปลอม)** | lane-enabled guard (I-37) จะแดงถ้าไม่ทำ — **ตั้งใจ** |
| 14 | เอกสาร: `docs/features/F-001-authentication.md` | บันทึกการเปลี่ยนพฤติกรรม **3** ข้อ (admin-reset แคบลง **2 รอบ**: multi-org + Owner-target · `traceId` มีเสมอ) — §14 | — (PM ทำตอน sync-back) |

**สรุปสิ่งที่ "สัญญาไม่เปลี่ยน แต่ความหมายเปลี่ยน" (ต้องประกาศด้วยคน เพราะ `oasdiff` เงียบ):**
1. `POST /orgs/{orgId}/members/{userId}/reset-password` — เคสที่เคยได้ `200` (พนักงานที่เป็นสมาชิกหลาย org) จะได้ `404`
2. **ทุก error response ของทั้งระบบ** จะมี `error.traceId` เพิ่มเข้ามา (เดิมมีเฉพาะเมื่อ gateway ส่ง correlation id)
   — additive ต่อ schema (optional เหมือนเดิม) แต่ **body ไม่ byte-identical กับของเดิม** ⇒ เทสต์ใดที่เทียบ body
   ทั้งก้อนต้องปรับ (รวม `I-08` ของ qa ที่เทียบ "ตรงกันทุก byte" — ต้องตัด `traceId` ออกก่อนเทียบ)
3. **(amend #4 · NEW-1/D-030)** `POST /orgs/{orgId}/members/{userId}/reset-password` — เคสที่เคยได้ `200`
   (**Admin รีเซ็ตรหัสให้ Owner ใน org เดียวกัน**) จะได้ `404` · ไม่มี code/status ใหม่ ⇒ `oasdiff` เงียบสนิท
   ⇒ **int test เป็นสิ่งเดียวที่จับได้** (§15 แถว 1) และ FE/QA ต้องรู้ว่านี่คือผลตั้งใจ
4. **(amend #4 · NEW-2)** `POST /orgs/{orgId}/invitations/{id}/link` — ผู้มี `manage_members` ที่**ไม่มี `full_access`**
   จะได้ `403 FORBIDDEN` เมื่อคำเชิญใบนั้นเป็น **role ที่มี `full_access`** (เดิมผ่านทุกใบ) · `403` ถูกประกาศไว้ใน
   §3.12 อยู่แล้ว ⇒ ไม่มี status ใหม่
5. **(amend #4 · NEW-9)** `acceptedUserCreatedAfterInvite` เปลี่ยน **นิยาม** (เทียบกับ `Invitation.createdAt`
   แทน `tokenIssuedAt`) ⇒ ชนิด/ชื่อ field เท่าเดิม แต่ธงจะเป็น `true` ในเคสที่มากกว่าเดิม (เข้มขึ้น, เจตนา)
6. **(amend #4 · NEW-4)** ทุก endpoint ที่คว้า org lock อาจคืน **`409 CONFLICT` ที่มี `details.reason='busy'`**
   ในสภาวะแย่ง lock (เดิมสภาวะนี้จะเป็น `500`) — `409` ถูกประกาศไว้ทุกเส้นในกลุ่มนี้แล้ว ⇒ ไม่มี status ใหม่

**สรุปตาราง §15 หลัง amend #4: 16 แถว · ★ = 8 แถว (1 · 2 · 3 · 4 · 5 · 5b · 6 · 6b)** — แถวที่ **เพิ่มใหม่ในรอบนี้:
5b (CapabilityGuard ครอบ read) · 6b (org-lock + timeout policy)** และแถว **1** ถูกขยายเป็น **งานใบเดียว 2 เงื่อนไข**
(C-2 + NEW-1) ตาม D-030 ⇒ **★-task ที่แตกได้ตรงจากตารางนี้ = 8 ใบ** (+ แถว 12 = งาน kit/meta-test ที่ qa เป็นผู้ใช้)

---

## §16 สถานะการปิด finding ของ delta review (§H) — ไล่ทีละข้อ

> ตารางนี้มีไว้ให้ตรวจว่า "ปิดจริงหรือแค่เขียนว่าปิด" · ช่อง **ที่อยู่** = จุดในเอกสารที่ *บังคับ* ให้เป็นจริง
> ไม่ใช่ที่ที่พูดถึงเฉย ๆ · ข้อที่ **ไม่รับ** เขียนเหตุผลไว้ ไม่ปล่อยเงียบ

| finding | สถานะ | ที่อยู่ / เหตุผล |
|---|---|---|
| **NEW-1** (Critical) admin-reset ยึดบัญชี Owner ใน org เดียวกัน | ✅ **ปิด** (D-030 ข้อ 1) | §3.3 (เงื่อนไขที่ 2 + เมทริกซ์ 7 เคส + int 2 ชุด) · §9 event ใหม่ · §15 แถว 1 (★, red→green) · ราคาที่รับ = §13 ข้อ 20 + forward-commitment F-081 (§14) |
| **NEW-2** (Important) reissue ไม่ผ่าน `canAssignRole` | ✅ **ปิด** | §3.2 (call site ที่ 4) · §7.4 (ลำดับใน tx) · §7.6 (compensating control) · **ไม่แตะ wire** (403 ประกาศไว้แล้วที่ §3.12) · ส่วนขยาย "reissue ใบที่หมดอายุ → 409" = **ไม่รับ พร้อมเหตุผล** (§3.2 ท้าย NEW-2) |
| **NEW-3** (Important) fail-closed ไม่ครอบ read | ✅ **ปิด** | §1.3 (guard ครอบทุก method) · §1.4 · §3.1 (`ANY_ACTIVE_MEMBER_ROUTES` แยก 2 tier — **แก้ความขัดกันกับ G-13**) · §2.3 ข้อ 5 · §15 แถว 5b |
| **NEW-4** (Medium) ไม่มีนโยบาย tx/lock timeout | ✅ **ปิด** | **§5.2** (ค่า 3 ตัว + การแมป error 4 ชนิด → `409` + ห้าม retry อัตโนมัติ + metric) · §6.4/§15 แถว 8 (env) · §15 แถว 6b |
| **NEW-5(ก)** TOCTOU นอก tx | ✅ **ปิด** | §3.3 (tx เดียว + `FOR UPDATE` + นับซ้ำหลังเขียน) · **ส่วนที่เหลือประกาศตรง ๆ ว่าเป็นความเสี่ยงชนิดเดียวกับ (ข)** |
| **NEW-5(ข)** ไม่มี force-change password | 🔁 **ส่งต่อ F-081** | §3.3 (bullet สุดท้าย) + **forward-commitment F-081** พร้อม trigger (§14) — user เห็นราคาแล้วผ่าน D-030 |
| **NEW-6** (Medium) data-model §3.3 ขัด api-spec | ✅ **ปิด** | [data-model §3.3](data-model.md) เขียนใหม่ให้ตรง reveal-only + summary ข้อ 7 |
| **NEW-7** (Minor) `traceId` ไม่ pin รูปแบบ | ✅ **ปิด** | §15 แถว 2 (UUID v4 opaque · server ออกค่าเสมอ · `X-Request-Id` ไม่ใช่การสะท้อนค่า client) + api-spec §1 แถว `traceId` |
| **NEW-8** (Minor) C-3 ไม่ครอบ nested read "ลงกลับ" | ✅ **ปิด** | §2.2 กติกาข้อ 4 + **`USER_SELECT` frozen (บังคับเชิงโครงสร้าง ไม่ใช่ grep อย่างเดียว)** · §2.3 grep gate · เคสให้ qa ที่ I-35 |
| **NEW-9** (Minor) rotate ล้างธง forensic | ✅ **ปิด** | §7.6 (คำนวณจาก `Invitation.createdAt`) · §14 sync-back docs/01 · §15 รายการความหมายเปลี่ยน ข้อ 5 |
| **NEW-10** (Minor) `canAssignRole` ไม่กัน privilege-superset | 🔁 **ส่งต่อ F-003** (D-030) | §3.2 (กล่อง "ขอบของกฎที่ยังไม่ปิด" + trigger) · forward-commitment F-003 (§14) |
| **NEW-11** (Minor) reveal เปิดถึง Admin | ✅ **ยืนยันตามเดิม** (D-030 ข้อ 2) | §3.1 (เหตุผล + ตัวคุม 5 อย่าง) · api-spec §3.16 · ส่วน "Owner ยังไม่มีจอเห็น event" → forward-commitment F-005 (§14) |
| **NEW-12** (Nit) test-plan อ้าง §20 | ➡️ **ของ @qa** | ไม่ใช่ไฟล์ของผม — ระบุไว้ที่ §13 ข้อ 21(ช) |

**รู 4 ข้อของ finding เดิมที่ §H ระบุว่า "ปิดแต่ยังมีรู":**

| finding เดิม | ปิดเต็มหรือยัง | ส่วนที่เหลือไปอยู่ที่ไหน + trigger |
|---|---|---|
| **C-1** Admin ยกตัวเองเป็น Owner | ✅ **ปิดเต็มใน F-002** — call site ของ `canAssignRole` ครบ **5 เส้น** แล้ว (`PATCH`/`DELETE` members · create invite · **reissue** · **admin-reset**) + accept ปิดทางอ้อมด้วย I-9 | เหลือเฉพาะมิติ **privilege-superset** (มอบ capability ที่ตัวเองไม่มี) ซึ่ง **เป็นไปไม่ได้ใน F-002** (role คงที่ 3 ตัว, ไม่มี role CRUD) ⇒ **F-003** · trigger = feature ที่เปิดให้สร้าง/แก้ capabilities ของ role |
| **C-3** query ตั้งต้นจาก model org-agnostic | ✅ **ปิดเต็มเท่าที่ชั้น client-extension ทำได้** — กติกา 4 ข้อ + `USER_SELECT` + grep + int (5 persona) + เคส nested "ลงกลับ" | สิ่งที่ชั้นนี้ทำไม่ได้เชิงหลักการคือ **การบังคับที่ระดับ DB** ⇒ **Postgres RLS = F-087** (ตัดสินไว้แล้วที่ backend.md §3.3) · trigger = เมื่อมี tenant ภายนอกจริง (ไม่ใช่ dogfood) หรือเมื่อมี query path ที่ไม่ผ่าน Prisma |
| **I-2** ลืม `@RequireCapability` = รั่วเงียบ | ✅ **ปิดเต็ม** — fail-closed ครอบ **ทุก method** + allowlist ของชั้นที่อ่อนที่สุดถูก pin ราย tier + CI 2 ชั้น (I-02 + G-13) | เหลือเฉพาะ "capability ที่ประกาศ **ผิดตัว**" (ประกาศครบแต่เลือก capability อ่อนไป) — จับด้วยคนตอน review เท่านั้นจนกว่า **F-003** จะมี registry ที่ผูก capability กับ resource · trigger = F-003 |
| **I-7** email binding ไม่มีฐานใน Phase 0 | 🔁 **ปิดไม่ได้ใน F-002 โดยธรรมชาติ** (ไม่มี SMTP) — แต่รูที่ delta review ชี้ **ปิดครบทั้ง 2 จุด**: reissue อ้อม Owner-only (NEW-2 ✅) · rotate ล้างธง (NEW-9 ✅) | ตัว control จริง = **email verification ที่ F-081** · trigger = **ทันทีที่มี SMTP** และ **บล็อกการเปิดขายจริง** (ระบบที่ยืนยัน email ไม่ได้ ห้ามมีลูกค้าจริง) — เขียนไว้ที่ forward-commitment §14 |
