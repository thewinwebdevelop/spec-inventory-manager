// F-002 · T-002-18 ★ — the membership service's ORCHESTRATION (api-spec
// §3.7–§3.9, §3.17 · architecture §5/§5.1/§3.2 · D-014).
//
// The RULES are proven exhaustively in `packages/core-domain`
// (`owner-invariant.test.ts`, `member-authz.test.ts`, `member-view.test.ts`) and
// are deliberately not re-proven here — a second copy of a rule is a second
// place for it to drift. What only this layer can prove:
//
//   * `lockCurrentOrganization` really is the FIRST statement of every mutating
//     transaction (the call order is recorded, not assumed — §5.1's own
//     requirement, extending U-API-09);
//   * every fact a decision is made from is read through `tx` and NOT through
//     the injected client (M-2 — the difference between a held invariant and a
//     concurrency test that passes most of the time);
//   * the revocation and the invitation cancellation are in the SAME
//     transaction (I-1);
//   * events are emitted POST-COMMIT, once, with the documented payload — and
//     `leave` emits `org.member.left`, never `org.member.revoked` (D-029).
//
// The double is a small in-memory database rather than a pile of `vi.fn`s
// returning canned rows: the same fixture then answers "what did the second
// request see after the first one committed?", which canned rows cannot.
import { describe, it, expect, vi } from "vitest";
import { DomainException } from "../common/domain-exception";
import {
  SecurityEventsService,
  collectSecurityEvents,
  type SecurityEventCollector,
} from "../auth/security-events.service";
import { OrgContextStore } from "../tenancy";
import { MembersService } from "./members.service";

const ORG_ID = "org_ctx";
const OWNER = "usr_owner";
const OWNER_2 = "usr_owner2";
const ADMIN = "usr_admin";
const STAFF = "usr_staff";

const ROLE_OWNER = { id: "rol_owner", name: "Owner", key: "owner", capabilities: ["full_access"] };
const ROLE_ADMIN = {
  id: "rol_admin",
  name: "Admin",
  key: "admin",
  capabilities: ["manage_members", "manage_org_settings"],
};
const ROLE_STAFF = { id: "rol_staff", name: "Staff", key: "staff", capabilities: ["view_products"] };

interface FakeMembership {
  id: string;
  userId: string;
  roleId: string;
  status: string;
  activatedAt: Date | null;
  revokedAt: Date | null;
  revokedByUserId: string | null;
  createdAt: Date;
  email: string;
}

interface FakeInvitation {
  id: string;
  email: string;
  status: string;
  cancelledAt: Date | null;
}

const ROLES = [ROLE_OWNER, ROLE_ADMIN, ROLE_STAFF];

function member(
  userId: string,
  roleId: string,
  over: Partial<FakeMembership> = {},
): FakeMembership {
  return {
    id: `mem_${userId}`,
    userId,
    roleId,
    status: "active",
    activatedAt: new Date("2026-07-01T00:00:00.000Z"),
    revokedAt: null,
    revokedByUserId: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    email: `${userId}@example.test`,
    ...over,
  };
}

/**
 * The double. `calls` records EVERY statement in order, which is what makes
 * "the lock came first" and "this read went through `tx`" assertable instead of
 * assumed.
 */
