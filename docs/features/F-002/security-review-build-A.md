# F-002 · ★ pre-merge security review (build) — **Part A: credential / secret / PII surface**

> **ผู้รีวิว:** security-reviewer (advisory — ไม่ใช่เจ้าของสัญญา, @backend-api/@user เป็นคนตัดสินว่ารับข้อไหน)
> **ขอบเขต:** `f66451f..HEAD` เฉพาะพื้นผิว **credential / secret / PII** — invitation ทั้งวงจร (T-002-19/20),
> tax profile + TIN reveal (T-002-17), `SYSTEM_PRISMA` jail, secret handling
> **HEAD ตอนสรุป:** `625f746` · **ไม่รีวิว** `apps/web` (coordinator ตัดออกรอบนี้) และไม่รีวิว tenancy/contract (part B)
> **วันที่:** 2026-08-06

## สรุปตัวเลข

| ระดับ | จำนวน | รหัส |
|---|---|---|
| 🔴 Critical | 1 | A-1 |
| 🟠 Important | 3 | A-2 · A-3 · A-4 |
| 🟡 Medium | 3 | A-5 · A-6 · A-7 |
| 🔵 Minor | 5 | A-8 · A-9 · A-10 · A-11 · A-12 |
| ⚪ Nit | 1 | A-13 |

**ควรบล็อก merge: A-1 และ A-2** (ทั้งคู่พิสูจน์ด้วยการรันจริงแล้ว ไม่ใช่การอ่านโค้ดเดา)
**ควรปิดในรอบเดียวกันถ้าทำได้: A-3 · A-4**

> ⚠️ **หมายเหตุเรื่องสภาพ worktree:** ระหว่างที่ผมรีวิว มี agent อื่นแก้ไฟล์ใน worktree เดียวกันอยู่
> (ผมเจอ `src/orgs/roles.controller.ts` ในสภาพ `@UserScoped() @Injectable() @Controller(...)` โดยไม่ import
> ทั้งสองตัว → แอปบูตไม่ขึ้นด้วย `ReferenceError: UserScoped is not defined` — สภาพนั้นหายไปแล้ว ไม่อยู่ใน HEAD)
> **ทุก finding ด้านล่างอ้างอิงสถานะที่ commit แล้วเท่านั้น** และผมยืนยัน `git status` สะอาดจากไฟล์ของผมตอนจบ
> · แถม: ตอนผมจบ มี **การแก้ที่ยังไม่ commit** ใน `apps/api/src/orgs/members.service.ts` ที่เปลี่ยน
> `runInOrgLockTransaction(...)` เป็น `this.prisma.$transaction(...)` — **นั่นคือการถอด org row lock ของ §5.1
> ออกจาก mutation** ไม่ใช่ของผม และไม่อยู่ในขอบเขตรีวิวนี้ แต่ควรมีคนดูก่อน commit

---

## 🔴 Critical

### A-1 · `SYSTEM_PRISMA` jail มีทางออกที่ไม่มีใครเฝ้า — feature module ฉีด `PrismaService` ตรง ๆ แล้วอ่านข้าม tenant ได้ โดย gate ทั้งสองตัวไม่ร้อง

**ไฟล์:** `apps/api/src/prisma/prisma.module.ts:8-12` (`@Global()` + `exports: [PrismaService]`) ·
`apps/api/src/prisma/prisma.service.ts:41` (`public readonly client: GuardedPrismaClient`) ·
gate ที่ควรจับ: `apps/api/src/orgs/system/system-prisma-allowlist.test.ts:32` (`/\bSYSTEM_PRISMA\b/`) และ
`packages/config/depcruise/.dependency-cruiser.api.cjs:63-78` (`api-db-client-allowlisted`)

**สถานการณ์โจมตี (รูปธรรม):** dev เขียน service ใหม่ใน `src/orgs/` (หรือ feature module ใด ๆ ในอนาคต) แบบนี้

```ts
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ZzJailProbeService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async everyMembershipEverywhere() {
    return this.prisma.client.membership.findMany({ select: { id: true, organizationId: true } });
  }
}
```

`prisma.client` คือ client ที่ **ไม่ผ่าน `withOrgScope`** เลย — `findMany({})` คืน Membership ของ **ทุก org
ในระบบ** ⇒ ละเมิดกฎทองข้อ 3 ตรง ๆ ไม่มี `organizationId` สักตัวในเส้นทางนั้น

**ทำไมชั้นป้องกันที่มีอยู่ไม่กัน (ผมทำให้แดงแล้ว — มันไม่แดง):** ผมวางไฟล์ข้างบนไว้จริงที่
`apps/api/src/orgs/zz-jail-probe.service.ts` แล้วรัน

| gate | ผลลัพธ์ |
|---|---|
| `pnpm vitest run src/orgs/system/system-prisma-allowlist.test.ts` | ✅ **5 passed** |
| `pnpm run depcruise` | ✅ `OK: real apps/api src has 0 boundary violations` |
| `pnpm run lint` | ✅ ไม่มี error |
| `pnpm vitest run --exclude "**/*.int.test.ts"` (ทั้งชุด) | ✅ **44 files / 623 tests passed** |

เหตุผล: allowlist test แมตช์ **ชื่อสัญลักษณ์** `SYSTEM_PRISMA` — ไฟล์นี้ไม่เอ่ยชื่อนั้นเลย ·
depcruise ห้ามเฉพาะการ import `@omnistock/db` / `@prisma/client` — ไฟล์นี้ import
`../prisma/prisma.service` ซึ่งเป็น **ไฟล์ในแอปเอง** ไม่อยู่ใน `DB_TARGETS` และ depcruise ไม่ตาม transitive
· `PrismaModule` เป็น `@Global()` ⇒ ไม่ต้อง import module อะไรเพิ่มเลยด้วย

