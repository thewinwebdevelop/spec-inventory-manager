// F-002 · T-002-22 — the seed kit (test-plan §19.1 item 2 + item 9 ·
// architecture §12.2 items 2 and 8).
//
// WHY A KIT AND NOT A TEST-ONLY ENDPOINT
// qa refused a seeding endpoint outright (test-plan Q8): anything that ships
// with the production build is new attack surface, and "guarded by an env var"
// is the same sentence every seeded-admin CVE starts with. So this file lives
// OUTSIDE `src/` — `apps/api/tsconfig.json` compiles only `src`, so it is
// structurally impossible for it to reach `dist/`.
//
// THE FOUR CONDITIONS qa ATTACHED (test-plan Q8, architecture §12.2 item 2)
//   (ก) `tokenHash` must be computed by the PRODUCTION function. This kit never
//       hashes anything itself — see `resolveInvitationTokenHasher`. If a kit
//       hashes its own tokens, I-14 proves only that the kit agrees with itself.
//   (ข) `expiresAt` / `tokenIssuedAt` / `revokedAt` / `createdAt` are free
//       parameters, so `revokedAt >`, `<` and `==` `tokenIssuedAt` are all
//       reachable (the three states of I-1).
//   (ค) NO fake timers anywhere. Postgres' own `now()` is not covered by them,
//       so a suite that fakes time is testing a clock the database disagrees
//       with. Every temporal state here is produced by writing explicit
//       timestamps.
//   (ง) `Membership.status='invited'` is creatable even though no production
//       write path produces it — that is precisely how we prove it is refused.
//
// ROLE KEYS (architecture §12.2 item 8 · I-44/I-45): roles are fully specified
// by the caller, `key: null` included, and `setRoleKey()` can SWITCH the key of
// an existing role. The kit deliberately does NOT dodge
// `@@unique([organizationId, key])` — seeding a duplicate key must fail loudly,
// because I-45 (flip Staff's key to "owner", privileges must not move) depends
// on the database behaving exactly as production does.
import { randomUUID } from "node:crypto";
import { SYSTEM_ROLE_BLUEPRINT } from "@omnistock/core-domain";
import type { PrismaClient } from "@omnistock/db";
import { HashingService } from "../src/auth/hashing.service";

// ── types ───────────────────────────────────────────────────────────────────

export type MembershipStatusValue = "active" | "invited" | "revoked";
export type InvitationStatusValue = "pending" | "accepted" | "cancelled";

/** A role to create with an org. `key: null` = a custom role (F-003 shape). */
export interface RoleSpec {
  readonly name: string;
  readonly key: string | null;
  readonly capabilities: readonly string[];
  readonly isSystem?: boolean;
}

export interface SeededRole {
  readonly id: string;
  readonly name: string;
  readonly key: string | null;
  readonly capabilities: readonly string[];
}

export interface SeededOrg {
  readonly id: string;
  readonly name: string;
  /** Roles by their `name` (not by `key` — the key is a thing under test). */
  readonly roles: Readonly<Record<string, SeededRole>>;
}

export interface SeededUser {
  readonly id: string;
  readonly email: string;
  /** The plaintext this user's `passwordHash` was produced from. */
  readonly password: string;
}

export interface SeededMembership {
  readonly id: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly roleId: string;
  readonly status: MembershipStatusValue;
}

export interface SeededInvitation {
  readonly id: string;
  readonly organizationId: string;
  readonly email: string;
  readonly roleId: string;
  readonly status: InvitationStatusValue;
  /** The RAW token — exists only here and in the emailed link, never in the DB. */
  readonly rawToken: string;
}

