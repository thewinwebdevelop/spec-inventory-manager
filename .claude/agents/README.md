# OmniStock Agents

Seven domain-owner subagents (one per discipline, each with **decision authority
only inside it**) plus one **advisory reviewer**. The governing rule for owners:

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

### Advisory (reviews, does not own)

| Agent | Advises on | File |
|------|-----------|------|
| `security-reviewer` | Senior review & security consult, **full-stack** (formerly `backend-reviewer`): Gate-2 backend **specs**, backend **implementation** (gaps/omissions, best-practice & project-fit, authn/authz, tenant isolation, tokens, injection, secrets, rate-limit), **and client-side security surfaces** (web token/cookie/CSRF/XSS/CSP, mobile secure storage & deep links) — mandatory on ★ tasks (auth/token/money). Produces severity-ranked findings; **the owning agent (`backend-api`/`frontend`) decides adoption** — the reviewer never edits owned files or blocks a gate alone. Not `qa` (which owns the test verdict). | [security-reviewer.md](security-reviewer.md) |

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
Every cross-team resolution is logged append-only in
[docs/DECISIONS.md](../../docs/DECISIONS.md) (D-XXX).

## Shared ground rules (all agents)

All seven inherit the project's **golden rules** from
[CLAUDE.md](../../CLAUDE.md) and the **data model** in
[docs/01-data-model.md](../../docs/01-data-model.md) — those files are the single
source of truth; agents link to them rather than restate them. Plus: report
results truthfully; commit/push only when the user asks; work on a branch.

## Skills — how agents stay consistent & expert

Agents define *who decides*; **skills** (`.claude/skills/<name>/SKILL.md`) define
*how to execute a procedure to expert standard, the same way every time*. Agents
invoke them via the Skill tool.

| Skill | What it standardizes | Invoked by |
|-------|----------------------|------------|
| `quality-gate` | the Gate A–F + golden-rule definition of done | all (qa owns verdict) |
| `feature-spec` | two-gate spec authoring + right-size + platform tag | product, backend-api, ux, qa |
| `connector-design` | marketplace integration (sync, idempotency, retry, reconcile) | backend-api |
| `money-stock` | ledger/transaction/Decimal math + the test matrix | backend-api, qa |
| `thai-ux` | Thai copy/microcopy/formatting + shared design tokens | ux, frontend |
| `contract-evolution` | safe contract change after clients ship (additive-only, deprecate, version) | backend-api |
| `prisma-migration` | expand→migrate→contract, ledger protections, rollback path | backend-api |
| `client-security` | client-side token/auth/XSS/secure-storage discipline (★ tasks) | frontend |
| `ux-heuristic-review` | SME-persona walkthrough + checklist before presenting UX docs | ux |
| `regression-curation` | permanent pack membership, smoke/full tiers, flaky policy | qa |
| `observability-standard` | per-feature logs/metrics/alerts/runbook | devops |
| `backup-dr` | backup policy + scheduled restore drills, RPO/RTO | devops |
| `compliance-checklist` | PDPA pass at Gate 1 for personal-data features | product |
| `adversarial-review` | HOW to review (own model first, absence-hunt, falsify, blast-radius rank) — distilled fable method | every reviewer (qa, security-reviewer, doc owners) |
| `blindspot-scan` | HOW to find what's missing (promise-vs-owner, follow-the-data, timeline collision) — distilled fable method | PM, product |
| `decompose-plan` | HOW to split epics/features/tasks (seam-cut, ★-mark, sizing, trigger-bound batching) — distilled fable method | PM, product |

`release` uses `quality-gate`. More role-specialist skills
(`backlog-prioritize`, `bullmq-ops`, `flutter-feature` — deferred to F-006 so
it's written from real code, …) are added when their stage arrives — don't
pre-build them.

**Skill budget (WEB_TEAM §3.8):** each skill ≤ ~100 lines — longer means split
or cut. New workflow rules go into a skill or WEB_TEAM, **never CLAUDE.md**
(it auto-loads into every agent on every dispatch — its size is frozen). At
each phase-end rulebook scan, rules that never caught anything get proposed
for deletion.

**Full skill map** (step × team × skill, superpowers line): [docs/SKILL_MAP.md](../../docs/SKILL_MAP.md).

## Notes
- `description` fields are written to drive auto-delegation — they state both
  what the agent is for and what it explicitly does **not** decide.
- **Models are pinned** by stakes, not split evenly: `product`, `backend-api`,
  `qa`, `ux` → **opus** (top of the chain + money/stock correctness + UX is the
  product's differentiator for a non-tech user who can't deep-review it);
  `frontend`, `devops`, `release` → **sonnet** (execute against a
  spec already decided upstream); `security-reviewer` → **fable** (deep,
  independent review & threat-modeling — a different model from the author it
  reviews, so it catches what the writer's own reasoning missed). Change the
  `model:` line in a file's frontmatter to re-tune cost vs. capability.
- **Per-task model override (★ risk marker):** the PM may override the model at
  dispatch time (the Agent tool's `model` param) per task row. Tasks marked
  **★** in `tasks.md` (money/stock/auth/tenant-isolation/concurrency) are
  dispatched on **opus** even to a sonnet-pinned agent, and get a mandatory
  `security-reviewer` pass before merge. See WEB_TEAM §3.4/§3.6.
