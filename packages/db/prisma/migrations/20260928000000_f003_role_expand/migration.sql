-- F-003 · T-003-B10 — f003_role_expand (schema; additive towards F-002 code).
-- Authoritative spec: docs/features/F-003/data-model.md §2, §2.1, §2.2, §3, §4.1, §5
-- · architecture.md §2 (DB = layer 4 of the Owner/full_access defence), §12.
--
-- WHAT IT DOES
--   §0 pre-flight   RAISE (naming check + shop + role) before any DDL if F-002
--                   data breaks an invariant the new constraints would enforce.
--   §1 columns      Role +6 (version, nameCustomized, lastEditedAt,
--                   lastEditedByUserId, deletedAt, deletedByUserId) ·
--                   Invitation +issuedByUserId. All defaulted or nullable, so
--                   an F-002 INSERT (which names none of them) still succeeds.
--   §2 CHECKs       capabilities ≥ 1 · full_access ⇒ isSystem · system row never
--                   soft-deleted · name shape (trimmed, no double space, 1–50,
--                   no forbidden code point).
--   §3 indexes      case-insensitive name unique among LIVE roles · one isSystem
--                   role per shop — both created BEFORE the old unique is dropped.
--   §4 triggers     role_system_row_lock · role_system_flag_guard ·
--                   role_soft_delete_guard · role_live_reference_guard.
--   Deliberately NOT here: the `manage_roles` backfill + Owner ≥ 1 check +
--   admin bridge trigger (= *_f003_backfill_manage_roles, T-003-B11).
--
-- FORBIDDEN CODE POINTS in a role name (CHECK "Role_name_shape" and the §0
-- pre-flight carry the SAME class): Cc ∪ Cf ∪ Default_Ignorable_Code_Point ∪
-- Co ∪ Cs ∪ {U+115F, U+1160, U+3164, U+FFA0, U+2800} — widened from the
-- data-model's Cc ∪ Cf by the B04 security review (PM 2026-09-28). The class is
-- GENERATED, never hand-typed: renderEscapedClass(forbiddenRoleNameSet()) in
-- packages/db/test/unicode-class.ts, under Node 22 / Unicode 16.0. G3-07
-- (packages/db/test/unicode-parity.test.ts + apps/api/test/
-- role-name-charset-parity.test.ts) fails if it ever differs from Node's set
-- or from core-domain's. A Node upgrade that grows the set ⇒ a NEW migration
-- re-creating the CHECK; never edit this file once applied.
--
-- WHITESPACE in a role name mirrors core-domain normalizeRoleName (NFC → trim →
-- collapse JS `\s+` to ONE U+0020): no JS-`\s` code point at either end, no two
-- in a row, and none other than U+0020 anywhere. Written as explicit escape
-- classes GENERATED from Node's `/\s/u` (renderEscapedClass(jsWhitespaceSet())
-- and the same minus U+0020) — NOT Postgres `btrim()` (U+0020 only) or `\s`
-- (depends on the database's LC_CTYPE). G3-07 pins both classes to Node.
--
-- KNOWN LIMIT — `lower(name)` in "Role_org_name_ci_live_key" folds case with the
-- database's default collation/ctype. Under LC_CTYPE=C it folds ASCII only, so
-- "ÉQUIPE"/"équipe" (or Greek/Cyrillic pairs) are NOT a duplicate at the DB,
-- while core-domain's JS toLowerCase says they are. Thai has no case, so the
-- dogfood data is unaffected; the service check (JS, under the org lock) remains
-- the rule. Pinning it (e.g. lower(name COLLATE "und-x-icu")) is a devops/DB
-- decision — proposed in the T-003-B10 report, not done here.
--
-- RE-APPLY: every statement is idempotent (IF [NOT] EXISTS, pg_constraint
-- probes, CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS), so a run that
-- stopped halfway — or a second full run — ends in the same catalogue (M3-03).
--
-- LOCK TIMEOUT: ADD COLUMN / ADD CONSTRAINT / CREATE INDEX take ACCESS EXCLUSIVE
-- (or SHARE) on "Role"/"Invitation" and hold it until the migration's
-- transaction ends. `lock_timeout = 5s` makes the deploy FAIL FAST instead of
-- queueing every Role/Invitation read behind a long-running transaction. On
-- "canceling statement due to lock timeout" the whole migration rolled back;
-- Prisma records it as failed (P3009) ⇒ runbook: find the blocker
-- (pg_stat_activity / pg_locks on "Role"), then
--   prisma migrate resolve --rolled-back 20260928000000_f003_role_expand
--   prisma migrate deploy        -- re-run; the file is idempotent
-- (proven by M3-03 "lock timeout" in packages/db/test/f003-role-expand.int.test.ts).
--
-- LOCKS: Role ≤ 30 live (+ ≤ 500 deleted) rows per shop, so the plain CREATE
-- INDEX / ADD CONSTRAINT scans are short; no CONCURRENTLY (it cannot run inside
-- the migration's transaction anyway). Invitation ADD COLUMN nullable without a
-- default is metadata-only.
--
-- ROLLBACK (data-model §4.3 — only after a SAFE code rollback, arch §12):
--   DROP TRIGGER IF EXISTS role_live_reference_guard ON "Invitation";
--   DROP TRIGGER IF EXISTS role_live_reference_guard ON "Membership";
--   DROP TRIGGER IF EXISTS role_soft_delete_guard ON "Role";
--   DROP TRIGGER IF EXISTS role_system_flag_guard ON "Role";
--   DROP TRIGGER IF EXISTS role_system_row_lock ON "Role";
--   DROP FUNCTION IF EXISTS omnistock_role_live_reference_guard(), omnistock_role_soft_delete_guard(),
--                           omnistock_role_system_flag_guard(), omnistock_role_system_row_lock();
--   -- a soft-deleted role may share a name with a live one: rename those first
--   UPDATE "Role" SET name = left(name, 40) || ' #' || left(id, 8) WHERE "deletedAt" IS NOT NULL;
--   CREATE UNIQUE INDEX "Role_organizationId_name_key" ON "Role"("organizationId", "name");
--   DROP INDEX IF EXISTS "Role_org_name_ci_live_key"; DROP INDEX IF EXISTS "Role_one_system_per_org";
--   ALTER TABLE "Role" DROP CONSTRAINT IF EXISTS "Role_name_shape",
--     DROP CONSTRAINT IF EXISTS "Role_system_not_deleted",
--     DROP CONSTRAINT IF EXISTS "Role_full_access_system_only",
--     DROP CONSTRAINT IF EXISTS "Role_capabilities_nonempty";
--   ALTER TABLE "Role" DROP COLUMN "deletedByUserId", DROP COLUMN "deletedAt",
--     DROP COLUMN "lastEditedByUserId", DROP COLUMN "lastEditedAt",
--     DROP COLUMN "nameCustomized", DROP COLUMN "version";   -- lastEdited/deleted data is lost (accepted)
--   ALTER TABLE "Invitation" DROP COLUMN "issuedByUserId";
-- The DROP COLUMNs are destructive: release sign-off + backup point first.

SET lock_timeout = '5s';

-- ── §0 pre-flight ─────────────────────────────────────────────────────────────
-- Today's data is Owner/Admin/Staff × N and is expected to pass. A failure means
-- a row was edited outside the application: a person must look at it — this
-- migration fixes nothing by itself. On a RE-APPLY the new CHECK/unique already
-- hold these, except that a soft-deleted role may reuse a live name, so the
-- duplicate check looks at live rows only once "deletedAt" exists.
DO $$
DECLARE
  v_live  TEXT := '';
  v_check TEXT;
  v_org   TEXT;
  v_role  TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = current_schema() AND table_name = 'Role' AND column_name = 'deletedAt') THEN
    v_live := ' AND "deletedAt" IS NULL';
  END IF;

  EXECUTE format(
    'SELECT "organizationId", min(id) FROM "Role" WHERE true %s
      GROUP BY "organizationId", lower(btrim(name)) HAVING count(*) > 1
      ORDER BY 1 LIMIT 1', v_live)
    INTO v_org, v_role;
  IF v_org IS NOT NULL THEN v_check := 'name_duplicate_ci'; END IF;

  IF v_check IS NULL THEN
    SELECT "organizationId", id INTO v_org, v_role FROM "Role"
     WHERE NOT (char_length(name) BETWEEN 1 AND 50
                AND name !~ '^[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028-\u2029\u202F\u205F\u3000\uFEFF]' AND name !~ '[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028-\u2029\u202F\u205F\u3000\uFEFF]$'
                AND name !~ '[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028-\u2029\u202F\u205F\u3000\uFEFF][\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028-\u2029\u202F\u205F\u3000\uFEFF]' AND name !~ '[\u0009-\u000D\u00A0\u1680\u2000-\u200A\u2028-\u2029\u202F\u205F\u3000\uFEFF]'
                AND name !~ '[\u0000-\u001F\u007F-\u009F\u00AD\u034F\u0600-\u0605\u061C\u06DD\u070F\u0890-\u0891\u08E2\u115F-\u1160\u17B4-\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\u2800\u3164\uD800-\uF8FF\uFE00-\uFE0F\uFEFF\uFFA0\uFFF0-\uFFFB\U000110BD\U000110CD\U00013430-\U0001343F\U0001BCA0-\U0001BCA3\U0001D173-\U0001D17A\U000E0000-\U000E0FFF\U000F0000-\U000FFFFD\U00100000-\U0010FFFD]')
     ORDER BY "organizationId", id LIMIT 1;
    IF v_org IS NOT NULL THEN v_check := 'name_shape'; END IF;
  END IF;

  IF v_check IS NULL THEN
    SELECT "organizationId", min(id) INTO v_org, v_role FROM "Role"
     WHERE "isSystem" GROUP BY "organizationId" HAVING count(*) > 1 ORDER BY 1 LIMIT 1;
    IF v_org IS NOT NULL THEN v_check := 'system_role_count'; END IF;
  END IF;

  IF v_check IS NULL THEN
    SELECT "organizationId", id INTO v_org, v_role FROM "Role"
     WHERE capabilities IS NULL OR cardinality(capabilities) = 0
     ORDER BY "organizationId", id LIMIT 1;
    IF v_org IS NOT NULL THEN v_check := 'capabilities_empty'; END IF;
  END IF;

  IF v_check IS NULL THEN
    SELECT "organizationId", id INTO v_org, v_role FROM "Role"
     WHERE 'full_access' = ANY (capabilities) AND NOT "isSystem"
     ORDER BY "organizationId", id LIMIT 1;
    IF v_org IS NOT NULL THEN v_check := 'full_access_not_system'; END IF;
  END IF;

  IF v_check IS NOT NULL THEN
    RAISE EXCEPTION 'f003_role_expand_preflight check=% org=% role=%', v_check, v_org, v_role
      USING HINT = 'Role data was changed outside the application. Review it by hand '
                   '(data-model F-003 §4.1); this migration changes nothing until it passes.';
  END IF;
END $$;

-- ── §1 columns ────────────────────────────────────────────────────────────────
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "nameCustomized" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "lastEditedAt" TIMESTAMP(3);
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "lastEditedByUserId" TEXT;
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT;
ALTER TABLE "Invitation" ADD COLUMN IF NOT EXISTS "issuedByUserId" TEXT;

-- ── §2 CHECK constraints ──────────────────────────────────────────────────────
-- "Role_capabilities_nonempty" also refuses NULL: the column is a nullable
-- TEXT[] since F-000, and cardinality(NULL) >= 1 is NULL, which a CHECK passes.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = '"Role"'::regclass AND conname = 'Role_capabilities_nonempty') THEN
    ALTER TABLE "Role" ADD CONSTRAINT "Role_capabilities_nonempty"
      CHECK (capabilities IS NOT NULL AND cardinality(capabilities) >= 1);                       -- AC-3.6
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = '"Role"'::regclass AND conname = 'Role_full_access_system_only') THEN
    ALTER TABLE "Role" ADD CONSTRAINT "Role_full_access_system_only"
      CHECK (NOT ('full_access' = ANY (capabilities)) OR "isSystem");                            -- AC-4.2
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = '"Role"'::regclass AND conname = 'Role_system_not_deleted') THEN
    ALTER TABLE "Role" ADD CONSTRAINT "Role_system_not_deleted"
      CHECK (NOT ("isSystem" AND "deletedAt" IS NOT NULL));                                      -- AC-4.1
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = '"Role"'::regclass AND conname = 'Role_name_shape') THEN
    ALTER TABLE "Role" ADD CONSTRAINT "Role_name_shape"                                          -- AC-3.4 · SR-04
      CHECK (char_length(name) BETWEEN 1 AND 50
             AND name !~ '^[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028-\u2029\u202F\u205F\u3000\uFEFF]' AND name !~ '[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028-\u2029\u202F\u205F\u3000\uFEFF]$'
             AND name !~ '[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028-\u2029\u202F\u205F\u3000\uFEFF][\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028-\u2029\u202F\u205F\u3000\uFEFF]' AND name !~ '[\u0009-\u000D\u00A0\u1680\u2000-\u200A\u2028-\u2029\u202F\u205F\u3000\uFEFF]'
             AND name !~ '[\u0000-\u001F\u007F-\u009F\u00AD\u034F\u0600-\u0605\u061C\u06DD\u070F\u0890-\u0891\u08E2\u115F-\u1160\u17B4-\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\u2800\u3164\uD800-\uF8FF\uFE00-\uFE0F\uFEFF\uFFA0\uFFF0-\uFFFB\U000110BD\U000110CD\U00013430-\U0001343F\U0001BCA0-\U0001BCA3\U0001D173-\U0001D17A\U000E0000-\U000E0FFF\U000F0000-\U000FFFFD\U00100000-\U0010FFFD]');
  END IF;
