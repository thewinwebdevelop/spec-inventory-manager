# F-002 — Gate F (Release) · คำตัดสินของ `release`

> **สถานะ:** ของเตรียมจาก PM (§1–5 เดิม) + **คำตัดสินของ `release` เพิ่มเข้ามา 2026-09-05**
> (§4 ทบทวนใหม่ · §6 branch/merge · §7 checklist ปิด F-002 — ของใหม่ทั้งสองหัวข้อ) ·
> qa ยังเป็นเจ้าของ verdict ของ Gate E เสมอ — เอกสารนี้ไม่ override ผลของ qa

---

## 1 · Version bump — **ข้อเสนอ: ยังไม่ตัดเวอร์ชันให้ F-002**

| ข้อเท็จจริง | ผล |
|---|---|
| repo **ไม่มี git tag เลยสักตัว** | ยังไม่เคยมี release ให้ bump ต่อจาก |
| npm workspace ทุกตัว = `0.0.0` · **`apps/mobile/pubspec.yaml` = `1.0.0+1`** | ค่า default ของ `flutter create` ที่ไม่มีใครแก้ — **ต้องตัดสินก่อนตัดเวอร์ชันแรก** |
| นโยบาย branch ของเฟสนี้: `main` ได้ merge ใหญ่ครั้งเดียวตอนปิด Phase 1 | F-002 ไม่ใช่หน่วยที่ ship ออกไปเดี่ยว ๆ |
| ไม่มี deploy target (Phase 0/1) | "released" ยังไม่มีความหมายเชิงปฏิบัติ |

⇒ **เสนอ:** F-002 อยู่ใต้ `[Unreleased]` ใน `CHANGELOG.md` (สร้างแล้ว) · เวอร์ชันแรกตัดตอนปิด Phase 1

✅ **ตัดสินแล้ว 2026-09-05** (user มอบให้ตัดสินแทน) — **`apps/mobile/pubspec.yaml` = `0.0.0+1`**
· ตรงกับทุก workspace ของ npm · `1.0.0` เดิมคือ default ของ `flutter create` ที่ไม่มีใครแก้ ⇒ **อ้างเวอร์ชันที่ไม่เคย ship**
· build number `+1` คงไว้เพราะสโตร์บังคับให้เป็นจำนวนเต็มที่เดินหน้าอย่างเดียว — เลข**หน้า** (`0.0.0`) กับเลข**หลัง** (`+1`) ตอบคนละคำถาม
· นี่ไม่ใช่การตัดเวอร์ชัน แต่คือการหยุดอ้างเวอร์ชัน · `release` ยังเป็นคนตัด `0.1.0` (หรืออะไรก็ตาม) ตอนปิด Phase 1

---

## 2 · Rollback plan

### 2.1 ข้อเท็จจริงที่ตัดสินทุกอย่าง: **migration หนึ่งตัวลบข้อมูลถาวร**

F-002 มี 3 migration · แต่ละตัว**เขียน SQL ย้อนกลับไว้ในคอมเมนต์ของตัวเองแล้ว** (expand→contract แยกกันโดยตั้งใจ):

| migration | ย้อนได้ไหม |
|---|---|
| `20260731000000_f002_expand` | ✅ additive ล้วน · SQL ย้อนอยู่ในไฟล์ |
| `20260731000100_f002_drop_invitation_token` | ⚠️ **`DROP COLUMN "token"` — ข้อมูลในคอลัมน์นั้นกู้ไม่ได้** |
| `20260807000000_f002_role_org_composite_fk` | ✅ FK swap · SQL ย้อนอยู่ในไฟล์ |

**ผลที่ต้องพูดออกมาให้ชัด:** ย้อน API กลับไปก่อน F-002 **หลัง**จาก `f002_drop_invitation_token` รันแล้ว
⇒ คอลัมน์ `token` ถูกสร้างคืนได้แต่**ว่างเปล่าและ NULLABLE** ⇒ โค้ดเก่าที่อ่าน `token` จะเจอ NULL
⇒ **คำเชิญที่ค้างอยู่ทั้งหมดใช้ไม่ได้ทันที** (ไม่พังดัง — ผู้ถูกเชิญกดลิงก์แล้วไม่ได้อะไร)

