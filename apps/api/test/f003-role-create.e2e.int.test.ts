// F-003 · T-003-B23 ★ — `POST /orgs/{orgId}/roles` on the REAL stack (DB + Redis).
//
//   G3-01 (int)  the live router's `@RoleWrite()` routes are set-equal with
//                ROLE_WRITE_ROUTES, and EVERY one of them, when called, runs the
//                decider seam (`ROLE_WRITE_DECIDER`) AND `assertOwnerRemains`,
//                and is closed by RoleWritesEnabledGuard when the flag is off.
//   I3-01..05    create: wire shape · names · reserved names · capabilities · cap.
//   I3-17        the Owner may create every selectable key, never `full_access`.
//   I3-44 / I3-45  flag off → 503 for `manage_roles` holders, 403 FORBIDDEN for
//                the rest (MUT-11) · reads unaffected · strict rules on shipped
//                routes NOT behind the flag · flag on (own boot) → normal.
//   order        capability → flag → rate limit (api-spec §2) with a real Redis.
//   MUT-07       an org with no active Owner refuses the create (409 LAST_OWNER) —
//                catches the check being DELETED; the "moved after the write" half
//                rolls back here too and is pinned by U-API3-01 (call order).
//
// Each case that changes env (flag, cap, quota) boots its own app — the env is
// read ONCE at boot (DV01), so a test cannot flip it on a running app.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { Redis } from "ioredis";
import { PrismaClient } from "@omnistock/db";
import { CAPABILITY_REGISTRY, decideRoleWrite, type RoleWriteInput } from "@omnistock/core-domain";
import { ORG_RATE_LIMIT_ENV_VARS } from "@omnistock/config";
import { AccessTokenService } from "../src/auth/access-token.service";
import {
  collectSecurityEvents,
  type SecurityEventCollector,
} from "../src/auth/security-events.service";
import { ORG_RATE_LIMIT_PREFIX } from "../src/common/org-rate-limit.guard";
import { ROLE_WRITE_ROUTES, enumerateRoutes, routeKey } from "../src/common/authz";
import { OrgOwnershipGuard } from "../src/orgs/org-ownership.guard";
import { ROLE_WRITE_DECIDER } from "../src/orgs/role-write-decider";
import { INT_LANE_ENABLED, createTestApp, type TestApp } from "./app.kit";
import {
  createF003SeedKit,
  type F003PersonasResult,
  type F003SeedKit,
  type PersonaKey,
} from "./f003-seed.kit";

const d = INT_LANE_ENABLED ? describe : describe.skip;

type Json = Record<string, unknown>;

/** Every key a role may be created with (selectable, tier `all`) — from the registry, not retyped. */
const SELECTABLE = CAPABILITY_REGISTRY.filter((c) => c.selectable && c.tier === "all").map(
  (c) => c.key,
);