**ที่ทำให้หนักกว่าปกติ:** ท่านี้ไม่ใช่ท่าที่ต้องคิดขึ้นมาเอง — `auth/refresh-token.service.ts:19`,
`auth/auth.service.ts:25`, `health/health.service.ts:18` ใช้ท่านี้อยู่ **ในโค้ดปัจจุบัน** (ถูกต้องตาม allowlist)
⇒ คนที่ลอก pattern จากไฟล์ข้างเคียงจะได้ทางอ้อมนี้มาโดยไม่รู้ตัว และ CI จะเขียว

**สถานะจริงวันนี้:** ยัง **ไม่มีไฟล์ไหนใช้ทางนี้** (ผม grep `PrismaService` ทั้ง `src` แล้ว — มีแต่
`auth/`, `health/`, `tenancy/`, `prisma/` ซึ่งอยู่ใน allowlist) ⇒ **ยังไม่มี leak จริง** แต่รั้วที่ควรกัน
"feature ที่ 4 ตัดสินใจว่าเคสตัวเองพิเศษ" **ไม่ทำงาน** และ F-002 คือ feature ที่ตั้งรั้วนี้ให้อีก ~40 feature ลอก

**ข้อเสนอ (เล็กที่สุดที่ปิดจริง — ทำอย่างน้อย 2 ใน 3):**
1. ขยาย regex ของ allowlist test เป็น `/\b(SYSTEM_PRISMA|PrismaService)\b/` (ไฟล์ใน allowlist เดิมผ่านอยู่แล้ว
   เพราะ `auth/ health/ tenancy/ prisma/` อยู่ใน `ALLOWED_PREFIXES` — ผมเช็คแล้วว่าไม่มีไฟล์นอก allowlist
   ที่เอ่ย `PrismaService` วันนี้ ⇒ เปลี่ยนแล้ว CI ยังเขียว)
2. เพิ่ม depcruise rule: `from` = `^apps/api/src/` (ยกเว้น `prisma|tenancy|health|auth` + `.test.ts`)
   → `to` = `^apps/api/src/prisma/prisma\.service` · พร้อม negative fixture แบบเดียวกับที่ gate นี้มีอยู่แล้ว
3. เลิก `export` `PrismaService` ออกจาก `@Global()` module — ให้เหลือทางเข้าเดียวคือ token
   `ORG_PRISMA`/`SYSTEM_PRISMA` ของ `TenancyModule` (`auth/`, `health/` ยังฉีดได้โดย import `PrismaModule` ตรง)

(Owner to action: **@backend-api** ปิด · **@qa** เพิ่ม self-check ว่า gate ใหม่แดงจริงกับ fixture)

---

## 🟠 Important

### A-2 · `POST /orgs/{orgId}/invitations` ที่อีเมลผิดรูป → **500 พร้อมกับที่ invitation ถูก commit ไปแล้ว** ⇒ ซอมบี้ที่กินโควตาและล็อกอีเมลนั้นถาวร

**ไฟล์:** `apps/api/src/orgs/invitations.service.ts:266-334` (ตัว `create`) —
บรรทัด **324** `emailMasked: maskEmail(email)` อยู่ **หลัง** `runInOrgLockTransaction` commit ไปแล้ว ·
`apps/api/src/orgs/invitations.controller.ts:103-110` ตรวจแค่ "ไม่ว่าง" ·
`packages/core-domain/src/orgs/invitation-email.ts:44-50` (`maskEmail` โยน `MaskEmailError`) ·
`packages/core-domain/src/auth/email.ts:44` (`isValidEmailShape` **มีอยู่แต่ไม่มีใครเรียกในเส้นนี้** —
grep ทั้ง repo: ถูกเรียกที่ `auth/auth.service.ts:108` ที่เดียว)

**สถานการณ์โจมตี (ผมยิงจริงผ่าน stack จริง):**

```
POST /orgs/{orgId}/invitations   { "email": "not-an-email", "roleId": <Staff> }
→ 500 {"error":{"code":"INTERNAL","message":"เกิดข้อผิดพลาดภายในระบบ","traceId":"…"}}
```
แต่ในฐานข้อมูล:
```
Invitation { email: "not-an-email", status: "pending", expiresAt: +7d, tokenHash: <hash ของ token ที่ไม่มีใครได้ไป> }
```
- token ถูกสร้าง+แฮชแล้ว แต่ **ไม่เคยถูกส่งกลับ** (500 กิน response ไป) ⇒ แถวนี้ redeem ไม่ได้ตลอดกาล
- ยิงซ้ำอีกที: `409 INVITATION_PENDING` + `details.invitationId` ⇒ **เชิญอีเมลนั้นไม่ได้อีก** จนกว่าจะไปกดยกเลิก
- แถวนี้ถูกนับใน cap `INVITATION_PENDING_CAP = 100` (`assertPendingCapNotReached` นับ `pending ∧ expiresAt > now`
  — ซอมบี้เข้าเงื่อนไขทั้งคู่)
- rate limit ของ `createInvitation` = **30/ชม./org** ⇒ ผู้ถือ `manage_members` (รวม Admin ที่เพิ่งถูกเชิญเข้ามา
  วันนี้ — Phase 0 ยืนยันอีเมลไม่ได้) ยิงอีเมลขยะคนละค่ากัน ~4 ชั่วโมง = เต็ม cap 100
  ⇒ **ทั้งร้านเชิญใครไม่ได้อีกเลย** (`409 INVITATION_LIMIT_REACHED`) และทุก request คืน 500 ซึ่งอ้างได้ว่า "บั๊ก"
  ไม่ใช่การโจมตี · การกู้ต้องไล่ cancel ทีละใบ (ไม่มี bulk endpoint)

