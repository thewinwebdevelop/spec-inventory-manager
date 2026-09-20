// F-002 · T-002-20 ★ — redeeming an invitation: the ORCHESTRATION
// (api-spec §3.14/§3.15 · architecture §5.1/§7.4 · I-1/I-3/I-9/M-6 · D-014).
//
// The RULES live in `packages/core-domain` (`canAcceptInvitation`,
// `resolveInvitationStatus`, `toInvitationPreview`) and are proven exhaustively
// there. Re-proving them here would create a second place for them to drift.
// What only this layer can prove — and what every case below is about:
//
//   * the organization comes from the INVITATION ROW, never from the ambient
//     context, even when one exists and points somewhere else (I-3);
//   * the lock is the FIRST statement, and every fact the decision uses is read
//     through `tx` AFTER it — the reads outside the transaction answer "which
//     tenant?" and nothing else (§5.1 rule 2 / U-API-09b);
//   * the decision ORDER of api-spec §3.15, including the one answer the pure fn
//     cannot give (the email check) and the slot it occupies;
//   * `ALREADY_MEMBER` does not touch the caller's role, and still closes the
//     invitation (I-9);
//   * a reactivation emits its own event, distinct from "somebody joined";
//   * the raw token never reaches the database layer — only its HMAC.
//
// The double is a small in-memory database rather than canned rows, so "what
// did the transaction see after the row changed?" is answerable.
import { describe, it, expect, vi } from "vitest";
// The PRODUCTION hasher, through the same re-export the service uses. A test
// that hashed its own tokens would prove only that the test agrees with itself
// (D-018 / test-plan Q8 ก) — and would not notice the day the two disagree.
import { hashInvitationToken } from "../prisma/invitation-token";
import { DomainException } from "../common/domain-exception";
import {
  SecurityEventsService,
  collectSecurityEvents,
  type SecurityEventCollector,
} from "../auth/security-events.service";
import { OrgContextStore } from "../tenancy";
import { InvitationsService } from "./invitations.service";
import type { InvitationLookupService } from "./system/invitation-lookup.service";

// `hashInvitationToken` reads this per call (never captured at module load), so
// the keyed hash needs a key here too. `??=` so a suite that already set one in
// the same process keeps it.
process.env.INVITATION_TOKEN_SECRET ??= "t20-unit-invitation-secret-32-chars!!";

const ORG_ID = "org_invited";
/** An org the CALLER belongs to. Nothing may ever be written here. */
const OTHER_ORG_ID = "org_the_caller_picked";
const ORG_NAME = "ร้านของจริง";
const USER_ID = "usr_invitee";
const USER_EMAIL = "napa@example.com";
const RAW_TOKEN = "raw-invitation-token-value";

const ROLE_STAFF = { id: "rol_staff", name: "Staff", key: "staff" };
const NOW = new Date("2026-08-05T10:00:00.000Z");
const ISSUED = new Date("2026-08-01T10:00:00.000Z");
const EXPIRES = new Date("2026-08-08T10:00:00.000Z");
const USER_CREATED = new Date("2026-07-01T00:00:00.000Z");

interface FakeInvitation {
  id: string;
  organizationId: string;
  email: string;
  roleId: string;
  status: string;
  expiresAt: Date;
  tokenIssuedAt: Date;
  acceptedAt: Date | null;
  acceptedByUserId: string | null;
  acceptedUserCreatedAt: Date | null;
  cancelledAt: Date | null;
  tokenHash: string;
}

interface FakeMembership {
  id: string;
  userId: string;
  roleId: string;
  status: string;
  activatedAt: Date | null;
  revokedAt: Date | null;
  revokedByUserId: string | null;
}

function invitation(over: Partial<FakeInvitation> = {}): FakeInvitation {
  return {
    id: "inv_1",
    organizationId: ORG_ID,
    email: USER_EMAIL,
    roleId: ROLE_STAFF.id,
    status: "pending",
    expiresAt: EXPIRES,
    tokenIssuedAt: ISSUED,
    acceptedAt: null,
    acceptedByUserId: null,
    acceptedUserCreatedAt: null,
    cancelledAt: null,
    tokenHash: hashInvitationToken(RAW_TOKEN),
    ...over,
  };
}

