-- G-12 red fixture — none of these retire `public.role_f003_admin_bridge()`.
-- Appended after `bridge`, an expired entry must STAY red.

-- (a) text in a string literal
DO $$
BEGIN
  RAISE NOTICE 'DROP FUNCTION IF EXISTS public.role_f003_admin_bridge();';
END $$;
SELECT 'DROP FUNCTION role_f003_admin_bridge();' AS reminder;

-- (b) another schema
DROP FUNCTION IF EXISTS audit.role_f003_admin_bridge();

-- (c) another signature (an overload that does not exist)
DROP FUNCTION IF EXISTS role_f003_admin_bridge(text);

-- (d) written inside another function's body — runs only if someone calls it
CREATE OR REPLACE FUNCTION omnistock_cleanup_later()
RETURNS void
LANGUAGE plpgsql
AS $cleanup$
BEGIN
  DROP FUNCTION IF EXISTS role_f003_admin_bridge();
END;
$cleanup$;
