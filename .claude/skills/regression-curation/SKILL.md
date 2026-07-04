---
name: regression-curation
description: >-
  Curate OmniStock's regression test pack as features accumulate. Use when
  closing a defect, finishing a feature's QA, noticing flaky tests, or when CI
  time grows. Defines what enters the permanent pack, smoke-vs-full tiers, the
  flaky-test policy (no silent skips), and periodic pruning. Owned by qa;
  devops wires the tiers into CI.
---

# Regression curation — the pack must stay trustworthy AND fast

An unmanaged suite ends one of two ways: so slow that agents "temporarily" skip
it, or so flaky that red means nothing. Both kill golden rule 4. Curate
deliberately.

## What enters the permanent pack (append on these events)
1. **Every fixed defect** gets a test reproducing it — added the same PR as the
   fix. No test = the defect isn't closed.
2. **Every ★ path**: the full money-stock matrix cases (append-only, atomicity,
   idempotency, oversell, precision, isolation) stay forever.
3. **One golden-path E2E per feature** (the primary user flow from its AC).
4. **Cross-tenant isolation tests** — never pruned, only extended.

## Tiers (qa defines membership; devops wires)
- **smoke** — every PR, hard gate, target **< 10 min**: unit (core-domain all),
  contract check, isolation tests, golden paths of features the diff touches.
- **full** — nightly + pre-release: everything incl. all E2E, perf smoke,
  Track-2 agentic run.
A PR touching money/stock/auth additionally runs the ★ matrix for that domain
in the PR gate regardless of tier.

## Flaky policy — no silent skips, ever
- A flaky test is **quarantined the same day**: moved to a quarantine tag,
  tracked with an owner + T-ID, still runs in `full` (non-blocking).
- Quarantine max age: 2 weeks → fix it or delete it **with a written reason**
  reviewed by qa. `skip`/`only` left in code = quality-gate fail.
- Red on smoke is never overridden to merge (WEB_TEAM Gate E).

## Pruning (per phase end, or when smoke > 10 min)
- Merge duplicated coverage (two tests proving the same rule → keep the
  stronger); drop UI tests for removed screens.
- **Never prune** categories 1–4 above. Record pruning decisions in the QA
  notes so a future session doesn't re-add.

## Verdict integration
When running `quality-gate` Gate E, state which tier ran, real duration, and
quarantine count — a growing quarantine list is itself a red flag to report.