function createService(options: {
  readonly memberships: readonly FakeMembership[];
  readonly invitations?: readonly FakeInvitation[];
  readonly actor?: string;
  readonly roles?: readonly { id: string; name: string; key: string; capabilities: string[] }[];
}) {
  const memberships = options.memberships.map((m) => ({ ...m }));
  const invitations = (options.invitations ?? []).map((i) => ({ ...i }));
  const roles = (options.roles ?? ROLES).map((r) => ({ ...r }));
  const calls: string[] = [];
  const txOptions: unknown[] = [];

  const roleOf = (roleId: string) => roles.find((r) => r.id === roleId) ?? ROLE_STAFF;
  const project = (m: FakeMembership) => ({
    id: m.id,
    userId: m.userId,
    roleId: m.roleId,
    status: m.status,
    activatedAt: m.activatedAt,
    revokedAt: m.revokedAt,
    createdAt: m.createdAt,
    role: roleOf(m.roleId),
    user: { id: m.userId, email: m.email, createdAt: m.createdAt },
  });

  const membershipDelegate = (channel: "tx" | "client") => ({
    findFirst: vi.fn(async (args: { where: { userId: string } }) => {
      calls.push(`${channel}:membership.findFirst`);
      const found = memberships.find((m) => m.userId === args.where.userId);
      return found ? project(found) : null;
    }),
    findMany: vi.fn(async (args: Record<string, unknown>) => {
      calls.push(`${channel}:membership.findMany`);
      const where = (args.where ?? {}) as Record<string, unknown>;
      let rows = memberships;
      if (where.role) {
        rows = rows.filter((m) => roleOf(m.roleId).capabilities.includes("full_access"));
      }
      const status = where.status as { in?: string[] } | string | undefined;
      if (typeof status === "string") rows = rows.filter((m) => m.status === status);
      else if (status?.in) rows = rows.filter((m) => status.in!.includes(m.status));
      return rows.map(project);
    }),
    count: vi.fn(async (_args: unknown) => {
      calls.push(`${channel}:membership.count`);
      return memberships.length;
    }),
    update: vi.fn(
      async (args: {
        where: { organizationId_userId: { organizationId: string; userId: string } };
        data: Record<string, unknown>;
      }) => {
        calls.push(`${channel}:membership.update`);
        const found = memberships.find(
          (m) => m.userId === args.where.organizationId_userId.userId,
        );
        if (!found) throw new Error("membership.update: no such row");
        Object.assign(found, args.data);
        return project(found);
      },
    ),
  });

  const tx = {
    // `lockCurrentOrganization` runs these two, in this order, before anything
    // the service does.
    $executeRawUnsafe: vi.fn(async (query: string) => {
      calls.push(query.startsWith("SET LOCAL lock_timeout") ? "tx:lock_timeout" : `tx:raw`);
    }),
    $queryRawUnsafe: vi.fn(async (_query: string, id: string) => {
      calls.push("tx:FOR UPDATE");
      return [{ id }];
    }),
    membership: membershipDelegate("tx"),
    role: {
      findFirst: vi.fn(async (args: { where: { id: string } }) => {
        calls.push("tx:role.findFirst");
        return roles.find((r) => r.id === args.where.id) ?? null;
      }),
    },
    invitation: {
      findMany: vi.fn(async (args: { where: { email: string; status: string } }) => {
        calls.push("tx:invitation.findMany");
        return invitations
          .filter((i) => i.email === args.where.email && i.status === args.where.status)
          .map((i) => ({ id: i.id }));
      }),
      updateMany: vi.fn(
        async (args: { where: { id: { in: string[] } }; data: Record<string, unknown> }) => {
          calls.push("tx:invitation.updateMany");
          for (const inv of invitations) {
            if (args.where.id.in.includes(inv.id)) Object.assign(inv, args.data);
          }
          return { count: args.where.id.in.length };
        },
      ),
    },
  };

  const prisma = {
    membership: membershipDelegate("client"),
    $transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>, opts: unknown) => {
      txOptions.push(opts);
      return fn(tx);
    }),
  };

  const events = new SecurityEventsService();
  const sink: SecurityEventCollector = collectSecurityEvents(events);
  const store = new OrgContextStore();
  const actorUserId = options.actor ?? OWNER;
  const service = new MembersService(prisma as never, store, events);

  return {
    service,
    prisma,
    tx,
    calls,
    txOptions,
    sink,
    memberships,
    invitations,
    /** Run `fn` with the SAME AsyncLocalStorage the org lock reads (T-002-03). */
    run: <T>(fn: () => Promise<T>): Promise<T> =>
      store.run(
        {
          organizationId: ORG_ID,
          userId: actorUserId,
          capabilities: roleOf(
            memberships.find((m) => m.userId === actorUserId)?.roleId ?? ROLE_STAFF.id,
          ).capabilities,
        },
        fn,
      ),
  };
}

/** The code of the `DomainException` a call rejected with. */
async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof DomainException) return error.code;
    throw error;
  }
  throw new Error("expected the call to be refused, but it resolved");
}

// ── §3.7 the list ───────────────────────────────────────────────────────────