### 2.2 ลำดับที่ปลอดภัย (deploy) — ✅ ยืนยันแล้วหลัง B-14..B-18 ว่ายังถูก · ระบุคนกดเพิ่ม

**บริบทที่ต้องพูดก่อน:** Phase 0/1 ไม่มี deploy target (§4) ⇒ "deploy" ข้างล่างนี้หมายถึง
**สภาพแวดล้อม dogfood ที่มีอยู่จริงตอนนี้เท่านั้น** (เครื่อง dev/CI ที่ยกสแตกตาม
`manual-pass-runbook.md`) ไม่ใช่ environment แยกที่มีชื่อ — ลำดับนี้ใช้ซ้ำได้ทันทีที่มี target จริง
(รอ F-009 ตาม `forward-commitments.md`) โดยไม่ต้องแก้

1. **migrate ก่อน deploy** — `f002_expand` เป็น additive ⇒ โค้ดเก่ายังทำงานได้บน schema ใหม่
   → **ใครกด:** `devops` รัน `prisma migrate deploy` (หรือเทียบเท่าใน runbook) บนฐานเป้าหมาย
2. **deploy โค้ด F-002** — PR ของ feature นี้ merge เข้า `chore/agent-definitions` แล้ว (§6)
   → **ใครกด:** `devops` ปล่อย build ล่าสุดของ `chore/agent-definitions` เข้าสภาพแวดล้อม dogfood
3. **หยุดไว้ตรงนี้ใน dogfood อย่างน้อย 1 รอบการใช้งานจริง** — ยังไม่รัน `f002_drop_invitation_token`
   → **ใครกด "ผ่าน":** `PM` ประกาศว่ารอบ dogfood จบ (นิยาม "1 รอบ" = มีคนในทีมสร้างร้าน
   เชิญสมาชิกจริงอย่างน้อย 1 คนจนรับคำเชิญสำเร็จ — ไม่ใช่แค่ผ่านไป 24 ชม.) · **`qa` ยืนยัน**ว่าไม่มี
   incident ที่เกี่ยวกับ invitation token ระหว่างรอบนั้น
4. รัน contract migration **เมื่อมั่นใจแล้วเท่านั้น** — หลังจากนี้ rollback ของโค้ดจะพาคำเชิญค้างตายไปด้วย
   → **ใครกด:** `devops` รัน `f002_drop_invitation_token` ก็ต่อเมื่อได้ไฟเขียวจากขั้น 3 เท่านั้น
   (ไม่ใช่ auto-run ต่อจากขั้น 1 — ต้องเป็นคำสั่งแยก คนละวันได้)

> ขั้นที่ 3 คือทั้งหมดที่ทำให้ expand→contract คุ้มค่ากับความยุ่งยากของมัน · ถ้ารันสองตัวติดกัน
> จะได้ความเสี่ยงของ contract โดยไม่ได้ประโยชน์อะไรเลย
>
> **สิ่งที่ไม่เปลี่ยนแม้ B-18 จะเปิดทาง mobile เข้าถึง F-002 แล้ว:** B-14..B-18 ทั้งหมดเป็นโค้ด
> ฝั่ง client (web/mobile) ไม่มีตัวไหนแตะ schema หรือลำดับ migration ⇒ ลำดับ 4 ขั้นข้างบนไม่ต้องแก้
> สิ่งที่เปลี่ยนคือ**ขอบเขตของขั้น 3**: "รอบใช้งานจริง" ตอนนี้ต้องรวมเส้นทางมือถือด้วย (ก่อน B-18
> มือถือเข้าจอ F-002 ไม่ได้เลย จึงนับแค่ web ก็พอ) — `PM` เป็นคนยืนยันว่ารอบที่นับรวม mobile แล้ว

### 2.3 rollback ของโค้ด (ไม่แตะ schema)