END $$;

-- ── §3 unique indexes (new ones first, then drop the F-000 one) ──────────────
-- Prisma's DSL cannot express an expression/partial index: schema.prisma points here.
CREATE UNIQUE INDEX IF NOT EXISTS "Role_org_name_ci_live_key"
  ON "Role" ("organizationId", lower(name)) WHERE "deletedAt" IS NULL;                         -- AC-3.4
CREATE UNIQUE INDEX IF NOT EXISTS "Role_one_system_per_org"
  ON "Role" ("organizationId") WHERE "isSystem";                                                -- SR-07
-- No F-002 code relies on it, and the index above is stricter for live rows.
DROP INDEX IF EXISTS "Role_organizationId_name_key";

-- ── §4 triggers (data-model §3.3) ─────────────────────────────────────────────
-- Errors carry an `f003_…` token + ERRCODE restrict_violation; the API maps an
-- unexpected one to 500 INTERNAL + error log. The service checks under the org
-- lock are the primary rule (with the nice error codes); these make a future
-- code path that forgets them fail instead of writing.

-- role_system_row_lock (AC-4.1): the isSystem row's permission data is frozen.
-- `key` is deliberately NOT locked — I-45 swaps it; it carries no permission.
CREATE OR REPLACE FUNCTION omnistock_role_system_row_lock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_col TEXT;
BEGIN
  v_col := CASE
    WHEN NEW.name IS DISTINCT FROM OLD.name THEN 'name'
    WHEN NEW.capabilities IS DISTINCT FROM OLD.capabilities THEN 'capabilities'
    WHEN NEW."isSystem" IS DISTINCT FROM OLD."isSystem" THEN 'isSystem'
    WHEN NEW."deletedAt" IS DISTINCT FROM OLD."deletedAt" THEN 'deletedAt'
  END;
  IF v_col IS NOT NULL THEN
    RAISE EXCEPTION 'f003_role_system_row_locked role=% column=%', OLD.id, v_col
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS role_system_row_lock ON "Role";
CREATE TRIGGER role_system_row_lock
  BEFORE UPDATE ON "Role"
  FOR EACH ROW WHEN (OLD."isSystem")
  EXECUTE FUNCTION omnistock_role_system_row_lock();

