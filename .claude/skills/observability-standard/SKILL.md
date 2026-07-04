---
name: observability-standard
description: >-
  Define logging, metrics, alerts, and runbooks for an OmniStock feature so
  operators know it's broken before customers do. Use during Gate 2
  architecture (full features — especially anything with BullMQ jobs, sync, or
  webhooks) and when wiring infra for a feature. Owned by devops; backend-api
  supplies domain signal points; feeds the architecture doc's
  observability/runbook section.
---

# Observability — "sync ค้าง 500 jobs" must page us, not surprise a customer

OmniStock's core is background sync. A silent failure = stale stock on
marketplaces = oversell = real money. Every full feature ships with its
observability defined **at design time**, not bolted on.

## Per-feature deliverable (in architecture.md, full features)
Answer four questions concretely:
1. **Logs** — which events, at which level, with what fields.
2. **Metrics** — what's counted/measured.
3. **Alerts** — which thresholds page/notify whom.
4. **Runbook** — 5 lines: symptom → where to look → first safe action.

## Logging rules
- Structured (JSON), always carrying: `organizationId`, request/job id,
  feature/module tag. **Never**: tokens, passwords, full PII (mask emails/
  phones), secrets, raw platform payloads containing buyer data.
- Errors log cause + context, once, at the failure boundary — no double-logging
  up the stack, no swallowed catches.

## Metrics baseline (BullMQ / sync features get all of these)
- Queue: depth, oldest-job age, fail count, retry count — per queue.
- Sync: push success/fail per channel account, reconciliation drift count.
- API: latency p95 + error rate per endpoint group.
- Jobs that mutate stock/money additionally count ledger writes (should match
  business ops — a cheap invariant probe).

## Alert rules
- Every alert names a **receiver and an action** — an alert nobody acts on is
  deleted. Baseline: queue oldest-job age > SLA, fail-rate spike, token/re-auth
  needed (feeds F-027 user-facing + ops-facing), DB/Redis health.
- Fail-open events (e.g. rate-limiter degraded, F-001 M-7) always alert —
  security posture changes must be visible.

## Runbook format (keep to ~5 lines each)
```
SYMPTOM: <what the alert/user shows>
CHECK:   <dashboard/log query to confirm + narrow>
CAUSE:   <the 1–2 most likely causes>
ACTION:  <first safe step (retry queue, rotate token, scale worker)>
ESCALATE:<when to stop and wake a human / file defect to owner>
```

Multi-tenant note: dashboards and alerts slice by `organizationId` where
possible — "one org's connector is down" and "everything is down" are
different incidents.
