---
doc: api-spec
owner: "@backend-api"
signoff: approved   # user 2026-07-28
---
# [F-002] API design

> STATUS: **LOCKED** (2026-07-28) — contract นิ่ง พร้อม sign-off
>
> **amend #4 (2026-07-28, ปิดเงื่อนไข delta review §H + D-030) — ไม่มีการเปลี่ยน wire:** ไม่มี endpoint/field/
> `code`/status/schema เพิ่มหรือแก้แม้แต่ตัวเดียว (registry ยังเป็น **18 code ใหม่** ตามที่ qa pin ไว้ที่ U-API-15) ·
> สิ่งที่แก้ในไฟล์นี้เป็นการ **แคบลง/ชัดขึ้น** ทั้งหมด: (1) §2 แถว 12 + §3.12 — reissue ต้องผ่าน Owner-only
> เหมือนตอนเชิญ (NEW-2 · ใช้ `403 FORBIDDEN` ที่ประกาศไว้แล้ว) (2) §2 หมายเหตุใต้ตาราง — admin-reset ปฏิเสธ
> เพิ่มอีก 1 เงื่อนไข (NEW-1/D-030 · คืน 404 รูปเดิม) (3) §1 — pin รูปแบบ `traceId`/ถ้อยคำ `X-Request-Id` (NEW-7)
> **+ แถวใหม่ "Lock contention"** ที่ประกาศว่าเส้นซึ่งคว้า lock คืน `409 CONFLICT` + `details.reason="busy"`
> **แทน 500** (NEW-4 · ไม่มี status/code ใหม่) (4) §3.10 — นิยามของธง `acceptedUserCreatedAfterInvite` (NEW-9)
> (5) §3.16 — บันทึกการยืนยันสิทธิ์ระดับ `manage_org_settings` + ตัวคุม (NEW-11/D-030) (6) §4/§5/§6.3 — หมายเหตุ
> ว่าจำนวน code ยังเป็น **18** และรายการ "ความหมายเปลี่ยน" + สิ่งที่ฝากถึง @qa ·
> **รายการ "สัญญาไม่เปลี่ยนแต่ความหมายเปลี่ยน" ฉบับเต็ม → [architecture.md §15](architecture.md)**

