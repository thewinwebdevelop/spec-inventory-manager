---
doc: gate-e-verdict
owner: "@qa"
signoff: pending
---
# [F-002] Gate E — verdict

> **เจ้าของเอกสารนี้ = qa** · เกณฑ์ = [test-plan.md §17](test-plan.md) + [WEB_TEAM.md §4](../../../WEB_TEAM.md) + skill `quality-gate`
> · ตัดสินบน `df37104` (HEAD ของ `claude/thai-language-output-4ea998`)
> · ตัวเลขทุกชุดในไฟล์นี้ **ผมรันเอง 2026-09-05** ไม่ได้ลอกจาก `tasks.md` / `manual-pass-results.md` / `release-gate-f.md`
>   — เอกสารพวกนั้นเป็น*หลักฐานของคนอื่น* ไฟล์นี้เป็น*คำตัดสิน* และคำตัดสินต้องยืนบนของที่ผมเห็นกับตา

---

## 0. คำตอบสั้น ๆ ก่อน (สำหรับคนที่อ่านบรรทัดเดียว)

**Gate E = ❌ NOT DONE** · ช่องแดง **1 ช่อง** และมันไม่ใช่โค้ด

| | |
|---|---|
| แดงเพราะ | **M-01** — ส่งลิงก์คำเชิญจริงทาง LINE บนมือถือจริง **ยังไม่มีใครทำ** ⇒ §17.6 ("manual §12.2 ทำครบ") ไม่ครบ |
| ต้องการอะไรถึงจะเขียว | คน 1 คน + โทรศัพท์ที่มี LINE + ~20 นาที · **ไม่ต้องแก้โค้ดแม้แต่บรรทัดเดียว** |
| **M-07ค ฝั่ง iOS บล็อกไหม** | **ไม่บล็อก** — เหตุผลเต็มอยู่ที่ §5.2 (สรุป: ไม่มี iOS release ใน Phase 0 · devops ตัดสินเป็นทางการแล้ว 2026-09-05 ให้เป็น forward-commitment ที่มี trigger ⇒ **n/a ไม่ใช่ red**) |
| defect ระดับ blocker ในโค้ด | **0** |

**ผมไม่เขียนว่า "เกือบผ่าน"** — §17 ของแผนที่ผมเขียนเองบอกว่า *"ข้อใดไม่ครบ = แดง ไม่มีเขียวแบบมีเงื่อนไข"*
และ §12.2 เขียนกำกับ M-01 ไว้ตรง ๆ ว่า **"D-012 คือ flow หลักของ MVP — ห้ามพิสูจน์แค่ใน CI"**
ผมเขียนประโยคนั้นตอน Gate 2 เพื่อกันนาทีนี้พอดี ⇒ ผมจะไม่มาแก้เกณฑ์ของตัวเองตอนตัดสินเพื่อให้มันผ่าน

---

## 1. Verdict block

```
❌ QUALITY GATE — F-002 Organization · License · Membership  (df37104)

A Requirement: pass — AC 35 ข้อใน F-002-organization-license-membership.md §2 · gate1-approved ·
                      Platform: both · size: full · D-012/D-027/D-028/D-029/D-030 ผูกกับ AC แล้ว
B Design:      pass — architecture/data-model/api-spec/ux-wireframe/ui/test-plan ครบ + signoff:approved ·
                      security-review 3 ไฟล์ (spec + build-A + build-B) · test plan map AC→case ครบ 35/35 (§3)
C Domain&Data: pass — cross-tenant proof รันจริง: org-leak.kit 20/20 + tenancy.db 19/19 (DB จริง) ·
                      tx+lock: concurrency-matrix 15/15 (Postgres+Redis จริง) · ledger: n/a โดยประกาศ
                      (F-002 ไม่แตะ StockMovement/เงิน — ยืนยันด้วย diff ที่ §6.3) · Decimal/int: n/a เหตุผลเดียวกัน
D Experience:  pass — 4 state ครบและมี unit ประกบ (SessionList/TaxProfileCard/MembersScreen) · copy lint E-11
                      6/6 · design token contract 4/4 · web+mobile ใช้ token ชุดเดียว · manual M-05: "องค์กร" 0 จุด
E Quality:     FAIL — เลนอัตโนมัติเขียวหมดและผมรันเองครบทุกเลน (§2) · manual §12.2 **ไม่ครบ: M-01 ยังไม่ได้ทำ**
F Release:     n-a  — ไม่ใช่ขอบเขตของ Gate E · @release ตัดสินบน release-gate-f.md (ห้ามอ้าง qa-green จากไฟล์นี้)

VERDICT: NOT DONE
Blocking: M-01 (manual §12.2 · owner = คนถือเครื่อง, dispatch โดย PM) — ข้อเดียว
Non-blocking (บันทึกไว้ มีเจ้าของ): §6 — 4 static gate ที่ไม่มีตัวตน · G-08 ถูกแตะ · doc drift 1 จุด
```

---

## 2. หลักฐานเป็นตัวเลข — ผมรันเองทั้งหมด (2026-09-05)

เครื่อง: node **v22.23.1** · pnpm **9.15.9** · สแตกจริงในเครื่อง (API :3000 · web :3001 · PG :55432 · Redis :56379)

### 2.1 unit / lint ในเครื่อง

| คำสั่ง | ผล | exit |
|---|---|---|
| `pnpm --filter web test` | **48 files · 366 passed · 0 failed · 0 skipped** (27.72s) | 0 |
| `pnpm --filter api test` | **56 passed \| 11 skipped files · 704 passed \| 210 skipped (914)** | 0 |
| `pnpm --filter @omnistock/core-domain test` | **23 files · 384 passed** | 0 |
| `pnpm --filter @omnistock/db test` | **8 passed \| 2 skipped files · 161 passed \| 24 skipped (185)** | 0 |
| `pnpm --filter @omnistock/config test` | **2 files · 63 passed** | 0 |
| `pnpm --filter @omnistock/contracts test` | **3 files · 12 passed** | 0 |
| `fvm flutter test` (apps/mobile) | **`00:54 +451: All tests passed!`** | 0 |
| `fvm flutter analyze` | **`No issues found! (ran in 2.4s)`** | 0 |
| `fvm dart run tool/check_boundaries.dart` | **`OK — 85 files scanned, no violations`** | 0 |