describe("MembersService.list — api-spec §3.7", () => {
  it("maps every row through the pure mapper, with isMe/isOwner", async () => {
    const ctx = createService({
      memberships: [member(OWNER, ROLE_OWNER.id), member(STAFF, ROLE_STAFF.id)],
      actor: OWNER,
    });
    const page = await ctx.run(() =>
      ctx.service.list({ status: "all", limit: 25, withTotal: false }),
    );

    expect(page.items).toHaveLength(2);
    expect(page.items[0]).toMatchObject({
      userId: OWNER,
      email: `${OWNER}@example.test`,
      roleName: "Owner",
      roleKey: "owner",
      isMe: true,
      isOwner: true,
    });
    expect(page.items[1]).toMatchObject({ userId: STAFF, isMe: false, isOwner: false });
    expect(page.nextCursor).toBeNull();
    // Not asked for ⇒ absent, not `null` (api-spec §1: `total` is opt-in).
    expect(page).not.toHaveProperty("total");
  });

  it("★ takes NO lock — a read that decides nothing must not serialize the tenant", async () => {
    const ctx = createService({ memberships: [member(OWNER, ROLE_OWNER.id)] });
    await ctx.run(() => ctx.service.list({ status: "all", limit: 25, withTotal: false }));
    expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
    expect(ctx.calls).toEqual(["client:membership.findMany"]);
  });

  it("`status=all` asks for active+revoked — never the dead `invited` state", async () => {
    const ctx = createService({ memberships: [member(OWNER, ROLE_OWNER.id)] });
    await ctx.run(() => ctx.service.list({ status: "all", limit: 25, withTotal: false }));
    expect(ctx.prisma.membership.findMany.mock.calls[0][0]).toMatchObject({
      where: { status: { in: ["active", "revoked"] } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 26,
    });
  });

  it("a status filter is passed straight through", async () => {
    const ctx = createService({
      memberships: [member(OWNER, ROLE_OWNER.id), member(STAFF, ROLE_STAFF.id, { status: "revoked" })],
    });
    const page = await ctx.run(() =>
      ctx.service.list({ status: "revoked", limit: 25, withTotal: false }),
    );
    expect(page.items.map((i) => i.userId)).toEqual([STAFF]);
  });

  it("`withTotal` adds a count over the SAME filter, minus the cursor window", async () => {
    const ctx = createService({ memberships: [member(OWNER, ROLE_OWNER.id)] });
    const page = await ctx.run(() =>
      ctx.service.list({
        status: "active",
        limit: 25,
        withTotal: true,
        cursor: { createdAt: "2026-07-01T00:00:00.000Z", id: "mem_x" },
      }),
    );
    expect(page.total).toBe(1);
    // The count's `where` has the status filter and NOT the keyset predicate.
    expect(ctx.prisma.membership.count.mock.calls[0][0]).toEqual({
      where: { status: "active" },
    });
  });

  it("over-fetches by one so `nextCursor: null` is honest", async () => {
    const ctx = createService({
      memberships: [member(OWNER, ROLE_OWNER.id), member(STAFF, ROLE_STAFF.id)],
    });
    const page = await ctx.run(() =>
      ctx.service.list({ status: "all", limit: 1, withTotal: false }),
    );
    expect(page.items).toHaveLength(1);
    expect(typeof page.nextCursor).toBe("string");
  });

  it("never selects a column outside the projection (no passwordHash reachable)", async () => {
    const ctx = createService({ memberships: [member(OWNER, ROLE_OWNER.id)] });
    await ctx.run(() => ctx.service.list({ status: "all", limit: 25, withTotal: false }));
    const args = ctx.prisma.membership.findMany.mock.calls[0][0] as {
      select: Record<string, unknown>;
    };
    // `USER_SELECT` — the frozen projection. `passwordHash` is not in it and
    // cannot be added here without changing packages/db.
    expect(args.select.user).toEqual({ select: { id: true, email: true, createdAt: true } });
  });
});

// ── §3.8 role change ────────────────────────────────────────────────────────

describe("MembersService.updateRole — api-spec §3.8", () => {
  it("★ the lock is the FIRST statement, and every decision is read through `tx`", async () => {
    const ctx = createService({
      memberships: [member(OWNER, ROLE_OWNER.id), member(STAFF, ROLE_STAFF.id)],
      actor: OWNER,
    });
    await ctx.run(() => ctx.service.updateRole({ targetUserId: STAFF, roleId: ROLE_ADMIN.id }));

    expect(ctx.calls[0]).toBe("tx:lock_timeout");
    expect(ctx.calls[1]).toBe("tx:FOR UPDATE");
    // M-2: nothing in the decision path touched the NON-transactional client.
    expect(ctx.calls.filter((c) => c.startsWith("client:"))).toEqual([]);
    expect(ctx.calls).toContain("tx:membership.findFirst");
    expect(ctx.calls).toContain("tx:role.findFirst");
    expect(ctx.calls).toContain("tx:membership.findMany");
  });

  it("★ opens the transaction with the §5.2 timeouts (never an unbounded one)", async () => {
    const ctx = createService({
      memberships: [member(OWNER, ROLE_OWNER.id), member(STAFF, ROLE_STAFF.id)],
    });
    await ctx.run(() => ctx.service.updateRole({ targetUserId: STAFF, roleId: ROLE_ADMIN.id }));
    expect(ctx.txOptions[0]).toMatchObject({
      timeout: expect.any(Number),
      maxWait: expect.any(Number),
    });
  });

  it("writes the new role and answers with the §3.7 row", async () => {
    const ctx = createService({
      memberships: [member(OWNER, ROLE_OWNER.id), member(STAFF, ROLE_STAFF.id)],
    });
    const row = await ctx.run(() =>
      ctx.service.updateRole({ targetUserId: STAFF, roleId: ROLE_ADMIN.id }),
    );
    expect(ctx.tx.membership.update.mock.calls[0][0]).toMatchObject({
      where: { organizationId_userId: { organizationId: ORG_ID, userId: STAFF } },
      data: { roleId: ROLE_ADMIN.id },
    });
    expect(row).toMatchObject({ userId: STAFF, roleName: "Admin", roleKey: "admin", isOwner: false });
  });

  it("★ emits role_changed POST-COMMIT with grantsFullAccess — the escalation flag", async () => {
    const ctx = createService({
      memberships: [member(OWNER, ROLE_OWNER.id), member(STAFF, ROLE_STAFF.id)],
      actor: OWNER,
    });
    await ctx.run(() => ctx.service.updateRole({ targetUserId: STAFF, roleId: ROLE_OWNER.id }));

    const emitted = ctx.sink.ofType("org.member.role_changed");
    expect(emitted).toHaveLength(1);
    expect(emitted[0].payload).toEqual({
      actorUserId: OWNER,
      organizationId: ORG_ID,
      targetUserId: STAFF,
      fromRoleId: ROLE_STAFF.id,
      toRoleId: ROLE_OWNER.id,
      // Promoting somebody to Owner is a privilege escalation, and this is the
      // field that makes it greppable without a join (§9).
      grantsFullAccess: true,
    });
    ctx.sink.stop();
  });

  it("grantsFullAccess is false for an ordinary role change", async () => {
    const ctx = createService({
      memberships: [member(OWNER, ROLE_OWNER.id), member(STAFF, ROLE_STAFF.id)],
    });
    await ctx.run(() => ctx.service.updateRole({ targetUserId: STAFF, roleId: ROLE_ADMIN.id }));
    expect(ctx.sink.ofType("org.member.role_changed")[0].payload).toMatchObject({
      grantsFullAccess: false,
    });
    ctx.sink.stop();
  });

  it("★ C-1/D-028: an Admin cannot promote anyone to Owner — 403, nothing written", async () => {
    const ctx = createService({
      memberships: [
        member(OWNER, ROLE_OWNER.id),
        member(ADMIN, ROLE_ADMIN.id),
        member(STAFF, ROLE_STAFF.id),
      ],
      actor: ADMIN,
    });
    const code = await codeOf(
      ctx.run(() => ctx.service.updateRole({ targetUserId: STAFF, roleId: ROLE_OWNER.id })),
    );
    expect(code).toBe("FORBIDDEN");
    expect(ctx.tx.membership.update).not.toHaveBeenCalled();
    expect(ctx.sink.ofType("org.member.role_changed")).toEqual([]);
    ctx.sink.stop();
  });

  it("★ C-1: an Admin cannot promote THEMSELVES to Owner", async () => {
    const ctx = createService({
      memberships: [member(OWNER, ROLE_OWNER.id), member(ADMIN, ROLE_ADMIN.id)],
      actor: ADMIN,
    });
    expect(
      await codeOf(
        ctx.run(() => ctx.service.updateRole({ targetUserId: ADMIN, roleId: ROLE_OWNER.id })),
      ),
    ).toBe("FORBIDDEN");
    expect(ctx.tx.membership.update).not.toHaveBeenCalled();
  });

  it("★ C-1: an Admin cannot DEMOTE an Owner either", async () => {
    const ctx = createService({
      memberships: [
        member(OWNER, ROLE_OWNER.id),
        member(OWNER_2, ROLE_OWNER.id),
        member(ADMIN, ROLE_ADMIN.id),
      ],
      actor: ADMIN,
    });
    expect(
      await codeOf(
        ctx.run(() => ctx.service.updateRole({ targetUserId: OWNER_2, roleId: ROLE_STAFF.id })),
      ),
    ).toBe("FORBIDDEN");
    expect(ctx.tx.membership.update).not.toHaveBeenCalled();
  });

  it("★ the actor's capabilities are re-read through `tx`, not taken from the ALS snapshot", async () => {
    // The context says `full_access` (that is what the guard saw); the DATABASE
    // says the actor is now an Admin, because a concurrent request demoted them.
    // The Owner-only decision must follow the database.
    const ctx = createService({
      memberships: [
        member(OWNER, ROLE_OWNER.id),
        member(ADMIN, ROLE_ADMIN.id),
        member(STAFF, ROLE_STAFF.id),
      ],
      actor: ADMIN,
    });
    const store = new OrgContextStore();
    const code = await codeOf(
      store.run({ organizationId: ORG_ID, userId: ADMIN, capabilities: ["full_access"] }, () =>
        ctx.service.updateRole({ targetUserId: STAFF, roleId: ROLE_OWNER.id }),
      ),
    );
    expect(code).toBe("FORBIDDEN");
  });

  it("★ 409 LAST_OWNER when the change would leave zero active Owners", async () => {
    const ctx = createService({
      memberships: [member(OWNER, ROLE_OWNER.id), member(STAFF, ROLE_STAFF.id)],
      actor: OWNER,
    });
    const code = await codeOf(
      ctx.run(() => ctx.service.updateRole({ targetUserId: OWNER, roleId: ROLE_STAFF.id })),
    );
    expect(code).toBe("LAST_OWNER");
    expect(ctx.tx.membership.update).not.toHaveBeenCalled();
    expect(ctx.sink.ofType("org.member.role_changed")).toEqual([]);
    ctx.sink.stop();
  });

  it("the SECOND Owner may step down while another Owner remains", async () => {
    const ctx = createService({
      memberships: [member(OWNER, ROLE_OWNER.id), member(OWNER_2, ROLE_OWNER.id)],
      actor: OWNER,
    });
    const row = await ctx.run(() =>
      ctx.service.updateRole({ targetUserId: OWNER_2, roleId: ROLE_STAFF.id }),
    );
    expect(row.isOwner).toBe(false);
  });

  it("a revoked owner does NOT count towards the invariant", async () => {
    const ctx = createService({
      memberships: [
        member(OWNER, ROLE_OWNER.id),
        member(OWNER_2, ROLE_OWNER.id, { status: "revoked", revokedAt: new Date() }),
      ],
      actor: OWNER,
    });
    expect(
      await codeOf(
        ctx.run(() => ctx.service.updateRole({ targetUserId: OWNER, roleId: ROLE_STAFF.id })),
      ),
    ).toBe("LAST_OWNER");
  });

  it("★ 404 when the target is not an active member (the PATCH ‖ DELETE loser)", async () => {
    const ctx = createService({
      memberships: [
        member(OWNER, ROLE_OWNER.id),
        member(STAFF, ROLE_STAFF.id, { status: "revoked", revokedAt: new Date() }),
      ],
    });
    expect(
      await codeOf(
        ctx.run(() => ctx.service.updateRole({ targetUserId: STAFF, roleId: ROLE_ADMIN.id })),
      ),
    ).toBe("NOT_FOUND");
    expect(ctx.tx.membership.update).not.toHaveBeenCalled();
  });

  it("★ 422 ROLE_INVALID for a role id this shop does not have", async () => {
    const ctx = createService({
      memberships: [member(OWNER, ROLE_OWNER.id), member(STAFF, ROLE_STAFF.id)],
    });
    expect(
      await codeOf(
        ctx.run(() => ctx.service.updateRole({ targetUserId: STAFF, roleId: "rol_other_org" })),
      ),
    ).toBe("ROLE_INVALID");
    expect(ctx.tx.membership.update).not.toHaveBeenCalled();
  });
});

// ── §3.9 revoke ─────────────────────────────────────────────────────────────

describe("MembersService.revoke — api-spec §3.9", () => {
  it("★ soft-revokes and cancels that email's pending invitations in ONE transaction", async () => {
    const ctx = createService({
      memberships: [member(OWNER, ROLE_OWNER.id), member(STAFF, ROLE_STAFF.id)],
      invitations: [
        { id: "inv_1", email: `${STAFF}@example.test`, status: "pending", cancelledAt: null },
        { id: "inv_2", email: `${STAFF}@example.test`, status: "accepted", cancelledAt: null },
        { id: "inv_3", email: "someone.else@example.test", status: "pending", cancelledAt: null },
      ],
      actor: OWNER,
    });

    const result = await ctx.run(() => ctx.service.revoke({ targetUserId: STAFF }));

    expect(result).toMatchObject({ userId: STAFF, status: "revoked", cancelledInvitations: 1 });
    expect(Date.parse(result.revokedAt)).not.toBeNaN();

    // The membership write.
    expect(ctx.tx.membership.update.mock.calls[0][0]).toMatchObject({
      where: { organizationId_userId: { organizationId: ORG_ID, userId: STAFF } },
      data: { status: "revoked", revokedByUserId: OWNER },
    });
    // …and ONLY that person's PENDING invitation, in the same tx.
    expect(ctx.tx.invitation.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: { in: ["inv_1"] } },
      data: { status: "cancelled" },
    });
    expect(ctx.invitations.find((i) => i.id === "inv_2")?.status).toBe("accepted");
    expect(ctx.invitations.find((i) => i.id === "inv_3")?.status).toBe("pending");

    // ONE transaction — not "revoke, then cancel", which would leave a window in
    // which the door back into the shop is still open (I-1).
    expect(ctx.prisma.$transaction).toHaveBeenCalledTimes(1);
    const lockIndex = ctx.calls.indexOf("tx:FOR UPDATE");
    expect(lockIndex).toBe(1);
    expect(ctx.calls.indexOf("tx:membership.update")).toBeGreaterThan(lockIndex);
    expect(ctx.calls.indexOf("tx:invitation.updateMany")).toBeGreaterThan(lockIndex);
  });

  it("★ the event names the cancelled invitations (I-1), post-commit", async () => {
    const ctx = createService({
      memberships: [member(OWNER, ROLE_OWNER.id), member(STAFF, ROLE_STAFF.id)],
      invitations: [
        { id: "inv_1", email: `${STAFF}@example.test`, status: "pending", cancelledAt: null },
      ],
      actor: OWNER,
    });
    await ctx.run(() => ctx.service.revoke({ targetUserId: STAFF }));

    const emitted = ctx.sink.ofType("org.member.revoked");
    expect(emitted).toHaveLength(1);
    expect(emitted[0].payload).toEqual({
      actorUserId: OWNER,
      organizationId: ORG_ID,
      targetUserId: STAFF,
      cancelledInvitationIds: ["inv_1"],
    });
    // ⛔ NOT the leave event — that is a different business signal (D-029).
    expect(ctx.sink.ofType("org.member.left")).toEqual([]);
    ctx.sink.stop();
  });

  it("touches no invitation table row when there is nothing pending", async () => {
    const ctx = createService({
      memberships: [member(OWNER, ROLE_OWNER.id), member(STAFF, ROLE_STAFF.id)],
    });
    const result = await ctx.run(() => ctx.service.revoke({ targetUserId: STAFF }));
    expect(result.cancelledInvitations).toBe(0);
    expect(ctx.tx.invitation.updateMany).not.toHaveBeenCalled();
  });

  it("★ 404 on the second of two concurrent revokes — never 500, and one revokedAt", async () => {
    const ctx = createService({
      memberships: [
        member(OWNER, ROLE_OWNER.id),
        member(STAFF, ROLE_STAFF.id, {
          status: "revoked",
          revokedAt: new Date("2026-07-05T00:00:00.000Z"),
        }),
      ],
    });
    expect(await codeOf(ctx.run(() => ctx.service.revoke({ targetUserId: STAFF })))).toBe(
      "NOT_FOUND",
    );
    expect(ctx.tx.membership.update).not.toHaveBeenCalled();
    expect(ctx.memberships.find((m) => m.userId === STAFF)?.revokedAt).toEqual(
      new Date("2026-07-05T00:00:00.000Z"),
    );
  });

  it("★ C-1: an Admin cannot remove an Owner", async () => {
    const ctx = createService({
      memberships: [
        member(OWNER, ROLE_OWNER.id),
        member(OWNER_2, ROLE_OWNER.id),
        member(ADMIN, ROLE_ADMIN.id),
      ],
      actor: ADMIN,
    });
    expect(await codeOf(ctx.run(() => ctx.service.revoke({ targetUserId: OWNER_2 })))).toBe(
      "FORBIDDEN",
    );
    expect(ctx.tx.membership.update).not.toHaveBeenCalled();
    expect(ctx.sink.ofType("org.member.revoked")).toEqual([]);
    ctx.sink.stop();
  });

  it("an Admin MAY remove a Staff member", async () => {
    const ctx = createService({
      memberships: [
        member(OWNER, ROLE_OWNER.id),
        member(ADMIN, ROLE_ADMIN.id),
        member(STAFF, ROLE_STAFF.id),
      ],
      actor: ADMIN,
    });
    const result = await ctx.run(() => ctx.service.revoke({ targetUserId: STAFF }));
    expect(result.status).toBe("revoked");
  });

  it("★ 409 LAST_OWNER — removing the only Owner is refused, nothing written", async () => {
    const ctx = createService({
      memberships: [member(OWNER, ROLE_OWNER.id), member(STAFF, ROLE_STAFF.id)],
      actor: OWNER,
    });
    expect(await codeOf(ctx.run(() => ctx.service.revoke({ targetUserId: OWNER })))).toBe(
      "LAST_OWNER",
    );
    expect(ctx.tx.membership.update).not.toHaveBeenCalled();
    expect(ctx.sink.ofType("org.member.revoked")).toEqual([]);
    ctx.sink.stop();
  });
});

