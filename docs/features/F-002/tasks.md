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
| T-002-D2 | ค่าจริงของ env per-environment: `DEFAULT_ORG_PLAN_KEY` (dogfood = `comp_full`) · `INVITATION_TOKEN_SECRET` · `WEB_APP_BASE_URL` · **log scrubbing: ห้าม log query string ของ `/invitations/*`** | `architecture.md §6.2/§7.3` · `api-spec.md §1` | T-002-06 | todo | — |

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
| T-002-W5 | ★ จอ: สมาชิก (S6) + เชิญ (S7) + **แผ่นลิงก์แสดงครั้งเดียว (S8)** — ปุ่ม **"ออกลิงก์ใหม่"** + เตือนก่อนกด · **ห้าม hardcode "7 วัน"** ใช้ `expiresAt` · token เก็บใน memory เท่านั้น | `ux-wireframe.md §7–9` · D-027 | T-002-W3 | todo | — |
| T-002-W6 | จอ: เปลี่ยนสิทธิ์ (S9) · ถอด/ออกจากร้าน (S10) · **`/invite` (S11) — ต้องดีบนเบราว์เซอร์มือถือ ~390px** · 403 สองแบบ (S12) · **ถอด token ออกจาก URL ด้วย `history.replaceState` ทันที** (I-6) | `ux-wireframe.md §10–12` | T-002-W5 | todo | — |

## frontend — mobile (Flutter)

| ID | งาน | ref → target | deps | status | updated_by |
|----|-----|--------------|------|--------|------------|
| T-002-M1 | ★ `core/session` + `orgDioProvider` + **`X-Organization-Id` เข้า interceptor chain** (seam comment วางไว้แล้ว) | `docs/architecture/mobile.md §3.2` · forward-commitments แถว F-002/F-003 | T-002-21, T-002-X1 | todo | — |
| T-002-M2 | ★ `ApiFailure` mobile: แยก `ORG_ACCESS_DENIED` / `FORBIDDEN` + `409 busy` (กติกาเดียวกับ web) | `mobile.md §3.4` · `api-spec.md §4` | T-002-M1 | todo | — |
| T-002-M3 | จอมือถือ: เลือกร้าน · สร้างร้าน · ตัวสลับร้านใน AppBar · สมาชิก (อ่าน+เชิญพื้นฐาน) · `/invite` deep link | `ux-wireframe.md §13` (ความต่าง web↔mobile) | T-002-M2 | todo | — |

## qa

| ID | งาน | ref → target | deps | status | updated_by |
|----|-----|--------------|------|--------|------------|
| T-002-Q1 | unit lane: core-domain (12) · packages/db (10 — รวม **M-9 `upsert` แถวต่อแถว**, `USER_SELECT` freeze, nested read "ลงกลับ") · config (6) | `test-plan.md §5–7` | T-002-02, T-002-08 | todo | — |
| T-002-Q2 | ★ int lane บังคับ: **cross-org leak × 4 persona** · **route-registry capability (รวม `GET`)** · assertion กลาง `passwordHash`/`tokenHash` · **hash-at-rest พิสูจน์ได้** | `test-plan.md §8` | T-002-22 | todo | — |
| T-002-Q3 | ★ concurrency 13 เคส: Owner คนสุดท้าย 2 ขนาน ×20 รอบ · accept ซ้ำ · invite ซ้ำ · **revoke‖accept** · reissue‖accept · cancel‖accept · PATCH‖DELETE · ยก Owner 2 คนพร้อมกัน · cap 49 · revoke‖revoke · **lock timeout → 409 ไม่ใช่ 500 · ห้าม 40P01/40001 หลุด wire** | `test-plan.md §8` · `architecture.md §5.2` | T-002-03, T-002-22 | todo | — |
| T-002-Q4 | ★ regression ของ finding: **NEW-1 (Admin→Owner reset = 404 + รหัสเดิมยัง login ได้ + เคสควบคุม)** · C-1 · C-2 · I-1 · NEW-2 · **I-45 สลับ `Role.key` ใน DB แล้วสิทธิ์ต้องไม่ขยับ** · เข้า **smoke tier ถาวร** | `test-plan.md §9` (ทะเบียน 41 finding) | T-002-09, T-002-22 | todo | — |
| T-002-Q5 | E2E + manual: flow เชิญ→รับ **3 ทางแยกของ US-4** · org switcher · ถูกถอดกลางคัน · Staff เจอ 403 แล้ว UI ทำถูก | `test-plan.md §10` · `ux-wireframe.md §11` | T-002-W6, T-002-M3 | todo | — |
| T-002-Q6 | perf smoke: member list 200 คน · `/me/organizations` 50 org · overhead membership lookup < 5 ms | `test-plan.md` · `architecture.md §10` | T-002-18 | todo | — |
| T-002-Q7 | Track 2 (agentic, **ไม่บล็อก merge**): 7 flow persona SME ไทย — คุ้มสุด: **"ออกลิงก์ใหม่"** (ผู้ใช้เข้าใจไหมว่าลิงก์เดิมตาย) และ **404 ของ admin-reset** | `test-plan.md` · WEB_TEAM §3.7 | T-002-Q5 | todo | — |

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
