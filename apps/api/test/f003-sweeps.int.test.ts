// F-003 · T-003-QA08 ★ — cross-route sweeps on the REAL stack (DB; Redis not bound →
// the org rate limiter takes its documented fail-open path).
//
//   I3-52  ★ leak kit over every F-003 route, ENUMERATED from `ROUTE_CAPABILITIES`
//          (rows whose capability is `manage_roles` — not a hand-typed list), 5
//          personas × {A, B, no-such-org}: no cross-tenant success, the right denial
//          code, no foreign email, ≥ 1 success per route (non-vacuity), ≥ 6 routes.
//          Then the roleId axis: shop B's role on shop A's path answers the SAME 404
//          bytes as an unknown id and a deleted role (GET · PATCH · DELETE) and B's row
//          does not move · `?roleId=<B's>` on /members and /invitations → 200 empty,
//          with an A-role control that is NOT empty.
//   I3-57  control half: after a GET sweep that returned verdict=false, the write that
//          verdict describes emits exactly ONE `org.role.escalation_denied`. (The sweep
//          itself — every verdict GET from the router, 0 events, 0 dedupe keys — is
//          f003-role-reads.e2e.int.test.ts "I3-57"; its control is a capability_denied.)
//   I3-50  every event this file collected (role created/updated/deleted, escalation,
//          capability/org denials, invitation created/cancelled, member role change)
//          carries no seeded email as a substring and no person-name key — with a
//          non-vacuity floor (an `emailMasked` was seen) and an in-test red proof.
//
// Already proved elsewhere and NOT repeated here:
//   I3-56 part 1 — role-key-authority.int.test.ts · part 2 — f003-role-writes.int.test.ts
//   "I3-56 ★ part 2" · M3-04 backfill — packages/db/test/f003-backfill.int.test.ts.
//   I3-13 404 identity on GET /roles/{id} as ADM_A — f003-role-reads.e2e.int.test.ts.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@omnistock/db";
import { AccessTokenService } from "../src/auth/access-token.service";
import { CAPABILITY_MANAGE_ROLES } from "@omnistock/core-domain";
import {
  collectSecurityEvents,
  type SecurityEventCollector,
} from "../src/auth/security-events.service";
import { enumerateRoutes, ROUTE_CAPABILITIES } from "../src/common/authz";
import { INT_LANE_ENABLED, createTestApp, type TestApp } from "./app.kit";
import { assertIdenticalErrorBodies } from "./assertions.kit";
import { createF003SeedKit, type F003SeedKit } from "./f003-seed.kit";
import type { SeededRole, SeededUser } from "./f002-seed.kit";
import {
  assertNoCrossOrgLeak,
  createOrgLeakKit,
  type OrgLeakKit,
  type SweepOutcome,
  type TargetOrg,
} from "./org-leak.kit";

const d = INT_LANE_ENABLED ? describe : describe.skip;
if (!INT_LANE_ENABLED) {
  console.warn(
    "[T-003-QA08] SKIPPING the F-003 sweeps: TEST_DATABASE_URL / TEST_REDIS_URL are not set. " +
      "I3-50 / I3-52 / I3-57 (control) are NOT verified.",
  );
}

/** I3-52 — the F-003 surface, read from the production table. */
const F003_ROUTES = ROUTE_CAPABILITIES.filter((r) => r.capability === CAPABILITY_MANAGE_ROLES);

/** Keys that would name a PERSON in an event payload (AC-9.5). `name` is a ROLE's name. */
const PERSON_KEYS = new Set(
  ["email", "displayName", "fullName", "firstName", "lastName", "userName", "personName"].map((k) =>
    k.toLowerCase(),
  ),
);

/** I3-50 — what a payload must not carry. Pure, so the red proof below can feed it a tamper. */
export function payloadPiiFindings(
  events: readonly { type: string; payload: unknown }[],
  seededEmails: readonly string[],
): string[] {
  const out: string[] = [];
  const walk = (type: string, node: unknown, path: string): void => {
    if (Array.isArray(node)) node.forEach((v, i) => walk(type, v, `${path}[${i}]`));
    else if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        if (PERSON_KEYS.has(k.toLowerCase())) out.push(`${type}: person key \`${path}.${k}\``);
        walk(type, v, `${path}.${k}`);
      }
    }
  };
  for (const e of events) {
    const json = JSON.stringify(e.payload ?? null).toLowerCase();
    for (const email of seededEmails) {
      if (json.includes(email.toLowerCase())) out.push(`${e.type}: carries the email ${email}`);
    }
    walk(e.type, e.payload, "payload");
  }
  return out;
}

