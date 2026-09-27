---
doc: api-spec
owner: "@backend-api"
signoff: approved     # user 2026-09-27 (+ รับ D-036/D-037)
---
# [F-003] API design
> สัญญาผ่าน OpenAPI (`packages/contracts/openapi/root.yaml` → bundle) — **seam กลาง FE↔BE** · ต่อจาก [architecture.md](architecture.md) + [data-model.md](data-model.md)
> skill `contract-evolution`: `GET /roles`, route สมาชิก/คำเชิญ/accept/admin-reset **ship แล้วและมี client 2 ตัวกินอยู่ ⇒ additive เท่านั้น** (oasdiff ต้องผ่าน) · D-028 · D-030 · D-032 · **D-034 · D-035**
> รอบ 3 (2026-09-27): แก้ตาม security-review (ตารางรวม architecture §15) · Q-P1 ปิดแล้ว (AC-9.6)
> รอบ 4 (2026-09-27): D-034 Addendum (PATCH/DELETE role ที่มีผู้ถืออื่น — §2/§3/§5) · D-035 Addendum (accept ตรวจ `manage_members` ของผู้ออกลิงก์ล่าสุด — §4.3) · Q-SR01b/Q-P2/Q-P3 ปิดแล้ว
> รอบ 5 (2026-09-27): **D-034 Addendum 2** (PATCH/DELETE role ที่มีผู้ถืออื่นต้องถือ `manage_members` → code ใหม่ `ROLE_HELD_REQUIRES_MANAGE_MEMBERS` + reason `in_use_requires_manage_members` — §2/§3/§5) · SR-19 (no-op บน PATCH member ยังเขียน + ยิง event — §4.3) · N-1/N-2 ปิด (§8)
> amendment 2026-09-27 (user อนุมัติ · ถ้อยคำเท่านั้น): §2 ลำดับการตรวจ PATCH role ระบุตำแหน่ง no-op ชัด (หลัง `TARGET_NOT_BELOW_ACTOR` · 200 คืน `RoleDetail` ปัจจุบัน · ไม่เทียบ `version` · ไม่เขียน · ไม่ยิง event) — ตรงกับ §2 บรรทัด no-op เดิม + test-plan I3-08 · ไม่ขัด SR-19/§1.2 (ค) ของ D-034: no-op มาถึงขั้นนี้ได้ต่อเมื่อผ่านกฎสิทธิ์ครบแล้ว ⇒ ไม่ใช่การลองที่ถูกปฏิเสธ และผล "ผ่าน" เดียวกันเห็นได้อยู่แล้วจาก `viewer.canEdit` ⇒ ไม่เปิด oracle ใหม่ (SR-19 คุม route **member** ซึ่งยัง emit ตามเดิม)

## Contract summary (≤20 บรรทัด — ทีม consumer อ่านแค่ส่วนนี้)
- **route ใหม่ 6 เส้น gate `manage_roles` (org-scoped ทุกเส้น):** `GET /capabilities` · `GET /role-details` · `GET|PATCH|DELETE /roles/{roleId}` · `POST /roles` · ไม่มี endpoint clone
- **route เขียน role 3 เส้นปิดด้วย flag จน rollout ครบ:** `503 ROLE_WRITES_DISABLED` + `viewer.*.reason = "writes_disabled"` — client ต้องรองรับตั้งแต่วันแรก
- **`GET /roles` (ship แล้ว) ยังไม่ส่ง `capabilities`** · +optional `nameCustomized` · `viewerCanAssign`/`assignBlockedReason` (ผู้ถือ `manage_members`)
- **กติกาแสดงชื่อ role (AC-1.5):** `nameCustomized ? name : (แปล key ?? name)` · `roleNameCustomized?` ใน 6 schema ที่มี roleKey
- **verdict ต่อแถว (additive):** `MemberRow.viewerCanManage`/`viewerCanResetPassword` **เฉพาะผู้ดูที่ถือ `manage_members` ∧ `manage_roles`** · `Invitation.viewerCanManage` เฉพาะผู้ถือ `manage_members` · reason ใหม่ `equal_permissions` — §3.1
- **กรองตาม role:** `GET /members?roleId=` · `GET /invitations?roleId=`
- **capabilities ใน request ถูก canonicalize** (§2) · `OrgMyMembership.capabilities` = ชุดที่เก็บ (ไม่ขยาย)
- **PATCH/DELETE role ที่มีผู้ถือ active คนอื่น (D-034 Addendum + Addendum 2 · ทุก field รวม rename-only):** ผู้แก้ต้องถือ `manage_members` → ไม่ถือ `403 ROLE_HELD_REQUIRES_MANAGE_MEMBERS` / reason `in_use_requires_manage_members` · caps เดิมต้อง ⊊ ผู้แก้ → ไม่ผ่าน `403 TARGET_NOT_BELOW_ACTOR` / reason `equal_permissions_in_use` · Owner ผ่าน · ⚠️ Admin > 1 คน: Admin แก้/ลบ role Admin ไม่ได้ · ผู้ถือแค่ `manage_roles` แก้ได้เฉพาะ role ที่ไม่มีผู้ถืออื่น (โคลนได้เสมอ)
- **PATCH role ต้องส่ง `version`** → `409 ROLE_CHANGED` — **client MUST re-fetch, ห้าม resubmit อัตโนมัติ**
- **error ใหม่:** `403 ROLE_EXCEEDS_ACTOR|TARGET_NOT_BELOW_ACTOR|ROLE_HELD_REQUIRES_MANAGE_MEMBERS` · `409 ROLE_LOCKED|ROLE_NAME_TAKEN|ROLE_LIMIT_REACHED|ROLE_HISTORY_LIMIT_REACHED|ROLE_IN_USE|ROLE_CHANGED` · `422 ROLE_EMPTY|UNKNOWN_CAPABILITY|FULL_ACCESS_RESERVED` · `503 ROLE_WRITES_DISABLED` (§5)
- **⚠️ พฤติกรรมใหม่บน route ที่ ship (wire shape เดิม):** รายการเต็ม §4.3 — Admin เปลี่ยน role/ถอด Admin = `403 TARGET_NOT_BELOW_ACTOR` · มอบ role เกินตัว = `403 ROLE_EXCEEDS_ACTOR` · Admin ยกเลิกคำเชิญ Owner = 403 · accept เมื่อผู้ออกลิงก์ล่าสุดไม่ active / ไม่มี `manage_members` / ⊉ role คำเชิญ = `409 INVITATION_CANCELLED` · reset ⊊ = 404 · rate limit ใหม่ 429
- **แตะ Owner ยัง `403 FORBIDDEN` เดิมทุกไบต์** (ตรวจก่อนทุกกฎใหม่) · admin-reset 404 รูปเดิมทุกไบต์
- **ชื่อ role ห้ามอักขระมองไม่เห็น/ควบคุม (Cc/Cf)** → `422 VALIDATION_FAILED` `fieldErrors.name`
- `lastEdited.by = { kind: "me"|"member"|"former_member", roleName?, roleKey?, roleNameCustomized? }` (AC-9.6) · **ไม่มี `displayName` ใน F-003**
- **gate ของ route สมาชิก/คำเชิญไม่เปลี่ยน** (`manage_members` — AC-2.5)

