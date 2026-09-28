# [F-003] Task Board
> เจ้าของ task update status ของตัวเอง (`todo→in_progress→done`) + ลงชื่อ updated_by
> PM ดูบอร์ด → dispatch task ที่ deps=done ครบ · ดู [WEB_TEAM.md](../../../WEB_TEAM.md)

> **รูปแบบ:** table แยก section ต่อทีม · 1 แถว = 1 task
> **★** = task แตะ money/stock/auth/token/tenant-isolation/concurrency → dispatch **opus** +
> `security-reviewer` บังคับก่อน merge (WEB_TEAM §3.4/§3.6) · `ref` = ทั้งหมดที่ subagent ต้องอ่าน
> **sizing:** 1 task ≈ ครึ่งวัน / diff ~≤400 บรรทัด — ใหญ่กว่า = แตกก่อน dispatch ·
> ปิด task ได้เมื่อมี **runnable proof** (คำสั่ง+output) และ PM รันซ้ำแล้ว (WEB_TEAM §3.6 Build discipline)
> **ref ชี้เป็น `ไฟล์ §section`** ไม่ใช่ทั้งไฟล์ · รายงานกลับ = task report format ≤30 บรรทัด (WEB_TEAM §3.6)

**ย่อ:** arch = [architecture.md](architecture.md) · dm = [data-model.md](data-model.md) · api = [api-spec.md](api-spec.md) ·
ux = [ux-wireframe.md](ux-wireframe.md) · ui = [ui.md](ui.md) · tp = [test-plan.md](test-plan.md) · FC = [forward-commitments.md](../forward-commitments.md) หมวด "จาก F-003 Gate 2"
**ทุก ref รวมโดยปริยาย:** `CLAUDE.md` (+ per-app CLAUDE.md) · Gate-1 AC ที่ task อ้าง ([F-003.md](F-003.md) §2) · D-032..D-037 ที่ task อ้าง
**เทสต์ประกบ:** ID ในคอลัมน์ "เทสต์" ต้องมาใน PR เดียวกับโค้ด (tp — ตาราง "เทสต์ที่ builder ต้องส่ง") · task ★ แนบ red run ของ MUT ที่ตรงกับโค้ดจาก CI ที่ int lane รันจริง (tp §9)

## Critical path & ลำดับ

```
DV-01/02 ─┐
B03 → B04 ─┼→ B05 → B06 → B07 ─┐
QA-01 → QA-05 → B10 → B11 ─────┼→ B15 → B16 ─→ B17..B20 (route ที่ ship — ไม่อยู่หลัง flag)
QA-02 · QA-03 → DV-03/04/05 ───┤                      └→ B23 (+QA-09) → B24 → B25 → B26a/b → QA-08 → QA-10 → QA-11 → QA-12
B01 (components+codegen) ─────→ frontend W*/M* (types) · B21 → W05/M05/W06/M06 (read wiring) · B23/B24 → W06/M06 (submit wiring)
```
- **ปลดล็อก frontend เร็วสุด:** B01 (component schemas + codegen, **0 path ใหม่**) เริ่มวันแรกขนานกับ B03 · paths ของ route role ใหม่ co-commit กับ task ที่ทำ route นั้น (Q-T1)
- **prerequisite ก่อน route เขียน role แรก (B23) — arch §14:** QA-01 · QA-02 · QA-03 · QA-05 · DV-03 · DV-04 ต้อง **merge ก่อน** (ไม่ใช่ PR เดียวกัน — ให้ CI พิสูจน์ว่า gate รันจริงแยกจาก diff ของ route)
- **W4 + M4 (ย้ายคำ "สิทธิ์→บทบาท") ต้อง merge/deploy คู่กัน** (ux §0.1)

## ❓ ต้องตัดสินก่อน dispatch

| ID | คำถาม | เจ้าของ | ผูกกับ |
|---|---|---|---|
| ~~Q-T1~~ ✅ **ปิด 2026-09-28 (qa): ตัวเลือก (ง)** — B01 = components + codegen ไม่มี path · path slice ไปกับ B21 (GET×3) / B23 (POST) / B24 (PATCH) / B25 (DELETE) · field ใหม่บน route ที่ ship ไปกับ B22 (ไม่ใช่ B02) · เหตุผล: parity kit เทียบแค่ path/operation, ห้ามทำให้ gate อ่อน (ค), stub = unreachable-but-tested (ข), branch ค้างยาว (ก) | ~~parity gate (openapi-parity / route-registry) ตรวจสองทาง ⇒ B01 merge path ใหม่ก่อนมี route จริง = CI แดง · ทางเลือก (ก) FE ใช้ generated client จาก branch B01 แล้ว merge B01 พร้อม B21/B23 (ข) B01 มี controller stub (ค) parity kit มี allowlist แบบ pending ที่มีวันหมดอายุ | qa (+ backend-api) | ก่อน dispatch B01 |

