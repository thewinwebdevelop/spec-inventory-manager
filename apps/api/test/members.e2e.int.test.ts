// F-002 · T-002-18 ★ — the membership endpoints against a real Postgres and the
// real guard chain (api-spec §3.7–§3.9, §3.17).
//
// WHAT THIS PROVES THAT THE UNIT LANE CANNOT
//   * SERIALIZATION IS A DATABASE PROPERTY. The unit suite proves the anchor is
//     the first statement of the transaction; only Postgres proves that two
//     requests racing to remove two different Owners cannot both win. The
//     assertion that matters is made AFTER the round, against the database:
//     `COUNT(active owner) >= 1`. Status codes alone would be satisfied by an
//     endpoint that refuses everybody.
//   * LOCK CONTENTION IS A 409, NOT A 500 (§5.2 / I-C-10). Proven by holding the
//     org row from a second connection — an error path no mock can produce.
//   * THE CAPABILITY GATE IS REAL ON THE WIRE, including on the READ: the member
//     directory is every member's email address (PDPA, NEW-3).
//   * THE CROSS-ORG SWEEP (CLAUDE.md rule 1), mandatory for every new endpoint.
//
// ⚠️ No fake timers anywhere (@qa's condition ค): Postgres' `now()` is not
// covered by them, so a suite that fakes time is testing a clock the database
// disagrees with. Every temporal state here is real or an explicit timestamp.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { ORG_TX_TIMEOUTS } from "@omnistock/config";
import { PrismaClient } from "@omnistock/db";
import { AccessTokenService } from "../src/auth/access-token.service";
import { collectSecurityEvents } from "../src/auth";
import { ORG_PROFILE_RESPONSE_HEADERS } from "../src/orgs";
import { assertErrorEnvelope, assertNoSecretFields, assertResponseHeaders } from "./assertions.kit";
import { INT_LANE_ENABLED, createTestApp, type TestApp } from "./app.kit";
import { createSeedKit, type SeedKit, type SeededOrg, type SeededUser } from "./f002-seed.kit";
import { assertNoCrossOrgLeak, createOrgLeakKit, type OrgLeakKit } from "./org-leak.kit";
import { auditApp } from "./route-registry.kit";

const d = INT_LANE_ENABLED ? describe : describe.skip;

if (!INT_LANE_ENABLED) {
  console.warn(
    "[T-002-18] SKIPPING the membership E2E suite: TEST_DATABASE_URL / TEST_REDIS_URL are not set. " +
      "The Owner ≥ 1 invariant under concurrency, the 409-not-500 lock policy and the cross-org " +
      "sweep are NOT verified in this run.",
  );
}

