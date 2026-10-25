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
  return { service, tx, sink, inOrg };
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
});
