---
doc: security-review
owner: "@security-reviewer"
signoff: pending      # pending | approved
---
# [F-003] Security review — Gate 2 spec (architecture · data-model · api-spec)

## Contract summary (≤20 บรรทัด)
- **Verdict (delta 2026-09-27): ✅ lock ได้ในด้าน security** (advisory — `backend-api`/user ตัดสินว่าจะรับข้อไหน) · ไม่มี Critical/High/Medium เหลือ · finding ใหม่ทั้งหมดอยู่ระดับ Low/Info
- **SR-01..14 ปิดแล้ว · SR-15 ส่งต่อ product แล้ว (ไม่บล็อก)** · ผมตรวจที่ตัวเอกสารและโค้ดเองทุกข้อ ไม่ได้อ้างจากตาราง §15 ของเจ้าของ (รายละเอียดใน "Delta review" ด้านล่าง)
- **SR-01 + D-034 Addendum:** หาลำดับ request ที่ actor คนเดียวใช้ reset คนที่สิทธิ์ ⊇ ตัวเองได้ **ไม่พบ** (ลองแล้ว 11 แบบ) · คำอ้างว่า "invariant พิสูจน์แล้ว" จริง**เฉพาะเมื่อมี actor คนเดียว**
  - ถ้ามี insider สองคนร่วมมือกัน คนหนึ่งถือ `manage_roles` แต่ไม่มี `manage_members` จะทำให้อีกคน reset เป้าหมายที่ไม่มีใครในสองคนนี้ reset ได้ตามลำพัง → **SR-F003-17 (Low, ส่งให้ product/user)**
  - BFS test มี control จริง แต่ความลึกจำกัด ชุด op ไม่ครบ และจำลอง actor คนเดียว → **SR-F003-16 (Low)**
- **SR-02 + D-035 Addendum:** re-check ตอน accept ครบทั้ง 3 เงื่อนไขและอยู่ใต้ org lock · **N-2 = รับเป็น known risk ได้:** reissue เปลี่ยนอีเมลหรือ role ไม่ได้ (ยืนยันจาก `invitations.service.ts:504-508`) ⇒ ใช้เป็นช่องของ SR-02 ไม่ได้ และช่องนี้เล็กกว่า baseline ของช่วง rolling เอง ⇒ ไม่ต้องเพิ่ม `issuedForTokenIssuedAt`
- **SR-03:** ยืนยันว่าการไม่มีปุ่มปิดกฎเข้มถูกต้อง · ช่วงที่โค้ดสองรุ่นรันพร้อมกัน ผลแย่สุด = baseline ของ F-002 ที่ ship อยู่แล้ว ไม่มีช่องใหม่ที่เกิดจากการรวมสองรุ่น (ตรวจแล้ว)
- **oracle (AC-6.4):** reason ใหม่ `equal_permissions` และ `equal_permissions_in_use` รวมถึงลำดับ `TARGET_NOT_BELOW_ACTOR` ไม่เผยข้อมูลเกินที่ผู้ดูรู้อยู่แล้ว · ช่องที่ยิงแล้วได้บิต "เท่ากัน" บน route สมาชิก เป็นช่องโดยธรรมชาติที่ยอมรับไว้แล้ว → **SR-F003-19 (Info)** ให้ pin ว่าการลองแต่ละครั้งทิ้งร่องรอยทั้งสองทาง
- **N-1 (เปลี่ยนชื่ออย่างเดียว):** ถ้าผ่อนให้เปลี่ยนชื่อได้ **จะไม่เปิดช่องสวมรอย** เพราะ caps ไม่เปลี่ยน แต่จะเปิดให้ Admin ตั้งป้ายหลอกบน role ของเพื่อน Admin ได้ และต้องแก้ wire ด้วย (ไม่จริงตามที่ §16 บอกว่า "wire ไม่เปลี่ยน") → **SR-F003-18 (Info)** · ผมแนะนำให้คงการบล็อกไว้
- **ต้องให้ user/product ตัดสิน (ไม่บล็อก lock):** SR-F003-17 (รับเป็นความเสี่ยง หรือเพิ่ม floor `manage_members` ให้การแก้ role ที่มีผู้ถืออื่น) · N-1 (คงบล็อกหรือผ่อน)
- **นอกขอบเขตของผม แต่ขวาง Gate 2:** `test-plan.md` ยังเป็น template ว่าง ⇒ regression ที่ AC-5.4b/5.5b/5.8 บังคับ มีอยู่แค่ใน architecture §13 → ส่ง qa/PM

---

## Delta review 2026-09-27 — F-003 RBAC (spec, Gate 2 รอบ 3–4)
Verdict: **ready → ✅ lock ได้** (advisory — backend-api/user ตัดสินว่าจะรับข้อไหน)

**วิธีทำ:** ผมสร้างลำดับโจมตีจากกฎใน AC-5.x, D-034 (+Addendum) และ D-035 (+Addendum) เองก่อน แล้วจึงไล่ตรวจกับ architecture §1.1/§1.3/§3/§6.1/§12/§13, data-model §2–§5 และ api-spec §2/§3.1/§4.3/§5/§6
ขั้นสุดท้ายตรวจ claim ที่อ้างถึงโค้ดกับไฟล์จริง: `invitations.service.ts` (reissue L432–530, accept L655–880), `members.service.ts` (updateRole L264–360: ไม่มี no-op short-circuit), `members.controller.ts` (DELETE ตัวเองต้องถือ `manage_members`), `auth.service.ts` (adminReset L284–450), `admin-reset-authz.ts:146` (reset ต้องมี `manage_members`) และ `schema.prisma` (`MembershipStatus` มี `invited` ที่เป็น dead state)
ยืนยันแล้วว่า `rbac/`, `decideMemberAuthority`, `isProperSubset`, `issuedByUserId` และ `ROLE_WRITES_ENABLED` **ยังไม่มีในโค้ด** ⇒ ทุกข้อที่ปิดแล้วด้านล่าง = ปิดใน**การออกแบบ** ซึ่งยังต้องพิสูจน์ตอน build

### สถานะ SR เดิม (ตรวจที่เนื้อเอกสาร ไม่ใช่จากตาราง §15)

