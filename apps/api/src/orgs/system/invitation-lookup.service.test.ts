// F-002 · T-002-20 ★ — the §2.4 conditions on the invitation lookup, enforced.
//
// This file holds the Prisma client with NO tenant filter. Architecture §2.4
// attaches four conditions to every method in `system/`, and three of them are
// properties of the QUERY rather than of the result — so they are asserted on
// the arguments the delegate was called with, which is the only place they are
// observable.
//
// The fourth condition (ง — "reads no `X-Organization-Id`") is structural: this
// class has no request, no ALS read and no org parameter. The test for it is the
// absence of anything to test, plus `invitation-redemption.service.test.ts`,
// which drives the whole path with a foreign org context established and proves
// the write still lands in the invitation's shop.
import { describe, it, expect, vi } from "vitest";
import { USER_SELECT } from "../../tenancy";
import { InvitationLookupService } from "./invitation-lookup.service";

const ROW = {
  id: "inv_1",
  organizationId: "org_1",
  email: "napa@example.com",
  roleId: "rol_staff",
  status: "pending",
  expiresAt: new Date("2026-08-08T10:00:00.000Z"),
  tokenIssuedAt: new Date("2026-08-01T10:00:00.000Z"),
  organization: { name: "ร้าน A" },
  role: { name: "Staff", key: "staff" },
};

function subject(over: { invitation?: unknown; user?: unknown } = {}) {
  const invitationFindUnique = vi.fn(async (_args: unknown) =>
    over.invitation === undefined ? ROW : over.invitation,
  );
  const userFindUnique = vi.fn(async (_args: unknown) =>
    over.user === undefined
      ? { id: "usr_1", email: "napa@example.com", createdAt: new Date("2026-07-01T00:00:00.000Z") }
      : over.user,
  );
  const prisma = {
    invitation: { findUnique: invitationFindUnique },
    user: { findUnique: userFindUnique },
  };
  return {
    service: new InvitationLookupService(prisma as never),
    invitationFindUnique,
    userFindUnique,
  };
}

describe("InvitationLookupService.findByTokenHash (§2.4 row 3)", () => {
  it("★ (ก) the query is keyed by the token hash — the scope limiter, always", async () => {
    const ctx = subject();
    await ctx.service.findByTokenHash("hash-abc");
    const args = ctx.invitationFindUnique.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(args.where).toEqual({ tokenHash: "hash-abc" });
    // Exactly one key. An `OR`, a `contains`, or an id fallback would turn a
    // unique lookup into a SEARCH over invitations — the enumeration surface the
    // whole design avoids (§7.3).
    expect(Object.keys(args.where)).toHaveLength(1);
  });

  it("★ never selects `tokenHash` back — the stored secret does not travel", async () => {
    const ctx = subject();
    await ctx.service.findByTokenHash("hash-abc");
    const args = ctx.invitationFindUnique.mock.calls[0][0] as { select: Record<string, unknown> };
    expect(args.select).not.toHaveProperty("tokenHash");
    // …and every relation is an explicit `select`, never an `include` (C-4): an
    // `include` of `organization` would return the shop's TAX ID to a public
    // endpoint.
    expect(args).not.toHaveProperty("include");
    expect(args.select.organization).toEqual({ select: { name: true } });
    expect(args.select.role).toEqual({ select: { name: true, key: true } });
  });

  it("★ projects field by field — a column added to the select cannot ride out", async () => {
    const ctx = subject({
      invitation: { ...ROW, tokenHash: "SECRET", organization: { name: "ร้าน A", taxId: "0105551234567" }, role: { name: "Staff", key: "staff" } },
    });
    const result = await ctx.service.findByTokenHash("hash-abc");
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("SECRET");
    expect(serialized).not.toContain("0105551234567");
    expect(Object.keys(result!).sort()).toEqual([
      "email",
      "expiresAt",
      "id",
      "organizationId",
      "organizationName",
      "roleId",
      "roleKey",
      "roleName",
      "status",
      "tokenIssuedAt",
    ]);
  });

  it("returns null for an unknown hash — the caller turns that into ONE 404", async () => {
    const ctx = subject({ invitation: null });
    expect(await ctx.service.findByTokenHash("nope")).toBeNull();
  });

  it("flattens the relations without losing a null role key (ux Q4)", async () => {
    const ctx = subject({ invitation: { ...ROW, role: { name: "หัวหน้าคลัง", key: null } } });
    const result = await ctx.service.findByTokenHash("hash-abc");
    expect(result).toMatchObject({ roleName: "หัวหน้าคลัง", roleKey: null, organizationName: "ร้าน A" });
  });
});

describe("InvitationLookupService.findAcceptor (§2.4 (ก))", () => {
  it("★ is keyed by the caller's OWN id and reads through USER_SELECT", async () => {
    const ctx = subject();
    await ctx.service.findAcceptor("usr_1");
    expect(ctx.userFindUnique.mock.calls[0][0]).toEqual({
      where: { id: "usr_1" },
      // The frozen projection: no relation keys, so the "walk through User back
      // down into another org's memberships" shape (NEW-8) is unexpressible, and
      // `passwordHash` is not selectable (C-4).
      select: USER_SELECT,
    });
  });

  it("★ the projection cannot be widened from here", async () => {
    // `USER_SELECT` is frozen; if this ever stops throwing in strict mode the
    // whole NEW-8 argument is only a convention again.
    expect(Object.isFrozen(USER_SELECT)).toBe(true);
    expect(Object.keys(USER_SELECT).sort()).toEqual(["createdAt", "email", "id"]);
  });

  it("returns the three fields the accept path needs, and only those", async () => {
    const ctx = subject();
    const acceptor = await ctx.service.findAcceptor("usr_1");
    expect(Object.keys(acceptor!).sort()).toEqual(["createdAt", "email", "id"]);
  });

  it("returns null when the account is gone (deleted mid-request)", async () => {
    const ctx = subject({ user: null });
    expect(await ctx.service.findAcceptor("usr_1")).toBeNull();
  });
});

describe("★ (ง) nothing here can read an organization from the request", () => {
  it("neither method takes an organizationId, and there is no request to read one from", () => {
    // Arity is the crude version of the argument; the real one is that the only
    // parameters in this file are a token hash and a user id (§2.4 (ก)).
    expect(InvitationLookupService.prototype.findByTokenHash).toHaveLength(1);
    expect(InvitationLookupService.prototype.findAcceptor).toHaveLength(1);
  });
});
