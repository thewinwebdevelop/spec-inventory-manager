-- G-12 fixture — the later migration that retires the bridge. Appended after the
-- `bridge` fixture it makes an expired allowlist entry green again.
DROP TRIGGER IF EXISTS role_f003_admin_bridge ON "Role";
DROP FUNCTION IF EXISTS public.role_f003_admin_bridge();
