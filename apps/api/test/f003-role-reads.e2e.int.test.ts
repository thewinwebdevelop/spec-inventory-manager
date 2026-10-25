// F-003 · T-003-B21 ★ — the role READ routes against a real Postgres + Redis.
//
//   I3-12  GET /capabilities — tier `full` hidden · full_access selectable=false
//          group=null · upcoming/live from the registry · Staff → 403.
//   I3-13  GET /role-details · GET /roles/{id} — usage, lastEdited=null after
//          seed, every viewer reason over the persona seed, STF/MM → 403,
//          another shop's / a deleted role → 404, flag off ⇒ writes_disabled.
//   I3-53  lastEdited.by (SR-09) — moved editor ⇒ former_member with NOTHING of
//          shop B in the body · me · member + CURRENT role (follows a change).
//   I3-57  ★ the inverse of I3-49: every GET route the router serves that calls
//          a decider emits ZERO events and writes no dedupe key, while the
//          responses carry verdict=false somewhere (non-vacuity) — then a
//          control refusal proves the sink is connected.
//
// The deciders are wrapped (call-through) so the sweep can SEE which routes
// compute `viewer.*` instead of trusting a hand-typed list.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { Redis } from "ioredis";
import { PrismaClient } from "@omnistock/db";
import {
  CAPABILITY_REGISTRY,
  decideAdminResetVisible,
  decideMemberAuthority,
  decideRoleAssignVisible,
  decideRoleWrite,
  hasCapability,
} from "@omnistock/core-domain";
import { AccessTokenService } from "../src/auth/access-token.service";
import { AUTH_REDIS } from "../src/auth/auth.module";
import {
  ESCALATION_DEDUPE_PREFIX,
  collectSecurityEvents,
  type SecurityEventCollector,
  SECURITY_EVENTS_DEDUPE_STORE,
} from "../src/auth/security-events.service";
import { enumerateRoutes } from "../src/common/authz";
import { INT_LANE_ENABLED, createTestApp, type TestApp } from "./app.kit";
import {
  createF003SeedKit,
  type F003PersonasResult,
  type F003SeedKit,
  type PersonaKey,
} from "./f003-seed.kit";

vi.mock("@omnistock/core-domain", async (importOriginal) => {
  const real = await importOriginal<typeof import("@omnistock/core-domain")>();
  return {
    ...real,
    decideRoleWrite: vi.fn(real.decideRoleWrite),
    decideMemberAuthority: vi.fn(real.decideMemberAuthority),
    decideAdminResetVisible: vi.fn(real.decideAdminResetVisible),
    // B22: GET /roles calls this one directly (the member / invitation verdicts
    // are computed inside core-domain mappers, out of a module spy's reach —
    // those routes are detected by the `viewerCan*` keys in the body instead).
    decideRoleAssignVisible: vi.fn(real.decideRoleAssignVisible),
  };
});

const d = INT_LANE_ENABLED ? describe : describe.skip;
if (!INT_LANE_ENABLED) {
  console.warn(
    "[T-003-B21] SKIPPING the role READ suite: TEST_DATABASE_URL / TEST_REDIS_URL are not set. " +
      "I3-12/13/53/57 are NOT verified.",
  );
}

type Verdict = { allowed: boolean; reason: string | null };
interface Detail {
  id: string;
  name: string;
  key: string | null;
  usage: { activeMembers: number; pendingInvitations: number };
  lastEdited: { at: string; by: Record<string, unknown> } | null;
  viewer: { canEdit: Verdict; canDelete: Verdict; canClone: Verdict };
  [k: string]: unknown;
}
const ok: Verdict = { allowed: true, reason: null };
const no = (reason: string): Verdict => ({ allowed: false, reason });