> **210/24 ที่ skip ในเครื่อง คือ int lane ที่ไม่มี `TEST_DATABASE_URL` — ไม่ใช่ skip ที่ซ่อนอะไร**
> พิสูจน์ที่ §2.3: บน CI เลนเดียวกันรัน **212/212** และ **185/185** โดย **skip = 0**
> (212 − 210 = 2 เคสในไฟล์ `*.int.test.ts` ที่รันได้โดยไม่ต้องมี DB — ตัวเลขสองฝั่งสอดคล้องกันพอดี)

### 2.2 E2E browser — ผมรันเองบนสแตกจริง

```
cd apps/web && CI=1 E2E_REDIS_URL=redis://localhost:56379 npx playwright test
→ 29 passed (32.5s)   exit 0
```

ครบทั้ง **E-01 · E-01b · E-02 · E-02b · E-03 · E-03b · E-04 · E-05 ×2 · E-06 ×3 · E-07 ×2 · E-08 · E-08b ·
E-09 · E-12★ · E-13 · E-13b · E-14★ ×4 · E-15 · E-15b · E-16 · S9**

⚠️ ก่อนรันต้องล้าง `throttle:*` + `orgrl:*` ใน Redis (โควตาของ F-001 หมดจาก manual pass) —
**ผมล้างแล้วรัน ไม่ได้แก้เทสต์หรือปิด throttle** · นี่คือของที่ `manual-pass-results.md` เตือนไว้ท้ายไฟล์ และมันจริง

### 2.3 CI run `33940886688` — ผมอ่านจาก log ไม่ใช่จากสถานะ

`headSha = df371049f899a2c89fc966c834a08163ca34507b` ⇒ **ตรงกับ HEAD ที่ผมตัดสิน** (ไม่ใช่ run ของคอมมิตเก่า)
9 job · conclusion = `success` ทั้งหมด: `node-ci` · `integration-api` · `db-migrate` · `e2e-web` · `mobile-e2e`
· `flutter-ci` · `contracts-drift` · `oasdiff` · `depcruise`

**จำนวนเคสที่รันจริง (ไม่ใช่แค่ ✅):**

| job | บรรทัดใน log | ตัวเลข |
|---|---|---|
| `e2e-web` | `Running 29 tests using 1 worker` → `29 passed (26.6s)` → `the browser lane ran 29 passing case(s) (floor 29).` | **29** |
| `mobile-e2e` | `00:10 +4: All tests passed!` → `mobile integration: 4 passing case(s) (floor 4)` | **4** |
| `integration-api` | `[lane-enabled guard] … total: 212 passed / 0 failed / 0 skipped (of 212)` → `OK — the required suites really ran.` | **212 · skip 0** |
| `db-migrate` | `[lane-enabled guard] … total: 185 passed / 0 failed / 0 skipped (of 185)` | **185 · skip 0** |
| `node-ci` | `Tasks: 33 successful, 33 total` · api `704 passed \| 210 skipped` · db `161 \| 24` · web `48 files` | ตรงกับเครื่องผมเป๊ะ |

**I-37 (บทเรียน F-001 "green locally ≠ tested") พิสูจน์แล้วสองชั้น** และผมตรวจถึงชั้นที่สอง:
เลน int แตกราย 13 ไฟล์ (`orgs 37 · members 34 · auth.e2e 26 · invitations 23 · redeem 16 · concurrency 15 ·
seed-kit 13 · org-leak 20 · rate-limit 6 · perf-smoke 5 · openapi-parity 5 · header-policy 4 · refresh-token 8`)
**ทุกไฟล์ `0 skipped`** ⇒ ไม่มีไฟล์ไหน `describe.skip` ทั้งก้อนแล้วเขียวลอย ๆ

---

## 3. AC ↔ เคส — **คำถามที่สำคัญที่สุดของงานนี้**

> **คำถาม:** มี AC ข้อไหนที่ไม่มีเคสไหนแตะเลยหรือเปล่า
> **คำตอบ: ไม่มี — 35/35 มีเทสต์ที่รันจริงและผ่านจริง**
>
> ผมไม่ได้ยอมรับตาราง §2 ของ test-plan ตามที่เขียนไว้ · ผมนับ AC ใหม่จากต้นทาง
> (`F-002-organization-license-membership.md` §2: US-1 4 + US-2 3 + US-3 9 + US-4 5 + US-5 7 + US-6 3 + US-7 4 = **35** ✓)
> แล้วไล่หาเทสต์**จากพฤติกรรมในโค้ด** ไม่ใช่จาก id ที่แผนอ้าง — เพราะ **id ในแผนกับ id ในโค้ดไม่ตรงกันทั้งหมด**
> (ดู §3.2 — เรื่องนี้เกือบทำให้ผมสรุปผิด และมันคือเหตุผลที่ต้องเช็คแบบนี้)

### 3.1 ตาราง AC ↔ เคสที่ผมยืนยันด้วยตาเอง

