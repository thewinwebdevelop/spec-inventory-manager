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
| T-002-03 | ★ `lockCurrentOrganization` + **`SET LOCAL lock_timeout`** + `ORG_TX_TIMEOUTS` + แมป `55P03`/`40P01`/`P2028`/pool-timeout → **`409` + `details.reason='busy'` (ห้าม 500)** + export `ORG_LOCK_REQUIRED_OPERATIONS` (7 รายการ) | `architecture.md §5.1/§5.2` · `§15 แถว 6b` → `packages/db/src/org-lock.ts` | T-002-01 | todo | — |
| T-002-04 | ★ `OrgContextMiddleware` (ALS) + `OrgScopeGuard` **default-deny** + `req.orgAuth` (ห้ามพึ่ง `req.user` — I-4) + **ไม่สร้าง context บน `@UserScoped()`/`@Public()`** (I-3) | `architecture.md §1.1–1.4` · `§15 แถว 5` → `apps/api/src/tenancy/` | T-002-02 | todo | — |
| T-002-05 | ★ `CapabilityGuard` **fail-closed ครอบ org-scoped route ทุก method รวม `GET`** (NEW-3) + `ROUTE_CAPABILITIES` + `ANY_ACTIVE_MEMBER_ROUTES` แยก 2 tier | `architecture.md §3.1` · `§15 แถว 5b` → `apps/api/src/common/authz/` | T-002-04 | todo | — |
| T-002-06 | env ใหม่เข้า zod schema (`INVITATION_TOKEN_SECRET` min32 + ต่างจาก JWT ทั้งสอง · `WEB_APP_BASE_URL` url+https · `DEFAULT_ORG_PLAN_KEY` · `MAX_ORGS_PER_USER=50` · `ORG_TX_TIMEOUTS`) + export `ORG_RATE_LIMIT_DEFAULTS` | `architecture.md §6.4` · `§15 แถว 8` → `packages/config/src/env.ts` | — | done | devops |
| T-002-07 | seed `PlanDefinition` 4 แถว (idempotent by `key`) — **ไม่มี = `POST /organizations` 503 ทุกเคส** | `data-model.md §5.1` → `packages/db/prisma/seed.ts` | T-002-01 | done | backend-api |
| T-002-08 | pure fn ใน core-domain + test matrix: `owner-invariant` · **`canAssignRole`** (Owner-only D-028) · `thai-tax-id` (13 หลัก+checksum) · `invitation-status` · `maskEmail` | `data-model.md §6` → `packages/core-domain/src/orgs/` | — | done | backend-api |
| T-002-08b | pure fn ที่ตกหล่นจากรอบแรก (**PM เขียน tasks.md ตกเอง — data-model §6 มี 7 ไฟล์ ไม่ใช่ 5**): `invitation-policy.ts` (`invitationTtlHours` 24ชม./7วัน · `canAcceptInvitation`) · `tax-id-mask.ts` (`maskTaxId`) | `data-model.md §6` → `packages/core-domain/src/orgs/` | T-002-08 | done | backend-api |

## backend-api — แก้โค้ดที่ ship แล้ว (★ ทุกใบ · red→green บังคับ)

| ID | งาน | ref → target | deps | status | updated_by |
|----|-----|--------------|------|--------|------------|
| T-002-09 | ★⚠️ **`adminResetPassword` — งานใบเดียว 2 เงื่อนไข** (ก) C-2 ปฏิเสธเมื่อ target active ใน org อื่น (ข) **NEW-1/D-030** ปฏิเสธเมื่อ target เป็น Owner และผู้เรียกไม่มี `full_access` (ค) NEW-5(ก) ทั้งบล็อกใน **tx เดียว** (`User` `FOR UPDATE` → นับ → ตรวจ → เขียน → นับซ้ำ) · **คืน 404 รูปเดิม ทุกสาเหตุ byte-identical** | `architecture.md §3.3` · `§15 แถว 1` → `apps/api/src/auth/auth.service.ts` | T-002-08 | todo | — |
| T-002-10 | ★⚠️ `traceId` ทุก error · **UUID v4 opaque** (ห้าม counter/timestamp) · server ออกเสมอ · `X-Request-Id` **ไม่ใช่การสะท้อนค่าจาก client** · **เทสต์เดิม 3 เคสต้องกลับด้าน** (ห้าม skip/ลบ) | `architecture.md §15 แถว 2` → `apps/api/src/common/domain-exception.filter.ts` | — | todo | — |
| T-002-11 | ★ `client-ip.ts` (ยุบ IPv6 เป็น **/64**) + ให้ `throttle.service.ts` ใช้ helper เดียวกัน — ของเดิม rate-limit ต่อ IP ไร้ผลกับ IPv6 | `architecture.md §15 แถว 3` → `apps/api/src/common/` + `auth/throttle.service.ts` | — | todo | — |
| T-002-12 | ★ ขยาย `SecurityEventType` union **15 ค่า** (รวม `org.member.left`, `org.tax_profile.revealed`, `auth.password.admin_reset_blocked_owner_target`) · **ไม่รื้อ transport** (EventEmitter = test sink ที่ qa ขอ) · emit **post-commit เท่านั้น** | `architecture.md §9` · `§15 แถว 4` → `apps/api/src/auth/security-events.service.ts` | — | done | backend-api |
| T-002-13 | จัดชั้น route ของ F-001: `/auth/*` = `@Public()` · `reset-password` = `@UserScoped()` (**คง 404-never-403 + capability inline เดิม ไม่เปลี่ยน wire**) + ลงทะเบียนใน `ROUTE_CAPABILITIES` | `architecture.md §1.1` · `§15 แถว 7` → `apps/api/src/auth/*.controller.ts` | T-002-05 | todo | — |