interface Options {
  /** The row the OUTSIDE (SYSTEM_PRISMA) lookup finds — `null` = unknown token. */
  readonly located?: FakeInvitation | null;
  /** The row the TRANSACTION finds. Defaults to `located` (the normal case). */
  readonly inTx?: FakeInvitation | null;
  readonly memberships?: readonly FakeMembership[];
  readonly roles?: readonly { id: string; name: string; key: string | null }[];
  readonly acceptorEmail?: string;
  readonly acceptorCreatedAt?: Date;
  /** `null` = the authenticated user's row has vanished. */
  readonly acceptorExists?: boolean;
}

function createService(options: Options = {}) {
  const located = options.located === undefined ? invitation() : options.located;
  const txRow = options.inTx === undefined ? located : options.inTx;
  const invitations = txRow ? [{ ...txRow }] : [];
  const memberships = (options.memberships ?? []).map((m) => ({ ...m }));
  const roles = (options.roles ?? [ROLE_STAFF]).map((r) => ({ ...r }));
  const calls: string[] = [];
  const lockedOrgIds: string[] = [];

  const tx = {
    // `lockCurrentOrganization` issues these two, in this order, before the
    // service's callback runs at all.
    $executeRawUnsafe: vi.fn(async (query: string) => {
      calls.push(query.startsWith("SET LOCAL lock_timeout") ? "tx:lock_timeout" : "tx:raw");
    }),
    $queryRawUnsafe: vi.fn(async (_query: string, id: string) => {
      calls.push("tx:FOR UPDATE");
      lockedOrgIds.push(id);
      return [{ id }];
    }),
    invitation: {
      findFirst: vi.fn(async (args: { where: { tokenHash: string } }) => {
        calls.push("tx:invitation.findFirst");
        const found = invitations.find((i) => i.tokenHash === args.where.tokenHash);
        return found ? { ...found } : null;
      }),
      update: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        calls.push("tx:invitation.update");
        const found = invitations.find((i) => i.id === args.where.id);
        if (!found) throw new Error("invitation.update: no such row");
        Object.assign(found, args.data);
        return { id: found.id };
      }),
    },
    role: {
      findFirst: vi.fn(async (args: { where: { id: string } }) => {
        calls.push("tx:role.findFirst");
        return roles.find((r) => r.id === args.where.id) ?? null;
      }),
    },
    membership: {
      findFirst: vi.fn(async (args: { where: { userId: string } }) => {
        calls.push("tx:membership.findFirst");
        const found = memberships.find((m) => m.userId === args.where.userId);
        return found ? { ...found } : null;
      }),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        calls.push("tx:membership.create");
        const data = args.data as unknown as FakeMembership;
        memberships.push({
          id: `mem_${memberships.length}`,
          userId: data.userId,
          roleId: data.roleId,
          status: data.status,
          activatedAt: data.activatedAt ?? null,
          revokedAt: null,
          revokedByUserId: null,
        });
        return { id: `mem_${memberships.length - 1}` };
      }),
      update: vi.fn(
        async (args: {
          where: { organizationId_userId: { organizationId: string; userId: string } };
          data: Record<string, unknown>;
        }) => {
          calls.push("tx:membership.update");
          const found = memberships.find(
            (m) => m.userId === args.where.organizationId_userId.userId,
          );
          if (!found) throw new Error("membership.update: no such row");
          Object.assign(found, args.data);
          return { id: found.id };
        },
      ),
    },
    organization: {
      findUnique: vi.fn(async (args: { where: { id: string } }) => {
        calls.push("tx:organization.findUnique");
        return { id: args.where.id, name: ORG_NAME };
      }),
    },
  };

  const prisma = {
    $transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
  };

  const lookup = {
    findByTokenHash: vi.fn(async (tokenHash: string) => {
      calls.push("system:findByTokenHash");
      if (!located || located.tokenHash !== tokenHash) return null;
      return {
        id: located.id,
        organizationId: located.organizationId,
        email: located.email,
        roleId: located.roleId,
        status: located.status,
        expiresAt: located.expiresAt,
        tokenIssuedAt: located.tokenIssuedAt,
        organizationName: ORG_NAME,
        roleName: ROLE_STAFF.name,
        roleKey: ROLE_STAFF.key,
      };
    }),
    findAcceptor: vi.fn(async (userId: string) => {
      calls.push("system:findAcceptor");
      if (options.acceptorExists === false) return null;
      return {
        id: userId,
        email: options.acceptorEmail ?? USER_EMAIL,
        createdAt: options.acceptorCreatedAt ?? USER_CREATED,
      };
    }),
  };

  const events = new SecurityEventsService();
  const sink: SecurityEventCollector = collectSecurityEvents(events);
  const store = new OrgContextStore();
  const service = new InvitationsService(
    prisma as never,
    store,
    events,
    100,
    "https://app.example.com",
    lookup as unknown as InvitationLookupService,
  );

  return { service, prisma, tx, lookup, calls, lockedOrgIds, sink, invitations, memberships, store };
}

