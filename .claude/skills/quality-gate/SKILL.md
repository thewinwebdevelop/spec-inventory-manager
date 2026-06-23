---
name: quality-gate
description: >-
  Run OmniStock's definition-of-done before declaring any feature/change
  complete. Use before merge, before marking a feature done, or when asked "is
  this ready". Walks the WEB_TEAM Gate A–F checklist and the 7 golden rules,
  collects evidence, and produces a pass/fail verdict. Shared by every agent;
  qa owns the final verdict.
---

# Quality Gate — definition of done

A change is **done only when every applicable gate passes with evidence**. This
skill turns "I think it's fine" into a verifiable verdict. Right-size: skip gates
that genuinely don't apply (e.g. no money/stock code → Gate C money checks N/A),
but **state why** you skipped — never silently.

## How to run
1. Identify what the change touches: scope, money/stock?, external service?,
   schema?, UI?, platform (web/mobile/both).
2. Walk each gate below; for every box collect **concrete evidence** (test name,
   file:line, command output) — not assertions.
3. Produce the verdict block at the end. Red on any required box = NOT done.

## Gate A — Requirement (Gate 1)
- [ ] User stories + acceptance criteria exist and were **user-approved** before design.
- [ ] Platform tag (web/mobile/both) and right-size (full/light) recorded.
- Evidence: link to the spec section + sign-off note.

## Gate B — Design & sign-off (Gate 2)
- [ ] If it touches external/sync/queue/money-stock: architecture/tech design present
  (sync strategy, idempotency, rate-limit, retry, reconciliation, mapping).
- [ ] data-model → API design → wireframe/UI present and internally consistent.
- [ ] test plan derived from AC (every AC maps to ≥1 case).
- [ ] design docs reviewed by each section's owner; **user-approved + committed before implement**.

## Gate C — Domain & Data (golden rules in code)
- [ ] Every domain query filters `organizationId` — proven by a **cross-tenant
  isolation test** (org A cannot read/write org B).
- [ ] Money/stock writes run **inside a DB transaction AND write the ledger**
  (`StockMovement`) — proven by a test asserting movement rows + atomic rollback.
- [ ] Stock changes are **append-only** — no `update`/`delete` of past quantities.
- [ ] Core business logic lives in `packages/core-domain` as **pure functions**.
- [ ] Money is **Decimal/numeric (no float)**; stock is **integer** — checked in
  schema + code; precision/rounding test exists.
- [ ] OpenAPI contract updated + client regenerated.

## Gate D — Experience
- [ ] All states present: empty / loading / error / success, with clear **Thai copy**.
- [ ] UI does not misrepresent the model (e.g. SellableSku never shown as having
  its own stock; "edit stock" framed as recording a movement).
- [ ] No money math on float in the client — displays server-computed values.
- [ ] If both platforms: web and Flutter use shared design tokens (no visual drift).

## Gate E — Quality
- [ ] **Money/stock code has passing unit tests before merge** (golden rule 4).
- [ ] unit + integration + E2E green; lint clean — report real output (fail = fail).
- [ ] Key regressions don't break.
- [ ] Manual pass on the primary user flow.

## Gate F — Release
- [ ] version bump + changelog.
- [ ] on a branch; commit/push only on user request.
- [ ] explicit rollback plan; rollout dogfood-first.
- [ ] go/no-go cites qa-green + devops-env-ready (never override a fail to ship).

## Verdict block (always output)
```
✅/❌ QUALITY GATE — <feature / change>
A Requirement: pass / fail / n-a — <evidence>
B Design:      pass / fail / n-a — <evidence>
C Domain&Data: pass / fail / n-a — <evidence>
D Experience:  pass / fail / n-a — <evidence>
E Quality:     pass / fail / n-a — <evidence: test cmd + result>
F Release:     pass / fail / n-a — <evidence>
VERDICT: DONE / NOT DONE
Blocking: <list red boxes + owner to fix>
```

> Reference: gates in [WEB_TEAM.md](../../../WEB_TEAM.md) §4 · golden rules in
> [CLAUDE.md](../../../CLAUDE.md). If "correct" is ambiguous, the answer is
> product's AC + backend-api's rules — escalate, don't assume.
