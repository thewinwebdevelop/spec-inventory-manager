// F-003 · T-003-B20 ★ — admin-reset under D-034 (target ⊊ caller) and SR-05
// (User → Membership FOR SHARE → Role FOR SHARE), against a real Postgres.
//
//   I3-35  the named cases: Admin→Admin (equal) 404 · Admin→Staff 200 ·
//          incomparable (MMS → R_BILL holder) 404 · Owner→Owner 200 · superset
//          404. Plus `…_blocked_privilege` on the new refusal, and an Owner
//          target still emits ONLY `…_owner_target`.
//   I3-36  non-oracle: the same caller gets "not a member", "⊊ failed", C-2
//          and High-2 as ONE response. Same status, same body once the traceId
//          is replaced, same header set, same Content-Length. The traceId is a
//          UUID v4. (Timing is review evidence, MAN3-04, not this file.)
//   I3-37  wherever `decideAdminResetVisible` (the `viewerCanResetPassword`
//          verdict) says false over the persona seed, the real reset is 404
//          and the hash is unchanged. Where it says true but the target is
//          active in another shop (C-2), the reset is 404 too.
//   IC3-02 SR-05. (a) Reset A holds Membership FOR SHARE behind a barrier, and
//          PATCH member B on the same target WAITS until A commits (seen in
//          `pg_stat_activity`, then in commit order). (b) Reversed: B's role
//          change is in flight, the reset waits for it, then decides on the NEW
//          roleId.
//   MUT-13 (reset leg of AC-6.5) — no memoised membership: with the SAME access
//          token, the outcome follows each role change on the next request.
//
// Every refusal asserts that the password HASH in the database did not change.
// The status code alone would be satisfied by an endpoint that never works,
// so every block has a 200 control.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Redis } from "ioredis";
import { PrismaClient } from "@omnistock/db";
import { decideAdminResetVisible, decideMemberAuthority } from "@omnistock/core-domain";
import { AccessTokenService } from "../src/auth/access-token.service";
import { THROTTLE_ACCT_PREFIX } from "../src/auth/auth.constants";
import { AuthService } from "../src/auth/auth.service";
import { HashingService } from "../src/auth/hashing.service";
import { RefreshTokenService } from "../src/auth/refresh-token.service";
import { ThrottleService } from "../src/auth/throttle.service";
import {
  SecurityEventsService,
  collectSecurityEvents,
  type SecurityEventCollector,
} from "../src/auth/security-events.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import { INT_LANE_ENABLED, createTestApp, type TestApp } from "./app.kit";
import { createF003SeedKit, type F003SeedKit, type PersonaShop } from "./f003-seed.kit";
import type { SeededOrg, SeededUser } from "./f002-seed.kit";

const d = INT_LANE_ENABLED ? describe : describe.skip;

if (!INT_LANE_ENABLED) {
  console.warn(
    "[T-003-B20] SKIPPING the admin-reset D-034/SR-05 suite: TEST_DATABASE_URL / TEST_REDIS_URL " +
      "are not set. The ⊊ refusal, the byte-identical 404 and the lock order are NOT verified.",
  );
}

const NEW_PW = "b20-reset-passphrase-4Kx!";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** Headers whose VALUE is per-response by design (the trace id and what derives from it). */
const VOLATILE_HEADERS = new Set(["date", "x-request-id", "etag"]);

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}
function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

