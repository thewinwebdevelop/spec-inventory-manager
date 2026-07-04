---
name: blindspot-scan
description: >-
  How to find what's MISSING from a plan, backlog, or spec set — gaps, dropped
  promises, timeline collisions, unowned obligations. Use when asked "what are
  we missing / anything dropped?", before a phase starts, or periodically over
  the backlog. Distilled from the fable-model gap-scan method that produced
  docs/superpowers/plans/2026-07-04-backlog-gap-scan.md (a worked example —
  read it to see the output quality bar).
---

# Blindspot scan — reading what ISN'T written

Core stance: reading the documents is only preparation. The scan is asking,
for each lens below, **"what should exist here that doesn't?"** You cannot
find gaps by evaluating what's present — you find them by holding the docs up
against something *external*: reality, time, data flows, and the catalog of
what systems like this always need.

Run **all six passes**, in order, even if early passes look clean. Each pass
is a different lens; gaps invisible in one are obvious in another.

## Pass 1 — Promise vs owner
List every promise the docs make, **including implied ones** ("re-send the
invitation" implies something can send). For each: which feature/system/infra
delivers it, and does that thing exist **by the time the promise is due**?
A promise with no owner, or an owner scheduled later than the promise, is a
gap — often the highest-severity kind (internal contradiction).
*Worked example: F-002 promised email invites; email infra was owned by a
feature 4 phases later → G-1, the top finding of the 2026-07-04 scan.*

## Pass 2 — Follow the data
Pick each class of sensitive/valuable data (PII, money, credentials/tokens,
files, ledger rows) and trace it end-to-end: **enters where → stored where →
who can see it → how it's exported → how it's deleted → who is legally
responsible**. Any stage with no answer is a gap. This pass catches
compliance and security holes that feature-by-feature review never sees,
because the data crosses feature boundaries.

## Pass 3 — Walk the user's real day
Play the actual persona (here: Thai SME shop owner, non-technical) through a
real day/week/year — **including the messy parts specs avoid**: they already
have 800 SKUs before day one (migration?), physical stock drifts from the
system (counting?), they edit data on the external platform directly
(conflict?), the internet dies mid-task, they make a mistake and need to
undo. Every point where the system has no answer is a gap. Specs describe
ideal flows; users live in the exceptions.

## Pass 4 — Timeline collision
For each feature in order, check its dependencies exist **by then** — not
just "is listed as a dependency" but infra, test environments, and content
too. Classic collision: a capability deferred to a later phase that an
earlier phase quietly needs (storage, email, sandbox APIs). Also walk the
dependency chain for cycles and for "depends on X" claims that the backlog
table and the spec header state differently.

## Pass 5 — Absence catalog
Compare against what systems of this class **always** end up needing, whether
or not anyone asked: security review, compliance/regulatory, backup & restore
(tested, not configured), observability & runbooks, data import/migration,
test infrastructure (sandboxes/mocks for external services), support/ops
tooling, status communication, help content. For each: either point at where
it's owned, or record it as a gap, or record it as a **deliberate, written
exclusion** — the difference between "decided not to" and "forgot" must be
auditable.

## Pass 6 — Cross-artifact diff
Mechanically compare every place the same fact is stated twice: spec headers
vs backlog tables, canon docs vs feature specs, capability matrix vs scope
tables. Any disagreement is a defect — a future agent will follow whichever
copy it happens to read.

## Output format (rank by cost-if-found-later, NOT by ease of fixing)
- 🔴 internal contradiction, or unowned obligation on a near-term path
- 🟡 must be decided before phase X / before launch
- 🟢 note it, decide when reached
Each finding: **evidence (file/line) → why it matters → 2–3 options with a
recommendation → what it impacts.** You are producing decisions-to-be-made,
not complaints. End with a **"checked and clean"** list — what you verified
and found sound — so the next scan doesn't redo it and readers can calibrate
trust.

## Anti-patterns
- Reviewing each doc in isolation (gaps live *between* docs).
- Reporting only what you can fix — the scan's job is surfacing, the owner's
  job is choosing.
- Vague findings ("security could be better") — no evidence + no option = noise.
- Skipping passes because early ones were clean.