/** The code of the `DomainException` a call rejected with. */
async function refusalOf(promise: Promise<unknown>): Promise<DomainException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof DomainException) return error;
    throw error;
  }
  throw new Error("expected the call to be refused, but it resolved");
}

function member(over: Partial<FakeMembership> = {}): FakeMembership {
  return {
    id: "mem_existing",
    userId: USER_ID,
    roleId: ROLE_STAFF.id,
    status: "active",
    activatedAt: new Date("2026-07-02T00:00:00.000Z"),
    revokedAt: null,
    revokedByUserId: null,
    ...over,
  };
}

// ── §3.14 preview ───────────────────────────────────────────────────────────

describe("InvitationsService.preview — api-spec §3.14", () => {
  it("returns the shop, the role and the masked address for a live link", async () => {
    const ctx = createService();
    const preview = await ctx.service.preview({ token: RAW_TOKEN, now: NOW });
    expect(preview).toEqual({
      organizationName: ORG_NAME,
      roleName: "Staff",
      roleKey: "staff",
      emailMasked: "n***@example.com",
      expiresAt: EXPIRES.toISOString(),
      status: "pending",
    });
  });

  it("★ the RAW token never reaches the data layer — only its HMAC does", async () => {
    // D-018: `Invitation` stores a keyed hash, and the lookup is a `findUnique`
    // on it. A service that passed the raw value down would mean the token was
    // in a query, a query log and a slow-query report.
    const ctx = createService();
    await ctx.service.preview({ token: RAW_TOKEN, now: NOW });
    expect(ctx.lookup.findByTokenHash).toHaveBeenCalledWith(hashInvitationToken(RAW_TOKEN));
    expect(ctx.lookup.findByTokenHash).not.toHaveBeenCalledWith(RAW_TOKEN);
  });

  it("★ the response carries NO organizationId, no full email, no invitation id", async () => {
    // api-spec §3.14: the caller is a stranger holding a link. Everything that
    // identifies the shop as a record — or the invitee as a person — stays here.
    const ctx = createService();
    const serialized = JSON.stringify(await ctx.service.preview({ token: RAW_TOKEN, now: NOW }));
    expect(serialized).not.toContain(ORG_ID);
    expect(serialized).not.toContain(USER_EMAIL);
    expect(serialized).not.toContain("inv_1");
  });

  it("★ an unknown token is ONE answer: 404 INVITATION_INVALID", async () => {
    const ctx = createService({ located: null });
    const error = await refusalOf(ctx.service.preview({ token: "never-issued", now: NOW }));
    expect(error.getStatus()).toBe(404);
    expect(error.code).toBe("INVITATION_INVALID");
    // Nothing about the token, nothing about whether it ever existed.
    expect(error.details).toBeUndefined();
    expect(JSON.stringify(error.getResponse())).not.toContain("never-issued");
  });

  it("★ a ROTATED token is indistinguishable from one that never existed", async () => {
    // §3.12 overwrites `tokenHash`, so yesterday's link resolves to nothing —
    // the same nothing an invented token resolves to (I-C-05).
    const ctx = createService({ located: invitation({ tokenHash: hashInvitationToken("rotated") }) });
    const stale = await refusalOf(ctx.service.preview({ token: RAW_TOKEN, now: NOW }));
    const invented = await refusalOf(ctx.service.preview({ token: "made-up", now: NOW }));
    expect(stale.code).toBe(invented.code);
    expect(stale.getStatus()).toBe(invented.getStatus());
    expect(stale.getResponse()).toEqual(invented.getResponse());
  });

  it.each([
    ["expired", invitation({ expiresAt: new Date(NOW.getTime() - 1) }), "INVITATION_EXPIRED"],
    ["cancelled", invitation({ status: "cancelled" }), "INVITATION_CANCELLED"],
    ["accepted", invitation({ status: "accepted" }), "INVITATION_ALREADY_ACCEPTED"],
  ])(
    "★ a token that DID resolve gets the precise state (%s) — the caller already holds the secret",
    async (_name, row, code) => {
      const ctx = createService({ located: row });
      const error = await refusalOf(ctx.service.preview({ token: RAW_TOKEN, now: NOW }));
      expect(error.code).toBe(code);
      expect(error.getStatus()).toBe(409);
    },
  );

  it("expiry is DERIVED at read time — the stored status is still `pending`", async () => {
    const row = invitation({ expiresAt: new Date(NOW.getTime() - 1) });
    const ctx = createService({ located: row });
    expect((await refusalOf(ctx.service.preview({ token: RAW_TOKEN, now: NOW }))).code).toBe(
      "INVITATION_EXPIRED",
    );
    expect(row.status).toBe("pending"); // no job, no write, no drift
  });

  it("★ takes NO lock and opens NO transaction — a read decides nothing", async () => {
    const ctx = createService();
    await ctx.service.preview({ token: RAW_TOKEN, now: NOW });
    expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
    expect(ctx.calls).toEqual(["system:findByTokenHash"]);
  });

  it("★ creates no org context — a public route must not enter one (I-3)", async () => {
    const ctx = createService();
    await ctx.service.preview({ token: RAW_TOKEN, now: NOW });
    expect(ctx.store.get()).toBeUndefined();
  });
});