| AC | เคสที่ผมเปิดดูจริง (ไฟล์:ชื่อเทสต์) | เลนที่รัน | ผล |
|---|---|---|---|
| **AC-1.1** สร้าง org → Owner + entitlement | `orgs.e2e.int`: *★ 201 creates Organization + 3 roles + Owner membership + entitlement + warehouse* | int 212 | ✅ |
| **AC-1.2** plan มาจาก server ไม่แจก free | `orgs.e2e.int`: *★ §6.2 · 503 ORG_PROVISIONING_UNAVAILABLE — and NO shop is created* · `config/env.test` + `app.kit` pin `DEFAULT_ORG_PLAN_KEY` · `plan-provisioning.service.test` | int + unit | 🟡 ตามที่ประกาศ |
| **AC-1.3** tier ตาม plan + default warehouse 1 | เคสเดียวกับ AC-1.1 + `orgs.e2e.int`: *★ the DB-level 'one default warehouse per org' index is real* | int | ✅ |
| **AC-1.4** ทุกอย่างผูก `organizationId` | `tenancy.db.test` 19/19 (DB จริง) · `tenancy.test` 83 · `org-models.test` (อ่าน DMMF) · `user-select.test` 4 | db 185 | ✅ |
| **AC-2.1** เห็น/เลือก org (web+mobile) | `orgs.e2e.int`: *lists the caller's shops in the full shape* · web **E-02/E-02b** · mobile **E-10** *the shop list and the members list come back from the server* | int+29+4 | ✅ |
| **AC-2.2** ไม่ปนข้าม org | `org-leak.kit.int` 20/20 · `orgs.e2e.int`: *GET/PATCH leaks nothing in any direction* · **E-02** | int+29 | ✅ |
| **AC-2.3** org ที่ไม่ได้เป็นสมาชิก → 403 | `orgs.e2e.int`: *★ the Staff persona gets FORBIDDEN while the stranger gets ORG_ACCESS_DENIED (I-5)* | int | ✅ |
| **AC-3.1** เชิญ + บังคับ role → pending + วันหมดอายุ | `invitations.e2e.int`: *★ TTL comes from the ROLE, not the caller* · *422 ROLE_INVALID…* · **E-03** | int+29 | ✅ |
| **AC-3.2** (D-012) copy link เอง ไม่มี email อัตโนมัติ | `invitations.e2e.int`: *★ the raw token is returned ONCE…* · **E-03** · **ผมตรวจเองว่าไม่มี dep ส่งเมลจริง** (§6.1) | int+29+by hand | ✅ |
| **AC-3.3** แสดงลิงก์ครั้งเดียว · เก็บ hash | `invitations.e2e.int`: *★ the raw token is returned ONCE and never stored (D-018)* + *★ the list can never hand the token back* · `invitation-token.test` (packages/db) 9 | int+db | ✅ |
| **AC-3.4** ออกลิงก์ใหม่ → ลิงก์เดิมตาย · อายุนับใหม่ · บันทึกเหตุการณ์ · ห้ามคำว่า "คัดลอกลิงก์เดิม" | `invitations.e2e.int`: *★ reissue rotates the token — the OLD hash stops existing immediately* + *★ reissue restarts the clock* · **E-03b** *the old link is DEAD the moment a new one exists* · **E-11** `copy-lint.test` 6/6 | int+29+unit | ✅ |
| **AC-3.5** ยกเลิกคำเชิญ → ลิงก์ตาย | `invitations.e2e.int`: *cancel kills the link, and cancelling twice is 409 rather than a silent no-op* | int | ✅ |
| **AC-3.6** เชิญคนที่เป็นสมาชิก/มี pending | `invitations.e2e.int`: *409 INVITATION_PENDING carries the id, so the UI has a next step* + *409 ALREADY_MEMBER* · **E-03** | int+29 | ✅ |
| **AC-3.7** normalize email · token สุ่ม/hash/หมดอายุ/ผูก email | `core-domain/auth/email.test` (`normalizeEmail`) · `invitation-token.test` · `invitations.e2e.int`: *★ A-4: an expired invitation reads as `expired`* | unit+db+int | ✅ |
| **AC-3.8** (D-028) Owner-only เชิญ Owner · role สูง 24 ชม. | `invitations.e2e.int`: *★ C-1/D-028: an Admin cannot invite somebody AS an Owner* + *★ NEW-2: an Admin cannot reissue an OWNER invitation, and the DB does not move* + *★ TTL comes from the ROLE* · **M-03 ยืนยันด้วยมือ: ตรงถึงนาที 3 จอ + DB** | int+manual | ✅ |
| **AC-3.9** เห็นใครรับเมื่อไหร่ + ธงบัญชีสร้างหลังออกลิงก์ | `invitations-redeem.e2e.int`: *★ joins the shop, and records the account-age snapshot (§3.10 flag)* (assert `acceptedUserCreatedAfterInvite: true`) · `MembersScreen.invitation-status.test` (`acceptedAt` → "รับแล้วเมื่อ") · **M-04 (ครึ่ง "เมื่อไหร่" หายไปจริง → B-15 → แก้แล้ว)** | int+unit+manual | ✅ |
| **AC-4.1** มีบัญชี → กดรับ → membership ทันที | `invitations-redeem.e2e.int` (16 เคส) · **E-04** | int+29 | ✅ |
| **AC-4.2** ยังไม่มีบัญชี → สมัคร email เดิม → ผูกอัตโนมัติ | **E-05** *they sign up with the invited address and join — the link is needed twice* · `oasdiff` ยืนยัน `/auth/*` ไม่ breaking | 29+CI | ✅ |
| **AC-4.3** หมดอายุ/ยกเลิก → แจ้ง expired/invalid | `invitations-redeem.e2e.int`: *★ a token that DID resolve gets its precise state (cancelled ≠ expired ≠ accepted)* + *★ an EXPIRED link says so — expiry is derived* | int | ✅ |
| **AC-4.4** (D-027) email คนละตัว → `u***@…` ไม่เผยเต็ม | `invitations-redeem.e2e.int`: *★ the wrong account gets 403 + a MASKED address, never the address* · **E-06 ×3 รวม ★ *the address never reached this browser at all*** | int+29 | ✅ |
| **AC-4.5** (D-028) คำเชิญที่ออกก่อนถูกถอด → ปฏิเสธ · กลับเข้ามา = เหตุการณ์แยก | `invitations-redeem.e2e.int`: *★ 409 INVITATION_SUPERSEDED when the link was issued BEFORE the removal (I-1)* + *★ a link issued AFTER the removal works, and says so with its own event* | int | ✅ |
| **AC-5.1** (D-027) ถอด → request ถัดไป 403 ทันที · session ไม่ตาย | `members.e2e.int`: *★ soft-revokes AND cancels that email's pending invitation, atomically* · **E-07** *removed while inside the shop: refused at once, and sent to the picker — not to /login* · mobile **E-10** *★ removed mid-session: the shop goes, the session stays* | int+29+4 | ✅ |
| **AC-5.2** org หายจาก switcher + พากลับหน้าเลือกร้าน | `orgs.e2e.int`: *★ AC US-5: a revoked shop disappears from the DEFAULT list immediately* · **E-07** *the shop is gone from the picker, and typing its URL does not get back in* | int+29 | ✅ |
| **AC-5.3** (D-028) ถอด → ยกเลิกคำเชิญค้างของ email นั้น (tx เดียว) | `members.e2e.int`: *★ soft-revokes AND cancels that email's pending invitation, **atomically*** | int | ✅ |
| **AC-5.4** ชื่อคนถูกถอดยังอยู่ในประวัติ | `members.e2e.int`: *shows revoked rows by default and filters on request* (แถวไม่ถูกลบ) | int | 🟡 ตามที่ประกาศ |
| **AC-5.5** ดูรายชื่อ+สถานะ+role ต้องมี `manage_members` | `members.e2e.int`: *★ D-028/I-8/N-4: a Staff member gets 403 FORBIDDEN — not the directory* + *an Admin (manage_members, no full_access) may read it* · **E-08/E-08b** | int+29 | ✅ |
| **AC-5.6** ถูกถอดแล้วยังล็อกอินได้ + เห็น org อื่น | **E-07** (ยืนยันว่า "ไม่ถูกเตะไป /login") · mobile **E-10** (*the session stays*) | 29+4 | ✅ |
| **AC-5.7** (D-029) ทุก role ออกจากร้านเองได้ · Owner คนสุดท้ายไม่ได้ | `members.e2e.int`: *★ a Staff member may leave WITHOUT manage_members — and it emits member.left* · *★ 409 LAST_OWNER — the only Owner cannot leave* · *★ there is no way to point this route at somebody else* (★7) · *★ leave ‖ remove-the-other-Owner keeps the invariant* · **E-13/E-13b** · **M-06 ด้วยมือ** | int+29+manual | ✅ **เต็ม** ตามที่ §17.1 บังคับ |
| **AC-6.1** Owner ≥ 1 | `members.e2e.int`: *★ 409 LAST_OWNER when the only Owner demotes themselves* + *★ 409 LAST_OWNER — the only Owner cannot be removed* + `concurrency-matrix` *★ two parallel removals of two different Owners never leave the shop ownerless* (20 รอบ) | int 15 conc. | ✅ |
| **AC-6.2** Owner ยกคนอื่นเป็น Owner ได้ | `members.e2e.int`: *★ promoting to Owner is flagged as full access — privilege escalation is greppable* | int | ✅ |
| **AC-6.3** (D-028/D-030) Owner-only ครบ 5 call site ของ `canAssignRole` | `members.e2e.int`: *★ C-1/D-028: an Admin cannot promote anyone to Owner* · *★ C-1: an Admin cannot promote THEMSELVES, nor demote an Owner* · *★ C-1: an Admin cannot remove an Owner* · `invitations.e2e.int`: *★ C-1/D-028 invite* + *★ NEW-2 reissue* · `auth.e2e.int` + `admin-reset-authz.test` (NEW-1) | int+unit | ✅ |
| **AC-7.1** เปิด accounting → บังคับ tax profile ครบ 13 หลัก + checksum | `orgs.e2e.int`: *★ PUT stores the profile and the RESPONSE never echoes the full number* · **E-09** *a wrong checksum is corrected AT THE FIELD, and the fix goes through* | int+29 | ✅ |
| **AC-7.2** 1 org = 1 tax profile | `orgs.e2e.int` §3.16 block (`PUT` ทั้งชุด เขียนทับ ไม่มีชุดที่สอง) · `schema-f002.test` (unique) | int+db | ✅ |
| **AC-7.3** ยังไม่ประกาศ TIN → Sync tier | `taxProfileComplete` ถูก assert ที่ `orgs.e2e.int` (4 จุด: 201 = false · GET = false · หลัง PUT = true · Staff เห็น true) + `org-profile.ts` (`isTaxProfileComplete`) + `tax-card.test` (web) | int+unit | 🟡 การ gate จริง = F-007 |
| **AC-7.4** (D-028 PDPA) TIN เต็มเฉพาะ `manage_org_settings` ผ่าน `reveal` เส้นเดียว | `orgs.e2e.int`: *★ reveal returns the FULL number, with no-store + no-referrer headers* · *★ reveal is the ONLY route allowed to emit a full TIN, and the list says so* · *★ a Staff member cannot reveal — 403, and nothing is emitted* · *★ a successful reveal is ALWAYS recorded, and the record carries no digits* · *★ Staff see vatRegistered ONLY — not even the last four digits* · **E-14★ 4 เคส** · **M-07/M-07ข/M-07ค(Android) ด้วยมือบนเครื่องจริง** | int+29+manual | ✅ |