**ทำไมชั้นป้องกันที่มีอยู่ไม่กัน:** DTO จงใจไม่ validate อะไรเลย (`dto.ts:104-114` — เหตุผลถูกต้อง: message ของ
class-validator จะกลายเป็น `error.code`) แต่ **กฎที่ควรย้ายไป core-domain ไม่เคยถูกเขียน** — controller ตรวจแค่
`trim() !== ""` และ `create()` ไม่เรียก `isValidEmailShape` เลย · int test ทุกใบใช้อีเมลที่ถูกรูปแบบ ⇒ ไม่มีเคสนี้
· และนี่ยังชนกับข้อห้าม "ห้ามมี 500" ที่ qa ตั้งไว้เอง (I-C-10)

**ข้อเสนอ:**
1. เรียก `isValidEmailShape(normalizeEmail(email))` **ก่อนเปิด transaction** → `422 VALIDATION_FAILED` +
   `fieldErrors.email` (ข้อความไม่สะท้อนค่าที่ส่งมา) — ทางที่ถูกที่สุดคือทำเป็น pure validator ใน
   `packages/core-domain/src/orgs/` คู่กับ `validateTaxProfilePut` ให้รูปเดียวกัน
2. เผื่อชั้นสอง: event post-commit ไม่ควรทำให้ request ที่ **สำเร็จไปแล้ว** กลายเป็น 500 —
   ห่อการ emit ไว้ (หรือให้ `maskEmail` มี variant ที่คืน `null` สำหรับ audit path) เพราะตอนนี้ "งานสำเร็จ"
   กับ "ตอบ 200" ผูกกันด้วยการมาสก์อีเมล ซึ่งไม่ควรเป็นเงื่อนไขของความสำเร็จ
3. @qa: 1 เคส int (อีเมลไม่มี `@`, อีเมลลงท้าย `@`, อีเมลว่างหลัง trim) → 422 **และ**
   `invitation.count(org) === 0`

(Owner to action: **@backend-api** · เคส → **@qa**)

---

### A-3 · gate ที่เขียนขึ้นมาแทน "High-1 ที่คุมแค่ 3 ใน 12 controller" ถูกหลบได้ด้วย decorator คั่นหนึ่งบรรทัด

**ไฟล์:** `apps/api/test/controller-tier-marks.test.ts:56-58` (regex
`/((?:@(?:Public|UserScoped|SystemScoped)\(\)\s*\n\s*)*)@Controller\(/`)

**สถานการณ์ (ผมทำให้แดงแล้ว — มันไม่แดง):** ผมแก้ `src/orgs/tax-profile.controller.ts` ชั่วคราวเป็น

```ts
@UserScoped()
@Injectable()
@Controller("orgs/:orgId/tax-profile")
export class TaxProfileController {
```

แล้วรัน `pnpm vitest run test/controller-tier-marks.test.ts` → ✅ **4 passed** (ควรแดงที่เคส
"★ no controller whose path carries :orgId declares a tier at CLASS level")

regex บังคับให้ tier mark ต้อง **ติดกับ `@Controller` เป๊ะ ๆ** ⇒ decorator อะไรก็ได้ที่คั่นกลาง
(`@Injectable()`, `@UseGuards()`, `@ApiTags()`, หรือแม้แต่ comment บรรทัดเดียว) ทำให้ `classMarks` เป็น `[]`
และ controller ผ่านทั้งสามข้อ

**นี่ไม่ใช่สมมติฐาน:** ระหว่างรีวิว ผมเจอ `src/orgs/roles.controller.ts` ในสภาพนี้จริง ๆ ใน working tree
(`@UserScoped()` + `@Injectable()` เหนือ `@Controller("orgs/:orgId/roles")`) — ผมเจอเพราะ **แอปบูตไม่ขึ้น**
(`ReferenceError: UserScoped is not defined`, ทั้งสองตัวไม่ได้ import) ไม่ใช่เพราะ gate ร้อง

**ผลถ้าหลุด:** tier ระดับ class ถูกสืบทอดโดยทุก handler ที่เพิ่มทีหลัง และตัวที่สืบทอดคือตัวที่ **หลวมที่สุด**
เสมอ — `@UserScoped()` บนเส้นที่มี `:orgId` = `OrgScopeGuard` เช็คแค่ "token ใช้ได้" ไม่เช็ค membership,
และ `CapabilityGuard` ก็ return ทันทีเมื่อมี tier ประกาศไว้ ⇒ `@RequireCapability(manage_org_settings)`
บน `POST …/tax-profile/reveal` ไม่มีผล
*ข้อบรรเทาที่ผมยืนยัน:* วันนี้ service อ่าน org จาก ALS ไม่ใช่จาก `:orgId` ⇒ เคสนี้จะจบที่ 500
(`MissingOrgContextError`/`INTERNAL`) ไม่ใช่ leak ทันที — **แต่นั่นคือความบังเอิญของ implementation
ไม่ใช่สิ่งที่ gate นี้รับประกัน** และเป็นสิ่งที่ refactor ครั้งเดียวก็หายไป

**ข้อเสนอ:** เลิกใช้ regex แบบ prefix ติดกัน — จับ **ทุก decorator ที่อยู่เหนือ `@Controller`** (หรือใช้ TS AST
/ อ่าน metadata จริงผ่าน `Reflect.getMetadata(ROUTE_SCOPE_KEY, Class)` ของ controller ที่ `auditApp()`
ค้นได้อยู่แล้ว) · การเช็คที่ **runtime metadata** ดีกว่าเช็คข้อความ เพราะมันวัดพฤติกรรมจริง ·
และเพิ่ม SELF-CHECK แบบที่ `system-prisma-allowlist.test.ts` มี: fixture ที่ต้องถูกจับให้ได้

