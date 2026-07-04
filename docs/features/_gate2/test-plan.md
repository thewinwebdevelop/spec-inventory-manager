---
doc: test-plan
owner: "@qa"
signoff: pending      # pending | approved
---
# [F-XXX] Test plan  (เจ้าภาพ: qa — ร่างตอน Gate 2 จาก AC)

## Contract summary (≤20 บรรทัด — ทีม consumer อ่านแค่ส่วนนี้)
> AC → coverage โดยย่อ, จุด ★ (money/stock/auth) ที่บังคับ test matrix, D-XXX ที่อ้าง
- ...

**Unit (core-domain / service):**
- [ ] ...

**Integration / API:**
- [ ] ...

**E2E (user flow) + manual:**
- [ ] ...

- test data: seed ≥2 org + isolation + state via StockMovement
- perf smoke (full เท่านั้น): endpoint list/query หลักตอบใน budget บน seed ใหญ่ (เช่น 10k movements) — right-size, ไม่ใช่ load test เต็ม (load test เต็ม = launch-readiness)