---

## 1. Endpoint

| Method | Path | คำอธิบาย | Auth/Permission | lock op |
|---|---|---|---|---|
| GET | `/orgs/{orgId}/roles` | **(ship แล้ว)** role ทั้งร้าน (dropdown) — +field optional §4.1 | `@AnyActiveMember` (ไม่เปลี่ยน) | — |
| GET | `/orgs/{orgId}/capabilities` | registry ที่ร้านนี้เห็น — ซ่อน tier `full` | `manage_roles` | — |
| GET | `/orgs/{orgId}/role-details` | role ทุกตัวแบบเต็ม — หน้ารายการ role | `manage_roles` | — |
| GET | `/orgs/{orgId}/roles/{roleId}` | role เดียวแบบเต็ม (`RoleDetail`) — หน้าแก้และ "clone" | `manage_roles` | — |
| POST | `/orgs/{orgId}/roles` | สร้าง role (รวม clone) | `manage_roles` + **flag** + US-5 + rate limit `roleWrite` | `createRole` |
| PATCH | `/orgs/{orgId}/roles/{roleId}` | แก้ชื่อ และ/หรือ capabilities (ต้องมี `version`) | `manage_roles` + **flag** + US-5 + `roleWrite` | `updateRole` |
| DELETE | `/orgs/{orgId}/roles/{roleId}` | ลบ (soft) | `manage_roles` + **flag** + US-5 + `roleWrite` | `deleteRole` |

- **flag `ROLE_WRITES_ENABLED` (default false — architecture §12):** guard อยู่**หลัง** capability guard ⇒ ผู้ไม่มี `manage_roles` ได้ `403 FORBIDDEN` เดิม (ไม่รู้ว่ามี flag) · ผู้ถือได้ `503 ROLE_WRITES_DISABLED` · route GET ไม่ถูก flag
- **rate limit `roleWrite`:** 60 / ชม. ต่อร้าน (3 route รวมกัน) → `429 RATE_LIMITED` (code เดิม + `Retry-After`)
- **ทำไมไม่มี `POST …/roles/{id}/clone`:** clone ไม่มีกฎของตัวเอง — ผลคือ role ใหม่ที่ต้องผ่าน create ทุกข้อ · endpoint แยก = เส้นทางเขียน `Role` ที่สองโดยไม่ได้อะไรเพิ่ม · ปุ่มมาจาก `viewer.canClone`
- **ทำไม `role-details` แยก path จาก `GET /roles`:** 1 route = 1 capability (F-002 §3.1) · shape ต้องไม่ขึ้นกับผู้ดู
- **`GET /capabilities` เป็น org-scoped:** tier `full` เป็น entitlement รายร้าน (F-007) · gate ต้องมีร้าน · leak kit ครอบอัตโนมัติ · client cache ต่อร้าน
- ทุก route: `{orgId}` หรือ `X-Organization-Id` (ไม่ตรง = `422 ORG_MISMATCH`) · `Cache-Control: no-store` · envelope เดิม
- registry ภายใน: `ROUTE_CAPABILITIES` +6 · `ORG_LOCK_REQUIRED_OPERATIONS` +3 · `ANY_ACTIVE_MEMBER_ROUTES` **ไม่เปลี่ยน** · route↔spec parity gate ครอบอัตโนมัติ

## 2. Request

```yaml
CreateRoleRequest:            # POST /roles
  name: string                # 1–50 code point หลัง normalize (NFC + trim + ยุบช่องว่าง) · ห้าม Cc/Cf หลัง normalize · response คืนชื่อที่ normalize แล้ว
  capabilities: string[]      # maxItems 64, item maxLength 64 — ที่เหลือ core-domain ตัดสิน
  # ไม่มี `key`, `isSystem`, `version` — ValidationPipe whitelist ตัดทิ้ง ⇒ custom role key=null เสมอ (AC-1.4)

UpdateRoleRequest:            # PATCH /roles/{roleId}
  version: integer            # required — ค่าจาก RoleDetail.version ที่ผู้ใช้เห็น
  name?: string
  capabilities?: string[]     # "ชุดใหม่ทั้งชุด" (replace) ไม่ใช่ diff
  # ไม่มีทั้งคู่ ⇒ 422 VALIDATION_FAILED · ค่าเท่าเดิมทั้งคู่ ⇒ 200 ไม่ bump version ไม่ยิง event (no-op)
```
DELETE ไม่มี body · ไม่รับ `version`

