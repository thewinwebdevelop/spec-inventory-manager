// F-002 · T-002-16 ★ — `GET /me/organizations` (api-spec §3.2).
//
// This service holds the UNFILTERED client, so the property under test is not
// "does it return the right rows" but "can it ever build a query that is not
// bound to this caller". Every case therefore inspects the `where` that was
// SENT, not only the rows that came back: a double can be made to return the
// right thing for the wrong query, and that is precisely the bug.
import { describe, it, expect, vi } from "vitest";
import { decodeCursor, encodeCursor } from "../../common/cursor";
import { MyOrganizationsService } from "./my-organizations.service";

const USER_ID = "usr_me";

function row(over: Partial<{ id: string; status: string; createdAt: Date; revokedAt: Date | null }> = {}) {
  return {
    id: over.id ?? "mem_1",
    createdAt: over.createdAt ?? new Date("2026-07-28T09:00:00.000Z"),
    status: over.status ?? "active",
    revokedAt: over.revokedAt ?? null,
    roleId: "rol_1",
    role: { name: "Owner", key: "owner" },
    organization: {
      id: "org_1",
      name: "ร้าน ก",
      logo: null,
      entitlement: { planDefinition: { key: "comp_full", tierLabel: "Full (comp)" } },
    },
  };
}

function createService(rows: ReturnType<typeof row>[] = [row()]) {
  const findMany = vi.fn(async (_args: unknown) => rows);
  const prisma = { membership: { findMany } };
  return { service: new MyOrganizationsService(prisma as never), findMany };
}

type Recorded = { mock: { calls: unknown[][] } };

function firstArg<T>(fn: unknown): T {
  return (fn as Recorded).mock.calls[0][0] as T;
}

function whereOf(findMany: unknown): Record<string, unknown> {
  return firstArg<{ where: Record<string, unknown> }>(findMany).where;
}

describe("★ every query is bound to the caller", () => {
  it("filters by userId — always", async () => {
    const { service, findMany } = createService();
    await service.list({ userId: USER_ID, status: "active", limit: 25 });
    expect(whereOf(findMany).userId).toBe(USER_ID);
  });

  it("★ filters by userId even for `status=all`", async () => {
    // `all` widens the STATUS, never the owner of the rows.
    const { service, findMany } = createService();
    await service.list({ userId: USER_ID, status: "all", limit: 25 });
    expect(whereOf(findMany).userId).toBe(USER_ID);
  });

  it("★ starts the query at Membership, never at User (rule C-3)", async () => {
    // A query starting at `User` and including `memberships` gets NO org
    // filtering anywhere in the tree — and the rows that leak belong to a THIRD
    // org, which a "call it with org B's token" test cannot see.
    const { service, findMany } = createService();
    await service.list({ userId: USER_ID, status: "active", limit: 25 });
    const args = firstArg<{ select: Record<string, unknown> }>(findMany);
    expect(args.select).not.toHaveProperty("user");
    expect(JSON.stringify(args.select)).not.toContain("memberships");
  });

  it("★ uses `select` everywhere — never `include` (C-4)", async () => {
    const { service, findMany } = createService();
    await service.list({ userId: USER_ID, status: "active", limit: 25 });
    expect(firstArg(findMany)).not.toHaveProperty("include");
  });
});

describe("status filter — AC US-5 / D-027", () => {
  it("default `active` is a WHERE clause, not a post-filter", async () => {
    // "Gone from the switcher on the very next request" cannot be delivered by
    // filtering after the fact, or by a cache with any TTL at all.
    const { service, findMany } = createService();
    await service.list({ userId: USER_ID, status: "active", limit: 25 });
    expect(whereOf(findMany).status).toBe("active");
  });

  it("`all` sends no status clause", async () => {
    const { service, findMany } = createService();
    await service.list({ userId: USER_ID, status: "all", limit: 25 });
    expect(whereOf(findMany)).not.toHaveProperty("status");
  });

  it("★ a revoked row comes back in the SHORT shape (M-10)", async () => {
    const { service } = createService([
      row({ status: "revoked", revokedAt: new Date("2026-07-29T00:00:00.000Z") }),
    ]);
    const page = await service.list({ userId: USER_ID, status: "all", limit: 25 });
    expect(page.items[0]).toEqual({
      organization: { id: "org_1", name: "ร้าน ก", logo: null },
      membership: { status: "revoked", revokedAt: "2026-07-29T00:00:00.000Z" },
    });
  });

  it("an active row comes back in the full shape", async () => {
    const { service } = createService();
    const page = await service.list({ userId: USER_ID, status: "active", limit: 25 });
    expect(page.items[0]).toEqual({
      organization: { id: "org_1", name: "ร้าน ก", logo: null },
      membership: { roleId: "rol_1", roleName: "Owner", roleKey: "owner", status: "active" },
      entitlement: { planKey: "comp_full", tierLabel: "Full (comp)" },
    });
  });

  it("an org with no entitlement yields `entitlement: null`, not a crash", async () => {
    const broken = row();
    const page = await createService([
      { ...broken, organization: { ...broken.organization, entitlement: null } },
    ] as never).service.list({ userId: USER_ID, status: "active", limit: 25 });
    expect(page.items[0]).toMatchObject({ entitlement: null });
  });
});

describe("pagination (api-spec §1)", () => {
  it("sorts `createdAt desc, id desc` — fixed, not client-chosen", async () => {
    const { service, findMany } = createService();
    await service.list({ userId: USER_ID, status: "active", limit: 25 });
    const args = firstArg<{ orderBy: unknown }>(findMany);
    expect(args.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  });

  it("over-fetches by exactly one so `nextCursor: null` is honest", async () => {
    const { service, findMany } = createService();
    await service.list({ userId: USER_ID, status: "active", limit: 25 });
    expect(firstArg<{ take: number }>(findMany).take).toBe(26);
  });

  it("★ the keyset predicate is a strict `<` on (createdAt, id)", async () => {
    const cursor = { createdAt: "2026-07-28T09:00:00.000Z", id: "mem_9" };
    const { service, findMany } = createService();
    await service.list({ userId: USER_ID, status: "active", limit: 25, cursor });
    expect(whereOf(findMany).OR).toEqual([
      { createdAt: { lt: new Date(cursor.createdAt) } },
      { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
    ]);
    // The tiebreaker matters: without the second clause, rows sharing a
    // timestamp are skipped; without the first, paging never advances.
  });

  it("returns a cursor pointing at the last returned row", async () => {
    const rows = [
      row({ id: "mem_1", createdAt: new Date("2026-07-28T09:00:00.000Z") }),
      row({ id: "mem_2", createdAt: new Date("2026-07-27T09:00:00.000Z") }),
      row({ id: "mem_3", createdAt: new Date("2026-07-26T09:00:00.000Z") }),
    ];
    const { service } = createService(rows);
    const page = await service.list({ userId: USER_ID, status: "active", limit: 2 });
    expect(page.items).toHaveLength(2);
    expect(decodeCursor(page.nextCursor)).toEqual({
      createdAt: "2026-07-27T09:00:00.000Z",
      id: "mem_2",
    });
  });

  it("round-trips: the cursor it emits is one it accepts", async () => {
    const emitted = encodeCursor({ createdAt: "2026-07-28T09:00:00.000Z", id: "mem_2" });
    const { service, findMany } = createService();
    await service.list({
      userId: USER_ID,
      status: "active",
      limit: 25,
      cursor: decodeCursor(emitted)!,
    });
    expect(whereOf(findMany)).toHaveProperty("OR");
  });
});