| SR | สถานะ | ที่ | หมายเหตุจากการตรวจ |
|---|---|---|---|
| 01 High | **closed** | arch §1.1, §1.2, §1.3, §13.6 · api §2, §4.3, §5 · AC-5.1/5.4/5.4b | แกน target ⊊ ครอบทั้ง PATCH/DELETE member, reset และแก้/ลบ role ที่มีผู้ถืออื่น · ลำดับโจมตี 3 request ล้มที่ขั้นแรกทั้งทาง member และทาง role edit · สำหรับ actor คนเดียวไม่พบทางอ้อม (ดู "ลำดับที่ลองแล้ว") · ข้อสังเกต → SR-16, SR-17 |
| 02 Medium | **closed** | arch §6.1, §13.7 · api §4.3, §5 · dm §5 | ตรวจครบ 3 เงื่อนไข: active (`inviter_not_active` fail-closed รวมกรณี null ทั้งคู่) · floor `manage_members` · grant ⊆ (Owner ผ่านด้วย bypass หลัง owner_only) · อยู่ใต้ org lock และทำ**หลัง** refusal เดิมทั้งหมด ⇒ คำตอบเดิมไม่เปลี่ยน · ยกเลิกคำเชิญใน tx เดียวกันและตอบไบต์เดียวกับที่ร้านยกเลิกเอง · N-2 → รับเป็น known risk (ด้านล่าง) |
| 03 Medium | **closed** | arch §12 · dm §4.3, §4.4 | แก้คำอ้างแล้ว · flag default false · rollback ปลอดภัยเฉพาะเมื่อ flag ยังไม่เคยเปิด + query ตรวจ · ข้อสังเกตเรื่องช่วงโค้ดสองรุ่นอยู่ในโฟกัส 3 |
| 04 Medium | **closed** | dm §2.1, §3.1, §4.1 · api §2, §5, §7 · arch §1 | ปฏิเสธ Cc/Cf **หลัง** normalize ทั้งใน core-domain และ DB CHECK · มี gate Unicode parity (set-equality + non-vacuity) · pre-flight จับข้อมูลเก่า · ความเสี่ยงคงเหลือ U+3164/U+2800/สระไทยซ้อน รับไว้แล้วโดย ux ตัดสิน (บันทึกไว้) |
| 05 Low | **closed** | arch §3 · api §6 · §13.5 | ลำดับล็อก User → Membership FOR SHARE → Role FOR SHARE · มี int barrier ทั้งสองทิศ |
| 06 Low | **closed** | dm §3.3 | trigger อ่าน Role FOR SHARE + บังคับ `VOLATILE` + int ต่อทิศ · ไล่ EvalPlanQual ของทั้งสองลำดับแล้ว ถูกต้อง |
| 07 Low | **closed** | arch §2 ชั้น 4 · dm §3.2, §3.3, §4.1 | `role_system_flag_guard` ห้าม false→true + partial unique 1 system role ต่อร้าน · หมายเหตุเล็ก: arch บอก "ห้าม INSERT `isSystem=true` นอก provisioning" แต่ dm ใช้ unique index อย่างเดียว ซึ่งให้ผลเท่ากัน (ไม่ต้องแก้) |
| 08 Low | **closed** | arch §1 `decideRoleWrite` (0), §5, §13.8 · api §2 | floor `manage_roles` จากสิทธิ์ที่อ่านใน tx · ลำดับ 404 ก่อน floor ไม่เผยอะไรเพิ่ม (ผู้เรียกผ่าน guard มาแล้ว) |
| 09 Low | **closed** | arch §9, §13.5 · api §3 · dm §2.1 | join ผ่าน ORG_PRISMA + int ที่ assert ทั้ง JSON · product รับทราบเรื่องระบุตัวคนในร้านเล็กแล้ว |
| 10 Low | **closed (ในการออกแบบ)** | dm §4.2 · arch §14 | มีเจ้าของ + migration ถอด + G-12 ขยายครอบ migrations โดยใช้ `removeBy` · **แต่** G-12 ยังไม่มีใน repo ⇒ การบังคับใช้จริงขึ้นกับงาน §14 ซึ่งถูกผูกไว้ก่อนเปิด flag อยู่แล้ว |
| 11 Low | **closed** | arch §1.1 ลำดับข้อ 3 · §13.6 · dm §1 | bypass ของ Owner เขียนไว้ชัด (หลัง owner_only) · มี matrix แถว unknown key และ snapshot ของเส้น implies |
| 12 Low | **closed** | arch §7, §10 · api §1, §5 | ค่ากลายเป็นข้อกำหนด · เพดาน soft-delete 500 · dedupe fail-open เฉพาะ log |
| 13 Info | **closed** | arch §7 · api §5 | |
| 14 Info | **closed (server)** | arch §4 · api §5 | test ฝั่ง client เป็นของ frontend/qa |
| 15 Info | **routed** | arch §7 | ส่งต่อ product แล้ว ไม่บล็อก F-003 |

### โฟกัส 1 — SR-01 + D-034 Addendum: ลำดับที่ลองแล้ว

นิยาม: A = actor ที่ไม่ใช่ Owner · T = เป้าหมายที่ตอนเริ่ม caps(T) ¬⊊ caps(A) · เป้าหมายของผู้โจมตีคือทำให้ `reset T` ผ่าน

| # | ลำดับ | ผล |
|---|---|---|
| 1 | PATCH T→ต่ำ → reset → PATCH กลับ | ล้มที่ขั้น 1 (แกน target) |
| 2 | แก้ `R_T` (= A) ให้ลดลง → reset → แก้คืน | ล้มที่ขั้น 1 (§1.3: มีผู้ถืออื่นและ before ¬⊊) · ได้ผลเดียวกันเมื่อ A ถือ `R_T` ร่วมกับ T (T ถูกนับเป็นผู้ถืออื่น) |
| 3 | เปลี่ยนชื่อ / no-op บน `R_T` | 403 เพราะไม่ short-circuit · ถึงผ่านได้ caps ก็ไม่เปลี่ยน |
| 4 | clone `R_T` → role ใหม่ → ย้าย T เข้า | ย้าย T ต้องผ่านแกน target ⇒ ล้ม |
| 5 | ลบ `R_T` แล้วสร้างใหม่ | `TARGET_NOT_BELOW_ACTOR` ก่อน `ROLE_IN_USE` + trigger soft-delete ⇒ ล้ม |
| 6 | A ย้ายตัวเองเข้า `R_T` แล้วแก้ | แก้ได้ก็ต่อเมื่อไม่มีผู้ถืออื่น แต่ T ถืออยู่ ⇒ ล้ม |
| 7 | A ลดตัวเอง (PATCH ตัวเอง / แก้ role ที่ถือคนเดียว) | S_A มีแต่หดลง ⇒ ไม่ได้อะไร |
| 8 | สะสม caps แบบ union ผ่าน role (A สร้าง `{X}` แล้ว C ที่ incomparable เติม `Y`) | C ต้องผ่าน before ⊆ C ⇒ `exceeds_actor` · union สร้างไม่ได้ |
| 9 | invite + accept (บัญชีสำรองของ A) | บัญชีสำรองได้แค่ ⊆ A · ไม่แตะ T |
| 10 | upcoming / implies / unknown key | upcoming นับใน ⊆ ตามปกติ · unknown key fail-closed · การเพิ่มเส้น implies ตอน deploy ขยายสิทธิ์จริงของ A (สม่ำเสมอกับที่ guard ใช้) ไม่ใช่ลำดับ request |
| 11 | ย้าย T ออกไปแล้วเชิญกลับ (T ถูก Owner ถอด หรือออกเอง แล้ว A แก้ `R_T` ตอนที่ไม่มีผู้ถือ active แล้วเชิญ T กลับเข้า `R_T` ที่ลดแล้ว) | T กลับมาเข้า role ที่ต่ำกว่า A **ตามที่เขายอมรับเอง** · reset ได้ = พฤติกรรม "reset คนที่ต่ำกว่า" ของ D-032(5) ไม่ใช่ทางเลี่ยง · หมายเหตุ: preview แสดงชื่อ role แต่ไม่แสดง caps (ux อาจพิจารณาได้ แต่ไม่ใช่ข้อบกพร่องของ F-003) |

**ผล:** actor คนเดียวทำไม่ได้ · lemma ใน §1.3 ถูกต้องสำหรับ actor คนเดียว · กรณีหลาย actor เป็นไปตามคุณสมบัติ "กลุ่มที่ร่วมมือกันไม่มีอำนาจเกินผลรวมของอำนาจแต่ละคน" ยกเว้นกรณีที่มีคนถือ `manage_roles` แต่ไม่มี `manage_members` → SR-17
**race:** ทุกเส้นทางที่เพิ่มผู้ถือ active (`membership.update/create` มี 4 call site: `members.service.ts:319,612` · `invitations.service.ts:771,789` · provisioning) อยู่ใต้ org lock · reset ไม่ถือ org lock แต่ถือ Membership+Role FOR SHARE ⇒ serialize ถูกต้อง
**lock graph:** รายการขอบใน §3 ขาดขอบ FK โดยนัย (INSERT Membership → `User` FOR KEY SHARE) · ผมไล่แล้ว ไม่เกิด deadlock เพราะ FOR SHARE ของ reset ข้ามแถวที่ insert แล้วยังไม่ commit และ path ที่ update membership ไม่ล็อก `User` · ไม่เป็น finding