**Canonical form ของ `capabilities` (deterministic, client คำนวณซ้ำได้):** หลังผ่านการตรวจ (`ROLE_EMPTY` → `FULL_ACCESS_RESERVED` → `UNKNOWN_CAPABILITY`) server เก็บ
`canonical(S) = sort_by_key( dedupe(S) \ { v | ∃k ∈ S, k ≠ v, v ∈ implies[k] } )`
- ส่ง `view_X` ที่ถูก `manage_X` imply มาด้วย = รับ แล้วตัดทิ้ง · ส่ง `view_X` เดี่ยว ๆ = เก็บ
- `implies` จาก `CapabilityCatalog.items[].implies` · imply ชั้นเดียว
- no-op เทียบ `canonical(ใหม่) == canonical(เดิม)` — **ตรวจหลังกฎสิทธิ์ทั้งหมด** ⇒ no-op บน role ที่ติด `TARGET_NOT_BELOW_ACTOR` = 403 ไม่ใช่ 200 (architecture §1.3)
- response คืนชุด canonical เสมอ
- กฎ ⊆ ไม่ขึ้นกับ canonicalization (เทียบหลัง `expandCapabilities`)

**ลำดับการตรวจของ route role (ตายตัว):** capability guard (`403 FORBIDDEN`) → flag (`503 ROLE_WRITES_DISABLED`) → rate limit (`429`) → role มีอยู่/live/ร้านเดียวกัน (`404`) → **floor `manage_roles` จากสิทธิ์ที่อ่านใน tx (`403 FORBIDDEN`)** → `ROLE_LOCKED` → รูปร่าง body (`VALIDATION_FAILED`) → ชื่อ (`VALIDATION_FAILED`: ความยาว / Cc-Cf → `ROLE_NAME_TAKEN` คำสงวน) → `ROLE_EMPTY` → `FULL_ACCESS_RESERVED` → `UNKNOWN_CAPABILITY` → `ROLE_EXCEEDS_ACTOR` → (update/delete เมื่อมีผู้ถือ active คนอื่น — นับใน tx) **ผู้แก้ไม่ถือ `manage_members` (อ่านใน tx — Addendum 2) `ROLE_HELD_REQUIRES_MANAGE_MEMBERS`** → caps เดิม ¬⊊ ผู้แก้ (Addendum) `TARGET_NOT_BELOW_ACTOR` → **(update) no-op: ชื่อ normalize แล้วเท่าเดิม ∧ `canonical(caps)` เท่าเดิม ⇒ `200` คืน `RoleDetail` ปัจจุบัน (version ปัจจุบัน) ไม่เทียบ `version` ไม่เขียน ไม่ยิง event** → (create) `ROLE_LIMIT_REACHED` / (delete) `ROLE_IN_USE` → `ROLE_HISTORY_LIMIT_REACHED` → Owner invariant (`LAST_OWNER` — ไม่ควรเกิด) → write (`ROLE_CHANGED` / unique → `ROLE_NAME_TAKEN`)

## 3. Response

