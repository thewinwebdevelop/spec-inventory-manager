-- F-003 · T-003-B11 — f003_backfill_manage_roles (data; AC-1.3 · AC-4.3 · AC-9.3).
-- Authoritative spec: docs/features/F-003/data-model.md §4.2, §4.3, §5 ·
-- architecture.md §12, §14.
--
-- ONE SQL SOURCE: `backfill:f003` (packages/db/src/backfill-f003.ts) executes
-- THIS FILE, byte for byte, in one transaction — never a copy (G3-10, M3-06).
-- So every statement must be safe to run again on a migrated database.
--
-- WHAT IT DOES
--   §1 backfill    the Admin row F-002 provisioning created (key='admin' AND the
--                  exact F-002 capability set) gains `manage_roles`, stored as a
--                  byte-ordered array = SYSTEM_ROLE_BLUEPRINT's Admin. One NOTICE
--                  per row (actor=system — no lastEditedAt, no SecurityEvent:
--                  AC-9.3/9.6 show it as "ค่าเริ่มต้นของระบบ"). `key` is only used
--                  to recognise the row F-002 provisioning wrote; a swapped key
--                  (I-45) or an edited set does not match, gets nothing, and is
--                  counted in one WARNING (fail closed).
--   §2 bridge      BEFORE INSERT trigger: an Admin inserted by F-002 code during a
--                  rolling deploy gets the same treatment. Owner backend-api;
--                  removal is forced by G-12's `removeBy` (see §2).
--   §3 Owner ≥ 1   every shop still has an active member holding `full_access`,
--                  else RAISE 'f003_owner_invariant_violation org=<id>' and the
--                  whole migration (or backfill:f003 run) rolls back.
--
-- IDEMPOTENT: a second run updates 0 rows and bumps no `version`; the trigger is
-- CREATE OR REPLACE + DROP TRIGGER IF EXISTS.
--
-- SORT ORDER: every set is sorted `COLLATE "C"` (byte order) so the comparison
-- and the stored array do not depend on the database's default collation.
--
-- ROLLBACK (data-model §4.3): the backfill is NOT reverted (that would silently
-- take a right away from real people — an Owner edits the role instead). The
-- bridge: DROP TRIGGER IF EXISTS role_f003_admin_bridge ON "Role";
--         DROP FUNCTION IF EXISTS role_f003_admin_bridge();
-- Check before any code rollback (architecture §12; = 0 ⇒ safe):
--   SELECT count(*) FROM "Role"
--    WHERE key IS NULL OR "lastEditedAt" IS NOT NULL OR "deletedAt" IS NOT NULL;

-- Same fail-fast policy as f003_role_expand: the UPDATE row-locks Admin rows
-- and CREATE TRIGGER takes SHARE ROW EXCLUSIVE on "Role". LOCAL = this
-- transaction only (backfill:f003 runs on a pooled connection).
SET LOCAL lock_timeout = '5s';

-- ── §1 backfill ───────────────────────────────────────────────────────────────
DO $$
DECLARE
  r          RECORD;
  v_updated  INTEGER := 0;
  v_mismatch INTEGER;
  v_sample   TEXT;
