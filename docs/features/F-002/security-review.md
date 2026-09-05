---
doc: security-review
owner: "@security-reviewer"
signoff: approved   # user 2026-07-29 — ตาม verdict §H (ผ่านแบบมีเงื่อนไข); delta review รอบ 2 เลื่อนไป ★-task review ก่อน merge
---
# [F-002] Security review — Gate-2 design (architecture / data-model / api-spec DRAFT)

> advisory เท่านั้น — **`backend-api` เป็นเจ้าของสัญญา** ผมไม่แก้ไฟล์ของเจ้าของอื่น ·
> ทุกข้อที่ติด **D-XXX** ต้องให้ user เคาะก่อน lock contract

## Contract summary (≤20 บรรทัด)

1. **Verdict (รอบแรก 2026-07-27): ไม่ผ่านตามที่ร่าง (has-blocking-concerns)** — 4 ข้อ Critical ต้องปิดก่อน lock contract · ที่เหลือแก้ระหว่าง build ได้
   · ✅ **Verdict ล่าสุด (2026-07-28 — ผลของ delta review §H หลัง amend 2 รอบ + D-027/D-028/D-029, contract LOCKED):**
   **ผ่านแบบมีเงื่อนไข (ready-with-conditions)** — finding เดิม 29 ข้อ: **ปิดจริง 25 · ปิดแต่ยังมีรู 4** (C-1/C-3/I-2/I-7) ·
   **finding ใหม่ 12** (Critical 1 · Important 2 · Medium 3 · Minor 5 · Nit 1) · เงื่อนไข 4 ข้อก่อน build → **§H.4**
2. นับ finding: **Critical 4 · Important 10 · Minor 11 · Nit 4**
3. เอกสารชุดนี้คุณภาพสูงในชั้น **tenant isolation แนวนอน** (org A ↔ org B) — สิ่งที่ขาดคือชั้น **แนวตั้ง (privilege ภายใน org)** และ **ขอบ identity ที่ข้าม org ผ่าน User เดียวกัน**
4. **C-1 · privilege escalation:** ใครก็ตามที่มี `manage_members` (= Admin) ยก **ตัวเอง** เป็น Owner ได้ → ยึด org เบ็ดเสร็จ · ไม่มีกฎว่า "เฉพาะ Owner ที่ให้ role Owner ได้" ทั้งใน architecture §3 และ api-spec §3.8/§3.11 → **D-XXX**
5. **C-2 · cross-tenant account takeover:** F-001 `reset-password` เปลี่ยน `User.passwordHash` **ระดับ global** · F-002 ทำให้ "1 user หลาย org" เป็นจริง ⇒ Admin ของ org B รีเซ็ตรหัสสมาชิกที่เป็น **Owner ของ org A** แล้วล็อกอินเป็นคนนั้นได้ → **D-XXX**
6. **C-3 · cross-org read leak ที่ `withOrgScope` ครอบไม่ถึง:** query ที่ตั้งต้นจาก model ใน allowlist org-agnostic (`User`) + `include` ลูก = อ่านข้าม org ได้เงียบ ๆ — เอกสารพูดถึงเฉพาะ nested **write**
7. **C-4 · `include: { user: true }`** ที่ data-model §3.5 แนะนำตรง ๆ = `passwordHash` ขึ้น wire ให้สมาชิกทุกคนเห็น
8. Important ที่กระทบสัญญา (ต้องแก้ **ก่อน** lock): I-5 (แยก error code "ไม่ใช่สมาชิก" ออกจาก `FORBIDDEN`), I-6 (token อยู่ใน query string), I-8 (TIN เต็มเปิดให้ Staff เห็น)
9. Important ที่เป็นช่องคงอยู่ (persistence): I-1 revoke แล้วกลับเข้ามาได้ด้วยคำเชิญค้าง · I-2 `requireCapability()` **ลืมเรียก = รั่วเงียบ** ขัดหลัก "ลืมแล้วพัง" ของ §1.1 เอง
10. ข้อที่ผู้เขียนยกมาเองแล้ว (§13 rotate token / การตีความ AC US-5) — **ผมเห็นด้วยทั้งสองข้อ** และไม่ถือเป็น finding ใหม่ (รายละเอียด §"ยืนยันว่าถูกแล้ว")
11. ที่ต้องเป็น **D-XXX (user เคาะ)**: C-1 · C-2 · I-1 · I-7 · I-8 — ที่เหลือ `backend-api` แก้เองได้ในเอกสาร
12. ไม่มีการละเมิดกฎทอง 2/5/7 (F-002 ไม่แตะ ledger/เงิน/สต๊อก — ยืนยันจาก data-model §1 + grep) · กฎทอง 3 = ดีในเชิงกลไก แต่มีรู C-3 · กฎทอง 4/6 ครบ
13. อ่านต่อ: findings §A–§D · สิ่งที่ verify แล้วว่าถูก §E · สิ่งที่ผมไม่ได้ review §F

---

## §A Critical — ต้องปิดก่อน lock contract

### C-1 · `manage_members` = ยกตัวเองเป็น Owner ได้ → ยึด org เบ็ดเสร็จ  **[D-XXX]**

**อาการ:** ไม่มีที่ไหนในเอกสารจำกัดว่า "ใครให้ role **Owner** ได้" หรือ "ใครแตะ membership ของ Owner ได้" —
api-spec §3.8 (`PATCH /orgs/{orgId}/members/{userId}`) และ §3.11 (invite) ระบุ permission แค่ `manage_members`
ซึ่ง **Admin มีอยู่แล้ว** (data-model §5.2) และ §3.8 อนุญาต "ทำกับตัวเองได้" อย่างชัดแจ้ง

**สถานการณ์ที่พังจริง:**
```
org มี Owner = U1 · Admin = A (capabilities มี manage_members)
1. A: PATCH /orgs/X/members/A   { roleId: <Owner role id> }   → 200 (ผ่าน manage_members)
2. A: hasCapability(["full_access"]) = true  → A ทำได้ทุกอย่างเทียบเท่า U1
3. A: DELETE /orgs/X/members/U1  → 200 (owner เหลือ A คนเดียว, assertOwnerRemains ผ่าน)
⇒ Admin ยึด org, ถอดเจ้าของจริงออก, ไม่มี endpoint กู้คืน (F-085 ยังไม่มี)
```
ทางที่สองที่ให้ผลเดียวกัน: `POST /orgs/X/invitations { email: <อีเมลของ A เอง/ของพวก>, roleId: Owner }` →
accept → ได้ Owner โดยไม่ต้องแตะ membership ตัวเอง (ผ่าน rate limit ปกติ)

**เกี่ยวกับ:** `api-spec.md §3.8`, `§3.11`, `architecture.md §3` (ประกาศ capability แค่ 2 ตัว), `data-model.md §5.2`
**ข้อเสนอ (เล็กที่สุดที่ปิดได้):** เพิ่ม pure fn `packages/core-domain/src/orgs/member-authz.ts`
`canAssignRole({ actorCapabilities, targetIsOwner, newRoleIsOwner })` — กฎ: **ต้องมี `full_access` เท่านั้น**
จึงจะ (ก) กำหนด/เชิญด้วย role ที่ `isSystem && name=Owner` (ข) แก้/ถอด membership ที่ปัจจุบันเป็น Owner ·
ไม่ผ่าน → `403 FORBIDDEN` (ไม่ต้องเพิ่ม code ใหม่) + test matrix ประกบ
**ทำไมต้อง D-XXX:** AC US-6 เขียนว่า "**Owner** ยกระดับสมาชิกอื่นเป็น Owner ได้" — ตีความได้ว่า Owner-only
อยู่แล้ว แต่ปัจจุบัน design ให้ Admin ทำได้ด้วย ⇒ ต้องยืนยันเจตนากับ product/user ก่อน (Owner to action: @backend-api หลัง user เคาะ)

---

### C-2 · F-001 admin-reset × F-002 multi-org = ยึดบัญชี **ข้าม tenant**  **[D-XXX]**

**อาการ:** `POST /orgs/{orgId}/members/{userId}/reset-password` (F-001, ยังอยู่เหมือนเดิมตาม architecture §1.1
และ api-spec §2 หมายเหตุท้ายตาราง) เขียนทับ `User.passwordHash` ซึ่งเป็น **credential ระดับ global**
(`apps/api/src/auth/auth.service.ts:206-212` + `refresh-token.service.ts:289` revoke ทุก family ของ user)
F-002 คือ feature ที่ทำให้ "1 user หลาย org" (AC US-2) เป็นจริง ⇒ ขอบเขตของ endpoint นี้เปลี่ยนไปคนละเรื่อง
โดยที่เอกสาร F-002 บันทึกไว้แค่ว่า "พฤติกรรมบน wire ไม่เปลี่ยนแม้แต่ status เดียว"

**สถานการณ์ที่พังจริง:**
```
สมชาย เป็น Owner ของ org A (ร้านตัวเอง) และรับจ้างทำบัญชีให้ org B
1. Admin ของ org B เชิญสมชาย → สมชาย accept → เป็นสมาชิก active (role Staff) ของ B
2. Admin ของ B: POST /orgs/B/members/<สมชาย>/reset-password { newPassword: "…" } → 200
   (เงื่อนไขครบ: caller active + manage_members, target active member ของ B)
3. Admin ของ B ล็อกอินด้วย email ของสมชาย + รหัสใหม่ → ได้ session ของสมชาย
4. ⇒ เข้าถึง org A ในฐานะ Owner ได้เต็ม (สต๊อก/เอกสารภาษี/สมาชิก) — ข้าม tenant boundary
```
สมชายรู้ตัว (ถูก logout ทุกเครื่อง) แต่หลังความเสียหายเกิดแล้ว · เคสนี้ตรงกับ persona ที่ Gate 1 เขียนไว้เอง
("1 คนถือได้หลาย license") จึงไม่ใช่เคสสมมติ

**เกี่ยวกับ:** `architecture.md §1.1` (ตัดสินคง endpoint ไว้), `api-spec.md §2` (บรรทัดใต้ตาราง)
**ข้อเสนอ (เรียงจากถูกที่สุด):**
- (a) **fail-closed ที่ target หลาย org:** ปฏิเสธ admin-reset ถ้า target มี `Membership active` ใน org อื่นนอกเหนือจาก org นี้
  → คืน 404 รูปเดิม (คง 404-never-403) · ตรวจได้ด้วย query เดียว, ไม่แตะ contract, ไม่แตะ wire
- (b) เปลี่ยนเป็น "ออก reset link/temp password ที่ต้องเปลี่ยนเมื่อล็อกอินครั้งแรก" — แพงกว่าและไม่มี transport (D-012)
- (c) ยอมรับความเสี่ยงแบบมีเงื่อนไข (dogfood-only) แล้วผูกเป็น pre-prod gate เหมือน D-016
**ทำไมต้อง D-XXX:** เป็นการ **ลดความสามารถของ endpoint ที่ ship แล้ว** + เป็นการตัดสินความเสี่ยง → user/product เคาะ
(Owner to action: @backend-api implement, @product ตัดสินระดับความเสี่ยง)

---

### C-3 · `withOrgScope` ครอบไม่ถึง query ที่ **ตั้งต้นจาก model org-agnostic** + nested include

