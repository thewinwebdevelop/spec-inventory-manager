// F-003 · T-003-B26b ★ — concurrency + events of the role-write surface on the REAL stack.
//
// Every race here is ordered by a REAL barrier (`tx-barrier.kit.ts`): the first request is
// paused at a named point (before its transaction · holding the org lock · around one Prisma
// call · before COMMIT), the second is started and — where it must wait — proven to be blocked
// ON THE FIRST ONE'S BACKEND (`pg_blocking_pids`), then the first is released. No sleep orders
// anything. Each race is run in BOTH directions and the outcome must match the commit order.
//
//   IC3-01  two PATCHes of one role with the same `version` → one 200, one 409 ROLE_CHANGED;
//           final caps = the winner's (both directions).
//   IC3-03  SR-08: a role write past the guard, not yet locked ‖ the Owner removes the actor's
//           manage_roles → 403 FORBIDDEN, nothing written · reversed: the write holds the lock →
//           the Owner's edit waits, the write wins.
//   IC3-04  Addendum 2: same barrier, the Owner removes manage_members → 403
//           ROLE_HELD_REQUIRES_MANAGE_MEMBERS · and the role had no holder when the request
//           started but C is moved in before it locks → 403 · both reversed.
//   IC3-05  edit R (= A, no other holder) ‖ move C into R: edit first → the move is decided on
//           the NEW caps · move first → the edit counts C and is refused.
//   IC3-06  arch §13.7(9) + §1.3 race: accept an invitation to R ‖ edit R (holder count) ·
//           accept ‖ demote the inviter (D-035) · accept ‖ the Owner RAISING R above a non-Owner
//           issuer (D-035 role-edit leg, review B26 M-1) — both directions each.
//   IC3-07  delete R ‖ invite with R (app level, both directions) · SR-06 at the SQL level,
//           skipping the org lock, both directions × 4 reference writers (Membership INSERT ·
//           Membership UPDATE roleId · Membership UPDATE status revoked→active · Invitation
//           INSERT): the trigger refuses the later writer — RED if `FOR SHARE` is removed from
//           `omnistock_role_live_reference_guard` (no waiter forms), or if a trigger binding is
//           narrowed (e.g. Membership BEFORE INSERT only, Invitation trigger dropped).
//   IC3-08  the org lock held past `lock_timeout` → POST / PATCH / DELETE role = 409 CONFLICT
//           {reason:"busy"}, nothing written, no event, another shop unaffected, recovery.
//   B25-L1  (security review B25, carried) a trigger refusal on a writer that skips the org
//           lock answers 500 INTERNAL + error log, by decision (data-model §3.3: "error จาก
//           trigger → 500 INTERNAL + error log") — pinned for invite-create and role-delete.
//   I3-48   org.role.created/updated/deleted: strict payload keys, before/after,
//           affectedActiveMembers, invitationsShortened · post-commit: a tx that fails AFTER
//           the write emits nothing and leaves the row as it was.
//   I3-49   escalation_denied on all 15 route × reason cells of test-plan §5.3 · set-equality
//           ESCALATION_CHECKED_OPERATIONS = the operations the decider spies saw on non-GET
//           routes · and NOT for: Owner ROLE_LOCKED · requires_manage_members · ROLE_EMPTY ·
//           UNKNOWN_CAPABILITY · a taken name · ROLE_CHANGED · 503.
//   I3-51   dedupe on the real Redis: the same key 3× → 1 event, suppressed metric +2; another
//           targetUserId → its own event.
//
// Already proved elsewhere (not repeated): IC3-02 (reset ‖ PATCH member, SR-05) —
// admin-reset.f003.e2e.int.test.ts · IC-B24 / IC-B25 (role write ‖ admin-reset lock order) —
// f003-role-update / f003-role-delete · F-002's 13 races — concurrency-matrix.int.test.ts.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import { Redis } from "ioredis";
import { Logger } from "@nestjs/common";
import { ORG_TX_TIMEOUTS } from "@omnistock/config";
import { PrismaClient } from "@omnistock/db";
import { decideMemberAuthority, decideRoleWrite } from "@omnistock/core-domain";
import { AccessTokenService } from "../src/auth/access-token.service";
import { enumerateRoutes } from "../src/common/authz";
import {
  ESCALATION_CHECKED_OPERATIONS,
  NESTED_PAYLOAD_KEYS,
  SECURITY_EVENT_PAYLOAD_KEYS,
  collectSecurityEvents,
  type SecurityEventCollector,
} from "../src/auth/security-events.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { ORG_PRISMA, OrgContextStore } from "../src/tenancy";
import { createOrgPrismaProxy } from "../src/tenancy/org-prisma.provider";
import { INT_LANE_ENABLED, createTestApp, type TestApp } from "./app.kit";
import { createF003SeedKit, personaRoleSpecs, type F003SeedKit } from "./f003-seed.kit";
import type { SeededOrg, SeededRole, SeededUser } from "./f002-seed.kit";
import { TxBarrier, waitUntilBlockedBy, within, type Gate } from "./tx-barrier.kit";

vi.mock("@omnistock/core-domain", async (importOriginal) => {
  const real = await importOriginal<typeof import("@omnistock/core-domain")>();
  return {
    ...real,
    // Call-through spies: I3-49 reads WHICH operations the write paths decide.
    decideRoleWrite: vi.fn(real.decideRoleWrite),
    decideMemberAuthority: vi.fn(real.decideMemberAuthority),
  };
});

const d = INT_LANE_ENABLED ? describe : describe.skip;
if (!INT_LANE_ENABLED) {
  console.warn(
    "[T-003-B26b] SKIPPING the F-003 concurrency suite: TEST_DATABASE_URL / TEST_REDIS_URL are " +
      "not set. IC3-01/03..08, SR-06 write-skew, I3-48/49/51 are NOT verified.",
  );
}

const HOUR = 3_600_000;
const SPECS = personaRoleSpecs();
type Res = request.Response;

