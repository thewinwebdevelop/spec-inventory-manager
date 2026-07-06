-- F-001 · T-001-02 — RefreshToken deltas (data-model §2.1/§3).
--
-- Additive, NON-DESTRUCTIVE, NO BACKFILL. F-000 shipped an EMPTY RefreshToken
-- table (auth issues the first tokens in F-001), so the new NOT NULL columns
-- (familyId, tokenHash, expiresAt, familyExpiresAt) are safe without a default
-- or backfill step — there are no rows to violate NOT NULL. Any pre-existing
-- rows would be pre-auth test rows and can be truncated (there are no live
-- sessions before F-001 ships). See data-model §3.
--
-- Follows prisma-migration discipline: this is the EXPAND step of a plain
-- additive change (no MIGRATE/CONTRACT needed — nothing is renamed or dropped).
-- Ledger-immutability trigger (StockMovement/UsageEvent, T-000-05) is untouched:
-- RefreshToken is NOT a ledger table, so no trigger interaction.
--
-- New columns:
--   familyId        — rotation-chain / session id (arch §3). Fresh on login,
--                     inherited on rotation. Many rows share one familyId.
--   tokenHash       — HMAC-SHA-256(JWT_REFRESH_SECRET, tokenValue), UNIQUE (L-3).
--                     Lookup key; plaintext never stored.
--   expiresAt       — per-token 60-day expiry; SLIDES on rotation.
--   familyExpiresAt — absolute family cap = login + 90d; INHERITED unchanged
--                     (does NOT slide) — D-007.
--   lastUsedAt      — optional session-list UX timestamp.
-- New constraints/indexes:
--   rotatedFrom UNIQUE (I-5) — ≤1 successor per token, DB-enforced. Postgres
--     permits multiple NULLs under UNIQUE, so every family's first token
--     (rotatedFrom = NULL) is unaffected; only two rows sharing the same
--     non-null predecessor are rejected.
--   familyId index — family-wide revoke + session list.
--   (userId, revokedAt) index — list live sessions + D-017 cap-20 count.

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "familyExpiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "familyId" TEXT NOT NULL,
ADD COLUMN     "lastUsedAt" TIMESTAMP(3),
ADD COLUMN     "tokenHash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_rotatedFrom_key" ON "RefreshToken"("rotatedFrom");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_revokedAt_idx" ON "RefreshToken"("userId", "revokedAt");
