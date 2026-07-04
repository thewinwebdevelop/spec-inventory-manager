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
`feature-spec` G1 (**core**) · `product-management:write-spec` (core) · `domain-modeling` (sit: มีศัพท์ใหม่)
**Advisory (§2.1):** `product-management:competitive-brief` (best practice/competitor) · `product-management:product-brainstorming` (ตัวเลือก+trade-off) · `synthesize-research` (ถ้ามี feedback จริง)

### Gate 2 — Design
| step | owner | skill |
|------|-------|-------|
| architecture (แตะ external/queue/money-stock) | BE | `connector-design` · `money-stock` |
| interface/module ลึก เทสต์ง่าย | BE | `codebase-design` · `design-an-interface` (sit) |
| data-model→OpenAPI contract | BE | `feature-spec` G2 |
| wireframe→UI+Thai copy+tokens | ux | `thai-ux` |
| UI design (visual) | ux→FE | `/design-sync` + `DesignSync` (ดู §8) |
| test plan จาก AC | qa | `feature-spec` · `money-stock` |
| review เอกสาร | เจ้าของส่วน | `anthropic-skills:scrutinize` · `review` |

### Build
| step | owner | skill |
|------|-------|-------|
| logic + unit test (test-first) | BE | `superpowers:test-driven-development` · `money-stock` |
| connector impl | BE | `connector-design` |
| consume client + UI | FE | `thai-ux` · `superpowers:test-driven-development` |
| sync Claude Design ↔ repo | ux+FE | `/design-sync` + `DesignSync` |
| รัน/ส่องแอปจริง | FE | `run` · `verify` · `mcp__Claude_Preview__*` |
| isolation workspace | build | `superpowers:using-git-worktrees` (sit) |
| ขอ/รับ review ก่อน merge | build | `superpowers:requesting-code-review` · `superpowers:receiving-code-review` · `code-review` |
| ลดความซับซ้อน | build | `simplify` (sit) |
| debug | build | `superpowers:systematic-debugging` (sit) |

### QA (qa)
`quality-gate` (**core**) · `feature-spec`+`money-stock` (verify AC+matrix) · `qa` skill (Browser Use track 2) · `verify`·`run` · `security-review` (core เมื่อแตะ auth/token/เงิน) · `superpowers:systematic-debugging` · `anthropic-skills:post-mortem` (sit)

### Release (release)
`superpowers:finishing-a-development-branch` (core) · `quality-gate` (core) · `product-management:metrics-review` (sit หลัง dogfood)

### DevOps (สนับสนุน)
`setup-pre-commit` (sit) · `git-guardrails-claude-code` (sit) · `resolving-merge-conflicts` (sit)

> **On-demand utility (ไม่ผูก step):** `obsidian-vault`, `migrate-to-shoehorn`, doc-gen (`docx`/`pptx`/`xlsx`), `request-refactor-plan`