(Owner to action: **@qa** เจ้าของไฟล์ + **@backend-api** ถ้าจะย้ายไปอ่าน metadata)

---

### A-4 · `GET /orgs/{orgId}/invitations` ไม่ derive สถานะ — คำเชิญที่หมดอายุแล้วรายงานว่า `pending` และ `?status=expired` คืนหน้าเปล่าเสมอ

**ไฟล์:** `apps/api/src/orgs/invitations.service.ts:117` (`status: row.status as InvitationRow["status"]`
— cast ค่า **stored** เป็นชนิด **resolved**) และ `:233` (`statusFilter = { status: input.status }` — ยิง
`expired` ไปที่คอลัมน์ที่ไม่มีใครเขียนค่านั้น) · `resolveInvitationStatus` ถูก import ในไฟล์นี้แต่ใช้แค่ใน
`preview()` (`:470`) · ขัดกับ `packages/core-domain/src/orgs/invitation-status.ts` (บรรทัดหัวไฟล์:
"`expired` is COMPUTED at read time, never stored") และกับ contract
(`packages/contracts/openapi/paths/org-invitations.yaml:36-43` ประกาศ enum มี `expired`)

**สถานการณ์ (ผมยิงจริง):** สร้างคำเชิญ role **Owner** แล้วดัน `expiresAt` ไปอดีต 60 วินาที

```
GET …/invitations?status=pending → 200 [{ "status": "pending", "expiresAt": <อดีต> }]   ← โกหก
GET …/invitations?status=expired → 200 []                                              ← ตัวกรองตายสนิท
GET …/invitations?status=all     → 200 [{ "status": "pending", … }]
```

**ทำไมสำคัญเชิงความปลอดภัย ไม่ใช่แค่ UX:** หน้านี้คือ **ที่เดียว** ที่เจ้าของร้านเห็นว่ามี credential
ค้างอยู่กี่ใบ ใครถืออยู่ (F-005 ยังไม่มี, event ยังเป็น log อย่างเดียว) ⇒
- มันรายงาน "ลิงก์ยังมีชีวิต" เกินจริง ⇒ เจ้าของร้านอาจไปกด cancel/reissue บนความเข้าใจผิด
- คนที่อยากตามล้างของเก่า **หาไม่เจอ**: `?status=expired` บอกว่า "ไม่มีอะไรต้องล้าง" ทั้งที่มี
- ประกอบกับ A-9 (reissue คำเชิญที่หมดอายุได้ 200) ⇒ ใบ Owner ที่ "ตายแล้ว" ในสายตาผู้ใช้
  ยังเป็นประตูที่กดปุ่มเดียวเปิดใหม่ได้ และมันไม่ปรากฏในตัวกรองไหนเลยว่าอยู่ในสภาพนั้น

**ข้อเสนอ (ไม่แตะ wire, ไม่ต้องปลด LOCKED):**
1. `toRow()` รับ `now` แล้วส่ง `resolveInvitationStatus({status,expiresAt}, now)` แทนการ cast
2. แปลตัวกรองที่ service: `pending → { status:'pending', expiresAt:{ gt: now } }` ·
   `expired → { status:'pending', expiresAt:{ lte: now } }` · ที่เหลือคงเดิม
3. @qa: 1 เคส — สร้างคำเชิญ, ดัน `expiresAt` ไปอดีต, ยืนยัน `?status=pending` ไม่มีมัน,
   `?status=expired` มีมัน, และ `status` ในแถวเป็น `"expired"`

(Owner to action: **@backend-api** · เคส → **@qa**)

---

## 🟡 Medium

### A-5 · `TAX_ID_RESPONSE_ALLOWLIST` ถูกบังคับแค่ "ตารางตรงกับ router" ไม่ได้บังคับกับ **body จริง** — คำโฆษณา "(e) เส้นนี้เส้นเดียวเท่านั้น" แข็งกว่าที่โค้ดทำ

**ไฟล์:** `apps/api/src/common/authz/route-capabilities.ts:156-164` ·
เทสต์เดียวที่ใช้มัน: `apps/api/test/orgs.e2e.int.test.ts:635-646` ·
`apps/api/test/assertions.kit.ts:39-48` (`FORBIDDEN_RESPONSE_FIELDS` — **ไม่มี `taxId`**) ·
`apps/api/test/org-leak.kit.int.test.ts` (persona sweep — ไม่สแกน TIN เลย, grep แล้วไม่พบคำว่า taxId/TIN)

เทสต์ที่ชื่อว่า "★ reveal is the ONLY route allowed to emit a full TIN" พิสูจน์แค่ว่า **ตาราง**
มี 1 แถว และ route อื่นใน router ไม่อยู่ในตาราง — มันไม่เคยดู response body สักใบ
⇒ ถ้าวันหนึ่ง mapper ของ `GET /orgs/{orgId}` หรือ endpoint ใหม่ใส่ `taxId` เต็มลงไป
**ไม่มี gate ไหนแดง** เหลือแค่ spot check ที่เขียนมือไว้ 2-3 จุดใน `orgs.e2e.int.test.ts`

**ข้อเสนอ:** ใน sweep ของ leak kit (ซึ่งวิ่งทุก route × 5 persona อยู่แล้ว) เพิ่มกฎเดียว:
`!isTaxIdAllowedOnRoute(route) ⇒ JSON.stringify(body) ต้องไม่มี TIN ที่ seed ไว้`
(ใช้ค่าที่ seed เอง ไม่ใช่ regex 13 หลัก — เลี่ยง flaky ที่เคยเจอตอนชน epoch-millis)
(Owner to action: **@qa** · @backend-api ถ้าต้อง export ค่า TIN ของ kit)

### A-6 · `MAX_ORGS_PER_USER` บังคับที่ `POST /organizations` เส้นเดียว — `POST /invitations/accept` สร้าง membership โดยไม่นับ