**สรุป: 35/35 — เต็ม 32 · partial 3 (AC-1.2 · AC-5.4 · AC-7.3)**
partial ทั้งสามคือ **"พื้นผิวยังไม่เกิดใน Phase 0"** ไม่ใช่ "ไม่มีคนเขียนเทสต์" — F-080/F-082 (plan จาก license),
F-005/F-011 (ledger/audit), F-007 (tier gating) · **@product รับทราบไว้แล้วใน D-029(4)** ⇒ ผมไม่นับเป็นแดง
และผมยืนยันว่า **ตัวเลขที่ถูกคือ 35/35 ไม่ใช่ 34/34** ที่ D-029(4) เขียน (D-029(2) เพิ่ม AC-5.7 เองแล้วนับก่อนหน้านั้น)

### 3.2 สิ่งที่เจอระหว่างเช็ค — id ในแผนกับ id ในโค้ดไม่ตรงกัน

ผมสแกน id ของแผนทั้ง 99 ตัวหาในโค้ด · **29 ตัวไม่ปรากฏเป็นสตริงเลย** — และ *ส่วนใหญ่ไม่ได้แปลว่าไม่มีเทสต์*
แต่แปลว่า **เทสต์มีอยู่โดยไม่ได้ติดป้าย** ⇒ ตาราง §3.1 ผมจึงยืนยันด้วย*พฤติกรรม*ไม่ใช่ด้วยป้าย

