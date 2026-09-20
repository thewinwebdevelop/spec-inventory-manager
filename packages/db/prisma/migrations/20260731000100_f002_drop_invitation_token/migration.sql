-- F-002 · T-002-01 — CONTRACT step: retire the plaintext invitation token.
-- Spec: docs/features/F-002/data-model.md §4.1/§4.2/§4.3. Skill: prisma-migration.
--
-- ⚠️ DESTRUCTIVE. This is the only destructive statement in the F-002 set, and
-- it is deliberately isolated in its own file so it can be reviewed, approved
-- and rolled back independently of the expand step.
--
-- WHY IT IS SAFE RIGHT NOW, AND ONLY RIGHT NOW: "Invitation" is empty in every
-- environment that exists (one dev machine + CI, which builds and drops the
-- database on every run). There is no staging and no production yet. D-018
-- (hash-at-rest) requires the raw token to go away, and a hash cannot be
-- computed from... nothing, nor reversed from a hash — so the longer this
-- waits, the more it costs. Doing it while the table is empty costs nothing.
--
-- The migration does NOT take that claim on trust: it verifies it first and
-- aborts loudly if a single row exists (below). If it ever aborts, DO NOT
-- delete the rows to make it pass — a real row means real pending invitations,
-- which means product has to decide whether to invalidate them all (the only
-- available answer, since hashing is one-way). Design the backfill, then ship a
-- new migration.
--
-- ────────────────────────────────────────────────────────────────────────────
-- ROLLBACK PATH — FORWARD-ONLY in principle, mechanically reversible today.
-- The column is dropped, so any data in it would be unrecoverable; the reason
-- this is acceptable is precisely the precondition above (there is no data).
-- To restore the previous SHAPE (e.g. to re-run an older API build):
--   ALTER TABLE "Invitation" ALTER COLUMN "tokenHash" DROP NOT NULL;
--   ALTER TABLE "Invitation" ADD COLUMN "token" TEXT;
--   CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");
--   -- NOTE: the old shape had "token" NOT NULL. It is restored as NULLABLE
--   -- because no value can be invented for rows written after this migration.
--   -- Tighten to NOT NULL only after a backfill decision exists.
-- Rolling back the enum value 'cancelled' added by the expand migration is not
-- possible in PostgreSQL and not necessary (data-model §4.3).
-- ────────────────────────────────────────────────────────────────────────────

-- Precondition (data-model §4.1) — refuse to run against real invitations.
-- Deliberately placed BEFORE any DDL: if it raises, the whole migration
-- transaction rolls back and the expand migration stays applied on its own,
-- which is a coherent, working state.
DO $$ BEGIN
  IF (SELECT count(*) FROM "Invitation") > 0 THEN
    RAISE EXCEPTION 'F-002 migration aborted: Invitation table is not empty — token→tokenHash needs a backfill plan';
  END IF;
END $$;

-- AlterTable — tighten the expanded column now that nothing can be missing it.
ALTER TABLE "Invitation" ALTER COLUMN "tokenHash" SET NOT NULL;

-- AlterTable — drop the plaintext token (D-018). Its UNIQUE index
-- ("Invitation_token_key") is dropped by PostgreSQL together with the column.
ALTER TABLE "Invitation" DROP COLUMN "token";
