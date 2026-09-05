# Retro Ledger — friction log ระหว่างงาน + micro-retro ท้ายทุก feature (append-only)

> PM เขียน **5 บรรทัด** หลังผ่าน Gate F ของทุก feature — จุดประสงค์เดียว: ให้ *process* ปรับปรุง
> ตัวเองได้โดยไม่ต้องรอ user จุดประเด็น · เจอ pattern เดิม **ซ้ำ 2 feature** = PM เสนอแก้ workflow
> เข้า [team-upgrade-plan](superpowers/plans/2026-07-04-team-upgrade-plan.md) (Type 2 → `[auto]` ได้ · แตะ gate/กติกาหลัก = Type 1 รอ user)
> ไฟล์นี้ append-only เหมือน [DECISIONS.md](DECISIONS.md) — ไม่แก้ retro เก่า

## Friction log — จด**ทันทีที่เจอ** ระหว่างงาน (1 บรรทัด/เหตุการณ์ อย่ารอจบ feature)
PM เจออาการต่อไปนี้เมื่อไหร่ → append 1 บรรทัดที่ section ของ feature ทันที
(`YYYY-MM-DD · @agent · <อาการ> · <กติกา/step ที่เกี่ยว>` — **tag @agent เสมอ** เพื่อให้
group by ทีมได้ตอน retro: อาการเดียวกันจาก agent เดิมซ้ำๆ vs กระจายทุกทีม = การวินิจฉัย
คนละโรค — อย่างแรกแก้ที่ agent นั้น อย่างหลังแก้ที่ workflow กลาง)
— นี่คือสัญญาณว่า **rulebook หนักเกิน/ขาด/ไม่ถูกอ่าน** ที่ตัวเลขจะไม่โกหก:

| อาการที่เฝ้าดู | บ่งบอกอะไร |
|---|---|
| builder ละเมิดกติกาที่**มีเขียนไว้แล้ว** (เช่น ลืม org filter ทั้งที่อยู่ใน ref) | กติกาไม่ถูกอ่าน = ref ยาวเกิน/กติกาอยู่ผิดที่ — **ไม่ใช่**แก้ด้วยเพิ่มกติกา |
| task bounce (review ตีกลับ → แก้ → ส่งใหม่) เกิน 1 รอบ | spec/ref ไม่พอ หรือ task ใหญ่เกิน sizing |
| 🚧 BLOCKED ถามสิ่งที่**มีคำตอบใน ref อยู่แล้ว** | ref ยาวจนไม่ถูกอ่านจริง — ตัด section ให้แคบลง |
| report ไม่ครบ format / proof ปลอมๆ (คำสั่งไม่ตรง output) | model tier ต่ำเกินสำหรับงานนั้น หรือ format ซับซ้อนไป |
| reviewer เจอ defect ที่กติกาข้อหนึ่ง**ควรกันได้แต่ไม่ได้กัน** | กติกามีแต่ไม่ทำงาน → ย้ายขึ้น enforcement ladder (B9) |
| PM เองต้องอ่าน/อธิบายซ้ำเกิน 2 รอบก่อน dispatch จะเข้าใจ | brief template มีปัญหา ไม่ใช่ model โง่ |
| กติกาข้อไหน**ไม่เคยโผล่ใน friction log เลยทั้ง phase** | candidate ตัดทิ้งตอน rulebook scan |

**จังหวะ report ให้ user:** ทันที = เฉพาะเรื่องที่ block งานหรือเสี่ยงเงิน/ข้อมูล · จบ feature =
micro-retro สังเคราะห์จาก friction log (ไม่ใช่จากความจำ) · ซ้ำ 2 feature = ข้อเสนอแก้ workflow
พร้อมหลักฐานจาก log · จบ phase = สรุปภาพรวม + rulebook scan (B9)

## Learning loop — บทเรียนต้อง "ไปลงไฟล์ที่ถูกอ่านตอนทำงาน" ไม่ใช่กองอยู่ที่นี่
RETRO/friction log คือ**ที่จับ** ไม่ใช่**ที่อยู่**ของบทเรียน — ตอนปิด retro/scan PM ต้อง route
บทเรียนแต่ละข้อไปยังปลายทางตามชนิด (บทเรียนที่ไม่ถูก route = ไม่ได้เรียนรู้):

