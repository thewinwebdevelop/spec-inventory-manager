-- F-002 · security review B-1 — a role from another org can no longer be
-- attached to a Membership or an Invitation.
--
-- WHAT WAS WRONG
-- `withOrgScope` pins the `organizationId` COLUMN of a write, but it never
-- inspects `data.roleId`. A client scoped to org A could therefore write org
-- B's role onto one of its own memberships — and roles carry `capabilities`,
-- so the role written could be one holding `full_access`. Verified against
-- this database before the change, in both the scalar and nested-`connect`
-- forms.
--
-- Not reachable over HTTP today: all four F-002 write paths resolve the role
-- through an already-scoped transaction first. That is four call sites
-- agreeing, not a property of the data — and the comment claiming it was
-- "impossible by construction" was describing an `if`.
--
-- WHY A COMPOSITE FK RATHER THAN A CHECK IN THE SEAM
-- The seam would need to know which columns are org-scoped foreign keys, for
-- every model, forever. The database already knows how to refuse a pair.
-- `Role(organizationId, id)` gains a unique index purely to be referenceable;
-- it is redundant against the primary key and that is the point.
--
-- ROLLBACK: fully reversible, no data is written or destroyed —
--   ALTER TABLE "Membership" DROP CONSTRAINT "Membership_organizationId_roleId_fkey";
--   ALTER TABLE "Invitation" DROP CONSTRAINT "Invitation_organizationId_roleId_fkey";
--   DROP INDEX "Role_organizationId_id_key";
--   ALTER TABLE "Membership" ADD CONSTRAINT "Membership_roleId_fkey"
--     FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
--   ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_roleId_fkey"
--     FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PRE-FLIGHT. Adding the constraint would fail on a pre-existing cross-org row
-- with a bare Postgres FK error naming neither the rows nor the remedy. This
-- says both. It deliberately does NOT delete anything: a membership pointing
-- at another org's role is a security incident to look at, not debris to
-- silently sweep (skill `prisma-migration`: no destructive statement without a
-- decision behind it).
DO $$
DECLARE
  bad_memberships bigint;
  bad_invitations bigint;
BEGIN
  SELECT count(*) INTO bad_memberships
  FROM "Membership" m JOIN "Role" r ON r.id = m."roleId"
  WHERE r."organizationId" <> m."organizationId";

  SELECT count(*) INTO bad_invitations
  FROM "Invitation" v JOIN "Role" r ON r.id = v."roleId"
  WHERE r."organizationId" <> v."organizationId";

  IF bad_memberships > 0 OR bad_invitations > 0 THEN
    RAISE EXCEPTION
      'B-1 pre-flight: % Membership and % Invitation row(s) reference a Role from another organization. '
      'These are cross-tenant capability grants and must be reviewed by hand before this constraint can be added. '
      'List them with: SELECT m.id, m."organizationId", r."organizationId" FROM "Membership" m '
      'JOIN "Role" r ON r.id = m."roleId" WHERE r."organizationId" <> m."organizationId";',
      bad_memberships, bad_invitations;
  END IF;
END $$;

-- DropForeignKey
ALTER TABLE "Invitation" DROP CONSTRAINT "Invitation_roleId_fkey";

-- DropForeignKey
ALTER TABLE "Membership" DROP CONSTRAINT "Membership_roleId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "Role_organizationId_id_key" ON "Role"("organizationId", "id");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_roleId_fkey" FOREIGN KEY ("organizationId", "roleId") REFERENCES "Role"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_roleId_fkey" FOREIGN KEY ("organizationId", "roleId") REFERENCES "Role"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