// ── §3.15 accept ────────────────────────────────────────────────────────────

describe("InvitationsService.accept — the transaction (architecture §5.1)", () => {
  it("★ the lock is the FIRST statement, and every decision fact is read AFTER it", async () => {
    const ctx = createService();
    await ctx.service.accept({ userId: USER_ID, token: RAW_TOKEN, now: NOW });
    expect(ctx.calls).toEqual([
      // outside the tx: "which tenant?", and the caller's own row
      "system:findByTokenHash",
      "system:findAcceptor",
      // inside: the anchor, then the re-reads, then the writes
      "tx:lock_timeout",
      "tx:FOR UPDATE",
      "tx:invitation.findFirst",
      "tx:role.findFirst",
      "tx:membership.findFirst",
      "tx:membership.create",
      "tx:invitation.update",
      "tx:organization.findUnique",
    ]);
  });

  it("★ the invitation is re-read BY TOKEN HASH inside the tx, not by id", async () => {
    // By id, a rotate committed between the two reads would still resolve — and
    // accept would redeem a link that no longer exists (I-C-05).
    const ctx = createService();
    await ctx.service.accept({ userId: USER_ID, token: RAW_TOKEN, now: NOW });
    expect(ctx.tx.invitation.findFirst.mock.calls[0][0]).toMatchObject({
      where: { tokenHash: hashInvitationToken(RAW_TOKEN) },
    });
  });

  it("★ U-API-09b: the OUTSIDE read is not the decision — the tx row wins", async () => {
    // The outside lookup returns a perfectly acceptable invitation; the row the
    // transaction sees was cancelled in between (a concurrent revoke, I-1). If
    // the service decided on the outside snapshot this would be a 200.
    const ctx = createService({
      located: invitation(),
      inTx: invitation({ status: "cancelled" }),
    });
    expect(
      (await refusalOf(ctx.service.accept({ userId: USER_ID, token: RAW_TOKEN, now: NOW }))).code,
    ).toBe("INVITATION_CANCELLED");
    expect(ctx.tx.membership.create).not.toHaveBeenCalled();
  });

  it("★ a token rotated between the two reads is 404, not a redeemed link", async () => {
    const ctx = createService({ located: invitation(), inTx: null });
    expect(
      (await refusalOf(ctx.service.accept({ userId: USER_ID, token: RAW_TOKEN, now: NOW }))).code,
    ).toBe("INVITATION_INVALID");
  });

  it("★ I-3: the org comes from the ROW even when the caller is inside another org", async () => {
    // The exact shape I-3 was written against: a caller who is a member of
    // `OTHER_ORG_ID` sends its id, something upstream establishes that context,
    // and the membership must STILL be written to the invitation's shop.
    const ctx = createService();
    await ctx.store.run({ organizationId: OTHER_ORG_ID, userId: USER_ID }, () =>
      ctx.service.accept({ userId: USER_ID, token: RAW_TOKEN, now: NOW }),
    );
    expect(ctx.lockedOrgIds).toEqual([ORG_ID]);
    expect(ctx.lockedOrgIds).not.toContain(OTHER_ORG_ID);
    expect(ctx.tx.membership.update).not.toHaveBeenCalled();
  });

  it("the context it opens is the invitation's org + the authenticated user", async () => {
    const ctx = createService();
    let seen: unknown;
    ctx.tx.organization.findUnique.mockImplementationOnce(async (args: { where: { id: string } }) => {
      seen = ctx.store.get();
      return { id: args.where.id, name: ORG_NAME };
    });
    await ctx.service.accept({ userId: USER_ID, token: RAW_TOKEN, now: NOW });
    expect(seen).toMatchObject({ organizationId: ORG_ID, userId: USER_ID });
    // …and it does not leak past the call.
    expect(ctx.store.get()).toBeUndefined();
  });

  it("passes the operation key so contention is labelled, not anonymous", async () => {
    const ctx = createService();
    await ctx.service.accept({ userId: USER_ID, token: RAW_TOKEN, now: NOW });
    // `runInOrgLockTransaction(..., { operation: "acceptInvitation" })` — the
    // label of `org_tx_lock_timeout_total` and of the §5.2 error mapping.
    expect(ctx.prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("InvitationsService.accept — success", () => {
  it("creates the membership with the invitation's role and returns §3.15's shape", async () => {
    const ctx = createService();
    const result = await ctx.service.accept({ userId: USER_ID, token: RAW_TOKEN, now: NOW });
    expect(result).toEqual({
      organization: { id: ORG_ID, name: ORG_NAME },
      membership: { roleId: ROLE_STAFF.id, roleName: "Staff", roleKey: "staff", status: "active" },
    });
    expect(ctx.memberships).toHaveLength(1);
    expect(ctx.memberships[0]).toMatchObject({ userId: USER_ID, roleId: ROLE_STAFF.id, status: "active" });
  });

  it("★ never passes an organizationId in the write — the scope injects it", async () => {
    // A caller-supplied org id on this path is the I-3 bug with a different
    // spelling: `roleId` is a single-column FK, so the database would accept a
    // membership pointing into another tenant without complaint.
    const ctx = createService();
    await ctx.service.accept({ userId: USER_ID, token: RAW_TOKEN, now: NOW });
    expect(ctx.tx.membership.create.mock.calls[0][0].data).not.toHaveProperty("organizationId");
  });

  it("★ snapshots the acceptor's createdAt into the invitation (survives PDPA deletion)", async () => {
    const ctx = createService();
    await ctx.service.accept({ userId: USER_ID, token: RAW_TOKEN, now: NOW });
    expect(ctx.invitations[0]).toMatchObject({
      status: "accepted",
      acceptedAt: NOW,
      acceptedByUserId: USER_ID,
      // A COPY, not a join: after the user row is deleted the flag must still
      // answer "was this account created after the invitation?" (architecture §7.6).
      acceptedUserCreatedAt: USER_CREATED,
    });
  });

  it("★ emits org.invitation.accepted POST-COMMIT with the documented payload", async () => {
    const ctx = createService({ acceptorCreatedAt: new Date(ISSUED.getTime() + 1000) });
    await ctx.service.accept({ userId: USER_ID, token: RAW_TOKEN, now: NOW });
    const emitted = ctx.sink.ofType("org.invitation.accepted");
    expect(emitted).toHaveLength(1);
    expect(emitted[0].payload).toEqual({
      userId: USER_ID,
      organizationId: ORG_ID,
      invitationId: "inv_1",
      roleId: ROLE_STAFF.id,
      acceptedByUserId: USER_ID,
      userCreatedAt: new Date(ISSUED.getTime() + 1000).toISOString(),
      // The account was made after THIS link was handed out — the Phase-0
      // signal for "somebody signed up to claim a leaked invitation" (I-7).
      userCreatedAfterTokenIssued: true,
    });
    // ⚠️ Asserted on `payload`, never on the whole event: the envelope carries an
    // epoch-millis `at` that collides with numeric fragments at random.
    expect(JSON.stringify(emitted[0].payload)).not.toContain(USER_EMAIL);
  });

  it("does NOT emit org.member.reactivated when nobody was revoked", async () => {
    const ctx = createService();
    await ctx.service.accept({ userId: USER_ID, token: RAW_TOKEN, now: NOW });
    expect(ctx.sink.ofType("org.member.reactivated")).toHaveLength(0);
  });

  it("★ a refusal emits NOTHING — a rolled-back decision leaves no trace (H-3)", async () => {
    const ctx = createService({ located: invitation({ status: "cancelled" }) });
    await refusalOf(ctx.service.accept({ userId: USER_ID, token: RAW_TOKEN, now: NOW }));
    expect(ctx.sink.types()).toEqual([]);
  });
});

describe("InvitationsService.accept — reactivation (I-1ค / M-7ข)", () => {
  const revokedBefore = member({
    status: "revoked",
    // Removed BEFORE this link was issued ⇒ the invitation is a conscious
    // re-invite and must work.
    revokedAt: new Date(ISSUED.getTime() - 60_000),
    revokedByUserId: "usr_owner",
  });

  it("★ wakes the revoked row up instead of creating a second membership", async () => {
    const ctx = createService({ memberships: [revokedBefore] });
    await ctx.service.accept({ userId: USER_ID, token: RAW_TOKEN, now: NOW });
    expect(ctx.tx.membership.create).not.toHaveBeenCalled();
    expect(ctx.memberships).toHaveLength(1);
    expect(ctx.memberships[0]).toMatchObject({
      status: "active",
      roleId: ROLE_STAFF.id,
      activatedAt: NOW,
      // Cleared: the member list and the I-1 comparison both read `revokedAt` as
      // "this person is out". The history is in the event below.
      revokedAt: null,
      revokedByUserId: null,
    });
  });

  it("★ emits org.member.reactivated as a SEPARATE event, with the old revokedAt", async () => {
    const ctx = createService({ memberships: [revokedBefore] });
    await ctx.service.accept({ userId: USER_ID, token: RAW_TOKEN, now: NOW });
    const reactivated = ctx.sink.ofType("org.member.reactivated");
    expect(reactivated).toHaveLength(1);
    expect(reactivated[0].payload).toEqual({
      userId: USER_ID,
      organizationId: ORG_ID,
      invitationId: "inv_1",
      roleId: ROLE_STAFF.id,
      previousRevokedAt: revokedBefore.revokedAt!.toISOString(),
    });
    // BOTH events, not one: "a removed person came back" is a different signal
    // from "a new person joined", and folded together nobody investigating a
    // takeover could tell them apart afterwards.
    expect(ctx.sink.ofType("org.invitation.accepted")).toHaveLength(1);
  });
});

describe("InvitationsService.accept — the decision order (api-spec §3.15)", () => {
  it("★ ALREADY_MEMBER does NOT touch the caller's role, and closes the invitation (I-9)", async () => {
    // The draft this replaced upserted the membership, which made "accept a
    // Staff invitation" a way for the last Owner to demote themselves and leave
    // the shop with zero Owners.
    const ownerRole = { id: "rol_owner", name: "Owner", key: "owner" };
    const ctx = createService({
      memberships: [member({ roleId: ownerRole.id })],
      roles: [ROLE_STAFF, ownerRole],
    });
    const error = await refusalOf(
      ctx.service.accept({ userId: USER_ID, token: RAW_TOKEN, now: NOW }),
    );
    expect(error.code).toBe("ALREADY_MEMBER");
    expect(error.getStatus()).toBe(409);
    expect(ctx.tx.membership.update).not.toHaveBeenCalled();
    expect(ctx.tx.membership.create).not.toHaveBeenCalled();
    expect(ctx.memberships[0].roleId).toBe(ownerRole.id);
    // …and the invitation does not stay `pending` offering a dead link.
    expect(ctx.invitations[0]).toMatchObject({ status: "cancelled", cancelledAt: NOW });
    expect(ctx.invitations[0].acceptedAt).toBeNull();
  });

  it("★ INVITATION_SUPERSEDED when the link predates the removal (I-1)", async () => {
    const ctx = createService({
      memberships: [
        member({ status: "revoked", revokedAt: new Date(ISSUED.getTime() + 60_000) }),
      ],
    });
    const error = await refusalOf(
      ctx.service.accept({ userId: USER_ID, token: RAW_TOKEN, now: NOW }),
    );
    expect(error.code).toBe("INVITATION_SUPERSEDED");
    expect(error.getStatus()).toBe(409);
    // A removed member must not walk back in, and nothing may be written while
    // refusing them.
    expect(ctx.memberships[0].status).toBe("revoked");
    expect(ctx.tx.membership.update).not.toHaveBeenCalled();
    expect(ctx.invitations[0].status).toBe("pending");
  });

  it("the exact instant counts as superseded — the safe side of a boundary", async () => {
    const ctx = createService({
      memberships: [member({ status: "revoked", revokedAt: new Date(ISSUED.getTime()) })],
    });
    expect(
      (await refusalOf(ctx.service.accept({ userId: USER_ID, token: RAW_TOKEN, now: NOW }))).code,
    ).toBe("INVITATION_SUPERSEDED");
  });

  it("★ the dead `invited` state is refused like a revocation, never accepted", async () => {
    const ctx = createService({ memberships: [member({ status: "invited", activatedAt: null })] });
    expect(
      (await refusalOf(ctx.service.accept({ userId: USER_ID, token: RAW_TOKEN, now: NOW }))).code,
    ).toBe("INVITATION_SUPERSEDED");
  });

  it("★ INVITATION_ROLE_UNAVAILABLE when the invited role is no longer this org's (M-6)", async () => {
    // Checked AT ACCEPT: F-003 lets a shop delete a role, and `ORG_PRISMA` makes
    // "deleted" and "belongs to another shop" the same answer by construction.
    const ctx = createService({ roles: [] });
    const error = await refusalOf(
      ctx.service.accept({ userId: USER_ID, token: RAW_TOKEN, now: NOW }),
    );
    expect(error.code).toBe("INVITATION_ROLE_UNAVAILABLE");
    expect(ctx.tx.membership.create).not.toHaveBeenCalled();
  });

  it("★ a mismatched account is 403 + details.emailMasked — never the address", async () => {
    const ctx = createService({ acceptorEmail: "somebody.else@example.com" });
    const error = await refusalOf(
      ctx.service.accept({ userId: USER_ID, token: RAW_TOKEN, now: NOW }),
    );
    expect(error.code).toBe("INVITATION_EMAIL_MISMATCH");
    expect(error.getStatus()).toBe(403);
    expect(error.details).toEqual({ emailMasked: "n***@example.com" });
    // Whoever is holding this link may not be its owner (§7.6): the mask is
    // enough to pick the right account, and not an address.
    expect(JSON.stringify(error.getResponse())).not.toContain(USER_EMAIL);
  });

  it("compares NORMALIZED addresses — case and padding are not a mismatch", async () => {
    const ctx = createService({ acceptorEmail: "  NAPA@Example.COM " });
    await expect(
      ctx.service.accept({ userId: USER_ID, token: RAW_TOKEN, now: NOW }),
    ).resolves.toMatchObject({ organization: { id: ORG_ID } });
  });

  it("★ ORDER: expired beats the email mismatch (the clock is checked first)", async () => {
    // Both are true. api-spec §3.15 fixes which one the user is told, because
    // each sends them somewhere different: "ask for a new link" vs "sign in with
    // the other account".
    const ctx = createService({
      located: invitation({ expiresAt: new Date(NOW.getTime() - 1) }),
      acceptorEmail: "somebody.else@example.com",
    });
    expect(
      (await refusalOf(ctx.service.accept({ userId: USER_ID, token: RAW_TOKEN, now: NOW }))).code,
    ).toBe("INVITATION_EXPIRED");
  });

  it("★ ORDER: the email mismatch beats role_unavailable, already_member and superseded", async () => {
    // The pure fn cannot answer the email question (it needs the authenticated
    // user, and it answers 403 rather than 409), so its slot is held here. All
    // three of these states would otherwise win.
    for (const options of [
      { roles: [] as never[] },
      { memberships: [member()] },
      { memberships: [member({ status: "revoked", revokedAt: new Date(ISSUED.getTime() + 1) })] },
    ]) {
      const ctx = createService({ ...options, acceptorEmail: "somebody.else@example.com" });
      expect(
        (await refusalOf(ctx.service.accept({ userId: USER_ID, token: RAW_TOKEN, now: NOW }))).code,
      ).toBe("INVITATION_EMAIL_MISMATCH");
    }
  });

  it("★ ORDER: expired beats already_member too (U-CD-04's mixed case)", async () => {
    const ctx = createService({
      located: invitation({ expiresAt: new Date(NOW.getTime() - 1) }),
      memberships: [member()],
    });
    const error = await refusalOf(
      ctx.service.accept({ userId: USER_ID, token: RAW_TOKEN, now: NOW }),
    );
    expect(error.code).toBe("INVITATION_EXPIRED");
    // …and because it lost, the ALREADY_MEMBER branch's write did NOT happen.
    expect(ctx.invitations[0].status).toBe("pending");
  });

  it("refuses with INTERNAL when the authenticated account no longer exists", async () => {
    // Better than joining a shop to a user id nothing can resolve.
    const ctx = createService({ acceptorExists: false });
    const error = await refusalOf(
      ctx.service.accept({ userId: USER_ID, token: RAW_TOKEN, now: NOW }),
    );
    expect(error.code).toBe("INTERNAL");
    expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("an unknown token never opens a transaction at all", async () => {
    const ctx = createService({ located: null });
    expect(
      (await refusalOf(ctx.service.accept({ userId: USER_ID, token: "nope", now: NOW }))).code,
    ).toBe("INVITATION_INVALID");
    expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
  });
});