ระหว่างขั้น 2–3: **revert deploy กลับ build ก่อนหน้าได้ตรง ๆ** — schema เป็น superset ของที่โค้ดเก่าต้องการ
ไม่ต้องย้อน migration · **นี่คือ rollback ที่ควรใช้ 99% ของกรณี**
→ **ใครกด:** `devops` เป็นคนสั่ง revert · `release` เป็นคนตัดสินใจว่าจะ revert (go/no-go ของการถอย
เป็นสิทธิ์เดียวกับ go/no-go ของการไป) · ไม่ต้องขอ sign-off ใหม่จาก `qa`/`product` ก่อนถอย — เวลาเป็นสิ่งที่
แพงที่สุดตอนต้องย้อน, ขอ sign-off ทีหลังได้เสมอ

**เพดานเวลา:** ถ้าเข้าขั้น 4 (รัน contract migration) ไปแล้วและต้อง rollback โค้ด — นี่ไม่ใช่ 99% กรณีอีกต่อไป
ให้ย้อนไปอ่าน §2.1 (คำเชิญค้างตายทันที ไม่พังดัง) ก่อนตัดสินใจ ไม่ใช่ revert เฉย ๆ แล้วคิดว่าจบ

### 2.4 สิ่งที่ **ไม่ใช่** rollback แต่คนมักสับสน

- **หมุน `INVITATION_TOKEN_SECRET`** ⇒ คำเชิญที่ค้างตายหมด**เงียบ ๆ** (hash ทางเดียว re-key ไม่ได้)
  ⇒ ต้องยกเลิกของค้าง + แจ้งให้ออกลิงก์ใหม่**ก่อน** หมุน (รายละเอียด: `infra/env/README.md`)
- **`DEFAULT_ORG_PLAN_KEY` ผิด/ไม่ได้ seed** ⇒ สร้างร้าน `503` ทุกครั้ง ขณะที่ทุก endpoint อื่นปกติ
  — ดูเหมือนบั๊กของฟีเจอร์ ไม่เหมือน outage
  → **เจ้าของการเช็คก่อน deploy ทุกครั้ง:** `devops` (ทั้งสองข้อของ §2.4 เป็น pre-flight ของเขา
  ไม่ใช่ของ `release` — `release` แค่กำหนดว่าต้องเช็ค ไม่ใช่คนเช็คเอง)

---

## 3 · Rollout — dogfood ก่อน

Phase 0/1 มี**ผู้ใช้กลุ่มเดียวคือเราเอง** ⇒ "dogfood-first" ไม่ใช่ ring แต่คือ:
ยกสแตกตาม `manual-pass-runbook.md` → เดิน M-01..M-07ค ด้วยมือ → แล้วค่อยพูดเรื่อง environment จริง

**อัปเดต 2026-09-05 หลัง §12.2 เดินจบเกือบหมด:** dogfood-first แปลว่า **"เดิน M-01..M-07ค
ให้ครบก่อนพูดเรื่อง external customer"** ไม่ใช่ "เดินครบก่อน merge" — สอง gate นี้แยกกัน:

| gate | เงื่อนไข | เจ้าของ |
|---|---|---|
| merge เข้า `chore/agent-definitions` (นี่คือ Gate F ของ F-002) | qa ออก verdict Gate E (เขียว หรือ go-with-known-risk ที่ product เซ็นรับ) | qa + product + release |
| เปิดให้ external customer (ไม่ใช่ของรอบนี้ — Phase 0/1 ยังไม่มีลูกค้านอก) | M-01 (LINE+มือถือจริง) และ M-07ค ฝั่ง iOS เดินจบทั้งคู่ + F-009 (deploy/hosting) มีอยู่จริง | qa + devops |

⇒ **M-01 กับ M-07ค-iOS ที่ยังทำไม่ได้ ไม่ใช่ตัวบล็อกการ merge ของ F-002 เข้า Phase 1 branch**
(ไม่มีอะไรพัง — แค่ยังไม่มีคน/เครื่องพิสูจน์) **แต่เป็นตัวบล็อกของการเปิดขายนอก dogfood แน่นอน**
— ต้องอยู่ใน launch-readiness checklist (ดูเดิมใน `forward-commitments.md`) ไม่ใช่หายไปเงียบ ๆ

---

## 4 · Go / No-Go — คำตัดสินของ `release` (2026-09-05)

### 4.0 คำตอบตรง ๆ ก่อน: "released" แปลว่าอะไรในบริบทนี้