**ไฟล์:** grep `MAX_ORGS_PER_USER` ทั้ง `src` → พบใช้จริงเฉพาะ
`apps/api/src/orgs/system/org-provisioning.service.ts:81` · `invitations.service.ts` (accept, `:643-671`)
สร้าง/ปลุก membership โดยไม่มีการนับเลย

D-029/§6.3/I-10 เขียนกติกาไว้ว่า "ผู้ใช้หนึ่งคนถือ active membership ได้ไม่เกิน 50" และปิด finding I-10
ด้วยคำว่า "fail-closed ที่ service" — จริงครึ่งเดียว ⇒ ค่านี้ไม่ใช่ invariant มันเป็นแค่ quota ของปุ่มสร้างร้าน

**ผลกระทบจริง (จำกัด แต่มี):** ผู้ใช้ที่ถูกเชิญเข้าเกิน 50 ร้าน จะ **สร้างร้านของตัวเองไม่ได้อีก**
(`409 ORG_LIMIT_REACHED`) โดยไม่มีอะไรอธิบายว่าทำไม · ไม่ใช่ช่องที่ผู้โจมตีบังคับได้ (เหยื่อต้องกดรับเอง)
จึงไม่ยกเป็น Important

**ข้อเสนอ:** ถ้าเจตนาคือ invariant → นับใน tx ของ accept ด้วย (raw count ผ่าน `lookup` เพราะ `ORG_PRISMA`
ตอบข้าม org ไม่ได้) แล้วคืน 409 ที่มีความหมาย · ถ้าเจตนาคือ "quota ของการสร้างร้านเท่านั้น" →
แก้ถ้อยคำใน architecture §6.3 ให้ตรง อย่าปล่อยให้เอกสารสอนว่ามันเป็น bound ของ membership
(Owner to action: **@product/@backend-api** ตัดสินเจตนาก่อน)

### A-7 · `RESPONSE_HEADER_POLICY` มี 4 route key ซ้ำ และ `responseHeaderPolicyFor` ใช้ `.find()` ⇒ แถวที่ถูกต้องเป็นแถวที่ตายแล้ว

**ไฟล์:** `apps/api/src/orgs/response-headers.ts:94-146` (ตาราง) · `:153` (`.find()`)

คู่ที่ซ้ำ (แถวแรกชนะเสมอ):

| route | แถวที่ **ชนะ** (บรรทัด) | แถวที่ **ตาย** (บรรทัด) |
|---|---|---|
| `GET /orgs/{orgId}/invitations` | 105 · `ORG_PROFILE` · `carries:["tin"]` | 123 · `INVITATION` · `carries:["email"]` |
| `POST /orgs/{orgId}/invitations` | 106 · `carries:["tin"]` | 124 · `carries:["token","email"]` |
| `POST …/invitations/{invitationId}/link` | 107 · `carries:["tin"]` | 125-130 · `carries:["token","email"]` |
| `DELETE …/invitations/{invitationId}` | 108 · `ORG_PROFILE` | 131-136 · `INVITATION` |

ผลที่ตามมา 2 อย่าง:
1. `carries` ของ 4 เส้นนี้เป็น `["tin"]` ทั้งที่มันไม่เคยคืน TIN — มันคืน **token กับ email**
   ⇒ ทิศทาง "wire → policy" ที่ตารางนี้อ้างว่าทำได้ (comment บรรทัด 14-19) จะตอบผิดถ้ามีใครเขียนเช็คตามนั้น
   (`members.routes.test.ts:177` ทำแบบนั้นกับเส้น member อยู่แล้ว — เส้น invitation ยังไม่มีใครเช็ค
   และ **ไม่มี `invitations.routes.test.ts` เลย**)
2. `GET /orgs/{orgId}/invitations` ตอบด้วย `ORG_PROFILE_RESPONSE_HEADERS` จริง (controller บรรทัด 76)
   = ไม่มี `Referrer-Policy: no-referrer` ทั้งที่แถวที่ตายบอกว่าต้องมี — response นี้เป็นรายการ
   **อีเมลของทุกคนที่ถูกเชิญ**

**ข้อเสนอ:** ยุบให้เหลือแถวเดียวต่อ route (รวม `carries`), เพิ่ม assertion ว่า `RESPONSE_HEADER_POLICY`
ไม่มี key ซ้ำ (`new Set(map(routeKey)).size === length`) และตัดสินว่า `GET …/invitations` ควรได้
`no-referrer` ด้วยหรือไม่ (ผมคิดว่าควร — มันคือรายการอีเมล)
(Owner to action: **@backend-api** · @qa เพิ่ม uniqueness assertion + `invitations.routes.test.ts`)

---

## 🔵 Minor

### A-8 · `resolveInvitationTokenSecret` รับประกันแค่ "มีและยาวพอ" ไม่ได้เช็ค key separation — และ `packages/db` เรียกมันทุกครั้งที่แฮช

`packages/config/src/env.ts:352-357` · การเช็ค `INVITATION_TOKEN_SECRET ≠ JWT_*` อยู่ใน
`envSchema.superRefine` (`:212-222`) ซึ่งวิ่งเฉพาะตอน `loadEnv` · docstring ของ resolver พูดเรื่องนี้ตรง ๆ
เอง (ซึ่งดี) แต่ผลคือ process ใดก็ตามที่ **ไม่ได้บูตผ่าน `loadEnv`** (script, seed, worker ในอนาคต,
test harness ที่ตั้ง env เอง) แฮช invite token ด้วยคีย์เดียวกับ JWT ได้ แล้วทุกอย่างทำงานปกติ
⇒ วันที่ JWT secret หลุด มันก็จะแฮช invite token ได้ด้วย ซึ่งคือสิ่งที่ §7.3 พยายามกัน
**ข้อเสนอ:** ให้ resolver เช็คด้วยว่า ค่าที่ได้ ≠ `source.JWT_ACCESS_SECRET` และ ≠ `source.JWT_REFRESH_SECRET`
(ถ้าตัวแปรนั้นมีอยู่) — 3 บรรทัด, ไม่กระทบ production path ที่ผ่าน `loadEnv` อยู่แล้ว