### โฟกัส 2 — N-2: issuer fallback ระหว่าง rolling → **รับเป็น known risk ได้ ไม่ต้องปิด**
- **เหตุผล 1 — ไม่ตรงกับ threat model ของ SR-02:** SR-02 คือ "A มอบสิทธิ์ล่วงหน้าให้**บัญชีสำรองของตัวเอง**" · reissue ของ F-002 เปลี่ยนแค่ `tokenHash/tokenIssuedAt/expiresAt` (`invitations.service.ts:504-508`) ⇒ อีเมลและ role ยังเป็นของผู้เชิญที่ถูกบันทึกไว้ (เช่น Owner) · A ได้ลิงก์ไปก็ accept ไม่ได้ถ้าไม่ได้คุมอีเมลนั้น และถ้าคุมอยู่ แปลว่า Owner ตั้งใจมอบให้อีเมลนั้นเอง
- **เหตุผล 2 — ช่องนี้เล็กกว่า baseline ของ rolling:** ระหว่าง rolling คนที่ accept บน instance F-002 **ไม่ถูก re-check เลย** (§12) ⇒ N-2 ไม่ได้เปิดอะไรเพิ่มจากช่องที่ยอมรับไว้แล้ว
- **เหตุผล 3 — มีขอบเขต:** เกิดได้เฉพาะแถวที่ reissue ในช่วง rolling และหมดอายุตาม TTL (elevated ≤ 24 ชม. นับจาก reissue · ไม่ elevated ≤ 168 ชม. และเป็น role ที่ผู้เชิญที่ถูกบันทึกไว้อนุมัติเอง)
- **ทิศกลับ (Owner reissue บน instance F-002 แทน A ที่ถูกลดสิทธิ์):** re-check ใช้ A ⇒ ปฏิเสธ = fail-closed ที่ Owner แก้ได้ด้วยการเชิญใหม่
- **เงื่อนไขที่ขอ:** แก้ถ้อยคำ §6.1/dm §5 ให้ใส่เหตุผล 1–2 (ตอนนี้เขียนแค่ว่า "อาจผ่านแทนผู้ reissue จริง" ซึ่งทำให้ดูเหมือนเป็นช่อง) · `issuedForTokenIssuedAt` ไม่จำเป็น

### โฟกัส 3 — SR-03: flag กับกฎเข้มบน route เดิม
- **เห็นด้วยกับเจ้าของ:** flag ที่ปิดกฎเข้มได้ = ปุ่มเปิดช่องโหว่ ⇒ ไม่ควรมี
- **ช่วงที่โค้ดสองรุ่นรันพร้อมกัน:** ผู้โจมตียิงซ้ำจนโดน instance F-002 แล้วได้พฤติกรรม F-002 (Admin→Admin reset/เปลี่ยน role, accept โดยไม่ re-check) = **baseline ที่ ship อยู่แล้ว ไม่ใช่ช่องใหม่** · ไล่แล้วว่าการรวมสองรุ่นไม่สร้างอะไรที่รุ่นใดรุ่นหนึ่งทำไม่ได้: flag ปิด ⇒ ไม่มี custom role และไม่มีการลบ · F-002 เข้าใจ `cancelled` · `manage_roles` เป็น key ที่ F-002 ไม่ใช้ · bridge trigger ครอบร้านใหม่
- **ข้อควรระวัง (ไม่ใช่ finding แยก):** (ก) release note/changelog ห้ามประกาศว่า D-034/D-035 มีผลแล้วจนกว่า instance F-002 ตัวสุดท้ายจะหยุด (ข) เงื่อนไขเปิด flag ข้อ (1) "ไม่มี instance F-002 เหลือ" ควรเป็น**หลักฐาน** (รายการ image digest ของทุก process/region/canary ที่รันโค้ด members) ไม่ใช่แค่การยืนยันด้วยวาจา — owner @devops

### โฟกัส 5 — oracle (AC-6.4)
- `equal_permissions` (MemberRow) ส่งเฉพาะผู้ดูที่ถือ `manage_members`∧`manage_roles` ซึ่งอ่าน caps ของทุก role ได้อยู่แล้ว ✓ · `equal_permissions_in_use` (RoleDetail) ส่งเฉพาะผู้ถือ `manage_roles` และ "มีผู้ถืออื่น" คำนวณได้จาก `usage` กับ `myMembership.roleId` ✓
- `TARGET_NOT_BELOW_ACTOR` บน route role เกิดได้เฉพาะกรณี relation `equal` (เพราะผ่าน ⊆ มาแล้ว) และเกิดหลัง `ROLE_EXCEEDS_ACTOR` ✓ · บน DELETE มาก่อน `ROLE_IN_USE` และไม่มี details ⇒ ไม่เกิน AC-3.9 ✓
- **route สมาชิกเรียง target ก่อน grant:** ผู้ที่มีแค่ `manage_members` สามารถยิงแบบไม่เปลี่ยนข้อมูลเพื่อดูบิต "T ¬⊊ ฉัน" ได้ (ส่ง grant ที่ ⊄ ตัวเอง หรือ PATCH no-op) · รวมกับ `viewerCanAssign` แล้วได้ "caps ของ role T = ของฉันทุกตัว" = ช่องโดยธรรมชาติที่ §1.2 ยอมรับไว้แล้ว · ผมยอมรับตาม เพราะลำดับแบบ grant ก่อนก็ยังมี no-op probe อยู่ดี → ขอ pin ร่องรอยให้ครบใน SR-19
- `INVITATION_CANCELLED` ของ re-check: ไบต์เดียวกัน · reason ภายในอยู่แค่ใน event ✓

### Findings ใหม่ (เรียงตาม severity)

#### SR-F003-16 · Low · test ของ lemma (BFS) ครอบไม่ถึงสิ่งที่คำอ้าง "พิสูจน์แล้ว" ต้องใช้
- **ที่:** arch §1.1 ย่อหน้า regression · §1.3 "เหตุผลเชิงรูปแบบ" · §13.6 lemma
- **ปัญหา:**
  - BFS ลึก 3 ขั้นบน op `{change_role, remove, role update, role delete}` ของ A **คนเดียว** ไม่ครอบ PATCH ตัวเอง, สร้าง/clone role, invite+accept และ actor คนที่สอง
  - ขาครึ่งหลังของ lemma ("op ที่เปลี่ยน A เองมีแต่ทำให้ S_A หด") ไม่ถูกทดสอบถ้าไม่มี op ต่อตัวเองอยู่ใน model
  - ความลึก 3 ตรงกับความยาวของการโจมตีที่รู้อยู่แล้วพอดี จึงจับการโจมตีที่ยาวกว่านั้นไม่ได้
  - control มีแค่ "ปิด §1.3" ไม่มี "ปิดแกน target ของ change_role"
- **สถานการณ์:** refactor ในอนาคตผ่อน self-exemption (เช่น ให้ PATCH ตัวเองข้ามแกน grant ด้วย) → A ยกตัวเองได้ → S_A โต → reset ผ่าน · BFS ยังเขียวเพราะไม่มี op นี้ใน model
- **ข้อเสนอ:**
  - เพิ่ม **inductive single-step property** (ครบกว่า BFS แบบจำกัดความลึก): สำหรับทุก state ใน fixture และทุก op ที่ผ่านของ actor ใด ๆ (รวม self-PATCH, create/clone, role update บน role ของตัวเอง, accept) → `S_A(หลัง) ⊆ S_A(ก่อน) ∪ {สมาชิกที่เพิ่งเข้ามาใหม่}`
  - เพิ่ม control ตัวที่สอง: ปิดแกน target ของ `change_role` ⇒ ต้องเจอ PATCH-ลด→reset
  - เขียนคำอ้างใน §1.3 ใหม่ให้จำกัดอยู่ที่ "actor คนเดียว" (ดู SR-17)
- **owner:** @backend-api (ถ้อยคำ) · @qa (ลง test-plan) · ไม่ต้องเป็น D

#### SR-F003-17 · Low · insider สองคนร่วมมือกันผ่านช่อง `manage_roles` ที่ไม่มี `manage_members` ทำให้ reset เป้าหมายที่ไม่มีใคร reset ได้ตามลำพัง
- **ที่:** arch §1.1 แถว `write_held_role` (floor "—") · §1.3 · D-032(3) × D-034 Addendum · `admin-reset-authz.ts:146` (reset ต้องมี `manage_members`)
- **ปัญหา:** D-034 Addendum ตีความการแก้ role ที่มีผู้ถือว่าเป็นการ "แตะ" ผู้ถือ แต่ไม่ได้ gate ด้วย `manage_members` ขณะที่ D-032(3)/AC-2.5 บอกว่าการแตะคนต้อง gate ด้วย `manage_members` · ผลคือคุณสมบัติ "อำนาจของกลุ่ม ≤ ผลรวมของแต่ละคน" ไม่จริงในกรณีเดียว
- **สถานการณ์:**
  - ตั้งต้น: M = `{manage_roles, X, Y}` (ไม่มี `manage_members`) · A = `{manage_members, Y}` · T ถือ `R_T = {X}` และ T ไม่อยู่ร้านอื่น (C-2 ไม่ช่วย)
  - ตอนเริ่ม: A reset T ไม่ได้ (X ∉ A) และ M reset T ไม่ได้ (ไม่มี `manage_members`)
  - (1) M แก้ `R_T` จาก `{X}` เป็น `{Y}`: before ⊊ M ✓ · after ⊆ M ✓
  - (2) A reset T: `{Y}` ⊊ A ✓ → 200
  - (3) M แก้ `R_T` กลับเป็น `{X}`: before `{Y}` ⊊ M ✓
  - ผล: A ถือรหัสผ่านของ T ซึ่งมี X ที่ A ไม่มี