## backend-api

| ID | งาน | ref → target | deps | เทสต์ | status | updated_by |
|----|-----|--------------|------|-------|--------|------------|
| T-003-B01 | contract **component schemas เท่านั้น** (`RoleDetail`/`CapabilityEntry`/`Create·UpdateRoleRequest`/`DeletedRole`/`viewer.*`) + `gen:contracts` (TS+Dart) + oasdiff · **ไม่เพิ่ม path** (Q-T1) | api §2–§3, §5 · arch Contract summary → `packages/contracts/openapi/components/**` + generated | G2✓ | oasdiff 0 breaking · contract lane | todo | — |
| T-003-B02 | `ERROR_CODES` +12 + `DomainExceptionFilter` + คำอธิบาย error/พฤติกรรม api §4.3 ใน description ของ operation เดิม (**ไม่เพิ่ม field/param** — ย้ายไป B22 ตาม Q-T1) | api §4.1–§4.3, §5 → `packages/contracts/openapi/**` · `apps/api/src/common/error-codes.ts` | G2✓ | U-API3-17 · R3-07 | todo | — |
| T-003-B03 | ★ `rbac/`: `CAPABILITY_REGISTRY` (ข้อความจาก ux §0.4 — D-037) · `expandCapabilities` · `hasCapability` ผ่าน expand · `canonicalizeCapabilities` · `lostCapabilities` + golden vectors (ไฟล์ JSON ที่ client อ่านร่วม) | arch §1 (ตาราง 4 แถวแรก + canonical/lost), §9 · dm §1 · ux §0.4 → `packages/core-domain/src/rbac/{registry,expand,canonical}.ts` | G2✓ | U-RB-01..05, 09 | todo | — |
| T-003-B04 | ★ `validateRoleCapabilities` (branded `ValidatedCapabilities`) · `validateRoleName` (NFC, ปฏิเสธ Cc/Cf) · `reservedRoleNames` | arch §1 แถว validate* · dm §2.1 → `rbac/role-validation.ts` | B03 | U-RB-06..08 | todo | — |
| T-003-B05 | ★ `decideMemberAuthority` สองแกน (target ⊊ / grant ⊆ — D-034) · wrapper `canAssignRole` · remap `decideAdminReset` + `decideAdminResetVisible` · gate G3-05 | arch §1.1, §1.2, §13.6 (unit matrix) → `rbac/member-authority.ts` · `apps/api/src/orgs/{member-authz,admin-reset-authz}.ts` | B03 | U-RB-10, 11, 14, 15, 21 · G3-01..03 (กฎ ⊆) · MUT-01..04, 06 | todo | — |
| T-003-B06 | ★ `decideRoleWrite` ลำดับ floor → locked → bypass → ⊆ → `requires_manage_members` → ⊊ (D-034 Addendum 1+2) | arch §1 แถว `decideRoleWrite`, §1.3, §13.6 ตาราง → `rbac/role-write.ts` | B05 | U-RB-12, 13 (แถว 1–21) · MUT-12, 15 | todo | — |
| T-003-B07 | ★ `OwnerChange` รูป 3/4 (`roleId` required) · `isElevatedRole` นับ `manage_roles` · TTL ใน `canAcceptInvitation` · map re-check เป็น `inviter_*` (D-035) | arch §2 (type), §6, §6.1 "ตรวจ", §13.1 matrix → `apps/api/src/orgs/{owner-invariant,invitation-policy}.ts` | B05 | U-OI-01..12 · U-RB-16, 17 | todo | — |
| T-003-B10 | ★ migration `f003_role_expand` (6+1 column · CHECK · index · trigger 4 ตัว · pre-flight · apply ซ้ำได้) + `schema.prisma` · ชี้ harness ไป migration จริง | dm §2.2, §3, §4.1, §5 · tp §4.14 → `packages/db/prisma/{schema.prisma,migrations/*_f003_role_expand}` | QA-01 · QA-05 | M3-02, 03 · I3-16 · G3-07 | todo | — |
| T-003-B11 | ★ migration `f003_backfill_manage_roles` + bridge trigger (+ แถว allowlist `removeBy` ใน G-12 ของ QA-03) + script `backfill:f003` อ่าน SQL ไฟล์เดียวกัน + `SYSTEM_ROLE_BLUEPRINT` Admin ได้ `manage_roles` | dm §4.2, §5 แถว BLUEPRINT · arch §12 (query ตรวจ rollback) → `migrations/*_f003_backfill_manage_roles` · `packages/db/src/backfill-f003.ts` · `apps/api/src/orgs/system/org-provisioning.service.ts` | B10 · B03 · QA-03 | M3-01, 04–07 · G3-10 | todo | — |
| T-003-B15 | ★ `assertOwnerRemainsInTx` → provider `OrgOwnershipGuard` · helper `LIVE_ROLE_WHERE` + ป้ายทุก call site (live/history) · `ORG_LOCK_REQUIRED_OPERATIONS` +3 · `ORG_TX_TIMEOUTS` · middleware fail-closed เมื่อ role ถูกลบ | arch §2 "input contract", §3, §8 · dm §2.2 → `apps/api/src/orgs/` · `apps/api/src/common/` · `system/org-lock-callsites.test.ts` | B07 · B10 | G3-04 · G3-11 · MUT-10 | todo | — |
| T-003-B16 | ★ SecurityEvents: event ใหม่ 6 ตัว + payload keys + dedupe Redis (fail-open) + `ESCALATION_CHECKED_OPERATIONS` (8) · union 25 | arch §7, §13.4 · tp §5.3 → `apps/api/src/auth/security-events.service.ts` | G2✓ | U-API3-10..12 · R3-01 | todo | — |
| T-003-B17 | ★ route ที่ ship: `MembersService` PATCH/DELETE ใช้ `decideMemberAuthority` (`actorIsTarget` · floor ใน tx · no-op ไม่ short-circuit) + `memberWrite` rate limit (รวม cancel invite) | arch §1.1 (ข้อยกเว้นตัวเอง), §1.2 (ค), §5, §10 · api §4.3 แถว member → `apps/api/src/orgs/members.{service,controller}.ts` | B05 · DV-02 · B15 · B16 | I3-25..30 · R3-04 (member) · MUT-05, 08 | todo | — |
| T-003-B18 | ★ **(จาก QA02)** แทน `dto.email.trim()` ใน `invitations.controller.ts` ด้วย `normalizeEmail` แล้วถอดแถวจาก `KNOWN_OFFENDERS` ของ G-11 · route ที่ ship: invite create/reissue/cancel ใช้ `decideMemberAuthority` · เขียน `issuedByUserId` ใน UPDATE เดียวกับ token · cancel role Owner = 403 · TTL นับ `manage_roles` | arch §6, §6.1 bullet แรก · api §4.3 แถว invitations/link/cancel → `apps/api/src/orgs/invitations.service.ts` | B05 · B07 · B10 · B15 · B16 | U-API3-08 · I3-20 (invite) · I3-39, I3-41 · R3-04 (invite) | todo | — |
| T-003-B19 | ★ accept re-check D-035 (+Addendum): ผู้ออกลิงก์ล่าสุด active ∧ `manage_members` ∧ ⊇ role · ยกเลิกคำเชิญใน tx เดียวกัน · `409 INVITATION_CANCELLED` ไบต์เดียวกับเดิม · event · TTL ชั้น 2 | arch §6.1, §13.7 → `invitations.service.ts` (accept) · `test/invitations-redeem.e2e.int.test.ts` | B18 | U-API3-09 · I3-38 a–k · I3-40 · I3-43 · MUT-09 | todo | — |
| T-003-B20 | ★ admin-reset: ลำดับล็อก User → Membership FOR SHARE → Role FOR SHARE + remap ⊊ + event `admin_reset_blocked_privilege` · 404 รูปเดิมทุกไบต์ (+Content-Length) | arch §3 แถว admin-reset, §13.5 SR-05 · api §6 → `apps/api/src/auth/*admin-reset*` | B05 · B16 | I3-35..37 · IC3-02 · MUT-13 | todo | — |
| T-003-B21 | ★ route อ่าน: `GET /capabilities` · `/role-details` · `/roles/{id}` (`usage` · `lastEdited.by` ผ่าน ORG_PRISMA · `viewer.*` จาก `decideRoleWrite` + `writes_disabled`) + `ROUTE_CAPABILITIES` · **+ paths GET×3 ใน OpenAPI + regen + oasdiff (Q-T1)** | api §1 (GET 3 เส้น), §3 · arch §9, §10 แถว role-details, §13.5 SR-09 → `apps/api/src/orgs/roles.controller.ts` · `role-read.service.ts` | B01 · B06 · DV-01 · B15 | I3-12, 13, 53 · I3-57 | todo | — |
| T-003-B22 | ★ field ใหม่บน route ที่ ship: `RoleRow.viewerCanAssign`/`nameCustomized` · verdict `MemberRow`/`Invitation` (ใครเห็น — arch §1.2) · `roleNameCustomized` ×6 · filter `?roleId` · **+ field/param เหล่านี้ใน OpenAPI + regen (ย้ายมาจาก B02 — Q-T1)** | api §3.1, §4.1–§4.2b · arch §1.2 → `apps/api/src/orgs/{roles,members,invitations}.service.ts` · `member-view.ts` | B02 · B05 · B15 | U-API3-16 · I3-22, 23, 54 | todo | — |
| T-003-B23 | ★ **(จาก review DV01 — Medium)** อ่าน flag จาก snapshot ตอน boot ผ่าน DI token `ROLE_WRITES_ENABLED` (ส่งจาก `main.ts`) ห้าม `loadEnv(process.env)` ซ้ำใน `useFactory`/ต่อ request + เทสต์ว่าแก้ `process.env` หลัง boot ไม่มีผล · `RolesService.create` + `POST /roles` + `@RoleWrite`/`ROLE_WRITE_ROUTES` + `RoleWritesEnabledGuard` (หลัง CapabilityGuard) + seam `ROLE_WRITE_DECIDER` + `roleWrite` rate limit + **ปลด G-15 แทนด้วย G3-01..03** · **co-commit QA-09** · ⚠ ~450 บรรทัด: ถ้าเกิน แตกเป็น "guard+flag+decorator+G3" กับ "create" แต่ merge เป็นชุดเดียว · **+ path POST ใน OpenAPI + regen + oasdiff (Q-T1)** | arch §12 "ผล", §13.2, §13.8 · api §1, §2 → `apps/api/src/orgs/roles.{service,controller}.ts` · `apps/api/src/common/authz/` | B01 · B02 · B04 · B06 · DV-01 · DV-02 · B15 · B16 · **QA-01 QA-02 QA-03 QA-05 DV-03 DV-04 merged** | I3-01..05, 17, 44, 45 · R3-02 · G3-12 · MUT-07, 11 | todo | — |
| T-003-B24 | ★ `RolesService.update` ขั้น 1–8 (4b no-op · `version` → 409 · clamp คำเชิญ · `lastEdited` · `nameCustomized`) + PATCH · **+ path PATCH ใน OpenAPI + regen + oasdiff (Q-T1)** | arch §2 ลำดับ update, §4, §6 ชั้น 1, §13.1 spy → `roles.service.ts` | B23 · B07 | U-API3-01 (update), 03–07 · I3-06..08, 14, 15, 42 · MUT-14, 16 | todo | — |
| T-003-B25 | ★ `RolesService.delete` (soft-delete · ลำดับ `ROLE_HELD…` → `TARGET…` → `IN_USE` → `HISTORY_LIMIT`) + DELETE · **+ path DELETE ใน OpenAPI + regen + oasdiff (Q-T1)** | arch §2 ย่อหน้า delete, §1.3 DELETE · dm §2.2 เงื่อนไขลบ → `roles.service.ts` | B23 | U-API3-01 (delete) · I3-09..11 · MUT-17, 18 | todo | — |
| T-003-B26a | ★ int D-034 Addendum: D034-R01..R21 + ลำดับโจมตี I3-32 + ลำดับร่วมมือ 2 คน I3-33 + verdict I3-34 + I3-56 ส่วน 2 (route F-003) | arch §13.6 (ตาราง + ลำดับโจมตี/ร่วมมือ) · tp §4.5 → `apps/api/test/f003-role-writes.int.test.ts` | B24 · B25 · B17 | (ตัว task คือเทสต์) | todo | — |
| T-003-B26b | ★ int concurrency IC3-01, 03..08 (barrier จริง สองทิศ — ห้าม sleep) + I3-49 sweep 15 ช่อง + I3-48/51 events | arch §3, §1.3 race, §13.8 · tp §4.10, §4.13 → `apps/api/test/f003-concurrency.int.test.ts` | B24 · B25 · B17 · B19 | (ตัว task คือเทสต์) | todo | — |