```yaml
RoleDetail:                   # GET /roles/{id} · items ของ /role-details · 201 POST · 200 PATCH
  id: string
  name: string
  key: string | null          # แปลเท่านั้น ⛔ ห้ามตัดสินสิทธิ์
  nameCustomized: boolean     # §4.1
  isSystem: boolean           # true = Owner (ล็อก)
  grantsOwnership: boolean    # จาก capabilities (full_access) — ไม่ใช่ key
  capabilities: string[]      # ชุด canonical ที่เก็บจริง เรียงตาม key · Owner = ["full_access"] · อาจมี key "upcoming"
  version: integer
  usage: { activeMembers: integer, pendingInvitations: integer }   # ตัวเลขเท่านั้น · pending รวมที่หมดอายุ (AC-3.9)
  lastEdited:                 # null = "ค่าเริ่มต้นของระบบ" (AC-9.6)
    at: date-time
    by:
      kind: string            # open set: "me" | "member" | "former_member" → "คุณ" / ชื่อบทบาทปัจจุบัน / "อดีตสมาชิก"
      roleName?: string       # มีเฉพาะ kind="member" — role ปัจจุบันของผู้แก้ในร้านนี้ (อ่าน ณ ตอนดู) · แสดงตามกติกา AC-1.5
      roleKey?: string | null #   〃 (แปลเท่านั้น)
      roleNameCustomized?: boolean  # 〃
  viewer:                     # คำตัดสินสำหรับผู้เรียก ณ ตอนอ่าน — UX input ไม่ใช่ enforcement
    canEdit:   { allowed: boolean, reason: string | null }   # role_locked | exceeds_your_permissions | in_use_requires_manage_members | equal_permissions_in_use | writes_disabled
    canDelete: { allowed: boolean, reason: string | null }   # role_locked | exceeds_your_permissions | in_use_requires_manage_members | equal_permissions_in_use | in_use | history_limit_reached | writes_disabled
    canClone:  { allowed: boolean, reason: string | null }   # owner_role | exceeds_your_permissions | role_limit_reached | writes_disabled
  createdAt: date-time

RoleDetailListPage:
  items: RoleDetail[]         # เรียง createdAt asc, id asc
  nextCursor: null
  viewer:
    canCreate: { allowed: boolean, reason: string | null }   # role_limit_reached | writes_disabled
    limit: integer

DeletedRole: { id: string, deletedAt: date-time }              # 200 DELETE

CapabilityCatalog:            # GET /capabilities
  groups: [{ key: string, labelTh: string }]
  items:  [{ key, labelTh, descriptionTh, group: string|null, status: string, implies: string[], selectable: boolean }]
  # ไม่มี entry tier "full" (AC-7.4) · full_access อยู่ด้วย selectable=false group=null
```
- **enum แบบเปิด (open set):** `reason`, `status`, `group`, `lastEdited.by.kind`, `assignBlockedReason`, `manageBlockedReason`, `resetBlockedReason` เป็น `type: string` + รายการค่าใน description + "ค่าที่ไม่รู้จัก ⇒ ข้อความกลาง"
- **`writes_disabled` มีลำดับเหนือ reason อื่น** เมื่อ flag ปิด (ปุ่มทุกปุ่มที่เขียน role disabled ด้วยเหตุผลเดียว)
- **`in_use_requires_manage_members` (D-034 Addendum 2):** role มีสมาชิก active คนอื่นถือ **และ** ผู้ดูไม่ถือ `manage_members` ⇒ แก้ (รวมเปลี่ยนชื่อ) / ลบไม่ได้ · โคลนได้ (`canClone` ไม่ได้รับผล) · copy = ux (AC-5.2)
- **`equal_permissions_in_use` (D-034 Addendum):** role มีสิทธิ์เท่ากับผู้ดูพอดี **และ** มีสมาชิก active คนอื่นถือ ⇒ แก้ (รวมเปลี่ยนชื่อ) / ลบไม่ได้ ต้องให้เจ้าของร้าน
- **ลำดับ reason (ตายตัว — ตามลำดับ `decideRoleWrite`):** `writes_disabled` → `role_locked` → `exceeds_your_permissions` → `in_use_requires_manage_members` → `equal_permissions_in_use` → (`canDelete`) `in_use` → `history_limit_reached`
- **ไม่เป็น oracle (AC-6.4 — architecture §1.3):** ทุก reason คำนวณได้จากข้อมูลที่ผู้ดูคนเดียวกันได้อยู่แล้ว — caps ของ role (ผู้ดูถือ `manage_roles`) · "มีคนอื่นถือ" = `usage.activeMembers` (ส่งให้ผู้ถือ `manage_roles` ทุกคน รวมคนที่ไม่มี `manage_members`) กับ `myMembership.roleId` · "ฉันไม่มี `manage_members`" = `myMembership.capabilities` · ไม่เผยตัวผู้ถือ · ค่าตัดสินด้วย `decideRoleWrite` ตัวเดียวกับตอนเขียน
- `viewer.*` คำนวณจาก capabilities ใน org context ของ request (read-only) · เส้นทางเขียนอ่านสิทธิ์ใหม่ใน tx เสมอ (AC-5.7)
- **`lastEdited.by` (AC-9.6 — user ตัดสิน 2026-09-27):** `kind` derive ตอนอ่าน — `me` · `member` (มี membership active **ในร้านนี้** → role ปัจจุบันของเขา) · `former_member` (รวม User ที่ถูกลบ) · **ไม่มีอีเมล/ userId บน wire** · join ผ่าน ORG_PRISMA เท่านั้น — ผู้แก้ที่ active ในร้านอื่นแต่ไม่อยู่ร้านนี้ = `former_member` และไม่มีข้อมูลของร้านอื่นในคำตอบ (SR-09, int test architecture §13.5) · **รับทราบ:** ในร้านเล็ก role ที่มีผู้ถือคนเดียวระบุตัวคนได้โดยอนุมาน (product ลงใน F-003 §5)
- **ไม่มี `displayName?` (ตัดสินตาม `contract-evolution`):** field optional ที่ไม่มีวันถูกส่งใน F-003 ทดสอบไม่ได้ และชวน client เขียน branch ที่ไม่มีวันรัน · การเพิ่ม optional response property ภายหลังเป็น non-breaking อยู่แล้ว ⇒ ไม่ต้องจองที่ · เพิ่มเมื่อ feature profile ผ่าน Gate 1 (forward-commitment F-003 §7)

### 3.1 คำตัดสินของผู้ดูบน route ที่ ship

**(1) `OrgMyMembership.capabilities` = ชุดที่เก็บจริง (canonical, ไม่ขยาย)** — คงความหมายที่ ship · กติกาเทียบ AC-3.10 (เมื่อ `RoleDetail.id === myMembership.roleId`): `expand(S) = S ∪ ⋃ implies[k]` · `lost = expand(เดิม) \ expand(ใหม่)` · core-domain export `lostCapabilities` + **golden vectors** (`packages/core-domain/src/rbac/fixtures/lost-capabilities.vectors.json`)

**(2)** canonical form — §2

**(3) verdict ของแถวสมาชิก — ส่งเฉพาะผู้ดูที่ถือ `manage_members` ∧ `manage_roles` (หลังขยาย) และเฉพาะแถว `status=active`**

| field | ค่า | reason (open set, ลำดับตายตัว) |
|---|---|---|
| `viewerCanManage?` / `manageBlockedReason?` | `decideMemberAuthority({op:"change_role"})` แกน target เท่านั้น (ไม่มี role ใหม่) — "เปลี่ยน role / ถอด คนนี้ได้ไหม" | `owner_only` → `equal_permissions` → `exceeds_your_permissions` |
| `viewerCanResetPassword?` / `resetBlockedReason?` | `decideAdminResetVisible(viewer, row)` | `self` → `owner_only` → `equal_permissions` → `exceeds_your_permissions` |

