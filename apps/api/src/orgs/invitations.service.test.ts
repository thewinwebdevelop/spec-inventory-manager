// F-003 · T-003-B18 ★ — the org side of invitations under D-034/D-035
// (architecture §1.1 / §6.1 · api-spec §4.3 · test-plan U-API3-08).
//
// What only this layer can prove (the RULE is `decideMemberAuthority`, proven
// exhaustively in core-domain — not re-proven here):
//   * U-API3-08: reissue writes `issuedByUserId = actor` in the SAME update as
//     `tokenHash/tokenIssuedAt/expiresAt` (one call, all four fields); create
//     writes it on the INSERT. A second statement would leave a window where
//     the new token is live but the re-check at accept still names the
//     previous issuer.
//   * every verdict reason maps to its wire code, and a refusal writes NOTHING
//     (no token rotated, no row inserted, no row cancelled);
//   * `exceeds_actor` emits `org.role.escalation_denied` (via the deduped
//     path) with the excess keys, and the 403 carries no `details` (AC-6.4).
import { describe, it, expect, vi } from "vitest";
import { SYSTEM_ROLE_BLUEPRINT } from "@omnistock/core-domain";
import { hashInvitationToken } from "../prisma/invitation-token";
import { DomainException } from "../common/domain-exception";
import { SecurityEventsService, collectSecurityEvents } from "../auth/security-events.service";
import { OrgContextStore } from "../tenancy";
import { InvitationsService } from "./invitations.service";
import type { InvitationLookupService } from "./system/invitation-lookup.service";

process.env.INVITATION_TOKEN_SECRET ??= "b18-unit-invitation-secret-32-chars!!";

const ORG_ID = "org_b18";
const ACTOR = "usr_actor";
const FIRST_INVITER = "usr_first_inviter";
const NOW = new Date("2026-10-01T10:00:00.000Z");
const LIVE_UNTIL = new Date("2026-10-05T10:00:00.000Z");

const OWNER_CAPS = ["full_access"];
// The production preset, never retyped (the F-002 kit once drifted that way).
const ADMIN_CAPS = [
  ...SYSTEM_ROLE_BLUEPRINT.find((r) => r.key === "admin")!.capabilities,
] as string[];
const MM_CAPS = ["manage_members", "manage_products"];
const ROLES = {
  owner: { id: "rol_owner", name: "Owner", key: "owner", capabilities: OWNER_CAPS },
  admin: { id: "rol_admin", name: "Admin", key: "admin", capabilities: ADMIN_CAPS },
  mm: { id: "rol_mm", name: "MM", key: null, capabilities: MM_CAPS },
  orders: { id: "rol_orders", name: "Orders", key: null, capabilities: ["manage_orders"] },
  products: { id: "rol_products", name: "Products", key: null, capabilities: ["manage_products"] },
} as const;
type RoleName = keyof typeof ROLES;

interface Setup {
  /** The actor's CURRENT role, as the transaction reads it. */
  readonly actorRole: RoleName;
  /** Role of the existing pending invitation (reissue / cancel). */
  readonly invitationRole?: RoleName;
}

