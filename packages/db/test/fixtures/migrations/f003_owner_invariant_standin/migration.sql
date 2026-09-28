-- T-003-QA05 STAND-IN for the tail of `*_f003_backfill_manage_roles`
-- (data-model §4.2: "ท้าย migration: RAISE EXCEPTION
-- 'f003_owner_invariant_violation org=%' ถ้าร้านใด Owner active = 0").
-- NOT a real migration. M3-01 uses it only until T-003-B11 ships the real one;
-- the "source guard" test goes red once a real migration carries the invariant
-- while this file is still the source.
--
-- Owner = a membership with status 'active' whose role holds 'full_access'
-- (decided by capability, not by name/key — architecture §2 / I-45).
DO $$
DECLARE
  v_org TEXT;
BEGIN
  SELECT o.id INTO v_org
    FROM "Organization" o
   WHERE NOT EXISTS (
           SELECT 1
             FROM "Membership" m
             JOIN "Role" r ON r."organizationId" = m."organizationId" AND r.id = m."roleId"
            WHERE m."organizationId" = o.id
              AND m.status = 'active'
              AND 'full_access' = ANY (r.capabilities))
   ORDER BY o.id
   LIMIT 1;
  IF v_org IS NOT NULL THEN
    RAISE EXCEPTION 'f003_owner_invariant_violation org=%', v_org;
  END IF;
END $$;
