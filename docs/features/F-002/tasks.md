# [F-002] Task Board — Organization · License · Membership

> เจ้าของ task update status ของตัวเอง (`todo→in_progress→done`) + ลงชื่อ `updated_by`
> PM ดูบอร์ด → dispatch task ที่ deps=done ครบ · กติกาเต็ม [WEB_TEAM.md §3.4/§3.6](../../../WEB_TEAM.md)

**Gate 2 ✓ 2026-07-29** — เอกสาร 7 ฉบับเซ็นครบ · decision: **D-027 · D-028 · D-029 · D-030 · D-031**

## กติกาเฉพาะของ feature นี้ (อ่านก่อนหยิบ task)

- **★ = แตะ auth / tenant-isolation / token / concurrency** → dispatch ด้วย **opus** + **`security-reviewer` บังคับก่อน merge** + ต้องมีหลักฐาน **red→green** (รันเทสต์กับโค้ดก่อนแก้แล้วแดงจริง — qa Q16)
- **⚠️ = เปลี่ยนพฤติกรรมบน wire โดยที่ `oasdiff` เงียบ** → ต้องประกาศด้วยคนใน PR description
- **cross-org leak int-test เป็นเทสต์บังคับของทุก feature ใหม่นับจาก F-002** — ไม่ใช่แค่ feature นี้
- ทุก task ส่ง **unit test ประกบเสมอ** (D-014) · ปิด task ได้เมื่อมี **runnable proof** (คำสั่ง+output) และ **PM รันซ้ำแล้วผลตรง**
- `ref` ชี้เป็น **`ไฟล์ §section`** ไม่ใช่ทั้งไฟล์ · รายงานกลับใช้ **task report format ≤30 บรรทัด** (WEB_TEAM §3.6)
- **ห้ามแตะ protected paths:** `.claude/**` · `CLAUDE.md` · `WEB_TEAM.md` · `docs/00–05*.md` · `docs/DECISIONS.md`

---

## backend-api — ชั้นฐาน (บล็อกทุกอย่าง ทำก่อน)

| ID | งาน | ref → target | deps | status | updated_by |
|----|-----|--------------|------|--------|------------|
| T-002-01 | ★⚠️ schema delta + **migration 2 ไฟล์** (`f002_expand` → `f002_drop_invitation_token`) · `Invitation.token`→`tokenHash` (D-018) · `Role.key` · partial unique index 2 ตัว · precondition check ที่ **abort ดัง** ถ้า `Invitation` ไม่ว่าง | `data-model.md §2/§4` → `packages/db/prisma/` | G2✓ | done | backend-api |
| T-002-02 | ★ `withOrgScope` ของจริง (แทน pass-through stub) ครบทุก operation + **"operation นอกตาราง = throw"** + export `USER_SELECT` **frozen** (ทางเดียวที่แตะ `User`) · `orgScopedModels`/`orgAgnosticModels` | `architecture.md §2.2` · `§15 แถว 6` → `packages/db/src/tenancy.ts` | T-002-01 | done | backend-api |
| T-002-03 | ★ `lockCurrentOrganization` + **`SET LOCAL lock_timeout`** + `ORG_TX_TIMEOUTS` + แมป `55P03`/`40P01`/`P2028`/pool-timeout → **`409` + `details.reason='busy'` (ห้าม 500)** + export `ORG_LOCK_REQUIRED_OPERATIONS` (7 รายการ) | `architecture.md §5.1/§5.2` · `§15 แถว 6b` → `packages/db/src/org-lock.ts` | T-002-01 | done | backend-api |
| T-002-04 | ★ `OrgContextMiddleware` (ALS) + `OrgScopeGuard` **default-deny** + `req.orgAuth` (ห้ามพึ่ง `req.user` — I-4) + **ไม่สร้าง context บน `@UserScoped()`/`@Public()`** (I-3) | `architecture.md §1.1–1.4` · `§15 แถว 5` → `apps/api/src/tenancy/` | T-002-02 | done | backend-api |
| T-002-05 | ★ `CapabilityGuard` **fail-closed ครอบ org-scoped route ทุก method รวม `GET`** (NEW-3) + `ROUTE_CAPABILITIES` + `ANY_ACTIVE_MEMBER_ROUTES` แยก 2 tier | `architecture.md §3.1` · `§15 แถว 5b` → `apps/api/src/common/authz/` | T-002-04 | done | backend-api |
| T-002-06 | env ใหม่เข้า zod schema (`INVITATION_TOKEN_SECRET` min32 + ต่างจาก JWT ทั้งสอง · `WEB_APP_BASE_URL` url+https · `DEFAULT_ORG_PLAN_KEY` · `MAX_ORGS_PER_USER=50` · `ORG_TX_TIMEOUTS`) + export `ORG_RATE_LIMIT_DEFAULTS` | `architecture.md §6.4` · `§15 แถว 8` → `packages/config/src/env.ts` | — | done | devops |
| T-002-07 | seed `PlanDefinition` 4 แถว (idempotent by `key`) — **ไม่มี = `POST /organizations` 503 ทุกเคส** | `data-model.md §5.1` → `packages/db/prisma/seed.ts` | T-002-01 | done | backend-api |
| T-002-08 | pure fn ใน core-domain + test matrix: `owner-invariant` · **`canAssignRole`** (Owner-only D-028) · `thai-tax-id` (13 หลัก+checksum) · `invitation-status` · `maskEmail` | `data-model.md §6` → `packages/core-domain/src/orgs/` | — | done | backend-api |
| T-002-08b | pure fn ที่ตกหล่นจากรอบแรก (**PM เขียน tasks.md ตกเอง — data-model §6 มี 7 ไฟล์ ไม่ใช่ 5**): `invitation-policy.ts` (`invitationTtlHours` 24ชม./7วัน · `canAcceptInvitation`) · `tax-id-mask.ts` (`maskTaxId`) | `data-model.md §6` → `packages/core-domain/src/orgs/` | T-002-08 | done | backend-api |
| T-002-08c | ย้าย `CAPABILITY_MANAGE_ORG_SETTINGS` จากที่ประกาศชั่วคราวใน `apps/api/src/common/authz/route-capabilities.ts` ไปอยู่ข้าง `CAPABILITY_MANAGE_MEMBERS` ใน core-domain (**ค่า string ห้ามเปลี่ยน**) — T-002-05 ประกาศไว้ชั่วคราวเพราะแตะ `packages/**` ไม่ได้ | `packages/core-domain/src/auth/capabilities.ts` | T-002-05 | done | product (ทำเอง — เล็กเกินกว่าจะ dispatch และชนไฟล์กับ T-002-13) |

## backend-api — แก้โค้ดที่ ship แล้ว (★ ทุกใบ · red→green บังคับ)

| ID | งาน | ref → target | deps | status | updated_by |
|----|-----|--------------|------|--------|------------|
| T-002-09 | ★⚠️ **`adminResetPassword` — งานใบเดียว 2 เงื่อนไข** (ก) C-2 ปฏิเสธเมื่อ target active ใน org อื่น (ข) **NEW-1/D-030** ปฏิเสธเมื่อ target เป็น Owner และผู้เรียกไม่มี `full_access` (ค) NEW-5(ก) ทั้งบล็อกใน **tx เดียว** (`User` `FOR UPDATE` → นับ → ตรวจ → เขียน → นับซ้ำ) · **คืน 404 รูปเดิม ทุกสาเหตุ byte-identical** | `architecture.md §3.3` · `§15 แถว 1` → `apps/api/src/auth/auth.service.ts` | T-002-08 | done | backend-api + product (agent โดน session limit กลางทาง — PM ทำ int test ต่อ) |
| T-002-10 | ★⚠️ `traceId` ทุก error · **UUID v4 opaque** (ห้าม counter/timestamp) · server ออกเสมอ · `X-Request-Id` **ไม่ใช่การสะท้อนค่าจาก client** · **เทสต์เดิม 3 เคสต้องกลับด้าน** (ห้าม skip/ลบ) | `architecture.md §15 แถว 2` → `apps/api/src/common/domain-exception.filter.ts` | — | done | backend-api |
| T-002-11 | ★ `client-ip.ts` (ยุบ IPv6 เป็น **/64**) + ให้ `throttle.service.ts` ใช้ helper เดียวกัน — ของเดิม rate-limit ต่อ IP ไร้ผลกับ IPv6 | `architecture.md §15 แถว 3` → `apps/api/src/common/` + `auth/throttle.service.ts` | — | done | backend-api |
| T-002-12 | ★ ขยาย `SecurityEventType` union **15 ค่า** (รวม `org.member.left`, `org.tax_profile.revealed`, `auth.password.admin_reset_blocked_owner_target`) · **ไม่รื้อ transport** (EventEmitter = test sink ที่ qa ขอ) · emit **post-commit เท่านั้น** | `architecture.md §9` · `§15 แถว 4` → `apps/api/src/auth/security-events.service.ts` | — | done | backend-api |
| T-002-13 | จัดชั้น route ของ F-001: `/auth/*` = `@Public()` · `reset-password` = `@UserScoped()` (**คง 404-never-403 + capability inline เดิม ไม่เปลี่ยน wire**) + ลงทะเบียนใน `ROUTE_CAPABILITIES` | `architecture.md §1.1` · `§15 แถว 7` → `apps/api/src/auth/*.controller.ts` | T-002-05  · **+ รับงานส่งต่อจาก T-002-05:** (ก) bind `CAPABILITY_EVENT_SINK → SecurityEventsService` — **ไม่ทำ = `org.access.capability_denied` หายจาก `collectSecurityEvents()` ของ qa** (ข) ลบ `tenancy/legacy-routes.ts` ชั่วคราวทิ้ง ใส่ decorator จริง (ค) ตัดสินเคส **`HEAD` บน route ที่มีแต่ `@Get()` → ตอนนี้ได้ 500** (fail-closed แต่เป็น wire artifact ของ T-002-04 · pin ไว้ในเทสต์แล้ว)| done | backend-api + product (agent โดน session limit กลางทาง — PM ทำต่อ 3 ข้อส่งต่อ) |

## backend-api — endpoint ของ F-002

| ID | งาน | ref → target | deps | status | updated_by |
|----|-----|--------------|------|--------|------------|
| T-002-14 | rate-limit guard กลาง (Redis sliding window) — create org / invite / reissue / preview+accept · fail-open + emit event | `architecture.md §8` → `apps/api/src/common/org-rate-limit.guard.ts` | T-002-06, T-002-11 | done | product (ทำเอง) — guard ลงทะเบียน **หลัง** authz โดยเจตนา (นับก่อน = คนนอกเผาโควตาของ org ได้) |
| T-002-15 | ★ `POST /organizations` — **1 tx**: Organization + system Roles(3) + Membership(Owner) + **OrgEntitlement** + default Warehouse · plan จาก env seam (**fail closed 503** ห้าม fallback free) · **cap 50 org/user** (`409 ORG_LIMIT_REACHED`) | `api-spec.md §3.1` · `architecture.md §6` → `apps/api/src/orgs/` | T-002-03, T-002-07, T-002-14 | done | backend-api |
| T-002-16 | `GET /me/organizations` (cursor · `?status=all` คืนแค่ id/ชื่อ/สถานะ) + `GET /orgs/{id}` + `PATCH /orgs/{id}` (`logo` รับเฉพาะ `null` ใน Phase 0) | `api-spec.md §3.2–3.4` → `apps/api/src/orgs/` | T-002-05 | done | backend-api |
| T-002-17 | ★ tax profile: `PUT /orgs/{id}/tax-profile` (ครบชุดหรือว่างทั้งชุด) + **`POST /orgs/{id}/tax-profile/reveal`** (TIN เต็ม · `manage_org_settings` · rate 20/ชม. · `no-store`+`no-referrer` · emit event **ที่ไม่มีค่า TIN**) · **`GET` ไม่คืน TIN เต็มอีกแล้ว** | `api-spec.md §3.5/§3.16` · `data-model.md §3.3` | T-002-08, T-002-16 | done | backend-api + product (agent โดน session limit ก่อนเขียน int lane — PM เขียนต่อ 8 เคส + mutation check) |
| T-002-18 | ★ สมาชิก: `GET /members` (**ต้องมี `manage_members`** — PDPA) · `PATCH /members/{userId}` · `DELETE /members/{userId}` (soft revoke + **ยกเลิก pending invite ของ email นั้นใน tx เดียว**) · **`DELETE /orgs/{id}/membership`** (ออกเอง — ไม่ต้องมี `manage_members`) · ทุกเส้น **lock + re-check ใน tx** + `canAssignRole` | `api-spec.md §3.7–3.9` · `architecture.md §5` | T-002-03, T-002-08, T-002-15 | done | backend-api |
| T-002-19 | ★ คำเชิญ (ฝั่ง org): `POST /invitations` (hash-at-rest · TTL **24 ชม.** สำหรับ role สูง / 7 วัน ที่เหลือ · `409 INVITATION_PENDING` พก `details.invitationId`) · `GET` · `POST .../link` (**rotate + อายุนับใหม่** D-027 · **ผ่าน `canAssignRole`** NEW-2 · **DB ต้องไม่ขยับถ้า 403**) · `DELETE` | `api-spec.md §3.10–3.13` · `architecture.md §7` | T-002-06, T-002-18 | done | product (agent โดน session limit ตั้งแต่ยังไม่เขียนอะไร — PM ทำเองทั้งใบ) |
| T-002-20 | ★ รับคำเชิญ: **`POST /invitations/preview`** (public · token ใน **body** ไม่ใช่ query — I-6) · `POST /invitations/accept` (`409 ALREADY_MEMBER` ไม่ทับ role · `409 INVITATION_SUPERSEDED` ถ้าออกก่อนถูกถอด · ตรวจ role ยังเป็นของ org นั้น) | `api-spec.md §3.14–3.15` · `architecture.md §7.4` | T-002-19 | done | backend-api |
| T-002-21 | ⚠️ OpenAPI: เพิ่ม 17 endpoint + schema · **แตกไฟล์เป็น `paths/*.yaml` + `components/*.yaml` → `redocly bundle`** · regen TS + Dart client | `api-spec.md §5` · `§15 แถว 11` → `packages/contracts/` | T-002-20 | done | backend-api |
| T-002-22 | test kit ที่ qa เป็นผู้ใช้: `f002-seed.kit.ts` + CLI (`--scenario` · ตั้ง/สลับ `Role.key`) · `org-leak.kit.ts` (**4 persona**) · route-registry helper · assertion กลาง (PII/header/traceId/schema) · **500-fixture ที่ compile เฉพาะโปรไฟล์ test** · **meta-test ว่า kit แดงได้จริง** | `architecture.md §12.2` · `test-plan.md §19.1` → `apps/api/test/` | T-002-05 | done | qa — 6 kit + meta-test แดงได้จริงทุกตัว · ~~ค้าง `hashInvitationToken`~~ **ปลดแล้ว** — `packages/db/src/invitation-token.ts` (D-018) · 3 scenario ของ invite รันจริงแล้ว และเทสต์ที่ pin ไว้ถูกพลิกเป็นสถานะ "wired" |

## devops

| ID | งาน | ref → target | deps | status | updated_by |
|----|-----|--------------|------|--------|------------|
| T-002-D1a | ปิด build-breaker: เติม env ใหม่ 3 ตัวเข้า CI job `integration-api` + `auth.e2e.int.test.ts` (T-002-06 ทำให้เป็น required ⇒ int lane แดงถ้าไม่เติม) | `.github/workflows/ci.yml` · `apps/api/src/auth/auth.e2e.int.test.ts` | T-002-06 | done | devops |
| T-002-D1b | **ปิดกับดัก "เขียวเพราะไม่ได้รัน"**: ให้ lane `db-migrate` รัน DB-backed test จริง + `tool/ci/assert-tests-ran.mjs` (skip/หาย/ลดจำนวน = CI แดง) · แก้ `integration-api` ที่เดิมมีสาขา "ถ้ามี script ค่อยรัน" | `.github/workflows/ci.yml` · `tool/ci/` | T-002-02 | done | devops |
| T-002-D1c | เพิ่มขั้น `prisma db seed` ใน lane `integration-api` — **ไม่มี `PlanDefinition` ⇒ `POST /organizations` = 503 ทุกเคส** (architecture §12.3 ข้อ 2) | `.github/workflows/ci.yml` | T-002-07 | done | devops |
| T-002-D1 | CI job `integration-api`: เพิ่ม env ใหม่ + ขั้น **`prisma db seed`** (ไม่มี = สร้างร้านไม่ได้เลย 503 ทุกเคส) + **`connection_limit` ของ `TEST_DATABASE_URL` ≥ จำนวน request ขนานของ test-plan §8** (ไม่งั้นขนานปลอม) | `architecture.md §12.3` · `§15 แถว 13` → `.github/workflows/` | T-002-06, T-002-07 | done | product (env + seed มีอยู่แล้วจาก wave ก่อน · เพิ่ม `connection_limit=25` — default ของ Prisma มาจากจำนวน CPU = 5 บน runner 2 core ⇒ เทสต์ concurrency จะกลายเป็น serial ที่ pool แล้วผ่านโดยไม่เคยแข่งกันเลย) |
| T-002-D2 | ค่าจริงของ env per-environment: `DEFAULT_ORG_PLAN_KEY` (dogfood = `comp_full`) · `INVITATION_TOKEN_SECRET` · `WEB_APP_BASE_URL` · **log scrubbing: ห้าม log query string ของ `/invitations/*`** | `architecture.md §6.2/§7.3` · `api-spec.md §1` | T-002-06 | done | devops (`infra/env/README.md` matrix + gateway log rule + drift gate `env-example.test.ts`) |

## ux

| ID | งาน | ref → target | deps | status | updated_by |
|----|-----|--------------|------|--------|------------|
| T-002-X1 | **sync-back `design-system.md` ตาม D-031** — icon policy **Phosphor** (§1.6 หัวข้อใหม่) · `color.info.*` · `type.button.sm` · `size.icon.*` · `focus.ring.*` · **tap-target 44px ไม่มีข้อยกเว้น** · `Button` +tertiary/+sm/+confirmed · **กฎโครงสร้าง: theme+base style ที่ `:root`/`body` ไม่ใช่ container** + "utility ที่แปลว่าซ่อนต้องชนะเสมอ" · §9 Component library + นิยาม "ประกาศแล้ว" | `ui.md §7` (diff ครบแล้ว) → `docs/design-system.md` | G2✓ | done | ux |
| T-002-X2 | ตาราง `icon.<role>` → ชื่อไอคอนจริงของ Phosphor (ทั้ง web + Flutter) + ยืนยันว่ามีครบทุก role ที่ F-002 ใช้ | `ui.md §7 ข้อ 12` · D-031 | T-002-X1 | done | ux |

> **⛔ T-002-X1 บล็อก frontend ทุกใบ** — ถ้า design-system ยังไม่ sync frontend จะ implement จากไฟล์ mockup ซึ่งไม่ใช่ source of truth

## frontend — web (Next.js)

| ID | งาน | ref → target | deps | status | updated_by |
|----|-----|--------------|------|--------|------------|
| T-002-W1 | ★ โครง org context: `lib/org` + `lib/session` + `app/o/[orgId]/layout` + org-scoped query client + ย้าย `components/auth/*` → `features/auth/` (R6) | `docs/architecture/web.md §3.2` · forward-commitments แถว F-002/F-003 | T-002-21, T-002-X1 | done | frontend (+ restart point: TanStack Query, `lib/api/query-client.ts`) |
| T-002-W2 | ★ `ApiFailure` web: **`ORG_ACCESS_DENIED` ≠ `FORBIDDEN` ห้ามรวม handler** (พากลับหน้าเลือกร้าน+refetch vs อยู่หน้าเดิม+toast) · `409` ที่มี `details.reason='busy'` = ลองใหม่ได้ · client ที่ไม่รู้จัก `reason` ต้องยังทำงานถูก | `web.md §3.4` · `api-spec.md §4` · `ux-wireframe.md §12` | T-002-W1 | done | frontend (`org-access-denied` + `busy` เป็น kind แยก — ดูหมายเหตุท้ายไฟล์) |
| T-002-W3 | จอ: เลือกร้าน (S1) · สร้างร้าน (S2) · AppShell+ตัวสลับร้าน (S3) | `ux-wireframe.md §2–4` · `ui.md §3` | T-002-W2 | done | frontend (+ `createUserApiClient` — tier ที่ W1 มองข้าม · ดูหมายเหตุท้ายไฟล์) |
| T-002-W4 | จอ: ข้อมูลร้าน (S4) + ฟอร์มผู้เสียภาษี (S5) — **TIN เต็มมาจาก reveal เท่านั้น เก็บใน memory ห้าม persist** · Staff ไม่เห็นตัวเลขเลย | `ux-wireframe.md §5–6` | T-002-W3 | done | frontend (reveal = mutation ไม่ใช่ query · ดูหมายเหตุท้ายไฟล์) |
| T-002-W5 | ★ จอ: สมาชิก (S6) + เชิญ (S7) + **แผ่นลิงก์แสดงครั้งเดียว (S8)** — ปุ่ม **"ออกลิงก์ใหม่"** + เตือนก่อนกด · **ห้าม hardcode "7 วัน"** ใช้ `expiresAt` · token เก็บใน memory เท่านั้น | `ux-wireframe.md §7–9` · D-027 | T-002-W3 | done | frontend (+ ปิดหนี้ W-13 Toast host · ดูหมายเหตุท้ายไฟล์) |
| T-002-W6 | จอ: เปลี่ยนสิทธิ์ (S9) · ถอด/ออกจากร้าน (S10) · **`/invite` (S11) — ต้องดีบนเบราว์เซอร์มือถือ ~390px** · 403 สองแบบ (S12) · **ถอด token ออกจาก URL ด้วย `history.replaceState` ทันที** (I-6) | `ux-wireframe.md §10–12` | T-002-W5 | done | frontend (★ I-6 token-stripping · ดูหมายเหตุท้ายไฟล์) |

## frontend — mobile (Flutter)

| ID | งาน | ref → target | deps | status | updated_by |
|----|-----|--------------|------|--------|------------|
| T-002-M1 | ★ `core/session` + `orgDioProvider` + **`X-Organization-Id` เข้า interceptor chain** (seam comment วางไว้แล้ว) | `docs/architecture/mobile.md §3.2` · forward-commitments แถว F-002/F-003 | T-002-21, T-002-X1 | done | frontend (ดูหมายเหตุท้ายไฟล์) |
| T-002-M2 | ★ `ApiFailure` mobile: แยก `ORG_ACCESS_DENIED` / `FORBIDDEN` + `409 busy` (กติกาเดียวกับ web) | `mobile.md §3.4` · `api-spec.md §4` | T-002-M1 | done | frontend (+ `SessionFailureListener` — ดูหมายเหตุ) |
| T-002-M3 | จอมือถือ: เลือกร้าน · สร้างร้าน · ตัวสลับร้านใน AppBar · สมาชิก (อ่าน+เชิญพื้นฐาน) · ~~`/invite` deep link~~ (ux §13: ไม่มีจอนี้ในแอป → F-006) | `ux-wireframe.md §13` (ความต่าง web↔mobile) | T-002-M2 | done | หนี้ M-3/M-4/M-5 |

## qa