Phase 0/1 **ไม่มี deploy target** (ไม่มี F-009, ไม่มี staging/prod) ⇒ ไม่มีคำว่า "released" แบบที่มีลูกค้า
เห็นได้ ดังนั้น go/no-go ของ Gate F รอบนี้ตอบคำถามที่แคบกว่า:

> **"F-002 พร้อม merge เข้า `chore/agent-definitions` (branch ของ Phase 1) แล้วหรือยัง"**

ไม่ใช่ "พร้อมขายหรือยัง" (คำถามนั้นรออีก gate ที่ต้องมี F-009 ก่อน — §3 ตารางด้านบน)
**ต้องแยกสองเหตุผลของ NO-GO ให้ชัด เพราะมันนำไปสู่ action คนละแบบ:**

| แบบ | ตัวอย่างในรอบนี้ | ทำอะไรต่อ |
|---|---|---|
| NO-GO เพราะ **ไม่มีที่ให้ ship** | ไม่มี deploy target ใน Phase 0 | ไม่ต้องทำอะไร — เป็นเรื่องจริงของเฟส ไม่ใช่สิ่งที่ต้องแก้ก่อน merge |
| NO-GO เพราะ **ยังพิสูจน์ไม่ได้ว่าไม่พัง** | qa ยังไม่ออก verdict Gate E | ต้องรอ/ต้องแก้ก่อนเดินหน้า |
| NO-GO เพราะ **ของพัง** | (ไม่มีข้อไหนในรอบนี้อยู่ในกลุ่มนี้) | ต้องแก้ก่อนเสมอ ไม่มีข้อยกเว้น |

⇒ วันนี้ NO-GO ของ F-002 เป็น**ผสมของสองแบบแรก ไม่มีข้อไหนอยู่แบบที่สาม** — สำคัญเพราะแบบแรกไม่บล็อกการ merge
(แค่บล็อกการพูดว่า "released") ส่วนแบบที่สองบล็อกจริง

### 4.1 ตารางเงื่อนไข

**สถานะวันนี้ (2026-09-05): 🔴 NO-GO ต่อการ merge** — เหตุผลเดียวที่เหลือคือ **qa ยังไม่ออก verdict**
ทุกอย่างที่ `release` ควบคุมได้ (version, changelog, rollback, rollout, micro-retro) ปิดครบแล้ว

| ช่อง | สถานะ | ใคร |
|---|---|---|
| qa เขียว (Gate E) | 🔴 **verdict ออกแล้ว 2026-09-05 = ❌ NOT DONE · บล็อกข้อเดียวคือ M-01** ([gate-e-verdict.md](gate-e-verdict.md)) — ทุกเลนอัตโนมัติเขียวและ qa รันเองทั้งหมด · AC ครบ **35/35 ไม่มีข้อไหนไม่มีเคสแตะ** · **M-07ค ฝั่ง iOS = `n/a` ไม่ใช่ red** (devops ตัดสินเป็น forward-commitment แล้ว) · M-01 บล็อกเพราะ D-012 คือกลไกเชิญทั้งหมดของ MVP และ §12.2 เขียนเองว่า "ห้ามพิสูจน์แค่ใน CI" — qa ปฏิเสธที่จะแก้กติกาที่ตัวเองเขียนไว้ตอน Gate 2 เพื่อให้ฟีเจอร์ตัวเองผ่าน · **แก้โค้ด 0 บรรทัด · ใช้คน ~20 นาที** · manual §12.2 เดินจบเกือบหมด ([ผลเต็ม](manual-pass-results.md)): M-03/M-05/M-06/M-07/ข/ค **ผ่านครบ** · M-04 ครึ่งเดียว (B-15 ปิดแล้ว) · M-02 ตอบไม่ได้เพราะไม่มีจอ (ux+product) · **M-01 (LINE+มือถือจริง) และ M-07ค ฝั่ง iOS ยังทำไม่ได้จริง** (ต้องใช้คน/เครื่อง Apple) — **`release` ไม่ตัดสินแทนว่านี่คือ pass หรือ accepted-risk เพราะเป็นสิทธิ์ของ qa** | **qa — บล็อกจริงตัวเดียว** |
| devops env พร้อม | ⚪ **N/A ในความหมายเดิม, ไม่บล็อก merge** — ไม่มี deploy target ใน Phase 0 (§4.0) · สิ่งที่ devops ต้องยืนยันแทนคือ pre-flight ของ §2.4 บนสภาพแวดล้อม dogfood ที่มีอยู่จริง | devops |
| CI Track 1 เขียว | ✅ **9/9 job** ล่าสุด run `33940886688` · browser 29 · emulator 4 | — |
| version + changelog | ✅ ตัดสินแล้ว §1 · `apps/mobile/pubspec.yaml` = `0.0.0+1` ตรงกับทุก npm workspace · `CHANGELOG.md` อัปเดตแล้ว | release |
| rollback plan | ✅ §2 | release |
| rollout sequence + ใครกดอะไร | ✅ §2.2/§3 | release |
| micro-retro | ✅ เขียนลง `docs/RETRO.md` แล้ว (PM ตรวจ/แก้ได้) | PM |
| native compile forward-commitment | ✅ **ปิดแล้ว** — ดู 4.2 | devops |
| §5 ข้อค้าง (copy ที่ frontend ยังไม่ wire) | ⚠️ **ไม่บล็อก merge ของ F-002** แต่บล็อก "ปิด F-002" (§7) — เป็นโค้ดจริงที่ยังไม่เสร็จ ไม่ใช่แค่เอกสาร | frontend |