- **ทำไมจำกัดผู้ดู (AC-6.4 — architecture §1.2):** ผู้ดูที่มีแค่ `manage_members` รู้ `role ⊆ ฉัน` จาก `viewerCanAssign` อยู่แล้ว · ถ้าได้ verdict แกน ⊊ ด้วย ⇒ `⊆ ∧ ¬⊊` = **capabilities ของ role นั้นเท่ากับของฉันทุกตัว** = อ่าน capabilities ผ่านช่องข้าง · ผู้ดูที่ได้ field อ่าน capabilities ของทุก role ได้จาก `/role-details` อยู่แล้ว ⇒ แยก `equal_permissions` ได้โดยไม่รั่ว
- **ผู้ดูที่มีแค่ `manage_members`:** field absent → client ใช้พฤติกรรม F-002 (แสดงปุ่มกับแถว active ที่ไม่ใช่ Owner/ตัวเอง) · เมื่อได้ `403 TARGET_NOT_BELOW_ACTOR` / 404 ของ reset → copy กลาง ("คุณจัดการสมาชิกคนนี้ไม่ได้ — ให้เจ้าของร้านช่วย") · การลองเขียนจริงเผยบิต "เท่ากัน" ได้โดยธรรมชาติของ D-034 แต่ทิ้ง event ทุกครั้ง (architecture §1.2)
- **แถวของตัวเอง:** `viewerCanManage=true` (แกน target ยกเว้นตัวเอง — ลดตัวเอง/ถอดตัวเองได้ตาม D-029; LAST_OWNER ไม่อยู่ใน verdict) · `viewerCanResetPassword=false, reason=self`
- **ไม่รวม** `target_active_in_other_org` (C-2) และสถานะ `User` ใน verdict reset (ข้อเท็จจริงข้ามร้าน) ⇒ `true` = "ไม่มีกฎที่คุณมองเห็นขวางอยู่" server ยังอาจตอบ 404
- `LAST_OWNER` เป็นสถานะของร้าน ไม่ใช่สิทธิ์ ⇒ ไม่อยู่ใน verdict

**`Invitation.viewerCanManage?` / `manageBlockedReason?`** (ยกเลิก / ออกลิงก์ใหม่) — ผู้ดูถือ `manage_members` ∧ stored `pending` (รวมหมดอายุ) · ค่า = `decideMemberAuthority({op:"invite_cancel", grant: role ของคำเชิญ})` (แกน grant ⊆) · reason: `owner_only` → `exceeds_your_permissions` · ให้ข้อมูลเท่ากับ `RoleRow.viewerCanAssign` ของ role เดียวกัน ⇒ ไม่รั่วเพิ่ม

**กรองตาม role:** optional query `roleId` บน `GET /members` และ `GET /invitations` (§4.2b) — ตัวเลขบนจอตรง `details` ของ `ROLE_IN_USE`

**Q-UX-3 — ไม่มี `roleDeleted`:** แถวประวัติไม่มี action ใดใช้ role เดิมซ้ำ

- **pagination:** `GET /roles` และ `/role-details` คืนครบในหน้าเดียว · `nextCursor = null` ตราบที่เพดาน 30 ≤ page max 100

## 4. ผลต่อ contract ที่ ship แล้ว (ทั้งหมด additive · oasdiff ต้องเขียว)

### 4.1 `RoleRow` (`GET /orgs/{orgId}/roles`)
| เปลี่ยน | ชนิด | หมายเหตุ |
|---|---|---|
| + `nameCustomized?: boolean` | optional | `key === null \|\| Role.nameCustomized` |
| + `viewerCanAssign?: boolean` | optional | มี **เฉพาะเมื่อผู้เรียกถือ `manage_members`** · `decideMemberAuthority` แกน grant (AC-2.2) |
| + `assignBlockedReason?: string \| null` | optional, open set | `owner_only` · `exceeds_your_permissions` · ไม่มี reason ที่บอก capability |
| description ของ `name` | doc | → "ใช้กติกา: `nameCustomized ? name : แปล key`" · client เก่าแสดงคำแปลแทนชื่อที่ร้านตั้ง (cosmetic) |
| description ของ `isSystem`, `nextCursor`, `listOrgRoles` | doc | สถานะจริง |
| `capabilities` | **ไม่เพิ่ม** | AC-6.4 |

### 4.2 schema อื่นที่มี `roleKey`
+ `roleNameCustomized?: boolean` ใน `MemberRow`, `Invitation`, `InvitationPreview`, `AcceptedMembership`, `OrgMyMembership`, `MyOrganizationMembership` · `NewOrganizationMembership` ไม่เพิ่ม

### 4.2b field/param ใหม่บน route สมาชิก/คำเชิญ (optional ทั้งหมด · §3.1)
| schema / route | เปลี่ยน | มีเมื่อ |
|---|---|---|
| `MemberRow` | + `viewerCanManage?` · `manageBlockedReason?` (`owner_only` · `equal_permissions` · `exceeds_your_permissions`) | ผู้ดูถือ `manage_members` ∧ **`manage_roles`** ∧ แถว `active` |
| `MemberRow` | + `viewerCanResetPassword?` · `resetBlockedReason?` (`self` · `owner_only` · `equal_permissions` · `exceeds_your_permissions`) | 〃 |
| `Invitation` | + `viewerCanManage?` · `manageBlockedReason?` (`owner_only` · `exceeds_your_permissions`) | ผู้ดูถือ `manage_members` ∧ stored `pending` |
| `GET /orgs/{orgId}/members` | + query `roleId?` (maxLength 64) — AND กับ `status` | roleId ร้านอื่น = 200 หน้าว่าง (ไม่เป็น oracle) · role ที่ลบแล้วยังกรองได้ |
| `GET /orgs/{orgId}/invitations` | + query `roleId?` | `ROLE_IN_USE.pendingInvitations` = pending + expired ของ roleId นั้น |
- ค่าคำนวณตอนสร้าง response ของ PATCH/DELETE ด้วย — ใช้ actor caps ที่อ่านใน tx เดียวกัน
- oasdiff: optional response property + optional query param = non-breaking · **`Invitation.issuedByUserId` ไม่อยู่บน wire**