| ID | งาน | ref → target | deps | status | updated_by |
|----|-----|--------------|------|--------|------------|
| T-002-Q1 | unit lane: core-domain (12) · packages/db (10 — รวม **M-9 `upsert` แถวต่อแถว**, `USER_SELECT` freeze, nested read "ลงกลับ") · config (6) | `test-plan.md §5–7` | T-002-02, T-002-08 | done | qa (audit ครบ + gate `U-API-14`; redaction จริง → devops D2) |
| T-002-Q2 | ★ int lane บังคับ: **cross-org leak × 4 persona** · **route-registry capability (รวม `GET`)** · assertion กลาง `passwordHash`/`tokenHash` · **hash-at-rest พิสูจน์ได้** | `test-plan.md §8` | T-002-22 | done | qa (**แถวนี้ค้างสถานะ ไม่ใช่ค้างงาน** — ของมีครบและรันใน CI มานานแล้ว: `test/org-leak.kit.ts` **5 persona** (มากกว่าที่ขอ — เพิ่ม `underprivilegedInA` ที่แยก 403 FORBIDDEN ออกจาก ORG_ACCESS_DENIED ตาม I-5) · `test/route-registry.kit.ts` · `test/assertions.kit.ts` · D-018 hash-at-rest ที่ `invitations.e2e.int.test.ts` + `f002-seed.kit.int.test.ts` · มี floor ใน CI ทุกไฟล์) |
| T-002-Q3 | ★ (เขียนครบ — **รอ CI ยืนยัน**) concurrency 13 เคส: Owner คนสุดท้าย 2 ขนาน ×20 รอบ · accept ซ้ำ · invite ซ้ำ · **revoke‖accept** · reissue‖accept · cancel‖accept · PATCH‖DELETE · ยก Owner 2 คนพร้อมกัน · cap 49 · revoke‖revoke · **lock timeout → 409 ไม่ใช่ 500 · ห้าม 40P01/40001 หลุด wire** | `test-plan.md §8` · `architecture.md §5.2` | T-002-03, T-002-22 | done | qa (`test/concurrency-matrix.int.test.ts` 14/14 เขียวบน CI run 31608348040) |
| T-002-Q4 | ★ regression ของ finding: **NEW-1 (Admin→Owner reset = 404 + รหัสเดิมยัง login ได้ + เคสควบคุม)** · C-1 · C-2 · I-1 · NEW-2 · **I-45 สลับ `Role.key` ใน DB แล้วสิทธิ์ต้องไม่ขยับ** · เข้า **smoke tier ถาวร** | `test-plan.md §9` (ทะเบียน 41 finding) | T-002-09, T-002-22 | done | qa (regression-pack gate + G-15 tripwire + ปิด M-3 ที่ไม่เคยมีเทสต์) |
| T-002-Q5 | E2E + manual: flow เชิญ→รับ **3 ทางแยกของ US-4** · org switcher · ถูกถอดกลางคัน · Staff เจอ 403 แล้ว UI ทำถูก | `test-plan.md §10` · `ux-wireframe.md §11` | T-002-W6, T-002-M3 | in_progress | qa (**§12.1 ครบ 14/14 แถวแล้ว** — web 26/26 เคส + **E-10 บน emulator จริง 3/3** [run 31991966111](https://github.com/thewinwebdevelop/spec-inventory-manager/actions/runs/31991966111) เขียวครบ 9 job · **เหลือเฉพาะ manual §12.2 M-01..M-07 ซึ่งเป็นงานคน** และ §17.6 บังคับให้มีก่อนตัดสิน verdict) |
| T-002-Q6 | perf smoke: member list 200 คน · `/me/organizations` 50 org · overhead membership lookup < 5 ms | `test-plan.md` · `architecture.md §10` | T-002-18 | done | qa (`test/perf-smoke.int.test.ts` P-01..P-04 · SAMPLES=30/WARMUPS=5 · **P-03 ใช้ median delta ไม่ใช่ p95** เพราะวัดส่วนต่างของ 2 เส้นบน runner ที่ noisy · มี non-vacuity test เช็คขนาด fixture · floor ใน CI) |
| T-002-Q7 | Track 2 (agentic, **ไม่บล็อก merge**): 7 flow persona SME ไทย — คุ้มสุด: **"ออกลิงก์ใหม่"** (ผู้ใช้เข้าใจไหมว่าลิงก์เดิมตาย) และ **404 ของ admin-reset** | `test-plan.md` · WEB_TEAM §3.7 | T-002-Q5 | in_progress | qa (runbook + finding แรกของ flow 2 → แก้แล้ว · การรันจริงรอ stack) |

---

## ลำดับ dispatch ที่แนะนำ

```
รอบ 1 (ขนานได้):  T-002-01  ·  T-002-06  ·  T-002-08  ·  T-002-10  ·  T-002-11  ·  T-002-12  ·  T-002-X1
รอบ 2:            T-002-02 → T-002-03 · T-002-07 · T-002-04 → T-002-05 → T-002-13 · T-002-22
รอบ 3:            T-002-09 (★ ใหญ่สุด) · T-002-14 → T-002-15 → T-002-16..T-002-20 → T-002-21
รอบ 4 (ขนาน):     frontend web ∥ mobile ∥ qa lane  ·  devops D1/D2 เดินคู่ตั้งแต่รอบ 2
```

> **จุดที่ห้ามลัด:** `T-002-02` (`withOrgScope`) และ `T-002-04/05` (guard) คือสิ่งที่ทำให้ "ลืมแล้วพัง ไม่ใช่ลืมแล้วรั่ว"
> เป็นจริง — ทุก endpoint ของ F-002 และ **~40 feature ถัดไป** พึ่งชั้นนี้ · ถ้าทำ endpoint ก่อนชั้นนี้เสร็จ จะได้ pattern ที่ผิดแล้วถูกลอกต่อ

---

## ผลตรวจ security review ของ wave 5 (commit `f66451f`) — 2026-08-03

verdict: **ready-with-recommendations · ไม่มี Critical** · reviewer พิสูจน์แล้วว่า C-2/D-028 และ NEW-1/D-030 บังคับใช้จริงกับ Postgres จริง
และไล่หา wire delta ที่ 4 จากการลบ bridge **ไม่เจอ** (มีแค่ 415→401 ที่บันทึกไว้แล้ว)

**ปิดแล้วใน wave 6:**

| finding | สิ่งที่ทำ |
|---|---|
| **High-1** `@UserScoped()` อยู่ที่ class `MembersController` — handler ใหม่ (`PATCH`/`DELETE` member ของ T-002-18) จะสืบทอด แล้ว **ใครก็ได้ที่ล็อกอินจะแก้ role/ถอดสมาชิกของ org ไหนก็ได้** | ย้ายไป handler + `members.controller.test.ts` บังคับกฎ "controller ที่ path มี `:orgId` ห้าม mark ที่ class" (แดงจริงเมื่อย้ายกลับ) |
| **Medium-1** 422 เป็น oracle จำแนก target (weak password → 422 = "target นี้ผ่าน", 404 = "target เป็น Owner/หลาย org") | ย้าย `checkPasswordPolicy` มาก่อน tx ⇒ 422 ขึ้นกับรหัสที่ผู้เรียกพิมพ์เท่านั้น · เทสต์เดิมกลับด้าน 4 scenario |
| **Medium-3** argon2 รันใน tx ⇒ ถือ `FOR UPDATE` บนแถว `User` ตลอดคิว libuv | pre-check ผู้เรียกนอก tx (ผ่าน pure fn เดิม ไม่มีสำเนาที่สอง) → hash นอก tx → tx: lock → ตัดสิน → เขียน → ตัดสินซ้ำ |
| **Medium-4** `org.access.denied` ประกาศใน §9 แต่ **ไม่มีใคร emit** ⇒ สัญญาณ "มีคนไล่เข้า org ที่ไม่ใช่ของตัวเอง" ไม่มีอยู่จริงใน audit trail · `capability_denied` reason `metadata_missing` ก็ไม่เคย emit | emit ทั้งสองผ่าน sink เดิม · wire ยังแยก 3 เหตุผลไม่ได้ (I-5) แต่ **event แยกได้** — คนสืบเคสต้องรู้ว่า "ไม่เคยเป็นสมาชิก" ต่างจาก "ถูกถอด" |
| **Low** ค่า env 22 หลักผ่าน `/^\d+$/` แล้วกลายเป็น `1e+21` ใน SQL ⇒ 500 ตอน request ไม่ใช่ตอน boot | ใส่เพดาน `POSITIVE_INT_ENV_MAX` + เทสต์ |
| **Low** เอกสาร 2 ฉบับยังเขียนว่า "wire ไม่เปลี่ยนแม้แต่ status เดียว" | แก้ `architecture.md §1.1` + `F-001-authentication.md` ให้ตรงกับ 415→401 |

**ยังค้าง — ต้องให้ user เคาะ (เป็น scope/contract ไม่ใช่บั๊ก):**

| # | เรื่อง | ทำไมต้องถาม |
|---|---|---|
| A | **High-2** `adminResetPassword` อนุญาตให้ `caller === target` — token หลุด = ตั้งรหัสใหม่ได้โดยไม่ต้องรู้รหัสเดิม แล้ว `revokeAllForUser` เตะเจ้าตัวออกทุกเครื่อง (`/auth/change-password` บังคับ `currentPassword` เพื่อกันเรื่องนี้พอดี) | ปิด = **บีบ endpoint ที่ ship แล้วเป็นครั้งที่ 3** ต้องขึ้นทะเบียน §15 เหมือน C-2/NEW-1 |
| B | **Medium-2** lock/tx contention บน admin-reset ตอนนี้เป็น **500** · §15 แถว 6b บอก `55P03/40P01/P2028` → `409 + details.reason='busy'` "ห้าม 500" | map = **เพิ่ม status ใหม่บน endpoint ที่ ship แล้ว** (contract-evolution) · ไม่ map = ยอมรับ 500 อย่างเป็นทางการ |
| C | **Medium** `auth.password.admin_reset_blocked_*` สร้าง oracle ซ้ำใน audit UI ของ F-005 — org admin ที่เห็น event จะรู้ทันทีว่า target เป็น Owner | ตัดสินตอนนี้ครั้งเดียว ดีกว่าไปเจอตอน F-005 สร้างจอ |

**หนี้จาก qa (T-002-22):** `hashInvitationToken` ยังไม่มีใน `packages/**` (architecture §12.2 item 2ก) ⇒ 3 invite scenario ของ kit ยัง throw · `RESPONSE_HEADER_POLICY` / `TOKEN_RESPONSE_ALLOWLIST` / `TAX_ID_RESPONSE_ALLOWLIST` ยังไม่ถูก export ⇒ header assertion ยังตรวจไม่ได้ · เจ้าของ: T-002-17/19

---

## หนี้ที่เปิดใหม่จาก T-002-15/16 (2026-08-04)

| # | เรื่อง | เจ้าของ |
|---|---|---|
| 1 | ~~`DEFAULT_ROLE_SPECS` ไม่ตรงกับของจริง~~ **ปิดแล้ว** — kit **derive จาก `SYSTEM_ROLE_BLUEPRINT`** ไม่ใช่พิมพ์ซ้ำ · เพี้ยนจริงทั้ง capability (Admin 2 vs 7, Staff 1 vs 3) และ `isSystem` (kit true ทั้งสาม ของจริง Owner ใบเดียว) · เทสต์ที่ hard-code ค่าเดิมก็ derive ตามแล้ว + เทสต์ pin ว่า kit == production (พิสูจน์แดงด้วยการยัด capability ปลอม) | product (ทำแทน qa) |
| 2 | ~~`cleanup()` ไม่ลบ `Warehouse`/`OrgEntitlement`~~ **ปิดแล้ว** — ลบแถวที่ **endpoint จริงสร้าง** (entitlement, warehouse, membership/role/invitation ที่ kit ไม่รู้จัก) โดย scope ด้วย `organizationId` ของ org ตัวเอง ไม่ใช่กวาดทั้งตาราง · ถ้าไม่ทำ FK จะพังใน `afterAll` แล้วโทษเทสต์ใบสุดท้ายที่บังเอิญรันก่อนหน้า | product (ทำแทน qa) |
| 3 | ~~fixture ค้างใน DB ร่วม~~ **ปิดแล้ว** — วัดจริงก่อนแก้: รันหนึ่งรอบเหลือ **65 org / 220 user** · ต้นเหตุ 2 ที่: `auth.e2e.int.test.ts` (ทั้ง block หลักและ block prod-path ที่ signup เอง) และ `refresh-token.service.int.test.ts` (สร้าง user **ต่อเทสต์** ใน `beforeEach` ไม่เคยลบ) · ตอนนี้ลบเฉพาะสิ่งที่ตัวเองสร้าง เรียงตาม FK ไม่ใช่ TRUNCATE (DB ใช้ร่วมกับ suite ที่รันขนาน) · **วัดซ้ำหลังแก้: 0 ทุกตาราง** เหลือแค่ `PlanDefinition` 4 แถวที่เป็น seed จริง | product (ทำแทน qa) |
| 4 | **flake ที่เจอจริงและปิดไปแล้วเฉพาะจุด:** `I1.2` ใช้ bucket IP ร่วมกับทุก suite (`IP_WINDOW_MAX=20`/5 นาที) · vitest รันไฟล์ขนานบน Redis ตัวเดียว ⇒ suite ข้างๆ เติม bucket จนล้นระหว่าง `beforeEach` clear กับ assert ⇒ signup แรกได้ 429 แล้วใบสองได้ 201 แทน 409 · **แก้เฉพาะ `I1.2` ให้มี IP ของตัวเอง — ยังไม่ได้แก้เชิงระบบ** (request อื่นในไฟล์ยังใช้ bucket ร่วม) | qa + backend-api |
| 5 | `app.kit.ts` เสิร์ฟ route ที่มี `@OrgRateLimit` โดยไม่มี Redis ⇒ guard เข้า fail-open แล้ว emit `auth.throttle.fail_open` ทุกครั้งที่สร้าง org · suite ที่ assert `collectSecurityEvents()` **ต้องกรองตาม type** | qa |

> **แก้ brief ที่ผมเขียนผิดเอง:** ผมสรุปใน task ว่า `GET /me/organizations` "คืนแค่ id/ชื่อ/สถานะ" — **ผิด** · api-spec §3.2 (LOCKED) บอกว่า **แถวที่ยัง active คืนรูปเต็ม** (org + membership/role + entitlement) และ **รูปย่อใช้เฉพาะแถวที่ไม่ active ภายใต้ `?status=all`** (M-10) · agent ทำตาม contract ถูกแล้ว

## หนี้ใหม่จาก T-002-18 (2026-08-05)

| # | เรื่อง | เจ้าของ |
|---|---|---|
| A | **`?withTotal=true` ประกาศใน api-spec §1 แต่ `/me/organizations` (T-002-16) ไม่ได้ทำ** — `/members` ทำแล้ว ⇒ สอง endpoint ที่อยู่ใน spec เดียวกันมีพฤติกรรมไม่ตรงกัน | backend-api · ปิดที่ **T-002-21** |
| B | **`findMany` บน org-scoped client (`$extends`) type เป็น `any` และ `OrgLockTxOf<OrgScopedPrismaClient>` ยุบเหลือ `unknown`** ⇒ T-002-18 ต้องประกาศ row shape เองทีละที่ · workaround อยู่ที่ `apps/api/src/tenancy/org-lock.ts` · **ทุก endpoint ถัดไปจะเจอเหมือนกัน** | backend-api (`packages/db`) |
| C | api-spec §1 ลงรายการ §3.7 แต่ไม่ลง §3.8 ทั้งที่ §3.8 ตอบด้วย body ของ §3.7 (มี email) ⇒ ช่องว่างระดับเอกสาร · `RESPONSE_HEADER_POLICY` ครอบให้แล้วโดยรูป | backend-api · ปิดที่ **T-002-21** |
| D | ~~flake ค้าง 2 อาการ~~ **หา root cause เจอและแก้แล้ว** (ดูหัวข้อล่างสุด) · เดิม: **flake ค้าง 2 อาการ** — (1) `orgs.e2e` `socket hang up` 1 ครั้ง (2) `auth.e2e` **I5.5 + อีกใบ แดง 1 ครั้งใน 5 รอบเต็ม** (รอบถัดมา 4 รอบเขียวติด ไม่ได้ข้อความ assertion ไว้) · ทั้งคู่เกิดตอน int suite รันขนานกัน 6 ไฟล์บน Postgres/Redis ตัวเดียว · **ต้องจับ trace ให้ได้ก่อนเดา** — อย่าไล่แก้แบบเดา | qa |

## ช่องว่างเชิงโครงสร้างที่เจอตอนสำรวจ T-002-21 (2026-08-05)

**ไม่มี gate ไหนเทียบ "route ที่ router มีจริง" กับ "path ที่ OpenAPI ประกาศ"**

หลักฐาน ณ วันนี้: F-002 มี endpoint ที่ทำงานได้จริงแล้ว **14 เส้น** (organizations · me/organizations · orgs/{id} ·
tax-profile ×2 · members ×3 · membership · invitations ×4) — และ **ไม่มีสักเส้นเดียวอยู่ใน `openapi.yaml`**
(ยังเป็น 9 path ของ F-000/F-001 เท่านั้น) · ทุก gate เขียวหมด

- `contracts-drift` ตรวจว่า **client ที่ generate ตรงกับ spec** — ไม่ได้ตรวจว่า **spec ตรงกับ server**
- `oasdiff` เทียบ spec↔spec ⇒ endpoint ที่ไม่เคยอยู่ใน spec **ไม่มีอะไรให้ diff**
- `route-registry.kit` เทียบ router กับ `ROUTE_CAPABILITIES` (เรื่องสิทธิ์) ไม่ใช่กับ spec

⇒ **ship endpoint ที่ client ไม่มีทางรู้จักได้แบบเงียบสนิท** และรู้ตัวอีกทีตอน frontend เขียนโค้ดแล้วหา type ไม่เจอ

**ข้อเสนอ (ปิดที่ T-002-21):** เพิ่มเทสต์ที่เดิน `enumerateRoutes(app)` แล้วยืนยันว่าทุก route ที่ไม่ใช่ fixture
ปรากฏใน `openapi.yaml` (และกลับกัน) — รูปเดียวกับ `route-registry.kit` ที่ทำกับตาราง capability อยู่แล้ว
ถ้าไม่มีชั้นนี้ การ "แตกไฟล์ paths/*.yaml" ของ T-002-21 จะเป็นแค่การจัดระเบียบ ไม่ได้ทำให้ spec เชื่อถือได้ขึ้น

## flake ของ int lane — หา root cause เจอแล้ว (2026-08-05)

**อาการ:** `socket hang up` / `Parse Error: Expected HTTP/, RTSP/ or ICE/` โผล่แบบสุ่ม **บนไฟล์ที่ไม่เกี่ยวข้อง**
(รวมไฟล์ unit ล้วน) · agent วัดได้ ~**5 แดงใน 13 รอบเต็ม** · **ไม่ใช่ connection ของ Postgres** —
peak `pg_stat_activity` = 27/100

**Root cause:** ทุก test app เรียกแค่ `app.init()` **ไม่เคย listen** ⇒ supertest **เปิดและปิด server ใหม่ทุก request**
⇒ หนึ่งรอบเต็มคือ listen/close หลายพันครั้ง × fork ที่รันขนาน ⇒ socket ถูกใช้ซ้ำระหว่างกำลัง teardown

**แก้:** `await app.listen(0, "127.0.0.1")` ครั้งเดียวแทน `init()` — supertest ใช้ address เดิมซ้ำ · แก้ 5 จุด
(`test/app.kit.ts` + 4 ไฟล์ใน `src/` ที่ประกอบ app เอง)

**ผลวัดหลังแก้: 8 รอบเต็มเขียวติด · transport error 0 ครั้ง · ที่ full parallelism (ไม่ต้อง cap fork)**

> **บทเรียนเรื่องวิธีแก้:** ระหว่างทางผมลอง cap `maxForks` ตามที่ agent เสนอ — ที่ 4 ยังแดง 1 ใน 4, ที่ 3 ยังแดง 1 ใน 7
> **แล้วพอแก้ root cause จริง ก็ถอด cap ออกได้ทั้งหมด** · ถ้าหยุดที่ cap เราจะได้ suite ที่ช้าลง **และยังแดงอยู่**
> โดยเข้าใจผิดว่าแก้แล้ว · ปุ่มที่กดแล้วอาการเบาลงไม่ใช่หลักฐานว่าเจอสาเหตุ

## T-002-16b — endpoint ที่ PM แตกงานตกเอง (2026-08-06)

**`GET /orgs/{orgId}/roles` (api-spec §3.6) ไม่เคยมีแถวใน tasks.md** ทั้งที่:
- อยู่ใน api-spec §2 ตารางที่เซ็นแล้ว (endpoint ที่ 6 จาก 17)
- ถูกประกาศใน `ANY_ACTIVE_MEMBER_ROUTES.read` ตั้งแต่ T-002-05
- **AC US-3 บังคับให้เลือก role ตอนเชิญ** ⇒ ไม่มี endpoint นี้ = จอเชิญไม่มีข้อมูลใส่ dropdown = AC ทำไม่ได้เลย

**ทำไมถึงรอดมา 5 wave:** `route-registry.kit` รายงานมันเป็น `pending` — tier ที่เป็น "ข้อสังเกต" ไม่ใช่ failure ·
ไม่มีใครอ่าน · **สิ่งที่จับได้จริงคือ route-parity gate ของ T-002-21** ที่เทียบ router กับ spec แล้วเจอว่า
api-spec สัญญา 17 เส้น แต่ ship 16

**แก้แล้ว:** implement + ใส่ spec + **ปิด escape hatch ของ `pending` ทั้ง 3 จุด** (`expect(pending).toEqual([])`
และ `failOnPending: true`) ⇒ นับจากนี้ "ประกาศไว้แต่ยังไม่สร้าง" เป็น **failure ไม่ใช่ note**

> **บทเรียน:** นี่เป็นครั้งที่ 4 ที่ agent ผู้ลงมือจับได้ว่า PM แตกงานตก (ก่อนหน้า: pure fn 7 ไฟล์นับเป็น 5 ·
> event 15 ค่านับเป็น 14 · `Organization` ไม่มีแถวใน §2.2) · ทุกครั้งมีชั้นที่ "รายงานแบบ advisory" อยู่แล้ว
> แต่ไม่มีใครอ่าน — **ชั้นที่ไม่ทำให้ CI แดง ไม่ใช่ชั้นที่ป้องกันอะไรได้**

---

## T-002-W1/W2 — สิ่งที่ตัดสินต่างจาก `web.md` และหนี้ที่เปิดใหม่ (2026-08-06)

### เบี่ยงจาก arch doc 2 จุด (ตั้งใจ — ทั้งคู่แปลง "กฎ" ให้เป็น "type")

1. **`org-access-denied` เป็น kind ของตัวเอง** ไม่ใช่ `{kind:"forbidden", code}` ตามภาพร่าง web.md §3.4
   — api-spec §4 + ux-wireframe §12 สั่งให้สอง 403 นี้ทำ**ตรงข้ามกัน** (ทิ้ง org context ไปหน้าเลือกร้าน
   vs อยู่หน้าเดิม+toast) ถ้าใช้ kind เดียวแล้วอ่าน `code` เอา คนที่ลืมอ่านจะได้พฤติกรรมผิด **และฝั่งที่ผิดคือฝั่งทำลาย**
   (เตะสมาชิกออกจากร้านที่เขายังอยู่) · แยก kind = ลืมแล้วคอมไพล์ไม่ผ่าน
2. **`busy` เป็น kind ของตัวเอง** ไม่ใช่ flag บน `conflict` — ux-wireframe §1.4 บังคับให้เช็ค
   `reason === "busy"` **ก่อน** copy 409 ของจอนั้นเสมอ · แยก kind ทำให้ลำดับนี้เป็นโครงสร้าง
   **wire ไม่เปลี่ยน**: 409 ยังเป็น 409 ⇒ คำสัญญาใน api-spec §1 ที่ว่า client ที่ไม่รู้จัก `reason` ยังทำงานถูก ยังจริง

> ทั้งสองข้อพิสูจน์ด้วยการ revert: รวมสอง 403 = แดง 2 เทสต์ (+1 ที่ระดับ OrgGuard) · ตัดเช็ค busy = แดง 2

### เบี่ยงข้อที่ 3 — `SessionState.authed` ไม่ถือ org list

web.md §3.1 ร่างไว้ว่า `{status:"authed", orgs: OrgSummary[]}` — **ไม่ทำ** เพราะ org list เป็น TanStack query
(`/me/organizations`) ถ้าก๊อปไว้ใน session state ด้วยจะมี **source of truth 2 ที่** สำหรับคำถาม "ฉันอยู่ร้านไหนบ้าง"
ซึ่งเป็นคำถามเดียวกับที่ §12.1 บังคับให้ refetch หลัง `403 ORG_ACCESS_DENIED` ⇒ refetch อัปเดตที่หนึ่ง
แต่ switcher ยังโชว์ร้านที่เพิ่งโดนถอดจากอีกที่

### หนี้ที่เปิดใหม่

| # | เรื่อง | ทำไมยังไม่ปิด | ควรปิดตอน |
|---|---|---|---|
| W-1 | `/select-org` เป็น **placeholder** — มีแค่แถบเตือนกับหัวข้อ ไม่มีรายการร้าน/ปุ่มสร้างร้าน | เป็นจอ S1 ของ W3 · แต่ `OrgGuard` navigate มาที่นี่ตอน `ORG_ACCESS_DENIED` ⇒ ถ้าไม่มี route เลยจะ 404 ซึ่งแย่กว่าปัญหาที่กำลังจัดการ | T-002-W3 (สัญญาที่ต้องคงไว้: query param `?removed=` + แถบ**เหลือง** ไม่ใช่แดง) |
| W-2 | `/o/[orgId]/page.tsx` เป็น **placeholder** — โชว์แค่ชื่อร้าน + ชื่อสิทธิ์ เพื่อพิสูจน์ว่า context ต่อติด | ถ้าไม่มี page เลย Next จะไม่สร้าง route ⇒ layout+guard เป็นโค้ดที่ render ไม่ได้ และคำว่า "org shell ใช้ได้" จะไม่มีอะไรพิสูจน์ | T-002-W3 (AppShell/S3) |
| W-3 | `errorsTh` มี 5 บรรทัดที่ **ux ยังไม่เคยเขียน** (mark `‡new` ในไฟล์): network / server / validation / notFound / conflict ทั่วไป | ux-wireframe ระบุ copy เฉพาะ busy · 403 สองแบบ · client-bug — ที่เหลือเป็น fallback ที่จอจะ override เองอยู่แล้ว ผมไม่แต่งคำแทน ux แบบเงียบ ๆ | ux ยืนยัน (ไม่บล็อก W3) |
| W-4 | `useOrgProfile` อยู่ใน `lib/org/` ไม่ใช่ `features/org/api/` | `ActiveOrgProvider` ต้องใช้ และ `lib/` import `features/` ไม่ได้ (web.md §2.3) — มันเป็น infra จริง ๆ (ทุกจอใต้ `/o/` รอมัน) | — (ตั้งใจ) |
| W-5 | **ยังไม่มี boundary gate ของ web** (`tool/check-boundaries.mjs`, web.md §5.2) — กติกา "feature ห้าม import `openapi-fetch` ตรง" / "`lib/` ห้าม import `features/`" ยังเป็นวินัย | เป็นชิ้นของ "จุด restart" ที่ยังไม่ได้ทำ · ตอนนี้มี 1 feature (auth) จึงยังไม่มีอะไรให้ละเมิด | ก่อน W3 จบ (มี `features/org/` เมื่อไหร่ กติกาเริ่มมีของให้คุม) |
| W-6 | `next.config.mjs` ต้องใส่ `extensionAlias` เพราะ `packages/contracts` เขียน specifier แบบ ESM (`./client.js`) ที่ webpack resolve ไม่ได้ | เดิมไม่พังเพราะ web import contracts แบบ **type-only** เท่านั้น (T-000-09) — พอ import ของจริงถึงโผล่ · `pnpm test`/`tsc` **ทั้งคู่เขียว** มีแต่ `next build` ที่จับได้ | — (ปิดแล้ว · บันทึกไว้เพราะ mobile/back-office จะเจอแบบเดียวกัน) |

> **บทเรียนซ้ำของฟีเจอร์นี้:** `vitest` + `tsc` เขียวไม่ได้แปลว่า build ผ่าน — รอบนี้ `next build` จับได้ 2 อย่าง
> ที่อีกสองด่านมองไม่เห็นเลย (Suspense ของ `useSearchParams`, และ W-6) ⇒ **web task ทุกใบต้องรัน `build` ด้วย ไม่ใช่แค่ test+typecheck**

---

## T-002-W3 — ช่องที่ W1 มองข้าม + คำถามที่ต้องส่งกลับ ux (2026-08-06)

### ช่องที่เจอตอนทำ W3: **มี route tier 2 แบบ แต่ W1 สร้าง client แค่แบบเดียว**

`GET /me/organizations` และ `POST /organizations` เป็น **user-scoped** — ครอบทุกร้าน ไม่ได้อยู่ในร้านไหน
แต่ `createOrgApiClient` ของ W1 แนบ `X-Organization-Id` **เสมอ** ⇒ ถ้าใช้ตัวเดิมยิงสองเส้นนี้
เราจะส่ง org id ไปให้ server บน route ที่ไม่ควรได้รับ ซึ่งเป็น input ของ **I-3 (confused deputy)** ตรง ๆ
— `OrgContextMiddleware` สร้าง org context จาก header **แม้บน route user-scoped**

⇒ เพิ่ม **`createUserApiClient`** (ไม่ส่ง org header เลย + ลบ header ที่ caller ใส่มาเองทิ้ง) ·
`org-client.ts` → `clients.ts` เพราะตอนนี้มีสอง tier จริง ๆ · เทสต์ ★ 2 ใบคุมว่า user-scoped ต้องไม่มี header

> **บทเรียน:** W1 พิสูจน์ว่า "org endpoint ลืมแนบ header ไม่ได้" แต่ไม่ได้ถามคำถามกลับด้าน —
> "endpoint ที่**ไม่ควรมี** header จะแนบไปโดยไม่ตั้งใจได้ไหม" · ด้านที่ไม่ได้ถาม คือด้านที่ไม่มีอะไรคุม

### คำถามที่ส่งกลับ ux (ไม่บล็อก — ผมเลือกทางที่ปลอดภัยกว่าไว้ก่อนแล้ว)

**หน้า "ความปลอดภัย" อยู่ที่ `/settings/security` (root) ไม่ใช่ `/o/{orgId}/settings/security`**
— ต่างจากที่ web.md §2.2 ร่างไว้ว่าให้ย้ายเข้าใต้ org ตอน F-002

เหตุผล: **F-002 สร้างสถานะ "ล็อกอินแล้วแต่ไม่ได้อยู่ร้านไหนเลย" ขึ้นมาเอง** (empty state ของ S1) ·
ถ้าย้ายหน้านี้เข้าใต้ org shell คนกลุ่มนั้นจะ **เปลี่ยนรหัสผ่าน/ดู session ตัวเองไม่ได้เลย** — โดนล็อกออกจาก
การตั้งค่าบัญชีตัวเองเพราะการจัด IA · และหน้านี้ยิง `/auth/*` ซึ่งไม่มี org อยู่แล้ว
⇒ **ต้องการคำตัดสินจาก ux** ว่าจะแก้ web.md §2.2 หรือจะให้มีทางเข้าที่สองสำหรับคนไม่มีร้าน

### หนี้ที่เปิดใหม่

| # | เรื่อง | ปิดตอน |
|---|---|---|
| W-7 | เมนู "ข้อมูลร้าน" → `/o/{orgId}/settings/org` และ "สมาชิก" → `/o/{orgId}/settings/members` **ยัง 404** | W4 · W5 (ต่างจาก W-1: อันนั้นเป็น error path ที่ระบบพาไปเอง อันนี้ผู้ใช้กดเอง = สถานะปกติของ feature ที่ทำครึ่งทาง) |
| W-8 | ปุ่ม "โหลดเพิ่ม" ของ S1 แสดงเป็น**ข้อความ** ยังกดไม่ได้ (มี `nextCursor` แต่ยังไม่ต่อ) | F-010 (`DataTable`/paging pattern) — cap 50 ร้าน/คน ทำให้เกิดยากมาก |
| W-9 | S2 สำเร็จแล้วส่ง toast ผ่าน query param `?created=` แต่ **ยังไม่มีใครอ่าน** (จอปลายทางคือ S4 ของ W4) | W4 |
| W-10 | ยังไม่ได้ seed cache ของ org profile จาก 201 ของ `POST /organizations` (ux Q5 บอกว่าทำได้) — เลือก invalidate แทน | — (ตั้งใจ: `NewOrganization` คนละ shape กับ `OrgProfile` — ไม่มี `myMembership`/`counts` ⇒ ยัดลง key เดียวกันจะได้ object ผิดรูปตรงที่ `OrgGuard` อ่าน `myMembership.capabilities`) |
| W-11 | `OrgSwitcher` ใช้ `<details>` ยังไม่ใช่ dropdown ตาม design-system §9 | เมื่อ component library มี `DropdownMenu` จริง (D-031 §9) |

---

## T-002-W4 — TIN reveal: เหตุผลของรูปทรง + หนี้ (2026-08-06)

### ทำไม reveal เป็น `useMutation` ไม่ใช่ `useQuery`

`POST /orgs/{orgId}/tax-profile/reveal` เป็น response **เดียวในระบบ**ที่มีเลขเต็ม และเมื่อ
`entityType = personal` เลขนั้น**คือเลขบัตรประชาชน** · ใช้ `useQuery` ผิด 3 ทาง ซึ่งแต่ละทาง
ทำลายสิ่งที่ฝั่ง server ตั้งใจทำ:

1. **query cache เก็บผลลัพธ์** ⇒ เลขอยู่ยาวกว่าจอ และโผล่ใน devtools cache inspector — นับเป็น "persist" แล้ว แม้ไม่แตะ storage
2. **`refetchOnWindowFocus`** (default ของเรา) ⇒ สลับแท็บกลับมา = reveal ใหม่เงียบ ๆ **กิน 20 ครั้ง/ชม.** + emit `org.tax_profile.revealed` ที่ไม่มีใครสั่ง
3. query เป็น declarative — รันเพราะ component render · แต่ ux-wireframe §5 บอกชัดว่านี่คือ **"การกระทำที่ตั้งใจ"**

⇒ mutation + `gcTime: 0` + ค่าอยู่ใน `useState` ของจอเท่านั้น · **ไม่มี `onSuccess` เขียน cache ที่ไหนเลย**

### รูปของ state ที่เป็นตัวกันเอง (`tax-reveal.ts`)

`{ status: "hidden" }` **ไม่มี field ให้เก็บเลข** — ต่างจาก `{ visible: false, taxId: "…" }` ซึ่งจะผ่านเทสต์ระดับ render
ได้สบาย ๆ ทั้งที่เลขยังอยู่ใน memory + React DevTools ตลอดอายุจอ · เทสต์จึง assert ว่า **เข้าถึงไม่ได้** ไม่ใช่แค่ **ไม่ถูก render**

พิสูจน์แดงแล้ว 2 regression: ถอด tier gate ของการ์ดภาษี + ทำให้ "ซ่อน" ไม่ทิ้งค่า ⇒ **แดง 6 เทสต์** (ทั้งชั้น pure และชั้น render)

### บั๊กที่ผมทำเองแล้วจับได้ก่อน commit

ลิงก์ **"ออกจากร้านนี้"** ผมชี้ไป `/o/{orgId}/settings/members?leave=1` — ซึ่ง**พนักงานเปิดไม่ได้**
ทั้งที่ D-029 + §5 ให้ลิงก์นี้อยู่บนจอนี้ **เพราะพนักงานต้องหาเจอ** ⇒ ส่งพนักงานไปเจอ 403 สำหรับสิ่งที่เขามีสิทธิ์ทำ
· แก้เป็น `?leave=1` บน route เดิม (W6 จะ render confirm §10.3 ตรงนั้น)

### หนี้ที่เปิดใหม่

| # | เรื่อง | ปิดตอน |
|---|---|---|
| W-12 | `?leave=1` ยังไม่มีใครอ่าน — confirm §10.3 ยังไม่ได้ทำ | W6 |
| W-13 | `?created=` จาก S2 และ toast "บันทึกชื่อร้านแล้ว" / "บันทึกข้อมูลผู้เสียภาษีแล้ว" **ยังไม่มี Toast host** — dialog ปิดเงียบ ๆ เมื่อสำเร็จ | W6 (มี `components/ui/Toast.tsx` อยู่แล้วแต่ยังไม่มีที่แขวนระดับแอป) |
| W-14 | S5 confirm "บันทึกทับ" ทำเป็น 2-step ในปุ่มเดิม ยังไม่ใช่ `ConfirmDialog` ตาม design-system | W6 (มี `ConfirmDialog` อยู่แล้ว) |
| W-15 | `?invite=1&role=owner` (D-030 ชวนเจ้าของร้านสำรอง) ยังไม่มีใครอ่าน | W5 |
| W-16 | ยังไม่ได้ทำ `RouteGuard`/`ForbiddenPanel` — เข้า URL ตรงไปหน้าที่ไม่มีสิทธิ์ยังไม่มีจอรองรับ (§12.2) | W6 · F-003 (`RouteGuard` เต็มเป็นของ F-003/F-007 ตาม web.md §3.3) |

---

## ★ Security review รอบ build — ผลและสถานะ (2026-08-06)

รายงานเต็ม: [security-review-build-A.md](security-review-build-A.md) (credential/secret) ·
[security-review-build-B.md](security-review-build-B.md) (tenancy/authz/lock/contract + delta)
scope `f66451f..625f746` · reviewer 2 ใบแยกกัน (opus แทน fable ตามที่ user สั่ง) · **Part B ตาย session limit
หลังเขียนรายงานเสร็จแล้ว** — ค้างเฉพาะ HTTP probe เพิ่มเติมของคำถาม coordinator

| ระดับ | A (credential) | B (tenancy) |
|---|---|---|
| 🔴 Critical | 1 (A-1) | 0 |
| 🟠 Important | 3 | 2 |
| 🟡 Medium | 3 | 3 |
| 🔵 Minor | 5 | 4 |

### ที่ผม verify เองแล้ว (ไม่รับ finding โดยไม่ทดสอบซ้ำ)

- **A-1 (🔴) — `SYSTEM_PRISMA` jail มีทางออกที่ไม่มีใครเฝ้า · ยืนยัน** ผมวางไฟล์ใน `src/orgs/` ที่
  `@Inject(PrismaService)` แล้ว `prisma.client.membership.findMany({})` (client ที่ไม่ผ่าน `withOrgScope`)
  ⇒ **allowlist test ผ่าน 5/5 · `pnpm depcruise` รายงาน "0 boundary violations"** · ยังไม่มี leak จริงวันนี้
  แต่รั้วของกฎทองข้อ 3 ไม่ทำงาน และท่านี้คือท่าที่ `auth/`/`health/` ใช้อยู่ให้ลอกได้ทันที **→ ยังไม่แก้**
- **A-3 = B-4 (reviewer 2 ใบเจอตรงกัน) — gate ของผมเองถูกหลบ · ยืนยันแล้ว + แก้แล้ว** ดูหัวข้อถัดไป

### A-3/B-4 — ครั้งที่ 4 ที่ชั้นป้องกันของฟีเจอร์นี้ "เขียวโดยไม่ทำงาน" (และครั้งที่ 2 ที่เป็นของผมเอง)

`controller-tier-marks.test.ts` ที่ผมเขียนแทน guard เดิมของ High-1 ใช้ regex ที่บังคับให้ tier decorator
ติดกับ `@Controller` **decorator คั่นหนึ่งบรรทัดก็หลบได้:**

```ts
@UserScoped()
@Injectable()          // ← บรรทัดเดียวนี้ทำให้ทั้ง gate ตาบอด
@Controller("orgs/:orgId/roles")
```

ผมทำซ้ำเองแล้ว: ใส่ shape นี้ที่ `roles.controller.ts` จริง → **4 passed** · ลำดับ decorator ใน TypeScript อิสระ
และนี่คือ shape ที่เกิดจาก **การแก้ไขธรรมดา** (เติม `@Injectable()`/`@ApiTags()` ทับของเดิม) ไม่ใช่ท่าแปลก

**แก้:** แยก parser ออกเป็น `controller-tier-marks.parse.ts` แล้ว**เทสต์ตัว parser เอง** — เดิม regex อยู่ในไฟล์เทสต์
และสิ่งเดียวที่ออกกำลังมันคือ assertion ที่มันทำให้ vacuous ⇒ ไม่มีทางจับได้เลยตามโครงสร้าง ·
parser ใหม่เดินย้อนขึ้นทั้ง decorator block · พิสูจน์แดง: ใส่ shape เดิม → **แดง 3 เทสต์ ระบุชื่อไฟล์**

> **บทเรียนที่ควรจำมากกว่าตัวบั๊ก:** ผมเขียน guard นี้ *เพราะ* guard ก่อนหน้าเป็น illusory —
> แล้วเขียน guard ที่ illusory คนละแบบ · **ชั้นป้องกันที่ไม่มีเทสต์ของตัวเอง = ชั้นป้องกันที่ยังไม่ถูกตรวจ**

### ยังไม่แก้ — ต้องตัดสินก่อน merge

| # | เรื่อง | เจ้าของ |
|---|---|---|

### A-1 🔴 ปิดแล้ว (2026-08-06) — สองด่าน และวัดว่าแต่ละด่านพลาดตรงไหน

**รากของปัญหาไม่ใช่ regex ผิด แต่คือ gate ตรวจ "ตัวอย่างของกฎ" แทน "ตัวกฎ"**
กฎจริงคือ *"unfiltered client ถูกขังไว้ใน allowlist §2.1"* แต่ gate ไปแมตช์ชื่อ token `SYSTEM_PRISMA`
ซึ่งเป็นแค่**หนึ่งในสองประตู** · ประตูที่สองคือ `PrismaService` เอง — `PrismaModule` เป็น `@Global()`
⇒ feature module ไหนก็ inject ได้โดยไม่ต้อง import module และ `.client` บนนั้นคือ client ที่ไม่ผ่าน `withOrgScope`

| ด่าน | ปิดยังไง | จับอะไรที่อีกด่านไม่จับ |
|---|---|---|
| textual — `system-prisma-allowlist.test.ts` | สแกนหา **ทั้งสองชื่อ** (`SYSTEM_PRISMA` + `PrismaService`) นอก allowlist | จุด inject ที่ depcruise ไม่เห็น direct edge |
| import graph — depcruise rule ใหม่ `api-prisma-service-allowlisted` | ห้าม `prisma/prisma.service`/`prisma.module` จากนอก allowlist | import ที่ **เปลี่ยนชื่อ binding** ตอน import |

**ที่แก้เพิ่มเพราะเจอระหว่างทาง:**
- `run-api-boundaries.mjs` เดิมเช็คแค่ *"fixture โดนจับไหม"* → เปลี่ยนเป็น **"fixture โดนจับโดยกฎของตัวเองไหม"**
  (ไม่งั้นกฎใหม่ ship ตายได้ — fixture ไปโดนกฎเก่าจับแทน แล้ว run ก็ยังเขียว)
- `app.module.ts` ถูก clean scan จับ (import `PrismaModule` = งานของ composition root) → ยกเว้นเฉพาะ **module**
  ไม่ยกเว้น service · ปลอดภัยเพราะถ้าไฟล์นั้นเอ่ยชื่อ `PrismaService` เมื่อไหร่ textual gate จับทันที (src root ไม่ใช่ allowed prefix)
- fixture ใหม่ทำให้ textual gate แดงเอง (มันตั้งใจละเมิด) → exclude `__boundary_fixtures__/` แบบเดียวกับที่ depcruise ทำ

**⚠️ ความเสี่ยงที่เหลือ — วัดแล้ว ไม่ใช่เดา:** ทั้งสองด่าน **ไม่จับ** การ launder ผ่าน re-export ที่เปลี่ยนชื่อ
```ts
// ในไฟล์ที่อยู่ใน allowlist เช่น tenancy/index.ts
export { PrismaService as Db } from "../prisma/prisma.service";
// ในไฟล์ feature
import { Db } from "../tenancy";
```
ผมลองจริงแล้ว **เขียวทั้งคู่** (textual ไม่เห็นชื่อ · depcruise เห็น edge เป็น `orgs→tenancy` ไม่ใช่ `orgs→prisma.service`) ·
กฎแบบ `reachable` จะจับได้แต่จะจับ path ที่ถูกต้องผ่าน ORG_PRISMA provider ไปด้วยทั้งหมด ⇒ ไม่คุ้ม ·
**ยอมรับความเสี่ยงนี้อย่างเปิดเผย** เพราะการ launder ต้อง **แก้ไฟล์ใน allowlist** ซึ่งเป็นการกระทำที่ตั้งใจและอยู่ในไดเรกทอรีที่ถูกรีวิว
— ต่างจากรูเดิมที่ต้องการแค่ "ไฟล์ใหม่ในโฟลเดอร์ feature" เท่านั้น

> เขียนไว้ใน `__boundary_fixtures__/prisma-service-leak.ts` ด้วย — **comment ที่อ้างการป้องกันเกินจริง อันตรายกว่าไม่มี comment**
> (ฉบับแรกที่ผมเขียนอ้างว่า import graph จับ laundering ได้ · ทดสอบแล้วไม่จริง · แก้ก่อน commit)

### A-2 🟠 ปิดแล้ว (2026-08-06) — แก้ที่**ลำดับ** ไม่ใช่แค่เพิ่ม validation

`maskEmail(email)` ถูกเรียก **post-commit** (ใช้ป้อน audit event) และมันโยนเมื่อแยก local/domain ไม่ได้
⇒ ลำดับเดิมคือ **commit invitation → throw → `500 INTERNAL`** โดยทิ้งแถว `pending` ที่ถือ token ซึ่งไม่มีใครเคยได้รับ

แถวนั้นไม่ใช่ความเสียหายเชิงความสวยงาม: ที่อยู่นั้น**เชิญไม่ได้อีกเลย** (`409 INVITATION_PENDING` ทุกครั้งที่ลองใหม่)
ตลอด TTL และกิน 1 ใน 100 slot ของร้าน · ที่ 30 create/ชม. ผู้ถือ `manage_members` ทำให้ cap เต็มได้ใน ~4 ชม.
โดย**ทุก response ดูเหมือนบั๊กของเซิร์ฟเวอร์ ไม่ใช่การโจมตี**

**แก้:** ย้ายการคำนวณ mask มา**ก่อน** transaction ⇒ สถานะ "commit แล้วแต่ mask ไม่ได้" **ไปถึงไม่ได้เชิงโครงสร้าง**
เพราะไม่มีอะไรถูก commit จนกว่าค่าจะมีอยู่จริง · การเพิ่ม guard เฉย ๆ จะทิ้งกับระเบิดเดิมไว้ให้ที่อยู่ตัวถัดไปที่ `maskEmail` ไม่รับ

**+ ใช้ `isValidEmailShape` เป็น guard ไม่ใช่ "อะไรก็ได้ที่ `maskEmail` ทน"** — `maskEmail` ยอมรับ `a@b`
ซึ่ง **signup ปฏิเสธ** ⇒ เชิญที่อยู่ที่ไม่มีวันสมัครบัญชีได้ = คำเชิญที่ไม่มีใครรับได้ แต่กิน slot ไปจนหมดอายุ ·
นิยามของคำว่า "อีเมล" ต้องเป็นอันเดียวกันทั้ง signup และ invite ไม่งั้นสองเส้นจะเถียงกันว่าใครมีตัวตนได้

**พิสูจน์:** RED ก่อน (`expected 500 to be 422` + `MaskEmailError` ใน log) → GREEN → ย้าย `maskEmail` กลับไปหลัง commit ⇒ **แดง 3 เทสต์**
· int lane 17/17 · เทสต์ยิงผ่าน stack จริงและ assert ว่า **ไม่มีแถวหลุดออกมา** ไม่ใช่แค่เช็ค status code

> **ระวังตอนเขียนเทสต์:** ฉบับแรกของผมใช้ `somchai@@shop.com` เป็นตัวอย่าง "อีเมลพัง" — **ผ่านทันที**
> เพราะ `lastIndexOf("@")` ทำให้ mask ได้ (local = `somchai@`) ⇒ เทสต์เขียวโดยไม่เคยแตะบั๊กเลย ·
> แก้เป็น `not-an-email` แล้วถึงแดงจริง — **ตัวอย่างที่ "ดูพัง" กับตัวอย่างที่ "พังจริงตามโค้ด" ไม่ใช่สิ่งเดียวกัน**

### A-4 🟠 ปิดแล้ว (2026-08-06) — สองครึ่งของกฎเดียวกัน ต้องแปลจากต้นฉบับเดียวกัน

`expired` เป็นค่าที่ **compute ตอนอ่าน ไม่เคยถูกเขียน** (บรรทัดแรกของ `core-domain/orgs/invitation-status.ts`
เขียนไว้ตรง ๆ) แต่ list ทำสองอย่างที่ขัดกับข้อนั้น:

| ครึ่ง | เดิม | ผล |
|---|---|---|
| render | `status: row.status as InvitationRow["status"]` — cast ค่า **stored** เป็นชนิด **resolved** | คำเชิญที่หมดอายุรายงานว่า `pending` |
| filter | `{ status: input.status }` — ยิงตรงเข้าคอลัมน์ | `?status=expired` คืน `[]` **ตลอดกาล** |

**ทำไมเป็นเรื่องความปลอดภัย ไม่ใช่แค่ UX:** จอนี้คือ **ที่เดียว**ที่เจ้าของร้านเห็นว่ามี credential ค้างกี่ใบ
(F-005 ยังไม่มี · event เป็น log อย่างเดียว) ⇒ มันบอกเกินจริงว่าลิงก์ไหน "ยังมีชีวิต" และคนที่อยากตามล้างของเก่า
**หาไม่เจอ** เพราะตัวกรองบอกว่าไม่มีอะไรต้องล้าง

**แก้:** `toRow(row, now)` เรียก `resolveInvitationStatus` · `invitationStatusFilter(status, now)` แปล
`pending → {status:'pending', expiresAt:{gt:now}}` และ `expired → {status:'pending', expiresAt:{lte:now}}` ·
`accepted`/`cancelled` เป็น terminal — นาฬิกาไม่มีสิทธิ์ลบล้างสิ่งที่เกิดไปแล้ว

**นาฬิกาเดียวต่อหนึ่งหน้า** — `const now = new Date()` ครั้งเดียวใน `list()` แล้วส่งเข้าไปทั้งสองครึ่ง ·
ถ้าอ่าน `new Date()` สองครั้ง แถวที่อยู่พอดีเส้นแบ่งจะผ่าน filter แต่ render ออกมาเป็นอีกสถานะหนึ่ง

**พิสูจน์:** RED (`expected 'pending' to be 'expired'`) → GREEN → **revert ทีละครึ่ง** ⇒ แดงทั้งสองครั้ง
(เทสต์เดียวจับได้ทั้งสองด้าน เพราะมัน assert ว่าสองครึ่ง**เห็นตรงกัน** ไม่ใช่ assert แต่ละครึ่งแยกกัน) ·
+ เทสต์ terminal-state (cancelled ที่เลย expiry แล้ว ต้องยังเป็น `cancelled` และไม่โผล่ใน `?status=expired`) ·
int lane เต็ม **182/182**

> **หมายเหตุจาก reviewer ที่ยังไม่ได้ปิด:** A-9 บอกว่า reissue คำเชิญที่หมดอายุแล้วได้ `200` ⇒ ใบ Owner ที่ผู้ใช้
> คิดว่า "ตายแล้ว" ยังเป็นประตูที่กดปุ่มเดียวเปิดใหม่ได้ · ตอนนี้อย่างน้อย**มองเห็นมันแล้ว** (`?status=expired` ใช้ได้จริง)
> แต่ยังต้องตัดสินว่าจะห้าม reissue ใบที่หมดอายุไหม — ยังเปิดอยู่

### A-9 🔵→ปิดแล้ว (2026-08-06) — **ห้าม reissue ใบที่หมดอายุ** (user ตัดสิน · กลับคำตัดสินเดิม)

เดิม reissue รับคำเชิญที่หมดอายุแล้วคืน 200 พร้อม token ใหม่ 24 ชม. — เป็น**การตัดสินใจที่จงใจ**
(comment อ้าง architecture §3.2: "ไม่งั้นจะเป็นทางตันบนจอ") · reviewer ไม่ถือเป็นข้อผิดแต่บันทึกผลรวมไว้

**ผลรวมที่ทำให้ต้องกลับคำ:** คำเชิญที่หมดอายุยัง**เก็บเป็น `pending`** (ไม่มี write path สำหรับ `expired`)
⇒ ใบ Owner ที่ออกไว้เมื่อไหร่ก็ตาม เป็น**ออปชันถาวร**ของผู้ถือ `full_access` · ไม่ถูกนับใน cap (cap นับเฉพาะ `expiresAt > now`)
· และก่อนปิด A-4 **มองไม่เห็นในตัวกรองไหนเลย** ⇒ "ลิงก์ที่คุณคิดว่าตายแล้ว อยู่ห่างจากการมีชีวิตแค่ปุ่มเดียว"
ไม่ใช่คุณสมบัติที่ credential ของ membership ควรมี

**ก่อนปิดประตู ต้องพิสูจน์ว่ามีทางออกจริง** — ไม่ใช่เชื่อ comment เดิมที่บอกว่าเป็นทางตัน:

| ขั้น | ได้ผลไหม | ทำไม |
|---|---|---|
| `cancel` ใบที่หมดอายุ | ✅ ได้ | cancel เช็ค **column** (`status !== "pending"`) ไม่ใช่ derived status ⇒ ใบหมดอายุยังเป็น `pending` ในคอลัมน์ |
| เชิญคนเดิมใหม่ **ก่อน** cancel | ❌ `409 INVITATION_PENDING` | partial unique index `("organizationId","email") WHERE status='pending'` ยังถูกจอง |
| เชิญคนเดิมใหม่ **หลัง** cancel | ✅ `201` | slot ถูกปล่อยแล้ว |

⇒ ทางออกคือ **cancel → เชิญใหม่** สองขั้นที่ตั้งใจ แทนการชุบชีวิตเงียบ ๆ ขั้นเดียว · **ไม่ใช่ทางตัน**
· error `INVITATION_PENDING` พก `expiresAt` มาด้วยอยู่แล้ว ⇒ UI แยกออกว่า "หมดอายุ" กับ "ค้างจริง" ต่างกัน

**ที่ไม่ทำ:** ไม่ผ่อน `assertNoPendingInvitation` ให้มองข้ามใบที่หมดอายุ — จะชน partial unique index เป็น 500 ·
และไม่เขียน `expired` ลงคอลัมน์ เพราะ data-model §2 ประกาศว่าค่านั้นไม่มี write path

**contract:** เพิ่ม `INVITATION_EXPIRED` เข้า description ของ **409 ที่ประกาศอยู่แล้ว** — additive ล้วน
ไม่มี status ใหม่ ไม่มี code ใหม่ (อยู่ใน registry ตั้งแต่ต้น) ⇒ ไม่ต้องปลด LOCKED

**พิสูจน์:** RED (`expected 200 to be 409`) → GREEN → ถอด guard ⇒ แดงอีก · เทสต์ assert เพิ่มว่า
**การปฏิเสธต้องไม่ขยับ `tokenHash`/`tokenIssuedAt`** (วินัยเดียวกับ branch FORBIDDEN — 409 ที่ rotate token ไปแล้ว
คือการทำความเสียหายพร้อมกับบอกว่า "ไม่") · int lane เต็ม **184/184**

### B-1 🟠 ปิดแล้ว (2026-08-07) — และระหว่างปิดเจอรูที่**ใหญ่กว่าที่รายงาน**

ยืนยันเองก่อน: client ที่ scope ไป org A เขียน `roleId` ของ org B (`full_access`) ลง membership **สำเร็จ**

**แต่พอใส่ composite FK แล้วเทสต์ `nested connect` ยังเขียว** — ไล่ดูถึงรู้ว่ามันไม่ใช่ "FK ยังไม่ครอบ"
แต่เป็นรูคนละใบ และ **FK ของผมเปลี่ยนรูปมันให้แย่ลง**:

```
data: { role: { connect: { id: <role ของ org B> } } }
```
พอ `Membership.role` อ้าง `Role(organizationId, id)` แล้ว Prisma ตั้ง **ทั้งสองคอลัมน์** จากแถวที่ connect
⇒ **membership ย้ายไป org B ทั้งแถว** · FK ช่วยไม่ได้เพราะคู่ที่ได้ถูกต้องตามข้อจำกัดทุกประการ มันแค่เป็นของคนอื่น ·
และ `data.organizationId` ไม่เคยถูกเขียน ⇒ `assertMatchesContext` ไม่มีโอกาสเห็นเลย

⇒ **ต้องปิดสองชั้น** และแต่ละชั้นจับคนละทาง (พิสูจน์ด้วยการถอดทีละอัน ⇒ แดงคนละเทสต์):

| ชั้น | ปิดอะไร |
|---|---|
| composite FK `(organizationId, roleId) → Role(organizationId, id)` | scalar `roleId` ข้าม org (Membership + Invitation) |
| `guardWriteData` ปฏิเสธ **nested relation write** ทุกชนิดบน model ที่ scope | `connect`/`create`/`upsert`/… ที่ย้าย org column โดยไม่เอ่ยชื่อมัน |

**ทำไมปฏิเสธแทนที่จะตีความ:** การ verify nested write ต้องรู้ว่า model ไหน relation ไหนพก org column
และแต่ละ verb ทำอะไรกับมัน — เป็นตารางที่ต้องถูกตลอดไป · production ใช้ nested write **ศูนย์จุด** ⇒ fail-closed ได้ฟรี
· `set` **ไม่**อยู่ในรายการที่ห้าม เพราะ scalar list (`capabilities: { set: [...] }`) ใช้คำเดียวกัน — มีเทสต์คุมไว้

**migration** `20260807000000_f002_role_org_composite_fk` · reversible เต็ม (เขียน rollback SQL ไว้ในไฟล์) ·
มี **pre-flight** ที่ `RAISE EXCEPTION` พร้อมคำสั่ง SELECT ให้ไปดูแถวที่ละเมิด — **ไม่ลบอะไรทั้งสิ้น**
เพราะ membership ที่ชี้ role ข้าม org คือเหตุการณ์ความปลอดภัยที่ต้องมีคนดู ไม่ใช่ขยะให้กวาด (skill `prisma-migration`)
· scan ก่อน migrate: 0 Membership / 1 Invitation — และแถวนั้นเป็น **เศษจาก RED test ของผมเอง**
(`afterAll` ลบ invitation ไม่ครบ ⇒ `role.deleteMany` พังเงียบ) แก้ cleanup แล้ว

**เทสต์เก่าที่ต้องเขียนใหม่:** `INVITATION_ROLE_UNAVAILABLE (M-6)` เดิม **seed สถานะข้าม org โดยตรง**
เพื่อพิสูจน์ว่า service เช็ค — ตอนนี้ seed นั้น**ทำไม่ได้แล้ว** · comment ของมันที่ว่า "DB ยอมรับ, check นี้คือสิ่งเดียวที่ไม่ยอม"
กลายเป็นเท็จ ⇒ เปลี่ยนเป็น assert ว่า**สถานะนั้นสร้างไม่ได้** ซึ่งเป็นคุณสมบัติที่แข็งกว่า ·
branch `INVITATION_ROLE_UNAVAILABLE` **ไม่ใช่ dead code** — ยังตอบเคส "role ถูกลบ" ที่ F-003 จะทำให้ไปถึงได้

**comment ที่ reviewer บอกว่าโกหก** (`members.service.ts` — "impossible by construction rather than by an `if`")
แก้แล้ว · ตอนนี้ประโยคนั้นจริง แต่**ด้วยเหตุผลคนละอัน** และเขียนกำกับไว้ว่าเหตุผลคืออะไร

`packages/db 185` · `api 631 unit` · **int lane 184/184** · typecheck ✓ lint ✓ depcruise PASS

### B-2 🟠 ปิดแล้ว (2026-08-07) — แถวที่สองเป็นโค้ดตาย ที่อ่านแล้วเหมือนบังคับใช้

`responseHeaderPolicyFor` เป็น `.find()` ⇒ **แถวที่สองของ route เดิมไม่มีทางถูกเรียก** · 4 route ของ invitation
ถูกประกาศสองครั้ง: block แรก (T-002-19) ให้ header ชุด**อ่อนกว่า** + `carries: ["tin"]` ทั้งสี่แถว ·
block หลัง (T-002-18) ถูกต้อง — แต่แพ้ทุกครั้ง

**สิ่งที่ผิดจริง 2 อย่าง:**
1. `GET …/invitations` และ `DELETE …/{invitationId}` resolve ได้ชุดที่**ไม่มี** `Referrer-Policy: no-referrer` (I-6)
   · และ controller ก็ set ชุดอ่อนพอดี ⇒ **สองฝั่งเห็นตรงกัน แต่ตรงกันที่ค่าที่ผิด — ซึ่งแย่กว่าไม่ตรงกัน เพราะความตรงกันดูเหมือนหลักฐาน**
2. `carries` ของทั้งสี่เป็น `["tin"]` ทับ `["token","email"]`/`["email"]` ⇒ assertion ที่เขียนตามความจริงจะแดง
   โดยไม่มีใครอธิบายได้ และทางแก้ที่คนจะเลือกคือ**แก้ assertion ไม่ใช่แก้ตาราง**

**ทำไมด่านที่มีอยู่มองไม่เห็น:** header ของไฟล์ประกาศว่าตารางถูกตรวจสองทิศ (route ที่คืน PII ต้องมีในตาราง /
ตารางต้องไม่มี route ที่ไม่มีจริง) — แต่ **key ซ้ำ ไม่ใช่ "route หาย" และไม่ใช่ "body ไม่ถูกจัดประเภท"**
ทั้งสองทิศจึงผ่านฉลุย

**แก้:** ลบ block ที่ผิด · controller ทั้งสองจุดใช้ `INVITATION_RESPONSE_HEADERS` ·
เพิ่มเทสต์ 3 ใบ — **key ต้อง unique** (ด่านใหม่ที่ไม่มีมาก่อน) + resolver ต้องคืน `no-referrer` ทุก invitation route
+ `carries` ต้องตรงกับสิ่งที่ route นั้นถืออยู่จริง · เทสต์ผูกกับ **resolver** ไม่ใช่กับตาราง ⇒ ยังจริงไม่ว่าจะจัดเรียงแถวใหม่ยังไง

**พิสูจน์:** RED ทั้งสามใบตรงตามรายงาน → GREEN → ใส่แถวซ้ำกลับ ⇒ แดงทั้งสาม

`api 634 unit` (+3) · **int lane 184/184** · typecheck ✓ lint ✓

### A-8 / A-10 / A-11 ปิดแล้ว (2026-08-08) — สามข้อที่แพงตอนพลาด แต่ถูกมากตอนแก้

**A-8 🔵 — key separation อยู่แค่ตอน boot** · `resolveInvitationTokenSecret` รับประกันแค่ "มีและยาวพอ"
ส่วนกฎ §7.3 (`INVITATION_TOKEN_SECRET` ต้องต่างจาก JWT secret) อยู่ใน `superRefine` ของ `loadEnv` ⇒
**process ที่ไม่ได้บูตผ่าน `loadEnv`** (seed script, worker ในอนาคต, test harness ที่ตั้ง env เอง)
แฮช invite token ด้วยคีย์เดียวกับ JWT ได้ แล้วทำงานปกติทุกอย่าง — วันที่ JWT secret หลุด มันจะปลอม invite token ได้ด้วย
· `packages/db` เรียก resolver นี้**ทุกครั้งที่แฮช** ⇒ ย้ายการเช็คมาไว้ตรงที่คีย์ถูกใช้จริง ไม่ใช่ตรงที่ process บังเอิญเริ่ม
· ข้อความ error ระบุ**ชื่อตัวแปร ไม่ใช่ค่า** (มันลง log — ระบุค่าคือเอา secret ทั้งสองตัวไปไว้ใน log)

**A-10 🟡 — event ตระกูล invitation ไม่อยู่ใน strict payload filter** · มันพึ่งสองอย่างที่ไม่ใช่การบังคับ:
(ก) ทุก call site จำได้ว่าต้องเรียก `maskEmail` (ข) `REDACTED_PAYLOAD_KEYS` ตัด key ที่ชื่อ `email` เป๊ะ ·
แต่มัน **ไม่ตัด `emailMasked`** (ถูกแล้ว — นั่นคือ key ที่ตั้งใจส่ง) ⇒ call site ที่ยัด**อีเมลเต็ม**ใส่ `emailMasked` ผ่านทุกด่าน
· `org.tax_profile.*` อยู่ใน strict list ด้วยเหตุผลนี้เป๊ะ · เพิ่ม `org.invitation.*` + `org.member.reactivated`

> **ผลข้างเคียงที่ต้องตามแก้:** เทสต์เดิม "no over-filtering" ใช้ `org.invitation.accepted` เป็นตัวอย่าง event ที่ **ไม่** strict
> — พอมันกลายเป็น strict เทสต์นั้นจะ assert ตรงข้ามกับกฎ · ย้ายไปใช้ `org.member.role_changed` (ยัง non-strict จริง)
> แล้วเพิ่มเทสต์อีกใบว่า strict event **ไม่เสีย field ที่ประกาศไว้** (`userCreatedAfterTokenIssued` มีคำว่า "Token" —
> ถ้า match แบบ substring มันจะหายทันทีที่ event นี้เป็น strict)

**A-11 🔵 — `org-scope.guard` ประกอบ log จาก `originalUrl` ดิบ** (มี query string) ขณะที่ `capability.guard` ผ่าน `normalizePath`
· วันนี้ยังไปไม่ถึง (เส้น invitation รับ token ทาง body เท่านั้น — I-6) แต่ **สอง guard ที่ต่างกันแปลว่าวันหนึ่งตัวหนึ่งจะ log สิ่งที่อีกตัวไม่ log**
· ทำให้เหมือนกันจบ

`api 636` (+2) · `config 57` (+4) · `packages/db 185` · **int lane 184/184** · typecheck ✓ lint ✓

### B-3 🟡 ปิดแล้ว (2026-08-08) — และทิศ "wire → policy" ที่เอกสารอ้างมาตลอด **ไม่เคยมีอยู่จริง**

header ของ `response-headers.ts` ประกาศว่าตารางถูกตรวจสองทิศ · ทิศแรกมีจริง ·
ทิศที่สอง (**route ที่คืน PII แต่ไม่มีในตาราง = แดง**) เป็น **prose ล้วน** — `carries` ถูกเขียนทุกแถวแต่ไม่มีอะไรอ่านมัน
ยกเว้น spot check 2 บรรทัดที่เขียนมือ

⇒ `GET /me/organizations` ship ออกไปโดย**ไม่มีแถวและไม่มี `Cache-Control` เลย**

**ทำไมหลุด — และมันเป็นรูปเดียวกับที่เจอมาทั้งฟีเจอร์:** prose เขียน trigger ไว้ว่า "token, email หรือ TIN"
· `/me/organizations` ไม่คืนสามอย่างนั้น มันคืน **membership** ซึ่งเป็นคลาสที่ `ResponseSensitivity` **ประกาศไว้แล้ว**
และตารางก็**ใช้มันเป็นเหตุผลใส่ route อยู่แล้ว** (`DELETE …/membership` อยู่ในตารางด้วยเหตุผลนี้เป๊ะ) ·
taxonomy รู้ แต่ไม่มีใครไปถามมัน

**แก้:** เขียน gate จริงที่ **เดิน router จริง** (`test/response-header-policy.int.test.ts`) แทนลิสต์ที่ต้องมีคนดูแล ·
trigger เปลี่ยนจาก "เดาจาก body" เป็น **route prefix** (`/orgs /organizations /me /invitations`) ·
เลือกเป็น **prefix list ไม่ใช่ exemption list**: ลืมเพิ่ม prefix ใหม่ = เห็นตอน review · ลืม**ถอด**ออกจาก exemption list = ไม่มีใครเห็นตลอดกาล

**gate เจอ 4 route ไม่ใช่ 1** — รวม `GET /orgs/{orgId}/roles` ที่**ผมเขียนเอง**ใน T-002-16b:
มัน set header ถูกอยู่แล้ว แต่ไม่มีแถวในตาราง ⇒ ทิศแรกก็จับไม่ได้เพราะมันไม่ได้อยู่ในตารางตั้งแต่แรก

| route | ทำไมต้องมี |
|---|---|
| `GET /me/organizations` | คนนี้อยู่ร้านไหน ตำแหน่งอะไร แพลนอะไร |
| `POST /organizations` | 201 body มีร้าน + membership + plan |
| `GET /orgs/{orgId}/roles` | (ของผมเอง — set header แล้ว แต่ไม่มีแถว) |
| `POST …/members/{userId}/reset-password` | body เป็น `{ok:true}` แต่ **การมีอยู่ของ response นี้**บอกว่ารหัสผ่านของคนชื่อนี้ในร้านนี้ถูกรีเซ็ต |

**ข้อจำกัดที่บันทึกไว้ตรง ๆ:** `applyResponseHeaders` อยู่ใน handler ⇒ **401 ที่ guard ปฏิเสธก่อน ไม่มี header**
· เทสต์ฉบับแรกของผม assert แบบไม่ต้อง auth แล้วแดง — สมมติฐานผมผิดเอง · เปลี่ยนเป็นยิงแบบมี token จริง
(สิ่งที่ต้องไม่ถูก cache คือ **200** — 401 body ไม่มีข้อเท็จจริงของใคร)

`api 636` · **int lane 188/188** (+4) · typecheck ✓ lint ✓ depcruise PASS

### B-5 / B-6 / B-7 / B-8 ปิดแล้ว (2026-08-08) — สามในสี่ข้อคือ **comment ที่อ้างว่ามีด่าน ทั้งที่ไม่มี**

**B-7 🔵 — "grep gate" ที่ไม่มีอยู่จริง** · `packages/db/src/tenancy.ts` เขียนว่า
*"$queryRaw/$executeRaw are handled by the grep gate"* — reviewer ค้น `ci.yml`, `tool/`, eslint config,
depcruise config **ไม่เจอ gate ไหนเลยที่ดู raw SQL** · และ seam **คุมไม่ได้จริง**: raw query ไม่มี model ไม่มี `where`
ให้ต่อ ⇒ `$queryRaw` ผ่าน ORG_PRISMA **วิ่งแบบไม่มี tenant filter และไม่ throw** (พิสูจน์กับ Postgres จริง)
· วันนี้ยังไม่มีผลเพราะ 4 caller ที่มีอยู่เป็น SYSTEM/tx client ทั้งหมด · **อันตรายคือประโยคนั้น** —
คนถัดไปที่อยาก aggregate เร็ว ๆ จะเขียน raw แล้วเชื่อว่ามีคนเฝ้า
⇒ ทำ gate จริง `orgs/system/raw-sql-allowlist.test.ts` (allowlist + self-check + เช็คว่า allowlist ไม่มีรายการค้าง)
· พิสูจน์: วางไฟล์ที่เรียก `$queryRawUnsafe` ใน `orgs/` ⇒ แดงระบุชื่อไฟล์

**B-5 🟡 — ลิสต์ที่ pin ตัวเอง 100% และ pin โค้ด 0%** · `ORG_LOCK_REQUIRED_OPERATIONS` เขียนว่า
*"write ใหม่ที่ลืม anchor = เทสต์แดง"* · reviewer grep แล้วเจอ 4 ที่: ตัวมันเอง, re-export, เทสต์ที่ assert ว่า
ลิสต์เท่ากับสำเนาของตัวเอง, และ comment — **ไม่มีอะไรเดินจากลิสต์ไป call site เลย**
⇒ เขียน `org-lock-callsites.test.ts` ที่เดิน **จากลิสต์ไปหา source**: ทุก `serviceMethod` ต้องมีอยู่จริง
+ service ที่อยู่ในลิสต์ห้ามเปิด `$transaction` เปล่า (รูปที่เขียนโดยไม่มี lock — ซึ่งคือสิ่งที่ reviewer เห็นใน working tree รอบนั้น)
· พิสูจน์สองเคส: เปลี่ยนเป็น `$transaction` เปล่า ⇒ แดง · เปลี่ยนชื่อ method ⇒ แดง
· **และแก้ comment ให้บอกความจริง** ว่าอะไรบังคับจริง อะไรยังเป็น forward commitment
(`SET LOCAL lock_timeout` เป็น statement แรกบน wire — ยังไม่มีใครคุม ต้องมี driver spy)

**B-8 🔵 — `assertOwnerRemainsInTx` นับ Owner จาก nested filter ที่ไม่ถูก org-scope** · `withOrgScope` ฉีด
`organizationId` ที่ top level ของ `Membership` แต่เงื่อนไข `role: {…}` เดินเข้า `Role` โดยไม่มี org filter ⇒
ถ้ามี membership ที่ roleId ข้าม org (สถานะที่ B-1 พิสูจน์ว่า DB เคยยอม) คนนั้นจะถูกนับเป็น Owner ของร้านนี้
· **B-1 ปิดไปแล้วทำให้สถานะนั้นสร้างไม่ได้** — แต่ผมใส่ `organizationId` ที่ role filter ด้วย เพราะ invariant
ไม่ควรต้องพึ่ง constraint ใน package อื่นเพื่อให้**อ่านแล้วดูถูก** และเพราะความหมายของ query คือ "นับ Owner ของร้านนี้"

**B-6 🔵 — floor ของ int lane ครอบแค่ auth** · `--min-passed 29` ถูกเติมเต็มด้วย auth 2 ไฟล์พอดี ⇒
สวีต F-002 **ทั้ง 8 ไฟล์ (~160 เคส) ไม่มี floor เลย** — ถ้ามันหยุดรันเงียบ ๆ lane ก็ยังเขียว ซึ่งคือสิ่งที่ I-37 มีไว้จับพอดี
· `--require` เป็น **floor (>= N)** ⇒ เพิ่มเทสต์ได้ฟรี เสียเทสต์ถึงแดง · ใส่ครบ 11 ไฟล์ + `--min-passed 183`
(เลขจริงจาก JSON report ของ lane เอง ไม่ได้เดา)

`api 645` (+9) · `packages/db 185` · **int lane 188/188** · typecheck ✓ lint ✓ depcruise PASS

### A-5 🟡 ปิดแล้ว (2026-08-08) — เทสต์ที่ชื่อว่า "reveal เป็นเส้นเดียวที่ปล่อย TIN ได้" ไม่เคยดู body สักใบ

`TAX_ID_RESPONSE_ALLOWLIST` มีแถวเดียวและ CI pin ความยาวไว้ · แต่เทสต์ที่ชื่อ
*"★ reveal is the ONLY route allowed to emit a full TIN"* พิสูจน์แค่ว่า **ตาราง**มี 1 แถว และ route อื่นใน router
ไม่อยู่ในตาราง — **มันไม่เคยดู response body สักใบ** ⇒ ถ้าวันหนึ่ง mapper ของ `GET /orgs/{orgId}` ใส่ `taxId` เต็มลงไป
ไม่มี gate ไหนแดง เหลือแค่ spot check ที่เขียนมือ 2-3 จุด

**แก้:** เพิ่มกฎ `tin-on-disallowed-route` เข้า `auditSweep` ของ leak kit ·
seed **TIN คนละค่าให้ org A และ B** (ไม่งั้นกฎจะผ่านเพราะไม่เจออะไร ซึ่งคือ vacuity ที่ kit นี้สร้างมาเพื่อปฏิเสธ) ·
และ **sweep route จริง** `GET /orgs/{orgId}` × 5 persona × 3 target — ไม่ใช่แค่ probe route

> **จับคู่กับค่าที่ seed เอง ไม่ใช่ regex 13 หลัก** — regex แมตช์ epoch millis ด้วย ซึ่งเป็น flake ที่สวีตนี้เคยเจอมาแล้ว
> (เลข 4 หลักที่โผล่ในกลาง trace id)

**control ในเทสต์เดียวกัน:** Owner ต้องได้ 200 จริง และ body ต้องมี `taxProfile` + `taxIdMasked` จริง —
ไม่งั้น "ไม่เจอ TIN" จะแปลว่า "ไม่เจออะไรเลย"

**พิสูจน์:** ทำให้ `toTaxProfileView` คืน `taxId` เต็ม ⇒ **แดงทันที** ระบุ persona/route

`api 645` · **int lane 189/189** · CI floor ของ `org-leak.kit` ปรับเป็น 20 · typecheck ✓ lint ✓

---

## A-6 🟡 ปิดแล้ว (2026-08-08) — cap คือ quota ของการ **สร้าง** และตอนนี้นับสิ่งที่คุณสร้างจริง

reviewer เสนอสองทาง (ทำเป็น invariant / แก้เอกสารให้ตรง) · **เลือกทางที่สาม** เพราะการนับแบบเดิม
**ผิดสองทาง** ไม่ใช่แค่ "ครอบไม่ครบ"

```
count(Organization where createdByUserId = you)      ← ตอนนี้
count(Membership where userId = you, status=active)  ← เดิม
```

**ทางที่ผิดที่ 1 — คำเชิญของคนอื่นกิน quota ของเรา** · ผู้รับทำบัญชีที่ดูแล SME ไทยหลายราย (persona ที่สมจริงมาก)
ถูกเชิญเข้า 50 ร้าน แล้ว**สร้างร้านของตัวเองไม่ได้อีกเลย** โดยไม่มีคำอธิบาย

**ทางที่ผิดที่ 2 — และอันนี้หนักกว่า: มันเป็น *ลูป* ไม่ใช่ *bound*** · นับเฉพาะ `active` ⇒ เสีย membership แล้วได้ quota คืน
⇒ สร้างจนเต็ม cap → ให้ผู้สมรู้ร่วมคิดที่เราเชิญเป็น Owner ถอดเราออก (last-Owner guard **ยอม** เพราะยังเหลือ Owner 1 คน)
→ ทำซ้ำ · **ผู้สมรู้ร่วมคิดคนเดียว = สร้างได้ไม่จำกัด** ในขณะที่ org ทุกใบยังกองอยู่
— ซึ่งคือภัยเดียวกับที่ I-10 ตั้งใจกันพอดี · comment ในโค้ดเดิมเขียนไว้เองว่า *"what this stops is thousands, not the 51st"*

**ทำไม accept ไม่ถูก cap (และไม่ควรถูก):** ภัยของ I-10 คือ *"user คนเดียวยิง `POST /organizations` รัว ๆ ตอน Redis ล่ม"*
· การสร้างเป็น**ฝ่ายเดียว** — คนเดียว request เดียว ไม่ต้องขอใคร · การ accept ต้องมีผู้ถือ `manage_members` ของ**ร้านอื่น**
ออกคำเชิญก่อน ⇒ ไม่ใช่คันโยกที่ผู้โจมตีคนเดียวดึงได้ · การ cap มันจะบล็อก persona ที่มีมูลค่าสูงสุด
และต้องยัด cross-org count ผ่าน `SYSTEM_PRISMA` เข้า tx ของ accept ⇒ **ขยาย jail ที่เพิ่งไปแคบลงใน A-1**

**ต้นทุน: ไม่มี migration** — `Organization.createdByUserId` มีอยู่แล้วและถูกเซ็ตจริง (`org-provisioning.service.ts:127`)

**ผลข้างเคียงที่ยอมรับ:** สร้าง 50 แล้วโอนความเป็นเจ้าของออกหมด → สร้างได้อีก · แต่ต้องมีคู่สัญญายินยอม 50 ราย
และทุกร้านยังมีเจ้าของรับผิดชอบ — ภัยที่ cap กันคือการสร้างจำนวนมากอัตโนมัติ ซึ่งยังกันได้

**เทสต์ที่ต้องเขียนใหม่เพราะความหมายเปลี่ยนโดยเจตนา:** เทสต์เดิม assert ว่า *"ออกจากร้านแล้วได้ quota คืน"*
— นั่นคือลูปข้างบน ⇒ ตอนนี้ assert ตรงข้าม · และ unit test เดิม pin `membership.count(...)` ไว้ตรง ๆ ⇒ pin query ใหม่แทน

**sync เอกสารแล้ว:** architecture §6.3 + บรรทัดสรุปข้อ 10 — ถ้อยคำเดิม *"ถือ active membership ได้ไม่เกิน 50"*
**ไม่เคยจริง** และปล่อยไว้จะสอนคนถัดไปผิด

**พิสูจน์:** RED (`expected 409 to be 201`) → GREEN → กลับไปนับ membership ⇒ **แดงทั้งชั้น int และ unit**
· `api 645` · **int lane 190/190** · core-domain 384 · CI floor ปรับแล้ว

## T-002-W5 — S6/S7/S8 + Toast host (2026-08-08)

### ★ ลิงก์คำเชิญ = credential — รูป state คือตัวกันเอง (แบบเดียวกับ TIN reveal)

token ที่อยู่บนแผ่นนี้คือ **bearer credential ของการเป็นสมาชิกร้าน** · server เก็บแค่ hash (D-018)
⇒ **แผ่นนี้คือที่เดียวที่ token ดิบเคยมีอยู่** · `closed` **ไม่มี field ให้เก็บ token** — ปิดแล้วหายจริง ไม่ใช่แค่ไม่ถูก render

**ด่านของ §9.1 คือ "น้ำหนักปุ่ม" ไม่ใช่ dialog** · user เคาะแล้วว่าไม่เอา confirm ตอนจะปิด (2 ชั้นถือว่ามากไป)
สิ่งที่มาแทนคือ **ปุ่ม "เสร็จแล้ว" เป็น `secondary` จนกว่าจะกดคัดลอก แล้วจึงเป็น `primary`** —
ทางออกจะเด่นก็ต่อเมื่อปลอดภัยแล้ว · เทสต์จึง assert **ตำแหน่ง DOM** ของแถบเตือนว่าอยู่**เหนือ**ปุ่มปิด
(พิสูจน์แดง: ย้ายลงใต้ปุ่ม ⇒ แดงทันที) เพราะนั่นคือเหตุผลเดียวที่ตัด dialog ออกได้

**clipboard ถูกปฏิเสธได้** (insecure origin / permission) ⇒ ลิงก์ยังอยู่บนจอและ select ได้ + helper บอกตรง ๆ —
ล้มเหลวเงียบจะทำให้คนเชื่อว่าถือลิงก์อยู่ทั้งที่ไม่มี

### สิ่งที่ contract สอนผมระหว่างทาง

ผมออกแบบ `memberActionsFor` ให้รับ `targetCapabilities` — แต่ `MemberRow` จริงมี **`isMe` / `isOwner`
ที่ server คำนวณให้แล้ว** และ comment ในสัญญาเขียนว่า *"Computed from CAPABILITIES, never from the role's name or key"*

⇒ list **ไม่ publish `capabilities` ของเพื่อนร่วมงาน** โดยตั้งใจ (เหตุผลเดียวกับ `GET …/roles`) —
การส่ง capability set ของทุกคนให้ทุกคนไปคำนวณเอง **คือ client-side authorization ที่ server เลี่ยงด้วยการตอบคำถามให้เอง**
· ผมเปลี่ยน pure fn ให้รับ boolean ตามสัญญาแทนที่จะดึงข้อมูลที่ client ไม่ควรมี

### หนี้ที่ปิด / เปิดใหม่

| # | เรื่อง | สถานะ |
|---|---|---|
| W-13 | Toast host ระดับแอป | **ปิดแล้ว** — `ToastProvider` ใน `AppProviders` · `useToast()` คืน no-op นอก provider (ตรงข้ามกับ `useActiveOrg` ที่ throw — org หายคือบั๊ก routing ที่ต้องดัง แต่ toast host หายต้องไม่ทำให้การบันทึกล้ม) |
| W-15 | `?invite=1&role=owner` (D-030) | ยังไม่อ่าน — `InviteDialog` รับ `defaultRoleId` แล้ว เหลือต่อ query param ที่ W6 |
| W-17 | เมนู `⋯` ยัง render เป็น**ข้อความ** ไม่ใช่ dropdown/bottom-sheet · การกระทำ (เปลี่ยนสิทธิ์ S9 / ถอด S10 / ออกจากร้าน S10.3) ยังไม่มี dialog | W6 — mutation hook เขียนครบแล้วทั้ง 5 ตัว |
| W-18 | "ดูคำเชิญที่หมดอายุ/ยกเลิกแล้ว" สลับ `?status=all` ได้ แต่ยังไม่มีปุ่ม "เชิญใหม่อีกครั้ง" ที่เติมอีเมล/สิทธิ์เดิม | W6 |

`web 257 tests` (+21) · typecheck ✓ lint ✓ build ✓

## T-002-W6 — `/invite` ★ + S9/S10/S12 (2026-08-08)

### ★ token ออกจาก URL **ก่อน paint** ไม่ใช่หลัง

`useLayoutEffect` ไม่ใช่ `useEffect` · `useEffect` รันหลัง paint ⇒ token จะอยู่บน address bar อย่างน้อยหนึ่งเฟรมที่ render จริง
— นานพอสำหรับ screenshot, screenshare, และ error reporter ที่เก็บ `location.href` ตอน mount

**`replaceState` ไม่ใช่ `pushState`** — push จะทิ้ง entry ที่มี token ไว้ใน history ห่างจากปุ่ม Back แค่ครั้งเดียว ซึ่งตรงข้ามกับจุดประสงค์

**ทำไม URL เป็นที่ที่แย่ที่สุดสำหรับ credential** (เหตุผลจริงทั้งหมด ไม่ใช่ทฤษฎี): `Referer` ของทุกลิงก์/resource ที่หน้านี้โหลด ·
history ที่ sync ข้ามเครื่องโดย default · address bar ตอน screenshare · access log ถ้าวันหนึ่ง server-render ·
analytics/error reporter ที่เก็บ `location.href` เป็นนิสัย

⇒ endpoint ทั้งสองเป็น **POST** เพื่อให้ token เดินทางใน body (สัญญาเขียนเหตุผลนี้ไว้เอง) · เทสต์ assert ว่า
**request URL ไม่มี token แต่ body มี**

**preview เป็น mutation ไม่ใช่ query** — เหตุผลเดียวกับ TIN reveal: query cache จะเก็บ token ไว้ และ
`refetchOnWindowFocus` จะยิงซ้ำทุกครั้งที่สลับแท็บ กิน rate limit ฟรี ๆ

**ไม่ auto-accept แม้ล็อกอินอยู่** (§11.1) — คนต้อง**เห็น**ว่ากำลังเข้าร้านอะไร ในสิทธิ์อะไร ·
ลิงก์ที่พาเข้าองค์กรทันทีที่เปิด คือลิงก์ที่ส่งให้คนที่ไม่เคยอยากเข้าได้

### ตารางที่แยกเป็น pure function เพราะ "ผิดแล้วมองไม่เห็น"

**`toInviteError` (§11.4)** — 10 แถว 9 แถวต่างกันแค่ error code · **สอง 409 ที่พาไปคนละที่**:
`ALREADY_MEMBER` → เข้าร้านเลย · `INVITATION_SUPERSEDED` → กลับไปขอลิงก์ใหม่ · status เดียวกันแยกไม่ได้
· ทุกแถว**มีทางไปต่อ** เพราะคนอ่านไม่ได้ทำอะไรผิด เขาแค่กดลิงก์ที่มีคนส่งให้

**`toLeaveOrgOutcome` (§10.3)** — 4 ผลลัพธ์ 3 พฤติกรรม:
`LAST_OWNER`/`busy` = กล่องไม่ปิด (มีอะไรให้ทำ) · `403` = **ปิดกล่อง** เพราะแปลว่าออกไปแล้ว ไม่ใช่ error ให้แก้ ·
ที่เหลือ = retry ในกล่อง · **busy เช็คก่อน LAST_OWNER** ตาม §1.4 — lock contention ที่รายงานว่า
"คุณเป็นเจ้าของคนเดียว" จะส่งคนไปตามหาเจ้าของร่วมที่เขามีอยู่แล้ว
· ลิงก์ "ไปหน้าสมาชิก" โผล่เฉพาะคนที่มี `manage_members` — ส่งพนักงานไปเจอ 403 แย่กว่าไม่ให้ลิงก์

### หนี้ที่ปิด

| # | เรื่อง |
|---|---|
| W-12 | `?leave=1` — ปิดแล้ว · confirm §10.3 เปิดบน S4 ตรงที่พนักงานเข้าถึงได้ (D-029) |
| W-16 (บางส่วน) | `ForbiddenPanel` (S12ข) มีแล้ว — เต็มพื้นที่เนื้อหา nav/switcher ยังอยู่ · `RouteGuard` เต็มยังเป็นของ F-003 |

### ยังค้าง (บันทึกตามจริง)

W-15 (`?invite=1&role=owner` ยังไม่อ่าน) · W-17 (เมนู `⋯` ยังเป็นข้อความ ยังไม่มี dialog S9/S10 ของการเปลี่ยนสิทธิ์/ถอด) ·
W-18 ("เชิญใหม่อีกครั้ง") — mutation hook พร้อมครบแล้วทั้ง 5 ตัว เหลือแต่ชั้น dialog

`web 284 tests` (+27) · typecheck ✓ lint ✓ build ✓

## T-002-M1 — `core/session` + `orgDioProvider` (2026-08-11)

### ★ ตำแหน่งของ interceptor คือสิ่งที่ทำให้ retry ยังอยู่ในร้านเดิม

chain ตาม mobile.md §3.4:
```
HttpsGuard → AuthToken → OrgHeader → Refresh → Retry → ErrorMapping
```
`RefreshInterceptor` **replay** request หลัง silent refresh และ `RetryInterceptor` replay GET ที่ล้มชั่วคราว —
ทั้งคู่ประกอบ request ใหม่จาก `RequestOptions` ⇒ **สิ่งที่ interceptor ก่อนหน้าใส่ไว้ ติดไปด้วย · สิ่งที่ใส่ทีหลัง ไม่ติด**
· วาง org header ไว้ระดับเดียวกับ auth header (ก่อน refresh) คือเหตุผลที่ request ที่ถูก replay ยังเป็นของร้านเดิม
· เทสต์ assert **ตำแหน่งใน chain** ไม่ใช่แค่ผลลัพธ์ เพราะผลลัพธ์จะโผล่ก็ต่อเมื่อเจอ 401 จริงเท่านั้น

### สอง client ที่ต้องแยกกัน — บทเรียนที่ web เพิ่งเรียนตอน W3

`baseDioProvider` (org-agnostic) สำหรับ `/auth/*`, `GET /me/organizations`, `POST /organizations`,
invitation preview/accept — **สี่เส้นนี้มีอยู่เพราะผู้เรียกยังไม่ได้อยู่ในร้าน** (หนึ่งในนั้นยังไม่มีบัญชีด้วยซ้ำ) ·
ส่ง`X-Organization-Id` ไปคือการยื่น input ที่ route เหล่านั้นไม่ควรได้รับ (I-3)

⇒ `orgDioProvider` สร้าง **Dio ใหม่** ที่ share adapter/options ของ base **ไม่ใช่ mutate ตัว base**
— mutate จะทำให้ `/auth/refresh` มี org header ติดไปด้วย ซึ่งคือสิ่งที่ไฟล์นี้มีไว้เพื่อแยก
· มีเทสต์ ★ คุมเฉพาะข้อนี้ (พิสูจน์แดง: เปลี่ยนเป็น mutate ⇒ แดง 2 เคส)

### ไม่มี fallback เมื่อไม่มี active org

`orgDioProvider` **throw** ไม่ใช่คืน base client · การ fallback จะส่ง org-scoped request แบบไม่มี org
⇒ เปลี่ยนบั๊ก routing ให้กลายเป็น 422 ที่ผู้ใช้แก้ไม่ได้ — หรือแย่กว่านั้น เป็น request ที่ไม่มีใครประกาศ scope ของมัน
(พิสูจน์แดง: ใส่ fallback ⇒ แดง)

### `SessionState` เป็น sealed — และสองคู่ที่สับสนง่ายไปคนละทาง

`SessionUnknown ≠ SessionNone` — "ยังไม่รู้" กับ "ไม่ได้ล็อกอิน" · ถือว่า unknown = ล็อกเอาต์ ⇒ เตะ session จริงออกทุก cold start
`SessionAuthed(active: null) ≠ ไม่มี session` — ล็อกอินแล้วแต่ยังไม่เลือกร้าน ⇒ org picker ไม่ใช่หน้า login

**`orgAccessDenied()` ทิ้ง *ร้าน* ไม่ทิ้ง *session*** (D-027) — เหตุผลเดียวกับที่ web แยก `ApiFailure` เป็นคนละ kind

### ข้อจำกัดเชิงโครงที่บันทึกไว้

`baseDioProvider` **ไม่มี default** ต้อง override ที่ composition root — `core/` import `features/` ไม่ได้ (gate rule 2)
และ base client ที่ wire แล้ว (พร้อม `RefreshInterceptor` ที่ผูกกับ `RefreshCoordinator` ของ auth repo)
อยู่ใน `features/auth/data` · ทางเลือกอื่นคือเขียน base-dio builder ตัวที่สองใน `core/` ซึ่งแปลว่ามี
**refresh policy สองชุดในแอปเดียว** — ซึ่งคือวิธีที่มันจะ drift

`mobile 240 tests` (+11) · `flutter analyze` ✓ · boundary gate ✓ (58 ไฟล์)

## T-002-M2 — `ApiFailure` mobile: สอง 403 และสอง 409 (2026-08-11)

ตัดสินใจเหมือน web ทุกข้อ เพราะเป็นกฎเดียวกัน — แต่ mobile มี sealed class อยู่แล้ว
⇒ **เพิ่ม case ใหม่ทำให้ `switch` ที่ exhaustive ทุกที่ต้องตอบคำถามใหม่ทันที** (คอมไพเลอร์เป็นคนถาม ไม่ใช่ review)

| เพิ่ม | แทนที่จะเป็น | เพราะ |
|---|---|---|
| `OrgAccessDeniedFailure` | `ForbiddenFailure(code: 'ORG_ACCESS_DENIED')` | สองอันนี้ทำ**ตรงข้ามกัน** — อันหนึ่งทิ้ง active org ไปหน้าเลือกร้าน อีกอันอยู่ที่เดิม · คนที่ลืมอ่าน `code` ได้พฤติกรรมสุ่ม และฝั่งที่ผิดคือฝั่งเตะสมาชิกออกจากร้านที่เขายังอยู่ |
| `BusyFailure` | flag บน `ConflictFailure` | §1.4 บังคับให้เช็คก่อน copy 409 ของจอนั้นเสมอ · แยก type = ลำดับเป็นโครงสร้าง · **wire ไม่เปลี่ยน** (409 ยังเป็น 409) |

**403 ที่ไม่รู้จัก → `ForbiddenFailure`** เสมอ (การอ่านแบบไม่ทำลาย) — เดาเป็น OrgAccessDenied จะเตะคนออกจากร้าน
ทุกครั้งที่เจอ 403 ที่ build นี้ไม่เคยเห็น

### สิ่งที่ต้องทำเพิ่ม ไม่งั้น type ใหม่ไม่มีความหมาย

mapper เดิม**ไม่เคยอ่าน `details` เลย** ⇒ เพิ่ม `extractErrorReason` · ถ้าไม่ทำ `BusyFailure` จะเป็น type ที่ไม่มีวันถูกสร้าง

และ **`SessionFailureListener`** — ถ้าไม่มี `OrgAccessDeniedFailure` จะเป็น type ที่ไม่มีใครตอบสนอง
คือรายการใน taxonomy ที่อ่านแล้วเหมือนการบังคับใช้แต่ไม่เปลี่ยนอะไรเลย (รูปแบบเดียวกับที่เจอ 6 ครั้งใน security review)
· มัน list **ทุก case แบบไม่มี `default`** ⇒ failure ชนิดใหม่ต้องถูกถามว่า "ย้าย session ไหม" ด้วย

> **การขยายรายการนี้คือวิธีที่ "แอปเด้งออกเฉย ๆ" เกิดขึ้น** — `ForbiddenFailure` ที่หลุดเข้ามาจะทำให้คนถูก logout
> เพราะเปิดหน้าที่ขาด capability เดียว · มีเทสต์ ★ คุมว่า failure ธรรมดา 8 ชนิดไม่แตะ session เลย

**พิสูจน์:** ยุบ `OrgAccessDenied` กลับเข้า `Forbidden` ⇒ แดง 2 · ตัดเช็ค `busy` ⇒ แดง 2 ·
เทสต์ยิงจาก **wire envelope จริง** ผ่าน `mapDioExceptionToApiFailure` ไม่ใช่เรียก pure mapper ด้วยอาร์กิวเมนต์ที่ปั้นเอง
(บทเรียนจาก `describeOrgBusy` ที่รอดเทสต์ตัวเองมาได้เพราะเทสต์สร้าง input ของ classifier แทนที่จะสร้าง response ที่มันต้องแปล)

`mobile 257 tests` (+17) · analyze ✓ · boundary gate ✓ (59 ไฟล์)

## T-002-M3 — org feature ฝั่ง mobile: domain → data → application → S1 (2026-08-11)

### ⚠️ ขอบเขตต่างจากที่บอร์ดเขียน — และ ux เป็นฝ่ายถูก

บอร์ดเขียนว่า M3 รวม **"`/invite` deep link"** · แต่ ux-wireframe **§13 ระบุตรงข้ามชัดเจน**:

| จอ | Web | Mobile |
|---|---|---|
| `/invite` | มีจอนี้ | **ไม่มีในแอป** (deep link = F-006) |

⇒ **ไม่ทำ** · ประดิษฐ์ deep-link scheme ล่วงหน้าคือสิ่งที่ `apps/mobile/CLAUDE.md` ห้ามไว้ตรง ๆ
("อย่า import ของที่ยังไม่มี — router/deep link เกิดที่ F-006")

### ที่ทำจริงในใบนี้

`domain/` (entities + 2 ports) · `data/` (mapping ทั้งหมด) · `application/` (providers) · `presentation/` S1 ครบ 4 states

**สอง port ไม่ใช่หนึ่ง** — `OrgDirectory` (user-scoped: `/me/organizations`, `POST /organizations`)
กับ `OrgScoped` (org-scoped: members/roles/invitations) · แยกใน **type system** ⇒ repository ต่อกับ Dio ผิดตัวไม่ได้
โดยบังเอิญ: `data/` wire `OrgDirectory` เข้า `baseDioProvider` และ `OrgScoped` เข้า `orgDioProvider` และไม่มีตัวไหนเอื้อมถึง client ของอีกตัว

**`data/` กรองแถวที่ไม่ active ทิ้ง** — M-10: แถวที่ถูก revoke พก `status`+`revokedAt` มาเท่านั้น **ไม่มี role เลย**
⇒ กรองที่นี่ที่เดียว ทำให้ทุกจอข้างบนสมมติ shape เต็มได้ แทนที่จะต้องจำกันทุกจอว่า `roleName` บางทีก็ไม่มี

**entity ของ member ไม่มี `capabilities`** — สัญญาไม่ publish ของเพื่อนร่วมงาน (เหตุผลเดียวกับ §3.6)
· `isMe`/`isOwner` มาจาก server ⇒ ไม่มีจอไหนคำนวณความเป็นเจ้าของจากข้อมูลที่ไม่ควรมี

### สองอย่างที่ gate จับได้ ไม่ใช่ผมเห็นเอง

1. **boundary gate**: ผมใส่ `@immutable` ใน `domain/` — มันมาจาก `package:flutter` ซึ่ง rule 1 ห้าม ·
   ถอดออกแล้ว (คลาสยัง immutable โดยโครงสร้าง: ทุก field `final`, ทุก constructor `const`)
2. **analyzer**: `built_collection` ไม่ใช่ direct dependency ⇒ เขียน mapping ใหม่ให้ไม่ต้องใช้ `BuiltList` เลย

และ **import generated client แบบ `as wire`** เพราะ DTO หลายตัวชื่อชนกับ entity ที่มันแมปไป
(`CreatedOrganization`, `MemberRow`) — ไม่ prefix แล้วสองฝั่งดูสลับกันได้ ซึ่งคือจังหวะที่ DTO เริ่มเดินทางออกนอก `data/`

### หนี้ที่เปิด

| # | เรื่อง | ปิดตอน |
|---|---|---|
| M-1 | จอสร้างร้าน · switcher bottom sheet · จอสมาชิก — ยังไม่ทำ (ชั้น data/application พร้อมครบแล้ว) | รอบถัดไปของ M3 |
| M-2 | `SessionListSkeleton` ใน `core/ui/` ชื่อเป็นของ auth แต่ widget generic (`rowCount`) — org picker ใช้อยู่ | เปลี่ยนชื่อเป็น mechanical change ที่แตะเทสต์ auth ไม่เกี่ยวกับ F-002 |
| M-3 | `enterOrganization` ส่ง `capabilities: {}` — picker ไม่มี capability ของแต่ละร้าน (`/me/organizations` ไม่คืน) ⇒ ต้องอ่านจาก `GET /orgs/{orgId}` หลังเข้าร้าน | จอถัดไปที่เข้าร้านจริง |

`mobile 267 tests` (+10) · analyze ✓ · boundary gate ✓ (65 ไฟล์)

## T-002-M3 (ต่อ) — S2 สร้างร้าน · switcher · S6 สมาชิก · S7/S8 เชิญ (2026-08-12)

ปิดหนี้ M-1 ครบทั้งสามจอ + เพิ่ม flow เชิญ (S7 → S8) ตามที่บอร์ดเขียนว่า "อ่าน+เชิญพื้นฐาน"

### สิ่งที่พบก่อน แล้วค่อยเขียนจอ: envelope ส่ง `details`/`fieldErrors` มาตั้งนานแล้ว แต่ไม่มีใครอ่าน

`core/api/error_mapping.dart` ดึงแค่ `code`/`reason`/`Retry-After` · แต่ `ErrorResponseError` ใน generated client
มี `details` + `fieldErrors` ครบตาม D-025 มาตลอด และคอมเมนต์ใน `api_failure.dart` เขียนไว้ว่า
"envelope มีแค่ `{code, message}`" — **ข้อความนั้นผิดตั้งแต่ D-025 ลง**

เรื่องนี้ไม่ใช่รายละเอียด: ux สั่งตรง ๆ ว่า `409 ORG_LIMIT_REACHED` ต้องแสดงตัวเลขจาก `details.limit`
(**ห้าม hardcode** — cap ผูกกับ plan, api-spec §3.1) ⇒ ถ้าไม่ดึงมา S2 มีทางเลือกแค่ "แต่งเลขเอง" กับ "พูดไม่รู้เรื่อง"

เพิ่ม `extractFieldErrors` / `extractDetails` (+ `ServerFailure.code` — `503 ORG_PROVISIONING_UNAVAILABLE`
เป็น 5xx ตัวเดียวที่ ux ให้ copy ของตัวเอง "ไม่ใช่ความผิดของคุณ") · `mapStatusToApiFailure` ยัง pure เหมือนเดิม —
การเดิน JSON อยู่ที่ `core/api`, การจำแนกอยู่ที่ `core/error` · แก้คอมเมนต์ที่ผิดด้วย

### wiring ที่ M2 ค้างไว้

`SessionFailureListener` มีคลาส มีเทสต์ **แต่ไม่มีใครเรียก** — กติกาที่อ่านเหมือนบังคับใช้ แต่ไม่ได้บังคับอะไรเลย ·
เพิ่ม `sessionFailureListenerProvider` และให้ controller ทุกตัวส่ง failure ผ่านมันก่อนตัดสินใจแสดง error
⇒ `403 ORG_ACCESS_DENIED` ทิ้งร้าน ไม่ใช่แปะ "คุณไม่มีสิทธิ์" บนจอที่กำลังจะโดนพาออกไป (§12.1) ·
ส่วน refetch `/me/organizations` ที่ §12.1 สั่ง **ไม่ต้องเขียนโค้ด**: รายการร้านเป็น `autoDispose`

### สามจอ + สองแผ่น

| จอ | จุดที่ไม่ยอมลดหย่อน |
|---|---|
| **S2 สร้างร้าน** | ปุ่ม disabled ระหว่างส่ง (**ไม่มี Idempotency-Key** ⇒ กด 2 ที = 2 ร้าน) · ร้านใหม่ active **ก่อน** `submit` return (ไม่งั้นจอถัดไป build โดยไม่มีร้าน แล้ว `orgDioProvider` โยน) · ไม่ถามเขตเวลา/สกุลเงิน/แพ็กเกจ |
| **switcher** | bottom sheet ไม่ใช่ dropdown (§13) · ร้านปัจจุบันบอกด้วย **คำว่า "ร้านที่ใช้อยู่"** ไม่ใช่ ✓ เดี่ยว ๆ · list พังไม่ทำให้ทั้งจอพัง |
| **S6 สมาชิก** | สองส่วน สอง controller ⇒ **พังแยกกันจริง** · ไม่มีคำเชิญค้าง = ซ่อนทั้งส่วน · `นับ` เฉพาะ active |
| **S7 เชิญ** | default = สิทธิ์ต่ำสุด (ไม่ใช่ `roles.first` ซึ่งคือ Owner) · Owner **disabled + บอกเหตุผล** ไม่ใช่ซ่อน · แถบ TTL ไม่มีตัวเลข |
| **S8 ลิงก์** | `pushReplacement` — กด back กลับไปเจอฟอร์มที่กรอกไว้แล้วกดซ้ำไม่ได้ · ไม่มีคำว่า "คัดลอกลิงก์เดิม" ที่ไหนเลย |

### สองจุดที่ตัดสินต่างจากตัวอักษรของ spec — และแจ้งไว้ให้ ux ชี้ขาด

1. **นับ Owner จาก `isOwner` ไม่ใช่ `roleKey === "owner"`** (แถบ D-030) — ux เขียนให้เช็ค `roleKey` และ
   ให้ **ไม่แสดงแถบ** ถ้ามี `roleKey === null` (custom role ของ F-003, "นับไม่ได้") · แต่ `isOwner` server คำนวณจาก
   **capabilities** (api-spec §3.7) ซึ่งตรงกับกฎของโปรเจกต์ที่ว่าความเป็นเจ้าของตัดสินด้วย `full_access` เท่านั้น ·
   เจตนาของ caveat คือ "อย่าเตือนจากตัวเลขที่เชื่อไม่ได้" — `isOwner` คือตัวเลขที่เชื่อได้ · **ผลต่างจริง:**
   ร้านที่ Owner คนที่สองถือ custom role ที่มี `full_access` จะไม่ขึ้นแถบ (ถูก — มี Owner 2 คน) ซึ่งกฎเดิมก็ไม่ขึ้นเหมือนกันแต่ด้วยเหตุผลผิด
2. **ปีเป็น ค.ศ.** ตามตัวอย่างในเอกสาร ("29 ก.ค. 2026") — แต่ **web ใช้ `Intl.DateTimeFormat("th-TH")`
   ซึ่ง default calendar ของ locale นี้คือพุทธศักราช** ⇒ web จะขึ้น "2569" ที่ mobile ขึ้น "2026" ·
   **สองแพลตฟอร์มไม่ตรงกันอยู่ตอนนี้** และเป็นการตัดสินใจเรื่อง copy ไม่ใช่เรื่อง client → รอ ux เคาะ

### พิสูจน์ว่า gate แดงได้จริง (mutation)

- ตัด `if (!complete) return false;` ในแถบ D-030 ⇒ **แดง**
- ทำให้ `extractDetails` คืน map ว่างเสมอ ⇒ **แดง** (รวมจอ S2 ที่ต้องโชว์เลขจาก server)
  รวมสองการกลายพันธุ์ = แดง 5 ตัว · คืนค่าเดิมแล้วเขียวหมด

### หนี้ที่เปิด/ปิด

| # | เรื่อง | สถานะ |
|---|---|---|
| M-1 | จอสร้างร้าน · switcher · จอสมาชิก | **ปิด** |
| M-2 | ชื่อ `SessionListSkeleton` ยังเป็นของ auth | ค้าง |
| M-3 | `enterOrganization` ส่ง `capabilities: {}` — S7 ใช้ capability ตัดสินว่าเลือก Owner ได้ไหม ⇒ **เข้าร้านจาก picker แล้วจะเลือก Owner ไม่ได้จนกว่าจะปิดหนี้นี้** (สร้างร้านใหม่ไม่กระทบ: response มี capabilities) | ค้าง — **ยกระดับเป็นบล็อกเกอร์ของ S7** |
| M-4 | ปุ่มบนแถว (เปลี่ยนสิทธิ์ · ถอด · ออกจากร้าน · ออกลิงก์ใหม่ · ยกเลิกคำเชิญ) ยังไม่ทำ ⇒ **แถวจงใจกดไม่ได้** (sheet ที่เปิดมาแล้วว่างแย่กว่าไม่มีปุ่ม) · แผง `INVITATION_PENDING` จึงมีทางออกเดียวคือ "กลับไปแก้อีเมล" | รอบถัดไป |
| M-5 | 429 ไม่มีนับถอยหลัง — `ThrottleCountdownController` อยู่ใน `features/auth` และ **rule 4 ห้าม import ข้าม feature** ⇒ ต้องยก widget ขึ้น `core/ui` ก่อน | รอบถัดไป |
| M-6 | ไม่มีคำเชิญ pending = ซ่อนทั้งส่วน ⇒ **ลิงก์ "ดูคำเชิญที่หมดอายุ/ยกเลิกแล้ว" หายไปด้วย** (ทำตามตัวอักษรของ §7) | ถาม ux |
| M-7 | `Page<T>` ชนกับ `Page` ของ Flutter → เปลี่ยนชื่อเป็น `PagedResult<T>` · controller paging เป็นตัวเล็ก ๆ เฉพาะกิจ **ไม่ใช่** `PagedListController` (F-013) | ตั้งใจ |

`mobile 387 tests` (+120) · analyze ✓ · boundary gate ✓ (78 ไฟล์)

## T-002-Q1/Q3 — qa lane: audit ของ unit lane + concurrency matrix ครบ 13 เคส (2026-08-12)

### สิ่งแรกที่ต้องพูด: int lane **ยังไม่ได้รัน** ในรอบนี้

เครื่องนี้ไม่มี Postgres — docker daemon ไม่ขึ้น (สั่ง `open -a Docker` แล้วไม่ start) และไม่มี postgres ที่ติดตั้งตรง ๆ
⇒ ทุกไฟล์ `*.int.test.ts` **skip** · ตาม `apps/api/CLAUDE.md` ข้อ 8 ("green locally ≠ tested") **ห้ามอ้างว่าผ่าน**
สิ่งที่ยืนยันแล้วรอบนี้: `typecheck` · `lint` · unit lane ทุกตัว

### Q1 — audit: unit lane ครบเกือบหมด และ **ช่องว่างจริงมีข้อเดียว**

| ชุด | ต้องมี | มีจริง |
|---|---|---|
| `U-CD-01..12` | 12 | **12/12** (label ครบในไฟล์) |
| `U-DB-01..11` | 11 | **11/11** — `U-DB-06` มีจริง (`org-models.test.ts` เช็ค drift สองทาง) แต่ **ไม่มี label id** ⇒ audit ครั้งหน้าจะหาไม่เจอด้วย grep |
| `U-CFG-01..07` | 7 | **7/7** |
| `U-API-01..21` | 21 | ครบตามไฟล์ **ยกเว้น `U-API-14`** |

**`U-API-14` (redact `token`/`tokenHash`/`taxId`/`password*` · ห้าม log query string ของ `/invitations/*`) —
ไม่มีอะไรให้เทสต์ เพราะ `apps/api` ยังไม่มี structured logger เลย** ใช้ Nest logger ตรง ๆ
(`main.ts` cap ไว้ที่ `["log","warn","error"]`) และไม่มีชั้น redact ที่ไหน · เขียนเทสต์ต่อ `redact` list
= ต้องสร้าง list ก่อน ซึ่งเป็นงาน **devops D2 + การตัดสินของ backend-api ไม่ใช่ของ qa**

⇒ ทำครึ่งที่ **พิสูจน์ได้จริงวันนี้** เป็น gate: `src/common/log-hygiene.test.ts`
- สแกน log call ทุกตัวใน `src/` แล้ว **ลบเนื้อใน string literal ออกก่อน** ⇒ `logger.warn("invalid token")`
  (คำในประโยค) ผ่าน แต่ `logger.warn(\`${token}\`)` / `logger.log({ tokenHash })` ไม่ผ่าน
- ห้าม `new PrismaClient({ log: ["query"] })` — คำเดียวในคอนสตรัคเตอร์ที่ทำให้ **parameter** ของทุก statement
  (คือ `passwordHash`, `tokenHash`, `taxIdEncrypted`) ลงล็อก และ **redact list จับไม่ได้** เพราะค่าไม่ได้ผ่าน field name
- `main.ts` ห้ามเปิด `debug`/`verbose`

> เมื่อ structured logger ลง (D2) `redact` เป็นชั้นที่สอง · **gate นี้ยังเป็นชั้นแรก** เพราะ redact ครอบแค่ชื่อ field
> ที่มีคนนึกออก ส่วน gate นี้ครอบ log call ทุกตัวในทรี

**พิสูจน์ว่าแดงได้จริง (mutation บนไฟล์จริง ไม่ใช่ fixture):** ใส่ `${this.taxId}` ใน `prisma.service.ts` ⇒ แดง ·
`log: ["query"]` ⇒ แดง · เพิ่ม `"debug"` ใน `main.ts` ⇒ แดง · คืนค่าทั้งสามแล้วเขียว

### Q3 — concurrency matrix ครบ 13 เคส (`test/concurrency-matrix.int.test.ts`)

เดิมมี **4/13** (I-C-01/02/07/10) กระจายอยู่ในไฟล์ feature และรัน **6 รอบ ไม่ใช่ 20** ·
เขียนใหม่เป็นไฟล์ของตัวเอง เพราะ §8 ไม่ใช่ "ลิสต์เคส" แต่เป็นลิสต์เคส **+ กติกา 3 ข้อที่มีความหมายเฉพาะเมื่อบังคับข้ามทั้งชุด**:

1. **ห้ามมี 5xx ที่ไหนเลยในไฟล์** — ทุก response ผ่าน `fire()` ⇒ เช็คทั้งราย response และรวบยอดใน `afterAll`
   ⇒ เคสที่ลืม assert ก็ยังซ่อน 500 ไม่ได้
2. **ห้ามมี `40P01`/`40001` ใน output ของ process** — architecture §5.1 อ้างว่า "คว้า lock ลำดับเดียวกันทุกเส้นทาง
   ⇒ ไม่มี deadlock" · **ไม่มีอะไรเช็คคำอ้างนี้มาก่อนไฟล์นี้** (tap `stdout`/`stderr` แบบ pass-through) ·
   ข้อยกเว้นเดียวที่ §8 ให้คือ `55P03` ใน I-C-13 ซึ่งเทสต์สร้างเอง
3. **รอบที่จบด้วย "ชนะ 1" ต้องมี security event ใบเดียว · รอบที่จบด้วย 409 ต้องมี 0 ใบ** —
   race ที่ทำให้ audit เพี้ยน **status code มองไม่เห็น** และ audit ที่บอกว่าเกิดสิ่งที่ไม่ได้เกิดแย่กว่าไม่มี audit

ทุกเคส **20 รอบ** และ assert invariant กับ **Postgres ท้ายรอบ** ไม่ใช่แค่ status
(I-C-13 = 3 รอบ ตามข้อยกเว้นที่ §8 เขียนไว้เอง) · ไม่มี `setTimeout` จัดจังหวะที่ไหนเลย — `Promise.all` เท่านั้น

เคสที่ควรพูดถึงเป็นพิเศษ:
- **I-C-11 (leave ‖ revoke)** — assert ว่า event ออก **ใบเดียว** ห้ามได้ทั้ง `member.left` และ `member.revoked`
  สำหรับการถอดครั้งเดียว · เพิ่ม assert ฝั่งอ่านด้วย: ร้านต้องหายจาก `/me/organizations` ทันที
  (แถวที่ `revoked` ในตารางแต่ยังอยู่ในลิสต์ = ร้านที่ picker ฝั่ง mobile จะพากลับเข้าไป)
- **I-C-12 (Owner 2 คน leave พร้อมกัน)** — ทางใหม่ที่ D-029 เปิดให้ร้านล็อกตัวเองออก ถ้า `DELETE …/membership`
  ไม่คว้า anchor เดียวกับ `DELETE …/members/{userId}`
- **I-C-09 (cap)** — ใช้ `MAX_ORGS_PER_USER=2` ผ่าน env (factory ของ production อ่านจาก env อยู่แล้ว)
  แทนการ seed 49 ร้านต่อรอบ · **สิ่งที่ §8 สนใจคือ "overshoot ไม่เกิน 1 ใบ" ไม่ใช่เลข 50** — สิทธิ์ปรับ env
  แบบเดียวกับที่ §8 ให้ I-C-13 เรื่อง timeout
- **I-C-13** — ครบทั้ง 6 ข้อย่อย: busy + ไม่มี SQLSTATE หลุด wire + `traceId` ยังมี + **DB ไม่เปลี่ยนแม้ field เดียว**
  (snapshot ก่อน/หลัง) + **ไม่มี event** + **org อื่นได้ 200 ระหว่างนั้น** (แก่นของ NEW-4 คือ noisy neighbour
  ไม่ใช่ error mapping) + หลังปล่อย lock request ถัดไปสำเร็จ
- **เทสต์ตัวสุดท้ายของไฟล์ = non-vacuity**: assert ว่าทั้ง 13 เคสยิง request จริง — ไม่มีชั้นนี้ ไฟล์ที่ทุกเคส
  no-op เงียบ ๆ จะผ่านกติกาทั้ง 3 ข้อข้างบนหมด ซึ่งคือรูปเดียวกับ finding "gate ที่แดงไม่ได้" 6 ข้อของรอบ review

**CI floor:** เพิ่ม `--require "test/concurrency-matrix.int.test.ts=14"` และยก `--min-passed` 185 → 199
⇒ ถ้าไฟล์นี้ skip ทั้งไฟล์ (ลืม env) lane จะ **แดง** ไม่ใช่เขียว

### สถานะ qa lane ตามจริง

| | สถานะ |
|---|---|
| Q1 | audit เสร็จ · ปิดช่องว่าง `U-API-14` ด้วย gate + **แจ้งว่า redaction จริงเป็นของ D2** · ค้าง: ใส่ label id ที่ `U-DB-06` |
| Q2 | audit แล้วว่ามีของครบ (org-leak kit 4+1 persona · route-registry · `assertions.kit` · hash-at-rest) — **แต่ยังไม่ได้รันยืนยันรอบนี้** |
| Q3 | **เขียนครบ 13 เคส + กติกา 3 ข้อ + non-vacuity** · typecheck/lint เขียว · **ยังไม่ได้รันจริง → ต้องรอ CI** |
| Q4–Q7 | ยังไม่เริ่ม (Q5/Q6 ต้องมี DB · Q7 เป็น Track 2 ไม่บล็อก merge) |

### Q3 รอบแรกบน CI: 11/13 เขียวทันที · แดง 3 จุด **และทั้งสามจุดเป็นเทสต์ผิด ไม่ใช่โค้ดผิด**

รัน `integration-api` จริง ([run 31607767660](https://github.com/thewinwebdevelop/spec-inventory-manager/actions/runs/31607767660)) —
เคสที่ผมเดาว่าเสี่ยงสุด (I-C-08 ต้อง `[200,200]` · I-C-12 ต้อง `LAST_OWNER` · I-C-13 ทั้ง 6 ข้อย่อย) **ผ่านหมดรอบแรก**
และกติกา "ห้ามมี `40P01`/`40001`" ก็ผ่าน ⇒ คำอ้างของ architecture §5.1 เรื่องลำดับคว้า lock **มีหลักฐานแล้ว**

| แดง | สาเหตุจริง | แก้ที่ |
|---|---|---|
| I-C-02 | code ที่ ship คือ **`INVITATION_ALREADY_ACCEPTED`** · **test-plan §8 เขียนย่อว่า `ALREADY_ACCEPTED` ซึ่งไม่มี code นี้อยู่จริง** และผมลอกคำย่อมาใส่ assertion | เทสต์ (contract ชนะคำย่อในแผน) |
| I-C-04 | round 5 ได้ `409 ALREADY_MEMBER` ซึ่ง **ถูกต้อง**: accept อ่านก่อน revoke commit ⇒ ตอนนั้นยังเป็นสมาชิก active อยู่ (I-9) · ลิสต์ code ของผมแคบเกินไป | เทสต์ (invariant "ห้ามถอดแล้วกลับเข้ามา" ผ่านอยู่แล้ว) |
| `afterAll` | `Membership_organizationId_roleId_fkey` — kit ลบเฉพาะแถวที่ **kit สร้าง** แต่ suite นี้สร้างแถวผ่าน **แอปจริง** (accept เขียน membership, `POST /invitations` เขียน invitation) ซึ่งยังชี้ไปที่ role ของ kit | เทสต์ (กวาดตาม `organizationId` ก่อน `kit.cleanup()`) |

> **หมายเหตุถึง qa/@product:** ข้อแรกเป็นข้อผิดพลาดในเอกสาร ไม่ใช่แค่ในเทสต์ — `test-plan.md §8` แถว I-C-02
> ควรแก้ `ALREADY_ACCEPTED` → `INVITATION_ALREADY_ACCEPTED` ให้ตรง `ERROR_CODES` + api-spec §4
> (ผมไม่แก้ test-plan เอง: เป็นไฟล์ของ qa)
>
> ข้อที่สามคือรูปเดิมที่เคยเจอในรอบ security review ("test debris ของผมเองทำให้ scan พัง") — คราวนี้เจอเพราะ
> รันจริงเท่านั้น ไม่มีทางเจอจาก typecheck/lint

### Q3 รอบสอง: เขียวครบ — **ยืนยันแล้วว่า "ผ่าน" ไม่ใช่ "เขียนเสร็จ"**

[run 31608348040](https://github.com/thewinwebdevelop/spec-inventory-manager/actions/runs/31608348040) — **8 job เขียวหมด**
· `integration-api` รายงาน `test/concurrency-matrix.int.test.ts (14 tests) 30374ms`
· I-37 floor guard รายงาน `14 passed, 0 failed, 0 skipped`

⇒ ที่รันจริงคือ **20 รอบ × 11 เคส + 3 รอบของ I-C-13** บน Postgres จริง ใน 30 วินาที

**สิ่งที่ตอนนี้มีหลักฐาน (ไม่ใช่คำอ้างในเอกสารอีกแล้ว):**
- architecture §5.1 "คว้า lock ลำดับเดียวกันทุกเส้นทาง ⇒ ไม่มี deadlock" — ไม่มี `40P01`/`40001` โผล่ใน output ของทั้ง suite
- §8 กติกา 1 "ห้ามมี 500 จาก race" — 0 ครั้งจากทุก response ที่ suite ยิง
- §8 กติกา 3 "audit ต้องไม่บวมและไม่โกหก" — I-C-11 ได้ event ใบเดียวต่อการถอดหนึ่งครั้ง ทุกรอบ · I-C-13 ได้ 0 ใบ
- D-029 ไม่ได้เปิดทางให้ร้านล็อกตัวเองออก — I-C-12 เหลือ owner 1 คนทุกรอบ

**หมายเหตุที่ต้องอ่านคู่กัน:** ใน job `node-ci` ไฟล์นี้ขึ้น `14 skipped` (ไม่มี DB env) — นั่นคือรูปที่ I-37 floor
มีไว้จับพอดี: ถ้าไม่มี floor ไฟล์นี้ skip ทั้งไฟล์แล้ว lane ก็ยังเขียว

## T-002-Q4 — regression pack: ทำให้ "ทะเบียน 41 finding" เป็นของที่ตรวจได้ (2026-08-12)

### ปัญหาที่แท้จริงของ Q4 ไม่ใช่ "ขาดเทสต์" แต่คือ **ไม่มีใครเทียบทะเบียนกับต้นไม้เทสต์**

§16 เรียก §9 ว่า "permanent pack" (ลบสมาชิกต้องมี D-XXX) · §17.11(ก) ทำให้ "ทุก finding มีเทสต์ **หรือ**
มีเหตุผลเป็นลายลักษณ์ — ช่องว่าง = แดง" เป็นเงื่อนไข verdict · **แต่ทั้งสองประโยคอยู่ใน markdown เท่านั้น**
ตารางอยู่ในเอกสาร เทสต์อยู่ในโค้ด ไม่มีอะไรเทียบกัน ⇒ เทสต์ที่ถูกลบ/ย้าย/เปลี่ยนชื่อ ทะเบียนก็ยัง "อ้างว่าปิดแล้ว" ต่อไป
— **รูปเดียวกับที่ delta review จับ NEW-1 ได้** (กฎที่เชื่อว่าปิดเพราะเอกสารบอกว่าปิด)

⇒ `test/regression-pack.ts` (ทะเบียน 41 ข้อเป็น **data**) + `test/regression-pack.test.ts` (gate)
- ทุกแถวต้องมี **pin** (ไฟล์ + marker ที่ต้องมีอยู่จริง) **หรือ** `noTest` ที่เขียนเหตุผลจริง (ยาวกว่า 40 ตัวอักษร — เหตุผลคำเดียวคือช่องว่างที่ใส่จุด)
- ทุก pin ต้อง resolve ได้จริง: ไฟล์ยังอยู่ + ยังมี marker
- แถวที่ไม่มีเทสต์ **ห้าม** ติด tier ว่า runnable · แถวที่มีเทสต์ห้ามติด `none`
- **smoke tier ระบุเป็นชื่อ ไม่ใช่จำนวน** — ถอด finding ออกจาก smoke = diff ที่มองเห็น (§16 บังคับ D-XXX)
- NEW-1 ต้อง pin **ทั้งสองชั้น** (core-domain + int) ตาม §17.11(ข)
- self-check: pin ที่ชี้ไฟล์ไม่มีจริง / marker ไม่มีจริง ต้องถูกจับ

> **ขอบเขตที่ gate นี้พิสูจน์ไม่ได้ (เขียนไว้ในหัวไฟล์ด้วย):** มันพิสูจน์ว่า "เทสต์ยังอยู่ตรงที่ทะเบียนบอก"
> **ไม่ได้**พิสูจน์ว่าเทสต์นั้นยัง assert สิ่งที่ถูก — การลดความเข้มของ assert ข้างในไฟล์ที่ pin ไว้ gate นี้มองไม่เห็น
> (นั่นคืองานของ code review) · เขียนไว้ตรง ๆ เพราะ **gate ที่ถูกเชื่อว่าพิสูจน์มากกว่าที่ทำได้ แย่กว่าไม่มี gate**

### สิ่งที่ gate จับได้ทันทีในการรันครั้งแรก: **M-3 ไม่มีเทสต์เลย**

§9.0 pin M-3 (cap ต้องไม่นับคำเชิญที่หมดอายุ) ไว้ที่ **"I-27"** — **ไม่มี I-27 อยู่จริง** ·
`INVITATION_LIMIT_REACHED` มีใน service, ใน error registry, ใน contract · **ไม่มีในเทสต์ไฟล์ไหนเลย**
⇒ กฎถูก implement ถูกต้อง (`expiresAt: { gt: now }`) แต่ไม่มีอะไรเฝ้า

เขียนปิดใน `invitations.e2e.int.test.ts` เป็นคู่:
- seed คำเชิญ **หมดอายุเต็มโควตา (100 ใบ)** → เชิญคนใหม่ต้อง **201**
- control: seed **ที่ยังไม่หมดอายุ 100 ใบ** → ต้อง `409 INVITATION_LIMIT_REACHED` + `details.limit = 100`
  (ถ้าไม่มีครึ่งหลัง เทสต์แรกจะเขียวบน build ที่ไม่มี cap เลย)
- ค่า 100 อ่านจาก `INVITATION_PENDING_CAP_DEFAULT` ไม่ใช่เขียนเลขซ้ำในเทสต์

### G-15 — tripwire ของ NEW-10 ที่ §17.11(ฉ) บังคับ แต่ **ไม่เคยมีอยู่**

NEW-10 (`canAssignRole` ไม่กัน privilege superset) **ทดสอบไม่ได้ใน F-002 จริง ๆ** — role คงที่ 3 ตัว ไม่มี role CRUD
⇒ เทสต์ที่เขียนไปก็จะเขียวตลอดกาลโดยไม่พิสูจน์อะไร ซึ่งคือรูป gate ที่โปรเจกต์นี้จับได้ในรีวิวตัวเองมาแล้ว 6 ครั้ง

`src/orgs/role-capability-write-tripwire.test.ts` จึงเป็น **tripwire ไม่ใช่คำสัญญา**: แดงทันทีที่มีไฟล์นอก allowlist
เขียน `Role` หรือรับ `capabilities` มาจาก request ⇒ เปลี่ยน "F-003 **ควร**จัดการเรื่องนี้" เป็น "F-003 **merge ไม่ได้**ถ้าไม่จัดการ"
· allowlist มีไฟล์เดียว (provisioning ที่สร้าง role จาก `SYSTEM_ROLE_BLUEPRINT` ที่ frozen) และมีเทสต์ว่า **เหตุผลของ allowlist ยังจริงอยู่**

**mutation บนไฟล์จริง:** เพิ่ม `role.update({ data: { capabilities: dto.capabilities } })` ใน `members.service.ts`
⇒ **แดง 2 ข้อ** (กฎ role-write และกฎ capabilities-from-input จับแยกกันคนละทาง) · คืนค่าแล้วเขียว

### เรื่องที่ตัดสินใจ **ไม่** ทำ และเหตุผล

**ไม่สร้างตัวรัน smoke tier แยกใน CI** — §16 ตั้งเป้า "smoke < 5 นาที" แต่ตอนนี้ทั้ง suite รันบนทุก PR อยู่แล้วใน ~3 นาที
⇒ กลไกคัดเลือกยังไม่ให้ประโยชน์อะไรวันนี้ และการทำ registry แบบชื่อเทสต์จะต้องไป**เปลี่ยนชื่อเทสต์ ~25 ตัวในไฟล์ของ backend-api**
· สิ่งที่ขาดจริงคือ **การบังคับสมาชิกภาพของ tier** ซึ่ง gate ข้างบนทำแล้ว (ถอดออกจาก smoke = แดง)
⇒ ถ้า suite โตจนเกิน 5 นาทีเมื่อไหร่ ค่อยสร้างตัวรันจาก registry เดิมนี้ได้เลย

### ถึง qa: สองแถวใน `test-plan.md` ที่ควรแก้ (ผมไม่แก้เอง — ไฟล์ของ qa)

1. §9.0 แถว **M-3**: pin "I-27" → ไม่มีอยู่จริง ควรชี้ไปที่คู่เทสต์ใหม่ใน `invitations.e2e.int.test.ts`
2. §8 แถว **I-C-02**: `ALREADY_ACCEPTED` → `INVITATION_ALREADY_ACCEPTED` (จากรอบก่อน)

`api unit 664 tests` (+13) · lint ✓ typecheck ✓ · int lane +2 เคส (floor 21→23, min-passed 199→201)

### Q4 ยืนยันบน CI: เขียวครบ 8 job ([run 31616406240](https://github.com/thewinwebdevelop/spec-inventory-manager/actions/runs/31616406240))

- `integration-api`: `test/invitations.e2e.int.test.ts` → **23 passed, 0 failed, 0 skipped** ⇒ คู่เทสต์ M-3 รันจริงกับ Postgres จริง **ผ่านรอบแรก**
- `node-ci`: `regression-pack.test.ts` 7 ✓ · `role-capability-write-tripwire.test.ts` (G-15) 6 ✓
- floor ใหม่ `invitations.e2e.int.test.ts=23` ทำงาน (guard พิมพ์ยืนยันจำนวนที่รันจริง)

## T-002-Q6 — perf smoke ครบ 4 เคสของ §14 (2026-08-12)

`test/perf-smoke.int.test.ts` — P-01..P-04 · **right-size ไม่ใช่ load test**: 4 รูปแบบ, process เดียว, ไม่มี concurrency
· คำถามคือ "ร้านขนาดจริงยังตอบในเวลาที่รับได้ไหม" ไม่ใช่ "รับได้กี่ req/s" (load test บน CI runner ที่แชร์กัน = วัด runner)

| id | สถานการณ์ | budget | สถิติที่ใช้ |
|---|---|---|---|
| P-01 | 200 สมาชิก + 100 คำเชิญ → `GET /members?limit=25` | p95 < 200 ms | p95 |
| P-02 | user อยู่ 50 ร้าน → `GET /me/organizations` | p95 < 150 ms | p95 |
| P-03 | ราคาของ membership lookup ต่อ request | < 5 ms | **median delta** |
| P-04 | `GET /invitations?limit=25` บน 100 ใบ | p95 < 200 ms | p95 |

### สามข้อที่ตัดสินใจแล้วเขียนเหตุผลไว้ในไฟล์

1. **P-03 ใช้ผลต่างของ median ไม่ใช่ p95** — ของที่วัดมีขนาด ~5 ms · ผลต่างของ p95 สองตัวบน runner ที่มีเพื่อนบ้าน
   คือผลต่างของ outlier สองตัว = **วัดอารมณ์ของ runner แล้วเรียกว่า tenancy overhead** · median ทนต่อ process ข้างเคียง
   (รายงาน max ควบไว้ด้วย เผื่อ tail ถดถอยจริง) · **ค่าติดลบไม่ใช่ failure** — แปลว่า lookup ถูกกว่า noise ซึ่งคือคำตอบที่ §1.5 หวัง
2. **§14 บอกว่า "เกิน budget = ต้องมีคำอธิบาย ไม่ใช่ retry จนผ่าน"** ⇒ suite นี้ **ไม่ retry** และ **พิมพ์ตัวเลขทุกเคสเสมอ**
   ไม่ว่าจะผ่านหรือไม่ผ่าน — ตัวเลขคือของที่ส่งมอบ ส่วน assertion เป็นแค่สัญญาณเตือน
3. **200 สมาชิกไม่ได้สร้างด้วย `kit.createUser`** — hasher ของ production ช้าโดยเจตนา 200 ครั้ง = เสียเวลานาทีนึงพิสูจน์ว่า argon2 ทำงาน
   ⇒ insert ตรงด้วย placeholder ที่ **หน้าตาไม่เหมือน hash เลย** (`"not-a-hash · perf fixture · this account cannot log in"`)
   บัญชีพวกนี้ไม่เคย login · คนเดียวที่ login คือ Owner ซึ่งมาจาก kit พร้อม hash จริง

**เทสต์ตัวที่ 5 = non-vacuity ของ fixture**: assert ว่ามีสมาชิก 201 แถวและคำเชิญ 100 ใบจริง ๆ ·
ถ้า seed พลาดเหลือ 2 แถว ทุก budget ข้างบนจะผ่านสบาย ๆ แล้วไม่ได้พิสูจน์อะไร — กับดักเดียวกับ gate ที่แดงไม่ได้

**fixture ใหม่ `PingController`** (`@Public`, ไม่ทำอะไรเลย) — P-03 ต้องมี baseline ที่ทำทุกอย่างเหมือนกันยกเว้น tenancy chain ·
`boom/public` ใช้ไม่ได้เพราะมัน throw (จะกลายเป็นวัด exception filter) · แยก controller ไม่ใช่เพิ่ม route ใน `ProbeController`
เพราะ `@Get("public")` จะไปอยู่ข้าง `@Get(":orgId")` ซึ่ง Nest match ตามลำดับประกาศ = "ร้านชื่อ public" ในอีก refactor เดียว

`f002-seed.kit.test.ts` ที่ assert รายชื่อ fixture controller แบบ **exact list** แดงทันที ⇒ แก้ในคอมมิตเดียวกัน
**ไม่ผ่อนเป็น `toContain`** (การผ่อนคือการปิดตาเรื่อง "fixture ตัวไหนมีอยู่บ้าง" ซึ่งเป็นเรื่องที่ควรแดงเมื่อเปลี่ยน)

`api unit 664` · lint ✓ typecheck ✓ · CI floor `perf-smoke.int.test.ts=5`, min-passed 201→206
**ยังไม่ได้รันจริง** (ไม่มี Postgres ในเครื่อง) — ต้องรอ CI

### Q6 ผลจริงบน CI ([run 31618708716](https://github.com/thewinwebdevelop/spec-inventory-manager/actions/runs/31618708716)) — เขียวครบ 8 job

**baseline ครั้งแรก (2026-08-12, GitHub-hosted ubuntu-latest + service container Postgres):**

| id | สถิติ | วัดได้ | budget | median | max | headroom |
|---|---|---|---|---|---|---|
| P-01 | p95 | **16.7 ms** | 200 | 8.7 | 20.7 | ~12× |
| P-02 | p95 | **12.3 ms** | 150 | 7.2 | 14.5 | ~12× |
| P-03 | median-delta | **1.4 ms** | 5 | 2.8 | 6.2 | ~3.5× |
| P-04 | p95 | **10.1 ms** | 200 | 7.2 | 12.2 | ~20× |

**P-03 = 1.4 ms คือราคาที่ §1.5 จ่ายเพื่อ "ไม่ cache membership"** — middleware + 2 guards + membership lookup ต่อ request
· ตัวเลขนี้ทำให้การตัดสินใจนั้นมีราคาที่อ้างอิงได้ ไม่ใช่ความรู้สึก

### ข้อสังเกตที่ต้องบันทึกไว้ ไม่ใช่ปล่อยผ่านเพราะเขียว

budget มี headroom 12–20× ⇒ **budget อย่างเดียวจับการถดถอยที่มีความหมายไม่ได้** — ถ้า P-01 แย่ลงจาก 16.7 เป็น 100 ms
(เลวลง 6 เท่า, น่าจะแปลว่ามี query ต่อแถวโผล่มา) มันก็ยัง "ผ่าน" budget 200 สบาย ๆ

⇒ **ตัวที่ใช้จริงคือกติกา ±50% เทียบ baseline ของ §14** ซึ่งใช้ได้ก็ต่อเมื่อ **baseline ถูกจดไว้** — ตารางข้างบนคือ baseline นั้น
· ยังไม่ทำเป็น gate อัตโนมัติ เพราะตัวเลขผูกกับสเปกของ runner (§14 เขียนเองว่าให้ใช้เป็นสัญญาณ + วิจารณญาณคน)
⇒ **ถ้าจะทำ gate ต้องเก็บ baseline ต่อ runner class ไม่ใช่ค่าเดียวทั้งโปรเจกต์** — ข้อเสนอนี้ฝากไว้ให้ devops/qa ตัดสิน

## T-002-Q5 (ส่วน E2E อัตโนมัติ) — ทำเท่าที่ **พิสูจน์ได้จริงวันนี้** และบอกให้ชัดว่าที่เหลือขาดอะไร (2026-08-14)

### สถานะจริงของ E2E ในโปรเจกต์: **ยังไม่มี Playwright เลย**

`ci.yml` job `e2e-web` boot web server จริงแล้วยิง `GET /` เป็น smoke — และมี notice เขียนไว้เองว่า
"apps/web has no 'test:e2e' script yet" · **ไม่มี Playwright config, ไม่มี browser runner** ·
E-01..E-09/E-13 ต้องมี **stack ครบ** (Postgres + Redis + API + web) ในเลนเดียวกัน ซึ่งวันนี้ `e2e-web` ไม่มี service container เลย
⇒ **เป็นงาน devops ไม่ใช่งานที่เขียนเทสต์เพิ่มแล้วจบ** — ระบุไว้ท้ายหัวข้อว่าต้องการอะไรบ้าง

### ที่ทำได้และทำแล้วในรอบนี้ (3 แถวของ §12.1)

**E-11 · copy lint (static)** — `apps/web/src/features/org/copy-lint.test.ts`
§12.1 เรียกมันเองว่า "เทสต์ถูกที่สุดที่บังคับ AC เชิงถ้อยคำได้" · สแกน **ทั้ง web และ mobile** (รวมค่าใน `app_th.arb`)
- **ครึ่งลบ:** ห้ามมีประโยคที่บอกว่าลิงก์เดิมยังใช้ได้ · **เป็นวลี ไม่ใช่คำว่า "ลิงก์เดิม"** เพราะคำเตือนที่ถูกต้อง
  ("ลิงก์เดิมจะใช้ไม่ได้ทันที") มีคำนั้นอยู่ — lint ที่แบนคำจะแบนประโยคที่ D-027 บังคับให้มี
- **ครึ่งบวก:** คำเตือน "แสดงครั้งเดียว" ต้อง **ยังมีอยู่ทั้งสองแพลตฟอร์ม** — ถ้าลบทิ้ง คำสั่งห้ามทุกข้อจะผ่านหมด
- **strip comment ก่อนสแกน** เพราะ 3 ไฟล์ในรีโปอธิบายกฎนี้ด้วยการยกวลีต้องห้ามมาเขียน ·
  และ **ข้าม `.test.ts`/`_test.dart`** เพราะ ban list ของ lint เองก็คือรายการวลีต้องห้าม (ไฟล์นี้ flag ตัวเองในการรันครั้งแรก)
- `@key` ของ arb = metadata ของ dev ไม่ใช่ copy ⇒ ไม่สแกน (ตรงนั้นมีวลีต้องห้ามอยู่จริงโดยเจตนา)
- **mutation ทั้งสองฝั่ง:** ใส่ `"คัดลอกลิงก์เดิม"` ใน `i18n.ts` ⇒ แดง · ใส่ `"ใช้ลิงก์เดิม"` ใน `app_th.arb` ⇒ แดง

**E-12(ข) · token ไม่อยู่ใน web storage** — เพิ่มใน `InviteScreen.test.tsx`
เทสต์เดิมพิสูจน์แค่ว่า token หลุดออกจาก URL · **การถอดออกจาก address bar ไม่มีความหมายถ้าค่าถูกฝากไว้ใน `localStorage` ระหว่างทาง**
— XSS หน้าไหนก็อ่านได้ และมันอยู่ข้ามแท็บ ต่างจาก URL · assert ครบ localStorage + sessionStorage + cookie

**E-14(ข)(ค) · TIN ไม่อยู่ใน storage และ reload แล้วต้องขอใหม่** — เพิ่มใน `TaxProfileCard.test.tsx`
เทสต์เดิมพิสูจน์ว่าหายจาก DOM · อันใหม่พิสูจน์ว่า**ไม่มีอะไรรอดข้ามจอ**: TIN ใน storage = ค่าที่ capability gate + audit +
rate limit คุมไว้ กลายเป็นของที่ใครก็หยิบทีหลังได้ · (ค) unmount แล้ว mount ใหม่ = สิ่งที่ reload เป็นในมุมของ component
— ถ้าเลขกลับมาเอง แปลว่ามันมาจากที่ที่รอดมา ซึ่งคือสิ่งที่ (ข) ห้าม

**mutation:** เขียน TIN ลง `sessionStorage` ใน `TaxProfileCard.tsx` ⇒ แดง · เขียน token ลง `localStorage` ใน
`use-invite-token.ts` ⇒ แดง · คืนค่าแล้วเขียวทั้งคู่

### ที่ยัง **ทำไม่ได้** และต้องการอะไร (ส่งต่อ devops)

| แถว | ต้องการ |
|---|---|
| E-01..E-09, E-13 | Playwright + **stack ครบใน job เดียว**: Postgres + Redis + API (`APP_ROLE=api`) + web build · `e2e-web` วันนี้ไม่มี service container |
| E-10 (mobile) | `integration_test/` ของ Flutter ต้องมี emulator/simulator ใน CI — `flutter-ci` วันนี้รันแค่ analyze + test |
| E-12(ก)/E-14(ง) ครึ่งเบราว์เซอร์จริง | network tab จริง + IndexedDB จริง — jsdom ไม่มี IndexedDB (ผม assert เท่าที่ jsdom มี: localStorage/sessionStorage/cookie/DOM) |

> **ผมไม่ประกาศว่า E-12/E-14 ปิดแล้ว** — ปิดเฉพาะข้อย่อยที่ jsdom พิสูจน์ได้ · ข้อย่อยที่เหลือรอเลน browser จริง

`web 293 tests` (+5) · lint ✓ typecheck ✓

### Q5 (ส่วน E2E) ยืนยันบน CI: เขียวครบ 8 job ([run 31732617996](https://github.com/thewinwebdevelop/spec-inventory-manager/actions/runs/31732617996))

`node-ci` รัน web suite 293 tests รวม E-11 copy lint (สแกน mobile tree ด้วย) และข้อย่อย storage ของ E-12/E-14

**Q5 ยังไม่ done** — ที่ทำแล้วคือ 3 แถวจาก 14 แถวของ §12.1 · ที่เหลือรอ 2 อย่างซึ่ง **ไม่ใช่งานเขียนเทสต์**:
1. **Playwright + stack ครบใน `e2e-web`** (Postgres + Redis + API + web) — วันนี้ job นั้นไม่มี service container เลย
2. **emulator ใน `flutter-ci`** สำหรับ E-10

⇒ ทั้งสองข้อเป็น **devops** · ส่วน manual §12.2 (M-01..M-07) เป็นของคน ทำแทนไม่ได้ — และ §17.6 บังคับว่าต้องทำก่อนออก verdict

## T-002-D2 — env ต่อ environment + log scrubbing (2026-08-14)

D2 มีสองครึ่งที่คนละธรรมชาติกัน: ครึ่งหนึ่ง**เขียนโค้ดบังคับได้** อีกครึ่ง**ยังบังคับไม่ได้เพราะ Phase 0 ไม่มี environment จริง**
· ทำทั้งสองครึ่ง แต่ไม่แกล้งทำให้ครึ่งหลังดูเหมือนเสร็จ

### ครึ่งที่บังคับได้: `.env.example` กับ schema ห้าม drift

`env.ts` บรรทัด 5 เขียนไว้ว่า *"The list of required vars mirrors .env.example at the repo root exactly"*
· **ไม่มีอะไรเช็คประโยคนี้** — เคส POSITIVE ใน `env.test.ts` เป็น **สำเนาที่พิมพ์ด้วยมือ** ของไฟล์นั้น
⇒ schema กับไฟล์ที่ operator เอาไปคัดลอกจริง drift ได้ทั้งสองทาง และรู้ตัวอีกทีตอน**service ไม่ยอม boot ใน environment ที่ deploy ไปแล้ว**

`packages/config/src/env-example.test.ts` อ่านไฟล์จริงแล้วเทียบสองทาง:
- **var ที่ required ต้องอยู่ใน `.env.example`** — ทางที่พังจริง: ใครตั้ง environment จากไฟล์เก่าจะได้ service ที่ exit ตอน start
- **var ที่อยู่ในไฟล์ต้องมีคน validate หรือมีคำอธิบายว่าใครอ่าน** — `API_ORIGIN` (apps/web อ่าน) และ
  **`TRUSTED_PROXY_IPS` ซึ่ง _ไม่มีโค้ดไหนอ่านเลย_** (เอกสารบอก operator ให้ตั้ง แต่ไม่มี consumer)
  ⇒ ใส่ allowlist พร้อมเหตุผล **ไม่ใช่เอาเข้า schema** เพราะการ validate มันจะทำให้ดูเหมือน implement แล้ว
- แยก `envObjectSchema` ออกจาก `envSchema` (object + superRefine) เพื่อ enumerate key ได้ — เหตุผลเขียนไว้ในไฟล์

**mutation สองทาง:** comment `DEFAULT_ORG_PLAN_KEY` ทิ้ง ⇒ แดง · เพิ่ม var ที่ไม่มีใคร validate ⇒ แดง

### ครึ่งที่เป็นเอกสาร (Phase 0 ไม่มี deploy target)

**`infra/env/README.md`** — matrix ของ 3 ตัว × 4 environment + **ผลที่ตามมาเมื่อตั้งผิด** ซึ่งเป็นส่วนที่ operator เดาเองไม่ได้:
- `DEFAULT_ORG_PLAN_KEY` ผิด/ไม่ได้ seed ⇒ **สร้างร้านได้ 503 ทุกครั้ง** ขณะที่ทุก endpoint อื่นปกติ (ไม่ใช่ outage)
- `INVITATION_TOKEN_SECRET` **หมุนแล้วคำเชิญที่ค้างตายหมดเงียบ ๆ** (hash ทางเดียว re-key ไม่ได้) ⇒ ต้องยกเลิกของค้าง + แจ้งให้ออกลิงก์ใหม่ก่อน · และ**ห้ามใช้ค่าเดียวกันข้าม environment** เพราะ token ที่ออกจากที่หนึ่งจะใช้ได้อีกที่
- `WEB_APP_BASE_URL` ผิด **ไม่พังตอน boot** — ได้ลิงก์คำเชิญที่ชี้ผิดโฮสต์ และคนที่รู้คือผู้ถูกเชิญ

**`infra/gateway/README.md`** — กฎ log scrubbing + config จริงของ nginx/Caddy
· กฎคือ **path ของ `/invitations/*` log ได้ แต่ query string ห้าม log เลย** และ body ของ preview/accept ห้าม log เลย
· ระบุสถานะตามจริง 3 ชั้น: **(ก)** log call ของแอปเอง — บังคับแล้วด้วย gate ของ Q1 **(ข)** request logger — **ยังไม่มี**
**(ค)** proxy — **ตั้งไม่ได้ ยังไม่มี deploy target** · และเขียนไว้ว่า ถ้า PaaS ไหน log URL เต็มโดยเปลี่ยน format ไม่ได้
**นั่นคือ finding ที่ต้องยกก่อน launch ไม่ใช่รายละเอียดที่รับไว้เฉย ๆ**

### ที่ยัง **ทำไม่ได้** และไม่ควรแกล้งว่าทำได้

ค่าจริงของ secret ต้องอยู่ใน secret store ของ environment นั้น — **ผมไม่สร้าง ไม่ถือ และไม่ commit ค่าจริง** ·
สิ่งที่ทำได้คือทำให้ "ค่าไหนไปที่ไหน ใครตั้ง ตั้งผิดแล้วเกิดอะไร" เขียนไว้ครบ และทำให้ contract กับโค้ด drift ไม่ได้

`config 63 tests` (+6) · lint ✓

## T-002-Q7 — Track 2 agentic: runbook + finding แรก **ที่เจอโดยไม่ต้องเปิดเบราว์เซอร์** (2026-08-14)

`docs/features/F-002/agentic-track2.md` — persona 2 ตัว · 7 flow เรียงตามความคุ้ม · ให้คะแนน **2 มิติแยกกัน**
(*ทำสำเร็จไหม* กับ *เข้าใจไหมว่าเกิดอะไรขึ้น*) เพราะ flow ที่ "ทำสำเร็จแต่ไม่เข้าใจ" คือคู่ที่ต้องรายงานที่สุด ·
บันทึก **ประโยคที่ผู้ใช้ลังเลตอนอ่าน แบบคำต่อคำ** ไม่ใช่สรุปความ

### 🔴 finding: ปุ่ม "ออกลิงก์ใหม่" และ "ยกเลิกคำเชิญ" **ยิงทันทีตั้งแต่กดครั้งแรก**

flow 2 ถามว่า "ผู้ใช้เข้าใจไหมว่าลิงก์เดิมตาย" — อ่านโค้ดเทียบ spec ตอบได้เลยโดยไม่ต้องเปิดเบราว์เซอร์:

> ทั้งสองปุ่ม **ไม่มี dialog ยืนยัน ไม่มีคำเตือน ไม่มี toast หลังทำ** ·
> ลิงก์ที่ผู้เชิญส่งไปใน LINE แล้วหยุดทำงานทันที **และไม่มีอะไรบนจอบอกเลย ทั้งก่อนและหลัง**

ux-wireframe **§9.2/§9.3 บังคับให้มี dialog ทั้งคู่** และ Contract summary ข้อ 4 เขียนว่า "ยืนยันก่อนเสมอ"
⇒ นี่ไม่ใช่ปัญหา copy ที่การรัน agentic จะช่วยได้: **ไม่มี dialog = flow 2 ได้ 1 คะแนนเต็มสิบครั้งจากสิบครั้ง**

แก้ในรอบเดียวกันด้วย copy verbatim ของ ux + เทสต์ 7 เคส:
กดครั้งแรก = **ถาม** · dialog บอกผลที่ตามมา **และระบุว่าเป็นคำเชิญของใคร** (ถามว่า "แน่ใจไหม" เฉย ๆ คือ dialog ที่คนเรียนรู้ที่จะกดผ่าน) ·
ปุ่มปฏิเสธของ dialog ยกเลิกคำเชิญคือ **"ไม่ยกเลิก"** (ถ้าใช้ "ยกเลิก" สองปุ่มในแถวเดียวกันจะแปลว่าคนละเรื่อง) · focus อยู่ที่ปุ่มปลอดภัย

### และ copy lint ที่ผมเพิ่งเขียนเอง **จับ copy ของ ux ผิด**

ban list มีวลี `"ส่งลิงก์เดิม"` · ประโยคจริงของ ux §9.2 คือ *"ถ้าคุณส่งลิงก์เดิมให้ใครไว้ ต้องส่งลิงก์ใหม่ให้เขาแทน"*
— เป็น **past conditional** ("ถ้าคุณส่งไปแล้ว") ซึ่งเป็นประโยคที่ D-027 ต้องการพอดี

⇒ **lint ที่ทำให้ copy ที่อนุมัติแล้วแดง คือ lint ผิด ไม่ใช่ copy ผิด** · narrow เป็น `"ส่งลิงก์เดิมอีกครั้ง"` / `"ส่งลิงก์เดิมได้"`
(สิ่งที่ห้ามคือ**สั่งให้ส่งตอนนี้** ไม่ใช่การพูดถึงอดีต) · re-verify แล้วว่ารูปที่แย่จริงยังแดงอยู่

### ที่ Track 2 ยังรันจริงไม่ได้

ไม่มีเลนเบราว์เซอร์ (เหตุผลเดียวกับ Q5) ⇒ ต้องมี stack รันในเครื่อง (Postgres + Redis + API + web)
· จนกว่าจะมี compose dev stack หรือ deploy target **Track 2 เป็นงาน manual-with-an-agent ไม่ใช่ scheduled job**

**สิ่งที่ยังคุ้มจะรัน flow 2 อยู่:** ประโยค "ลิงก์เดิมที่ส่งไปแล้วจะใช้ไม่ได้ทันที" ผู้อ่านตีความว่า
*"ข้อความที่ฉันส่งไปแล้วใช้ไม่ได้แล้ว"* หรือเปล่า — คำถูกแล้ว แต่จะ**ลง**หรือไม่ มีแต่คนอ่านที่ตอบได้

`web 300 tests` (+7) · lint ✓ typecheck ✓

## T-002-Q5 (ต่อ) — สร้างเลนเบราว์เซอร์จริง: 3 รอบแดง เจอ 3 อย่างที่ไม่มีใครเจอมาก่อน (2026-08-15)

`e2e-web` เดิม boot web ตัวเดียวแล้วยิง `GET /` · ตอนนี้ยก **Postgres + Redis + migrate + seed + API + web** ครบ
และ **ลบเงื่อนไข `if apps/web declares test:e2e`** ที่ทำให้ job นี้เขียวมาหลายเดือนบน repo ที่ไม่มี browser suite เลย
(รูป "เขียวเพราะไม่ได้รัน" ที่ I-37 มีไว้จับ นั่งอยู่ในเลนที่ควรเป็นด่านสุดท้าย)

### รอบ 1 · build ของ API ล้ม
`Cannot find module '@omnistock/core-domain'` — job build แค่ `web^...` ⇒ เปลี่ยนเป็น turbo build ทั้งสองแอป
· **guard I-37 ที่เพิ่งเขียนทำงานถูก**: job ไม่ได้ผ่านแบบเงียบ ๆ แต่แดงด้วย "no Playwright report was produced"

### รอบ 2 · 🔴 **`node dist/main.js` รันไม่ได้ — production start script ของ repo ไม่เคยทำงาน**

```
ERR_MODULE_NOT_FOUND  file:///…/packages/config/src/env
```

`@omnistock/config` ship **TypeScript source** (`main: "src/index.ts"`) — tsx/vitest/webpack resolve ได้ **Node เปล่า ๆ ไม่ได้**
⇒ `pnpm --filter api run start` **ไม่เคยทำงาน** และไม่มีใครรู้เพราะไม่เคยมีใครสตาร์ท API แบบนั้น (Phase 0 ไม่มี deploy target · ทุก suite รัน in-process)

**เลนนี้ boot ด้วย `tsx` แบบเดียวกับ `dev`** — เพราะเลนนี้ทดสอบ *แอป* ไม่ใช่ *การแพ็กเกจ* ·
**ไม่กลบช่องว่าง**: ต้องปิดก่อน deploy และเป็นงานระบบ build (ให้ workspace package emit JS หรือ bundle API) → **devops + backend-api**
· แก้ `main` ของ config ตอนนี้ = ไปแตะสิ่งที่ทุกเลนพึ่งพา ในคอมมิตที่ควรเป็นแค่ "ทำให้ E2E รันได้"

### รอบ 3 · 🔴 **login สำเร็จแล้วไปโผล่หน้า placeholder ของ F-000**

`login/page.tsx` เขียนว่า `router.push("/")` พร้อมคอมเมนต์ *"F-002 will own the post-login destination"*
— **F-002 ship จอครบแล้วและไม่เคยมารับ** ⇒ ล็อกอินสำเร็จแล้วเจอ *"apps/web placeholder shell (T-000-09)"*
และ flow ของร้านเข้าถึงได้ด้วยการพิมพ์ URL เอาเองเท่านั้น

ux-wireframe **§1.1 flow map เขียนไว้ตั้งแต่ต้นว่า login สำเร็จ → S1 `/select-org`** ⇒ แก้ตามนั้น
**เจอเพราะเขียน E-01** ซึ่งเป็นสิ่งแรกที่เดิน login → ร้าน เป็นการเดินทางเดียวกัน — ไม่มี component test ตัวไหนถามคำถามนี้ได้

และ selector: `getByLabel("รหัสผ่าน")` ชนกับปุ่ม `aria-label="แสดงรหัสผ่าน"` (คำหนึ่งเป็น substring ของอีกคำ) ⇒ `{ exact: true }`

### flaky ที่ต้องบันทึกตามกติกา §16 (ห้าม skip เงียบ)

`ChangePasswordForm > success/data state` แดง 1 ครั้งในการรัน suite เต็ม (6.2 วินาที) · รันเดี่ยวผ่าน (1.5 วินาที) ·
รัน suite เต็มซ้ำผ่าน ⇒ **timeout ภายใต้ load ไม่ใช่ตรรกะผิด** · ไม่เกี่ยวกับการแก้ redirect (คนละไฟล์ คนละ flow)
**เจ้าของ: frontend · เส้นตาย: ก่อน Gate F** — ถ้าเกิดซ้ำใน CI ให้ยก timeout ของเคสนั้นหรือแยก argon2 mock ออก **ห้าม `.skip`**

### รอบ 4 · 🔴 **แอปไม่มีทางรันที่ใช้งานได้เลย — ทั้ง `dev` และ `start` พังคนละแบบ**

`POST /auth/signup` ตอบ 500:

```
TypeError: Cannot read properties of undefined (reading 'checkIp')
  at AuthController.signup (auth.controller.ts:80)
```

`this.throttle` เป็น `undefined` — **DI ของ Nest ไม่ได้ inject อะไรเลย** เพราะ esbuild/tsx **ไม่ emit `design:paramtypes`**

**และ repo นี้รู้เรื่องนี้อยู่แล้ว** — `apps/api/vitest.config.ts` เขียนไว้ตรง ๆ:

> *"NestJS type-based DI needs emitted decorator metadata (`design:paramtypes`), which esbuild/tsx do NOT produce ...
> Without this, full-module @nestjs/testing builds inject `undefined` for typed constructor params
> (**the ThrottleService-into-controller bug**)"*

⇒ แก้ให้ **เลนเทสต์** ด้วย SWC แล้ว · **ไม่มีใครแก้ให้ตัวแอป**

| ทางรัน | สถานะ |
|---|---|
| `pnpm --filter api run start` (`node dist/main.js`) | ❌ `ERR_MODULE_NOT_FOUND` — config ship TS source |
| `pnpm --filter api run dev` (`tsx watch src/main.ts`) | ❌ DI inject `undefined` ทุกตัว — ไม่มี decorator metadata |
| เลนเทสต์ (vitest + SWC) | ✅ — เป็นทางเดียวที่แอปนี้เคย "ทำงาน" |

**เลน E2E ใช้ `tsx dist/main.js`**: entry ที่ tsc compile (มี metadata) + tsx เป็นตัว resolve TS-source package
— แต่ละครึ่งชี้ไปที่ช่องว่างคนละอัน และรวมกันคือคำอธิบายว่าทำไมไม่มีใครเคยเจอ: **ไม่เคยมีใครสตาร์ทแอปนี้นอก harness ของเทสต์**

⇒ ส่งต่อ **backend-api + devops**: ก่อน deploy ต้องเลือกทางใดทางหนึ่ง — ให้ workspace package emit JS,
หรือ bundle API, หรือย้าย build ไป SWC/nest-cli ให้ `dev` ใช้ได้จริง · **นี่ไม่ใช่การตัดสินใจของคนที่ทำ CI ให้เขียว**

### รอบ 5–6 · 🔴 **login สำเร็จแล้ว แอปยังเชื่อว่าไม่มีใครล็อกอิน** (บั๊กจริงบนโค้ดที่ ship แล้ว)

รอบ 5 ไปได้ไกลสุด: signup ✓ login ✓ `/select-org` ✓ `/orgs/new` ✓ **ร้านถูกสร้างจริง** (`/o/cmsttsxui…`)
→ **แล้วเด้งไป `/login`**

ผมกำลังจะเดาว่าเป็นเรื่อง cookie `Secure` บน http แล้ว**หยุด** — เดาผิด 1 ครั้ง = อีก 1 รอบ CI ⇒
ใส่ assertion ที่**แยกสองสมมติฐานออกจากกันได้**: หลัง login เช็ก `context.cookies()` มี `omni_rt` ไหม
· **มี** ⇒ ไม่ใช่เรื่อง cookie ⇒ ตัดสมมติฐานทิ้งได้ทั้งก้อน

**สาเหตุจริง:** `SessionProvider` bootstrap **ครั้งเดียวตอน mount** แล้วไม่เคยเปลี่ยนใจ · ไม่มีเมธอดให้บอกว่า "เพิ่งล็อกอินสำเร็จ"
⇒ login ที่เกิด **หลัง** bootstrap ไม่อัปเดต state เลย

| route | อ่าน session ไหม | ผล |
|---|---|---|
| `/select-org`, `/orgs/new` | ไม่อ่าน | ✅ ทำงานปกติ |
| `/o/{orgId}` (`OrgGuard`) | อ่าน | ❌ เตะกลับ `/login` |

**ทำไมไม่มีเทสต์ไหนเห็น:** component test ทุกตัว mount provider ด้วย `bootstrap={async () => true}` = *ล็อกอินอยู่แล้ว*
โดยเจตนา เพราะแต่ละตัวกำลังทดสอบเรื่องอื่น · **สถานะที่พังมีอยู่เฉพาะใน page load ที่เริ่มแบบ signed-out แล้วล็อกอินกลางทาง**
— ซึ่งเป็น "การเดินทาง" ไม่ใช่ "จอ" และไม่ใช่เรื่องของ component ไหนเลย

แก้: เพิ่ม `beginSession()` + login page เรียกมัน · เทสต์ 4 เคสประกบ (`session-context.test.tsx`)
· **mutation:** ทำให้ `beginSession` เป็น no-op ⇒ **แดง 2** (รวมเคส endSession ที่พิสูจน์ว่าลำดับยังถูก)

> นี่คือเหตุผลที่ §12.1 มีอยู่ · unit test 304 ตัวและ int test 200+ ตัว **ไม่มีตัวไหนถามคำถามนี้ได้**
> เพราะทุกตัวเริ่มต้นตอน "อยู่ในสถานะที่ต้องการแล้ว"

### รอบ 7 · ✅ **เขียว** — เลนเบราว์เซอร์มีอยู่จริงแล้ว ([run 31863032629](https://github.com/thewinwebdevelop/spec-inventory-manager/actions/runs/31863032629))

```
✓ E-01  · signs up, creates a shop, and is inside it   (1.2s)
✓ E-01b · the shop persists across a reload            (1.3s)
  2 passed
```

8 job เขียวหมด · `e2e-web` เป็น merge gate จริงแล้ว ไม่ใช่ smoke ที่ยิง `GET /`

### สิ่งที่ได้จากการสร้างเลนนี้: **บั๊กจริง 5 ข้อ ใน 7 รอบ**

| # | สิ่งที่เจอ | ใครเจอไม่ได้ |
|---|---|---|
| 1 | job ไม่ได้ build dependency ของ API | — (CI config) |
| 2 | **`node dist/main.js` รันไม่ได้** (config ship TS source) | ทุก suite รัน in-process |
| 3 | **`tsx src/main.ts` DI inject `undefined` ทุกตัว** (ไม่มี decorator metadata) | vitest ใช้ SWC จึงไม่เจอ |
| 4 | **login ไม่พาไปไหน** — ยังชี้ placeholder ของ F-000 | ไม่มีเทสต์ไหนเดินข้ามจอ |
| 5 | **login สำเร็จแล้วแอปยังเชื่อว่าไม่มีใครล็อกอิน** | component test ทุกตัว mock ว่า "ล็อกอินแล้ว" |

ข้อ 2+3 รวมกันแปลว่า **แอปนี้ไม่มีทางรันที่ใช้งานได้เลยนอก harness ของเทสต์** — ยังไม่ปิด ส่งต่อ backend-api + devops

### Q5 ยัง **ไม่ done**

ทำแล้ว **E-01/E-01b** (browser) + **E-11/E-12ข/E-14ขค** (static + jsdom) = 5 จาก 14 แถวของ §12.1
· ที่เหลือ (E-02..E-10, E-13) เขียนได้แล้ววันนี้เพราะ **harness มีแล้ว** — เหลือแค่เวลาเขียน ไม่ใช่ของที่ขาด
· ยกเว้น **E-10 (mobile)** ที่ยังต้องการ emulator ใน `flutter-ci`
· **manual §12.2 (M-01..M-07) เป็นของคน** — §17.6 บังคับว่าต้องทำก่อนออก verdict

### เลนเบราว์เซอร์รอบถัดมา: E-02 + E-03 เขียว ([run 31893480993](https://github.com/thewinwebdevelop/spec-inventory-manager/actions/runs/31893480993))

```
6 passed (8.1s)
playwright: expected=6 unexpected=0 flaky=0 skipped=0
```

**E-03 คือ flow ที่ §15 บอกว่าคุ้มที่สุด** — เดินครบตั้งแต่ลิงก์ครั้งเดียว → เชิญซ้ำแล้วไม่ตัน → confirm ก่อน reissue
· **E-03b เปิด browser context ที่สอง** ถือลิงก์ใบเก่า แล้วพิสูจน์ว่ามันตายจริง พร้อม pin ข้อความที่ผู้ใช้เห็น
(`"ลิงก์คำเชิญนี้ใช้ไม่ได้"` + `"ขอลิงก์ใหม่จากเจ้าของร้าน"`) — **นี่คือผลลัพธ์ที่ผู้ใช้เห็นทั้งหมดของ D-027**

**E-02 คือเรื่อง bleed ไม่ใช่เรื่องกดปุ่ม** — หลังสลับร้าน ข้อมูลร้านเดิมต้องไม่อยู่ใน `main`
· cache ที่ key ไม่มี `orgId` ผ่าน screenshot ทุกใบและตกข้อนี้ข้อเดียว

### 3 รอบหลังไม่เจอบั๊กแอปเลย — เจอแต่ของผมเอง 3 อย่าง

| ผมเขียนผิด | ความจริง |
|---|---|
| switcher เป็นเมนูที่กดเปิด | เป็น `<details>/<summary>` — list ไม่ render จนกว่าจะเปิด |
| `expect(nameB).toHaveCount(0)` ทั้งหน้า | switcher **ลิสต์ทุกร้านโดยชอบธรรม** ⇒ ต้อง scope ที่ `main` |
| `.first()` เลือกปุ่ม "ออกลิงก์ใหม่" | กลายเป็นการโยนหัวก้อยทันทีที่มีคำเชิญใบที่สอง |

ข้อกลางน่าสนใจที่สุด: **assertion ที่ผิดแบบนี้ล่อให้คนแก้ด้วยการลบทิ้ง** — ผมเลยเขียนเหตุผลไว้ในคอมเมนต์ว่าทำไมมันต้องอยู่และทำไมมันต้อง scope

### 🔴 guard ของผมเองทำให้ suite ที่เขียวกลายเป็นแดง

`6 passed` แต่ job แดง เพราะ guard นับ `"testId"` ใน HTML report — ซึ่งเก็บข้อมูลใน payload ที่ pack ไว้ ⇒ นับได้ 0 เสมอ

> **guard ที่ทำให้ของเขียวกลายเป็นแดง แย่กว่าไม่มี guard** — คนถัดไปลบทิ้ง แล้วช่องว่างที่มันเฝ้า
> (`testDir` พิมพ์ผิด / filter ไม่แมตช์ / suite โหลดไม่ขึ้น — **ทั้งสามทำให้เลนเขียวโดยไม่ได้รันอะไร**) เปิดกลับมาเงียบ ๆ

⇒ `tool/ci/assert-playwright-ran.mjs` อ่าน JSON reporter + **พิมพ์ตัวเลขที่ใช้ตัดสิน** · self-check สองทางก่อน push

### ข้อจำกัดของเลนนี้ที่ต้องรู้ไว้

**F-001 throttle ต่อ IP: `IP_WINDOW_MAX = 20` / 5 นาที เป็น hard-coded constant** และทั้งเลนวิ่งจาก IP เดียว
⇒ แต่ละไฟล์ signup ครั้งเดียวแล้วรันเรียงกัน · **ถ้า browser suite โตเกิน ~6 ไฟล์ ตัวเลขนี้คือสิ่งที่ backend-api ต้องตัดสิน**

**Q5 ตอนนี้: E-01 · E-02 · E-03 · E-11 เต็ม + E-12/E-14 บางส่วน** — เหลือ E-04..E-09 · E-13 (เขียนต่อได้ทันที)
· E-10 (mobile) ยังต้องการ emulator · manual §12.2 เป็นของคน


### E-07 ทำไม่ได้วันนี้ — และนั่นคือ finding ไม่ใช่ข้อจำกัดของเทสต์

E-07 คือ "ถูกถอดกลางคัน → 403 → พากลับหน้าเลือกร้าน" · ต้องมีใครสักคน**กดถอด**

`MembersScreen` render การกระทำของแถว (`เปลี่ยนสิทธิ์` · `ถอดออกจากร้าน` · `ออกจากร้านนี้`) เป็น **`<span>` ไม่ใช่ปุ่ม**
— นี่คือหนี้ W-17 ที่บันทึกไว้ตั้งแต่ W6 (mutation hook เขียนครบแล้วทั้ง 5 ตัว เหลือแต่ชั้น dialog)

⇒ **ถอดสมาชิกยังไม่มีทางกดจริงบนเว็บ** ⇒ E-07 เดินไม่ได้ · และที่หนักกว่าคือ **AC ของ S9/S10 ยังไม่มีทางเข้าถึงของผู้ใช้เลย**

> เทียบกับ `ออกจากร้านนี้` ซึ่ง**มี** UI จริง (ปุ่มบนจอข้อมูลร้าน + `LeaveOrgDialog`) เพราะ Staff เข้าจอสมาชิกไม่ได้
> — ux จงใจวางไว้คนละที่ · E-13 จึงเดินได้ทั้งสองด้าน

**ข้อเสนอ:** ปิด W-17 (dialog ของ S9/S10) เป็นงานชิ้นถัดไปที่คุ้มที่สุด — ปลดล็อก E-07 + ทำให้ AC ที่ signed off แล้วใช้งานได้จริง

### 🔴 finding ที่เลนเบราว์เซอร์เจอ และใหญ่กว่าเรื่องเทสต์: **ทุกการโหลดหน้ากินโควตา throttle ของ IP**

E-04 แดงที่ `beforeAll` ด้วย *"ลองเข้าสู่ระบบถี่เกินไป · เหลือ 04:53"* — ทั้งที่รอบนั้นสร้างบัญชีแค่ 6 ใบทั้ง suite

สาเหตุ: `AuthController.refreshTokens` เรียก `throttle.checkIp()` **เส้นเดียวกับ login/signup** ·
และ `SessionProvider` bootstrap ด้วย `POST /auth/refresh` **ทุกครั้งที่โหลดหน้า**

⇒ **1 page load = 1 slot** ของโควตา `IP_WINDOW_MAX = 20` ต่อ 5 นาที **ต่อ IP**

**ผลกับผู้ใช้จริง ไม่ใช่แค่กับ CI:** ร้าน SME ไทยที่พนักงาน 5 คนใช้ Wi-Fi เดียวกัน (NAT ออก IP เดียว)
· คนละ 4 หน้าใน 5 นาที = **ชนโควตาแล้วโดนกันไม่ให้ล็อกอินกันเอง** — และข้อความที่เห็นคือ "ลองเข้าสู่ระบบถี่เกินไป"
ทั้งที่ไม่มีใครทำอะไรผิด

> เรื่องนี้ **ผมไม่แก้เอง**: `IP_WINDOW_MAX` เป็น abuse control ของ F-001 และ `apps/api/CLAUDE.md` กำหนดว่า
> ★ auth/token ต้องผ่าน security-reviewer · การทำให้ปรับผ่าน env ได้ (ค่า default เท่าเดิม) ดูเป็นทางที่สมเหตุสมผลที่สุด
> — แต่เป็นการตัดสินใจของ **backend-api + security-reviewer** ไม่ใช่ของคนที่กำลังทำให้เลนเทสต์เขียว

**สิ่งที่ผมทำแทน:** ให้เทสต์ **เดินด้วยการคลิก ไม่ใช่ `goto`** — client-side navigation ไม่ remount provider จึงไม่ยิง refresh
· ซึ่งนอกจากประหยัดโควตาแล้วยัง**เหมือนที่คนใช้จริงมากกว่า** (คนไม่พิมพ์ URL ทีละหน้า)

### 🔴 บทเรียนที่แพงที่สุดของเลนนี้: **`storageState` ที่แชร์กันหลาย context = token reuse**

พยายามประหยัดโควตา throttle ด้วยการ save `storageState` ครั้งเดียวแล้วให้ทุกไฟล์ restore
⇒ API ตอบ **`401 INVALID_REFRESH`**

เพราะ **refresh token หมุนทุกครั้ง (F-001)** · state ที่ save ไว้ครั้งเดียวแล้วเอาไป restore 3 context
= **ส่ง token ใบเดิมซ้ำ 3 ครั้ง** = รูปเดียวกับ token ที่ถูกขโมยไปใช้ ⇒ **reuse detection เพิกถอนทั้ง family**

> **server ทำถูก · suite ของผมต่างหากที่ดูเหมือนคนขโมย cookie**

⇒ เปลี่ยนเป็นแชร์ **credential ไม่ใช่ session**: setup สร้างบัญชี 1 ใบ + ร้าน แล้วแต่ละไฟล์ **login เอง 1 ครั้ง**
(ถูกกว่า signup+login ครึ่งหนึ่ง และทุก context ได้ family ของตัวเอง)

**นี่คือสิ่งที่เลน E2E ให้ที่เลนอื่นให้ไม่ได้:** unit/int test ไม่มีวันเจอ เพราะไม่มีตัวไหนถือ session ข้าม context จริง ๆ

### 🔴🔴 บั๊กที่ใหญ่ที่สุดที่เลนเบราว์เซอร์เจอ: **เจ้าของร้านมองไม่เห็นเมนู "สมาชิก" ของตัวเอง**

E-08b (เคสที่ผมเพิ่มเพราะ**สงสัยจาก snapshot แล้วเลือกแปลงความสงสัยเป็น assertion แทนที่จะเดา**) แดง:

```
main:  heading "สมาชิก" · button "เชิญสมาชิก" · สมาชิกในร้าน (2)   ← อยู่บนจอนั้นได้
nav:   ข้อมูลร้าน · ความปลอดภัย                                    ← ไม่มี "สมาชิก"
```

**สาเหตุ:** role Owner ถือ capability **ตัวเดียวคือ `full_access`** (`SYSTEM_ROLE_BLUEPRINT`) ·
server มองว่ามันเป็น wildcard (`hasCapability` ใน core-domain: `full_access || required`) — จึงยอมให้เปิดจอสมาชิกและเชิญคนได้ ·
แต่ `useCan` ฝั่ง web ทำ **`Set.has()` เปล่า ๆ** ⇒ ตอบ "ไม่" ทุกครั้งที่ถามหา capability เจาะจง

⇒ **เจ้าของร้านซึ่งเป็นคนที่ทำได้ทุกอย่าง กลับเป็นคนเดียวที่ไม่เห็นเมนู** และเข้าจอสมาชิกได้ทางเดียวคือพิมพ์ URL
· กระทบทุกที่ที่ใช้ `useCan` (ปุ่มแสดงเลขผู้เสียภาษี ฯลฯ) ไม่ใช่แค่เมนูเดียว

**ทำไมเทสต์ 305 ตัวไม่เจอ:** ทุกเคสส่ง capability list แบบเจาะจง (`["manage_members"]`, `["manage_org_settings"]`)
— **พวกมันบรรยายผู้ใช้ที่ไม่มีอยู่จริง** · ไม่มีเคสไหนเคยส่ง `["full_access"]` ซึ่งคือสิ่งที่เจ้าของร้านทุกคนถืออยู่จริง

**แก้:** `useCan` เรียก `hasCapability` จาก `@omnistock/core-domain` — **import กฎเดียวกับ server ไม่ใช่เขียนใหม่**
(สำเนาที่สองของกฎ authorization คือวิธีที่ client กับ server เริ่มไม่ตรงกัน ซึ่งคือสิ่งที่เพิ่งเกิดขึ้น)
· `apps/web` เพิ่ม dependency `@omnistock/core-domain` (pure TS ไม่มี node dep — ปลอดภัยกับ browser bundle)
· mutation: กลับไปใช้ `Set.has()` ⇒ **แดง**

### บั๊กที่แก้แล้วเปิดของถัดไป: รายชื่อสมาชิก **ค้าง 30 วินาที** หลังมีคนกดรับคำเชิญ

[run 31898880022](https://github.com/thewinwebdevelop/spec-inventory-manager/actions/runs/31898880022) — E-08b หายแดงตามที่แก้ (nav มี "สมาชิก" แล้ว จาก snapshot)
แต่ **E-04 ที่เคยเขียวกลับแดง** และเป็นผลโดยตรงจากการแก้ ไม่ใช่ของบังเอิญ:

```
คำเชิญที่รอตอบรับ (1)   ← staff รับไปแล้ว
สมาชิกในร้าน (1)        ← มีแต่เจ้าของร้าน
```

**ลูกโซ่:** ก่อนแก้ nav ไม่มีลิงก์ "สมาชิก" ⇒ `openMembers` ตกไป `page.goto()` = **โหลดหน้าใหม่ทั้งหน้า ⇒ query สดเสมอ** ·
พอแก้แล้วลิงก์โผล่ ⇒ กดลิงก์ = client-side nav ⇒ TanStack Query คืน**ของใน cache**

**ของจริงที่ผู้ใช้เจอ (ไม่ใช่เรื่องของเทสต์):** `staleTime: 30_000` ใน `query-client.ts` ·
จอสมาชิกคือ**จอเดียวที่ข้อมูลเปลี่ยนจากนอกเบราว์เซอร์นี้โดยเจตนา** (ทั้งฟีเจอร์คือรอคนอื่นกดรับ) ·
คนกดรับอยู่คนละเครื่อง ⇒ ไม่มี mutation ในแท็บนี้ให้ invalidate และ `refetchOnWindowFocus` ก็ไม่ยิง
⇒ เจ้าของร้านที่เพิ่งส่งลิงก์ไปทาง LINE แล้ววนกลับมาดู เห็น "รอตอบรับ" ต่ออีกไม่เกินครึ่งนาที แล้วค่อยหายเอง

**ไม่แก้ค่า default จากฝั่งเทสต์** — 30 วิเป็นค่าที่ตั้งใจเลือกและมันหายเอง · ส่งต่อ ux/frontend ตัดสินว่าจอนี้ควร
override เป็น `staleTime: 0`/`refetchOnMount: "always"` ไหม (ราคาคือ request เพิ่มเฉพาะจอนี้)
· เทสต์แก้ให้**ซื่อกับความจริง**: E-04 `reload()` ก่อน assert พร้อมคอมเมนต์ว่าทำไมต้องมี — คือสิ่งที่คนงงจะทำจริง

**บทเรียน:** การแก้บั๊กหนึ่งเปลี่ยน**เส้นทางที่เทสต์ใช้เดิน** (goto→click) แล้วเปิดพฤติกรรมที่ซ่อนอยู่ใต้ page reload มาตลอด
— เทสต์ที่ "เขียวมาก่อน" ไม่ได้แปลว่าเคยพิสูจน์สิ่งนั้นจริง

### เลนเบราว์เซอร์เขียวครบ 12 เคส แล้วเขียนต่อ E-05 · E-06 · E-07 · E-12 (2026-08-16)

[run 31957383848](https://github.com/thewinwebdevelop/spec-inventory-manager/actions/runs/31957383848) — **8/8 job เขียว · `expected=12 unexpected=0 skipped=0`**
(setup · E-01 · E-01b · E-02 · E-02b · E-03 · E-03b · E-04 · E-08 · E-08b · E-13 · E-13b) — E-13/E-13b ได้รันจริงเป็นครั้งแรก

เพิ่มอีก 3 ไฟล์ · 7 เคส:

| ไฟล์ | เคส | สิ่งที่พิสูจน์ |
|---|---|---|
| `e05-signup-through-invite.spec.ts` | **E-12 ★** | token หายจาก URL ก่อน paint แรก · ไม่อยู่ใน `localStorage`/`sessionStorage`/DOM · **กด Back ก็ไม่กลับมา** (`replaceState` ไม่ใช่ `pushState`) |
| ↑ | **E-05** | คนไม่มีบัญชีอ่านคำเชิญได้ (ร้าน+สิทธิ์ เห็น · อีเมลเต็มไม่เห็น) → สมัคร → **ยังไม่เป็นสมาชิกอะไรเลย** → เปิดลิงก์อีกครั้ง → เข้าร่วมเป็น "พนักงาน" |
| `e06-wrong-account.spec.ts` | **E-06 ★** | ล็อกอินคนละบัญชี → `403 INVITATION_EMAIL_MISMATCH` + ทางออก · และ **สแกน response body ทุกก้อนที่เข้าเบราว์เซอร์นั้น** ว่าไม่มีอีเมลเต็มของผู้ถูกเชิญเลย (มี guard กัน assertion ว่างด้วย) |
| `e07-removed-mid-session.spec.ts` | **E-07** | ถูกถอดกลางคัน → request ถัดไป 403 → กลับหน้าเลือกร้าน · **ไม่หลุดล็อกอิน** (พิสูจน์ด้วยร้านของตัวเองที่ยังอยู่) · switcher ไม่มีร้านนั้น · พิมพ์ URL ตรงก็ไม่เข้า |

**E-07 ยิง revoke ผ่าน API จาก session อื่นจริง** (`APIRequestContext` + login body-transport) — ไม่ใช่ทางลัด: §12.1 เขียนว่า "จาก session อื่น"
และ **W-17 ทำให้ web ไม่มีปุ่มถอดสมาชิกให้กดอยู่แล้ว** (แถว action เป็น `<span>`) · พอ W-17 ลง ครึ่งของเจ้าของร้านจะกลายเป็นคลิก โดย assertion ไม่ต้องเปลี่ยน

#### 3 ช่องว่างที่เจอระหว่างเขียน — **ไม่แก้เอง เพราะเป็นของเจ้าของอื่น**

1. **E-05 ไม่ "ถือ token ตลอด flow" อย่างที่ §12.1 เขียน** — token อยู่ใน ref ของ `/invite` เท่านั้น เดินไป `/signup` แล้วหาย
   ⇒ ต้องเปิดลิงก์ซ้ำ (ซึ่งคนที่ได้ลิงก์ทาง LINE ก็ทำแบบนั้นจริง) · **สองแถวนี้ขัดกันเอง**: จะถือ token ข้ามหน้าได้ต้องเก็บลง `sessionStorage`/URL = สิ่งที่ E-12 ห้าม
   ⇒ ผลลัพธ์ของ AC-4.2 ได้ครบ แต่ถ้อยคำของ §12.1 ไม่ได้ — **product/qa** ตัดสินว่าจะแก้ถ้อยคำหรือแก้ flow
2. **หน้าปฏิเสธของ E-06 ไม่บอกว่าให้ใช้บัญชีไหน** — server ส่ง `details.emailMasked` มาให้ "เพื่อให้ UI บอกได้ว่าใช้บัญชีไหน" (contract §3.15)
   แต่ `toApiFailure` ฝั่ง web **ทิ้ง `details` ทิ้งสำหรับ kind `forbidden`** และ copy §11.4 เขียนว่า "บัญชีที่ถูกเชิญ" เฉย ๆ
   ⇒ คนอ่านถูกบอกให้สลับไปบัญชีที่จอ**เพิ่งเลิกบอก**ว่าคือบัญชีไหน (จอ preview ก่อนหน้ามี `u***@…` แต่จอ error ไม่มี)
   ⇒ **ux (copy) + frontend (plumbing)** · เทสต์**ไม่ assert** เรื่องนี้ทั้งสองทาง เพื่อให้วันที่แก้แล้วไม่มีเคสแดง
3. **cache 30 วิ กับคนที่เพิ่งถูกถอด** — คลิกในร้านหลังถูกถอดอาจไม่ยิง request เลย (`staleTime`) ⇒ ยังเห็นจอเดิมได้ไม่เกินครึ่งนาที
   ขอบเขตจำกัด (เห็นข้อมูลที่โหลดไว้แล้ว · **ทุก write โดน server ปฏิเสธ** ซึ่งคือ control จริง) แต่เป็นเรื่องเดียวกับที่ E-04 เจอ · ส่งต่อ ux/frontend

### 🔴🔴🔴 บั๊ก `full_access` ไม่ใช่ที่เดียว — มีอีก **5 จุด** และจุดหนึ่งทำให้โค้ดที่เขียนไว้ไม่มีวันถูกเรียก (2026-08-16)

เจอตอนกำลังจะเขียน E-09/E-14: `taxCardView` ก็ทำ `capabilities.has(...)` เหมือนกัน ⇒ ไล่ดูทั้ง repo แล้วเจอครบชุด

| ไฟล์ | บรรทัดเดิม | เจ้าของร้าน (`full_access` ล้วน) เจออะไร |
|---|---|---|
| `tax-card.ts` canEdit | `capabilities.has(MANAGE_ORG_SETTINGS)` | **ประกาศ/แก้ข้อมูลผู้เสียภาษีไม่ได้เลย** ⇒ AC-7.1 เข้าไม่ถึงทาง UI |
| `tax-card.ts` `onboardingItems` | เหมือนกัน | การ์ด onboarding ไม่ขึ้นเลย · **รวมถึง nudge หาเจ้าของร้านสำรอง (D-030) ซึ่งนิยามว่า "ถือ `full_access` + เป็นสมาชิกคนเดียว"** — โค้ดอยู่ใต้ `return null` ที่ตัดเจ้าของร้านทิ้งก่อน ⇒ **ไม่มีวันถูกเรียกถึง** |
| `OrgProfileScreen.tsx` ×2 | เหมือนกัน | เปลี่ยนชื่อร้านตัวเองไม่ได้ |
| `LeaveOrgDialog.tsx` | `has(MANAGE_MEMBERS)` | ตอนโดน `409 LAST_OWNER` **ไม่ได้ลิงก์ไปหน้าสมาชิก** ซึ่งคือทางออกเดียว — และคนที่เจอจอนี้เป็นเจ้าของร้าน**เสมอ** ⇒ ทางออกถูกซ่อนจากทุกคนที่เคยเห็นมัน |
| mobile `session_state.dart` `can()` | `capabilities.contains(c)` | ทุก gate บนมือถือ ตอบ "ไม่" กับเจ้าของร้าน |

**แก้ที่ราก ไม่ใช่ทีละจุด:**
- web: `src/lib/org/capability.ts` — `can(capabilities, x)` ห่อ `hasCapability` ของ core-domain · ทุกจุด (รวม `useCan`) เรียกผ่านตัวนี้
- mobile: `ActiveOrg.can` = `contains(full_access) || contains(x)` · ย้าย `fullAccessCapability` จากไฟล์จอ → `core/session` (ทิศทาง dependency ถูกต้อง)
- **tripwire `capability-lint.test.ts`** (แบบเดียวกับ G-15): สแกน source ทั้ง web+mobile — ห้ามไฟล์ไหนถาม membership ของ capability เอง
  ยกเว้นถาม `full_access` ตรง ๆ (คือถามตัว wildcard เอง = ถูก) และไฟล์ที่ implement กฎ 2 ไฟล์
  · มี SELF-CHECK ทั้งสองทาง (บรรทัดจริงที่พัง = จับได้ · `ownerRoleIds.has(role.id)`/`entitlements.contains()` = ไม่ตะครุบ)
  · **mutation แล้ว**: คืน `.has()` ที่ `tax-card.ts` ⇒ tripwire แดงระบุไฟล์+บรรทัด · คืน `contains` ที่ Dart ⇒ เทสต์ Dart แดง

**ทำไมเทสต์เดิมไม่เจอ (ย้ำอีกรอบเพราะมันคือแก่นของเรื่องนี้):** `tax-card.test.ts` มีบรรทัด
`new Set([MANAGE_ORG_SETTINGS, FULL_ACCESS])` — **ผู้ใช้ที่ไม่มีอยู่จริง** · role Owner ตาม `SYSTEM_ROLE_BLUEPRINT` ถือ `full_access` **ตัวเดียว**
⇒ เพิ่ม describe block "the Owner who actually exists" (3 เคส) + Dart 4 เคส · web 312 tests เขียว · flutter analyze สะอาด

**บทเรียนที่ควรอยู่ถาวร:** กฎ authorization ที่ client ต้องรู้ ให้ **import จาก core-domain เสมอ** — ทุกครั้งที่มีคนเขียนใหม่เพราะ "มันก็แค่เช็คว่ามีใน list ไหม" จะได้บั๊กเดิมกลับมา และมันจะ**เขียวทุกเทสต์**

### ปิดหนี้ W-17 — S9/S10 มี dialog จริงแล้ว · และ E-09 แดงเพราะผมเดา default ผิด (2026-08-16)

**E-09 แดงรอบแรก** ([run 31958528846](https://github.com/thewinwebdevelop/spec-inventory-manager/actions/runs/31958528846)) — เคสอื่นเขียวถึงเคสที่ 20 (E-07 ผ่านทั้งไฟล์)
สาเหตุ: ผมเขียนว่า "บุคคลธรรมดาเป็นค่าเริ่มต้น" แต่จริง ๆ default คือ **นิติบุคคล** ⇒ helper เรื่องเลขบัตรประชาชนยังไม่ขึ้น
· **สมมติฐานผมผิด ไม่ใช่แอปผิด** — และ default ของแอปดีกว่า (ร้านที่ประกาศภาษีส่วนใหญ่เป็นนิติบุคคล · สาขา personal เป็นสาขาที่ต้องเลือกอย่างตั้งใจเพราะมันคือเลขบัตรประชาชน)

**W-17 ปิดแล้ว** (หนี้ตั้งแต่ W6 — hook ครบ 5 ตัวตั้งแต่ W5 แต่ไม่มีใครกดถึง):

| ของใหม่ | ตาม | จุดที่สำคัญ |
|---|---|---|
| `ChangeRoleDialog.tsx` (S9) | §10.1 | ป้าย "(สิทธิ์ปัจจุบัน)" · **ปุ่มบันทึก disabled ถ้าไม่เปลี่ยนค่า** (write ที่ไม่เปลี่ยนอะไร = แถว audit ที่บอกว่ามีคนทำสิ่งที่เขาไม่ได้ทำ) · **เตือนก่อนกด**เมื่อกำลังลดสิทธิ์เจ้าของร้าน · error 5 แบบตามตาราง |
| `RemoveMemberDialog.tsx` (S10) | §10.2 | **ไม่ใช้ `ConfirmDialog`** เพราะ ux รีวิวข้อ 8 ทิ้ง "แน่ใจหรือไม่" แล้วให้เขียนผล 4 ข้อ — body string เดียวรองรับไม่ได้ · `alertdialog` + focus ที่ "ยกเลิก" · toast ต่อท้ายจำนวนคำเชิญที่ถูกยกเลิกไปด้วย (I-1) |
| แถวสมาชิก | §7 | `<span>` → `<Button>` · แถวของตัวเอง = "ออกจากร้านนี้" (S10.3 ทางเข้า ข) ไม่ใช่ "ถอดออก" |

**E-07 เขียนใหม่ให้เป็นการกดจริง** — เดิมยิง revoke ผ่าน API เพราะไม่มีปุ่ม · ตอนนี้ owner กดในเบราว์เซอร์ตัวเอง (= "session อื่น" ตามที่ §12.1 หมายถึง)
· **assertion ฝั่งคนถูกถอดไม่ต้องแก้เลย** เพราะเขียนไว้ที่จอของเขา ไม่ได้เขียนไว้ที่การคลิก · เพิ่มเคส S9 เข้าไฟล์เดียวกัน (นักแสดงชุดเดิม)

#### ⚠️ ช่องว่างที่เจอตอนเขียนเทสต์ S9 (ของ backend-api + ux)

**client บอกไม่ได้ว่า role ไหนคือเจ้าของร้าน ถ้าคนดูไม่ใช่เจ้าของร้านเอง**
· §10.1 สั่งให้ตัวเลือก "เจ้าของร้าน" **แสดงแต่ disabled + helper** สำหรับคนที่ไม่ใช่เจ้าของ
· แต่ `GET /orgs/{orgId}/roles` **ไม่ส่ง `capabilities`** (§3.6) และกฎเหล็กคือ ownership ตัดสินด้วย capability ห้ามดูจาก `key`
⇒ `ownerRoleIds` มีได้แค่ role ของตัวเอง ⇒ **ผู้ดูแลเห็นตัวเลือกเจ้าของร้านแบบกดได้ แล้วโดน `403 FORBIDDEN`**
· ช่องเดียวกันนี้มีอยู่แล้วใน S7 (`assignableRoles` ของ InviteDialog กรองอะไรไม่ได้เลยสำหรับผู้ดูแล)
· **ไม่แก้ด้วยการดู `key === "owner"`** (แหกกฎเหล็ก + F-003 ให้สร้าง role เองได้) ⇒ เสนอ backend-api เพิ่ม flag เช่น `grantsOwnership` ใน §3.6
· เทสต์ **pin สภาพจริงไว้พร้อมเหตุผล** — วันที่ contract มี flag เคสนี้จะแดงและบอกว่าต้องแก้อะไร · ความปลอดภัยไม่ได้พึ่ง UI: server ปฏิเสธ และ dialog มี copy ของ 403 ครบ

### 🔴🔴 "แสดงเลขเต็ม" พังมาตลอด — `415 UNSUPPORTED_MEDIA_TYPE` (2026-08-16)

E-14 แดง · หน้าจอขึ้น `ขอดูเลขเต็มไม่สำเร็จ กรุณาลองใหม่อีกครั้ง` · **หลักฐานอยู่ใน API log ที่ CI dump ไว้ตอน job แดง**:
```
WARN [DomainExceptionFilter] error status=415 code=UNSUPPORTED_MEDIA_TYPE
```

**สาเหตุ:** `POST /orgs/{id}/tax-profile/reveal` **ไม่มี body** (server รู้อยู่แล้วว่าใครขอและร้านไหน)
⇒ `openapi-fetch` เลยไม่ส่ง `Content-Type` ⇒ แต่ route นี้อยู่หลัง `JsonOnlyGuard` ซึ่งบังคับ `application/json` **กับทุก request ที่มันเฝ้า ไม่ว่ามี body หรือไม่**

⇒ **จอเดียวใน F-002 ที่แสดงเลขผู้เสียภาษีเต็ม ใช้ไม่ได้เลย ทุกคน ทุกครั้ง** (AC-7.4 ทั้งข้อ)

**ทำไมไม่มีใครเจอ:** เทสต์ฝั่ง API ยิงผ่าน supertest ซึ่ง**ใส่ header ให้เอง** · เทสต์ฝั่ง web mock hook ตัวนี้ทิ้ง
⇒ **แต่ละฝั่ง mock อีกฝั่งไว้ ทั้งคู่จึงเขียว** — เจอได้ทางเดียวคือมีเบราว์เซอร์จริงคุยกับ API จริง

**แก้ (ฝั่ง client เท่านั้น):** ส่ง `Content-Type: application/json` ไปกับ request ที่ไม่มี body · เทสต์ pin ไว้ 2 เคส
(ส่ง header · **ไม่ส่ง body** — เพราะ body คือที่ที่วันหนึ่งจะมีคนใส่ "ขอเลขของใคร" เข้ามา ซึ่ง §3.16 ตั้งใจไม่ให้มี) · **mutation แล้ว**: เอา header ออก ⇒ แดง

**ส่งต่อ backend-api + security-reviewer (ไม่แก้เอง — เป็น guard บนเส้น sensitive):**
`JsonOnlyGuard` ปฏิเสธ POST ที่ไม่มี body · วันนี้มีเส้นเดียวที่โดน (`/tax-profile/reveal`) เพราะอีก 2 เส้นที่ใช้ guard นี้มี body จริง
· **เส้น bodyless เส้นถัดไปที่ใครเพิ่มจะเจอกำแพงเดียวกัน** และมันจะดูเหมือนบั๊ก client ทุกครั้ง

### staleness 30 วิ กัดครั้งที่ 3 (S9 ในไฟล์ E-07)

owner เปิดจอสมาชิกไว้ตอนยังไม่มีใครรับคำเชิญ → กลับมาภายใน 30 วิ → เห็น cache เดิม → ไม่มีแถวสมาชิกใหม่ให้กด
· แก้เทสต์แบบเดียวกับ E-04 (reload + คอมเมนต์เหตุผล) · **3 ครั้งใน 3 ไฟล์แล้ว — ข้อเสนอสำหรับ ux/frontend: จอสมาชิกควร override `staleTime: 0`**
เพราะเป็นจอเดียวที่ข้อมูลตั้งใจให้เปลี่ยนจากนอกเบราว์เซอร์ (ทั้งฟีเจอร์คือรอคนอื่นกดรับ)

### สรุปสถานะ Q5 หลังเลนเบราว์เซอร์เขียวครบ (2026-08-16)

[run 31959752691](https://github.com/thewinwebdevelop/spec-inventory-manager/actions/runs/31959752691) — **8/8 job · `expected=26 unexpected=0 flaky=0 skipped=0`**

| แถว §12.1 | สถานะ | ที่ไหน |
|---|---|---|
| E-01 · E-01b | ✅ | `e01-signup-create-shop` |
| E-02 · E-02b | ✅ | `e02-org-switcher` |
| E-03 · E-03b | ✅ | `e03-invite-reissue` |
| E-04 · E-08 · E-08b · E-13 · E-13b | ✅ | `e04-accept-and-permissions` |
| E-05 · E-12 ★ | ✅ | `e05-signup-through-invite` |
| E-06 ★ | ✅ | `e06-wrong-account` |
| E-07 (+S9) | ✅ | `e07-removed-mid-session` |
| E-09 · E-14 ★ | ✅ | `e09-tax-profile` |
| E-11 | ✅ | `copy-lint.test.ts` (static scan ทั้ง web+mobile) |
| **E-10 (mobile)** | ❌ | **ยังไม่มี** — ต้องมี emulator lane |

**E-10 ไม่ทำเองเพราะเป็นการตัดสินใจของ devops:** ต้องเพิ่ม `integration_test` + Android emulator ใน CI
(`reactivecircus/android-emulator-runner` ~5–10 นาที/รัน) + ให้แอปคุยกับ stack จริง ⇒ **เพิ่มเวลา CI ให้ทุก PR**
· ทางเลือกที่ถูกกว่าแต่พิสูจน์ parity ไม่ได้จริง: widget test + fake API (ซึ่งมีอยู่แล้ว 391 ตัว)
⇒ **ให้ devops/ผู้ใช้เลือก** ว่าจะจ่ายเวลา CI เพื่อ E-10 หรือรับความเสี่ยงแล้วเลื่อนไป F-006 (ตอนที่ router/deep link ลงครบ)

**สิ่งที่เลนนี้เจอทั้งหมด (บั๊กจริงที่ไม่มีเลนอื่นเจอได้เลย):**
1. 🔴 เจ้าของร้านไม่เห็นเมนู "สมาชิก" ของตัวเอง (`useCan` ไม่รู้จัก wildcard) — และอีก **5 จุดถัดมา** รวมถึงกิ่งที่ไม่มีวันถูกเรียก (D-030 nudge)
2. 🔴 `POST /tax-profile/reveal` ตอบ **415 ทุกครั้ง** ⇒ "แสดงเลขเต็ม" ใช้ไม่ได้เลยทั้งระบบ
3. 🟠 W-17: S9/S10 เป็น `<span>` — mutation hook 5 ตัวไม่มีคนเรียก
4. 🟠 หน้าปฏิเสธ `INVITATION_EMAIL_MISMATCH` ทิ้ง `details.emailMasked` ⇒ บอกให้สลับบัญชีโดยไม่บอกว่าบัญชีไหน
5. 🟠 staleness 30 วิ บนจอสมาชิก (โดน 3 ครั้ง) — และเวอร์ชันของคนที่เพิ่งถูกถอด
6. 🟡 client แยกไม่ออกว่า role ไหนคือเจ้าของร้าน ถ้าคนดูไม่ใช่เจ้าของ (§3.6 ไม่ส่ง capabilities)

### E-10 — emulator lane (ผู้ใช้เลือก "ทำเลย" 2026-08-16) · และมันเจอของทันทีก่อนรันด้วยซ้ำ

#### 🔴🔴 ฝั่ง mobile ของ F-002 **รันในแอปจริงไม่ได้เลย** — ไม่มีใคร wire

`orgDirectoryProvider` / `orgScopedRepositoryProvider` ตั้งใจให้ throw `UnimplementedError` แล้วให้ composition root override
· **เทสต์ทุกไฟล์ override ด้วย fake · แอปไม่ override สักตัว** ⇒ 4 จอ + controller + repository impl + เทสต์เขียว ~390 ตัว **เปิดใช้จริงไม่ได้**
(เจอตอนจะเขียน E-10 — คือสิ่งที่เลนที่รัน "แอปจริงบนเครื่องจริง" มีไว้เจอ · เป็นฝาแฝดของ W-17 ฝั่ง web)

**แก้:**
- `createAuthStack()` (additive) คืน `(repository, dio)` — เพราะ `api_providers.dart` เขียนไว้เองว่า "override `baseDioProvider` ด้วย wired client จาก `createAuthClient()`" แต่ไม่มีทางเอา Dio ออกมาได้ · `createAuthClient()` เดิม delegate ต่อ ไม่เปลี่ยนพฤติกรรม
- `buildAppOverrides()` wire ครบ: `baseDio` (**instance เดียวกับ auth repo — refresh chain เดียวในแอป**) + org directory + org scoped
- `features/org/data/org_client_factory.dart` — boundary gate ตีกลับตอนแรกเพราะผม import generated client ใน `app/` (rule 3 อนุญาตเฉพาะ `features/*/data/**` + `core/api/**`) · **gate ถูก ผมผิด** ⇒ ย้ายไป `data/` แบบเดียวกับ `auth_client_factory`
- `test/app/bootstrap_test.dart` 6 เคส — provider resolve ได้ · Dio ตัวเดียว · ไม่มีร้านแล้ว throw (ไม่เดา) · มีร้านแล้ว org client มี interceptor มากกว่า base (คือ `X-Organization-Id`)

#### เลน `mobile-e2e` (job ใหม่ แยกจาก flutter-ci)

Postgres + Redis + API จริง (**คนละ database กับ e2e-web** เพราะรันขนานกัน) → emulator api-34 (`reactivecircus/android-emulator-runner`, เปิด KVM)
→ `flutter test integration_test/org_flow_test.dart --dart-define=API_BASE_URL=http://10.0.2.2:3000`
· **10.0.2.2 ไม่ใช่ localhost** — ใน emulator `localhost` คือตัวเครื่องจำลองเอง อาการเวลาพลาดคือ connection refused ที่อ่านเหมือน API ล่ม
· มี guard `grep "All tests passed"` กัน job เขียวทั้งที่ไม่ได้รันอะไร (บทเรียน I-37)
· **แยก job เพราะ boot emulator ~5 นาที** — analyze/test ของ flutter-ci ต้องเร็วเหมือนเดิม

`integration_test/org_flow_test.dart` 3 เคส: สร้างร้าน (จอจริง + `onCreated` + session เข้าร้านทันที) · รายชื่อร้าน+สมาชิกจาก server จริง · **ถูกถอดกลางคัน**
· **ยอมรับตรง ๆ ว่า 2 ขั้นยิง API ตรง**: mobile ไม่มี accept-invitation และไม่มี remove-member ใน port (D-012 ลิงก์เปิดบนเว็บ · §7 row action เป็นของ web)
⇒ เทสต์ที่แกล้งทำเป็นมีจะเป็นการเทสต์สิ่งที่ไม่มีอยู่ · และ "อีก session ถอดเราออกระหว่างใช้งาน" คือสิ่งที่ AC เขียนไว้พอดี
· ไม่ขับ navigation ของแอปเอง เพราะ **ยังไม่มี router** (F-006) — เทสต์ประกอบจอแบบที่ router จะทำ และเขียนบอกไว้ว่าวันที่ F-006 ลง ตรงนี้คือสิ่งที่ถูกแทน

### 🔴🔴🔴 เลน emulator รอบแรกที่รันจริง: **สมัครสมาชิกบนมือถือใช้ไม่ได้เลย** — `ApiError(status: 201)`

ทั้ง 3 เคสตายที่ขั้นเดียวกัน (`auth.signup`) ด้วย `ApiError(status: 201, code: null)` — คือ **server ตอบ 201 สำเร็จ แต่ client ถอดรหัส body ไม่ได้**

**ลูกโซ่ (ยาวและน่าสนใจ):**
1. contract เขียน `SignupResponse.verified: {type: boolean, enum: [false]}` — เจตนาดี แปลว่า "บัญชีใหม่ยังไม่ verified เสมอ"
2. openapi-generator target **dart-dio** อ่าน `enum` บน boolean แล้วสร้าง **`EnumClass` ที่ wire value เป็น STRING `"false"`**
3. server ส่ง JSON boolean `false` ⇒ deserialize พัง ⇒ `res.data == null` ⇒ repo โยน `ApiError(201, null)`
4. **ไม่มีเทสต์ไหนเห็น** เพราะ…

#### 🔴 …fake ถูกแก้ให้ตรงกับ **client** แทนที่จะตรงกับ **server**

```dart
// เดิมใน auth_repository_impl_test.dart
'verified': 'false',   // ← สตริง! พร้อมคอมเมนต์อธิบายว่า built_value ต้องการแบบนี้
{'ok': 'true'}         // ← เหมือนกัน อีก 4 ไฟล์
```

มีคนเห็นว่า generated model เป็น string enum แล้ว **ปรับ fake ให้ตรงกับมัน** แทนที่จะถามว่า "แล้ว server ส่งอะไรจริง ๆ"
⇒ เทสต์เขียวเพราะมัน**จำลองบั๊กได้อย่างซื่อสัตย์** · นี่คือรูปแบบที่อันตรายที่สุดของ mock ที่เจอในโปรเจกต์นี้จนถึงตอนนี้

**แก้:** ลบ `enum` ออกจาก boolean **ทั้ง 3 จุด** ในสัญญา (ไม่ใช่แค่จุดที่พัง):
- `SignupResponse.verified` (พังจริง พิสูจน์แล้ว)
- `OkResponse.ok` — อยู่บนทุกเส้นที่คืน `OkResponse` (logout, logout-all, change-password) ⇒ **จะพังทันทีที่ mobile เรียกจริง**
- `ReissuedLink.rotated`
regen ทั้ง TS + Dart · `bool get verified` แล้ว · แก้ fake 5 ไฟล์ให้ส่ง JSON boolean จริง · TS: `verified: false` → `boolean` (ไม่มีโค้ดไหนอ่าน field นี้)

> **⚠️ นี่คือการแก้ contract ซึ่งเป็นของ backend-api** — ผมลงมือเพราะมันทำให้ generated client **ใช้งานไม่ได้ทั้งเส้น** และ oasdiff ใน CI เป็นคนตัดสินว่า breaking หรือไม่ (docker รันในเครื่องไม่ได้)
> ถ้า backend-api เห็นต่าง ให้ revert ได้ทันที — แต่ต้องมีทางอื่นให้ Dart client ใช้งานได้ก่อน
> **บทเรียนเชิงกฎ: อย่าใส่ `enum` บน `boolean` ในสัญญา** — มันคือคอมเมนต์ที่ generator บางตัวอ่านเป็นชนิดข้อมูล

### pack ของ "บั๊กที่เจอตอน build" + tripwire กันชนิดของบั๊กกลับมา (2026-08-17)

**`packages/contracts/src/generator-hostile-shapes.test.ts`** — สแกน bundle: **ห้าม `type: boolean` มี `enum`**
· mutation แล้ว: ใส่ `enum: [false]` กลับเข้า `verified` ⇒ แดงพร้อมบอก `openapi.yaml:1611`
· เหตุผลที่ต้อง ban ทั้งรูปแบบ ไม่ใช่แค่ 3 จุดที่แก้: มันคือ**คอมเมนต์ที่ generator บางตัวอ่านเป็นชนิดข้อมูล** — คนถัดไปที่เขียนก็จะเขียนแบบเดิม

**`apps/api/test/build-defects.ts` + gate** — แยกจาก `regression-pack.ts` (ซึ่ง mirror §9 และ gate ล็อกจำนวนไว้ 41)
เพราะ**คนละสายพันธุ์**: §9 มาจากรีวิวเอกสาร · อันนี้มาจากการ**รันของจริง** และทุกข้อมี unit test เขียวทับอยู่ตอนที่มันพัง

| id | เรื่อง | สถานะ |
|---|---|---|
| B-1 | client ไม่รู้จัก `full_access` เป็น wildcard (6 จุด) | ✅ pin: tripwire + 3 เทสต์ |
| B-2 | reveal ตอบ 415 ทุกครั้ง | ✅ pin: hook test + E-14 |
| B-3 | W-17 action เป็น `<span>` | ✅ pin: actions test + E-07 |
| B-4 | mobile providers ไม่ถูก wire | ✅ pin: bootstrap test + E-10 |
| B-5 | boolean+enum ทำ Dart client พัง | ✅ pin: contract scan + fake ที่ส่ง boolean จริง |
| B-6 | redirect หลังล็อกอินชี้ placeholder ของ F-000 | ✅ pin: session test + E-01 |
| B-7 | รายชื่อสมาชิกค้าง 30 วิ | 🟠 เปิด → **ux + frontend** |
| B-8 | จอปฏิเสธไม่บอกว่าให้ใช้บัญชีไหน | 🟠 เปิด → **ux + frontend** |
| B-9 | client ระบุ role เจ้าของร้านไม่ได้ (§3.6) | 🟠 เปิด → **backend-api** |
| B-10 | `dev`/`start` รัน API ไม่ได้ | 🟠 เปิด → **devops + backend-api** |

gate บังคับ 4 ข้อ: pin ต้อง resolve · ไม่มีแถวว่าง · **แถวที่ยังเปิดต้องระบุเจ้าของ** (ไม่มีชื่อ = กลายเป็นตำนาน) · ทุกแถวต้องบอกว่า**เจอด้วยเครื่องมืออะไร**
· SELF-CHECK ทั้งสองทางของ resolver (ไฟล์หาย · ไฟล์อยู่แต่ marker หาย)

**ผลรัน CI ของการแก้ contract** ([run 31989431720](https://github.com/thewinwebdevelop/spec-inventory-manager/actions/runs/31989431720)): **oasdiff เขียว = ไม่ breaking** · contracts-drift เขียว = regen ตรงกับ CI · flutter 397 เขียว · web 323 เขียว

### E-10 รอบที่รันจริง: **เคสแรกเขียว** — และเคสที่สองฆ่า emulator ด้วย `pumpAndSettle`

[run 31989775706](https://github.com/thewinwebdevelop/spec-inventory-manager/actions/runs/31989775706)

```
00:23 +1: E-10 · creates a shop on a real API and lands inside it     ← ✅ ผ่าน
01:23 +1: ... - did not complete [E]   (อีก 2 เคส + tearDownAll)
adb: could not connect to TCP port 5554: Connection refused           ← emulator ตายไปแล้ว
```

**เคสแรกผ่าน = การแก้ boolean-enum ได้ผลจริง** — signup → login → สร้างร้าน → session เข้าร้านทันที ผ่านของจริงหมด

**เคสที่สองตาย 60 วิ โดยไม่มี exception ให้อ่าน** เพราะ:
`MembersScreen` ขึ้น skeleton ตอนโหลด · skeleton คือ `AnimationController(...)..repeat()` (`core/ui/skeleton.dart`)
⇒ **มีเฟรมถูก schedule ตลอดเวลา ⇒ `pumpAndSettle` ไม่มีวันคืนค่า** มันเรนเดอร์เฟรมรัวที่สุดเท่าที่ทำได้
⇒ บน emulator ที่ render ด้วย software = พายุ CPU ⇒ process ตาย ⇒ harness เห็นแค่ "did not complete"

**skeleton ถูกแล้วที่หมุนไม่หยุด — เทสต์ผิดที่ไปรอให้มันหยุด**

แก้: `pumpUntil(finder)` (pump ทีละ 100ms แล้วหยุดทันทีที่เจอ) แทน `pumpAndSettle` ทุกจุด
· `pump()` ตอนวางจอเหลือเฟรมเดียว · เคสสร้างร้าน pump เป็นสเต็ปจนกว่า callback จะกลับมา
· เพิ่ม `-memory 3072` ให้ emulator เป็น headroom — **ไม่ใช่ตัวแก้** แต่เพื่อให้พายุครั้งหน้าออกมาเป็น assertion ที่แดง ไม่ใช่เครื่องตาย

**บทเรียนสำหรับ integration test ของ Flutter ทุกตัวหลังจากนี้:** จอไหนมี skeleton = ห้าม `pumpAndSettle`

### รอบถัดมา: เจอ **บั๊ก UI จริงบนเครื่องจริง** + เครื่องยังตายอยู่ (2026-08-17)

[run 31990514496](https://github.com/thewinwebdevelop/spec-inventory-manager/actions/runs/31990514496)

**🟠 B-11 · การ์ด "เจ้าของร้านสำรอง" ล้นขอบจอโทรศัพท์**
```
A RenderFlex overflowed by 5.0 pixels on the right.
Row … members_screen.dart:152   ← ปุ่ม "เชิญเจ้าของร้านอีกคน" + "ไว้ทีหลัง"
constraints: 0.0<=w<=256.0
```
Flutter ถือว่า overflow เป็น **error** เพราะแปลว่ามีเนื้อหาที่ผู้ใช้มองไม่เห็น
**ทำไม widget test 391 ตัวไม่เจอ:** harness เรนเดอร์ที่ **800×600 ซึ่งกว้างกว่ามือถือทุกรุ่น** — layout ที่พังบนเครื่องจริงจึงพอดีในเทสต์
· แก้: `Row` → `Wrap` (คงดีไซน์ side-by-side ของ ux เมื่อมีที่ · ตกบรรทัดเมื่อไม่มี — ซึ่งคือสิ่งที่ **label ภาษาไทยต้องการ** เพราะยาวกว่าอังกฤษที่คนมักใช้กะ layout)
· **เพิ่มเทสต์ที่ตั้งจอเป็น 360dp ก่อน** แล้ว assert `tester.takeException()` เป็น null · **mutation แล้ว**: เอา `Row` กลับมา ⇒ แดง

**🔴 เครื่องยังตายอยู่ (รอบที่ 2)** — เคส 3 รัน 40 วิแล้ว "did not complete" ทั้ง 2 เคสที่เหลือ + `adb emu kill` ตอบ connection refused
· รอบแรกอธิบายได้ด้วย `pumpAndSettle` (พายุเฟรม) · **รอบนี้เคส 3 ไม่แตะ widget เลย ยิงแต่ HTTP** ⇒ คำอธิบายเดิมใช้ไม่ได้
· **เลิกเดา ใส่เครื่องมือวัดแทน:** เก็บ `adb devices` · `free -m` · `logcat -d -t 400` **ก่อน teardown** แล้ว dump ตอน job แดง
⇒ รอบหน้าจะตอบได้ว่า Android ฆ่าแอป · host หมด RAM · หรือ emulator ตายเอง — ไม่ใช่เดาเป็นครั้งที่สาม

### เครื่องมือวัดตอบแล้ว — **สมมติฐานผมผิดทั้งสองรอบ** และเคส 1–2 เขียวแล้ว (2026-08-17)

[run 31991324725](https://github.com/thewinwebdevelop/spec-inventory-manager/actions/runs/31991324725) — `+2 -1`

```
adb devices → emulator-5554  device      ← เครื่อง "ไม่ได้ตาย" มันยังอยู่ดี ๆ
free -m     → available 6430 MB          ← ไม่ได้หมด RAM
logcat      → t=CLOSE (Task ปิด)         ← ที่หายไปคือ "แอป" ไม่ใช่ "เครื่อง"
```

**`could not connect to TCP port 5554` ที่ผมอ่านว่า "emulator ตาย" เป็นแค่ artifact ตอน teardown** — ผมสรุปจากมันสองรอบ
· ถ้าไม่ใส่เครื่องมือวัด ผมคงเดาเป็นรอบที่สาม (คราวนี้จะโทษ RAM) แล้วแก้ผิดจุดต่อไปเรื่อย ๆ

**ผลจริงรอบนี้:** เคส 1 (สร้างร้าน) และ **เคส 2 (รายชื่อร้าน+สมาชิก) เขียวแล้ว** — การแก้ overflow ได้ผล
เคส 3 แดงด้วย **`ForbiddenFailure` ที่บรรทัดของผมเอง**:

```dart
final before = await staffContainer...listMembers();   // ← พนักงานอ่านรายชื่อสมาชิกไม่ได้!
```

`GET …/members` ต้องมี `manage_members` ⇒ **พนักงานยิงแล้วได้ 403 FORBIDDEN ซึ่งถูกต้องแล้ว** (E-08 ฝั่ง web ยืนยันข้อเดียวกัน)
· ผมใช้ call ที่ persona นั้นทำไม่ได้มาเป็นตัวพิสูจน์ว่า "เขาอยู่ในร้านจริง" — **เทสต์ผิด ไม่ใช่แอปผิด**
· แก้เป็น `listRoles()` ซึ่งเป็น `@AnyActiveMember()`: สำเร็จตราบเท่าที่ยังเป็นสมาชิก = property ที่การถอดกำลังจะทำลายพอดี
· ส่วน userId ของคนที่จะถอด อ่านผ่าน client ของ **เจ้าของร้าน** ซึ่งมีสิทธิ์จริง

## ✅ E-10 เขียวบน emulator จริง — §12.1 ครบ 14/14 แถว (2026-08-17)

[run 31991966111](https://github.com/thewinwebdevelop/spec-inventory-manager/actions/runs/31991966111) — **เขียวครบ 9 job**

```
00:03 +1: E-10 · creates a shop on a real API and lands inside it
00:05 +2: E-10 · the shop list and the members list come back from the server
00:08 +3: ★ E-10 · removed mid-session: the shop goes, the session stays
          All tests passed!
```

**ราคาที่จ่ายไป 4 รอบ CI และสิ่งที่ได้กลับมา:**

| รอบ | แดงเพราะ | เป็นของใคร |
|---|---|---|
| 1 | YAML: `\` ต่อบรรทัดกลายเป็นชื่อไฟล์เทสต์ | ผม |
| 2 | **`ApiError(201)` — สมัครสมาชิกบนมือถือพังทุกครั้ง** | **แอป/contract** |
| 3 | `pumpAndSettle` กับ skeleton ที่หมุนไม่หยุด + **overflow 5px บนจอมือถือ** | ผม + **แอป** |
| 4 | ผมใช้ `listMembers()` เป็น probe ของ persona ที่ไม่มีสิทธิ์ | ผม |

⇒ **บั๊กจริงของแอป 3 ตัวจากเลนนี้** (mobile ไม่ถูก wire · signup พังทั้งหมด · UI ล้นจอ) และทั้งสามตัว **unit test ~390 ตัวเขียวทับอยู่**

**สรุปเครื่องมือของ F-002 ตอนนี้:** unit (web 323 · mobile 397 · api) + int (Postgres/Redis จริง) + **browser 26 เคส** + **emulator 3 เคส** + tripwire เชิงโครงสร้าง 4 ตัว (G-15 · capability · copy-lint · boolean-enum) + pack 2 ชุด (§9 41 ข้อ · build 11 ข้อ)

## Quality gate — หลักฐานสำหรับ qa (ไม่ใช่คำตัดสิน · qa เป็นเจ้าของ verdict) — 2026-08-17

รันตาม skill `quality-gate` (WEB_TEAM §4) เก็บ**หลักฐานจริง** ไม่ใช่คำยืนยัน:

| Gate | ผล | หลักฐาน |
|---|---|---|
| **A** Requirement | ✅ pass | Gate 1 เคาะแล้ว · แถวงานทั้งกระดานมี `G2✓` · platform = both · size = full |
| **B** Design | ✅ pass | ครบชุด: architecture · data-model · api-spec · ux-wireframe · ui · test-plan · **security-review 3 ฉบับ** (build-B: *"ไม่มีข้อที่ผมเสนอให้บล็อก merge"*) · **sync-back แล้ว** ที่ `docs/01-data-model.md` + `02-architecture.md` + `DECISIONS.md` (commit `3570f2d`) |
| **C** Domain & Data | ✅ pass | cross-tenant: `org-leak.kit.int.test.ts` **5 persona** (floor 20 เคสใน CI) · **money/stock = N/A และนี่คือเหตุผล**: `grep StockMovement\|Decimal apps/api/src/orgs/` ว่างเปล่า — F-002 ไม่แตะเงิน/สต๊อกเลย · logic แกนเป็น pure fn ใน `core-domain` · **query bounded**: composite index ตรงกับ query จริงทุกตัว (`[organizationId,status,createdAt]` · `[userId,status]` · `[organizationId,email,status]`) · contract + client regen เขียว (`contracts-drift`) |
| **D** Experience | ✅ pass (มีข้อสังเกต) | 4 states ครบทั้ง web/mobile · copy ไทยเป็นของ ux + **copy-lint บังคับถ้อยคำ AC-3.4** · ไม่มี hex ในจอ (token ล้วน) · **ข้อสังเกตไม่บล็อก:** B-7 (list ค้าง 30 วิ) · B-8 (จอปฏิเสธไม่บอกบัญชี) — เปิดค้างและมีเจ้าของแล้ว |
| **E** Quality | ⚠️ **ไม่ผ่าน 1 ช่อง** (เดิม 2 · dependency อนุมัติแล้ว 2026-08-18) | **เขียว:** [run 31992513221](https://github.com/thewinwebdevelop/spec-inventory-manager/actions/runs/31992513221) 9/9 job · web 323 · mobile 397 · browser 26 · emulator 3 · **test integrity:** ไม่มี `.skip/xit` เลย · มี mutation-check บันทึกไว้ 21 จุด · **diff hygiene:** ไล่ commit ทั้ง 25 ตัวของรอบนี้ **ไม่มีตัวไหนแตะ protected path** · **แดง:** **manual §12.2 M-01..M-07 ยังไม่ได้ทำ — เป็นงานคน** (ช่อง dependency ปิดแล้ว) |
| **F** Release | ⏸️ ยังไม่เริ่ม (ถูกต้องตามลำดับ) | อยู่บน branch ✓ · version ยัง `0.0.0` · ไม่มี CHANGELOG · **ไม่มี rollback plan** · **`docs/RETRO.md` ไม่มี F-002 เลย** → เป็นงานของ release + PM |

### dependency ใหม่ — ✅ **ผู้ใช้อนุมัติครบทั้ง 4 ตัว 2026-08-18**

| package | ที่ไหน | ทำไม |
|---|---|---|
| `@playwright/test` | apps/web (dev) | เลนเบราว์เซอร์ §12.1 — Gate E บังคับ E2E แต่โปรเจกต์ไม่มี runner |
| `ioredis` | apps/web (dev) | ล้างตัวนับ throttle ต่อ IP ระหว่างไฟล์เทสต์ (เหตุผลเต็มใน `helpers.ts`) |
| `@omnistock/core-domain` | apps/web (dep) | **ให้ client ใช้ `hasCapability` ตัวเดียวกับ server** — สาเหตุของบั๊ก B-1 คือมีสำเนาที่สอง |
| `integration_test` | apps/mobile (dev) | E-10 บน emulator (มากับ Flutter SDK ไม่ใช่ package ภายนอก) |

**VERDICT: ยัง NOT DONE** — เหลือ **ข้อเดียว** ที่ผมทำแทนไม่ได้:
1. ~~อนุมัติ dependency 4 ตัว~~ → ✅ **ผู้ใช้อนุมัติแล้ว 2026-08-18** (บันทึกไว้ตรงนี้เพราะ Gate E บังคับว่าต้องมี "PM approval + reason" เป็นหลักฐาน ไม่ใช่ความทรงจำ)
2. **manual §12.2** (M-01..M-07) — §17.6 บังคับให้มีก่อนตัดสิน · **เป็นงานคน**

ส่วน Gate F เป็นของ release ตามลำดับปกติ (ยังไม่ถึงคิว) · B-7..B-10 เปิดค้างแต่**ไม่บล็อก** — qa เป็นคนชี้ขาด

### runbook ของ manual pass — ทำให้ช่องแดงช่องสุดท้ายถูกและเร็ว (2026-08-18)

`docs/features/F-002/manual-pass-runbook.md` — ผมทำ manual pass แทนไม่ได้ แต่ทำให้มัน**ไม่เสียเวลาไปกับการหาว่าจะรันยังไง**ได้

- **คำสั่งยกสแตกที่รู้ว่าใช้ได้จริง** = ชุดเดียวกับที่ `e2e-web` รันเขียวทุกวัน · พร้อมคำเตือนตัวโตว่า **อย่าใช้ `pnpm dev`/`pnpm start` กับ API** (B-10) และเหตุผลของแต่ละตัวที่พัง
- ไม่ได้ใส่ค่า secret ลงไฟล์ — ชี้ไป `.env.example` + `infra/env/README.md` แล้วบอกว่าตัวไหนบังคับ (เช่น ไม่มี `DEFAULT_ORG_PLAN_KEY` = สร้างร้านได้ 503 ทุกครั้ง)
- มือถือ: `10.0.2.2` ใช้ได้เฉพาะ emulator — **เครื่องจริงต้องใช้ LAN IP**
- ตาราง M-01..M-06 พร้อมช่องติ๊ก + **ระบุว่าผลของแต่ละข้อเป็นข้อมูลให้ใคร** (M-02/M-05/M-06 → ux/product ไม่ใช่ qa)
- ตารางท้ายไฟล์: อะไรที่เลนอัตโนมัติพิสูจน์ไปแล้ว **จะได้ไม่ทำซ้ำด้วยมือ**

#### ⛔ เจอระหว่างเขียน: **M-07 ทำไม่ได้ในทางกายภาพ**

§12.2 M-07 = "กด **แสดงเลขเต็ม** บนมือถือจริง" · แต่ `apps/mobile` มี 5 จอ (สร้างร้าน · เลือกร้าน · สมาชิก · เชิญ · ลิงก์)
· `grep taxProfile|แสดงเลขเต็ม` ทั้ง `apps/mobile/lib` → **ไม่เจอ** ⇒ **จอภาษีไม่มีบนมือถือใน F-002**

และ test-plan เองรู้อยู่แล้วที่ **§13 ข้อ 3**: *"เพิ่ม lane ... ตอนที่จอ tax profile ลง mobile จริง (ยังไม่มีใน F-002)"*
⇒ **§12.2 ขัดกับ §13 ในเอกสารฉบับเดียวกัน** · ข้อเสนอ: M-07 เป็น N/A ของ F-002 แล้วผูกกับ feature ที่เอาจอภาษีขึ้น mobile
· **ไม่แก้ให้เพราะ test-plan เป็นของ qa** — เขียนไว้พร้อมหลักฐานเพื่อให้ตัดสินได้ในนาทีเดียว

### B-10 ครึ่งแรกปิดแล้ว: **กับดักหายไป** (แต่สาเหตุยังอยู่ และเป็นของเจ้าของอื่น) — 2026-08-18

reproduce ในเครื่องก่อนแก้ ไม่ได้เชื่อโน้ตเก่าของตัวเอง:

```
$ node dist/main.js        → SyntaxError: Unexpected token 'export'
                             at packages/config/src/index.ts:8
$ tsx  dist/main.js        → Invalid environment variables: DATABASE_URL is required …
                             (= แอปโหลดครบแล้ว เหลือแค่ env)
```

**แก้ script (ไม่เพิ่ม dependency):** `start` → `tsx dist/main.js` (ชุดที่ CI พิสูจน์ทุกวัน) ·
`dev` → `tsc && tsx dist/main.js` เพราะของเดิม `tsx watch src/main.ts` **บูตขึ้นแล้ว DI พังเงียบ ๆ**
(esbuild ไม่ปล่อย `design:paramtypes` — repo นี้รู้อยู่แล้ว: `vitest.config.ts` ถึงต้องรันผ่าน SWC และเรียกมันว่า "the ThrottleService-into-controller bug")
· เพิ่ม `dev:compile:watch` + `dev:run:watch` ไว้ให้คนที่อยาก watch จริง ๆ รันสองเทอร์มินัล — **ไม่แอบเพิ่ม process runner เข้ามาเป็น dependency**

**เทสต์ `run-scripts.test.ts`** จับ**ทั้งสองกับดัก**พร้อมเหตุผลของแต่ละอัน + SELF-CHECK + ยืนยันว่า `start` ตรงกับคำสั่งใน CI เป๊ะ
· **mutation แล้ว**: เปลี่ยน `start` กลับเป็น `node dist/main.js` ⇒ แดง 2 เคส พร้อมข้อความว่าทำไม

**ครึ่งหลังยังเปิด และไม่ใช่ของผม:** `config` · `contracts` · `db` ยัง ship TypeScript source (`"main": "src/index.ts"`)
ขณะที่ `core-domain` · `connectors` ship `dist/index.js` แล้ว ⇒ ตราบใดที่ยังไม่ทำให้เหมือนกัน `node dist/main.js` ตรง ๆ จะใช้ไม่ได้
และ `tsx` จะเป็น runtime dependency ต่อไป — **packaging decision ของ devops + backend-api**

### ปิดรูใน guard ที่ผมเขียนเอง: เลน E2E ทั้งสองมี "พื้น" แล้ว (2026-08-18)

**ปัญหาของ guard เดิม (ผมเขียนเอง):** ทั้งสองเลนถามแค่ *"มีเคสรันไหม"*
- browser: `expected < 1` ⇒ **ลบไฟล์ spec ทิ้ง 5 ไฟล์จาก 26 เคส ก็ยังเขียว**
- mobile: `grep "All tests passed"` ⇒ **เหลือเคสเดียวก็พิมพ์ข้อความนี้เหมือนกัน**

"อย่างน้อยหนึ่ง" เป็นคำถามที่ถูกสำหรับ suite ที่อาจว่างได้จริง ๆ · **แต่ผิดสำหรับเลนที่มีหน้าที่ครอบ §12.1 ทั้ง 14 แถว**

**แก้:** ใส่พื้นเป็นตัวเลขที่ workflow ส่งเข้าไป — `assert-playwright-ran.mjs <report> 26` และเลน mobile parse `+N` ท้าย log เทียบกับ 3
· เพิ่มเคสแล้วต้องยกพื้น · **ลดพื้น = การแก้ที่มองเห็นได้ใน diff และต้องอธิบายตัวเองในรีวิว** ซึ่งคือประเด็นทั้งหมด
· วิธีเดียวกับที่เลน vitest ใช้อยู่แล้ว (`--require file=N`)

**verify ทั้งสองทางในเครื่อง:** report 26 เคส ⇒ ผ่าน · report 21 เคส ⇒ **แดงพร้อมบอกว่าหายไปกี่เคส** ·
log ที่มี `+3` ⇒ ผ่าน · log ที่มี `+1` ⇒ ตกพื้น

**แก้ตามทันที (2026-08-18):** พื้นของเลน mobile แดงในรอบแรก **ทั้งที่ suite ผ่านครบ 3 เคส** —
log บอกตรง ๆ ว่า `mobile integration: 0 passing case(s)`

สาเหตุ: `android-emulator-runner` รัน **ทีละบรรทัดเป็น `sh -c` คนละตัว** ⇒ ตัวแปร `passed=$(...)` ที่ตั้งบรรทัดหนึ่ง **หายไปในบรรทัดถัดไป**
```
[command]/usr/bin/sh -c passed=$(grep …)
[command]/usr/bin/sh -c echo "mobile integration: ${passed:-0} …"   ← คนละ shell แล้ว
```
· **นี่คือครั้งที่สอง**ที่ execution model ของ action ตัวนี้ทำให้เสียรอบ CI (ครั้งแรกคือ `\` ต่อบรรทัด) ⇒ เขียนกฎไว้ในไฟล์เลย: **step ที่ต้องใช้ shell state ต้องเป็นคำสั่งเดียว**
· แก้เป็นบรรทัดเดียวคั่นด้วย `;` แล้ว **simulate ด้วย `sh -c` ในเครื่องทั้งสองทางก่อน push**: log `+3` ⇒ 3 ผ่านพื้น · log `+1` ⇒ 1 ตกพื้น

## B-7 และ B-8 ปิดแล้ว (user สั่งให้ทำ 2026-08-18)

### B-8 — จอปฏิเสธบอกได้แล้วว่าให้ใช้บัญชีไหน · **ไม่ได้แต่ง copy ใหม่แม้แต่คำเดียว**

2 ชั้นที่ต้องแก้:
1. `toApiFailure` — เพิ่ม `details` ให้ kind `forbidden` (เหตุผลเดียวกับที่ `conflict` มีอยู่แล้ว: server ส่ง context เฉพาะ code มาให้ copy ใช้)
2. `toInviteError` — เอา `details.emailMasked` มาประกอบ **จากประโยคที่ ux อนุมัติแล้วทั้งสองท่อน**:
   §11.1 `issuedTo` (`"คำเชิญนี้ออกให้ …"` ซึ่งอยู่บนจอ preview อยู่แล้ว) + §11.4 ประโยคเดิม (`"กรุณาเข้าสู่ระบบด้วยบัญชีที่ถูกเชิญ"`) คั่นด้วย ` · `

**ทำไมไม่แต่งประโยคใหม่:** copy เป็นของ ux — งานของไฟล์นี้คือ**เอาข้อมูลที่ server ส่งมาแล้วไปวางในประโยคที่มีอยู่** ไม่ใช่เขียนประโยค
· scope ไว้ที่ code เดียว: "append details ลง body" แบบทั่วไปจะเอา internal ของ server ไปโชว์ผู้ใช้
· 5 เคสใหม่: ใช้ masked · **fallback สะอาดเมื่อ server ไม่ส่งมา** (ไม่มี `undefined` ในประโยค) · ไม่รับค่าที่ไม่ใช่ string (`42`/`""`/`null`/`{}`) · **code อื่นไม่งอกที่อยู่ออกมา**
· **mutation แล้ว**: เอา `details` ออกจาก `forbidden` ⇒ แดง
· E-06 ใน browser lane เพิ่ม assertion ว่าจอปฏิเสธมี `คำเชิญนี้ออกให้` **และยังไม่หลุดอีเมลเต็ม** — สองข้อนี้ต้องจริงพร้อมกัน

### B-7 — รายชื่อสมาชิกสดแล้ว · **override 2 query ไม่ใช่ทั้งแอป**

`useMembers` + `useInvitations` ตั้ง `staleTime: 0` · เหตุผลที่เขียนไว้ในไฟล์: **นี่คือจอเดียวที่ข้อมูลตั้งใจให้เปลี่ยนจากนอกเบราว์เซอร์นี้**
(ทั้งฟีเจอร์คือรอคนอื่นกดรับ · ไม่มี mutation ในแท็บนี้ให้ invalidate · `refetchOnWindowFocus` ไม่ยิงเพราะแท็บไม่เคยเสีย focus)

**ที่ไม่แตะและเขียนเหตุผลไว้:** `staleTime` 30 วิของ query อื่นทั้งหมด รวม **org profile ที่ `OrgGuard` อ่าน** —
คนที่ถูกถอดยังถูกเด้งที่ **request จริงถัดไป** ซึ่งคือสิ่งที่ AC-5.1 เขียน ("request ถัดไป 403") ไม่ใช่ "ภายใน N วินาที"
· ราคา: request เพิ่ม 1 ครั้งต่อการเปิดจอสมาชิก แลกกับ 2 lists ที่มีหน้าที่รายงานสิ่งที่คนอื่นทำ

**ลบ `reload()` ออกจาก E2E ทั้ง 2 จุดแล้ว** (E-04 · S9) — **นี่คือวิธีพิสูจน์ว่าแก้จริง**: ถ้า caching เพี้ยนกลับ เคสจะแดง ไม่ใช่ผ่านไปเงียบ ๆ
· `reload()` ของ E-07 ฝั่ง staff **ยังอยู่** เพราะมันคือ trigger ของ AC ไม่ใช่ workaround (เขียนกำกับไว้แล้ว)

web: **330 tests เขียว** · lint สะอาด · pack ปรับ B-7/B-8 เป็นปิดพร้อม pin แล้ว

### B-7 รอบแรกยังแดง — และเหตุผลไม่ใช่ cache

E-04 กับ S9 (สองเคสที่ผมถอด `reload()` ออก) แดง · snapshot ยังเป็น `คำเชิญที่รอตอบรับ (1)` / `สมาชิกในร้าน (1)` เหมือนเดิม

**`staleTime: 0` ทำงานถูกแล้ว แต่ไม่มีใครไป trigger มัน:** `openMembers` กดลิงก์ "สมาชิก" **ตอนที่อยู่บนหน้านั้นอยู่แล้ว**
⇒ ไม่มี unmount/mount ⇒ **ไม่มี query ถูกยิงเลย** · `refetchOnMount` แปลว่า "ตอน mount" ไม่ใช่ "ตอนกดลิงก์"

⇒ เพิ่ม helper `reopenMembers()` = ไป "ข้อมูลร้าน" แล้วกลับมา "สมาชิก" · **นี่คือสิ่งที่เจ้าของร้านทำจริงระหว่างรอคนกดรับ**
· และเป็นการพิสูจน์ที่แท้จริง: `reload()` จะผ่านแม้ revert การแก้ไป — round trip จะไม่ผ่าน

**ขอบเขตของ B-7 (เขียนไว้ใน pack แล้ว):** สดเมื่อจอถูก **mount** — กลับเข้าจอ หรือกลับมาที่แท็บ (`refetchOnWindowFocus` ซึ่ง 30 วิเดิมกลืนไว้ = **การสลับไป LINE แล้วกลับมา** ซึ่งคือ path จริงของ flow นี้)
· **ไม่ครอบ:** คนที่นั่งจ้องจออยู่เฉย ๆ ไม่แตะอะไร — ต้องใช้ polling ซึ่งเป็นการตัดสินใจเรื่อง request/แบตที่ยังไม่มีใครตัดสิน **จึงไม่ทำเอง**

**gate ของ build-defect pack จับ pin ของผมเองว่าเก่า:** pin เดิมอ้างข้อความคอมเมนต์ `"NO RELOAD"` ซึ่งผมเพิ่งเขียนใหม่เป็น "A ROUND TRIP" ⇒ แดงทันที
⇒ เปลี่ยนไป pin **กลไก** (`reopenMembers`) ไม่ใช่ประโยค · **บทเรียนเรื่อง pin: pin สิ่งที่ต้องหายไปจริง ๆ ถ้า coverage หาย ไม่ใช่ถ้อยคำที่คนแก้ได้ตลอด**

## B-9 ปิดแล้ว — เพิ่ม **1 บิต** ลง §3.6 ไม่ใช่เปิด capabilities (2026-08-19)

เข้า skill `contract-evolution` ก่อนแตะ contract ตามกฎ

**ปัญหา:** §3.6 ตั้งใจไม่ส่ง `capabilities` (เหตุผลเขียนไว้ในสัญญาเอง: "จะชวนให้ client คำนวณสิทธิ์เอง") ⇒ client ระบุ role เจ้าของร้านไม่ได้ **ถ้าคนดูไม่ใช่เจ้าของ**
⇒ §10.1 ("แสดงตัวเลือกเจ้าของร้านแบบ disabled + เหตุผล") **implement ไม่ได้สำหรับผู้ดูแล** และ filter ของ S7 กรองอะไรไม่ได้เลย
⇒ ทางที่ client จะไปคือ `key === "owner"` ซึ่งกฎทองห้าม และ F-003 (สร้าง role เองได้) จะพังทันที

**แก้:** เพิ่ม `grantsOwnership` — **บิตเดียวที่ derive มาแล้ว ไม่ใช่ลิสต์ capability**
· server คิดด้วย `isOwnerRole()` จาก core-domain (ฟังก์ชันเดียวกับที่ `toMemberRow` ใช้ทำ `isOwner`) ⇒ ระบบมีคำตอบเดียวว่า "อะไรคือ ownership"
· **optional ในสัญญา** ตาม contract-evolution: client ที่ใหม่กว่า server ต้อง parse ได้ และ "ไม่ส่งมา" ≠ "ไม่ใช่"
· `capabilities` ยัง**ไม่ถูกเผยแพร่** — service select มาเพื่อคิดบิตแล้ว project ทิ้ง (มีเทสต์เช็ค key ของ object ว่ามี 5 ตัวเป๊ะ + `JSON.stringify` ไม่มี `full_access`)

**เทสต์ที่สำคัญกว่า happy path:**
- API: **role ที่ `key='owner'` แต่ capability เป็น staff ⇒ `grantsOwnership: false`** (I-45) และ **role ที่ `key=null` แต่มี `full_access` ⇒ true** (เคสของ F-003)
- **mutation แล้วทั้ง 3 ชั้น:** เปลี่ยน server เป็น `key === "owner"` ⇒ แดง 2 เคส · ใส่ shortcut กลับใน mobile ⇒ แดง
- web: **เคสที่ผมเคย pin ว่า "ผู้ดูแลเห็นตัวเลือกเจ้าของร้านแบบกดได้" ถูกกลับข้างแล้ว** — คอมเมนต์เดิมเขียนไว้ว่า "วันที่ §3.6 มี flag เคสนี้จะแดงและบอกว่าต้องแก้อะไร" · วันนั้นคือวันนี้

#### เจอของแถม: web กับ mobile ทำ §8 ไม่เหมือนกันมาตลอด

web's S7 **filter ตัวเลือกเจ้าของร้านออก** · mobile **แสดงแบบ disabled + เหตุผล** ตาม §8
· **มองไม่เห็นความต่างมาก่อน** เพราะ `ownerRoleIds` ว่างสำหรับคนที่ไม่ใช่เจ้าของ ⇒ filter ไม่ได้กรองอะไร ⇒ ตัวเลือกเจ้าของร้านกดได้เงียบ ๆ ทั้งสองฝั่ง
⇒ web เปลี่ยนเป็น show-but-disable · **ใช้ประโยค helper ของ mobile คำต่อคำ** (`"เฉพาะเจ้าของร้านเท่านั้นที่ตั้งเจ้าของร้านคนใหม่ได้"`) — สองแพลตฟอร์มตอบคำถามเดียวกันด้วยคำเดียวกัน

web 331 · mobile org 118 เขียว · TS+Dart client regen แล้ว · รอ `oasdiff` ตัดสินว่า additive

## B-10 ครึ่งหลังปิดแล้ว — `node dist/main.js` รันได้จริง (2026-08-19)

```
$ node dist/main.js
Invalid environment variables:
  - DATABASE_URL: DATABASE_URL is required     ← แอปโหลดครบทั้งก้อนแล้ว เหลือแค่ config
```

**ขอบเขตจริง: 2 package ไม่ใช่ 3** — ไล่ดูจาก `dist` ที่ compile แล้วว่า require อะไรจริง:
`core-domain` (28 จุด · ship dist อยู่แล้ว) · `db` (16) · `config` (11) · **`contracts` = 0** เพราะ API ใช้ `import type` เท่านั้น ⇒ ไม่ต้องแตะ

**การตัดสินใจที่สำคัญที่สุด: ย้าย Prisma client ออกจาก `src/`** ไป `packages/db/generated/`
· `src/` กับ `dist/` เป็น sibling ⇒ `../generated/client` resolve ไปที่เดียวกันทั้งจากซอร์สและจากไฟล์ที่ compile แล้ว
· **ทางเลือกที่ diff เล็กกว่าคือ copy client เข้า `dist/` ตอน build — และนั่นคือทางที่อันตรายกว่า**: จะมี client 2 ชุด และชุดหนึ่งเก่ากว่า schema ได้เงียบ ๆ
⇒ เลือกทางที่ diff ใหญ่กว่าแต่**ไม่มีโอกาสมีสำเนาที่สอง**

**`tsconfig.build.json` แยกจาก `tsconfig.json`** ทั้งสอง package: ตัวเดิมยัง `noEmit` + include ไฟล์เทสต์ (typecheck/vitest อ่านตัวนั้น) · ตัวใหม่ ship เฉพาะไฟล์ runtime
⇒ กัน `*.test.ts` และ `*.compile-test.ts` (ไฟล์ที่ตั้งใจให้พังตอน compile) หลุดเข้า `dist/`

#### ⚠️ กับดักที่เกือบเขียวในเครื่องผมแล้วแดงในทุกเครื่องอื่น

build ครั้งแรกที่ไม่ใส่ `types` **ผ่านในเครื่องผม** · `--traceResolution` บอกว่ามันไปเจอ @types/node ที่ **`/Users/tar/node_modules`** — นอก repo ทั้งก้อน
⇒ ใส่ `"types": ["node"]` + ประกาศ `@types/node` เป็น devDependency ของ 2 package นั้น (เวอร์ชันเดียวกับที่ apps ใช้อยู่ `^22.10.2` — ไม่ใช่ package ใหม่ของ repo แต่**ขอแจ้งไว้เพราะ Gate E บังคับ**)
· ค้นพบระหว่างทาง: `tsconfig.json` ของ config ที่ใช้ `"types": []` typecheck ผ่านได้**เพราะมีไฟล์เทสต์อยู่ใน program** และ types ของ vitest อ้าง Node ต่อ — เส้นทางที่ config ตัว emit สืบทอดไม่ได้

**scripts + CI:** `start` → `node dist/main.js` · `dev` → `tsc && node dist/main.js` · `dev:run:watch` → `node --watch` · **CI เลิกใช้คำสั่งที่มีอยู่แค่ในไฟล์ workflow แล้วรัน `pnpm --filter api start` ของ repo เอง** — CI จึงพิสูจน์คำสั่งที่คนพิมพ์จริง

**`run-scripts.test.ts` ถูกกลับข้าง** (ครั้งที่ 2 ในเซสชันนี้ที่ guard ทำนายการกลับข้างของตัวเองถูก): ห้าม `tsx` ใน boot path แล้ว
· เพิ่ม guard ของ **สาเหตุ** ไม่ใช่แค่อาการ: ไล่ `package.json` ของทุก package ที่ API โหลด runtime แล้วยืนยันว่า `main` ลงท้าย `.js`
· **mutation แล้ว**: คืน `config.main` เป็น `src/index.ts` ⇒ แดงพร้อมชื่อ package

api 680 tests เขียว · db/config/core-domain/contracts เขียว · typecheck+lint สะอาด

**ผลข้างเคียงของ B-10 ที่ CI จับได้ (และเป็นบทเรียนของ monorepo):** `db-migrate` แดง
`Failed to resolve entry for package "@omnistock/config"`

package ที่ emit `dist/` ทำให้ **consumer ต้อง build ก่อนรัน** — `turbo test` ประกาศ `dependsOn: ["build"]` ไว้แล้ว
แต่ job นี้เรียก `pnpm --filter … run <script>` ตรง ๆ **ข้าม dependency graph ของ turbo ไป**
⇒ เลนที่ขับด้วย turbo เขียวหมด (node-ci) · เลนที่ขับ script ตรงแดง · **e2e-web/mobile-e2e เขียวเพราะมี `turbo build` อยู่แล้ว**

แก้: เพิ่มขั้น `pnpm turbo build --filter=@omnistock/db` ใน job นั้นก่อน `verify:ac`/test พร้อมเหตุผลกำกับ
· **reproduce ในเครื่องก่อนแก้**: ลบ `dist` ทั้งสอง package ⇒ ได้ error ตัวเดียวกันเป๊ะ ⇒ build แล้วเทสต์ผ่าน 161 ตัว

## M-07: สร้างจอภาษีบนมือถือ (user สั่ง 2026-08-19) — **เพิ่ม scope ของ F-002 โดยเจตนา**

⚠️ **ขัดกับ §13 ข้อ 3 ที่เลื่อนเรื่องนี้ไว้** — ผู้ใช้ตัดสินใจให้ทำ · บันทึกไว้ตรงนี้เพื่อให้ qa/product แก้เอกสารตาม
เข้า skill `client-security` ก่อนเขียนโค้ด (★ task: TIN ของบุคคลธรรมดา = เลขบัตรประชาชน)

**ขอบเขตที่เลือกและเหตุผล: อ่าน + เปิดดูเท่านั้น ไม่มีฟอร์ม**
· §13 ข้อ 3 ให้ฟอร์มเป็นงานเว็บ · การใส่ฟอร์มมาด้วยคือเพิ่ม scope ที่ไม่มีใครขอ
· เจ้าของร้านที่ยังไม่ได้ประกาศ **ได้รับการบอกว่าไปทำที่ไหน** ไม่ใช่เจอทางตัน (`taxEditOnWebHint`)

**3 ชั้นป้องกัน — ไม่มีชั้นไหนพอเพียงลำพัง:**

| ชั้น | ทำอะไร | ทำไมลำพังไม่พอ |
|---|---|---|
| `FLAG_SECURE` / iOS obscuring | ลบภาพใน app switcher | best-effort · iOS ไม่มี API บล็อก screenshot จริง |
| **ทิ้งเลขเมื่อแอปออกจาก foreground** | เลขหายก่อนกลับเข้ามา | OS ถ่ายภาพ **แข่ง**กับเฟรม — Dart รู้ตัวไม่ทันเสมอ |
| ไม่เก็บที่ไหนเลย | ดูอีกครั้ง = request ใหม่ที่ถูกนับ+บันทึก | — |

· ใช้ `ScreenshotGuardScope` ของ F-001 ตรง ๆ (ref-counted + observer ที่ re-enable หลัง activity recreation อยู่แล้ว)
· **ถือ guard เฉพาะตอนเลขอยู่บนจอ** (รวม `loading` เพื่อไม่ให้เฟรมแรกหลุด) — ไม่ถือทั้งจอ เพราะจอที่โชว์แต่ mask ไม่ใช่ความลับ และ thumbnail ที่ดำตลอดคือสิ่งที่คนจะปิดทิ้ง

**สถานะ = shape ไม่ใช่ flag:** `RevealShown` เป็น variant เดียวที่**มีฟิลด์เก็บเลขได้** ⇒ "ซ่อน" แปลว่าไม่มีที่เก็บ ไม่ใช่ "เก็บไว้แต่ไม่วาด" (มิเรอร์ `tax-reveal.ts` ของเว็บ)

**เทสต์ 24 ตัว · mutation ครบทุกกฎ ★:**
- domain 7: shape · tier (staff ไม่เห็นแม้ 4 ตัวท้าย · **Owner ที่มีแค่ `full_access` ต้องเห็น details**)
- controller 8: **ปิดหน้าจอ/สลับแอป (`inactive`/`paused`/`hidden`/`detached`) ⇒ เลขหาย** · กลับมา `resumed` **ไม่ reveal เอง** · hide ไม่กิน quota · ดูอีกครั้ง = request ใหม่
  · mutation: เอาการทิ้งเลขออก ⇒ **แดง 3 เคส**
- widget 9: 4 states ครบ · **refcount ของ screenshot guard ขึ้น/ลงตามเลขบนจอ** (เพิ่ม `debugRefCount` เพราะ MethodChannel เป็น no-op ใต้ `flutter test` ⇒ เดิมสังเกตไม่ได้เลย)
  · mutation: ตัดการ acquire ⇒ **แดง 2 เคส**
- **emulator lane +1 เคส**: `GET /orgs/{id}` ไม่มีเลข · reveal บนร้านที่ยังไม่ประกาศ **ต้องพังดัง ๆ ไม่ใช่คืนค่าว่าง** ⇒ ยกพื้นเลน 3 → 4

**ที่ยังเป็นงานคนอยู่ (คือแก่นของ M-07):** ภาพใน app switcher จริง · เลขอ่านออก/คัดลอกได้บนจอโทรศัพท์จริง — `SelectableText` เตรียมไว้ให้แล้ว

**tripwire ที่ผมเขียนเองจับโค้ดที่ผมเพิ่งเขียนเอง (2026-08-19):** `node-ci` แดงที่ `capability-lint.test.ts`

`taxCardView` เขียนกฎ wildcard ซ้ำ: `capabilities.contains(fullAccess) || capabilities.contains(manageOrgSettings)`
· มันคือ**สำเนาที่สองของกฎ authorization** — สิ่งเดียวกับที่ทำให้เจ้าของร้านมองไม่เห็นเมนูตัวเอง (B-1) เมื่อสี่วันก่อน
⇒ ยก `hasCapability(Set, String)` ขึ้นไปไว้ที่ `core/session` เป็น implementation เดียว · `ActiveOrg.can` และ `taxCardView` เรียกตัวเดียวกัน

**นี่คือเหตุผลทั้งหมดที่ guard เชิงโครงสร้างคุ้มกว่าเทสต์ที่ assert พฤติกรรม:** เทสต์ 24 ตัวของ M-07 เขียวหมดทั้งที่มีสำเนาที่สองอยู่ในนั้น — เพราะสำเนานั้น *ทำงานถูก* วันนี้ · สิ่งที่ผิดคือ**การมีอยู่ของมัน** และมีแค่ guard ที่อ่านโครงสร้างเท่านั้นที่เห็น

## security review ของ M-07 (user สั่ง 2026-08-19) — **เจอ Critical จริง 1 + High 3**

reviewer ไม่ได้อ่านเฉย ๆ — **เขียน probe 7 ตัวยิงใส่จอจริงเพื่อหักล้างข้ออ้างของผมทั้ง 6 ข้อ** แล้วลบทิ้ง · ทุกบรรทัด "Evidence" คือ output จริง

| ระดับ | เรื่อง | สถานะ |
|---|---|---|
| **Critical** | **เลขที่เปิดดูแล้ว อยู่ข้ามจอ ข้ามร้าน และข้าม session** | ✅ แก้ที่ราก |
| High | reveal ที่ลอยอยู่ **มาถึงตอนแอปอยู่เบื้องหลัง → ถูกวาด** | ✅ epoch |
| High | `press()` catch แค่ `ApiFailure` ⇒ อย่างอื่นทำจอค้าง loading ถาวร | ✅ catch-all |
| High | **capability set ที่จอใช้ ว่างเปล่าในแอปจริง** ⇒ เจ้าของร้านเห็น tier read-only | ✅ **ทั้งสองครึ่ง** (การ์ดภาษี → อ่านจาก response · ทั้งแอป → เข้าร้านแล้วถามเซิร์ฟเวอร์) |
| Medium | เทสต์ "leaving the screen forgets it" เรียกเมธอดที่ production ไม่เคยเรียก | ✅ เขียนใหม่ |
| Medium | เทสต์ integration ชื่อ "round trip" ไม่เคย reveal เลข | ✅ round trip จริงบน emulator |
| Medium | คลิปบอร์ด replicate ข้ามเครื่อง (Android 13 preview · iOS Universal Clipboard) | ✅ ลด surface + mark native ทั้งสองฝั่ง |
| Low ×2 | error copy แยก 429/404 ไม่ได้ · domain ไม่ pure จริง (import Flutter ทางอ้อม) | ✅ ทั้งคู่ |

### Critical: หลักฐานที่ทำให้เถียงไม่ได้

```
หลังปิดจอ:        state=RevealShown visible=0105560123454
เข้าจอใหม่:        เลขเต็มถูกวาดอีกครั้ง · revealCalls=1  ← ไม่มี request ใหม่ = ไม่มี audit event
switchOrg(org_2): เลขของร้าน A ยังอยู่บนการ์ดของร้าน B
sessionExpired → คนอื่นล็อกอิน: เลขบัตรประชาชนของคนก่อนหน้า อยู่บนเฟรมแรก
```

**"ทุกการเปิดดูถูกบันทึก" ของ §3.16 เป็นเท็จบนมือถือ** — audit log รายงานน้อยกว่าความจริง

### การแก้: **Riverpod ปฏิเสธ 3 ครั้ง แล้วผมถึงเข้าใจว่ามันกำลังบอกอะไร**

1. เรียก notifier ใน `dispose` ⇒ notify defunct element ⇒ throw
2. `ref.invalidate` ใน `dispose` ⇒ พังทั้งไฟล์
3. reset ใน `initState` ⇒ *"Tried to modify a provider while the widget tree was building"*

⇒ **state ที่เป็นความลับและมีอายุเท่าจอ ไม่ควรอยู่ใน container ที่อายุยืนกว่าจอ**
ย้ายไปไว้ใน `State` ของจอเอง (`TaxRevealSession` — plain class ให้ยังเทสต์ได้โดยไม่ต้องมี widget)
⇒ **"ออกจากจอแล้วเลขหาย" กลายเป็นข้อเท็จจริงเรื่องที่เก็บ ไม่ใช่กฎที่ใครต้องจำไปทำ**
· **mutation แล้ว**: ทำให้ session อยู่รอดข้ามจอ (static) ⇒ เคส "coming back never inherits" แดงทันที

**เทสต์ 12 ตัวของ session + 9 ของจอ + 7 ของ domain** · mobile 427 เขียว · analyze/boundary สะอาด

### 🟠 ที่ยังเปิดค้าง (ส่งต่อ ไม่ปิดเอง)

> ตัดออกแล้ว 3 ข้อ — ทั้งสามข้อ**ผมทำเองได้และทำแล้ว** (คลิปบอร์ด native ทั้งสองฝั่ง · round trip จริงบน emulator · M-07ข/ค เข้า runbook)
> เหลือเฉพาะข้อที่**เจ้าของไม่ใช่ผม** ซึ่งเป็นเหตุผลเดียวที่ยังเปิดอยู่:

- **auto-hide เมื่อไม่ได้ใช้งาน**: mobile ควรซ่อนเลขเองไหมเมื่อทิ้งจอไว้เฉย ๆ (เว็บไม่มี) — เป็นการตัดสินใจเรื่อง**ประสบการณ์ ไม่ใช่ความปลอดภัย** (ออกจากจอ/พับแอป/สลับร้าน/ออกจากระบบ ปิดหมดแล้ว) ⇒ **@ux + @product**
- **`myMembership.capabilities` เป็นแหล่งเดียวของ client ใช่ไหม**: `GET /orgs/{orgId}` เป็นทางเดียวที่ client รู้ว่าตัวเอง "เสนออะไรได้" เพราะ §3.5 ตั้งใจไม่ส่ง capabilities ใน `/me/organizations` ⇒ **@backend-api** ยืนยันว่านี่คือสัญญาที่ตั้งใจ ไม่ใช่ผลข้างเคียง

### integration test ที่ชื่อ "round trip" — ตอนนี้ round trip จริงแล้ว (2026-08-19)

reviewer ชี้ว่าเคสนี้ **declare อะไรไม่เคยเลย** ⇒ success path (deserialise `taxId`/`revealedAt`) **ไม่เคยถูกยิงกับ server จริง**
· ซึ่งคือเส้นทางเดียวกับที่ High #3 บอกว่าถ้าพังจะทำให้จอค้าง `loading` ถาวร

เคสใหม่เดินครบวง:
1. ร้านใหม่ ⇒ `taxProfileComplete: false` · ไม่มี mask · **reveal ต้องพังดัง ๆ**
2. **ประกาศผ่าน API** (`PUT …/tax-profile`, `entityType: personal` = เคสที่เลขนี้คือเลขบัตรประชาชน) — mobile ไม่มีฟอร์ม จึงทำแบบที่เกิดขึ้นจริง คือคนไปทำบนเว็บ
3. **response ของ PUT เองก็ต้องไม่ echo เลขกลับมา** (§3.3)
4. `GET /orgs/{id}` ⇒ `taxProfileComplete: true` · มี mask · **mask ต้องไม่มีเลขเต็มอยู่ข้างใน** · และมี `capabilities` (ฟิลด์ที่เคยถูก map ตกไปจนเจ้าของร้านเห็น tier ผิด)
5. **reveal ⇒ ได้เลขเต็มจริง** ← success path ที่ไม่เคยมีใครยิง
6. **หลัง reveal แล้ว `GET` ยังคงมีแค่ mask** — ถ้าวันหนึ่ง reveal ไป "อุ่น" profile response ทุกจอที่โชว์ร้านจะเริ่มรั่ว
7. reveal ครั้งที่สอง = request ใหม่ (ไม่มี cache ที่ไหนในสาย)

**CI จับ guard ของตัวเองสองตัวที่ผิด (ไม่ใช่ product พัง) — 2026-08-19**

1. **capability tripwire แดงใส่ไฟล์ที่ implement กฎนั้นเอง** — เพราะกฎย้ายไป `core/session/capabilities.dart` (ผลจาก Low #9 ของรีวิว) แต่ allow-list ยังชี้ `session_state.dart`
   ⇒ **guard เก่า ไม่ใช่ guard ถูก** · แก้ allow-list ให้ตามกฎไป
2. **`I-C-01` แดงด้วย "SQLSTATE leaked to the client: ... not to contain '40001'"** ทั้งที่ body สะอาด
   · assertion เดิมสแกน **substring** ทั้งก้อน ⇒ **cuid2 ยาว ๆ มีโอกาสมีเลข 5 ตัวนั้นอยู่ข้างในโดยบังเอิญ**
   · เป็นบั๊กชนิดเดียวกับ "3454" ใน E-14 เป๊ะ ⇒ เปลี่ยนเป็น match แบบ **token boundary** + `leaksSqlstate()` ที่ export ออกมาให้ SELF-CHECK ทดสอบทั้งสองทาง
   (`"code 40001"` ⇒ จับได้ · `"cmsz40001dm4s001g"` ⇒ ไม่จับ)

**ทั้งสองตัวคือ guard ที่ทำให้ suite เขียวกลายเป็นแดง** ซึ่งผมเขียนเตือนตัวเองไว้เองว่าอันตรายกว่าไม่มี guard — คนถัดไปจะลบทิ้ง

✅ **ยืนยันบน emulator จริง** ([run 32211552086](https://github.com/thewinwebdevelop/spec-inventory-manager/actions/runs/32211552086) — เขียวครบ 9 job):
```
00:05 +2: ★ M-07 · the tax id round trip against the real API
          mobile integration: 4 passing case(s) (floor 4)
```
success path ของ `POST …/tax-profile/reveal` **ถูกยิงกับ server จริงเป็นครั้งแรก** — deserialise ผ่าน · profile ยังคงมีแค่ mask หลัง reveal

### ปิดข้อสุดท้ายของรีวิว: clipboard ที่ไม่เดินทางข้ามเครื่อง (2026-08-19)

reviewer จัดเป็น **residual risk ให้ตัดสิน ไม่ใช่ defect ให้ลบ** — เพราะ "คัดลอกได้" คือข้อกำหนดของ M-07 (ข) เอง
· ปัญหาคือคลิปบอร์ดปกติพาเลขออกไปไกลกว่าที่แอปคุมได้: **Android 13+ เด้ง preview ของค่าที่คัดลอก ซึ่งอยู่นอกหน้าต่างที่ `FLAG_SECURE` คุม** และ sync ไป Chromebook · **iOS ส่งต่อไปเครื่อง Apple อื่นของคนเดียวกันผ่าน Universal Clipboard และอยู่ยาว**

**เก็บการคัดลอกไว้ แต่ทำให้มัน mark ตัวเอง** (ทำตามที่ reviewer เสนอ):
- Android: `ClipDescription.EXTRA_IS_SENSITIVE` ⇒ ระบบไม่โชว์ preview (13+ · ต่ำกว่านั้นแพลตฟอร์มไม่มีอะไรให้ใช้ — เขียนไว้ตรง ๆ)
- iOS: `localOnly: true` (ไม่ไป Universal Clipboard) + `expirationDate` 120 วิ (ระบบล้างให้ ไม่ค้างข้ามวัน)
- Dart: เมนู Copy ของ `SelectableText` ถูก override ให้วิ่งผ่านช่องนี้ **ไม่ใช่คลิปบอร์ดปกติของ Flutter** · โครงเดียวกับ `ScreenshotGuard` ของ F-001 (first-party MethodChannel ไม่ลาก plugin เข้ามาเพื่อ 1 เมธอด)

**fallback ที่ไม่โกหก:** ไม่มี native handler (เช่นใน `flutter test`) ⇒ คัดลอกด้วยคลิปบอร์ดปกติ **แล้ว return `false`**
· ไม่คัดลอกเลย = ฟีเจอร์พังเงียบ · คัดลอกแล้วอ้างว่าปลอดภัย = แย่กว่า ⇒ ทำอย่างแรกแล้ว**บอกความจริง** · เทสต์ 3 เคสยืนยันทั้งสองทาง

**เพิ่มขั้นตอน manual ตามที่ reviewer ขอ:**
- **M-07ข** — ทำ 3 ทางที่ probe เคยเจอว่าพัง ซ้ำด้วยมือ: ออกจากจอแล้วเข้าใหม่ · สลับร้าน · ออกจากระบบแล้วให้อีกคนล็อกอิน
- **M-07ค** — ดู clipboard preview บน Android 13+ ว่าไม่โชว์เลข · และเช็คว่าเลขไม่โผล่บนเครื่อง Apple อื่นของคนเดียวกัน

mobile 430 tests เขียว · analyze/boundary สะอาด

### ปิดครึ่งที่สองของ High #4: **ทั้งแอปเข้าร้านด้วย capability ว่างเปล่า** (2026-08-19)

รีวิวบอกไว้ตรง ๆ ว่า `invite_member_screen.dart:53` มีปัญหาเดียวกัน — ผมแก้เฉพาะการ์ดภาษีไปก่อน ⇒ **ยังค้างอยู่จริง**

ยืนยันในโค้ด: `enterOrganization(ref, org)` ถูกเรียกจาก **org_picker (บรรทัด 59)** และ **org_switcher (บรรทัด 143)** โดย**ไม่ส่ง capabilities** · มีแต่ create-org ที่ส่ง (เพราะ `POST /organizations` คืนมาให้)
⇒ ใครก็ตามที่เข้าร้านจากตัวเลือกร้านหรือสลับร้าน จะมี `capabilities: {}` ⇒ **เจ้าของร้านตัวจริงถูกปฏิบัติเหมือนไม่มีสิทธิ์อะไรเลย**
· จอเชิญ: เลือก role "เจ้าของร้าน" ไม่ได้ · การ์ดภาษี: ไม่เห็นรายละเอียด · เปลี่ยนชื่อร้าน: ไม่ได้
· **fail closed จึงไม่มีใครเห็น** — ไม่มีอะไรพัง มีแต่ของหายไปเฉย ๆ

**แก้ที่ต้นทาง:** ตอนเข้าร้าน ให้ไปถาม server (`GET /orgs/{id}` → `myMembership.capabilities`) แล้วบอก session
· **ไม่ await** — การเข้าร้านไม่ควรรอ round trip · ระหว่างรอ จอปิดสิทธิ์ไว้ก่อน ซึ่งเป็นทิศที่ปลอดภัย
· `capabilitiesLearned` **ทิ้งคำตอบที่มาช้าของร้านที่ผู้ใช้ออกไปแล้ว** — รูปแบบเดียวกับ epoch ของ M-07 (คำตอบของร้าน A ต้องไม่ไปลงในร้าน B)
· สร้างร้านใหม่**ไม่ถามซ้ำ** เพราะ 201 ตอบมาแล้ว (ux Q5)
· ถามไม่สำเร็จ ⇒ UI เสนอ**น้อยลง ไม่ใช่มากขึ้น** และ server ปฏิเสธอยู่ดี

เทสต์ 4 เคส · **mutation แล้ว**: เอาการเรียก learn ออก ⇒ แดง · mobile 434 เขียว

**คำถามที่ reviewer ส่งให้ backend-api ยังเปิดอยู่:** `GET /orgs/{orgId}` → `myMembership.capabilities` เป็นแหล่งเดียวที่ตั้งใจให้ client ใช้ตัดสินว่าจะ "เสนออะไร" ใช่ไหม (เพราะ `/me/organizations` ตั้งใจไม่ส่ง capabilities)

### เก็บของที่รีวิวเจอเข้า pack ให้มันไม่หายไปกับ log (2026-08-19)

สิ่งที่รีวิวเจอ 2 ข้อใหญ่ยังอยู่ใน**ร้อยแก้วของไฟล์นี้เท่านั้น** ⇒ ไม่มี gate ไหนดูแลมัน ⇒ ลบเทสต์ทิ้งวันหน้าก็ไม่มีใครรู้
⇒ ใส่เข้า `build-defects.ts` เป็น **B-12** (เลขที่เปิดดูแล้วอยู่ข้ามจอ/ข้ามร้าน/ข้าม session) และ **B-13** (เข้าร้านด้วย capability ว่าง)

**ทำไมอยู่ pack นี้ ไม่ใช่ pack §9:** §9 คือ 41 ข้อที่**ทำนายจากเอกสาร**ก่อนมีของ · pack นี้คือข้อที่**เจอตอนรันของจริง**
· รีวิวเขียน probe 7 ตัวยิงจอที่ build แล้ว ไม่ได้อ่านเฉย ๆ ⇒ ลายเซ็นเดียวกับทุกแถวในนี้: **มี suite เขียวทับอยู่ตอนนั้น**

pin ที่ **พฤติกรรม** ไม่ใช่ถ้อยคำ (บทเรียนจาก B-7): `never inherits the number` · `backgrounding drops the number` · `after dispose` · `learns what this member may do` · `has LEFT`
⇒ build pack **13 แถว** · gate 6/6 เขียว

### บั๊กในตัวแก้ของผมเอง: **แก้แล้วมันไม่ทำงานในแอปจริง** (2026-08-19)

ตัวแก้ B-13 ที่เพิ่ง push ไปมี `ref.read(...)` **หลัง `await`** — และ `ref` ตัวนั้นคือ `WidgetRef` ของ**จอที่กด**
· `WidgetRef` ที่ถูกใช้หลังจาก widget ถูก dispose แล้ว **throw**
· `throw` ตัวนั้นตกลง `catch (_)` ที่ผมเขียนไว้เอง ⇒ **เงียบสนิท**

**และจอที่กด "เข้าร้าน" คือจอที่ถูกแทนที่ทันทีเพราะการกดนั้นเอง** (picker ถูก replace · switcher ปิดตัวเอง)
⇒ ในแอปจริง คำตอบจะมาถึงตอนที่เจ้าของ `ref` หายไปแล้ว**แทบทุกครั้ง** ⇒ capability ว่างเหมือนเดิม ⇒ **แก้เท่ากับไม่ได้แก้ และล้มเหลวแบบเดียวกับบั๊กเป๊ะ: เงียบ ปิดสิทธิ์ ไม่มีร่องรอย**

เทสต์ 4 ตัวเดิมเขียวหมด เพราะทุกตัว pump `Consumer` ที่**ยังอยู่**ตลอดเคส — **เทสต์ที่ปั้นสภาพแวดล้อมให้เข้ากับโค้ด แล้วเขียวไปตลอด** (บทเรียนเดิม: fake ที่ปรับให้ตรงกับ client)

**แก้:** ดึงของออกจาก `ref` **ก่อน `await` ทั้งหมด** (`session` กับ `repository` มีอายุเท่า container ไม่ใช่เท่า widget) แล้วห้ามแตะ `ref` อีกเลยหลังจากนั้น
· ทั้งสอง read อยู่**ใน `try`** — เข้าร้านต้องไม่ throw เพราะ lookup เบื้องหลังประกอบไม่ได้ (จอ picker ไม่ได้ใช้ org repository ทำอย่างอื่น เทสต์ของมันจึงไม่ควรต้อง wire) · เรื่อง "แอป wire ครบไหม" เป็นคำถามของ B-4 ซึ่ง pin อยู่ที่ `bootstrap_test.dart`

**เคสใหม่ ★★ "the answer still lands after the screen that asked is GONE"** — pump จอทิ้งระหว่างรอ response
· **mutation แล้ว**: เอา `ref.read` กลับไปไว้หลัง `await` ⇒ **แดงทันที** (อีก 4 เคสยังเขียว = เคสเก่าพิสูจน์เรื่องนี้ไม่ได้จริง ๆ)

mobile **435 เขียว** · analyze/boundary สะอาด