## backend-api — endpoint ของ F-002

| ID | งาน | ref → target | deps | status | updated_by |
|----|-----|--------------|------|--------|------------|
| T-002-14 | rate-limit guard กลาง (Redis sliding window) — create org / invite / reissue / preview+accept · fail-open + emit event | `architecture.md §8` → `apps/api/src/common/org-rate-limit.guard.ts` | T-002-06, T-002-11 | todo | — |
| T-002-15 | ★ `POST /organizations` — **1 tx**: Organization + system Roles(3) + Membership(Owner) + **OrgEntitlement** + default Warehouse · plan จาก env seam (**fail closed 503** ห้าม fallback free) · **cap 50 org/user** (`409 ORG_LIMIT_REACHED`) | `api-spec.md §3.1` · `architecture.md §6` → `apps/api/src/orgs/` | T-002-03, T-002-07, T-002-14 | todo | — |
| T-002-16 | `GET /me/organizations` (cursor · `?status=all` คืนแค่ id/ชื่อ/สถานะ) + `GET /orgs/{id}` + `PATCH /orgs/{id}` (`logo` รับเฉพาะ `null` ใน Phase 0) | `api-spec.md §3.2–3.4` → `apps/api/src/orgs/` | T-002-05 | todo | — |
| T-002-17 | ★ tax profile: `PUT /orgs/{id}/tax-profile` (ครบชุดหรือว่างทั้งชุด) + **`POST /orgs/{id}/tax-profile/reveal`** (TIN เต็ม · `manage_org_settings` · rate 20/ชม. · `no-store`+`no-referrer` · emit event **ที่ไม่มีค่า TIN**) · **`GET` ไม่คืน TIN เต็มอีกแล้ว** | `api-spec.md §3.5/§3.16` · `data-model.md §3.3` | T-002-08, T-002-16 | todo | — |
| T-002-18 | ★ สมาชิก: `GET /members` (**ต้องมี `manage_members`** — PDPA) · `PATCH /members/{userId}` · `DELETE /members/{userId}` (soft revoke + **ยกเลิก pending invite ของ email นั้นใน tx เดียว**) · **`DELETE /orgs/{id}/membership`** (ออกเอง — ไม่ต้องมี `manage_members`) · ทุกเส้น **lock + re-check ใน tx** + `canAssignRole` | `api-spec.md §3.7–3.9` · `architecture.md §5` | T-002-03, T-002-08, T-002-15 | todo | — |
| T-002-19 | ★ คำเชิญ (ฝั่ง org): `POST /invitations` (hash-at-rest · TTL **24 ชม.** สำหรับ role สูง / 7 วัน ที่เหลือ · `409 INVITATION_PENDING` พก `details.invitationId`) · `GET` · `POST .../link` (**rotate + อายุนับใหม่** D-027 · **ผ่าน `canAssignRole`** NEW-2 · **DB ต้องไม่ขยับถ้า 403**) · `DELETE` | `api-spec.md §3.10–3.13` · `architecture.md §7` | T-002-06, T-002-18 | todo | — |
| T-002-20 | ★ รับคำเชิญ: **`POST /invitations/preview`** (public · token ใน **body** ไม่ใช่ query — I-6) · `POST /invitations/accept` (`409 ALREADY_MEMBER` ไม่ทับ role · `409 INVITATION_SUPERSEDED` ถ้าออกก่อนถูกถอด · ตรวจ role ยังเป็นของ org นั้น) | `api-spec.md §3.14–3.15` · `architecture.md §7.4` | T-002-19 | todo | — |
| T-002-21 | ⚠️ OpenAPI: เพิ่ม 17 endpoint + schema · **แตกไฟล์เป็น `paths/*.yaml` + `components/*.yaml` → `redocly bundle`** · regen TS + Dart client | `api-spec.md §5` · `§15 แถว 11` → `packages/contracts/` | T-002-20 | todo | — |
| T-002-22 | test kit ที่ qa เป็นผู้ใช้: `f002-seed.kit.ts` + CLI (`--scenario` · ตั้ง/สลับ `Role.key`) · `org-leak.kit.ts` (**4 persona**) · route-registry helper · assertion กลาง (PII/header/traceId/schema) · **500-fixture ที่ compile เฉพาะโปรไฟล์ test** · **meta-test ว่า kit แดงได้จริง** | `architecture.md §12.2` · `test-plan.md §19.1` → `apps/api/test/` | T-002-05 | todo | — |