### A-9 · reissue คำเชิญที่ **หมดอายุแล้ว** คืน 200 พร้อม token ใหม่อายุ 24 ชม. (ผมยิงจริง) — pending row ไม่มีวันตาย

`apps/api/src/orgs/invitations.service.ts:350-354` · เป็นการ **ตัดสินใจที่จงใจ** (comment อธิบายไว้ และ
NEW-2 เสนอ 409 ไว้เป็น "เสริม" ไม่ใช่เงื่อนไข) ⇒ ผมไม่ถือเป็นข้อผิด แต่บันทึกผลรวม: `canAssignRole`
กันไม่ให้ Admin ทำกับใบ Owner ได้แล้ว (พิสูจน์แล้ว ดู §ยืนยัน ข้อ 2) เหลือความจริงว่า **ใบ Owner ที่ออกไว้
เมื่อไหร่ก็ตาม เป็นออปชันถาวรของผู้ถือ `full_access`** และมันมองไม่เห็นในรายการเพราะ A-4 และไม่ถูกนับใน cap
เพราะ cap นับเฉพาะ `expiresAt > now` · ถ้ายังยืนตามนี้ ควรผูกกับ A-4 ให้ผู้ใช้ **เห็น** มันอย่างน้อย

### A-10 · `org.invitation.*` ไม่อยู่ใน `STRICT_PAYLOAD_EVENT_TYPES`

`apps/api/src/auth/security-events.service.ts:166-171` · ตระกูล invitation พึ่ง (ก) call site ที่เรียก
`maskEmail` เอง และ (ข) `REDACTED_PAYLOAD_KEYS` ที่ตัดคีย์ชื่อ `email` — แต่ **ไม่ตัด `emailMasked`**
(ถูกแล้ว มันคือคีย์ที่ตั้งใจส่ง) ⇒ call site ที่ส่ง **อีเมลเต็ม** ใส่คีย์ `emailMasked` จะผ่านฉลุย
`org.tax_profile.*` ได้ strict filter เพราะเหตุผลเดียวกันเป๊ะ · ราคาถูกมาก: ใส่
`org.invitation.created/accepted/link_reissued/cancelled` + `org.member.reactivated` เข้า strict list ด้วย

### A-11 · `org-scope.guard.ts:90` ประกอบ log จาก `req.originalUrl` ดิบ (มี query string) ขณะที่ `capability.guard.ts:82` ผ่าน `normalizePath` (ตัด query)

วันนี้ยังไปไม่ถึง: เส้น invitation รับ token ทาง **body** เท่านั้น และ branch ที่ log ค่านี้เป็น branch
`INTERNAL`/`@SystemScoped` ซึ่ง request ปกติไม่แตะ · แต่ถ้า client เผลอต่อ `?token=…` ท้าย
`POST /invitations/accept` แล้ววันหนึ่งไปตกที่ branch นั้น token จะลง log · ทำให้เหมือน capability guard
(ใช้ `normalizePath`) เสียก็จบ

### A-12 · ไม่มี unit test ประกบ `InvitationsService` ฝั่ง org (create/list/reissue/cancel)

มีเฉพาะ `invitation-redemption.service.test.ts` (accept/preview) + int lane · D-014 บอกว่าทุกงาน implement
ต้องมี unit test ประกบ · ที่เจ็บกว่าคือ finding A-2 และ A-4 เป็นเคสที่ unit test ระดับ service
จะจับได้ในไม่กี่บรรทัด แต่ int test ที่มีอยู่ใช้ข้อมูลถูกรูปแบบเสมอเลยไม่เคยเดินผ่าน

---

## ⚪ Nit

### A-13 · `maskEmail` โยน exception จาก projection ของ `POST /invitations/preview`

`packages/core-domain/src/orgs/invitation-redemption-view.ts:64-73` — แถวที่มาสก์ไม่ได้ (เข้าถึงได้ผ่าน A-2
เท่านั้นในวันนี้) ทำให้ preview ตอบ 500 แทน domain code · การเลือก "โยนดีกว่าคืน placeholder" **ถูกแล้ว**
สำหรับหน้า public แต่ควรมีการแมป `MaskEmailError → INVITATION_INVALID` ที่ filter เพื่อไม่ให้มันเป็น 500

---

## สิ่งที่ผมยืนยันว่าถูกแล้ว (verify ยังไง — ไม่ใช่ "ดูแล้วโอเค")

1. **การผลิตและเก็บ token (D-018)** — อ่าน `packages/db/src/invitation-token.ts` ทั้งไฟล์ + อ่าน
   `invitation-token.test.ts` ทีละเคส: `randomBytes(32)` (256-bit) base64url 43 ตัว · `HMAC-SHA-256` keyed ·
   hex 64 · เทสต์ pin ไว้ว่า **ไม่ใช่ bare SHA-256** (เทียบกับ `createHash` ตรง ๆ) และ hash ไม่มี window
   8 ตัวอักษรร่วมกับ input · ทั้งหมดนี้เป็นเคสที่จะแดงจริงถ้ามีคน "simplify" — ไม่ใช่ assertion ที่ผ่านเปล่า