/**
 * The three system roles every F-002 org is created with — DERIVED from
 * production's `SYSTEM_ROLE_BLUEPRINT`, never restated here.
 *
 * ⚠️ It used to be a hand-written copy, and it had already drifted: the kit gave
 * Admin 2 capabilities where production gives 7, Staff 1 where production gives
 * 3, and marked all three `isSystem: true` where production marks only Owner.
 * Nothing failed — which is the problem. A QA case asserting "an Admin can do X"
 * against a kit-seeded org was exercising a DIFFERENT Admin from the one
 * `POST /organizations` creates, so it could pass while the real role was wrong,
 * or fail for a difference that exists only in the fixture.
 *
 * Same rule as `resolveInvitationTokenHasher` right below: a kit that restates
 * production proves only that the kit agrees with itself.
 *
 * `key` is a stable slug used ONLY to translate the name on screen — never to
 * decide permissions. That rule is what I-45 tests, using `setRoleKey()`.
 */
export const DEFAULT_ROLE_SPECS: readonly RoleSpec[] = Object.freeze(
  SYSTEM_ROLE_BLUEPRINT.map((role) =>
    Object.freeze({
      name: role.name,
      key: role.key,
      capabilities: role.capabilities,
      isSystem: role.isSystem,
    }),
  ),
) as readonly RoleSpec[];

/** Scenario names the CLI accepts (architecture §12.2 item 2/8). */
export const F002_SCENARIOS = [
  "two-orgs",
  "fifty-orgs",
  "revoked-member",
  "invited-member",
  "custom-role-null-key",
  "expired-invite",
  "superseded-invite",
  "high-role-invite",
] as const;

export type F002Scenario = (typeof F002_SCENARIOS)[number];

export interface ScenarioResult {
  readonly scenario: F002Scenario;
  readonly orgs: readonly SeededOrg[];
  readonly users: readonly SeededUser[];
  readonly memberships: readonly SeededMembership[];
  readonly invitations: readonly SeededInvitation[];
  /** Free-form, scenario-specific notes an E2E spec reads (ids, raw tokens). */
  readonly notes: Readonly<Record<string, unknown>>;
}

// ── the production-hasher dependency (condition ก) ──────────────────────────

/**
 * Thrown when the kit is asked for something whose PRODUCTION implementation
 * does not exist yet. The kit refuses to substitute its own — that is the whole
 * point of condition (ก).
 */
export class MissingProductionDependencyError extends Error {
  constructor(
    readonly symbol: string,
    readonly owner: string,
    readonly why: string,
  ) {
    super(
      `seed kit cannot continue: \`${symbol}\` is not exported yet (owner: ${owner}). ${why}\n` +
        `The kit will NOT compute this itself — a kit that hashes its own tokens makes ` +
        `I-14 prove only that the kit agrees with the kit (D-018 / test-plan Q8 ก).`,
    );
    this.name = "MissingProductionDependencyError";
  }
}

/** Shape of the production invitation-token hasher (architecture §7). */
export type InvitationTokenHasher = (token: string) => string;

/**
 * Resolve the PRODUCTION `hashInvitationToken`. `module` is injectable so the
 * meta-test can prove both branches without waiting for the implementation.
 */
export function resolveInvitationTokenHasher(
  module: Readonly<Record<string, unknown>>,
): InvitationTokenHasher {
  const fn = module.hashInvitationToken;
  if (typeof fn !== "function") {
    throw new MissingProductionDependencyError(
      "hashInvitationToken",
      "@backend-api (packages/db)",
      "invitation seeding is blocked until it lands; every other scenario works.",
    );
  }
  return fn as InvitationTokenHasher;
}

// ── the kit ─────────────────────────────────────────────────────────────────

/** Only the models the kit touches — keeps it usable with any Prisma client. */
export type SeedPrismaClient = Pick<
  PrismaClient,
  | "user"
  | "organization"
  | "role"
  | "membership"
  | "invitation"
  // The kit never CREATES these two, but `cleanup()` must delete them: an org
  // provisioned through `POST /organizations` owns an entitlement and a default
  // warehouse, and both hold a foreign key to it (T-002-15).
  | "orgEntitlement"
  | "warehouse"
>;

export interface SeedKitOptions {
  /**
   * The module the invitation hasher is looked up in. Defaults to a live
   * `import("@omnistock/db")`.
   */
  readonly dbModule?: Readonly<Record<string, unknown>>;
  /** Prefix for generated emails/org names, so a shared DB stays greppable. */
  readonly label?: string;
}