**สรุป (อัปเดตหลัง verdict ออก 2026-09-05):** เงื่อนไขเดียวที่เหลือคือ **M-01** — ให้คนถือมือถือที่มี LINE
เดิน 20 นาที · ถ้าเดินแล้วผ่าน ⇒ qa แก้ verdict เป็น DONE ⇒ **`release` เปลี่ยนเป็น 🟢 GO ทันที**
· ถ้า `product` เลือกจะ merge ก่อนโดยรับความเสี่ยงไว้ ⇒ ต้องเขียนในบันทึกว่า **"qa NOT DONE · release รับ
ความเสี่ยงของ M-01"** — **ห้ามเขียนว่า "qa-green"** (qa ระบุข้อนี้ไว้เองในเอกสาร และ quality-gate §F ห้าม override)
ไม่ต้องกลับมาเปิด gate นี้ใหม่ — เงื่อนไขทุกอย่างที่เหลือปิดไปแล้ววันนี้

### 4.2 native compile — ✅ ปิดแล้ว (ปิดไปแล้วก่อนผมเข้ามา ผมแค่ยืนยัน)

`forward-commitments.md` บันทึกไว้แล้วว่า devops ตัดสิน 2026-09-05: ลดขอบเขต forward-commitment
เหลือ **iOS/Swift เท่านั้น** — Android/Kotlin ปิดจริงแล้วโดยเลน `mobile-e2e` (ต้อง `assembleDebug`
APK จริงก่อนรัน integration test ⇒ `MainActivity.kt` compile ทุกรอบ CI, แก้พังแล้วเลนแดง)
ส่วน iOS/Swift (`AppDelegate.swift`) ยังไม่เคย compile เลย (ไม่มี mac runner) — ความเสี่ยงจริงคือ
**เฉพาะ path ของ iOS** และผูก trigger ไว้แล้ว: "ก่อน mobile feature ถัดไปที่แตะ native iOS (F-006
ใกล้สุด) หรือก่อน first iOS release" **ไม่ใช่ตัวบล็อกของ F-002** เพราะ F-002 ไม่ได้ ship ไป iOS
จริงในรอบนี้ (ไม่มี mac runner ⇒ ไม่มี build ให้ ship) — สอดคล้องกับ §3 ที่แยก M-07ค-iOS
ออกจาก merge-gate ไปเป็น launch-readiness gate แล้ว

---

## 5 · สิ่งที่ยังเปิดค้าง (ไม่บล็อก แต่ต้องอยู่ในสายตาตอน go/no-go)