/** Rejects if `p` has not settled within `ms` — a barrier that never fires must fail, not hang. */
async function within<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms waiting for: ${what}`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

d("T-003-B20 admin-reset — D-034 ⊊ + SR-05 lock order (E2E, DB+Redis)", () => {
  let app: TestApp;
  let prisma: PrismaClient;
  let redis: Redis;
  let kit: F003SeedKit;
  let sink: SecurityEventCollector;

  const token = (userId: string): string =>
    app.app.get(AccessTokenService, { strict: false }).sign(userId);

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    await prisma.$connect();
    redis = new Redis(process.env.TEST_REDIS_URL!);
    app = await createTestApp();
    kit = createF003SeedKit(prisma, { label: "b20" });
    sink = collectSecurityEvents(app.events);
  });

  afterAll(async () => {
    sink?.stop();
    if (kit) await kit.cleanup();
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
    if (redis) redis.disconnect();
  });

  // The reset route counts every 404 against the caller's own throttle
  // (api-spec §2.8). These suites make many refused calls on purpose, so the
  // caller's window is cleared before each call: the throttle is not what is
  // under test. Only THIS caller's key is touched (never `throttle:*`), because
  // Redis is shared with suites that run in parallel and DO assert on throttling.
  const clearCallerThrottle = async (callerAccess: string): Promise<void> => {
    const payload = JSON.parse(
      Buffer.from(callerAccess.split(".")[1], "base64url").toString("utf8"),
    ) as { sub: string };
    await redis.del(`${THROTTLE_ACCT_PREFIX}${payload.sub}:reset-password`);
  };

  const reset = async (orgId: string, callerAccess: string, targetUserId: string) => {
    await clearCallerThrottle(callerAccess);
    return request(app.server())
      .post(`/orgs/${orgId}/members/${targetUserId}/reset-password`)
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${callerAccess}`)
      .send({ newPassword: NEW_PW });
  };

  const patchRole = (orgId: string, callerAccess: string, targetUserId: string, roleId: string) =>
    request(app.server())
      .patch(`/orgs/${orgId}/members/${targetUserId}`)
      .set("Authorization", `Bearer ${callerAccess}`)
      .set("Content-Type", "application/json")
      .send({ roleId });

  const hashOf = async (userId: string): Promise<string> =>
    (await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } }))
      .passwordHash;

  /** The relation the production rule computes — so a fixture cannot silently be the wrong case. */
  const relation = (actor: readonly string[], target: readonly string[]) => {
    const r = decideMemberAuthority({
      op: "reset_password",
      actorCapabilities: actor,
      actorIsTarget: false,
      targetCurrentCapabilities: target,
    });
    return r.ok ? "below" : r.reason === "target_not_below_actor" ? r.relation : r.reason;
  };

  /** A small shop: Owner, Admin and Staff system roles, one member per entry. */
  async function smallShop(
    roles: Readonly<Record<string, "Owner" | "Admin" | "Staff">>,
  ): Promise<{ org: SeededOrg; people: Record<string, SeededUser> }> {
    const org = await kit.createOrg();
    const people: Record<string, SeededUser> = {};
    for (const [name, roleName] of Object.entries(roles)) {
      const user = await kit.createUser();
      await kit.addMember({
        organizationId: org.id,
        userId: user.id,
        roleId: org.roles[roleName].id,
      });
      people[name] = user;
    }
    return { org, people };
  }

  // ── I3-35 ────────────────────────────────────────────────────────────────

  describe("I3-35 · the named cases (AC-5.5 · AC-5.5b)", () => {
    let A: PersonaShop;
    let billHolder: SeededUser;

    beforeAll(async () => {
      const personas = await kit.scenario("f003-personas");
      A = personas.shops.A;
      // Nobody holds R_BILL in the persona seed; the incomparable case needs a holder.
      billHolder = await kit.createUser();
      await kit.addMember({
        organizationId: A.org.id,
        userId: billHolder.id,
        roleId: A.customRoles.R_BILL.id,
      });
    });

    function capsOf(k: keyof PersonaShop["memberships"]): readonly string[] {
      const roleId = A.memberships[k].roleId;
      const all = [...Object.values(A.org.roles), ...Object.values(A.customRoles)];
      const role = all.find((r) => r.id === roleId);
      if (!role) throw new Error(`no role ${roleId} for persona ${String(k)}`);
      return role.capabilities;
    }

    async function expectRefusedPrivilege(callerId: string, targetId: string): Promise<void> {
      const before = await hashOf(targetId);
      sink.clear();
      const res = await reset(A.org.id, token(callerId), targetId);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
      expect(await hashOf(targetId)).toBe(before);
      expect(sink.ofType("auth.password.admin_reset_blocked_privilege")).toHaveLength(1);
      expect(sink.ofType("auth.password.admin_reset_blocked_privilege")[0].payload).toEqual({
        actorUserId: callerId,
        orgId: A.org.id,
        targetUserId: targetId,
      });
      expect(sink.ofType("auth.password.admin_reset")).toHaveLength(0);
    }

    it("Admin → Admin (EQUAL caps) = 404, password unchanged, one …_blocked_privilege", async () => {
      expect(relation(capsOf("ADM_A"), capsOf("ADM_B"))).toBe("equal");
      await expectRefusedPrivilege(A.users.ADM_A.id, A.users.ADM_B.id);
    });

    it("incomparable (MMS → R_BILL holder) = 404, password unchanged, one …_blocked_privilege", async () => {
      expect(relation(capsOf("MMS"), A.customRoles.R_BILL.capabilities)).toBe("incomparable");
      await expectRefusedPrivilege(A.users.MMS.id, billHolder.id);
    });

    it("superset (MM → Admin: the target holds more) = 404, password unchanged, one …_blocked_privilege", async () => {
      expect(relation(capsOf("MM"), capsOf("ADM_A"))).toBe("superset");
      await expectRefusedPrivilege(A.users.MM.id, A.users.ADM_A.id);
    });

    it("Admin → Staff (⊊) = 200 and the password really changed (control)", async () => {
      expect(relation(capsOf("ADM_A"), capsOf("STF"))).toBe("below");
      const before = await hashOf(A.users.STF.id);
      sink.clear();
      const res = await reset(A.org.id, token(A.users.ADM_A.id), A.users.STF.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(await hashOf(A.users.STF.id)).not.toBe(before);
      expect(sink.ofType("auth.password.admin_reset")).toHaveLength(1);
      expect(sink.ofType("auth.password.admin_reset_blocked_privilege")).toHaveLength(0);
    });

    it("Owner → Owner = 200 (full_access bypass)", async () => {
      const before = await hashOf(A.users.OWN2.id);
      const res = await reset(A.org.id, token(A.users.OWN.id), A.users.OWN2.id);
      expect(res.status).toBe(200);
      expect(await hashOf(A.users.OWN2.id)).not.toBe(before);
    });

    it("Admin → Owner = 404 with ONLY …_owner_target (the Owner signal is not relabelled)", async () => {
      const before = await hashOf(A.users.OWN.id);
      sink.clear();
      const res = await reset(A.org.id, token(A.users.ADM_A.id), A.users.OWN.id);
      expect(res.status).toBe(404);
      expect(await hashOf(A.users.OWN.id)).toBe(before);
      expect(sink.ofType("auth.password.admin_reset_blocked_owner_target")).toHaveLength(1);
      expect(sink.ofType("auth.password.admin_reset_blocked_privilege")).toHaveLength(0);
    });
  });

  // ── I3-36 ────────────────────────────────────────────────────────────────

  describe("I3-36 · the ⊊ refusal is not an oracle (byte-identical 404)", () => {
    it("not-a-member, ⊊-failed, C-2 and self-reset give the SAME status, body (minus traceId), header set and Content-Length", async () => {
      const { org, people } = await smallShop({
        admin: "Admin",
        admin2: "Admin",
        staffMulti: "Staff",
      });
      // C-2: staffMulti is also active in a second shop.
      const other = await kit.createOrg();
      await kit.addMember({
        organizationId: other.id,
        userId: people.staffMulti.id,
        roleId: other.roles.Staff.id,
      });
      const stranger = await kit.createUser(); // a real user, not a member here
      const access = token(people.admin.id);
      const hashesBefore = await Promise.all(
        [people.admin.id, people.admin2.id, people.staffMulti.id].map(hashOf),
      );

      const cases = {
        notMember: await reset(org.id, access, stranger.id),
        noSuchUser: await reset(org.id, access, "00000000-0000-4000-8000-000000000000"),
        notProperSubset: await reset(org.id, access, people.admin2.id),
        multiOrg: await reset(org.id, access, people.staffMulti.id),
        self: await reset(org.id, access, people.admin.id),
      };
      const base = cases.notMember;

      const normalized = (body: unknown) => {
        const clone = JSON.parse(JSON.stringify(body)) as { error: { traceId?: string } };
        clone.error.traceId = "<trace>";
        return clone;
      };
      const headerShape = (headers: Record<string, unknown>) =>
        Object.fromEntries(
          Object.entries(headers)
            .map(([k, v]) => [
              k.toLowerCase(),
              VOLATILE_HEADERS.has(k.toLowerCase()) ? "<volatile>" : v,
            ])
            .sort(([a], [b]) => String(a).localeCompare(String(b))),
        );

      const traceIds = new Set<string>();
      for (const [name, res] of Object.entries(cases)) {
        expect(res.status, name).toBe(404);
        expect(normalized(res.body), name).toEqual(normalized(base.body));
        expect(headerShape(res.headers), name).toEqual(headerShape(base.headers));
        expect(res.headers["content-length"], name).toBe(base.headers["content-length"]);
        expect(Number(res.headers["content-length"]), name).toBeGreaterThan(0);
        // The raw bytes too: only the 36 characters of the traceId may differ.
        const trace = res.body.error.traceId as string;
        expect(trace, name).toMatch(UUID_V4);
        expect(res.headers["x-request-id"], name).toBe(trace);
        expect(res.text.replace(trace, "<trace>"), name).toBe(
          base.text.replace(base.body.error.traceId as string, "<trace>"),
        );
        traceIds.add(trace);
      }
      // The one field allowed to differ does differ (it is not derived from the request).
      expect(traceIds.size).toBe(Object.keys(cases).length);
      // …and none of the refusals changed a password.
      expect(
        await Promise.all([people.admin.id, people.admin2.id, people.staffMulti.id].map(hashOf)),
      ).toEqual(hashesBefore);
    });

    it("control · the same caller CAN reset a Staff member (200), so the 404s above are refusals", async () => {
      const { org, people } = await smallShop({ admin: "Admin", staff: "Staff" });
      const res = await reset(org.id, token(people.admin.id), people.staff.id);
      expect(res.status).toBe(200);
    });
  });

  // ── I3-37 ────────────────────────────────────────────────────────────────

  describe("I3-37 · viewerCanResetPassword=false ⇒ the real reset is 404", () => {
    it("every (viewer, row) pair of shop A whose verdict is false answers 404 and leaves the hash alone; a C-2 target with verdict true is 404 too", async () => {
      const personas = await kit.scenario("f003-personas");
      const A = personas.shops.A;
      const allRoles = [...Object.values(A.org.roles), ...Object.values(A.customRoles)];
      const capsOfRole = (roleId: string) => {
        const role = allRoles.find((r) => r.id === roleId);
        if (!role) throw new Error(`no role ${roleId}`);
        return role.capabilities;
      };
      const active = (Object.keys(A.memberships) as Array<keyof typeof A.memberships>).filter(
        (k) => A.memberships[k].status === "active",
      );
      // The verdict is only computed for viewers who may manage members (its
      // audience rule); the write path applies to the same people.
      const viewers = active.filter((k) =>
        capsOfRole(A.memberships[k].roleId).some(
          (c) => c === "manage_members" || c === "full_access",
        ),
      );
      const reasonsSeen = new Set<string>();

      let refusedChecked = 0;
      for (const v of viewers) {
        for (const r of active) {
          const verdict = decideAdminResetVisible(
            { userId: A.users[v].id, capabilities: capsOfRole(A.memberships[v].roleId) },
            { userId: A.users[r].id, capabilities: capsOfRole(A.memberships[r].roleId) },
          );
          if (verdict.ok) continue;
          const before = await hashOf(A.users[r].id);
          const res = await reset(A.org.id, token(A.users[v].id), A.users[r].id);
          expect(res.status, `${v} → ${r} (${verdict.reason})`).toBe(404);
          expect(await hashOf(A.users[r].id), `${v} → ${r}`).toBe(before);
          refusedChecked += 1;
          reasonsSeen.add(verdict.reason);
        }
      }
      // Non-vacuity: every reason the verdict can give occurs in the seed.
      expect(viewers.length).toBeGreaterThanOrEqual(5);
      expect(refusedChecked).toBeGreaterThan(10);
      expect([...reasonsSeen].sort()).toEqual([
        "equal_permissions",
        "exceeds_your_permissions",
        "owner_only",
        "self",
      ]);

      // C-2: the verdict is true (it may not look at other shops) but the write refuses.
      const both = personas.activeInBoth;
      const verdict = decideAdminResetVisible(
        { userId: A.users.OWN.id, capabilities: capsOfRole(A.memberships.OWN.roleId) },
        { userId: both.user.id, capabilities: capsOfRole(both.membershipA.roleId) },
      );
      expect(verdict.ok).toBe(true);
      const before = await hashOf(both.user.id);
      const res = await reset(A.org.id, token(A.users.OWN.id), both.user.id);
      expect(res.status).toBe(404);
      expect(await hashOf(both.user.id)).toBe(before);
    });
  });

  // ── MUT-13 (reset leg of AC-6.5) ─────────────────────────────────────────

  describe("MUT-13 · no memoised membership: the next request sees the role change", () => {
    it("same access token: 200 → (target raised to Admin) 404 → (lowered back) 200 → (caller lowered) 404", async () => {
      const { org, people } = await smallShop({ owner: "Owner", admin: "Admin", staff: "Staff" });
      const adminAccess = token(people.admin.id); // signed ONCE, reused throughout
      const ownerAccess = token(people.owner.id);

      expect((await reset(org.id, adminAccess, people.staff.id)).status).toBe(200);

      expect(
        (await patchRole(org.id, ownerAccess, people.staff.id, org.roles.Admin.id)).status,
      ).toBe(200);
      const before = await hashOf(people.staff.id);
      sink.clear();
      expect((await reset(org.id, adminAccess, people.staff.id)).status).toBe(404);
      expect(await hashOf(people.staff.id)).toBe(before);
      expect(sink.ofType("auth.password.admin_reset_blocked_privilege")).toHaveLength(1);

      expect(
        (await patchRole(org.id, ownerAccess, people.staff.id, org.roles.Staff.id)).status,
      ).toBe(200);
      expect((await reset(org.id, adminAccess, people.staff.id)).status).toBe(200);

      expect(
        (await patchRole(org.id, ownerAccess, people.admin.id, org.roles.Staff.id)).status,
      ).toBe(200);
      expect((await reset(org.id, adminAccess, people.staff.id)).status).toBe(404);
    });
  });

  // ── IC3-02 · SR-05 ───────────────────────────────────────────────────────

  describe("IC3-02 · SR-05 lock order against a concurrent PATCH member", () => {
    /** Backends of THIS database currently waiting on a heavyweight lock. */
    const lockWaiters = async (): Promise<Array<{ query: string }>> =>
      prisma.$queryRawUnsafe<Array<{ query: string }>>(
        `SELECT query FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock' AND pid <> pg_backend_pid()`,
      );

    async function waitForLockWaiter(what: string): Promise<Array<{ query: string }>> {
      const deadline = Date.now() + 2_500;
      while (Date.now() < deadline) {
        const rows = await lockWaiters();
        if (rows.length > 0) return rows;
        await new Promise((r) => setTimeout(r, 25));
      }
      throw new Error(`no backend ever waited on a lock: ${what}`);
    }

    /**
     * An AuthService identical to the app's except that its transaction pauses
     * right after the `Membership … FOR SHARE` statement returns — the only
     * place a test can hold the reset "between the lock and the decision".
     * Production code is untouched: the barrier lives in a proxy around the
     * Prisma client handed to the constructor.
     */
    function barrierAuthService(
      client: PrismaClient,
      onMembershipLocked: () => Promise<void>,
      onCommitted: () => void = () => undefined,
    ) {
      let fired = false;
      const wrapTx = (tx: object) =>
        new Proxy(tx, {
          get(target, prop, receiver) {
            if (prop === "$queryRawUnsafe") {
              return async (sql: string, ...params: unknown[]) => {
                const out = await (target as PrismaClient).$queryRawUnsafe(sql, ...params);
                if (!fired && /FROM "Membership"[\s\S]*FOR SHARE/.test(sql)) {
                  fired = true;
                  await onMembershipLocked();
                }
                return out;
              };
            }
            const value = Reflect.get(target, prop, receiver) as unknown;
            return typeof value === "function"
              ? (value as (...a: unknown[]) => unknown).bind(target)
              : value;
          },
        });
      const wrapped = new Proxy(client, {
        get(target, prop, receiver) {
          if (prop === "$transaction") {
            return (fn: (tx: object) => Promise<unknown>, options?: object) =>
              // `.then` runs when Postgres has COMMITTED — before the service's
              // post-commit work (revoke, backoff clear, event), so it marks the
              // commit itself rather than the end of the call.
              target
                .$transaction((tx) => fn(wrapTx(tx)), options)
                .then((result) => {
                  onCommitted();
                  return result;
                });
          }
          const value = Reflect.get(target, prop, receiver) as unknown;
          return typeof value === "function"
            ? (value as (...a: unknown[]) => unknown).bind(target)
            : value;
        },
      });
      const get = <T>(cls: new (...args: never[]) => T): T => app.app.get(cls, { strict: false });
      return new AuthService(
        { client: wrapped } as unknown as PrismaService,
        get(HashingService),
        get(RefreshTokenService),
        get(AccessTokenService),
        get(SecurityEventsService),
        get(ThrottleService),
      );
    }

    it("(a) reset holds Membership FOR SHARE → PATCH of the same target WAITS, and commits only after the reset", async () => {
      const { org, people } = await smallShop({ owner: "Owner", admin: "Admin", staff: "Staff" });
      const reached = deferred();
      const release = deferred();
      const order: string[] = [];
      const service = barrierAuthService(
        prisma,
        async () => {
          reached.resolve();
          await release.promise;
        },
        () => order.push("reset committed"),
      );
      const before = await hashOf(people.staff.id);

      const resetA = service.adminResetPassword(people.admin.id, org.id, people.staff.id, NEW_PW);
      await within(reached.promise, 3_000, "the reset to take Membership FOR SHARE");

      const patchB = patchRole(
        org.id,
        token(people.owner.id),
        people.staff.id,
        org.roles.Admin.id,
      ).then((res) => {
        order.push("patch committed");
        return res;
      });

      const waiters = await waitForLockWaiter("PATCH member should queue behind the reset");
      expect(waiters.some((w) => /Membership/.test(w.query))).toBe(true);
      expect(order).toEqual([]); // the PATCH is blocked, not finished

      release.resolve();
      const [, patched] = await Promise.all([resetA, patchB]);
      expect(order).toEqual(["reset committed", "patch committed"]);
      expect(patched.status).toBe(200);
      // The reset decided on the role it had locked (Staff ⊊ Admin) and applied.
      expect(await hashOf(people.staff.id)).not.toBe(before);
      const m = await prisma.membership.findUniqueOrThrow({
        where: { organizationId_userId: { organizationId: org.id, userId: people.staff.id } },
      });
      expect(m.roleId).toBe(org.roles.Admin.id);
    });

    it("(b) reversed · a role change is in flight → the reset waits for it, then decides on the NEW roleId (equal ⇒ 404)", async () => {
      const { org, people } = await smallShop({ admin: "Admin", staff: "Staff" });
      const other = new PrismaClient({
        datasources: { db: { url: process.env.TEST_DATABASE_URL } },
      });
      await other.$connect();
      try {
        const updated = deferred();
        const commit = deferred();
        const txB = other.$transaction(
          async (tx) => {
            await tx.membership.update({
              where: { organizationId_userId: { organizationId: org.id, userId: people.staff.id } },
              data: { roleId: org.roles.Admin.id },
            });
            updated.resolve();
            await commit.promise;
          },
          { timeout: 10_000 },
        );
        await within(updated.promise, 3_000, "B to update the membership");

        const before = await hashOf(people.staff.id);
        sink.clear();
        let settled = false;
        const resetA = reset(org.id, token(people.admin.id), people.staff.id).then((res) => {
          settled = true;
          return res;
        });

        const waiters = await waitForLockWaiter(
          "the reset should wait on the in-flight Membership row",
        );
        expect(waiters.some((w) => /Membership/.test(w.query))).toBe(true);
        expect(settled).toBe(false);

        commit.resolve();
        await txB;
        const res = await resetA;
        // Decided on the committed row: target is now Admin = equal ⇒ refused.
        expect(res.status).toBe(404);
        expect(await hashOf(people.staff.id)).toBe(before);
        expect(sink.ofType("auth.password.admin_reset_blocked_privilege")).toHaveLength(1);
      } finally {
        await other.$disconnect();
      }
    });
  });
});
