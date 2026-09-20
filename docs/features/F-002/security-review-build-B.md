---
doc: security-review-build-B
owner: "@security-reviewer"
scope: "★ pre-merge security review · PART B — tenancy / authz / lock / contract + delta"
range: "f66451f..HEAD (HEAD = d6b130d ตอนเขียน · เนื้อหาที่ตรวจคือ commit backend ถึง a38e464/c3e128b)"
signoff: pending
---

# [F-002] Security review — build, **Part B** (tenancy · authz · lock · contract · delta)

> **advisory เท่านั้น** — `@backend-api` เป็นเจ้าของโค้ดและสัญญา ผมเสนอ ไม่ตัดสิน · ผมไม่แก้ไฟล์ production
> ค้างไว้เลย (git tree สะอาดตอนจบ — ตรวจด้วย `git status --porcelain` ว่าว่าง)
>
> **ขอบเขต Part B** (ไม่ทับ Part A ซึ่งดู invitation token / TIN / SYSTEM_PRISMA jail / secret):
> `apps/api/src/tenancy/**` · `apps/api/src/common/authz/**` · `apps/api/src/common/org-rate-limit.guard.ts` ·
> endpoint ของ T-002-15/16/16b/18 · `packages/core-domain/src/orgs/{owner-invariant,member-authz,member-view,org-profile}.ts` ·
> `packages/db/src/{tenancy,org-lock}.ts` · `apps/api/src/prisma/org-busy.ts` · parity gate (T-002-21) · delta ของ §H
>
> **วิธี:** ผมไม่เชื่อ comment กับชื่อฟังก์ชัน — ทุกข้อที่เขียนว่า "คุมแล้ว" ผมพยายาม**ทำให้แดง**จริง
> (แก้ชั่วคราว → รัน → ดูผล → `git checkout`) และทุกข้อที่เขียนว่า "รั่ว" ผมเดินเส้นทางจริงผ่าน HTTP/Postgres
> ไม่ใช่สร้าง input เอง · env: node 22.23.1 · Postgres `:55432` · Redis index 15

---

## สรุปตัวเลข

| ระดับ | จำนวน | เลข |
|---|---|---|
| 🔴 Critical | 0 | — |
| 🟠 Important | 2 | B-1 · B-2 |
| 🟡 Medium | 3 | B-3 · B-4 · B-5 |
| 🔵 Minor | 3 | B-6 · B-7 · B-8 |
| ⚪ Nit | 1 | B-9 |

**ไม่มีข้อที่ผมเสนอให้บล็อก merge.** ไม่มีช่องที่ผู้โจมตีใช้ได้จริงผ่าน HTTP surface ของ F-002 วันนี้ในขอบเขต Part B ·
สองข้อ Important เป็น **ชั้นป้องกันที่อ้างว่ามีแต่ไม่มีจริง** (B-1) และ **ค่าคงเหลือของกติกาที่ยังพิงคนเขียน service คนเดียว** (B-2)
— ทั้งสองข้อ**ควรปิดก่อน F-003** เพราะ F-003 คือ feature ที่จะเดินเข้าไปในรูนั้นพอดี

---

## § Findings

### 🟠 B-1 · `Membership.roleId` ชี้ไป Role ของ org อื่นได้ — ทั้ง seam ทั้ง DB ไม่กัน และผลคือ `full_access` ข้าม tenant

**ไฟล์:** `packages/db/src/tenancy.ts:399-410` (`guardWriteData` ตรวจเฉพาะคอลัมน์ `organizationId`) ·
`packages/db/prisma/schema.prisma:139-167` (Membership ไม่มี composite FK ไป Role) ·
`apps/api/src/orgs/members.service.ts:282-289` (comment อ้างว่า "impossible by construction")

**สถานการณ์โจมตี (พิสูจน์แล้วกับ Postgres จริง + HTTP จริง):**

1. ระดับ DB — client ที่ scope ไป org A เขียน role ของ org B ลง membership ของ org A **สำเร็จ** ทั้งสองรูป:
   ```
   [probe] scalar roleId  -> WROTE scalar FK cross-org:
             {"role":{"organizationId":"<orgB>","capabilities":["full_access"]}}
   [probe] nested connect -> WROTE cross-org role: (เหมือนกัน)
   ```
   (`withOrgScope(prisma,{organizationId: orgA}).membership.update({ where:{id}, data:{ roleId: <role ของ orgB> } })`
   — extension ฉีด `where.organizationId=orgA` ถูกต้อง แต่ **ไม่แตะ `data.roleId` เลย** เพราะกติกาดูแค่คอลัมน์ org)
2. ระดับ HTTP — พอ state นั้นมีอยู่ คนนั้นกลายเป็น Owner ของ org A ทันที:
   ```
   [Q4] Staff→foreign-Owner role, GET /orgs/{A}/members : 200   (ต้องมี manage_members)
   [Q4] GET /orgs/{A} : myMembership.capabilities = ["full_access"], roleName "Owner"
   ```
   เพราะ `OrgContextMiddleware` (`org-context.middleware.ts:109-140`) อ่าน `role: { select: { capabilities: true } }`
   ผ่าน relation โดย**ไม่ได้ตรวจว่า Role ใบนั้นเป็นของ org นี้** — relation walk อยู่นอกสายตาของ extension (C-3 รูปเดิม)

**ทำไมชั้นป้องกันที่มีอยู่ไม่กัน:**
- `withOrgScope` เห็นแค่ top-level model+operation — FK scalar และ nested `connect` ไม่ถูกตรวจ (เอกสารยอมรับข้อจำกัดนี้
  แต่ยกตัวอย่างเฉพาะ *read*; **write ผ่าน FK ไม่มีใครพูดถึง**)
- schema ไม่มี `@@unique([organizationId, id])` บน Role + composite FK จาก Membership/Invitation ⇒ Postgres ยอมทุกกรณี
- comment ที่ `members.service.ts:282` เขียนว่า *"cross-tenant role assignment is impossible by construction rather than
  by an `if`"* — **ไม่จริง** สิ่งที่กันอยู่คือ `if (!newRole) throw` บรรทัด 289 นั่นเอง (เป็น `if` ที่ถูก แต่มันคือ `if`)