**ที่สำคัญกว่านั้น: เลข E- ในไฟล์กับเลข E- ในแผนคนละชุดกัน**

| ในแผน §12.1 | ในโค้ดจริง |
|---|---|
| E-10 = mobile Flutter | ไฟล์ `e15-root-route.spec.ts` = **E-15/E-15b** (root route, มาจาก B-14) · **E-10 ตัวจริงอยู่ที่ `apps/mobile/integration_test/org_flow_test.dart`** |
| E-11 = copy lint (static) | ไฟล์ `e16-sign-out.spec.ts` = **E-16** (sign-out, มาจาก B-16) · **E-11 ตัวจริงอยู่ที่ `apps/web/src/features/org/copy-lint.test.ts`** |
| — | **E-15 · E-15b · E-16 · S9 เป็นเคสใหม่ที่ไม่มีในแผน** (เกิดจาก B-14/B-16/B-3) |

⇒ **§12.1 วันนี้คือ 29 เคส ไม่ใช่ 14 หรือ 26** (แผนเขียน 14 flow · `tasks.md` §2358 ยังเขียน "browser 26" ซึ่งล้าสมัย)
· ผมยืนยันด้วยตัวเอง: `Running 29 tests` บน CI **และ** `29 passed` บนเครื่องผม · emulator **4** (แผนเขียน 1, tasks เขียน 3 แล้ว 4)
· **ไม่มีเคสไหนของแผนหายไป** — E-01..E-09, E-12, E-13, E-14 อยู่ครบในเบราว์เซอร์ · E-10 อยู่ที่ emulator · E-11 อยู่ที่ unit
· นี่เป็น **ปัญหาการติดป้าย ไม่ใช่ปัญหา coverage** ⇒ non-blocking (§6.4)

---

## 4. §17 ไล่ทีละข้อ (เกณฑ์ที่ผมเขียนเองตอน Gate 2)

| § | เกณฑ์ | ผล | หลักฐาน |
|---|---|---|---|
| 17.1 | AC 35 ข้อมีเทสต์ที่รันจริงและผ่าน · AC-5.7 ต้อง "เต็ม" | ✅ | §3.1 — AC-5.7 มี 4 เคส int + 2 เคส browser + M-06 |
| 17.2 | Track 1 เขียวบน **CI** · int lane พิสูจน์ว่าเปิดจริง (I-37) | ✅ | 9/9 job บน `33940886688` (headSha = HEAD) · int **212/212 skip 0** · db **185/185 skip 0** |
| 17.3 | ★1–★7 ครบ · §9 ครบ 41 finding | ✅ | `regression-pack.test.ts` เดินทะเบียนทีละแถวและ **อ่านไฟล์จริง + เช็คสตริง `must`** (ไม่ใช่ assert ลอย) · 41 distinct findings · 0 blank row |
| 17.4 | gate §10 ทั้งหมดเขียว **และ G-05 พิสูจน์ว่าแดงได้จริง** | ⚠️ **บางส่วน** | G-01/02/03/04/05/07/13/15 มีจริงและมี fixture (`route-registry.kit.test`: *RED G-13* + *RED G-13(ค)* ครบ 2 tier · *RED (the important one): an EMPTY enumeration must not be green*) · **G-06/G-09/G-11/G-12 ไม่มีตัวตน** → §6.1 |
| 17.5 | `oasdiff` ไม่ breaking · `contracts-drift` ว่าง · client 2 ฝั่ง regen+build | ✅ | job `oasdiff` + `contracts-drift` (รวม *fail on uncommitted diff incl. untracked* + *TS client typecheck-green* + Dart regen) |
| 17.6 | **manual §12.2 ทำครบและบันทึกผล** | ❌ **แดง** | M-02..M-07ข ทำครบ + บันทึกที่ `manual-pass-results.md` · **M-01 ไม่ได้ทำ** |
| 17.7 | perf smoke อยู่ใน budget | ✅ | `perf-smoke.int.test.ts` 5/5 บน `integration-api` (0 skipped) |
| 17.8 | ไม่มี test ถูก skip/ลด/ลบเพื่อให้ผ่าน · ★ มี red→green | ✅ / ⚠️ ดูหมายเหตุ | `.skip` ที่มีคือ `const d = INT_LANE_ENABLED ? describe : describe.skip` ล้วน ๆ (13 ไฟล์) ซึ่ง **I-37 บน CI บังคับให้ต้องรัน** · ไม่มี `.only` / `xit` / `xdescribe` เลย · **หมายเหตุ: red→green ผมยืนยันได้แค่ที่เป็นลายลักษณ์ใน `tasks.md`/`manual-pass-results.md` — ผมไม่ได้ย้อน revert โค้ดเพื่อดูแดงเอง (§7)** |
| 17.9 | defect ค้างถูกจัดชั้น · **blocker = 0** | ✅ | `build-defects.ts` B-1..B-18 — **18 แถว ทุกแถวมี pin, ไม่มีแถวไหนไม่มีเทสต์** · `build-defects.test.ts` บังคับเช่นเดียวกับ §9 |
| 17.10 | §11.1 ครบ 6 · R-01/R-02 ไม่ถูก skip · G-12/13/14/15 เขียว+มี fixture | ⚠️ **บางส่วน** | G-13/G-15 ครบพร้อม fixture · **G-12 ไม่มี · G-14 มีครึ่งเดียว** (`log-hygiene.test.ts` ครอบครึ่ง logger · ครึ่ง DTO ครอบด้วย `org-leak.kit` เชิงพฤติกรรมแทน) |
| 17.11 | (ก) 41 finding ไม่มีช่องว่าง (ข) NEW-1 red→green สองชั้น (ค) fail-closed บน `GET` (ง) ไม่มี 500/SQLSTATE ตอนแย่ง lock (จ) `USER_SELECT` 3 ชั้น (ฉ) G-15 มี fixture | ✅ (ยกเว้น red→green — ดู §7) | (ก) `regression-pack.test`: *★ no blank rows* · NEW-5(ข)/NEW-12 มี `noTest` ที่เขียนเหตุผลยาว >40 ตัวอักษรตามกฎของ gate เอง (ค) `capability.guard.test` + `members.routes.test` + `members.e2e.int` (ง) `org-busy.test` (U-API-21) + `concurrency-matrix` (I-C-13) + `members.e2e.int`: *★ revoke ‖ revoke … never a 500* (จ) `user-select.test` 4 + `org-models.test` + G-02 (ฉ) `role-capability-write-tripwire.test.ts` 6 เคส |