| เรื่อง | เจ้าของ |
|---|---|
| ~~เขียน error code 5 ตัว (`EMAIL_TAKEN` ฯลฯ) ลง OpenAPI · `TOKEN_RESPONSE_ALLOWLIST` จะสร้างหรือแก้เอกสาร · `capabilities` ใน `201` ไหม~~ **✅ ปิดครบ 3 ข้อ 2026-09-05** — (1) 5 code เขียนลง `openapi/paths/*` แล้ว + `UNDOCUMENTED` ว่าง + guard ใหม่ฝั่ง server `apps/api/test/error-code-contract.test.ts` (ทุก code ใน `ERROR_CODES` ต้องถูกประกาศ **และตรง status** — เปลี่ยนชื่อ code = แดง) (2) **สร้างของจริง** `TOKEN_RESPONSE_ALLOWLIST` (2 แถวตัวอักษร) + `isTokenAllowedOnRoute()` + บังคับใน `org-leak.kit.ts` (3) **ไม่ใส่** `capabilities` ใน `201` — เหตุผลเต็มอยู่ที่ api-spec §3.1ก | backend-api |
| mobile auto-hide เลขภาษีด้วย idle timer (ux เสนอ §15.1: ซ่อนเมื่อ "จอไม่ได้อยู่กับผู้ใช้แล้ว" ทำครบแล้ว · idle timer ยังไม่ทำ เพราะกดใหม่ = audit event + กิน quota 20/ชม.) | ux + product |
| ~~ตัวเลข `timeout-minutes` · `APP_ROLE` ที่ `apps/api/CLAUDE.md` อธิบายสองแบบ~~ **✅ ปิด 2026-09-05** — timeout ตั้งใหม่จากเวลาจริงของ 10 run (มีคอมเมนต์กำกับที่มาของทุกค่า) · `APP_ROLE` แก้แล้วที่บรรทัด 8 ให้บอกตรง ๆ ว่าเป็น target ที่ยังไม่มีในโค้ด (`grep` = 0 ครั้ง) · **iOS**: ยังไม่เพิ่ม mac runner (macOS minute แพงกว่า Linux ~10× และยังไม่มี cert/กำหนด release) — forward-commitment ลดขอบเขตเหลือ iOS แล้ว | devops |
| **ux ตอบครบแล้ว 2026-09-05** · คีย์ที่ ux เพิ่งเขียนถูก wire ครบในรอบเดียวกันแล้ว (`menuLabel` → `AppShell` 2 จุด · `leaveLastOwnerCta`/`leaveLastOwnerHere` → `LeaveOrgDialog` แตก 2 สาขาตาม §10.3 พร้อมเทสต์ 3 เคส — **ปิด nit ของ M-06 ไปด้วย**) ⇒ **เหลือของ frontend 2 อย่าง:** ปุ่ม "เชิญใหม่อีกครั้ง" (สเปกครบใน ux-wireframe §7) · เปลี่ยน literal → token ที่ 8 ไฟล์ | frontend |
| ~~ธง "บัญชีสร้างหลังออกลิงก์" หายาก~~ ป้ายปุ่มเปลี่ยนเป็น "ดูคำเชิญทั้งหมด รวมที่รับแล้ว" แล้ว · **ย้ายธงไปแถวสมาชิก = ไม่ทำตอนนี้** (ต้องเพิ่ม field ใน `MemberRow`) → forward-commitments, trigger = F-004 Gate 2 | — |
| ~~ปุ่มสลับ dark theme~~ · ~~`@phosphor-icons/react`~~ **ตัดสินแล้ว: ไม่ทำทั้งคู่** — เหตุผล + trigger อยู่ใน `docs/features/forward-commitments.md` | — |
| **M-02 copy** — `/login/help` เคยบอกให้ติดต่อเจ้าของร้าน/ผู้ดูแลให้ตั้งรหัสใหม่ให้ ทั้งที่**ไม่มีจอไหนเรียก `reset-password` เลย** ⇒ แก้ให้ชี้ไป "ติดต่อทีมงาน OmniStock" ตาม ux-wireframe §12.3 · **กลับมาแก้อีกครั้งเมื่อ F-004 มีจอจริง** | ux + F-004 |
| **M-01 (ใหม่):** `/invite` ที่ถูกเปิดโดย**ไม่มี token** (เกิดจาก E-12 ถอด token ทิ้งเอง แล้วคนถูกพากลับมาหลังสมัคร) ขึ้นข้อความเดียวกับ token ที่ใช้ไม่ได้จริง — *"ลิงก์อาจถูกคัดลอกมาไม่ครบ หรือถูกยกเลิกไปแล้ว"* ซึ่ง**ไม่จริงทั้งสองข้อ** · แก้ด้วย copy (แยกเคส) หรืออุ้ม token ข้าม auth round trip (= การตัดสินใจเชิงความปลอดภัย) | ux + product |
| **M-01 (devops):** ทดสอบลิงก์คำเชิญ**ข้ามเครื่องจริง** ต้องมี origin ที่เป็น **https** — `WEB_APP_BASE_URL` รับ http เฉพาะ `localhost`/`127.0.0.1` (`packages/config/src/env.ts:103`, กฎถูก) · วิธีเลี่ยงสำหรับเครื่องต่อ USB คือ `adb reverse` (บันทึกใน runbook แล้ว) แต่ส่งข้ามเครื่องไม่ได้ | devops |
| B-7..B-18 ปิดครบแล้ว (**B-14** `/` → login/select-org · **B-15** แถวคำเชิญที่ตายแล้วบอกว่าลิงก์ยังใช้ได้ · **B-16** ทั้งแอปไม่มีปุ่มออกจากระบบ · **B-17** แอปมือถือชี้ไป API ไหนไม่ได้ · **B-18** จอ F-002 บนมือถือไม่มีทางเข้าถึง — product เคาะทาง (ก), ต่อ nav ชั่วคราวแล้ว) | — |