2. **NEW-2 (`canAssignRole` ที่ reissue) เป็นของจริง — ผมทำให้แดงแล้ว**
   ปิดการเช็คใน `reissueLink` ชั่วคราว (`if (!allowed && false)`) → `pnpm vitest run
   test/invitations.e2e.int.test.ts` = **1 failed / 13 passed** และตัวที่แดงคือ
   "★ NEW-2: an Admin cannot reissue an OWNER invitation, and the DB does not move" เป๊ะ · คืนไฟล์แล้ว
   (`git status` สะอาด)
3. **IDOR ข้าม org ด้วย `invitationId` ปิดจริง — ผมยิงจริง**
   Owner ของ org A เรียก `POST /orgs/A/invitations/{idOfB}/link` → **404 NOT_FOUND** ·
   `DELETE /orgs/A/invitations/{idOfB}` → **404** · และผมอ่าน row ของ B กลับมาเทียบ:
   `tokenHash` **ไม่เปลี่ยน** และ `status` ยัง `pending` ⇒ `withOrgScope` ฉีด `organizationId`
   เข้า `findUnique` (`uniqueWhere`, `packages/db/src/tenancy.ts:165`) ได้ผลจริง ไม่ใช่แค่คำอ้าง M-9
4. **NEW-9 ยังจริง** — `packages/core-domain/src/orgs/invitation-view.ts:81-87`
   (`acceptedUserCreatedAfterInvite` เทียบ `source.createdAt`) และ `:110-112`
   (`userCreatedAfterTokenIssued` เทียบ `tokenIssuedAt`) เป็น **คนละฟังก์ชัน คนละ baseline** ·
   `toInvitationRow` ส่ง object ทั้งก้อนเข้าไป (`:132`) ⇒ ใช้ `createdAt` จริง ·
   service ใช้ตัวที่สองเฉพาะใน event (`invitations.service.ts:723`) ⇒ กด reissue ไม่ล้างธงบน wire
5. **token ไม่เข้า query string ในฝั่งเรา (I-6)** — อ่าน handler ทั้งสอง: `RedeemInvitationDto` มีคีย์เดียว
   (`token`) และรับจาก `@Body()` เท่านั้น, ไม่มี `@Query` ที่ไหนในสองไฟล์นั้น · int test มีเคสยิง token
   ทาง query แล้วต้องไม่ถูกอ่าน ทั้ง preview (`:205`) และ accept (`:603`) · ทั้งสองเส้นตั้ง
   `no-store` + `Referrer-Policy: no-referrer` (`INVITATION_RESPONSE_HEADERS`) — assert จาก **ค่าที่ export
   จาก production** ไม่ใช่ค่าที่พิมพ์ซ้ำในเทสต์ · **`inviteUrl` ที่มี `?token=` เป็น URL ของ web app
   ตามเจตนา D-012 — เป็น ★-task ของ @frontend ยังไม่ปิด (ดูหัวข้อถัดไป)**
6. **token ไม่เคยถูกเก็บ/อ่านกลับได้** — `INVITATION_SELECT` (`invitations.service.ts:81-94`) ไม่มี
   `tokenHash` · `InvitationLookupService.findByTokenHash` ไม่ select `tokenHash` กลับ · int test
   คำนวณ `hashInvitationToken(raw)` แล้วเทียบกับ column และยืนยันว่า `JSON.stringify(row)` ไม่มี raw
7. **enumeration ที่ preview** — unknown / rotated / ของร้านที่ถูกลบ = `404 INVITATION_INVALID` ก้อนเดียว
   (`invitations.service.ts:466`, มี comment "Do NOT add a branch here") · int test เทียบ **byte ต่อ byte**
   ระหว่าง unknown กับ rotated (`:229`) · สถานะละเอียด (expired/cancelled/accepted) ออกหลังจาก HMAC
   แมตช์แล้วเท่านั้น ⇒ ผู้เรียกถือความลับอยู่ก่อนแล้ว · lookup เป็น `findUnique` บน unique index
   ⇒ ไม่มี JS comparison ให้จับเวลา
8. **accept พร้อมกันสองครั้ง** — อ่านเทสต์ที่ `invitations-redeem.e2e.int.test.ts:624` จริง: ยิงด้วย
   `Promise.all` ไม่มี sleep ไม่มีสมมติฐานลำดับ, assert `[200,409]`, membership = **1 แถว**,
   invitation ลงเอยที่ `accepted` · โครงสร้างที่รองรับคือ `runInOrgLockTransaction` (SELECT…FOR UPDATE
   บนแถว Organization) + re-read ทุก fact ผ่าน `tx` (`invitations.service.ts:552-596`) ซึ่งผมไล่อ่านทีละ statement
9. **TIN ออกทางเดียว** — `GET /orgs/{id}` ให้ Staff แค่ `{vatRegistered}` (int test เทียบ `toEqual` ไม่ใช่
   `toMatchObject`) · `PUT` คืน body §3.3 เดิม ไม่สะท้อนค่าที่เพิ่งส่ง (`tax-profile.service.ts:90`) ·
   `reveal` select แค่ 2 คอลัมน์ · event ผ่าน `sanitizePayload` (`security-events.service.ts:205-227`)
   ซึ่งผมอ่านจริง: มี **2 ชั้น** — `REDACTED_PAYLOAD_KEYS` (มี `taxid`, `taxidmasked`, `token`, `email`,
   `passwordhash`) ตัดทุก event, และ strict filter ตัดคีย์นอก whitelist สำหรับ `org.tax_profile.*` ·
   int test ไล่หา **ทุก window 4 ตัวอักษร** ของ TIN ใน payload
10. **secret separation ที่ boot** — `packages/config/src/env.ts:212-222` เป็น `superRefine` ที่ปฏิเสธ
    `INVITATION_TOKEN_SECRET` เท่ากับ JWT ตัวใดตัวหนึ่ง + `min(32)` (`:172-177`) ·
    `loadEnv` พิมพ์เฉพาะ **ชื่อตัวแปร + เหตุผล** ไม่เคยพิมพ์ค่า (`:250-263`) ·
    `WEB_APP_BASE_URL` ต้องเป็น https ยกเว้น loopback นอก production (`:100-113`)
    ⇒ invite URL ที่มี token ในนั้นออกทาง http ใน prod ไม่ได้
