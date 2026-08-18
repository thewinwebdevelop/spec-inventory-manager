// F-002 · T-002-02 ★ — DB-BACKED proof of `withOrgScope` against a real
// Postgres. Requires TEST_DATABASE_URL (or DATABASE_URL); skipped otherwise so
// the pure-unit suite still runs everywhere.
//
// WHY THIS FILE EXISTS (security-review M-9): architecture §2.2 makes claims
// about PRISMA'S RUNTIME — "extendedWhereUnique makes another org's row look
// like P2025", "upsert scopes both the lookup and the insert". Those are
// unverifiable claims until a real database answers them; a probe extension can
// only prove what we SENT, never what Postgres DID. Every row of §2.2 that
// touches an existing row of another org is proven here, row by row.
//
// It also pins two behaviours we depend on but do not control:
//   - `$transaction` (callback AND array form) inherits the extension, so org
//     scoping survives inside a transaction. If Prisma ever changes that, this
//     goes red instead of silently leaking.
//   - the C-3 / NEW-8 nested-read gap is REAL (a relation walk through `User`
//     returns other orgs' rows) — pinned so nobody "discovers" later that the
//     extension was supposed to cover it. USER_SELECT (U-DB-11) is the fix.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "../generated/client";
import { withOrgScope, OrgScopeViolationError } from "./tenancy";
import { USER_SELECT } from "./user-select";

// Gate on TEST_DATABASE_URL only — the same convention as apps/api's
// *.int.test.ts. NOT on DATABASE_URL: importing the generated client loads the
// repo's .env, so DATABASE_URL is almost always set (often at a stale port) and
// gating on it would turn "no test database configured" into a confusing
// connection error instead of an honest skip.
const TEST_DB = process.env.TEST_DATABASE_URL;
const d = TEST_DB ? describe : describe.skip;

if (!TEST_DB) {
  // Loud, not silent: a skipped tenancy proof must be visible in the log, or
  // "the suite was green" quietly stops meaning "the isolation was proven".
  console.warn(
    "[T-002-02] SKIPPING the DB-backed withOrgScope proof (M-9): TEST_DATABASE_URL is not set. " +
      "The extendedWhereUnique + upsert + $transaction claims are NOT verified in this run.",
  );
}