- **ขอบเขต:** ต้องมี insider สองคนที่ Owner ตั้ง role แยกแกนแบบนี้ไว้ · สิทธิ์รวมของกลุ่มไม่ได้โตขึ้น (M มี X อยู่แล้ว) · ผลที่เกิดคือการสวมรอยตัวบุคคล T และ T ถูกเตะออกจากทุกอุปกรณ์ (ตัว T เห็น) · มี event `org.role.updated` สองครั้งล้อม reset
- **ข้อเสนอ (เลือกหนึ่ง):**
  - (ก) รับเป็นความเสี่ยงที่บันทึกไว้ + แก้ถ้อยคำ lemma (SR-16)
  - (ข) เพิ่ม floor ให้แก้/ลบ role ที่มีผู้ถือ active อื่น ⇒ actor ต้องถือ `manage_members` ด้วย · สอดคล้องกับที่ D-034 Addendum ตีความว่านี่คือการแตะคน · ราคา: persona "ผู้ออกแบบ role" ที่มีแค่ `manage_roles` จะแก้ได้เฉพาะ role ที่ยังไม่มีคนถือ (ต้องแก้ AC-5.1)
  - ผมเอนไปทาง (ข) เพราะปิดได้ด้วยโครงสร้าง แต่ (ก) ก็รับได้ที่ระดับ Low
- **owner:** product → user (เปลี่ยนความหมายของ AC-5.1/D-032(3)) · ถ้าเลือก (ข) ควรตัดสินก่อน lock contract เพราะเพิ่ม refusal บน route ใหม่

#### SR-F003-18 · Info · N-1 (เปลี่ยนชื่ออย่างเดียวถูกบล็อก) — ความเห็นด้าน security สำหรับ product
- **ผลต่อการสวมรอย:** ไม่มี · rename ไม่เปลี่ยน caps ⇒ S_A ไม่เปลี่ยน ⇒ lemma ยังจริงถ้าผ่อน rename
- **ผลที่จะเปิดถ้าผ่อน:** Admin คนหนึ่งเปลี่ยนป้ายของ role ที่เพื่อน Admin ถืออยู่ได้ (เช่น เปลี่ยนชื่อ "Admin" เป็น "พนักงานคลัง")
  - Owner อาจมอบ role ที่สิทธิ์สูงให้คนใหม่เพราะเข้าใจผิดจากชื่อ = ป้ายหลอกแบบเดียวกับที่ AC-3.5 ตั้งใจกัน
  - และเป็นการ "แตะ" คนที่เท่ากับตัวเองตามความหมายของ D-034
  - ความเสียหายต่ำ: เห็นได้จาก `lastEdited` และ event
- **ข้อเท็จจริงที่ §16 เขียนไม่ถูก:** "wire ไม่เปลี่ยน" ไม่จริง · `viewer.canEdit` เป็น verdict ตัวเดียว จึงแสดง "เปลี่ยนชื่อได้แต่แก้สิทธิ์ไม่ได้" ไม่ได้ ⇒ ต้องมี field ใหม่ (additive แต่ก็คือการเปลี่ยน contract) + แก้ matrix แถว 4/5
- **ข้อเสนอ:** คงการบล็อกไว้ (ง่ายสุดและสม่ำเสมอกับความหมาย "แตะ") · ถ้าจะผ่อน ให้ทำเป็น op แยก (`rename_held_role`) ที่ caps ต้องเท่าเดิม และส่ง verdict แยก — owner @product (ตัดสิน) · @backend-api (แก้ข้อความ §16)

#### SR-F003-19 · Info · ต้อง pin ว่าการลองยิงเพื่อดูบิต "เท่ากัน" บน route สมาชิกทิ้งร่องรอยทั้งสองทาง
- **ที่:** arch §1.2 ข้อ (ค) "ไม่มีทางลองแบบไม่ทิ้งร่องรอย"
- **ปัญหา:** คำอ้างนี้จริงวันนี้**โดยบังเอิญ**
  - ถ้าผลคือเท่ากัน: `escalation_denied`
  - ถ้าผลคือ ⊊: PATCH no-op ได้ 200 และ `members.service.ts:319` เขียนซ้ำแล้วยิง `org.member.role_changed` (from=to) เพราะโค้ดไม่มี no-op short-circuit
  - ถ้าวันหน้ามีคน "optimize" ให้ no-op ไม่เขียนและไม่ยิง event ฝั่ง ⊊ จะกลายเป็นการลองแบบเงียบ
- **ข้อเสนอ:** int test: PATCH no-op บนเป้าหมาย ⊊ ⇒ 200 **และ** มี event 1 ตัว (หรือกำหนด event ของ no-op อย่างชัดเจน) · ลงคู่กับแถว "PATCH no-op บน Admin อีกคน = 403 + event" ที่มีอยู่แล้วใน §13.6 — owner @qa/@backend-api

### Strengths (ต้องรักษาไว้)
- `decideMemberAuthority` ตัวเดียวที่ตัดสินสองแกน และ `isProperSubset` ถูกเรียกในไฟล์เดียว (gate + non-vacuity) · การแก้ role ที่มีผู้ถือถูกตีความเป็น `change_role` แบบยกชุด ⇒ กฎสม่ำเสมอกับ route สมาชิก
- บังคับ `otherActiveHolders` ที่ระดับ type (ไม่มี default 0) · นับใต้ org lock และมี gate `org-lock-callsites` ที่ขยายไปครอบทุก call site ที่เขียน `roleId`/`status→active`
- no-op ไม่ short-circuit ทั้ง route role และ route สมาชิก
- accept re-check วางหลัง refusal เดิมทั้งหมด (คนถือลิงก์ที่อีเมลไม่ตรงจึงไปไม่ถึงขั้นนี้ และทำให้คำเชิญถูกยกเลิกไม่ได้) · ยกเลิกถาวรแทนการปล่อยให้ "ฟื้น" · ตอบไบต์เดียวกับที่ร้านยกเลิกเอง
- เจ้าของเปิดเผยความเสี่ยงคงเหลือ (N-2, oracle ที่เกิดจากการลองจริง) แทนการอ้างว่า fail-closed
- ไม่มีปุ่มปิดกฎเข้ม และ rollback มี query ตรวจที่ชัด

### ความเสี่ยง 3 จุดสูงสุดและสิ่งที่ผมตรวจ (calibration)
1. **ทางเลี่ยง reset ⊊:** ลอง 11 ลำดับ + coalition + race + lock graph → ไม่พบช่องสำหรับ actor คนเดียว · เจอ SR-17 (สองคนร่วมมือ)
2. **accept re-check / issuer:** ตรวจโค้ด reissue/accept จริง ลำดับ refusal, fallback null, owner_only ของผู้เชิญที่ถูกลดจาก Owner และ N-2 → ปิดแล้ว, N-2 รับได้
3. **ช่วงโค้ดสองรุ่น:** ไล่ทุก state ใหม่ที่ F-003 เขียนแล้ว F-002 อ่าน (cancelled, `manage_roles`, `issuedByUserId`, `deletedAt`, bridge) → ไม่มีช่องที่เกิดจากการรวมกัน

### ไม่ได้ตรวจในรอบนี้
- `ui.md` / `ux-wireframe.md` (copy และพฤติกรรมของปุ่ม) · client security (ยังไม่มีโค้ด) · `test-plan.md` (ยังว่าง — เป็นของ qa) · timing ของ 404 (เป็นหลักฐานตอน review โค้ด)

