// F-003 · T-003-B15 ★ — OrgOwnershipGuard: the tx/DB wrapper around the pure
// `assertOwnerRemains` (architecture §2 "input contract" · §8).
//
// The rule itself is proven in core-domain (U-OI-*). What only this layer can
// get wrong is the INPUT: which memberships it reads, from which org, and how
// the refusal becomes a wire code. The fake tx below evaluates the `where` the
// guard sends (top-level `OR`, `roleId`, the `role` relation filter), so a
// guard that forgot the "∪ holders of the role being changed" half reads
// fewer rows and the union case turns red — it is not a canned answer.
import { describe, it, expect, vi, afterEach } from "vitest";
import { Logger } from "@nestjs/common";
import type { OwnerChange } from "@omnistock/core-domain";
import { DomainException } from "../common/domain-exception";
import { OrgContextStore } from "../tenancy";
import { OrgOwnershipGuard } from "./org-ownership.guard";

const ORG = "org_ctx";

interface Row {
  userId: string;
  roleId: string;
  status: "active" | "revoked";
  caps: string[];
  roleDeleted?: boolean;
}

type Where = Record<string, unknown>;

function matches(row: Row, where: Where): boolean {
  if (Array.isArray(where.OR)) return (where.OR as Where[]).some((w) => matches(row, w));
  if (typeof where.roleId === "string" && row.roleId !== where.roleId) return false;
  const role = where.role as Where | undefined;
  if (role) {
    if (role.organizationId !== ORG) return false;
    if ("deletedAt" in role && role.deletedAt === null && row.roleDeleted) return false;
    const has = (role.capabilities as { has?: string } | undefined)?.has;
    if (has && !row.caps.includes(has)) return false;
  }
  return true;
}

function harness(rows: Row[]) {
  const findMany = vi.fn(async (args: { where: Where }) =>
    rows
      .filter((r) => matches(r, args.where))
      .map((r) => ({
        userId: r.userId,
        roleId: r.roleId,
        status: r.status,
        role: { capabilities: r.caps },
      })),
  );
  const tx = { membership: { findMany } };
  const store = new OrgContextStore();
  const guard = new OrgOwnershipGuard(store);
  const run = (change: OwnerChange) =>
    store.run({ organizationId: ORG, userId: "usr_actor" }, () =>
      guard.assertOwnerRemainsInTx(tx as never, change),
    );
  return { guard, findMany, run, store, tx };
}

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof DomainException) return e.code;
    throw e;
  }
  return "OK";
}

const OWNER_A: Row = { userId: "a", roleId: "rol_owner", status: "active", caps: ["full_access"] };
const OWNER_B: Row = { userId: "b", roleId: "rol_owner", status: "active", caps: ["full_access"] };
const STAFF: Row = { userId: "s", roleId: "rol_staff", status: "active", caps: ["view_products"] };

afterEach(() => vi.restoreAllMocks());

describe("OrgOwnershipGuard.assertOwnerRemainsInTx — F-002 shapes", () => {
  it("role_change / revoke read live-role owners of THIS org through tx — no union branch", async () => {
    const h = harness([OWNER_A, STAFF]);
    expect(await codeOf(h.run({ kind: "revoke", userId: "a" }))).toBe("LAST_OWNER");
    expect(h.findMany.mock.calls[0]![0].where).toEqual({
      role: { organizationId: ORG, deletedAt: null, capabilities: { has: "full_access" } },
    });
  });

  it("control: revoking a non-owner passes", async () => {
    const h = harness([OWNER_A, STAFF]);
    expect(await codeOf(h.run({ kind: "revoke", userId: "s" }))).toBe("OK");
  });
});

describe("OrgOwnershipGuard — shapes 3/4 (architecture §2 input contract)", () => {
  it("★ owners ∪ every holder of the role being changed are read (top-level OR on roleId)", async () => {
    const h = harness([OWNER_A, STAFF]);
    await h.run({ kind: "role_delete", roleId: "rol_staff" });
    expect(h.findMany.mock.calls[0]![0].where).toEqual({
      OR: [
        { role: { organizationId: ORG, deletedAt: null, capabilities: { has: "full_access" } } },
        { roleId: "rol_staff", role: { organizationId: ORG } },
      ],
    });
  });

  it("★ the union matters: a role GAINING full_access counts its holders (red if only owners were read)", async () => {
    // The org has no active Owner today (A revoked). Giving rol_staff full_access
    // makes S an Owner — only visible if S's row was read at all.
    const h = harness([{ ...OWNER_A, status: "revoked" }, STAFF]);
    const change: OwnerChange = {
      kind: "role_capabilities_change",
      roleId: "rol_staff",
      newCapabilities: ["full_access"],
    };
    expect(await codeOf(h.run(change))).toBe("OK");
  });

  it("★ two Owners on the same role, full_access removed from that role → 409 LAST_OWNER", async () => {
    const h = harness([OWNER_A, OWNER_B, STAFF]);
    const change: OwnerChange = {
      kind: "role_capabilities_change",
      roleId: "rol_owner",
      newCapabilities: ["manage_members"],
    };
    expect(await codeOf(h.run(change))).toBe("LAST_OWNER");
  });

  it("★ deleting the sole Owner's role → LAST_OWNER + error log `role_invariant_violation` (§8)", async () => {
    const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const h = harness([OWNER_A, STAFF]);
    expect(await codeOf(h.run({ kind: "role_delete", roleId: "rol_owner" }))).toBe("LAST_OWNER");
    expect(error).toHaveBeenCalledTimes(1);
    const line = String(error.mock.calls[0]![0]);
    expect(line).toContain("role_invariant_violation");
    expect(JSON.parse(line.slice(line.indexOf("{")))).toEqual({
      operation: "role_delete",
      organizationId: ORG,
      roleId: "rol_owner",
    });
  });

  it("member-path refusals are ordinary (no role_invariant_violation log)", async () => {
    const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const h = harness([OWNER_A]);
    expect(await codeOf(h.run({ kind: "revoke", userId: "a" }))).toBe("LAST_OWNER");
    expect(error).not.toHaveBeenCalled();
  });

  it("control: deleting a role no Owner holds passes", async () => {
    const h = harness([OWNER_A, STAFF]);
    expect(await codeOf(h.run({ kind: "role_delete", roleId: "rol_staff" }))).toBe("OK");
  });
});

describe("OrgOwnershipGuard — fail loud", () => {
  it("no org context ⇒ INTERNAL, and nothing is read", async () => {
    const h = harness([OWNER_A]);
    expect(
      await codeOf(h.guard.assertOwnerRemainsInTx(h.tx as never, { kind: "revoke", userId: "s" })),
    ).toBe("INTERNAL");
    expect(h.findMany).not.toHaveBeenCalled();
  });

  it("a DB error is rethrown as-is, never read as 'owners remain'", async () => {
    const h = harness([OWNER_A]);
    h.findMany.mockRejectedValueOnce(new Error("connection reset"));
    await expect(h.run({ kind: "revoke", userId: "s" })).rejects.toThrow("connection reset");
  });
});