11. **rate limit อ่านค่าจาก env จริง** — guard ใช้ `ORG_RATE_LIMITS` (getter อ่าน `process.env` ทุกครั้ง)
    ไม่ใช่ `ORG_RATE_LIMIT_DEFAULTS` ที่ freeze ไว้ (`org-rate-limit.guard.ts:107` + comment ที่อธิบายว่า
    เคยผิดตรงนี้) · `publicInvitationEntry` key = `ip` ผ่าน `clientIpKey` (IPv6 ยุบ /64) และ
    branch นี้ **ไม่มีทางตกไป "unidentified"** ⇒ endpoint สาธารณะถูกนับเสมอ · fail-open พร้อม event
    เป็นการตัดสินใจที่ประกาศไว้ (§8) และ cap ที่เป็น invariant จริงถูกบังคับ fail-closed ที่ service
12. **`SYSTEM_PRISMA` ในความหมายของตัวมันเอง** — ไฟล์ที่เอ่ยชื่อ token นี้มีแค่ 4 ไฟล์ใน `orgs/system/`
    ตามที่ pin ไว้ และเทสต์มี SELF-CHECK ว่า matcher จับได้จริง + ไม่จับ comment ⇒ **ส่วนนี้ทำงาน**
    (ปัญหาคือมันไม่ใช่ทางเดียวที่ออกจาก jail — A-1)

---

## สิ่งที่ผมไม่ได้รีวิว (อย่าถือว่าผ่าน)

1. **`apps/web` ทั้งหมด** (T-002-W1/W2/W3 + งานที่ยังไม่ commit) — coordinator ตัดออกรอบนี้
   ⇒ **★-task ของ I-6 ฝั่ง client ยังเปิดอยู่**: token ใน URL ของเบราว์เซอร์, การไม่เก็บลง
   localStorage/sessionStorage, การไม่ส่งเข้า analytics/Sentry, การถอด token ออกจาก URL หลัง preview,
   และคำสั่งใน contract ว่า TIN ที่ reveal มา "ห้ามเก็บ ห้าม log" — **ยังไม่มีใครรีวิว**
2. **Part B (tenancy + contract)** — `OrgScopeGuard`/`CapabilityGuard` decision matrix, `ROUTE_CAPABILITIES`
   ครบไหม, `withOrgScope` operation map, openapi parity, `members.service.ts` authz, `admin-reset`
   (NEW-1/D-030) ผมแตะเฉพาะเท่าที่ invitation/tax ต้องใช้
3. **§5.2 lock/timeout mapping** (`prisma/org-busy.ts`, 55P03 → 409, deadlock) — ผมพึ่งพาว่ามันทำงาน
   ตอนพิสูจน์ concurrency แต่ไม่ได้ตรวจเอง
4. **การแก้ที่ยังไม่ commit ใน worktree** — โดยเฉพาะ `members.service.ts` ที่กำลังถอด
   `runInOrgLockTransaction` ออก (ดูหมายเหตุหัวเอกสาร) · ผมรีวิว **HEAD `625f746`** ไม่ใช่ working tree
5. **มือถือ (Flutter)** — ไม่มีโค้ดในขอบเขตนี้
6. **CI ว่ารัน int lane จริงกับ PR นี้หรือยัง** — ผมรันเองในเครื่อง (Redis index 14 ตามที่กำหนด);
   "เขียวในเครื่อง ≠ ผ่าน" ยังเป็นกฎของโปรเจกต์นี้
7. **ค่าเชิงนโยบาย** — cap 100 ใบ, 30/60/20 ต่อชั่วโมง, TTL 24 ชม./7 วัน เหมาะกับธุรกิจไหม เป็นเรื่อง
   product/ops ไม่ใช่กลไก

---

## 3 จุดที่ผมเจาะหนักที่สุด (calibration — เผื่อประเมินว่ารีวิวนี้เชื่อได้แค่ไหน)

1. **"gate ที่รายงานว่าผ่านแต่ไม่เคยทำให้แดง"** — ผมทดสอบ 3 gate ด้วยการวางของผิดจริง ๆ:
   SYSTEM_PRISMA allowlist (**หลุด → A-1**), controller tier marks (**หลุด → A-3**),
   NEW-2 canAssignRole (**จับได้ → ยืนยันข้อ 2**) · อัตราส่วน 2 ใน 3 ที่หลุด คือเหตุผลที่ผมยก A-1 เป็น Critical
   ทั้งที่ยังไม่มี leak จริง
2. **invitation lifecycle ทุก transition × ผู้เรียกทุกชนิด** — สร้าง/ออกลิงก์ใหม่/ยกเลิก/preview/accept
   × Owner/Admin/Staff/คนนอก/คนละร้าน · ยิงจริง 3 รอบ (malformed email, cross-org id, expired reissue,
   list status) · ที่เจอเป็นเรื่องของ **input ที่ไม่มีใคร validate** และ **สถานะที่ไม่ได้ derive**
   ไม่ใช่ authz ซึ่งแน่นดี
3. **เส้นทางที่ TIN/ token/ อีเมลจะรั่วออกได้** — response body, event payload, error message, log line,
   URL, header · สองชั้นแรกแน่นจริง (projection field-by-field + sanitizer สองชั้น) · ที่เหลือคือ
   A-5 (ไม่มีใครสแกน body จริง), A-7 (ตารางซ้ำจนแถวที่ถูกตาย), A-11 (log ที่ไม่ normalize)