### 4.3 ⚠️ พฤติกรรมใหม่บน route ที่ ship (wire shape ไม่เปลี่ยน — ต้องลง description + changelog §6 ของ F-003 + regression ต่อแถว)
| route | เดิม (F-002) | F-003 | code |
|---|---|---|---|
| `PATCH /orgs/{orgId}/members/{userId}` | ปฏิเสธเฉพาะแตะ Owner | (1) แตะ Owner → เดิม (2) **role ปัจจุบันของเป้าหมาย ¬⊊ ผู้ทำ** (D-034 — เท่ากัน/มากกว่า/ตัดกัน; ยกเว้นเป้าหมาย = ตัวเอง) (3) role ใหม่ ⊄ ผู้ทำ (AC-5.1 — ใช้กับตัวเองด้วย) · no-op ไป role เดิมก็ถูกตรวจ — **ไม่ short-circuit ทั้งสองผล (SR-19 · pin ด้วย int):** ปฏิเสธ ⇒ 403 + `escalation_denied` · ผ่าน (เป้าหมาย ⊊) ⇒ **200 + `org.member.role_changed` (from = to) เหมือน F-002** · + rate limit `memberWrite` | (1) `403 FORBIDDEN` (2) **`403 TARGET_NOT_BELOW_ACTOR`** (ใหม่) (3) **`403 ROLE_EXCEEDS_ACTOR`** (ใหม่) · `429 RATE_LIMITED` |
| `DELETE /orgs/{orgId}/members/{userId}` | ปฏิเสธเฉพาะเป้าหมายเป็น Owner | + **role เป้าหมาย ¬⊊ ผู้ทำ** (ยกเว้นถอดตัวเอง — D-029) · + `memberWrite` | `403 TARGET_NOT_BELOW_ACTOR` · `429` |
| `POST /orgs/{orgId}/invitations` | ปฏิเสธเฉพาะ role Owner | + role ⊄ ผู้ทำ · role ที่ถูกลบ = `422 ROLE_INVALID` | `403 ROLE_EXCEEDS_ACTOR` |
| `POST …/invitations/{id}/link` (reissue) | ปฏิเสธเฉพาะ role Owner | + role ของคำเชิญ ⊄ ผู้ทำ · TTL นับ `manage_roles` เป็น elevated · **เขียน `issuedByUserId = ผู้ reissue`** (ไม่อยู่บน wire) ⇒ ตั้งแต่นี้ accept ตรวจสิทธิ์ของผู้ reissue แทนผู้เชิญเดิม (D-035 Addendum P3) | `403 ROLE_EXCEEDS_ACTOR` |
| `DELETE …/invitations/{id}` (cancel) | **ไม่มีกฎ role** | + role Owner ⇒ `403 FORBIDDEN` · role ⊄ ผู้ทำ ⇒ `403 ROLE_EXCEEDS_ACTOR` (⊆ — D-034 ไม่เปลี่ยน) · + `memberWrite` | ⚠️ Admin ยกเลิกคำเชิญ Owner ไม่ได้อีก · `429` |
| `POST /invitations/accept` | ตรวจสถานะ/อายุ/อีเมล | + **re-check ผู้ออกลิงก์ล่าสุด (D-035 + Addendum):** ไม่ active **หรือไม่ถือ `manage_members`** หรือ role คำเชิญ ⊄ สิทธิ์ปัจจุบันของเขา ⇒ คำเชิญถูกยกเลิกใน tx เดียวกัน · ผู้ออกลิงก์ = ผู้ reissue ครั้งล่าสุด (หรือผู้เชิญถ้าไม่เคย reissue) · ตรวจ**หลัง**ทุก refusal เดิม ⇒ กรณีเดิมได้คำตอบเดิม · `expiresAt` อาจถูกย่น (AC-10.4) | **`409 INVITATION_CANCELLED`** (code เดิม — ไบต์เดียวกับร้านยกเลิกเอง, ไม่มี details ใหม่) · `INVITATION_EXPIRED` |
| `POST /invitations/preview` | — | ไม่ re-check ⇒ อาจแสดง pending แล้ว accept ได้ `INVITATION_CANCELLED` | — |
| `POST /orgs/{orgId}/members/{userId}/reset-password` | non-Owner รีเซ็ตทุกคนที่ไม่ใช่ Owner | เฉพาะเป้าหมาย ⊊ ผู้รีเซ็ต (Owner ตาม D-030) | **404 รูปเดิม** (§6) |
| `GET /orgs/{orgId}` | — | `myMembership.capabilities` ของ Admin มี `manage_roles` (หลัง backfill) | — |
| ทุก route ที่ `@RequireCapability` | `full_access` หรือตรง key | + imply — วันนี้ไม่มีคู่จริง ⇒ ไม่มีผลที่สังเกตได้ | — |