**วันนี้ยังไม่ถูก exploit ได้** เพราะทุก write path ของ F-002 resolve role ผ่าน tx ที่ scope แล้วก่อนเขียน — ผมไล่ครบ 4 จุด:
`members.service.ts:285` (`tx.role.findFirst`) · `invitations.service.ts:754` (`readRole` → `tx.role.findUnique`) ·
`invitations.service.ts:572` (accept) · `org-provisioning` (สร้าง role เอง) · **ไม่มีจุดไหนรับ `roleId` จาก body ตรง ๆ**

**ข้อเสนอ (เล็กสุดที่ปิดจริง):**
1. (ถูกที่สุด, ได้ผลถาวร) schema: `Role @@unique([organizationId, id])` + Membership/Invitation ใช้ composite FK
   `@relation(fields:[organizationId, roleId], references:[organizationId, id])` → Postgres ปฏิเสธเอง ไม่ต้องเชื่อ service
2. หรือถ้าไม่อยาก migrate ตอนนี้: ใน `guardWriteData`/`scopedCreateData` เพิ่มกติกา **"ห้ามเขียน FK scalar/relation
   `connect` ของ model org-scoped ผ่าน seam นี้"** (fail-closed) แล้วให้ service ที่ต้องการทำ ประกาศ opt-in ชัด ๆ
3. อย่างน้อยที่สุด: แก้ comment `members.service.ts:282` ให้พูดความจริง (มันคือ `if` ไม่ใช่ construction)
   — comment ที่โกหกอันตรายกว่าไม่มี comment เพราะคนถัดไปจะไม่ตรวจซ้ำ

(Owner to action: **@backend-api** · migration → skill `prisma-migration` · regression case → **@qa**)

---

### 🟠 B-2 · `RESPONSE_HEADER_POLICY` มีแถวซ้ำ 4 คู่ — `responseHeaderPolicyFor()` คืนแถวที่**อ่อนกว่า** ⇒ กติกา header/PII ตรวจสิ่งที่ไม่ได้ตั้งใจตรวจ

**ไฟล์:** `apps/api/src/orgs/response-headers.ts:105-108` ซ้ำกับ `:123-136` · resolver `:148-154` ใช้ `.find()` (แถวแรกชนะ)

**พิสูจน์ (รันจริง):**
```
[H] rows: 18  dupes: ["GET /orgs/{orgId}/invitations","POST /orgs/{orgId}/invitations",
                      "POST /orgs/{orgId}/invitations/{invitationId}/link",
                      "DELETE /orgs/{orgId}/invitations/{invitationId}"]
[H] resolved GET    /orgs/{orgId}/invitations                 -> {no-store,Pragma}                  ["tin"]
[H] resolved DELETE /orgs/{orgId}/invitations/{invitationId}  -> {no-store,Pragma}                  ["tin"]
[H] resolved POST   /orgs/{orgId}/invitations                 -> {…,Referrer-Policy:no-referrer}    ["tin"]
```
**ผลที่ผิด 2 อย่าง:**
1. `GET /orgs/{orgId}/invitations` และ `DELETE …/{invitationId}` — ตารางตั้งใจให้เป็น `INVITATION_RESPONSE_HEADERS`
   (มี `Referrer-Policy: no-referrer` ตาม I-6) แต่ resolver คืนชุดที่**ไม่มี** `Referrer-Policy` · controller
   (`invitations.controller.ts:76` และ `:149`) ก็ set ชุดอ่อนพอดี ⇒ **ทั้งสองฝั่งเห็นตรงกัน แต่ตรงกันที่ค่าที่ผิด**
2. `carries` ของทั้ง 4 แถวกลายเป็น `["tin"]` ทับ `["token","email"]`/`["email"]` ⇒ ถ้าใครเขียน assertion แบบ
   `expect(responseHeaderPolicyFor(...).carries).toContain("email")` แบบที่ `members.routes.test.ts:177` ทำกับ
   member routes มันจะแดงโดยไม่มีใครเข้าใจ — หรือแย่กว่านั้น คนจะแก้ assertion แทนที่จะแก้ตาราง