### Questions to route (ไม่เดาเอง)
- **@product → @user:** SR-F003-17 — (ก) รับความเสี่ยง หรือ (ข) ให้การแก้/ลบ role ที่มีผู้ถืออื่นต้องถือ `manage_members` ด้วย
- **@product:** N-1 / SR-F003-18 — คงการบล็อก rename (ผมแนะนำ) หรือผ่อนพร้อม op + verdict แยก
- **@qa / PM:** `test-plan.md` ยังเป็น template — ต้องลง AC-5.4b/5.5b/5.8 + SR-16/19 ก่อน G2✓
- **@devops:** เงื่อนไขเปิด flag ข้อ (1) ต้องมีหลักฐานที่ครอบทุก process/region

### Verdict (delta)
**✅ lock ได้** (ด้าน security, advisory)
- ทำให้ครบก่อน G2✓ โดยไม่บล็อก: SR-16 (ถ้อยคำ lemma + test) · SR-19 (1 int) · แก้ถ้อยคำ §6.1/§16 ตาม N-2/N-1
- ควรตัดสินก่อน lock ถ้าจะเลือก (ข): SR-17

---

# รอบ 1 (2026-09-27) — review ต้นฉบับ (คงไว้เป็นประวัติ · สถานะปัจจุบันดูตาราง "สถานะ SR เดิม" ด้านบน)

## Contract summary รอบ 1 (ประวัติ)
- **Verdict: ⚠️ lock ได้หลังแก้ SR-F003-01, 02, 03, 04** (advisory — `backend-api`/user ตัดสินว่าจะรับข้อไหน) · ไม่พบ Critical
- **ต้อง route เป็น decision ก่อน lock contract:**
  - **SR-F003-01 (High → D-XXX, user):** กฎ reset ⊊ (D-032(5)) ถูกเลี่ยงได้ใน 3 request: Admin ลด Admin อีกคนเป็น Staff → reset → ยกกลับ (AC-5.4 อนุญาตแตะคนที่สิทธิ์ "เท่ากัน")
  - **SR-F003-02 (Medium → D-XXX, product/user):** คำเชิญที่ออกไว้ก่อนผู้เชิญถูกลดสิทธิ์/ถอด ยังผูกคนกับ role ได้ตอน accept = การมอบที่ไม่ผ่าน ⊆ ของสิทธิ์ปัจจุบัน
- **backend-api แก้ในเอกสารได้เอง (ไม่ต้องเป็น decision):** SR-F003-03 (rolling/rollback เปิด NEW-10 กลับมา — "ปลอดภัยทั้ง rolling" ไม่จริง) · SR-F003-04 (อักขระมองไม่เห็นเลี่ยงคำสงวน "เจ้าของร้าน")
- **Low/Info 11 ข้อ** — แก้ตอน build หรือรับเป็นความเสี่ยงได้ ไม่บล็อก
- **ยืนยันจากโค้ดแล้ว (ถูกต้อง):** token ไม่พกสิทธิ์ · middleware อ่านสิทธิ์จาก DB ทุก request · route สมาชิก/คำเชิญ/accept อยู่ใต้ org lock ทั้งหมด · admin-reset มีจุดสร้าง 404 จุดเดียว · `isOwnerRole` ใช้ capabilities ไม่ใช้ key

---

## Security review — F-003 RBAC (spec, Gate 2)
Verdict: **ready-with-recommendations → ⚠️ lock ได้หลังแก้ SR-F003-01..04**
(advisory — backend-api/user ตัดสินว่าจะรับข้อไหน)

วิธีทำ: ผมสร้าง threat model จาก AC ของ Gate 1 ก่อน แล้วจึงอ่าน claim ในเอกสาร จากนั้นตรวจกับโค้ดที่ ship แล้ว
(`packages/core-domain/src/orgs/{member-authz,owner-invariant,admin-reset-authz}.ts`, `auth/capabilities.ts`, `auth/access-claims.ts`,
`apps/api/src/auth/auth.service.ts` (adminResetPassword), `apps/api/src/orgs/{members,invitations}.service.ts`,
`apps/api/src/tenancy/org-context.middleware.ts`, `packages/db/prisma/schema.prisma`)

### Findings (เรียงตาม severity)

#### SR-F003-01 · High · กฎ reset ⊊ เลี่ยงได้ด้วยการลดสิทธิ์ → reset → ยกสิทธิ์คืน
- **ที่:** architecture §1 (`decideRoleGrant` ข้อ 3, `decideAdminReset`) · api-spec §4.3 · AC-5.4 × AC-5.5
- **ปัญหา:** AC-5.4 และ `decideRoleGrant` ใช้ **⊆** (เท่ากันก็ผ่าน) กับการเปลี่ยน role/ถอดสมาชิก แต่ AC-5.5 ใช้ **⊊** กับการ reset
  ช่องว่างระหว่างสองกฎนี้ทำให้ทางอ้อมเปิดอยู่
- **สถานการณ์โจมตี:** Admin A กับ Admin B อยู่ร้านเดียว (B ไม่ได้อยู่ร้านอื่น ดังนั้น C-2 ไม่ทำงาน)
  1. `PATCH /members/B {roleId: Staff}` → role ปัจจุบันของ B (Admin) ⊆ A ✓ และ Staff ⊆ A ✓ → 200
  2. `POST /members/B/reset-password` → Staff ⊊ Admin ✓ → 200 (`revokeAllForUser` เตะ B ออกจากทุกอุปกรณ์)
  3. `PATCH /members/B {roleId: Admin}` → 200
  ผล: A รู้รหัสผ่านของบัญชี Admin B และสวมรอยได้ (การกระทำทุกอย่างจะถูกบันทึกเป็น B) นี่คือกรณีที่ AC-5.5b ตั้งชื่อไว้ตรง ๆ ว่าต้องได้ 404
  test regression "Admin→Admin เท่ากัน = 404" จะเขียว แต่คุณสมบัติที่ test นี้ตั้งใจปกป้องกลับไม่จริง
- **ข้อเสนอ (เลือกหนึ่ง):**
  (ก) admin-reset ปฏิเสธถ้า role ของเป้าหมายถูกเปลี่ยนโดยคนที่ไม่ใช่ Owner ภายใน N ชม. ต้องเพิ่ม `Membership.roleChangedAt/ByUserId` (additive) แล้ว `decideAdminReset` รับ fact นี้เพิ่ม
  (ข) AC-5.4 ใช้ ⊊ กับ "แตะคนอื่น" (Admin แก้/ถอด Admin ด้วยกันไม่ได้) ⇒ ปิดได้หมด แต่เปลี่ยนพฤติกรรม F-002 มากกว่า
  (ค) รับความเสี่ยงไว้ + emit event ที่เชื่อมกันได้ (role_changed→reset→role_changed ภายใน N นาที) — ตรวจจับได้เท่านั้น ป้องกันไม่ได้
- **ต้องเป็น D-XXX ✅ — owner: user** (Type 1, แก้ความหมายของ D-032(5)) · qa ต้องเพิ่ม int test ที่ระบุชื่อ 3 ขั้นนี้ตรง ๆ

#### SR-F003-02 · Medium · คำเชิญที่ออกไว้ก่อน ยังมอบ role ได้หลังผู้เชิญเสียสิทธิ์ (accept ไม่ผ่านกฎ ⊆)
- **ที่:** architecture §1 (`canAcceptInvitation`), §6 · api-spec §4.3 แถว accept · AC-5.3 (ระบุแค่ assign/create/reissue)
- **ปัญหา:** คำเชิญคือการมอบสิทธิ์ที่ถูกเลื่อนเวลาออกไป ตอนนี้ตรวจอำนาจของผู้เชิญแค่ตอนสร้างคำเชิญ ตอน accept (`invitations.service.ts` ~L697–790) ตรวจแค่สถานะ/อายุ/email
  I-1 ของ D-028 กันได้เฉพาะ email **เดียวกับ**สมาชิกที่ถูกถอด ส่วน DELETE member ยกเลิกเฉพาะคำเชิญ**ของ email เป้าหมาย** ไม่ได้ยกเลิกคำเชิญที่เป้าหมาย**เป็นคนออก**