// ── §3.17 leave (D-029) ─────────────────────────────────────────────────────

describe("MembersService.leave — api-spec §3.17 (D-029)", () => {
  it("★ emits org.member.left — NOT org.member.revoked", async () => {
    // The whole reason §3.17 is a separate endpoint: afterwards, "did the team
    // walk out or did the owner clear them out?" must be answerable.
    const ctx = createService({
      memberships: [member(OWNER, ROLE_OWNER.id), member(STAFF, ROLE_STAFF.id)],
      invitations: [
        { id: "inv_self", email: `${STAFF}@example.test`, status: "pending", cancelledAt: null },
      ],
      actor: STAFF,
    });
    const result = await ctx.run(() => ctx.service.leave());

    expect(result).toMatchObject({
      organizationId: ORG_ID,
      status: "revoked",
      cancelledInvitations: 1,
    });
    const left = ctx.sink.ofType("org.member.left");
    expect(left).toHaveLength(1);
    expect(left[0].payload).toEqual({
      userId: STAFF,
      organizationId: ORG_ID,
      roleId: ROLE_STAFF.id,
      cancelledInvitationIds: ["inv_self"],
    });
    expect(ctx.sink.ofType("org.member.revoked")).toEqual([]);
    ctx.sink.stop();
  });

  it("★ records the caller as their own revoker (D-029 self-revoke)", async () => {
    const ctx = createService({
      memberships: [member(OWNER, ROLE_OWNER.id), member(STAFF, ROLE_STAFF.id)],
      actor: STAFF,
    });
    await ctx.run(() => ctx.service.leave());
    expect(ctx.tx.membership.update.mock.calls[0][0]).toMatchObject({
      where: { organizationId_userId: { organizationId: ORG_ID, userId: STAFF } },
      data: { status: "revoked", revokedByUserId: STAFF },
    });
  });

  it("★ needs NO capability — a member with an empty capability set may leave", async () => {
    // The structural difference from §3.9: there is no `userId` input, so there
    // is nothing to authorize BEYOND being an active member.
    const ctx = createService({
      memberships: [member(OWNER, ROLE_OWNER.id), member(STAFF, "rol_nothing")],
      roles: [...ROLES, { id: "rol_nothing", name: "จำกัด", key: "none", capabilities: [] }],
      actor: STAFF,
    });
    const result = await ctx.run(() => ctx.service.leave());
    expect(result.status).toBe("revoked");
  });

  it("★ takes the same lock, first statement, same transaction as a revoke", async () => {
    const ctx = createService({
      memberships: [member(OWNER, ROLE_OWNER.id), member(STAFF, ROLE_STAFF.id)],
      actor: STAFF,
    });
    await ctx.run(() => ctx.service.leave());
    expect(ctx.calls[0]).toBe("tx:lock_timeout");
    expect(ctx.calls[1]).toBe("tx:FOR UPDATE");
    expect(ctx.calls.filter((c) => c.startsWith("client:"))).toEqual([]);
    expect(ctx.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("★ 409 LAST_OWNER — the only Owner cannot leave (same pure fn, no second rule)", async () => {
    const ctx = createService({
      memberships: [member(OWNER, ROLE_OWNER.id), member(STAFF, ROLE_STAFF.id)],
      actor: OWNER,
    });
    expect(await codeOf(ctx.run(() => ctx.service.leave()))).toBe("LAST_OWNER");
    expect(ctx.tx.membership.update).not.toHaveBeenCalled();
    expect(ctx.sink.ofType("org.member.left")).toEqual([]);
    ctx.sink.stop();
  });

  it("an Owner with a co-Owner may leave", async () => {
    const ctx = createService({
      memberships: [member(OWNER, ROLE_OWNER.id), member(OWNER_2, ROLE_OWNER.id)],
      actor: OWNER_2,
    });
    expect((await ctx.run(() => ctx.service.leave())).status).toBe("revoked");
  });

  it("★ 403 ORG_ACCESS_DENIED (never 404) when the caller is no longer active", async () => {
    // Pressing "leave" twice, or being removed between the guard chain and the
    // transaction. `404` here would tell somebody outside the shop that it
    // exists (I-8).
    const ctx = createService({
      memberships: [
        member(OWNER, ROLE_OWNER.id),
        member(STAFF, ROLE_STAFF.id, { status: "revoked", revokedAt: new Date() }),
      ],
      actor: STAFF,
    });
    expect(await codeOf(ctx.run(() => ctx.service.leave()))).toBe("ORG_ACCESS_DENIED");
    expect(ctx.tx.membership.update).not.toHaveBeenCalled();
  });
});

// ── the shared post-commit rule (H-3) ───────────────────────────────────────

describe("★ events are POST-COMMIT (H-3)", () => {
  const calls: readonly [string, (s: MembersService) => Promise<unknown>][] = [
    ["revoke", (s) => s.revoke({ targetUserId: STAFF })],
    ["leave", (s) => s.leave()],
    ["updateRole", (s) => s.updateRole({ targetUserId: STAFF, roleId: ROLE_ADMIN.id })],
  ];

  it.each(calls)("%s emits nothing when the transaction fails", async (_name, call) => {
    const ctx = createService({
      // Two Owners, so `leave()` gets past the invariant and reaches the write.
      memberships: [
        member(OWNER, ROLE_OWNER.id),
        member(OWNER_2, ROLE_OWNER.id),
        member(STAFF, ROLE_STAFF.id),
      ],
      actor: OWNER,
    });
    // The database refuses the write after every check has passed — a rolled-back
    // transaction must never leave an audit line claiming it happened.
    ctx.tx.membership.update.mockRejectedValueOnce(new Error("boom"));
    await expect(ctx.run(() => call(ctx.service))).rejects.toThrow();
    expect(ctx.sink.types()).toEqual([]);
    ctx.sink.stop();
  });
});