**ทำไมชั้นป้องกันที่มีอยู่ไม่กัน:** header comment ของไฟล์ประกาศว่าตารางตรวจ **สองทิศ** ("wire → policy: route ที่คืน
token/email/TIN แล้วไม่มีในตาราง = แดง") แต่ไม่มีอะไรตรวจ **ความซ้ำของ key เอง** และ `.find()` ทำให้แถวที่สองเป็นโค้ดที่ตายแล้ว
— มันอยู่ในไฟล์ อ่านแล้วดูเหมือนบังคับใช้ แต่ไม่มีทางถูกเรียก

**ข้อเสนอ:** (ก) เพิ่ม unit test 3 บรรทัด: route key ในตารางต้อง unique (ตอนนี้จะแดงทันที = พิสูจน์ว่ามันจับได้)
(ข) รวม 4 คู่ให้เหลือแถวเดียวต่อ route โดยใช้ชุด header ที่**เข้มกว่า** และ `carries` เป็น union
(ค) แก้ `invitations.controller.ts:76,149` ให้ใช้ `INVITATION_RESPONSE_HEADERS`
(Owner to action: **@backend-api**)

---

### 🟡 B-3 · `GET /me/organizations` ไม่มี `Cache-Control: no-store` และไม่มีแถวใน `RESPONSE_HEADER_POLICY` เลย

**ไฟล์:** `apps/api/src/orgs/my-organizations.controller.ts:38-63` (ไม่มี `@Res`, ไม่เรียก `applyResponseHeaders`) ·
`apps/api/src/orgs/response-headers.ts:94-145` (ตารางไม่มีแถวนี้)

**พิสูจน์ (request จริง):**
```
[V] cache-control — members: no-store | me/orgs: undefined | roles: no-store
```

**สถานการณ์:** response นี้บอกว่า "คนนี้อยู่ร้านไหนบ้าง เป็นตำแหน่งอะไร ร้านนั้นแพลนอะไร" ครบ — เป็นข้อมูลบุคคลตรง ๆ
ตามนิยามของตารางเอง (`DELETE /orgs/{orgId}/membership` ถูกใส่ในตารางด้วยเหตุผลนี้เป๊ะ: *"when did this person leave which
shop is still a fact about a person"*) แต่กลับเป็น GET ที่ไม่มี `no-store` เลย ⇒ ค้างใน browser disk cache / bfcache /
shared proxy ได้ (เครื่องร่วม, เครื่องในร้าน — ซึ่งคือ persona ของ OmniStock)

**ทำไมชั้นป้องกันที่มีอยู่ไม่กัน:** ทิศ wire → policy ของ I-05 ใช้ taxonomy `token | email | tin` เป็นตัวจุดชนวน ·
`/me/organizations` ไม่คืนสามอย่างนั้น มันคืน `membership` ซึ่ง**เป็นคลาสที่ประกาศไว้ใน `ResponseSensitivity` แล้ว**
แต่ไม่มีใครใช้เป็นเงื่อนไขตรวจ ⇒ endpoint หลุดออกจากตารางอย่างเงียบสนิท

**ข้อเสนอ:** เพิ่ม `policyRow("GET","/me/organizations", ORG_PROFILE_RESPONSE_HEADERS, ["membership"])` +
`applyResponseHeaders` ใน controller · และขยายทิศ wire → policy ให้จุดชนวนด้วย `membership` ด้วย ไม่ใช่แค่ 3 คลาสแรก
(Owner to action: **@backend-api** · เคส → **@qa**)

---

### 🟡 B-4 · guard ของ High-1 (`controller-tier-marks.test.ts`) ยังหลบได้ด้วยการจัดเรียง decorator ธรรมดา

**ไฟล์:** `apps/api/test/controller-tier-marks.test.ts:56-58` (regex ต้องให้ tier mark **ติดกับ** `@Controller` พอดี
และรองรับเฉพาะ `@Controller("literal")`) · `:53` ใช้ `source.match()` (แถวเดียว ไม่ใช่ `matchAll`)

**พิสูจน์ — ผมทำให้แดงได้ 1 รูป และหลบได้ 2 รูป:**

| รูปที่ทดลอง (ใส่ที่ `RolesController`, path `orgs/:orgId/roles`) | ผล |
|---|---|
| `@UserScoped()` ติดบน `@Controller("orgs/:orgId/roles")` | ✅ **แดง** (3 เคสล้ม) — guard ทำงาน |
| `@UserScoped()` → `@Injectable()` → `@Controller("orgs/:orgId/roles")` | ❌ **เขียว** — หลุด |
| `@UserScoped()` → `@Controller({ path: "orgs/:orgId/roles" })` | ❌ **เขียว** — หลุด |

ทั้งสองรูปที่หลุด **มีผลจริงตอน runtime** (ลำดับ decorator ไม่มีผลกับ `SetMetadata` บน class · Nest รองรับ object form
ของ `@Controller`) ⇒ กติกาที่ guard นี้อ้างว่าคุ้มครองยัง**ถูกละเมิดได้โดยไม่มีอะไรแดง**

**ทำไมมันสำคัญกว่าที่ดู:** commit `c3e128b` เขียนไว้เองว่า *"a guard that looks general and is not is worse than an
obvious gap: it stops anyone looking again"* — ข้อนี้คือประโยคนั้นสะท้อนกลับมาที่ guard ตัวใหม่เอง

> ⚠️ **ทับซ้อนกับ Part A (A-3) — อ่านย่อหน้านี้ก่อนสั่งงาน**
> ระหว่างที่ผมเขียนรายงาน ผู้รีวิว Part A เจอรูปเดียวกัน (แถวที่ 2) และกำลังแก้อยู่ใน working tree
> (`apps/api/test/controller-tier-marks.parse.ts` + แก้ `controller-tier-marks.test.ts` — **ยังไม่ commit**)
> parser ตัวใหม่เดินย้อนขึ้นทั้ง decorator block, รองรับหลาย controller ต่อไฟล์ และรับ quote เดี่ยว/คู่
> ⇒ **แถวที่ 2 ของตารางข้างบนถูกปิดแล้วโดย Part A**
>
> **สิ่งที่ยังเหลือหลังการแก้ของ Part A คือแถวที่ 3:** regex ของ parser ตัวใหม่คือ
> `/^@Controller\(\s*(?:"([^"]*)"|'([^']*)')?/` ⇒ `@Controller({ path: "orgs/:orgId/roles" })` จะได้
> `path = "/"` ซึ่งไม่มี `:orgId` ⇒ controller หลุดจาก assertion ★ ทั้งใบ · และชุดเทสต์ 9 เคสของ parser
> ตัวใหม่**ไม่มีเคส object form** (ตรวจแล้ว: มี `path:` แค่ที่ fixture ของ `ControllerDecl` บรรทัด 67)
> ⇒ ข้อเสนอด้านล่างยังใช้ได้ ขอแค่เพิ่มเคสนี้เข้าไปด้วย

**ข้อเสนอ:** ย้ายจาก regex ไปเป็น **runtime check** ซึ่งของอยู่ครบแล้ว: boot app แล้ว
`Reflect.getMetadata(PATH_METADATA, metatype)` + `reflector.get(ROUTE_SCOPE_KEY, metatype)` (คือสิ่งที่
`RouteScopeRegistry.build()` ทำอยู่แล้วบรรทัด 130-131) ⇒ "controller ที่ path มี `:orgId` ต้องไม่มี class-level
`ROUTE_SCOPE_KEY`" กลายเป็นการอ่าน metadata จริง ไม่ใช่การอ่านตัวอักษร · ถ้ายังอยากคงเป็น unit (ไม่ต้อง boot)
อย่างน้อยให้ parser ของ Part A รองรับ `@Controller({ path: … })` และเพิ่มเคสนั้นในชุดเทสต์ของ parser
(Owner to action: **@backend-api** หรือ **@qa** แล้วแต่ใครถือไฟล์นี้)

---

### 🟡 B-5 · `ORG_LOCK_REQUIRED_OPERATIONS` ยืนยันแค่ตัวมันเอง — คำอ้าง "call site ที่ลืม anchor = เทสต์แดง" ยังไม่จริง

**ไฟล์:** `packages/db/src/org-lock.ts:48-57` (comment: *"qa's U-API-09 enumerates this … so a new membership/invitation
write that forgets the anchor is a red test"*) · `packages/db/src/org-lock.test.ts:111-137` (assertion คือ
`toHaveLength(7)` + `toEqual([...literal 7 แถว...])`)

**สิ่งที่ผมตรวจ:** `grep -rn "ORG_LOCK_REQUIRED_OPERATIONS"` ทั้ง repo → พบ 4 ไฟล์: ตัวมันเอง, `index.ts` (re-export),
`org-lock.test.ts` (assert ตัวเอง) และ **comment** ใน `org-provisioning.service.ts` · **ไม่มีเทสต์ใดเดินจากลิสต์นี้
ไปหา call site จริง** ⇒ ลิสต์ pin ตัวเอง 100% แต่ไม่ pin โค้ดเลย

**สิ่งที่ยังดีอยู่ (ผมทำให้แดงเพื่อยืนยัน):** เทสต์ต่อ **method** มีจริงและกัดจริง — ผมถอด `runInOrgLockTransaction`
ออกจาก `MembersService.leave()` (เหลือ `$transaction` เปล่า) แล้วได้:
```
× MembersService.leave — api-spec §3.17 (D-029) > ★ takes the same lock, first statement, same transaction as a revoke
  Tests 1 failed | 37 passed
```
⇒ ช่องว่างคือ **method ใหม่** (F-003 role editing, endpoint สมาชิกใบใหม่) ที่ไม่มีใครเขียนเทสต์ "lock มาก่อน" ให้
— ตรงนั้นไม่มีอะไรบังคับ และ comment บอกว่ามี

**ข้อเสนอ:** เพิ่ม int test 1 เคสที่ enumerate `ORG_LOCK_REQUIRED_OPERATIONS` แล้วเทียบกับ router จริง (แบบเดียวกับที่
`openapi-parity.int.test.ts` ทำ ซึ่งพิสูจน์แล้วว่าทำได้) + spy บน `$executeRawUnsafe` เพื่อยืนยันว่าทุกแถวยิง
`SET LOCAL lock_timeout` เป็น statement แรก · หรือถ้ายังไม่ทำตอนนี้ **ให้แก้ comment** ให้บอกความจริงว่าเป็น
forward-commitment (Owner to action: **@backend-api** + **@qa**)

---

### 🔵 B-6 · CI `--min-passed 29` ของ int lane ถูกเติมเต็มด้วย auth 2 ไฟล์พอดี — สvitte F-002 ทั้ง 8 ไฟล์ (143 เคส) ไม่มี floor

**ไฟล์:** `.github/workflows/ci.yml:381-386`

**นับจริงจาก JSON report ที่ผมรัน:**
```
26 src/auth/auth.e2e.int.test.ts          ← --require 21
 8 src/auth/refresh-token.service.int.test.ts ← --require 8
13 test/f002-seed.kit.int.test.ts
16 test/invitations-redeem.e2e.int.test.ts
14 test/invitations.e2e.int.test.ts
34 test/members.e2e.int.test.ts
 5 test/openapi-parity.int.test.ts
19 test/org-leak.kit.int.test.ts
 6 test/org-rate-limit.e2e.int.test.ts
36 test/orgs.e2e.int.test.ts
TOTAL 178
```
`--require` มี 2 แถว (21+8 = 29) และ `--min-passed 29` ⇒ ถ้า F-002 int suite ทั้ง 8 ไฟล์หายจาก filter `int.test`
(เปลี่ยนชื่อไฟล์ / ย้ายโฟลเดอร์ / ลบ) job ยัง**เขียว**

**ข้อจำกัดของ finding นี้ (ผมตรวจแล้ว):** `--max-skipped 0` **กัน** กรณี suite self-skip เพราะ env หาย ซึ่งเป็นเคสที่
I-37 ตั้งใจแก้จริง ๆ · ที่ยังไม่กันคือ "ไฟล์หายไปจาก filter" — ซึ่งเป็นเคสของ refactor ไม่ใช่ของ CI พัง

**ข้อเสนอ:** เพิ่ม `--require` ให้ 3 ไฟล์แกน (`test/members.e2e.int.test.ts`, `test/orgs.e2e.int.test.ts`,
`test/openapi-parity.int.test.ts`) และยก `--min-passed` เป็น ~150 (Owner to action: **@qa** เจ้าของ lane · **@devops** ถ้าแตะ workflow)

---

### 🔵 B-7 · `packages/db/src/tenancy.ts` อ้าง "grep gate" ที่ไม่มีอยู่ + `$queryRaw` ผ่าน `ORG_PRISMA` วิ่งแบบไม่มี tenant filter และ**ไม่ throw**

**ไฟล์:** `packages/db/src/tenancy.ts:181` (*"$queryRaw/$executeRaw are handled by the grep gate"*) และ `:20-22`

**พิสูจน์ (Postgres จริง):**
```
[probe] $queryRaw       -> RAN UNSCOPED, rows=[{"n":0}]     ← ไม่ throw, ไม่ filter
[probe] membership.count -> 0                                ← control: model op ถูก scope ปกติ
```
**และ gate ที่อ้างถึงไม่มีจริง:** ผมค้นทั้ง `.github/workflows/ci.yml`, `tool/`, `.eslintrc.cjs`,
`packages/config/depcruise/` — gate ที่มีคือ `api-boundaries` (depcruise ระดับ import เท่านั้น) กับ purity gate
· **ไม่มีอะไรตรวจ `$queryRaw` เลย**

**วันนี้ยังไม่มีผล** เพราะไม่มี production code ใน `apps/api/src` ที่เรียก `$queryRaw` บน `ORG_PRISMA`
(ที่ใช้อยู่คือ `refresh-token.service.ts`, `auth.service.ts`, `prisma.service.ts`, `org-lock.ts` ซึ่งเป็น SYSTEM/tx client
และ parameterized ครบ — ผมตรวจแล้ว) · ประเด็นคือ **comment สร้างความมั่นใจปลอม**: คนถัดไปที่ต้องการ aggregate เร็ว ๆ
จะเขียน raw แล้วเชื่อว่ามี gate คุม

**ข้อเสนอ:** ทำ gate ตัวเล็ก ๆ ให้จริง (source scan แบบเดียวกับ `system-prisma-allowlist.test.ts` ซึ่งเป็น pattern ที่ทีมนี้
ใช้ได้ผลแล้ว: allowlist ไฟล์ที่เรียก `$queryRaw*`/`$executeRaw*` ได้ + self-check) **หรือ** ลบคำว่า "grep gate"
ออกจาก comment แล้วเขียนว่าเป็นกติกาที่ยังไม่มีเครื่องบังคับ (Owner to action: **@backend-api**)

---

### 🔵 B-8 · `assertOwnerRemainsInTx` ใช้ nested relation filter ที่ไม่ถูก org-scope — วันนี้ผลถูก แต่เหตุผลไม่ใช่ที่ comment เขียน

**ไฟล์:** `apps/api/src/orgs/members.service.ts:547-550`
```ts
tx.membership.findMany({ where: { role: { capabilities: { has: "full_access" } } }, … })
```
`withOrgScope` ฉีด `organizationId` ที่ **top level ของ Membership** (ถูกต้อง) แต่เงื่อนไข `role: {…}` เดินเข้าไปที่
`Role` โดยไม่มี org filter — ซึ่ง**ตรงกับ B-1 พอดี**: ถ้ามี membership ที่ `roleId` ชี้ข้าม org (สถานะที่ B-1 พิสูจน์ว่า
DB ยอม) คนนั้นจะถูกนับเป็น "Owner ของ org นี้" ทั้งที่ role ใบนั้นเป็นของร้านอื่น ⇒ invariant "Owner ≥ 1"
ก็จะถูกคำนวณจากแถวที่ไม่ใช่ของร้านนี้

**ผลวันนี้:** ถูก — เพราะไม่มีทางสร้าง state นั้นผ่าน API · แต่ความถูกต้องพิงอยู่กับ B-1 ไม่ใช่กับตัวมันเอง

**ข้อเสนอ:** ปิด B-1 (ข้อ 1 = composite FK) แล้วข้อนี้หายเอง · ถ้ายังไม่ปิด ให้เขียน `where` เป็น
`{ role: { organizationId: <ctx.organizationId>, capabilities: { has: "full_access" } } }` **หรือ** filter ใน
pure fn อีกชั้น (Owner to action: **@backend-api**)

---

### 🔵 B-9 · เรื่องเล็กที่ยืนยันแล้วว่าไม่ใช่ปัญหา (เขียนไว้เพื่อไม่ให้มีคนไปรื้อ)

- `RolesService.list` ตัด `capabilities` ทิ้งจริง (project ทีละ field, `roles.service.ts:56-61`) — `@AnyActiveMember()`
  บน `GET /orgs/{orgId}/roles` **ปลอดภัย** เพราะไม่มีอะไรใช้ตัดสิทธิ์ในนั้น
- `GET /orgs/{orgId}` ที่ `@AnyActiveMember()` คืน `counts.activeMembers` / `counts.pendingInvitations` เป็นตัวเลขล้วน
  (ไม่มีรายชื่อ) และ `taxProfile` ผ่าน `toTaxProfileView` ที่ Staff ได้แค่ `vatRegistered` — ตรงกับ ux Q13 ที่เข้มกว่า D-028

---

## § Delta: สถานะ finding รอบก่อน (§H ของ `security-review.md`)

ผมตรวจเฉพาะข้อที่อยู่ในขอบเขต Part B และตรวจ **ในโค้ด/บนสาย ไม่ใช่ในเอกสาร**

| finding | เอกสารบอก | ผมตรวจแล้วพบว่า | หลักฐาน |
|---|---|---|---|
| **C-1** Owner-only | ปิดแต่ยังมีรู | ✅ **ปิดจริงในโค้ด** — `canAssignRole` ครบ 5 call site จริง: `members.service.ts:294` (patch) · `:395` (revoke) · `invitations.service.ts:285` (create) · `:361` (reissue = NEW-2) · `admin-reset-authz.ts` (NEW-1) | อ่านโค้ด + int lane มีเคส "Admin cannot promote anyone to Owner" ผ่านจริง |
| **C-3** query ตั้งต้นจาก model org-agnostic | ปิดแต่ยังมีรู | ⚠️ **ยังเปิด และมีรูปที่ 2 ที่เอกสารไม่พูดถึง** = การเขียน FK ข้าม org → **B-1** · ส่วน read ปิดด้วย `USER_SELECT` จริง (ไม่มี relation key, frozen) | probe DB + `packages/db/src/user-select.ts:28-32` |
| **I-2 / NEW-3** ลืม `@RequireCapability` = รั่ว | ปิด (ขยายถึง read) | ✅ **ปิดจริงและกัดจริง** — `CapabilityGuard` ไม่มี method test แล้ว (`capability.guard.ts:115-142`) และผมเปลี่ยน `GET /orgs/:orgId/members` เป็น `@AnyActiveMember()` แล้ว **route-registry audit บน router จริงแดง** | `× route registry (I-02/G-13) > ★ every org-scoped route … declares its authorization` (int lane) |
| **I-3** org context จาก header บน user-scoped route | ปิดจริง | ✅ **ยืนยันบนสายจริง** — ดูหัวข้อ "คำถามของ coordinator" ด้านล่าง | request จริง 4 แบบ |
| **I-5** แยก `ORG_ACCESS_DENIED` | ปิดจริง | ✅ ยืนยัน — non-member ได้ `403 ORG_ACCESS_DENIED`, member ที่ขาด capability ได้ `403 FORBIDDEN`, header/path ไม่ตรงได้ `422 ORG_MISMATCH` | `[Q3]`, `[Q5]`, `[RL]` |
| **M-2** ทุก read ที่ตัดสินต้องผ่าน `tx` | ปิดจริง | ✅ — `members.service.ts` มี `this.prisma` ที่เดียวจริง (บรรทัด 189/211 = LIST ที่ไม่ตัดสินอะไร) และ unit test บันทึกลำดับ call | grep + sabotage test |
| **M-9** extendedWhereUnique เป็น unverifiable claim | ปิดเชิงกระบวนการ | ✅ **ยืนยันกับ Postgres จริงแล้ว — ทำงานถูก** `findUnique(row ของ org อื่น)` → `null` · `update` → `P2025` และ row ไม่ถูกแตะ ⇒ claim นี้ verifiable ได้แล้ว ควรอัปเดต §2.2 | probe: `[probe] findUnique foreign -> NULL` / `update foreign -> P2025` |
| **M-10** `?status=all` คืนรูปย่อ | ปิดจริง | ✅ ยืนยันบนสายจริง: member ที่ถูก revoke เห็นแค่ `{organization:{id,name,logo}, membership:{status,revokedAt}}` — ไม่มี role ไม่มี entitlement | `[Q5] status=all` |
| **M-11** cache header | ปิดจริง (ส่วน header) | ⚠️ **ปิดไม่ครบ** — `/me/organizations` ไม่มี `no-store` เลย → **B-3** · และตารางมีแถวซ้ำที่ทำให้กติกาอ่อนลง → **B-2** | `[V] cache-control` |
| **N-1** `ORG_MISMATCH` = 422 | ปิดจริง | ✅ ยืนยันบนสาย: `422 ORG_MISMATCH` | `[Q3]` |
| **N-2** lock อ่าน org จาก ctx | ปิดจริง | ✅ — `lockCurrentOrganization` ปฏิเสธ bare string (`org-lock.ts:363-379`) และ `runInOrgLockTransaction` resolve ctx ก่อนเปิด tx | อ่านโค้ด |
| **N-3** IPv6 /64 | ปิดจริง | ✅ — `clientIpKey` fail-closed ไปที่ bucket `unknown`, และ `TRUST_PROXY_HOPS` default 0 (`main.ts:34`) · int lane มีเคส "spoofed X-Forwarded-For does NOT create a fresh throttle bucket" ผ่านจริง | int lane |
| **N-4** สิทธิ์อ่าน member list | ปิดจริง | ✅ — Staff ได้ 403 ทั้ง `GET` และ `HEAD` | `[V] HEAD members (staff): 403` |
| **NEW-2** reissue ผ่าน `canAssignRole` | เงื่อนไข sign-off | ✅ ปิดจริง (`invitations.service.ts:355-366`) | อ่านโค้ด |
| **NEW-4** ไม่มีนโยบาย tx timeout | เงื่อนไข sign-off | ✅ ปิดจริง — `ORG_TX_TIMEOUTS` (lock 3s / tx 5s / maxWait 2s) env-tunable + `superRefine` บังคับ `lock < tx` ที่ boot | `packages/config/src/{org-policy,env}.ts` |
| **NEW-7** `traceId` ต้อง random ห้ามสะท้อนค่า client | Minor | ✅ ปิดจริง — filter ใช้ `newTraceId()` เสมอ, `extractTraceId(req)` เป็น log-only มีคอมเมนต์กำกับ | `domain-exception.filter.ts:72-99` |
| **NEW-8** traverse ผ่าน org-agnostic กลับลงมา | Minor | ✅ ปิดจริงเชิงโครงสร้าง — `USER_SELECT` frozen ไม่มี relation key ⇒ เขียนรูปที่รั่วไม่ได้ | `user-select.ts` |
| **NEW-9** rotate ล้างธง forensic | Minor | ✅ ปิดจริง **และแยกสองธงถูกต้อง** — wire ใช้ `Invitation.createdAt`, event ใช้ `tokenIssuedAt` | `invitation-view.ts:81-111` |
| **NEW-10** `canAssignRole` คุมเฉพาะ `full_access` | forward-commitment F-003 | ⏭️ ยังเปิดตามที่ตกลง — ไม่รายงานซ้ำ (ตรงกับ commit `a38e464`) | — |
| **High-1** ตำแหน่ง route-tier mark | แก้แล้วใน `c3e128b` | ⚠️ **ดีขึ้นจริง แต่ยังหลบได้ 2 รูป** → **B-4** (ผมไม่รายงานเรื่อง "ลิสต์ 3 ใบ" ซ้ำ) | ตาราง 3 แถวใน B-4 |
| `describeOrgBusy` (409 vs 500) | แก้แล้ว | ✅ **ปิดจริงบนเส้นทางจริง** — int lane มีเคสที่จับ Organization row ค้างไว้จริงแล้ว membership write ได้ `409 + details.reason='busy'` (ไม่ใช่ input ที่เทสต์สร้างเอง) | `✓ a held org row makes a membership write 409 + details.reason='busy' — never 500` |

**สรุป delta:** ปิดจริง 17 · ปิดไม่ครบ/ยังเปิด 3 (C-3 → B-1/B-8 · M-11 → B-2/B-3 · High-1 → B-4) ·
**ไม่พบข้อที่ "ปิดในเอกสารแต่โค้ดไม่ทำเลย"**

**หมายเหตุเรื่องรูที่สามของ last-Owner:** ผมไล่หาแล้วไม่เจอรูปที่สามที่เกิดได้ใน F-002 วันนี้ ·
เส้นที่ผมเจาะ: `accept` ที่ membership `active` (`invitations.service.ts:625-641` → 409 + ไม่แตะ role, I-9 ถูก) ·
`accept` ที่ membership `revoked` (reactivate = เพิ่ม ไม่ใช่ลด) · self-demote / self-revoke / leave (ผ่าน
`assertOwnerRemains` เดียวกันทั้งหมด) · revoke ‖ revoke และ demote ‖ remove (int lane มีเคสจริงและผ่าน) ·
สิ่งที่ใกล้เคียงที่สุดคือ **B-1/B-8** ซึ่งเป็นรูของ *ใครถูกนับว่าเป็น Owner* ไม่ใช่ของ *กติกา* — และวันนี้ยังสร้าง state ไม่ได้

---

## § คำถามของ coordinator: server ทำอะไรกับ `X-Organization-Id` บน route `@UserScoped()`

**คำตอบ: server เพิกเฉยอย่างสมบูรณ์ (ignore) — ไม่ใช้ ไม่ 422 ไม่มี context ถูกสร้าง**
ผมเดินเส้นทางจริงผ่าน HTTP ไม่ได้อ่านแค่โค้ด:

```
[Q1] GET /me/organizations, ไม่ส่ง header        → 200  items = ร้านของผู้เรียกเอง
[Q1] GET /me/organizations, header = org ตัวเอง   → 200  body เหมือนกันทุก byte
[Q1] GET /me/organizations, header = org คนอื่น   → 200  body เหมือนกันทุก byte   ← ไม่รั่ว ไม่ 422
[Q1] GET /me/organizations, header = "no-such-org"→ 200  body เหมือนกันทุก byte
[Q1b] POST /organizations + header = org คนอื่น    → 201  สร้างร้านใหม่ให้ผู้เรียกตามปกติ
[Q1b] POST /auth/login (@Public) + header          → 401  (รหัสผิด) — header ไม่มีผล
```

**กลไกที่ทำให้เป็นแบบนั้น** (ยืนยันกับโค้ด): `OrgContextMiddleware.use()` ถาม `RouteScopeRegistry` ก่อนทุกอย่าง —
ถ้า tier ไม่ใช่ `org` มัน `next()` ทันทีโดยไม่อ่าน header เลย (`org-context.middleware.ts:63-67`) ⇒ ไม่มี ALS context,
`ORG_PRISMA` จะ throw ถ้ามีใครเผลอใช้ และ `MyOrganizationsService` ใช้ `SYSTEM_PRISMA` ที่ `where.userId` มาจาก
`req.orgAuth.userId` (จาก bearer) เท่านั้น

**ความเห็นของผม:** การ **ignore** ถูกแล้วสำหรับ Phase 0 — ตอบ 422 จะทำให้ client ที่แนบ header ไว้ทั่ว ๆ (แบบที่ W3 เพิ่งแก้)
พังทั้งแอปโดยไม่ได้เพิ่มความปลอดภัย เพราะ header ไม่เคยถูกอ่าน · **แต่**ขอเสนอ 1 อย่างราคาถูก: ถ้าอนาคตมี route
`@UserScoped()` ที่เผลออ่าน `req.params.orgId`/header เอง จะไม่มีอะไรจับได้ ⇒ แนะนำเพิ่ม assertion ใน route-registry kit ว่า
**route tier `user`/`public` ต้องไม่ inject `ORG_PRISMA`** (ตรวจจาก DI ของ controller/service ที่ route นั้นใช้)
· การแก้ฝั่ง client ของ W3 ยังเป็นสิ่งที่ควรทำ (ลด attack surface + ไม่ส่งข้อมูลที่ไม่จำเป็น) แต่ **server ไม่ได้พึ่งมัน**

---

## § สิ่งที่ผมยืนยันว่าถูกแล้ว (verify ยังไง)

| ข้อ | วิธีพิสูจน์ (ไม่ใช่การอ่าน comment) |
|---|---|
| **parity gate (T-002-21) จับ endpoint ที่ไม่ได้ประกาศได้จริง** | ลบ path `/orgs/{orgId}/roles` ออกจาก **bundle จริง** `packages/contracts/openapi/openapi.yaml` แล้วรัน int → แดง 3 เคส พร้อมข้อความ `[missing-from-spec] GET /orgs/{orgId}/roles (RolesController.list)` · restore แล้วเขียว · gate อ่าน **bundle** ไม่ใช่ `root.yaml` และ throw ถ้าเจอ `$ref` ค้าง (= กันการชี้ไปไฟล์ source) · มี floor `minRoutes/minOperations ≥ 24` กัน vacuous |
| **route-registry audit (router ↔ ROUTE_CAPABILITIES) กัดจริงบน router จริง** | เปลี่ยน `GET /orgs/:orgId/members` จาก `@RequireCapability(manage_members)` เป็น `@AnyActiveMember()` → `orgs.e2e.int.test.ts` แดงที่เคส "★ every org-scoped route the app serves declares its authorization" (นอกเหนือจาก unit 2 เคส) |
| **ลำดับ guard `OrgScope → Capability → RateLimit` เป็นจริงและ load-bearing** | probe ผ่าน HTTP + Redis จริง: outsider `POST /orgs/{B}/invitations` → 403 และคีย์ `orgrl:createInvitation:o:{B}` **ยังไม่มีอยู่** (`null`) · Staff → 403 คีย์ยัง `null` · Owner → 201 คีย์ = `1` ⇒ คนที่ถูกปฏิเสธเผาโควตาของร้านไม่ได้จริง |
| **AsyncLocalStorage ไม่รั่วข้าม request** | ยิง 40 request สลับกันจาก 2 tenant (`GET /orgs/{id}` คนละ org คนละ token) พร้อมกัน → mismatch = 0 · และมี ALS อันเดียวจริง (`OrgContextStore` เป็น adapter บาง ๆ ของ `packages/db`, `org-context.ts:55-67`) ⇒ `lockCurrentOrganization` อ่าน store เดียวกับ `withOrgScope` |
| **extendedWhereUnique (M-9) ทำงานจริงกับ Postgres** | `findUnique` row ของ org อื่น → `null` · `update` → `P2025` และ row เดิมไม่ถูกแก้ (ตรวจซ้ำด้วย client ที่ไม่ scope) |
| **IDOR บน `:orgId` และ `:userId`** | `GET /orgs/{ของคนอื่น}` → `403 ORG_ACCESS_DENIED` (ไม่แยก "ไม่มีร้านนี้" ออกจาก "ไม่ได้เป็นสมาชิก") · `PATCH /orgs/{A}/members/{userId ของ B}` → int lane มีเคส 404 + "422 ROLE_INVALID สำหรับ role ของร้านอื่น และไม่บอกอะไรเกี่ยวกับร้านนั้น" ผ่านจริง |
| **cursor pagination ปลอมไม่ข้าม org** | `decodeCursor` ตรวจโครงสร้าง + `Date.parse` และคืน `null` → 422 (`cursor.ts:53-76`) · ต่อให้ปลอมสำเร็จ `where` ของทุก list ถูกฉีด `organizationId` (member list) หรือ `userId` (`/me/organizations`) จาก context เสมอ ⇒ cursor เลื่อนได้แค่ในผลลัพธ์ของตัวเอง |
| **member ที่ถูก revoke** | `GET /orgs/{id}` → 403 ทันทีในคำขอถัดไป (ไม่มี cache) · `/me/organizations?status=all` → รูปย่อ (ไม่มี role/entitlement) |
| **`?status=all` บน member list ไม่โผล่ `invited`** | `members.service.ts:169-172` แปลง `all` เป็น `status in [active, revoked]` — `invited` เป็น dead state ที่กรองออก ไม่ใช่ค่าที่ client เลือกได้ |
| **HEAD ไม่ได้สิทธิ์อ่อนกว่า GET** | `HEAD /orgs/{id}/members` ในฐานะ Staff → **403** (ไม่ใช่ 200 ไม่ใช่ 500) · `HEAD /orgs/{id}` → 200 · registry fallback HEAD→GET ทำงานตามที่เขียน |
| **path แปลก ๆ ไม่ทำให้ tier เพี้ยน** | `/orgs/{id}/members/` → 200 · `//orgs/{id}/members` → 404 · `/orgs/{id}/members%2f` → 404 · header ซ้ำสองใบ → `422 ORG_MISMATCH` (fail-closed ทุกกรณี) |
| **rate limit fail-open ตอน Redis ล่ม** | มี int test จริงที่ปิด Redis แล้วยืนยันว่าเสิร์ฟต่อ + ยิง event `auth.throttle.fail_open` · เป็นการตัดสินใจที่ถูกสำหรับ abuse control และ cap 50 org ยัง fail-closed ที่ service แยกกัน |
| **`X-Forwarded-For` ปลอม key ของ rate limit ไม่ได้** | `TRUST_PROXY_HOPS` default 0 (`main.ts:28-34`) + int lane มีเคส "spoofed X-Forwarded-For does NOT create a fresh throttle bucket" · guard ไม่เคยอ่าน header เอง อ่านแค่ `req.ip` |
| **`SET LOCAL lock_timeout` ไม่ใช่ช่อง injection** | ค่ามาจาก `ORG_TX_TIMEOUTS.lockTimeoutMs` และถูกตรวจว่าเป็น positive integer ก่อน interpolate (`org-lock.ts:402-414`) · org id ถูก bind เป็น `$1` |
| **error envelope ไม่รั่ว** | 500 คืนแค่ `INTERNAL` + `traceId` · `OrgBusyError.diagnostic` (SQLSTATE/Prisma code) log-only ไม่เข้า body |

---

## § สิ่งที่ผมไม่ได้รีวิว (อย่าถือว่าผ่าน)

1. **ทุกอย่างที่เป็นขอบเขตของ Part A** — invitation token (สร้าง/hash/rotate/redeem), TIN + `/tax-profile/reveal`,
   `SYSTEM_PRISMA` allowlist ในเชิงลึก, การจัดการ secret/env · ผมแตะเฉพาะจุดที่จำเป็นต่อ authz เท่านั้น
2. **`apps/web` และ `apps/mobile` ทั้งหมด** — commit ฝั่ง web (T-002-W1..W4) ไม่ได้ถูกรีวิวในรอบนี้ตามที่ coordinator สั่ง
   · ★ client-side review (token ใน memory, CSP, XSS surface, deep-link) **ยังไม่มีใครทำ** สำหรับ F-002
3. **F-001 auth surface** (login/refresh/CSRF/JWT alg pinning/admin-reset) — สันนิษฐานว่าคงเดิมตาม review ก่อนหน้า
   ผมตรวจแค่ว่า `access-token-verifier.ts` เป็น verify-only twin ที่ใช้ secret เดียวกัน ไม่ได้ audit ตัว F-001 ใหม่
4. **`packages/contracts` เนื้อใน** — ผมพิสูจน์ว่า parity gate **จับ path ที่หายได้** แต่ **ไม่ได้ตรวจว่า schema ของแต่ละ
   response ตรงกับสิ่งที่ implementation คืนจริงทุก field** (parity เทียบ `METHOD /path` ไม่เทียบ body) ·
   คำถาม "spec ประกาศ field ที่ implementation ไม่ควรคืนไหม" **ยังตอบไม่ได้** — ต้องมี contract test ระดับ body
   (schema validation ของ response จริง) ซึ่งยังไม่มีในลู่ไหน
5. **`oasdiff` / `contracts-drift` job** — ผมอ่าน workflow แต่ไม่ได้รันจริง (ต้องใช้ Docker + merge-base)
6. **การทดสอบ concurrency แบบหนัก** — ผมพึ่ง int lane ที่มีอยู่ (2 owner ถูกลบพร้อมกัน, demote ‖ remove, PATCH ‖ DELETE,
   lock contention) ซึ่งผ่านทั้งหมด แต่ไม่ได้เขียน stress test 50-way เอง
7. **BullMQ worker path** — ยังไม่มี worker ที่เปิด org context ใน F-002 · คำถาม "ALS รั่วใน worker ไหม" จึงยังตอบไม่ได้
   และ `OrgScopeGuard`/`CapabilityGuard` จะ throw บน execution context ที่ไม่ใช่ HTTP (ถูกต้อง) แต่ **ไม่มีเทสต์ที่พิสูจน์
   ว่า worker ที่เรียก `OrgContextStore.run` แล้วโยน error จะไม่ทิ้ง context ค้าง**
8. **performance / DoS เชิงปริมาณ** — `withTotal=true` ยิง `count` เพิ่ม 1 ครั้ง, org lock อาจทำให้ request รอ
   (NEW-4 ปิดด้วย timeout แล้ว) แต่ผมไม่ได้วัด load จริง
9. **`docs/` ที่ไม่ใช่ security-review** — ผมไม่ได้ตรวจว่า architecture/api-spec/data-model ยังตรงกับโค้ดทุกบรรทัด
   (ผมตรวจเฉพาะจุดที่ finding อ้างถึง)

---

## § คำถามที่ต้องส่งกลับเจ้าของ (ผมไม่เดา)

1. **@backend-api:** B-1 — จะปิดด้วย composite FK (migration, ถาวร, ทำครั้งเดียว) หรือด้วยกติกาใน seam
   (ไม่ต้อง migrate แต่ต้องมีคน maintain allowlist)? · ถ้าเลือก "ไว้ F-003" ขอให้บันทึกเป็น forward-commitment
   แบบเดียวกับ NEW-10 แทนที่จะปล่อย comment ที่บอกว่าปิดแล้ว
2. **@qa:** B-6 — จะยก `--min-passed` และเพิ่ม `--require` ของ F-002 ในรอบนี้ หรือทำพร้อม F-003?
3. **@backend-api / @qa:** ข้อ 4 ใน "สิ่งที่ผมไม่ได้รีวิว" — ใครถือ contract test ระดับ **response body**
   (spec schema ↔ ของจริง)? ตอนนี้ไม่มีลู่ไหนตอบคำถามนี้ และมันคือครึ่งที่เหลือของ T-002-21