> ตัดออกจากข้อเสนอเดิม (กันเจ้าของซ้อน): B08 lemma → **QA-07** (กัน "model เห็นด้วยกับตัวเอง") · B09 config → **DV-01/02** · B12 G-12 → **QA-03** · B13 I-45 int ส่วน 1 → **QA-01** · B14 → **QA-02/DV-04** · R3-03 (seed kit) ย้ายจาก B10 → **QA-01** (merge ก่อน migration — ใส่ caps ไม่ว่างไม่กระทบ F-002)

## qa

| ID | งาน | ref → target | deps | status | updated_by |
|----|-----|--------------|------|--------|------------|
| T-003-QA01 | ★ **R3-03** seed kit `custom-role-null-key` ให้ caps ไม่ว่าง + ไล่ทุก scenario ว่าไม่มี non-system ถือ `full_access` · **I3-56 ส่วน 1 (I-45 int):** สลับ key Staff↔Owner + `key=null` บน DB จริง ยิงชุด Owner-only ของ F-002 ทั้งหมด + control | tp §8.1 R3-03, §4.12 I3-56 · F-002/test-plan.md แถว I-45 → `apps/api/test/f002-seed.kit.ts` · `apps/api/test/role-key-authority.int.test.ts` | G2✓ · **ก่อน B10** | todo | — |
| T-003-QA02 | **G-06 · G-09 · G-11** เป็น gate จริง · fixture แดงต่อตัว · self-check สองทาง · non-vacuity · G-09 ครอบ `package.json` + import | tp §5.2 · F-002/test-plan.md แถว G-05/06/09/11 → `apps/api/test/static-gates/` + `__gate_fixtures__/` | G2✓ | todo | — |
| T-003-QA03 | ★ **G-12** TS 5 รูป · Dart 2 รูป · SQL `CREATE FUNCTION … $$…$$` ใน migrations · allowlist รายไฟล์ + `removeBy` + clock seam · fixture 9 รูป · non-vacuity | tp §5.2 G-12 · arch §14 · F-002/test-plan.md แถว G-12 → `apps/api/test/static-gates/role-key-authority.gate.test.ts` | G2✓ | todo | — |
| T-003-QA05 | ★ **migration-fail harness + M3-01:** migrate ถึง `20260807000000_f002_role_org_composite_fk` → seed ร้าน Owner=0 → apply ถัดไป → exit ≠ 0 + stderr `f003_owner_invariant_violation org=<id>` + control · พิสูจน์ด้วย migration fixture ที่ RAISE ก่อน · helper notice handler (M3-04) | tp §4.14 M3-01 · arch §13.1 → `packages/db/test/migration-harness.ts` · `packages/db/test/f003-owner-invariant.int.test.ts` | G2✓ (lane: DV-03) | todo | — |
| T-003-QA06 | seed kit F-003: `createCustomRole` · `softDeleteRole` · `setRoleVersion` · `setLastEdited` · `createInvitation({issuedByUserId})` · `setInvitationExpiry` · scenario `f003-personas` ร้าน A/B ครบ persona · ใช้ `SYSTEM_ROLE_BLUEPRINT`/`validateRoleCapabilities` ตัวจริง + kit test | tp §7, §0 persona → `apps/api/test/f003-seed.kit.ts` + `.int.test.ts` | B03 · B04 · B10 | todo | — |
| T-003-QA07 | ★ **lemma U-RB-18/19/20:** property single-step ทุก state × ทุก op · control c1–c4 แดง + assert รูปตัวอย่างค้าน · BFS 2 actor ลึก 4 · non-vacuity · import fn จริงเท่านั้น | tp §2.4 · arch §1.3 "เหตุผลเชิงรูปแบบ", §13.6 lemma → `packages/core-domain/src/rbac/authority-lemma.test.ts` | B05 · B06 · B07 | todo | — |
| T-003-QA08 | ★ int sweep ข้ามทุก route: I3-52 (leak kit enumerate จาก `ROUTE_CAPABILITIES` ≥6 route) · I3-57 (GET 0 event + non-vacuity + control) · I3-50 (สแกนอีเมลใน payload) · I3-56 ส่วน 2 · ⚠ ~400: แยก I3-56(2) ถ้าเกิน | tp §4.10–§4.12 → `apps/api/test/org-leak.kit.ts` · `apps/api/test/f003-sweeps.int.test.ts` | QA-06 · B21 · B23 · B24 · B25 | todo | — |
| T-003-QA09 | **G3-12 + R3-02 + G3-14:** ย้ายทะเบียน NEW-10 จาก G-15 ไปเทสต์จริง · SR-F003-01..19 (SR-15 = `noTest`) · marker smoke/full · G3-14 เทียบ fixture client (web+Flutter) กับ response I3-22/I3-13 | tp §5.2 G3-12/G3-14, §6 ข้อ 3, §8 → `apps/api/test/regression-pack.ts` | **co-commit ใน PR ของ B23** (G3-14 ตามหลัง B22) | todo | — |
| T-003-QA10 | ★ red run ครบ 18 จุด (MUT-01..18) บน branch รวม ใน CI ที่ int lane รันจริง · MUT ที่เทสต์ไม่แดง = defect ส่งกลับเจ้าของ · (~1 วัน — แตก unit MUT-01..04,06,12,15 / int ที่เหลือ ตอน dispatch) | tp §9, §15 ข้อ 3 → QA report | build ★ ครบทุกตัว | todo | — |
| T-003-QA11 | manual MAN3-01..07 + Track 2 T2-01..03 (copy กับ ux · ยิงแก้ request ตรง 8 op + accept + reset · review timing 404 · rehearsal flag ปิดบน staging · `backfill:f003` = 0 แถว · screen reader · persona SME 3 flow) · (~1 วัน) | tp §12, §13 · WEB_TEAM §3.7 → QA report | E2E เขียว (W*/M*) · staging (devops) | todo | — |
| T-003-QA12 | verdict Gate E ของ F-003 (tp §15 ข้อ 1–6 · ตาราง AC §1 ทุกแถว รวมหลักฐานทดแทน AC-8.2/9.7 · smoke ไม่ถูก skip) · **verdict เปิด `ROLE_WRITES_ENABLED` แยกฉบับ** (tp §6 ข้อ 5) | tp §15, §6 ข้อ 5 · arch §14 → QA report | QA-10 · QA-11 · security-reviewer pass | todo | — |