## devops

| ID | งาน | ref → target | deps | status | updated_by |
|----|-----|--------------|------|--------|------------|
| T-002-D1a | ปิด build-breaker: เติม env ใหม่ 3 ตัวเข้า CI job `integration-api` + `auth.e2e.int.test.ts` (T-002-06 ทำให้เป็น required ⇒ int lane แดงถ้าไม่เติม) | `.github/workflows/ci.yml` · `apps/api/src/auth/auth.e2e.int.test.ts` | T-002-06 | done | devops |
| T-002-D1b | **ปิดกับดัก "เขียวเพราะไม่ได้รัน"**: ให้ lane `db-migrate` รัน DB-backed test จริง + `tool/ci/assert-tests-ran.mjs` (skip/หาย/ลดจำนวน = CI แดง) · แก้ `integration-api` ที่เดิมมีสาขา "ถ้ามี script ค่อยรัน" | `.github/workflows/ci.yml` · `tool/ci/` | T-002-02 | done | devops |
| T-002-D1c | เพิ่มขั้น `prisma db seed` ใน lane `integration-api` — **ไม่มี `PlanDefinition` ⇒ `POST /organizations` = 503 ทุกเคส** (architecture §12.3 ข้อ 2) | `.github/workflows/ci.yml` | T-002-07 | todo | — |
| T-002-D1 | CI job `integration-api`: เพิ่ม env ใหม่ + ขั้น **`prisma db seed`** (ไม่มี = สร้างร้านไม่ได้เลย 503 ทุกเคส) + **`connection_limit` ของ `TEST_DATABASE_URL` ≥ จำนวน request ขนานของ test-plan §8** (ไม่งั้นขนานปลอม) | `architecture.md §12.3` · `§15 แถว 13` → `.github/workflows/` | T-002-06, T-002-07 | todo | — |
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
| T-002-W1 | ★ โครง org context: `lib/org` + `lib/session` + `app/o/[orgId]/layout` + org-scoped query client + ย้าย `components/auth/*` → `features/auth/` (R6) | `docs/architecture/web.md §3.2` · forward-commitments แถว F-002/F-003 | T-002-21, T-002-X1 | todo | — |
| T-002-W2 | ★ `ApiFailure` web: **`ORG_ACCESS_DENIED` ≠ `FORBIDDEN` ห้ามรวม handler** (พากลับหน้าเลือกร้าน+refetch vs อยู่หน้าเดิม+toast) · `409` ที่มี `details.reason='busy'` = ลองใหม่ได้ · client ที่ไม่รู้จัก `reason` ต้องยังทำงานถูก | `web.md §3.4` · `api-spec.md §4` · `ux-wireframe.md §12` | T-002-W1 | todo | — |
| T-002-W3 | จอ: เลือกร้าน (S1) · สร้างร้าน (S2) · AppShell+ตัวสลับร้าน (S3) | `ux-wireframe.md §2–4` · `ui.md §3` | T-002-W2 | todo | — |
| T-002-W4 | จอ: ข้อมูลร้าน (S4) + ฟอร์มผู้เสียภาษี (S5) — **TIN เต็มมาจาก reveal เท่านั้น เก็บใน memory ห้าม persist** · Staff ไม่เห็นตัวเลขเลย | `ux-wireframe.md §5–6` | T-002-W3 | todo | — |
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