---

## 5. สองข้อที่ยังทำไม่ได้ — บล็อกหรือไม่บล็อก และทำไม

### 5.1 M-01 — ส่งลิงก์จริงทาง LINE บนมือถือจริง ⇒ **บล็อก**

**ผมตัดสินว่าบล็อก** และนี่คือเหตุผล ไม่ใช่การเล่นตามตัวอักษร:

- AC-3.2 (D-012) ไม่ใช่ AC ธรรมดา — มันคือ**กลไกเชิญคนเข้าร้านทั้งหมดของ MVP** เพราะไม่มี SMTP จนถึง F-081
  ⇒ ถ้าเส้นนี้ขาดในโลกจริง F-002 ไม่ได้ทำงานเลยแม้ทุกเลนจะเขียว
- ผมเขียนไว้เองใน §12.2 ว่า **"ห้ามพิสูจน์แค่ใน CI"** · การมาบอกตอนนี้ว่า "E-03/E-05 พิสูจน์แทนได้"
  คือการ**เปลี่ยนเกณฑ์ตอนกำลังถูกตัดสิน** ซึ่งเป็นสิ่งเดียวที่ qa ทำไม่ได้
- และมันมีเนื้อจริง: `manual-pass-results.md` เองบันทึกว่า `WEB_APP_BASE_URL` ที่ชี้ `localhost`
  จะทำให้ลิงก์เปิดไม่ได้บนโทรศัพท์ — **พลาดแบบเดียวกับ B-17 เป๊ะ** และ B-17 คือของที่ทุกเลนเขียวทับมาตลอด
  ⇒ ชั้นที่จะจับเรื่องนี้ได้มีชั้นเดียวคือคนถือเครื่อง

**สิ่งที่ตัดออกไปแล้ว (ให้เครดิตตามจริง):** รูปร่างของลิงก์ไม่ใช่ความเสี่ยงอีกต่อไป —
token เป็น base64url 43 ตัว ไม่มี space/`+`/`/`/`=`/unicode ที่ LINE จะห่อหรือตัด · 1 path 1 query
⇒ **ที่เหลือของ M-01 คือ ~20 นาทีของคน ไม่ใช่งานแก้โค้ด**

- **เจ้าของ:** คนถือเครื่อง (dispatch โดย PM) · **ไม่ใช่** @backend-api / @frontend — ไม่มีอะไรให้แก้
- **ต้องตั้งอะไรก่อน:** `WEB_APP_BASE_URL` = host ที่โทรศัพท์เปิดได้จริง (LAN IP ไม่ใช่ `localhost`)

### 5.2 M-07ค ฝั่ง iOS — **ไม่บล็อก** และผมไม่นับเป็น red

ผมตรวจ `apps/mobile/ios/Runner/AppDelegate.swift` เองแล้ว: `localOnly: true` + expiry บน `UIPasteboard`
มีอยู่จริงในโค้ด · และผม grep `.github/workflows/ci.yml` แล้ว **ไม่มี job `macos`/`xcode` เลย**
⇒ **ยืนยันว่าไฟล์นี้ไม่เคยถูก compile จริง** ตามที่ `manual-pass-results.md` เขียนไว้

**แต่มันไม่ใช่ red ของ Gate E เพราะเหตุผลทางขอบเขต ไม่ใช่เพราะผมยอม:**

1. **ไม่มี iOS release ใน Phase 0** — ไม่มี Apple cert, ไม่มี target release · ⇒ ไม่มีผู้ใช้คนไหนแตะโค้ดบรรทัดนี้ได้
   ⇒ ความเสี่ยง = 0 วันนี้ ไม่ใช่ "ความเสี่ยงที่เรารับไว้"
2. **@devops ตัดสินเป็นทางการแล้ว 2026-09-05** (ตอบ `release-gate-f §4.1`) และคำตัดสินนั้น**อยู่ใน
   `docs/features/forward-commitments.md` พร้อม trigger ที่ผูกกับเหตุการณ์**: *"ก่อน mobile feature ถัดไป
   ที่แตะ `AppDelegate.swift`/iOS-native (F-006 ใกล้สุด) หรือก่อน first iOS release"*
   ⇒ นี่คือรูปแบบที่ skill `quality-gate` อนุญาต: **ข้ามได้ แต่ต้องบอกว่าทำไม** — และมีคนชื่อจริงรับไว้พร้อมเงื่อนไขปลด
3. **Android ปิดไปแล้วจริง** — `mobile-e2e` ต้อง Gradle `assembleDebug` ก่อนรัน ⇒ `MainActivity.kt`
   (ทั้ง `FLAG_SECURE` และคลิปบอร์ดของ M-07) compile ทุกรอบ CI · **M-07ค ฝั่ง Android ผ่านด้วยมือแล้ว**
   (preview ขึ้น `••••••` ขณะที่ control ขึ้นเนื้อหาเต็ม — control คือสิ่งที่ทำให้ผลนี้มีความหมาย)

