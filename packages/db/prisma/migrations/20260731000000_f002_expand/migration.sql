-- F-002 · T-002-01 — EXPAND step (Organization, License & Membership).
-- Spec: docs/features/F-002/data-model.md §1/§2/§4.2. Skill: prisma-migration.
--
-- CONTRACT OF THIS FILE: additive only. It adds columns/indexes/one enum value
-- and DROPS NOTHING. `Invitation.token` still exists and is still NOT NULL after
-- this migration runs — dropping it is the separate CONTRACT step in
-- `20260731000100_f002_drop_invitation_token`. Expand→contract is kept split
-- even though every table is empty today, because (a) the next agent copies this
-- pattern and (b) if the contract step's precondition fails we can stop with
-- expand applied instead of losing the whole set (data-model §4.2).
--
-- NOT TOUCHED, deliberately: StockMovement, UsageEvent, StockLevel columns,
-- InventoryItem, SellableSku, BundleComponent, ChannelListing — i.e. no ledger,
-- money or stock column is read or written here. The only stock-adjacent object
-- is a partial UNIQUE INDEX on Warehouse("organizationId") — an index, no column
-- change, no ledger interaction, no trigger interaction (T-000-05's
-- immutability trigger is on StockMovement/UsageEvent only).
--
-- ────────────────────────────────────────────────────────────────────────────
-- ROLLBACK PATH (fully reversible — no data is destroyed by this migration):
--   DROP INDEX "Warehouse_org_default_key";
--   DROP INDEX "Invitation_org_email_pending_key";
--   DROP INDEX "Invitation_organizationId_email_status_idx";
--   DROP INDEX "Invitation_organizationId_status_createdAt_idx";
--   DROP INDEX "Invitation_tokenHash_key";
--   ALTER TABLE "Invitation" DROP COLUMN "tokenHash",
--     DROP COLUMN "tokenIssuedAt", DROP COLUMN "invitedByUserId",
--     DROP COLUMN "acceptedAt", DROP COLUMN "acceptedByUserId",
--     DROP COLUMN "acceptedUserCreatedAt", DROP COLUMN "cancelledAt",
--     DROP COLUMN "updatedAt";
--   DROP INDEX "Role_organizationId_key_key";
--   ALTER TABLE "Role" DROP COLUMN "key";
--   DROP INDEX "Membership_organizationId_status_createdAt_idx";
--   DROP INDEX "Membership_userId_status_idx";
--   ALTER TABLE "Membership" DROP COLUMN "activatedAt",
--     DROP COLUMN "revokedAt", DROP COLUMN "revokedByUserId";
--   DROP INDEX "Organization_taxId_idx";
--   ALTER TABLE "Organization" DROP COLUMN "createdByUserId";
--   -- NOT reversible (accepted, harmless): the enum value 'cancelled'.
--   -- PostgreSQL cannot remove a value from an enum type. An unused enum value
--   -- has no cost; removing it would require recreating the type and every
--   -- column that uses it. Documented in data-model §4.3.
-- ────────────────────────────────────────────────────────────────────────────

-- AlterEnum
-- MUST BE FIRST, and nothing below may reference 'cancelled'. PostgreSQL allows
-- ALTER TYPE ... ADD VALUE inside a transaction block (PG12+; we run PG16 in
-- docker-compose and CI) but the NEW value cannot be USED until that
-- transaction commits — and Prisma applies a migration file as one transaction.
-- The partial index further down filters on 'pending', which is a PRE-EXISTING
-- value, so it is unaffected by this rule. The first code that writes
-- 'cancelled' runs in F-002's service layer, long after this commits.
-- 'expired' is intentionally left in place but stays write-path-free: expiry is
-- derived at read time from expiresAt (data-model §3.2).
ALTER TYPE "InvitationStatus" ADD VALUE 'cancelled';

-- AlterTable — Organization: provenance of the tenant.
-- No FK to "User" on purpose (User is org-agnostic and may be
-- deleted/anonymized under PDPA) — same pattern as StockMovement.createdBy.
ALTER TABLE "Organization" ADD COLUMN     "createdByUserId" TEXT;

