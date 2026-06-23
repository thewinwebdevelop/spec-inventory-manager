---
name: money-stock
description: >-
  Implement and test any OmniStock code that touches money or stock to
  golden-rule standard. Use for inventory movements, availability, allocation,
  weighted-average cost, COGS, bundles, pricing, accounting documents, and their
  tests. Covers the immutable ledger, transaction boundaries, Decimal/integer
  rules, the 5-layer model math, multi-tenant isolation, and the required test
  matrix. Owned by backend-api (logic) and qa (verification).
---

# Money & stock — the rules that must never bend

This is where bugs cost real money and real oversells. Treat every line that
touches stock or money as high-stakes: it ships **inside a transaction, writes
the ledger, has tests, and uses the right number type** — no exceptions.

## The 5-layer model (compute, don't store, what's derived)
`Product → SellableSku → BundleComponent → InventoryItem` + `ChannelListing`.
- **InventoryItem** holds the real stock (integer) and cost (Decimal,
  weighted-average). This is the only thing that "has" stock.
- **SellableSku has NO stored stock.** Availability is **derived**:
  `available = min over components of floor(item.available / qty)`.
- **COGS of a sellable = Σ(component weighted-avg cost × qty).**
- **Bundles are virtual** — components are deducted at sale time, not pre-assembled.
Never persist a derived value as if it were a source figure; recompute it.

## Ledger is immutable (golden rule 2)
- Adjust stock by **appending a new `StockMovement`**, never `update`/`delete` of
  a past quantity. The current level is the **fold of movements**, optionally
  with a cached running balance that is itself only ever appended/recomputed.
- Every movement records: `organizationId`, item, qty delta (signed integer),
  reason/type (purchase, sale, adjustment, return, reconciliation, transfer),
  reference (orderId/docId), and actor. This gives a free audit trail.
- A correction is a **new compensating movement**, not an edit.

## Transactions (golden rule 5)
- Any write that changes stock or money runs in **one DB transaction that also
  writes the ledger**. Either the business row and its movement both commit, or
  neither does. No path writes stock without a movement in the same tx.
- Concurrency: guard against oversell with row locks / atomic conditional updates
  (e.g. decrement only if `available >= qty`); never read-modify-write without a
  guard. For sync races use the connector's distributed lock.
- **Idempotency:** a retried order/webhook must not double-deduct — guard the
  movement creation by an idempotency key inside the same tx (see `connector-design`).

## Numbers (golden rule 7)
- **Money = Decimal/numeric. Never float.** Do arithmetic with a Decimal library;
  store as Postgres `numeric`. No `number` for baht.
- **Stock = integer.** No fractional units unless a future UoM feature says so.
- **Rounding is explicit**: define rounding mode + scale for money (e.g. 2 dp,
  half-up) at the point of computation; document it. VAT/WHT rounding must match
  Thai accounting expectations (see accounting features).

## Allocation, reservation, oversell
- Selling reserves/deducts component stock; define the policy explicitly
  (allocate-on-order vs on-confirm) per `Settings`. Reserved ≠ available.
- Returns/cancellations **add stock back via a movement** + adjust accounting —
  never silently restore by editing a number.

## Multi-tenant (golden rule 3)
- Every query and movement filters `organizationId`. Stock/cost of one org must be
  invisible and unaffectable by another. Enforce at the repository/middleware
  layer, not ad hoc.

## Where the code lives (golden rule 6)
- Pure math (availability, COGS, weighted-avg, allocation) → `packages/core-domain`
  as **pure functions**, no DB/framework. I/O (tx, persistence) wraps around it.

## Required test matrix (qa — no money/stock merges without these)
1. **Ledger append-only**: an adjustment creates a new movement; no row updated.
2. **Transaction atomicity**: inject a failure mid-write → business row AND
   movement both roll back (no half-write).
3. **Idempotency**: same order/webhook applied twice → stock deducted once.
4. **Concurrency / oversell**: parallel orders on last unit → exactly one succeeds,
   no negative stock.
5. **Derived availability**: bundle of components computes
   `min(floor(item.available/qty))` correctly, incl. zero/edge qty.
6. **Weighted-average cost**: multiple purchases at different costs → correct
   running average; COGS = Σ(component cost × qty).
7. **Decimal precision**: no float drift in totals/COGS/cost; rounding mode honored.
8. **Cross-tenant isolation**: org A cannot read/move org B's stock or cost.
9. **Returns/reconciliation**: restore + correction go through movements, balances
   reconcile.

Then run `quality-gate` (Gate C + E).