⇒ **สถานะ: `n/a — deferred, owned, triggered` ไม่ใช่ `fail`**
· **แต่ผมขอผูกเงื่อนไขไว้ตรงนี้:** ถ้า @release จะ ship iOS เมื่อไหร่ **ข้อนี้กลับมาเป็น red ทันที**
และ verdict นี้ห้ามถูกอ้างว่าครอบ iOS

---

## 6. ของที่ยังค้าง — ไม่บล็อก แต่ผมบันทึกไว้พร้อมเจ้าของ

### 6.1 static gate 4 ตัวที่ §10 ประกาศไว้ แต่ **ไม่มีตัวตนในโค้ด** — owner: **@qa (ผมเอง) + @devops**

ผม grep ทั้ง tree แล้วไม่พบ implementation ของ:

| gate | สิ่งที่แผนสั่ง | ผมตรวจด้วยมือแทนวันนี้ | สถานะ |
|---|---|---|---|
| **G-06** | ไม่มี write path ไหนเขียน `status: "invited"` | จริง — `members.service.ts:166` เขียนคอมเมนต์ว่า *"`invited` is a dead state: no production write path"* และไม่มี write จริง | คุณสมบัติ ✅ · **gate ✗** |
| **G-09** | ไม่มี dependency/โค้ดส่ง email | จริง — `grep nodemailer\|smtp\|sendgrid\|mailgun` ใน `package.json` ทุกไฟล์ = **0 hit** | คุณสมบัติ ✅ · **gate ✗** |
| **G-11** | ไม่ normalize email ด้วยมือ (ต้องเรียก `normalizeEmail`) | จริง — `.toLowerCase()` ที่เจอในเส้นทางเมลอยู่ในไฟล์เทสต์เท่านั้น · production ผ่าน `core-domain/auth/email.ts` | คุณสมบัติ ✅ · **gate ✗** |
| **G-12** | ห้าม `role.key ===` ในเส้นทางตัดสินสิทธิ์ (api+web+mobile) | จริง — ที่เจอทั้ง 4 จุดเป็น**คอมเมนต์ที่ปฏิเสธวิธีนั้น** (`roles.service.ts:36`: *"Not `key === "owner"`"*) ไม่ใช่โค้ดที่ทำ | คุณสมบัติ ✅ · **gate ✗** |

**ทำไมไม่บล็อก:** ทั้งสี่ข้อมี**ชั้นที่แรงกว่า**คุมอยู่ — G-12 มี **I-45** (`roles.service.test.ts` สลับ `Role.key`
ใน DB แล้วสิทธิ์ต้องไม่ขยับ) ซึ่งพิสูจน์เชิงพฤติกรรม แผนเองก็เขียนว่า *"gate นี้ไม่พอเดี่ยว ๆ — คู่บังคับคือ I-45"*
· G-09/G-11 คุณสมบัติวันนี้ถูกต้องและผมตรวจแล้ว · G-06 มีชั้น `members.service` + `?status=` ที่ปฏิเสธ `invited`

**ทำไมยังต้องบันทึก:** gate ที่ไม่มีตัวตน **ไม่มีวันแดง** ⇒ ไม่มีอะไรจับ regression วันหน้า —
ซึ่งเป็นรูปเดียวกับ NEW-1/B-14 เป๊ะ ("เชื่อว่าปิดเพราะเอกสารบอก") · §17.11(ก) บังคับกับ §9 ว่า
*"มีเทสต์ หรือมีเหตุผลเป็นลายลักษณ์"* — **§10 ควรอยู่ใต้กฎเดียวกันแต่วันนี้ไม่ได้อยู่**
⇒ **ผมสั่งงานตัวเอง:** เขียน G-06/G-09/G-11/G-12 เป็น source-scanning test (แบบเดียวกับ
`system-prisma-allowlist.test.ts`) **หรือ** ลดชั้นเป็นลายลักษณ์ใน §10 ว่า "ครอบด้วย I-45/…" — เลือกอย่างใดอย่างหนึ่ง
ก่อน F-003 (ตัวที่จะเปิด role CRUD ⇒ G-12 กลายเป็นของจำเป็นทันที)

### 6.2 G-08 ถูกแตะจริง — owner: **@qa (บันทึกแล้ว ไม่ต้องแก้)**

G-08 = *"diff ของ F-002 ต้องไม่แตะไฟล์ ledger/`StockMovement`/คอลัมน์เงิน"* · ผมรัน `git diff main...HEAD` แล้ว **แตะ 1 ไฟล์**:

```
packages/db/src/ledger-guard.ts | 1 +/-
-import { Prisma } from "./generated/client";
+import { Prisma } from "../generated/client";
```

**เป็นผลพวงของ B-10** (ย้าย Prisma client จาก `src/generated/` ไป `generated/` เพื่อให้ `dist/` ใช้ client ตัวเดียวกัน)
· **ไม่มีบรรทัดไหนของ semantics ของ ledger เปลี่ยน** · `ledger-guard.test.ts` 6/6 ยังเขียวบน `db-migrate`
· `db-migrate` มี step *"AC5/6/7/8 — schema shape + ledger immutability"* ผ่าน
⇒ **เจตนาของ G-08 ไม่ถูกละเมิด** แต่ **ตัวอักษรถูก** ⇒ บันทึกไว้เพื่อไม่ให้กลายเป็นบรรทัดฐานเงียบ ๆ ว่า
"แตะ ledger ได้ถ้ามีเหตุผลดี"

### 6.3 doc drift ใน `manual-pass-results.md` — owner: **@qa/@backend-api (คนที่เดิน manual pass)**

หัวไฟล์เขียนว่า B-18 **ปิดแล้ว** (user เลือกทาง (ก) 2026-09-05) และ `build-defects.ts` ก็มี pin ครบ
แต่ **§B-18 ในเนื้อไฟล์ยังขึ้นหัวว่า "🔴 เปิดอยู่"** และยังเสนอทางเลือก (ก)/(ข) เหมือนยังไม่มีคนเคาะ
⇒ คนอ่านครั้งแรกจะได้คำตอบคนละอย่างจากไฟล์เดียวกัน · **ไม่กระทบ verdict** (ผมยืนตาม `build-defects.ts` + pin ที่รันจริง)