d("T-003-QA08 F-003 sweeps (E2E, DB)", () => {
  let app: TestApp;
  let prisma: PrismaClient;
  let leak: OrgLeakKit;
  let kit: F003SeedKit;
  let sink: SecurityEventCollector;
  /** I3-50 — never cleared: everything this file emitted, start to end. */
  let all: SecurityEventCollector;
  const seededEmails: string[] = [];
  const unique = () => Math.random().toString(36).slice(2, 8);

  // Two Admins of A (equal permissions) — the I3-57 control and a source of escalation events.
  let admX: SeededUser;
  let admY: SeededUser;
  let tokenX: string;

  const call = (
    method: "get" | "post" | "patch" | "delete",
    path: string,
    token: string,
    body?: unknown,
  ) => {
    let r = request(app.server())[method](path).set("Authorization", `Bearer ${token}`);
    if (body !== undefined) r = r.set("Content-Type", "application/json").send(body as object);
    return r;
  };

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    await prisma.$connect();
    process.env.ROLE_WRITES_ENABLED = "true";
    app = await createTestApp();
    delete process.env.ROLE_WRITES_ENABLED;
    sink = collectSecurityEvents(app.events);
    all = collectSecurityEvents(app.events);
    leak = await createOrgLeakKit(app.app, prisma, { withUnderprivileged: true });
    kit = createF003SeedKit(prisma, { label: "qa08" });
    seededEmails.push(...leak.personas.map((p) => p.email));
    const signer = app.app.get(AccessTokenService, { strict: false });
    admX = await kit.createUser();
    admY = await kit.createUser();
    seededEmails.push(admX.email, admY.email);
    for (const u of [admX, admY]) {
      await kit.addMember({
        organizationId: leak.orgA.id,
        userId: u.id,
        roleId: leak.orgA.roles.Admin!.id,
      });
    }
    tokenX = signer.sign(admX.id);
  });

  afterAll(async () => {
    sink?.stop();
    all?.stop();
    if (leak) await leak.cleanup();
    if (kit) await kit.cleanup();
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });

  const role = (org: "A" | "B", label: string): Promise<SeededRole> =>
    kit.createCustomRole({
      organizationId: org === "A" ? leak.orgA.id : leak.orgB.id,
      name: `qa08 ${label} ${unique()}`,
      capabilities: ["manage_orders"],
    });

  // ── I3-52 ────────────────────────────────────────────────────────────────
  describe("I3-52 ★ leak kit over the F-003 routes (enumerated from ROUTE_CAPABILITIES)", () => {
    it("every manage_roles route × 5 personas × {A, B, no-such-org}: no leak, right codes, ≥ 1 success each", async () => {
      // Non-vacuity of the enumeration: the table names ≥ 6 routes, and each is LIVE.
      expect(F003_ROUTES.length).toBeGreaterThanOrEqual(6);
      const live = new Set(enumerateRoutes(app.app).map((r) => `${r.method} ${r.path}`));
      for (const r of F003_ROUTES)
        expect(live, `${r.method} ${r.path}`).toContain(`${r.method} ${r.path}`);

      const checked: string[] = [];
      for (const r of F003_ROUTES) {
        const params: Partial<Record<TargetOrg, Record<string, string>>> = {};
        if (r.path.includes("{roleId}")) {
          // A row that EXISTS in the org each target addresses — fresh per route (DELETE eats it).
          params.A = { roleId: (await role("A", r.method)).id };
          params.B = { roleId: (await role("B", r.method)).id };
          params.nonexistent = { roleId: params.A.roleId };
        }
        const body =
          r.method === "POST"
            ? { name: `qa08 new ${unique()}`, capabilities: ["manage_orders"] }
            : r.method === "PATCH"
              ? { version: 1, name: `qa08 renamed ${unique()}` }
              : undefined;
        if (r.method !== "GET" && r.method !== "DELETE" && body === undefined) {
          throw new Error(`I3-52: no sweep body for ${r.method} ${r.path} — add one`);
        }
        const outcomes = await leak.sweep({
          method: r.method.toLowerCase() as "get" | "post" | "patch" | "delete",
          path: r.path,
          body,
          params,
        });
        expect(outcomes).toHaveLength(15);
        assertNoCrossOrgLeak(outcomes, {
          foreignValues: leak.foreignEmails("activeInAOnly"),
          taxIds: leak.taxIds,
        });
        const at = (p: SweepOutcome["persona"], t: TargetOrg) =>
          outcomes.find((o) => o.persona === p && o.target === t)!;
        // The control that makes the denials mean something: the Owner of A IS served.
        expect(at("activeInAOnly", "A").status, `${r.method} ${r.path}`).toBeLessThan(300);
        // I-5 on the F-003 surface: a member without manage_roles is FORBIDDEN, not ORG_ACCESS_DENIED.
        expect([
          at("underprivilegedInA", "A").status,
          (at("underprivilegedInA", "A").body as { error?: { code?: string } }).error?.code,
        ]).toEqual([403, "FORBIDDEN"]);
        checked.push(`${r.method} ${r.path}`);
      }
      console.info(`[I3-52] swept ${checked.length} F-003 routes: ${checked.join(" · ")}`);
      expect(checked.length).toBeGreaterThanOrEqual(6);
    });

    it("B's role on A's path = the same 404 bytes as an unknown id and a deleted role (GET · PATCH · DELETE); B's row does not move", async () => {
      // activeInBoth is the strongest caller: Owner in A AND in B — it may write B's role on B's path.
      const both = leak.persona("activeInBoth");
      const foreign = await role("B", "foreign");
      const deleted = await role("A", "deleted");
      await kit.softDeleteRole(leak.orgA.id, deleted.id);
      const before = await prisma.role.findUniqueOrThrow({ where: { id: foreign.id } });

      const shapes = [
        { method: "get" as const, body: undefined },
        { method: "patch" as const, body: { version: 1, name: `qa08 hijack ${unique()}` } },
        { method: "delete" as const, body: undefined },
      ];
      for (const { method, body } of shapes) {
        const fire = (id: string) =>
          call(method, `/orgs/${leak.orgA.id}/roles/${id}`, both.accessToken, body);
        const viaA = await fire(foreign.id);
        const ghost = await fire(`qa08-no-such-role-${unique()}`);
        const gone = await fire(deleted.id);
        expect([viaA.status, viaA.body.error?.code], `${method} foreign`).toEqual([
          404,
          "NOT_FOUND",
        ]);
        assertIdenticalErrorBodies(viaA, ghost);
        assertIdenticalErrorBodies(viaA, gone);
        expect(await prisma.role.findUniqueOrThrow({ where: { id: foreign.id } })).toEqual(before);
      }
      // Control: the same caller on B's OWN path is served — the row is real and reachable.
      const ownPath = await call(
        "get",
        `/orgs/${leak.orgB.id}/roles/${foreign.id}`,
        both.accessToken,
      );
      expect(ownPath.status).toBe(200);
      expect(ownPath.body.id).toBe(foreign.id);
    });

    it("?roleId=<B's role> on A's /members and /invitations → 200 and empty; an A role → not empty (control)", async () => {
      const owner = leak.persona("activeInAOnly");
      const bOwnerRole = leak.orgB.roles.Owner!.id; // activeInBoth holds it in B
      const bRole = await role("B", "invited");
      const issuerB = leak.persona("activeInBoth").userId;
      const invB = `qa08-inv-b-${unique()}@seed.test`;
      const invA = `qa08-inv-a-${unique()}@seed.test`;
      seededEmails.push(invA, invB);
      await kit.createInvitation({
        organizationId: leak.orgB.id,
        email: invB,
        roleId: bRole.id,
        issuedByUserId: issuerB,
      });
      await kit.createInvitation({
        organizationId: leak.orgA.id,
        email: invA,
        roleId: leak.orgA.roles.Staff!.id,
        issuedByUserId: owner.userId,
      });

      const page = async (path: string) => {
        const res = await call("get", `/orgs/${leak.orgA.id}${path}`, owner.accessToken);
        expect(res.status, path).toBe(200);
        return res.body.items as unknown[];
      };
      expect(await page(`/members?roleId=${bOwnerRole}`)).toEqual([]);
      expect(await page(`/invitations?roleId=${bRole.id}&status=all`)).toEqual([]);
      // B really has rows under those ids (asked on B's own path) — the empty above is the filter.
      const inB = await call(
        "get",
        `/orgs/${leak.orgB.id}/invitations?roleId=${bRole.id}&status=all`,
        leak.persona("activeInBoth").accessToken,
      );
      expect(inB.body.items).toHaveLength(1);
      expect((await page(`/members?roleId=${leak.orgA.roles.Staff!.id}`)).length).toBeGreaterThan(
        0,
      );
      expect(
        (await page(`/invitations?roleId=${leak.orgA.roles.Staff!.id}&status=all`)).length,
      ).toBeGreaterThan(0);
    });
  });

  // ── I3-57 (control half) ────────────────────────────────────────────────
  describe("I3-57 control — the write a verdict=false describes reaches the sink once", () => {
    it("Admin X reads the Admin role (equal_permissions_in_use, 0 events) → PATCH it → exactly 1 escalation_denied", async () => {
      const adminRole = leak.orgA.roles.Admin!.id;
      sink.clear();
      const view = await call("get", `/orgs/${leak.orgA.id}/roles/${adminRole}`, tokenX);
      expect(view.status).toBe(200);
      expect(view.body.viewer.canEdit).toEqual({
        allowed: false,
        reason: "equal_permissions_in_use",
      });
      const list = await call("get", `/orgs/${leak.orgA.id}/members`, tokenX);
      const yRow = (list.body.items as { userId: string; viewerCanManage?: boolean }[]).find(
        (m) => m.userId === admY.id,
      );
      expect(yRow?.viewerCanManage).toBe(false);
      expect(sink.types()).toEqual([]); // the verdict GETs emit nothing of any type

      const write = await call("patch", `/orgs/${leak.orgA.id}/roles/${adminRole}`, tokenX, {
        version: view.body.version,
        name: `qa08 admin ${unique()}`,
      });
      expect(write.status).toBe(403);
      const denied = sink.ofType("org.role.escalation_denied");
      expect(denied).toHaveLength(1);
      expect(denied[0]!.payload).toMatchObject({
        operation: "update_role",
        roleId: adminRole,
        actorUserId: admX.id,
      });
      // Nothing else — bar the limiter's documented fail-open signal (no Redis bound here).
      expect(sink.types().filter((t) => t !== "auth.throttle.fail_open")).toEqual([
        "org.role.escalation_denied",
      ]);
    });
  });

  // ── I3-50 ────────────────────────────────────────────────────────────────
  describe("I3-50 — no email, no person's name in any event payload", () => {
    it("member + invitation events join the role events; the whole collection is clean", async () => {
      const owner = leak.persona("activeInAOnly");
      const staff = leak.persona("underprivilegedInA");
      const invited = `qa08-i350-${unique()}@seed.test`;
      seededEmails.push(invited);
      const created = await call("post", `/orgs/${leak.orgA.id}/invitations`, owner.accessToken, {
        email: invited,
        roleId: leak.orgA.roles.Staff!.id,
      });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const invId = (created.body.invitation?.id ?? created.body.id) as string;
      expect(
        (await call("delete", `/orgs/${leak.orgA.id}/invitations/${invId}`, owner.accessToken))
          .status,
      ).toBeLessThan(300);
      const custom = await role("A", "move");
      expect(
        (
          await call("patch", `/orgs/${leak.orgA.id}/members/${staff.userId}`, owner.accessToken, {
            roleId: custom.id,
          })
        ).status,
      ).toBe(200);
      // Self-sufficient (runs alone under -t): one role created → updated → deleted here too.
      const made = await call("post", `/orgs/${leak.orgA.id}/roles`, owner.accessToken, {
        name: `qa08 i350 ${unique()}`,
        capabilities: ["manage_orders"],
      });
      expect(made.status, JSON.stringify(made.body)).toBe(201);
      const renamed = await call(
        "patch",
        `/orgs/${leak.orgA.id}/roles/${made.body.id}`,
        owner.accessToken,
        {
          version: made.body.version,
          name: `qa08 i350b ${unique()}`,
        },
      );
      expect(renamed.status).toBe(200);
      expect(
        (await call("delete", `/orgs/${leak.orgA.id}/roles/${made.body.id}`, owner.accessToken))
          .status,
      ).toBe(200);
      // …and a capability denial (Staff on a manage_roles read).
      await call("get", `/orgs/${leak.orgA.id}/role-details`, staff.accessToken).expect(403);

      const events = all.events.map((e) => ({ type: e.type, payload: e.payload as unknown }));
      const types = new Set(events.map((e) => e.type));
      // Non-vacuity: the email-bearing families really were exercised in this collection.
      for (const t of [
        "org.role.created",
        "org.role.updated",
        "org.role.deleted",
        "org.invitation.created",
        "org.invitation.cancelled",
        "org.member.role_changed",
        "org.access.capability_denied",
      ]) {
        expect([...types], t).toContain(t);
      }
      expect(JSON.stringify(events)).toContain("emailMasked");
      expect(seededEmails.length).toBeGreaterThanOrEqual(8); // 5 personas + 2 Admins + the invitee
      expect(payloadPiiFindings(events, seededEmails)).toEqual([]);

      // Red proof: the same scanner, the same events, one payload carrying the address it masked.
      const tampered = events.map((e) =>
        e.type === "org.invitation.created"
          ? { ...e, payload: { ...(e.payload as object), emailMasked: invited } }
          : e,
      );
      expect(payloadPiiFindings(tampered, seededEmails).join("\n")).toContain(invited);
      expect(
        payloadPiiFindings([{ type: "x", payload: { nested: [{ DisplayName: "n" }] } }], []),
      ).toHaveLength(1);
    });
  });
});