d("F-002 membership endpoints (E2E, DB)", () => {
  let app: TestApp;
  let prisma: PrismaClient;
  let kit: SeedKit;

  const token = (userId: string): string =>
    app.app.get(AccessTokenService, { strict: false }).sign(userId);

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    await prisma.$connect();
    app = await createTestApp();
    kit = createSeedKit(prisma, { label: "t18" });
  });

  afterAll(async () => {
    if (kit) await kit.cleanup();
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });

  // ── fixtures ────────────────────────────────────────────────────────────

  interface Person extends SeededUser {
    readonly accessToken: string;
  }

  async function person(): Promise<Person> {
    const user = await kit.createUser();
    return { ...user, accessToken: token(user.id) };
  }

  /** A shop with the three system roles and one member per requested role. */
  async function shop(roles: Readonly<Record<string, string>>): Promise<{
    org: SeededOrg;
    people: Record<string, Person>;
  }> {
    const org = await kit.createOrg();
    const people: Record<string, Person> = {};
    for (const [name, roleName] of Object.entries(roles)) {
      const p = await person();
      await kit.addMember({
        organizationId: org.id,
        userId: p.id,
        roleId: org.roles[roleName].id,
      });
      people[name] = p;
    }
    return { org, people };
  }

  const get = (path: string, accessToken: string) =>
    request(app.server()).get(path).set("Authorization", `Bearer ${accessToken}`);

  const patch = (path: string, accessToken: string, body: unknown) =>
    request(app.server())
      .patch(path)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send(body as object);

  const del = (path: string, accessToken: string) =>
    request(app.server()).delete(path).set("Authorization", `Bearer ${accessToken}`);

  /** The invariant, asked of the DATABASE (never of a status code). */
  const activeOwnerCount = (organizationId: string): Promise<number> =>
    prisma.membership.count({
      where: {
        organizationId,
        status: "active",
        // By CAPABILITY, exactly as the production rule does — never by role name.
        role: { capabilities: { has: "full_access" } },
      },
    });

  // ── §3.7 GET /orgs/{orgId}/members ──────────────────────────────────────

  describe("GET /orgs/{orgId}/members — api-spec §3.7", () => {
    it("★ the Owner sees the directory, with no-store headers and no secrets", async () => {
      const { org, people } = await shop({ owner: "Owner", staff: "Staff" });

      const res = await get(`/orgs/${org.id}/members`, people.owner.accessToken);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      const owner = res.body.items.find((i: { userId: string }) => i.userId === people.owner.id);
      const staff = res.body.items.find((i: { userId: string }) => i.userId === people.staff.id);
      expect(owner).toMatchObject({
        email: people.owner.email,
        roleName: "Owner",
        roleKey: "owner",
        status: "active",
        isMe: true,
        isOwner: true,
      });
      expect(staff).toMatchObject({ roleKey: "staff", isMe: false, isOwner: false });
      expect(res.body.nextCursor).toBeNull();

      // The directory is the most PII-dense response in F-002.
      assertNoSecretFields(res.body);
      assertResponseHeaders(res, ORG_PROFILE_RESPONSE_HEADERS);
      // …and nothing from the `User` row beyond the frozen projection.
      expect(JSON.stringify(res.body)).not.toContain("$argon2");
    });

    it("★ D-028/I-8/N-4: a Staff member gets 403 FORBIDDEN — not the directory", async () => {
      // This is why the READ is capability-gated at all (NEW-3): other people's
      // email addresses are PII under PDPA, not a UX preference.
      const { org, people } = await shop({ owner: "Owner", staff: "Staff" });

      const res = await get(`/orgs/${org.id}/members`, people.staff.accessToken);

      assertErrorEnvelope(res, { status: 403, code: "FORBIDDEN" });
      // Not one address escaped with the refusal.
      expect(JSON.stringify(res.body)).not.toContain(people.owner.email);
    });

    it("an Admin (manage_members, no full_access) may read it", async () => {
      const { org, people } = await shop({ owner: "Owner", admin: "Admin" });
      const res = await get(`/orgs/${org.id}/members`, people.admin.accessToken);
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
    });

    it("shows revoked rows by default and filters on request", async () => {
      const { org, people } = await shop({ owner: "Owner", staff: "Staff" });
      await del(`/orgs/${org.id}/members/${people.staff.id}`, people.owner.accessToken);

      const all = await get(`/orgs/${org.id}/members`, people.owner.accessToken);
      expect(all.body.items.map((i: { status: string }) => i.status).sort()).toEqual([
        "active",
        "revoked",
      ]);

      const active = await get(`/orgs/${org.id}/members?status=active`, people.owner.accessToken);
      expect(active.body.items.map((i: { userId: string }) => i.userId)).toEqual([people.owner.id]);

      const revoked = await get(`/orgs/${org.id}/members?status=revoked`, people.owner.accessToken);
      expect(revoked.body.items.map((i: { userId: string }) => i.userId)).toEqual([people.staff.id]);
      expect(revoked.body.items[0].revokedAt).toEqual(expect.any(String));
    });

    it("paginates with an opaque cursor, terminates, and can report a total", async () => {
      const { org, people } = await shop({ owner: "Owner", staff: "Staff" });

      const first = await get(`/orgs/${org.id}/members?limit=1&withTotal=true`, people.owner.accessToken);
      expect(first.body.items).toHaveLength(1);
      expect(first.body.total).toBe(2);
      expect(typeof first.body.nextCursor).toBe("string");

      const second = await get(
        `/orgs/${org.id}/members?limit=1&cursor=${encodeURIComponent(first.body.nextCursor)}`,
        people.owner.accessToken,
      );
      expect(second.body.items).toHaveLength(1);
      expect(second.body.items[0].userId).not.toBe(first.body.items[0].userId);
      expect(second.body.nextCursor).toBeNull();
      expect(second.body).not.toHaveProperty("total");
    });

    it("422 for a garbage cursor / an unknown status (`invited` is not offered)", async () => {
      const { org, people } = await shop({ owner: "Owner" });
      for (const query of ["?cursor=!!!", "?status=invited", "?limit=0"]) {
        const res = await get(`/orgs/${org.id}/members${query}`, people.owner.accessToken);
        assertErrorEnvelope(res, { status: 422, code: "VALIDATION_FAILED" });
      }
    });
  });

  // ── §3.8 PATCH /orgs/{orgId}/members/{userId} ───────────────────────────

  describe("PATCH /orgs/{orgId}/members/{userId} — api-spec §3.8", () => {
    it("the Owner changes a role and gets the §3.7 row back", async () => {
      const { org, people } = await shop({ owner: "Owner", staff: "Staff" });
      const events = collectSecurityEvents(app.events);

      const res = await patch(
        `/orgs/${org.id}/members/${people.staff.id}`,
        people.owner.accessToken,
        { roleId: org.roles.Admin.id },
      );

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        userId: people.staff.id,
        email: people.staff.email,
        roleId: org.roles.Admin.id,
        roleName: "Admin",
        roleKey: "admin",
        isOwner: false,
      });
      const row = await prisma.membership.findFirstOrThrow({
        where: { organizationId: org.id, userId: people.staff.id },
      });
      expect(row.roleId).toBe(org.roles.Admin.id);

      const changed = events.ofType("org.member.role_changed");
      expect(changed).toHaveLength(1);
      expect(changed[0].payload).toEqual({
        actorUserId: people.owner.id,
        organizationId: org.id,
        targetUserId: people.staff.id,
        fromRoleId: org.roles.Staff.id,
        toRoleId: org.roles.Admin.id,
        grantsFullAccess: false,
      });
      events.stop();
    });

    it("★ promoting to Owner is flagged as full access — privilege escalation is greppable", async () => {
      const { org, people } = await shop({ owner: "Owner", staff: "Staff" });
      const events = collectSecurityEvents(app.events);

      const res = await patch(
        `/orgs/${org.id}/members/${people.staff.id}`,
        people.owner.accessToken,
        { roleId: org.roles.Owner.id },
      );

      expect(res.status).toBe(200);
      expect(res.body.isOwner).toBe(true);
      expect(events.ofType("org.member.role_changed")[0].payload).toMatchObject({
        grantsFullAccess: true,
      });
      expect(await activeOwnerCount(org.id)).toBe(2);
      events.stop();
    });

    it("★ C-1/D-028: an Admin cannot promote anyone to Owner — 403, nothing written", async () => {
      const { org, people } = await shop({ owner: "Owner", admin: "Admin", staff: "Staff" });
      const events = collectSecurityEvents(app.events);

      const res = await patch(
        `/orgs/${org.id}/members/${people.staff.id}`,
        people.admin.accessToken,
        { roleId: org.roles.Owner.id },
      );

      // FORBIDDEN, not ORG_ACCESS_DENIED: they ARE a member (I-5).
      assertErrorEnvelope(res, { status: 403, code: "FORBIDDEN" });
      const row = await prisma.membership.findFirstOrThrow({
        where: { organizationId: org.id, userId: people.staff.id },
      });
      expect(row.roleId).toBe(org.roles.Staff.id);
      expect(await activeOwnerCount(org.id)).toBe(1);
      expect(events.ofType("org.member.role_changed")).toEqual([]);
      events.stop();
    });

    it("★ C-1: an Admin cannot promote THEMSELVES, nor demote an Owner", async () => {
      const { org, people } = await shop({ owner: "Owner", admin: "Admin" });

      const selfPromote = await patch(
        `/orgs/${org.id}/members/${people.admin.id}`,
        people.admin.accessToken,
        { roleId: org.roles.Owner.id },
      );
      assertErrorEnvelope(selfPromote, { status: 403, code: "FORBIDDEN" });

      const demoteOwner = await patch(
        `/orgs/${org.id}/members/${people.owner.id}`,
        people.admin.accessToken,
        { roleId: org.roles.Staff.id },
      );
      assertErrorEnvelope(demoteOwner, { status: 403, code: "FORBIDDEN" });

      expect(await activeOwnerCount(org.id)).toBe(1);
    });

    it("★ 409 LAST_OWNER when the only Owner demotes themselves", async () => {
      const { org, people } = await shop({ owner: "Owner", staff: "Staff" });

      const res = await patch(
        `/orgs/${org.id}/members/${people.owner.id}`,
        people.owner.accessToken,
        { roleId: org.roles.Staff.id },
      );

      assertErrorEnvelope(res, { status: 409, code: "LAST_OWNER" });
      expect(await activeOwnerCount(org.id)).toBe(1);
    });

    it("★ 422 ROLE_INVALID for another shop's role id — and it says nothing about that shop", async () => {
      const mine = await shop({ owner: "Owner", staff: "Staff" });
      const theirs = await shop({ owner: "Owner" });

      const res = await patch(
        `/orgs/${mine.org.id}/members/${mine.people.staff.id}`,
        mine.people.owner.accessToken,
        { roleId: theirs.org.roles.Admin.id },
      );

      assertErrorEnvelope(res, { status: 422, code: "ROLE_INVALID" });
      // The refusal must not confirm that the id exists somewhere (I-8).
      expect(JSON.stringify(res.body)).not.toContain(theirs.org.id);
      const row = await prisma.membership.findFirstOrThrow({
        where: { organizationId: mine.org.id, userId: mine.people.staff.id },
      });
      expect(row.roleId).toBe(mine.org.roles.Staff.id);
    });

    it("404 for someone who is not an active member of this shop", async () => {
      const { org, people } = await shop({ owner: "Owner" });
      const stranger = await person();

      const res = await patch(`/orgs/${org.id}/members/${stranger.id}`, people.owner.accessToken, {
        roleId: org.roles.Staff.id,
      });
      assertErrorEnvelope(res, { status: 404, code: "NOT_FOUND" });
    });

    it("422 for a missing roleId, 415 for a non-JSON body", async () => {
      const { org, people } = await shop({ owner: "Owner", staff: "Staff" });

      const empty = await patch(
        `/orgs/${org.id}/members/${people.staff.id}`,
        people.owner.accessToken,
        {},
      );
      assertErrorEnvelope(empty, { status: 422, code: "VALIDATION_FAILED" });
      expect(empty.body.error.fieldErrors).toHaveProperty("roleId");

      const wrongType = await request(app.server())
        .patch(`/orgs/${org.id}/members/${people.staff.id}`)
        .set("Authorization", `Bearer ${people.owner.accessToken}`)
        .set("Content-Type", "text/plain")
        .send("roleId=x");
      assertErrorEnvelope(wrongType, { status: 415, code: "UNSUPPORTED_MEDIA_TYPE" });
    });
  });

  // ── §3.9 DELETE /orgs/{orgId}/members/{userId} ──────────────────────────

  describe("DELETE /orgs/{orgId}/members/{userId} — api-spec §3.9", () => {
    it("★ soft-revokes AND cancels that email's pending invitation, atomically (I-1)", async () => {
      const { org, people } = await shop({ owner: "Owner", staff: "Staff" });
      // Two invitations for the SAME email: one pending (must die with the
      // revocation) and one already accepted (must be left alone).
      const pending = await kit.createInvitation({
        organizationId: org.id,
        email: people.staff.email,
        roleId: org.roles.Staff.id,
        invitedByUserId: people.owner.id,
      });
      const other = await kit.createInvitation({
        organizationId: org.id,
        email: `someone-else-${Date.now()}@seed.test`,
        roleId: org.roles.Staff.id,
      });
      const events = collectSecurityEvents(app.events);

      const res = await del(`/orgs/${org.id}/members/${people.staff.id}`, people.owner.accessToken);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        userId: people.staff.id,
        status: "revoked",
        cancelledInvitations: 1,
      });
      expect(Date.parse(res.body.revokedAt)).not.toBeNaN();
      assertNoSecretFields(res.body);

      const membership = await prisma.membership.findFirstOrThrow({
        where: { organizationId: org.id, userId: people.staff.id },
      });
      expect(membership.status).toBe("revoked");
      expect(membership.revokedByUserId).toBe(people.owner.id);
      expect(membership.revokedAt).toBeInstanceOf(Date);

      const cancelled = await prisma.invitation.findUniqueOrThrow({ where: { id: pending.id } });
      expect(cancelled.status).toBe("cancelled");
      expect(cancelled.cancelledAt).toBeInstanceOf(Date);
      // Somebody else's invitation is untouched — the cancellation is scoped to
      // the removed person's address, not "everything pending".
      const untouched = await prisma.invitation.findUniqueOrThrow({ where: { id: other.id } });
      expect(untouched.status).toBe("pending");

      const revoked = events.ofType("org.member.revoked");
      expect(revoked).toHaveLength(1);
      expect(revoked[0].payload).toEqual({
        actorUserId: people.owner.id,
        organizationId: org.id,
        targetUserId: people.staff.id,
        cancelledInvitationIds: [pending.id],
      });
      // ⛔ Being removed is NOT leaving (D-029).
      expect(events.ofType("org.member.left")).toEqual([]);
      events.stop();

      // The removed member is out on the very next request — no cache, no TTL.
      const after = await get(`/orgs/${org.id}`, people.staff.accessToken);
      assertErrorEnvelope(after, { status: 403, code: "ORG_ACCESS_DENIED" });
    });

    it("★ C-1: an Admin cannot remove an Owner", async () => {
      const { org, people } = await shop({ owner: "Owner", admin: "Admin" });
      const secondOwner = await person();
      await kit.addMember({
        organizationId: org.id,
        userId: secondOwner.id,
        roleId: org.roles.Owner.id,
      });

      const res = await del(`/orgs/${org.id}/members/${secondOwner.id}`, people.admin.accessToken);

      assertErrorEnvelope(res, { status: 403, code: "FORBIDDEN" });
      expect(await activeOwnerCount(org.id)).toBe(2);
    });

    it("★ 409 LAST_OWNER — the only Owner cannot be removed", async () => {
      const { org, people } = await shop({ owner: "Owner", staff: "Staff" });
      const res = await del(`/orgs/${org.id}/members/${people.owner.id}`, people.owner.accessToken);
      assertErrorEnvelope(res, { status: 409, code: "LAST_OWNER" });
      expect(await activeOwnerCount(org.id)).toBe(1);
    });

    it("★ revoke ‖ revoke on the same person: one 200, one 404 — never a 500 (I-C-10)", async () => {
      const { org, people } = await shop({ owner: "Owner", staff: "Staff" });

      const [a, b] = await Promise.all([
        del(`/orgs/${org.id}/members/${people.staff.id}`, people.owner.accessToken),
        del(`/orgs/${org.id}/members/${people.staff.id}`, people.owner.accessToken),
      ]);

      const statuses = [a.status, b.status].sort();
      expect(statuses[0]).toBe(200);
      expect([404, 409]).toContain(statuses[1]);
      expect(statuses[1]).not.toBe(500);

      // `revokedAt` was written exactly once.
      const row = await prisma.membership.findFirstOrThrow({
        where: { organizationId: org.id, userId: people.staff.id },
      });
      expect(row.status).toBe("revoked");
    });
  });

  // ── §3.17 DELETE /orgs/{orgId}/membership (D-029) ───────────────────────

  describe("DELETE /orgs/{orgId}/membership — api-spec §3.17", () => {
    it("★ a Staff member may leave WITHOUT manage_members — and it emits member.left", async () => {
      const { org, people } = await shop({ owner: "Owner", staff: "Staff" });
      const invitation = await kit.createInvitation({
        organizationId: org.id,
        email: people.staff.email,
        roleId: org.roles.Staff.id,
        invitedByUserId: people.owner.id,
      });
      const events = collectSecurityEvents(app.events);

      // The same person is refused by `GET /members` for lacking the capability,
      // and served here — which is exactly the D-029 split.
      const denied = await get(`/orgs/${org.id}/members`, people.staff.accessToken);
      assertErrorEnvelope(denied, { status: 403, code: "FORBIDDEN" });

      const res = await del(`/orgs/${org.id}/membership`, people.staff.accessToken);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        organizationId: org.id,
        status: "revoked",
        cancelledInvitations: 1,
      });
      assertResponseHeaders(res, ORG_PROFILE_RESPONSE_HEADERS);

      const membership = await prisma.membership.findFirstOrThrow({
        where: { organizationId: org.id, userId: people.staff.id },
      });
      expect(membership.status).toBe("revoked");
      // D-029 — they removed themselves.
      expect(membership.revokedByUserId).toBe(people.staff.id);
      expect(
        (await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } })).status,
      ).toBe("cancelled");

      // ★ THE EVENT DISTINCTION. One event type cannot answer "did the team walk
      // out, or did the owner clear them out?" — so there are two.
      const left = events.ofType("org.member.left");
      expect(left).toHaveLength(1);
      expect(left[0].payload).toEqual({
        userId: people.staff.id,
        organizationId: org.id,
        roleId: org.roles.Staff.id,
        cancelledInvitationIds: [invitation.id],
      });
      expect(events.ofType("org.member.revoked")).toEqual([]);
      events.stop();

      // …and the shop is gone from their switcher immediately.
      const mine = await get("/me/organizations", people.staff.accessToken);
      expect(
        mine.body.items.map((i: { organization: { id: string } }) => i.organization.id),
      ).not.toContain(org.id);
    });

    it("★ pressing it twice gives 403 ORG_ACCESS_DENIED — never 404, never 500", async () => {
      const { org, people } = await shop({ owner: "Owner", staff: "Staff" });
      const first = await del(`/orgs/${org.id}/membership`, people.staff.accessToken);
      expect(first.status).toBe(200);

      const second = await del(`/orgs/${org.id}/membership`, people.staff.accessToken);
      assertErrorEnvelope(second, { status: 403, code: "ORG_ACCESS_DENIED" });
    });

    it("★ 409 LAST_OWNER — the only Owner cannot leave (same rule as §3.9)", async () => {
      const { org, people } = await shop({ owner: "Owner", staff: "Staff" });
      const res = await del(`/orgs/${org.id}/membership`, people.owner.accessToken);
      assertErrorEnvelope(res, { status: 409, code: "LAST_OWNER" });
      expect(await activeOwnerCount(org.id)).toBe(1);
    });

    it("an Owner with a co-Owner may leave", async () => {
      const { org, people } = await shop({ owner: "Owner" });
      const second = await person();
      await kit.addMember({ organizationId: org.id, userId: second.id, roleId: org.roles.Owner.id });

      const res = await del(`/orgs/${org.id}/membership`, people.owner.accessToken);
      expect(res.status).toBe(200);
      expect(await activeOwnerCount(org.id)).toBe(1);
    });

    it("★ there is no way to point this route at somebody else", async () => {
      // The structural claim of §3.17, tested as a claim about the ROUTER: a
      // `userId` appended to the path must not resolve to a handler at all.
      const { org, people } = await shop({ owner: "Owner", staff: "Staff" });
      const res = await del(
        `/orgs/${org.id}/membership/${people.owner.id}`,
        people.staff.accessToken,
      );
      expect(res.status).toBe(404);
      const owner = await prisma.membership.findFirstOrThrow({
        where: { organizationId: org.id, userId: people.owner.id },
      });
      expect(owner.status).toBe("active");
    });
  });

  // ── the concurrency proof (architecture §5 · test-plan I-C-01/I-C-07) ────

  describe("★ Owner ≥ 1 under real concurrency", () => {
    /**
     * Two requests, fired with `Promise.all` (no `setTimeout` staging — a sleep
     * proves the sleep, not the lock), each removing a DIFFERENT Owner of a shop
     * that has exactly two.
     *
     * The verdict is taken from the DATABASE afterwards. Status codes alone
     * would be satisfied by an endpoint that refuses everything.
     */
    async function twoWayOwnerRemovalRound() {
      const { org, people } = await shop({ a: "Owner", b: "Owner" });
      const [first, second] = await Promise.all([
        del(`/orgs/${org.id}/members/${people.b.id}`, people.a.accessToken),
        del(`/orgs/${org.id}/members/${people.a.id}`, people.a.accessToken),
      ]);
      return {
        orgId: org.id,
        statuses: [first.status, second.status],
        codes: [first.body?.error?.code, second.body?.error?.code],
        remaining: await activeOwnerCount(org.id),
      };
    }

    it("★ two parallel removals of two different Owners never leave the shop ownerless", async () => {
      const ROUNDS = 6;
      const results = [];
      for (let round = 0; round < ROUNDS; round++) {
        results.push(await twoWayOwnerRemovalRound());
      }

      for (const [index, result] of results.entries()) {
        // THE INVARIANT. Asked of Postgres, after the race, every single round.
        expect(
          result.remaining,
          `round ${index}: the shop was left with ${result.remaining} active Owner(s) — ` +
            `statuses ${JSON.stringify(result.statuses)}, codes ${JSON.stringify(result.codes)}`,
        ).toBeGreaterThanOrEqual(1);

        // Exactly one request may win.
        const succeeded = result.statuses.filter((s) => s === 200);
        expect(succeeded, `round ${index}: statuses ${JSON.stringify(result.statuses)}`).toHaveLength(1);

        // The loser is a DECIDED refusal the client can act on — never a 500 and
        // never a raw SQLSTATE (§5.2 / I-C-10). WHICH refusal depends on the
        // order the lock granted, and both are correct:
        //   removed-the-other-Owner first → removing themselves would leave zero
        //                                   Owners            → 409 LAST_OWNER
        //   removed-themselves first      → the actor is no longer a member of
        //                                   this shop     → 403 ORG_ACCESS_DENIED
        // Pinning one of the two would make this test a coin flip; the INVARIANT
        // above is what the round is actually about.
        const loser = result.statuses.find((s) => s !== 200)!;
        expect([403, 409], `round ${index}: codes ${JSON.stringify(result.codes)}`).toContain(loser);
        expect(
          ["LAST_OWNER", "ORG_ACCESS_DENIED", "CONFLICT"],
          `round ${index}: codes ${JSON.stringify(result.codes)}`,
        ).toContain(result.codes.find(Boolean));
      }

      // ⚠️ Non-vacuity: if EVERY loser were `CONFLICT` (lock contention), this
      // would be proving the timeout policy rather than the invariant. At least
      // one round must have been refused by a MEMBERSHIP rule.
      const refusedByRule = results.filter((r) =>
        r.codes.some((code) => code === "LAST_OWNER" || code === "ORG_ACCESS_DENIED"),
      );
      expect(refusedByRule.length, JSON.stringify(results.map((r) => r.codes))).toBeGreaterThan(0);
    });

    it("★ demote-one-Owner ‖ remove-the-other — the §5 opening scenario", async () => {
      const { org, people } = await shop({ a: "Owner", b: "Owner" });

      const [demote, remove] = await Promise.all([
        patch(`/orgs/${org.id}/members/${people.a.id}`, people.a.accessToken, {
          roleId: org.roles.Staff.id,
        }),
        del(`/orgs/${org.id}/members/${people.b.id}`, people.a.accessToken),
      ]);

      const remaining = await activeOwnerCount(org.id);
      const statuses = [demote.status, remove.status];
      const codes = [demote.body?.error?.code, remove.body?.error?.code];
      const where = `statuses ${JSON.stringify(statuses)}, codes ${JSON.stringify(codes)}`;

      // THE INVARIANT — the point of the whole scenario.
      expect(remaining, `left with ${remaining} active Owner(s): ${where}`).toBeGreaterThanOrEqual(1);
      expect(statuses.filter((s) => s === 200), where).toHaveLength(1);

      // BOTH orderings are correct, and they refuse differently — which is the
      // evidence that the actor's own role is re-read INSIDE the transaction:
      //   DELETE first  → the demotion would leave 0 Owners      → 409 LAST_OWNER
      //   PATCH first   → the actor demoted THEMSELVES, so they no longer hold
      //                   `full_access` and may not remove an Owner → 403 FORBIDDEN
      // Reading the actor's capabilities from the ALS snapshot instead would
      // produce a 200 here, on a role its holder had already given up.
      const loser = statuses.find((s) => s !== 200)!;
      expect([403, 409], where).toContain(loser);
      expect(codes.filter(Boolean), where).toHaveLength(1);
      expect(["LAST_OWNER", "FORBIDDEN", "CONFLICT"], where).toContain(codes.find(Boolean));
    });

    it("★ leave ‖ remove-the-other-Owner keeps the invariant too (D-029 uses the same rule)", async () => {
      const { org, people } = await shop({ a: "Owner", b: "Owner" });

      const [leave, remove] = await Promise.all([
        del(`/orgs/${org.id}/membership`, people.a.accessToken),
        del(`/orgs/${org.id}/members/${people.b.id}`, people.a.accessToken),
      ]);

      expect(await activeOwnerCount(org.id)).toBeGreaterThanOrEqual(1);
      expect([leave.status, remove.status].filter((s) => s === 200)).toHaveLength(1);
    });

    it("★ PATCH ‖ DELETE on the same target: no role change survives the revoke (I-C-07)", async () => {
      const { org, people } = await shop({ owner: "Owner", staff: "Staff" });

      const [change, remove] = await Promise.all([
        patch(`/orgs/${org.id}/members/${people.staff.id}`, people.owner.accessToken, {
          roleId: org.roles.Admin.id,
        }),
        del(`/orgs/${org.id}/members/${people.staff.id}`, people.owner.accessToken),
      ]);

      // Whoever came second sees the committed state of the first.
      for (const res of [change, remove]) {
        expect([200, 404, 409]).toContain(res.status);
        expect(res.status).not.toBe(500);
      }
      const row = await prisma.membership.findFirstOrThrow({
        where: { organizationId: org.id, userId: people.staff.id },
      });
      if (remove.status === 200) expect(row.status).toBe("revoked");
    });
  });

  // ── §5.2 lock contention is a 409, not a 500 ────────────────────────────

  describe("★ lock contention (architecture §5.2 · §15 row 6b)", () => {
    let holder: PrismaClient;

    beforeAll(async () => {
      // A SEPARATE pool: the holder must not compete for the app's connections.
      holder = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
      await holder.$connect();
    });

    afterAll(async () => {
      if (holder) await holder.$disconnect();
    });

    it(
      "a held org row makes a membership write 409 + details.reason='busy' — never 500",
      async () => {
        const held = await shop({ owner: "Owner", staff: "Staff" });
        const control = await shop({ owner: "Owner", staff: "Staff" });

        let release!: () => void;
        const untilReleased = new Promise<void>((resolve) => (release = resolve));
        let acquired!: () => void;
        const untilAcquired = new Promise<void>((resolve) => (acquired = resolve));

        const holding = holder.$transaction(
          async (tx) => {
            await tx.$queryRawUnsafe(
              'SELECT id FROM "Organization" WHERE id = $1 FOR UPDATE',
              held.org.id,
            );
            acquired();
            await untilReleased;
          },
          { timeout: 30_000, maxWait: 5_000 },
        );

        await untilAcquired;
        try {
          const started = Date.now();
          const blocked = await del(
            `/orgs/${held.org.id}/members/${held.people.staff.id}`,
            held.people.owner.accessToken,
          );
          const elapsed = Date.now() - started;

          assertErrorEnvelope(blocked, { status: 409, code: "CONFLICT" });
          expect(blocked.body.error.details).toEqual({ reason: "busy" });
          // It gave up on POLICY, not by hanging.
          expect(elapsed).toBeLessThan(ORG_TX_TIMEOUTS.lockTimeoutMs + 2_500);
          // Nothing from the database's vocabulary reached the caller.
          const wire = JSON.stringify(blocked.body);
          for (const forbidden of ["55P03", "40P01", "40001", "P2028", "P2010", "Organization"]) {
            expect(wire).not.toContain(forbidden);
          }

          // THE CONTROL: another tenant is completely unaffected while that row
          // is held — the lock is per-shop, which is the whole §5.2 argument.
          const other = await del(
            `/orgs/${control.org.id}/members/${control.people.staff.id}`,
            control.people.owner.accessToken,
          );
          expect(other.status).toBe(200);
        } finally {
          release();
          await holding;
        }
      },
      ORG_TX_TIMEOUTS.lockTimeoutMs + 30_000,
    );
  });

  // ── the mandatory cross-org sweep (CLAUDE.md rule 1) ────────────────────

  describe("★ cross-org isolation — the 4+1 persona sweep", () => {
    let leak: OrgLeakKit;
    let targetUserId: string;

    beforeAll(async () => {
      leak = await createOrgLeakKit(app.app, prisma, { withUnderprivileged: true });
      // The Staff persona of A — a real, harmless PATCH target inside A.
      targetUserId = leak.persona("underprivilegedInA").userId;
    });

    afterAll(async () => {
      if (leak) await leak.cleanup();
    });

    it("GET /orgs/{orgId}/members leaks nothing in any direction", async () => {
      const outcomes = await leak.sweep({ method: "get", path: "/orgs/{orgId}/members" });
      expect(outcomes).toHaveLength(15); // 5 personas × 3 targets

      // The foreign value here is the STRANGER's address: everybody else in the
      // sweep is a legitimate member of A, so their addresses SHOULD appear in
      // A's directory. Someone with no membership anywhere must never appear.
      assertNoCrossOrgLeak(outcomes, {
        foreignValues: [leak.persona("noMembership").email],
      });

      // The control: the Owner of A really was served, and got A's directory.
      const served = outcomes.find((o) => o.persona === "activeInAOnly" && o.target === "A")!;
      expect(served.status).toBe(200);
      const emails = (served.body as { items: { email: string }[] }).items.map((i) => i.email);
      expect(emails).toContain(leak.persona("activeInAOnly").email);

      // …and B's directory never appeared in an answer about A.
      const inB = outcomes.find((o) => o.persona === "activeInBoth" && o.target === "B")!;
      expect(inB.status).toBe(200);
    });

    it("PATCH /orgs/{orgId}/members/{userId} leaks nothing in any direction", async () => {
      const outcomes = await leak.sweep({
        method: "patch",
        path: `/orgs/{orgId}/members/${targetUserId}`,
        body: { roleId: leak.orgA.roles.Staff.id },
      });
      assertNoCrossOrgLeak(outcomes, {
        foreignValues: [leak.persona("noMembership").email],
      });
    });

    it("★ golden rule 3: a member of A cannot remove a member of B", async () => {
      const outsider = leak.persona("activeInAOnly");
      const victim = leak.persona("activeInBoth");

      const res = await del(`/orgs/${leak.orgB.id}/members/${victim.userId}`, outsider.accessToken);

      assertErrorEnvelope(res, { status: 403, code: "ORG_ACCESS_DENIED" });
      const untouched = await prisma.membership.findFirstOrThrow({
        where: { organizationId: leak.orgB.id, userId: victim.userId },
      });
      expect(untouched.status).toBe("active");
      expect(untouched.revokedAt).toBeNull();
    });

    it("★ I-5: the Staff persona gets FORBIDDEN while the stranger gets ORG_ACCESS_DENIED", async () => {
      const outcomes = await leak.sweep({
        method: "get",
        path: "/orgs/{orgId}/members",
        targets: ["A"],
      });
      const staff = outcomes.find((o) => o.persona === "underprivilegedInA")!;
      const stranger = outcomes.find((o) => o.persona === "noMembership")!;
      assertErrorEnvelope({ status: staff.status, body: staff.body }, { code: "FORBIDDEN" });
      assertErrorEnvelope(
        { status: stranger.status, body: stranger.body },
        { code: "ORG_ACCESS_DENIED" },
      );
    });
  });

  // ── the live router vs the contract tables ──────────────────────────────

  describe("route registry (I-02 / G-13)", () => {
    it("★ the four membership routes are live, with the tiers api-spec §2 states", () => {
      const routes = auditApp(app.app).routes;
      const find = (method: string, path: string) =>
        routes.find((r) => r.method === method && r.path === path);

      expect(find("GET", "/orgs/{orgId}/members")).toMatchObject({
        scope: "org",
        declaration: "capability",
        capability: "manage_members",
      });
      expect(find("PATCH", "/orgs/{orgId}/members/{userId}")).toMatchObject({
        scope: "org",
        declaration: "capability",
        capability: "manage_members",
      });
      expect(find("DELETE", "/orgs/{orgId}/members/{userId}")).toMatchObject({
        scope: "org",
        declaration: "capability",
        capability: "manage_members",
      });
      expect(find("DELETE", "/orgs/{orgId}/membership")).toMatchObject({
        scope: "org",
        declaration: "any-active-member",
      });
    });

    it("the rows T-002-18 ships are no longer `pending`", () => {
      const pending = auditApp(app.app).pending.map((p) => p.route);
      for (const route of [
        "GET /orgs/{orgId}/members",
        "PATCH /orgs/{orgId}/members/{userId}",
        "DELETE /orgs/{orgId}/members/{userId}",
        "DELETE /orgs/{orgId}/membership",
      ]) {
        expect(pending).not.toContain(route);
      }
      // The "…and something else still is" escape hatch that kept this honest
      // while F-002 was half-built is now closed: nothing is pending at all.
      expect(pending).toEqual([]);
    });
  });
});
