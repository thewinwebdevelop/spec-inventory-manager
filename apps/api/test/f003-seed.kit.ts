// F-003 · T-003-QA06 — the F-003 seed kit (test-plan §7, §0).
//
// Builds ON `f002-seed.kit.ts` (same conditions ก/ข/ค/ง, same "kit lives outside
// `src/`" rule, same cleanup-by-id discipline). Adds what RBAC tests need:
//   createCustomRole · softDeleteRole · setRoleVersion · setLastEdited ·
//   createInvitation({ issuedByUserId }) · setInvitationExpiry ·
//   scenario "f003-personas" (shops A and B, every persona of test-plan §0).
//
// NO PRODUCTION RULE IS RESTATED HERE.
//   - A custom role's capabilities go through production's
//     `validateRoleCapabilities` and the kit stores its CANONICAL output. A kit
//     that wrote whatever a test typed could seed a role the API would refuse
//     (so a test "as an X" would run against a role that cannot exist).
//   - R_B and R_MMS are DERIVED from `SYSTEM_ROLE_BLUEPRINT` (Admin's / Staff's
//     capabilities), never retyped — the F-002 kit once drifted exactly that way.
//   - What the kit deliberately does NOT do is dodge the database: the CHECKs,
//     unique indexes and triggers of `f003_role_expand` stay live. Soft-deleting
//     a role an active member still holds fails loudly (`f003_role_in_use`),
//     because a test that needs that state is testing the trigger.
//   - `setInvitationExpiry` writes the exact instant it is given: it is the way
//     to reach states the API's 24h/168h TTL would never produce (I3-43).
//
// Every mutator is scoped by `organizationId` (golden rule 3) and throws when it
// matched nothing — a silent no-op would let a test assert against an untouched
// row and still go green.
import { randomUUID } from "node:crypto";
import { SYSTEM_ROLE_BLUEPRINT, validateRoleCapabilities } from "@omnistock/core-domain";
import {
  createSeedKit,
  type F002Scenario,
  type InvitationStatusValue,
  type ScenarioResult,
  type SeedKit,
  type SeedKitOptions,
  type SeedPrismaClient,
  type SeededInvitation,
  type SeededMembership,
  type SeededOrg,
  type SeededRole,
  type SeededUser,
} from "./f002-seed.kit";

// ── persona definitions (test-plan §0 / §7) ─────────────────────────────────

export const F003_SCENARIOS = ["f003-personas"] as const;
export type F003Scenario = (typeof F003_SCENARIOS)[number];

export const PERSONA_KEYS = [
  "OWN",
  "OWN2",
  "ADM_A",
  "ADM_B",
  "STF",
  "MR",
  "MM",
  "T",
  "MMS",
  "REV",
] as const;
export type PersonaKey = (typeof PERSONA_KEYS)[number];

export type PersonaRoleKey = "R_B" | "R_T" | "R_BILL" | "R_HIST" | "R_MR" | "R_MM" | "R_MMS";
export type ShopTag = "A" | "B";

function blueprintCapabilities(key: string): readonly string[] {
  const role = SYSTEM_ROLE_BLUEPRINT.find((r) => r.key === key);
  if (!role) throw new Error(`SYSTEM_ROLE_BLUEPRINT has no "${key}" role`);
  return role.capabilities;
}

/**
 * The custom roles of test-plan §7. R_B / R_MMS come from the production
 * blueprint; the rest are the sets §0 states literally (MR, MM, T, BILL).
 */
export function personaRoleSpecs(): Readonly<Record<PersonaRoleKey, readonly string[]>> {
  return Object.freeze({
    // "= caps of Admin, ADM_B holds" (§7)
    R_B: blueprintCapabilities("admin"),
    R_T: ["manage_orders"],
    R_BILL: ["manage_billing", "manage_orders"],
    // history only: a revoked member (REV) held it; nobody active does
    R_HIST: ["manage_stock"],
    // "MR" = {manage_roles, manage_orders, manage_products} — no manage_members
    R_MR: ["manage_roles", "manage_orders", "manage_products"],
    // "MM" = {manage_members, manage_products}
    R_MM: ["manage_members", "manage_products"],
    // "MMS" = Staff + manage_members
    R_MMS: [...blueprintCapabilities("staff"), "manage_members"],
  });
}

/** Shop B's names never equal shop A's (I3-53 can only see a leak if they differ). */
export function personaRoleName(role: PersonaRoleKey, shop: ShopTag): string {
  return `${role}-${shop}`;
}

// ── result types ─────────────────────────────────────────────────────────────

export type PersonaInvitationKey =
  "pending" | "expired" | "accepted" | "cancelled" | "byAdmA" | "reissuedByOwn";