### 6.4 ป้ายของเคสกับแผนไม่ตรงกัน — owner: **@qa (test-plan §12.1)**

ตาม §3.2 · `test-plan.md §12.1` ยังลิสต์ 14 flow และให้ E-10/E-11 คนละความหมายกับไฟล์ที่ชื่อ `e10-`/`e11-`
· `tasks.md` §2358 ยังเขียน "browser 26" ทั้งที่วันนี้ **29** · ผมเลือก**ไม่แก้ `test-plan.md` ในรอบนี้**
เพราะมันเป็นเอกสารที่ user เคาะไปแล้ว (`signoff: approved`) และการแก้ควรไปพร้อมรอบ amend ที่มีคนอ่าน
⇒ **ตัวเลขที่ถูกต้อง ณ วันนี้อยู่ในไฟล์นี้ (§2.2/§2.3) ให้ใช้ตัวนี้เป็นหลัก**

### 6.5 `--passWithNoTests` / `echo ok` นอกขอบเขต F-002 — owner: **@devops (เฝ้าไว้)**

`packages/connectors` (`test: vitest run --passWithNoTests`) · `apps/back-office` (เหมือนกัน) ·
`packages/contracts` (`build: echo ok` — แต่ `test` จริงและมี 12 เคส) · `apps/mobile` (`typecheck: echo ok`
— ตัวจริงคือ `flutter analyze` ที่รันบน `flutter-ci`)
⇒ **G-07 ไม่ถูกละเมิด** เพราะกฎเขียนว่า *"ในเวิร์กสเปซที่มีเทสต์แล้ว"* และสองตัวแรกยังไม่มีโค้ด
· บันทึกไว้เพราะวันที่ connectors/back-office มีโค้ด **สคริปต์นี้จะเขียวโดยไม่พิสูจน์อะไรเลย**

---

## 7. สิ่งที่ผมตัดสินไม่ได้ และพูดตรง ๆ ว่าทำไม

1. **red→green ของ ★-task (§17.8 · §17.11(ข))** — ผมยืนยันได้แค่ว่า *มีคนบันทึกไว้เป็นลายลักษณ์*
   (`tasks.md` · `manual-pass-results.md` เช่น B-15 *"ถอดการแก้ออก → 2 เคสแดงทันที"*)
   · ผม **ไม่ได้** revert โค้ดแต่ละจุดแล้วดูว่าแดงจริงด้วยตัวเอง — ทำไม่ได้ในรอบนี้เพราะกติกาห้ามผมแตะโค้ด
   ⇒ **ผมรับข้อนี้บนคำของ implementer ไม่ใช่บนสายตาตัวเอง** และบันทึกไว้ตรงนี้ให้ชัดว่านั่นคือคุณภาพของหลักฐาน
   · ของที่ผมยืนยันเองได้และยืนยันแล้วคือ **gate ยังแดงได้จริง** (`route-registry.kit.test.ts` มี RED case 8 ตัว
   รวม *an EMPTY enumeration must not be green*) — ซึ่งเป็นครึ่งที่สำคัญกว่า
2. **M-02 / M-05 / M-06 ครึ่งที่เป็น "อ่านแล้วเข้าใจไหม"** — ไม่ใช่ของผม เป็นของ **@ux + @product**
   · M-02 ยังไม่มีคำตอบ: *ไม่มีจอไหนเรียก `adminResetPassword` เลย* ⇒ คำถามที่ runbook ถามตอบไม่ได้เชิงโครงสร้าง
   · **ผมไม่ถือว่าบล็อก Gate E** (พฤติกรรม API ถูกต้องและมีเทสต์: Staff→200 · Owner→404 · รหัสเดิมยังใช้ได้)
   แต่ **@product ต้องรู้ก่อน release** ว่าราคาที่เคาะไว้ใน D-030 ยังไม่เคยมีใครเห็นบนจอ
3. **จะ ship ทั้งที่ M-01 ยังไม่ได้ทำหรือไม่** — **ไม่ใช่การตัดสินของ qa** เป็นของ **@release**
   · ผมให้ได้แค่ข้อเท็จจริง: *ไม่มี defect ค้างในโค้ด · เลนอัตโนมัติเขียวครบ · ช่องที่ขาดคือหลักฐานจากคน 1 ข้อ*
   ⇒ ถ้า @release เลือกเดินต่อ **ห้ามเขียนว่า "qa-green"** — เขียนว่า *"qa NOT DONE, release ยอมรับความเสี่ยง M-01"*

---

## 8. ทางกลับมาเป็นเขียว (สั้นและชัด)

```
เหลืองานเดียว: M-01
  1. ตั้ง WEB_APP_BASE_URL = LAN IP ของเครื่องที่รัน web (ไม่ใช่ localhost) แล้ว restart api
  2. เชิญสมาชิก → คัดลอกลิงก์ → ส่งทาง LINE → เปิดบนโทรศัพท์จริง → กดรับจนเข้าร้าน
  3. บันทึกผลลง manual-pass-results.md
  4. กลับมาที่ไฟล์นี้ แก้ §1 verdict block เป็น ✅ DONE + §4 แถว 17.6 เป็น ✅
เมื่อ 4 ข้อนี้จบ Gate E = DONE โดยไม่ต้องรันเลนไหนใหม่ (ยกเว้นมีคอมมิตใหม่เข้ามาระหว่างนั้น)
```

> **ห้ามทำ:** แก้ §12.2 ให้ M-01 หายไป หรือแทน M-01 ด้วย E-03/E-05 · ถ้าจะเปลี่ยนเกณฑ์นี้จริง ๆ ต้องมี **D-XXX**
> และเป็นการตัดสินของ user ไม่ใช่ของ qa ไม่ใช่ของคนที่อยากให้ feature ผ่าน