## devops

| ID | งาน | ref → target | deps | status | updated_by |
|----|-----|--------------|------|--------|------------|
| T-003-DV01 | ★ env `ROLE_WRITES_ENABLED` (boolean, default `false`, ตรงตัว `"true"` เท่านั้น, อ่านครั้งเดียวตอน boot) + `.env.example` (comment ความรุนแรงของการเปิด) · เทสต์ U-CFG3-01 | arch §12 → `packages/config/src/env.ts` · `.env.example` | G2✓ | todo | — |
| T-003-DV02 | config `MAX_ROLES_PER_ORG=30` · `MAX_DELETED_ROLES_PER_ORG=500` · rate limit `roleWrite` 60/ชม. · `memberWrite` 120/ชม. (pattern `ORG_RATE_LIMIT_DEFAULTS`) · เทสต์ U-CFG3-02/03 | arch §10 → `packages/config/src/{env,org-policy}.ts` · `.env.example` | G2✓ | todo | — |
| T-003-DV03 | CI lane รัน migration-fail harness (QA-05) บน ephemeral Postgres + `assert-tests-ran --require` floor ของไฟล์นี้ | dm §4.2/§4.4 · tp §4.14 → `.github/workflows/ci.yml` (job `db-migrate`) | QA-05 | todo | — |
| T-003-DV04 | **G3-13:** ผูก G-06/09/11/12 + I3-56 (QA-01) เข้า `--require` ของ `node-ci`/`integration-api` · นับเคส > 0 จาก JSON report · พิสูจน์ว่าลบไฟล์แล้ว job แดง · ขยับ `--min-passed` (qa กำหนดตัวเลข) · floor ไฟล์ int F-003 ถัด ๆ ไปขยับตาม PR ของ builder | tp §5.2 G3-13, §6 ข้อ 1–2 · WEB_TEAM §3.7 → `.github/workflows/ci.yml` · `tool/ci/assert-tests-ran.mjs` | QA-01 · QA-02 · QA-03 | todo | — |
| T-003-DV05 | CI scan `packages/db/prisma/migrations/**/migration.sql` เทียบชุด `\p{Cc}\p{Cf}` ของ Node runtime แบบ set-equal (G3-07) + เตือนเมื่อ `.nvmrc` เปลี่ยน | tp §5.2 G3-07 → `.github/workflows/ci.yml` | B10 | todo | — |
| T-003-DV06 | runbook ร่าง: query ตรวจก่อน rollback + "ปิด flag ด่วน = restart" | arch §12 (ตาราง rollback) → `docs/features/F-003/runbook.md` | G2✓ | todo | — |

