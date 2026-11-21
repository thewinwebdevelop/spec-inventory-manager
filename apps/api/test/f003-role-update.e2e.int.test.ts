// F-003 · T-003-B24 ★ — `PATCH /orgs/{orgId}/roles/{roleId}` on the REAL stack (DB + Redis).
//
//   I3-06   rename / caps of Admin · Staff · custom → 200, version+1, event before/after ·
//           `nameCustomized` stays true after renaming back · self-lockout (AC-3.10) is allowed.
//   I3-07   stale `version` + a real change → 409 ROLE_CHANGED `details.currentVersion`, no write, no event.
//   I3-08   no-op → 200, version / lastEdited unchanged, 0 role events — a STALE version on a no-op
//           is not compared (MUT-18) · controls: no-op on a role the rules refuse → 403;
//           stale + different → 409.
//   I3-14   the Owner role: ROLE_LOCKED for everyone (rename / caps / no-op); event only for a
//           non-Owner (SR-13).
//   I3-15   permissive ROLE_WRITE_DECIDER → PATCH the Owner role → 409 LAST_OWNER (not 500), row
//           unchanged, error log `role_invariant_violation` (MUT-07, update leg).
//   I3-42   a long-lived Staff link is cut to tokenIssuedAt + 24h when Staff becomes elevated;
//           demoting again never extends it.
//   I3-44   flag off → 503 for `manage_roles` holders, 403 FORBIDDEN for the rest (PATCH leg).
//   IC-B24  (review B20 L-4) lock order: an edit of a role's caps holds the Role row; a concurrent
//           admin-reset (User → Membership S → Role S) WAITS on it, then decides on the NEW caps.
//           The edit never locks Membership after Role — if it did, this would deadlock.
//
// Every shop is fresh: a role edit is state, and two tests editing the same role would
// decide each other's outcome.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { Redis } from "ioredis";
import { PrismaClient } from "@omnistock/db";
import type { TestingModuleBuilder } from "@nestjs/testing";
import { AccessTokenService } from "../src/auth/access-token.service";
import { THROTTLE_ACCT_PREFIX } from "../src/auth/auth.constants";
import {
  SecurityEventsService,
  collectSecurityEvents,
  type SecurityEventCollector,
} from "../src/auth/security-events.service";
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
    "[T-003-B24] SKIPPING the PATCH /roles/{roleId} suite: TEST_DATABASE_URL / TEST_REDIS_URL " +
      "are not set. ROLE_CHANGED, the no-op rule, ROLE_LOCKED, the clamp and the lock order are NOT verified.",
  );
}

const HOUR = 3_600_000;
const NEW_PW = "b24-reset-passphrase-7Qz!";

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
 * The barrier of IC-B24: an ORG_PRISMA whose transactions pause right AFTER the
 * `role.updateMany` of the edit returns — i.e. while the edit holds the Role row
 * and has not committed. Production code is untouched: `RolesService` is
 * re-provided with this client, every other collaborator is the app's own.
 */
interface RoleWriteBarrier {
  armed: boolean;
  onRoleWritten: (holderPid: number) => Promise<void>;
}
function barrierOrgPrisma(base: OrgScopedPrismaClient, barrier: RoleWriteBarrier): unknown {
  const bindTo = (target: object, value: unknown) =>
    typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
  const wrapTx = (tx: object) =>
    new Proxy(tx, {
      get(target, prop) {
        const value = Reflect.get(target, prop) as unknown;
        if (prop !== "role") return bindTo(target, value);
        const delegate = value as Record<string, unknown>;
        return new Proxy(delegate, {
          get(dt, p) {
            const fn = Reflect.get(dt, p) as unknown;
            if (p !== "updateMany") return bindTo(dt, fn);
            return async (args: unknown) => {
              const out = await (fn as (a: unknown) => Promise<unknown>).call(dt, args);
              if (barrier.armed) {
                barrier.armed = false;
                const [{ pid }] = await (
                  target as { $queryRawUnsafe: (q: string) => Promise<Array<{ pid: number }>> }
                ).$queryRawUnsafe("SELECT pg_backend_pid() AS pid");
                await barrier.onRoleWritten(pid);
              }
              return out;
            };
          },
        });
      },
    });
  return new Proxy(base as unknown as object, {
    get(target, prop) {
      const value = Reflect.get(target, prop) as unknown;
      if (prop !== "$transaction") return bindTo(target, value);
      return (fn: (tx: object) => Promise<unknown>, options?: object) =>
        (value as (f: (tx: object) => Promise<unknown>, o?: object) => Promise<unknown>).call(
          target,
          (tx: object) => fn(wrapTx(tx)),
          options,
        );
    },
  });
}