d("T-003-B23 POST /orgs/{orgId}/roles (E2E, DB+Redis)", () => {
  let on: TestApp; // ROLE_WRITES_ENABLED=true
  let off: TestApp; // flag unset (default false)
  let spied: TestApp; // flag on + decider seam spied
  let prisma: PrismaClient;
  let redis: Redis;
  let kit: F003SeedKit;
  let seed: F003PersonasResult;
  let sinkOn: SecurityEventCollector;
  const decideSpy = vi.fn((input: RoleWriteInput) => decideRoleWrite(input));
  const unique = () => Math.random().toString(36).slice(2, 8);

  const tokenOf = (app: TestApp, userId: string) =>
    app.app.get(AccessTokenService, { strict: false }).sign(userId);
  const post = (app: TestApp, orgId: string, userId: string, body: unknown) =>
    request(app.server())
      .post(`/orgs/${orgId}/roles`)
      .set("Authorization", `Bearer ${tokenOf(app, userId)}`)
      .set("Content-Type", "application/json")
      .send(body as object);
  const get = (app: TestApp, path: string, userId: string) =>
    request(app.server())
      .get(path)
      .set("Authorization", `Bearer ${tokenOf(app, userId)}`);
  const A = () => seed.shops.A;
  const user = (p: PersonaKey) => A().users[p].id;
  const liveRoleCount = (organizationId: string) =>
    prisma.role.count({ where: { organizationId, deletedAt: null } });

  async function bootWith(env: Record<string, string | undefined>, options = {}) {
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

  /** A fresh shop: 3 system roles + an Owner (and whoever else the test adds). */
  async function freshShop() {
    const org = await kit.createOrg({ name: `b23-${unique()}` });
    const owner = await kit.createUser();
    await kit.addMember({ organizationId: org.id, userId: owner.id, roleId: org.roles.Owner!.id });
    return { org, owner };
  }

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    await prisma.$connect();
    redis = new Redis(process.env.TEST_REDIS_URL!);
    on = await bootWith({ ROLE_WRITES_ENABLED: "true" });
    off = await bootWith({ ROLE_WRITES_ENABLED: undefined });
    spied = await bootWith(
      { ROLE_WRITES_ENABLED: "true" },
      {
        configure: (b: {
          overrideProvider: (t: unknown) => { useValue: (v: unknown) => unknown };
        }) => b.overrideProvider(ROLE_WRITE_DECIDER).useValue(decideSpy),
      },
    );
    kit = createF003SeedKit(prisma, { label: "b23" });
    seed = await kit.scenario("f003-personas");
    sinkOn = collectSecurityEvents(on.events);
  });

  afterAll(async () => {
    sinkOn?.stop();
    if (kit) await kit.cleanup();
    for (const app of [on, off, spied]) if (app) await app.close();
    if (prisma) await prisma.$disconnect();
    if (redis) redis.disconnect();
  });

  // ── G3-01 (int) ────────────────────────────────────────────────────────────

  /**
   * One request per ROLE_WRITE_ROUTES row that reaches the write. B25 adds
   * a recipe with its route — the set-equality below is red until it does.
   */
  interface Recipe {
    path: string;
    method: "post" | "patch";
    body: unknown;
    as: string;
  }
  const RECIPES: Record<string, () => Promise<Recipe>> = {
    "POST /orgs/{orgId}/roles": async () => ({
      path: `/orgs/${A().org.id}/roles`,
      method: "post",
      body: { name: `g3-01-${unique()}`, capabilities: ["manage_orders"] },
      as: user("OWN"),
    }),
    // T-003-B24 — a role nobody holds, so the edit is a real change that reaches the write.
    "PATCH /orgs/{orgId}/roles/{roleId}": async () => {
      const role = await kit.createCustomRole({
        organizationId: A().org.id,
        name: `g3-01-p-${unique()}`,
        capabilities: ["manage_orders"],
      });
      return {
        path: `/orgs/${A().org.id}/roles/${role.id}`,
        method: "patch",
        body: { version: 1, name: `g3-01-p2-${unique()}` },
        as: user("OWN"),
      };
    },
  };

  const send = (app: TestApp, r: Recipe) => {
    // `r.method` widens to "delete" when B25 adds its recipe.
    const agent = request(app.server());
    const open = agent[r.method].bind(agent);
    return open(r.path)
      .set("Authorization", `Bearer ${tokenOf(app, r.as)}`)
      .set("Content-Type", "application/json")
      .send(r.body as object);
  };

  it("★ G3-01 · the live router's @RoleWrite() routes are exactly ROLE_WRITE_ROUTES (and each has a recipe)", () => {
    const live = enumerateRoutes(on.app)
      .filter((r) => r.roleWrite)
      .map(routeKey)
      .sort();
    expect(live).toEqual(ROLE_WRITE_ROUTES.map(routeKey).sort());
    expect(Object.keys(RECIPES).sort()).toEqual(live);
    // non-vacuity: the enumeration really sees the router (reads are not role writes)
    expect(
      enumerateRoutes(on.app).some((r) => routeKey(r) === "GET /orgs/{orgId}/roles/{roleId}"),
    ).toBe(true);
  });

  it("★ G3-01 · every role-write route runs ROLE_WRITE_DECIDER AND assertOwnerRemains, and is flag-guarded", async () => {
    const ownership = spied.app.get(OrgOwnershipGuard, { strict: false });
    const assertSpy = vi.spyOn(ownership, "assertOwnerRemainsInTx");
    for (const [key, recipe] of Object.entries(RECIPES)) {
      decideSpy.mockClear();
      assertSpy.mockClear();
      const r = await recipe();
      const res = await send(spied, r);
      expect(res.status, `${key}: ${JSON.stringify(res.body)}`).toBeLessThan(300);
      expect(decideSpy, `${key} never reached the decider seam`).toHaveBeenCalled();
      expect(assertSpy, `${key} never ran assertOwnerRemains`).toHaveBeenCalled();

      const closed = await send(off, r);
      expect([closed.status, closed.body.error?.code], key).toEqual([503, "ROLE_WRITES_DISABLED"]);
    }
    assertSpy.mockRestore();
  });

  // ── I3-01 ──────────────────────────────────────────────────────────────────

  it("★ I3-01 · 201: key=null even if the body says owner/isSystem · canonical caps · version 1 · lastEdited.by=me", async () => {
    sinkOn.clear();
    const name = `I3-01 ${unique()}`;
    const res = await post(on, A().org.id, user("OWN"), {
      name,
      capabilities: ["manage_products", "manage_orders", "manage_products"],
      key: "owner",
      isSystem: true,
      version: 7,
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const body = res.body as Json;
    expect(body).toMatchObject({
      name,
      key: null,
      isSystem: false,
      grantsOwnership: false,
      nameCustomized: true,
      capabilities: ["manage_orders", "manage_products"],
      version: 1,
      usage: { activeMembers: 0, pendingInvitations: 0 },
      lastEdited: { by: { kind: "me" } },
    });
    expect((body.viewer as Json).canEdit).toEqual({ allowed: true, reason: null });
    expect(res.headers["cache-control"]).toContain("no-store");

    // The DB row says the same — nothing the body asked for leaked into it.
    const row = await prisma.role.findUniqueOrThrow({ where: { id: body.id as string } });
    expect(row).toMatchObject({
      organizationId: A().org.id,
      key: null,
      isSystem: false,
      capabilities: ["manage_orders", "manage_products"],
      version: 1,
      lastEditedByUserId: user("OWN"),
      deletedAt: null,
    });

    // It matches what the read route serves for the same id (same RoleDetail shape).
    const read = await get(
      on,
      `/orgs/${A().org.id}/roles/${body.id as string}`,
      user("OWN"),
    ).expect(200);
    expect(read.body).toEqual(body);

    expect(sinkOn.ofType("org.role.created").map((e) => e.payload)).toEqual([
      {
        actorUserId: user("OWN"),
        organizationId: A().org.id,
        roleId: body.id,
        name,
        capabilities: ["manage_orders", "manage_products"],
      },
    ]);
  });

  it("I3-01 · an Admin (manage_roles, ⊆) creates; MR (manage_roles, no manage_members) creates within its own caps", async () => {
    const adm = await post(on, A().org.id, user("ADM_A"), {
      name: `adm ${unique()}`,
      capabilities: ["manage_members"],
    });
    expect(adm.status, JSON.stringify(adm.body)).toBe(201);
    const mr = await post(on, A().org.id, user("MR"), {
      name: `mr ${unique()}`,
      capabilities: ["manage_orders"],
    });
    expect(mr.status, JSON.stringify(mr.body)).toBe(201);
    // …and MR asking for a key it does not hold = ROLE_EXCEEDS_ACTOR (no details).
    const over = await post(on, A().org.id, user("MR"), {
      name: `mr-over ${unique()}`,
      capabilities: ["manage_members"],
    });
    expect([over.status, over.body.error.code]).toEqual([403, "ROLE_EXCEEDS_ACTOR"]);
    expect(over.body.error.details).toBeUndefined();
  });

  // ── I3-02 ──────────────────────────────────────────────────────────────────

  it("★ I3-02 · names: case/space-insensitive clash with a live role · 50 ok / 51 no · Cc/Cf → 422 · BOM-suffixed 'Owner' → 409", async () => {
    const before = await liveRoleCount(A().org.id);
    for (const name of ["  admin ", "ADMIN", "Owner﻿"]) {
      const res = await post(on, A().org.id, user("OWN"), {
        name,
        capabilities: ["manage_orders"],
      });
      expect([res.status, res.body.error?.code], JSON.stringify(name)).toEqual([
        409,
        "ROLE_NAME_TAKEN",
      ]);
    }
    const tooLong = await post(on, A().org.id, user("OWN"), {
      name: "ก".repeat(51),
      capabilities: ["manage_orders"],
    });
    expect([tooLong.status, tooLong.body.error.code]).toEqual([422, "VALIDATION_FAILED"]);
    expect(tooLong.body.error.fieldErrors).toHaveProperty("name");
    for (const bad of ["a​b", "a‮b", "a\u0007b"]) {
      const res = await post(on, A().org.id, user("OWN"), {
        name: bad,
        capabilities: ["manage_orders"],
      });
      expect([res.status, res.body.error.code], JSON.stringify(bad)).toEqual([
        422,
        "VALIDATION_FAILED",
      ]);
      expect(res.body.error.fieldErrors).toHaveProperty("name");
    }
    expect(await liveRoleCount(A().org.id)).toBe(before);

    // 50 code points (Thai — one code point each) is the ceiling, and passes.
    const fifty = `${unique()}${"ข".repeat(44)}`;
    expect([...fifty].length).toBe(50);
    expect(
      (await post(on, A().org.id, user("OWN"), { name: fifty, capabilities: ["manage_orders"] }))
        .status,
    ).toBe(201);
  });

  it("I3-02 · the name of a DELETED role may be used again", async () => {
    const name = `reuse ${unique()}`;
    const first = await post(on, A().org.id, user("OWN"), {
      name,
      capabilities: ["manage_orders"],
    });
    expect(first.status).toBe(201);
    await kit.softDeleteRole(A().org.id, first.body.id as string);
    const again = await post(on, A().org.id, user("OWN"), {
      name,
      capabilities: ["manage_orders"],
    });
    expect(again.status, JSON.stringify(again.body)).toBe(201);
    expect(again.body.id).not.toBe(first.body.id);
  });

  // ── I3-03 ──────────────────────────────────────────────────────────────────

  it("★ I3-03 · reserved names: 'เจ้าของร้าน' always · 'ผู้ดูแล' while Admin is not renamed · free once it is", async () => {
    const { org, owner } = await freshShop();
    const caps = { capabilities: ["manage_orders"] };
    expect(
      (await post(on, org.id, owner.id, { name: "เจ้าของร้าน", ...caps })).body.error.code,
    ).toBe("ROLE_NAME_TAKEN");
    expect((await post(on, org.id, owner.id, { name: " ผู้ดูแล ", ...caps })).body.error.code).toBe(
      "ROLE_NAME_TAKEN",
    );
    // Admin renamed (PATCH /roles is B24 — set the state the PATCH would leave).
    await prisma.role.update({
      where: { id: org.roles.Admin!.id },
      data: { name: "หัวหน้าร้าน", nameCustomized: true },
    });
    const freed = await post(on, org.id, owner.id, { name: "ผู้ดูแล", ...caps });
    expect(freed.status, JSON.stringify(freed.body)).toBe(201);
    // The Owner label stays reserved whatever happens to the Owner role.
    expect(
      (await post(on, org.id, owner.id, { name: "เจ้าของร้าน", ...caps })).body.error.code,
    ).toBe("ROLE_NAME_TAKEN");
  });

  // ── I3-04 ──────────────────────────────────────────────────────────────────

  it("★ I3-04 · caps: [] → ROLE_EMPTY · full_access → FULL_ACCESS_RESERVED + event (Owner too) · unknown / tier full → UNKNOWN_CAPABILITY · NO row written", async () => {
    sinkOn.clear();
    const before = await liveRoleCount(A().org.id);
    const name = `I3-04 ${unique()}`;

    const empty = await post(on, A().org.id, user("OWN"), { name, capabilities: [] });
    expect([empty.status, empty.body.error.code]).toEqual([422, "ROLE_EMPTY"]);
    expect(empty.body.error.fieldErrors).toHaveProperty("capabilities");

    const full = await post(on, A().org.id, user("OWN"), { name, capabilities: ["full_access"] });
    expect([full.status, full.body.error.code]).toEqual([422, "FULL_ACCESS_RESERVED"]);
    const denied = sinkOn.ofType("org.role.escalation_denied").map((e) => e.payload);
    expect(denied).toHaveLength(1);
    expect(denied[0]).toMatchObject({
      actorUserId: user("OWN"),
      organizationId: A().org.id,
      operation: "create_role",
      reason: "full_access_reserved",
      roleId: null,
      targetUserId: null,
    });

    for (const [caps, refused] of [
      [["bogus"], ["bogus"]],
      [["access_accounting"], ["access_accounting"]],
      [
        ["manage_orders", "zz_two", "access_accounting"],
        ["access_accounting", "zz_two"],
      ],
    ] as const) {
      const res = await post(on, A().org.id, user("OWN"), { name, capabilities: caps });
      expect([res.status, res.body.error.code], JSON.stringify(caps)).toEqual([
        422,
        "UNKNOWN_CAPABILITY",
      ]);
      expect(res.body.error.details.capabilities).toEqual(refused);
      expect(res.body.error.fieldErrors).toHaveProperty("capabilities");
    }

    const sixtyFive = await post(on, A().org.id, user("OWN"), {
      name,
      capabilities: Array.from({ length: 65 }, () => "manage_orders"),
    });
    expect([sixtyFive.status, sixtyFive.body.error.code]).toEqual([422, "VALIDATION_FAILED"]);

    expect(await liveRoleCount(A().org.id), "a refused create wrote a Role row").toBe(before);

    // An UPCOMING key is a legal choice (AC-7.5).
    const upcoming = await post(on, A().org.id, user("OWN"), {
      name,
      capabilities: ["manage_billing"],
    });
    expect(upcoming.status, JSON.stringify(upcoming.body)).toBe(201);
    expect(upcoming.body.capabilities).toEqual(["manage_billing"]);
  });

  // ── I3-05 ──────────────────────────────────────────────────────────────────

  it("★ I3-05 · cap (env-lowered): system roles count, deleted ones do not, over → 409 ROLE_LIMIT_REACHED + viewer reasons", async () => {
    const { org, owner } = await freshShop(); // 3 live system roles
    const capped = await bootWith({ ROLE_WRITES_ENABLED: "true", MAX_ROLES_PER_ORG: "5" });
    try {
      const make = (n: string) =>
        post(capped, org.id, owner.id, { name: n, capabilities: ["manage_orders"] });
      expect((await make(`c1-${unique()}`)).status).toBe(201);
      const second = await make(`c2-${unique()}`);
      expect(second.status).toBe(201); // 5 live = at the cap
      const over = await make(`c3-${unique()}`);
      expect([over.status, over.body.error.code]).toEqual([409, "ROLE_LIMIT_REACHED"]);
      expect(over.body.error.details).toEqual({ limit: 5 });
      expect(await liveRoleCount(org.id)).toBe(5);

      const list = await get(capped, `/orgs/${org.id}/role-details`, owner.id).expect(200);
      expect(list.body.viewer.canCreate).toEqual({ allowed: false, reason: "role_limit_reached" });
      for (const item of list.body.items as Json[]) {
        if (item.isSystem) continue;
        expect((item.viewer as Json).canClone).toEqual({
          allowed: false,
          reason: "role_limit_reached",
        });
      }

      // A deleted role frees its seat.
      await kit.softDeleteRole(org.id, second.body.id as string);
      expect((await make(`c4-${unique()}`)).status).toBe(201);
    } finally {
      await capped.close();
    }
  });

  // ── I3-17 ──────────────────────────────────────────────────────────────────

  it("★ I3-17 · the Owner creates a role with EVERY selectable key · adding full_access → FULL_ACCESS_RESERVED (AC-5.6)", async () => {
    expect(SELECTABLE.length).toBeGreaterThan(5);
    const res = await post(on, A().org.id, user("OWN"), {
      name: `I3-17 ${unique()}`,
      capabilities: SELECTABLE,
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    // Canonical: deduped, sorted, implied keys dropped (none ship today).
    const stored = res.body.capabilities as string[];
    expect(stored.length).toBeLessThanOrEqual(SELECTABLE.length);
    expect(stored).not.toContain("full_access");
    const withFull = await post(on, A().org.id, user("OWN"), {
      name: `I3-17b ${unique()}`,
      capabilities: [...SELECTABLE, "full_access"],
    });
    expect([withFull.status, withFull.body.error.code]).toEqual([422, "FULL_ACCESS_RESERVED"]);
  });

  // ── MUT-07 on the real DB ────────────────────────────────────────────────

  it("★ MUT-07 (create, check DELETED — moved-after-the-write is caught by U-API3-01, the tx rolls back here) · no active Owner → 409 LAST_OWNER, no row", async () => {
    const org = await kit.createOrg({ name: `b23-noowner-${unique()}` });
    const admin = await kit.createUser();
    await kit.addMember({ organizationId: org.id, userId: admin.id, roleId: org.roles.Admin!.id });
    const res = await post(on, org.id, admin.id, { name: "x", capabilities: ["manage_orders"] });
    expect([res.status, res.body.error.code]).toEqual([409, "LAST_OWNER"]);
    expect(await liveRoleCount(org.id)).toBe(3);
  });

  // ── I3-44 / I3-45 ──────────────────────────────────────────────────────────

  it("★ I3-44 · flag off: manage_roles holders get 503 ROLE_WRITES_DISABLED; STF/MM get 403 FORBIDDEN (MUT-11)", async () => {
    const before = await liveRoleCount(A().org.id);
    for (const p of ["OWN", "ADM_A", "MR"] as const) {
      const res = await post(off, A().org.id, user(p), {
        name: `off ${unique()}`,
        capabilities: ["manage_orders"],
      });
      expect([res.status, res.body.error.code], p).toEqual([503, "ROLE_WRITES_DISABLED"]);
    }
    for (const p of ["STF", "MM"] as const) {
      const res = await post(off, A().org.id, user(p), {
        name: `off ${unique()}`,
        capabilities: ["manage_orders"],
      });
      expect([res.status, res.body.error.code], p).toEqual([403, "FORBIDDEN"]);
    }
    expect(await liveRoleCount(A().org.id)).toBe(before);
  });

  it("I3-44 · flag off: the three role READS still answer 200, every write verdict says writes_disabled", async () => {
    await get(off, `/orgs/${A().org.id}/capabilities`, user("OWN")).expect(200);
    const list = await get(off, `/orgs/${A().org.id}/role-details`, user("OWN")).expect(200);
    expect(list.body.viewer.canCreate).toEqual({ allowed: false, reason: "writes_disabled" });
    const one = await get(
      off,
      `/orgs/${A().org.id}/roles/${A().customRoles.R_T.id}`,
      user("OWN"),
    ).expect(200);
    for (const v of ["canEdit", "canDelete", "canClone"])
      expect(one.body.viewer[v]).toEqual({ allowed: false, reason: "writes_disabled" });
  });

  it("★ I3-44 · flag off: the strict rules on SHIPPED routes are not behind it (ADM_A PATCH ADM_B = TARGET_NOT_BELOW_ACTOR)", async () => {
    const res = await request(off.server())
      .patch(`/orgs/${A().org.id}/members/${user("ADM_B")}`)
      .set("Authorization", `Bearer ${tokenOf(off, user("ADM_A"))}`)
      .set("Content-Type", "application/json")
      .send({ roleId: A().org.roles.Staff!.id });
    expect([res.status, res.body.error.code]).toEqual([403, "TARGET_NOT_BELOW_ACTOR"]);
    const still = await prisma.membership.findFirstOrThrow({
      where: { organizationId: A().org.id, userId: user("ADM_B") },
    });
    expect(still.roleId).toBe(A().customRoles.R_B.id);
  });

  it("★ I3-45 · flag on (its own boot) → the same request succeeds; flipping process.env afterwards changes neither app", async () => {
    const body = () => ({ name: `I3-45 ${unique()}`, capabilities: ["manage_orders"] });
    expect((await post(on, A().org.id, user("OWN"), body())).status).toBe(201);
    const saved = process.env.ROLE_WRITES_ENABLED;
    try {
      process.env.ROLE_WRITES_ENABLED = "true";
      expect((await post(off, A().org.id, user("OWN"), body())).status).toBe(503);
      process.env.ROLE_WRITES_ENABLED = "false";
      expect((await post(on, A().org.id, user("OWN"), body())).status).toBe(201);
    } finally {
      if (saved === undefined) delete process.env.ROLE_WRITES_ENABLED;
      else process.env.ROLE_WRITES_ENABLED = saved;
    }
  });

  // ── api-spec §2 order with a real limiter: capability → flag → rate limit ──

  it("★ order · flag off is answered BEFORE the quota is counted; flag on: the shared roleWrite quota → 429 + Retry-After", async () => {
    const { org, owner } = await freshShop();
    const envVar = ORG_RATE_LIMIT_ENV_VARS.roleWrite;
    const saved = process.env[envVar];
    const offR = await bootWith({ ROLE_WRITES_ENABLED: undefined }, { rateLimitRedis: redis });
    const onR = await bootWith({ ROLE_WRITES_ENABLED: "true" }, { rateLimitRedis: redis });
    const clear = async () => {
      const keys = await redis.keys(`${ORG_RATE_LIMIT_PREFIX}*${org.id}*`);
      if (keys.length > 0) await redis.del(...keys);
    };
    try {
      process.env[envVar] = "1"; // ORG_RATE_LIMITS is a live view (test seam of U-CFG3-03)
      await clear();
      for (let i = 0; i < 3; i++) {
        const res = await post(offR, org.id, owner.id, {
          name: `q${i}`,
          capabilities: ["manage_orders"],
        });
        expect([res.status, res.body.error.code], `attempt ${i}`).toEqual([
          503,
          "ROLE_WRITES_DISABLED",
        ]);
      }
      // Nothing was counted, so the one allowed write is still available.
      const first = await post(onR, org.id, owner.id, {
        name: `q-ok-${unique()}`,
        capabilities: ["manage_orders"],
      });
      expect(first.status, JSON.stringify(first.body)).toBe(201);
      const second = await post(onR, org.id, owner.id, {
        name: `q-2-${unique()}`,
        capabilities: ["manage_orders"],
      });
      expect([second.status, second.body.error.code]).toEqual([429, "RATE_LIMITED"]);
      expect(Number(second.headers["retry-after"])).toBeGreaterThanOrEqual(1);
    } finally {
      if (saved === undefined) delete process.env[envVar];
      else process.env[envVar] = saved;
      await clear();
      await offR.close();
      await onR.close();
    }
  });

  it("ORG_ACCESS_DENIED / ORG_MISMATCH are unchanged on this route (envelope of every org route)", async () => {
    const outsider = await kit.createUser();
    const res = await post(on, A().org.id, outsider.id, {
      name: "x",
      capabilities: ["manage_orders"],
    });
    expect([res.status, res.body.error.code]).toEqual([403, "ORG_ACCESS_DENIED"]);
    const mismatch = await request(on.server())
      .post(`/orgs/${A().org.id}/roles`)
      .set("Authorization", `Bearer ${tokenOf(on, user("OWN"))}`)
      .set("X-Organization-Id", seed.shops.B.org.id)
      .set("Content-Type", "application/json")
      .send({ name: "x", capabilities: ["manage_orders"] });
    expect([mismatch.status, mismatch.body.error.code]).toEqual([422, "ORG_MISMATCH"]);
  });

  it("415 for a non-JSON body (same transport guard as every other org write)", async () => {
    const res = await request(on.server())
      .post(`/orgs/${A().org.id}/roles`)
      .set("Authorization", `Bearer ${tokenOf(on, user("OWN"))}`)
      .set("Content-Type", "text/plain")
      .send("name=x");
    expect([res.status, res.body.error.code]).toEqual([415, "UNSUPPORTED_MEDIA_TYPE"]);
  });
});