## frontend — web (`apps/web`)

| ID | งาน | ref → target | deps | เทสต์ | status | updated_by |
|----|-----|--------------|------|-------|--------|------------|
| T-003-W01 | ★ แก้ `apps/web/CLAUDE.md` ("web พักไว้" → ปกติ — FC) · const `manage_roles` · `RouteGuard`/`FeatureGate` gate-by-capability ใช้ `ForbiddenPanel` เดิม (skill `client-security`) | FC แถว apps/web/CLAUDE.md · ux §0 (ForbiddenPanel) · `docs/architecture/web.md` §3.3 → `apps/web/CLAUDE.md` · `apps/web/src/lib/org/capability.ts` | G2✓ · **ก่อน W05–W11 ทุกตัว** | unit guard | todo | — |
| T-003-W02 | component กลาง `Checkbox`+`CheckboxRow` · `Disclosure` · `StickyActionBar` (token `size.checkbox`/`radius.checkbox`/`checkbox.border.w` — ไม่มี hex ใหม่ · ไม่ใช้ opacity) | ui §2 · design-system §1.3, §9.1 → `apps/web/src/components/ui/` | G2✓ | component tests | todo | — |
| T-003-W03 | reason→copy กลาง (ux §0.3 ก+ข) + i18n R1–R5/R8/R9 (ไม่แก้ของเดิม · ไม่ hardcode ป้ายสิทธิ์ — มาจาก `GET /capabilities`) | ux §0.2, §0.3, §E → `apps/web/src/features/org/role-copy.ts` · `i18n.ts` | G2✓ | CW3 copy-lint | todo | — |
| T-003-W04 | ย้ายคำ "สิทธิ์→บทบาท" ตาราง ux §0.1 (`membersTh`, `CHANGE_ROLE_COPY`, `inviteFormTh`, `invitationConfirmTh`, `/invite`) — แก้ค่า ไม่แก้ key + copy-lint pattern ใหม่ | ux §0.1 → `apps/web/src/features/org/i18n.ts` · `apps/web/src/app/invite/*` | **merge/deploy คู่ M04** | G3-08 · R3-06 | todo | — |
| T-003-W05 | R1 รายการบทบาท (`/o/[orgId]/settings/roles`) + R2 dialog เลือกต้นแบบ + sidebar "บทบาทและสิทธิ์" (`icon.roles`, gate `manage_roles`) · **+ static copy ของจอนี้ใน i18n (ย้ายมาจาก W03)** | ux R1, R2 · ui §1, §5 → `apps/web/src/app/o/[orgId]/settings/roles/` · `features/org/roles/` | W01 · W02 · W03 · B01 · B21 | CW3 · EW3 (R1/R2) | todo | — |
| T-003-W06 | R3 ฟอร์มบทบาท 3 โหมด (สร้าง/สำเนา/แก้) + `CapabilityChecklist` (imply-lock, upcoming, disabled+เหตุผล — UX เท่านั้น server ตัดสิน) + dirty-guard · ส่ง `name` เฉพาะเมื่อแก้จริง (ux R3 ⚠️) · **+ static copy ของจอนี้ใน i18n (ย้ายมาจาก W03)** | ux R3 · ui §3 → `features/org/roles/` | W02 · W03 · B01 · B21 · B23 · B24 (submit wiring) | CW3 · EW3 (R3) | todo | — |
| T-003-W07 | R3a ยืนยันก่อนบันทึก (diff + `lostCapabilities` จาก `@omnistock/core-domain` + impact) + R3b `409 ROLE_CHANGED` (refetch + banner — ห้าม resubmit อัตโนมัติ SR-14) | ux R3a, R3b · api §2 → `features/org/roles/` | W06 · B03 | CW3-01 (golden vectors) · mutation เรียก 1 ครั้ง | todo | — |
| T-003-W08 | R4 ดูอย่างเดียว — `CapabilityReadList` + `RoleReasonBanner` ทุก reason + fallback ค่าไม่รู้จัก · **+ static copy ของจอนี้ใน i18n (ย้ายมาจาก W03)** | ux R4, §0.3 · ui §3 → `features/org/roles/` | W06 | CW3 · EW3 (R4) | todo | — |
| T-003-W09 | R5 ลบบทบาท — dialog + variant `ROLE_IN_USE`/`ROLE_HISTORY_LIMIT_REACHED` + ลิงก์ไป R6 · **+ static copy ของจอนี้ใน i18n (ย้ายมาจาก W03)** | ux R5 → `features/org/roles/` | W06 · W08 | CW3 · EW3 (R5) | todo | — |
| T-003-W10 | ★ R6 กรอง `?roleId=` บนจอสมาชิก/คำเชิญ + R7 verdict ต่อแถว (`viewerCanManage`/`manageBlockedReason` · `Invitation.viewerCanManage`) — **verdict ชนะ caps ในเครื่องทั้งสองทิศ** · field ไม่มี → fallback F-002 | ux R6, R7 · api §3.1, §4.2b → `apps/web/src/features/org/MembersScreen.tsx` | W03 · W04 · B02 · B22 | CW3-03 · EW3 (R6/R7) | todo | — |
| T-003-W11 | R8 ตัวเลือกบทบาทใน `InviteDialog`/`ChangeRoleDialog` (server-driven `GET /roles` · custom role · disabled+เหตุผล ไม่ซ่อน) + R9 `/invite` คำเชิญถูกยกเลิก (D-035) | ux R8, R9 → `apps/web/src/features/org/` · `app/invite/*` | W03 · W04 · B02 · B22 · B19 | CW3 · EW3 (R8/R9) | todo | — |