-- role_system_flag_guard (SR-07): a custom role never becomes a system role, so
-- `SET "isSystem"=true, capabilities='{full_access}'` (which the full_access ⇒
-- isSystem CHECK alone would accept) is refused. A second system role by INSERT
-- is refused by "Role_one_system_per_org".
CREATE OR REPLACE FUNCTION omnistock_role_system_flag_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'f003_role_system_flag_forbidden role=%', OLD.id
    USING ERRCODE = 'restrict_violation';
END;
$$;
DROP TRIGGER IF EXISTS role_system_flag_guard ON "Role";
CREATE TRIGGER role_system_flag_guard
  BEFORE UPDATE OF "isSystem" ON "Role"
  FOR EACH ROW WHEN (NOT OLD."isSystem" AND NEW."isSystem")
  EXECUTE FUNCTION omnistock_role_system_flag_guard();

-- role_soft_delete_guard (AC-3.9 · SR-06 direction ข): a role an active member or
-- a pending invitation (expired ones included) still points at is not deleted.
-- ⚠ VOLATILE (the default) on purpose — never STABLE/IMMUTABLE: under READ
-- COMMITTED a VOLATILE function takes a fresh snapshot per query, so after
-- waiting on a concurrent INSERT's FOR SHARE lock it SEES that committed row.
-- A STABLE function would reuse the caller's pre-wait snapshot and miss it.
CREATE OR REPLACE FUNCTION omnistock_role_soft_delete_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_members BIGINT;
  v_invites BIGINT;