- **สถานการณ์:** Owner สงสัย Admin A จึงลด A เป็น Staff (หรือถอดออก) แต่ A ออกคำเชิญ role Admin ไปที่ `alt@` ไว้ก่อนแล้ว (อายุ 24 ชม.) → A accept ด้วยบัญชี alt → ได้ Admin กลับมา
  ในจอคำเชิญ Owner อาจยกเลิกทันก็ได้ แต่ไม่มีอะไรเตือน
- **ข้อเสนอ:** ในการ accept ภายใต้ org lock ให้เรียก `decideRoleGrant` กับ membership **ปัจจุบัน**ของ `invitedByUserId` ถ้าผู้เชิญไม่ active หรือ role ⊄ ผู้เชิญ → `INVITATION_INVALID` (รูปเดิม)
  อีกทาง: ใน tx ของ revoke/PATCH member ให้ยกเลิกคำเชิญ pending ที่ `invitedByUserId = target` และ role ⊄ สิทธิ์ใหม่ของเขา
  ราคาที่ต้องจ่าย: คำเชิญที่ Admin ซึ่งลาออกไปแล้วเป็นคนออกจะใช้ไม่ได้ (ผมเห็นว่าทิศทางนี้ถูกต้อง)
- **ต้องเป็น D-XXX ✅ — owner: product → user** (ขยาย AC-5.3 ให้ครอบ accept + เปลี่ยนพฤติกรรม accept ที่ ship แล้ว)

#### SR-F003-03 · Medium · rolling deploy / rollback เปิด NEW-10 กลับมา — claim "ปลอดภัยทั้ง rolling และ stop-start" ไม่จริง
- **ที่:** data-model §4.3, §4.4 · architecture §12
- **ปัญหา:** §4.4 นับเป็นความเสี่ยงไว้แค่ "dropdown F-002 เห็น role ที่ลบแล้ว" แต่ระหว่างที่มีโค้ดสองรุ่นรันพร้อมกัน instance F-002 **ไม่มีกฎ ⊆ ไม่มี ⊊ และไม่กรอง `deletedAt`**
- **สถานการณ์:** Owner สร้าง custom role "การเงิน" `{manage_billing}` บน instance F-003 → Admin ยิง `PATCH /members/{ตัวเอง} {roleId: การเงิน}` แล้ว load balancer ส่งไป instance F-002
  `canAssignRole` เดิมผ่าน (ไม่ใช่ `full_access`) → Admin ยกสิทธิ์ตัวเองได้ · ในช่วงเดียวกัน admin-reset Admin→Admin ก็ยังผ่านบน F-002
  rollback โค้ดกลับ F-002 **หลังมีการสร้าง/แก้ role** ให้ผลเหมือนกันทุกประการ (§4.3 บอกแค่ว่า "ก่อนมีการลบ = ✅")
- **ข้อเสนอ:** แยก release เป็นสองขั้น: (1) ส่งกฎ ⊆/⊊ + live-filter + migration ไปก่อน โดยปิด route เขียน role ไว้ด้วย flag (`ROLE_WRITES_ENABLED=false`) (2) เปิด flag หลังทุก instance อยู่รุ่น F-003
  แก้ §4.3: "rollback หลังมีการสร้าง/แก้ role ใด ๆ = ไม่ปลอดภัย" · แก้ §4.4 ให้ระบุความเสี่ยงนี้
- **D-XXX ไม่จำเป็น** — backend-api แก้เอกสาร · **devops** รับเงื่อนไข flag ไปไว้ใน trigger การตัดสิน rolling

#### SR-F003-04 · Medium · อักขระมองไม่เห็น/bidi เลี่ยงคำสงวน "เจ้าของร้าน" และ unique ชื่อ
- **ที่:** data-model §2.1 (`normalizeRoleName`, `reservedRoleNames`), §3.1 CHECK `Role_name_shape` · api-spec §5 `ROLE_NAME_TAKEN`
- **ปัญหา:** normalize ทำแค่ NFC → trim → ยุบ whitespace ซึ่งไม่ตัด U+200B/200C/200D/2060/FEFF (กลางคำ) หรือ bidi controls U+202A–202E/2066–2069 และ CHECK ใน DB ก็ไม่กัน
- **สถานการณ์:** ผู้ถือ `manage_roles` สร้าง role ชื่อ `"เจ้า​ของร้าน"` ที่แสดงผลเหมือน "เจ้าของร้าน" ทุกไบต์ที่ตาเห็น แล้วมอบให้ลูกน้อง → รายชื่อสมาชิกแสดงว่าคนนั้นเป็น "เจ้าของร้าน" = ตรงกับการหลอกที่ AC-3.5 ตั้งใจกัน
  ใช้แบบเดียวกันสร้าง role ที่หน้าตาซ้ำกับ "พนักงาน" แต่มีสิทธิ์มากกว่า เพื่อหลอกให้ Owner มอบผิดตัวได้ด้วย
- **ข้อเสนอ:** `validateRoleName` ปฏิเสธ code point ในหมวด Cc/Cf (รวม ZW* และ bidi) → `VALIDATION_FAILED` + เพิ่ม CHECK ใน DB ที่ตรงกัน (`name !~ '[​-‏‪-‮⁠-⁩﻿]'`) · unit fixture ต่อ code point
  ไม่ขัดกับที่ ux ตัดสินว่า "ไม่จับคำคล้าย" เพราะนี่คือชื่อ**ที่แสดงผลเหมือนกันทุกประการ** ไม่ใช่แค่คล้าย · (ทางเลือกเสริม: ปฏิเสธสระ/วรรณยุกต์ไทยที่ซ้อนซ้ำ — Low)
- **D-XXX ไม่จำเป็น** — backend-api (+ux รับทราบ copy ของ error)

#### SR-F003-05 · Low · admin-reset ล็อก `Role` แต่ไม่ล็อก `Membership` — roleId ที่อ่านก่อนล็อกอาจเก่า
- **ที่:** architecture §3 แถว admin-reset
- **ปัญหา:** ต้องอ่าน membership ก่อนถึงจะรู้ `callerRoleId/targetRoleId` แล้วค่อย `FOR SHARE` บน Role · แต่ PATCH member (เปลี่ยน `roleId`) ไม่แตะแถว Role ⇒ ไม่ชนกับ FOR SHARE และไม่ถูก serialize กับ reset
  re-check หลัง write (NEW-5ก) ยังเหลือช่องหลังการอ่านรอบสองจนถึง commit · ช่องนี้ถูก SR-F003-01 ครอบไปแล้วในทางปฏิบัติ แต่ claim "reset ไม่ตัดสินบน caps ที่กำลังเปลี่ยน" จริงแค่ครึ่งเดียว
- **ข้อเสนอ:** `SELECT … FROM "Membership" WHERE (organizationId, userId) IN (…) ORDER BY userId FOR SHARE` ก่อน Role (ลำดับ User → Membership → Role ยังเป็น DAG เพราะ member write = Org → Membership และไม่ย้อนไปล็อก User) · ให้ qa เพิ่ม concurrency case
- **ไม่ต้องเป็น D** — backend-api

#### SR-F003-06 · Low · trigger ตาข่าย soft-delete มี write-skew ภายใต้ READ COMMITTED
- **ที่:** data-model §3.3 (`role_soft_delete_guard`, `role_live_reference_guard`)
- **ปัญหา:** trigger สองตัวต่างก็อ่านอีกตารางโดยไม่ล็อกแถว · FK check ใช้ `FOR KEY SHARE` ซึ่งไม่ชนกับ `UPDATE deletedAt` (NO KEY UPDATE) ⇒ tx สร้าง membership กับ tx ลบ role ที่ commit พร้อมกันจะผ่านทั้งคู่
  ทุกเส้นทางวันนี้อยู่ใต้ org lock จึงยังปลอดภัย แต่เอกสารบอกว่าตาข่ายนี้มีไว้สำหรับ "เส้นทางในอนาคตที่ลืม" ซึ่งก็คือเส้นทางที่น่าจะลืม org lock ด้วยพอดี
- **ข้อเสนอ:** ใน `role_live_reference_guard` ให้อ่าน Role ด้วย `FOR SHARE` (ชนกับ NO KEY UPDATE) · int concurrency test 1 เคส
- **ไม่ต้องเป็น D**

