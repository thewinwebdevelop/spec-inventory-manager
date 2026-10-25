// F-003 · T-003-QA01 ★ — I3-56 part 1 = F-002 I-45 on a real Postgres
// (F-003 test-plan §4.12 · AC-10.1 · F-002 test-plan I-45).
//
// THE CLAIM: `Role.key` is a display slug. It never decides a permission —
// capabilities do. grep (G-12) catches `role.key === "owner"`; it cannot catch
// `ROLE_KEYS.includes(k)` or a key threaded into some other function. This file
// is the behavioural half: rewrite the keys IN THE DATABASE and fire every
// F-002 Owner-only route. If anything anywhere reads `key` to decide, a verdict
// here moves.
//
// KEY STATES (each gets a fresh shop):
//   untouched          — control: same requests, keys as production writes them
//   swapped            — Staff.key="owner", Owner.key="staff"   (I-45 literal)
//   owner-null         — Staff.key="owner", Owner.key=null      (I-45 "+ key=null")
//   admin-wears-owner  — Admin.key="owner", Owner.key=null      (extension, see below)
//   staff-wears-admin  — Staff.key="admin", Admin.key=null      (review Medium: a
//                        "key admin ⇒ manage_members" mapping, or a blueprint
//                        lookup BY KEY, passes every state that only ever puts
//                        "owner"/"staff" on Staff)
//
// ORDER-INDEPENDENT: every `it` builds its own shop, so no case depends on what
// an earlier case wrote (or failed to write).
//
// WHY AN ADMIN ACTOR AND NOT ONLY STAFF: Staff lacks `manage_members`, so
// `CapabilityGuard` refuses Staff before any Owner-only rule is evaluated. A
// Staff-only I-45 therefore proves the GUARD ignores `key`, but says nothing
// about `canAssignRole`'s inputs (target/new-role/actor ownership). Admin holds
// `manage_members` and not `full_access`, so Admin's 403s are produced by the
// Owner-only rule itself — the "control" block proves that by letting Admin
// perform the same six verbs on non-Owner targets in the same shop.
//
// THE OWNER-ONLY SET (F-002 api-spec §1 item 13, §2 rows 8/9/11/12):
//   R1 PATCH  members/{u}             promote to the Owner role
//   R2 PATCH  members/{owner}         demote an Owner
//   R3 DELETE members/{owner}         remove an Owner
//   R4 POST   invitations             invite with the Owner role
//   R5 POST   invitations/{id}/link   reissue an Owner invitation (NEW-2)
//   R6 POST   members/{owner}/reset-password  (F-001; refuses with 404, never 403)
//
// Refusals are checked on the wire AND in the database: a 403 that had already
// written would still be a hole.
//
// ⚠️ No fake timers (@qa's condition ค) · rows deleted by id via the seed kit.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@omnistock/db";
import { AccessTokenService } from "../src/auth/access-token.service";
import { INT_LANE_ENABLED, createTestApp, type TestApp } from "./app.kit";
import { createSeedKit, type SeedKit, type SeededOrg, type SeededUser } from "./f002-seed.kit";

const d = INT_LANE_ENABLED ? describe : describe.skip;

if (!INT_LANE_ENABLED) {
  console.warn(
    "[T-003-QA01] SKIPPING I3-56/I-45: TEST_DATABASE_URL / TEST_REDIS_URL are not set. " +
      "'Role.key never decides a permission' is NOT verified in this run.",
  );
}

type KeyState = "untouched" | "swapped" | "owner-null" | "admin-wears-owner" | "staff-wears-admin";

const EXPECTED_KEYS: Record<KeyState, Record<"Owner" | "Admin" | "Staff", string | null>> = {
  untouched: { Owner: "owner", Admin: "admin", Staff: "staff" },
  swapped: { Owner: "staff", Admin: "admin", Staff: "owner" },
  "owner-null": { Owner: null, Admin: "admin", Staff: "owner" },
  "admin-wears-owner": { Owner: null, Admin: "owner", Staff: "staff" },
  "staff-wears-admin": { Owner: "owner", Admin: null, Staff: "admin" },
};

/** Users an Owner-only / guard request could act UPON (sessions + passwords snapshotted). */
const TARGETS = ["ownerA", "ownerB", "ownerC", "promotee", "staffX", "staffY", "staffZ"] as const;

