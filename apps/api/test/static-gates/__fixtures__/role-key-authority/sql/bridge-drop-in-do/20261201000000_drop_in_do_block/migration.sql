-- G-12 green control — a real drop that runs at migrate time, inside a DO block,
-- written without a signature and with a quoted schema.
DO $$
BEGIN
  DROP FUNCTION IF EXISTS "public"."role_f003_admin_bridge" CASCADE;
END $$;
