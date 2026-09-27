---
doc: architecture
owner: "@backend-api"
signoff: approved     # user 2026-09-27 (หลังรวม SR-17 ข · D-034 Addendum 2)
---
# [F-003] Architecture / Technical design
> เจ้าภาพ: `backend-api` · ทำก่อน data-model/api/UX · อ้าง AC จาก [F-003.md](F-003.md) (G1✓ 2026-09-27) · D-028 · D-029 · D-030 · D-032 · D-033 · **D-034 · D-035**
> ต่อยอดโค้ดที่ F-002 ship จริง (`member-authz`, `owner-invariant`, `admin-reset-authz`, `invitation-policy`, `CapabilityGuard`,
> `runInOrgLockTransaction`, `SecurityEventsService`) — **ไม่มีสำเนาที่สองของกฎใด ๆ**
> รอบ 3 (2026-09-27): แก้ตาม [security-review.md](security-review.md) SR-F003-01..15 + D-034/D-035 — ตาราง "ตอบ security review" ที่ §15
> รอบ 4 (2026-09-27): ตาม **Addendum ของ D-034** (แก้/ลบ role ที่มีผู้ถืออื่น = แตะผู้ถือ — §1.3) และ **D-035** (floor `manage_members` ของผู้เชิญ · ผู้เชิญ = `issuedByUserId` — §6.1) · Q-SR01b / Q-P2 / Q-P3 ปิดแล้ว
> รอบ 5 (2026-09-27): ตาม **D-034 Addendum 2** (SR-17 ข — แก้/ลบ role ที่มีผู้ถืออื่นต้องถือ `manage_members` ด้วย · N-1 คงบล็อก rename-only — §1.3) + security delta review **SR-16..19** (lemma หลาย actor + property single-step — §1.3/§13.6 · no-op pin — §1.2/§13.6 · หลักฐานเปิด flag — §12/§14) · N-2 = known risk (§6.1)
> amendment 2026-09-27 (user อนุมัติ · ถ้อยคำเท่านั้น): §2 `RolesService.update` เพิ่มขั้น 4b no-op ⇒ return ปัจจุบัน (ข้าม 5–7 · ไม่ตรวจ version) · §7 route GET ที่เรียก decider เพื่อ `viewer.*` ไม่ยิง event — ไม่ขัด §1.2 (ค)/SR-19: no-op ถึงขั้น 4b ได้ต่อเมื่อผ่านกฎสิทธิ์ครบแล้ว ⇒ ไม่ใช่การลองที่ถูกปฏิเสธ (SR-19 คุม route member ที่ยัง emit ตามเดิม)