const NEW_PASSWORD = "role-key-authority-7Qx!pass";

d("I3-56 part 1 / I-45 — Role.key never decides a permission (DB)", () => {
  let app: TestApp;
  let prisma: PrismaClient;
  let kit: SeedKit;
  /** Users whose seeded refresh tokens must go before `kit.cleanup()` (FK). */
  const sessionUserIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    await prisma.$connect();
    app = await createTestApp();
    kit = createSeedKit(prisma, { label: "qa01" });
  });

  afterAll(async () => {
    if (prisma && sessionUserIds.length > 0) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: sessionUserIds } } });
    }
    if (kit) await kit.cleanup();
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });

  // ── fixture ─────────────────────────────────────────────────────────────

  interface Person extends SeededUser {
    readonly accessToken: string;
  }

  interface Shop {
    readonly org: SeededOrg;
    readonly p: Record<string, Person>;
    readonly ownerInvitationId: string;
    readonly staffInvitationId: string;
  }

  const token = (userId: string): string =>
    app.app.get(AccessTokenService, { strict: false }).sign(userId);

  async function shop(state: KeyState): Promise<Shop> {
    const org = await kit.createOrg();
    const layout: Record<string, "Owner" | "Admin" | "Staff"> = {
      own: "Owner",
      adm: "Admin",
      stf: "Staff",
      // Owner-only targets. Four Owners in total, so LAST_OWNER (409) can never
      // be the reason a request is refused or allowed.
      ownerA: "Owner", // R3 target
      ownerB: "Owner", // R2 target
      ownerC: "Owner", // R6 target
      promotee: "Staff", // R1 target
      // Control targets (non-Owner) for Admin's attribution proof.
      staffX: "Staff",
      staffY: "Staff",
      staffZ: "Staff",
    };
    const p: Record<string, Person> = {};
    for (const [who, roleName] of Object.entries(layout)) {
      const user = await kit.createUser();
      await kit.addMember({
        organizationId: org.id,
        userId: user.id,
        roleId: org.roles[roleName].id,
      });
      p[who] = { ...user, accessToken: token(user.id) };
    }
    // A live session for every target, so "nothing was written" also covers
    // "nobody's sessions were revoked" (reset-password / removal revoke them).
    for (const who of TARGETS) {
      const now = Date.now();
      await prisma.refreshToken.create({
        data: {
          userId: p[who].id,
          familyId: randomUUID(),
          tokenHash: randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, ""),
          expiresAt: new Date(now + 60 * 86_400_000),
          familyExpiresAt: new Date(now + 90 * 86_400_000),
        },
      });
      sessionUserIds.push(p[who].id);
    }
    const ownerInvitation = await kit.createInvitation({
      organizationId: org.id,
      email: `qa01-owner-inv-${randomUUID()}@example.com`,
      roleId: org.roles.Owner.id,
      expiresAt: new Date(Date.now() + 24 * 3_600_000),
      invitedByUserId: p.own.id,
    });
    const staffInvitation = await kit.createInvitation({
      organizationId: org.id,
      email: `qa01-staff-inv-${randomUUID()}@example.com`,
      roleId: org.roles.Staff.id,
      invitedByUserId: p.own.id,
    });

    // Rewrite the keys. The "owner" slug is freed first: @@unique(orgId, key)
    // is real and the kit does not dodge it.
    const { Owner, Admin, Staff } = org.roles;
    switch (state) {
      case "untouched":
        break;
      case "swapped":
        await kit.setRoleKey(Owner.id, null);
        await kit.setRoleKey(Staff.id, "owner");
        await kit.setRoleKey(Owner.id, "staff");
        break;
      case "owner-null":
        await kit.setRoleKey(Owner.id, null);
        await kit.setRoleKey(Staff.id, "owner");
        break;
      case "admin-wears-owner":
        await kit.setRoleKey(Owner.id, null);
        await kit.setRoleKey(Admin.id, "owner");
        break;
      case "staff-wears-admin":
        await kit.setRoleKey(Admin.id, null);
        await kit.setRoleKey(Staff.id, "admin");
        break;
    }

    // Fixture sanity, read from the DATABASE: the keys moved, capabilities did not.
    const rows = await prisma.role.findMany({
      where: { organizationId: org.id },
      select: { name: true, key: true, capabilities: true },
    });
    const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
    for (const name of ["Owner", "Admin", "Staff"] as const) {
      expect(byName[name].key, `${state}: ${name}.key`).toBe(EXPECTED_KEYS[state][name]);
      expect(byName[name].capabilities).toEqual([...org.roles[name].capabilities]);
    }
    expect(byName.Owner.capabilities).toContain("full_access");
    expect(byName.Admin.capabilities).not.toContain("full_access");
    expect(byName.Staff.capabilities).not.toContain("full_access");

    return { org, p, ownerInvitationId: ownerInvitation.id, staffInvitationId: staffInvitation.id };
  }

  // ── requests ────────────────────────────────────────────────────────────

  const send = (
    method: "patch" | "delete" | "post" | "put",
    path: string,
    accessToken: string,
    body?: object,
  ) => {
    const req = request(app.server())[method](path).set("Authorization", `Bearer ${accessToken}`);
    return body === undefined ? req.send() : req.set("Content-Type", "application/json").send(body);
  };

  interface Outcome {
    readonly route: string;
    readonly status: number;
    readonly code: string | undefined;
  }

  /** The six Owner-only requests, fired by `actor`. */
  async function ownerOnly(s: Shop, actor: Person, inviteEmail: string): Promise<Outcome[]> {
    const o = `/orgs/${s.org.id}`;
    const R = s.org.roles;
    const shots: Array<[string, () => request.Test]> = [
      [
        "R1 PATCH promote→Owner",
        () =>
          send("patch", `${o}/members/${s.p.promotee.id}`, actor.accessToken, {
            roleId: R.Owner.id,
          }),
      ],
      [
        "R2 PATCH demote Owner",
        () =>
          send("patch", `${o}/members/${s.p.ownerB.id}`, actor.accessToken, { roleId: R.Staff.id }),
      ],
      ["R3 DELETE Owner", () => send("delete", `${o}/members/${s.p.ownerA.id}`, actor.accessToken)],
      [
        "R4 POST invite as Owner",
        () =>
          send("post", `${o}/invitations`, actor.accessToken, {
            email: inviteEmail,
            roleId: R.Owner.id,
          }),
      ],
      [
        "R5 POST reissue Owner invitation",
        () => send("post", `${o}/invitations/${s.ownerInvitationId}/link`, actor.accessToken),
      ],
      [
        "R6 POST reset Owner password",
        () =>
          send("post", `${o}/members/${s.p.ownerC.id}/reset-password`, actor.accessToken, {
            newPassword: NEW_PASSWORD,
          }),
      ],
    ];
    const out: Outcome[] = [];
    for (const [route, fire] of shots) {
      const res = await fire();
      out.push({ route, status: res.status, code: res.body?.error?.code as string | undefined });
    }
    return out;
  }

  /** The refusal every Owner-only route must give a non-`full_access` actor. */
  const REFUSED: ReadonlyArray<Omit<Outcome, "code"> & { code: string | undefined }> = [
    { route: "R1 PATCH promote→Owner", status: 403, code: "FORBIDDEN" },
    { route: "R2 PATCH demote Owner", status: 403, code: "FORBIDDEN" },
    { route: "R3 DELETE Owner", status: 403, code: "FORBIDDEN" },
    { route: "R4 POST invite as Owner", status: 403, code: "FORBIDDEN" },
    { route: "R5 POST reissue Owner invitation", status: 403, code: "FORBIDDEN" },
    // F-001's shipped shape: every refusal on this route is an identical 404.
    { route: "R6 POST reset Owner password", status: 404, code: "NOT_FOUND" },
  ];

  /** Everything an Owner-only or guard-tier request could have written. */
  async function snapshot(s: Shop) {
    const targetIds = TARGETS.map((who) => s.p[who].id);
    const [memberships, invitations, roles, organization, passwords, sessions] = await Promise.all([
      prisma.membership.findMany({
        where: { organizationId: s.org.id },
        select: { userId: true, roleId: true, status: true, revokedAt: true },
        orderBy: { userId: "asc" },
      }),
      prisma.invitation.findMany({
        where: { organizationId: s.org.id },
        select: {
          id: true,
          email: true,
          roleId: true,
          status: true,
          tokenHash: true,
          expiresAt: true,
        },
        orderBy: { id: "asc" },
      }),
      prisma.role.findMany({
        where: { organizationId: s.org.id },
        select: {
          id: true,
          name: true,
          key: true,
          isSystem: true,
          capabilities: true,
          updatedAt: true,
        },
        orderBy: { id: "asc" },
      }),
      prisma.organization.findUniqueOrThrow({
        where: { id: s.org.id },
        select: {
          name: true,
          logo: true,
          timezone: true,
          taxEntityType: true,
          taxId: true,
          vatRegistered: true,
          taxBranchCode: true,
          updatedAt: true,
        },
      }),
      prisma.user.findMany({
        where: { id: { in: targetIds } },
        select: { id: true, passwordHash: true },
        orderBy: { id: "asc" },
      }),
      prisma.refreshToken.findMany({
        where: { userId: { in: targetIds } },
        select: { id: true, userId: true, familyId: true, revokedAt: true, expiresAt: true },
        orderBy: { id: "asc" },
      }),
    ]);
    // Non-vacuity: one live session per target was seeded — an empty list here
    // would make "sessions unchanged" true of any request.
    expect(sessions).toHaveLength(TARGETS.length);
    return { memberships, invitations, roles, organization, passwords, sessions };
  }

  const passwordOf = (snap: Awaited<ReturnType<typeof snapshot>>, userId: string) =>
    snap.passwords.find((u) => u.id === userId)!.passwordHash;

  const inviteEmail = (): string => `qa01-new-${randomUUID()}@example.com`;

  // ── the matrix ──────────────────────────────────────────────────────────
  // Every `it` seeds its OWN shop (review Low-4): no case can pass or fail
  // because of what a sibling wrote, and `-t` / reordering / `.only` are safe.

  describe.each<[KeyState]>([
    ["untouched"],
    ["swapped"],
    ["owner-null"],
    ["admin-wears-owner"],
    ["staff-wears-admin"],
  ])("key state: %s", (state) => {
    it("★ Staff is refused on every Owner-only route, and nothing is written", async () => {
      const s = await shop(state);
      const before = await snapshot(s);
      expect(await ownerOnly(s, s.p.stf, inviteEmail())).toEqual(REFUSED);
      expect(await snapshot(s)).toEqual(before);
    });

    it("★ Staff is refused at the GUARD too — manage_members + manage_org_settings verbs, key or no key", async () => {
      // Why this exists: the Owner-only routes re-read the actor's
      // capabilities inside the transaction, so a GUARD that trusted `key`
      // (Staff.key="owner" ⇒ full_access) would still be stopped there, and
      // the case above would stay green. Measured, not assumed: that exact
      // mutation in org-context.middleware left all six Owner-only refusals
      // intact. Several verbs here have no second check — the guard is the
      // only thing between Staff and them.
      const s = await shop(state);
      const o = `/orgs/${s.org.id}`;
      const R = s.org.roles;
      const t = s.p.stf.accessToken;
      const before = await snapshot(s);
      const results = {
        // manage_members
        "PATCH members/{staff}": (
          await send("patch", `${o}/members/${s.p.staffX.id}`, t, { roleId: R.Admin.id })
        ).status,
        "DELETE members/{staff}": (await send("delete", `${o}/members/${s.p.staffY.id}`, t)).status,
        "POST invitations (Staff role)": (
          await send("post", `${o}/invitations`, t, { email: inviteEmail(), roleId: R.Staff.id })
        ).status,
        "POST invitations/{staff}/link": (
          await send("post", `${o}/invitations/${s.staffInvitationId}/link`, t)
        ).status,
        "GET members": (
          await request(app.server()).get(`${o}/members`).set("Authorization", `Bearer ${t}`)
        ).status,
        // manage_org_settings
        "PATCH org": (await send("patch", o, t, { name: `renamed-by-staff-${randomUUID()}` }))
          .status,
        "PUT tax-profile": (
          await send("put", `${o}/tax-profile`, t, {
            entityType: "company",
            taxId: "0105556000009",
            vatRegistered: false,
            branchCode: "00000",
          })
        ).status,
        // JSON body, as the real client sends it: a body-less POST answers 415
        // once past the guard, which would hide what the guard decided.
        "POST tax-profile/reveal": (await send("post", `${o}/tax-profile/reveal`, t, {})).status,
        // F-001's @UserScoped path — its own check, its own 404-never-403 shape.
        "POST members/{staff}/reset-password": (
          await send("post", `${o}/members/${s.p.staffZ.id}/reset-password`, t, {
            newPassword: NEW_PASSWORD,
          })
        ).status,
      };
      expect(results).toEqual({
        "PATCH members/{staff}": 403,
        "DELETE members/{staff}": 403,
        "POST invitations (Staff role)": 403,
        "POST invitations/{staff}/link": 403,
        "GET members": 403,
        "PATCH org": 403,
        "PUT tax-profile": 403,
        "POST tax-profile/reveal": 403,
        "POST members/{staff}/reset-password": 404,
      });
      expect(await snapshot(s)).toEqual(before);
    });

    it("★ Admin (manage_members, no full_access) is refused on every Owner-only route, and nothing is written", async () => {
      const s = await shop(state);
      const before = await snapshot(s);
      expect(await ownerOnly(s, s.p.adm, inviteEmail())).toEqual(REFUSED);
      expect(await snapshot(s)).toEqual(before);
    });

    it("control: Admin's refusals are the Owner-only rule — the same verbs on non-Owner targets succeed", async () => {
      // Without this, "Admin got 403" could mean a malformed body, a wrong
      // path, or a rate limit. Same shop layout, same actor, same six verbs.
      const s = await shop(state);
      const o = `/orgs/${s.org.id}`;
      const R = s.org.roles;
      const a = s.p.adm.accessToken;
      // R3-04 (F-003 AC-5.4b · D-034): Staff first, THEN Admin. F-002 promoted
      // staffX to Admin and demoted them back; under D-034 the demote-back is
      // `403 TARGET_NOT_BELOW_ACTOR` by design (staffX is then equal to the
      // actor) — pinned in members.f003.e2e.int.test.ts, not a control here.
      const results = [
        (await send("patch", `${o}/members/${s.p.staffX.id}`, a, { roleId: R.Staff.id })).status,
        (await send("patch", `${o}/members/${s.p.staffX.id}`, a, { roleId: R.Admin.id })).status,
        (await send("delete", `${o}/members/${s.p.staffY.id}`, a)).status,
        (await send("post", `${o}/invitations`, a, { email: inviteEmail(), roleId: R.Staff.id }))
          .status,
        (await send("post", `${o}/invitations/${s.staffInvitationId}/link`, a)).status,
        (
          await send("post", `${o}/members/${s.p.staffZ.id}/reset-password`, a, {
            newPassword: NEW_PASSWORD,
          })
        ).status,
      ];
      expect(results).toEqual([200, 200, 200, 201, 200, 200]);
    });

    it("★ Owner — whatever its key says — performs every Owner-only route, and the writes land", async () => {
      const s = await shop(state);
      const before = await snapshot(s);
      const email = inviteEmail();
      const outcomes = await ownerOnly(s, s.p.own, email);
      expect(outcomes.map((x) => [x.route, x.status])).toEqual([
        ["R1 PATCH promote→Owner", 200],
        ["R2 PATCH demote Owner", 200],
        ["R3 DELETE Owner", 200],
        ["R4 POST invite as Owner", 201],
        ["R5 POST reissue Owner invitation", 200],
        ["R6 POST reset Owner password", 200],
      ]);

      // Status codes alone would be satisfied by an endpoint that answers 200
      // and writes nothing. Ask the database.
      const R = s.org.roles;
      const after = await snapshot(s);
      const m = (userId: string) => after.memberships.find((x) => x.userId === userId)!;
      expect(m(s.p.promotee.id)).toMatchObject({ roleId: R.Owner.id, status: "active" });
      expect(m(s.p.ownerB.id)).toMatchObject({ roleId: R.Staff.id, status: "active" });
      expect(m(s.p.ownerA.id).status).toBe("revoked");
      expect(after.invitations.find((i) => i.email === email)).toMatchObject({
        roleId: R.Owner.id,
        status: "pending",
      });
      const inv = (x: typeof before) => x.invitations.find((i) => i.id === s.ownerInvitationId)!;
      expect(inv(after).tokenHash).not.toBe(inv(before).tokenHash);
      expect(passwordOf(after, s.p.ownerC.id)).not.toBe(passwordOf(before, s.p.ownerC.id));
    });
  });
});
