---
name: backup-dr
description: >-
  Backup and disaster-recovery discipline for OmniStock's PostgreSQL, Redis,
  and object storage. Use when provisioning any environment that holds real
  tenant data, before dogfood onboards a real shop, and on the recurring
  restore-drill schedule. A backup that has never been restored is a hope, not
  a backup. Owned by devops; release gates launch on a passed drill.
---

# Backup & DR — we hold other people's money records

OmniStock stores tenants' stock and financial history. Losing it isn't an
outage, it's a business-ending breach of trust. Backups are only real when a
**restore drill** has proven them.

## What gets backed up
- **PostgreSQL** — the crown jewels (ledger, orders, accounting docs):
  automated daily full + WAL/PITR so we can recover to a point in time, not
  just to last night. Retention: ≥30 days (extend when tax documents arrive —
  Thai tax retention rules apply, confirm with product/compliance).
- **Object storage** (attachments, F-040+): versioning or replication; same
  retention thinking; org-prefix layout (F-000 seam) must survive restore.
- **Redis/BullMQ** — treat as **rebuildable, not backed up**: queues must be
  safe to lose (jobs re-enqueueable / reconciliation heals) — if a design makes
  Redis loss unrecoverable, that's an architecture finding, escalate.
- Config/secrets: env schema + secret store recoverable without git (secrets
  are never in git).

## Hard rules
- Backups are **encrypted, off-site** (different provider/account boundary
  from the primary DB), and restore-tested — all three or it doesn't count.
- Targets stated in writing: **RPO ≤ 1h** (max data loss), **RTO ≤ 4h** (max
  downtime) as Phase-0 defaults — product/user may tighten for launch.
- Any destructive migration or bulk operation on prod-like data: verify a
  fresh restore point exists first (pairs with `prisma-migration`).

## Restore drill (the part everyone skips — we don't)
- **Schedule:** before dogfood holds real data (first drill), then quarterly,
  and before public launch (launch-readiness gate).
- Procedure: restore latest backup into a clean environment → run smoke
  (migrate status clean, row counts sane, one org's stock levels fold correctly
  from movements, app boots against it) → record duration vs RTO.
- Output: a short drill report (date, backup age, duration, issues) kept with
  infra docs. A failed drill = P1 defect on devops, blocks release gating.

## Multi-tenant notes
- Restore is **all-or-nothing per database** — per-org "undelete" is a product
  feature (not built); never hand-edit restored data for one org (golden rules
  still apply in a restore).
- DR runbook lives with `observability-standard` runbooks; the alert
  "backup job failed" pages — silence there is the most expensive silence.