**อาการ:** architecture §2.2 ระบุ allowlist org-agnostic (`User`, `RefreshToken`, `Channel`, `PlanDefinition`)
และพูดถึงความเสี่ยงของ nested **write** ไว้ (พึ่ง NOT NULL ให้พัง) แต่ **ไม่พูดถึง nested read เลย** ·
Prisma client extension ระดับ `$allModels.$allOperations` เห็นเฉพาะ operation ชั้นบนสุด — `include`/`select`
ของ relation ชั้นลูก **ไม่ถูก intercept** ⇒ ถ้า query เริ่มที่ model ที่ไม่ถูก scope ทั้งสายจะไม่ถูกกรอง

**สถานการณ์ที่พังจริง:**
```ts
// feature module ใด ๆ ที่ต้องการ "โปรไฟล์ผู้ใช้ + org ที่เขาสังกัด"
orgPrisma.user.findUnique({
  where: { id: someUserId },                       // User = allowlist → ไม่ inject organizationId
  include: { memberships: { include: { organization: true, role: true } } },
});
// ⇒ คืน membership + ชื่อ org + role ของ "ทุก org" ที่ user คนนั้นสังกัด
//    ให้ผู้เรียกที่อยู่ org เดียว — cross-tenant leak ที่ int test แบบ "ยิง endpoint ของ F-002 ด้วย token org B"
//    จับไม่ได้ เพราะมันไม่ได้อ่านข้อมูลของ org B แต่อ่านของ org ที่สาม
```
**ทำไม Critical:** F-002 คือ feature ที่ตั้ง pattern ให้ ~40 feature ถัดไป (§0 บอกเองว่า "หลังจากนี้ทุก feature
ได้ org scoping ฟรี") — ประโยคนั้นเป็นจริงเฉพาะ query ที่ตั้งต้นจาก model org-scoped · รั่วแบบเงียบ + ถาวร

**เกี่ยวกับ:** `architecture.md §2.2` (ตารางพฤติกรรมต่อ operation), `§2.3` (boundary gates), `data-model.md §3.5`
**ข้อเสนอ:**
1. เขียนกติกาให้ชัดใน §2.2: **ห้าม feature module ตั้งต้น query จาก model ใน org-agnostic allowlist** —
   ต้องตั้งต้นจาก model org-scoped แล้ว `include` ขึ้นไป (`membership.findMany({ include: { user: … } })`)
2. `packages/db/src/org-models.ts` ประกาศ allowlist อยู่แล้ว → เพิ่ม **grep/depcruise gate**: `orgPrisma.user.` /
   `orgPrisma.channel.` ฯลฯ นอก `orgs/system/` = แดง
3. เพิ่ม int test ลง `org-leak.kit.ts`: จาก context org B เรียก `user.findUnique + include memberships`
   ต้องไม่คืนแถวของ org A (ถ้าเลือกทาง "ให้ extension inject ให้ nested ด้วย" ก็ต้องมี test ตัวนี้อยู่ดี)
(Owner to action: @backend-api · test → @qa)

---

### C-4 · `include: { user: true }` ที่ data-model §3.5 แนะนำ = `passwordHash` ขึ้น wire

**อาการ:** data-model §3.5 "N+1 discipline" เขียนว่า *"member list ดึง `user` + `role` ด้วย `include` ชุดเดียว"* ·
`User` มีคอลัมน์ `passwordHash` (schema.prisma) และ api-spec §3.7 ประกอบ response จากแถวนั้น ·
ไม่มีบรรทัดไหนบังคับ `select` แบบระบุคอลัมน์

**สถานการณ์ที่พังจริง:** implementer ทำตามคำแนะนำตรง ๆ →
`membership.findMany({ include: { user: true, role: true } })` → mapper เขียนแบบ spread (`...m.user`) หรือ
DTO หลุด 1 field ⇒ `GET /orgs/{orgId}/members` คืน argon2 hash ของสมาชิกทุกคนให้ **สมาชิก active ทุกคนรวม Staff**
(§3.7 อ่านได้โดยไม่ต้องมี `manage_members`) — hash หลุด = brute-force offline ได้ + เป็น credential ระดับ global (ดู C-2)

**เกี่ยวกับ:** `data-model.md §3.5`, `api-spec.md §3.7`
**ข้อเสนอ:** เปลี่ยนถ้อยคำเป็น **`select` เสมอ ห้าม `include` บน `User`** (`user: { select: { id: true, email: true } }`)
+ int test assert ว่า response ของทุก endpoint ไม่มี key `passwordHash`/`tokenHash` (เขียนเป็น assertion กลางใน kit
ครั้งเดียว ใช้ได้ทุก feature) — ราคาถูกและกันทั้งตระกูล (Owner to action: @backend-api + @qa)

---

## §B Important

### I-1 · revoke แล้ว "ปลุก membership กลับ" ด้วยคำเชิญค้าง = ช่องคงอยู่ (persistence)  **[D-XXX]**
**อาการ:** architecture §7.4 ระบุ *"membership เดิม status=revoked → เชิญใหม่ได้ (accept จะปลุก membership กลับเป็น active)"*
และ api-spec §3.15 *"เคย revoked มาก่อน → กลับมาเป็น active"* · แต่ **ไม่มีที่ไหนบอกว่า "ถอดสมาชิก → ยกเลิกคำเชิญ
pending ของ email นั้น"**
**สถานการณ์:**
```
A เป็น Admin (manage_members) ของ org X และกำลังจะถูกถอด
1. A: POST /orgs/X/invitations { email: <email ของ A เอง>, roleId: Admin }  → pending 7 วัน
   (ผ่าน? ต้องเช็ค: AC บอก "เชิญคนที่เป็นสมาชิกอยู่แล้ว → 409 ALREADY_MEMBER" ⇒ A ใช้ email สำรองของตัวเอง
    หรือรอจังหวะหลังถูกถอด — คำเชิญที่ค้างอยู่ก่อนถูกถอดก็ยัง valid เพราะไม่มีใครยกเลิกให้)
2. Owner: DELETE /orgs/X/members/A → revoked, request ถัดไป 403 (ทำงานถูกต้อง)
3. A: POST /invitations/accept { token }  → membership กลับเป็น active role Admin
⇒ การถอดสมาชิกไม่มีผลจริงภายใน window 7 วัน และ Owner ไม่เห็นสัญญาณอะไรนอกจากแถวสมาชิกกลับมา
```
**ข้อเสนอ:** (ก) `DELETE members/{userId}` ต้อง `updateMany` invitation ของ email นั้นใน org นี้ที่ยัง pending → `cancelled`
**ในtx เดียวกัน** (ข) `POST /invitations/accept` ต้องปฏิเสธถ้ามี membership เดิม `revoked` ที่ `revokedAt > invitation.tokenIssuedAt`
(ค) ถ้ายอมให้ปลุกกลับได้จริง ต้อง emit event แยก (`org.member.reactivated`) ไม่ใช่กลืนใน `invitation.accepted`
**ทำไม D-XXX:** ข้อ (ข) เปลี่ยนพฤติกรรมที่ AC US-4 ไม่ได้พูดถึง — ต้องให้ product ยืนยันว่า "เชิญคนที่เคยถูกถอดกลับเข้ามา"
ต้องเป็นการเชิญ**ใหม่หลังถอด**เท่านั้น

### I-2 · `requireCapability()` = fail-open by omission — ขัดหลัก "ลืมแล้วพัง" ของเอกสารเอง
**อาการ:** architecture §1.1 ภูมิใจถูกต้องกับ default-deny ที่ชั้น org ("ลืมแล้วพัง ไม่ใช่ลืมแล้วรั่ว") แต่ §3 วาง authz
ชั้น capability เป็น **helper ที่ต้องเรียกเองที่บรรทัดแรกของ service method** — ลืมเรียก = **ไม่มีอะไรพัง แต่รั่ว**
**สถานการณ์:** implementer เขียน `revokeMember()` แล้วลืมบรรทัด `requireCapability(ctx,'manage_members')` →
Staff (สมาชิก active) ยิง `DELETE /orgs/X/members/<Owner คนที่สอง>` ได้ · guard ผ่านหมด (เป็นสมาชิก active),
`withOrgScope` ผ่าน (org เดียวกัน), `assertOwnerRemains` ผ่าน (ยังเหลือ 1) → 200 · ไม่มี test ไหนจับเพราะ test เขียนตาม
happy path ของแต่ละ endpoint
**ข้อเสนอ:** เพิ่ม **route-registry test** คู่กับ `org-leak.kit.ts`: ประกาศตาราง `endpoint → capability ที่ต้องมี`
ครั้งเดียว แล้ว test ยิงทุก mutating endpoint ด้วย token ของ Staff → ต้อง 403 ทุกเส้น · endpoint ใหม่ที่ไม่ได้ลงทะเบียน
= test แดง (ทำให้ "ลืม" กลายเป็น "พัง") · ทางเลือกที่แข็งกว่า: ประกาศ `@RequireCapability()` เป็น metadata ตั้งแต่ F-002
โดยให้ guard อ่าน ALS ctx (F-003 มาเติม registry ทีหลัง — wire ไม่เปลี่ยนตามที่ §3 ตั้งใจอยู่แล้ว)
(Owner to action: @backend-api · @qa สำหรับ kit)

### I-3 · org context ถูกสร้างจาก header ที่ผู้เรียกคุมได้ **แม้บน route user-scoped/public** → confused deputy ตอน accept
**อาการ:** §1.3 ให้ middleware resolve org **ทุก request** โดยไม่สนใจว่า route นั้นเป็น `@UserScoped()`/`@Public()`
⇒ บน `POST /invitations/accept` ผู้เรียกเลือกได้ว่า ALS ctx จะเป็น org ไหน (org ใดก็ได้ที่ตนเป็นสมาชิก active)
**สถานการณ์:** ผู้ใช้ M เป็นสมาชิกของ org B และถือ token คำเชิญของ org A →
`POST /invitations/accept` + `X-Organization-Id: B` · service ตาม §2.4 ใช้ `SYSTEM_PRISMA` อ่าน invitation ได้ถูก
แต่ถ้าโค้ดเส้นใดในเส้นทางนี้เผลอใช้ `ORG_PRISMA` (เช่นอ่าน `role.name` มาประกอบ response, นับสมาชิก, emit metric)
มันจะทำงานกับ **org B** — กรณีเลวสุดคือ `orgPrisma.membership.upsert(...)` ซึ่ง extension จะ inject
`organizationId = B` ให้เอง ⇒ สร้าง membership ผิด org พร้อม `roleId` ที่เป็น role ของ org A (FK เป็น `Role.id`
เดี่ยว ๆ ไม่ใช่ composite ⇒ DB ไม่ปฏิเสธ) = ข้อมูลปนข้าม org แบบไม่มีใครรู้
**ข้อเสนอ:** ให้ **fail loud แทนการฝากวินัย** — `OrgScopeGuard` (หรือ middleware) ต้อง **ล้าง/ไม่สร้าง** org context
สำหรับ route ที่ mark `@UserScoped()`/`@Public()` ⇒ ถ้าโค้ดในเส้นทางนั้นแตะ `ORG_PRISMA` จะได้
`MissingOrgContextError` → 500 ตาม failure matrix §1.4 แถวสุดท้าย (ซึ่งเป็นพฤติกรรมที่ต้องการอยู่แล้ว) ·
ถ้า accept ต้องการ context จริง ให้ service เรียก `OrgContextStore.run({ organizationId: inv.organizationId, … })`
เองหลังอ่าน invitation (รูปเดียวกับ worker ใน §2.1)

### I-4 · ลำดับ guard: `OrgScopeGuard` (global) รันก่อน `JwtAuthGuard` (controller) → `req.user` ยังไม่มี
**อาการ:** §1.3 เขียนว่า `@UserScoped()` → "ต้องมี `req.user` (JwtAuthGuard ทำงานตามปกติ) → ผ่าน" · แต่ใน NestJS
guard รันตามลำดับ **global → controller → route** และ `JwtAuthGuard` วันนี้ผูกที่ระดับ controller
(`apps/api/src/auth/members.controller.ts:33`, `auth.controller.ts`) ⇒ ตอน global guard ทำงาน `req.user` ยัง `undefined` เสมอ
**ผลที่จะเกิดจริง:** ทางที่ดี = ทุก route `@UserScoped()` ตอบ 401 ตลอด (พังดัง จับได้ตอน test) ·
ทางที่แย่กว่าและน่ากลัวกว่า = ภายใต้แรงกดดันเวลา คนแก้ด้วยการ "ให้ `@UserScoped()` ผ่านไปเลย" ⇒
`POST /organizations` / `POST /invitations/accept` กลายเป็น endpoint ที่ **ไม่มีการตรวจ auth ที่ชั้น guard กลาง**
เหลือแค่ `@UseGuards(JwtAuthGuard)` ราย controller ที่ลืมได้
**ข้อเสนอ:** ระบุใน §1.3 ให้ชัดว่า middleware ต้องแนบผลการ verify ลง request เอง
(`req.orgAuth = { userId?, tokenValid: boolean, orgOutcome: 'ok'|'no_membership'|'revoked'|'mismatch'|'none' }`)
แล้ว `OrgScopeGuard` ตัดสินจากค่านั้นทั้งหมด (ทั้ง 401/403/422 ของ §1.4) ไม่พึ่ง `req.user` · และ pin ด้วย unit test
ว่า `@UserScoped()` + token ปลอม → 401

### I-5 · `FORBIDDEN` ตัวเดียวปน "ไม่ใช่สมาชิก org นี้" กับ "ไม่มี capability" → เหตุผลที่เลือก 403 แทน 404 ไม่จริง
**อาการ:** §1.4 อ้างว่าเลือก 403 เพราะ "client taxonomy (D-025) แยก `ForbiddenFailure` เพื่อพากลับหน้าเลือก org ได้"
แต่ api-spec §4 ให้ทั้งสองกรณีใช้ code เดียวกัน (`FORBIDDEN`) ⇒ client แยกไม่ออก
**สถานการณ์:** Staff กดปุ่มที่ไม่ควรเห็น → 403 `FORBIDDEN` → web/mobile ทำตาม §1.4 คือ **เตะกลับหน้าเลือก org**
ทั้งที่ผู้ใช้ยังเป็นสมาชิกดี ๆ (UX พัง + ผู้ใช้เชื่อว่าถูกถอด) · หรือกลับกัน: ถูกถอดจริงแต่ client แสดงแค่ toast
"ไม่มีสิทธิ์" แล้วค้างอยู่ในหน้าเดิมที่ยิง 403 รัว ๆ
**ข้อเสนอ:** เพิ่ม code ใหม่ **`ORG_ACCESS_DENIED`** (403, map → `ForbiddenFailure`) สำหรับ "ไม่ใช่สมาชิก active ของ org นี้"
คงไว้ `FORBIDDEN` สำหรับ capability · **ไม่เปิด oracle** เพราะทั้ง "org ไม่มีจริง" และ "org มีแต่ไม่ได้เป็นสมาชิก"
คืนค่าเดียวกัน (guard ตัดสินจากผล membership lookup ที่ว่างเหมือนกันทั้งคู่) — ต้องเขียนกำกับไว้ให้ implementer ไม่แยกสองเคสนี้
เป็นคนละ code ภายหลัง (Owner to action: @backend-api ก่อน lock — เป็นการเพิ่ม code จึงยัง additive)

### I-6 · invite token เดินทางใน **query string** — รั่วผ่าน Referer / history / access log
**อาการ:** `GET /invitations/preview?token=…` (api-spec §3.14) และ `inviteUrl = ${WEB_APP_BASE_URL}/invite?token=…`
(architecture §7.3) · ไม่มีบรรทัดไหนพูดถึง `Referrer-Policy`, การถอด token ออกจาก URL หลังอ่าน, หรือการ scrub
query string ออกจาก access log — ทั้งที่ token ตัวนี้คือ **ความลับตัวเดียว**ที่กันคนนอกออกจาก org (ดู I-7)
**สถานการณ์:** ผู้ถูกเชิญเปิด `/invite?token=…` แล้วหน้านั้นโหลด resource ข้าม origin (font/analytics/รูป) →
`Referer: https://app.example.com/invite?token=…` หลุดออกไปนอกระบบ · หรือ token ค้างใน browser history/
proxy log/pino access log แล้วใครก็ตามที่อ่าน log ได้ = ยึดคำเชิญได้ทันที (accept ไม่ต้องพิสูจน์ email จริง — I-7)
**ข้อเสนอ:** (ก) เปลี่ยน preview เป็น `POST /invitations/preview` รับ token ใน body (ยัง public + rate-limited ได้เหมือนเดิม)
(ข) หน้าเว็บอ่าน token แล้ว `history.replaceState` ถอดออกจาก URL ทันที + ตั้ง `Referrer-Policy: no-referrer` บน route นั้น
(ค) ประกาศเป็นกติกาว่า **ห้าม log query string ของ `/invitations/*`** (ง) response ของ 3.11/3.12 ควรมี `Cache-Control: no-store`
(Owner to action: @backend-api (ก)(ค)(ง) · @frontend (ข) · @devops log scrubbing)

### I-7 · การ "ผูกคำเชิญกับ email" ไม่มีฐานรองรับใน Phase 0 — `User.verified` ไม่เคยเป็น true  **[D-XXX]**
**อาการ:** AC US-3 บอก token ต้อง "ผูกกับ email ที่เชิญ" และ api-spec §3.15 บังคับ
`normalizeEmail(user.email) === invitation.email` · แต่ as-built: signup เขียน `verified: false`
(`auth.service.ts:65`) และ login **ไม่เช็ค `verified`** (`auth.service.ts:84-113`) — ไม่มี flow ยืนยัน email
เลยจนถึง F-081 ⇒ ใครก็ตามที่ได้ลิงก์ **สมัครบัญชีด้วย email ของผู้ถูกเชิญ** แล้ว accept ได้ทันที
**สถานการณ์:** ลิงก์คำเชิญถูก forward ผิดกลุ่มไลน์ → คนที่เห็น: (1) เปิด preview เห็น `n***@example.com` + ชื่อ org
(2) เดา/รู้ email เต็มจาก domain + ชื่อพนักงาน (3) signup ด้วย email นั้น (ถ้ายังไม่มีบัญชี) (4) accept → เป็นสมาชิก org
· การเช็ค email จึงเป็น **การตกแต่ง** ไม่ใช่ control · หนักขึ้นเมื่อ role ที่เชิญคือ Owner/Admin (ดู C-1)
**ข้อเสนอ:** ไม่ต้องสร้าง email infra — แต่ต้อง **เขียนความจริงข้อนี้ลง threat model** แล้วเลือก compensating control:
(ก) ลด TTL คำเชิญที่ให้ role สูง (Owner/Admin) เหลือ 24 ชม. (ข) emit `org.invitation.accepted` พร้อม
`acceptedByUserId` + `userCreatedAt` เพื่อสืบย้อนได้ (ค) แสดงใน UI ของผู้เชิญว่า "ใครรับไปแล้ว/เมื่อไหร่"
(ง) ถ้า user ที่ accept ถูกสร้างหลัง `tokenIssuedAt` ให้ mark membership เป็น `needs_review` — ทางเลือกนี้แพง, เสนอเป็น option
**ทำไม D-XXX:** เป็นการยอมรับความเสี่ยง + อาจกระทบ AC US-3/US-4 → product/user เคาะ

### I-8 · TIN 13 หลัก (= เลขบัตรประชาชนเมื่อ `entityType=personal`) เปิดให้ **สมาชิก active ทุกคน** อ่าน  **[D-XXX]**
**อาการ:** api-spec §3.3 `GET /orgs/{orgId}` คืน `taxProfile.taxId` เต็ม และ §2 ตาราง permission ระบุแค่ "สมาชิก active"
· เขียน tax profile ต้องมี `manage_org_settings` แต่ **อ่านไม่ต้อง**
**สถานการณ์:** ร้านแบบบุคคลธรรมดา → `taxId` = เลขบัตรประชาชนของเจ้าของ · พนักงานรายวัน (Staff) เปิดแอป
กด `GET /orgs/{id}` ครั้งเดียวได้เลขบัตรประชาชนเจ้าของร้าน (PDPA: ข้อมูลส่วนบุคคลที่ต้องจำกัดการเข้าถึงตามความจำเป็น)
**ข้อเสนอ:** คืน `taxProfile.taxId` เต็มเฉพาะผู้มี `manage_org_settings` · คนอื่นได้ mask (`…-…-…-…-7` 4 ตัวท้าย)
หรือได้แค่ `taxProfileComplete` · เป็น field-level authorization ไม่ใช่ endpoint-level → เขียนใน api-spec §3.3 ให้ชัด
**ทำไม D-XXX:** เป็นการตัดสินเรื่อง "ใครควรเห็นอะไร" = product + PDPA posture ไม่ใช่ผมตัดสิน

### I-9 · `accept` แก้ role ของ membership ที่มีอยู่ **นอก** `lockOrganization` — ข้ออ้าง "accept ลด owner ไม่ได้" เปราะ
**อาการ:** architecture §5 ระบุ "operation ที่ไม่ต้อง lock: accept invitation (เพิ่มสมาชิก ไม่มีทางลด owner)" ·
แต่ §7.4 + api-spec §3.15 บอกว่า accept เป็น **upsert** ที่เขียนทับ `roleId` ของ membership เดิมได้
(เคส revoked → active, ดู I-1) ⇒ accept เป็น operation ที่**เปลี่ยน role ได้** ไม่ใช่ "เพิ่มสมาชิก" อย่างเดียว
**สถานการณ์:** วันนี้กันไว้ด้วยการเช็ค `ALREADY_MEMBER` **ตอนสร้างคำเชิญ** ซึ่งเป็น TOCTOU ยาว 7 วัน —
ทันทีที่ F-003 เพิ่มเส้นทาง "เพิ่มสมาชิกตรง ๆ" หรือ "reactivate member" (ซึ่งอยู่ใน backlog แน่นอน)
เคส "มี pending invite ค้างอยู่ ขณะที่คนนั้นกลายเป็น Owner คนสุดท้าย" จะเกิดได้ → accept ทับ role เป็น Staff →
**org เหลือ 0 Owner** โดยไม่มี lock/invariant ขวางเลย และไม่มี test ไหนจับ
**ข้อเสนอ (ถูกกว่าการรอให้พัง):** ให้ accept ทำ 1 ใน 2 (ก) `lockOrganization` + `assertOwnerRemains` เมื่อ target
มี membership เดิมที่ active (ข) **ไม่แตะ role ของ membership ที่ active อยู่แล้ว** — accept ที่เจอ membership active
ให้ตอบ `409 ALREADY_MEMBER` แล้ว mark invitation เป็น accepted (ทางนี้ง่ายกว่าและปิดทั้ง C-1 บางส่วนด้วย)

### I-10 · ไม่มี cap จำนวน org ต่อ user + rate limit fail-open ⇒ bound "≤ 50 org/user" ของ §10 ไม่ถูกบังคับจริง
**อาการ:** §10 ประกาศ capacity bound "org ต่อ user ≤ 50" โดยมี "ตัวคุม = rate limit 10/ชม." · แต่ (ก) 10/ชม.
= 240/วัน ไม่ใช่ cap (ข) §8 ประกาศ **fail-open** เมื่อ Redis ล่ม ⇒ ตอน Redis ล่มไม่มีอะไรคุมเลย (ค) api-spec §15
ยอมรับว่าไม่มี `Idempotency-Key` → double-submit ได้ 2 org
**สถานการณ์:** user คนเดียวยิง `POST /organizations` รัว ๆ ระหว่าง Redis ล่ม → org หลายพันใบ ×
(3 Role + 1 Membership + 1 OrgEntitlement + 1 Warehouse) ต่อใบ · `GET /me/organizations` ยัง cursor อยู่แต่จอ switcher
และ query bound ที่ประกาศไว้ผิดหมด · ไม่มี endpoint ลบ org (scope-out) ⇒ ล้างไม่ได้
**ข้อเสนอ:** cap ที่ **DB/service level แบบ fail-closed**: นับ `Membership where userId, status=active` ก่อนสร้าง
เกิน N (เช่น 50) → `409 ORG_LIMIT_REACHED` · ทำให้ bound ที่ §10 ประกาศเป็นจริงโดยไม่พึ่ง Redis
(rate limit ยังคง fail-open ได้ตามนโยบายเดิม เพราะไม่ใช่ชั้นที่บังคับ invariant อีกต่อไป)

---

## §C Minor

- **M-1 · `src/tenancy/**` หายจาก SYSTEM_PRISMA allowlist** — §2.1 ระบุ allowlist `src/auth/**`, `src/orgs/system/**`,
  `src/health/**`, `src/prisma/**` แต่ `OrgContextMiddleware` (ที่ต้อง query `Membership` ก่อนมี context — ปัญหาไก่กับไข่)
  จะอยู่ที่ `src/tenancy/` ตาม seam เดิม (`apps/api/src/tenancy/org-context.ts`) · backend.md §3.3 ระบุ allowlist ว่ามี
  `tenancy/` ด้วย ⇒ **เอกสารสองฉบับไม่ตรงกัน** → gate จะแดงหรือคนจะย้ายไฟล์ไปที่แปลก ๆ · แก้: เติม `src/tenancy/**` ใน §2.1
- **M-2 · ไม่ได้ระบุว่า `countActiveOwners` ต้องใช้ `tx` client** — §5 เขียนแค่ "หลัง lock จึงคำนวณ" · ถ้า implementer
  นับด้วย `ORG_PRISMA` (นอก tx) จะอ่าน snapshot คนละใบกับ lock = บั๊กเดิมกลับมาทั้งดุ้นโดย test concurrency
  อาจผ่านบ้างไม่ผ่านบ้าง (flake) · แก้: เขียนให้ชัดว่า **ทุก read/write ในเส้นทางนี้ใช้ `tx` เท่านั้น** + assert ใน unit test
- **M-3 · คำเชิญที่หมดอายุยังเก็บ `status='pending'` (derived expiry) แต่ cap 100 นับรวม** ⇒ org ที่มี pending
  ค้าง/หมดอายุครบ 100 ใบจะ **เชิญใครไม่ได้อีกเลย** จนกว่าจะไล่กด cancel ทีละใบ (insider grief: Admin ยิง 30/ชม.
  ~4 ชม. ก็เต็ม) · แก้: cap นับเฉพาะ `pending && expiresAt > now` (query มี index รองรับแล้ว)
- **M-4 · `PATCH /orgs/{orgId} { logo }` รับ string อิสระ** (api-spec §3.4) — ไม่มีกฎ scheme/host · ผู้มี
  `manage_org_settings` ตั้ง URL ภายนอกที่ web/mobile โหลดให้สมาชิกทุกคน = tracking pixel/SSRF-ish/ภาพไม่พึงประสงค์ ·
  แก้: บังคับ https + host allowlist (ของ object storage เราเอง, F-040) หรือรับเฉพาะ key ที่ระบบออกให้
- **M-5 · env ใหม่ยังไม่ผูกกับ `packages/config/src/env.ts`** — §13 ข้อ 6 บอกแค่ "@devops ต้องเติม" · repo นี้บังคับ
  boot fail-closed ผ่าน zod อยู่แล้ว (มี `.min(32)` + `.refine` ว่า access/refresh secret ต้องต่างกัน) ⇒ ต้องระบุว่า
  `INVITATION_TOKEN_SECRET` เข้า schema (`min 32`, ต้องต่างจาก JWT ทั้งสองตัว), `WEB_APP_BASE_URL` = `.url()` + https,
  `DEFAULT_ORG_PLAN_KEY` = required · **บวก:** ไม่มี story การ rotate `INVITATION_TOKEN_SECRET` (rotate = คำเชิญค้างทั้งหมด
  ตายเงียบ ๆ ตอบ `404 INVITATION_INVALID`) — อย่างน้อยต้องเขียนไว้เป็นผลข้างเคียงที่รู้ตัว
- **M-6 · role หายไประหว่างคำเชิญ pending** — F-003 จะเปิดให้ลบ/แก้ role · accept ที่อ้าง `roleId` ที่ถูกลบ →
  FK error → 500 `INTERNAL` · แก้: accept ตรวจว่า `roleId` ยังมีจริงและเป็นของ `invitation.organizationId`
  ไม่งั้น `409 CONFLICT` (ข้อความ "คำเชิญนี้ใช้ไม่ได้แล้ว โปรดขอลิงก์ใหม่") — และ **ต้องตรวจ role เป็นของ org นั้นตอน
  accept ด้วย ไม่ใช่แค่ตอนสร้าง** (กันเคส cross-org roleId ที่ I-3 อธิบาย)
- **M-7 · security event ที่ยังขาด/เกิน (§9):** (ก) ไม่มี event เมื่อ **capability ถูกปฏิเสธ** — insider probing
  มองไม่เห็นเลย (ข) ไม่มีสัญญาณแยกเมื่อ accept **ปลุก membership ที่ revoked** (ผูกกับ I-1) (ค) `org.tax_profile.set`
  เขียนว่า "ไม่ log TIN เต็ม — mask 6 ตัวท้าย" กำกวม (mask 6 ตัวท้าย หรือ เหลือ 6 ตัวท้าย?) — ข้อเสนอ: **ไม่ log TIN เลย**
  ให้ log แค่ `taxIdPresent: true` + `entityType` (ค่าที่ต้องสืบย้อนอ่านจาก DB ได้อยู่แล้ว)
- **M-8 · `org-leak.kit.ts` ครอบไม่ครบชนิดผู้เรียก** — §2.3 ระบุแค่ "token ของ org B" · ต้องเพิ่มอีก 2 persona:
  (ก) user ที่ **ไม่มี membership ที่ไหนเลย** (ข) user ที่ membership `revoked` ใน org A (พิสูจน์ AC US-5 แบบ per-endpoint
  ไม่ใช่เทสต์เดียว) (ค) user `invited` (status ที่ schema มีแต่ flow ไม่ใช้ — ถ้าไม่ใช้ ควรระบุว่าเป็น dead state)
- **M-9 · ข้ออ้าง extendedWhereUnique ยังไม่ถูกพิสูจน์** — §2.2 อ้างว่า `findUnique/update/delete` ใส่ `organizationId`
  ลง `where` ได้ (Prisma 5.22 ✓ ยืนยัน version จาก `packages/db/package.json`) แต่ **`upsert`** ถูกใส่ไว้ในตารางเดียวกัน
  ทั้งที่ข้อจำกัดของ `where` ใน `upsert` ต่างจาก `update` · ต้องมี unit test พิสูจน์ **แถวต่อแถว** ก่อนถือว่าจริง
  (โดยเฉพาะ `upsert` ซึ่ง accept flow พึ่งพาโดยตรง) — ตอนนี้จัดเป็น **unverifiable claim**
- **M-10 · `GET /me/organizations?status=all`** คืนชื่อ org + role ของ org ที่ตน **ถูกถอดไปแล้ว** — ยืนยันว่าตั้งใจ
  (ผมเอนไปทาง: default `active` ถูกแล้ว แต่ `all` ควรคืนเฉพาะ id/ชื่อ ไม่คืน role/entitlement)
- **M-11 · ไม่มีเรื่อง cache header / การเก็บรักษาข้อมูล** — response ที่มี email/TIN ควร `Cache-Control: no-store`
  · email ของผู้ถูกเชิญที่ไม่เคยรับ ค้างในตาราง `Invitation` ตลอดกาล (ไม่มี job ลบ, §3.2 บอกว่า housekeeping ค่อยว่ากัน)
  — เขียนเป็น forward-commitment PDPA ไว้ดีกว่าปล่อยเงียบ

## §D Nit

- **N-1** `ORG_MISMATCH` เป็น 403 (api-spec §4) ทั้งที่มันคือ **client bug ไม่ใช่ผลการ authorize** → client taxonomy
  จะแปลงเป็น `ForbiddenFailure` แล้วเตะผู้ใช้กลับหน้าเลือก org เพราะ bug ของตัวเอง · 422 ตรงความหมายกว่า (แต่ไม่ใช่ช่องโหว่)
- **N-2** `lockOrganization(tx, organizationId)` ควรรับ org จาก ALS ctx ไม่ใช่ string ที่ caller ส่ง — ลดโอกาสล็อกผิดแถว
- **N-3** rate-limit key ต่อ IP ควรยุบ IPv6 เป็น /64 (ไม่งั้น 1 เครื่องมี key ได้ไม่จำกัด) — ปรับพร้อมกับ `auth/throttle.service.ts` ที่มีปัญหาเดียวกัน
- **N-4** api-spec §2 (ตาราง) เขียน permission ของ `GET /members` ว่า "สมาชิก active" ส่วน §3.7 ตั้งคำถามเปิดไว้ (Q2) —
  คำตอบของ Q2 คือ **การตัดสินเรื่อง PII** (email ของทุกคนในองค์กร) ไม่ใช่แค่ UX ⇒ แนะนำให้ route ไป product คู่กับ I-8 ไม่ใช่ ux อย่างเดียว

---

## §E สิ่งที่ผมยืนยันว่าถูกแล้ว (verify แล้ว — อย่ารื้อตอน rewrite)

1. **default-deny ที่ชั้น route (§1.1)** — ถูกต้องและเป็นการตัดสินที่ดีที่สุดในเอกสารชุดนี้ · การ mark `/auth/*`
   เป็น `@Public()` และ `reset-password` เป็น `@UserScoped()` โดยคง 404-never-403 = ไม่เปลี่ยน status ของ endpoint
   ที่ ship แล้ว ✓ (เทียบกับ `apps/api/src/auth/*.ts` แล้วตรง)
2. **การตีความ AC US-5 = ตัดสิทธิ์ที่ membership ไม่ใช่ลบ token row (§4)** — ผมพยายาม falsify แล้วยืนยันว่า **ถูก**:
   `RefreshToken` ไม่มี `organizationId` จริง (schema.prisma) และตัวเลือก (B)/(C) แย่กว่าในทุกมิติ · ที่สำคัญ
   window ของ "คนที่ถูกถอดยังทำอะไรได้" = **0 request** เพราะไม่มี cache (§1.5) — **แรงกว่า** revoke token จริง ๆ
   (ซึ่งยังปล่อย access token เดิมอีก 15 นาที — `ACCESS_TOKEN_TTL_SECONDS = 15*60`) · seam cache §1.5 มี
   `orgEpoch` + ข้อบังคับ invalidate + test บังคับ = ครบพอที่จะไม่พังเงียบตอน F-003
3. **rotate token ตอน re-copy โดยคง `expiresAt` (§7)** — ปลอดภัย**กว่า**ทางเลือกอื่นทุกทาง (ลิงก์เก่าในแชตตายทันที,
   ไม่ต่ออายุ = ไม่ยืด window) · ทางเลือก #2 (AES ย้อนกลับได้) ถูกปฏิเสธด้วยเหตุผลที่ถูกต้อง — **สนับสนุนให้ user เคาะผ่าน**
4. **`taxId` ไม่ unique ระดับระบบ (data-model §3.4)** — เหตุผล cross-tenant oracle ถูกต้องทั้งเชิงความปลอดภัย
   และเชิงธุรกิจ · ทิศทาง "เพิ่ม unique ทีหลังง่ายกว่าถอด" ก็ถูก
5. **hash-at-rest ของ invite token (§7.3)** — `randomBytes(32)` (256-bit) + HMAC-SHA-256 + **แยก secret จาก auth**
   + lookup ด้วย unique index = ไม่มี timing leak ที่ใช้ได้จริง และ brute-force ไม่ feasible ⇒ rate limit ต่อ IP
   เป็นแค่ defense-in-depth ตามที่ควร ✓ (รูปแบบตรงกับ `refresh-token.crypto.ts` ที่ ship แล้ว)
6. **การแยก error ของ invitation (`EXPIRED`/`CANCELLED`/`ALREADY_ACCEPTED`) หลังตรวจ token ถูกต้องแล้ว** —
   ไม่ใช่ leak เพราะผู้เรียกถือความลับอยู่แล้ว · และ token ไม่รู้จัก → `404 INVITATION_INVALID` ข้อความเดียว ✓
7. **`403 FORBIDDEN` สำหรับ org ที่ไม่มีจริง = ค่าเดียวกับ org ที่มีอยู่แต่ไม่ได้เป็นสมาชิก** — ไม่เปิด existence oracle
   และ `organizationId` เป็น cuid เดาไม่ได้ ✓ (แต่ดู I-5 เรื่องการแยก code)
8. **`Owner ≥ 1` ด้วย `SELECT … FOR UPDATE` บนแถว `Organization`** — เป็นทางเลือกที่ถูกที่สุดที่ยังถูกต้อง
   (กัน phantom ได้จริง, ไม่ต้อง retry loop แบบ SERIALIZABLE) · ตาราง trade-off §5 ซื่อสัตย์ ✓
   — เงื่อนไข: ต้องครอบ call site ให้ครบตาม I-9 + M-2
9. **สร้าง org = 1 tx + fail-closed เมื่อไม่มี plan (§6)** — "ห้าม fallback เป็น free เงียบ ๆ" คือท่าที่ถูก ·
   client ส่ง plan ไม่ได้ = กัน self-grant Full tier ✓
10. **migration expand→contract + precondition check ที่ล้มดัง (§4.1)** — ถูกต้อง และ `ALTER TYPE ADD VALUE`
    แยกข้อกำกับไว้ถูกแล้ว · destructive ตอนตารางว่าง = จังหวะที่ถูกที่สุดจริงตาม D-018
11. **ไม่แตะ ledger/เงิน/สต๊อกเลย** — ยืนยันจาก data-model §1 + §4.4 checklist ⇒ กฎทอง 2/5/7 ไม่เกี่ยวข้อง ✓
12. **pure fn ใน core-domain (owner-invariant / thai-tax-id / invitation-status / maskEmail) พร้อม test matrix** —
    ตรงกฎทอง 6 + D-014 ✓ · การให้ `resolveInvitationStatus` เป็น derived ไม่มี cron = ตัดสินถูก
13. **trusted proxy** — `TRUST_PROXY_HOPS` ถูก set อยู่แล้ว (`apps/api/src/main.ts:34`) ⇒ rate limit ต่อ IP ของ F-002
    ใช้ IP จริงได้ ไม่ต้องขอ @devops เพิ่ม ✓

## §F สิ่งที่ผมไม่ได้ review (อย่าถือว่าผ่าน)

- `docs/features/F-002/ux-wireframe.md` · `ui.md` · `test-plan.md` (ยังเป็นโครง — ผมอ่านเฉพาะ 3 artifact ที่ได้รับมอบหมาย)
- โค้ดฝั่ง client (web/mobile) ของ F-002 — ยังไม่มี · การ **เก็บ/ถอด token ออกจาก URL** (I-6ข) ต้อง review ตอน ★-task ของ @frontend
- ค่าโควตา rate limit เชิงธุรกิจ (30/ชม. พอไหม) — เป็นเรื่อง product/ops ไม่ใช่ความปลอดภัยเชิงกลไก
- OpenAPI ที่ยังไม่เขียน (api-spec ยัง DRAFT) — ผมรีวิวเจตนาของสัญญา ไม่ใช่ไฟล์ `openapi.yaml` ที่ยังไม่มี

## §G 3 จุดเสี่ยงสุดที่ผมเจาะ (calibration)

1. **เส้นทาง resolve org (header → ALS → membership → `withOrgScope`)** — ไล่จาก `org-scope.guard.ts` (stub วันนี้),
   `org-context.ts`, `packages/db/src/tenancy.ts` (pass-through วันนี้) เทียบกับ §1–§2 · เจอ C-3 (nested/allowlist),
   I-3 (context จาก header บน route user-scoped), I-4 (ลำดับ guard), M-1 (allowlist ไม่ตรง backend.md)
2. **invitation lifecycle** — ไล่ทุก state transition × ผู้เรียกทุกชนิด · เจอ I-1 (resurrection), I-6 (token ใน URL),
   I-7 (email binding ไม่มีฐาน), I-9 (accept แก้ role นอก lock), M-3 (cap นับ expired), M-6 (role หาย)
3. **privilege boundary ภายใน org + ขอบ identity ข้าม org** — ไล่ `hasCapability` (`full_access` = wildcard),
   `adminResetPassword` as-built, ตาราง permission ของ api-spec §2 · เจอ **C-1** และ **C-2** ซึ่งเป็นสองข้อที่ผม
   ถือว่าสำคัญที่สุดในรีวิวนี้ และทั้งคู่เป็น **สิ่งที่ไม่มีในเอกสาร** ไม่ใช่สิ่งที่เขียนผิด

---

## §H Delta review — 2026-07-28 (หลัง amend 2 รอบ + D-027/028/029, contract LOCKED)

> ขอบเขตรอบนี้ = **delta ไม่ใช่ review ใหม่** · ผมอ่านฉบับปัจจุบันของ `architecture.md` / `data-model.md` /
> `api-spec.md` (LOCKED) · `docs/DECISIONS.md` D-027/028/029 · AC ฉบับแก้ · `test-plan.md` (เฉพาะเพื่อดูว่า
> finding ที่ปิดแล้วมี regression กันย้อนกลับ) · และโค้ดจริงเท่าที่ต้องยืนยัน (`apps/api/src/auth/**`,
> `apps/api/src/common/**`, `apps/api/src/tenancy/**`, `packages/db/src/**`, `packages/config/src/env.ts`)
> · **หมายเหตุ:** `test-plan.md` ถูกแก้ระหว่างที่ผมรีวิว (mtime 2026-07-28 06:29 — เพิ่ม I-38..I-45, U-API-17..20,
> G-12..G-14, AC-5.7, แก้ AC-7.4) — ข้อสรุปด้านล่างอ้างฉบับ **หลัง** การแก้นั้น
> · วิธี: falsify ทุกคำที่เขียนว่า "ปิดแล้ว" — อ่านสิ่งที่เอกสาร**เขียนจริง** ไม่ใช่คำสรุปที่หัวเอกสาร

### H.1 สถานะ finding เดิม (29 ข้อ)

| # | สถานะ | หลักฐาน / สิ่งที่เอกสารเขียนจริง |
|---|---|---|
| **C-1** Admin ยกตัวเองเป็น Owner | ⚠️ **ปิดแต่ยังมีรู** | `canAssignRole()` มีจริง (arch §3.2 + data-model §6 8 เคส + U-CD-02) และครอบ **3 call site**: `PATCH members/{userId}` · `DELETE members/{userId}` · `POST invitations` · accept ปิดทางอ้อมด้วย I-9 (ไม่แตะ role ของ membership active) · leave ไม่ต้องมี (actor = ตัวเอง) · **แต่ไม่ครอบ `POST …/invitations/{id}/link` (reissue) → NEW-2** และ **ไม่ครอบ admin-reset ที่ ship แล้ว → NEW-1** |
| **C-2** cross-tenant takeover ผ่าน admin-reset | ✅ **ปิดจริง** (สำหรับภัยที่ระบุ) | arch §3.3 + §15 แถว 1: นับ `membership.count(userId=target, active, organizationId ≠ orgId) > 0 ⇒ targetOk=false` → 404 รูปเดิม + event `admin_reset_blocked_multi_org` + unit 5 เคส + int บังคับ (รหัสเดิมยัง login ได้) + smoke tier ถาวร · ผมพยายามหาทางหลบ: target `invited`/`revoked` ที่ org อื่น = ไม่บล็อก (ตั้งใจ, ถูก) · ผู้โจมตีถอด target ออกจาก org อื่นเพื่อปลดบล็อกได้เฉพาะ org ที่ตนคุมอยู่แล้ว = ไม่ข้ามขอบ tenant · **เหลือ 2 ข้อจำกัดเชิงเวลา → NEW-5** |
| **C-3** query ตั้งต้นจาก model org-agnostic | ⚠️ **ปิดแต่ยังมีรู (เล็ก)** | arch §2.2 มีกติกา 3 ข้อ (ห้ามตั้งต้นจาก allowlist · grep gate · int test) + นโยบายใหม่ **"operation นอก map = throw"** (แข็งกว่าที่ผมขอ) + data-model §3.5 เขียนตัวอย่างกลับด้านให้ถูก · **รูที่เหลือ: nested read หลายชั้นที่ "ลงกลับ" เข้า model org-scoped ผ่าน relation ของ model org-agnostic → NEW-8** |
| **C-4** `passwordHash` ขึ้น wire | ✅ **ปิดจริง** | `select` เสมอบน `User` (arch §2.2/§2.3, data-model §3.5) + grep gate `include: { user:` + assertion กลาง I-04 (สแกน nested/array, allowlist import จาก production, ขนาด allowlist ถูก pin) |
| **I-1** ปลุก membership ด้วยคำเชิญค้าง | ✅ **ปิดจริง** | 3 ชั้นครบ (arch §7.4): revoke ยกเลิก pending ของ email นั้น **ใน tx เดียว** · accept ปฏิเสธเมื่อ `revokedAt > tokenIssuedAt` (`INVITATION_SUPERSEDED`, `==` → ปฏิเสธ) · event `org.member.reactivated` แยกใบ · **และ §5.1 ปิดช่องแข่งขัน `revoke ‖ accept` ที่ร่าง amend#2 ยังเปิดอยู่** |
| **I-2** ลืม `@RequireCapability` = รั่วเงียบ | ⚠️ **ปิดแต่ยังมีรู** | เปลี่ยนเป็น metadata + `CapabilityGuard` + fail-closed by omission + route-registry test (I-02) + `@AnyActiveMember()` + G-13 · **แต่ fail-closed ครอบเฉพาะ mutating** (arch §1.3/§3.1 และ I-02 เขียนตรงกันว่า `POST/PATCH/PUT/DELETE`) ⇒ **org-scoped read ที่ลืมประกาศ = ตกเป็น "สมาชิก active คนไหนก็ได้" เงียบ ๆ → NEW-3** |
| **I-3** org context จาก header บน route user-scoped | ✅ **ปิดจริง** | arch §1.1/§1.3: ไม่สร้าง context เลยบน `@UserScoped()`/`@Public()` + accept เรียก `OrgContextStore.run({ organizationId: inv.organizationId })` เอง + §2.4 ห้าม `orgs/system/` อ่าน header + U-API-02 · I-26 |
| **I-4** guard พึ่ง `req.user` | ✅ **ปิดจริง** | middleware แนบ `req.orgAuth` เอง, guard ตัดสินจากค่านั้น 100% + unit test บังคับ (`@UserScoped` + token ปลอม → 401) |
| **I-5** แยก `ORG_ACCESS_DENIED` | ✅ **ปิดจริง** | code ใหม่ + ⛔ ห้ามแยก "org ไม่มีจริง" ออกจาก "ไม่ได้เป็นสมาชิก" + int test เทียบ byte (ปรับตาม `traceId` แล้ว) + persona ที่ 5 (Staff) พิสูจน์ว่าไม่ถูกกลืน |
| **I-6** token ใน query string | ✅ **ปิดจริง** | `POST /invitations/preview` (body) · `no-store` + `Referrer-Policy: no-referrer` (export `RESPONSE_HEADER_POLICY`) · ห้าม log query ของ `/invitations/*` (U-API-14 ยิง log จริง) · ★-task ของ @frontend ยังค้างตามเดิม (URL ของผู้ใช้ยังมี token = แก่นของ D-012, ยอมรับ) |
| **I-7** email binding ไม่มีฐานใน Phase 0 | ⚠️ **ปิดแต่ยังมีรู** | arch §7.6 เขียน threat model ตรงไปตรงมา ("เป็น defense-in-depth ไม่ใช่ control") + compensating control 6 อย่างที่ **ใช้ได้จริง** และปฏิเสธข้อเสนอ `needs_review` พร้อมเหตุผลที่ผมยอมรับ · **แต่ 2 อย่างถูกกัดกร่อนโดยของใหม่:** Owner-only ตอนเชิญถูกอ้อมได้ทาง reissue (**NEW-2**) · ธง `acceptedUserCreatedAfterInvite` ล้างได้ด้วยการ rotate (**NEW-9**) |
| **I-8** TIN เปิดให้สมาชิกทุกคน | ✅ **ปิดจริง (เข้มกว่าที่ผมขอ)** | `GET /orgs/{id}` ไม่คืน `taxId` ให้ **ใครเลย** · `taxIdMasked` เฉพาะ `manage_org_settings` · เลขเต็มออกทาง `POST …/tax-profile/reveal` เส้นเดียว (event + rate limit + `TAX_ID_RESPONSE_ALLOWLIST` = 1 เส้นพอดี) · **แต่เอกสารรองยังเขียนกฎเก่า → NEW-6** |
| **I-9** accept ทับ role ของ membership active | ✅ **ปิดจริง** | เลือกทาง (ข): `409 ALREADY_MEMBER` + ไม่แตะ role + mark invitation `cancelled` (ไม่ใช่ `accepted` — เหตุผลเรื่องประวัติที่เป็นเท็จ ถูกต้อง) + U-API-10 assert ว่า `membership.update` ไม่ถูกเรียก |
| **I-10** cap org/user | ✅ **ปิดจริง** | arch §6.3 cap 50 fail-closed ที่ service (`409 ORG_LIMIT_REACHED`) แยกจาก rate limit ที่ fail-open · overshoot ≤ 1 ประกาศเปิดเผย + I-C-09 · leave คืนโควตาโดยนับเฉพาะ `active` (ตรวจแล้วว่าไม่เปิดทางวนสร้าง org ทิ้ง เพราะ Owner คนสุดท้าย leave ไม่ได้) |
| **M-1** `tenancy/` ใน allowlist | ✅ ปิดจริง | arch §2.1 + ขอบเขตที่อนุญาต (อ่าน Membership/Role ของคู่ที่ resolve เท่านั้น) + unit test |
| **M-2** count ต้องใช้ `tx` | ✅ ปิดจริง | arch §5 + spy identity (U-API-09) + data-model §3.5 แถว count owners |
| **M-3** cap นับ pending ที่หมดอายุ | ✅ ปิดจริง | `count(status=pending, expiresAt > now)` + I-27 |
| **M-4** `logo` เป็น string อิสระ | ✅ ปิดจริง (เข้มกว่าที่ขอ) | api-spec §3.4 รับเฉพาะ `null` จนกว่า F-040 |
| **M-5** env เข้า zod | ✅ ปิดจริง | arch §6.4 ครบ 5 กลุ่ม + `.refine` ว่า `INVITATION_TOKEN_SECRET` ต่างจาก JWT ทั้งสอง (รูปเดียวกับที่มีอยู่จริงใน `packages/config/src/env.ts:67`) + เขียนผลข้างเคียงของการ rotate secret ไว้ชัด |
| **M-6** role หายระหว่าง pending | ✅ ปิดจริง | `INVITATION_ROLE_UNAVAILABLE` ตรวจ **ตอน accept** + ตรวจว่าเป็น role ของ org นั้น |
| **M-7** security event ขาด/กำกวม | ✅ ปิดจริง | `capability_denied` (มี reason `owner_only`) · `member.reactivated` · `member.left` · `tax_profile.revealed` · `org.tax_profile.set` เก็บแค่ `taxIdPresent` (ไม่ log TIN เลย) |
| **M-8** persona ของ leak kit | ✅ ปิดจริง | 5 persona + ประกาศ `invited` = dead state + G-06 (ไม่มี write path เขียน `invited`) |
| **M-9** ข้ออ้าง extendedWhereUnique/`upsert` | ✅ ปิดจริง (เชิงกระบวนการ) | arch §2.2 ประกาศตรง ๆ ว่าเป็น **unverifiable claim** + fallback ที่ตัดสินไว้แล้ว + before-merge checklist บังคับให้แก้เอกสารถ้าพิสูจน์ไม่ผ่าน — นี่คือท่าที่ถูก |
| **M-10** `status=all` | ✅ ปิดจริง | คืนรูปย่อ id/ชื่อ/สถานะ (ไม่มี role/entitlement) |
| **M-11** cache header / retention | ✅ ปิดจริง (ส่วน header) · retention = forward-commitment ที่บันทึกแล้ว | `no-store` ผูกกับ `RESPONSE_HEADER_POLICY` + I-05 · retention ของ email คำเชิญ → forward-commitments (ยอมรับ) |
| **N-1** `ORG_MISMATCH` | ✅ ปิดจริง | เปลี่ยนเป็น **422 / Validation** |
| **N-2** lock อ่าน org จาก ctx | ✅ ปิดจริง | `lockCurrentOrganization(tx, ctx)` ไม่รับ id จาก caller |
| **N-3** IPv6 /64 | ✅ ปิดจริง | `common/client-ip.ts` + แก้ `auth/throttle.service.ts` ที่ ship แล้วพร้อมกัน (★-task §15 แถว 3) |
| **N-4** สิทธิ์อ่าน member list | ✅ ปิดจริง | ต้องมี `manage_members` ทั้ง `/members` และ `/invitations` |

**สรุป: ปิดจริง 25 · ปิดแต่ยังมีรู 4 (C-1 · C-3 · I-2 · I-7) · ไม่ได้ปิด 0**
รูทั้ง 4 ข้อไม่ได้เกิดจาก "เขียนผิด" แต่เกิดจาก **ขอบของกฎที่ยังไม่ถูกลากให้สุด** — รายละเอียดอยู่ใน H.2

### H.2 finding ใหม่จากรอบ amend

#### 🔴 Critical

**NEW-1 · admin-reset ยังเป็นทางลัดยึดบัญชี Owner "ภายใน org เดียวกัน" ⇒ กฎ Owner-only (D-028/C-1) ถูกข้ามได้ด้วย 1 request**
เกี่ยวกับ: `architecture.md §3.3` · `api-spec.md §2` (บรรทัดใต้ตาราง) · โค้ดจริง `apps/api/src/auth/auth.service.ts` (บล็อก `callerOk/targetOk`)
D-028 ปิดเฉพาะมิติ **ข้าม org** (target active ใน org อื่น) · แต่ **ไม่มีเงื่อนไขใดห้ามผู้มี `manage_members` รีเซ็ตรหัสของ Owner ใน org ตัวเอง**
และตัวกรอง multi-org **ไม่ทำงานเลย**ในเคสที่พบบ่อยที่สุดของ dogfood: เจ้าของร้านสังกัดร้านตัวเองร้านเดียว
```
org X: Owner = U1 (สังกัด org X ร้านเดียว) · Admin = A (manage_members, ถูกเชิญเข้ามา — คำเชิญ Admin TTL 24 ชม.)
1. A: POST /orgs/X/members/U1/reset-password { newPassword }   → callerOk ✓ (manage_members)
                                                                 targetOk ✓ (U1 active ใน X)
                                                                 multi-org filter ✓ ผ่าน (U1 ไม่มี org อื่น)
   → 200 · เขียนทับ User.passwordHash ของ U1 · revoke ทุก session ของ U1 · clearAccount (ปลด backoff ให้ด้วย)
2. A ล็อกอินด้วย email ของ U1 + รหัสใหม่ → ได้ session ของ Owner ตัวจริง
3. A (ในร่าง U1) ยกตัวเองเป็น Owner / ถอด U1 → ยึด org เบ็ดเสร็จ · Phase 0 ไม่มีทางกู้ (F-085 = Phase 5)
```
`canAssignRole` ที่เพิ่งเพิ่มมากันได้เฉพาะเส้นทาง membership API — เส้นทางนี้เดินผ่าน **credential** ไม่ใช่ผ่าน role
⇒ ตราบใดที่ยังเปิดอยู่ กฎ "เฉพาะ `full_access` เท่านั้นที่แตะ Owner ได้" **เป็นจริงแค่บนกระดาษ**
**ข้อเสนอ (เล็กที่สุด, ทรงเดียวกับสิ่งที่ตัดสินไปแล้ว):** ใน `adminResetPassword` ให้ถือว่า `targetOk = false`
เมื่อ **role ปัจจุบันของ target มี `full_access`** และผู้เรียก **ไม่มี `full_access`** → คืน **404 รูปเดิม**
(ไม่มี code/status ใหม่ · `oasdiff` ยังเงียบ · เท่ากับใช้ `canAssignRole({ actorCapabilities, targetIsOwner, newRoleIsOwner:false })` ตัวเดิม)
+ emit event แยก (`…blocked_owner_target`) + เพิ่ม 2 เคสในเมทริกซ์ที่ §3.3 มีอยู่แล้ว + เข้า regression pack คู่กับ C-2
**หมายเหตุการตัดสิน:** นี่คือ **การลดความสามารถของ endpoint ที่ ship แล้ว** รอบที่สอง — อยู่ในเจตนาเดียวกับ D-028
แต่ user ควรรับทราบ/ยืนยัน (Owner to action: **@backend-api** implement · **@user/@product** รับทราบว่า Owner จะถูก
รีเซ็ตรหัสโดย Admin ไม่ได้อีกต่อไป)

#### 🟠 Important

**NEW-2 · `POST /orgs/{orgId}/invitations/{invitationId}/link` (reissue) ไม่ผ่าน `canAssignRole` ⇒ Admin ต่ออายุ/ออกโทเคนใหม่ของคำเชิญ role Owner ได้ไม่จำกัด**
เกี่ยวกับ: `api-spec.md §2 แถว 12` + `§3.12` (permission = `manage_members` ล้วน) · `architecture.md §3.2` (ตาราง call site มี 3 เส้น ไม่มี reissue) · `§7.4` · D-027
```
มีคำเชิญ role Owner ค้างอยู่ 1 ใบ (ออกโดย Owner ตัวจริงเมื่อไหร่ก็ได้ · จะหมดอายุแล้วก็ได้ — status ที่เก็บยังเป็น pending)
1. Admin A: POST /orgs/X/invitations/{inv}/link      → 200 { token, inviteUrl }   (ผ่านแค่ manage_members)
   ⇒ D-027: expiresAt = now + 24 ชม. · tokenIssuedAt = now · A ถือ token ของคำเชิญ **role Owner** อยู่ในมือ
2. §7.6 บอกเองว่า Phase 0 ยืนยัน email ไม่ได้ ⇒ ถ้า email ที่ถูกเชิญยังไม่มีบัญชีในระบบ
   A สมัครบัญชีด้วย email นั้นเอง → POST /invitations/accept → **เป็น Owner**
3. ถ้ามีบัญชีอยู่แล้ว: A กดออกลิงก์ใหม่ซ้ำ ๆ (rate limit 60/ชม./org) ⇒ ประตู Owner เปิดค้างได้ไม่จำกัดเวลา
   โดยที่ Owner ตัวจริงเห็นแค่ event ที่ยังไม่มีจอแสดง (F-005)
```
ช่องนี้เกิดจากการที่ D-027 (อายุนับใหม่) + D-028 (Owner-only เฉพาะตอน *create*) ถูกตัดสินคนละรอบ
⇒ "Owner-only" คุมประตูบานแรก แต่ไม่คุมกุญแจที่ทำสำเนาได้
**ข้อเสนอ:** เรียก `canAssignRole({ actorCapabilities, targetIsOwner:false, newRoleIsOwner: roleของคำเชิญมี full_access })`
ที่ reissue ด้วย → ไม่ผ่าน = `403 FORBIDDEN` (มีอยู่ใน §3.12 แล้ว ⇒ **ไม่แตะ wire, ไม่ขัด LOCKED**)
· เสริม (ถูกและได้ผลมาก): reissue ที่คำเชิญ **หมดอายุแล้ว** ควรถูกปฏิเสธด้วย `409 CONFLICT` แล้วบังคับให้เชิญใหม่
(ทำให้ TTL 24 ชม. ของ role สูงมีความหมายจริง) (Owner to action: @backend-api · test → @qa: เพิ่มเคสใน I-15/I-23)

**NEW-3 · "ลืม = พัง" ครอบเฉพาะ mutating — org-scoped *read* ที่ลืมประกาศ ตกเป็น "สมาชิก active คนไหนก็ได้" เงียบ ๆ**
เกี่ยวกับ: `architecture.md §1.3` (guard: `method ∈ {POST,PATCH,PUT,DELETE}` + ไม่มี metadata → 403) · `§3.1` · `§2.3 ข้อ 5` · test-plan `I-02` · `G-13`
เส้นที่แพงที่สุดของ F-002 ไม่ใช่ mutation แต่เป็น **read**: `GET /orgs/{id}/members` = email ของทุกคนในองค์กร
และ `GET /orgs/{id}/invitations` = email ของคนนอกที่ถูกเชิญ — ทั้งคู่เพิ่งถูกยกให้ต้องมี `manage_members` เพราะ I-8/N-4
```
dev เพิ่ม/รีแฟกเตอร์ controller แล้ว @RequireCapability(manage_members) บน GET /members หล่นหาย
→ CapabilityGuard: ไม่ใช่ mutating ⇒ ไม่ปฏิเสธ · OrgScopeGuard: เป็นสมาชิก active ⇒ ผ่าน
→ Staff ทุกคนอ่าน directory email ทั้งองค์กรได้ · I-02 (registry test) ตรวจเฉพาะ mutating ⇒ **ไม่แดง**
→ กลับไปเป็นสภาพก่อน D-028 โดยไม่มีสัญญาณใด ๆ
```
ยิ่งกว่านั้น **arch §3.1 กับ G-13 ขัดกันเอง**: §3.1 สั่งว่า read ที่ตั้งใจให้ทุกคนเข้าถึง "ต้อง mark ชัดด้วย `@AnyActiveMember()`"
(ซึ่งจะมีอย่างน้อย `GET /orgs/{id}` + `GET /orgs/{id}/roles`) แต่ G-13 pin allowlist ของ marker นี้ไว้ที่ **1 เส้น** (`DELETE …/membership`)
⇒ ทำตามข้อหนึ่งจะแดงที่อีกข้อ
**ข้อเสนอ:** เปลี่ยนเงื่อนไขเป็น **"ทุก org-scoped route (รวม read) ต้องประกาศอย่างใดอย่างหนึ่งของ `@RequireCapability`/`@AnyActiveMember`"**
— บังคับที่ CI (I-02) เป็นอย่างน้อย, ที่ runtime ได้ยิ่งดี · แล้วแยก G-13 เป็น "allowlist ของ **mutating** ที่ใช้ `@AnyActiveMember` = 1 เส้น"
(Owner to action: @backend-api แก้ §1.3/§3.1/§2.3 · @qa แก้ I-02/G-13)

#### 🟡 Medium

**NEW-4 · §5.1 บังคับ lock ทุก write ที่แตะ membership/invitation แต่ไม่มีนโยบาย timeout — คิวรอ lock กิน connection pool ที่ใช้ร่วมทุก tenant**
เกี่ยวกับ: `architecture.md §5/§5.1` · ไม่มีคำว่า `timeout`/`maxWait`/`lock_timeout` ที่ไหนเลยในเอกสารทั้งชุด (ยืนยันด้วย grep)
`POST /invitations/accept` เป็นเส้นที่ **ใครก็ตามที่ถือ token + ล็อกอินแล้ว** ยิงได้ และตอนนี้มันคว้า row lock ของ org
⇒ คำขอที่รอ lock จะ **ถือ DB connection ค้าง** · pool เป็นของทั้งแอป ⇒ org เดียวทำให้ทั้งระบบช้า/ล้มได้ (noisy neighbour)
· และเมื่อชน `lock_timeout`/deadlock จริง Prisma จะโยน error ที่ **ยังไม่มีใครแมป** ⇒ 500 (ซึ่ง qa ห้ามไว้เองใน I-C-10)
**ข้อเสนอ:** ประกาศใน §5 ว่า interactive tx ของกลุ่มนี้ใช้ `timeout`/`maxWait` ที่กำหนดชัด (เช่น 5 s / 2 s)
+ ตั้ง `lock_timeout` ที่ระดับ tx + แมป timeout/deadlock → `409 CONFLICT` (หรือ 503) ไม่ใช่ 500 · เพิ่ม 1 เคสใน §8
(Owner to action: @backend-api · @qa 1 เคส · @devops ค่า pool)

**NEW-5 · C-2 เป็นการตรวจแบบ point-in-time: (ก) TOCTOU นอก tx (ข) รหัสที่ admin ตั้งไว้ยังใช้ได้หลัง target ไปสังกัด org อื่น**
เกี่ยวกับ: `architecture.md §3.3` (นับก่อนบล็อก `if (!callerOk || !targetOk)`) · `data-model.md §3.5` แถว admin-reset
(ก) การนับ + การเขียน `passwordHash` ไม่ได้อยู่ใน tx เดียวกัน ⇒ ถ้า target กำลัง accept คำเชิญเข้า org อื่นพอดี
การรีเซ็ตอาจ commit ก่อน = ได้ credential ของคนที่กำลังจะเป็นสมาชิก org อื่น (แคบแต่เป็นช่องจริง และปิดถูกมาก)
(ข) หนักกว่าและถาวรกว่า: **ไม่มีการบังคับเปลี่ยนรหัสหลัง admin-reset** ⇒ Admin ที่รีเซ็ตให้พนักงานวันนี้ (ถูกกฎ, org เดียว)
**ยังรู้รหัสนั้นอยู่** เมื่อพนักงานคนนั้นไปสร้างร้านของตัวเอง/ถูกเชิญเข้าร้านอื่นในภายหลัง — ตัวกรองของ D-028 มองไม่เห็นอดีต
**ข้อเสนอ:** (ก) ย้ายการนับเข้าไปใน tx เดียวกับ `user.update` (ราคาศูนย์) · (ข) บันทึกเป็น **forward-commitment ของ F-081**
("must change password on next login" หรือ self-serve reset) + เขียนไว้ใน §7.6/§13 ให้ product เห็นว่านี่คือความเสี่ยงที่ยัง**ยอมรับอยู่**
(Owner to action: @backend-api (ก) · @product/@backend-api (ข) เขียนลง forward-commitments)

**NEW-6 · เอกสารรอง drift จาก contract ที่ LOCKED ในเรื่อง TIN — ถ้าไม่แก้ implementer มีสิทธิ์ทำถอยกลับไปที่ I-8**
เกี่ยวกับ: `data-model.md §3.3` (บรรทัด "…`taxId` **เต็ม** คืนได้เฉพาะผู้มี `manage_org_settings` · ผู้ใช้อื่นได้ค่า mask 4 ตัวท้าย")
ขัดกับ `api-spec.md §3.3/§3.16` ที่ LOCKED (**`GET` ไม่คืน `taxId` ให้ใครเลย** · คนที่ไม่มี `manage_org_settings` **ไม่ได้แม้แต่ mask**)
· AC US-7 ในไฟล์ feature ก็ยังเขียน "สมาชิกอื่นเห็นแบบ mask (4 ตัวท้าย)" (qa ตีความว่ายังอยู่ในกรอบ AC เพราะมีคำว่า "หรือ" — ผมเห็นด้วย
และ **ไม่ถือเป็น finding ของ AC**) · แต่ `data-model.md` เป็นเอกสารที่ implementer อ่านคู่กับ schema มากที่สุด
⇒ ความเสี่ยงจริงคือมี mapper คืน `taxId` เต็มบน `GET /orgs/{id}` ให้ Owner "เพราะ data-model บอกว่าได้"
**ข้อเสนอ:** แก้ย่อหน้านั้นให้ตรงกับ §3.16 (1–2 บรรทัด) — G-14 + I-04 จะจับได้ตอน CI อยู่แล้ว แต่ **อย่าให้เอกสารสอนผิดตั้งแต่แรก**
(Owner to action: @backend-api · PM sync-back ที่ AC ถ้าต้องการให้ตรงเป๊ะ)

#### 🔵 Minor

- **NEW-7 · `traceId` ยังไม่ pin รูปแบบ + ถ้อยคำ "echo `X-Request-Id`" กำกวม** (`api-spec §1`, `arch §15 แถว 2`) — ต้องเขียนให้ชัดว่า
  ค่าเป็น **random opaque (uuid v4) ห้ามเรียงลำดับ/ห้ามฝังข้อมูลของ request** (ค่าที่เดาได้/เรียงลำดับ = บอกปริมาณทราฟฟิกและเดา traceId ของคนอื่นได้)
  และ **header ที่ echo กลับ = ค่าที่ server ออกเสมอ** ไม่ใช่สะท้อนค่าจาก client (ของเดิม `extractTraceId` ใน `common/domain-exception.filter.ts`
  รับค่าจาก client จริง — U-API-20 ของ qa เทสต์ถูกทางแล้ว เหลือแค่ pin ถ้อยคำในสัญญาให้ตรงกัน) · ไม่พบทางที่ `traceId` จะ join กับ log ที่ไม่ควร join
- **NEW-8 · กติกา C-3 ไม่ครอบ nested read "ลงกลับ"** — กติกาเขียนว่า "ตั้งต้นจาก model org-scoped แล้ว `include`/`select` ขึ้นไป"
  แต่ไม่ห้าม `membership.findMany({ select: { user: { select: { memberships: … } } } })` ซึ่งวิ่งผ่าน `User` (org-agnostic) **กลับลงมา**
  ที่ `Membership` ของ org อื่น = รั่วรูปเดียวกับ C-3 เป๊ะ · grep gate เป็น textual (alias/destructure หลบได้) ⇒ ควรเขียนกติกาเป็น
  "ห้าม traverse relation **ผ่าน** model org-agnostic กลับเข้าสู่ model org-scoped" + เพิ่มเคสนี้ใน I-35
- **NEW-9 · D-027 rotate ล้างสัญญาณ forensic ของ I-7** — `acceptedUserCreatedAfterInvite` เทียบกับ `tokenIssuedAt` ซึ่ง rotate เขียนทับเป็น `now`
  ⇒ ผู้ที่สมัครบัญชีด้วย email ที่ถูกเชิญไปแล้ว เพียงกด/ขอให้กด "ออกลิงก์ใหม่" ก็ทำให้ธงกลายเป็น `false` (ดูเหมือนบัญชีมีมาก่อน)
  · ถูกมาก: คำนวณธงจาก `Invitation.createdAt` (หรือเก็บ `firstIssuedAt` เพิ่ม 1 คอลัมน์) แทน `tokenIssuedAt`
- **NEW-10 · `canAssignRole` คุมเฉพาะ `full_access`** — พอ F-003 เปิด custom role, ผู้มี `manage_members` จะยัง **มอบ capability ที่ตัวเองไม่มี** ได้
  (เช่น สร้าง/มอบ role ที่มี `manage_org_settings` ⇒ อ่าน TIN ได้) · เขียนเป็น forward-commitment ของ F-003: "actor มอบได้เฉพาะ capability ที่ตัวเองถืออยู่"
- **NEW-11 · `POST …/tax-profile/reveal` เปิดถึงระดับ Admin** (`manage_org_settings` อยู่ในชุดของ Admin ตาม data-model §5.2)
  ⇒ Admin ที่เพิ่งถูกเชิญเข้ามา (TTL 24 ชม. · Phase 0 ยืนยัน email ไม่ได้) อ่าน **เลขบัตรประชาชนของเจ้าของร้าน** ได้ตั้งแต่วันแรก
  · **นี่เป็นการตัดสินของ product/ux ไม่ใช่ของผม** (D-028 + ux Q13 เลือกเกณฑ์นี้เอง) — แต่ถ้ายืนยันตามนี้ ขอแนะนำ 1 อย่างที่ราคาถูก:
  ให้ event `org.tax_profile.revealed` ไปโผล่บนจอของ Owner (ไม่ใช่แค่ log ที่ยังไม่มีใครอ่านจนกว่าจะมี F-005) → ดู H.3

#### ⚪ Nit

- **NEW-12** `test-plan.md` หัวไฟล์ (บรรทัด 13) และ Contract summary ข้อ 14 อ้าง **"§20"** ซึ่ง **ไม่มีอยู่จริง** ในไฟล์ (มีแค่ §0–§19 + ท้ายไฟล์)
  — เนื้อหาที่สัญญาไว้ถูกกระจายลง §2/§6/§7/§8/§9/§10 ครบแล้ว ⇒ เป็นแค่ dangling reference (Owner: @qa)

### H.3 คำถามที่ต้องส่งกลับเจ้าของ (ผมไม่เดา)

1. **@user/@product:** รับ NEW-1 ไหม — Admin จะ **รีเซ็ตรหัสให้ Owner ไม่ได้อีก** (ได้ 404 ที่ไม่อธิบาย) · นี่คือการลด
   ความสามารถของ endpoint ที่ ship แล้วรอบที่สอง แต่เป็นเจตนาเดียวกับ D-028 · ถ้าไม่รับ = ยอมรับว่ากฎ Owner-only ข้ามได้ด้วย 1 request
2. **@product:** NEW-11 — ยืนยันไหมว่า **Admin** (ไม่ใช่เฉพาะ Owner) ควรเปิดดูเลขบัตรประชาชนของเจ้าของร้านได้ · ถ้าใช่ ควรมี
   การแจ้ง Owner หรือไม่ (ไม่ใช่คำถามเชิงเทคนิค — เป็น posture ของ PDPA)
3. **@backend-api:** NEW-2 ตัดสินอย่างไรกับ "reissue คำเชิญที่หมดอายุแล้ว" — ปิดไปเลย (`409`) หรือให้ทำได้แต่ต้องผ่าน `canAssignRole`

### H.4 Verdict สุดท้าย (สำหรับ sign-off)

> ## ✅ **ผ่านแบบมีเงื่อนไข (ready-with-conditions)** — เซ็นได้ ถ้ารับเงื่อนไข 4 ข้อด้านล่าง
> *(advisory — @backend-api เป็นเจ้าของสัญญา, @user เป็นผู้เคาะ)*

เหตุผลที่ **ไม่ใช่ "ไม่ผ่าน"**: Critical 4 ข้อของรอบแรกถูกปิดจริงทั้งหมดในระดับที่ตรวจสอบได้ (ไม่ใช่แค่รับปาก) ·
สิ่งที่เพิ่มเข้ามาในรอบ amend — Owner-only, §5.1 lock+re-validate, PDPA reveal-only, `@AnyActiveMember` เชิงโครงสร้างของ leave,
"operation นอก map = throw" — **เป็นการยกระดับจริง ไม่ใช่การเขียนให้ดูดี** และหลายจุด**เข้มกว่า**ที่ผมเสนอ ·
เหตุผลที่ **ไม่ใช่ "ผ่าน" เปล่า ๆ**: NEW-1 เป็นช่อง privilege escalation ที่ **ใช้ได้จริงในเคสที่พบบ่อยที่สุดของ dogfood**
และมันลบล้างผลของสิ่งที่ D-028 เพิ่งซื้อมาด้วยราคาสูง

**เงื่อนไขก่อนเริ่ม build (ทั้ง 4 ข้อเป็นงานเล็ก — รวมแล้วไม่ถึงครึ่งวัน):**

| # | เงื่อนไข | เจ้าของ | ทำไมต้องก่อน build ไม่ใช่ระหว่าง build |
|---|---|---|---|
| 1 | ปิด **NEW-1** (admin-reset ปฏิเสธเมื่อ target เป็น Owner และผู้เรียกไม่มี `full_access`) + 2 เคสในเมทริกซ์ §3.3 + เข้า regression pack | @backend-api (+ @user รับทราบ) | เป็น ★-task เดียวกับ C-2 ที่กำลังจะเขียน — ทำทีเดียวจบ · ถ้าปล่อยไว้ กฎ Owner-only ที่ทั้ง feature สร้างขึ้นมาไม่มีผล |
| 2 | ปิด **NEW-2** (`canAssignRole` ที่ reissue) — **ไม่แตะ wire จึงไม่ต้องปลด LOCKED** | @backend-api · เคส → @qa | ถ้าเขียนโค้ด reissue ไปก่อนแล้วค่อยเติม จะกลายเป็นการแก้ authz หลังมีเทสต์เขียวแล้ว = จุดที่คนมองข้ามที่สุด |
| 3 | ขยาย **NEW-3** ให้ registry ครอบ **read route** + ปรับ G-13 ให้ไม่ขัดกับ §3.1 | @backend-api + @qa | เป็นกติกาที่ ~40 feature ถัดไปจะลอก — แก้ตอนนี้ราคา 1 บรรทัดของ filter, แก้ทีหลังราคาเท่ากับไล่ตรวจทุก route |
| 4 | แก้ **NEW-6** (data-model §3.3 ให้ตรงกับ reveal-only) + ตัดสิน **NEW-4** (tx timeout) แล้วเขียนลง §5 | @backend-api | เอกสารที่สอนผิด 1 ย่อหน้า = โค้ดที่ผิดตั้งแต่ commit แรก · นโยบาย timeout ต้องมีก่อนเขียน tx ไม่ใช่หลังเจอ 500 ใน CI |

**ไม่ถือเป็นเงื่อนไข (แก้ระหว่าง build ได้):** NEW-5 (ก) · NEW-7 · NEW-8 · NEW-9 · NEW-12
**ต้องรอคำตอบ (ไม่บล็อก sign-off แต่บล็อกการปิด finding):** NEW-5 (ข) · NEW-10 · NEW-11 → H.3

### H.5 สิ่งที่ทำได้ดีในรอบ amend (อย่ารื้อทิ้งตอน build)

1. **§5.1 (lock + re-validate ใน tx)** — การยอมรับว่าข้อสรุปเดิม "accept ไม่ต้อง lock" **ผิด** แล้วแก้ที่ *design*
   ไม่ใช่แก้ที่เทสต์ คือสิ่งที่ถูกที่สุดในรอบนี้ · ลำดับคว้า lock เดียวกันทุกเส้น = กัน deadlock เชิงโครงสร้าง
2. **`DELETE /orgs/{orgId}/membership` ที่ไม่มี `userId` ใน path** — กัน confused deputy **เชิงโครงสร้าง ไม่ใช่เชิง `if`**
   (และเหตุผลที่ปฏิเสธการผ่อน authz บนเส้นเดิมถูกต้อง: capability ที่ขึ้นกับค่าใน path ทำให้ guard แบบ metadata ตัดสินไม่ได้)
3. **"operation ที่ไม่อยู่ใน map = throw"** — เปลี่ยน allowlist ที่ไม่มี else ให้เป็น fail-closed จริง + enumerate จาก DMMF
   ⇒ อัปเกรด Prisma แล้วมี operation ใหม่ = CI แดง ไม่ใช่รั่วเงียบ
4. **TIN แบบ reveal-only + `TAX_ID_RESPONSE_ALLOWLIST` = 1 เส้นพอดี** — "ข้อมูลที่ไม่ได้ถูกส่งคือข้อมูลที่รั่วไม่ได้" ถูกต้อง
5. **M-9 ถูกประกาศเป็น unverifiable claim พร้อม fallback ที่ตัดสินไว้ล่วงหน้า** — ท่าที่ควรเป็นมาตรฐานของทีมนี้
6. **การไม่รับข้อเสนอ `needs_review` ของผมพร้อมเหตุผล (dead state หลอกคนอ่านโค้ด)** — เป็นการปฏิเสธที่ถูก ผมยอมรับ
