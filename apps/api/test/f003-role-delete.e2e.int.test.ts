// F-003 · T-003-B25 ★ — `DELETE /orgs/{orgId}/roles/{roleId}` on the REAL stack (DB + Redis).
//
//   I3-09   an unused role → 200 DeletedRole (soft: the row stays, deletedAt/By, version+1,
//           name kept) + org.role.deleted · Staff with 2 active members + 1 EXPIRED pending link
//           → 409 ROLE_IN_USE {activeMembers:2, pendingInvitations:1}, numbers only (no e-mail /
//           userId / person name anywhere in the body) · the same numbers as GET /members?roleId=
//           and GET /invitations?roleId=.
//   I3-10   a role with history only (revoked member + accepted + cancelled links) → 200 · the
//           history reads still show its name · every live read stops seeing it · PATCH member /
//           invite with its id answer exactly like an id that never existed · its name is free.
//   I3-11   MAX_DELETED_ROLES_PER_ORG lowered → at the cap → 409 ROLE_HISTORY_LIMIT_REACHED
//           {limit} and the role stays live.
//   order   (api-spec §2 · arch §1.3) on a held role: designer → ROLE_HELD_REQUIRES_MANAGE_MEMBERS,
//           Admin at the role's level → TARGET_NOT_BELOW_ACTOR, Owner → ROLE_IN_USE.
//   I3-14   (delete leg) the Owner role → ROLE_LOCKED for everyone, event only for a non-Owner.
//   I3-15 / MUT-07 (delete leg) permissive ROLE_WRITE_DECIDER → DELETE the Owner role of a shop
//           whose Owner left → 409 LAST_OWNER (not 500) · no active Owner + the real decider →
//           LAST_OWNER (catches the check being deleted).
//   I3-44   (delete leg) flag off → 503 for `manage_roles` holders, 403 FORBIDDEN for the rest.
//   I3-46   the `roleWrite` quota is ONE bucket for POST + PATCH + DELETE, shared by two Admins
//           of the shop; another shop is unaffected.
//   IC-B25  (review B20 L-4) lock order: while a delete holds the Role row (paused just before
//           COMMIT), an admin-reset in the same shop (User → Membership S → Role S) runs to the
//           end — the delete holds no Membership lock above ACCESS SHARE.
//           The "reset waits, then decides on the NEW caps" half is IC-B24 (PATCH): a deleted
//           role has no active holder, so no reset can be about it.
//
// Every shop is fresh: a deletion is state.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { Redis } from "ioredis";
import { PrismaClient } from "@omnistock/db";
import { ORG_RATE_LIMIT_ENV_VARS } from "@omnistock/config";
import type { TestingModuleBuilder } from "@nestjs/testing";
import { AccessTokenService } from "../src/auth/access-token.service";
import { THROTTLE_ACCT_PREFIX } from "../src/auth/auth.constants";
import {
  SecurityEventsService,
  collectSecurityEvents,
  type SecurityEventCollector,
} from "../src/auth/security-events.service";
import { ORG_RATE_LIMIT_PREFIX } from "../src/common/org-rate-limit.guard";
import { OrgOwnershipGuard } from "../src/orgs/org-ownership.guard";
import { ROLE_CAPACITY_LIMITS } from "../src/orgs/org-config";
import { RoleReadService } from "../src/orgs/role-read.service";
import { ROLE_WRITE_DECIDER } from "../src/orgs/role-write-decider";
import { RolesService } from "../src/orgs/roles.service";
import { ORG_PRISMA, OrgContextStore, type OrgScopedPrismaClient } from "../src/tenancy";
import { INT_LANE_ENABLED, createTestApp, type TestApp } from "./app.kit";
import { createF003SeedKit, type F003SeedKit } from "./f003-seed.kit";
import type { SeededOrg, SeededUser } from "./f002-seed.kit";

const d = INT_LANE_ENABLED ? describe : describe.skip;

if (!INT_LANE_ENABLED) {
  console.warn(
    "[T-003-B25] SKIPPING the DELETE /roles/{roleId} suite: TEST_DATABASE_URL / TEST_REDIS_URL " +
      "are not set. Soft delete, ROLE_IN_USE, the history cap and the lock order are NOT verified.",
  );
}

