---
name: decompose-plan
description: >-
  How to break a large goal into features/tasks that weaker models can execute
  safely: outcome-first, cut along seams (not equal chunks), risk-mark before
  dispatch, size for the executor, and bind deferred work to triggers instead
  of memory. Use when planning a feature build, splitting an epic, or turning
  a review's recommendations into an executable plan. Distilled from the
  fable-model planning process (2026-07-04 team-upgrade-plan is a worked example).
---

# Decompose plan — cut work so smaller models can't fall off

Core stance: a plan's quality is measured by **whether the weakest executor
assigned to it can succeed** — not by how complete it looks. Every rule here
exists because dispatched agents start cold, degrade with context length, and
cannot see what you see.

## Method (in order)

### 1. Outcome first — verification before tasks
Write the end state and **how you'll verify it** (the AC) before writing any
task. If you can't state how you'd check it's done, you don't understand the
goal yet — go back. Every task inherits this: a task without a checkable
"done" is not a task, it's a wish.

### 2. Cut along seams, not into equal chunks
Find the stable interfaces — API contract, DB schema, design tokens, queue
messages — and cut there. **A good cut = both sides can proceed with only
the interface agreed.** A bad cut = two tasks that must constantly re-consult
each other (that's one task, or the seam is wrong). Lock the seam first
(contract before build), then parallelize freely across it.

### 3. Dependency spine
Order by what unblocks what. Identify the critical path explicitly; everything
off it can run in parallel or wait. Check each dependency exists **by the
time it's needed** — not just "eventually" (see blindspot-scan pass 4:
timeline collision is the most common planning bug).

### 4. Risk-mark BEFORE dispatch (★)
Tag every task touching money / stock / auth / token / tenant-isolation /
concurrency. Marked tasks get the strong model + mandatory security review;
everything else right-sizes down (sonnet + light review). Deciding risk at
dispatch time — instead of averaging effort across all tasks — is what makes
"opus thinks, sonnet builds" safe. Never let the executor self-assess risk.

### 5. Size for the executor
1 task ≈ half a day / ~≤400-line diff. Bigger → split (quality degrades with
context length, silently). Each task's brief must be **self-contained**: the
`ref` list is *everything* the executor reads — canon docs + AC + relevant
D-XXX, and **not** other features' specs. Assume the executor knows nothing
beyond the brief; if the task needs a fact, the brief names where it lives.

### 6. Do-now vs trigger-bound (the Batch A/B pattern)
Never plan detail for work whose shape depends on undone work — you'd be
writing fiction (e.g. don't write a Flutter skill before Flutter code
exists; distill it from the real code after). Split every plan into:
- **Batch A (do now):** executable and verifiable today.
- **Batch B (trigger-bound):** each item bound to the *event* that makes it
  executable ("after F-000 CI is green", "when an external user exists") —
  never to a date, and never left in memory. Register triggers where the
  workflow **auto-checks** them (forward-commitments, checked by gate
  commands), so firing doesn't depend on anyone remembering.

### 7. Every cut is written down
Deferral = a written commitment with a trigger and destination (forward-
commitments). Descope = a written out-of-scope line (auditable boundary —
"decided not to" must be distinguishable from "forgot"). A plan whose
exclusions live only in the planner's head loses them at the next session.

## Smell test before dispatching
- Any task named "implement the feature"? → not decomposed, start over.
- Any pair of tasks that will need to talk mid-flight? → wrong seam.
- Any ★-eligible task unmarked? → the most expensive class of mistake.
- Any "we'll remember to do X later" without a registered trigger? → you won't.
- Any task whose brief requires reading another in-flight feature's spec? →
  context bleed; route the fact through canon docs instead.

> Worked example: [2026-07-04-team-upgrade-plan.md](../../../docs/superpowers/plans/2026-07-04-team-upgrade-plan.md)
> (Batch A/B split, trigger binding, checkbox progress) — match that bar.