export interface PersonaShop {
  readonly org: SeededOrg;
  readonly users: Readonly<Record<PersonaKey, SeededUser>>;
  readonly memberships: Readonly<Record<PersonaKey, SeededMembership>>;
  readonly customRoles: Readonly<Record<PersonaRoleKey, SeededRole>>;
  readonly invitations: Readonly<Record<PersonaInvitationKey, SeededInvitation>>;
}

export interface F003PersonasResult {
  readonly scenario: F003Scenario;
  readonly shops: { readonly A: PersonaShop; readonly B: PersonaShop };
  /** Admin in A and Staff in B (same human, two shops). */
  readonly activeInBoth: {
    readonly user: SeededUser;
    readonly membershipA: SeededMembership;
    readonly membershipB: SeededMembership;
  };
  /** Edited A's `R_T` (lastEditedBy) and has since moved to B — no membership in A. */
  readonly movedEditor: {
    readonly user: SeededUser;
    readonly editedRoleId: string;
    readonly membershipB: SeededMembership;
  };
  readonly orgs: readonly SeededOrg[];
  readonly users: readonly SeededUser[];
  readonly memberships: readonly SeededMembership[];
  readonly invitations: readonly SeededInvitation[];
}

// ── kit surface ─────────────────────────────────────────────────────────────

export interface CreateInvitationF003Options {
  organizationId: string;
  email: string;
  roleId: string;
  /** Who issued the CURRENT link (D-035). Required: `null` must be a decision. */
  issuedByUserId: string | null;
  /** Who first invited. Defaults to `issuedByUserId`; differs on a reissue. */
  invitedByUserId?: string | null;
  status?: InvitationStatusValue;
  tokenIssuedAt?: Date;
  expiresAt?: Date;
  createdAt?: Date;
  acceptedAt?: Date | null;
  acceptedByUserId?: string | null;
  cancelledAt?: Date | null;
  rawToken?: string;
}

export interface F003SeedKit extends Omit<SeedKit, "scenario" | "createInvitation"> {
  createCustomRole(options: {
    organizationId: string;
    name: string;
    capabilities: readonly string[];
    key?: string | null;
  }): Promise<SeededRole>;
  softDeleteRole(
    organizationId: string,
    roleId: string,
    options?: { deletedAt?: Date; deletedByUserId?: string | null },
  ): Promise<void>;
  setRoleVersion(organizationId: string, roleId: string, version: number): Promise<void>;
  setLastEdited(
    organizationId: string,
    roleId: string,
    edited: { at: Date | null; byUserId: string | null },
  ): Promise<void>;
  createInvitation(options: CreateInvitationF003Options): Promise<SeededInvitation>;
  /** Writes `expiresAt` verbatim — bypasses the TTL clamp (I3-43). */
  setInvitationExpiry(organizationId: string, invitationId: string, expiresAt: Date): Promise<void>;
  scenario(name: F002Scenario): Promise<ScenarioResult>;
  scenario(name: F003Scenario): Promise<F003PersonasResult>;
}

export type F003SeedPrismaClient = SeedPrismaClient;