function createService({ actorRole, invitationRole = "orders" }: Setup) {
  const invitationRow = {
    id: "inv_1",
    status: "pending",
    roleId: ROLES[invitationRole].id,
    expiresAt: LIVE_UNTIL,
    tokenHash: "old-hash",
    tokenIssuedAt: new Date("2026-09-30T10:00:00.000Z"),
    invitedByUserId: FIRST_INVITER,
    role: ROLES[invitationRole],
  };
  const tx = {
    $executeRawUnsafe: vi.fn(async () => 0),
    $queryRawUnsafe: vi.fn(async (_q: string, id: string) => [{ id }]),
    role: {
      findUnique: vi.fn(async (args: { where: { id: string } }) => {
        return Object.values(ROLES).find((r) => r.id === args.where.id) ?? null;
      }),
    },
    membership: {
      findFirst: vi.fn(async (args: { where: { userId?: string } }) => {
        // readActorCapabilities: the actor's active membership.
        if (args.where.userId === ACTOR)
          return { role: { capabilities: ROLES[actorRole].capabilities } };
        // assertNotAlreadyMember: nobody with that email.
        return null;
      }),
    },
    invitation: {
      findUnique: vi.fn(async () => ({ ...invitationRow })),
      findFirst: vi.fn(async () => null),
      count: vi.fn(async () => 0),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: "inv_new",
        email: args.data.email,
        roleId: args.data.roleId,
        status: "pending",
        expiresAt: args.data.expiresAt,
        tokenIssuedAt: args.data.tokenIssuedAt,
        invitedByUserId: args.data.invitedByUserId,
        createdAt: NOW,
        acceptedAt: null,
        acceptedByUserId: null,
        acceptedUserCreatedAt: null,
        // Shaped like INVITATION_SELECT.role (B22: + nameCustomized, capabilities for the verdict).
        role: {
          name: "Orders",
          key: null,
          nameCustomized: false,
          capabilities: [
            ...(Object.values(ROLES).find((r) => r.id === args.data.roleId)?.capabilities ?? []),
          ],
        },
      })),
      update: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
        id: args.where.id,
        expiresAt: (args.data.expiresAt as Date | undefined) ?? LIVE_UNTIL,
        tokenIssuedAt: (args.data.tokenIssuedAt as Date | undefined) ?? NOW,
      })),
    },
  };
  const prisma = { $transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
  const events = new SecurityEventsService();
  const sink = collectSecurityEvents(events);
  const store = new OrgContextStore();
  const service = new InvitationsService(
    prisma as never,
    store,
    events,
    100,
    "https://app.example.com",
    {} as unknown as InvitationLookupService,
  );
  const inOrg = <T>(fn: () => Promise<T>) =>
    store.run({ organizationId: ORG_ID, userId: ACTOR }, fn);
  return { service, tx, sink, inOrg, store };
}

async function codeOf(p: Promise<unknown>): Promise<{ code: string; details: unknown }> {
  try {
    await p;
  } catch (err) {
    expect(err).toBeInstanceOf(DomainException);
    const e = err as DomainException;
    return { code: e.code, details: e.details };
  }
  throw new Error("expected a refusal, got success");
}

describe("U-API3-08 · issuedByUserId is written WITH the token (D-035 Addendum P3)", () => {
  it("reissue: ONE update carries tokenHash + tokenIssuedAt + expiresAt + issuedByUserId = actor", async () => {
    const { service, tx, inOrg } = createService({ actorRole: "admin", invitationRole: "orders" });
    const out = await inOrg(() => service.reissueLink({ invitationId: "inv_1", now: NOW }));

    expect(tx.invitation.update).toHaveBeenCalledTimes(1);
    const data = tx.invitation.update.mock.calls[0]![0].data;
    expect(Object.keys(data).sort()).toEqual(
      ["expiresAt", "issuedByUserId", "tokenHash", "tokenIssuedAt"].sort(),
    );
    expect(data.issuedByUserId).toBe(ACTOR);
    expect(data.tokenHash).toBe(hashInvitationToken(out.token));
    expect(data.tokenIssuedAt).toEqual(NOW);
    // `invitedByUserId` is history ("who invited") — reissue never rewrites it.
    expect(data).not.toHaveProperty("invitedByUserId");
    // and the wire shape does not grow the column (it is not on the contract).
    expect(JSON.stringify(out)).not.toContain("issuedByUserId");
  });

  it("create: the INSERT writes issuedByUserId = invitedByUserId = actor", async () => {
    const { service, tx, inOrg } = createService({ actorRole: "admin" });
    const out = await inOrg(() =>
      service.create({ email: "new@example.com", roleId: ROLES.orders.id, now: NOW }),
    );
    expect(tx.invitation.create).toHaveBeenCalledTimes(1);
    const data = tx.invitation.create.mock.calls[0]![0].data;
    expect(data.issuedByUserId).toBe(ACTOR);
    expect(data.invitedByUserId).toBe(ACTOR);
    expect(JSON.stringify(out)).not.toContain("issuedByUserId");
  });
});

