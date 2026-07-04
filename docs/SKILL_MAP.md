# Skill Map — step × team × skill (สาย superpowers)

> agent เรียก skill ผ่าน Skill tool · **core** = ใช้ทุกครั้ง · **sit** = เมื่อเข้าเงื่อนไข
> default line = superpowers (เลิกใช้ tdd/debug-mantra/diagnosing-bugs ใน flow หลัก)
> คู่กับ [WEB_TEAM.md](../WEB_TEAM.md) (ใคร decide) และ [.claude/agents/README.md](../.claude/agents/README.md)

### PM/Orchestrator (cross-cutting)
| เมื่อไหร่ | skill |
|---------|-------|
| เริ่มงาน creative | `superpowers:brainstorming` |
| แตกงาน parallel | `superpowers:dispatching-parallel-agents` · `superpowers:subagent-driven-development` |
| หลัง G2 → ก่อน build | `superpowers:writing-plans` → `superpowers:executing-plans` |
| รายงาน user | `product-management:stakeholder-update` · `9arm-skills:management-talk` |
| งานช่างกลถูกๆ | `anthropic-skills:qwen-agent` |
| ก่อนเคาะเสร็จ | `superpowers:verification-before-completion` · `anthropic-skills:scrutinize` |

### Portfolio (product)
`product-management:product-brainstorming` (core) · `synthesize-research` (sit) · `competitive-brief` (sit) · `roadmap-update` (core) · `sprint-planning` (sit)

### Gate 1 — Requirement + Product Advisory (product)
`feature-spec` G1 (**core**) · `product-management:write-spec` (core) · `domain-modeling` (sit: มีศัพท์ใหม่) · `compliance-checklist` (sit: แตะ personal data — orders/buyer, เอกสาร, notification, export, AI)
**Advisory (§2.1):** `product-management:competitive-brief` (best practice/competitor) · `product-management:product-brainstorming` (ตัวเลือก+trade-off) · `synthesize-research` (ถ้ามี feedback จริง)

### Gate 2 — Design
| step | owner | skill |
|------|-------|-------|
| architecture (แตะ external/queue/money-stock) | BE | `connector-design` · `money-stock` |
| observability/runbook section (full, sync/queue) | devops | `observability-standard` |
| interface/module ลึก เทสต์ง่าย | BE | `codebase-design` · `design-an-interface` (sit) |
| data-model→OpenAPI contract | BE | `feature-spec` G2 |
| wireframe→UI+Thai copy+tokens | ux | `thai-ux` |
| self-review ก่อนเสนอ user (**core**) | ux | `ux-heuristic-review` (SME persona walkthrough + checklist) |
| UI design (visual) | ux→FE | `/design-sync` + `DesignSync` (ดู §8) |
| test plan จาก AC | qa | `feature-spec` · `money-stock` |
| review เอกสาร | เจ้าของส่วน | `anthropic-skills:scrutinize` · `review` |
| security review spec (full/auth-token-money) | security-reviewer | → `security-review.md` · verdict ประกบ sign-off |
| สรุปภาษาคนประกบ sign-off เอกสารเทคนิค | PM | `9arm-skills:management-talk` (**core**) |

### Build
| step | owner | skill |
|------|-------|-------|
| logic + unit test (test-first) | BE | `superpowers:test-driven-development` · `money-stock` |
| connector impl | BE | `connector-design` |
| แก้ contract ที่ ship แล้ว | BE | `contract-evolution` (**core** หลัง client แรก ship) |
| migration บนข้อมูลจริง | BE | `prisma-migration` (**core** หลังมีข้อมูล) |
| consume client + UI | FE | `thai-ux` · `superpowers:test-driven-development` |
| client แตะ token/auth/sensitive (★) | FE | `client-security` (**core** บน ★) |
| sync Claude Design ↔ repo | ux+FE | `/design-sync` + `DesignSync` |
| รัน/ส่องแอปจริง | FE | `run` · `verify` · `mcp__Claude_Preview__*` |
| isolation workspace | build | `superpowers:using-git-worktrees` (sit) |
| ขอ/รับ review ก่อน merge | build | `superpowers:requesting-code-review` · `superpowers:receiving-code-review` · `code-review` |
| review ก่อน merge — right-size ตาม risk (WEB_TEAM §3.6) | PM route | ★ money/stock/auth/token/tenant → **security-reviewer บังคับ** · backend/contract → medium · UI/copy → `code-review` low หรือ CI พอ |
| dispatch task ★ | PM | model override → **opus** (แม้ agent pin sonnet) |
| ลดความซับซ้อน | build | `simplify` (sit) |
| debug | build | `superpowers:systematic-debugging` (sit) |

### QA (qa)
`quality-gate` (**core**) · `feature-spec`+`money-stock` (verify AC+matrix) · `regression-curation` (core เมื่อปิด defect/จบ feature/CI ช้า) · `qa` skill (Browser Use track 2) · `verify`·`run` · `security-review` (core เมื่อแตะ auth/token/เงิน) · `superpowers:systematic-debugging` · `anthropic-skills:post-mortem` (sit)

### Release (release)
`superpowers:finishing-a-development-branch` (core) · `quality-gate` (core) · `product-management:metrics-review` (sit หลัง dogfood)

### DevOps (สนับสนุน)
`observability-standard` (**core** ต่อ feature full sync/queue) · `backup-dr` (**core** เมื่อ env มีข้อมูลจริง + drill ตาม schedule) · `setup-pre-commit` (sit) · `git-guardrails-claude-code` (sit) · `resolving-merge-conflicts` (sit)

> **On-demand utility (ไม่ผูก step):** `obsidian-vault`, `migrate-to-shoehorn`, doc-gen (`docx`/`pptx`/`xlsx`), `request-refactor-plan`