export interface SeedKit {
  createUser(options?: {
    email?: string;
    password?: string;
    createdAt?: Date;
    verified?: boolean;
  }): Promise<SeededUser>;
  createOrg(options?: { name?: string; roles?: readonly RoleSpec[] }): Promise<SeededOrg>;
  addMember(options: {
    organizationId: string;
    userId: string;
    roleId: string;
    status?: MembershipStatusValue;
    activatedAt?: Date | null;
    revokedAt?: Date | null;
    revokedByUserId?: string | null;
  }): Promise<SeededMembership>;
  /** Switch an EXISTING role's `key` (including to `null`) — I-45. */
  setRoleKey(roleId: string, key: string | null): Promise<SeededRole>;
  /** Point a membership at another role — the "switch a member's role" path. */
  setMembershipRole(organizationId: string, userId: string, roleId: string): Promise<SeededMembership>;
  createInvitation(options: {
    organizationId: string;
    email: string;
    roleId: string;
    status?: InvitationStatusValue;
    tokenIssuedAt?: Date;
    expiresAt?: Date;
    createdAt?: Date;
    invitedByUserId?: string | null;
    rawToken?: string;
  }): Promise<SeededInvitation>;
  scenario(name: F002Scenario): Promise<ScenarioResult>;
  /** Delete exactly the rows this kit created — never a global TRUNCATE. */
  cleanup(): Promise<void>;
}