| ชนิดปัญหา (วินิจฉัยจาก log) | บทเรียนไปลงที่ | Type |
|---|---|---|
| agent ทำผิดเพราะ**ไม่รู้วิธี** (ทำถูกถ้ามีตัวอย่าง) | skill ที่เกี่ยว หรือ exemplar (per-app CLAUDE.md ชี้โค้ดต้นแบบ) | 2 `[auto]` |
| **agent ตัวเดิมพลาดแบบเดิมซ้ำ ≥2 ครั้ง** (เช่น frontend ไม่ reuse component, ตกหล่น spec รูปแบบเดิม) | section **"Known pitfalls"** ใน `.claude/agents/<agent>.md` (PM เขียน — โหลดทุก dispatch ของ agent นั้น ตรงเป้า ไม่เปลือง context ทีมอื่น) + เพิ่มข้อเช็คใน review checklist ของงานทีมนั้น · ถ้าเช็คได้ด้วยเครื่อง → enforcement ladder (B9) | 2 `[auto]` |
| ผิดเพราะ**กติกาขาดจริง** (defect ที่ไม่มีกฎไหนกัน) | WEB_TEAM/quality-gate — เพิ่มกฎ | แตะ gate = **1** |
| ผิดเพราะ**กติกามีแต่ไม่ถูกอ่าน/ไม่ทำงาน** | **ห้ามเพิ่มกฎ** — ตัด/ย้าย/ทำให้สั้นลง หรือดันขึ้น enforcement ladder (B9) ให้ CI กันแทน | 2 / B9 |
| **ข้อเท็จจริงโปรเจกต์**เปลี่ยน/ค้นพบใหม่ | canon docs (01/02/design-system) + D-XXX | ตาม protocol |
| บทเรียนเรื่อง**วิธี orchestrate ของ PM เอง** (การแตก task, การเขียน brief, จังหวะ dispatch) | PM memory (persistent, ข้าม session) · ใหญ่/พิสูจน์แล้ว → อัปเดต skill `decompose-plan`/`adversarial-review`/`blindspot-scan` | 2 `[auto]` |
| ปัญหา**ที่ signal table ด้านบนจับไม่ได้** (หลุดมาทางอื่น เช่น user เจอเอง) | เพิ่มแถวใน signal table นี้ — ระบบเรียนรู้วิธีเรียนรู้ | 2 `[auto]` |

**Guardrail สำคัญ:** PM แก้ระบบที่คุมตัวเองได้เฉพาะทาง route ข้างบน + ทุกการแก้ผ่าน Decision
protocol (แตะ gate/กติกาหลัก = Type 1 รอ user เสมอ) — วงจรเรียนรู้ต้องไม่กลายเป็นช่องให้
ระบบคลายกฎตัวเองเงียบๆ

## Format (5 บรรทัด — สั้นกว่านี้ได้ ยาวกว่านี้ต้องมีเหตุผล)
### F-XXX · YYYY-MM-DD
- **ช้าที่:** <step ไหนกินเวลา/วนซ้ำเกินควร เพราะอะไร>
- **กติกาที่ขาด/หนักเกิน:** <กฎที่ควรมีแต่ไม่มี หรือมีแต่ถ่วงงานโดยไม่ได้ผล — หรือ "ไม่มี">
- **Review จับพลาด:** <defect ที่หลุดผ่าน review ไปเจอตอน QA/หลัง merge — หรือ "ไม่มี">
- **Dispatch/model:** <task ที่ bounce กลับ, ★ ที่ควรติดแต่ไม่ได้ติด, model ที่ over/under-kill — หรือ "ตรง">
- **ทำซ้ำ/เลิกทำ:** <สิ่งที่เวิร์กจนควรเป็นมาตรฐาน หรือสิ่งที่ควรเลิก>

---