d("T-003-B26b F-003 concurrency + events (E2E, DB+Redis)", () => {
  let on: TestApp;
  let prisma: PrismaClient; // test reads + kit
  let holderDb: PrismaClient; // a second pool: lock holders / lock-skipping SQL writers
  let redis: Redis;
  let kit: F003SeedKit;
  let sink: SecurityEventCollector;
  const barrier = new TxBarrier();
  const unique = () => Math.random().toString(36).slice(2, 8);

  const tokenOf = (userId: string) =>
    on.app.get(AccessTokenService, { strict: false }).sign(userId);
  const send = (method: "post" | "patch", path: string, userId: string, body: unknown) => {
    const agent = request(on.server());
    return agent[method]
      .call(agent, path)
      .set("Authorization", `Bearer ${tokenOf(userId)}`)
      .set("Content-Type", "application/json")
      .send(body as object);
  };
  const remove = (path: string, userId: string) =>
    request(on.server())
      .delete(path)
      .set("Authorization", `Bearer ${tokenOf(userId)}`);
  const patchRole = (org: SeededOrg, roleId: string, userId: string, body: unknown) =>
    send("patch", `/orgs/${org.id}/roles/${roleId}`, userId, body);
  const delRole = (org: SeededOrg, roleId: string, userId: string) =>
    remove(`/orgs/${org.id}/roles/${roleId}`, userId);
  const patchMember = (org: SeededOrg, actorId: string, targetId: string, roleId: string) =>
    send("patch", `/orgs/${org.id}/members/${targetId}`, actorId, { roleId });
  const invite = (org: SeededOrg, actorId: string, roleId: string) =>
    send("post", `/orgs/${org.id}/invitations`, actorId, {
      email: `b26b-${unique()}@seed.test`,
      roleId,
    });
  const accept = (user: SeededUser, rawToken: string) =>
    request(on.server())
      .post("/invitations/accept")
      .set(
        "X-Forwarded-For",
        `10.26.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
      )
      .set("Authorization", `Bearer ${tokenOf(user.id)}`)
      .set("Content-Type", "application/json")
      .send({ token: rawToken });
  const roleRow = (id: string) => prisma.role.findUniqueOrThrow({ where: { id } });
  const membershipOf = (orgId: string, userId: string) =>
    prisma.membership.findFirst({
      where: { organizationId: orgId, userId },
      select: { roleId: true, status: true },
    });
  const without = (caps: readonly string[], drop: string) => caps.filter((k) => k !== drop);
  const sorted = (caps: readonly string[]) => [...caps].sort();
  /**
   * supertest builds a request LAZILY — nothing is sent until something calls `.then`.
   * A request that must be in flight while the test waits on a gate is started here.
   */
  const started = (req: PromiseLike<Res>): Promise<Res> => Promise.resolve(req);
  const codeOf = (res: Res) => [res.status, res.body?.error?.code] as const;

  async function shop(people: Readonly<Record<string, "Owner" | "Admin" | "Staff">>) {
    const org = await kit.createOrg({ name: `b26b-${unique()}` });
    const u: Record<string, SeededUser> = {};
    for (const [name, roleName] of Object.entries(people)) {
      u[name] = await kit.createUser();
      await kit.addMember({
        organizationId: org.id,
        userId: u[name]!.id,
        roleId: org.roles[roleName]!.id,
      });
    }
    return { org, u };
  }
  const custom = (org: SeededOrg, capabilities: readonly string[]) =>
    kit.createCustomRole({ organizationId: org.id, name: `R ${unique()}`, capabilities });
  async function holder(org: SeededOrg, role: SeededRole) {
    const user = await kit.createUser();
    await kit.addMember({ organizationId: org.id, userId: user.id, roleId: role.id });
    return user;
  }

  /**
   * The ordering core: `first` is started and paused at `gate`; `second` is started and (when
   * `secondWaits`) must be blocked on the first one's backend; then the first is released.
   * Returns both answers and the order they arrived in.
   */
  async function race(
    gate: Gate,
    first: () => Promise<Res>,
    second: () => Promise<Res>,
    opts: { secondWaits: boolean; what: string },
  ): Promise<{ a: Res; b: Res; order: string[] }> {
    const order: string[] = [];
    const a = first().then((r) => (order.push("first"), r));
    const pid = await within(gate.reached, 4_000, `${opts.what}: the first request to pause`);
    let b: Promise<Res>;
    if (opts.secondWaits) {
      b = second().then((r) => (order.push("second"), r));
      // The second request queues on the ORG LOCK (its first statement) behind the first.
      await waitUntilBlockedBy(
        prisma,
        pid,
        /FROM "Organization"[\s\S]*FOR UPDATE/,
        `${opts.what}: second must wait`,
      );
      expect(order, `${opts.what}: nobody may answer while the first is paused`).toEqual([]);
      gate.release();
    } else {
      // The first holds nothing yet: the second runs to the END, then the first resumes.
      const done = await within(second(), 6_000, `${opts.what}: second must not wait`);
      order.push("second");
      b = Promise.resolve(done);
      gate.release();
    }
    const [ra, rb] = await Promise.all([a, b]);
    return { a: ra, b: rb, order };
  }

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    await prisma.$connect();
    holderDb = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    await holderDb.$connect();
    redis = new Redis(process.env.TEST_REDIS_URL!);
    const saved = process.env.ROLE_WRITES_ENABLED;
    process.env.ROLE_WRITES_ENABLED = "true";
    try {
      on = await createTestApp({
        // EVERY org-scoped service gets the barrier client — production code is untouched.
        configure: (b) =>
          b.overrideProvider(ORG_PRISMA).useFactory({
            factory: (p: PrismaService, store: OrgContextStore) =>
              barrier.wrap(
                createOrgPrismaProxy(p.client, store) as object,
                () => store.get()?.userId,
              ),
            inject: [PrismaService, OrgContextStore],
          }),
      });
    } finally {
      if (saved === undefined) delete process.env.ROLE_WRITES_ENABLED;
      else process.env.ROLE_WRITES_ENABLED = saved;
    }
    kit = createF003SeedKit(prisma, { label: "b26b" });
    sink = collectSecurityEvents(on.events);
  });

  afterEach(() => barrier.reset());

  afterAll(async () => {
    barrier.reset();
    sink?.stop();
    if (kit) await kit.cleanup();
    if (on) await on.close();
    if (prisma) await prisma.$disconnect();
    if (holderDb) await holderDb.$disconnect();
    if (redis) redis.disconnect();
  });

  // ── IC3-01 · optimistic concurrency ───────────────────────────────────────

  describe("IC3-01 · two PATCHes with the same version", () => {
    for (const winner of ["own", "adm"] as const) {
      it(`${winner} commits first → 200; the other → 409 ROLE_CHANGED {currentVersion:2}; caps = the winner's`, async () => {
        const { org, u } = await shop({ own: "Owner", adm: "Admin" });
        const r = await custom(org, ["manage_orders", "manage_products"]);
        const loser = winner === "own" ? "adm" : "own";
        const capsOf = { own: ["manage_orders"], adm: ["manage_products"] } as const;
        sink.clear();
        const gate = barrier.arm(u[winner]!.id, { at: "afterOrgLock" });
        const { a, b } = await race(
          gate,
          () => patchRole(org, r.id, u[winner]!.id, { version: 1, capabilities: capsOf[winner] }),
          () => patchRole(org, r.id, u[loser]!.id, { version: 1, capabilities: capsOf[loser] }),
          { secondWaits: true, what: "IC3-01" },
        );
        expect(a.status, JSON.stringify(a.body)).toBe(200);
        expect(codeOf(b)).toEqual([409, "ROLE_CHANGED"]);
        expect(b.body.error.details).toEqual({ currentVersion: 2 });
        const row = await roleRow(r.id);
        expect([row.version, row.capabilities]).toEqual([2, [...capsOf[winner]]]);
        expect(sink.ofType("org.role.updated")).toHaveLength(1);
      });
    }
  });

  // ── IC3-03 · SR-08 — the manage_roles floor is read in the tx ─────────────

  describe("IC3-03 · SR-08: manage_roles removed while a role write waits", () => {
    async function setup() {
      const { org, u } = await shop({ own: "Owner" });
      const rA = await custom(org, SPECS.R_B); // A's own role = Admin's caps, A alone
      const a = await holder(org, rA);
      const target = await custom(org, ["manage_orders"]);
      return { org, u, a, rA, target };
    }

    it("(a) past the guard, not yet locked ‖ the Owner strips manage_roles and commits → 403 FORBIDDEN · no write", async () => {
      const { org, u, a, rA, target } = await setup();
      const before = await roleRow(target.id);
      sink.clear();
      const gate = barrier.arm(a.id, { at: "beforeTx" });
      const { a: edit, b: strip } = await race(
        gate,
        () => patchRole(org, target.id, a.id, { version: 1, name: `T ${unique()}` }),
        () =>
          patchRole(org, rA.id, u.own!.id, {
            version: 1,
            capabilities: without(SPECS.R_B, "manage_roles"),
          }),
        { secondWaits: false, what: "IC3-03a" },
      );
      expect(strip.status, JSON.stringify(strip.body)).toBe(200);
      expect(codeOf(edit)).toEqual([403, "FORBIDDEN"]);
      expect(await roleRow(target.id)).toEqual(before);
      expect(sink.ofType("org.role.updated").map((e) => e.payload.roleId)).toEqual([rA.id]);
    });

    it("(b) reversed: the write holds the org lock → the Owner's strip waits → write 200 first, strip 200 after", async () => {
      const { org, u, a, rA, target } = await setup();
      const gate = barrier.arm(a.id, { at: "afterOrgLock" });
      const {
        a: edit,
        b: strip,
        order,
      } = await race(
        gate,
        () => patchRole(org, target.id, a.id, { version: 1, name: `T ${unique()}` }),
        () =>
          patchRole(org, rA.id, u.own!.id, {
            version: 1,
            capabilities: without(SPECS.R_B, "manage_roles"),
          }),
        { secondWaits: true, what: "IC3-03b" },
      );
      expect(edit.status, JSON.stringify(edit.body)).toBe(200);
      expect(strip.status, JSON.stringify(strip.body)).toBe(200);
      expect(order[0]).toBe("first");
    });
  });

  // ── IC3-04 · Addendum 2 — the manage_members floor + holders, read in the tx ──

  describe("IC3-04 · Addendum 2 under a race", () => {
    it("(a) A's edit of R_T (held by T) waits before the lock ‖ the Owner strips A's manage_members → 403 ROLE_HELD_REQUIRES_MANAGE_MEMBERS", async () => {
      const { org, u } = await shop({ own: "Owner" });
      const capsA = ["manage_roles", "manage_members", "manage_orders", "manage_products"];
      const rA = await custom(org, capsA);
      const a = await holder(org, rA);
      const rT = await custom(org, SPECS.R_T);
      await holder(org, rT);
      const before = await roleRow(rT.id);
      const gate = barrier.arm(a.id, { at: "beforeTx" });
      const { a: edit, b: strip } = await race(
        gate,
        () =>
          patchRole(org, rT.id, a.id, {
            version: 1,
            capabilities: ["manage_orders", "manage_products"],
          }),
        () =>
          patchRole(org, rA.id, u.own!.id, {
            version: 1,
            capabilities: without(capsA, "manage_members"),
          }),
        { secondWaits: false, what: "IC3-04a" },
      );
      expect(strip.status, JSON.stringify(strip.body)).toBe(200);
      expect(codeOf(edit)).toEqual([403, "ROLE_HELD_REQUIRES_MANAGE_MEMBERS"]);
      expect(await roleRow(rT.id)).toEqual(before);
    });

    it("(a′) reversed: A's edit holds the lock → the strip waits → edit 200 (A still had manage_members)", async () => {
      const { org, u } = await shop({ own: "Owner" });
      const capsA = ["manage_roles", "manage_members", "manage_orders", "manage_products"];
      const rA = await custom(org, capsA);
      const a = await holder(org, rA);
      const rT = await custom(org, SPECS.R_T);
      await holder(org, rT);
      const gate = barrier.arm(a.id, { at: "afterOrgLock" });
      const { a: edit, b: strip } = await race(
        gate,
        () =>
          patchRole(org, rT.id, a.id, {
            version: 1,
            capabilities: ["manage_orders", "manage_products"],
          }),
        () =>
          patchRole(org, rA.id, u.own!.id, {
            version: 1,
            capabilities: without(capsA, "manage_members"),
          }),
        { secondWaits: true, what: "IC3-04a′" },
      );
      expect(edit.status, JSON.stringify(edit.body)).toBe(200);
      expect(strip.status, JSON.stringify(strip.body)).toBe(200);
    });

    it("(b) M's edit of an UNHELD role waits before the lock ‖ the Owner moves C into it → 403 ROLE_HELD_REQUIRES_MANAGE_MEMBERS", async () => {
      const { org, u } = await shop({ own: "Owner", c: "Staff" });
      const m = await holder(org, await custom(org, SPECS.R_MR));
      const r = await custom(org, ["manage_orders", "manage_products"]);
      const before = await roleRow(r.id);
      const gate = barrier.arm(m.id, { at: "beforeTx" });
      const { a: edit, b: move } = await race(
        gate,
        () => patchRole(org, r.id, m.id, { version: 1, capabilities: ["manage_orders"] }),
        () => patchMember(org, u.own!.id, u.c!.id, r.id),
        { secondWaits: false, what: "IC3-04b" },
      );
      expect(move.status, JSON.stringify(move.body)).toBe(200);
      expect(codeOf(edit)).toEqual([403, "ROLE_HELD_REQUIRES_MANAGE_MEMBERS"]);
      expect(await roleRow(r.id)).toEqual(before);
    });

    it("(b′) reversed: M's edit holds the lock → the move waits → edit 200, then C lands on the edited role", async () => {
      const { org, u } = await shop({ own: "Owner", c: "Staff" });
      const m = await holder(org, await custom(org, SPECS.R_MR));
      const r = await custom(org, ["manage_orders", "manage_products"]);
      const gate = barrier.arm(m.id, { at: "afterOrgLock" });
      const { a: edit, b: move } = await race(
        gate,
        () => patchRole(org, r.id, m.id, { version: 1, capabilities: ["manage_orders"] }),
        () => patchMember(org, u.own!.id, u.c!.id, r.id),
        { secondWaits: true, what: "IC3-04b′" },
      );
      expect(edit.status, JSON.stringify(edit.body)).toBe(200);
      expect(move.status, JSON.stringify(move.body)).toBe(200);
      expect(await membershipOf(org.id, u.c!.id)).toEqual({ roleId: r.id, status: "active" });
      expect((await roleRow(r.id)).capabilities).toEqual(["manage_orders"]);
    });
  });

  // ── IC3-05 · edit R ‖ move C into R ────────────────────────────────────────

  describe("IC3-05 · edit R (= A, nobody else holds it) ‖ PATCH member moves C into R", () => {
    /** Owner · Admin A · X = {manage_members, manage_orders} · C on {manage_orders} · R = Admin's caps, unheld. */
    async function setup() {
      const { org, u } = await shop({ own: "Owner", a: "Admin" });
      const x = await holder(org, await custom(org, ["manage_members", "manage_orders"]));
      const c = await holder(org, await custom(org, ["manage_orders"]));
      const r = await custom(org, SPECS.R_B);
      return { org, u, x, c, r };
    }

    it("control · on R's CURRENT caps (= Admin) X may not move C into R → 403 ROLE_EXCEEDS_ACTOR", async () => {
      const { org, x, c, r } = await setup();
      expect(codeOf(await patchMember(org, x.id, c.id, r.id))).toEqual([403, "ROLE_EXCEEDS_ACTOR"]);
    });

    it("(a) the edit commits first (R → {manage_orders}) → X's move, which waited, is decided on the NEW caps → 200", async () => {
      const { org, u, x, c, r } = await setup();
      const gate = barrier.arm(u.a!.id, { at: "afterOrgLock" });
      const { a: edit, b: move } = await race(
        gate,
        () => patchRole(org, r.id, u.a!.id, { version: 1, capabilities: ["manage_orders"] }),
        () => patchMember(org, x.id, c.id, r.id),
        { secondWaits: true, what: "IC3-05a" },
      );
      expect(edit.status, JSON.stringify(edit.body)).toBe(200);
      expect(move.status, JSON.stringify(move.body)).toBe(200);
      expect(await membershipOf(org.id, c.id)).toEqual({ roleId: r.id, status: "active" });
    });

    it("(b) the move commits first (Owner moves C into R) → A's edit, which waited, counts C → 403 TARGET_NOT_BELOW_ACTOR · R unchanged", async () => {
      const { org, u, c, r } = await setup();
      const before = await roleRow(r.id);
      const gate = barrier.arm(u.own!.id, { at: "afterOrgLock" });
      const { a: move, b: edit } = await race(
        gate,
        () => patchMember(org, u.own!.id, c.id, r.id),
        () => patchRole(org, r.id, u.a!.id, { version: 1, capabilities: ["manage_orders"] }),
        { secondWaits: true, what: "IC3-05b" },
      );
      expect(move.status, JSON.stringify(move.body)).toBe(200);
      expect(codeOf(edit)).toEqual([403, "TARGET_NOT_BELOW_ACTOR"]);
      expect(await roleRow(r.id)).toEqual(before);
    });
  });

  // ── IC3-06 · accept ‖ edit R · accept ‖ demote the inviter (D-035 (9)) ────

  describe("IC3-06 ★ SR-F003-02 · accept races a capability edit / an inviter demotion (arch §13.7(9))", () => {
    async function inviteTo(org: SeededOrg, role: SeededRole, issuer: SeededUser) {
      const invitee = await kit.createUser();
      const inv = await kit.createInvitation({
        organizationId: org.id,
        email: invitee.email,
        roleId: role.id,
        issuedByUserId: issuer.id,
      });
      return { invitee, inv };
    }

    it("(a) accept into R commits first → A's edit of R (R = A) counts the newcomer → 403 TARGET_NOT_BELOW_ACTOR", async () => {
      const { org, u } = await shop({ own: "Owner", a: "Admin" });
      const r = await custom(org, SPECS.R_B);
      const before = await roleRow(r.id);
      const { invitee, inv } = await inviteTo(org, r, u.own!);
      const gate = barrier.arm(invitee.id, { at: "afterOrgLock" });
      const { a: accepted, b: edit } = await race(
        gate,
        () => accept(invitee, inv.rawToken),
        () => patchRole(org, r.id, u.a!.id, { version: 1, capabilities: ["manage_orders"] }),
        { secondWaits: true, what: "IC3-06a" },
      );
      expect(accepted.status, accepted.text).toBe(200);
      expect(codeOf(edit)).toEqual([403, "TARGET_NOT_BELOW_ACTOR"]);
      expect(await roleRow(r.id)).toEqual(before);
      expect(await membershipOf(org.id, invitee.id)).toEqual({ roleId: r.id, status: "active" });
    });

    it("(b) the edit of R commits first → the accept, which waited, joins R with the NEW caps", async () => {
      const { org, u } = await shop({ own: "Owner", a: "Admin" });
      const r = await custom(org, SPECS.R_B);
      const { invitee, inv } = await inviteTo(org, r, u.own!);
      const gate = barrier.arm(u.a!.id, { at: "afterOrgLock" });
      const { a: edit, b: accepted } = await race(
        gate,
        () => patchRole(org, r.id, u.a!.id, { version: 1, capabilities: ["manage_orders"] }),
        () => accept(invitee, inv.rawToken),
        { secondWaits: true, what: "IC3-06b" },
      );
      expect(edit.status, JSON.stringify(edit.body)).toBe(200);
      expect(edit.body).toMatchObject({ usage: { activeMembers: 0 } });
      expect(accepted.status, accepted.text).toBe(200);
      const joined = await prisma.membership.findFirstOrThrow({
        where: { organizationId: org.id, userId: invitee.id },
        select: { status: true, role: { select: { id: true, capabilities: true } } },
      });
      expect(joined).toEqual({
        status: "active",
        role: { id: r.id, capabilities: ["manage_orders"] },
      });
    });

    it("(c) D-035 (9): the inviter's demotion commits first → the accept, which waited, is 409 INVITATION_CANCELLED (inviter_not_authorized) · no membership", async () => {
      const { org, u } = await shop({ own: "Owner", a: "Admin" });
      const { invitee, inv } = await inviteTo(org, org.roles.Staff!, u.a!);
      sink.clear();
      const gate = barrier.arm(u.own!.id, { at: "afterOrgLock" });
      const { a: demote, b: accepted } = await race(
        gate,
        () => patchMember(org, u.own!.id, u.a!.id, org.roles.Staff!.id),
        () => accept(invitee, inv.rawToken),
        { secondWaits: true, what: "IC3-06c" },
      );
      expect(demote.status, JSON.stringify(demote.body)).toBe(200);
      expect(codeOf(accepted)).toEqual([409, "INVITATION_CANCELLED"]);
      expect(await membershipOf(org.id, invitee.id)).toBeNull();
      expect(
        (
          await prisma.invitation.findUniqueOrThrow({
            where: { id: inv.id },
            select: { status: true },
          })
        ).status,
      ).toBe("cancelled");
      expect(
        sink.ofType("org.invitation.accept_blocked_inviter").map((e) => e.payload),
      ).toMatchObject([
        { invitationId: inv.id, issuerUserId: u.a!.id, reason: "inviter_not_authorized" },
      ]);
    });

    it("(d) D-035 (9) reversed: the accept commits first → 200 · the demotion, which waited, then lands", async () => {
      const { org, u } = await shop({ own: "Owner", a: "Admin" });
      const { invitee, inv } = await inviteTo(org, org.roles.Staff!, u.a!);
      sink.clear();
      const gate = barrier.arm(invitee.id, { at: "afterOrgLock" });
      const { a: accepted, b: demote } = await race(
        gate,
        () => accept(invitee, inv.rawToken),
        () => patchMember(org, u.own!.id, u.a!.id, org.roles.Staff!.id),
        { secondWaits: true, what: "IC3-06d" },
      );
      expect(accepted.status, accepted.text).toBe(200);
      expect(demote.status, JSON.stringify(demote.body)).toBe(200);
      expect(await membershipOf(org.id, invitee.id)).toEqual({
        roleId: org.roles.Staff!.id,
        status: "active",
      });
      expect(sink.ofType("org.invitation.accept_blocked_inviter")).toEqual([]);
    });

    // (a)/(b) above race an edit against an OWNER-issued link, which passes the issuer
    // re-check whatever R becomes (§13.7(4)) — they prove the holder count, not D-035.
    // (e)/(f) are the D-035 leg of the role-edit race (security review B26 M-1): a
    // NON-Owner issuer, and an edit that RAISES R above that issuer while the accept runs.
    // Rule: arch §6.1 — issuer caps ⊉ invited role ⇒ cancelled, reason inviter_exceeds.
    it("(e) ★ D-035 role-edit leg: Admin A issued the link to R; the Owner's RAISE of R (+manage_billing) commits first → the accept, which waited, is 409 INVITATION_CANCELLED (inviter_exceeds) · no membership", async () => {
      const { org, u } = await shop({ own: "Owner", a: "Admin" });
      const r = await custom(org, ["manage_orders"]);
      const { invitee, inv } = await inviteTo(org, r, u.a!);
      sink.clear();
      const gate = barrier.arm(u.own!.id, { at: "afterOrgLock" });
      const { a: raise, b: accepted } = await race(
        gate,
        () =>
          patchRole(org, r.id, u.own!.id, {
            version: 1,
            capabilities: ["manage_orders", "manage_billing"],
          }),
        () => accept(invitee, inv.rawToken),
        { secondWaits: true, what: "IC3-06e" },
      );
      expect(raise.status, JSON.stringify(raise.body)).toBe(200);
      expect(codeOf(accepted)).toEqual([409, "INVITATION_CANCELLED"]);
      expect(await membershipOf(org.id, invitee.id)).toBeNull();
      expect(
        (
          await prisma.invitation.findUniqueOrThrow({
            where: { id: inv.id },
            select: { status: true },
          })
        ).status,
      ).toBe("cancelled");
      expect(
        sink.ofType("org.invitation.accept_blocked_inviter").map((e) => e.payload),
      ).toMatchObject([
        {
          invitationId: inv.id,
          issuerUserId: u.a!.id,
          reason: "inviter_exceeds",
          excessCapabilities: ["manage_billing"],
        },
      ]);
    });

    it("(f) D-035 role-edit leg reversed: the accept commits first → 200 on R as it was · the raise, which waited, then lands (the newcomer holds the raised role)", async () => {
      const { org, u } = await shop({ own: "Owner", a: "Admin" });
      const r = await custom(org, ["manage_orders"]);
      const { invitee, inv } = await inviteTo(org, r, u.a!);
      sink.clear();
      const gate = barrier.arm(invitee.id, { at: "afterOrgLock" });
      const { a: accepted, b: raise } = await race(
        gate,
        () => accept(invitee, inv.rawToken),
        () =>
          patchRole(org, r.id, u.own!.id, {
            version: 1,
            capabilities: ["manage_orders", "manage_billing"],
          }),
        { secondWaits: true, what: "IC3-06f" },
      );
      expect(accepted.status, accepted.text).toBe(200);
      expect(raise.status, JSON.stringify(raise.body)).toBe(200);
      expect(raise.body).toMatchObject({ usage: { activeMembers: 1 } });
      expect(await membershipOf(org.id, invitee.id)).toEqual({ roleId: r.id, status: "active" });
      expect(sink.ofType("org.invitation.accept_blocked_inviter")).toEqual([]);
    });
  });

  // ── IC3-07 · delete ‖ invite (app) + SR-06 (SQL, no org lock) ─────────────

  describe("IC3-07 ★ SR-F003-06 · delete a role ‖ give it to somebody", () => {
    it("(a) the invite commits first → the delete, which waited, is 409 ROLE_IN_USE {0, 1}", async () => {
      const { org, u } = await shop({ own: "Owner", a: "Admin" });
      const r = await custom(org, ["manage_orders"]);
      const gate = barrier.arm(u.a!.id, { at: "afterOrgLock" });
      const { a: invited, b: deleted } = await race(
        gate,
        () => invite(org, u.a!.id, r.id),
        () => delRole(org, r.id, u.own!.id),
        { secondWaits: true, what: "IC3-07a" },
      );
      expect(invited.status, JSON.stringify(invited.body)).toBe(201);
      expect(codeOf(deleted)).toEqual([409, "ROLE_IN_USE"]);
      expect(deleted.body.error.details).toEqual({ activeMembers: 0, pendingInvitations: 1 });
      expect((await roleRow(r.id)).deletedAt).toBeNull();
    });

    it("(b) the delete commits first → the invite, which waited, is 422 ROLE_INVALID · no invitation row", async () => {
      const { org, u } = await shop({ own: "Owner", a: "Admin" });
      const r = await custom(org, ["manage_orders"]);
      const gate = barrier.arm(u.own!.id, { at: "afterOrgLock" });
      const { a: deleted, b: invited } = await race(
        gate,
        () => delRole(org, r.id, u.own!.id),
        () => invite(org, u.a!.id, r.id),
        { secondWaits: true, what: "IC3-07b" },
      );
      expect(deleted.status, JSON.stringify(deleted.body)).toBe(200);
      expect(codeOf(invited)).toEqual([422, "ROLE_INVALID"]);
      expect(
        await prisma.invitation.count({ where: { organizationId: org.id, roleId: r.id } }),
      ).toBe(0);
    });

    /**
     * SR-06 at the SQL level: two connections, NO org lock (a future path that forgot it).
     * The first writer stays open in a transaction on `holderDb`; the second must WAIT on it
     * (that wait IS `FOR SHARE` in omnistock_role_live_reference_guard — the FK's FOR KEY SHARE
     * does not conflict with the delete's NO KEY UPDATE) and then be refused by the trigger.
     */
    async function openWriter(
      write: (tx: { $executeRawUnsafe: PrismaClient["$executeRawUnsafe"] }) => Promise<unknown>,
    ) {
      let reach!: (pid: number) => void;
      const reached = new Promise<number>((r) => (reach = r));
      let release!: () => void;
      const released = new Promise<void>((r) => (release = r));
      const done = holderDb.$transaction(
        async (tx) => {
          const [{ pid }] = await tx.$queryRawUnsafe<Array<{ pid: number }>>(
            "SELECT pg_backend_pid() AS pid",
          );
          await write(tx);
          reach(Number(pid));
          await released;
        },
        { timeout: 15_000, maxWait: 5_000 },
      );
      return { reached, release, done };
    }

    type RawExec = { $executeRawUnsafe: PrismaClient["$executeRawUnsafe"] };
    /**
     * Every writer of a LIVE reference the trigger guards (migration §4: INSERT and
     * UPDATE OF "roleId", status on Membership AND Invitation — security review B26 L-3).
     * The two UPDATE legs are the realistic lock-skipping writer: an INSERT's FK already
     * takes FOR KEY SHARE on "Organization", which the org lock blocks.
     */
    interface Leg {
      readonly name: string;
      readonly statement: RegExp;
      prepare(org: SeededOrg, r: SeededRole): Promise<(db: RawExec) => Promise<unknown>>;
      liveRefs(org: SeededOrg, r: SeededRole): Promise<number>;
    }
    const activeOn = (org: SeededOrg, r: SeededRole) =>
      prisma.membership.count({
        where: { organizationId: org.id, roleId: r.id, status: "active" },
      });
    const LEGS: readonly Leg[] = [
      {
        name: "Membership INSERT (active)",
        statement: /INSERT INTO "Membership"/,
        async prepare(org, r) {
          const newcomer = await kit.createUser();
          return (db) =>
            db.$executeRawUnsafe(
              `INSERT INTO "Membership" (id, "organizationId", "userId", "roleId", status, "activatedAt", "updatedAt")
               VALUES ($1, $2, $3, $4, 'active', now(), now())`,
              `b26b_${unique()}${unique()}`,
              org.id,
              newcomer.id,
              r.id,
            );
        },
        liveRefs: activeOn,
      },
      {
        name: "Membership UPDATE roleId (an active member moved onto R)",
        statement: /UPDATE "Membership" SET "roleId"/,
        async prepare(org, r) {
          const mover = await holder(org, org.roles.Staff!);
          return (db) =>
            db.$executeRawUnsafe(
              `UPDATE "Membership" SET "roleId" = $1, "updatedAt" = now()
                WHERE "organizationId" = $2 AND "userId" = $3`,
              r.id,
              org.id,
              mover.id,
            );
        },
        liveRefs: activeOn,
      },
      {
        name: "Membership UPDATE status (a revoked holder of R reactivated)",
        statement: /UPDATE "Membership" SET status/,
        async prepare(org, r) {
          const gone = await kit.createUser();
          await kit.addMember({
            organizationId: org.id,
            userId: gone.id,
            roleId: r.id,
            status: "revoked",
            revokedAt: new Date(),
          });
          return (db) =>
            db.$executeRawUnsafe(
              `UPDATE "Membership" SET status = 'active', "revokedAt" = NULL, "updatedAt" = now()
                WHERE "organizationId" = $1 AND "userId" = $2`,
              org.id,
              gone.id,
            );
        },
        liveRefs: activeOn,
      },
      {
        name: "Invitation INSERT (pending)",
        statement: /INSERT INTO "Invitation"/,
        async prepare(org, r) {
          return (db) =>
            db.$executeRawUnsafe(
              `INSERT INTO "Invitation" (id, "organizationId", email, "roleId", status, "tokenHash", "expiresAt", "updatedAt")
               VALUES ($1, $2, $3, $4, 'pending', $5, now() + interval '7 days', now())`,
              `b26b_${unique()}${unique()}`,
              org.id,
              `b26b-sr06-${unique()}@seed.test`,
              r.id,
              `b26b-sr06-${unique()}${unique()}${unique()}`,
            );
        },
        liveRefs: (org, r) =>
          prisma.invitation.count({
            where: { organizationId: org.id, roleId: r.id, status: "pending" },
          }),
      },
    ];
    const softDeleteSql = (db: RawExec, org: SeededOrg, r: SeededRole) =>
      db.$executeRawUnsafe(
        `UPDATE "Role" SET "deletedAt" = now() WHERE id = $1 AND "organizationId" = $2`,
        r.id,
        org.id,
      );
    const settle = (p: Promise<unknown>) =>
      p.then(
        () => "committed",
        (e: unknown) => String(e),
      );

    for (const leg of LEGS) {
      it(`(c) SR-06 delete first (raw UPDATE deletedAt, open) ‖ ${leg.name} → the reference WAITS (FOR SHARE), then f003_role_deleted · nothing live on the deleted role`, async () => {
        const { org } = await shop({ own: "Owner" });
        const r = await custom(org, ["manage_orders"]);
        const writeRef = await leg.prepare(org, r);
        const writer = await openWriter((tx) => softDeleteSql(tx, org, r));
        try {
          const pid = await within(writer.reached, 4_000, "the raw delete to be open");
          const ref = settle(writeRef(prisma));
          await waitUntilBlockedBy(
            prisma,
            pid,
            leg.statement,
            `${leg.name} must wait on the open delete`,
          );
          writer.release();
          await writer.done;
          expect(await ref).toMatch(/f003_role_deleted/);
        } finally {
          writer.release();
        }
        expect((await roleRow(r.id)).deletedAt).not.toBeNull();
        expect(await leg.liveRefs(org, r)).toBe(0);
      });

      it(`(d) SR-06 reference first (${leg.name}, open) ‖ raw UPDATE deletedAt → the delete WAITS (FOR SHARE), then f003_role_in_use · the role stays live`, async () => {
        const { org } = await shop({ own: "Owner" });
        const r = await custom(org, ["manage_orders"]);
        const writeRef = await leg.prepare(org, r);
        const writer = await openWriter((tx) => writeRef(tx));
        try {
          const pid = await within(writer.reached, 4_000, `${leg.name} to be open`);
          const del = settle(softDeleteSql(prisma, org, r));
          await waitUntilBlockedBy(
            prisma,
            pid,
            /UPDATE "Role" SET "deletedAt"/,
            `the soft-delete must wait on the open ${leg.name}`,
          );
          writer.release();
          await writer.done;
          expect(await del).toMatch(/f003_role_in_use/);
        } finally {
          writer.release();
        }
        expect((await roleRow(r.id)).deletedAt).toBeNull();
        expect(await leg.liveRefs(org, r)).toBe(1);
      });
    }
  });

  // ── IC3-08 · busy ─────────────────────────────────────────────────────────

  it(
    "IC3-08 · the org lock held past lock_timeout → POST / PATCH / DELETE role = 409 CONFLICT {reason:busy} · nothing written · no event · other shop fine · recovers",
    async () => {
      const held = await shop({ own: "Owner" });
      const other = await shop({ own: "Owner" });
      const r = await custom(held.org, ["manage_orders"]);
      const before = await roleRow(r.id);
      const rolesBefore = await prisma.role.count({ where: { organizationId: held.org.id } });
      let release!: () => void;
      const released = new Promise<void>((res) => (release = res));
      let acquired!: () => void;
      const isHeld = new Promise<void>((res) => (acquired = res));
      const holding = holderDb.$transaction(
        async (tx) => {
          await tx.$queryRawUnsafe(
            'SELECT id FROM "Organization" WHERE id = $1 FOR UPDATE',
            held.org.id,
          );
          acquired();
          await released;
        },
        { timeout: 60_000, maxWait: 5_000 },
      );
      try {
        await isHeld;
        sink.clear();
        // One at a time (as I-C-13): each must give up on POLICY (lock_timeout), not hang.
        const shots: Array<[string, () => PromiseLike<Res>]> = [
          [
            "POST",
            () =>
              send("post", `/orgs/${held.org.id}/roles`, held.u.own!.id, {
                name: `Busy ${unique()}`,
                capabilities: ["manage_orders"],
              }),
          ],
          [
            "PATCH",
            () =>
              patchRole(held.org, r.id, held.u.own!.id, { version: 1, name: `Busy ${unique()}` }),
          ],
          ["DELETE", () => delRole(held.org, r.id, held.u.own!.id)],
        ];
        for (const [verb, fire] of shots) {
          const t0 = Date.now();
          const res = await fire();
          const elapsed = Date.now() - t0;
          expect(codeOf(res), `${verb}: ${JSON.stringify(res.body)}`).toEqual([409, "CONFLICT"]);
          expect(res.body.error.details, verb).toEqual({ reason: "busy" });
          expect(JSON.stringify(res.body), verb).not.toMatch(/55P03|Organization/);
          expect(elapsed, verb).toBeGreaterThanOrEqual(ORG_TX_TIMEOUTS.lockTimeoutMs - 100);
          expect(elapsed, verb).toBeLessThan(ORG_TX_TIMEOUTS.lockTimeoutMs + 2_500);
        }
        expect(await roleRow(r.id)).toEqual(before);
        expect(await prisma.role.count({ where: { organizationId: held.org.id } })).toBe(
          rolesBefore,
        );
        expect(sink.events.filter((e) => e.type.startsWith("org.role."))).toEqual([]);
        // another shop is not behind this shop's lock
        const fine = await patchRole(other.org, other.org.roles.Staff!.id, other.u.own!.id, {
          version: 1,
          name: `Fine ${unique()}`,
        });
        expect(fine.status, JSON.stringify(fine.body)).toBe(200);
      } finally {
        release();
        await holding;
      }
      const recovered = await patchRole(held.org, r.id, held.u.own!.id, {
        version: 1,
        name: `Back ${unique()}`,
      });
      expect(recovered.status, JSON.stringify(recovered.body)).toBe(200);
    },
    3 * ORG_TX_TIMEOUTS.lockTimeoutMs + 30_000,
  );

  // ── B25-L1 · a trigger refusal is a 500 by decision ───────────────────────

  describe("B25-L1 · a writer that skips the org lock meets the trigger → 500 INTERNAL + error log (data-model §3.3)", () => {
    function errorLog() {
      return vi.spyOn(Logger.prototype, "error");
    }
    const loggedWith = (spy: ReturnType<typeof errorLog>, token: RegExp) =>
      spy.mock.calls.some(
        (c) => /status=500 code=INTERNAL/.test(String(c[0])) && token.test(String(c[1])),
      );
    const expectOpaque500 = (res: Res) => {
      expect(codeOf(res), JSON.stringify(res.body)).toEqual([500, "INTERNAL"]);
      expect(JSON.stringify(res.body)).not.toMatch(
        /f003_|restrict|23001|Role|Membership|Invitation/,
      );
    };

    it("invite-create: the role is soft-deleted by raw SQL between the live read and the INSERT → 500 INTERNAL · no invitation row · error logged with f003_role_deleted", async () => {
      const { org, u } = await shop({ own: "Owner" });
      const r = await custom(org, ["manage_orders"]);
      const spy = errorLog();
      try {
        const gate = barrier.arm(u.own!.id, {
          at: "beforeCall",
          model: "invitation",
          method: "create",
        });
        const pending = started(invite(org, u.own!.id, r.id));
        await within(gate.reached, 4_000, "the invite to reach its INSERT");
        await prisma.$executeRawUnsafe(
          `UPDATE "Role" SET "deletedAt" = now() WHERE id = $1 AND "organizationId" = $2`,
          r.id,
          org.id,
        );
        gate.release();
        const res = await pending;
        expectOpaque500(res);
        expect(
          await prisma.invitation.count({ where: { organizationId: org.id, roleId: r.id } }),
        ).toBe(0);
        expect(loggedWith(spy, /f003_role_deleted/)).toBe(true);
      } finally {
        spy.mockRestore();
      }
    });

    // NOTE: the lock-skipping writer here is an UPDATE of an existing membership's roleId.
    // An INSERT cannot get in: its FK to "Organization" takes FOR KEY SHARE on the org row,
    // which conflicts with the delete's org FOR UPDATE — the org lock serializes it anyway.
    it("★ I3-48 post-commit (trigger leg) · role-delete: an ACTIVE member is moved onto the role by raw SQL after the in-use count → 500 INTERNAL · the role stays live · NO org.role.deleted", async () => {
      const { org, u } = await shop({ own: "Owner", mover: "Staff" });
      const r = await custom(org, ["manage_orders"]);
      const spy = errorLog();
      try {
        sink.clear();
        const gate = barrier.arm(u.own!.id, {
          at: "beforeCall",
          model: "role",
          method: "updateMany",
        });
        const pending = started(delRole(org, r.id, u.own!.id));
        await within(gate.reached, 4_000, "the delete to reach its UPDATE");
        await prisma.$executeRawUnsafe(
          `UPDATE "Membership" SET "roleId" = $1, "updatedAt" = now()
            WHERE "organizationId" = $2 AND "userId" = $3 AND status = 'active'`,
          r.id,
          org.id,
          u.mover!.id,
        );
        gate.release();
        const res = await pending;
        expectOpaque500(res);
        expect((await roleRow(r.id)).deletedAt).toBeNull();
        expect(sink.ofType("org.role.deleted")).toEqual([]);
        expect(loggedWith(spy, /f003_role_in_use/)).toBe(true);
      } finally {
        spy.mockRestore();
      }
    });
  });

  // ── I3-48 · success events ────────────────────────────────────────────────

  describe("I3-48 · org.role.created / updated / deleted", () => {
    const keysOf = (p: Record<string, unknown>) => Object.keys(p).sort();

    it("created + updated + deleted: strict payload keys and values · affectedActiveMembers · invitationsShortened", async () => {
      const { org, u } = await shop({ own: "Owner", s1: "Staff", s2: "Staff" });
      const staff = await roleRow(org.roles.Staff!.id);
      const issued = new Date(Date.now() - 2 * HOUR);
      await kit.createInvitation({
        organizationId: org.id,
        email: `b26b-i348-${unique()}@seed.test`,
        roleId: staff.id,
        issuedByUserId: u.own!.id,
        tokenIssuedAt: issued,
        expiresAt: new Date(issued.getTime() + 168 * HOUR),
      });
      sink.clear();

      const name = `Picker ${unique()}`;
      const created = await send("post", `/orgs/${org.id}/roles`, u.own!.id, {
        name,
        capabilities: ["manage_stock", "manage_orders"],
      });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const upCaps = [...staff.capabilities, "manage_members"];
      const updated = await patchRole(org, staff.id, u.own!.id, {
        version: staff.version,
        capabilities: upCaps,
      });
      expect(updated.status, JSON.stringify(updated.body)).toBe(200);
      const deleted = await delRole(org, created.body.id, u.own!.id);
      expect(deleted.status, JSON.stringify(deleted.body)).toBe(200);

      const [c] = sink.ofType("org.role.created").map((e) => e.payload);
      const [up] = sink.ofType("org.role.updated").map((e) => e.payload);
      const [del] = sink.ofType("org.role.deleted").map((e) => e.payload);
      expect(keysOf(c!)).toEqual([...SECURITY_EVENT_PAYLOAD_KEYS["org.role.created"]].sort());
      expect(keysOf(up!)).toEqual([...SECURITY_EVENT_PAYLOAD_KEYS["org.role.updated"]].sort());
      expect(keysOf(del!)).toEqual([...SECURITY_EVENT_PAYLOAD_KEYS["org.role.deleted"]].sort());
      for (const side of ["before", "after"] as const) {
        expect(keysOf(up![side] as Record<string, unknown>)).toEqual(
          [...NESTED_PAYLOAD_KEYS["org.role.updated"]![side]!].sort(),
        );
      }
      const createdRow = await roleRow(created.body.id);
      expect(c).toEqual({
        actorUserId: u.own!.id,
        organizationId: org.id,
        roleId: created.body.id,
        name,
        capabilities: createdRow.capabilities,
      });
      const staffAfter = await roleRow(staff.id);
      expect(up).toEqual({
        actorUserId: u.own!.id,
        organizationId: org.id,
        roleId: staff.id,
        before: { name: staff.name, capabilities: staff.capabilities },
        after: { name: staff.name, capabilities: staffAfter.capabilities },
        affectedActiveMembers: 2, // s1 + s2 (the Owner does not hold Staff)
        invitationsShortened: 1,
      });
      expect(sorted(staffAfter.capabilities)).toEqual(sorted(upCaps));
      expect(del).toEqual({
        actorUserId: u.own!.id,
        organizationId: org.id,
        roleId: created.body.id,
        name,
        capabilities: createdRow.capabilities,
      });
    });

    it("★ post-commit: PATCH whose tx aborts after its last statement, before COMMIT (row write proven) → 500 · the row rolled back · NO org.role.updated", async () => {
      const { org, u } = await shop({ own: "Owner" });
      const r = await custom(org, ["manage_orders"]);
      const before = await roleRow(r.id);
      sink.clear();
      const gate = barrier.arm(u.own!.id, { at: "beforeCommit" });
      const pending = started(
        patchRole(org, r.id, u.own!.id, { version: 1, capabilities: ["manage_stock"] }),
      );
      await within(gate.reached, 4_000, "the PATCH to finish its callback");
      // Non-vacuity, ROW-level (review B26 L-2): the paused tx holds THIS row's write lock —
      // a table-level RowExclusiveLock would also be taken by an updateMany that matched 0 rows.
      const probe = await holderDb
        .$queryRawUnsafe('SELECT 1 FROM "Role" WHERE id = $1 FOR UPDATE NOWAIT', r.id)
        .then(
          () => "not locked",
          (e: unknown) => String(e),
        );
      expect(probe).toMatch(/55P03|could not obtain lock/);
      // Every statement of the callback ran (an emit inside it would have fired by now);
      // the barrier then throws INSIDE the callback, so Prisma rolls back instead of COMMIT.
      gate.failWith(new Error("b26b: COMMIT never happens"));
      const res = await pending;
      expect(codeOf(res)).toEqual([500, "INTERNAL"]);
      expect(await roleRow(r.id)).toEqual(before);
      expect(sink.events.filter((e) => e.type.startsWith("org.role."))).toEqual([]);
    });

    it("★ post-commit: POST whose tx aborts after its last statement, before COMMIT (row insert proven) → 500 · no row · NO org.role.created", async () => {
      const { org, u } = await shop({ own: "Owner" });
      const name = `Ghost ${unique()}`;
      sink.clear();
      const gate = barrier.arm(u.own!.id, { at: "beforeCommit" });
      const pending = started(
        send("post", `/orgs/${org.id}/roles`, u.own!.id, { name, capabilities: ["manage_orders"] }),
      );
      const pid = await within(gate.reached, 4_000, "the POST to finish its callback");
      // Non-vacuity, ROW-level (review B26 L-2): a second INSERT of the same live name waits
      // on the paused tx's uncommitted row (unique index Role_org_name_ci_live_key).
      const twinId = `b26b_${unique()}${unique()}`;
      const twin = holderDb
        .$executeRawUnsafe(
          `INSERT INTO "Role" (id, "organizationId", name, capabilities, "updatedAt")
           VALUES ($1, $2, $3, ARRAY['manage_orders'], now())`,
          twinId,
          org.id,
          name,
        )
        .then(
          () => "inserted",
          (e: unknown) => String(e),
        );
      await waitUntilBlockedBy(
        prisma,
        pid,
        /INSERT INTO "Role"/,
        "the twin INSERT must wait on the paused row",
      );
      gate.failWith(new Error("b26b: COMMIT never happens"));
      const res = await pending;
      expect(codeOf(res)).toEqual([500, "INTERNAL"]);
      // The paused row rolled back, so the twin went through — and is the ONLY row of that name.
      expect(await twin).toBe("inserted");
      expect(
        (
          await prisma.role.findMany({
            where: { organizationId: org.id, name },
            select: { id: true },
          })
        ).map((x) => x.id),
      ).toEqual([twinId]);
      expect(sink.events.filter((e) => e.type.startsWith("org.role."))).toEqual([]);
    });
  });

  // ── I3-49 · the 15 cells ──────────────────────────────────────────────────

  describe("I3-49 ★ escalation_denied on every route × reason cell (test-plan §5.3)", () => {
    const ROLE_OP: Record<string, string> = {
      create: "create_role",
      update: "update_role",
      delete: "delete_role",
    };
    const MEMBER_OP: Record<string, string> = {
      change_role: "change_member_role",
      remove: "remove_member",
      invite_create: "invite_create",
      invite_reissue: "invite_reissue",
      invite_cancel: "invite_cancel",
    };
    const roleSpy = vi.mocked(decideRoleWrite);
    const memberSpy = vi.mocked(decideMemberAuthority);

    it("15 cells, 1 event each with the right operation/reason · operations seen by the decider spies = ESCALATION_CHECKED_OPERATIONS · no event for the 7 non-escalations", async () => {
      const { org, u } = await shop({ own: "Owner", a: "Admin", b: "Admin", stf: "Staff" });
      const bill = await custom(org, SPECS.R_BILL); // ⊄ Admin, held by nobody
      const twin = await custom(org, SPECS.R_B); // = Admin, held by another member
      await holder(org, twin);
      const billInv = await kit.createInvitation({
        organizationId: org.id,
        email: `b26b-bill-${unique()}@seed.test`,
        roleId: bill.id,
        issuedByUserId: u.own!.id,
      });
      const o = `/orgs/${org.id}`;
      const A = u.a!.id;
      const staffId = org.roles.Staff!.id;
      const ownerRoleId = org.roles.Owner!.id;
      const staffCaps = org.roles.Staff!.capabilities;

      const cells: Array<[string, string, string, string, () => Promise<Res>]> = [
        // [operation, reason, expected code, label, request]
        [
          "create_role",
          "exceeds_actor",
          "ROLE_EXCEEDS_ACTOR",
          "POST manage_billing",
          () =>
            send("post", `${o}/roles`, A, {
              name: `X ${unique()}`,
              capabilities: ["manage_billing"],
            }),
        ],
        [
          "create_role",
          "full_access_reserved",
          "FULL_ACCESS_RESERVED",
          "POST full_access",
          () =>
            send("post", `${o}/roles`, A, { name: `X ${unique()}`, capabilities: ["full_access"] }),
        ],
        [
          "update_role",
          "exceeds_actor",
          "ROLE_EXCEEDS_ACTOR",
          "PATCH Staff + manage_billing",
          () =>
            patchRole(org, staffId, A, {
              version: 1,
              capabilities: [...staffCaps, "manage_billing"],
            }),
        ],
        [
          "update_role",
          "target_not_below_actor",
          "TARGET_NOT_BELOW_ACTOR",
          "PATCH twin (held)",
          () => patchRole(org, twin.id, A, { version: 1, name: `X ${unique()}` }),
        ],
        [
          "update_role",
          "full_access_reserved",
          "FULL_ACCESS_RESERVED",
          "PATCH Staff full_access",
          () => patchRole(org, staffId, A, { version: 1, capabilities: ["full_access"] }),
        ],
        [
          "update_role",
          "role_locked",
          "ROLE_LOCKED",
          "PATCH Owner role",
          () => patchRole(org, ownerRoleId, A, { version: 1, name: "Boss" }),
        ],
        [
          "delete_role",
          "exceeds_actor",
          "ROLE_EXCEEDS_ACTOR",
          "DELETE R_BILL",
          () => delRole(org, bill.id, A),
        ],
        [
          "delete_role",
          "target_not_below_actor",
          "TARGET_NOT_BELOW_ACTOR",
          "DELETE twin (held)",
          () => delRole(org, twin.id, A),
        ],
        [
          "delete_role",
          "role_locked",
          "ROLE_LOCKED",
          "DELETE Owner role",
          () => delRole(org, ownerRoleId, A),
        ],
        [
          "change_member_role",
          "target_not_below_actor",
          "TARGET_NOT_BELOW_ACTOR",
          "PATCH member Admin B",
          () => patchMember(org, A, u.b!.id, staffId),
        ],
        [
          "change_member_role",
          "exceeds_actor",
          "ROLE_EXCEEDS_ACTOR",
          "PATCH member Staff → R_BILL",
          () => patchMember(org, A, u.stf!.id, bill.id),
        ],
        [
          "remove_member",
          "target_not_below_actor",
          "TARGET_NOT_BELOW_ACTOR",
          "DELETE member Admin B",
          () => remove(`${o}/members/${u.b!.id}`, A),
        ],
        [
          "invite_create",
          "exceeds_actor",
          "ROLE_EXCEEDS_ACTOR",
          "POST invitation R_BILL",
          () => invite(org, A, bill.id),
        ],
        [
          "invite_reissue",
          "exceeds_actor",
          "ROLE_EXCEEDS_ACTOR",
          "reissue R_BILL link",
          () => send("post", `${o}/invitations/${billInv.id}/link`, A, {}),
        ],
        [
          "invite_cancel",
          "exceeds_actor",
          "ROLE_EXCEEDS_ACTOR",
          "cancel R_BILL invitation",
          () => remove(`${o}/invitations/${billInv.id}`, A),
        ],
      ];
      expect(cells).toHaveLength(15);

      const seenOps = new Set<string>();
      const emittedOps = new Set<string>();
      for (const [operation, reason, code, label, fire] of cells) {
        sink.clear();
        const r0 = roleSpy.mock.calls.length;
        const m0 = memberSpy.mock.calls.length;
        const res = await fire();
        expect(res.body?.error?.code, `${label}: ${JSON.stringify(res.body)}`).toBe(code);
        for (const [input] of roleSpy.mock.calls.slice(r0)) seenOps.add(ROLE_OP[input.op]!);
        for (const [input] of memberSpy.mock.calls.slice(m0)) {
          const mapped = MEMBER_OP[input.op];
          expect(mapped, `${label}: unexpected decideMemberAuthority op ${input.op}`).toBeDefined();
          seenOps.add(mapped!);
        }
        const denied = sink.ofType("org.role.escalation_denied").map((e) => e.payload);
        expect(denied, label).toHaveLength(1);
        expect(denied[0], label).toMatchObject({
          actorUserId: A,
          organizationId: org.id,
          operation,
          reason,
        });
        // Nothing else of the org surface (no success event; the rate-limit fail-open
        // `auth.throttle.*` signal of an app without a limiter Redis is not about this request).
        expect(
          sink.types().filter((t) => t.startsWith("org.") && t !== "org.role.escalation_denied"),
          label,
        ).toEqual([]);
        emittedOps.add(operation);
      }
      expect([...seenOps].sort()).toEqual([...ESCALATION_CHECKED_OPERATIONS].sort());
      expect([...emittedOps].sort()).toEqual([...ESCALATION_CHECKED_OPERATIONS].sort());

      // ── review B26 L-4: the cells are hand-picked, the ROUTES are not ──
      // Every non-GET route the router serves is either swept above (through its operation)
      // or named here with the reason it runs no escalation check. A NEW write route — the
      // one place a new decider call site can appear — is red until somebody classifies it.
      const ROUTE_OF_OPERATION: Record<string, string> = {
        create_role: "POST /orgs/{orgId}/roles",
        update_role: "PATCH /orgs/{orgId}/roles/{roleId}",
        delete_role: "DELETE /orgs/{orgId}/roles/{roleId}",
        change_member_role: "PATCH /orgs/{orgId}/members/{userId}",
        remove_member: "DELETE /orgs/{orgId}/members/{userId}",
        invite_create: "POST /orgs/{orgId}/invitations",
        invite_reissue: "POST /orgs/{orgId}/invitations/{invitationId}/link",
        invite_cancel: "DELETE /orgs/{orgId}/invitations/{invitationId}",
      };
      const NO_ESCALATION_CHECK: Record<string, string> = {
        "PATCH /orgs/{orgId}": "shop profile — manage_org_settings, grants no capability",
        "PUT /orgs/{orgId}/tax-profile": "tax profile — manage_org_settings, grants no capability",
        "POST /orgs/{orgId}/tax-profile/reveal": "reveal — read with an audit event (D-030)",
        "DELETE /orgs/{orgId}/membership": "leave the shop — the caller acts only on themselves",
        "POST /orgs/{orgId}/members/{userId}/reset-password":
          "admin reset — its own event (auth.password.admin_reset_blocked_privilege)",
        "POST /invitations/accept":
          "accept — its own event (org.invitation.accept_blocked_inviter)",
        "POST /invitations/preview": "public preview — decides nothing",
        "POST /organizations": "create a shop — the creator becomes its Owner",
        "POST /auth/signup": "auth — no org",
        "POST /auth/login": "auth — no org",
        "POST /auth/logout": "auth — no org",
        "POST /auth/logout-all": "auth — no org",
        "POST /auth/refresh": "auth — no org",
        "POST /auth/change-password": "auth — no org",
      };
      const swept = new Set([...emittedOps].map((op) => ROUTE_OF_OPERATION[op]!));
      const served = enumerateRoutes(on.app)
        .filter((r) => r.method !== "GET" && !r.path.startsWith("/__test__"))
        .map((r) => `${r.method} ${r.path}`);
      expect(served.length).toBeGreaterThan(swept.size); // non-vacuity of the enumeration
      expect(served.filter((k) => !swept.has(k) && !(k in NO_ESCALATION_CHECK))).toEqual([]);
      // …and neither list names a route that is gone.
      expect(
        [...swept, ...Object.keys(NO_ESCALATION_CHECK)].filter((k) => !served.includes(k)),
      ).toEqual([]);

      // ── the refusals that are NOT escalations: 0 escalation_denied each ──
      const mr = await holder(org, await custom(org, SPECS.R_MR));
      const heldByOther = await custom(org, ["manage_orders", "manage_products"]);
      await holder(org, heldByOther);
      const staffNow = await roleRow(staffId);
      const quiet: Array<[string, string, () => Promise<Res>]> = [
        [
          "Owner → ROLE_LOCKED",
          "ROLE_LOCKED",
          () => patchRole(org, ownerRoleId, u.own!.id, { version: 1, name: "Boss" }),
        ],
        [
          "requires_manage_members",
          "ROLE_HELD_REQUIRES_MANAGE_MEMBERS",
          () =>
            patchRole(org, heldByOther.id, mr.id, { version: 1, capabilities: ["manage_orders"] }),
        ],
        [
          "ROLE_EMPTY",
          "ROLE_EMPTY",
          () => send("post", `${o}/roles`, A, { name: `X ${unique()}`, capabilities: [] }),
        ],
        [
          "UNKNOWN_CAPABILITY",
          "UNKNOWN_CAPABILITY",
          () =>
            send("post", `${o}/roles`, A, { name: `X ${unique()}`, capabilities: ["no_such_key"] }),
        ],
        [
          "a taken name",
          "ROLE_NAME_TAKEN",
          () => send("post", `${o}/roles`, A, { name: bill.name, capabilities: ["manage_orders"] }),
        ],
        [
          "ROLE_CHANGED",
          "ROLE_CHANGED",
          () =>
            patchRole(org, staffId, A, { version: staffNow.version + 7, name: `X ${unique()}` }),
        ],
      ];
      for (const [label, code, fire] of quiet) {
        sink.clear();
        const res = await fire();
        expect(res.body?.error?.code, `${label}: ${JSON.stringify(res.body)}`).toBe(code);
        expect(sink.ofType("org.role.escalation_denied"), label).toEqual([]);
      }
    });

    it("…and 503 ROLE_WRITES_DISABLED emits nothing (flag off, its own boot)", async () => {
      const saved = process.env.ROLE_WRITES_ENABLED;
      delete process.env.ROLE_WRITES_ENABLED;
      let off: TestApp;
      try {
        off = await createTestApp();
      } finally {
        if (saved !== undefined) process.env.ROLE_WRITES_ENABLED = saved;
      }
      const offSink = collectSecurityEvents(off.events);
      try {
        const { org, u } = await shop({ own: "Owner", a: "Admin" });
        const res = await request(off.server())
          .patch(`/orgs/${org.id}/roles/${org.roles.Owner!.id}`)
          .set(
            "Authorization",
            `Bearer ${off.app.get(AccessTokenService, { strict: false }).sign(u.a!.id)}`,
          )
          .set("Content-Type", "application/json")
          .send({ version: 1, name: "Boss" });
        expect(codeOf(res)).toEqual([503, "ROLE_WRITES_DISABLED"]);
        expect(offSink.events.filter((e) => e.type.startsWith("org.role."))).toEqual([]);
      } finally {
        offSink.stop();
        await off.close();
      }
    });
  });

  // ── I3-51 · dedupe on the real Redis ──────────────────────────────────────

  it("I3-51 · the same escalation key 3× → 1 event, security_event_suppressed_total +2 · another targetUserId → its own event", async () => {
    const { org, u } = await shop({ own: "Owner", a: "Admin", b: "Admin", c: "Admin" });
    const type = "org.role.escalation_denied" as const;
    const suppressedBefore = on.events.suppressedTotal(type);
    sink.clear();
    for (let i = 0; i < 3; i++) {
      const res = await patchMember(org, u.a!.id, u.b!.id, org.roles.Staff!.id);
      expect(codeOf(res)).toEqual([403, "TARGET_NOT_BELOW_ACTOR"]);
    }
    expect(sink.ofType(type).map((e) => e.payload.targetUserId)).toEqual([u.b!.id]);
    expect(sink.ofType(type)[0]!.payload.suppressedCount).toBe(0);
    expect(on.events.suppressedTotal(type) - suppressedBefore).toBe(2);

    const res = await patchMember(org, u.a!.id, u.c!.id, org.roles.Staff!.id);
    expect(codeOf(res)).toEqual([403, "TARGET_NOT_BELOW_ACTOR"]);
    expect(sink.ofType(type).map((e) => e.payload.targetUserId)).toEqual([u.b!.id, u.c!.id]);
    // (+2 above can only come from Redis answering "not first" to SET NX — no store ⇒ every event fires.)
  });
});