#### SR-F003-07 · Low · ชั้น DB ไม่กัน custom role → `isSystem=true` + `full_access`
- **ที่:** data-model §3.1/§3.3 · architecture §2 "ชั้น 4"
- **ปัญหา:** `role_system_row_lock` ทำงานเฉพาะ `WHEN OLD."isSystem"` และ CHECK `full_access ⇒ isSystem` ⇒ `UPDATE "Role" SET "isSystem"=true, capabilities='{full_access}' WHERE id=<custom>` ผ่านทุกชั้นของ DB
  (ทางแอปถูกกันด้วย whitelist + branded type อยู่แล้ว ข้อนี้เป็นเรื่องความครบของ defense-in-depth)
- **ข้อเสนอ:** trigger ห้าม `isSystem` false→true · partial unique `("organizationId") WHERE "isSystem"` (1 system role ต่อร้าน — ข้อมูลวันนี้ตรงอยู่แล้ว) · pre-flight ใน §4.1 ตรวจเงื่อนไขนี้
- **ไม่ต้องเป็น D**

#### SR-F003-08 · Low · `decideRoleWrite` ไม่มี floor `manage_roles` จากสิทธิ์ที่อ่านใน tx
- **ที่:** architecture §1 (`decideRoleWrite`), §2 ขั้น 2–4
- **ปัญหา:** gate `manage_roles` อยู่ที่ ALS (อ่านตอนต้น request) ส่วนใน tx ตรวจแค่ ⊆ · request ที่ผ่าน middleware แล้วมารอ org lock อยู่ จะยังทำงานต่อได้หลัง Owner ถอด `manage_roles` ออกแล้ว (แม้จะถูกจำกัดด้วย ⊆ ของสิทธิ์ใหม่)
  ไม่ตรงกับหลัก AC-5.7 และไม่สมมาตรกับ floor `manage_members` ของ `canAssignRole`/`decideRoleGrant`
- **ข้อเสนอ:** `decideRoleWrite` ปฏิเสธถ้า `!hasCapability(actorFresh, manage_roles)` → `FORBIDDEN` + เพิ่มแถวใน matrix
- **ไม่ต้องเป็น D**

#### SR-F003-09 · Low · `lastEdited.by.roleName` ระบุตัวคนได้เมื่อ role มีผู้ถือคนเดียว + join ต้อง org-scoped
- **ที่:** api-spec §3 `lastEdited.by` · data-model §2.1 · F-003 §5 (Q-P1 ที่ user ตัดสิน 2026-09-27)
- **ประเมินตามคำตัดสินของ user:** คนที่เห็น field นี้คือผู้ถือ `manage_roles` เท่านั้น (`/role-details`, `/roles/{id}`) ส่วน `GET /roles` ที่ทุกคนเห็นไม่มี field นี้ ⇒ ผู้ดูที่ไม่มี `manage_roles` เห็นไม่ได้
  ชื่อบทบาทไม่เผย capability (ผู้ดูอ่าน caps ของทุก role ได้อยู่แล้ว) ⇒ **ไม่ขัด AC-6.4**
  แต่ `RoleDetail.usage.activeMembers` แสดงอยู่ข้างกัน ⇒ ถ้า role ของผู้แก้มีคนถือคนเดียว ในร้าน 3–10 คนก็รู้ทันทีว่าเป็นใคร ข้อความใน §5 ที่ว่า "ไม่มีตัวระบุบุคคล" จึงไม่แม่นยำ (ความเสียหายต่ำ — ผู้ดูเป็นระดับผู้ดูแลอยู่แล้ว)
- **ความเสี่ยงที่ใหญ่กว่า (ระดับ implementation):** ถ้า join `Membership(userId=lastEditedByUserId)` ลืมกรอง `organizationId` ชื่อ role ของ**ร้านอื่น**ที่ผู้แก้สังกัดจะรั่วข้ามร้าน (กฎทอง 3)
- **ข้อเสนอ:** product รับทราบ/แก้ถ้อยคำ §5 · qa เพิ่ม int: ผู้แก้ที่ถูกถอดจากร้าน A แต่ active ในร้าน B → ต้องได้ `former_member` และไม่มีชื่อ role ของ B · join ผ่าน ORG_PRISMA เท่านั้น
- **ไม่ต้องเป็น D** (product ack)

#### SR-F003-10 · Low · bridge trigger = ให้ capability ตาม `key` ตอน runtime และยังไม่มีเจ้าของที่รับผิดชอบการถอด
- **ที่:** data-model §4.2 (`role_f003_admin_bridge`)
- **ปัญหา:** ผมยอมรับเหตุผลที่ใช้ `key` ใน backfill ได้ (key + caps ตรงชุดเป๊ะ, fail-closed) แต่ bridge คือ**กฎ runtime** ที่ทำงานกับทุก INSERT ตราบที่ยังอยู่ และอยู่นอกขอบเขตที่ G-12 scan (`apps/*`)
  คำว่า "ถอดใน feature ถัดไปที่แตะ Role" ไม่มี owner และไม่มี trigger ที่จับต้องได้ ⇒ ถ้าวันหน้ามีฟีเจอร์ "คืนค่า role มาตรฐาน" insert Admin แบบ F-002 ก็จะได้ `manage_roles` ไปเงียบ ๆ
- **ข้อเสนอ:** เพิ่มแถว forward-commitment ที่มี trigger ชัด ("หลัง rollout F-003 เสร็จ — devops ยืนยัน") + test ใน `packages/db` ที่แดงเมื่อ trigger ยังอยู่หลังวันที่/flag ที่กำหนด หรือทำแบบง่ายกว่า: ถอดใน migration ถัดไปของ F-003 เอง
- **ไม่ต้องเป็น D**

#### SR-F003-11 · Low · Owner bypass ใน `decideRoleGrant` ไม่ชัด + key ที่ไม่รู้จักทำให้ Owner จัดการสมาชิกไม่ได้
- **ที่:** architecture §1 (`expandCapabilities` "key ที่ไม่รู้จักคงไว้", `decideRoleGrant`)
- **ปัญหา:** `expand(full_access)` = key ใน registry ⇒ role ที่มี key ค้าง (ถูกลบออกจาก registry) จะ ⊄ Owner · `decideRoleWrite` ระบุ bypass ของ `full_access` ไว้ แต่ `decideRoleGrant` ไม่ได้ระบุ ⇒ Owner อาจเปลี่ยน role/ถอดสมาชิกที่ถือ role นั้นไม่ได้ (AC-5.6 บอกว่า Owner ผ่าน ⊆ ทุกข้อ)
  นอกจากนี้ registry ห้ามลบ key แต่**ไม่ได้ห้ามลบเส้น `implies`** · role เก็บแบบ canonical (ตัด `view_X` ทิ้งแล้ว) ⇒ ถ้าลบเส้น implies ภายหลัง ผู้ถือจะเสีย `view_X` ไปเงียบ ๆ
- **ข้อเสนอ:** เขียน `full_access ⇒ ok` ที่ขั้น ⊆ ของ `decideRoleGrant` ให้ชัด (หลังตรวจ `owner_only`) + matrix แถว "role มี key ที่ไม่รู้จัก" · snapshot test ของเส้น implies ที่ ship แล้ว (ลบ = แดง)
- **ไม่ต้องเป็น D**

#### SR-F003-12 · Low · abuse/DoS: rate limit ยังเป็นแค่ข้อเสนอ, แถว soft-delete ไม่มีเพดาน, event ปฏิเสธถูกยิงถล่มได้
- **ที่:** architecture §10 ("**เสนอ** 30 write / 10 นาที"), §7 · data-model §2.2
- **ปัญหา:** เพดาน 30 นับเฉพาะ role live ⇒ วนสร้าง/ลบซ้ำได้ไม่จำกัด = แถว soft-delete เพิ่มไม่รู้จบ + ยึด org lock ของร้าน (member/accept ได้ `409 busy`) · ผู้ถือ `manage_members` ยิง `ROLE_EXCEEDS_ACTOR` ซ้ำ ๆ จนสัญญาณ `escalation_denied` จมได้ (ใช้ได้แค่ในร้านตัวเอง)
- **ข้อเสนอ:** pin ค่า rate limit บน route role (U-CFG) แทนการเขียนว่า "เสนอ" · ใช้ org rate-limit เดิมกับ route สมาชิก/คำเชิญที่เพิ่ม refusal ใหม่ · (ทางเลือก) เพดานการลบต่อวัน
- **ไม่ต้องเป็น D**