## frontend — mobile (`apps/mobile`)

| ID | งาน | ref → target | deps | เทสต์ | status | updated_by |
|----|-----|--------------|------|-------|--------|------------|
| T-003-M01 | ★ const `manage_roles` + guard helper entry point/screen (`can()` ต่อยอด — skill `client-security`) | `docs/mobile-architecture.md` §3.3 · FC → `apps/mobile/lib/core/session/capabilities.dart` | G2✓ | unit | todo | — |
| T-003-M02 | widget กลาง `CheckboxRow` · `Disclosure` · `StickyActionBar` (bottom sheet ใช้ native) | ui §2, §5 · design-system §9.1 → `apps/mobile/lib/core/ui/` | G2✓ | widget tests | todo | — |
| T-003-M03 | reason→copy (ux §0.3) + `app_th.arb` R1–R9 (ไม่รวม R10 error table) | ux §0.2, §0.3, §E → `apps/mobile/lib/features/org/` · `apps/mobile/lib/l10n/app_th.arb` | G2✓ | CM3 copy | todo | — |
| T-003-M04 | ย้ายคำ "สิทธิ์→บทบาท" arb keys ตาราง ux §0.1 + **ลบ** `inviteRoleAdminDesc`/`inviteRoleStaffDesc` | ux §0.1 → `app_th.arb` | **merge/deploy คู่ W04** | copy-lint arb เทียบ web | todo | — |
| T-003-M05 | R1 รายการบทบาท (push) + R2 เลือกต้นแบบ (push เต็มจอ) + entry "ข้อมูลร้าน" row + ปุ่ม tertiary บนจอสมาชิก (gate `manage_roles`) | ux R1, R2 · ui §5 → `apps/mobile/lib/features/org/` | M01 · M02 · M03 · B01 · B21 | CM3 · EM3 (R1/R2) | todo | — |
| T-003-M06 | R3 ฟอร์มบทบาท 3 โหมด — checklist `Disclosure` พับกลุ่มได้ (เปิดทุกกลุ่มตั้งต้น) | ux R3 · ui §3, §5 → `features/org/` | M02 · M03 · B01 · B21 · B23 · B24 (submit wiring) | CM3 · EM3 (R3) | todo | — |
| T-003-M07 | R3a + R3b + **port `lostCapabilities` เป็น pure Dart** เทสต์กับไฟล์ golden-vector เดียวกับ server (อ่านไฟล์ ไม่ก็อปค่า) | ux R3a, R3b · tp CM3-01, U-RB-09 → `features/org/domain/` | M06 · B03 | CM3-01 | todo | — |
| T-003-M08 | R4 ดูอย่างเดียว + R5 ลบบทบาท (dialog + variant ยังมีคนใช้) | ux R4, R5 → `features/org/` | M06 · M07 | CM3 · EM3 (R4/R5) | todo | — |
| T-003-M09 | R8 ตัวเลือกบทบาทในจอเชิญ — server-driven `GET /roles` · ลบคำอธิบาย hardcode admin/staff · คง owner desc | ux R8 · api §3.1 → `features/org/.../invite_member_screen.dart` | M03 · M04 · B02 · B22 | CM3 · EM3 (R8) | todo | — |
| T-003-M10 | ★ R6 กรองตามบทบาท + R7 verdict แถวสมาชิก (ทั้งสองทิศเหมือน W10) — คำเชิญไม่มี action (F-002b) | ux R6, R7 → `features/org/.../members_screen.dart` | M03 · M04 · B02 · B22 | CM3-03 · EM3 (R6/R7) | todo | — |
| T-003-M11 | ★ R10 bottom sheet เปลี่ยนบทบาทรายคน (แถวที่ล็อก**ไม่มีทางเปิด sheet**) · no-op guard · ล็อกระหว่างส่ง + R10a ยืนยันเปลี่ยนตัวเอง · error mapping ตาราง (ค) ครบ 9 code | ux R10 · tp CM3-08, EM3-08..11 → `features/org/` | M09 · M10 · M01 | CM3-08 · EM3-08..11 | todo | — |