BEGIN
  SELECT count(*) INTO v_members FROM "Membership"
   WHERE "organizationId" = NEW."organizationId" AND "roleId" = NEW.id AND status = 'active';
  SELECT count(*) INTO v_invites FROM "Invitation"
   WHERE "organizationId" = NEW."organizationId" AND "roleId" = NEW.id AND status = 'pending';
  IF v_members > 0 OR v_invites > 0 THEN
    RAISE EXCEPTION 'f003_role_in_use role=% active_members=% pending_invitations=%',
      NEW.id, v_members, v_invites
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS role_soft_delete_guard ON "Role";
CREATE TRIGGER role_soft_delete_guard
  BEFORE UPDATE OF "deletedAt" ON "Role"
  FOR EACH ROW WHEN (NEW."deletedAt" IS NOT NULL AND OLD."deletedAt" IS NULL)
  EXECUTE FUNCTION omnistock_role_soft_delete_guard();

-- role_live_reference_guard (SR-06 direction ก): an active Membership / pending
-- Invitation may not point at a soft-deleted role. Reads the Role row FOR SHARE:
-- the FK check only takes FOR KEY SHARE, which does NOT conflict with the
-- delete's `UPDATE deletedAt` (NO KEY UPDATE) — FOR SHARE does, so the two
-- writes serialize instead of both committing. VOLATILE for the same reason as
-- above. History rows (revoked / accepted / cancelled) are not checked.
CREATE OR REPLACE FUNCTION omnistock_role_live_reference_guard()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_deleted TIMESTAMP(3);
BEGIN
  SELECT "deletedAt" INTO v_deleted FROM "Role"
   WHERE "organizationId" = NEW."organizationId" AND id = NEW."roleId"
   FOR SHARE;
  -- no row: the composite FK reports it right after this trigger
  IF v_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'f003_role_deleted role=% table=%', NEW."roleId", TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS role_live_reference_guard ON "Membership";
CREATE TRIGGER role_live_reference_guard
  BEFORE INSERT OR UPDATE OF "roleId", status ON "Membership"
  FOR EACH ROW WHEN (NEW.status = 'active')
  EXECUTE FUNCTION omnistock_role_live_reference_guard();
DROP TRIGGER IF EXISTS role_live_reference_guard ON "Invitation";
CREATE TRIGGER role_live_reference_guard
  BEFORE INSERT OR UPDATE OF "roleId", status ON "Invitation"
  FOR EACH ROW WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION omnistock_role_live_reference_guard();
