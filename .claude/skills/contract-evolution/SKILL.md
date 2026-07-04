---
name: contract-evolution
description: >-
  Evolve the OmniStock OpenAPI contract safely once any client has shipped.
  Use for every change to packages/contracts or an existing endpoint/DTO/enum/
  error code after the first web or mobile client consumes it. Enforces
  additive-only changes, deprecation before removal, and versioned breaking
  changes. Owned by backend-api; devops wires the CI diff gate; release
  sequences breaking rollouts.
---

# Contract evolution — the contract outlives any single deploy

Once a client ships, the contract is a **promise to running software you don't
control** — especially mobile: a Flutter build on a user's phone may be months
old. Every change must assume old clients are still calling.

## Default: additive-only
- **New fields are optional** (nullable / has default) in responses AND requests.
  A required new request field is a breaking change.
- **Never repurpose** an existing field: no type change, no semantic change, no
  narrowing (e.g. string → enum). Need different semantics → new field.
- **Enums:** add values only if every consuming client tolerates unknown values
  (client codegen must map unknown → safe fallback, never crash). If not
  verifiable, treat as breaking.
- **Error codes are contract too** — clients branch on them. Add freely;
  changing/removing an existing code = breaking.
- New endpoints are always safe; prefer a new endpoint over mutating an old one.

## Deprecate before remove
1. Mark `deprecated: true` in the OpenAPI spec + note the replacement.
2. Announce in the feature's Contract summary + changelog; log `D-XXX` if any
   team must migrate.
3. Keep serving for **≥1 release cycle after every client has migrated** —
   for mobile that means: the last store build using it has fallen out of use
   (or force-update shipped). `release` owns the removal date, not backend-api.

## Breaking change (last resort)
- Requires: explicit **version bump**, `D-XXX` decision entry, migration notes
  for frontend, and `release` sequencing (server supports old+new during the
  window — no flag-day).
- Mobile store lag is the binding constraint: assume weeks, not hours.

## Mechanics (every contract change)
- [ ] Regenerate TS + Dart clients from `packages/contracts`; both compile.
- [ ] CI `openapi-diff` (devops wires) is green: change classified
      additive/deprecating/breaking and matches what you declared.
- [ ] Contract summary of the feature doc updated; consumers notified in handoff.
- [ ] No secrets/internal fields leaked into the public surface (see
      security-reviewer).

If a requirement seems to force a breaking change, escalate the trade-off to
`product` + user before locking — don't absorb it silently.