d("T-003-B21 role READ routes (E2E, DB+Redis)", () => {
  let on: TestApp; // ROLE_WRITES_ENABLED=true
  let off: TestApp; // flag unset (default false)
  let prisma: PrismaClient;
  let redis: Redis;
  let kit: F003SeedKit;
  let seed: F003PersonasResult;
  let sink: SecurityEventCollector;

  const tokenOf = (app: TestApp, userId: string) =>
    app.app.get(AccessTokenService, { strict: false }).sign(userId);
  const get = (app: TestApp, path: string, userId: string) =>
    request(app.server())
      .get(path)
      .set("Authorization", `Bearer ${tokenOf(app, userId)}`);
  const A = () => seed.shops.A;
  const user = (p: PersonaKey) => A().users[p].id;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    await prisma.$connect();
    redis = new Redis(process.env.TEST_REDIS_URL!);
    process.env.ROLE_WRITES_ENABLED = "true";
    on = await createTestApp();
    delete process.env.ROLE_WRITES_ENABLED;
    off = await createTestApp();
    kit = createF003SeedKit(prisma, { label: "b21" });
    seed = await kit.scenario("f003-personas");
    sink = collectSecurityEvents(on.events);
  });

  afterAll(async () => {
    sink?.stop();
    if (kit) await kit.cleanup();
    if (on) await on.close();
    if (off) await off.close();
    if (prisma) await prisma.$disconnect();
    if (redis) redis.disconnect();
  });

  const details = async (app: TestApp, viewer: PersonaKey): Promise<Map<string, Detail>> => {
    const res = await get(app, `/orgs/${A().org.id}/role-details`, user(viewer)).expect(200);
    return new Map((res.body.items as Detail[]).map((i) => [i.id, i]));
  };
  const roleId = {
    owner: () => A().org.roles.Owner.id,
    admin: () => A().org.roles.Admin.id,
    staff: () => A().org.roles.Staff.id,
    custom: (k: keyof F003PersonasResult["shops"]["A"]["customRoles"]) => A().customRoles[k].id,
  };

  // ── I3-12 ────────────────────────────────────────────────────────────────
  describe("I3-12 GET /capabilities", () => {
    it("hides tier full, full_access is not selectable, status from the registry, no-store", async () => {
      const res = await get(on, `/orgs/${A().org.id}/capabilities`, user("ADM_A")).expect(200);
      expect(res.headers["cache-control"]).toBe("no-store");
      const items = res.body.items as {
        key: string;
        status: string;
        group: string | null;
        selectable: boolean;
      }[];
      const keys = items.map((i) => i.key);
      expect(keys).not.toContain("access_accounting");
      expect(keys).toEqual(CAPABILITY_REGISTRY.filter((c) => c.tier !== "full").map((c) => c.key));
      expect(items.find((i) => i.key === "full_access")).toMatchObject({
        selectable: false,
        group: null,
      });
      expect(items.find((i) => i.key === "manage_roles")?.status).toBe("live");
      const upcoming = items.filter((i) => i.status === "upcoming").map((i) => i.key);
      expect(upcoming).toEqual(
        CAPABILITY_REGISTRY.filter((c) => c.tier !== "full" && c.status === "upcoming").map(
          (c) => c.key,
        ),
      );
      expect(upcoming).toHaveLength(6); // 7 in the registry, access_accounting (tier full) hidden
      for (const i of items) expect(i).not.toHaveProperty("tier");
      expect((res.body.groups as unknown[]).length).toBe(6);
    });

    it("org-scoped + manage_roles: STF → 403 FORBIDDEN, a non-member → 403 ORG_ACCESS_DENIED", async () => {
      const r1 = await get(on, `/orgs/${A().org.id}/capabilities`, user("STF")).expect(403);
      expect(r1.body.error.code).toBe("FORBIDDEN");
      const r2 = await get(on, `/orgs/${seed.shops.B.org.id}/capabilities`, user("ADM_A")).expect(
        403,
      );
      expect(r2.body.error.code).toBe("ORG_ACCESS_DENIED");
    });
  });

  // ── I3-13 ────────────────────────────────────────────────────────────────
  describe("I3-13 GET /role-details · GET /roles/{id}", () => {
    it("usage counts active members and pending invitations (expired included); revoked holders do not count", async () => {
      const m = await details(on, "ADM_A");
      // Staff: STF · invitations pending + expired + reissuedByOwn
      expect(m.get(roleId.staff())!.usage).toEqual({ activeMembers: 1, pendingInvitations: 3 });
      // Admin: ADM_A + activeInBoth
      expect(m.get(roleId.admin())!.usage).toEqual({ activeMembers: 2, pendingInvitations: 0 });
      expect(m.get(roleId.custom("R_T"))!.usage).toEqual({
        activeMembers: 1,
        pendingInvitations: 1,
      });
      // R_HIST: only REV (revoked)
      expect(m.get(roleId.custom("R_HIST"))!.usage).toEqual({
        activeMembers: 0,
        pendingInvitations: 0,
      });
    });

    it("lists every live role oldest first, lastEdited=null after seed (R_T was edited by the kit)", async () => {
      const res = await get(on, `/orgs/${A().org.id}/role-details`, user("ADM_A")).expect(200);
      expect(res.headers["cache-control"]).toBe("no-store");
      const items = res.body.items as Detail[];
      expect(items).toHaveLength(3 + 7);
      expect(items.slice(0, 3).map((i) => i.key)).toEqual(["owner", "admin", "staff"]);
      for (const i of items) {
        if (i.id !== roleId.custom("R_T")) expect(i.lastEdited, i.name).toBeNull();
      }
      expect(res.body.nextCursor).toBeNull();
      expect(res.body.viewer).toEqual({ canCreate: ok, limit: 30 });
      const owner = items[0]!;
      expect(owner).toMatchObject({
        isSystem: true,
        grantsOwnership: true,
        capabilities: ["full_access"],
      });
      expect(items.find((i) => i.id === roleId.custom("R_T"))).toMatchObject({
        key: null,
        nameCustomized: true,
        version: 1,
      });
    });

    it("★ ADM_A's verdicts: role_locked · owner_role · equal_permissions_in_use · exceeds · in_use · allowed", async () => {
      const m = await details(on, "ADM_A");
      const v = (id: string) => m.get(id)!.viewer;
      expect(v(roleId.owner())).toEqual({
        canEdit: no("role_locked"),
        canDelete: no("role_locked"),
        canClone: no("owner_role"),
      });
      // Admin = ADM_A's own role, also held by activeInBoth → equal + held by another
      for (const id of [roleId.admin(), roleId.custom("R_B")]) {
        expect(v(id)).toEqual({
          canEdit: no("equal_permissions_in_use"),
          canDelete: no("equal_permissions_in_use"),
          canClone: ok,
        });
      }
      expect(v(roleId.custom("R_BILL"))).toEqual({
        canEdit: no("exceeds_your_permissions"),
        canDelete: no("exceeds_your_permissions"),
        canClone: no("exceeds_your_permissions"),
      });
      expect(v(roleId.staff())).toEqual({ canEdit: ok, canDelete: no("in_use"), canClone: ok });
      expect(v(roleId.custom("R_HIST"))).toEqual({ canEdit: ok, canDelete: ok, canClone: ok });
    });

    it("★ MR (manage_roles without manage_members): in_use_requires_manage_members, own role editable", async () => {
      const m = await details(on, "MR");
      expect(m.get(roleId.custom("R_T"))!.viewer).toEqual({
        canEdit: no("in_use_requires_manage_members"),
        canDelete: no("in_use_requires_manage_members"),
        canClone: ok,
      });
      expect(m.get(roleId.staff())!.viewer.canEdit).toEqual(no("exceeds_your_permissions"));
      // R_MR: MR is its only holder → nobody ELSE holds it
      expect(m.get(roleId.custom("R_MR"))!.viewer).toEqual({
        canEdit: ok,
        canDelete: no("in_use"),
        canClone: ok,
      });
    });

    it("GET /roles/{id} is byte-for-byte the list item, for every role", async () => {
      const m = await details(on, "MR");
      for (const [id, item] of m) {
        const res = await get(on, `/orgs/${A().org.id}/roles/${id}`, user("MR")).expect(200);
        expect(res.headers["cache-control"]).toBe("no-store");
        expect(res.body).toEqual(item);
      }
    });

    it("STF and MM (no manage_roles) → 403 FORBIDDEN on all three", async () => {
      for (const p of ["STF", "MM"] as const) {
        for (const path of ["role-details", `roles/${roleId.staff()}`, "capabilities"]) {
          const res = await get(on, `/orgs/${A().org.id}/${path}`, user(p)).expect(403);
          expect(res.body.error.code, `${p} ${path}`).toBe("FORBIDDEN");
        }
      }
    });

    it("another shop's role, a deleted role and an unknown id are the same 404", async () => {
      const deleted = await kit.createCustomRole({
        organizationId: A().org.id,
        name: "b21-deleted",
        capabilities: ["manage_orders"],
      });
      await kit.softDeleteRole(A().org.id, deleted.id);
      const bodies = [];
      for (const id of [seed.shops.B.customRoles.R_T.id, deleted.id, "no-such-role"]) {
        const res = await get(on, `/orgs/${A().org.id}/roles/${id}`, user("ADM_A")).expect(404);
        bodies.push(res.body.error.code);
      }
      expect(bodies).toEqual(["NOT_FOUND", "NOT_FOUND", "NOT_FOUND"]);
      // and the deleted role is gone from the list
      expect((await details(on, "ADM_A")).has(deleted.id)).toBe(false);
    });

    it("★ flag off: every write verdict is writes_disabled, including canCreate", async () => {
      const res = await get(off, `/orgs/${A().org.id}/role-details`, user("ADM_A")).expect(200);
      expect(res.body.viewer.canCreate).toEqual(no("writes_disabled"));
      const verdicts = (res.body.items as Detail[]).flatMap((i) => Object.values(i.viewer));
      expect(verdicts.length).toBeGreaterThanOrEqual(30);
      for (const v of verdicts) expect(v).toEqual(no("writes_disabled"));
    });
  });

  // ── I3-53 ────────────────────────────────────────────────────────────────
  describe("I3-53 lastEdited.by — org-scoped (SR-09)", () => {
    it("★ editor moved to shop B ⇒ former_member, and the body carries nothing of shop B", async () => {
      // Give the moved editor a DISTINCTLY named role in B, so a leak would be visible.
      const B = seed.shops.B;
      await kit.setMembershipRole(B.org.id, seed.movedEditor.user.id, B.customRoles.R_T.id);
      const res = await get(
        on,
        `/orgs/${A().org.id}/roles/${seed.movedEditor.editedRoleId}`,
        user("ADM_A"),
      ).expect(200);
      expect(res.body.lastEdited.by).toEqual({ kind: "former_member" });
      const raw = JSON.stringify(res.body);
      const bRoles = await prisma.role.findMany({ where: { organizationId: B.org.id } });
      expect(bRoles.length).toBeGreaterThanOrEqual(10); // non-vacuity
      for (const r of bRoles) {
        expect(raw).not.toContain(r.id);
        if (r.key === null) expect(raw, r.name).not.toContain(r.name);
      }
      expect(raw).not.toContain(seed.movedEditor.user.id);
      expect(raw).not.toContain(B.org.id);
    });

    it("editor = viewer ⇒ me · active member ⇒ member + CURRENT role, following a role change", async () => {
      const at = new Date(Date.now() - 60_000);
      await kit.setLastEdited(A().org.id, roleId.custom("R_HIST"), { at, byUserId: user("ADM_A") });
      await kit.setLastEdited(A().org.id, roleId.custom("R_BILL"), { at, byUserId: user("T") });
      // activeInBoth: Admin in A, Staff in B — A's role must win.
      await kit.setLastEdited(A().org.id, roleId.custom("R_MM"), {
        at,
        byUserId: seed.activeInBoth.user.id,
      });
      // REV: a REVOKED membership in this shop is not "member".
      await kit.setLastEdited(A().org.id, roleId.custom("R_MR"), { at, byUserId: user("REV") });

      const one = async (id: string) =>
        (await get(on, `/orgs/${A().org.id}/roles/${id}`, user("ADM_A")).expect(200))
          .body as Detail;
      expect((await one(roleId.custom("R_HIST"))).lastEdited).toEqual({
        at: at.toISOString(),
        by: { kind: "me" },
      });
      expect((await one(roleId.custom("R_BILL"))).lastEdited!.by).toEqual({
        kind: "member",
        roleName: "R_T-A",
        roleKey: null,
        roleNameCustomized: true,
      });
      expect((await one(roleId.custom("R_MM"))).lastEdited!.by).toEqual({
        kind: "member",
        roleName: "Admin",
        roleKey: "admin",
        roleNameCustomized: false,
      });
      expect((await one(roleId.custom("R_MR"))).lastEdited!.by).toEqual({ kind: "former_member" });

      await kit.setMembershipRole(A().org.id, user("T"), roleId.staff());
      try {
        expect((await one(roleId.custom("R_BILL"))).lastEdited!.by).toEqual({
          kind: "member",
          roleName: "Staff",
          roleKey: "staff",
          roleNameCustomized: false,
        });
        // the same rows on the list route
        const m = await details(on, "ADM_A");
        expect(m.get(roleId.custom("R_BILL"))!.lastEdited!.by).toMatchObject({ roleName: "Staff" });
        expect(m.get(roleId.custom("R_HIST"))!.lastEdited!.by).toEqual({ kind: "me" });
      } finally {
        await kit.setMembershipRole(A().org.id, user("T"), roleId.custom("R_T"));
      }
    });
  });

  // ── I3-57 ────────────────────────────────────────────────────────────────
  describe("I3-57 ★ GET routes that compute viewer.* emit nothing", () => {
    const spies = [
      decideRoleWrite,
      decideMemberAuthority,
      decideAdminResetVisible,
      decideRoleAssignVisible,
    ].map((f) => vi.mocked(f as (...args: never[]) => unknown));
    const decisions = () => spies.reduce((n, s) => n + s.mock.calls.length, 0);

    const fill = (path: string): string =>
      path.replace(/\{(\w+)\}/g, (_m, name: string) => {
        if (name === "orgId") return A().org.id;
        if (name === "roleId") return roleId.custom("R_T");
        throw new Error(`I3-57: no sweep value for path parameter {${name}} in ${path}`);
      });

    it("sweep (enumerated from the router) → 0 events of any type, no new dedupe key; control → the sink is live", async () => {
      const routes = enumerateRoutes(on.app).filter(
        (r) => r.method === "GET" && r.path.startsWith("/orgs/{orgId}") && r.scope === "org",
      );
      expect(routes.length).toBeGreaterThanOrEqual(5); // non-vacuity of the enumeration itself
      const personas: PersonaKey[] = ["ADM_A", "MR", "MMS"];
      const capsOf = new Map<PersonaKey, readonly string[]>();
      for (const p of personas) {
        const m = await prisma.membership.findFirstOrThrow({
          where: { organizationId: A().org.id, userId: user(p) },
          select: { role: { select: { capabilities: true } } },
        });
        capsOf.set(p, m.role.capabilities);
      }

      // Count only THIS app's dedupe writes. A global `KEYS secevt:dedupe:*` count raced
      // with other suites sharing the Redis under a parallel run (red for nothing — and
      // could stay green if another suite's key expired as ours was added). The store is
      // the instance SecurityEventsService writes through (useExisting AUTH_REDIS).
      const dedupeStore = on.app.get<{ set: (...a: unknown[]) => unknown }>(
        SECURITY_EVENTS_DEDUPE_STORE,
        { strict: false },
      );
      // Non-vacuity of the spy: it must be the same instance the service was wired with.
      expect(dedupeStore).toBe(on.app.get(AUTH_REDIS, { strict: false }));
      const dedupeSets = vi.spyOn(dedupeStore, "set");
      const ourDedupeWrites = () =>
        dedupeSets.mock.calls.filter(
          (c) => typeof c[0] === "string" && c[0].startsWith(ESCALATION_DEDUPE_PREFIX),
        ).length;
      sink.clear();
      const verdictRoutes = new Set<string>();
      let refusedVerdicts = 0;
      let calls = 0;
      for (const route of routes) {
        for (const p of personas) {
          if (
            route.declaration === "capability" &&
            !hasCapability(capsOf.get(p)!, route.capability!)
          ) {
            continue; // a 403 emits capability_denied by design — not a verdict route for p
          }
          const before = decisions();
          const res = await get(on, fill(route.path), user(p));
          expect(res.status, `${p} GET ${route.path}`).toBe(200);
          calls += 1;
          const body = JSON.stringify(res.body);
          if (decisions() > before || /"viewerCan\w+":/.test(body)) {
            verdictRoutes.add(route.path);
            refusedVerdicts += (body.match(/"allowed":false|"viewerCan\w+":false/g) ?? []).length;
          }
        }
      }

      expect(calls).toBeGreaterThan(0);
      // Today: the three B21 routes. B22 adds `viewer*` on /roles, /members,
      // /invitations — those join this set automatically (no list to update).
      for (const path of [
        "/orgs/{orgId}/role-details",
        "/orgs/{orgId}/roles/{roleId}",
        "/orgs/{orgId}/roles",
        "/orgs/{orgId}/members",
        "/orgs/{orgId}/invitations",
      ]) {
        expect([...verdictRoutes]).toContain(path);
      }
      // B22 adds /roles, /members, /invitations (and the B21 three) — floor raised from 2.
      expect(verdictRoutes.size).toBeGreaterThanOrEqual(5);
      expect(refusedVerdicts).toBeGreaterThan(0);
      expect(sink.types()).toEqual([]);
      expect(ourDedupeWrites()).toBe(0);
      dedupeSets.mockRestore();

      // Control: a refusal on the same surface reaches the same sink.
      await get(on, `/orgs/${A().org.id}/role-details`, user("MMS")).expect(403);
      expect(sink.types()).toContain("org.access.capability_denied");
    });
  });
});
