-- T-003-QA05 harness self-proof fixture (NOT a real migration — lives outside
-- prisma/migrations and is only ever staged into a scratch database).
-- Fails unconditionally so the harness must report exit != 0 + this text on stderr.
DO $$
BEGIN
  RAISE EXCEPTION 'qa05_fixture_always_raise marker=%', 'harness-live';
END $$;