const HOUR = 3_600_000;
const NEW_PW = "b25-reset-passphrase-7Qz!";
type Json = Record<string, unknown>;

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

/**
 * The barrier of IC-B25: an ORG_PRISMA whose transactions pause right AFTER the
 * callback returned and BEFORE COMMIT — i.e. holding every lock the delete took,
 * including any taken after its Role write. Production code is untouched:
 * `RolesService` is re-provided with this client, every other collaborator is
 * the app's own.
 */
interface CommitBarrier {
  armed: boolean;
  beforeCommit: (holderPid: number) => Promise<void>;
}
function barrierOrgPrisma(base: OrgScopedPrismaClient, barrier: CommitBarrier): unknown {
  const bindTo = (target: object, value: unknown) =>
    typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
  return new Proxy(base as unknown as object, {
    get(target, prop) {
      const value = Reflect.get(target, prop) as unknown;
      if (prop !== "$transaction") return bindTo(target, value);
      return (fn: (tx: object) => Promise<unknown>, options?: object) =>
        (value as (f: (tx: object) => Promise<unknown>, o?: object) => Promise<unknown>).call(
          target,
          async (tx: object) => {
            const out = await fn(tx);
            if (barrier.armed) {
              barrier.armed = false;
              const [{ pid }] = await (
                tx as { $queryRawUnsafe: (q: string) => Promise<Array<{ pid: number }>> }
              ).$queryRawUnsafe("SELECT pg_backend_pid() AS pid");
              await barrier.beforeCommit(pid);
            }
            return out;
          },
          options,
        );
    },
  });
}

