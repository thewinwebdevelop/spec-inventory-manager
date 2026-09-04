# F-002 — Gate F (Release) · ร่างให้ `release` + PM เคาะ

> **นี่คือ*ของเตรียม* ไม่ใช่คำตัดสิน** — Gate F มีเจ้าภาพคือ `release` (WEB_TEAM §4) ·
> ผมเตรียมสิ่งที่เตรียมได้ให้ครบ แล้ว**ระบุตรง ๆ ว่าช่องไหนยังตอบไม่ได้และทำไม**
> qa เป็นเจ้าของ verdict ของ Gate E · เอกสารนี้ไม่ override อะไรทั้งสิ้น

---

## 1 · Version bump — **ข้อเสนอ: ยังไม่ตัดเวอร์ชันให้ F-002**

| ข้อเท็จจริง | ผล |
|---|---|
| repo **ไม่มี git tag เลยสักตัว** | ยังไม่เคยมี release ให้ bump ต่อจาก |
| npm workspace ทุกตัว = `0.0.0` · **`apps/mobile/pubspec.yaml` = `1.0.0+1`** | ค่า default ของ `flutter create` ที่ไม่มีใครแก้ — **ต้องตัดสินก่อนตัดเวอร์ชันแรก** |
| นโยบาย branch ของเฟสนี้: `main` ได้ merge ใหญ่ครั้งเดียวตอนปิด Phase 1 | F-002 ไม่ใช่หน่วยที่ ship ออกไปเดี่ยว ๆ |
| ไม่มี deploy target (Phase 0/1) | "released" ยังไม่มีความหมายเชิงปฏิบัติ |

⇒ **เสนอ:** F-002 อยู่ใต้ `[Unreleased]` ใน `CHANGELOG.md` (สร้างแล้ว) · เวอร์ชันแรกตัดตอนปิด Phase 1
⇒ **ที่ `release` ต้องเคาะ:** mobile จะเดินเลขเดียวกับ monorepo หรือเลขของตัวเอง (store build number มีข้อบังคับของมัน)

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

### 2.2 ลำดับที่ปลอดภัย (deploy)

1. **migrate ก่อน deploy** — `f002_expand` เป็น additive ⇒ โค้ดเก่ายังทำงานได้บน schema ใหม่
2. **deploy โค้ด F-002**
3. **หยุดไว้ตรงนี้ใน dogfood อย่างน้อย 1 รอบการใช้งานจริง** — ยังไม่รัน `f002_drop_invitation_token`
4. รัน contract migration **เมื่อมั่นใจแล้วเท่านั้น** — หลังจากนี้ rollback ของโค้ดจะพาคำเชิญค้างตายไปด้วย

> ขั้นที่ 3 คือทั้งหมดที่ทำให้ expand→contract คุ้มค่ากับความยุ่งยากของมัน · ถ้ารันสองตัวติดกัน
> จะได้ความเสี่ยงของ contract โดยไม่ได้ประโยชน์อะไรเลย

### 2.3 rollback ของโค้ด (ไม่แตะ schema)

ระหว่างขั้น 2–3: **revert deploy กลับ build ก่อนหน้าได้ตรง ๆ** — schema เป็น superset ของที่โค้ดเก่าต้องการ
ไม่ต้องย้อน migration · **นี่คือ rollback ที่ควรใช้ 99% ของกรณี**

### 2.4 สิ่งที่ **ไม่ใช่** rollback แต่คนมักสับสน

- **หมุน `INVITATION_TOKEN_SECRET`** ⇒ คำเชิญที่ค้างตายหมด**เงียบ ๆ** (hash ทางเดียว re-key ไม่ได้)
  ⇒ ต้องยกเลิกของค้าง + แจ้งให้ออกลิงก์ใหม่**ก่อน** หมุน (รายละเอียด: `infra/env/README.md`)
- **`DEFAULT_ORG_PLAN_KEY` ผิด/ไม่ได้ seed** ⇒ สร้างร้าน `503` ทุกครั้ง ขณะที่ทุก endpoint อื่นปกติ
  — ดูเหมือนบั๊กของฟีเจอร์ ไม่เหมือน outage

---

## 3 · Rollout — dogfood ก่อน

Phase 0/1 มี**ผู้ใช้กลุ่มเดียวคือเราเอง** ⇒ "dogfood-first" ไม่ใช่ ring แต่คือ:
ยกสแตกตาม `manual-pass-runbook.md` → เดิน M-01..M-07ค ด้วยมือ → แล้วค่อยพูดเรื่อง environment จริง

---

## 4 · Go / No-Go

**สถานะวันนี้: 🔴 NO-GO** — และไม่มีข้อไหนที่แปลว่ามีอะไรพัง