#### SR-F003-13 · Info · ความพยายามแก้ role Owner ของคนที่ไม่ใช่ Owner ไม่มี event
- **ที่:** architecture §7 (ไม่ emit สำหรับ `ROLE_LOCKED`)
- **ข้อเสนอ:** ถ้า actor ไม่ถือ `full_access` แล้วโดน `ROLE_LOCKED` → `org.role.escalation_denied` reason `role_locked` (Owner ที่กดพลาดไม่ต้องยิง) · ต้องปรับตัวนับ `ESCALATION_CHECKED_OPERATIONS` ตาม — backend-api เลือก

#### SR-F003-14 · Info · `409 ROLE_CHANGED details.currentVersion` เปิดทางให้ client retry อัตโนมัติ (= last-write-wins)
- **ข้อเสนอ:** api-spec ระบุ "client MUST re-fetch และแสดงความต่าง ห้าม resubmit ด้วย currentVersion อัตโนมัติ" · qa/frontend test ว่า client ไม่ retry — owner @frontend/@qa

#### SR-F003-15 · Info · capability "เร็ว ๆ นี้" ที่ติ๊กไว้ล่วงหน้าจะมีผลเงียบ ๆ ทันทีที่ feature เปิด
- AC-7.5 รับไว้โดยเจตนาแล้ว · ข้อเสนอให้ product: Gate 2 ของ feature ที่พลิก `upcoming→live` (โดยเฉพาะ `manage_billing`) ต้องมี release note/ตัวนับ "role ที่ถือสิทธิ์นี้อยู่แล้ว" ให้ Owner เห็น — ไม่บล็อก F-003

### ตรวจตามโฟกัสที่ได้รับ (สรุปผลที่ไม่ได้เป็น finding)
- **กฎ ⊆ มีสำเนาเดียว:** มี — `decideRoleWrite`/`decideRoleGrant`/`decideAdminResetVisible` อยู่ใน `core-domain/rbac` และ `canAssignRole` เหลือเป็น wrapper · clone ไม่มี endpoint แยก (ถูกต้อง) · rename ผ่าน `decideRoleWrite` · implies เทียบหลังขยายทั้งสองฝั่ง · upcoming นับใน ⊆ · backfill ไม่ยกสิทธิ์ใครเกิน preset ✓
- **Owner ≥ 1 ทั้ง 4 ชั้น:** ครบตามที่อ้าง · การแก้ role พร้อมกับย้ายสมาชิก หรือ 2 request ขนาน ถูก serialize ด้วย org lock (ยืนยันแล้วว่า `updateMemberRole/revokeMember/leave/createInvitation/reissue/cancel/accept` ใช้ `runInOrgLockTransaction`) ✓ · migration มี RAISE ✓ · ข้อที่ขาดอยู่ที่ SR-07 (ชั้น DB)
- **Deadlock:** role write = Org→Role · member = Org→Membership · reset = User→Role ⇒ DAG ✓ (ถ้ารับ SR-05 ลำดับจะเป็น User→Membership→Role ซึ่งยังเป็น DAG)
- **404 non-oracle ของ admin-reset:** refusal ⊊ เข้าจุดสร้าง 404 จุดเดียว หลัง argon2 เหมือนกันทุกกรณี ✓ · `viewerCanResetPassword` ส่งเฉพาะผู้ถือ `manage_members∧manage_roles` และไม่รับ input C-2 ✓ · หมายเหตุ: "true แล้วได้ 404 ⇒ C-2" เป็นการอนุมานที่ทำได้**ตั้งแต่ F-002** (Admin→non-Owner non-self ได้ 404 ได้จาก C-2 เท่านั้น) และต้องลองจริงซึ่งถ้าสำเร็จจะเปลี่ยนรหัสผ่าน ⇒ field ใหม่ไม่ได้ทำให้แย่ลง
- **ช่อง oracle ใหม่:** `viewerCanAssign/assignBlockedReason` (ส่งเฉพาะผู้ถือ `manage_members`) ให้ข้อมูล 1 บิต "role ⊆ ฉัน" ต่อ role ซึ่ง AC-2.2 กำหนดให้มีอยู่แล้ว และไม่มี reason ที่บอก capability ✓ · `ROLE_EXCEEDS_ACTOR` ไม่มี details ✓ · `lostCapabilities` ใช้กับ role ของตัวเองเท่านั้น ✓ · `lastEdited.by` → SR-09
- **Cross-org:** roleId ของร้าน B → 404 ผ่าน ORG_PRISMA + composite FK (B-1) ✓ · `?roleId=` ร้านอื่นได้ 200 หน้าว่าง (ไม่เป็น oracle) ✓ · `/capabilities` เป็น org-scoped + อยู่ใน leak kit ✓
- **Token/cache:** `AccessTokenClaims = {sub,iat,exp,jti,typ}` (ยืนยันแล้ว) · middleware `findUnique` ทุก request ✓ · sync-back ของ backend.md ("cache Redis TTL 60s") **ต้องทำจริง** ไม่งั้นเอกสารสถาปัตยกรรมจะชวนให้ใครสักคนเพิ่ม cache
- **Event PII:** มีแค่ id + ชื่อ role + caps ✓ · ชื่อ role อาจเป็นชื่อคน (§5 รับไว้แล้ว)

### Strengths (ต้องรักษาไว้)
- ใช้ทั้ง org lock **และ** `version` (แยกเหตุผลได้ถูก: race ระหว่าง tx กับกรณีคนหลังเขียนทับสิ่งที่ไม่เคยเห็น)
- ลำดับให้ `owner_only` มาก่อน `exceeds_actor` ⇒ ทุกกรณีที่ F-002 เคยปฏิเสธยังได้คำตอบเดิมทุกไบต์
- `ValidatedCapabilities` แบบ branded + fixture `@ts-expect-error` + G-15 ที่ถูกแทนด้วยเทสต์ self-check สองทาง
- `assertOwnerRemains` ทำงานแยกจากผลของ `decideRoleWrite` + ใช้ DI seam `ROLE_WRITE_DECIDER` เพื่อพิสูจน์ว่าแดงได้จริง (int ต้องได้ 409 ไม่ใช่ 500)
- backfill ใช้ key + caps ตรงชุดเป๊ะ (fail-closed), idempotent, bump version, และมี Owner ≥ 1 RAISE
- middleware ทำ fail-closed เมื่อ membership ชี้ไปที่ role ที่ถูกลบ · clamp อายุคำเชิญ "ย่นได้อย่างเดียว" + ตรวจซ้ำตอน accept
- ตั้งใจไม่ส่ง `viewerCanResetPassword` ให้ผู้ถือ `manage_members` ที่ไม่มี `manage_roles` พร้อมเหตุผลเรื่องการรั่วกรณี "เท่ากัน" ที่ถูกต้อง

### Questions to route (ไม่เดาเอง)
- **@user (ผ่าน PM):** SR-F003-01 — เลือก (ก) cool-down / (ข) ⊊ สำหรับแตะคนอื่น / (ค) รับความเสี่ยง + ตรวจจับ
- **@product → @user:** SR-F003-02 — accept ต้องตรวจอำนาจ**ปัจจุบัน**ของผู้เชิญไหม (ขยาย AC-5.3)
- **@devops:** SR-F003-03 — รับเงื่อนไข "เปิด route เขียน role ด้วย flag หลัง rollout ครบ" ไว้ใน trigger การตัดสิน rolling
- **@product:** SR-F003-09 — รับทราบว่า roleName + usage=1 ระบุตัวคนได้ (แก้ถ้อยคำ §5)

### Verdict
**⚠️ lock ได้หลังแก้ SR-F003-01, SR-F003-02 (decision), SR-F003-03, SR-F003-04 (backend-api แก้เอกสาร)** · Low/Info ทำตอน build หรือบันทึกเป็นความเสี่ยงที่รับได้