### F-001 · 2026-07-06
- **ช้าที่:** วน push→CI→fix 5 รอบ เพราะ "green ในเครื่อง" บังหน้าปัญหาจริง (core-domain อ่านไฟล์ด้วย node:fs ในแพ็กเกจ pure, deps ไม่ compile, `test:integration` ไม่เคย wire, เทสต์ XFF ใช้ email ผิด) — DB-backed test **ไม่เคยรันจริง**จนขึ้น CI (host Docker ค้าง + ดิสก์เต็ม). ซ้ำด้วย agent โดน usage-limit ตัดกลางงานหลายรอบ.
- **กติกาที่ขาด:** (1) backlog **ไม่มี feature deploy/hosting** → infra ที่ defer (T-001-13, prod artifact) ไม่มีที่เกาะ (เสนอ F-009). (2) นิยาม "Gate E เขียว" ไม่ได้บังคับว่า DB-backed suite ต้อง**รันจริง** — integration lane แค่ smoke `/health`, `test:integration` ไม่ถูก wire → "code-complete" ปลอมเป็น "tested" ได้.
- **Review จับพลาด:** core-domain fs-purity ผ่าน local build (warm cache) — purity gate จับตอน **clean build ที่ CI** ไม่ใช่ตอน review; และ ★ เทสต์ 2 ตัว (spoofed-XFF, cookie path) เขียนแล้วแต่**ไม่ถูก execute** จน DB CI พร้อม → test bug (email ไม่ valid) ซ่อนอยู่ในนั้น.
- **Dispatch/model:** ★ tagging เวิร์ก (จับ Critical จริง: trust-proxy, cookie-path). cross-artifact defect (cookie Path ปะทะ `/api` proxy prefix) ต้องใช้ **client-security ★ pass แยก** ถึงเจอ — backend/frontend เดี่ยวๆ ไม่เจอ. agent usage-limit → PM ทำ CI-fix ทั้ง 6 commit เองใน main session.
- **ทำซ้ำ/เลิกทำ:** **KEEP** — push ขึ้น CI จริงเพื่อไล่ภาพลวง "green ในเครื่อง" (เจอบั๊กจริง 5 ตัว) · **KEEP** — client-security ★ pass แยกจาก backend review · **STOP** — เคลม Gate E ผ่านทั้งที่เทสต์ยัง unrun; ต้องบังคับ DB-backed suite execute จริงใน CI = นิยามของ gate.

> **Routing (learning loop):** (a) "Gate E ต้องมี DB-backed test รันจริง ไม่ใช่แค่ /health smoke" → เสนอแก้ **quality-gate/WEB_TEAM Gate E** (Type 1 — รอ user เคาะ). (b) "ไม่มี deploy feature" → **product** สร้าง F-009. (c) "green ในเครื่อง ≠ tested; push CI เร็วเพื่อ flush illusion" → **PM memory** (orchestration lesson).

### F-002 · 2026-08-25
- **ช้าที่:** วน push→CI ยาวมากเพราะเลนที่ช้าที่สุด (emulator) **ถูก push ของเราเองยกเลิกสองครั้ง** (`cancel-in-progress`) ⇒ เลนเดียวที่รันแอปจริงบนเครื่องจริงไม่เคยจบสักที · และ `e2e-web` ค้างที่ขั้นดาวน์โหลดเบราว์เซอร์ **68 นาที** โดยไม่มีใครรู้ เพราะ `ci.yml` **ไม่มี `timeout-minutes` เลยสักที่** ⇒ เลนที่ค้างไม่รายงานอะไรเลย ไม่แดง ไม่เขียว หายไปเฉย ๆ
- **กติกาที่ขาด:** Gate E บังคับ "เทสต์ต้องรันจริง" (บทเรียน F-001) แต่**ไม่ได้บังคับว่าเลนต้อง *จบ*** — และ `--passWithNoTests` ยังนั่งอยู่บน `web` (41 ไฟล์เทสต์) กับ `packages/contracts` (3 ไฟล์ ซึ่งเป็น guard ทั้งหมด) ⇒ glob พังเมื่อไหร่ก็เขียวโดยรัน 0 เทสต์ — รูปเดียวกับ I-37 เป๊ะ ในที่ที่ไม่มีใครมอง
- **Review จับพลาด:** spec review 41 ข้อ + security review 3 ฉบับ ไม่เจอบั๊กที่ **เลนของจริงเจอ 13 ตัว** (B-1..B-13) — ทุกตัวมี unit suite เขียวทับอยู่ตอนที่มันพัง · หนักสุด 2 ตัวคือ **เจ้าของร้านมองไม่เห็นเมนูตัวเอง** กับ **จอเดียวที่โชว์เลขภาษีตอบ 415 ทุกครั้ง** · และ security review ของ M-07 (user สั่งเพิ่ม) เจอ **Critical** ที่รีวิวเอกสารไม่มีทางเจอ: เลขที่เปิดดูแล้วอยู่ข้ามจอ/ข้ามร้าน/ข้าม session ⇒ *"ทุกการเปิดดูถูกบันทึก"* ของ §3.16 **เป็นเท็จบนมือถือ**
- **Dispatch/model:** ★ tagging + security-reviewer แยกรอบ **คุ้มที่สุดของ feature นี้** — reviewer เขียน probe 7 ตัวยิงจอจริงเพื่อหักล้างข้ออ้าง 6 ข้อของ builder แทนที่จะอ่านโค้ดเฉย ๆ · agent โดน session limit กลางทางหลายใบ (T-002-09/13/17/19) ⇒ PM ทำต่อเอง — **รูปแบบเดิมกับ F-001 ซ้ำเป็น feature ที่สอง**
- **ทำซ้ำ/เลิกทำ:** **KEEP** — guard เชิงโครงสร้างที่อ่าน*โครงสร้าง*ไม่ใช่ assert พฤติกรรม (พฤติกรรม*ถูก*อยู่วันนี้ เทสต์จึงจับไม่ได้) โดยต้องมีครบ 3 อย่าง: non-vacuity · self-check สองทาง · ลิสต์หนี้ที่แดงเมื่อหนี้ถูกใช้คืนแล้ว · **KEEP** — audit "ข้อเท็จจริงที่โค้ด/เอกสารอ้างแต่ไม่มีใครรองรับ" (รอบเดียวเจอ 10) · **STOP** — push ระหว่างเลน emulator ยังรันอยู่ · **STOP** — รันเทสต์*ก่อน*เขียนเอกสารแล้วถือว่าเขียว (guard ที่เพิ่งเขียนจับ commit ถัดมาของตัวเองได้เพราะเรื่องนี้)