BEGIN
  FOR r IN
    WITH updated AS (
      UPDATE "Role"
         SET capabilities = (SELECT array_agg(c ORDER BY c COLLATE "C")
                               FROM unnest(array_append(capabilities, 'manage_roles')) c),
             version = version + 1,
             "updatedAt" = now()
       WHERE key = 'admin' AND "deletedAt" IS NULL
         AND NOT ('manage_roles' = ANY (capabilities))
         AND (SELECT array_agg(c ORDER BY c COLLATE "C") FROM unnest(capabilities) c)
             = ARRAY['manage_channels','manage_members','manage_orders','manage_org_settings',
                     'manage_products','manage_stock','view_financials']::text[]
      RETURNING "organizationId", id
    )
    SELECT "organizationId", id FROM updated ORDER BY "organizationId", id
  LOOP
    RAISE NOTICE 'f003_backfill actor=system org=% role=% added=manage_roles', r."organizationId", r.id;
    v_updated := v_updated + 1;
  END LOOP;

  SELECT count(*), string_agg(id, ',' ORDER BY id) FILTER (WHERE rn <= 20)
    INTO v_mismatch, v_sample
    FROM (SELECT id, row_number() OVER (ORDER BY id) AS rn FROM "Role"
           WHERE key = 'admin' AND "deletedAt" IS NULL
             AND NOT ('manage_roles' = ANY (capabilities))) m;
  IF v_mismatch > 0 THEN
    RAISE WARNING 'f003_backfill_admin_mismatch count=% roles=%', v_mismatch, v_sample
      USING HINT = 'key=''admin'' but not the F-002 capability set: left without manage_roles '
                   '(fail closed). An Owner grants it by editing the role (data-model F-003 §4.2).';
  END IF;

  -- read back by backfill:f003 inside the same transaction (rows changed by THIS run)
  PERFORM set_config('omnistock.f003_backfill_updated', v_updated::text, true);
END $$;

-- ── §2 bridge trigger role_f003_admin_bridge ──────────────────────────────────
-- A runtime rule that reads `key` (SR-10) ⇒ it has an owner and an end date:
-- owner backend-api; removed by a later migration `f003_drop_admin_bridge`
-- (DROP TRIGGER IF EXISTS role_f003_admin_bridge ON "Role";
--  DROP FUNCTION IF EXISTS role_f003_admin_bridge();) in the release after devops
-- confirms no F-002 instance is left (architecture §12). G-12
-- (apps/api/test/static-gates/role-key-authority.gate.test.ts) allowlists THIS
-- function with a `removeBy` date; past it, CI is red until the drop lands.
-- INSERT only: an UPDATE is never touched. F-003 code inserts Admin with
-- manage_roles already ⇒ no-op; a custom role (key NULL) ⇒ no-op.
CREATE OR REPLACE FUNCTION role_f003_admin_bridge()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.key = 'admin'
     AND (SELECT array_agg(c ORDER BY c COLLATE "C") FROM unnest(NEW.capabilities) c)
         = ARRAY['manage_channels','manage_members','manage_orders','manage_org_settings',
                 'manage_products','manage_stock','view_financials']::text[] THEN
    NEW.capabilities := (SELECT array_agg(c ORDER BY c COLLATE "C")
                           FROM unnest(array_append(NEW.capabilities, 'manage_roles')) c);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS role_f003_admin_bridge ON "Role";
CREATE TRIGGER role_f003_admin_bridge
  BEFORE INSERT ON "Role"
  FOR EACH ROW
  EXECUTE FUNCTION role_f003_admin_bridge();

-- ── §3 Owner ≥ 1 (AC-4.3 · M3-01) ─────────────────────────────────────────────
-- Owner = an ACTIVE membership whose role holds `full_access` — by capability,
-- never by name/key (architecture §2 · I-45). A shop with none was broken
-- outside the application; a person must look at it.
DO $$
DECLARE
  v_org   TEXT;
  v_count INTEGER;
BEGIN
  SELECT min(o.id), count(*) INTO v_org, v_count
    FROM "Organization" o
   WHERE NOT EXISTS (
           SELECT 1
             FROM "Membership" m
             JOIN "Role" r ON r."organizationId" = m."organizationId" AND r.id = m."roleId"
            WHERE m."organizationId" = o.id
              AND m.status = 'active'
              AND 'full_access' = ANY (r.capabilities));
  IF v_count > 0 THEN
    RAISE EXCEPTION 'f003_owner_invariant_violation org=%', v_org
      USING DETAIL = format('%s shop(s) without an active Owner; the first by id is named.', v_count),
            HINT = 'Restore an active Owner membership by hand, then re-run (data-model F-003 §4.2).';
  END IF;
END $$;