- **route role (PATCH/DELETE `/roles/{id}`) เป็น route ใหม่ — ไม่อยู่ในตารางนี้** แต่ client ต้องรู้: ร้านที่มี Admin > 1 คน Admin แก้/ลบ role `Admin` ได้ `403 TARGET_NOT_BELOW_ACTOR` (D-034 Addendum — §2/§3) · ร้านที่มี Admin คนเดียว แก้ได้ (ลดได้อย่างเดียว) · **ผู้ถือ `manage_roles` ที่ไม่มี `manage_members` แก้/ลบ role ที่มีผู้ถืออื่นได้ `403 ROLE_HELD_REQUIRES_MANAGE_MEMBERS`** (Addendum 2 — §2/§3/§5) · preset ที่ ship (Owner/Admin/Staff) ไม่มีใครอยู่ในกรณีนี้ ⇒ เกิดเฉพาะกับ custom role
- **เปิดใช้ (SR-03):** กฎในตารางนี้มีผลบน instance F-003 ทันที แต่ changelog/release note **ห้ามประกาศว่ามีผลแล้ว** จนกว่า devops มีหลักฐานว่าไม่มี instance F-002 เหลือทุก process/region (architecture §12)
- **ลำดับ code บน route สมาชิก/คำเชิญ:** `FORBIDDEN` (Owner-only / ไม่มี `manage_members` ใน tx) → `TARGET_NOT_BELOW_ACTOR` → `ROLE_EXCEEDS_ACTOR` ⇒ **ทุกกรณีที่ F-002 เคยปฏิเสธ ได้คำตอบเดิมทุกไบต์**
- `ROLE_EXCEEDS_ACTOR` / `TARGET_NOT_BELOW_ACTOR` **ไม่มี details** บน route สมาชิก/คำเชิญ (AC-6.4) — key ที่เกินอยู่ใน event เท่านั้น
- **client ที่ต้องแก้ในรอบเดียวกัน (AC-5.4b):** แถวสมาชิกที่สิทธิ์เท่ากัน = disabled + เหตุผล (เมื่อได้ verdict) · copy ของ `TARGET_NOT_BELOW_ACTOR` / `INVITATION_CANCELLED` (ux)
- **oasdiff:** path ใหม่ 6 · response prop ใหม่ optional · query param optional 2 · request body ที่ ship ไม่แตะ · error code ใหม่ = description (`ErrorResponse.code` เปิด) ⇒ คาด 0 breaking · ⚠️ oasdiff **มองไม่เห็น** 4.3 ⇒ regression test ต่อแถว (qa)

## 5. Error codes (ใหม่ → `ERROR_CODES` registry + `DomainExceptionFilter` · ค่า code ห้ามเปลี่ยนหลัง ship)

| code | HTTP | เมื่อ | details / fieldErrors | event |
|---|---|---|---|---|
| `ROLE_NAME_TAKEN` | 409 | ชื่อซ้ำ (normalize + ไม่สนตัวพิมพ์) กับ role live **หรือ** ตรงคำสงวน exact | — | — |
| `ROLE_EMPTY` | 422 | capabilities ว่าง (AC-3.6) | `fieldErrors.capabilities` | — |
| `UNKNOWN_CAPABILITY` | 422 | key ไม่อยู่ใน registry / tier `full` / `selectable=false` | `fieldErrors.capabilities` · `details.capabilities` | — |
| `FULL_ACCESS_RESERVED` | 422 | มี `full_access` ใน body (AC-4.2) | `fieldErrors.capabilities` | `escalation_denied` (`full_access_reserved`) |
| `ROLE_LIMIT_REACHED` | 409 | role live ครบเพดาน (default 30) | `details.limit` | — |
| **`ROLE_HISTORY_LIMIT_REACHED`** | 409 | ลบ role เมื่อแถวที่ลบแล้วของร้านครบเพดาน (default 500 — SR-12) · role ยัง live | `details.limit` | — |
| `ROLE_IN_USE` | 409 | ลบ role ที่มีสมาชิก active หรือคำเชิญ pending | `details: { activeMembers, pendingInvitations }` | — |
| `ROLE_CHANGED` | 409 | `version` ไม่ตรง (AC-3.12) · **client MUST re-fetch `GET /roles/{id}` แล้วแสดงความต่างให้ผู้ใช้ตัดสิน — ห้าม resubmit อัตโนมัติด้วย `currentVersion` (= last-write-wins ที่ AC-3.12 ห้าม)** (SR-14 — test ฝั่ง client: frontend/qa) | `details.currentVersion` | — |
| `ROLE_LOCKED` | 409 | แก้/ลบ/เปลี่ยนชื่อ role Owner — ทุกผู้เรียกรวม Owner | — | `escalation_denied` (`role_locked`) **เฉพาะ actor ไม่ถือ `full_access`** (SR-13) |
| `ROLE_EXCEEDS_ACTOR` | 403 | **แกน grant ⊆** ไม่ผ่าน — role CRUD และ route สมาชิก/คำเชิญ (AC-5.1/5.3) | ไม่มี | `escalation_denied` (`exceeds_actor`) |
| **`TARGET_NOT_BELOW_ACTOR`** | 403 | **แกน target ⊊** ไม่ผ่าน — PATCH/DELETE member (D-034 · AC-5.4) · **PATCH/DELETE role ที่มีผู้ถือ active คนอื่นและ caps เท่ากับผู้แก้** (D-034 Addendum · AC-5.1) — บน route role มาหลัง `ROLE_EXCEEDS_ACTOR` และ `ROLE_HELD_REQUIRES_MANAGE_MEMBERS`, ก่อน `ROLE_IN_USE` | ไม่มี | `escalation_denied` (`target_not_below_actor`) |
| **`ROLE_HELD_REQUIRES_MANAGE_MEMBERS`** | 403 | PATCH (ทุก field รวม rename-only / no-op) / DELETE role ที่มี **สมาชิก active คนอื่น** ถือ ขณะผู้แก้ (อ่านใน tx) ไม่ถือ `manage_members` (D-034 Addendum 2 · AC-5.1 · SR-17) · มาหลัง `ROLE_EXCEEDS_ACTOR`, ก่อน `TARGET_NOT_BELOW_ACTOR` / `ROLE_IN_USE` · client: map ไป copy เดียวกับ reason `in_use_requires_manage_members` แล้ว re-fetch (อย่าออกจากจอ — ต่างจาก `FORBIDDEN`) | ไม่มี | — (log warn `role_write_refused` — ไม่ใช่การยกสิทธิ์, architecture §1.3) |
| **`ROLE_WRITES_DISABLED`** | 503 | POST/PATCH/DELETE role ขณะ flag ปิด (architecture §12) — ผู้ถือ `manage_roles` เท่านั้นที่เห็น | — | — |
| (เดิม) `INVITATION_CANCELLED` | 409 | + accept re-check ผู้ออกลิงก์ล่าสุดไม่ผ่าน (D-035 + Addendum: ไม่ active / ไม่มี `manage_members` / ⊉ role) — body ไม่ต่างจากคำเชิญที่ร้านยกเลิก | — | `org.invitation.accept_blocked_inviter` |
| (เดิม) `VALIDATION_FAILED` | 422 | + ชื่อ role มี Cc/Cf หลัง normalize (SR-04) | `fieldErrors.name` | — |
| (เดิม) `NOT_FOUND` | 404 | roleId ไม่มี / ร้านอื่น / ถูกลบแล้ว — แยกไม่ได้ (AC-6.3) | — | — |
| (เดิม) `FORBIDDEN` | 403 | ไม่มี `manage_roles`/`manage_members` (guard **หรือ** floor ใน tx) · แตะ Owner · (บน route role: ขาด `manage_members` เมื่อ role มีผู้ถืออื่น = `ROLE_HELD_REQUIRES_MANAGE_MEMBERS` ไม่ใช่ code นี้) | — | `org.access.capability_denied` (guard เท่านั้น) |
| (เดิม) `CONFLICT` | 409 | `details.reason="busy"` | — | — |
| (เดิม) `LAST_OWNER` | 409 | ตัวตรวจป้องกันบนเส้นทาง role (ไม่ควรเกิด) | — | error log |
| (เดิม) `RATE_LIMITED` | 429 | + `roleWrite` · `memberWrite` | `Retry-After` | — |
| (เดิม) `ORG_ACCESS_DENIED` · `ORG_MISMATCH` · `UNSUPPORTED_MEDIA_TYPE` | ตามเดิม | | | |