describe("B18 · invite create / reissue / cancel decide through decideMemberAuthority (api §4.3)", () => {
  const routes: Record<
    "invite_create" | "invite_reissue" | "invite_cancel",
    (s: InvitationsService, role: RoleName) => Promise<unknown>
  > = {
    invite_create: (s, role) =>
      s.create({ email: "x@example.com", roleId: ROLES[role].id, now: NOW }),
    invite_reissue: (s) => s.reissueLink({ invitationId: "inv_1", now: NOW }),
    invite_cancel: (s) => s.cancel({ invitationId: "inv_1", now: NOW }),
  };
  const ops = Object.keys(routes) as (keyof typeof routes)[];

  const writesOf = (tx: ReturnType<typeof createService>["tx"]) =>
    tx.invitation.create.mock.calls.length + tx.invitation.update.mock.calls.length;

  it.each(ops)(
    "%s: grant ⊄ actor → 403 ROLE_EXCEEDS_ACTOR, no details, nothing written, event",
    async (op) => {
      // MM holds {manage_members, manage_products}; the role carries manage_orders.
      const { service, tx, sink, inOrg } = createService({
        actorRole: "mm",
        invitationRole: "orders",
      });
      const refused = await codeOf(inOrg(() => routes[op](service, "orders")));
      expect(refused.code).toBe("ROLE_EXCEEDS_ACTOR");
      expect(refused.details).toBeUndefined();
      expect(writesOf(tx)).toBe(0);
      const denied = sink.ofType("org.role.escalation_denied");
      expect(denied).toHaveLength(1);
      expect(denied[0]!.payload).toMatchObject({
        actorUserId: ACTOR,
        organizationId: ORG_ID,
        roleId: ROLES.orders.id,
        targetUserId: null,
        operation: op,
        reason: "exceeds_actor",
        excessCapabilities: ["manage_orders"],
      });
      // the success event of the route did not fire
      expect(sink.types().filter((t) => t !== "org.role.escalation_denied")).toEqual([]);
    },
  );

  it.each(ops)(
    "%s: Owner role by a non-Owner → 403 FORBIDDEN, nothing written, no escalation event",
    async (op) => {
      const { service, tx, sink, inOrg } = createService({
        actorRole: "admin",
        invitationRole: "owner",
      });
      const refused = await codeOf(inOrg(() => routes[op](service, "owner")));
      expect(refused.code).toBe("FORBIDDEN");
      expect(writesOf(tx)).toBe(0);
      expect(sink.events).toEqual([]);
    },
  );

  it.each(ops)("%s: grant ⊆ actor (equal set) → allowed, one write", async (op) => {
    // equal is fine on the grant axis — an Admin may invite / reissue / cancel an Admin
    const { service, tx, sink, inOrg } = createService({
      actorRole: "admin",
      invitationRole: "admin",
    });
    await inOrg(() => routes[op](service, "admin"));
    expect(writesOf(tx)).toBe(1);
    expect(sink.ofType("org.role.escalation_denied")).toEqual([]);
  });

  it.each(ops)("%s: control — MM with a role inside its set is allowed", async (op) => {
    const { service, tx, inOrg } = createService({ actorRole: "mm", invitationRole: "products" });
    await inOrg(() => routes[op](service, "products"));
    expect(writesOf(tx)).toBe(1);
  });

  it.each(ops)("%s: Owner may hand out / cancel an Owner invitation", async (op) => {
    const { service, tx, inOrg } = createService({ actorRole: "owner", invitationRole: "owner" });
    await inOrg(() => routes[op](service, "owner"));
    expect(writesOf(tx)).toBe(1);
  });

  it("cancel reads the actor INSIDE the lock — a revoked actor is ORG_ACCESS_DENIED, nothing written", async () => {
    const { service, tx, inOrg } = createService({ actorRole: "admin" });
    tx.membership.findFirst.mockImplementation(async () => null);
    const refused = await codeOf(inOrg(() => service.cancel({ invitationId: "inv_1", now: NOW })));
    expect(refused.code).toBe("ORG_ACCESS_DENIED");
    expect(tx.invitation.update).not.toHaveBeenCalled();
  });

  it("★ B18 Low (T-003-B17): cancel by an actor who lost manage_members between the guard and the tx re-read → FORBIDDEN, nothing written, no event", async () => {
    // The guard saw an Admin (ALS); the locked re-read sees a role with no
    // manage_members. The floor (decideMemberAuthority step 1) must follow the DB.
    const { service, tx, sink, store } = createService({
      actorRole: "orders",
      invitationRole: "orders",
    });
    const refused = await codeOf(
      store.run({ organizationId: ORG_ID, userId: ACTOR, capabilities: ADMIN_CAPS }, () =>
        service.cancel({ invitationId: "inv_1", now: NOW }),
      ),
    );
    expect(refused.code).toBe("FORBIDDEN");
    expect(tx.invitation.update).not.toHaveBeenCalled();
    expect(sink.events).toEqual([]);
  });
});

