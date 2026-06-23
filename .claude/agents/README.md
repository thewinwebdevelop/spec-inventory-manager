# OmniStock Agents

Seven specialized subagents, one per discipline. Each owns a single domain and
has **decision authority only inside it**. The governing rule:

> **If a decision isn't in my domain, I stop and escalate — I never guess.**

## The agents

| Agent | Owns (decides) | File |
|------|----------------|------|
| `product` | What/why, scope, F-XXX backlog, user stories, acceptance criteria, business rules | [product.md](product.md) |
| `ux` | UX/UI: user flows, IA, wireframes, interaction, Thai copy, accessibility, visual design + design tokens (shared web↔mobile) | [ux.md](ux.md) |
| `frontend` | Next.js web + Flutter mobile implementation, client state, consuming the API client | [frontend.md](frontend.md) |
| `backend-api` | NestJS, Prisma schema, core-domain logic, the OpenAPI contract, transactions, ledger, multi-tenant enforcement | [backend-api.md](backend-api.md) |
| `devops` | Turborepo tooling, CI/CD, Docker, env/secrets, hosting, Redis+BullMQ ops, observability | [devops.md](devops.md) |
| `qa` | Test strategy, unit/E2E plans, verification vs. AC, quality gates, pass/fail verdict | [qa.md](qa.md) |
| `release` | Versioning, changelog, branch/merge strategy, phase/release gating, rollout & rollback | [release.md](release.md) |

## Decision boundaries at a glance

```
product      WHAT & WHY ............. top of the requirements chain (Gate 1 = AC)
   │ (AC, rules)
   ▼
backend-api  ARCHITECTURE, DATA &     architecture (right-sized) → data-model →
   │         CONTRACT ............... OpenAPI contract = the shared seam ──┐
   ▼                                                                       │
ux (UX/UI)   HOW IT FEELS & LOOKS .. designs against the settled contract  │
   │ (UX/UI spec)                     flow, structure, words, design tokens │
   ▼                                                                       │
frontend     CLIENT IMPL ........... consumes the contract ◄───────────────┘
   │
devops       WHERE IT RUNS ......... runtime, pipeline, infra
   │
qa           IS IT CORRECT ......... verifies against AC + rules
   │
release      WHEN IT SHIPS ......... gates on qa + devops, sequences rollout
```
> Order shown is the Gate-2 design sequence: architecture/contract precede UX so
> the experience is designed against real constraints. Full workflow (Portfolio →
> 2 gates → Build → QA → Release): [WEB_TEAM.md](../../WEB_TEAM.md) §3.

Key seams:
- **product → everyone**: Gate-1 acceptance criteria are the scope contract.
- **backend-api → ux**: UX is designed against the settled API/architecture, not
  guesses; ux confirms data shape with backend-api before finalizing.
- **backend-api ↔ frontend**: the **OpenAPI contract** is fixed; frontend
  requests contract changes, never works around them.
- **qa ← product + backend-api**: "correct" = product's AC + backend-api's rules;
  qa verifies, it does not redefine.
- **release ← qa + devops**: release gates on qa's green verdict and devops'
  environment-ready signal.

## Escalation protocol

Subagents can't call each other directly — they return to the orchestrator
(the main session). When an agent hits a question outside its domain it emits
this block **and stops**:

```
🚧 BLOCKED — needs a decision from: @<agent>
Question: <one precise question>
Why I stopped: outside my domain (<agent> owns <X> only)
Options I see (if any): <a / b / c with trade-offs>
What I'll do once answered: <next concrete step>
```

The orchestrator reads the block, routes the question to the named agent
(usually by invoking it), and feeds the answer back. This keeps every decision
with its rightful owner instead of letting an agent improvise outside its lane.

## Shared ground rules (all agents)

All seven inherit the project's **golden rules** from
[CLAUDE.md](../../CLAUDE.md) and the **data model** in
[docs/01-data-model.md](../../docs/01-data-model.md) — those files are the single
source of truth; agents link to them rather than restate them. Plus: report
results truthfully; commit/push only when the user asks; work on a branch.

## Notes
- `description` fields are written to drive auto-delegation — they state both
  what the agent is for and what it explicitly does **not** decide.
- **Models are pinned** by stakes, not split evenly: `product`, `backend-api`,
  `qa` → **opus** (top of the chain + money/stock correctness — costly to get
  wrong); `ux`, `frontend`, `devops`, `release` → **sonnet** (execute against a
  spec already decided upstream). Change the `model:` line in a file's
  frontmatter to re-tune cost vs. capability.