`ErrorResponse.details` description: เพิ่มแถวเอกสาร `ROLE_IN_USE` · `ROLE_CHANGED` · `ROLE_LIMIT_REACHED` · `ROLE_HISTORY_LIMIT_REACHED` · `UNKNOWN_CAPABILITY` (additive doc)

## 6. Admin-reset 404 (AC-5.5 · AC-5.5b) — ไม่เป็น oracle

- refusal ใหม่ `target_not_proper_subset` (มาจาก `decideMemberAuthority` แกน target — ไม่มีการเทียบ ⊊ ใน `decideAdminReset` เอง) เข้า **จุดสร้าง 404 จุดเดียว** ใน `AuthService` ⇒ status / body / headers **เหมือน "ไม่ใช่สมาชิก" ทุกไบต์** ยกเว้นค่าของ `traceId` / `X-Request-Id`
- **traceId ความยาวคงที่:** `crypto.randomUUID()` = 36 ตัวเสมอ ⇒ `Content-Length` เท่ากัน · test assert รูป UUID v4 **และ** `Content-Length`
- **วิธีเทียบ (seam qa):** caller เดียวกันยิง 404 "ไม่ใช่สมาชิก" กับ 404 "⊊ ไม่ผ่าน" → เทียบ status + body หลังแทน traceId + ชุด header · timing = review evidence
- **ลำดับล็อก (SR-05):** `User` FOR UPDATE → `Membership` (caller, target) FOR SHARE → `Role` FOR SHARE → ตัดสิน ⇒ reset ไม่ตัดสินบน `roleId` ที่ PATCH member กำลังเปลี่ยน · refusal อยู่ตำแหน่งเดียวกับ `target_is_owner` หลัง argon2 — ไม่มี early-return ใหม่
- event: `auth.password.admin_reset_blocked_privilege` · Owner target ยังยิง `…_owner_target` ตัวเดียว
- **regression ที่ต้องมีชื่อกรณีตรง ๆ (AC-5.5b):** Admin→Admin เท่ากัน = 404 · Admin→Staff = 200 · ตัดกันไม่ครอบ = 404 · Owner→Owner = 200 · byte-equality · **+ AC-5.4b:** ลำดับ ลด→reset→ยก ล้มที่ขั้นแรก (`403 TARGET_NOT_BELOW_ACTOR`)
- contract: path file ไม่เปลี่ยน shape · เพิ่ม bullet ใน "⚠️ THE BEHAVIOUR NARROWED" ของ `org-member-reset-password.yaml` — doc-only

## 7. Validation (ที่ edge vs core-domain)

| ชั้น | ตรวจ |
|---|---|
| DTO (class-validator, whitelist) | `name` string · `capabilities` array ≤ 64 ของ string ≤ 64 · `version` int ≥ 1 · field แปลกปลอมถูกตัด |
| core-domain (pure) | ชื่อ: NFC → trim → ยุบช่องว่าง → **ห้าม Cc/Cf** → 1–50 code point → คำสงวน · capabilities: ลำดับ §2 → canonical → ⊆ · locked · สองแกนของ `decideMemberAuthority` |
| DB | CHECK/unique/trigger (data-model §3) — error ที่หลุดถึงนี่ = 500 + log (ยกเว้น unique ชื่อ → `ROLE_NAME_TAKEN`) |

## 8. ที่ยังเปิด

ไม่มี

**ปิดแล้ว:** **SR-17 → D-034 Addendum 2 (ข) — §2/§3/§5** · **N-1 → Addendum 2: คงบล็อก rename-only (wire ไม่เปลี่ยน — `canEdit` ตัวเดียว)** · **N-2 → known risk (architecture §6.1 · ไม่มีผลต่อ wire)** · **Q-SR01b → D-034 Addendum (ก) — §2/§3/§5** · **Q-P2/Q-P3 → D-035 Addendum — §4.3** · **Q-P1 → AC-9.6 (user 2026-09-27: "คุณ" / ชื่อบทบาทปัจจุบัน / "อดีตสมาชิก") — §3** · Q-UX-1 → data-model §2.1 · Q-UX-2 → architecture §11 (เสนอ D-037) · Q-UX-3/4/5 → §3.1 · §4.2b · Q-QA-1..4 → architecture §13 · devops → data-model §4.4 + architecture §12 (flag)