const TAG = `t002-02-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

d("withOrgScope against a real database (M-9 — row by row)", () => {
  let base: PrismaClient;
  let scoped: ReturnType<typeof withOrgScope<PrismaClient>>;
  let orgA: string;
  let orgB: string;
  let roleA: string;
  let roleB: string;

  const newUser = async () =>
    (await base.user.create({ data: { email: `${TAG}-${Math.random().toString(36).slice(2)}@t.co`, passwordHash: "x" } }))
      .id;

  /** A membership row that belongs to `org` — the "other org's row" under test. */
  async function seedMembership(org: string, role: string) {
    return base.membership.create({ data: { organizationId: org, userId: await newUser(), roleId: role, status: "active" } });
  }

  beforeAll(async () => {
    // vitest still runs the hooks of a skipped suite — without this guard the
    // file would try (and fail) to reach a database in DB-less CI lanes.
    if (!TEST_DB) return;
    base = new PrismaClient({ datasources: { db: { url: TEST_DB } } });
    await base.$connect();
    orgA = (await base.organization.create({ data: { name: `${TAG}-A` } })).id;
    orgB = (await base.organization.create({ data: { name: `${TAG}-B` } })).id;
    roleA = (await base.role.create({ data: { organizationId: orgA, name: "Owner", key: "owner", capabilities: ["full_access"] } })).id;
    roleB = (await base.role.create({ data: { organizationId: orgB, name: "Owner", key: "owner", capabilities: ["full_access"] } })).id;
    scoped = withOrgScope(base, { organizationId: orgA });
  });

  afterAll(async () => {
    if (!TEST_DB || !base) return;
    await base.membership.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    // Invitations reference Role, so they must go first or `role.deleteMany`
    // fails on the FK and leaves this suite's rows behind — which is how a
    // cross-org row from the B-1 case survived a run and turned up in a scan.
    await base.invitation.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await base.role.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await base.user.deleteMany({ where: { email: { startsWith: TAG } } });
    await base.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await base.$disconnect();
  });

  // ── reads ────────────────────────────────────────────────────────────────

  it("findMany / findFirst / count / aggregate / groupBy see only the ctx org", async () => {
    const a = await seedMembership(orgA, roleA);
    const b = await seedMembership(orgB, roleB);

    const rows = await scoped.membership.findMany({ where: { status: "active" } });
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(a.id);
    expect(ids).not.toContain(b.id);
    expect(rows.every((r) => r.organizationId === orgA)).toBe(true);

    expect(await scoped.membership.findFirst({ where: { id: b.id } })).toBeNull();
    expect(await scoped.membership.count()).toBe(await base.membership.count({ where: { organizationId: orgA } }));

    const agg = await scoped.membership.aggregate({ _count: { _all: true } });
    expect(agg._count._all).toBe(await base.membership.count({ where: { organizationId: orgA } }));

    const grouped = await scoped.membership.groupBy({ by: ["organizationId"], _count: { _all: true } });
    expect(grouped.map((g) => g.organizationId)).toEqual([orgA]);
  });

  it("findUnique on another org's row returns null (extendedWhereUnique)", async () => {
    const b = await seedMembership(orgB, roleB);
    expect(await scoped.membership.findUnique({ where: { id: b.id } })).toBeNull();
    // …and the row is genuinely there for the unscoped client.
    expect(await base.membership.findUnique({ where: { id: b.id } })).not.toBeNull();
  });

  it("findUniqueOrThrow / findFirstOrThrow give the SAME P2025 as a row that never existed (no existence oracle — I-5)", async () => {
    const b = await seedMembership(orgB, roleB);
    const foreign = await scoped.membership.findUniqueOrThrow({ where: { id: b.id } }).catch((e) => e);
    const absent = await scoped.membership.findUniqueOrThrow({ where: { id: "cl_does_not_exist_00000000" } }).catch((e) => e);
    expect(foreign).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((foreign as Prisma.PrismaClientKnownRequestError).code).toBe("P2025");
    expect((absent as Prisma.PrismaClientKnownRequestError).code).toBe("P2025");
    expect((foreign as Error).message).toBe((absent as Error).message);

    const first = await scoped.membership.findFirstOrThrow({ where: { id: b.id } }).catch((e) => e);
    expect((first as Prisma.PrismaClientKnownRequestError).code).toBe("P2025");
  });

  // ── writes on another org's row ──────────────────────────────────────────

  it("update on another org's row fails with P2025 and leaves the row untouched", async () => {
    const b = await seedMembership(orgB, roleB);
    const err = await scoped.membership.update({ where: { id: b.id }, data: { status: "revoked" } }).catch((e) => e);
    expect((err as Prisma.PrismaClientKnownRequestError).code).toBe("P2025");
    expect((await base.membership.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("active");
  });

  it("delete on another org's row fails with P2025 and the row survives", async () => {
    const b = await seedMembership(orgB, roleB);
    const err = await scoped.membership.delete({ where: { id: b.id } }).catch((e) => e);
    expect((err as Prisma.PrismaClientKnownRequestError).code).toBe("P2025");
    expect(await base.membership.findUnique({ where: { id: b.id } })).not.toBeNull();
  });

  it("updateMany / deleteMany never reach across the tenant boundary", async () => {
    const a = await seedMembership(orgA, roleA);
    const b = await seedMembership(orgB, roleB);

    await scoped.membership.updateMany({ where: { status: "active" }, data: { status: "revoked" } });
    expect((await base.membership.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("revoked");
    expect((await base.membership.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("active");

    const del = await scoped.membership.deleteMany({ where: { status: "revoked" } });
    expect(del.count).toBeGreaterThanOrEqual(1);
    expect(await base.membership.findUnique({ where: { id: a.id } })).toBeNull();
    expect(await base.membership.findUnique({ where: { id: b.id } })).not.toBeNull();
  });

  // ── creates ──────────────────────────────────────────────────────────────

  it("create / createMany / createManyAndReturn land in the ctx org without the caller saying so", async () => {
    const created = await scoped.membership.create({ data: { userId: await newUser(), roleId: roleA } as never });
    expect(created.organizationId).toBe(orgA);

    const many = await scoped.membership.createMany({
      data: [
        { userId: await newUser(), roleId: roleA },
        { userId: await newUser(), roleId: roleA },
      ] as never,
    });
    expect(many.count).toBe(2);

    const returned = await scoped.membership.createManyAndReturn({
      data: [{ userId: await newUser(), roleId: roleA }] as never,
    });
    expect(returned.every((r) => r.organizationId === orgA)).toBe(true);
  });

  // ── upsert: the M-9 crux ─────────────────────────────────────────────────

  it("upsert UPDATES the ctx org's row when it exists (where + create both scoped)", async () => {
    const a = await seedMembership(orgA, roleA);
    const before = await base.membership.count({ where: { organizationId: orgA } });

    const out = await scoped.membership.upsert({
      where: { organizationId_userId: { organizationId: orgA, userId: a.userId } } as never,
      update: { status: "revoked" },
      create: { userId: a.userId, roleId: roleA, status: "active" } as never,
    });

    expect(out.id).toBe(a.id);
    expect(out.status).toBe("revoked");
    expect(await base.membership.count({ where: { organizationId: orgA } })).toBe(before);
  });

  it("★ upsert targeting a row that belongs to ANOTHER org neither reads nor writes it — it creates in the ctx org", async () => {
    // The exact M-9 doubt: `upsert`'s `where` is a WhereUniqueInput, and the
    // question was whether the injected non-unique `organizationId` really
    // participates in the "does the row exist?" decision. Answer (verified
    // here, on Postgres): yes — org B's row stays invisible AND untouched, and
    // the fallback insert lands in org A because `create` is scoped too.
    const b = await seedMembership(orgB, roleB);
    const bBefore = await base.membership.findUniqueOrThrow({ where: { id: b.id } });

    const out = await scoped.membership.upsert({
      where: { organizationId_userId: { organizationId: orgA, userId: b.userId } } as never,
      update: { status: "revoked" },
      create: { userId: b.userId, roleId: roleA, status: "active" } as never,
    });

    expect(out.id).not.toBe(b.id);
    expect(out.organizationId).toBe(orgA); // create was scoped to ctx …
    expect(out.status).toBe("active"); // … i.e. it INSERTED, it did not update B

    const bAfter = await base.membership.findUniqueOrThrow({ where: { id: b.id } });
    expect(bAfter.status).toBe(bBefore.status);
    expect(bAfter.organizationId).toBe(orgB);
    expect(bAfter.updatedAt.getTime()).toBe(bBefore.updatedAt.getTime()); // not written at all
  });

  it("upsert by id of another org's row does not update it either", async () => {
    const b = await seedMembership(orgB, roleB);
    const out = await scoped.membership.upsert({
      where: { id: b.id },
      update: { status: "revoked" },
      create: { userId: await newUser(), roleId: roleA, status: "active" } as never,
    });
    expect(out.id).not.toBe(b.id);
    expect(out.organizationId).toBe(orgA);
    expect((await base.membership.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("active");
  });

  // ── nested write: not scoped, and provably NOT silent ────────────────────

  it("a nested write to another model fails loudly instead of creating an unscoped row (§2.2)", async () => {
    // The extension injects into the TOP-LEVEL model only, so F-002's rule is
    // "no nested writes — use sequential creates in one transaction". This pins
    // the safety net behind the rule: the nested row has no organizationId, and
    // nothing anywhere accepts that silently.
    const before = await base.role.count({ where: { organizationId: orgA } });
    const err = await scoped.membership
      .create({
        data: {
          userId: await newUser(),
          role: { create: { name: `nested-${Date.now()}`, capabilities: [] } },
        } as never,
      })
      .catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect(await base.role.count({ where: { organizationId: orgA } })).toBe(before);
    expect(await base.role.count({ where: { name: { startsWith: "nested-" } } })).toBe(0);
  });

  // ── explicit cross-org attempt ───────────────────────────────────────────

  it("an explicit foreign organizationId is refused before it reaches the database", async () => {
    await expect(scoped.membership.findMany({ where: { organizationId: orgB } })).rejects.toThrow(OrgScopeViolationError);
    await expect(
      scoped.membership.create({ data: { organizationId: orgB, userId: await newUser(), roleId: roleB } }),
    ).rejects.toThrow(OrgScopeViolationError);
  });

  // ── U-DB-10: $transaction inherits the extension ─────────────────────────

  it("U-DB-10 · $transaction (callback form) keeps org scoping inside the transaction", async () => {
    const b = await seedMembership(orgB, roleB);
    const result = await scoped.$transaction(async (tx) => {
      const created = await tx.membership.create({ data: { userId: await newUser(), roleId: roleA } as never });
      const leak = await tx.membership.findUnique({ where: { id: b.id } });
      const all = await tx.membership.findMany({});
      return { created, leak, all };
    });
    expect(result.created.organizationId).toBe(orgA);
    expect(result.leak).toBeNull();
    expect(result.all.every((r) => r.organizationId === orgA)).toBe(true);
  });

  it("U-DB-10 · $transaction (array form) keeps org scoping too", async () => {
    const b = await seedMembership(orgB, roleB);
    const [rows, foreign] = await scoped.$transaction([
      scoped.membership.findMany({}),
      scoped.membership.findUnique({ where: { id: b.id } }),
    ]);
    expect(rows.every((r) => r.organizationId === orgA)).toBe(true);
    expect(foreign).toBeNull();
  });

  // ── B-1: a FOREIGN KEY is what stops a cross-org role, not a service `if`

  it("★ B-1 · the database refuses a Role from ANOTHER org on a scoped update", async () => {
    // Security review B-1. `withOrgScope` guards the `organizationId` COLUMN,
    // so it correctly pins `where.organizationId` — but it never looks at
    // `data.roleId`. Writing another org's role onto a membership therefore
    // succeeded, and since roles carry `capabilities`, the role written could
    // be one holding `full_access`: an Owner of shop A, minted from shop B's
    // role row.
    //
    // Every F-002 write path happens to resolve the role through a scoped
    // `tx` first, so this was not exploitable over HTTP. That is a property of
    // four call sites agreeing, not a property of the data — and the comment
    // in members.service.ts claiming it was "impossible by construction"
    // described an `if`, which is precisely the kind of guard that the fifth
    // call site forgets.
    //
    // The fix is a composite foreign key `(organizationId, roleId)` →
    // `Role(organizationId, id)`. Postgres then refuses the pair outright, and
    // no service has to remember anything.
    const membership = await base.membership.create({
      data: { organizationId: orgA, userId: await newUser(), roleId: roleA, status: "active" },
    });

    await expect(
      scoped.membership.update({ where: { id: membership.id }, data: { roleId: roleB } }),
    ).rejects.toThrow();

    // …and the row did not move. A rejection that had already written would be
    // the same bug wearing an error message.
    const after = await base.membership.findUniqueOrThrow({
      where: { id: membership.id },
      select: { roleId: true },
    });
    expect(after.roleId).toBe(roleA);
  });

  it("★ B-1 · the same guard covers Invitation, and still allows the SAME org's role", async () => {
    // Invitation carries a `roleId` for exactly the same reason and had exactly
    // the same hole. The second half matters as much as the first: a
    // constraint that also refuses legitimate writes is not a fix.
    const own = await scoped.invitation.create({
      data: {
        organizationId: orgA,
        email: `${TAG}-fk@t.co`,
        roleId: roleA,
        tokenHash: `${TAG}-hash-ok`,
        tokenIssuedAt: new Date(),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    expect(own.roleId).toBe(roleA);

    await expect(
      scoped.invitation.update({ where: { id: own.id }, data: { roleId: roleB } }),
    ).rejects.toThrow();
  });

  it("★ B-1 · a nested `connect` is refused by the SEAM — the FK cannot catch it", async () => {
    // This one is worse than the scalar case, and the composite FK does not
    // close it — it CHANGES it. With `Membership.role` referencing
    // `Role(organizationId, id)`, `connect: { id: <org B's role> }` makes
    // Prisma set BOTH columns from the connected row: the membership moves to
    // org B entirely. The resulting pair is a valid foreign key; it just
    // belongs to somebody else. And `data.organizationId` was never written,
    // so the seam's column check never saw it.
    //
    // Measured, not assumed: with the FK in place and this guard removed, the
    // row came back with `organizationId` = org B.
    const membership = await base.membership.create({
      data: { organizationId: orgA, userId: await newUser(), roleId: roleA, status: "active" },
    });

    await expect(
      scoped.membership.update({
        where: { id: membership.id },
        data: { role: { connect: { id: roleB } } },
      }),
    ).rejects.toBeInstanceOf(OrgScopeViolationError);

    const after = await base.membership.findUniqueOrThrow({
      where: { id: membership.id },
      select: { organizationId: true, roleId: true },
    });
    expect(after.organizationId).toBe(orgA);
    expect(after.roleId).toBe(roleA);
  });

  it("★ B-1 · the nested-write refusal does not break a scalar-list write", async () => {
    // `set` is excluded from the refused verbs on purpose: `capabilities` is a
    // scalar list and uses the same word. A guard that blocked it would be
    // trading one broken write for another.
    const role = await scoped.role.create({
      data: { organizationId: orgA, name: `${TAG}-scalarlist`, capabilities: ["view_products"] },
    });
    const updated = await scoped.role.update({
      where: { id: role.id },
      data: { capabilities: { set: ["view_products", "manage_members"] } },
    });
    expect(updated.capabilities).toEqual(["view_products", "manage_members"]);
  });

  // ── C-3 / NEW-8: the nested-read gap is real (that is why USER_SELECT exists)

  it("C-3/NEW-8 · a relation walk through User DOES return other orgs' rows — the gap USER_SELECT closes", async () => {
    const user = await base.user.create({ data: { email: `${TAG}-multi@t.co`, passwordHash: "secret-hash" } });
    await base.membership.create({ data: { organizationId: orgA, userId: user.id, roleId: roleA, status: "active" } });
    await base.membership.create({ data: { organizationId: orgB, userId: user.id, roleId: roleB, status: "active" } });

    // The forbidden shape (test-plan I-35(b)) — proven to leak, hence banned by
    // rule, by the grep gate, and structurally by USER_SELECT.
    const leaky = await scoped.membership.findMany({
      where: { userId: user.id },
      select: { id: true, user: { select: { memberships: { select: { organizationId: true } } } } },
    });
    const orgsSeen = new Set(leaky.flatMap((m) => m.user.memberships.map((x) => x.organizationId)));
    expect(orgsSeen.has(orgB)).toBe(true); // ← the leak, pinned deliberately

    // The sanctioned shape cannot express it: USER_SELECT has no relation keys,
    // so the same query through it stays inside the ctx org and carries no
    // passwordHash (C-4).
    const safe = await scoped.membership.findMany({
      where: { userId: user.id },
      select: { id: true, organizationId: true, user: { select: USER_SELECT } },
    });
    expect(safe.every((m) => m.organizationId === orgA)).toBe(true);
    expect(Object.keys(safe[0].user).sort()).toEqual(["createdAt", "email", "id"]);
    expect(JSON.stringify(safe)).not.toContain("secret-hash");
  });
});
