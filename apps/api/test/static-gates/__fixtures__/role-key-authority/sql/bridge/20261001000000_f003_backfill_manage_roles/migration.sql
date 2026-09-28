-- G-12 fixture — the SHAPE of the F-003 bridge (data-model §4.2), used to prove
-- the allowlist + removeBy mechanism. Not the real migration (B11 owns that).

-- backfill: an UPDATE that names key='admin' is not a function => not counted
UPDATE "Role" SET "capabilities" = array_append("capabilities", 'manage_roles')
WHERE "key" = 'admin';

CREATE OR REPLACE FUNCTION role_f003_admin_bridge()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NEW."key" = 'admin' AND NOT ('manage_roles' = ANY (NEW."capabilities")) THEN
    NEW."capabilities" := array_append(NEW."capabilities", 'manage_roles');
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS role_f003_admin_bridge ON "Role";
CREATE TRIGGER role_f003_admin_bridge
  BEFORE INSERT ON "Role"
  FOR EACH ROW EXECUTE FUNCTION role_f003_admin_bridge();