| ช่อง | สถานะ | ใคร |
|---|---|---|
| qa เขียว (Gate E) | ⚠️ **ยังไม่ออก verdict** — manual §12.2 เดินแล้ว ([ผลเต็ม](manual-pass-results.md)): M-03/M-05/M-06 ผ่าน · M-04 ครึ่งเดียว · M-02 ตอบไม่ได้เพราะไม่มีจอ · **M-07/ข/ค ทำไม่ได้ (B-18)** · M-01 ต้องใช้คน | qa + คน |
| devops env พร้อม | 🔴 **ไม่มี deploy target ใน Phase 0** — ไม่มี environment ให้ประกาศว่าพร้อม | devops |
| CI Track 1 เขียว | ✅ **9/9 job** ทุก commit ล่าสุด · browser 29 · emulator 4 | — |
| version + changelog | ⚠️ `CHANGELOG.md` สร้างแล้ว · **เวอร์ชันรอ `release` เคาะ** (ดู §1) | release |
| rollback plan | ✅ §2 | release |
| micro-retro | ✅ เขียนลง `docs/RETRO.md` แล้ว (PM ตรวจ/แก้ได้) | PM |

### 4.1 ⚠️ native compile — **ครึ่งหนึ่งปิดไปแล้ว โดยเลนที่มาด้วยเหตุผลอื่น**

`forward-commitments.md` บันทึกไว้ว่า *"Kotlin/Swift ไม่ถูก compile — flutter-ci = analyze+test เท่านั้น"*
เจ้าของ devops · trigger = "ก่อน first mobile release" · **ผมลอกข้อความนั้นมาใส่ร่างนี้ตอนแรกโดยไม่ตรวจ แล้วมันไม่จริงแล้ว**

ตรวจ log ของ `mobile-e2e` จริง:
```
Running Gradle task 'assembleDebug'...        254.9s
✓ Built build/app/outputs/flutter-apk/app-debug.apk
```

| | สถานะจริง |
|---|---|
| **Android / Kotlin** | ✅ **compile ทุกรอบ CI** — เลน emulator (E-10) ต้อง build APK จริงถึงจะรัน integration test ได้ ⇒ `MainActivity.kt` (ทั้ง `FLAG_SECURE` และคลิปบอร์ดของ M-07) ถูก compile · แก้พังแล้วเลนแดง |
| **iOS / Swift** | 🔴 **ยังไม่เคยถูก compile เลย** — ไม่มี mac runner ⇒ `AppDelegate.swift` (privacy overlay ตอนสลับแอป + `localOnly` ของคลิปบอร์ด) **ship ไปโดยไม่มีใคร build** ⇒ พังเงียบและ guard degrade เป็น no-op โดยไม่มีเลนไหนแดง |

⇒ **ที่ยังเป็นความเสี่ยงจริงคือ iOS เท่านั้น** และมันจับได้ด้วยเลนที่ยังไม่มี ไม่ใช่ด้วยการรีวิว
⇒ **@devops:** forward-commitment แถวนี้ควรถูกลดขอบเขตเหลือ iOS · ครึ่ง Android ปิดไปแล้วโดย E-10 ซึ่งมาเพื่อเหตุผลอื่นทั้งหมด

---

## 5 · สิ่งที่ยังเปิดค้าง (ไม่บล็อก แต่ต้องอยู่ในสายตาตอน go/no-go)

| เรื่อง | เจ้าของ |
|---|---|
| เขียน error code 5 ตัว (`EMAIL_TAKEN` ฯลฯ) ลง OpenAPI · `TOKEN_RESPONSE_ALLOWLIST` จะสร้างหรือแก้เอกสาร · `capabilities` ใน `201` ไหม | backend-api |
| mobile ควร auto-hide เลขภาษีเมื่อทิ้งจอไว้ไหม | ux + product |
| ตัวเลข `timeout-minutes` ใน CI · `APP_ROLE` ที่ `apps/api/CLAUDE.md` อธิบายไว้สองแบบ | devops |
| **B-18 (ใหม่ 2026-09-04 · บล็อก M-07/ข/ค):** จอ F-002 ทั้งชุดบนมือถือ **ไม่มีทางเข้าถึงในแอปจริง** — `OrgPickerScreen`/`CreateOrgScreen`/`MembersScreen`/`OrgProfileScreen` มี 0 อ้างอิงใน `lib/` นอกไฟล์ตัวเอง · `app.dart` จบที่ `SecurityScreen` ของ F-001 · **CHANGELOG อ้างว่า ship จอพวกนี้** ⇒ ต้องเคาะ: ต่อ nav ชั่วคราวใน F-002 หรือรอ F-006 แล้วแก้ AC/CHANGELOG ให้ตรง | **product** (+ F-006) |
| ธง "บัญชีสร้างหลังออกลิงก์" ซ่อนหลังปุ่ม "ดูคำเชิญที่หมดอายุ/ยกเลิกแล้ว" · ปุ่ม "เชิญใหม่อีกครั้ง" (§7 บรรทัด 525) ยังไม่มี · copy ตอนออกจากระบบล้มเหลว (B-16) · CTA "ไปหน้าสมาชิก" ของ LAST_OWNER ชี้หน้าเดิม · connection failure บนมือถือพูดว่า "เกิดข้อผิดพลาด" แทน "เชื่อมต่อไม่ได้" | ux |
| B-7..B-17 ปิดครบแล้ว (**B-14** `/` → login/select-org · **B-15** แถวคำเชิญที่ตายแล้วบอกว่าลิงก์ยังใช้ได้ · **B-16** ทั้งแอปไม่มีปุ่มออกจากระบบ · **B-17** แอปมือถือชี้ไป API ไหนไม่ได้) | — |