export function createF003SeedKit(
  prisma: F003SeedPrismaClient,
  options: SeedKitOptions = {},
): F003SeedKit {
  const label = options.label ?? "f003";
  const base = createSeedKit(prisma, { ...options, label });
  const myRoles: string[] = [];
  const unique = (): string => `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;

  async function createCustomRole(opts: {
    organizationId: string;
    name: string;
    capabilities: readonly string[];
    key?: string | null;
  }): Promise<SeededRole> {
    // Production's validator, not a copy. Fail loudly with its own code.
    const verdict = validateRoleCapabilities(opts.capabilities);
    if (!verdict.ok) {
      throw new Error(
        `createCustomRole(${opts.name}): production validateRoleCapabilities refused ` +
          `${verdict.code}${"capabilities" in verdict ? ` ${JSON.stringify(verdict.capabilities)}` : ""}`,
      );
    }
    const row = await prisma.role.create({
      data: {
        organizationId: opts.organizationId,
        name: opts.name,
        key: opts.key ?? null,
        capabilities: [...verdict.capabilities],
        isSystem: false,
      },
      select: { id: true, name: true, key: true, capabilities: true },
    });
    myRoles.push(row.id);
    return { id: row.id, name: row.name, key: row.key, capabilities: row.capabilities };
  }

  async function updateRole(
    fn: string,
    organizationId: string,
    roleId: string,
    data: Record<string, unknown>,
    requireLive = false,
  ): Promise<void> {
    const res = await prisma.role.updateMany({
      where: { id: roleId, organizationId, ...(requireLive ? { deletedAt: null } : {}) },
      data,
    });
    if (res.count !== 1) {
      throw new Error(
        `${fn}: matched ${res.count} rows for role ${roleId} in org ${organizationId} (expected 1)`,
      );
    }
  }

  async function softDeleteRole(
    organizationId: string,
    roleId: string,
    opts: { deletedAt?: Date; deletedByUserId?: string | null } = {},
  ): Promise<void> {
    // NOT wrapped: `role_soft_delete_guard` must be able to refuse (AC-3.9).
    await updateRole(
      "softDeleteRole",
      organizationId,
      roleId,
      { deletedAt: opts.deletedAt ?? new Date(), deletedByUserId: opts.deletedByUserId ?? null },
      true,
    );
  }

  async function setRoleVersion(
    organizationId: string,
    roleId: string,
    version: number,
  ): Promise<void> {
    if (!Number.isInteger(version) || version < 1) {
      throw new Error(`setRoleVersion: version must be an integer >= 1 (got ${version})`);
    }
    await updateRole("setRoleVersion", organizationId, roleId, { version });
  }

  async function setLastEdited(
    organizationId: string,
    roleId: string,
    edited: { at: Date | null; byUserId: string | null },
  ): Promise<void> {
    await updateRole("setLastEdited", organizationId, roleId, {
      lastEditedAt: edited.at,
      lastEditedByUserId: edited.byUserId,
    });
  }

  async function createInvitation(opts: CreateInvitationF003Options): Promise<SeededInvitation> {
    if (opts.issuedByUserId === undefined) {
      throw new Error(
        "createInvitation: issuedByUserId is required (pass null explicitly for a legacy row with no issuer)",
      );
    }
    return base.createInvitation({
      organizationId: opts.organizationId,
      email: opts.email,
      roleId: opts.roleId,
      status: opts.status,
      tokenIssuedAt: opts.tokenIssuedAt,
      expiresAt: opts.expiresAt,
      createdAt: opts.createdAt,
      rawToken: opts.rawToken,
      issuedByUserId: opts.issuedByUserId,
      invitedByUserId:
        opts.invitedByUserId === undefined ? opts.issuedByUserId : opts.invitedByUserId,
      acceptedAt: opts.acceptedAt,
      acceptedByUserId: opts.acceptedByUserId,
      cancelledAt: opts.cancelledAt,
    });
  }

  async function setInvitationExpiry(
    organizationId: string,
    invitationId: string,
    expiresAt: Date,
  ): Promise<void> {
    const res = await prisma.invitation.updateMany({
      where: { id: invitationId, organizationId },
      data: { expiresAt },
    });
    if (res.count !== 1) {
      throw new Error(
        `setInvitationExpiry: matched ${res.count} rows for invitation ${invitationId} in org ${organizationId} (expected 1)`,
      );
    }
  }

  // ── scenario f003-personas ────────────────────────────────────────────────

  async function seedShop(shop: ShopTag): Promise<PersonaShop> {
    const org = await base.createOrg({ name: `${label}-shop-${shop}-${unique()}` });
    const specs = personaRoleSpecs();
    const customRoles = {} as Record<PersonaRoleKey, SeededRole>;
    for (const key of Object.keys(specs) as PersonaRoleKey[]) {
      customRoles[key] = await createCustomRole({
        organizationId: org.id,
        name: personaRoleName(key, shop),
        capabilities: specs[key],
      });
    }

    const roleFor: Record<PersonaKey, SeededRole> = {
      OWN: org.roles.Owner,
      OWN2: org.roles.Owner,
      ADM_A: org.roles.Admin,
      ADM_B: customRoles.R_B,
      STF: org.roles.Staff,
      MR: customRoles.R_MR,
      MM: customRoles.R_MM,
      T: customRoles.R_T,
      MMS: customRoles.R_MMS,
      REV: customRoles.R_HIST,
    };

    const users = {} as Record<PersonaKey, SeededUser>;
    const memberships = {} as Record<PersonaKey, SeededMembership>;
    for (const p of PERSONA_KEYS) {
      users[p] = await base.createUser({
        email: `${label}-${shop}-${p}-${unique()}@seed.test`.toLowerCase(),
      });
    }
    const now = Date.now();
    for (const p of PERSONA_KEYS) {
      memberships[p] =
        p === "REV"
          ? await base.addMember({
              organizationId: org.id,
              userId: users[p].id,
              roleId: roleFor[p].id,
              status: "revoked",
              activatedAt: new Date(now - 10 * 86_400_000),
              revokedAt: new Date(now - 86_400_000),
              revokedByUserId: users.OWN.id,
            })
          : await base.addMember({
              organizationId: org.id,
              userId: users[p].id,
              roleId: roleFor[p].id,
            });
    }

    const email = (k: string): string => `${label}-${shop}-inv-${k}-${unique()}@seed.test`;
    const staff = org.roles.Staff;
    const hour = 3_600_000;
    const invitations: Record<PersonaInvitationKey, SeededInvitation> = {
      pending: await createInvitation({
        organizationId: org.id,
        email: email("pending"),
        roleId: staff.id,
        issuedByUserId: users.OWN.id,
      }),
      expired: await createInvitation({
        organizationId: org.id,
        email: email("expired"),
        roleId: staff.id,
        issuedByUserId: users.OWN.id,
        tokenIssuedAt: new Date(now - 8 * 24 * hour),
        expiresAt: new Date(now - 24 * hour),
      }),
      accepted: await createInvitation({
        organizationId: org.id,
        email: email("accepted"),
        roleId: staff.id,
        status: "accepted",
        issuedByUserId: users.OWN.id,
        acceptedAt: new Date(now - 2 * 24 * hour),
        acceptedByUserId: users.STF.id,
      }),
      cancelled: await createInvitation({
        organizationId: org.id,
        email: email("cancelled"),
        roleId: staff.id,
        status: "cancelled",
        issuedByUserId: users.OWN.id,
        cancelledAt: new Date(now - 24 * hour),
      }),
      byAdmA: await createInvitation({
        organizationId: org.id,
        email: email("byAdmA"),
        roleId: customRoles.R_T.id,
        issuedByUserId: users.ADM_A.id,
      }),
      // ADM_A invited, OWN reissued: the D-035 row (issuer ≠ original inviter).
      reissuedByOwn: await createInvitation({
        organizationId: org.id,
        email: email("reissuedByOwn"),
        roleId: staff.id,
        invitedByUserId: users.ADM_A.id,
        issuedByUserId: users.OWN.id,
      }),
    };

    return { org, users, memberships, customRoles, invitations };
  }

  async function personas(): Promise<F003PersonasResult> {
    const A = await seedShop("A");
    const B = await seedShop("B");

    const both = await base.createUser({ email: `${label}-activeInBoth-${unique()}@seed.test` });
    const membershipA = await base.addMember({
      organizationId: A.org.id,
      userId: both.id,
      roleId: A.org.roles.Admin.id,
    });
    const membershipB = await base.addMember({
      organizationId: B.org.id,
      userId: both.id,
      roleId: B.org.roles.Staff.id,
    });

    // The editor of A's R_T who has since moved to B (no membership left in A).
    const editor = await base.createUser({ email: `${label}-movedEditor-${unique()}@seed.test` });
    await setLastEdited(A.org.id, A.customRoles.R_T.id, {
      at: new Date(Date.now() - 3_600_000),
      byUserId: editor.id,
    });
    const editorB = await base.addMember({
      organizationId: B.org.id,
      userId: editor.id,
      roleId: B.org.roles.Staff.id,
    });

    const shops = [A, B];
    return {
      scenario: "f003-personas",
      shops: { A, B },
      activeInBoth: { user: both, membershipA, membershipB },
      movedEditor: { user: editor, editedRoleId: A.customRoles.R_T.id, membershipB: editorB },
      orgs: [A.org, B.org],
      users: [...shops.flatMap((s) => Object.values(s.users)), both, editor],
      memberships: [
        ...shops.flatMap((s) => Object.values(s.memberships)),
        membershipA,
        membershipB,
        editorB,
      ],
      invitations: shops.flatMap((s) => Object.values(s.invitations)),
    };
  }

  function scenario(name: F002Scenario): Promise<ScenarioResult>;
  function scenario(name: F003Scenario): Promise<F003PersonasResult>;
  function scenario(
    name: F002Scenario | F003Scenario,
  ): Promise<ScenarioResult | F003PersonasResult> {
    if (name === "f003-personas") return personas();
    return base.scenario(name);
  }

  async function cleanup(): Promise<void> {
    // The base sweep deletes every role of a kit-created org (by organizationId),
    // which covers roles made by `createCustomRole` there. Anything left is a role
    // I made in an org this kit did not create — delete exactly those, by id.
    await base.cleanup();
    if (myRoles.length > 0) {
      await prisma.role.deleteMany({ where: { id: { in: myRoles } } });
      myRoles.length = 0;
    }
  }

  return {
    createUser: base.createUser,
    createOrg: base.createOrg,
    addMember: base.addMember,
    setRoleKey: base.setRoleKey,
    setMembershipRole: base.setMembershipRole,
    createCustomRole,
    softDeleteRole,
    setRoleVersion,
    setLastEdited,
    createInvitation,
    setInvitationExpiry,
    scenario,
    cleanup,
  };
}