d("T-003-B25 DELETE /orgs/{orgId}/roles/{roleId} (E2E, DB+Redis)", () => {
  let on: TestApp; // ROLE_WRITES_ENABLED=true
  let off: TestApp; // flag unset (default false)
  let permissive: TestApp; // flag on + ROLE_WRITE_DECIDER that allows everything (I3-15)
  let barred: TestApp; // flag on + RolesService over the commit barrier (IC-B25)
  let prisma: PrismaClient;
  let redis: Redis;
  let kit: F003SeedKit;
  let sink: SecurityEventCollector;
  const barrier: CommitBarrier = { armed: false, beforeCommit: async () => undefined };
  const unique = () => Math.random().toString(36).slice(2, 8);

  const tokenOf = (app: TestApp, userId: string) =>
    app.app.get(AccessTokenService, { strict: false }).sign(userId);
  const del = (app: TestApp, orgId: string, roleId: string, userId: string) =>
    request(app.server())
      .delete(`/orgs/${orgId}/roles/${roleId}`)
      .set("Authorization", `Bearer ${tokenOf(app, userId)}`);
  const get = (app: TestApp, path: string, userId: string) =>
    request(app.server())
      .get(path)
      .set("Authorization", `Bearer ${tokenOf(app, userId)}`);
  const send = (
    app: TestApp,
    method: "post" | "patch",
    path: string,
    userId: string,
    body: unknown,
  ) => {
    const agent = request(app.server());
    return agent[method]
      .call(agent, path)
      .set("Authorization", `Bearer ${tokenOf(app, userId)}`)
      .set("Content-Type", "application/json")
      .send(body as object);
  };
  const roleRow = (id: string) => prisma.role.findUniqueOrThrow({ where: { id } });
  const roleEvents = (s: SecurityEventCollector) =>
    s.events.filter((e) => e.type.startsWith("org.role."));
  /** The 404 body without its per-request id. */
  const shape404 = (body: Json) => {
    const error = { ...(body.error as Json) };
    delete error.traceId;
    return error;
  };

  async function bootWith(
    env: Record<string, string | undefined>,
    options: {
      configure?: (b: TestingModuleBuilder) => TestingModuleBuilder;
      rateLimitRedis?: unknown;
    } = {},
  ) {
    const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    try {
      return await createTestApp(options);
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  }

  /** A fresh shop: 3 system roles + one member per entry. */
  async function shop(
    people: Readonly<Record<string, "Owner" | "Admin" | "Staff">>,
  ): Promise<{ org: SeededOrg; u: Record<string, SeededUser> }> {
    const org = await kit.createOrg({ name: `b25-${unique()}` });
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
  const customRole = (
    organizationId: string,
    capabilities: readonly string[] = ["manage_orders"],
  ) => kit.createCustomRole({ organizationId, name: `R ${unique()}`, capabilities });

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    await prisma.$connect();
    redis = new Redis(process.env.TEST_REDIS_URL!);
    on = await bootWith({ ROLE_WRITES_ENABLED: "true" });
    off = await bootWith({ ROLE_WRITES_ENABLED: undefined });
    permissive = await bootWith(
      { ROLE_WRITES_ENABLED: "true" },
      { configure: (b) => b.overrideProvider(ROLE_WRITE_DECIDER).useValue(() => ({ ok: true })) },
    );
    barred = await bootWith(
      { ROLE_WRITES_ENABLED: "true" },
      {
        configure: (b) =>
          b.overrideProvider(RolesService).useFactory({
            factory: (
              orgPrisma: OrgScopedPrismaClient,
              store: OrgContextStore,
              events: SecurityEventsService,
              ownership: OrgOwnershipGuard,
              decide: never,
              limits: never,
              reads: RoleReadService,
            ) =>
              new RolesService(
                barrierOrgPrisma(orgPrisma, barrier) as OrgScopedPrismaClient,
                store,
                events,
                ownership,
                decide,
                limits,
                reads,
              ),
            inject: [
              ORG_PRISMA,
              OrgContextStore,
              SecurityEventsService,
              OrgOwnershipGuard,
              ROLE_WRITE_DECIDER,
              ROLE_CAPACITY_LIMITS,
              RoleReadService,
            ],
          }),
      },
    );
    kit = createF003SeedKit(prisma, { label: "b25" });
    sink = collectSecurityEvents(on.events);
  });

  afterAll(async () => {
    sink?.stop();
    if (kit) await kit.cleanup();
    for (const app of [on, off, permissive, barred]) if (app) await app.close();
    if (prisma) await prisma.$disconnect();
    if (redis) redis.disconnect();
  });

  // ── I3-09 ──────────────────────────────────────────────────────────────────

  it("★ I3-09 · an unused role → 200 DeletedRole · the row is SOFT-deleted (still there, name kept, version+1) · org.role.deleted", async () => {
    const { org, u } = await shop({ own: "Owner" });
    const r = await customRole(org.id, ["manage_orders", "manage_products"]);
    sink.clear();
    const res = await del(on, org.id, r.id, u.own!.id);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(["deletedAt", "id"]);
    expect(res.body.id).toBe(r.id);
    expect(res.headers["cache-control"]).toContain("no-store");

    const row = await roleRow(r.id); // still in the table: SOFT delete
    expect(row).toMatchObject({
      organizationId: org.id,
      name: r.name,
      capabilities: ["manage_orders", "manage_products"],
      version: 2,
      deletedByUserId: u.own!.id,
    });
    expect(row.deletedAt?.toISOString()).toBe(res.body.deletedAt);

    expect(roleEvents(sink).map((e) => [e.type, e.payload])).toEqual([
      [
        "org.role.deleted",
        {
          actorUserId: u.own!.id,
          organizationId: org.id,
          roleId: r.id,
          name: r.name,
          capabilities: ["manage_orders", "manage_products"],
        },
      ],
    ]);
  });

  it("★ I3-09 · Staff with 2 active members + 1 EXPIRED pending link → 409 ROLE_IN_USE {2, 1} · numbers only · equal to the ?roleId= lists", async () => {
    const { org, u } = await shop({ own: "Owner", s1: "Staff", s2: "Staff" });
    const staff = org.roles.Staff!.id;
    const issued = new Date(Date.now() - 10 * 24 * HOUR);
    await kit.createInvitation({
      organizationId: org.id,
      email: `b25-i309-${unique()}@seed.test`,
      roleId: staff,
      issuedByUserId: u.own!.id,
      tokenIssuedAt: issued,
      expiresAt: new Date(issued.getTime() + 24 * HOUR), // long expired, still `pending`
    });
    const before = await roleRow(staff);
    sink.clear();

    const res = await del(on, org.id, staff, u.own!.id);
    expect([res.status, res.body.error?.code], JSON.stringify(res.body)).toEqual([
      409,
      "ROLE_IN_USE",
    ]);
    expect(res.body.error.details).toEqual({ activeMembers: 2, pendingInvitations: 1 });
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/@/);
    for (const id of [u.s1!.id, u.s2!.id, u.own!.id]) expect(text).not.toContain(id);
    expect(await roleRow(staff)).toEqual(before);
    expect(roleEvents(sink)).toEqual([]);

    const members = await get(
      on,
      `/orgs/${org.id}/members?roleId=${staff}&status=active`,
      u.own!.id,
    ).expect(200);
    const pending = await get(
      on,
      `/orgs/${org.id}/invitations?roleId=${staff}&status=pending`,
      u.own!.id,
    ).expect(200);
    const expired = await get(
      on,
      `/orgs/${org.id}/invitations?roleId=${staff}&status=expired`,
      u.own!.id,
    ).expect(200);
    expect(members.body.items).toHaveLength(2);
    expect(pending.body.items.length + expired.body.items.length).toBe(1);
  });

  // ── I3-10 ──────────────────────────────────────────────────────────────────

  it("★ I3-10 · history only (revoked member + accepted + cancelled links) → 200 · history still names it · live reads stop seeing it · its id answers like an unknown id", async () => {
    const { org, u } = await shop({ own: "Owner", stf: "Staff" });
    const r = await customRole(org.id);
    const gone = await kit.createUser();
    await kit.addMember({
      organizationId: org.id,
      userId: gone.id,
      roleId: r.id,
      status: "revoked",
      revokedAt: new Date(Date.now() - HOUR),
      revokedByUserId: u.own!.id,
    });
    const acceptedBy = await kit.createUser();
    await kit.createInvitation({
      organizationId: org.id,
      email: `b25-acc-${unique()}@seed.test`,
      roleId: r.id,
      issuedByUserId: u.own!.id,
      status: "accepted",
      acceptedAt: new Date(Date.now() - HOUR),
      acceptedByUserId: acceptedBy.id,
    });
    await kit.createInvitation({
      organizationId: org.id,
      email: `b25-can-${unique()}@seed.test`,
      roleId: r.id,
      issuedByUserId: u.own!.id,
      status: "cancelled",
      cancelledAt: new Date(Date.now() - HOUR),
    });

    const res = await del(on, org.id, r.id, u.own!.id);
    expect(res.status, JSON.stringify(res.body)).toBe(200);

    // history reads keep the last name
    const revoked = await get(on, `/orgs/${org.id}/members?status=revoked`, u.own!.id).expect(200);
    expect((revoked.body.items as Json[]).find((m) => m.userId === gone.id)?.roleName).toBe(r.name);
    for (const status of ["accepted", "cancelled"]) {
      const list = await get(on, `/orgs/${org.id}/invitations?status=${status}`, u.own!.id).expect(
        200,
      );
      expect(
        (list.body.items as Json[]).filter((i) => i.roleId === r.id).map((i) => i.roleName),
        status,
      ).toEqual([r.name]);
    }

    // live reads do not see it
    const roles = await get(on, `/orgs/${org.id}/roles`, u.own!.id).expect(200);
    expect((roles.body.items as Json[]).map((x) => x.id)).not.toContain(r.id);
    const details = await get(on, `/orgs/${org.id}/role-details`, u.own!.id).expect(200);
    expect((details.body.items as Json[]).map((x) => x.id)).not.toContain(r.id);
    const one = await get(on, `/orgs/${org.id}/roles/${r.id}`, u.own!.id);
    const never = await get(on, `/orgs/${org.id}/roles/rol_never_${unique()}`, u.own!.id);
    expect([one.status, never.status]).toEqual([404, 404]);
    expect(shape404(one.body)).toEqual(shape404(never.body));
    // deleting it again is the same 404 as an unknown id
    const again = await del(on, org.id, r.id, u.own!.id);
    expect(again.status).toBe(404);
    expect(shape404(again.body)).toEqual(shape404(never.body));

    // a write that names it answers exactly like a role that never existed
    const bogus = `rol_never_${unique()}`;
    const moveTo = (roleId: string) =>
      send(on, "patch", `/orgs/${org.id}/members/${u.stf!.id}`, u.own!.id, { roleId });
    const [moveDeleted, moveBogus] = [await moveTo(r.id), await moveTo(bogus)];
    expect([moveDeleted.status, moveDeleted.body.error?.code]).toEqual([
      moveBogus.status,
      moveBogus.body.error?.code,
    ]);
    expect(moveDeleted.status).toBe(422);
    const invite = (roleId: string) =>
      send(on, "post", `/orgs/${org.id}/invitations`, u.own!.id, {
        email: `b25-inv-${unique()}@seed.test`,
        roleId,
      });
    const [invDeleted, invBogus] = [await invite(r.id), await invite(bogus)];
    expect([invDeleted.status, invDeleted.body.error?.code]).toEqual([
      invBogus.status,
      invBogus.body.error?.code,
    ]);
    expect(invDeleted.status).toBe(422);

    // the live-name unique no longer holds it: a new role may take the name
    const reuse = await send(on, "post", `/orgs/${org.id}/roles`, u.own!.id, {
      name: r.name,
      capabilities: ["manage_orders"],
    });
    expect(reuse.status, JSON.stringify(reuse.body)).toBe(201);
  });

  // ── I3-11 ──────────────────────────────────────────────────────────────────

  it("★ I3-11 · MAX_DELETED_ROLES_PER_ORG=2 → two deletes pass, the third → 409 ROLE_HISTORY_LIMIT_REACHED {limit:2} · the role stays live", async () => {
    const { org, u } = await shop({ own: "Owner" });
    const capped = await bootWith({ ROLE_WRITES_ENABLED: "true", MAX_DELETED_ROLES_PER_ORG: "2" });
    try {
      for (let i = 0; i < 2; i++) {
        const r = await customRole(org.id);
        const res = await del(capped, org.id, r.id, u.own!.id);
        expect(res.status, `delete ${i}: ${JSON.stringify(res.body)}`).toBe(200);
      }
      const last = await customRole(org.id);
      const over = await del(capped, org.id, last.id, u.own!.id);
      expect([over.status, over.body.error?.code]).toEqual([409, "ROLE_HISTORY_LIMIT_REACHED"]);
      expect(over.body.error.details).toEqual({ limit: 2 });
      expect((await roleRow(last.id)).deletedAt).toBeNull();
      await get(capped, `/orgs/${org.id}/roles/${last.id}`, u.own!.id).expect(200);
      expect(
        await prisma.role.count({ where: { organizationId: org.id, deletedAt: { not: null } } }),
      ).toBe(2);
    } finally {
      await capped.close();
    }
  });

  // ── api-spec §2 / arch §1.3 order on a held role ───────────────────────────

  it("★ order on a held role: designer → 403 ROLE_HELD_REQUIRES_MANAGE_MEMBERS · Admin at its level → 403 TARGET_NOT_BELOW_ACTOR · Owner → 409 ROLE_IN_USE", async () => {
    const { org, u } = await shop({ own: "Owner", adm: "Admin" });
    const adminCaps = (await roleRow(org.roles.Admin!.id)).capabilities;
    const designerRole = await customRole(org.id, [
      "manage_orders",
      "manage_products",
      "manage_roles",
    ]);
    const designer = await kit.createUser();
    await kit.addMember({ organizationId: org.id, userId: designer.id, roleId: designerRole.id });

    const small = await customRole(org.id, ["manage_orders"]); // ⊊ designer, held by T
    const equal = await customRole(org.id, adminCaps); // = Admin, held by T2
    for (const roleId of [small.id, equal.id]) {
      const t = await kit.createUser();
      await kit.addMember({ organizationId: org.id, userId: t.id, roleId });
    }
    const rows = async () => [await roleRow(small.id), await roleRow(equal.id)];
    const before = await rows();
    sink.clear();

    const held = await del(on, org.id, small.id, designer.id);
    expect([held.status, held.body.error?.code]).toEqual([
      403,
      "ROLE_HELD_REQUIRES_MANAGE_MEMBERS",
    ]);
    const eq = await del(on, org.id, equal.id, u.adm!.id);
    expect([eq.status, eq.body.error?.code]).toEqual([403, "TARGET_NOT_BELOW_ACTOR"]);
    const inUse = await del(on, org.id, small.id, u.own!.id);
    expect([inUse.status, inUse.body.error?.code]).toEqual([409, "ROLE_IN_USE"]);
    expect(inUse.body.error.details).toEqual({ activeMembers: 1, pendingInvitations: 0 });

    expect(await rows()).toEqual(before);
    // only the target-axis refusal is a security event (arch §1.3 — HELD is a warn log)
    expect(
      sink
        .ofType("org.role.escalation_denied")
        .map((e) => [e.payload.operation, e.payload.reason, e.payload.roleId]),
    ).toEqual([["delete_role", "target_not_below_actor", equal.id]]);
    expect(sink.ofType("org.role.deleted")).toEqual([]);
  });

  // ── I3-14 (delete leg) ─────────────────────────────────────────────────────

  it("★ I3-14 (delete) · the Owner role → 409 ROLE_LOCKED for the Owner (no event) and for an Admin (escalation_denied role_locked — SR-13) · row unchanged", async () => {
    const { org, u } = await shop({ own: "Owner", adm: "Admin" });
    const ownerRole = org.roles.Owner!.id;
    const before = await roleRow(ownerRole);
    sink.clear();
    const own = await del(on, org.id, ownerRole, u.own!.id);
    expect([own.status, own.body.error?.code]).toEqual([409, "ROLE_LOCKED"]);
    // (only org.* events: the limiter may log auth.throttle.fail_open under load)
    expect(sink.events.filter((e) => e.type.startsWith("org."))).toEqual([]);
    const adm = await del(on, org.id, ownerRole, u.adm!.id);
    expect([adm.status, adm.body.error?.code]).toEqual([409, "ROLE_LOCKED"]);
    const denied = sink.ofType("org.role.escalation_denied");
    expect(denied.map((e) => e.payload)).toEqual([
      expect.objectContaining({
        actorUserId: u.adm!.id,
        organizationId: org.id,
        roleId: ownerRole,
        targetUserId: null,
        operation: "delete_role",
        reason: "role_locked",
        excessCapabilities: [],
      }),
    ]);
    expect(await roleRow(ownerRole)).toEqual(before);
  });

  // ── I3-15 / MUT-07 (delete leg) ────────────────────────────────────────────

  it("★ I3-15 (delete) · decider seam allows everything → DELETE the Owner role of a shop whose Owner left → 409 LAST_OWNER (not 500), row unchanged, role_invariant_violation logged", async () => {
    const { org, u } = await shop({ adm: "Admin" });
    const formerOwner = await kit.createUser();
    await kit.addMember({
      organizationId: org.id,
      userId: formerOwner.id,
      roleId: org.roles.Owner!.id,
      status: "revoked",
      revokedAt: new Date(Date.now() - HOUR),
      revokedByUserId: formerOwner.id,
    });
    const ownerRole = org.roles.Owner!.id;
    const before = await roleRow(ownerRole);
    const guard = permissive.app.get(OrgOwnershipGuard, { strict: false });
    const logged = vi.spyOn(
      (guard as unknown as { logger: { error: (m: string) => void } }).logger,
      "error",
    );
    try {
      const res = await del(permissive, org.id, ownerRole, u.adm!.id);
      expect([res.status, res.body.error?.code], JSON.stringify(res.body)).toEqual([
        409,
        "LAST_OWNER",
      ]);
      expect(await roleRow(ownerRole)).toEqual(before);
      const line = logged.mock.calls
        .map((c) => String(c[0]))
        .find((l) => /role_invariant_violation/.test(l));
      expect(line).toBeDefined();
      expect(line).toContain('"operation":"deleteRole"');
      expect(line).toContain(`"roleId":"${ownerRole}"`);
    } finally {
      logged.mockRestore();
    }
  });

  it("I3-15 control · the same permissive seam on the Owner role while the Owner is ACTIVE → 409 ROLE_IN_USE (in-use answers first), row unchanged", async () => {
    const { org, u } = await shop({ own: "Owner", adm: "Admin" });
    const ownerRole = org.roles.Owner!.id;
    const before = await roleRow(ownerRole);
    const res = await del(permissive, org.id, ownerRole, u.adm!.id);
    expect([res.status, res.body.error?.code]).toEqual([409, "ROLE_IN_USE"]);
    expect(await roleRow(ownerRole)).toEqual(before);
  });

  it("★ MUT-07 (delete, check DELETED) · a shop with no active Owner + the REAL decider → 409 LAST_OWNER, the role stays live", async () => {
    const { org, u } = await shop({ adm: "Admin" });
    const r = await customRole(org.id);
    const res = await del(on, org.id, r.id, u.adm!.id);
    expect([res.status, res.body.error?.code], JSON.stringify(res.body)).toEqual([
      409,
      "LAST_OWNER",
    ]);
    expect((await roleRow(r.id)).deletedAt).toBeNull();
  });

  // ── I3-44 (delete leg) ─────────────────────────────────────────────────────

  it("★ I3-44 (delete) · flag off: manage_roles holders get 503 ROLE_WRITES_DISABLED; Staff gets 403 FORBIDDEN (MUT-11 order) · row unchanged", async () => {
    const { org, u } = await shop({ own: "Owner", adm: "Admin", stf: "Staff" });
    const r = await customRole(org.id);
    const before = await roleRow(r.id);
    for (const p of ["own", "adm"]) {
      const res = await del(off, org.id, r.id, u[p]!.id);
      expect([res.status, res.body.error?.code], p).toEqual([503, "ROLE_WRITES_DISABLED"]);
    }
    const stf = await del(off, org.id, r.id, u.stf!.id);
    expect([stf.status, stf.body.error?.code]).toEqual([403, "FORBIDDEN"]);
    expect(await roleRow(r.id)).toEqual(before);
  });

  // ── tenancy + transport ────────────────────────────────────────────────────

  it("another shop's role id on this shop's path → 404 NOT_FOUND, that row unchanged (AC-6.3)", async () => {
    const a = await shop({ own: "Owner" });
    const b = await shop({ own: "Owner" });
    const theirs = await customRole(b.org.id);
    const before = await roleRow(theirs.id);
    const res = await del(on, a.org.id, theirs.id, a.u.own!.id);
    const unknown = await del(on, a.org.id, `rol_never_${unique()}`, a.u.own!.id);
    expect([res.status, res.body.error?.code]).toEqual([404, "NOT_FOUND"]);
    expect(shape404(res.body)).toEqual(shape404(unknown.body));
    expect(await roleRow(theirs.id)).toEqual(before);
    // control: the route exists and this caller CAN delete — the 404 above is the tenancy answer
    const mine = await customRole(a.org.id);
    expect((await del(on, a.org.id, mine.id, a.u.own!.id)).status).toBe(200);
  });

  it("no body and no Content-Type → 200 (DELETE takes no body — not 415)", async () => {
    const { org, u } = await shop({ own: "Owner" });
    const r = await customRole(org.id);
    const res = await request(on.server())
      .delete(`/orgs/${org.id}/roles/${r.id}`)
      .set("Authorization", `Bearer ${tokenOf(on, u.own!.id)}`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
  });

  // ── I3-46 ──────────────────────────────────────────────────────────────────

  it("★ I3-46 · roleWrite is ONE quota for POST + PATCH + DELETE, shared by two Admins → the 4th write is 429 + Retry-After ≥ 1 · shop B unaffected", async () => {
    const a = await shop({ own: "Owner", a1: "Admin", a2: "Admin" });
    const b = await shop({ own: "Owner" });
    const envVar = ORG_RATE_LIMIT_ENV_VARS.roleWrite;
    const saved = process.env[envVar];
    const limited = await bootWith({ ROLE_WRITES_ENABLED: "true" }, { rateLimitRedis: redis });
    const clear = async () => {
      for (const orgId of [a.org.id, b.org.id]) {
        const keys = await redis.keys(`${ORG_RATE_LIMIT_PREFIX}*${orgId}*`);
        if (keys.length > 0) await redis.del(...keys);
      }
    };
    try {
      process.env[envVar] = "3"; // ORG_RATE_LIMITS is a live view (test seam of U-CFG3-03)
      await clear();
      const created = await send(limited, "post", `/orgs/${a.org.id}/roles`, a.u.a1!.id, {
        name: `q-${unique()}`,
        capabilities: ["manage_orders"],
      });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const patched = await send(
        limited,
        "patch",
        `/orgs/${a.org.id}/roles/${created.body.id as string}`,
        a.u.a2!.id,
        { version: 1, name: `q2-${unique()}` },
      );
      expect(patched.status, JSON.stringify(patched.body)).toBe(200);
      const deleted = await del(limited, a.org.id, created.body.id as string, a.u.a1!.id);
      expect(deleted.status, JSON.stringify(deleted.body)).toBe(200);

      const spare = await customRole(a.org.id);
      const fourth = await del(limited, a.org.id, spare.id, a.u.a2!.id);
      expect([fourth.status, fourth.body.error?.code]).toEqual([429, "RATE_LIMITED"]);
      const retry = fourth.headers["retry-after"];
      expect(retry).toMatch(/^\d+$/);
      expect(Number(retry)).toBeGreaterThanOrEqual(1);
      expect((await roleRow(spare.id)).deletedAt).toBeNull();

      const other = await customRole(b.org.id);
      const inB = await del(limited, b.org.id, other.id, b.u.own!.id);
      expect(inB.status, JSON.stringify(inB.body)).toBe(200);
    } finally {
      if (saved === undefined) delete process.env[envVar];
      else process.env[envVar] = saved;
      await clear();
      await limited.close();
    }
  });

  // ── IC-B25 · lock order (review B20 L-4) ──────────────────────────────────

  describe("IC-B25 · a delete holding the Role row never holds Membership: a concurrent admin-reset runs to the end", () => {
    const hashOf = async (userId: string) =>
      (
        await prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: { passwordHash: true },
        })
      ).passwordHash;
    const reset = async (app: TestApp, orgId: string, callerId: string, targetId: string) => {
      await redis.del(`${THROTTLE_ACCT_PREFIX}${callerId}:reset-password`);
      return request(app.server())
        .post(`/orgs/${orgId}/members/${targetId}/reset-password`)
        .set("Authorization", `Bearer ${tokenOf(app, callerId)}`)
        .set("Content-Type", "application/json")
        .send({ newPassword: NEW_PW });
    };
    const locksOf = (pid: number, relname: string) =>
      prisma.$queryRawUnsafe<Array<{ mode: string }>>(
        `SELECT l.mode FROM pg_locks l JOIN pg_class c ON c.oid = l.relation
          WHERE l.pid = $1 AND c.relname = $2 AND l.granted`,
        pid,
        relname,
      );

    it("★ while the delete waits before COMMIT, Admin resets Staff in the same shop → 200 before the delete answers · the delete holds only ACCESS SHARE on Membership", async () => {
      const { org, u } = await shop({ own: "Owner", adm: "Admin", stf: "Staff" });
      const r = await customRole(org.id);
      const reached = deferred();
      const release = deferred();
      let deletePid = 0;
      const order: string[] = [];
      barrier.beforeCommit = async (pid) => {
        deletePid = pid;
        reached.resolve();
        await release.promise;
      };
      barrier.armed = true;
      try {
        const before = await hashOf(u.stf!.id);
        const deleting = del(barred, org.id, r.id, u.own!.id).then((res) => {
          order.push("delete answered");
          return res;
        });
        await within(reached.promise, 3_000, "the delete to reach COMMIT");

        // Non-vacuity: the paused transaction really holds the Role write.
        expect((await locksOf(deletePid, "Role")).map((l) => l.mode)).toContain("RowExclusiveLock");
        // The rule: reading Membership is fine (count + trigger); locking it is not.
        const membershipModes = (await locksOf(deletePid, "Membership")).map((l) => l.mode);
        expect(membershipModes.length).toBeGreaterThan(0);
        expect([...new Set(membershipModes)]).toEqual(["AccessShareLock"]);

        const resetRes = await within(
          reset(barred, org.id, u.adm!.id, u.stf!.id),
          4_000,
          "the reset to finish while the delete is paused (it must not wait on the delete)",
        );
        order.push("reset answered");
        expect(resetRes.status, JSON.stringify(resetRes.body)).toBe(200);
        expect(await hashOf(u.stf!.id)).not.toBe(before);

        release.resolve();
        const deleted = await deleting;
        expect(deleted.status, JSON.stringify(deleted.body)).toBe(200);
        expect(order).toEqual(["reset answered", "delete answered"]);
        expect((await roleRow(r.id)).deletedAt).not.toBeNull();
      } finally {
        barrier.armed = false;
        release.resolve();
      }
    });
  });
});