## ux

| ID | งาน | ref → target | deps | status | updated_by |
|----|-----|--------------|------|--------|------------|
| T-003-UX01 | review ข้อความใน `rbac/registry.ts` (D-037 — ux เป็นเจ้าของ) + copy-lint ครอบไฟล์นั้น · review copy W03/M03/W04/M04 เทียบ ux §0 | ux §0.1–§0.4, §E → review ใน PR ของ B03 · W03 · M03 · W04 · M04 | B03 · W03 · M03 | todo | — |
| T-003-UX02 | Claude Design sync (`/design-sync`) ของ `Checkbox`/`CheckboxRow`/`Disclosure`/`StickyActionBar` (§9.1 เท่านั้น) | ui §7 · design-system §9.1 → Claude Design | W02 · M02 | todo | — |

## Batch B — trigger-bound (ไม่ใช่ task ตอนนี้ · ลงทะเบียนใน FC แล้ว)

| งาน | เจ้าของ | TRIGGER |
|---|---|---|
| เปิด `ROLE_WRITES_ENABLED=true` ต่อ environment + image digest ว่าไม่มี instance F-002 เหลือ + G-06/09/11/12 + I3-56 อยู่ใน commit ที่ deploy และรันจริง · release notes ห้ามประกาศ D-034/D-035 ก่อนนั้น | devops (+ release · verdict จาก QA-12) | F-003 deploy ครบทุก instance/region |
| ถอด bridge trigger `role_f003_admin_bridge` | backend-api | migration ถัดไปหลังเปิด flag (G-12 `removeBy` บังคับ) |
| ถอด flag ออกจากโค้ด | backend-api (devops ยืนยัน) | feature ถัดไปที่แตะ `Role` หลังเปิดครบทุก env |
| เลือก deploy strategy rolling vs stop-start | devops | ตั้ง production deploy pipeline ครั้งแรก |

## Model / review ต่อ task (WEB_TEAM §3.6)
- **★** → dispatch **opus** · `security-reviewer` เต็มรูปแบบก่อน merge (ถ้า fable ชน spend limit → opus override แล้วจด RETRO) · frontend ★ ใช้ skill `client-security`
- ไม่ ★ (B01/B02 contract · W02–W09 · M02–M09 · DV02–DV06 · QA02/06/09/11/12 · UX*) → model ที่ agent pin · review medium (contract) / low (UI/copy)
- reviewer ได้ **diff + AC + spec เท่านั้น** ไม่ได้ self-summary ของ builder