// ── T-003-B19 ★ · U-API3-09 — the accept-time re-check of the issuer (D-035) ──

const INVITEE = "usr_invitee";
const INVITEE_EMAIL = "invitee@example.com";
const ISSUER = "usr_issuer";
const FIRST = "usr_first";
const BLOCKED = "org.invitation.accept_blocked_inviter";

/** The six F-002 refusals + the email binding — none may reach the re-check. */
const PRIOR_REFUSALS = [
  ["expired", "INVITATION_EXPIRED"],
  ["cancelled", "INVITATION_CANCELLED"],
  ["already_accepted", "INVITATION_ALREADY_ACCEPTED"],
  ["email_mismatch", "INVITATION_EMAIL_MISMATCH"],
  ["role_unavailable", "INVITATION_ROLE_UNAVAILABLE"],
  ["already_member", "ALREADY_MEMBER"],
  ["superseded", "INVITATION_SUPERSEDED"],
] as const;
type PriorRefusal = (typeof PRIOR_REFUSALS)[number][0];

interface AcceptSetup {
  readonly invitationRole?: RoleName;
  readonly issuedByUserId?: string | null;
  readonly invitedByUserId?: string | null;
  /** CURRENT role of each user with an ACTIVE membership; absent = none. */
  readonly active?: Readonly<Record<string, RoleName>>;
  readonly refusal?: PriorRefusal;
}

function createAcceptService({
  invitationRole = "orders",
  issuedByUserId = ISSUER,
  invitedByUserId = FIRST,
  active = {},
  refusal,
}: AcceptSetup) {
  const log: string[] = [];
  const tokenIssuedAt = new Date("2026-10-01T09:00:00.000Z");
  const row = {
    id: "inv_acc",
    email: INVITEE_EMAIL,
    roleId: ROLES[invitationRole].id,
    status:
      refusal === "cancelled"
        ? "cancelled"
        : refusal === "already_accepted"
          ? "accepted"
          : "pending",
    expiresAt: refusal === "expired" ? new Date(NOW.getTime() - 1) : LIVE_UNTIL,
    tokenIssuedAt,
    issuedByUserId,
    invitedByUserId,
  };
  const tx = {
    $executeRawUnsafe: vi.fn(async () => 0),
    $queryRawUnsafe: vi.fn(async (_q: string, id: string) => [{ id }]),
    invitation: {
      findFirst: vi.fn(async () => ({ ...row })),
      update: vi.fn(async (args: { where: { id: string } }) => ({ id: args.where.id })),
    },
    role: {
      findFirst: vi.fn(async () =>
        refusal === "role_unavailable" ? null : { ...ROLES[invitationRole], nameCustomized: false },
      ),
    },
    membership: {
      findFirst: vi.fn(async (args: { where: { userId: string; status?: string } }) => {
        if (args.where.userId === INVITEE) {
          if (refusal === "already_member")
            return { id: "m_inv", status: "active", revokedAt: null, roleId: ROLES.orders.id };
          if (refusal === "superseded")
            return {
              id: "m_inv",
              status: "revoked",
              revokedAt: new Date(tokenIssuedAt.getTime() + 1),
              roleId: ROLES.orders.id,
            };
          return null;
        }
        const roleName = active[args.where.userId];
        if (!roleName || args.where.status !== "active") return null;
        return { role: { capabilities: ROLES[roleName].capabilities, deletedAt: null } };
      }),
      create: vi.fn(async () => ({ id: "m_new" })),
      update: vi.fn(async () => ({ id: "m_inv" })),
    },
    organization: { findUnique: vi.fn(async () => ({ id: ORG_ID, name: "ร้าน" })) },
  };
  const prisma = {
    $transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => {
      log.push("tx:begin");
      const out = await fn(tx);
      log.push("tx:commit");
      return out;
    }),
  };
  const lookup = {
    findByTokenHash: vi.fn(async () => ({ id: row.id, organizationId: ORG_ID })),
    findAcceptor: vi.fn(async () => ({
      id: INVITEE,
      email: refusal === "email_mismatch" ? "someone.else@example.com" : INVITEE_EMAIL,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    })),
  };
  const events = new SecurityEventsService();
  const sink = collectSecurityEvents(events);
  const emit = events.emit.bind(events);
  vi.spyOn(events, "emit").mockImplementation((type, payload) => {
    log.push(`emit:${type}`);
    emit(type, payload);
  });
  const service = new InvitationsService(
    prisma as never,
    new OrgContextStore(),
    events,
    100,
    "https://app.example.com",
    lookup as unknown as InvitationLookupService,
  );
  const accept = () => service.accept({ userId: INVITEE, token: "raw-token", now: NOW });
  /** Membership reads aimed at anyone but the invitee = the re-check ran. */
  const issuerReads = () =>
    tx.membership.findFirst.mock.calls.filter((c) => c[0].where.userId !== INVITEE);
  return { accept, tx, sink, log, issuerReads };
}