## Contract summary (≤20 บรรทัด — ทีม consumer อ่านแค่ส่วนนี้)
- **กฎทุกข้ออยู่ใน `packages/core-domain/src/rbac/` (pure fn)** · กฎแตะคน/มอบ role = **`decideMemberAuthority` ตัวเดียว** (D-034): **แกน target ⊊** (เปลี่ยน role · ถอด · reset · **แก้/ลบ role ที่มีผู้ถืออื่น**) + **แกน grant ⊆** (เปลี่ยน role · เชิญ · reissue · ยกเลิกคำเชิญ · accept re-check) — `isProperSubset` ถูกเรียกในไฟล์เดียว (gate)
- **การกระทำต่อตัวเองที่ยกเว้นแกน target:** `PATCH`/`DELETE /members/{ตัวเอง}` เท่านั้น (ออกจากร้าน `DELETE /membership` ไม่ผ่าน fn นี้อยู่แล้ว) · reset ตัวเองยังห้าม (§1.1)
- **Owner ≥ 1 (AC-4.3) 4 ชั้น:** `ROLE_LOCKED` · `FULL_ACCESS_RESERVED` · `assertOwnerRemains` ใน tx ก่อน write · DB CHECK + trigger + partial unique (§2)
- **Concurrency:** role/member/invite/accept อยู่ใต้ org lock · admin-reset ล็อก `User → Membership → Role` (FOR SHARE) · `Role.version` → `409 ROLE_CHANGED` · lock graph เป็น DAG (§3)
- **สิทธิ์ผู้ทำอ่านใหม่ใน tx เสมอ** (AC-5.7 — รวม floor `manage_roles` ของ role write) · **token ไม่พกสิทธิ์ + ไม่มี cache** (AC-6.5)
- **verdict บน wire (additive):** `RoleRow.viewerCanAssign` (ผู้ถือ `manage_members`) · `MemberRow.viewerCanManage` + `viewerCanResetPassword` (**เฉพาะ `manage_members`∧`manage_roles`** — กัน oracle "เท่ากันพอดี", §1.2) · `Invitation.viewerCanManage` (ผู้ถือ `manage_members`)
- **แก้/ลบ role ที่มีผู้ถือ active อื่น (D-034 Addendum + Addendum 2):** = change_role ของผู้ถือทุกคน ⇒ ผู้แก้ต้อง **ถือ `manage_members`** (`403 ROLE_HELD_REQUIRES_MANAGE_MEMBERS` · verdict `in_use_requires_manage_members`) **และ** ค่าเดิม ⊊ ผู้แก้ (`403 TARGET_NOT_BELOW_ACTOR` · verdict `equal_permissions_in_use`) + ค่าใหม่ ⊆ · ทุก field รวม rename-only · นับผู้ถือใน tx ใต้ org lock · ⚠️ ร้านที่มี Admin > 1 คน Admin แก้/ลบ role Admin ไม่ได้ · ผู้ถือแค่ `manage_roles` แก้ได้เฉพาะ role ที่ไม่มีผู้ถืออื่น (§1.3)
- **lemma (SR-16/17):** ไม่มีลำดับ op ของ actor ที่ไม่ใช่ Owner **กี่คนก็ได้** ที่ทำให้สมาชิกที่ไม่มีใคร reset ได้ กลายเป็น reset ได้ — pin ด้วย property single-step ทุก op + control 3 ตัว (§1.3 · §13.6)
- **accept re-check (D-035 + Addendum):** ผู้ออกลิงก์ล่าสุด (`issuedByUserId`) ต้อง active ∧ ถือ `manage_members` ∧ role คำเชิญ ⊆ สิทธิ์เขา → ไม่ผ่าน = คำเชิญถูก**ยกเลิกใน tx เดียวกัน** + ตอบ `409 INVITATION_CANCELLED` (ไบต์เดียวกับที่ร้านยกเลิกเอง) + event (§6.1)
- **Events:** 6 ตัวใหม่ · F-002 list 15 ไม่แตะ · รวม **25** · `escalation_denied` dedupe 5 นาที (§7)
- **เปลี่ยนพฤติกรรม route ที่ ship:** รายการเต็มที่ api-spec §4.3 (member `403 TARGET_NOT_BELOW_ACTOR`/`ROLE_EXCEEDS_ACTOR` · cancel-invite Owner · accept · reset ⊊ · rate limit ใหม่)
- **Rollout (SR-03):** route เขียน role ปิดด้วย `ROLE_WRITES_ENABLED` (default **false**) — devops เปิดหลังทุก instance เป็น F-003 · **rollback โค้ดปลอดภัยเฉพาะเมื่อ flag ยังไม่เคยเปิด** (§12)
- **ชื่อ role ห้าม Cc/Cf** (zero-width/bidi) ทั้ง core-domain + DB CHECK + gate เทียบกับ Unicode ของ runtime (data-model §2.1)
- **rate limit เป็นข้อกำหนด:** `roleWrite` 60/ชม./ร้าน · `memberWrite` 120/ชม./ผู้ใช้+ร้าน · soft-delete ≤ 500 แถว/ร้าน (§10)
- **เงื่อนไขก่อนเปิด flag (AC-10.1 · SR-03/10):** G-06/09/11/**12** + I-45 int **อยู่ในโค้ดของ commit ที่ deploy และ CI log แสดงว่ารันจริง** (ยังไม่มีใน repo = งานจริง §14) + **หลักฐาน** ว่าไม่มี instance F-002 เหลือทุก process/region (§12) · ข้อกำหนดทดสอบ §13
- **ไม่เกี่ยว:** sync / BullMQ / ChannelListing / เงิน / สต๊อก / ledger · เสนอ **D-036** (soft-delete) · **D-037** (labels ใน registry) — §11

---

## 0. หัวข้อ template ที่ไม่เกี่ยว

| หัวข้อ template | สถานะ |
|---|---|
| Sync strategy (push/poll/webhook) | **ไม่เกี่ยว** — F-003 ไม่แตะ external service ใด ๆ |
| Rate-limit/retry ของ platform · BullMQ | **ไม่เกี่ยว** — ไม่มีงาน async; ทุก write เป็น HTTP sync ใน tx เดียว (rate limit ขาเข้าของเราเองอยู่ §10) |
| Reconciliation & partial failure กับ platform | **ไม่เกี่ยว** — partial failure ภายในมีแค่ tx rollback (§4) |
| Mapping `ChannelListing` | **ไม่เกี่ยว** |
| Idempotency | ไม่ใช้ `Idempotency-Key` (ไม่ใช่เงิน/สต๊อก และ middleware §3.4 ยังไม่เกิด) — กันซ้ำด้วย unique ชื่อ + `version` (§4) |

## 1. ตำแหน่งกฎ — `packages/core-domain/src/rbac/` (สำเนาเดียว, pure fn)

โมดูลใหม่ `rbac/` (ย้าย/ต่อยอดจาก `auth/capabilities.ts` + `orgs/member-authz.ts` — **export ชื่อเดิมคงไว้** เพื่อไม่ให้ call site ของ F-001/F-002 พัง)

| fn | หน้าที่ | ผู้เรียก |
|---|---|---|
| `CAPABILITY_REGISTRY` | entry ต่อ key (shape ใน data-model §1) — แหล่งเดียวของ key/ป้าย/กลุ่ม/tier/status/implies | ทุกตัวข้างล่าง + registry endpoint + lint |
| `expandCapabilities(caps)` | `full_access` → ทุก key ใน registry · `manage_X` → + `view_X` (ตาม `implies`) · key ที่ไม่รู้จัก **คงไว้** (fail-closed: ทำให้ ⊆ ไม่ผ่าน ไม่ใช่หายไป — Owner ผ่านด้วย bypass ที่เขียนชัด ไม่ใช่ด้วยการขยาย, SR-11) | ทุกการเทียบ |
| `hasCapability(caps, required)` | **แก้ตัวเดิม** ให้วิ่งผ่าน `expandCapabilities` (imply มีผลที่ guard ด้วย — AC-7.3) · signature เดิม | `CapabilityGuard`, admin-reset |
| `isSubset(a, b)` / `isProperSubset(a, b)` | เทียบ **หลังขยาย** ทั้งสองฝั่ง · **module-private ใน `member-authority.ts` + `role-write.ts`** — gate: `isProperSubset(` ถูกเรียกเฉพาะใน `member-authority.ts` (non-vacuity: ≥ 1 call) | ข้างล่าง |
| `validateRoleCapabilities(input)` | ลำดับตายตัว: ว่าง → `ROLE_EMPTY` · มี `full_access` → `FULL_ACCESS_RESERVED` · ไม่อยู่ใน registry / tier `full` / `selectable=false` → `UNKNOWN_CAPABILITY` · ผ่าน → `canonicalizeCapabilities` → คืน **`ValidatedCapabilities` (branded type)** — constructor เดียวของ brand | role create/update |
| `canonicalizeCapabilities(caps)` | dedupe · ตัด key ที่ถูก imply โดย key อื่นในชุด · เรียงตาม key (api-spec §2) · pin: `isSubset(canon(a), x) === isSubset(a, x)` ทุกคู่ใน matrix | `validateRoleCapabilities`, no-op check |
| `lostCapabilities(before, after)` | `expand(before) \ expand(after)` (ชั้นเดียว) — AC-3.10 · golden vectors ให้ 2 client | export ให้ web + vectors ให้ mobile |
| `validateRoleName(raw, ctx)` | `normalizeRoleName` (NFC → trim → ยุบช่องว่าง) → **ปฏิเสธ code point หมวด Cc/Cf ที่เหลือ** (SR-04 → `VALIDATION_FAILED`) → 1–50 code point · ชน `reservedRoleNames(ctx)` แบบ exact (AC-3.5 — data-model §2.1) → `ROLE_NAME_TAKEN` | role create/update |
| `decideRoleWrite({ actor, op, role?, next?, otherActiveHolders })` | op = create/update/delete · **(0) floor: actor (อ่านใน tx) ต้องถือ `manage_roles` → `forbidden`** (SR-08) · Owner/`isSystem` → `role_locked` · actor ถือ `full_access` → ผ่าน (AC-5.6) · before ⊆ actor และ after ⊆ actor (AC-5.1) → `exceeds_actor` · **(update + delete — D-034 Addendum + Addendum 2, §1.3)** `otherActiveHolders > 0` → `decideMemberAuthority({op:"write_held_role", target: before})`: floor `manage_members` → `requires_manage_members` · แกน target ⊊ → `target_not_below_actor` · `otherActiveHolders: number` **required** (type บังคับให้ call site นับ — ไม่มี default 0) | `RolesService` · `viewer.canEdit/canDelete` |
| **`decideMemberAuthority(input)`** | **ตัวเดียวที่ตัดสิน "แตะคน / มอบ role" ทุกเส้นทาง** (D-034 · AC-5.3/5.4) — แทน `decideRoleGrant` ของร่างก่อน (เปลี่ยนชื่อเพราะไม่ได้ตัดสินแค่การมอบ) · spec เต็มที่ §1.1 | PATCH/DELETE member · invite create · reissue · cancel · **accept re-check** · `decideAdminReset` · `decideAdminResetVisible` · verdict บน wire |
| `canAssignRole(...)` | **คงไว้เป็น wrapper** `decideMemberAuthority(...).ok` เพื่อ compat — ลบใน PR เดียวกันเมื่อ call site ย้ายครบ (ไม่มี logic ของตัวเอง) | — |
| `decideAdminReset` | refusal เดิมไม่แตะลำดับ · ขั้น Owner-only เดิม (ที่วันนี้เรียก `canAssignRole`) → เรียก `decideMemberAuthority({op:"reset_password"})` แทน · map: `owner_only` → `target_is_owner` (เดิม) · **`target_not_below_actor` → `target_not_proper_subset` (ใหม่)** · ไม่มีการเทียบ ⊊ ใน fn นี้เอง | `AuthService.adminResetPassword` |
| `decideAdminResetVisible(viewer, row)` | ส่วนย่อยที่คำนวณจากข้อมูลที่ผู้ดูได้อยู่แล้ว: `self` → `decideMemberAuthority({op:"reset_password"})` · **ไม่รับ input C-2** (type ไม่มี field นั้น) · unit: visible ปฏิเสธ ⇒ `decideAdminReset` ปฏิเสธ | `MemberRow.viewerCanResetPassword` |
| `isElevatedRole` | + `manage_roles` (AC-10.3) | TTL invite |
| `canAcceptInvitation` | รับ `roleCapabilities` เพิ่ม → expiry ที่มีผล = `min(expiresAt, tokenIssuedAt + ttl(current))` (AC-10.4 ชั้นที่ 2) · **ไม่รู้เรื่องผู้เชิญ** — re-check D-035 เป็นขั้นแยกหลัง decision = `ok` (§6.1) | accept |
| `assertOwnerRemains` | + `OwnerChange` รูปที่ 3/4 (§2) | ทุกเส้นทางเขียน role + membership |

### 1.1 `decideMemberAuthority` — สองแกนใน fn เดียว (D-034 · SR-F003-01)

```ts
type MemberAuthorityOp =
  | "change_role" | "remove" | "reset_password"            // แตะคน
  | "invite_create" | "invite_reissue" | "invite_cancel"   // มอบ (เลื่อนเวลา)
  | "invite_accept_recheck"                                // D-035 — actor = ผู้ออกลิงก์ปัจจุบัน
  | "write_held_role";                                     // D-034 Addendum (§1.3) — แก้/ลบ role ที่มีผู้ถือ active อื่น
interface MemberAuthorityInput {
  op: MemberAuthorityOp;
  actorCapabilities: readonly string[];          // อ่านใน tx (AC-5.7)
  actorIsTarget: boolean;                        // true เฉพาะ PATCH/DELETE /members/{ตัวเอง}
  targetCurrentCapabilities?: readonly string[]; // role ปัจจุบันของเป้าหมาย (แกน target)
  grantCapabilities?: readonly string[];         // role ที่จะมอบ / role ของคำเชิญ (แกน grant)
}
type MemberAuthorityResult =
  | { ok: true }
  | { ok: false; reason: "forbidden" | "owner_only" | "exceeds_actor"; excess: string[] }
  | { ok: false; reason: "target_not_below_actor"; relation: "equal" | "superset" | "incomparable"; excess: string[] };
```

| op | floor `manage_members` | owner_only | แกน target (⊊) | แกน grant (⊆) | ยกเว้นตัวเอง |
|---|---|---|---|---|---|
| `change_role` | ✅ | ✅ (target หรือ role ใหม่ถือ `full_access`) | ✅ | ✅ | แกน target ข้าม |
| `remove` | ✅ | ✅ | ✅ | — | แกน target ข้าม |
| `reset_password` | ✅ | ✅ | ✅ | — | **ไม่ยกเว้น** (ตัวเอง = `caller_is_target` ใน `decideAdminReset` ก่อนถึงนี่ — fn นี้ไม่ผ่อนให้แม้ถูกเรียกผิด) |
| `invite_create` · `invite_reissue` | ✅ | ✅ (role Owner) | — | ✅ | — |
| `invite_cancel` | ✅ | ✅ (role Owner) | — | ✅ | — |
| `invite_accept_recheck` | ✅ **(D-035 Addendum P2)** — actor = ผู้ออกลิงก์ล่าสุด | ✅ | — | ✅ | — |
| `write_held_role` | ✅ **(D-034 Addendum 2 · SR-17)** — floor `manage_roles` ตรวจแล้วใน `decideRoleWrite` · ที่นี่ตรวจ `manage_members` เพิ่ม (`forbidden` → `decideRoleWrite` map เป็น `requires_manage_members`) | — (role Owner ถูก `role_locked` ก่อน) | ✅ (target = caps **เดิม** ของ role) | — (ค่าใหม่ตรวจ ⊆ ใน `decideRoleWrite` แล้ว) | ผู้ถืออื่น = 0 ⇒ ไม่เรียก (actor ที่ถือ role เดียวกันไม่นับ) |

**ลำดับตายตัว:** (1) floor → `forbidden` (2) owner_only (3) **actor ถือ `full_access` → `ok` ทันที** (bypass เขียนชัด — SR-11: role ที่มี key ค้างซึ่งไม่อยู่ใน registry ไม่ทำให้ Owner จัดการไม่ได้) (4) แกน target: `¬actorIsTarget ∧ ¬isProperSubset(target, actor)` → `target_not_below_actor` + `relation` (5) แกน grant: `¬isSubset(grant, actor)` → `exceeds_actor`
- **target ก่อน grant:** PATCH ที่ผิดทั้งสองแกนได้ reason ของแกน target (ตรงกับ copy "คนนี้คุณจัดการไม่ได้" ซึ่งเป็นเหตุหลัก — เปลี่ยน role ใหม่ก็ไม่ช่วย)
- **ทำไม "ยกเลิกคำเชิญ" ใช้ ⊆ ไม่ใช่ ⊊ (AC-5.4 ที่ product ลงแล้ว):** แกน target มีไว้กันการ**ลดคนที่มีบัญชีในร้าน**ลงมาใต้ ⊊ เพื่อ reset/สวมรอย · คำเชิญ pending ยังไม่มีสมาชิกให้ reset และการยกเลิก**ลด**ทางเข้า ไม่สร้าง ⇒ ไม่มีลำดับ request ที่ใช้การยกเลิกเป็นขั้นหนึ่งของการสวมรอย · ใช้ ⊊ จะทำให้ Admin ยกเลิกคำเชิญ Admin ที่ตัวเองออกผิดไม่ได้ (ถอยความปลอดภัยเชิงปฏิบัติ) · ยังคง ⊆ เพื่อไม่ให้คนสิทธิ์ต่ำยกเลิกคำเชิญของ role ที่สูงกว่า (AC-5.2 อ่านอย่างเดียว)
- **เส้นทาง "ต่อตัวเอง" ที่ยกเว้น (ตรวจโค้ด 2026-09-27):**
  - `DELETE /orgs/{orgId}/membership` (ออกจากร้าน D-029, `MembersService.leave`) — **ไม่เรียก fn นี้เลย** (ไม่มี input `userId`) · คงเดิม
  - `DELETE /orgs/{orgId}/members/{ตัวเอง}` — `members.controller.ts` ยอมให้ผู้ถือ `manage_members` ถอดตัวเอง (D-029) → `actorIsTarget=true` ⇒ แกน target ข้าม (role ตัวเองไม่มีวัน ⊊ ตัวเอง — ไม่ยกเว้น = ห้ามถอดตัวเองเงียบ ๆ) · `LAST_OWNER` ยังคุม
  - `PATCH /orgs/{orgId}/members/{ตัวเอง}` — โค้ด F-002 ไม่มีกฎห้าม · แกน target ข้าม **แต่แกน grant ยังตรวจ** ⇒ ลดตัวเองได้ ยกตัวเองไม่ได้ · `LAST_OWNER` ยังคุม
  - `POST …/reset-password` ตัวเอง — **ไม่ยกเว้น** (ห้ามตาม High-2 `caller_is_target` เดิม)
  - `actorIsTarget` คำนวณใน service จาก `ctx.userId === targetUserId` (ค่าจาก ALS ที่ middleware พิสูจน์แล้ว) — ไม่รับจาก request
- **regression บังคับ (AC-5.4b):** int ลำดับ 3 request ด้วย Admin A/B ร้านเดียว (B ไม่อยู่ร้านอื่น — C-2 ไม่ช่วย): `PATCH B→Staff` = **403 `TARGET_NOT_BELOW_ACTOR`** · B role/`version`/refresh token ไม่เปลี่ยน · ขั้น 2 reset B = 404 · ขั้น 3 ไม่มีอะไรให้ยก · + unit (property, fixture registry ขนาดเล็ก ทุกคู่): `¬(T ⊊ A) ∧ A ไม่ถือ full_access ∧ ¬actorIsTarget ⇒ change_role/remove/reset_password ปฏิเสธทุก grant` · **lemma เต็ม (หลาย actor, ทุก op รวม op ต่อตัวเอง) + control 3 ตัว = §1.3 "เหตุผลเชิงรูปแบบ" และ §13.6 (SR-16/17)**

### 1.2 verdict บน wire กับ oracle "เท่ากันพอดี" (AC-6.4)

- **ข้อเท็จจริง:** ผู้ดูที่มี `manage_members` แต่ไม่มี `manage_roles` รู้ `role ⊆ ฉัน` จาก `RoleRow.viewerCanAssign` (AC-2.2 บังคับให้มี) · ถ้าได้ verdict แกน target (⊊) ของสมาชิกที่ถือ role นั้นด้วย → `⊆ ∧ ¬⊊` = **capabilities ของ role นั้นเท่ากับของฉันทุกตัว** = อ่าน capabilities ได้โดยไม่มี `manage_roles` (ขัด AC-6.4)
- **ตัดสิน:** `MemberRow.viewerCanManage/manageBlockedReason` ส่ง**เฉพาะผู้ดูที่ถือ `manage_members` ∧ `manage_roles`** (ผู้ดูกลุ่มนี้อ่าน capabilities ของทุก role ได้อยู่แล้ว ⇒ ไม่มีอะไรรั่ว) — กฎเดียวกับ `viewerCanResetPassword` · ผู้ดูที่มีแค่ `manage_members`: field absent → client ใช้พฤติกรรม F-002 (แสดงปุ่ม) และเมื่อได้ 403 แสดง copy กลาง · preset Admin (หลัง backfill) มี `manage_roles` ⇒ กรณีหลักได้ verdict ครบ
- **เพราะผู้ดูทุกคนที่ได้ verdict อ่าน caps ได้อยู่แล้ว จึงแยก reason ได้แม่นโดยไม่รั่ว:** `owner_only` → `equal_permissions` (relation=`equal`) → `exceeds_your_permissions` (superset/incomparable) — ใช้ทั้ง `manageBlockedReason` และ `resetBlockedReason` · ux ได้ copy "สิทธิ์เท่ากับคุณ — ให้เจ้าของร้านจัดการ" แยกจาก "มีสิทธิ์ที่คุณไม่มี"
- **oracle ที่เหลือโดยธรรมชาติ (รับไว้ — บันทึกให้ security-reviewer):** กฎใดที่ผลต่างกันเมื่อ "เท่ากัน" จะเผยบิตนั้นแก่ผู้ที่**ลองทำจริง**ได้เสมอ (ผู้ดูแค่ `manage_members` ยิง PATCH แล้วได้ 403 `TARGET_NOT_BELOW_ACTOR`) — ปิดไม่ได้ถ้าไม่ยกเลิก D-034 · ลดทอน: (ก) ไม่มีช่องเงียบ (verdict ไม่ส่ง) (ข) ทุกครั้งที่ลองยิง `org.role.escalation_denied` reason `target_not_below_actor` (§7) (ค) PATCH ไปยัง role เดิม (no-op) **ต้องผ่าน fn นี้เต็มลำดับ** ไม่ short-circuit — ไม่มีทางลองแบบไม่ทิ้งร่องรอย **ทั้งสองผล:** เท่ากัน ⇒ 403 + `escalation_denied` · ⊊ ⇒ 200 + `org.member.role_changed` (from = to) 1 ตัว เพราะ `MembersService.updateRole` ไม่มี no-op short-circuit (ตรวจโค้ด `members.service.ts:319`) · **ข้อนี้เป็นข้อกำหนด ไม่ใช่ผลบังเอิญ (SR-19):** ห้าม "optimize" ให้ no-op ของ route สมาชิกข้าม write/event — pin ด้วย int §13.6 · precedent เดียวกับ C-2 ของ admin-reset (security-review "ตรวจตามโฟกัส")
- `Invitation.viewerCanManage` (แกน grant ⊆ เท่านั้น) ส่งให้ผู้ถือ `manage_members` ได้ตามเดิม — ให้ข้อมูลเท่ากับ `viewerCanAssign` ของ role เดียวกัน ไม่มีบิตใหม่

### 1.3 แก้/ลบ role ที่มีผู้ถือ active อื่น (D-034 Addendum ตัวเลือก ก + Addendum 2 ตัวเลือก ข — user ตัดสิน 2026-09-27)

- **ช่องที่ปิด:** Admin A · B ถือ `R_B` ที่ caps **เท่ากับ** A · (1) A ถอด cap หนึ่งตัวจาก `R_B` (ผ่าน AC-5.1 เดิม) (2) `R_B ⊊ A` → reset B (3) ใส่ cap คืน ⇒ สวมรอย B เหมือน SR-01 ผ่านเส้นทาง role edit
- **ช่องที่ปิดเพิ่ม (Addendum 2 · SR-17 — insider 2 คน):** M = `{manage_roles, X, Y}` (ไม่มี `manage_members`) · A = `{manage_members, Y}` · T ถือ `R_T = {X}` · (1) M แก้ `R_T` เป็น `{Y}` (before ⊊ M ✓) (2) A reset T (`{Y}` ⊊ A ✓) (3) M แก้คืน ⇒ A สวมรอย T ทั้งที่ไม่มีใครทำได้คนเดียว
- **กฎ:** actor ไม่ถือ `full_access` · role มี `otherActiveHolders > 0` (membership `status='active'` ของ role นี้ ที่ `userId ≠ actor`) ⇒ ต้องผ่าน **ครบ**: (ก) actor ถือ `manage_members` (อ่านใน tx — AC-5.7 · Addendum 2) (ข) **caps เดิม (before) ⊊ actor** (Addendum) — ใช้กับ **PATCH (ทุก field รวมเปลี่ยนชื่ออย่างเดียว — N-1 คงบล็อกตาม Addendum 2) และ DELETE** · ไม่มีผู้ถืออื่น ⇒ `manage_roles` + กฎ ⊆ ของ D-032 ข้อ 4 เท่าเดิม (ไม่ต้องมี `manage_members`) · Owner ผ่านด้วย bypass (D-030 — `full_access` ขยายเป็นทุก key) · create/clone ไม่เกี่ยว (role ใหม่ไม่มีผู้ถือ — ผู้ถือแค่ `manage_roles` โคลนได้เสมอ)
- **ทำไม (ข) ของ Addendum 2 ปิดช่อง:** การแก้ role ที่มีผู้ถือ = change_role ยกชุด (ข้อถัดไป) ⇒ ใช้ floor เดียวกับ change_role ของ route สมาชิก (`manage_members` — AC-2.5) · ขั้น (1) ของ M ล้มเพราะ M ไม่มี `manage_members` · ถ้า M มี `manage_members` M ก็ reset T ได้เองอยู่แล้ว (`R_T ⊊ M`) ⇒ การร่วมมือไม่ให้อะไรเกินที่ M มี
- **ตัดสิน "ค่าเดิม vs ค่าใหม่":** role edit = **`change_role` แบบยกชุดให้ผู้ถือทุกคน** (จาก role ที่ caps = before ไป role ที่ caps = after) ⇒ ใช้สองแกนเดียวกับ route สมาชิกทุกประการ: **before ⊊ actor (แกน target)** + **after ⊆ actor (แกน grant = AC-5.1 เดิม)** — **ไม่** บังคับ after ⊊
  - **ลดลง** (before = A, after ⊊ A): ปฏิเสธที่ before ⇒ ช่องข้างบนล้มที่ขั้น 1
  - **ยกขึ้นจากเท่ากัน** (before = A): ปฏิเสธที่ before เช่นกัน — ทุกการแก้ role ที่เท่ากับ actor และมีผู้ถืออื่นถูกห้ามไม่ว่าทิศไหน
  - **ยกขึ้นจากต่ำกว่า** (before ⊊ A, after = A): **อนุญาต** — เท่ากับ `PATCH /members/{B}` จาก Staff → Admin ที่ D-034 อนุญาตอยู่แล้ว (target ⊊ ✓ grant ⊆ ✓) · บังคับ after ⊊ จะเข้มกว่า route สมาชิกโดยไม่ปิดช่องใดเพิ่ม (A reset B ได้อยู่แล้วก่อนยก — การยกทีหลังไม่ให้สิทธิ์เกิน caps ของ A เอง)
  - **เหตุผลเชิงรูปแบบ (lemma หลาย actor — SR-16/17 · pin ด้วย property §13.6):**
    - นิยาม: `MM` = สมาชิก active ที่ไม่ใช่ Owner และถือ `manage_members` (หลังขยาย) · **`U` = { T active ไม่ใช่ Owner : ∄ Y ∈ MM, Y ≠ T, caps(T) ⊊ caps(Y) }** = สมาชิกที่ไม่มี non-Owner คนใด reset ได้ (reset ต้อง `manage_members` + T ⊊ ผู้ reset — `admin-reset-authz.ts:146` + §1.1)
    - **คำอ้าง:** สำหรับ actor ที่ไม่ใช่ Owner **กี่คนก็ได้ ทำ op กี่ขั้นก็ได้** ถ้า T ∈ `U` และ T ไม่ได้เป็นผู้ทำ op เอง ⇒ T ∈ `U` ตลอด ⇒ reset T ไม่มีวันผ่าน · **นอกขอบเขต (ตั้งใจ):** Owner (D-030 ทำได้ทุกอย่าง) · op ที่ T ทำกับตัวเอง (ลดตัวเอง = T ยินยอม) · instance F-002 ระหว่าง rolling (baseline §12)
    - **พิสูจน์ด้วย induction ทีละ op** (op แรกที่ทำให้ T ออกจาก `U` ต้องทำให้เกิด Y ∈ MM ที่ T ⊊ Y):
      1. **caps ของ T เปลี่ยน** — เกิดได้ทาง PATCH T (floor `manage_members` + T ⊊ ผู้ทำ) หรือแก้ role ที่ T ถือ (T นับเป็นผู้ถืออื่น ⇒ floor `manage_members` (Addendum 2) + before ⊊ ผู้ทำ (Addendum)) ⇒ ผู้ทำ ∈ MM และ T ⊊ ผู้ทำ **ก่อน** op = T ∉ `U` อยู่แล้ว — ขัดสมมติฐาน · (DELETE T = T ไม่อยู่แล้ว)
      2. **caps ของ Y โตขึ้น** (หรือ Y ได้ `manage_members`) — ทาง PATCH Y โดย Z: Z ∈ MM ∧ caps ใหม่ของ Y ⊆ Z ⇒ T ⊊ Y′ ⊆ Z ⇒ T ⊊ Z ก่อน op — ขัด · แก้ role ที่ Y ถือโดย Z ≠ Y: Y เป็นผู้ถืออื่น ⇒ Z ∈ MM ∧ after ⊆ Z ⇒ เหมือนกัน — ขัด · Y แก้ role ของตัวเอง: มีผู้ถืออื่น ⇒ ต้อง before ⊊ Y แต่ before = caps(Y) ⇒ ปฏิเสธเสมอ · ไม่มีผู้ถืออื่น ⇒ after ⊆ Y = หด · PATCH ตัวเอง: แกน grant ⊆ ⇒ หด
      3. **Y เป็นสมาชิกใหม่** (accept) — D-035: caps(Y) ⊆ ผู้ออกลิงก์ I ∧ I ∈ MM (floor Addendum P2) ⇒ T ⊊ Y ⊆ I ⇒ T ⊊ I ก่อน op — ขัด
      4. op อื่น (สร้าง/โคลน role · invite create/reissue/cancel · reset · ลบ role ไม่มีผู้ถือ) ไม่เปลี่ยน caps ของสมาชิก active ใด
    - **ขาที่พึ่งกฎแต่ละข้อ (= control ของ property §13.6):** ข้อ 1 ทาง PATCH ← แกน target ของ `change_role` (D-034) · ข้อ 1 ทาง role edit ← before ⊊ (Addendum) **และ** floor `manage_members` (Addendum 2 — ขาดข้อนี้ = SR-17) · ข้อ 2 ← แกน grant ⊆ + การไม่ยกเว้นแกน grant ของ PATCH ตัวเอง · ข้อ 3 ← floor ของ D-035
- **DELETE:** role ที่มีผู้ถือ active อื่นถูก `ROLE_IN_USE` อยู่แล้ว — กฎ (ก)(ข) บน DELETE เป็นตาข่ายกันวันที่กฎ in-use ผ่อน (เช่น ลบพร้อมย้ายผู้ถือ) · **ลำดับ: `ROLE_HELD_REQUIRES_MANAGE_MEMBERS` → `TARGET_NOT_BELOW_ACTOR` → `ROLE_IN_USE`** เพราะ copy ของ in-use ("ย้ายสมาชิกออกก่อน") หลอกทั้งสองกรณี — ผู้ไม่มี `manage_members` ย้ายใครไม่ได้เลย · actor ย้ายผู้ถือที่เท่ากับตัวเองไม่ได้ (แกน target บน PATCH member)
- **ลำดับใน `decideRoleWrite`:** floor `manage_roles` → `role_locked` → bypass Owner → `exceeds_actor` (before ⊆ ∧ after ⊆) → [ผู้ถืออื่น > 0] `requires_manage_members` → `target_not_below_actor` (¬(before ⊊)) · เพราะผ่าน ⊆ มาแล้ว ⇒ บน route role **`TARGET_NOT_BELOW_ACTOR` เกิดได้เฉพาะ before = actor (relation `equal`)** · `exceeds_actor` มาก่อนทั้งสองเพราะเป็นเหตุที่ครบกว่า (แก้ไม่ได้แม้ผู้ถือออกหมด / แม้ได้ `manage_members`) · **floor `manage_members` ก่อนแกน target** = ลำดับเดียวกับ `decideMemberAuthority` (floor → … → target) และเป็นเหตุที่ต้องแก้ก่อน (ได้ `manage_members` แล้วค่อยเจอ equal ถ้าเท่ากัน)
- **wire ของ (ก) — code ใหม่ `403 ROLE_HELD_REQUIRES_MANAGE_MEMBERS` (ไม่มี details) แทน `FORBIDDEN`:** `FORBIDDEN` บน route role แปลว่า "ไม่มี `manage_roles` แล้ว" (guard / floor ใน tx) — client ที่ได้ code นั้นควรออกจากจอ role · กรณีนี้ผู้ใช้ยังจัดการ role อื่นได้ และ AC-5.2 ต้องการเหตุผลแยก ⇒ ถ้า verdict เก่า (มีคนถูกย้ายเข้า role ระหว่างเปิดจอ) client ได้ code ที่ map ไป copy เดียวกับ verdict ได้ตรง · `ErrorResponse.code` เป็น open set ⇒ additive · **ไม่ยิง security event** (log warn `role_write_refused` reason `requires_manage_members` — §8): ผู้ทำถือ caps ⊇ role อยู่แล้ว ไม่ใช่การยกสิทธิ์ และข้อมูลที่ refusal เผยอยู่บน wire แล้ว (ข้อ verdict ข้างล่าง) · pin `ESCALATION_CHECKED_OPERATIONS`/reason 4 ค่าของ §13.4 ไม่เปลี่ยน
- **no-op ไม่ short-circuit:** PATCH ที่ค่าเท่าเดิมบน role ที่ติดกฎนี้ = `403` (ไม่ใช่ 200 no-op) — ตรงกับ route สมาชิก (§1.2 ข้อ ค) และตรงกับ `viewer.canEdit=false`
- **นับผู้ถือ + race:** ขั้น 4 ของ `RolesService.update/delete` (§2) — `membership.count({ organizationId, roleId, status:'active', userId: { not: actor } })` ผ่าน `tx` (ORG_PRISMA) **หลัง** ได้ org lock · ทุกเส้นทางที่ **เพิ่ม** ผู้ถือ active ของ role (PATCH member · accept · provisioning) อยู่ใต้ org lock เดียวกัน (§3) ⇒ serialize: PATCH/accept ที่ย้าย C เข้า R commit ก่อน → edit นับ C (ถ้า R = A ⇒ ปฏิเสธ) · edit commit ก่อน → PATCH/accept อ่าน caps ใหม่ของ R แล้วตัดสินใหม่ (grant ⊆ / D-035 re-check) · ไม่มี write-skew · เส้นทางที่ **ลด** ผู้ถือ (DELETE member · ออกเอง) ทำให้ค่าที่นับได้สูงเกินจริงเท่านั้น = เข้มขึ้น ไม่ใช่ช่อง · admin-reset ไม่ถือ org lock แต่ถือ `Role` FOR SHARE (§3) ⇒ ชนกับ UPDATE ของ role edit — reset อ่าน caps หลัง edit commit เสมอ · **gate:** `org-lock-callsites.test.ts` ขยายให้ทุก call site ที่เขียน `Membership.roleId` หรือ `status → 'active'` อยู่ใน operation ของ `ORG_LOCK_REQUIRED_OPERATIONS` (fixture แดง + non-vacuity)
- **ไม่นับ:** คำเชิญ pending (ยังไม่มีบัญชีในร้านให้ reset — เมื่อ accept จะเข้า role ที่ caps ปัจจุบัน ผ่าน D-035 re-check) · membership `revoked`
- **verdict `viewer.canEdit/canDelete.reason` = `in_use_requires_manage_members` (Addendum 2) · `equal_permissions_in_use` (Addendum) — ไม่เป็น oracle (AC-6.4) ตรวจทีละบิต:** ผู้ที่ได้ `RoleDetail` ต้องผ่าน gate `manage_roles` ⇒ (1) "caps ของ role เท่ากับฉัน" — อ่าน caps ของทุก role ได้อยู่แล้ว (2) "มีผู้ถืออื่น" = `usage.activeMembers` (ส่งให้ผู้ถือ `manage_roles` ทุกคน **รวมคนที่ไม่มี `manage_members`** — นับ `status='active'` นิยามเดียวกับ `otherActiveHolders`) ลบ 1 ถ้า `OrgMyMembership.roleId` = role นั้น (3) "ฉันไม่มี `manage_members`" — `OrgMyMembership.capabilities` ของตัวเอง ⇒ ทั้งสาม reason คำนวณได้จากข้อมูลบน wire ของผู้ดูคนนั้นเอง = ไม่มีบิตใหม่ · **ไม่เผยตัวผู้ถือ** (ผู้ไม่มี `manage_members` ไม่ได้รายชื่อสมาชิก — ได้แค่ตัวเลขที่มีอยู่แล้ว) · verdict คำนวณด้วย `decideRoleWrite` ตัวเดียวกับตอนเขียน (property §13.5) · ลำดับ reason ตามลำดับ fn
- **ผลต่อ UX/พฤติกรรม (user รับแล้วใน Addendum + Addendum 2):** ผู้ถือ `manage_roles` ที่ไม่มี `manage_members` ("ผู้ออกแบบ role") แก้/ลบได้เฉพาะ role ที่ไม่มีผู้ถืออื่น · โคลนได้เสมอ · copy ของ `in_use_requires_manage_members` = ux · ร้านที่มี Admin > 1 คน — Admin **แก้ (รวมเปลี่ยนชื่อ) / ลบ role `Admin` ไม่ได้** และแก้ custom role ที่สิทธิ์เท่ากับตัวเองซึ่งคนอื่นถือไม่ได้ ⇒ ปุ่ม disabled + copy "มีคนอื่นที่สิทธิ์เท่ากับคุณถือบทบาทนี้ — ให้เจ้าของร้านแก้" (ux) · ร้านที่มี Admin คนเดียว: Admin แก้ role `Admin` ได้ (ลดได้อย่างเดียวเพราะ after ⊆ ตัวเอง) · โคลนได้เสมอ (role ใหม่ไม่มีผู้ถือ) · **wire:** `403 TARGET_NOT_BELOW_ACTOR` (code เดิมจาก D-034, ไม่มี details) + reason ใหม่ใน open set ⇒ ไม่มี shape ใหม่
- **event:** `org.role.escalation_denied` reason `target_not_below_actor` operation `update_role`/`delete_role` · `targetUserId = null` · `excessCapabilities = []` (relation equal เสมอบน route นี้) · `requires_manage_members` → ไม่มี event (ข้อ wire ข้างบน)

**ทำไม result มี reason ไม่ใช่ boolean:** call site map เป็นคนละ wire — `forbidden`/`owner_only` → `403 FORBIDDEN` (**code ที่ ship แล้ว — ห้ามเปลี่ยน**) · ยกเว้น `forbidden` ของ op `write_held_role` → `decideRoleWrite` map เป็น `requires_manage_members` → `403 ROLE_HELD_REQUIRES_MANAGE_MEMBERS` (route ใหม่ — §1.3) · `target_not_below_actor` → `403 TARGET_NOT_BELOW_ACTOR` · `exceeds_actor` → `403 ROLE_EXCEEDS_ACTOR` · admin-reset → 404 ทุกกรณี · accept → `409 INVITATION_CANCELLED` (§6.1)
**ลำดับ owner_only ก่อน:** ทุกกรณีที่ F-002 เคยปฏิเสธยังได้คำตอบเดิมทุกไบต์

## 2. Owner ≥ 1 บนเส้นทางเขียน role — `OwnerChange` รูปที่ 3 (forward-commitment L283)

**ปัญหา (ทวน):** `OwnerChange` วันนี้อธิบายแค่การเปลี่ยนที่ `Membership` — การแก้ `Role.capabilities` ทำให้ร้านเหลือ Owner 0 คนได้โดยไม่มี membership ใบไหนถูกแตะ

**ขยาย type (core-domain `orgs/owner-invariant.ts`):**
```ts
export type OwnerChange =
  | { kind: "role_change"; userId; newRoleCapabilities }           // เดิม
  | { kind: "revoke"; userId }                                      // เดิม
  | { kind: "role_capabilities_change"; roleId; newCapabilities }   // ใหม่ — PATCH role
  | { kind: "role_delete"; roleId };                                // ใหม่ — DELETE role (soft)
// OwnerMembership เพิ่ม `roleId` (required) — รูปใหม่ต้องรู้ว่า membership ไหนถือ role ที่ถูกแก้
```
`activeOwnersAfter` สำหรับรูปใหม่: membership ที่ `roleId === change.roleId` → ใช้ `newCapabilities` แทน (รูป 3) / ถือว่าไม่ใช่ Owner แล้ว (รูป 4) แล้วนับ Owner active ตามเดิม

**input contract เปลี่ยน:** `owners` = membership ทุกสถานะที่ role ปัจจุบันถือ `full_access` **∪ membership ทุกใบของ role ที่กำลังถูกแก้** — อ่านผ่าน `tx` ที่ถือ org lock (M-2 เดิม) · helper `assertOwnerRemainsInTx` ย้ายจาก `MembersService` ไปเป็น `OrgOwnershipGuard` (provider ร่วมใน `orgs/`) ที่ทั้ง `MembersService` และ `RolesService` inject — **ไม่มีสำเนาของ query**

**ลำดับใน `RolesService.update` (tx เดียว):**
```
runInOrgLockTransaction(operation: "updateRole") ─┐
 1 อ่าน role (live, org-scoped) → ไม่มี = 404       │
 2 อ่าน actor capabilities ใหม่ (AC-5.7)            │
 3 validateRoleName / validateRoleCapabilities      │  pure
 4 นับผู้ถือ active อื่น (§1.3) → decideRoleWrite   │  pure — floor manage_roles จากค่าข้อ 2 (SR-08) · ผู้ถืออื่น > 0 ⇒ manage_members + before ⊊
 4b no-op ⇒ return ปัจจุบัน (ข้ามขั้น 5–7 · ไม่ตรวจ version)  │  ชื่อ normalize + canonical(caps) เท่าเดิม · ไม่ emit
 5 assertOwnerRemains(role_capabilities_change) ◄── defensive (AC-4.3) — ก่อน write
 6 UPDATE … WHERE id AND version = expected        │  0 แถว ⇒ 409 ROLE_CHANGED
 7 clamp expiresAt ของคำเชิญ pending (ถ้า role กลายเป็น elevated — §6)
 8 return snapshot before/after                     ┘
post-commit: emit org.role.updated
```
ขั้น 5 อยู่ **หลัง** ขั้น 4 และทำงาน **โดยไม่ขึ้นกับ** ผลขั้น 4 (defense-in-depth ตาม AC-4.3)

**`RolesService.delete`** ลำดับเดียวกัน: 1 อ่าน role → 2 actor caps → 4 นับผู้ถืออื่น → `decideRoleWrite(op:"delete")` (รวม `requires_manage_members` → `target_not_below_actor` ก่อน in-use — §1.3) → `ROLE_IN_USE` → `ROLE_HISTORY_LIMIT_REACHED` → `assertOwnerRemains(role_delete)` → soft-delete

**พิสูจน์ว่าแดงได้จริง (AC-4.3 · qa Q-QA-1 — ข้อกำหนดเต็มที่ §13.1):**
1. unit (core-domain) matrix รูป 3 **และ** รูป 4 (§13.1 ตาราง)
2. service (unit, fake tx): seam `ROLE_WRITE_DECIDER` (DI token, default = `decideRoleWrite`) · ฉีดตัวปล่อยทุกอย่าง → `LAST_OWNER` + **spy ทุกทางเขียนไม่ถูกเรียก** + ลำดับ `assertOwnerRemains` ก่อน write · control: decider ปล่อย + แก้ role ที่ไม่มี Owner → ผ่านและ write ถูกเรียก 1 ครั้ง
3. int (DB จริง): override provider `ROLE_WRITE_DECIDER` → PATCH role Owner → ต้องได้ **`409 LAST_OWNER` ไม่ใช่ 500** · แยกต่างหาก: `UPDATE "Role"` ตรงด้วย `SYSTEM_PRISMA` บนแถว `isSystem` → DB trigger ปฏิเสธ
4. migration: harness (data-model §4.2) — ร้าน Owner=0 → apply F-003 ล้ม

**ชั้น 4 (DB, data-model §3):** `CHECK full_access ⇒ isSystem` · `CHECK NOT (isSystem ∧ deleted)` · trigger `role_system_row_lock` ห้าม UPDATE `name/capabilities/isSystem/deletedAt` ของแถว `isSystem` · **ใหม่ (SR-07):** trigger `role_system_flag_guard` ห้าม `isSystem` false→true และห้าม INSERT `isSystem=true` นอก provisioning (ตรวจว่าร้านนั้นยังไม่มีแถว system) + partial unique `("organizationId") WHERE "isSystem"` (1 system role ต่อร้าน) ⇒ `UPDATE … SET "isSystem"=true, capabilities='{full_access}'` บน custom role ถูก DB ปฏิเสธ · migration F-003 ตรวจ Owner ≥ 1 ทุกร้านท้าย migration (RAISE → deploy ล้ม)

## 3. Lock / ordering

| operation | ล็อก (ตามลำดับ) | หมายเหตุ |
|---|---|---|
| `createRole` · `updateRole` · `deleteRole` (ใหม่ใน `ORG_LOCK_REQUIRED_OPERATIONS`) | `Organization` FOR UPDATE → `Role` (UPDATE) → `Invitation` (clamp, UPDATE `expiresAt`) | ล็อกตัวเดียวกับ 7 operation ของ F-002 |
| PATCH/DELETE member · invite create/reissue/cancel · **accept** | เดิม (org lock) → `Membership`/`Invitation` → (trigger §3.3) `Role` FOR SHARE | **accept อยู่ใต้ org lock อยู่แล้ว (ยืนยันจากโค้ด `invitations.service.ts` `accept` → `runInOrgLockTransaction`)** ⇒ re-check D-035 อ่าน membership+role ของผู้ออกลิงก์หลังได้ล็อก = เห็นการลดสิทธิ์/ถอด/แก้ role ที่ commit แล้วเสมอ — ไม่ต้องล็อกเพิ่ม |
| admin-reset (`AuthService`) | `User` FOR UPDATE (เดิม) → **`Membership` FOR SHARE** ของ (caller, target) เรียง `userId` asc (SR-05) → `Role` FOR SHARE เรียง `id` asc → อ่าน facts | Membership FOR SHARE ชนกับ UPDATE ของ PATCH/DELETE member ⇒ reset ไม่ตัดสินบน `roleId` ที่กำลังเปลี่ยน · อ่าน `roleId` จากแถวที่ล็อกแล้ว (อ่านซ้ำหลัง FOR SHARE ถ้าอ่านก่อน) · re-evaluate หลัง write (NEW-5ก) คงเดิม |

- **lock graph เป็น DAG (ตรวจทุกขอบ):** `User → Membership → Role` (reset) · `Organization → Membership → Role` (member write + trigger) · `Organization → Role → Invitation` (role write + clamp) · `Invitation(แถวใหม่) → Role` (trigger ตอน INSERT invitation) — ไม่มีใครล็อก**แถว invitation ที่มีอยู่แล้ว**ก่อน Role: trigger `role_live_reference_guard` ยิงเฉพาะ `NEW.status='pending'` ที่เปลี่ยน `roleId`/`status` (accept → accepted, cancel → cancelled, reissue แตะแค่ token, clamp แตะแค่ `expiresAt` ⇒ ไม่ยิง) · role write ไม่แตะ `User`/`Membership` (trigger soft-delete อ่าน Membership แบบไม่ล็อก) · reset ไม่แตะ `Organization`
- **"แก้ role พร้อมย้ายสมาชิก / accept เข้า role นั้น":** serialize ด้วย org lock — ตัวหลังอ่านสถานะใหม่แล้วตัดสินใหม่ · การนับผู้ถืออื่นของ §1.3 อ่านหลังได้ล็อก ⇒ เห็นผู้ถือที่ถูกย้าย/accept เข้ามาและ commit แล้วเสมอ (รายละเอียด race §1.3)
- **"ลบ role พร้อมเชิญด้วย role นั้น":** serialize ด้วย org lock · เชิญก่อน → ลบได้ `409 ROLE_IN_USE` · ลบก่อน → เชิญได้ `422 ROLE_INVALID` · trigger data-model §3.3 (อ่าน Role **FOR SHARE** — SR-06) เป็นตาข่ายชั้นสองที่ไม่มี write-skew แม้เส้นทางอนาคตลืม org lock
- lock timeout / busy → `409 CONFLICT {reason:"busy"}` ตามนโยบาย NEW-4 (`ORG_TX_TIMEOUTS` เพิ่ม 3 key)

## 4. Optimistic concurrency (AC-3.12) + partial failure

- `Role.version Int` เริ่ม 1 · ทุก PATCH **ต้อง** ส่ง `version` ที่อ่านมา · `updateMany({ where: { id, version }, data: { …, version: { increment: 1 } } })` → `count === 0` ⇒ `409 ROLE_CHANGED` `details: { currentVersion }` · **ไม่มี last-write-wins** · client **ต้อง** re-fetch แล้วแสดงความต่าง ห้าม resubmit อัตโนมัติด้วย `currentVersion` (SR-14 — api-spec §5)
- ทำไมต้องมีทั้ง org lock และ version: lock กัน race **ระหว่าง** tx · version กัน "คนหลังเขียนทับสิ่งที่ตัวเองไม่เคยเห็น" ที่ห่างกันเป็นนาที
- DELETE ไม่รับ version (ลบไม่สร้างสิทธิ์ที่ไม่ตั้งใจ; เงื่อนไข in-use ตรวจใต้ล็อกอยู่แล้ว)
- **partial failure:** ทุกอย่างของ 1 operation อยู่ใน tx เดียว (role write + clamp คำเชิญ · accept refusal + ยกเลิกคำเชิญ) · error ใด ๆ → rollback ทั้งก้อน · event ยิง **หลัง commit เท่านั้น**

## 5. สิทธิ์ไม่อยู่ใน token + ไม่มี cache (AC-2.4 · AC-6.5)

- **ยืนยันจากโค้ด:** `buildAccessClaims` = `{ sub, iat, exp, jti, typ }` · `OrgContextMiddleware` ทำ `membership.findUnique(orgId_userId)` + `role.capabilities` ทุก request แล้วใส่ ALS · `CapabilityGuard` อ่านจาก ALS ⇒ แก้ role → request ถัดไปเห็นผลทันที
- **F-003 ไม่เพิ่ม cache ใด ๆ** · test: แก้ role (ถอด cap) → request ถัดไปของผู้ถือ = 403 (int)
- **กติกาส่งต่อ (คงไว้):** ใครเพิ่ม cache membership/สิทธิ์ ต้อง invalidate ตอน revoke / role update / role delete / member role change + test
- **เส้นทางเขียนไม่เชื่อ ALS:** อ่าน actor caps ใหม่ใน tx (AC-5.7) — ALS ใช้แค่ประตูหน้า `@RequireCapability` · **floor ใน tx ครบทุกเส้น:** role write = `manage_roles` (SR-08) **+ `manage_members` เมื่อ role มีผู้ถืออื่น** (Addendum 2 — ถูกถอดระหว่างรอ = `403 ROLE_HELD_REQUIRES_MANAGE_MEMBERS`) · member/invite = `manage_members` (`decideMemberAuthority` ข้อ 1) ⇒ request ที่ผ่าน middleware แล้วรอล็อกอยู่ขณะ Owner ถอดสิทธิ์ จะถูกปฏิเสธ `403 FORBIDDEN`

## 6. คำเชิญกับ role ที่เปลี่ยน (AC-10.3 · AC-10.4)

- `isElevatedRole` = `full_access | manage_members | manage_roles` (ผ่าน `hasCapability` ⇒ imply ครอบอัตโนมัติ)
- **ชั้น 1 — clamp ตอนแก้ role:** ใน tx ของ `updateRole` ถ้า `!isElevated(before) && isElevated(after)` → `expiresAt = LEAST(expiresAt, tokenIssuedAt + 24h)` ของคำเชิญ pending ของ role นั้น (ORG_PRISMA `updateMany`) · **ย่นได้อย่างเดียว ไม่ยืด**
- **ชั้น 2 — ตอน accept:** `canAcceptInvitation` คำนวณ expiry จาก caps ปัจจุบันซ้ำ
- role ถูกลดสิทธิ์จนไม่ elevated → **ไม่ยืดอายุคืน**

### 6.1 accept re-check อำนาจผู้เชิญ (D-035 · AC-5.3 · SR-F003-02)

- **"ผู้เชิญ" = ผู้ที่ออกลิงก์ล่าสุด (D-035 Addendum P3 — user ตัดสิน):** `COALESCE(Invitation.issuedByUserId, invitedByUserId)` — column ใหม่ `issuedByUserId` (data-model §5) **เขียนใน UPDATE/INSERT เดียวกับ token:** create (= ผู้เชิญ) และ**ทุกครั้งที่ reissue** (= ผู้ reissue, พร้อม `tokenHash/tokenIssuedAt/expiresAt`) · ตรวจโค้ด 2026-09-27: `InvitationsService.reissueLink` วันนี้ยังไม่เขียน column นี้ (ยังไม่มี) ⇒ **งาน build + unit/int: reissue โดย X ⇒ แถวมี `issuedByUserId = X`** · `invitedByUserId` คงความหมาย "ใครเชิญ" ของประวัติ (ship แล้วบน wire) · fallback `invitedByUserId` เฉพาะแถวที่ `issuedByUserId` null (ออกก่อน F-003 / ออกบน instance F-002 ระหว่าง rolling)
- **ความเสี่ยงคงเหลือของ fallback = known risk (N-2 — security delta review โฟกัส 2 · ไม่ปิดเพิ่ม):** คำเชิญที่ **reissue บน instance F-002** ระหว่าง rolling ไม่อัปเดต `issuedByUserId` ⇒ re-check ใช้ผู้ออกก่อนหน้า (เช่น Owner สร้าง → Admin reissue บน instance เก่า → Admin ถูกลด → accept ผ่านเพราะเช็ค Owner) — ไม่ใช่ fail-closed แต่**ไม่เปิดช่องจริง** เพราะ: (1) **reissue เปลี่ยนอีเมล/role ไม่ได้** — F-002 reissue แตะแค่ `tokenHash/tokenIssuedAt/expiresAt` (`invitations.service.ts:504-508`) ⇒ ลิงก์ยังผูกกับอีเมลและ role ที่ผู้ออกก่อนหน้า (ผู้ที่ re-check ประเมิน) อนุมัติไว้เอง · ผู้ reissue ที่ไม่คุมอีเมลนั้น accept ไม่ได้ (email mismatch มาก่อน re-check) · ถ้าคุมอยู่ แปลว่าผู้อนุมัติตั้งใจมอบให้อีเมลนั้น ⇒ ไม่ตรงกับ threat ของ SR-02 ("มอบล่วงหน้าให้บัญชีสำรองของตัวเอง") (2) **ช่องเล็กกว่าช่อง rolling เดิม** — ในหน้าต่างเดียวกัน accept ที่ตกไปที่ instance F-002 ไม่ re-check เลย (§12) ⇒ N-2 ไม่เปิดอะไรที่ baseline ของ rolling ไม่เปิดอยู่แล้ว (3) มีขอบเขต — เฉพาะแถวที่ reissue ในหน้าต่าง rolling และหมดตาม TTL (elevated ≤ 24 ชม. จาก `tokenIssuedAt`) · ทิศกลับ (Owner reissue บน instance เก่าแทน A ที่ถูกลด) ⇒ re-check ใช้ A ⇒ ปฏิเสธ = fail-closed ที่ Owner แก้ได้ด้วยการเชิญใหม่ · **ไม่เพิ่ม `issuedForTokenIssuedAt`** (security ยืนยันว่าไม่จำเป็น)
- **ตำแหน่ง:** ใน tx ของ accept (ใต้ org lock เดิม) **หลัง** `canAcceptInvitation` ได้ `ok` เท่านั้น — คือหลัง expired → cancelled/accepted → email → role_unavailable → already_member → superseded ⇒ **ไม่เปลี่ยนคำตอบของกรณีใดที่ F-002 ตอบอยู่** · คนถือลิงก์ที่อีเมลไม่ตรงไปไม่ถึงขั้นนี้ (ทำให้คำเชิญถูกยกเลิกไม่ได้)
- **ตรวจ:** อ่าน `Membership(org, issuer, status='active') → Role` ผ่าน `tx` (ORG_PRISMA — org-scoped) · ไม่มี = `inviter_not_active` (รวมผู้เชิญที่ถูกถอด / ออกเอง / บัญชีถูกลบ — `User` ถูกลบ ⇒ membership ไม่ active ⇒ fail-closed · `issuedByUserId` และ `invitedByUserId` เป็น null ทั้งคู่ (แถวเก่า) ⇒ fail-closed เหมือนกัน) · มี → `decideMemberAuthority({ op:"invite_accept_recheck", actorCapabilities: issuerRole.caps, grantCapabilities: invitationRole.caps })` ลำดับ fn §1.1: **(1) floor `manage_members` (D-035 Addendum P2) → `forbidden` ⇒ `inviter_not_authorized`** (2) role คำเชิญถือ `full_access` ∧ ผู้เชิญไม่ใช่ Owner → `owner_only` ⇒ `inviter_exceeds` (3) Owner ผ่านด้วย bypass (4) grant ⊄ → `exceeds_actor` ⇒ `inviter_exceeds` · floor อ่านผ่าน `hasCapability` (ขยาย imply/`full_access`) ⇒ Owner ผ่าน floor เสมอ
- **role ของคำเชิญถูก soft-delete:** ถูกจับก่อนหน้าแล้วด้วย `role_unavailable` (live read) · role ของผู้เชิญถูก soft-delete ไม่เกิดได้ขณะมีสมาชิก active ถือ (trigger) ⇒ ไม่ต้องมีกรณีแยก
- **ไม่ผ่าน ⇒ (ใน tx เดียวกัน):** `UPDATE Invitation SET status='cancelled', cancelledAt=now` (pattern เดียวกับ `already_member` ที่ commit refusal) → ตอบ **`409 INVITATION_CANCELLED` ไบต์เดียวกับคำเชิญที่ร้านยกเลิกเอง** · เหตุผล: ผู้รับเชิญต้องรู้แค่ "ลิงก์นี้ใช้ไม่ได้ ขอใหม่จากร้าน" — `ROLE_UNAVAILABLE` จะบอกใบ้ว่าเป็นเรื่อง role/สิทธิ์ · ยกเลิกถาวร (ไม่ปล่อย pending) เพราะ: preview/accept รอบถัดไปตอบตรงกัน · Owner เห็นในรายการว่ายกเลิกแล้ว · ไม่มีคำเชิญ "ฟื้น" เองเมื่อผู้เชิญได้สิทธิ์คืน (การมอบต้องเป็นการตัดสินใจใหม่)
- **event (post-commit):** `org.invitation.accept_blocked_inviter` (§7) — มีเหตุผลภายในครบให้ Owner/F-005 · ผู้รับเชิญไม่เห็น
- **preview ไม่ re-check** (ไม่มี lock, ไม่มีตัวตนผู้เรียก) ⇒ preview อาจแสดง pending แล้ว accept ได้ `INVITATION_CANCELLED` — copy เดิมของ code นี้ใช้ได้ (ux รับทราบ)
- **ทางเลือกที่ไม่เลือก:** ยกเลิกคำเชิญของผู้เชิญใน tx ของ revoke/PATCH member — ไม่ครอบกรณีสิทธิ์ผู้เชิญลดลงจาก **การแก้ role** (ไม่แตะ membership) และต้องไล่ทุกเส้นทางที่ลดสิทธิ์ · re-check ตอน accept ครอบทุกทางในจุดเดียว

## 7. Events (US-9) — ที่มา + seam F-005

**ที่มา:** `RolesService` / `MembersService` / `InvitationsService` / `AuthService` ยิงผ่าน `SecurityEventsService` เดิม **หลัง tx คืนค่า** · payload keys pin ใน `SECURITY_EVENT_PAYLOAD_KEYS` (strict)

| event ใหม่ | เมื่อ | payload (id + ชื่อ role + cap เท่านั้น — AC-9.5) |
|---|---|---|
| `org.role.created` | POST role สำเร็จ | `actorUserId, organizationId, roleId, name, capabilities` |
| `org.role.updated` | PATCH สำเร็จ (มีการเปลี่ยนจริง) | `actorUserId, organizationId, roleId, before{name,capabilities}, after{name,capabilities}, affectedActiveMembers, invitationsShortened` |
| `org.role.deleted` | DELETE สำเร็จ | `actorUserId, organizationId, roleId, name, capabilities` |
| `org.role.escalation_denied` | `exceeds_actor` · `target_not_below_actor` · `FULL_ACCESS_RESERVED` · **`ROLE_LOCKED` เมื่อ actor ไม่ถือ `full_access`** (SR-13) บน 8 เส้นทาง | `actorUserId, organizationId, roleId\|null, targetUserId\|null, operation, reason, excessCapabilities[], suppressedCount` |
| `auth.password.admin_reset_blocked_privilege` | refusal `target_not_proper_subset` | `actorUserId, orgId, targetUserId` |
| `org.invitation.accept_blocked_inviter` **ใหม่ (D-035)** | accept re-check ไม่ผ่าน (§6.1) | `actorUserId` (ผู้รับเชิญ), `organizationId, invitationId, issuerUserId, reason` (`inviter_not_active`\|`inviter_not_authorized`\|`inviter_exceeds` — open set), `excessCapabilities[]` |

- `reason` ของ `escalation_denied`: `exceeds_actor` · `target_not_below_actor` (route สมาชิก **และ** role update/delete — §1.3) · `full_access_reserved` · `role_locked` (open set) · `excessCapabilities` ของแกน target = `expand(target) \ expand(actor)` (ว่างได้เมื่อ `equal`) · Owner ที่กดแก้ role Owner พลาด (`ROLE_LOCKED`) **ไม่ยิง** — ไม่ใช่สัญญาณยกสิทธิ์
- **dedupe (SR-12):** key `(actorUserId, organizationId, operation, reason, roleId, targetUserId)` · Redis `SET NX EX 300` — ชนภายใน 5 นาที = ไม่ยิง แต่ `INCR` ตัวนับ · event ถัดไปของ key เดียวกันหลังหมดหน้าต่างพก `suppressedCount` · Redis ล่ม = **ยิงทุกครั้ง** (fail-open สำหรับ log — เสีย volume ดีกว่าเสียสัญญาณ) · metric `security_event_suppressed_total{type}` · ใช้กับ `escalation_denied` เท่านั้น (event อื่นมีเพดานธรรมชาติ: accept_blocked ≤ 1 ครั้งต่อคำเชิญเพราะคำเชิญถูกยกเลิก)
- **ไม่ emit event ปฏิเสธ** สำหรับ `ROLE_EMPTY` / `UNKNOWN_CAPABILITY` / ชื่อซ้ำ / `ROLE_CHANGED` / `ROLE_WRITES_DISABLED` · log warn พอ (§8)
- **backfill (AC-9.3):** `RAISE NOTICE 'f003_backfill actor=system org=… role=… added=manage_roles'` ต่อแถวใน deploy log · `Role.lastEditedAt` คง `null` ⇒ "ค่าเริ่มต้นของระบบ"
- **pin count (AC-9.4):** `F003_SECURITY_EVENT_TYPES` (**6**) แยกจาก F-002 list (15 คงเดิม) · `SECURITY_EVENT_TYPES` = F-001 4 + F-002 15 + F-003 6 = **25** (qa ยืนยัน) · test ครบชุดที่ §13.4
- **seam F-005:** `SecurityEventsService` จุดเดียวที่ยิง · F-005 เปลี่ยน sink เป็น outbox โดยไม่แก้ call site · ข้อจำกัด (AC-9.7): log-only = process ตายหลัง commit ก่อน emit ⇒ event หาย
- **ส่งต่อ product (SR-15, ไม่บล็อก):** Gate 2 ของ feature ที่พลิก capability `upcoming → live` (โดยเฉพาะ `manage_billing`) ควรมี release note / ตัวนับ "role ที่ถือสิทธิ์นี้อยู่แล้ว" ให้ Owner เห็น — เพราะ AC-7.5 ให้ติ๊กล่วงหน้าและมีผลเงียบ ๆ ทันทีที่เปิด
- route GET ที่เรียก decider เพื่อคำนวณ `viewer.*` ไม่ยิง event ใด ๆ

## 8. Observability ขั้นต่ำ

- **security events:** ตาราง §7 + ของเดิม
- **structured log (warn):** `role_write_refused { operation, reason, organizationId, roleId }` สำหรับ refusal ที่ไม่ใช่ security event (ห้ามมีชื่อ role/อีเมล) — รวม `requires_manage_members` (§1.3)
- **metric:** `org_tx_lock_timeout_total{operation}` +3 label · `security_event_suppressed_total{type}` · `org_rate_limited_total{action}` (เดิม) +2 action · **warn log `role_deleted_rows_high {organizationId, count}`** เมื่อแถว soft-delete ของร้าน ≥ 80% ของเพดาน (§10)
- **error log:** `role_invariant_violation` เมื่อ `assertOwnerRemains` บนเส้นทาง role โยน · middleware เจอ membership active ชี้ role ที่ลบแล้ว → error log + `ORG_ACCESS_DENIED` (fail-closed)
- **ไม่มี dashboard ใหม่**

## 9. US-8 cross-org seam + ผลต่อสถาปัตยกรรมรวม

- registry entry มี `scope: "org"` (literal type) · test: ทุก entry `scope === "org"` และไม่มี key ใดขึ้นต้น `platform_`/`cross_`
- `RolesService` inject `ORG_PRISMA` เท่านั้น — `system-prisma-allowlist.test.ts` เดิมคุม · **join `lastEdited.by` (SR-09):** อ่าน `Membership(userId = lastEditedByUserId, status='active')` ผ่าน ORG_PRISMA (org ถูกฉีดเสมอ) — ห้าม raw/SYSTEM_PRISMA · int ที่ §13.5
- super-admin (F-085) — **F-003 ไม่เขียนโค้ดส่วนนี้**
- **sync-back ที่เสนอ (ห้ามแก้เอง):** `docs/architecture/backend.md` §3.3 "cache Redis TTL 60s" → "resolve จาก DB ทุก request — **ไม่มี cache** (F-003 AC-6.5); cache ต้องมาพร้อม invalidation + test" (**ต้องทำจริงตอน G2✓** — security-review ชี้ว่าเอกสารนี้จะชวนให้ใครเพิ่ม cache) · เพิ่ม `rbac/` ใน §2.4

## 10. Capacity + เพดาน (SR-12 — ค่าเป็นข้อกำหนด ไม่ใช่ข้อเสนอ · pin ใน `packages/config` `org-policy.ts` + U-CFG)

| มิติ | ค่า (default · env) | จุดที่พังก่อน / ผลเมื่อเกิน |
|---|---|---|
| role live ต่อร้าน | ≤ **30** รวม system · `MAX_ROLES_PER_ORG` | `409 ROLE_LIMIT_REACHED` · list คืนหน้าเดียว |
| **role ที่ soft-delete ต่อร้าน** | ≤ **500** · `MAX_DELETED_ROLES_PER_ORG` | DELETE ครั้งที่เกิน → `409 ROLE_HISTORY_LIMIT_REACHED` (role ยัง live — ไม่มีอะไรเสีย; ร้านจริงไม่ถึง) · warn log ที่ 80% |
| **`roleWrite`** (POST/PATCH/DELETE role รวมกัน) | **60 / ชม.** key `organizationId` · `ORG_RATE_LIMIT_ROLE_WRITE_PER_HOUR` | `429 RATE_LIMITED` · จำกัดการยึด org lock + การงอกแถว soft-delete ≤ 30/ชม. |
| **`memberWrite`** (PATCH/DELETE member + DELETE invitation) — **ใหม่บน route ที่ ship** | **120 / ชม.** key `userId+organizationId` · `ORG_RATE_LIMIT_MEMBER_WRITE_PER_HOUR` | `429 RATE_LIMITED` (code เดิม) · จำกัดการยิง refusal ใหม่ถล่ม event (ร่วมกับ dedupe §7) · invite create/reissue มี limit เดิมอยู่แล้ว |
| capability ต่อ role | ≤ ขนาด registry · DTO array ≤ 64 | — |
| hot path ต่อ request | ไม่เปลี่ยน: 1 indexed read · `expandCapabilities` O(k) | — |
| `GET /role-details` | `groupBy` 2 ครั้ง + 1 read ≤30 แถว + 1 read membership ของผู้แก้ (≤30 id) | index `(organizationId, status, createdAt)` มีแล้ว |
| accept | + 1 read membership+role ของผู้ออกลิงก์ (indexed PK) | — |

ค่า window คงที่ 1 ชม. ตาม pattern F-002 (`ORG_RATE_LIMIT_DEFAULTS` — behaviour test ลด limit ไม่ใช่ window)

## 11. เสนอ D-XXX (ห้ามแก้ DECISIONS.md เอง — PM route ให้ user · เลขเดิม D-034/D-035 ถูกใช้แล้ว ⇒ เลื่อนเป็น D-036/D-037)

- **เสนอ D-036 — soft-delete สำหรับ entity ที่ประวัติอ้างถึง:** `deletedAt/deletedByUserId` + partial unique `WHERE "deletedAt" IS NULL` + DB trigger กัน "อ้างอิงที่ยังมีชีวิต" ชี้แถวที่ถูกลบ (อ่าน FOR SHARE) + helper `live*Where` บังคับด้วย gate + เพดานแถวที่ลบต่อ tenant · F-003 (Role) เป็นตัวแรก, คาดใช้ซ้ำที่ Product/SellableSku/Warehouse · เหตุผล: FK `ON DELETE RESTRICT` (B-1) ทำ hard delete ไม่ได้อยู่แล้ว และ nullable FK ทำประวัติอ่านชื่อ role ไม่ได้ (AC-3.9b) — data-model §2
- **เสนอ D-037 — ป้าย/คำอธิบาย capability อยู่ใน `core-domain` registry และเสิร์ฟผ่าน `GET /capabilities`** · เหตุผล: AC-7.1 ต้องการชุดเดียวทั้ง 2 client + key "เร็ว ๆ นี้" เปลี่ยนเป็น live ได้โดยไม่ต้องออก app ใหม่ · **ux รับแล้ว (2026-09-27) พร้อมเงื่อนไข:** (1) ux เป็นเจ้าของข้อความใน `rbac/registry.ts` (2) copy-lint ของ ux ครอบไฟล์นั้น (3) `descriptionTh` = 1 ประโยค (4) ข้อความที่ยังอยู่ client: "เร็ว ๆ นี้", "มาพร้อมสิทธิ์จัดการ", fallback ของ key ที่ไม่รู้จัก

## 12. Migration / deploy / rollout flag / rollback (SR-03)

**migration:** 1 schema (`f003_role_expand` — additive, re-apply ได้) → 1 data (`f003_backfill_manage_roles` — idempotent + bridge trigger + Owner ≥ 1) — รายละเอียด data-model §4 · schema เข้ากับโค้ด F-002 ทั้ง rolling และ stop-start (**เฉพาะความเข้ากันของ schema** — ไม่ใช่คุณสมบัติความปลอดภัย)

**ความจริงเรื่องความปลอดภัยระหว่าง rollout (แก้คำอ้างเดิม "ปลอดภัยทั้ง rolling และ stop-start"):** ขณะที่ instance F-002 ยังรับ request อยู่ request ที่ตกไปที่ instance นั้นได้กฎ F-002 — **ไม่มี ⊆ · ไม่มีแกน target ⊊ · ไม่มี reset ⊊ · ไม่มี accept re-check · ไม่กรอง `deletedAt`** ⇒ ถ้ามี custom role อยู่แล้ว Admin ยกตัวเองเข้า role ที่เกินสิทธิ์ได้ (NEW-10 กลับมา) · กฎใหม่ทั้งหมดรับประกันได้**หลัง instance F-002 ตัวสุดท้ายหยุด**เท่านั้น

**`ROLE_WRITES_ENABLED` — flag ปิดการสร้าง custom role จนกว่า rollout ครบ:**
- **อยู่ที่:** `packages/config` (env, boolean, **default `false`** — ค่าที่ไม่ใช่ `"true"` ตรงตัว = false) · อ่านครั้งเดียวตอน boot ผ่าน config module (U-CFG pin)
- **ผล:** guard `RoleWritesEnabledGuard` บน handler ที่มี `@RoleWrite()` (POST/PATCH/DELETE role — ชุดเดียวกับ §13.2 ก) วาง**หลัง** `CapabilityGuard` (ผู้ไม่มี `manage_roles` ยังได้ 403 เดิม ไม่รู้ว่ามี flag) → `503 ROLE_WRITES_DISABLED` · route อ่าน (`GET /capabilities`, `/role-details`, `/roles/{id}`) เปิดตามปกติ · `viewer.canCreate/canEdit/canDelete/canClone.reason = writes_disabled` (client ซ่อน/disable ปุ่ม) · test: registry ของ guard set-equal กับ `ROLE_WRITE_ROUTES`
- **ครอบอะไร:** เฉพาะการเขียน `Role` · **กฎใหม่บน route ที่ ship (⊆, แกน target, reset ⊊, accept re-check, rate limit) ไม่อยู่หลัง flag** — เป็นการคุมให้เข้มขึ้น เปิดทันทีบน instance F-003 · flag ที่ปิดกฎเข้มได้ = ปุ่มเปิดช่องโหว่ ⇒ ไม่มี
- **ทำไมพอ:** ช่องของ SR-03 ต้องมี custom role (หรือ role ที่ถูกแก้) อยู่ก่อน · flag ปิด ⇒ ระหว่าง rollout มีแค่ preset 3 ตัว ⇒ instance F-002 ให้ผล**เท่ากับ F-002 วันนี้** (Admin→Admin reset/เปลี่ยน role ยังผ่านบน instance เก่า = baseline ที่ ship อยู่ ไม่ใช่ช่องใหม่ — ปิดจริงเมื่อ instance เก่าหมด)
- **ใครเปิด:** **devops** ตั้ง `ROLE_WRITES_ENABLED=true` ต่อ environment หลังยืนยัน (1) **ไม่มี instance F-002 เหลือ — เป็นหลักฐาน ไม่ใช่การยืนยันด้วยวาจา (SR-03 delta):** รายการ image digest / build SHA ของ**ทุก** process ที่เสิร์ฟ route members/invitations/auth ในทุก region · canary · worker · job runner (ถ้ามีโค้ด F-002 ที่เรียก service เหล่านี้) ตรงกับ commit F-003 ทั้งหมด แนบใน release record ของ environment นั้น — owner @devops (2) `backfill:f003` รายงาน 0 แถว (3) **G-06/09/11/12 + I-45 int อยู่ในโค้ดของ commit ที่ deploy และ CI log ของ commit นั้นแสดงว่ารันจริง** (นับจำนวนเทสต์ > 0 — §14 · SR-10) · **release** เป็นเจ้าของจังหวะ · release note/changelog **ห้ามประกาศว่า D-034/D-035 มีผลแล้ว** จนกว่าข้อ (1) จะครบ (ช่วงสองรุ่น = baseline F-002) · การเปิด = rolling restart F-003→F-003 (ช่วงที่บาง instance on บาง off = 503 ชั่วคราว ไม่มีผลด้านความปลอดภัย)
- **ถอด flag:** feature ถัดไปที่แตะ `Role` หลัง flag เปิดครบทุก env (forward-commitment — owner backend-api, trigger = devops ยืนยันเปิดครบ)

**Rollback (แทนตาราง data-model §4.3 เดิมในส่วนโค้ด):**

| สถานะ | rollback โค้ด F-003 → F-002 | เหตุผล |
|---|---|---|
| flag ยังไม่เคยเปิด **และ** query ตรวจ = 0 | ✅ ปลอดภัย (กลับสู่ baseline F-002 รวมช่อง Admin→Admin ที่ F-002 มีอยู่แล้ว) | ไม่มี custom/แก้/ลบ role ให้โค้ดเก่าตีความผิด · `manage_roles` ใน Admin ไม่มีผลกับ F-002 |
| flag เคยเปิด และมี role ใดถูกสร้าง/แก้/ลบ | ⛔ **ไม่ปลอดภัย — forward-fix เท่านั้น** | F-002 ไม่มี ⊆ ⇒ Admin มอบ custom role ที่เกินตัวเองให้ตัวเองได้ · F-002 ไม่กรอง `deletedAt` |
| ต้องหยุดการสร้าง/แก้ role ด่วน | ปิด flag (restart) — โค้ดยังเป็น F-003 กฎยังครบ | ไม่แตะ role ที่มีอยู่ |

- **query ตรวจก่อน rollback (runbook devops):** `SELECT count(*) FROM "Role" WHERE key IS NULL OR "lastEditedAt" IS NOT NULL OR "deletedAt" IS NOT NULL` = 0 (backfill ไม่เขียน `lastEditedAt` ⇒ ไม่นับ)
- migration down / backfill down: data-model §4.3

## 13. ข้อกำหนดทดสอบ + seam (qa ลง test-plan, backend สร้าง seam ใน build)

### 13.1 Owner ≥ 1 บนเส้นทาง role (Q-QA-1)
- **spy ทุกทางเขียน** บน fake tx ของ `RolesService`: `role.create/update/updateMany/upsert/delete/deleteMany` · `$executeRaw(Unsafe)` · `$queryRaw(Unsafe)` · call log ร่วม — assert `indexOf(assertOwnerRemains) < indexOf(write แรก)` และบน refusal: write = 0 · test แดงถ้า fake tx มี method เขียนที่ไม่อยู่ใน spy list (enumerate จาก Prisma DMMF — non-vacuity)
- **control:** decider ปล่อยทุกอย่าง + แก้ role ที่ไม่มี Owner ถือ → write 1 ครั้ง
- **unit matrix (core-domain `owner-invariant`):**

| รูป | กรณี | ผล |
|---|---|---|
| 3 `role_capabilities_change` | Owner 1 คน ถอด `full_access` จาก role ของเขา | throw |
| 3 | **Owner 2 คน role เดียวกัน ถอด `full_access` ทั้ง role** | throw |
| 3 | Owner 2 คนคนละ role ถอดจาก role หนึ่ง | ผ่าน |
| 3 | role ที่ไม่มี Owner ถือ | ผ่าน |
| 3 | ร้านที่ Owner = 0 อยู่แล้ว | throw |
| 4 `role_delete` | ลบ role ที่ไม่มีใครถือ | ผ่าน |
| 4 | ลบ role ที่ Owner คนเดียวถือ | throw |
| 4 | ลบ role ที่ Owner ถือ แต่มี Owner อีกคนใน role อื่น | ผ่าน |
| 4 | ร้านที่ Owner = 0 อยู่แล้ว | throw |
| 4 | ลบ role ที่มี membership `revoked` เคยเป็น Owner | ผ่าน (นับเฉพาะ active) |

- **int บน DB จริง:** override `ROLE_WRITE_DECIDER` ด้วยตัวปล่อย → PATCH/DELETE role Owner → **`409 LAST_OWNER`** + แถว Role ไม่เปลี่ยน
- **DB ชั้น 4 (SR-07):** `UPDATE "Role" SET "isSystem"=true, capabilities='{full_access}'` บน custom role ด้วย `SYSTEM_PRISMA` → ปฏิเสธ · INSERT system role ที่สองในร้าน → unique ปฏิเสธ
- **migration-fail harness:** data-model §4.2

### 13.2 ตัวแทน G-15 — 3 ชั้นแบบขยาย (Q-QA-2 · AC-10.2)
- **(ก) route registry จาก metadata จริง:** `@RoleWrite()` → enumerate จาก Nest router → **set-equality** กับ `ROLE_WRITE_ROUTES` · ต่อ route: spy ว่าเรียก `decideRoleWrite` **และ** `assertOwnerRemains` **และ** มี `RoleWritesEnabledGuard` · fixture แดงทั้งสองทิศ
- **(ข) branded type:** `ValidatedCapabilities` สร้างได้จาก `validateRoleCapabilities` เท่านั้น · fixture `@ts-expect-error` · grep ห้าม cast นอก `rbac/` + fixture แดง
- **(ค) tripwire เดิมเปลี่ยนความหมาย:** `RAW_ROLE_WRITE` คงเดิม · allowlist = {`roles.service.ts`, `org-provisioning.service.ts`} · `CAPABILITIES_FROM_INPUT` = "ค่าจาก input ต้องผ่าน `validateRoleCapabilities` ใน call path เดียวกัน" · self-check สองทาง + non-vacuity · ปลด G-15 ใน PR เดียวกับกฎ ⊆ + test

### 13.3 `LIVE_ROLE_WHERE` (Q-QA-3) — data-model §2.2

### 13.4 Event pins (Q-QA-4 · AC-9.4/9.5)
- F-002 list 15 **ไม่แตะ** · `F003_SECURITY_EVENT_TYPES` **toEqual ตามลำดับ** 6 ตัว · union = **25** และไม่ซ้ำ
- `_UNION_IS_EXHAUSTIVE` + `SECURITY_EVENT_PAYLOAD_KEYS` ครบ 6 ตัว · payload strict · **ไม่มีอีเมล** (key + ค่า)
- `org.role.escalation_denied` ยิงครบ **8 เส้นทาง** (role create/update/delete · member PATCH/DELETE · invite create/reissue/cancel) · production export `ESCALATION_CHECKED_OPERATIONS` (8) → **set-equality** กับ operation ที่ spy เห็นเรียก `decideRoleWrite`/`decideMemberAuthority` (ไม่นับ `invite_accept_recheck`/`reset_password` ซึ่งมี event ของตัวเอง) · reason ครบ 4 ค่า · `role_locked` เฉพาะ actor ไม่ถือ `full_access` (Owner = 0 event) · **rollback แล้วไม่มี event**
- **dedupe:** fake Redis — ยิงซ้ำ key เดียวกัน 3 ครั้งใน 5 นาที = 1 event · หลังหมดหน้าต่าง event ถัดไป `suppressedCount=2` · Redis โยน error = ยิงทุกครั้ง · key ต่างกัน (targetUserId ต่าง) = ยิงแยก

### 13.5 seam อื่น
- **admin-reset non-oracle (AC-5.5b):** api-spec §6 · `Content-Length` เท่ากัน · timing = review evidence
- **admin-reset lock (SR-05):** int concurrency — tx A ถือ reset ค้างหลัง Membership FOR SHARE (barrier) · tx B PATCH member ของเป้าหมาย → B ต้องรอจน A commit (วัดด้วย `pg_locks`/ลำดับ commit) · ลำดับกลับกัน: B commit ก่อน → A อ่าน `roleId` ใหม่
- **cross-org leak kit (AC-6.3):** enumerate จาก `ROUTE_CAPABILITIES` · roleId ของร้าน B บน path ร้าน A → 404 + แถว B ไม่เปลี่ยน · `?roleId=<ของ B>` → 200 หน้าว่าง
- **`lastEdited.by` org-scope (SR-09):** int — ผู้แก้ถูกถอดจากร้าน A แต่ active ในร้าน B → `GET /roles/{id}` ของ A ได้ `kind="former_member"` และ **body ไม่มีชื่อ/key ของ role ใดในร้าน B** (assert บน JSON ทั้งก้อน)
- **backfill:** data-model §4.2 · bridge trigger 3 กรณี
- **verdict บน wire = fn เดียวกับตอนเขียน:** property — ทุกคู่ (viewer, row): `viewerCanManage === decideMemberAuthority(...).ok` · verdict=false ⇒ write จริงได้ code ตรง reason (`owner_only`→`FORBIDDEN`, `equal_permissions`/`exceeds_your_permissions` บน MemberRow→`TARGET_NOT_BELOW_ACTOR`, บน Invitation→`ROLE_EXCEEDS_ACTOR`) · audience: ผู้ดูแค่ `manage_members` → `MemberRow.viewerCanManage` **absent** (assert key ไม่อยู่ใน JSON)
- **single-copy gate:** `isProperSubset(` ถูกเรียกเฉพาะ `rbac/member-authority.ts` · `hasCapability(… full_access)` ใน `member-authz`/`admin-reset-authz` ไม่มี logic ⊆/⊊ ของตัวเอง (grep + fixture แดง + นับ match > 0)
- **DI seam:** `ROLE_WRITE_DECIDER` · `OrgOwnershipGuard` · clock (`now`) · `MAX_ROLES_PER_ORG` / `MAX_DELETED_ROLES_PER_ORG` / `ROLE_WRITES_ENABLED` / rate limit ผ่าน config · Redis ของ dedupe (token เดียวกับ rate-limit)

### 13.6 D-034 — สองแกน (AC-5.4 · AC-5.4b · AC-5.8)
- **unit matrix `decideMemberAuthority`** (op × relation): relation ∈ {⊂ แท้, =, ⊃, ตัดกันไม่ครอบ, ว่าง, actor มี `full_access`, มี key ที่ถูก imply, **role มี key ที่ไม่รู้จัก** (SR-11: Owner ผ่าน, non-Owner ไม่ผ่าน)} × op 8 ตัว · **แถว "=" ต้องต่างกัน:** target-axis ops ปฏิเสธ (`relation="equal"`) · grant-axis ops ผ่าน · `actorIsTarget=true`: `change_role` (grant ⊆) ผ่าน / grant ⊄ ปฏิเสธ · `remove` ผ่าน · `reset_password` **ไม่ผ่อน**
- **snapshot เส้น implies ที่ ship (SR-11):** pin ชุด `(key → implies)` ของ registry · ลบเส้น = แดง (เพิ่มเส้นได้) · ข้อความบอกว่า "ลบเส้น implies = ผู้ถือ role ที่เก็บแบบ canonical เสีย view_X เงียบ ๆ — ต้อง data migration"
- **int (route ที่ ship):** Admin→Admin เปลี่ยน role = 403 `TARGET_NOT_BELOW_ACTOR` · ถอด = 403 · ลำดับโจมตี 3 request ล้มที่ขั้นแรก (B ไม่เปลี่ยน, refresh token ของ B ยังใช้ได้) · Admin→Staff เปลี่ยน/ถอด = ผ่าน · Admin ถอดตัวเองผ่าน `DELETE /members/{ตัวเอง}` = ผ่าน · Admin PATCH ตัวเองเป็น Staff = ผ่าน · PATCH ตัวเองเป็น role ⊄ = 403 `ROLE_EXCEEDS_ACTOR` · Owner→Owner เปลี่ยน role = ผ่าน (LAST_OWNER คุม) · Admin ยกเลิกคำเชิญ Admin = ผ่าน (⊆) · PATCH no-op ไป role เดิมบน Admin อีกคน = 403 + event (ไม่ short-circuit)
- **D-034 Addendum — role write (unit `decideRoleWrite` + int):**

| # | actor | role R (before → after) | ผู้ถือ active อื่น | ผล |
|---|---|---|---|---|
| 1 | Admin A | `Admin` = A → ลด 1 cap | Admin B | `403 TARGET_NOT_BELOW_ACTOR` · R/version ไม่เปลี่ยน · event `target_not_below_actor` |
| 2 | Admin A | `Admin` = A → ลด 1 cap | ไม่มี (A ถือคนเดียว) | 200 (⊆ เดิม) |
| 3 | Admin A | custom `R_B` = A → ลด | B | 403 `TARGET_NOT_BELOW_ACTOR` |
| 4 | Admin A | custom `R_B` = A → เปลี่ยนชื่ออย่างเดียว | B | 403 (ทุก field) |
| 5 | Admin A | custom `R_B` = A → ค่าเดิม (no-op) | B | 403 (ไม่ short-circuit) |
| 6 | Admin A | `R` ⊊ A → ยกเป็น = A | B | **200** (= change_role Staff→Admin ที่ D-034 อนุญาต — §1.3) |
| 7 | Admin A | `R` ⊊ A → ลด | B | 200 |
| 8 | Admin A | `R` ⊄ A (ตัดกัน/มากกว่า) | B / ไม่มี | `403 ROLE_EXCEEDS_ACTOR` (มาก่อน target) |
| 9 | Admin A | DELETE `R_B` = A | B | `403 TARGET_NOT_BELOW_ACTOR` (ก่อน `ROLE_IN_USE`) |
| 10 | Admin A | DELETE `R` ⊊ A | B | `409 ROLE_IN_USE` |
| 11 | Owner | `Admin` → ลด | Admin หลายคน | 200 (bypass) |
| 12 | Admin A | `R_B` = A | B เป็น `revoked` / มีแค่คำเชิญ pending | 200 (ไม่นับ) |
| 13 | M (`manage_roles`, ไม่มี `manage_members`) | `R_T` ⊊ M → ลด | T | **`403 ROLE_HELD_REQUIRES_MANAGE_MEMBERS`** · R/version ไม่เปลี่ยน · ไม่มี security event · log warn (Addendum 2) |
| 14 | M | `R_T` ⊊ M → rename-only / no-op | T | 403 `ROLE_HELD_REQUIRES_MANAGE_MEMBERS` (N-1 · ไม่ short-circuit) |
| 15 | M | DELETE `R_T` ⊊ M | T | 403 `ROLE_HELD_REQUIRES_MANAGE_MEMBERS` (ก่อน `ROLE_IN_USE`) |
| 16 | M | `R` = M → ลด | T | 403 `ROLE_HELD_REQUIRES_MANAGE_MEMBERS` (floor ก่อน target) |
| 17 | M | `R` ⊄ M | T | `403 ROLE_EXCEEDS_ACTOR` (ก่อน floor `manage_members`) |
| 18 | M | `R` ⊊ M → ลด | ไม่มี (ไม่มีใครถือ / M ถือคนเดียว / T `revoked` / มีแค่คำเชิญ pending) | 200 (`manage_roles` + ⊆ พอ) |
| 19 | M | clone `R_T` | T | 201 (role ใหม่ไม่มีผู้ถือ) |
| 20 | M′ = M + `manage_members` (control ของ 13) | `R_T` ⊊ M′ → ลด | T | 200 |
| 21 | Owner | `R_T` → ลด | T | 200 (bypass — `full_access` ⇒ มี `manage_members`) |

- **ลำดับโจมตี (AC-5.4b ขยาย — int):** Admin A, B ถือ `R_B` = A: (1) PATCH `R_B` ลด cap → **403 ล้มที่ขั้นแรก** · `R_B.capabilities`/`version` ไม่เปลี่ยน (2) reset B → 404 (3) ไม่มีอะไรให้แก้คืน · + ลำดับเดียวกันด้วย role `Admin` ที่มี Admin 2 คน
- **ลำดับร่วมมือ 2 คน (AC-5.8 · SR-17 — int):** M = `{manage_roles, X, Y}` · A = `{manage_members, Y}` · T ถือ `R_T = {X}` ร้านเดียว (C-2 ไม่ช่วย): (1) M PATCH `R_T` → `{Y}` = **403 `ROLE_HELD_REQUIRES_MANAGE_MEMBERS`** · `R_T` ไม่เปลี่ยน (2) A reset T = 404 (3) ไม่มีอะไรให้แก้คืน · control: M′ (มี `manage_members`) ขั้น 1 ผ่าน
- **lemma — property single-step (SR-16 · หลักฐานหลักของ §1.3 "เหตุผลเชิงรูปแบบ"):** fixture registry เล็ก `{manage_members, manage_roles, X, Y}` (+ `full_access` ของ Owner) · enumerate **ทุก state** ของร้านที่มี Owner 1 + non-Owner 3 คน (ทุกการกระจาย role จาก subset ของ fixture, role ร่วมกันได้, สถานะ active/revoked, คำเชิญ pending 0–1) × **ทุก op ของทุก actor ที่ไม่ใช่ Owner รวม op ต่อตัวเอง**: PATCH member (คนอื่น + ตัวเอง, ทุก grant) · DELETE member (คนอื่น + ตัวเอง) · role create/clone · role update (ทุก after, **รวม role ที่ actor ถือ** และ rename-only/no-op) · role delete · invite create/reissue/cancel · accept (ผู้ใช้ใหม่ ผ่าน D-035 re-check) · reset → เรียก **fn จริงของ core-domain** (`decideRoleWrite`/`decideMemberAuthority`/`canAcceptInvitation`+re-check/`decideAdminReset`) ตัดสิน · op ที่ผ่าน → คำนวณ state ถัดไป · **assert:** `∀ T ∈ U(s), T ≠ actor, T ยัง active ใน s′ ⇒ T ∈ U(s′)` · + `∀ T ∈ U(s), ∀ Y non-Owner ⇒ decideAdminReset(Y,T)` ปฏิเสธ (เชื่อม `U` กับ reset จริง) · **non-vacuity:** นับ op ที่ผ่านแยกตามชนิด — ทุกชนิด > 0 และมี state ที่ `U` ไม่ว่าง
- **control (fixture ปิดกฎทีละข้อ — property ต้องแดง พร้อมพิมพ์ตัวอย่างค้าน):** (c1) ปิด before ⊊ ของ §1.3 → เจอ actor เดียวลด role ที่เท่ากัน (c2) **ปิดแกน target ของ `change_role`** (SR-16) → เจอ PATCH-ลด→reset (c3) **ปิด floor `manage_members` ของ `write_held_role`** (SR-17) → เจอตัวอย่าง 2 actor แบบ M/A ข้างบน (c4) ให้ PATCH ตัวเองข้ามแกน grant → เจอ actor ยกตัวเอง
- **BFS (ตรวจปลายทางเสริม property):** 2 actor ที่ไม่ใช่ Owner (A, M) + T, op ชุดเดียวกับ property, ความลึก **4** · assert ไม่มีสถานะที่ reset T ผ่าน สำหรับทุกคู่เริ่มที่ T ∈ `U` · control c1–c3 ต้องเจอเส้นทาง (ความลึก ≤ 3)
- **no-op บน route สมาชิกทิ้งร่องรอยทั้งสองผล (SR-19 — int):** (a) Admin A PATCH no-op บน Staff S (⊊) → **200 + `org.member.role_changed` 1 ตัว (from = to)** ตามพฤติกรรม F-002 (`members.service.ts:319` ไม่มี short-circuit) (b) คู่กับแถวเดิม: PATCH no-op บน Admin B → 403 + `escalation_denied` 1 ตัว · test (a) พังถ้าใครเพิ่ม no-op short-circuit ⇒ ต้องแก้ spec §1.2 (ค) ก่อน
- **race (int, barrier):** tx1 edit `R` (= A, ไม่มีผู้ถืออื่น) ค้างหลังได้ org lock ‖ tx2 PATCH member ย้าย C เข้า `R` → tx2 รอ · กลับทิศ: tx2 commit ก่อน → tx1 นับ C แล้วปฏิเสธ · accept คำเชิญของ `R` ‖ edit → ผลตรงลำดับ commit ทั้งสองทิศ
- **verdict = fn เดียวกัน:** `viewer.canEdit/canDelete` ของ `RoleDetail` = `decideRoleWrite(...)` ด้วยจำนวนผู้ถือที่นับจาก `usage` · reason `in_use_requires_manage_members` ⇔ write ได้ `ROLE_HELD_REQUIRES_MANAGE_MEMBERS` · `equal_permissions_in_use` ⇔ `TARGET_NOT_BELOW_ACTOR` · audience: ผู้ดู M (ไม่มี `manage_members`) ได้ `in_use_requires_manage_members` บน role ที่มีผู้ถืออื่น และ `usage.activeMembers` ที่ JSON เดียวกันพอให้คำนวณ reason ซ้ำได้ (assert — ยืนยันว่าไม่มีบิตใหม่)

### 13.7 D-035 — accept re-check
- **int:** (1) ผู้เชิญถูกลดเป็น Staff → accept คำเชิญ Admin = `409 INVITATION_CANCELLED` · body เทียบไบต์กับคำเชิญที่ Owner ยกเลิก (หลังแทน traceId) · แถวคำเชิญ `cancelled` · ไม่มี membership ใหม่ · event 1 ครั้ง reason `inviter_exceeds` (2) ผู้เชิญถูกถอด / ออกเอง → `inviter_not_active` (3) role ของผู้เชิญถูกแก้ถอด cap (ไม่แตะ membership) → ปฏิเสธ (4) Owner เชิญ → ผ่านเสมอ (5) Admin ถูกลด แต่ Owner reissue ลิงก์แล้ว → accept ผ่าน (`issuedByUserId`) (6) อีเมลไม่ตรง + ผู้เชิญถูกลด → `INVITATION_EMAIL_MISMATCH` และคำเชิญ**ยัง pending** (7) `already_member` + ผู้เชิญถูกลด → คำตอบเดิม `ALREADY_MEMBER` (8) แถวที่ `issuedByUserId` และ `invitedByUserId` เป็น null → ปฏิเสธ · **(10) (Addendum P2) ผู้เชิญถูกย้ายเป็น role ที่ไม่มี `manage_members` แต่ยัง ⊇ role คำเชิญ (เช่น คำเชิญ Staff) → `409 INVITATION_CANCELLED` reason `inviter_not_authorized` · control: ผู้เชิญคงมี `manage_members` → ผ่าน (11) (Addendum P3) reissue โดย X ⇒ แถวมี `issuedByUserId = X` (unit service + int) · A สร้าง → Owner reissue → A ถูกลด → accept ผ่าน · Owner สร้าง → A reissue → A ถูกลด → accept ปฏิเสธ** · (9) concurrency: accept ‖ PATCH ลดผู้เชิญ — serialize ด้วย org lock, ผลตรงกับลำดับ commit ทั้งสองทิศ

### 13.8 SR-03/04/08/12
- **flag:** default false (unit config) · flag off → 3 route = 503 `ROLE_WRITES_DISABLED` (ผู้ไม่มี `manage_roles` ได้ 403 ไม่ใช่ 503) · GET ทำงาน · verdict `writes_disabled` · flag on → ปกติ
- **ชื่อ Cc/Cf:** data-model §2.1 (fixture ต่อ code point + gate Unicode parity)
- **floor `manage_roles` ใน tx (SR-08):** barrier — request ผ่าน guard แล้วค้างก่อน lock · Owner ถอด `manage_roles` ของ role actor แล้ว commit · request เดินต่อ → 403 `FORBIDDEN` + ไม่มี write
- **floor `manage_members` ของ role ที่มีผู้ถือ (Addendum 2):** barrier เดียวกัน — Owner ถอด `manage_members` ของ actor ระหว่างรอ → `403 ROLE_HELD_REQUIRES_MANAGE_MEMBERS` + ไม่มี write · กลับทิศ: role ไม่มีผู้ถือตอนเปิดจอ แต่ C ถูกย้ายเข้าก่อน edit ได้ล็อก → edit ได้ 403 (race §1.3)
- **rate limit:** `roleWrite`/`memberWrite` ครบ limit → 429 (behaviour test ลด limit) · เพดาน soft-delete: ลบครบ `MAX_DELETED_ROLES_PER_ORG` (ลดค่าใน test) → 409 `ROLE_HISTORY_LIMIT_REACHED` + role ยัง live

## 14. เงื่อนไขก่อนเปิด `ROLE_WRITES_ENABLED` (AC-10.1 — งานจริง ไม่ใช่ checkbox)

ตรวจ repo 2026-09-27: **G-06 / G-09 / G-11 / G-12 ไม่มี implementation ใน repo** · **I-45 มีแค่ unit** (`apps/api/src/orgs/roles.service.test.ts:60`) — **ไม่มี int test**
- **task (build, ก่อน PR แรกที่มี route เขียน role):** (1) implement G-06/09/11/12 ตามนิยาม F-002 test-plan §10 + fixture แดง (G-05) + non-vacuity · **G-12 ขยายขอบเขต (SR-10):** scan `packages/db/prisma/migrations/**/migration.sql` เฉพาะ**ตัว function/trigger** (`CREATE [OR REPLACE] FUNCTION … $$ … $$`) ที่อ้าง `key = '(owner|admin|staff)'` → แดง เว้นแต่อยู่ใน allowlist ที่มี `removeBy` (วันที่) · `role_f003_admin_bridge` อยู่ใน allowlist `removeBy = วัน merge PR build + 60 วัน` (backend ตั้งตอน build) → เลยวันแล้วยังอยู่ = แดง (บังคับถอด — data-model §4.2) · backfill `UPDATE` ไม่ใช่ function ⇒ ไม่นับ (2) I-45 int: สลับ key Staff↔Owner + `key=null` บน DB จริง → ชุด Owner-only ทั้งหมด + เส้น F-003 ใหม่ → ตัดสินด้วย capabilities เท่านั้น
- **ลำดับ merge:** PR gate (1)+(2) merge ก่อน หรืออยู่ PR เดียวกับ route เขียน role · route เขียน role ห้าม merge ถ้า CI ไม่รันทั้งสองชุดจริง (ตรวจจำนวนเทสต์ที่รันใน log — "green locally ≠ tested") · flag เปิดไม่ได้ก่อนข้อนี้ (§12 เงื่อนไข 3)
- **G-12 เป็นเงื่อนไขเปิด flag โดยตรง (SR-10 delta):** security ปิด SR-10 "ในการออกแบบ" เท่านั้น — การบังคับถอด `role_f003_admin_bridge` มีจริงเมื่อ G-12 อยู่ในโค้ดเท่านั้น ⇒ devops ต้องเห็น G-12 (พร้อม fixture แดง + non-vacuity + allowlist ที่มี `removeBy` ของ bridge) **ใน commit ที่ deploy** และรันใน CI log ของ commit นั้น ก่อนตั้ง flag ใน environment ใด · ไม่มี = ไม่เปิด (ไม่มีข้อยกเว้นแบบ "ตามมาทีหลัง")

## 15. ตอบ security review (SR-F003-01..19)

| SR | severity | แก้ที่ | สถานะ |
|---|---|---|---|
| 01 | High | §1.1 (`decideMemberAuthority` สองแกน, ยกเว้นตัวเอง, regression) · §1.2 (verdict/oracle) · §1.3 (role update/delete ที่มีผู้ถืออื่น: `manage_members` + before ⊊ · นับใต้ org lock · race · verdict) · §13.6 · api-spec §2/§3/§4.3/§5 | ✅ ตาม D-034 + Addendum (ก) + Addendum 2 (ข) |
| 02 | Medium | §6.1 (re-check ใต้ org lock · floor `manage_members` ของผู้เชิญ · ผู้เชิญ = `issuedByUserId` · ยกเลิก + `INVITATION_CANCELLED`) · §13.7 · data-model §5 | ✅ ตาม D-035 + Addendum P2/P3 · N-2 = known risk พร้อมเหตุผล (§6.1) |
| 03 | Medium | §12 (flag, คำอ้างที่แก้, rollback · **เงื่อนไขเปิดข้อ 1 = หลักฐาน image digest ทุก process/region/canary · ห้ามประกาศ D-034/035 ก่อนครบ**) · data-model §4.3/§4.4 | ✅ · devops รับเงื่อนไขเปิด flag |
| 04 | Medium | §1 `validateRoleName` · data-model §2.1/§3.1/§4.1 · api-spec §5 | ✅ |
| 05 | Low | §3 (User → Membership → Role) · §13.5 | ✅ |
| 06 | Low | data-model §3.3 (trigger อ่าน Role FOR SHARE, fn VOLATILE) · §13 | ✅ |
| 07 | Low | §2 ชั้น 4 · data-model §3.1/§3.3/§4.1 | ✅ |
| 08 | Low | §1 `decideRoleWrite` ข้อ 0 · §5 · §13.8 | ✅ |
| 09 | Low | §9 · §13.5 · api-spec §3 | ✅ |
| 10 | Low | §14 (G-12 ครอบ migrations + `removeBy` · **G-12 อยู่ในโค้ด commit ที่ deploy = เงื่อนไขเปิด flag โดยตรง**) · §12 เงื่อนไข 3 · data-model §4.2 | ✅ ในการออกแบบ · บังคับใช้จริงเมื่อ G-12 เข้าโค้ด (ผูกกับ flag แล้ว) |
| 11 | Low | §1.1 ข้อ 3 (bypass ชัด) · §13.6 (unknown key + snapshot implies) | ✅ |
| 12 | Low | §10 (ค่าเป็นข้อกำหนด + soft-delete cap) · §7 (dedupe) | ✅ |
| 13 | Info | §7 (`role_locked` เมื่อไม่ใช่ Owner) | ✅ |
| 14 | Info | §4 · api-spec §5 `ROLE_CHANGED` (client MUST) | ✅ · test ฝั่ง client = frontend/qa |
| 15 | Info | §7 (ส่งต่อ product) | ↪ product — ไม่บล็อก F-003 |
| **16** | Low | §1.3 (lemma เขียนใหม่: หลาย actor, induction ทีละ op, ขอบเขตชัด) · §13.6 (**property single-step ทุก op ทุก actor รวม op ต่อตัวเอง** + control c1–c4 รวม **ปิดแกน target ของ `change_role`** + BFS 2 actor ลึก 4) | ✅ · qa ลง test-plan |
| **17** | Low | §1.1 (`write_held_role` floor `manage_members`) · §1.3 (กฎ · ลำดับ · code `ROLE_HELD_REQUIRES_MANAGE_MEMBERS` · verdict `in_use_requires_manage_members` + ตรวจ oracle) · §5 · §13.6 แถว 13–21 + ลำดับร่วมมือ 2 คน · §13.8 barrier · api-spec §2/§3/§5 | ✅ ตาม D-034 Addendum 2 (ข) |
| **18** | Info | §1.3 (rename-only อยู่ใต้กฎ) · §13.6 แถว 4/14 · §16 | ✅ ตาม Addendum 2 N-1 — คงบล็อก · wire ไม่เปลี่ยน (`canEdit` ตัวเดียว) |
| **19** | Info | §1.2 (ค) (no-op ไม่ short-circuit = ข้อกำหนด) · §13.6 int (a)/(b) · api-spec §4.3 | ✅ · qa ลง test-plan |

**เลื่อนไป build:** ไม่มี SR ที่เลื่อนทั้งข้อ · ความเสี่ยงคงเหลือที่รับไว้: SR-04 ทางเลือกเสริม (สระ/วรรณยุกต์ไทยซ้อน · U+3164/U+2800) — ux ตัดสินไม่จับคำคล้าย · oracle "เท่ากัน" ผ่านการลองเขียนจริง (§1.2 — ทิ้ง event/ร่องรอยทุกผล, SR-19) · issuer fallback ระหว่าง rolling (N-2 · §6.1)

## 16. คำถามที่ยังเปิด

**ไม่มี**

**ปิดแล้ว (2026-09-27, user/security):** Q-SR01b → D-034 Addendum (ก) · SR-17 → D-034 Addendum 2 (ข) — §1.3 · **N-1 → Addendum 2: คงบล็อก rename-only** (§1.3 · `canEdit` ตัวเดียว ไม่แยกต่อ field) · **N-2 → known risk ตาม security delta review โฟกัส 2** (เหตุผลใน §6.1 · ไม่เพิ่ม `issuedForTokenIssuedAt`) · Q-P2/Q-P3 → D-035 Addendum — §6.1
