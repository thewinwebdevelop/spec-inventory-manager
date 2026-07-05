-- F-000 · T-000-05 — Ledger immutability trigger (golden rule 2, AC8)
-- Authoritative spec: docs/features/F-000/architecture.md §2.
--
-- The stock/usage ledger is IMMUTABLE: correct a balance by INSERTing a NEW
-- StockMovement (append-only), never by UPDATE/DELETE. This migration installs
-- the DB-level GUARANTEE (Layer 2 of the two-layer defense): even a raw psql
-- session or a future buggy service physically cannot mutate a ledger row.
--
-- Coverage: reject UPDATE, DELETE, and TRUNCATE on "StockMovement" and
-- "UsageEvent". INSERT is intentionally NOT covered by any trigger, so appends
-- pass untouched.
--   * UPDATE / DELETE  -> BEFORE ... FOR EACH ROW      (aborts before commit)
--   * TRUNCATE         -> BEFORE TRUNCATE FOR EACH STATEMENT (row-level not allowed)
-- All raise via RAISE EXCEPTION, guaranteeing full transaction rollback.
-- Table identifiers are quoted PascalCase to match Prisma's default naming.

-- ── Shared reject function ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION omnistock_reject_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'ledger is immutable: % on table % is not allowed (append a new row instead)',
    TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

-- ── StockMovement ───────────────────────────────────────────────────────────
-- UPDATE / DELETE (row-level). INSERT intentionally not attached.
DROP TRIGGER IF EXISTS trg_stock_movement_immutable ON "StockMovement";
CREATE TRIGGER trg_stock_movement_immutable
  BEFORE UPDATE OR DELETE ON "StockMovement"
  FOR EACH ROW
  EXECUTE FUNCTION omnistock_reject_ledger_mutation();

-- TRUNCATE (statement-level — a row-level trigger cannot fire on TRUNCATE).
DROP TRIGGER IF EXISTS trg_stock_movement_no_truncate ON "StockMovement";
CREATE TRIGGER trg_stock_movement_no_truncate
  BEFORE TRUNCATE ON "StockMovement"
  FOR EACH STATEMENT
  EXECUTE FUNCTION omnistock_reject_ledger_mutation();

-- ── UsageEvent ──────────────────────────────────────────────────────────────
-- Same discipline (golden rule 2 applies to the usage ledger too — docs/01 §2).
DROP TRIGGER IF EXISTS trg_usage_event_immutable ON "UsageEvent";
CREATE TRIGGER trg_usage_event_immutable
  BEFORE UPDATE OR DELETE ON "UsageEvent"
  FOR EACH ROW
  EXECUTE FUNCTION omnistock_reject_ledger_mutation();

DROP TRIGGER IF EXISTS trg_usage_event_no_truncate ON "UsageEvent";
CREATE TRIGGER trg_usage_event_no_truncate
  BEFORE TRUNCATE ON "UsageEvent"
  FOR EACH STATEMENT
  EXECUTE FUNCTION omnistock_reject_ledger_mutation();
