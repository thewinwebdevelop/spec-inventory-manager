---
name: adversarial-review
description: >-
  How to review any artifact (code diff, spec, design doc, plan) the way a
  strong reviewer does: form your own model before reading claims, hunt what's
  ABSENT not just what's wrong, falsify claims instead of confirming them, and
  rank by blast radius. Use whenever you are dispatched to review someone
  else's work. Distilled from the fable-model review process (2026-07-04).
---

# Adversarial review — find what's wrong, not confirm what's right

Core stance: **a review that found nothing means you haven't looked properly.**
Your job is not to approve; it is to make the strongest honest case against the
work, then report what survived. The author already believes it's correct —
you are the only one paid to believe otherwise.

## Procedure (in this order — the order is the method)

### 1. Form your own model FIRST
Read the artifact itself (diff, schema, spec) **before** reading the author's
summary/description — never the other way around. Build your own answer to
"what does this actually do?" — then compare with what the author claims.
The gap between the two is where bugs live. If you were handed a summary,
set it aside until step 5.

### 2. Inventory the claims, then try to break each one
List every claim the work makes, explicit or implied ("handles retry",
"org-scoped", "atomic", "covers all AC"). For each claim, attempt to
**construct a concrete failure scenario**: specific input/state → wrong
outcome. Three results possible:
- You built one → finding (with the scenario, not a platitude).
- You proved you can't → claim verified, move on.
- You can neither break nor verify it → **flag it as unverifiable** — that is
  itself a finding (missing test / missing evidence).

### 3. Hunt absence (the highest-value pass)
The worst defects are **missing code, not wrong code** — grep can't find
them and diffs don't show them. Walk this catalog against the work:
- error path for every happy path? (what happens when this call fails?)
- the edge the spec explicitly named — is it actually handled AND tested?
- tenant filter on every new query? auth check on every new surface?
- rollback/undo story for every state change?
- empty / loading / error states for every new UI surface?
- the second call: what if it runs twice, concurrently, out of order?
For each item either point at where it's handled (`file:line`) or write the
finding. "Probably handled somewhere" is not an answer.

### 4. Check the boundaries
For every interface this work touches (API contract, schema, events, shared
components, docs it should sync back to): does the **other side** agree?
Cross-artifact inconsistency (spec says X, table says Y) is a real defect —
someone will follow the wrong one. This pass caught the highest-severity
findings in past scans; do not skip it.

### 5. Verify, don't reason
Anything checkable by running something — run it (test, typecheck, lint,
query, `grep` for the pattern the author says exists). Demonstrated beats
reasoned. This is also where you finally read the author's summary: check it
against what you found — discrepancies between summary and reality are
findings too (and a signal to look harder).

### 6. Rank by blast radius × silence
Severity = how much damage × how long before anyone notices.
**Silent money/stock corruption > silent data leak > loud crash > UX wart.**
A bug that throws is self-reporting; a bug that quietly returns a default is
the one that costs weeks. Separate **must-fix** from **opinion** — never
drown a Critical in style nits.

### 7. Calibration guard (before you submit)
If all your findings are style-level, you looked in the easy places. State
explicitly: **the 3 riskiest spots in this work, and what you checked in each.**
If you can't name 3 risky spots, you don't understand the work — go back to
step 1. Also report what's genuinely good (so it's preserved), and what you
did NOT review (so nobody assumes you did).

## Anti-patterns (these mean the review failed)
- Rubber-stamp: reading the summary, skimming the diff, "LGTM".
- Style-nitpicking as a substitute for substance.
- Trusting green tests without reading **what the tests assert** — a passing
  test that asserts nothing is worse than no test.
- Reviewing only what changed — the bug is often in what *didn't* change but
  should have (callers, docs, related paths).

> Output format: follow the dispatching workflow's format if given (e.g.
> security-reviewer's findings block); otherwise: findings ranked by severity,
> each = summary + concrete failure scenario + `file:line`, then the
> calibration-guard statement.