> สัญญาผ่าน OpenAPI (`packages/contracts/openapi/openapi.yaml`) — **seam กลาง FE↔BE** ·
> ตัดสินใจเชิงโครง: [architecture.md](architecture.md) · ชนิด/ข้อจำกัดของข้อมูล: [data-model.md](data-model.md) ·
> **รอบแก้ 2026-07-27 (amend #2):** ปรับตาม **D-027/D-028** + finding ของ [security-review.md](security-review.md) ·
> **รอบแก้ 2026-07-28 (amend #3 — รอบสุดท้าย):** รับคำตอบ consult ของ [ux-wireframe.md](ux-wireframe.md)
> และ [test-plan.md](test-plan.md) + **D-029** เข้า contract แล้ว (สรุปว่าใครตอบอะไร → §6)

## Contract summary (≤20 บรรทัด — ทีม consumer อ่านแค่ส่วนนี้)

1. **17 endpoint ใหม่** (amend #3 เพิ่ม 2: **`POST /orgs/{orgId}/tax-profile/reveal`** — ขอดู TIN เต็มแบบตั้งใจ · **`DELETE /orgs/{orgId}/membership`** — ออกจากร้านเอง, D-029) · ไม่แก้/ไม่ลบ endpoint เดิมของ F-001 แม้แต่เส้นเดียว (additive-only) — **แต่ `reset-password` ถูก *ลดความสามารถ* ที่ชั้น logic **2 เงื่อนไข** (D-028/C-2 = target อยู่หลาย org · **D-030/NEW-1 = target เป็น Owner แต่ผู้เรียกไม่มี `full_access`**): wire/status ไม่เปลี่ยน แต่เคสที่เคย 200 จะเป็น **404**
2. auth = `Authorization: Bearer <access>` เหมือนเดิม · org ส่งผ่าน **`X-Organization-Id`** (D-025) — endpoint ที่มี `{orgId}` ใน path จะรับจาก path ก็ได้ ถ้าส่งทั้งคู่ **ต้องตรงกัน** ไม่ตรง = **`422 ORG_MISMATCH`**
3. 3 กลุ่ม: **org-scoped** (`/orgs/{orgId}/**`) · **user-scoped** (`POST /organizations`, `GET /me/organizations`, `POST /invitations/accept`) · **public** (**`POST /invitations/preview`**)
4. error envelope เดิม `{ error: { code, message, details?, fieldErrors?, traceId? } }` map 1:1 กับ `ApiFailure` (D-025) — **code ใหม่ 18 ตัว** §4 · **`traceId` มีจริง *ทุก* error response** (schema ยัง optional เพื่อไม่ breaking — §1) · `message` ไทยใช้คำว่า **"ร้าน"** ให้ตรงจอ (D-029; identifier ยังเป็น `organization`)
5. list ทุกเส้น = cursor pagination `{ items, nextCursor, total? }` · `limit` default 25 max 100 · `?withTotal=true` ถึงจะได้ `total`
6. **ไม่ใช่สมาชิก / ถูกถอด → `403 ORG_ACCESS_DENIED`** (client พากลับหน้าเลือกร้าน + refetch `/me/organizations`) · **ขาดสิทธิ์ → `403 FORBIDDEN`** (อยู่หน้าเดิม แสดง toast) — **สอง code นี้ทำคนละอย่าง ห้ามรวม** (ux ยืนยันแล้ว)
7. **สร้าง org** ไม่มี field เลือก plan — server ผูกให้เอง · **cap 50 org/user (ยืนยันโดย D-029, env-tunable) → `409 ORG_LIMIT_REACHED`** · response `201` มีข้อมูลครบพอให้ client พาเข้าร้านใหม่ได้เลย ไม่ต้องยิง `/me/organizations` ซ้ำ
8. **เชิญสมาชิก** คืน `{ invitation, token, inviteUrl }` — **`token` แสดงครั้งนี้ครั้งเดียว** (เก็บเป็น hash, D-018) · **role ที่มี `full_access` เชิญได้เฉพาะ Owner** · **คำเชิญ role สูง (Owner/Admin) อายุ 24 ชม.** ที่เหลือ 7 วัน · **`expiresAt` เป็น field บังคับใน *ทุก* รูปของ Invitation** ⇒ UI ห้าม hardcode "7 วัน"
9. **"ส่งลิงก์อีกครั้ง" = `POST …/invitations/{id}/link`** → ได้ลิงก์ **ใหม่** (ลิงก์เดิมใช้ไม่ได้ทันที) และ **อายุนับใหม่จากเวลาที่ออกลิงก์** (D-027) ⚠️ ต้องมี copy เตือนใน UI · **เส้นนี้ติดกฎ Owner-only เหมือนตอนเชิญ (NEW-2): คำเชิญที่เป็น role `Owner` ออกลิงก์ใหม่ได้เฉพาะผู้มี `full_access` มิฉะนั้น `403 FORBIDDEN`**
10. **เชิญซ้ำคนที่มีคำเชิญค้าง → `409 INVITATION_PENDING` + `details.invitationId`** ⇒ UI เสนอ "ออกลิงก์ใหม่"/"ยกเลิก" ได้ทันที (D-027 — ห้ามปล่อยผู้ใช้ตัน)
11. **ถอดสมาชิก = `DELETE …/members/{userId}`** soft (status → `revoked`) · **ยกเลิกคำเชิญ `pending` ของ email นั้นให้อัตโนมัติ** (D-028) · org หายจาก `GET /me/organizations` ทันที · `?status=all` คืน **เฉพาะ id/ชื่อ/สถานะ** ของ org ที่ตนถูกถอดแล้ว
12. **ออกจากร้านเอง (D-029) = `DELETE /orgs/{orgId}/membership`** — **ไม่ต้องมี `manage_members`** (endpoint แยก ไม่มี `userId` ใน path ⇒ ชี้ไปที่คนอื่นไม่ได้เชิงโครงสร้าง) · ยังติดกฎ Owner คนสุดท้าย → `409 LAST_OWNER`
13. **Owner-only (D-028 + D-030):** เปลี่ยน role เป็น Owner / แก้-ถอด membership ที่เป็น Owner / **ออกลิงก์ใหม่ของคำเชิญ role Owner** = ต้องมี `full_access` มิฉะนั้น `403 FORBIDDEN` · **รีเซ็ตรหัสของสมาชิกที่เป็น Owner ก็ต้องมี `full_access`** (endpoint ของ F-001 — คืน `404` ตามแบบเดิมของเส้นนั้น) · Owner คนสุดท้าย → `409 LAST_OWNER`
14. **accept:** เป็นสมาชิก active อยู่แล้ว → `409 ALREADY_MEMBER` (ไม่ทับ role) · คำเชิญออกก่อนถูกถอด → `409 INVITATION_SUPERSEDED` · role ถูกลบ → `409 INVITATION_ROLE_UNAVAILABLE`
15. **PDPA (D-028 + ux Q13 ที่เข้มกว่า):** `GET /orgs/{orgId}/members` และ `/invitations` ต้องมี **`manage_members`** · **TIN เต็มออกทาง endpoint เดียวคือ `…/tax-profile/reveal`** (ไม่ติดมากับ `GET /orgs/{orgId}` อีกแล้ว) · **`taxIdMasked` ให้เฉพาะผู้มี `manage_org_settings`** · คนอื่นได้แค่ `vatRegistered` + `taxProfileComplete` (ไม่มีตัวเลขใด ๆ)
16. tax profile = **`PUT` ทั้งชุด** (กรอกครบหรือไม่กรอกเลย) · `taxProfileComplete` ให้ UI ใช้แสดงผล (การ **gate** จริงเป็นของ F-007)
17. **`roleKey` คู่กับ `roleName` เสมอ** (ux Q4) — system role = `owner|admin|staff` คงที่ตลอดอายุระบบ · role ที่ F-003 สร้างเอง = **`null`** ⇒ client ต้องรองรับ `null`/ค่าที่ไม่รู้จัก · **ห้ามใช้ `roleKey` ตัดสินสิทธิ์** (สิทธิ์ = capabilities เท่านั้น)
18. **token ไม่เดินทางใน query string:** preview เป็น **POST + body** · response ที่มี token/email/TIN มี `Cache-Control: no-store` + `Referrer-Policy: no-referrer`
19. rate limit: create org 10/ชม./user · invite 30/ชม./org · reissue 60/ชม./org · preview+accept 30/ชม./IP (IPv6 = /64) · **reveal TIN 20/ชม./user** → `429` + **`Retry-After` เป็นวินาที ≥ 1 เสมอ**
20. ยังไม่รองรับ `Idempotency-Key` (interceptor กลางเกิดที่ F-011) — UI ต้อง disable ปุ่มระหว่างรอ (cap ข้อ 7 กันความเสียหายระดับใหญ่แล้ว) · **เส้นที่คว้า org lock อาจคืน `409 CONFLICT` + `details.reason="busy"` เมื่อระบบกำลังประมวลผลคำขออื่นของร้านเดียวกัน (ชั่วคราว — ให้ผู้ใช้ลองใหม่; ไม่ใช่ 500) — architecture §5.2**

---

## §1 Conventions ที่ทุก endpoint ในเอกสารนี้ยึด

| หัวข้อ | กติกา |
|---|---|
| Auth | `Authorization: Bearer <accessToken>` (ยกเว้น `POST /invitations/preview`) — ไม่มี/หมดอายุ → `401 UNAUTHENTICATED` |
| Org context | `X-Organization-Id: <orgId>` (D-025) · endpoint ที่มี `{orgId}` ใน path ใช้ path แทนได้ · ส่งทั้งคู่แล้วไม่ตรง → **`422 ORG_MISMATCH`** · org-scoped ที่ไม่มีทั้งสองอย่าง → `422 ORG_CONTEXT_REQUIRED` · **route user-scoped/public จะเพิกเฉยต่อ header นี้ทั้งหมด** (architecture §1.1/I-3) |
| Cache / PII | response ที่มี **token / email / TIN** → `Cache-Control: no-store` + `Pragma: no-cache` เสมอ (§3.3, §3.7, §3.10–3.17) · route คำเชิญ + `…/tax-profile/reveal` ตั้ง `Referrer-Policy: no-referrer` · **ห้าม log query string ของ `/invitations/*`** (I-6) · **ตารางว่าเส้นไหนต้องมี header ใด export เป็น `RESPONSE_HEADER_POLICY` ให้เทสต์ import** (ไม่ให้ kit ประกาศซ้ำแล้ว drift — qa §19 ข้อ 4) |
| Content type | `application/json` เท่านั้นสำหรับ body method → มิฉะนั้น `415 UNSUPPORTED_MEDIA_TYPE` (pattern เดิมของ F-001) |
| Error | envelope เดียว `{ error: { code, message, details?, fieldErrors?, traceId? } }` · `message` = ไทย (**ใช้คำว่า "ร้าน" ให้ตรงจอ — D-029**; identifier/enum ยังเป็น `organization`) · client switch จาก **`code` เท่านั้น ห้าม parse `message`** |
| `traceId` | **มีเสมอทุก error response** (401/403/404/409/415/422/429/500) — ตอบ qa Q12 · **server เป็นคนออกค่าเสมอ** (ไม่รับค่าจาก client ⇒ ไม่ซ้ำข้าม request + ไม่มีทางถูกยัด PII) · **รูปแบบที่ pin ไว้ (NEW-7): UUID v4 สุ่ม opaque** — ⛔ ห้ามเรียงลำดับ/counter/timestamp และ **ห้ามฝังข้อมูลใด ๆ ของ request** (ค่าที่เดาได้ = บอกปริมาณทราฟฟิกและเดา traceId ของคนอื่นได้) · **`X-Request-Id` ใน response = ค่าที่ server ออก ไม่ใช่การสะท้อนค่าที่ client ส่งมา** — ค่าที่ client ส่งมาถูกเก็บเป็น `upstreamRequestId` **ในlog เท่านั้น** ไม่ขึ้น response ทั้ง body และ header · ค่าเดียวกันโผล่ใน log บรรทัดของ request นั้น · ใน OpenAPI **ยังประกาศเป็น optional** (ไม่ทำให้ client เดิม breaking) — บังคับที่ **พฤติกรรม + test** |
| Lock contention *(amend #4 · NEW-4)* | endpoint ที่ **เขียน membership/invitation** (§3.8 · §3.9 · §3.11 · §3.12 · §3.13 · §3.15 · §3.17) ทำงานใน tx ที่คว้า row lock ของร้าน · ถ้าแย่ง lock จนเกินเพดานเวลา หรือเกิด deadlock → **`409 CONFLICT` + `details.reason = "busy"`** (**ไม่ใช่ `500` และไม่ใช่การค้างรอ**) · ค่าเพดาน + การแมป error → [architecture §5.2](architecture.md) · **client:** ปฏิบัติเหมือน Conflict ทั่วไปได้ (ให้ผู้ใช้ลองใหม่) — ไม่ต้องรู้จัก `reason` ก็ทำงานถูก · **server ไม่ retry ให้เอง** (ยังไม่มี `Idempotency-Key` — F-011) |
| Rate limit header | `Retry-After` เป็น **จำนวนวินาที integer ≥ 1 เสมอ** (ปัดขึ้น ห้ามเป็น `0`/ทศนิยม/รูปแบบวันที่) — mobile ใช้คำนวณ backoff |
| Validation | ผิดรูปฟอร์ม → `422` + `fieldErrors` ราย field (เช่น `{ "taxId": "เลขผู้เสียภาษีไม่ถูกต้อง" }`) |
| Pagination | `?cursor=<opaque>&limit=25[&withTotal=true]` → `{ items, nextCursor, total? }` · `nextCursor: null` = หมดแล้ว · cursor เป็น opaque base64 **ห้าม client แกะ** |
| Sort | ทุก list เรียง `createdAt desc, id desc` (คงที่ ไม่ให้ client เลือกใน F-002) |
| เวลา | ISO-8601 UTC (`2026-07-27T09:00:00.000Z`) — client แปลงเป็น Asia/Bangkok เอง |
| Rate limit | เกิน → `429 RATE_LIMITED` + header `Retry-After` (วินาที) |

---

## §2 ตาราง endpoint

| # | Method | Path | คำอธิบาย | Scope | Permission |
|---|---|---|---|---|---|
| 1 | POST | `/organizations` | สร้างองค์กร (US-1) | user | login แล้ว |
| 2 | GET | `/me/organizations` | รายการ org ที่ตนเป็นสมาชิก (US-2) | user | login แล้ว |
| 3 | GET | `/orgs/{orgId}` | โปรไฟล์ org + plan + tax profile | org | สมาชิก active |
| 4 | PATCH | `/orgs/{orgId}` | แก้ชื่อ/โลโก้/timezone | org | `manage_org_settings` |
| 5 | PUT | `/orgs/{orgId}/tax-profile` | ประกาศนิติฐานะ/TIN (US-7) | org | `manage_org_settings` |
| **5b** | **POST** | `/orgs/{orgId}/tax-profile/reveal` | **ขอดูเลขผู้เสียภาษีเต็มแบบตั้งใจ** (§3.16 — ux Q7/Q13) | org | `manage_org_settings` |
| 6 | GET | `/orgs/{orgId}/roles` | รายการ role (ให้ dropdown ตอนเชิญ) | org | สมาชิก active |
| 7 | GET | `/orgs/{orgId}/members` | รายชื่อสมาชิก + สถานะ + role (US-5) | org | **`manage_members`** (D-028 — email = PII) |
| 8 | PATCH | `/orgs/{orgId}/members/{userId}` | เปลี่ยน role (รวมยกเป็น Owner — US-6) | org | `manage_members` **+ Owner-only ถ้าแตะ/มอบ Owner** |
| 9 | DELETE | `/orgs/{orgId}/members/{userId}` | ถอดสมาชิก**คนอื่น** (soft → `revoked`, US-5) + ยกเลิกคำเชิญค้างของ email นั้น | org | `manage_members` **+ Owner-only ถ้า target เป็น Owner** |
| **9b** | **DELETE** | `/orgs/{orgId}/membership` | **ออกจากร้านด้วยตัวเอง** (US-5/D-029) — target = ผู้เรียกเสมอ | org | **สมาชิก active คนไหนก็ได้** (`@AnyActiveMember()` — ไม่ต้องมี `manage_members`) |
| 10 | GET | `/orgs/{orgId}/invitations` | รายการคำเชิญ | org | `manage_members` |
| 11 | POST | `/orgs/{orgId}/invitations` | เชิญสมาชิก + ได้ลิงก์ (US-3) | org | `manage_members` **+ Owner-only ถ้าเชิญด้วย role Owner** |
| 12 | POST | `/orgs/{orgId}/invitations/{invitationId}/link` | ออกลิงก์ใหม่ (rotate token, **อายุนับใหม่** — D-027) | org | `manage_members` **+ Owner-only ถ้าคำเชิญใบนั้นเป็น role ที่มี `full_access`** (NEW-2) |
| 13 | DELETE | `/orgs/{orgId}/invitations/{invitationId}` | ยกเลิกคำเชิญที่ค้าง | org | `manage_members` |
| 14 | **POST** | `/invitations/preview` | ดูรายละเอียดคำเชิญก่อนสมัคร/รับ (US-4) — **token อยู่ใน body** (I-6) | public | — (rate-limited) |
| 15 | POST | `/invitations/accept` | กดรับคำเชิญ (US-4) | user | login แล้ว |

> **endpoint เดิมของ F-001 — wire ไม่เปลี่ยน แต่พฤติกรรมแคบลง (2 เงื่อนไข):** `POST /orgs/{orgId}/members/{userId}/reset-password`
> คง capability check inline + **404-never-403** เหมือนเดิมทุกประการ · **เงื่อนไขปฏิเสธที่ 1 (D-028/C-2):** target
> มี `Membership status=active` ใน **org อื่น** ด้วย · **เงื่อนไขปฏิเสธที่ 2 (D-030/NEW-1):** **target เป็น Owner
> (role มี `full_access`) และผู้เรียกไม่มี `full_access`** — ทั้งคู่คืน **404 รูปเดิม** (ไม่มี code/status ใหม่,
> `oasdiff` ไม่เห็นการเปลี่ยนแปลง; ผู้เรียกแยกไม่ออกว่าถูกปฏิเสธด้วยเหตุใด — เจตนา)
> · FE/QA ต้องรู้: เคสที่เคยได้ 200 (พนักงานที่เป็นสมาชิกหลาย org · **Admin รีเซ็ตรหัสให้ Owner**) จะกลายเป็น 404
> — รายละเอียด architecture §3.3 · **ผลที่ user รับแล้ว (D-030): ร้านที่มี Owner คนเดียวแล้วลืมรหัสจะกู้เองไม่ได้จนกว่าจะมี F-081**

---

## §3 รายละเอียดต่อ endpoint

### 3.1 `POST /organizations` — สร้างองค์กร (US-1)

```jsonc
// request
{ "name": "ร้านตัวอย่าง", "timezone": "Asia/Bangkok" }   // timezone optional (default Asia/Bangkok)
// 201
{
  "organization": {
    "id": "org_...", "name": "ร้านตัวอย่าง", "logo": null,
    "timezone": "Asia/Bangkok", "currency": "THB",
    "taxProfileComplete": false, "createdAt": "…"
  },
  "membership": { "userId": "usr_…", "roleId": "rol_…", "roleName": "Owner", "roleKey": "owner", "status": "active" },
  "entitlement": { "planKey": "comp_full", "tierLabel": "Full (comp)" },
  "defaultWarehouse": { "id": "wh_…", "name": "คลังหลัก" }
}
```
- **ตอบ ux Q5 — ยืนยันว่า `201` พอสำหรับพาเข้าร้านใหม่ทันที:** มีครบทั้งตัวร้าน (id/ชื่อ/logo/timezone/currency),
  membership + role ของผู้สร้าง, entitlement และคลังตั้งต้น ⇒ client **seed cache ของร้านนั้นจาก response นี้ได้เลย**
  แล้วค่อย invalidate รายการร้าน (ไม่ต้องยิง `GET /me/organizations` ซ้ำก่อนเข้า)
- **ไม่มี field เลือก plan** — server ผูกให้เอง (AC US-1; architecture §6.2)
- `name`: 1–120 ตัวอักษร (ไม่ unique — ร้านชื่อซ้ำได้)
- `currency` fix `THB` (D-013 THB-only) — ไม่รับจาก client
- errors: `422 VALIDATION_FAILED` (fieldErrors.name) · `429 RATE_LIMITED` (10/ชม./user) ·
  **`409 ORG_LIMIT_REACHED`** (เป็นสมาชิก active ครบ 50 org แล้ว — cap fail-closed, architecture §6.3 ·
  `details: { limit: 50 }` ให้ UI แสดงข้อความที่มีตัวเลขจริง) ·
  `503 ORG_PROVISIONING_UNAVAILABLE` (ระบบยังไม่ได้ผูก plan ตั้งต้น — ไม่ใช่ความผิด user, ให้ติดต่อทีม)

### 3.2 `GET /me/organizations` — รายการ org ของฉัน (US-2)

`?cursor&limit&status=active|all` (default `active`)
```jsonc
// status=active (default) — รูปเต็ม
{ "items": [ {
    "organization": { "id": "org_…", "name": "ร้าน A", "logo": null },
    "membership": { "roleId": "rol_…", "roleName": "Owner", "roleKey": "owner", "status": "active" },
    "entitlement": { "planKey": "comp_full", "tierLabel": "Full (comp)" }
  } ], "nextCursor": null }

// status=all — org ที่ตนถูกถอดแล้วคืน "รูปย่อ" เท่านั้น (M-10)
{ "items": [ {
    "organization": { "id": "org_…", "name": "ร้าน B", "logo": null },
    "membership": { "status": "revoked", "revokedAt": "…" }      // ไม่มี roleId/roleName/roleKey, ไม่มี entitlement
  } ], "nextCursor": null }
```
- **AC US-5 (D-027): org ที่ถูกถอดต้องหายจากผลลัพธ์ default ทันทีที่ถูกถอด** — ไม่มี cache, ไม่มี job (architecture §4)
  ⇒ client ที่ได้ `403 ORG_ACCESS_DENIED` ควร refetch endpoint นี้แล้วอัปเดต switcher
- สมาชิกที่ถูกถอดจาก org หนึ่ง **ยังเห็น org อื่น**ตามปกติ (AC US-5)
- **M-10 — ทำไม `status=all` ถึงคืนรูปย่อ:** role/entitlement คือข้อมูล**ภายในของ org ที่ผู้ใช้ไม่ได้เป็นสมาชิกแล้ว**
  ไม่มีเหตุผลทาง UX ใดที่ต้องรู้ว่า "ตอนถูกถอด ตนเป็น role อะไร / org นั้นใช้ plan อะไร" · คืน id/ชื่อ/สถานะ
  ก็พอสำหรับหน้า "ประวัติองค์กรที่เคยสังกัด" ถ้า ux ต้องการทำ
- ใช้เป็นแหล่งข้อมูลของ **org switcher** ทั้ง web และ mobile

### 3.3 `GET /orgs/{orgId}` — โปรไฟล์องค์กร

```jsonc
// ผู้เรียกที่มี manage_org_settings — ได้ "รูปย่อของ TIN" เท่านั้น (ไม่มีเลขเต็ม ดู §3.16)
{
  "id": "org_…", "name": "ร้าน A", "logo": null, "timezone": "Asia/Bangkok", "currency": "THB",
  "taxProfile": { "entityType": "company", "taxIdMasked": "•••••••••4567",
                  "vatRegistered": true, "branchCode": "00000" },
  "taxProfileComplete": true,
  "entitlement": { "planKey": "comp_full", "tierLabel": "Full (comp)" },
  "myMembership": { "roleId": "rol_…", "roleName": "Owner", "roleKey": "owner",
                    "capabilities": ["full_access"], "status": "active" },
  "counts": { "activeMembers": 4, "pendingInvitations": 1 }
}

// ผู้เรียกที่ไม่มี manage_org_settings — **ไม่มีตัวเลขใด ๆ เลย** (ไม่มีทั้ง taxId และ taxIdMasked)
{ "…": "…",
  "taxProfile": { "vatRegistered": true },     // มีแค่ field เดียว — ไม่มี entityType/branchCode/tax id ทุกรูป
  "taxProfileComplete": true }
```
- `taxProfile` = `null` ถ้ายังไม่ประกาศ (ทุกระดับสิทธิ์) · `myMembership.capabilities` ให้ client ซ่อน/แสดงปุ่มได้
  (**ยังไม่ใช่การ enforce** — enforce อยู่ที่ server เสมอ)
- **field-level authorization (D-028/I-8 + ux Q13 ซึ่งเข้มกว่า D-028) — รูปสุดท้าย 3 ระดับ:**

  | ผู้เรียก | ได้อะไรใน `taxProfile` |
  |---|---|
  | มี `manage_org_settings` | `entityType` · **`taxIdMasked`** (4 ตัวท้าย) · `vatRegistered` · `branchCode` |
  | สมาชิก active อื่น (เช่น Staff) | **`vatRegistered` เท่านั้น** — ไม่มี `taxIdMasked`, ไม่มี `entityType`, ไม่มี `branchCode` |
  | ทุกคน | `taxProfileComplete` (bool) ที่ระดับ root |

  - **เลขเต็ม 13 หลักไม่เดินทางมากับ endpoint นี้อีกต่อไป** — ต้องขอทาง **`POST …/tax-profile/reveal` (§3.16)**
    ⇒ การเปิดดู TIN กลายเป็น *การกระทำที่ตั้งใจและถูกบันทึก* ไม่ใช่ผลข้างเคียงของการเปิดหน้าจอ
  - เหตุผลที่ Staff ไม่ได้แม้แต่ 4 ตัวท้าย (ux ตัดสิน, backend รับ): `entityType="personal"` ⇒ TIN = **เลขบัตรประชาชน
    ของเจ้าของร้าน** และ 4 ตัวท้ายของเลขบัตรยังใช้ยืนยันตัวตนได้ในหลายบริการ · พนักงานไม่มีงานที่ต้องใช้เลขนี้เลย
  - **สัญญาต่อ FE:** ทุก field ใน `taxProfile` เป็น **optional** ใน schema — client ต้องทำงานได้เมื่อไม่มี ·
    **ห้าม** ตีความว่า "ไม่มี `taxIdMasked` = ยังไม่ประกาศ" → ใช้ `taxProfileComplete` ตัดสินเรื่องนั้นเสมอ
  - `Cache-Control: no-store` บน response นี้เสมอ (มี PII: ชื่อร้าน + สถานะภาษี)
- `counts` เป็นตัวเลขรวม ไม่ใช่รายชื่อ ⇒ สมาชิกทุกคนเห็นได้ (ไม่ขัด PDPA ข้อ 15 ของ contract summary)

### 3.4 `PATCH /orgs/{orgId}` — แก้โปรไฟล์
body: `{ name?, logo?, timezone? }` → 200 คืนรูปเดียวกับ §3.3 · `manage_org_settings` · errors: `403 FORBIDDEN`, `422`
- **`logo` ไม่ใช่ string อิสระ (M-4):** รับได้เฉพาะ (ก) `null` (ลบโลโก้) (ข) **object key ที่ระบบเราออกให้** จาก
  storage ของเราเอง (F-040) — Phase 0 ที่ยังไม่มี upload flow ⇒ **รับเฉพาะ `null`** และ field นี้เป็น read-only
  จนกว่า F-040 จะมา · **ห้ามรับ URL ภายนอก** เพราะผู้มี `manage_org_settings` จะตั้ง tracking pixel / ภาพไม่พึงประสงค์
  ให้สมาชิกทุกคนโหลดโดยไม่รู้ตัว (และ server-side fetch ในอนาคต = SSRF)
- validation: `422 VALIDATION_FAILED` + `fieldErrors.logo` = "ยังไม่รองรับการตั้งโลโก้ในเวอร์ชันนี้"
- `timezone` = IANA tz ที่รู้จักเท่านั้น (whitelist จาก `Intl.supportedValuesOf('timeZone')`) · `name` 1–120 ตัวอักษร

### 3.5 `PUT /orgs/{orgId}/tax-profile` — ประกาศนิติฐานะ (US-7)

```jsonc
// request — ครบชุดหรือไม่ส่งเลย (ไม่มีการกรอกครึ่ง ๆ)
{ "entityType": "company", "taxId": "0105551234567", "vatRegistered": true, "branchCode": "00000" }
// 200 → org object (§3.3) พร้อม taxProfileComplete: true
```
- `entityType`: `personal | company` · `taxId`: 13 หลัก + **checksum** (data-model §6) · `branchCode`: 5 หลัก (optional, `"00000"` = สำนักงานใหญ่)
- **response ไม่สะท้อนค่า `taxId` ที่เพิ่งส่งมากลับไป** — ใช้กติกาเดียวกับ §3.3 ทุกประการ (ได้ `taxIdMasked`) ·
  เหตุผล: ผู้เรียกเป็นคนพิมพ์ค่านั้นเองอยู่แล้ว การส่งกลับมาไม่เพิ่มประโยชน์ แต่เพิ่มจำนวนที่ที่ TIN เต็มไปโผล่ ·
  `Cache-Control: no-store` · **ห้าม log ค่า `taxId` ทุกกรณี** — security event เก็บแค่ `taxIdPresent`/`entityType` (architecture §9)
- errors: `422 TAX_ID_INVALID` + `fieldErrors.taxId` · `403 FORBIDDEN`
- **F-002 ไม่ทำ tier gating** — "ยังไม่ประกาศ TIN → ใช้ได้เฉพาะ Sync tier" (AC US-7) บังคับใช้จริงที่ **F-007**
  ผ่าน `entitled('accounting')` ที่อ่าน `taxProfileComplete` — F-002 มีหน้าที่เก็บข้อมูล + เปิด flag เท่านั้น

### 3.6 `GET /orgs/{orgId}/roles`
```jsonc
{ "items": [ { "id": "rol_…", "key": "owner", "name": "Owner", "isSystem": true },
             { "id": "rol_…", "key": "admin", "name": "Admin", "isSystem": false },
             { "id": "rol_…", "key": "staff", "name": "Staff", "isSystem": false } ], "nextCursor": null }
```
read-only ใน F-002 (F-003 เพิ่ม create/update/delete + capabilities) — มีเพื่อให้ **AC US-3 "บังคับเลือก role ตอนเชิญ"** ทำได้จริง

> **`key` — field ใหม่จาก ux Q4 (รับเข้า contract แล้ว):** UI ห้ามโชว์คำอังกฤษ "Owner/Admin/Staff" ให้ SME ⇒ ต้อง map
> เป็น "เจ้าของร้าน/ผู้ดูแล/พนักงาน" · การ map จาก `name` เปราะเพราะ F-003 จะเปิดให้เปลี่ยนชื่อ role ⇒ ให้ **key ที่นิ่ง**
> - **ค่าที่รับประกัน:** role ที่ระบบสร้างตอนสร้างร้าน = **`owner` · `admin` · `staff`** (ค่าคงที่ตลอดอายุระบบ —
>   เป็นส่วนหนึ่งของ contract, เปลี่ยนค่าถือเป็น breaking change)
> - **role ที่ F-003 สร้างเอง (custom) → `key: null`** — เพราะ key เป็น namespace ของระบบ ไม่ใช่ของผู้ใช้
>   (ให้ผู้ใช้ตั้ง slug เอง = ชนกับค่าสงวน + กลายเป็น identifier ที่ผู้ใช้แก้ได้ = ของที่ client เผลอเชื่อ)
> - **สัญญาต่อ client:** `key` เป็น `string | null` และเป็น **open set** — เจอ `null` หรือค่าที่ไม่รู้จัก **ต้อง fallback
>   ไปแสดง `name` ตรง ๆ** (ทางที่ ux เขียนไว้เป็น fallback อยู่แล้ว) ห้าม `switch` แบบไม่มี default
> - ⛔ **ห้ามใช้ `key` ตัดสินสิทธิ์ทั้ง client และ server** — "เป็น Owner ไหม" ตัดสินจาก **capabilities (`full_access`)
>   เท่านั้น** (architecture §3.2 / data-model §5.2) · `key` มีไว้เพื่อ **แปลคำบนจอ** ล้วน ๆ

### 3.7 `GET /orgs/{orgId}/members` — รายชื่อสมาชิก (US-5)

`?cursor&limit&status=active|revoked|all` (default `all`) · **ต้องมี `manage_members`** (D-028/I-8/N-4)
```jsonc
{ "items": [ {
    "userId": "usr_…", "email": "somchai@example.com",
    "roleId": "rol_…", "roleName": "Admin", "roleKey": "admin",
    "status": "active", "activatedAt": "…", "revokedAt": null, "createdAt": "…",
    "isMe": false, "isOwner": true
  } ], "nextCursor": null }
```
- **สิทธิ์อ่าน = `manage_members`** (ตอบ Q2 เดิมด้วย D-028): รายชื่อ + **email ของทุกคนในองค์กร** เป็น PII ตาม PDPA
  ไม่ใช่การตัดสินเชิง UX ⇒ Staff เรียกได้ `403 FORBIDDEN` · ถ้าจอไหนต้องแสดง "ใครทำรายการนี้" ให้ใช้ชื่อ/ID
  ที่มากับ resource นั้น ๆ ไม่ใช่ดึงทั้ง directory
- `isOwner` = role ของแถวนั้นมี `full_access` — ให้ UI ซ่อนปุ่ม "เปลี่ยน role/ถอด" เมื่อผู้เรียกไม่ใช่ Owner (C-1;
  **การ enforce จริงอยู่ที่ server เสมอ**)
- **`status=invited` ถูกตัดออกจากตัวเลือก** — flow ของเราสร้าง membership ตอน **accept** เท่านั้น ⇒ `invited`
  เป็น dead state (data-model §7) · "คนที่ถูกเชิญแต่ยังไม่รับ" อยู่ที่ **§3.10 invitations**
- **ตอบ ux Q1 (ปิดแล้ว — ไม่มี endpoint รวม):** จอสมาชิกเป็น **จอเดียว 2 ส่วน** โดย FE ยิง **2 endpoint นี้แยกกัน**
  (`/members` + `/invitations`) และ **ไม่ merge เป็น list เดียว** · ผมไม่สร้าง endpoint รวมตามที่เคยเสนอไว้ —
  เหตุผลที่ ux ให้และผมเห็นด้วย: สองแหล่งมี **สถานะและการกระทำคนละชุด** (ออกลิงก์ใหม่/ยกเลิก vs เปลี่ยนสิทธิ์/ถอด)
  ⇒ endpoint รวมจะได้ row polymorphic ที่ทั้งสองฝั่งต้องแตกเคสอยู่ดี · แต่ละส่วนมี cursor + สถานะ error ของตัวเอง
- `Cache-Control: no-store` (มี email — M-11)

### 3.8 `PATCH /orgs/{orgId}/members/{userId}` — เปลี่ยน role (US-6)

body `{ "roleId": "rol_…" }` → 200 คืนแถวสมาชิกรูปเดียวกับ §3.7
- `manage_members` · ทำกับตัวเองได้ (เช่น Owner ลดตัวเองหลังตั้ง Owner คนใหม่)
- **Owner-only (D-028/C-1):** ต้องมี `full_access` ถ้า (ก) role ใหม่มี `full_access` (ยกใครเป็น Owner รวมทั้งตัวเอง)
  **หรือ** (ข) role ปัจจุบันของ target มี `full_access` (แก้ Owner) → ไม่ผ่าน = `403 FORBIDDEN`
  · ตรวจด้วย pure fn `canAssignRole()` ใน tx เดียวกับ row lock (architecture §3.2)
- **target ต้องเป็น membership `status=active`** — ถ้าถูกถอดไปแล้ว (รวมกรณีถูกถอดโดยอีก request ที่ชนกัน) → `404 NOT_FOUND`
  · การตรวจนี้เกิด **ในทรานแซกชันหลังคว้า org lock** ไม่ใช่ก่อนเข้า tx (architecture §5 — เคส `PATCH ‖ DELETE`)
- errors: `403 FORBIDDEN` (ขาด capability **หรือ** ผิดกฎ Owner-only) · `409 LAST_OWNER` (จะเหลือ owner active 0 คน) ·
  `422 ROLE_INVALID` (roleId ไม่ใช่ของ org นี้) · `404 NOT_FOUND` (ไม่ใช่สมาชิก active ของ org นี้)

### 3.9 `DELETE /orgs/{orgId}/members/{userId}` — ถอดสมาชิก (US-5)

200 → `{ "userId": "…", "status": "revoked", "revokedAt": "…", "cancelledInvitations": 1 }`
- **soft delete**: ไม่ลบ user ไม่ลบ membership → ประวัติเก่า (ledger/audit) ไม่พัง (กฎทอง 2)
- **ยกเลิกคำเชิญค้างของ email นั้นใน org เดียวกันโดยอัตโนมัติ ใน transaction เดียวกัน** (D-028/I-1) —
  `cancelledInvitations` = จำนวนใบที่ถูกยกเลิก (ปกติ 0 หรือ 1) ให้ UI แจ้งผู้ใช้ได้ว่า "คำเชิญที่ค้างถูกยกเลิกด้วย"
- ผลทันที: request ถัดไปของ org นี้จาก user คนนั้น = **`403 ORG_ACCESS_DENIED`** · org นั้นหายจาก
  `GET /me/organizations` ทันที · **session/ล็อกอินไม่ถูกทำลาย** และ org อื่นไม่กระทบ (architecture §4)
- **Owner-only (D-028/C-1):** ถอด membership ที่ปัจจุบันเป็น Owner ต้องมี `full_access` → ไม่ผ่าน = `403 FORBIDDEN`
- **ถอดตัวเองผ่านเส้นนี้ได้เฉพาะผู้ที่มี `manage_members` อยู่แล้ว** — สมาชิกทั่วไปที่อยากออกจากร้านเองใช้ **§3.17**
  (D-029; เส้นนี้ไม่ได้ผ่อน authz ให้ใครทั้งสิ้น)
- **idempotency ภายใต้การชนกัน:** ทำงานใน tx ที่คว้า org lock เป็นบรรทัดแรก แล้ว **อ่านสถานะ target ซ้ำใน tx** ⇒
  `revoke ‖ revoke` บนคนเดียวกัน = สำเร็จ 1 (200) · อีก request ได้ **`404 NOT_FOUND`** (ไม่ใช่ 500 และ `revokedAt`
  ถูกเขียนครั้งเดียว) — ux map 404 เป็น toast "คนนี้ไม่ได้เป็นสมาชิกของร้านนี้แล้ว" + refetch อยู่แล้ว
- errors: `403 FORBIDDEN` · `409 LAST_OWNER` · `404 NOT_FOUND`

### 3.10 `GET /orgs/{orgId}/invitations`

`?cursor&limit&status=pending|accepted|cancelled|expired|all` (default `pending`)
```jsonc
{ "items": [ {
    "id": "inv_…", "email": "new@example.com", "roleId": "rol_…", "roleName": "Staff", "roleKey": "staff",
    "status": "pending", "expiresAt": "…", "tokenIssuedAt": "…",
    "invitedByUserId": "usr_…", "createdAt": "…",
    // เฉพาะใบที่ status = accepted (D-028/I-7 — ให้ผู้เชิญเห็นว่า "ใครรับไปแล้วเมื่อไหร่")
    "acceptedAt": null, "acceptedByUserId": null, "acceptedUserCreatedAfterInvite": null
  } ], "nextCursor": null }
```
- **ไม่คืน token/ลิงก์ใน list** (ไม่มีทางคืนได้ด้วย — เก็บเป็น hash) → ต้องกด §3.12 เพื่อได้ลิงก์
- **`expiresAt` เป็น field บังคับ (non-null) ในทุกแถว** รวมใบที่ `accepted`/`cancelled`/หมดอายุ — ตอบ ux Q14:
  UI คำนวณ "อีกประมาณ N ชั่วโมง" จากค่านี้เสมอ และไม่มีเคสที่ต้องเดา
- `acceptedUserCreatedAfterInvite` (bool) = บัญชีที่กดรับ **ถูกสร้างหลัง `invitation.createdAt`** (เวลาที่คำเชิญใบนี้
  ถูกสร้าง**ครั้งแรก**) หรือไม่ · ⚠️ **แก้นิยามใน amend #4 (NEW-9): เดิมเทียบกับ `tokenIssuedAt` ซึ่ง "ออกลิงก์ใหม่"
  เขียนทับเป็น `now`** ⇒ เพียงกดออกลิงก์ใหม่ก็ทำให้ธงกลายเป็น `false` = ล้างสัญญาณ forensic ตัวเดียวที่เรามี ·
  ชนิด/ชื่อ field ไม่เปลี่ยน (ธงจะเป็น `true` ในเคสที่มากกว่าเดิม) —
  สัญญาณเดียวที่เรามีใน Phase 0 ว่า "ลิงก์อาจถูกใครเอาไปสมัครใหม่แล้วรับแทน" (ยืนยัน email ไม่ได้จนถึง F-081 —
  architecture §7.6) · UI ควรแสดงเป็นธงเตือนเบา ๆ ไม่ใช่คำกล่าวหา
- `Cache-Control: no-store` (มี email)

### 3.11 `POST /orgs/{orgId}/invitations` — เชิญสมาชิก (US-3, D-012)

```jsonc
// request
{ "email": "New@Example.com ", "roleId": "rol_…" }     // server normalize: lowercase + trim
// 201
{
  "invitation": { "id": "inv_…", "email": "new@example.com",
                  "roleId": "rol_…", "roleName": "Staff", "roleKey": "staff",
                  "status": "pending", "expiresAt": "2026-08-03T…Z", "tokenIssuedAt": "2026-07-28T…Z" },
  "token": "9f2b…",                                     // ⚠️ แสดงครั้งเดียว — เก็บเป็น hash (D-018)
  "inviteUrl": "https://app.example.com/invite?token=9f2b…"
}
```
- `roleId` **บังคับ** (AC US-3) · **อายุ: 7 วัน ปกติ / 24 ชม. ถ้า role ที่เชิญมี `full_access` หรือ `manage_members`**
  (D-028/I-7) → **UI ต้องอ่านค่า `expiresAt` จริงเสมอ ห้าม hardcode "7 วัน" ในข้อความ**
- **Owner-only (D-028/C-1):** เชิญด้วย role ที่มี `full_access` ต้องมี `full_access` → ไม่ผ่าน = `403 FORBIDDEN`
- **`409 INVITATION_PENDING` ต้องพาผู้ใช้ออกจากทางตัน (D-027):**
  ```jsonc
  { "error": { "code": "INVITATION_PENDING",
               "message": "อีเมลนี้มีคำเชิญค้างอยู่แล้ว",
               "details": { "invitationId": "inv_…", "expiresAt": "…", "roleId": "rol_…", "roleName": "Staff" } } }
  ```
  ⇒ UI เสนอได้ทันทีว่า "ออกลิงก์ใหม่" (§3.12 ด้วย `invitationId` นี้) หรือ "ยกเลิกคำเชิญ" (§3.13)
- errors: `409 ALREADY_MEMBER` · `409 INVITATION_PENDING` (+`details.invitationId`) ·
  `409 INVITATION_LIMIT_REACHED` (**pending ที่ยังไม่หมดอายุ** > 100 — M-3) · `422 VALIDATION_FAILED` (`fieldErrors.email`) ·
  `422 ROLE_INVALID` · `429 RATE_LIMITED` · `403 FORBIDDEN` (capability หรือ Owner-only)
- **ไม่มีการส่ง email** (D-012) — UI ต้องมีปุ่มคัดลอกลิงก์ให้ผู้ใช้ส่งเอง
- `Cache-Control: no-store` + `Referrer-Policy: no-referrer` (มี token)

### 3.12 `POST /orgs/{orgId}/invitations/{invitationId}/link` — ออกลิงก์ใหม่

```jsonc
// 200
{ "token": "a71c…", "inviteUrl": "https://app.example.com/invite?token=a71c…",
  "expiresAt": "2026-08-04T…Z", "tokenIssuedAt": "2026-07-28T…Z", "rotated": true }
```
- ⚠️ **ลิงก์เดิมใช้ไม่ได้ทันทีหลังเรียก** · **`expiresAt` นับใหม่จากเวลาที่ออกลิงก์** = `now + TTL(role)`
  (7 วัน ปกติ / 24 ชม. สำหรับ role สูง) — **D-027 (เปลี่ยนจากร่างแรกที่คงอายุเดิม)**
- เหตุผล + ทางเลือกที่เทียบแล้ว: architecture §7 (D-018 hash-at-rest ทำให้คืน token เดิมไม่ได้) ·
  เหตุผลที่ user เลือก "นับใหม่": สอดคล้องกับ reissue ตอนหมดอายุ + เลี่ยงเคส "ลิงก์ใหม่เหลืออายุ 4 ชม."
- email/role ของคำเชิญ **ไม่เปลี่ยน** · ทุกครั้ง emit `org.invitation.link_reissued` (สืบเคสลิงก์หลุด)
- **Owner-only เหมือนตอนเชิญ (NEW-2 · amend #4):** ถ้า role ของคำเชิญใบนั้นมี `full_access` ผู้เรียกต้องมี
  `full_access` ด้วย มิฉะนั้น **`403 FORBIDDEN`** — ตรวจด้วย `canAssignRole()` **ในtx เดียวกับ org lock**
  (อ่าน role ของคำเชิญผ่าน `tx`) · เหตุผล: ถ้าไม่คุมเส้นนี้ ผู้มี `manage_members` จะ **ทำสำเนากุญแจของประตู Owner**
  ได้ไม่จำกัด (D-027 ทำให้อายุนับใหม่ทุกครั้ง) = กฎ Owner-only ของ D-028 ถูกอ้อมทั้งดุ้น
- **คำเชิญที่หมดอายุแล้วยัง reissue ได้** (สถานะที่เก็บยังเป็น `pending`) — เจตนา: ไม่สร้างทางตันบนจอ และเมื่อมี
  Owner-only ที่เส้นนี้แล้ว การปิดเพิ่มไม่ได้ความปลอดภัยเพิ่ม (เหตุผลเต็ม architecture §3.2 ท้าย NEW-2) ·
  TTL ถูกคำนวณใหม่จาก capability ของ role เสมอ ⇒ คำเชิญ role สูงยืดได้ทีละ 24 ชม.
- **UI:** ต้องมี dialog ยืนยันก่อนกด และ**ห้าม**ใช้คำว่า "คัดลอกลิงก์เดิม" (AC US-3/D-027)
- errors: `409 CONFLICT` (คำเชิญไม่ได้อยู่สถานะ pending — **หรือระบบกำลังประมวลผลคำขออื่นของร้านนี้: `details.reason="busy"`**) ·
  `404 NOT_FOUND` · `429` · `403 FORBIDDEN` (capability **หรือ Owner-only**)
- `Cache-Control: no-store` + `Referrer-Policy: no-referrer`

### 3.13 `DELETE /orgs/{orgId}/invitations/{invitationId}` — ยกเลิก
200 → `{ "id": "inv_…", "status": "cancelled" }` · ลิงก์ที่ส่งไปแล้วใช้ไม่ได้ทันที ·
errors: `409 CONFLICT` (ไม่ได้ pending) · `404 NOT_FOUND` · `403 FORBIDDEN`

### 3.14 `POST /invitations/preview` — ดูก่อนรับ (public, US-4)

```jsonc
// request  ← token อยู่ใน body ไม่ใช่ query string (I-6)
{ "token": "9f2b…" }
// 200
{ "organizationName": "ร้าน A", "roleName": "Staff", "roleKey": "staff",
  "emailMasked": "n***@example.com", "expiresAt": "…", "status": "pending" }
```
- **เปลี่ยนจาก `GET …?token=` เป็น `POST` + body (I-6)** — token คือความลับตัวเดียวที่กันคนนอกออกจาก org
  ⇒ ห้ามให้มันไปอยู่ใน access log / proxy log / `Referer` ของ request ที่ browser ยิงต่อ ·
  ผลข้าง ๆ ที่ได้ฟรี: response ไม่ถูก cache โดยธรรมชาติ
- **ไม่ต้อง login** — จอ `/invite?token=` เรียกก่อนตัดสินใจว่าจะ login หรือ signup ·
  **@frontend ★:** อ่าน token จาก URL แล้ว `history.replaceState` ถอดออกทันที + เก็บไว้ใน memory (ไม่ใช่ localStorage)
- ไม่คืน `organizationId`, ไม่คืน email เต็ม, ไม่คืนรายชื่อสมาชิก · header: `Cache-Control: no-store` + `Referrer-Policy: no-referrer`
- errors: `404 INVITATION_INVALID` (token ไม่รู้จัก — ข้อความเดียวไม่บอกอะไรเพิ่ม) ·
  `409 INVITATION_EXPIRED` / `409 INVITATION_CANCELLED` / `409 INVITATION_ALREADY_ACCEPTED`
  (บอกแยกได้เพราะผู้เรียกถือ token ที่ถูกต้องอยู่แล้ว — ตรงตาม AC US-4) · `429 RATE_LIMITED` (30/ชม./IP, IPv6 = /64)

### 3.15 `POST /invitations/accept` — กดรับ (US-4)

```jsonc
// request (ต้อง login แล้ว)
{ "token": "9f2b…" }
// 200
{ "organization": { "id": "org_…", "name": "ร้าน A" },
  "membership": { "roleId": "rol_…", "roleName": "Staff", "roleKey": "staff", "status": "active" } }
```
- **ไม่มี org context** — endpoint นี้เป็น `@UserScoped()` และ **เพิกเฉยต่อ `X-Organization-Id` ทั้งหมด**
  (org มาจากแถว invitation เท่านั้น — I-3)
- ผูกกับ email: `normalizeEmail(user.email)` ต้องตรงกับ email ที่เชิญ → ไม่ตรง `403 INVITATION_EMAIL_MISMATCH`
  (ข้อความ: `details.emailMasked` ให้ UI แสดง "คำเชิญนี้ออกให้ `u***@example.com` กรุณาเข้าสู่ระบบด้วยบัญชีนั้น" — AC US-4/D-027)
  ⚠️ **ข้อจำกัดที่ต้องรู้:** Phase 0 ระบบยืนยัน email ไม่ได้ ⇒ การเช็คนี้เป็น defense-in-depth ไม่ใช่ control (architecture §7.6)
- **เคย `revoked` มาก่อน → กลับมาเป็น `active` ได้เฉพาะเมื่อคำเชิญถูกออก *หลัง* การถอด** (D-028/I-1)
  - `revokedAt > invitation.tokenIssuedAt` → **`409 INVITATION_SUPERSEDED`** ("คำเชิญนี้ออกก่อนที่คุณจะถูกถอดจากองค์กร
    — กรุณาขอคำเชิญใหม่") · การกลับเข้ามาสำเร็จจะ emit `org.member.reactivated` แยกใบ
- **เป็นสมาชิก `active` อยู่แล้ว → `409 ALREADY_MEMBER`** และ **role เดิมไม่ถูกแตะ** (I-9) — คำเชิญใบนั้นถูก mark
  `cancelled` ให้เอง (ไม่ค้างเป็น pending) · เดิมร่างแรกให้ `upsert` ทับ role ซึ่งเปิดช่อง "accept ทำให้ org เหลือ 0 Owner"
- `roleId` ของคำเชิญถูกลบ/ไม่ใช่ของ org นั้นแล้ว (F-003 เปิดให้ลบ role) → **`409 INVITATION_ROLE_UNAVAILABLE`**
  ("คำเชิญนี้ใช้ไม่ได้แล้ว โปรดขอลิงก์ใหม่") — ตรวจ **ตอน accept** ไม่ใช่แค่ตอนสร้าง (M-6)
- **flow "ยังไม่มีบัญชี"** (AC US-4): preview → signup (`POST /auth/signup` **ไม่เปลี่ยน**) → login → เรียก endpoint นี้
  โดย client ถือ `token` ไว้ตลอด flow · ไม่มีการแก้ contract ของ auth เลย ·
  ระบบบันทึก `acceptedUserCreatedAt` ⇒ ผู้เชิญเห็นธง "บัญชีถูกสร้างหลังออกลิงก์" ใน §3.10
- errors: `404 INVITATION_INVALID` · `409 INVITATION_EXPIRED|INVITATION_CANCELLED|INVITATION_ALREADY_ACCEPTED` ·
  `409 ALREADY_MEMBER|INVITATION_SUPERSEDED|INVITATION_ROLE_UNAVAILABLE` · `403 INVITATION_EMAIL_MISMATCH` · `429`
- **ลำดับการตัดสิน (pin ด้วย unit test — data-model §6):** token ไม่รู้จัก → หมดอายุ → cancelled/accepted →
  email mismatch → role ใช้ไม่ได้ → already member → superseded → สำเร็จ
- **ทุกเงื่อนไขด้านบนถูกตรวจ *ซ้ำ* ในทรานแซกชันหลังคว้า org lock** (architecture §5/§7.4) — การอ่านคำเชิญนอก tx
  ใช้เพื่อ "รู้ว่าเป็น org ไหน" เท่านั้น ⇒ ไม่มีช่องที่ `accept` แทรกระหว่าง `revoke`/`cancel`/`reissue` แล้วชนะ

### 3.16 `POST /orgs/{orgId}/tax-profile/reveal` — ขอดูเลขผู้เสียภาษีเต็ม (ux Q7/Q13)

```jsonc
// request — ไม่มี field ใด ๆ (body ว่าง `{}`)
{}
// 200
{ "taxId": "0105551234567", "entityType": "company", "revealedAt": "2026-07-28T09:00:00.000Z" }
```
- **สิทธิ์:** `manage_org_settings` เท่านั้น → ไม่ผ่าน = `403 FORBIDDEN` · ยังไม่ประกาศ tax profile = `404 NOT_FOUND`
- ✅ **ยืนยันสิทธิ์ระดับนี้ตามเดิม (NEW-11 · D-030 ข้อ 2 — user เคาะแล้ว):** `manage_org_settings` อยู่ในชุดของ
  **Admin** ด้วย ⇒ Admin เปิดดู TIN เต็มของร้านได้ · security-reviewer ยกเป็นประเด็น PDPA อย่างถูกต้อง แต่การซ่อน
  จากคนที่ต้องกรอก/ตรวจเอกสารภาษีจะทำให้ Phase 2 ทำงานไม่ได้ ⇒ **ตัดสินว่าคุมด้วยตัวคุม ไม่ใช่ด้วยการซ่อน**:
  (ก) เป็น **การกระทำที่ต้องกดโดยตั้งใจ** ไม่ติดมากับ `GET /orgs/{orgId}` (ข) emit `org.tax_profile.revealed` ทุกครั้ง
  (**ไม่มีค่า TIN ใน event**) (ค) rate limit **20/ชม. ต่อ (userId, orgId)** (ง) `no-store` + `no-referrer`
  (จ) `TAX_ID_RESPONSE_ALLOWLIST` = **1 เส้นพอดี** ที่ CI บังคับ · **ข้อจำกัดที่รู้ตัว:** Owner ยังไม่มีจอที่เห็น
  event นี้จนกว่าจะมี **F-005** → forward-commitment (architecture §14)
- **ทำไมเป็น endpoint แยกและเป็น `POST` (ไม่ใช่ field ใน `GET /orgs/{orgId}`):**
  1. ux ขอปุ่ม **"แสดงเลขเต็ม"** และฟอร์มแก้ไข (S5) ที่ต้อง preload ค่าเดิม ⇒ ต้องมี "ทางขอแบบตั้งใจ"
     ไม่ใช่ให้ TIN ติดมากับทุกครั้งที่เปิดหน้าจอร้าน (จอ S4 คือหน้าแรกของร้าน — โหลดบ่อยที่สุดในระบบ)
  2. การเปิดดูข้อมูลระดับนี้ **ต้องบันทึกได้** — emit `org.tax_profile.revealed` (actorUserId, organizationId;
     **ไม่มีค่า TIN ใน event**) ⇒ ตอบได้ว่าใครเปิดดูเลขบัตรประชาชนของเจ้าของร้านเมื่อไหร่
  3. `POST` ⇒ ไม่ถูก cache โดยธรรมชาติ, ไม่มี query string, ไม่ติดใน history/`Referer` — รูปเดียวกับ `POST /invitations/preview` (I-6)
- header บังคับ: `Cache-Control: no-store` + `Pragma: no-cache` + `Referrer-Policy: no-referrer`
- **rate limit 20/ชม. ต่อ (userId, orgId)** → `429 RATE_LIMITED` (§8 ของ architecture) — กันการดูดค่าโดยสคริปต์
  ที่ยึด session ได้ · **ไม่มี `taxId` ใน response ของ endpoint อื่นใดในระบบเลย** (assertion กลางของ int kit:
  `taxId` อนุญาตเฉพาะเส้นนี้ — `TAX_ID_RESPONSE_ALLOWLIST`)
- **@frontend:** ค่าที่ได้เก็บใน memory ของหน้าจอเท่านั้น (ห้าม persist/log) · กด "ซ่อนเลข" = ทิ้งค่าทิ้ง
  ต้องขอใหม่ถ้าจะดูอีก
- errors: `403 FORBIDDEN` · `404 NOT_FOUND` (ยังไม่ประกาศ) · `429 RATE_LIMITED` · `403 ORG_ACCESS_DENIED` (ไม่ใช่สมาชิก)

### 3.17 `DELETE /orgs/{orgId}/membership` — ออกจากร้านด้วยตัวเอง (US-5 · **D-029**)

```jsonc
// 200
{ "organizationId": "org_…", "status": "revoked", "revokedAt": "…", "cancelledInvitations": 0 }
```
- **สิทธิ์: สมาชิก `active` คนไหนก็ได้** — mark `@AnyActiveMember()` ⇒ **ไม่ต้องมี `manage_members`**
  (D-029: authz ของ "ถอนตัวเอง" แยกจาก "ถอดคนอื่น" โดยสิ้นเชิง)
- **ทำไมเป็น endpoint แยก ไม่ใช่ผ่อน authz ของ `DELETE …/members/{userId}` เมื่อ `userId === ctx.userId`:**
  1. **กัน confused deputy เชิงโครงสร้าง** — เส้นนี้ **ไม่มี `userId` ใน path เลย** เป้าหมายคือ `ctx.userId` เสมอ
     ⇒ ไม่มีทางชี้ไปที่คนอื่นได้แม้โค้ดจะมีบั๊ก · ถ้าผ่อน authz บนเส้นเดิม เราจะได้ route ที่ "capability ที่ต้องใช้
     ขึ้นกับค่าใน path" ⇒ `CapabilityGuard` (metadata ล้วน, fail-closed) ตัดสินไม่ได้ ต้องย้ายการตัดสินเข้าไปใน service
     = พลาดเมื่อไหร่ Staff ถอด Owner ได้ (นี่คือช่อง C-1 ที่เพิ่งปิดไป — ไม่เปิดกลับ)
  2. **route-registry test (I-2) ยังจัดชั้น route ได้ชัด** — เส้นเดิม = `manage_members`, เส้นนี้ = `@AnyActiveMember()`
     ไม่มี route ไหนที่ "แล้วแต่ข้อมูลใน request"
  3. **event/audit แยกใบ** — `org.member.left` ≠ `org.member.revoked` (สมัครใจ vs ถูกถอด เป็นคนละเหตุการณ์ทางธุรกิจ)
- **พฤติกรรม (เหมือน §3.9 ทุกประการ ยกเว้นตัว actor):** soft delete (`status='revoked'`, `revokedAt`,
  `revokedByUserId = ตัวเอง`) · **ยกเลิกคำเชิญ `pending` ของ email ตัวเองใน org นี้ใน tx เดียวกัน** (I-1 —
  ไม่งั้นคำเชิญค้างจะกลายเป็นทางกลับเข้ามาโดยไม่มีใครตัดสินใจใหม่; และกฎ `revokedAt > tokenIssuedAt` ทำให้
  ใบเก่ากลายเป็น `INVITATION_SUPERSEDED` อัตโนมัติ) · org หายจาก `GET /me/organizations` ทันที ·
  request ถัดไปของ org นี้ = `403 ORG_ACCESS_DENIED` · **session/org อื่นไม่กระทบ**
- **ยังติดกฎ Owner คนสุดท้าย → `409 LAST_OWNER`** (ตรวจใน tx เดียวกับ `lockCurrentOrganization` เหมือน §3.9) ·
  ⚠️ **ผลที่ต้องรู้:** Owner คนเดียวของร้าน **ออกเองไม่ได้** และ F-002 ไม่มี "ลบร้าน" ⇒ ทางออกคือตั้ง Owner คนใหม่ก่อน
  (ux copy ของ `409` บอกตรงนี้อยู่แล้ว) — บันทึกเป็นข้อจำกัดที่ยอมรับ, ปิดจริงเมื่อมี "ลบ/โอนร้าน" (productize)
- **กลับเข้ามาได้ต้องถูกเชิญใหม่เท่านั้น** (คำเชิญที่ออก *หลัง* `revokedAt`) — เหมือนถูกถอดทุกประการ
- errors: `409 LAST_OWNER` · `403 ORG_ACCESS_DENIED` (ไม่ใช่สมาชิก active — ครอบกรณีกดซ้ำหลังออกไปแล้ว) ·
  **ไม่มี `403 FORBIDDEN`** บนเส้นนี้ (ไม่มี capability ให้ขาด — ถ้า client เจอ 403 ต้องเป็น `ORG_ACCESS_DENIED` เท่านั้น)

---

## §4 Error code ใหม่ (เพิ่มเข้า `ERROR_CODES` registry — code ที่ ship แล้วห้ามเปลี่ยนค่า)

| code | HTTP | client failure (D-025) | เมื่อไหร่ |
|---|---|---|---|
| `ORG_CONTEXT_REQUIRED` | 422 | Validation | org-scoped แต่ไม่มีทั้ง header และ path orgId |
| `ORG_MISMATCH` | **422** | **Validation** | header ≠ path param — **client bug ไม่ใช่ผลการ authorize** (N-1) ⇒ ต้องไม่ทำให้ผู้ใช้ถูกเตะออกจาก org |
| **`ORG_ACCESS_DENIED`** | 403 | Forbidden | **ไม่ใช่สมาชิก active ของ org นี้** (รวมกรณี org ไม่มีจริง / ถูกถอด / `invited`) → client พากลับหน้าเลือก org + refetch `/me/organizations` |
| `FORBIDDEN` *(มีแล้ว)* | 403 | Forbidden | **มี membership แต่ทำสิ่งนี้ไม่ได้**: ขาด capability, ผิดกฎ Owner-only (C-1), หรือ route ที่ลืมประกาศ capability (I-2) → client อยู่หน้าเดิม แสดง toast |
| **`ORG_LIMIT_REACHED`** | 409 | Conflict | สร้าง org เกิน cap ต่อ user (`details.limit`) — I-10 |
| `LAST_OWNER` | 409 | Conflict | จะทำให้ org เหลือ Owner active 0 คน — **รวมกรณีออกจากร้านเอง §3.17 (D-029)** |
| `ALREADY_MEMBER` | 409 | Conflict | เชิญคนที่เป็นสมาชิก active อยู่แล้ว **หรือ** accept ทั้งที่เป็นสมาชิก active อยู่แล้ว (I-9) |
| `INVITATION_PENDING` | 409 | Conflict | มีคำเชิญค้างของ email นี้อยู่ — **มี `details.invitationId`** ให้ UI เสนอ "ออกลิงก์ใหม่/ยกเลิก" (D-027) |
| **`INVITATION_SUPERSEDED`** | 409 | Conflict | คำเชิญถูกออก **ก่อน** ที่ผู้รับจะถูกถอดจาก org นี้ (I-1) — ต้องเชิญใหม่ |
| **`INVITATION_ROLE_UNAVAILABLE`** | 409 | Conflict | role ของคำเชิญถูกลบ/ไม่ใช่ของ org นั้นแล้ว (M-6) |
| `INVITATION_LIMIT_REACHED` | 409 | Conflict | pending invitation เกิน cap ของ org |
| `INVITATION_INVALID` | 404 | NotFound | token ไม่รู้จัก |
| `INVITATION_EXPIRED` | 409 | Conflict | token ถูกต้องแต่เลย `expiresAt` |
| `INVITATION_CANCELLED` | 409 | Conflict | ถูกยกเลิกแล้ว |
| `INVITATION_ALREADY_ACCEPTED` | 409 | Conflict | รับไปแล้ว |
| `INVITATION_EMAIL_MISMATCH` | 403 | Forbidden | บัญชีที่ล็อกอินอยู่ไม่ตรงกับ email ที่เชิญ |
| `TAX_ID_INVALID` | 422 | Validation | 13 หลัก/checksum ไม่ผ่าน (มี `fieldErrors.taxId`) |
| `ROLE_INVALID` | 422 | Validation | `roleId` ไม่ใช่ role ของ org นี้ |
| `ORG_PROVISIONING_UNAVAILABLE` | 503 | Server | ระบบยังไม่มี plan ตั้งต้นให้ผูก (config ฝั่งเรา — ไม่ใช่ความผิด user) |

> **amend #3 ไม่เพิ่ม code ใหม่แม้แต่ตัวเดียว** — endpoint ใหม่ 2 เส้นใช้ code ที่มีอยู่แล้วทั้งหมด
> (`FORBIDDEN` / `NOT_FOUND` / `RATE_LIMITED` / `ORG_ACCESS_DENIED` / `LAST_OWNER`) ⇒ registry ยังเป็น **18 code ใหม่**
> ตามที่ประกาศไว้ตั้งแต่ amend #2 (test `U-API-15` ของ qa ไม่ต้องแก้ตัวเลข)
>
> **amend #4 ก็ไม่เพิ่ม code ใหม่เช่นกัน (จำนวนยังเป็น 18)** — สภาวะ "แย่ง lock / tx timeout / deadlock" ของ
> endpoint กลุ่มที่คว้า org lock ใช้ **`CONFLICT` (409) ที่มีอยู่แล้ว** + **`details.reason = "busy"`**
> (`details` เป็น field optional ในซองอยู่แล้ว ⇒ additive ล้วน · client ที่ไม่รู้จักค่านี้ยังทำงานถูกทุกประการ) ·
> **เหตุผลที่ไม่ใช้ `503`:** ทุก endpoint ในกลุ่มนี้ประกาศ `409` ไว้แล้ว แต่ **ไม่มีเส้นไหนประกาศ `503`**
> ⇒ การเพิ่ม status ที่ไม่เคยประกาศบน contract ที่ LOCKED คือการเปลี่ยน wire ซึ่งรอบนี้ห้าม ·
> **สิ่งที่ห้ามคือ 500** — กติกาเต็ม + การแมป error 4 ชนิด → [architecture §5.2](architecture.md)
>
> **`message` ทุก code ต้องใช้คำว่า "ร้าน" ไม่ใช่ "องค์กร"** (D-029) — เป็น default ที่ผู้ใช้จะเห็นถ้า client ไม่ override ·
> client **ยังต้อง switch จาก `code`** และใช้ copy ของ [ux-wireframe.md](ux-wireframe.md) เป็นหลักเสมอ

---

## §5 ผลต่อ contract กลาง (`packages/contracts`) — ประกาศการเปลี่ยนแปลง

- **additive-only ต่อ surface ที่ ship แล้ว**: ไม่แตะรูปสัญญาของ `/auth/*` และไม่แตะรูปของ
  `/orgs/{orgId}/members/{userId}/reset-password` → `oasdiff` ต้องไม่รายงาน breaking change (ถ้ารายงาน = ผมทำผิด)
  - ⚠️ **แต่พฤติกรรมของ reset-password แคบลงจริง 2 รอบ:** (1) **D-028/C-2** target ที่เป็นสมาชิก active ของ org อื่นด้วย
    จะได้ 404 แทน 200 · (2) **D-030/NEW-1 (amend #4)** target ที่เป็น **Owner** และผู้เรียกไม่มี `full_access`
    จะได้ 404 แทน 200 · `oasdiff` มองไม่เห็นการเปลี่ยนแปลงชนิดนี้ ⇒ **ต้องประกาศด้วยคนตรงนี้** และ qa ต้องมี test
    (นี่คือกรณีตัวอย่างของ "สัญญาไม่ได้เปลี่ยน แต่ contract ทางความหมายเปลี่ยน")
  - ⚠️ **amend #4 เพิ่มอีก 3 รายการในทะเบียนเดียวกัน** (รายละเอียด → [architecture §15](architecture.md)):
    **reissue** ติด Owner-only (`403` ในเคสที่เคยผ่าน — NEW-2) · **`acceptedUserCreatedAfterInvite`** เปลี่ยนนิยาม
    (NEW-9) · สภาวะแย่ง lock คืน **`409` แทน `500`** (NEW-4)
- component ใหม่ที่ต้องเพิ่มเป็น **ของกลาง** (feature ถัดไปใช้ต่อ): `PageMeta` (cursor envelope) ·
  `OrgIdHeader` (`X-Organization-Id` parameter) · `CursorParam` / `LimitParam` / `WithTotalParam`
- schema ใหม่: `Organization` · `OrganizationSummary` · **`OrganizationRevokedSummary`** (M-10) · `Membership` ·
  `MemberRow` · `RoleRow` (**+`key: string|null`**) · `Invitation` · `InvitationPreview` ·
  **`TaxProfileView`** (ทุก field optional ยกเว้น `vatRegistered` — I-8 + ux Q13 · **ไม่มี field `taxId`**) ·
  **`TaxIdReveal`** (`{ taxId, entityType, revealedAt }` — §3.16) · **`LeaveOrgResult`** (§3.17) ·
  `EntitlementSummary` + request DTO ของแต่ละ endpoint
- **`roleKey` (nullable string) ต้องอยู่คู่กับ `roleName` ทุกที่ในสัญญา** — `MemberRow`, `Invitation`,
  `InvitationPreview`, `Membership` (ทั้งใน §3.1/§3.2/§3.3/§3.15) · กติกา: **มี `roleName` ที่ไหน ต้องมี `roleKey` ที่นั่น**
  (ประกาศเป็น lint ของ contract review ไม่ใช่กฎในใจ)
- ไฟล์ `openapi.yaml` จะทะลุ ~2,000 บรรทัดหลังเพิ่มชุดนี้ → **แตกไฟล์เป็น `openapi/paths/*.yaml` + `components/*.yaml`
  แล้ว `redocly bundle`** ตาม backend.md §3.6 (โครง redocly มีแล้ว) — ทำพร้อม F-002 ไม่ปล่อยให้ไฟล์เดียวโตต่อ
- client ทั้งสองฝั่ง regen: `pnpm gen:contracts` (TS) + Dart — `contracts-drift` gate ต้องเขียว

---

## §6 ✅ คำตอบที่รับเข้า contract แล้ว (trace: ใครตอบอะไร — 2026-07-28)

> §6 เดิมคือ **consult questions (Q1–Q16)** · รอบนี้ `ux` และ `qa` ตอบครบและ user เคาะ **D-029** เพิ่ม
> ⇒ เก็บไว้เป็น **บันทึกการตัดสิน** ว่าอะไรเปลี่ยนเพราะใคร (คำตอบเต็มอยู่ในไฟล์ของเจ้าของ:
> [ux-wireframe.md §ตอบ consult questions](ux-wireframe.md) · [test-plan.md §ตอบ consult questions + §18/§19](test-plan.md))
> · **Q2/Q3 ถูกตัดไปตั้งแต่ amend #2** (D-028 ตอบ Q2, D-027 ตอบ Q3)

### 6.1 จาก @ux — 7 ข้อ (รับทั้งหมด)

| Q | คำตอบ | ผลต่อ contract |
|---|---|---|
| **Q1** จอสมาชิกรวม/แยก | จอเดียว 2 ส่วน · **ไม่ต้องมี endpoint รวม** | **ตัดงานออก** — คง `/members` + `/invitations` แยกตามร่าง (§3.7 มีเหตุผลบันทึกไว้) |
| **Q4** field ที่จอขาด | ไม่ขอชื่อ-นามสกุล (ไม่ต้องแตะ `User`, ไม่ต้อง escalate product) · ขอ **`key`/slug ของ role** แบบ "มีก็ดี" | **เพิ่มจริง** — `RoleRow.key` + `roleKey` คู่กับ `roleName` ทุกที่ (§3.6) · system = `owner\|admin\|staff` · custom (F-003) = `null` · **ห้ามใช้ตัดสินสิทธิ์** · ต้องเพิ่มคอลัมน์ `Role.key` (data-model §2/§4.2/§5.2) |
| **Q5** สร้างร้านแล้วพาเข้าเลย | พาเข้าทันที · `201` พอ | ยืนยัน + เขียนชัดใน §3.1 ว่า client seed cache จาก response ได้ |
| **Q6** 403 สองแบบ | ยืนยันแยก handler + copy ครบ | ไม่เปลี่ยน contract (§4 คงสองแถวแยกกัน) |
| **Q7** tax profile มีโหมดแก้ไข | มี (S4 ดู + ปุ่ม "แสดงเลขเต็ม" · S5 ฟอร์ม `PUT` ทั้งชุด) | **เพิ่ม endpoint `POST …/tax-profile/reveal` (§3.16)** + `PUT` ไม่สะท้อน TIN กลับ |
| **Q13** Staff เห็นอะไร | **ไม่เห็นตัวเลขเลยแม้แต่ 4 ตัวท้าย** (เข้มกว่า D-028) + ซ่อนเมนูสมาชิก | **แก้ §3.3** — `taxIdMasked` เฉพาะ `manage_org_settings` · คนอื่นได้แค่ `vatRegistered` + `taxProfileComplete` |
| **Q14/Q15** copy อายุลิงก์ / admin-reset ล้มเหลว | เป็นเรื่อง copy ล้วน | ไม่เปลี่ยน contract — **แต่ผมยืนยันเป็นสัญญา: `expiresAt` เป็น field บังคับ non-null ในทุกรูปของ Invitation** (§3.10/§3.11/§3.12/§3.14) |

> **จุดที่ผมทำ *เข้มกว่า* ที่ ux เขียนไว้ (บอกตรง ๆ):** ux เขียนว่า "`taxIdMasked` ยังส่งมาได้ตามสัญญาเดิม UI แค่ไม่ใช้"
> — ผมเลือก **ไม่ส่งเลย** สำหรับคนที่ไม่มี `manage_org_settings` · เหตุผล: ข้อมูลที่ไม่ได้ถูกส่งคือข้อมูลที่รั่วไม่ได้
> (network tab / log ของ client / bug report screenshot ก็เห็น) และไม่มีจอไหนใช้มัน ⇒ **ไม่มีต้นทุนต่อ UX เลย**
> · ถ้าวันหนึ่ง ux ต้องการ mask กลับมา = additive change ทำได้ทันทีโดยไม่ breaking

**ที่ ux ยกเป็น unresolved แล้วปิดในรอบนี้:** "พนักงานออกจากร้านเองไม่ได้" → **D-029 (2)** → §3.17 ·
"ร้าน vs องค์กร" → **D-029 (1)** → คำใน `message` ใช้ "ร้าน", identifier/schema ไม่เปลี่ยน ·
"`roles` ไม่มี slug" → ปิดด้วย `RoleRow.key`

### 6.2 จาก @qa — รับ 12/12 ข้อของ §18 + คำขอ 5 ข้อของ §19.1 ครบ

- **§18 ทั้ง 12 ข้อ = รับ** (qa เป็นเจ้าของ verdict "ทดสอบพอหรือยัง" — architecture §12 ถูกเขียนใหม่ให้ชี้มาที่
  [test-plan.md](test-plan.md) เป็น authority ของ lane/เคส แทนที่จะประกาศเองแบบครึ่ง ๆ) ·
  **4 ข้อหนักที่ปิดแล้ว:** E2E lane (qa เขียนเอง §12) · เทสต์ security event (ผมส่ง sink ให้ — ด้านล่าง) ·
  meta-test ว่า kit/gate ยิงจริง (I-09/G-05) · lane-enabled guard (I-37) — **สองข้อหลังคือบทเรียน F-001 ที่ผมรับเต็ม**
- **คำขอ 5 ข้อ (ของที่ต้องมี ไม่งั้นทดสอบไม่ได้จริง) — รับครบ, รายละเอียดอยู่ architecture §12/§15:**
  1. เติมแถวที่ขาดใน `withOrgScope` (§2.2) + **นโยบาย "operation นอกตาราง = throw"**
  2. **seed kit + CLI** (`apps/api/test/f002-seed.kit.ts` + `f002-seed` CLI ที่ E2E เรียกได้) — hash ด้วย production fn,
     ตั้งเวลาได้อิสระ 3 แบบตาม I-1, ไม่มี fake timer, **ไม่มี test-only endpoint**
  3. **test sink ของ security event** — `SecurityEventsService` ที่ ship แล้ว **มี `EventEmitter` อยู่ในตัวแล้ว**
     ⇒ ไม่ต้องรื้อ: ผมเพิ่ม (ก) event type ของ F-002 เข้า union (ข) helper `collectSecurityEvents(app)` ใน kit
  4. **export ให้เทสต์ import ได้:** route/capability registry · `org-models` · rate-limit defaults ·
     `RESPONSE_HEADER_POLICY` · `TOKEN_RESPONSE_ALLOWLIST` + **`TAX_ID_RESPONSE_ALLOWLIST`** (ของใหม่จาก §3.16)
  5. **`traceId` ทุก error** — รับ (พฤติกรรมบังคับ, schema คง optional) → §1
- **Q11 rate limit:** env-tunable ✔ + **pin ค่า default ด้วยเทสต์ที่ `packages/config`** ✔ + **`Retry-After` ≥ 1 วินาทีเสมอ** ✔ (§1)
- **Q16 `adminResetPassword`:** เอา **ทั้ง unit และ int** ✔ (+ assert `user.update` ไม่ถูกเรียก, int พิสูจน์ "รหัสเดิมยัง login ได้",
  เคสควบคุม, smoke tier ถาวร, red→green) — architecture §3.3
- **Q9 concurrency 7 เคสใหม่:** **มี 1 เคสที่ทำให้ต้องแก้ *design* ไม่ใช่แค่เพิ่มเทสต์** → `revoke ‖ accept`
  (และ `cancel ‖ accept`, `reissue ‖ accept`) พิสูจน์ว่า accept ที่ **ไม่คว้า org lock** สามารถ "ปลุก membership
  ที่เพิ่งถูกถอด" ได้จริงภายใต้ Read Committed ⇒ **architecture §5/§7.4 ถูกแก้:** ทุก mutation ที่แตะ
  membership/invitation ต้องเปิด tx ด้วย `lockCurrentOrganization` และ **ตรวจเงื่อนไขซ้ำใน tx** (รายละเอียด + ตาราง
  I-C-01..10 → architecture §5)

### 6.3 ที่ผมแย้งกลับ / ที่ test-plan ต้องปรับตาม contract ใหม่ (ฝากถึง @qa — ไฟล์ของคุณ ผมไม่แก้เอง)

1. **I-08 "org ไม่มีจริง vs org คนอื่น → ตรงกันทุก byte" ชนกับ Q12 ที่บังคับ `traceId` ไม่ซ้ำ** ⇒ ต้องเทียบ
   **หลังตัด `traceId` (และ header ที่ผันตามเวลา) ออก** ไม่งั้นเทสต์แดงตลอดโดยที่ระบบถูก — ขอให้แก้ถ้อยคำ I-08
2. **U-API-12 / I-22(d)** เขียนบนสมมติฐานเดิมว่า "ผู้มีสิทธิ์เห็น `taxId` เต็มใน `GET /orgs/{id}`" — **ไม่จริงแล้ว**
   (ux Q13 + §3.16): mapper **ไม่คืน `taxId` ให้ใครเลยบนเส้นนั้น** ⇒ ขอเพิ่มเคสของ §3.16 (403 เมื่อไม่มีสิทธิ์ ·
   404 เมื่อยังไม่ประกาศ · emit `org.tax_profile.revealed` · header `no-store` · rate limit) และเคส
   "Staff ไม่ได้แม้แต่ `taxIdMasked`"
3. **I-04 (PII assertion)** ขอเพิ่มมิติ `taxId`: ห้ามโผล่ในทุก response ยกเว้น `POST …/tax-profile/reveal`
4. **เคสใหม่ที่มากับ D-029:** `DELETE /orgs/{orgId}/membership` — Staff ออกเองได้ (200) · Owner คนสุดท้ายออกไม่ได้
   (409 `LAST_OWNER`) · ออกแล้ว request ถัดไป 403 + org หายจาก `/me/organizations` · คำเชิญค้างของตัวเองถูก cancel ·
   emit `org.member.left` · **และเคสความปลอดภัย: เส้นนี้ต้องไม่มีทางแตะ membership ของคนอื่นได้** (ไม่มี param ให้ชี้)
5. **route-registry (I-02)** ต้องรู้จักชั้นใหม่ `@AnyActiveMember()` ว่าเป็นการประกาศที่ถูกต้อง (ไม่ใช่ "ลืมประกาศ")
6. **F-001 regression ที่จะแดงเพราะ Q12:** `apps/api/src/common/domain-exception.filter.test.ts` มี 3 เคสที่ assert
   ว่า **ไม่มี** `traceId` เมื่อไม่มี correlation id — ต้องกลับด้านพร้อมกับโค้ด (อยู่ในรายการ ★ ของ architecture §15)
7. **(amend #4) สิ่งที่ต้องปรับใน test-plan หลังปิดเงื่อนไข delta review — ผมไม่แก้ไฟล์ของคุณ:**
   (ก) **G-13** เทียบ `ANY_ACTIVE_MEMBER_ROUTES` **ราย tier** (`mutating` = 1 เส้น · `read` = 2 เส้น: `GET /orgs/{orgId}`,
   `GET /orgs/{orgId}/roles`) แทนตัวเลขรวม — ของเดิม pin ไว้ 1 เส้นซึ่ง **ขัดกับ architecture §3.1** (NEW-3)
   (ข) **I-02** ต้องครอบ **read route** ด้วย (fail-closed ไม่ได้จำกัดที่ mutating อีกแล้ว)
   (ค) **U-API-07** เพิ่ม 2 เคสของ NEW-1 (Admin→Owner = 404 + `user.update` ไม่ถูกเรียก + event `…blocked_owner_target` ·
   Owner→Owner = สำเร็จ) และ **I-30** เพิ่มคู่ int (รหัสเดิมของ Owner ยังล็อกอินได้)
   (ง) **I-15/I-23** เพิ่มเคส `canAssignRole` ที่ **reissue** (Admin ออกลิงก์ใหม่ของคำเชิญ role Owner → 403)
   (จ) **I-35** เพิ่มเคส nested read "ลงกลับ" (`Membership → User → memberships`)
   (ฉ) **§8 concurrency** เพิ่ม 1 เคส: ยึด lock ค้างแล้วยิงซ้ำ org เดียวกัน → **409 ไม่ใช่ 500** + org อื่นยัง 200
   (ช) **U-CFG** เพิ่มการ pin `ORG_TX_TIMEOUTS` (`lockTimeout < txTimeout` ไม่งั้น boot ไม่ขึ้น)
   · **ของที่คุณขอ (§19.1 ข้อ 7–10) ผมรับครบและระบุที่มา/รูปแบบไว้ที่ [architecture §12.2 ข้อ 6–9](architecture.md)**