describe("U-API3-09 ★ D-035 · accept re-checks the issuer of the current link (arch §6.1)", () => {
  it.each(PRIOR_REFUSALS)(
    "%s: the F-002 answer is unchanged and the re-check never runs (issuer would fail)",
    async (refusal, code) => {
      // No active issuer at all — the re-check would refuse if it were reached.
      const { accept, tx, sink, issuerReads } = createAcceptService({ refusal, active: {} });
      const refused = await codeOf(accept());
      expect(refused.code).toBe(code);
      expect(issuerReads()).toEqual([]);
      expect(sink.ofType(BLOCKED)).toEqual([]);
      expect(tx.membership.create).not.toHaveBeenCalled();
      // only `already_member` writes (it closes the invitation, I-9) — and the
      // email mismatch, above all, must NOT cancel someone else's invitation.
      expect(tx.invitation.update).toHaveBeenCalledTimes(refusal === "already_member" ? 1 : 0);
    },
  );

  it("refusal: cancelled IN the tx, no membership, 409 INVITATION_CANCELLED (no details), event AFTER commit", async () => {
    const { accept, tx, sink, log } = createAcceptService({
      invitationRole: "admin",
      active: { [ISSUER]: "orders" }, // demoted: no manage_members any more
    });
    const refused = await codeOf(accept());
    expect(refused).toEqual({ code: "INVITATION_CANCELLED", details: undefined });
    expect(tx.invitation.update).toHaveBeenCalledTimes(1);
    expect(tx.invitation.update.mock.calls[0]![0]).toMatchObject({
      where: { id: "inv_acc" },
      data: { status: "cancelled", cancelledAt: NOW },
    });
    expect(tx.membership.create).not.toHaveBeenCalled();
    expect(tx.membership.update).not.toHaveBeenCalled();
    expect(sink.types()).toEqual([BLOCKED]);
    expect(sink.ofType(BLOCKED)[0]!.payload).toEqual({
      actorUserId: INVITEE,
      organizationId: ORG_ID,
      invitationId: "inv_acc",
      issuerUserId: ISSUER,
      reason: "inviter_not_authorized",
      excessCapabilities: ["manage_members"],
    });
    expect(log).toEqual(["tx:begin", "tx:commit", `emit:${BLOCKED}`]);
  });

  it("the issuer is read through an ACTIVE membership, in the tx", async () => {
    const { accept, issuerReads } = createAcceptService({ active: { [ISSUER]: "admin" } });
    await accept();
    expect(issuerReads()).toHaveLength(1);
    expect(issuerReads()[0]![0].where).toEqual({ userId: ISSUER, status: "active" });
  });

  it("COALESCE: issuedByUserId wins over invitedByUserId — first inviter Owner, current issuer exceeded ⇒ refused (MUT-05)", async () => {
    const { accept, sink } = createAcceptService({
      invitationRole: "admin",
      issuedByUserId: ISSUER,
      invitedByUserId: FIRST,
      active: { [ISSUER]: "mm", [FIRST]: "owner" },
    });
    expect((await codeOf(accept())).code).toBe("INVITATION_CANCELLED");
    expect(sink.ofType(BLOCKED)[0]!.payload).toMatchObject({
      issuerUserId: ISSUER,
      reason: "inviter_exceeds",
    });
  });

  it("COALESCE: …and the other way round — first inviter demoted, current issuer Owner ⇒ accepted (MUT-05)", async () => {
    const { accept, tx, sink } = createAcceptService({
      invitationRole: "admin",
      issuedByUserId: ISSUER,
      invitedByUserId: FIRST,
      active: { [ISSUER]: "owner", [FIRST]: "orders" },
    });
    await accept();
    expect(tx.membership.create).toHaveBeenCalledTimes(1);
    expect(sink.ofType(BLOCKED)).toEqual([]);
  });

  it("COALESCE: issuedByUserId null (legacy row) ⇒ falls back to invitedByUserId", async () => {
    const { accept, issuerReads, tx } = createAcceptService({
      issuedByUserId: null,
      invitedByUserId: FIRST,
      active: { [FIRST]: "admin" },
    });
    await accept();
    expect(issuerReads()[0]![0].where).toEqual({ userId: FIRST, status: "active" });
    expect(tx.membership.create).toHaveBeenCalledTimes(1);
  });

  it("both null ⇒ inviter_not_active (fail closed), no issuer read, issuerUserId null on the event", async () => {
    const { accept, issuerReads, sink, tx } = createAcceptService({
      issuedByUserId: null,
      invitedByUserId: null,
      active: { [FIRST]: "owner" },
    });
    expect((await codeOf(accept())).code).toBe("INVITATION_CANCELLED");
    expect(issuerReads()).toEqual([]);
    expect(tx.membership.create).not.toHaveBeenCalled();
    expect(sink.ofType(BLOCKED)[0]!.payload).toMatchObject({
      issuerUserId: null,
      reason: "inviter_not_active",
      excessCapabilities: [],
    });
  });

  it("issuer with no active membership ⇒ inviter_not_active", async () => {
    const { accept, sink } = createAcceptService({ active: {} });
    expect((await codeOf(accept())).code).toBe("INVITATION_CANCELLED");
    expect(sink.ofType(BLOCKED)[0]!.payload).toMatchObject({ reason: "inviter_not_active" });
  });

  it("grant ⊄ issuer ⇒ inviter_exceeds with the excess keys", async () => {
    const { accept, sink } = createAcceptService({
      invitationRole: "orders",
      active: { [ISSUER]: "mm" },
    });
    expect((await codeOf(accept())).code).toBe("INVITATION_CANCELLED");
    expect(sink.ofType(BLOCKED)[0]!.payload).toMatchObject({
      reason: "inviter_exceeds",
      excessCapabilities: ["manage_orders"],
    });
  });

  it("control: an issuer who still may grant it ⇒ accepted, membership written, no blocked event", async () => {
    const { accept, tx, sink } = createAcceptService({
      invitationRole: "products",
      active: { [ISSUER]: "mm" },
    });
    await accept();
    expect(tx.membership.create).toHaveBeenCalledTimes(1);
    expect(tx.invitation.update.mock.calls[0]![0].data).toMatchObject({ status: "accepted" });
    expect(sink.types()).toEqual(["org.invitation.accepted"]);
  });

  it("a failing issuer read is NOT swallowed into ok — it propagates and nothing is written", async () => {
    const { accept, tx } = createAcceptService({ active: { [ISSUER]: "admin" } });
    const boom = new Error("issuer read failed");
    tx.membership.findFirst.mockImplementation(
      async (args: { where: { userId: string; status?: string } }) => {
        if (args.where.userId === INVITEE) return null;
        throw boom;
      },
    );
    await expect(accept()).rejects.toBe(boom);
    expect(tx.membership.create).not.toHaveBeenCalled();
    expect(tx.invitation.update).not.toHaveBeenCalled();
  });
});