export function createSeedKit(prisma: SeedPrismaClient, options: SeedKitOptions = {}): SeedKit {
  const label = options.label ?? "f002";
  const hashing = new HashingService();
  const created = {
    invitations: [] as string[],
    memberships: [] as string[],
    roles: [] as string[],
    orgs: [] as string[],
    users: [] as string[],
  };

  const unique = (): string => `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;

  async function createUser(
    opts: { email?: string; password?: string; createdAt?: Date; verified?: boolean } = {},
  ): Promise<SeededUser> {
    const email = (opts.email ?? `${label}-${unique()}@seed.test`).toLowerCase();
    const password = opts.password ?? "seed-kit-passphrase-8Kx!";
    const row = await prisma.user.create({
      data: {
        email,
        // Production hasher — a seeded user must be able to log in for real.
        passwordHash: await hashing.hash(password),
        verified: opts.verified ?? true,
        // Condition (ข): explicit, so "account created AFTER the invite" (I-17e)
        // is reachable without touching a clock.
        ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
      },
      select: { id: true, email: true },
    });
    created.users.push(row.id);
    return { id: row.id, email: row.email, password };
  }

  async function createOrg(
    opts: { name?: string; roles?: readonly RoleSpec[] } = {},
  ): Promise<SeededOrg> {
    const name = opts.name ?? `${label}-org-${unique()}`;
    const org = await prisma.organization.create({ data: { name }, select: { id: true, name: true } });
    created.orgs.push(org.id);

    const roles: Record<string, SeededRole> = {};
    for (const spec of opts.roles ?? DEFAULT_ROLE_SPECS) {
      const role = await prisma.role.create({
        data: {
          organizationId: org.id,
          name: spec.name,
          key: spec.key,
          capabilities: [...spec.capabilities],
          isSystem: spec.isSystem ?? false,
        },
        select: { id: true, name: true, key: true, capabilities: true },
      });
      created.roles.push(role.id);
      roles[role.name] = { id: role.id, name: role.name, key: role.key, capabilities: role.capabilities };
    }
    return { id: org.id, name: org.name, roles };
  }

  async function addMember(opts: {
    organizationId: string;
    userId: string;
    roleId: string;
    status?: MembershipStatusValue;
    activatedAt?: Date | null;
    revokedAt?: Date | null;
    revokedByUserId?: string | null;
  }): Promise<SeededMembership> {
    const status = opts.status ?? "active";
    const row = await prisma.membership.create({
      data: {
        organizationId: opts.organizationId,
        userId: opts.userId,
        roleId: opts.roleId,
        status,
        activatedAt: opts.activatedAt ?? (status === "active" ? new Date() : null),
        revokedAt: opts.revokedAt ?? null,
        revokedByUserId: opts.revokedByUserId ?? null,
      },
      select: { id: true, organizationId: true, userId: true, roleId: true, status: true },
    });
    created.memberships.push(row.id);
    return { ...row, status: row.status as MembershipStatusValue };
  }

  async function setRoleKey(roleId: string, key: string | null): Promise<SeededRole> {
    // NOT wrapped in a try/catch: `@@unique([organizationId, key])` must be able
    // to reject a duplicate, exactly as it would in production (§12.2 item 8).
    const role = await prisma.role.update({
      where: { id: roleId },
      data: { key },
      select: { id: true, name: true, key: true, capabilities: true },
    });
    return { id: role.id, name: role.name, key: role.key, capabilities: role.capabilities };
  }

  async function setMembershipRole(
    organizationId: string,
    userId: string,
    roleId: string,
  ): Promise<SeededMembership> {
    const row = await prisma.membership.update({
      where: { organizationId_userId: { organizationId, userId } },
      data: { roleId },
      select: { id: true, organizationId: true, userId: true, roleId: true, status: true },
    });
    return { ...row, status: row.status as MembershipStatusValue };
  }

  async function createInvitation(opts: {
    organizationId: string;
    email: string;
    roleId: string;
    status?: InvitationStatusValue;
    tokenIssuedAt?: Date;
    expiresAt?: Date;
    createdAt?: Date;
    invitedByUserId?: string | null;
    rawToken?: string;
  }): Promise<SeededInvitation> {
    // Resolves LAZILY so every non-invitation scenario stays usable while the
    // production hasher is still unwritten.
    const dbModule = options.dbModule ?? ((await import("@omnistock/db")) as Record<string, unknown>);
    const hashInvitationToken = resolveInvitationTokenHasher(dbModule);

    const rawToken = opts.rawToken ?? randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
    const now = new Date();
    const row = await prisma.invitation.create({
      data: {
        organizationId: opts.organizationId,
        email: opts.email.trim().toLowerCase(),
        roleId: opts.roleId,
        status: opts.status ?? "pending",
        tokenHash: hashInvitationToken(rawToken),
        tokenIssuedAt: opts.tokenIssuedAt ?? now,
        expiresAt: opts.expiresAt ?? new Date(now.getTime() + 168 * 3_600_000),
        invitedByUserId: opts.invitedByUserId ?? null,
        ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
      },
      select: { id: true, organizationId: true, email: true, roleId: true, status: true },
    });
    created.invitations.push(row.id);
    return { ...row, status: row.status as InvitationStatusValue, rawToken };
  }

  async function scenario(name: F002Scenario): Promise<ScenarioResult> {
    switch (name) {
      case "two-orgs": {
        const [orgA, orgB] = [await createOrg(), await createOrg()];
        const user = await createUser();
        const other = await createUser();
        const m1 = await addMember({
          organizationId: orgA.id,
          userId: user.id,
          roleId: orgA.roles.Owner.id,
        });
        const m2 = await addMember({
          organizationId: orgB.id,
          userId: other.id,
          roleId: orgB.roles.Owner.id,
        });
        return result(name, [orgA, orgB], [user, other], [m1, m2], [], {
          orgAId: orgA.id,
          orgBId: orgB.id,
        });
      }

      case "fifty-orgs": {
        // The `MAX_ORGS_PER_USER = 50` boundary (D-029 item 3): seeded AT the
        // cap so the 51st attempt is the thing under test.
        const user = await createUser();
        const orgs: SeededOrg[] = [];
        const memberships: SeededMembership[] = [];
        for (let i = 0; i < 50; i++) {
          const org = await createOrg({ name: `${label}-cap-${i}-${unique()}` });
          orgs.push(org);
          memberships.push(
            await addMember({ organizationId: org.id, userId: user.id, roleId: org.roles.Owner.id }),
          );
        }
        return result(name, orgs, [user], memberships, [], { userId: user.id, orgCount: orgs.length });
      }

      case "revoked-member": {
        const org = await createOrg();
        const owner = await createUser();
        const revoked = await createUser();
        const revokedAt = new Date();
        const m1 = await addMember({
          organizationId: org.id,
          userId: owner.id,
          roleId: org.roles.Owner.id,
        });
        const m2 = await addMember({
          organizationId: org.id,
          userId: revoked.id,
          roleId: org.roles.Staff.id,
          status: "revoked",
          activatedAt: new Date(revokedAt.getTime() - 86_400_000),
          revokedAt,
          revokedByUserId: owner.id,
        });
        return result(name, [org], [owner, revoked], [m1, m2], [], {
          orgId: org.id,
          revokedUserId: revoked.id,
          revokedAt: revokedAt.toISOString(),
        });
      }

      case "invited-member": {
        // Condition (ง): a dead state with no production write path, seeded so
        // the suite can prove it is REFUSED rather than assume it never occurs.
        const org = await createOrg();
        const user = await createUser();
        const m = await addMember({
          organizationId: org.id,
          userId: user.id,
          roleId: org.roles.Staff.id,
          status: "invited",
          activatedAt: null,
        });
        return result(name, [org], [user], [m], [], { orgId: org.id, userId: user.id });
      }

      case "custom-role-null-key": {
        // Two custom roles with `key: null` must coexist (Postgres treats each
        // NULL as distinct) — and the Staff role's key is then FLIPPED to
        // "owner" while its capabilities stay put: I-45's fixture exactly.
        const org = await createOrg({
          roles: [
            ...DEFAULT_ROLE_SPECS,
            { name: "Custom A", key: null, capabilities: ["manage_products"] },
            { name: "Custom B", key: null, capabilities: [] },
          ],
        });
        const user = await createUser();
        const m = await addMember({
          organizationId: org.id,
          userId: user.id,
          roleId: org.roles["Custom A"].id,
        });
        // Free the "owner" key first — the unique index is real and must stay real.
        await setRoleKey(org.roles.Owner.id, null);
        const flipped = await setRoleKey(org.roles.Staff.id, "owner");
        return result(name, [org], [user], [m], [], {
          orgId: org.id,
          impostorRoleId: flipped.id,
          impostorCapabilities: flipped.capabilities,
        });
      }

      case "expired-invite":
      case "superseded-invite":
      case "high-role-invite":
        return invitationScenario(name);
    }
  }

  async function invitationScenario(name: F002Scenario): Promise<ScenarioResult> {
    const org = await createOrg();
    const owner = await createUser();
    const invitee = await createUser();
    const ownerMembership = await addMember({
      organizationId: org.id,
      userId: owner.id,
      roleId: org.roles.Owner.id,
    });
    const now = new Date();

    if (name === "expired-invite") {
      const issuedAt = new Date(now.getTime() - 8 * 86_400_000);
      const invitation = await createInvitation({
        organizationId: org.id,
        email: invitee.email,
        roleId: org.roles.Staff.id,
        tokenIssuedAt: issuedAt,
        // 168h TTL from issue → already in the past. No fake timer involved.
        expiresAt: new Date(issuedAt.getTime() + 168 * 3_600_000),
        invitedByUserId: owner.id,
      });
      return result(name, [org], [owner, invitee], [ownerMembership], [invitation], {
        orgId: org.id,
        invitationId: invitation.id,
        rawToken: invitation.rawToken,
      });
    }

    if (name === "superseded-invite") {
      // I-1: the link was issued BEFORE the member was revoked ⇒ accepting it
      // would let a removed member walk back in. Three orderings must be
      // reachable; this scenario pins `revokedAt > tokenIssuedAt`.
      const issuedAt = new Date(now.getTime() - 3_600_000);
      const revokedAt = new Date(now.getTime() - 60_000);
      const membership = await addMember({
        organizationId: org.id,
        userId: invitee.id,
        roleId: org.roles.Staff.id,
        status: "revoked",
        activatedAt: new Date(issuedAt.getTime() - 86_400_000),
        revokedAt,
        revokedByUserId: owner.id,
      });
      const invitation = await createInvitation({
        organizationId: org.id,
        email: invitee.email,
        roleId: org.roles.Staff.id,
        tokenIssuedAt: issuedAt,
        expiresAt: new Date(now.getTime() + 86_400_000),
        invitedByUserId: owner.id,
      });
      return result(
        name,
        [org],
        [owner, invitee],
        [ownerMembership, membership],
        [invitation],
        {
          orgId: org.id,
          invitationId: invitation.id,
          rawToken: invitation.rawToken,
          tokenIssuedAt: issuedAt.toISOString(),
          revokedAt: revokedAt.toISOString(),
        },
      );
    }

    // high-role-invite — an Owner invitation, TTL 24h (D-028): the row Owner-only
    // reissue (I-15f) and the short-TTL assertion (I-15b) are written against.
    const invitation = await createInvitation({
      organizationId: org.id,
      email: invitee.email,
      roleId: org.roles.Owner.id,
      tokenIssuedAt: now,
      expiresAt: new Date(now.getTime() + 24 * 3_600_000),
      invitedByUserId: owner.id,
    });
    return result(name, [org], [owner, invitee], [ownerMembership], [invitation], {
      orgId: org.id,
      invitationId: invitation.id,
      rawToken: invitation.rawToken,
      ttlHours: 24,
    });
  }

  function result(
    scenarioName: F002Scenario,
    orgs: readonly SeededOrg[],
    users: readonly SeededUser[],
    memberships: readonly SeededMembership[],
    invitations: readonly SeededInvitation[],
    notes: Record<string, unknown>,
  ): ScenarioResult {
    return { scenario: scenarioName, orgs, users, memberships, invitations, notes };
  }

  async function cleanup(): Promise<void> {
    // Postgres is SHARED with other suites: delete BY ID, in FK order. Never a
    // TRUNCATE, never a `deleteMany({})` — one of those would delete a parallel
    // suite's fixtures and produce a failure nobody can reproduce.
    if (created.invitations.length > 0) {
      await prisma.invitation.deleteMany({ where: { id: { in: created.invitations } } });
    }
    if (created.memberships.length > 0) {
      await prisma.membership.deleteMany({ where: { id: { in: created.memberships } } });
    }
    if (created.roles.length > 0) {
      await prisma.role.deleteMany({ where: { id: { in: created.roles } } });
    }
    if (created.orgs.length > 0) {
      // Rows the kit never creates but `POST /organizations` does (T-002-15
      // provisions an OrgEntitlement and a default Warehouse in the same
      // transaction). A suite that creates an org through the REAL endpoint and
      // then hands the id to `cleanup()` would otherwise fail on the foreign
      // key — and the failure surfaces in `afterAll`, i.e. attributed to
      // whichever test happened to run last. Scoped by organizationId, so this
      // is still "delete exactly what belongs to my orgs", never a broad sweep.
      await prisma.warehouse.deleteMany({ where: { organizationId: { in: created.orgs } } });
      await prisma.orgEntitlement.deleteMany({ where: { organizationId: { in: created.orgs } } });
      // Memberships/roles/invitations created by the endpoint rather than by the
      // kit hang off the same orgs and are equally unknown to `created.*`.
      await prisma.invitation.deleteMany({ where: { organizationId: { in: created.orgs } } });
      await prisma.membership.deleteMany({ where: { organizationId: { in: created.orgs } } });
      await prisma.role.deleteMany({ where: { organizationId: { in: created.orgs } } });
      await prisma.organization.deleteMany({ where: { id: { in: created.orgs } } });
    }
    if (created.users.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    }
    created.invitations.length = 0;
    created.memberships.length = 0;
    created.roles.length = 0;
    created.orgs.length = 0;
    created.users.length = 0;
  }

  return {
    createUser,
    createOrg,
    addMember,
    setRoleKey,
    setMembershipRole,
    createInvitation,
    scenario,
    cleanup,
  };
}
