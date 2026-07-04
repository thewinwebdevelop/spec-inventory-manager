# [F-XXX] Task Board
> เจ้าของ task update status ของตัวเอง (`todo→in_progress→done`) + ลงชื่อ updated_by
> PM ดูบอร์ด → dispatch task ที่ deps=done ครบ · ดู [WEB_TEAM.md](../../../WEB_TEAM.md)

> **รูปแบบ:** table แยก section ต่อทีม (backend-api / ux / devops / frontend / qa) · 1 แถว = 1 task
> **★** = task แตะ money/stock/auth/token/tenant-isolation/concurrency → dispatch **opus** +
> `security-reviewer` บังคับก่อน merge (WEB_TEAM §3.4/§3.6) · `ref` = ทั้งหมดที่ subagent ต้องอ่าน

## <team>

| ID | งาน | ref → target | deps | status | updated_by |
|----|-----|--------------|------|--------|------------|
| T-XXX-01 | ★? <ทำอะไรคร่าวๆ> | <Gate-2 doc + target path เช่น api-spec.md → apps/api> | <T-… / G2✓ / —> | todo | — |