---

## 6 · นโยบาย branch — merge เข้าที่ไหน เมื่อไหร่

อ้างอิง `git-branch-workflow` (memory ของทีม): `chore/agent-definitions` คือ branch ที่ใช้งานจริงของ
Phase 1 (และเป็น GitHub default) · `main` ถูก protect ไว้ (1 review) และรับ **merge ใหญ่ครั้งเดียว
ตอนปิด Phase 1** — F-002 ไม่ merge เข้า `main` ตรง ๆ ในรอบนี้

**ลำดับที่ตัดสิน:**

1. งานของ session นี้ (`claude/thai-language-output-4ea998`) commit ไว้ในสาขาตัวเองแล้ว (working
   tree สะอาด ก่อนผมเริ่ม) — ไฟล์ที่ผมแก้รอบนี้ (`release-gate-f.md`, `CHANGELOG.md`) เหลือเป็น
   uncommitted diff ตามกติกา "ห้าม commit/push" ให้ผู้ใช้รีวิวแล้ว commit เอง
2. เปิด (หรืออัปเดต) PR **`claude/thai-language-output-4ea998` → base `chore/agent-definitions`**
   — ระบุ `--base` ตรง ๆ เสมอ (กติกาเดียวกับที่ทีมล็อกไว้ ป้องกัน PR ชนไปที่ `main` โดยไม่ตั้งใจ)
3. Merge PR **หลัง**เงื่อนไข §4.1 ครบเป็น 🟢 เท่านั้น (คือ: qa ออก verdict เขียว/go-with-known-risk
   ที่ product เซ็นรับ) — คนกด merge = `release`
4. `chore/agent-definitions` สะสมงานของทุก feature ต่อไปจนกว่าจะถึงจุดปิด Phase 1 — merge ก้อนใหญ่
   เข้า `main` เป็น **Gate F แยกต่างหาก** ของ "ปิด Phase 1" ไม่ใช่ของ F-002 เดี่ยว ๆ (เงื่อนไข/timing
   ของ merge ก้อนนั้นยังไม่ใช่ของที่ต้องตัดสินวันนี้)

**✅ ปิดแล้ว — เดิมเป็นข้อสงสัยเรื่อง shallow clone (ตรวจจริง 2026-09-05):**
`release` สังเกตถูกว่า repo นี้เป็น shallow clone (`git rev-parse --is-shallow-repository` = true) และ
`git merge-base HEAD chore/agent-definitions` **ไม่คืนค่าอะไรเลย** ⇒ ตั้งข้อสงสัยไว้ว่าเป็นผลของ shallow fetch
ไม่ใช่ประวัติที่แยกกันจริง แล้ว**ไม่ฟันธงแทน** — ซึ่งเป็นการตัดสินใจที่ถูกต้อง