-- CreateIndex — back-office/support TIN lookup.
-- NOT unique: a system-wide unique taxId is a cross-tenant oracle (a 409 would
-- tell any signup "that company is already our customer") and would block one
-- legal entity holding several licenses. Full reasoning: data-model §3.4.
CREATE INDEX "Organization_taxId_idx" ON "Organization"("taxId");

-- AlterTable — Membership lifecycle evidence. Revoking a member never deletes
-- the row (AC US-5); revokedAt doubles as a security input: an invitation
-- issued before revokedAt cannot be accepted (finding I-1).
ALTER TABLE "Membership" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "revokedByUserId" TEXT;

-- CreateIndex — GET /me/organizations + per-user org cap count (data-model §3.5)
CREATE INDEX "Membership_userId_status_idx" ON "Membership"("userId", "status");

-- CreateIndex — member list + "count active owners" under the org row lock
CREATE INDEX "Membership_organizationId_status_createdAt_idx" ON "Membership"("organizationId", "status", "createdAt");

-- AlterTable — Role.key (amend #3 · ux Q4): a stable slug used ONLY to
-- translate the role name on screen. Nullable because custom roles (F-003) have
-- no key. NO BACKFILL NEEDED: Role is empty in every environment (roles are
-- created together with an org, and no org exists yet). If this ever runs
-- against real data, a backfill from "name" must be designed first — add a
-- precondition guard like the one in the contract migration.
ALTER TABLE "Role" ADD COLUMN     "key" TEXT;

-- CreateIndex — one key per org. PostgreSQL treats every NULL as distinct, so
-- any number of custom (key IS NULL) roles coexist under this unique index.
CREATE UNIQUE INDEX "Role_organizationId_key_key" ON "Role"("organizationId", "key");

-- AlterTable — Invitation: hash-at-rest (D-018) + full lifecycle.
-- "tokenHash" is added NULLABLE here on purpose: expand must not break the old
-- shape. It is tightened to NOT NULL in the contract migration.
-- "updatedAt" is added WITH a default and then has the default dropped: adding
-- a NOT NULL column with no default fails on a non-empty table, and Prisma's
-- @updatedAt expects a column with NO database default — this two-step reaches
-- the expected end state without assuming the table is empty.
ALTER TABLE "Invitation" ADD COLUMN     "tokenHash" TEXT,
ADD COLUMN     "tokenIssuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "invitedByUserId" TEXT,
ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "acceptedByUserId" TEXT,
ADD COLUMN     "acceptedUserCreatedAt" TIMESTAMP(3),
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Invitation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex — token lookup on preview/accept is by hash, O(1)
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex — invitation list of an org + pending cap count (data-model §3.5)
CREATE INDEX "Invitation_organizationId_status_createdAt_idx" ON "Invitation"("organizationId", "status", "createdAt");

-- CreateIndex — cancel a member's still-pending invitations inside the same
-- transaction that revokes them (finding I-1)
CREATE INDEX "Invitation_organizationId_email_status_idx" ON "Invitation"("organizationId", "email", "status");

-- CreateIndex — PARTIAL UNIQUE, raw SQL because Prisma's DSL cannot express a
-- WHERE clause on an index. Invariant: at most one PENDING invitation per
-- (org, email). Enforced by the database, not by an `if` that loses a race to a
-- concurrent request. Accepted/cancelled rows are outside the predicate, so the
-- same email can be re-invited any number of times over its lifetime.
-- Filters on 'pending' — a pre-existing enum value, see the AlterEnum note.
CREATE UNIQUE INDEX "Invitation_org_email_pending_key" ON "Invitation"("organizationId", "email") WHERE "status" = 'pending';

-- CreateIndex — PARTIAL UNIQUE, raw SQL (same DSL limitation). Invariant:
-- 1 org = at most 1 default warehouse (Phase 0 is single-warehouse). Rows with
-- isDefault = false are outside the predicate and unconstrained.
-- Index only: no Warehouse column is added, altered or dropped by F-002.
CREATE UNIQUE INDEX "Warehouse_org_default_key" ON "Warehouse"("organizationId") WHERE "isDefault";