d("T-003-B24 PATCH /orgs/{orgId}/roles/{roleId} (E2E, DB+Redis)", () => {
  let on: TestApp; // ROLE_WRITES_ENABLED=true
  let off: TestApp; // flag unset (default false)
  let permissive: TestApp; // flag on + ROLE_WRITE_DECIDER that allows everything (I3-15)
  let barred: TestApp; // flag on + RolesService over the barrier client (IC-B24)
  let prisma: PrismaClient;
  let redis: Redis;
  let kit: F003SeedKit;
  let sink: SecurityEventCollector;
  let barredSink: SecurityEventCollector;
  const barrier: RoleWriteBarrier = { armed: false, onRoleWritten: async () => undefined };
  const unique = () => Math.random().toString(36).slice(2, 8);

  const tokenOf = (app: TestApp, userId: string) =>
    app.app.get(AccessTokenService, { strict: false }).sign(userId);
  const patch = (app: TestApp, orgId: string, roleId: string, userId: string, body: unknown) =>
    request(app.server())
      .patch(`/orgs/${orgId}/roles/${roleId}`)
      .set("Authorization", `Bearer ${tokenOf(app, userId)}`)
      .set("Content-Type", "application/json")
      .send(body as object);
  const get = (app: TestApp, path: string, userId: string) =>
    request(app.server())
      .get(path)
      .set("Authorization", `Bearer ${tokenOf(app, userId)}`);
  const roleRow = (id: string) => prisma.role.findUniqueOrThrow({ where: { id } });
  const roleEvents = (s: SecurityEventCollector) =>
    s.events.filter((e) => e.type.startsWith("org.role."));

  async function bootWith(
    env: Record<string, string | undefined>,
    configure?: (b: TestingModuleBuilder) => TestingModuleBuilder,
  ) {
    const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    try {
      return await createTestApp(configure ? { configure } : {});
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
    const org = await kit.createOrg({ name: `b24-${unique()}` });
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

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    await prisma.$connect();
    redis = new Redis(process.env.TEST_REDIS_URL!);
    on = await bootWith({ ROLE_WRITES_ENABLED: "true" });
    off = await bootWith({ ROLE_WRITES_ENABLED: undefined });
    permissive = await bootWith({ ROLE_WRITES_ENABLED: "true" }, (b) =>
      b.overrideProvider(ROLE_WRITE_DECIDER).useValue(() => ({ ok: true })),
    );
    barred = await bootWith({ ROLE_WRITES_ENABLED: "true" }, (b) =>
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
    );
    kit = createF003SeedKit(prisma, { label: "b24" });
    sink = collectSecurityEvents(on.events);
    barredSink = collectSecurityEvents(barred.events);
  });

  afterAll(async () => {
    sink?.stop();
    barredSink?.stop();
    if (kit) await kit.cleanup();
    for (const app of [on, off, permissive, barred]) if (app) await app.close();
    if (prisma) await prisma.$disconnect();
    if (redis) redis.disconnect();
  });

  // ── I3-06 ──────────────────────────────────────────────────────────────────

  it("★ I3-06 · the Owner edits Admin / Staff / a custom role → 200, version+1, the DB row and org.role.updated agree", async () => {
    const { org, u } = await shop({ own: "Owner" });
    const custom = await kit.createCustomRole({
      organizationId: org.id,
      name: `Packer ${unique()}`,
      capabilities: ["manage_orders"],
    });
    for (const [roleId, body] of [
      [org.roles.Admin!.id, { version: 1, name: "หัวหน้าร้าน" }],
      [org.roles.Staff!.id, { version: 1, capabilities: ["manage_orders", "manage_products"] }],
      [custom.id, { version: 1, name: `Picker ${unique()}`, capabilities: ["manage_stock"] }],
    ] as const) {
      sink.clear();
      const before = await roleRow(roleId);
      const res = await patch(on, org.id, roleId, u.own!.id, body);
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      const after = await roleRow(roleId);
      expect(after.version).toBe(before.version + 1);
      expect(res.body).toMatchObject({
        id: roleId,
        version: after.version,
        name: after.name,
        capabilities: after.capabilities,
        lastEdited: { by: { kind: "me" } },
      });
      expect(after.lastEditedByUserId).toBe(u.own!.id);
      expect(sink.ofType("org.role.updated").map((e) => e.payload)).toEqual([
        {
          actorUserId: u.own!.id,
          organizationId: org.id,
          roleId,
          before: { name: before.name, capabilities: before.capabilities },
          after: { name: after.name, capabilities: after.capabilities },
          affectedActiveMembers: 0,
          invitationsShortened: 0,
        },
      ]);
      // The 200 body is exactly what the read route serves now.
      const read = await get(on, `/orgs/${org.id}/roles/${roleId}`, u.own!.id).expect(200);
      expect(read.body).toEqual(res.body);
    }
  });

  it("I3-06 · Admin renamed → nameCustomized=true, and it STAYS true after renaming back (AC-1.5)", async () => {
    const { org, u } = await shop({ own: "Owner" });
    const admin = org.roles.Admin!.id;
    const renamed = await patch(on, org.id, admin, u.own!.id, { version: 1, name: "หัวหน้าร้าน" });
    expect(renamed.body).toMatchObject({ name: "หัวหน้าร้าน", nameCustomized: true, key: "admin" });
    const back = await patch(on, org.id, admin, u.own!.id, { version: 2, name: "Admin" });
    expect(back.status, JSON.stringify(back.body)).toBe(200);
    expect(back.body).toMatchObject({ name: "Admin", nameCustomized: true });
    expect((await roleRow(admin)).nameCustomized).toBe(true);
  });

  it("★ I3-06 · self-lockout (AC-3.10): the only Admin drops manage_roles from their own role → 200; the next request is 403", async () => {
    const { org, u } = await shop({ own: "Owner", adm: "Admin" });
    const admin = await roleRow(org.roles.Admin!.id);
    const without = admin.capabilities.filter((k) => k !== "manage_roles");
    const res = await patch(on, org.id, admin.id, u.adm!.id, { version: 1, capabilities: without });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.capabilities).not.toContain("manage_roles");
    // AC-6.5: no cached permission — the very next request sees the new role.
    const next = await get(on, `/orgs/${org.id}/role-details`, u.adm!.id);
    expect([next.status, next.body.error?.code]).toEqual([403, "FORBIDDEN"]);
  });

  // ── I3-07 ──────────────────────────────────────────────────────────────────

  it("★ I3-07 · stale version + a real change → 409 ROLE_CHANGED details.currentVersion · row unchanged · no event", async () => {
    const { org, u } = await shop({ own: "Owner" });
    const role = await kit.createCustomRole({
      organizationId: org.id,
      name: `R ${unique()}`,
      capabilities: ["manage_orders"],
    });
    expect(
      (await patch(on, org.id, role.id, u.own!.id, { version: 1, name: `first ${unique()}` }))
        .status,
    ).toBe(200);
    const afterFirst = await roleRow(role.id);
    sink.clear();
    const stale = await patch(on, org.id, role.id, u.own!.id, {
      version: 1,
      capabilities: ["manage_stock"],
    });
    expect([stale.status, stale.body.error?.code]).toEqual([409, "ROLE_CHANGED"]);
    expect(stale.body.error.details).toEqual({ currentVersion: 2 });
    expect(await roleRow(role.id)).toEqual(afterFirst);
    expect(roleEvents(sink)).toEqual([]);
  });

  // ── I3-08 ──────────────────────────────────────────────────────────────────

  it("★ I3-08 · no-op (same values, duplicate keys) → 200 · version + lastEdited unchanged · 0 role events — even with a STALE version (MUT-18)", async () => {
    const { org, u } = await shop({ own: "Owner" });
    const role = await kit.createCustomRole({
      organizationId: org.id,
      name: `Noop ${unique()}`,
      capabilities: ["manage_orders", "manage_products"],
    });
    await kit.setRoleVersion(org.id, role.id, 4);
    const before = await roleRow(role.id);
    sink.clear();
    for (const version of [4, 1]) {
      const res = await patch(on, org.id, role.id, u.own!.id, {
        version,
        name: ` ${before.name}  `,
        capabilities: ["manage_products", "manage_orders", "manage_orders"],
      });
      expect(res.status, `version ${version}: ${JSON.stringify(res.body)}`).toBe(200);
      expect(res.body).toMatchObject({ version: 4, lastEdited: null });
    }
    expect(await roleRow(role.id)).toEqual(before);
    expect(roleEvents(sink)).toEqual([]);

    // control: the same stale version with a DIFFERENT value is compared → 409.
    const changed = await patch(on, org.id, role.id, u.own!.id, {
      version: 1,
      capabilities: ["manage_orders"],
    });
    expect([changed.status, changed.body.error?.code]).toEqual([409, "ROLE_CHANGED"]);
  });

  it("I3-08 control · a no-op on a held role at the actor's own level → 403 TARGET_NOT_BELOW_ACTOR (the no-op comes after the rules)", async () => {
    const { org, u } = await shop({ own: "Owner", admA: "Admin" });
    const admin = await roleRow(org.roles.Admin!.id);
    const twin = await kit.createCustomRole({
      organizationId: org.id,
      name: `Twin ${unique()}`,
      capabilities: admin.capabilities,
    });
    const holder = await kit.createUser();
    await kit.addMember({ organizationId: org.id, userId: holder.id, roleId: twin.id });
    const before = await roleRow(twin.id);
    sink.clear();
    const res = await patch(on, org.id, twin.id, u.admA!.id, { version: 1, name: before.name });
    expect([res.status, res.body.error?.code]).toEqual([403, "TARGET_NOT_BELOW_ACTOR"]);
    expect(res.body.error.details).toBeUndefined();
    expect(await roleRow(twin.id)).toEqual(before);
    expect(sink.ofType("org.role.escalation_denied").map((e) => e.payload)).toMatchObject([
      { operation: "update_role", reason: "target_not_below_actor", roleId: twin.id },
    ]);
  });

  // ── I3-14 ──────────────────────────────────────────────────────────────────

  it("★ I3-14 · the Owner role: rename / caps / no-op → 409 ROLE_LOCKED for the Owner (no event) and for an Admin (escalation_denied role_locked — SR-13)", async () => {
    const { org, u } = await shop({ own: "Owner", adm: "Admin" });
    const ownerRole = org.roles.Owner!.id;
    const before = await roleRow(ownerRole);
    const bodies = [
      { version: 1, name: "Boss" },
      { version: 1, capabilities: ["manage_orders"] },
      { version: 1, name: before.name },
    ];
    sink.clear();
    for (const body of bodies) {
      const res = await patch(on, org.id, ownerRole, u.own!.id, body);
      expect([res.status, res.body.error?.code], JSON.stringify(body)).toEqual([
        409,
        "ROLE_LOCKED",
      ]);
    }
    expect(roleEvents(sink)).toEqual([]);

    for (const body of bodies) {
      const res = await patch(on, org.id, ownerRole, u.adm!.id, body);
      expect([res.status, res.body.error?.code], JSON.stringify(body)).toEqual([
        409,
        "ROLE_LOCKED",
      ]);
    }
    const denied = sink.ofType("org.role.escalation_denied").map((e) => e.payload);
    expect(denied.length).toBeGreaterThanOrEqual(1); // dedupe (SR-12) may fold the repeats
    // Security review B24 L-3: EVERY event is the Admin's role_locked — not just
    // the first (the Owner's own refusals above must have added none).
    for (const e of denied) {
      expect(e).toMatchObject({ actorUserId: u.adm!.id, reason: "role_locked", roleId: ownerRole });
    }
    expect(denied[0]).toMatchObject({
      actorUserId: u.adm!.id,
      organizationId: org.id,
      roleId: ownerRole,
      targetUserId: null,
      operation: "update_role",
      reason: "role_locked",
    });
    expect(await roleRow(ownerRole)).toEqual(before);
  });

  // ── I3-15 ──────────────────────────────────────────────────────────────────

  it("★ I3-15 · decider seam allows everything → PATCH the Owner role → 409 LAST_OWNER (not 500), row unchanged, role_invariant_violation logged", async () => {
    const { org, u } = await shop({ own: "Owner" });
    const ownerRole = org.roles.Owner!.id;
    const before = await roleRow(ownerRole);
    const guard = permissive.app.get(OrgOwnershipGuard, { strict: false });
    const logged = vi.spyOn(
      (guard as unknown as { logger: { error: (m: string) => void } }).logger,
      "error",
    );
    try {
      const res = await patch(permissive, org.id, ownerRole, u.own!.id, {
        version: 1,
        capabilities: ["manage_orders"],
      });
      expect([res.status, res.body.error?.code], JSON.stringify(res.body)).toEqual([
        409,
        "LAST_OWNER",
      ]);
      expect(await roleRow(ownerRole)).toEqual(before);
      const line = logged.mock.calls
        .map((c) => String(c[0]))
        .find((l) => /role_invariant_violation/.test(l));
      expect(line).toBeDefined();
      expect(line).toContain('"operation":"updateRole"');
      expect(line).toContain(`"roleId":"${ownerRole}"`);
    } finally {
      logged.mockRestore();
    }
  });

  // ── I3-42 ──────────────────────────────────────────────────────────────────

  it("★ I3-42 · Staff becomes elevated → its long-lived pending link is cut to tokenIssuedAt+24h (invitationsShortened=1); demoting never extends it", async () => {
    const { org, u } = await shop({ own: "Owner" });
    const staff = await roleRow(org.roles.Staff!.id);
    const issued = new Date(Date.now() - 2 * HOUR);
    const longLink = await kit.createInvitation({
      organizationId: org.id,
      email: `b24-i342-${unique()}@seed.test`,
      roleId: staff.id,
      issuedByUserId: u.own!.id,
      tokenIssuedAt: issued,
      expiresAt: new Date(issued.getTime() + 168 * HOUR),
    });
    const shortLink = await kit.createInvitation({
      organizationId: org.id,
      email: `b24-i342s-${unique()}@seed.test`,
      roleId: staff.id,
      issuedByUserId: u.own!.id,
      tokenIssuedAt: issued,
      expiresAt: new Date(issued.getTime() + 3 * HOUR),
    });
    const expiryOf = async (id: string) =>
      (await prisma.invitation.findUniqueOrThrow({ where: { id } })).expiresAt.getTime();

    sink.clear();
    const up = await patch(on, org.id, staff.id, u.own!.id, {
      version: 1,
      capabilities: [...staff.capabilities, "manage_members"],
    });
    expect(up.status, JSON.stringify(up.body)).toBe(200);
    expect(await expiryOf(longLink.id)).toBe(issued.getTime() + 24 * HOUR);
    expect(await expiryOf(shortLink.id)).toBe(issued.getTime() + 3 * HOUR); // LEAST — never longer
    expect(sink.ofType("org.role.updated")[0]!.payload).toMatchObject({ invitationsShortened: 1 });

    const down = await patch(on, org.id, staff.id, u.own!.id, {
      version: 2,
      capabilities: staff.capabilities,
    });
    expect(down.status, JSON.stringify(down.body)).toBe(200);
    expect(await expiryOf(longLink.id)).toBe(issued.getTime() + 24 * HOUR); // not given back
  });

  // ── I3-44 (PATCH leg) ──────────────────────────────────────────────────────

  it("★ I3-44 · flag off: manage_roles holders get 503 ROLE_WRITES_DISABLED; Staff gets 403 FORBIDDEN (MUT-11 order) · row unchanged", async () => {
    const { org, u } = await shop({ own: "Owner", adm: "Admin", stf: "Staff" });
    const role = org.roles.Staff!.id;
    const before = await roleRow(role);
    for (const p of ["own", "adm"]) {
      const res = await patch(off, org.id, role, u[p]!.id, { version: 1, name: `off ${unique()}` });
      expect([res.status, res.body.error?.code], p).toEqual([503, "ROLE_WRITES_DISABLED"]);
    }
    const stf = await patch(off, org.id, role, u.stf!.id, { version: 1, name: "x" });
    expect([stf.status, stf.body.error?.code]).toEqual([403, "FORBIDDEN"]);
    expect(await roleRow(role)).toEqual(before);
  });

  // ── tenancy ────────────────────────────────────────────────────────────────

  it("another shop's role id on this shop's path → 404 NOT_FOUND, that row unchanged (AC-6.3)", async () => {
    const a = await shop({ own: "Owner" });
    const b = await shop({ own: "Owner" });
    const theirs = b.org.roles.Staff!.id;
    const before = await roleRow(theirs);
    const res = await patch(on, a.org.id, theirs, a.u.own!.id, { version: 1, name: "hijack" });
    expect([res.status, res.body.error?.code]).toEqual([404, "NOT_FOUND"]);
    expect(await roleRow(theirs)).toEqual(before);
  });

  it("415 for a non-JSON body · 422 VALIDATION_FAILED for a body without version", async () => {
    const { org, u } = await shop({ own: "Owner" });
    const text = await request(on.server())
      .patch(`/orgs/${org.id}/roles/${org.roles.Staff!.id}`)
      .set("Authorization", `Bearer ${tokenOf(on, u.own!.id)}`)
      .set("Content-Type", "text/plain")
      .send("name=x");
    expect([text.status, text.body.error.code]).toEqual([415, "UNSUPPORTED_MEDIA_TYPE"]);
    const noVersion = await patch(on, org.id, org.roles.Staff!.id, u.own!.id, { name: "x" });
    expect([noVersion.status, noVersion.body.error.code]).toEqual([422, "VALIDATION_FAILED"]);
    expect(noVersion.body.error.fieldErrors).toHaveProperty("version");
  });

  // ── IC-B24 · lock order (review B20 L-4) ──────────────────────────────────

  describe("IC-B24 · an edit of a role's caps during an admin-reset: the reset waits, then decides on the NEW caps", () => {
    const blockedBy = async (holderPid: number): Promise<Array<{ query: string }>> =>
      prisma.$queryRawUnsafe<Array<{ query: string }>>(
        `SELECT query FROM pg_stat_activity
          WHERE datname = current_database() AND $1::int = ANY(pg_blocking_pids(pid))`,
        holderPid,
      );
    async function waitForWaiterBehind(holderPid: number, what: string) {
      const deadline = Date.now() + 2_500;
      while (Date.now() < deadline) {
        const rows = await blockedBy(holderPid);
        if (rows.length > 0) return rows;
        await new Promise((r) => setTimeout(r, 25));
      }
      throw new Error(`no backend ever waited on a lock: ${what}`);
    }
    const hashOf = async (userId: string) =>
      (
        await prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: { passwordHash: true },
        })
      ).passwordHash;
    const reset = async (orgId: string, callerId: string, targetId: string) => {
      await redis.del(`${THROTTLE_ACCT_PREFIX}${callerId}:reset-password`);
      return request(barred.server())
        .post(`/orgs/${orgId}/members/${targetId}/reset-password`)
        .set("Authorization", `Bearer ${tokenOf(barred, callerId)}`)
        .set("Content-Type", "application/json")
        .send({ newPassword: NEW_PW });
    };

    /** Owner + Admin + T holding a custom role R ⊊ Admin. */
    async function setup() {
      const { org, u } = await shop({ own: "Owner", adm: "Admin" });
      const admin = await roleRow(org.roles.Admin!.id);
      const r = await kit.createCustomRole({
        organizationId: org.id,
        name: `R ${unique()}`,
        capabilities: ["manage_orders"],
      });
      const t = await kit.createUser();
      await kit.addMember({ organizationId: org.id, userId: t.id, roleId: r.id });
      return { org, u, t, r, adminCaps: admin.capabilities };
    }

    it("control · with no edit, Admin resets T (R ⊊ Admin) → 200 (so the 404 below comes from the NEW caps)", async () => {
      const { org, u, t } = await setup();
      const before = await hashOf(t.id);
      const res = await reset(org.id, u.adm!.id, t.id);
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(await hashOf(t.id)).not.toBe(before);
    });

    it("★ the edit holds Role → the reset queues behind it on Role (not a deadlock) → edit 200 commits first → reset 404 on the new caps", async () => {
      const { org, u, t, r, adminCaps } = await setup();
      const reached = deferred();
      const release = deferred();
      let editPid = 0;
      const order: string[] = [];
      barrier.onRoleWritten = async (pid) => {
        editPid = pid;
        reached.resolve();
        await release.promise;
      };
      barrier.armed = true;
      try {
        const before = await hashOf(t.id);
        barredSink.clear();

        // Owner raises R to exactly Admin's caps (Owner bypass; T is an "other holder").
        const edit = patch(barred, org.id, r.id, u.own!.id, {
          version: 1,
          capabilities: adminCaps,
        }).then((res) => {
          order.push("edit answered");
          return res;
        });
        await within(reached.promise, 3_000, "the edit to write the Role row");

        const resetA = reset(org.id, u.adm!.id, t.id).then((res) => {
          order.push("reset answered");
          return res;
        });
        const waiters = await waitForWaiterBehind(
          editPid,
          "the reset should queue behind the edit",
        );
        expect(waiters.some((w) => /"Role"/.test(w.query))).toBe(true);
        expect(order).toEqual([]);

        release.resolve();
        const [edited, resetRes] = await Promise.all([edit, resetA]);
        expect(edited.status, JSON.stringify(edited.body)).toBe(200);
        expect(edited.body.capabilities).toEqual([...adminCaps].sort());
        // Decided on the committed caps: R = Admin ⇒ not ⊊ ⇒ the reset's 404.
        expect(resetRes.status, JSON.stringify(resetRes.body)).toBe(404);
        expect(await hashOf(t.id)).toBe(before);
        expect(barredSink.ofType("auth.password.admin_reset_blocked_privilege")).toHaveLength(1);
        expect(barredSink.ofType("org.role.updated")).toHaveLength(1);
      } finally {
        barrier.armed = false;
        release.resolve();
      }
    });
  });
});
