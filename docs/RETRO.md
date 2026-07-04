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

_(ยังไม่มี entry — feature แรกที่ผ่าน Gate F จะเริ่มบันทึกที่นี่)_
