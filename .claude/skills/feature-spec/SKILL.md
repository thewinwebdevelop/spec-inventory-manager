---
name: feature-spec
description: >-
  Author or extend an OmniStock feature spec (F-XXX) using the two-gate flow and
  _TEMPLATE.md. Use when starting a new feature, breaking an epic into features,
  right-sizing a spec, or filling Gate 1 / Gate 2 sections. Enforces the
  Gate-1-before-Gate-2 sign-off discipline, platform tagging, and full-vs-light
  sizing. Product owns Gate 1; backend-api/ux/qa fill Gate 2.
---

# Feature spec authoring (two-gate)

Specs exist to **align before building**. The two-gate split is the whole point:
prove the requirement is right (cheap) before sinking effort into design
(expensive). Never write Gate 2 before Gate 1 is user-approved.

## Step 0 — right-size first
Decide before writing:
- **full** — touches external service / sync / queue / complex money-stock /
  cross-cutting. Write every section incl. Architecture (§5).
- **light** — internal CRUD / small UI. Skip Architecture, trim data/api detail.
- **Platform tag** — web / mobile / both on ONE spec. Do *not* fork into
  per-platform features; shared core (contract, data-model, rules) is written
  once, only UX/UI + navigation + platform capabilities differ.

## Gate 1 — Requirement (product, cheap to change)
Fill §1–4 of [_TEMPLATE.md](../../../docs/features/_TEMPLATE.md):
- **Overview**: problem, users (Owner/Admin/Staff/Accountant/System), value.
- **User stories**: INVEST — `As <role> I want <capability> so that <outcome>`.
- **Acceptance criteria**: testable, given/when/then style. Each AC must be
  something `qa` can turn into a test. Vague AC = not done.
- **Scope**: an explicit In / Out table — Out prevents scope creep.
- **Business rules & edge cases**: cite golden rules where relevant.
- ✋ **STOP: get user sign-off on stories/AC.** Mark status `gate1-approved`.
  Do not proceed to design without it.

## Gate 2 — Design (built on approved Gate 1)
Fill §5–11, in this order (each constrains the next):
1. **Architecture/tech design** (full only) — invoke `connector-design` if it
   touches a marketplace. Settle sync/idempotency/rate-limit/reconciliation first.
2. **Data model** — entities/fields/indexes/migrations; data-model drives the API.
3. **API design** — OpenAPI endpoints/DTOs/errors; the FE↔BE seam.
4. **UX wireframe & UI** — design against the *settled* API, not guesses; Thai copy
   + design tokens (invoke `thai-ux`).
5. **Test plan** — `qa` maps every AC → unit/integration/E2E (invoke `test-plan`).
- **Review**: each section by its owner only (architecture/api/data → backend-api,
  UX/UI → ux, testability → qa, infra → devops, scope/AC → product).
- ✋ **STOP: user approval → commit all docs on a branch.** Mark status `designed`.

## Quality bar for a good spec
- Every AC is testable and traceable to a test in §11.
- No data-model field that the API doesn't expose (or vice versa) without reason.
- No UX flow that depends on data the API doesn't provide — confirm with backend-api.
- Golden-rule impacts called out (multi-tenant, ledger, money/stock, Decimal).
- Cross-feature impact (schema/contract changes) listed in §10; sync shared
  changes back to [docs/01-data-model.md](../../../docs/01-data-model.md) /
  [docs/02-architecture.md](../../../docs/02-architecture.md).

## When blocked
If a requirement is ambiguous or conflicts with a golden rule, do not guess —
emit the escalation block to `product` and stop.
