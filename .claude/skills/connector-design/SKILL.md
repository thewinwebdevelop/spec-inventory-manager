---
name: connector-design
description: >-
  Design and implement an OmniStock marketplace connector (Shopee/Lazada/TikTok)
  to expert standard. Use for any feature touching an external channel: OAuth,
  product import, stock push, order sync, webhooks, shipping labels,
  reconciliation. Covers the ChannelConnector port, push-vs-poll, idempotency,
  rate-limit & retry via BullMQ, the anti-corruption layer, token security,
  partial-failure and reconciliation. Owned by backend-api.
---

# Connector design (marketplace integration)

External platforms are **unreliable, rate-limited, eventually-consistent, and
each weird in its own way**. The job of a connector is to absorb all of that so
the rest of the system never has to. Get these invariants right and connectors
stop being a source of bugs.

## Non-negotiable invariants (from golden rules + docs/02)
1. **Our system is the source of truth.** Platform is a downstream target. Stock
   flows out (push); we never trust platform stock as authoritative.
2. **Every external call is async via BullMQ** — never inside the request path.
   Jobs must be **idempotent + retryable**.
3. **All connector logic lives in `packages/connectors`** behind the
   `ChannelConnector` interface; `core-domain` must not know any platform exists
   (anti-corruption layer).
4. **Tokens are encrypted at rest** (`ChannelAccount.authData`), refreshed via the
   connector, never logged.
5. Writes that change stock/money still obey the ledger + transaction rules —
   a sync that adjusts stock writes a `StockMovement` like any other write.
6. Every job and query is scoped to `organizationId` + `channelAccountId`.

## The port (implement one adapter per platform, don't touch core)
Conform to `ChannelConnector` (see [docs/02-architecture.md](../../../docs/02-architecture.md) §4):
auth (`getAuthUrl`/`exchangeCode`/`refreshToken`), products (`fetchProducts`),
stock (`pushStock`), orders (`fetchOrders`/`verifyWebhook`/`parseWebhook`), ops
(`getShippingLabel`). Adapter responsibilities:
- Map platform payloads ↔ our domain via an explicit **mapper** (the ACL). No
  platform field names leak past the adapter.
- Translate platform errors into a normalized `ConnectorError` taxonomy
  (auth-expired, rate-limited, not-found, validation, transient, fatal).

## Push vs poll vs webhook — decide per data type
| Data | Mechanism | Why |
|------|-----------|-----|
| Stock (our → platform) | **push** on change, debounced | we are source of truth |
| Orders (platform → us) | **webhook** primary + **poll** backstop | webhooks drop; poll fills gaps |
| Products (import) | **poll/pull** on demand | one-off / user-triggered |
| Token refresh | scheduled job before expiry | avoid mid-sync 401 |
Always have a **polling reconciler** even when webhooks exist — webhooks are
best-effort, not guaranteed.

## Idempotency (the #1 cause of double-counting)
- Derive a stable **idempotency key** per external event: e.g.
  `channelAccountId + platformOrderId + eventType`. Persist processed keys;
  a re-delivered webhook must be a no-op.
- Stock push: send **desired absolute quantity**, not deltas — re-sending is safe.
- Order ingestion: upsert by `(channelAccountId, platformOrderId)`; never insert
  blindly. Apply stock deduction exactly once, guarded by the idempotency record
  inside the same transaction that writes the order + ledger.

## Rate limits & retry (BullMQ)
- Respect each platform's limits: a **per-account rate limiter** (Redis token
  bucket) in front of outbound calls; never burst.
- Retry transient/rate-limited errors with **exponential backoff + jitter**
  (e.g. 1s→2s→4s→…cap), bounded attempts. Auth-expired → refresh token then retry
  once. Validation/fatal → no retry, route to **dead-letter** + alert (F-027).
- Use a **distributed lock** (Redis) per `(account, listing)` to prevent
  concurrent stock pushes racing.
- Make jobs **resumable with a cursor** (e.g. `fetchOrders(since)`); store
  `lastSyncedAt`/cursor per account so a crash doesn't reprocess or skip.

## Partial failure & ordering
- A batch (e.g. import 500 products) must record **per-item** success/failure and
  be re-runnable for only the failures — never all-or-nothing the whole batch.
- Out-of-order events: guard with event timestamps/versions; an older update must
  not overwrite a newer one (last-writer-by-event-time, not by arrival).

## Reconciliation (target: stock match >99.9%, oversell = 0)
- Scheduled reconciler compares our computed sellable vs platform-reported per
  listing; on drift, **re-push from our truth** and emit a discrepancy record.
- Surface health per account: connected / token-expiring / failing-jobs / drift
  → feeds Sync health (F-027) and alerts (F-028).

## Sync state, observability, security
- Model an explicit **sync status** per entity (pending/synced/failed/stale) so
  the UI can show truth (don't fake "synced").
- Trace the pipeline (OpenTelemetry); every job logs `orgId`/`accountId`/key —
  but **never tokens or PII**.
- New platform = new adapter only. If you find yourself editing `core-domain` to
  add a platform, stop — the abstraction is leaking; escalate.

## Definition of done for a connector feature
- Idempotency proven by a **redelivery test** (same webhook twice → one effect).
- Retry/backoff + dead-letter path tested; rate-limiter enforced.
- Reconciler closes a deliberately-injected drift.
- Tokens encrypted, refresh path tested, nothing sensitive logged.
- Stock changes write `StockMovement` in a transaction (see `money-stock` skill).
- Then run `quality-gate`.
