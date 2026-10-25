-- G-12 red fixture SQL-FN — a database function that decides by Role.key and
-- is NOT in the allowlist. Exactly one offender expected:
-- `rogue_owner_only`. Everything else in this file is a control.

-- control: a one-shot backfill UPDATE is not a runtime rule (not a function)
UPDATE "Role" SET "capabilities" = array_append("capabilities", 'manage_roles')
WHERE "key" = 'admin';

-- control: an anonymous DO block runs once at migrate time
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Role" WHERE key = 'owner' AND NOT "isSystem") THEN
    RAISE EXCEPTION 'preflight';
  END IF;
END $$;

-- control: a function that never reads key
CREATE OR REPLACE FUNCTION omnistock_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'immutable';
END;
$$;

-- control: prose in a comment is not a function
-- CREATE FUNCTION f() AS $$ SELECT key = 'owner' $$;

-- RED: runtime authority from the key
CREATE FUNCTION "public"."rogue_owner_only"(p_role_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $body$
  SELECT r."key" = 'owner' FROM "Role" r WHERE r.id = p_role_id;
$body$;