> **Routing (learning loop):** (a) "เลนที่ค้าง = ไม่มีผล ไม่ใช่ผลลบ" + `--passWithNoTests` บน workspace ที่มีเทสต์ → **แก้แล้วในโค้ด** (bound ครบ 9 job + ถอด flag) แต่ *นิยาม Gate E ควรพูดถึง "เลนต้องจบ"* → เสนอแก้ **quality-gate/WEB_TEAM Gate E** (Type 1 — รอ user) · (b) "agent โดน session limit กลางงาน ซ้ำ 2 feature" → **team-upgrade-plan** (sizing ของ task ใบเดียว) · (c) "รีวิวเอกสารจับ Critical ของ state ที่มีอายุยืนกว่าจอไม่ได้ — ต้องมี probe ที่รันจริง" → **skill `client-security`** เพิ่มข้อว่า ★ task ที่ render ข้อมูลอ่อนไหวต้องพิสูจน์ด้วยการ*ออกจากจอ/สลับ context/ออกจากระบบ* ไม่ใช่ assert ว่า state ถูกเคลียร์ · (d) "green ในเครื่อง ≠ tested" **โผล่ซ้ำเป็น feature ที่สอง** ในรูปใหม่ (รันก่อนแก้เอกสาร) → PM memory

### F-002 (ภาคสอง) · 2026-09-05 — manual pass §12.2 + B-14..B-18

> ภาคแรก (2026-08-25) เป็นเรื่องของ *เลนอัตโนมัติเจอสิ่งที่รีวิวไม่เจอ* · ภาคนี้เป็นเรื่องของ
> **คนเดินแอปด้วยมือ เจอสิ่งที่เลนอัตโนมัติไม่เจอ** — และมันเป็นคนละชั้นกันโดยสิ้นเชิง