ตรวจแล้วด้วยการ deepen จริง:
```
$ git fetch --deepen=500 origin chore/agent-definitions claude/thai-language-output-4ea998
$ git merge-base HEAD origin/chore/agent-definitions
25ae7f30aea6a3b2db0545152fef8a27152a7f37   ← "Merge pull request #3 …"
```
⇒ **สองสายมีบรรพบุรุษร่วมกันจริง · เป็น artifact ของ shallow fetch ล้วน ๆ** (depth ก่อนหน้า: `HEAD` เห็น 32
commit · หลัง deepen เห็น 213) ⇒ merge จะเป็นสามฝ่ายปกติ ไม่ใช่การเชื่อมประวัติที่ไม่เกี่ยวกัน
· **@devops ไม่ต้องทำอะไรเพิ่ม** — บันทึกวิธีตรวจไว้เผื่อเจอ symptom เดิมอีก: อาการ "merge-base ว่าง"
บน worktree ที่ clone มาแบบ shallow **ไม่ใช่สัญญาณของประวัติที่แยกกัน** ให้ deepen ก่อนตกใจ

---

## 7 · เช็คลิสต์ปิด F-002 (ทำครบทุกข้อ = เรียกว่า "ปิด" ได้)

| ข้อ | เจ้าของ | สถานะวันนี้ |
|---|---|---|
| ออก `gate-e-verdict.md` (เขียว หรือ go-with-known-risk ระบุ M-01/M-07ค-iOS ชัดเจน) | qa | 🔴 รอ |
| ถ้า verdict เป็น go-with-known-risk: เซ็นรับความเสี่ยง M-01/M-07ค-iOS เป็นลายลักษณ์อักษร | product | 🔴 รอ qa ก่อน |
| merge PR เข้า `chore/agent-definitions` (§6) | release | 🔴 รอ 2 ข้อบน |
| ยืนยัน CI เขียวอีกครั้ง**หลัง merge** (ไม่ใช่แค่บน PR branch) | release | 🔴 รอ merge |
| เดิน rollout §2.2 ขั้น 1–3 บนสภาพแวดล้อม dogfood จริง (migrate → deploy → หยุดสังเกต ≥1 รอบ รวม mobile) | devops (กด) + PM (ยืนยันรอบจบ) | 🔴 รอ merge |
| รัน contract migration `f002_drop_invitation_token` เมื่อรอบ dogfood ผ่าน | devops | 🔴 รอข้อบน |
| ปิดโค้ดค้างใน §5 แถว frontend (ปุ่ม "เชิญใหม่อีกครั้ง" · CTA `LAST_OWNER` 2 สาขา · 3 คีย์ i18n ที่ยังไม่มีคนเรียก · literal→token 8 ไฟล์) | frontend | 🔴 เปิดอยู่ — ไม่บล็อก merge แต่บล็อกการเรียกว่า "ปิด" |
| ตัดสิน idle-timer auto-hide เลขภาษี (ทำ/ไม่ทำตอนนี้ + เหตุผล) | ux + product | 🔴 เปิดอยู่ |
| ~~ตรวจ shallow-clone/merge-base ก่อนกด merge จริง (§6)~~ | ~~devops~~ | ✅ **ปิดแล้ว 2026-09-05** — deepen แล้ว merge-base = `25ae7f3` |
| M-01 (LINE+มือถือจริง) และ M-07ค-iOS — เดินให้จบ **ก่อนเปิด external customer** (ไม่ใช่ก่อนปิด F-002 ภายใน) | qa (คน) + devops (mac runner) | 🔴 เปิดอยู่ — อยู่ใน launch-readiness bucket ตาม §3 |
| ตัดเวอร์ชันแรก (`0.1.0` หรืออื่น) ตอนปิด Phase 1 | release | ⚪ ยังไม่ถึงเวลา — ไม่ใช่ของรอบนี้ |