- **ช้าที่:** ไล่ผิดทางหลายรอบตอนล็อกอินมือถือไม่ผ่าน — สงสัย cleartext HTTP ก่อน (ถึงขั้น rebuild ด้วย `usesCleartextTraffic=true` เพื่อพิสูจน์ว่าไม่ใช่) กว่าจะเจอว่า `--dart-define=API_BASE_URL` ไม่เคยถูกต่อเข้า `main.dart` เลย · **ต้นเหตุที่ทำให้ช้าคือ `catch (_)` ใน `login_controller`** ที่กลืน exception ทุกชนิดแล้วรายงานเป็น "เกิดข้อผิดพลาด" ประโยคเดียว ⇒ transport failure กับ 5xx แยกไม่ออก · และเลน Playwright แดง 6 เคสสองรอบ **เพราะ manual pass ของผมเองใช้โควตา throttle หมด** — เกือบอ่านเป็น regression ทั้งสองครั้ง
- **กติกาที่ขาด:** **ไม่มี gate ไหนถามว่า "คนไปถึงจอนี้ได้ไหม"** — ทุก gate ถามว่าโค้ดถูกไหม เทสต์ครบไหม query bound ไหม แต่ไม่มีข้อไหนถามว่า*เปิดมันได้หรือเปล่า* · **B-14** (`/` บนเว็บเป็น placeholder) กับ **B-18** (จอ F-002 บนมือถือทั้งสี่จอมี 0 อ้างอิงใน `lib/`) คือรูเดียวกันบนสองแพลตฟอร์ม และทั้งคู่ถูกเจอโดยคนเปิดแอป ไม่ใช่โดยเลนไหน · **B-16** คมที่สุด: *ปุ่มที่ไม่มีอยู่ ไม่ render อะไร ไม่ assert อะไร ไม่ throw อะไร* — ไม่มีเครื่องมือชนิดไหนใน repo นี้เห็นมันได้
- **Review จับพลาด:** manual pass รอบเดียวเจอ **4 ตัว (B-15..B-18)** โดยที่ **web 363 + api 704 + mobile 451 เขียว · CI 9 job เขียว · browser lane + emulator lane เขียว** ทับอยู่ทั้งหมด · หนักสุดคือ B-18 ซึ่ง `CHANGELOG` ประกาศไปแล้วว่า ship จอมือถือครบ — จอมีจริง ทำงานจริง มีเทสต์จริง **และเปิดไม่ได้** · ที่ต้องพูดให้ตรงคือ E-10 พิสูจน์ได้แค่ว่า*จอทำงานเมื่อมีคนพามันขึ้นมา* ไม่เคยพิสูจน์ว่า*มีใครไปถึงมันได้* — และไม่มีใครสังเกตความต่างนั้นมาสามสัปดาห์
- **Dispatch/model:** ส่งงานให้ agent 3 ทีมพร้อมกันได้ผลจริง (backend-api ปิดรูที่ผมทิ้งไว้เองด้วย: guard เดิมเทียบ client↔contract เลยไม่เห็นตอน server เปลี่ยนชื่อ code) · **แต่รอบแรกตายพร้อมกันทั้งสามใบตอน session limit โดยยังไม่ได้แตะไฟล์** (feature ที่สาม ที่เจอรูปแบบเดิม) · และ **ใบของ ux ไม่มี Bash ในเซสชันเลย ⇒ รันเทสต์ไม่ได้สักตัว** — ตรงนี้ agent รายงานตามจริงว่ารันไม่ได้ ซึ่งถูกต้อง แต่แปลว่า **งานที่ agent ส่งกลับมาต้องถูกรันโดยคนเรียกเสมอ ไม่ใช่บางครั้ง**
- **ทำซ้ำ/เลิกทำ:** **KEEP** — เดินแอปด้วยมือบนเครื่องจริง เป็นวิธีเดียวที่เคยเจอบั๊กชั้น "ไม่มีใครไปถึง" · **KEEP** — สร้าง *control* คู่กับ assertion เสมอ: clipboard preview ขึ้น `••••••` แปลว่าอะไรไม่ได้เลย จนกว่าจะมี control ที่คัดลอกข้อความธรรมดาในแอปเดียวกันแล้วขึ้นเนื้อหาเต็ม · **STOP** — เขียนเทสต์ที่*ชื่อ*สัญญามากกว่าที่ assertion อ่านจริง: `findsNothing` ผ่านทั้งที่ใช้ `IndexedStack` เพราะลูกใน stack ยังอยู่ในทรี ⇒ เทสต์ชื่อ "DISPOSES it" จะรายงานว่า dispose แล้วทับจอที่ยังถือเลขบัตรประชาชนอยู่

> **Routing (learning loop):** (a) **"reachability" ควรเป็นข้อหนึ่งของ gate** — "ทุกจอที่ feature อ้างว่า ship ต้องมีเส้นทางจาก entry point ของแอปไปถึง และมีเทสต์เดินเส้นนั้น" → เสนอแก้ **quality-gate Gate D / WEB_TEAM** (Type 1 — รอ user เคาะ) · (b) agent ใบเดียวไม่มี Bash ⇒ verify ไม่ได้ → **team-upgrade-plan** (นิยาม capability ขั้นต่ำของ agent ที่แก้โค้ด) · (c) `catch (_)` ที่กลืน transport error จนดีบักไม่ได้ → **`apps/mobile/CLAUDE.md`** ควรมีข้อว่า controller ห้าม catch แบบไม่แยกชนิด (ux ตอบ copy ให้แล้วที่ ux-wireframe §15.2) · (d) manual pass กิน throttle จนเลนแดง → บันทึกไว้ใน `manual-pass-runbook.md` แล้ว (คนต่อไปจะเจอเหมือนกัน)
