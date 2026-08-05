// F-002 · T-002-22 ★ — the kits, proven against the REAL guard chain
// (deliverables 2, 3, 4 and 5, end to end).
//
// The unit meta-tests prove each audit can go red on a fabricated outcome. This
// file proves the other half: that the kit, pointed at a live application with a
// real Postgres behind it, produces outcomes at all — and that the outcomes it
// produces are the ones a correctly isolated endpoint gives.
//
// A kit that has never been run against the real middleware/guard/ALS chain is a
// kit whose first real use will be its first debugging session.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@omnistock/db";
import { AccessTokenService } from "../src/auth/access-token.service";
import { assertErrorEnvelope, assertNoSecretFields, assertIdenticalErrorBodies } from "./assertions.kit";
import { INT_LANE_ENABLED, createTestApp, type TestApp } from "./app.kit";
import { BOOM_MESSAGE } from "./fixtures/boom.controller";
import { assertNoCrossOrgLeak, auditSweep, createOrgLeakKit, type OrgLeakKit } from "./org-leak.kit";
import { assertRouteRegistryClean, auditApp } from "./route-registry.kit";

const d = INT_LANE_ENABLED ? describe : describe.skip;

// ── I-37 — a lane that silently skipped itself is not a result ──────────────
describe("int lane guard (I-37)", () => {
  it("in the integration lane, DB/Redis must be ENABLED — a skipped suite proves nothing", () => {
    // Locally the lane may be off (that is a developer's choice and it is
    // reported as SKIPPED). In the job that exists to run it, it may not:
    // "green" would then mean "we ran nothing", which is the F-001 lesson this
    // project already paid for.
    //
    // ⛔ Keyed off REQUIRE_INT_LANE, NOT `CI`. GitHub sets `CI` in every job,
    // including `node-ci`, which has no service containers by design and
    // correctly skips these suites — so the `CI` version of this guard failed
    // node-ci for behaving exactly as intended. The variable names the ONE job
    // where a skipped int suite is a failure rather than a choice.
    if (process.env.REQUIRE_INT_LANE) {
      expect(
        INT_LANE_ENABLED,
        "TEST_DATABASE_URL + TEST_REDIS_URL must be set in the integration-api job",
      ).toBe(true);
    } else {
      expect(typeof INT_LANE_ENABLED).toBe("boolean");
    }
  });
});

d("org-leak kit against the live guard chain", () => {
  let testApp: TestApp;
  let prisma: PrismaClient;
  let kit: OrgLeakKit;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    await prisma.$connect();
    testApp = await createTestApp();
    kit = await createOrgLeakKit(testApp.app, prisma, { withUnderprivileged: true });
  });

  afterAll(async () => {
    if (kit) await kit.cleanup();
    if (testApp) await testApp.close();
    if (prisma) await prisma.$disconnect();
  });

  it("builds four distinct membership situations (plus the opt-in fifth)", () => {
    expect(kit.personas.map((p) => p.key)).toEqual([
      "activeInAOnly",
      "activeInBoth",
      "revokedInA",
      "noMembership",
      "underprivilegedInA",
    ]);
    expect(kit.orgA.id).not.toBe(kit.orgB.id);
    expect(kit.persona("revokedInA").activeInA).toBe(false);
    expect(kit.persona("activeInBoth").activeInB).toBe(true);
    // Every persona holds a usable token, or "denied" would prove nothing.
    for (const p of kit.personas) expect(p.accessToken.split(".")).toHaveLength(3);
  });

  it("★ sweeps an @AnyActiveMember() route with no leak in any direction", async () => {
    const outcomes = await kit.sweep({ method: "get", path: "/__test__/probe/{orgId}" });
    // 5 personas × 3 targets — the shape of the evidence matters as much as the
    // verdict: a sweep that quietly fired 3 requests would still "pass".
    expect(outcomes).toHaveLength(15);
    assertNoCrossOrgLeak(outcomes, { foreignValues: kit.foreignEmails("activeInAOnly") });

    // And the control that makes the verdict mean something: the member DID get
    // served, and got THEIR org back — not the one they asked about.
    const ok = outcomes.find((o) => o.persona === "activeInAOnly" && o.target === "A");
    expect(ok?.status).toBe(200);
    expect((ok?.body as { organizationId: string }).organizationId).toBe(kit.orgA.id);
  });

  it("★ AC-5.1: the revoked member's very next request is 403 ORG_ACCESS_DENIED", async () => {
    const outcomes = await kit.sweep({ method: "get", path: "/__test__/probe/{orgId}", targets: ["A"] });
    const revoked = outcomes.find((o) => o.persona === "revokedInA");
    expect(revoked?.status).toBe(403);
    assertErrorEnvelope({ status: revoked!.status, body: revoked!.body }, { code: "ORG_ACCESS_DENIED" });
  });

  it("★ I-8: 'not your org' and 'no such org' are byte-identical after normalizing traceId", async () => {
    const outcomes = await kit.sweep({
      method: "get",
      path: "/__test__/probe/{orgId}",
      targets: ["A", "nonexistent"],
    });
    const stranger = outcomes.find((o) => o.persona === "noMembership" && o.target === "A")!;
    const ghost = outcomes.find((o) => o.persona === "noMembership" && o.target === "nonexistent")!;
    assertIdenticalErrorBodies(
      { status: stranger.status, body: stranger.body },
      { status: ghost.status, body: ghost.body },
    );
  });

  it("★ I-5: FORBIDDEN and ORG_ACCESS_DENIED are NOT merged", async () => {
    // The capability route. A member without `manage_members` must be told
    // FORBIDDEN (stay on the page); a non-member must be told ORG_ACCESS_DENIED
    // (go back to the org picker). One code for both makes the client wrong.
    const outcomes = await kit.sweep({
      method: "get",
      path: "/__test__/probe/{orgId}/members",
      targets: ["A"],
    });
    assertNoCrossOrgLeak(outcomes);

    const owner = outcomes.find((o) => o.persona === "activeInAOnly")!;
    const staff = outcomes.find((o) => o.persona === "underprivilegedInA")!;
    const stranger = outcomes.find((o) => o.persona === "noMembership")!;

    expect(owner.status).toBe(200);
    expect((owner.body as { organizationId: string }).organizationId).toBe(kit.orgA.id);
    expect(staff.status).toBe(403);
    assertErrorEnvelope({ status: staff.status, body: staff.body }, { code: "FORBIDDEN" });
    assertErrorEnvelope({ status: stranger.status, body: stranger.body }, { code: "ORG_ACCESS_DENIED" });
  });

  it("★ golden rule 3: the org-scoped count only ever sees ONE tenant's rows", async () => {
    // The probe's `members` route runs a REAL query through ORG_PRISMA. The two
    // orgs have different member counts, so a missing `organizationId` filter
    // would show up as the same number twice (or as the global total).
    const outcomes = await kit.sweep({
      method: "get",
      path: "/__test__/probe/{orgId}/members",
      targets: ["A", "B"],
    });
    const both = kit.persona("activeInBoth").key;
    const inA = outcomes.find((o) => o.persona === both && o.target === "A")!;
    const inB = outcomes.find((o) => o.persona === both && o.target === "B")!;
    expect(inA.status).toBe(200);
    expect(inB.status).toBe(200);
    const countA = (inA.body as { memberCount: number }).memberCount;
    const countB = (inB.body as { memberCount: number }).memberCount;
    // A has activeInAOnly + activeInBoth + revokedInA + underprivilegedInA = 4
    // rows; B has activeInBoth only. If either number were the global total the
    // filter is gone.
    expect(countA).toBe(4);
    expect(countB).toBe(1);
    const globalTotal = await prisma.membership.count();
    expect(countA).toBeLessThan(globalTotal);
  });

  it("RED PROOF: the audit reports the leak when a real sweep result is tampered with", async () => {
    // Same outcomes, one flipped to what a missing org filter would return.
    const outcomes = await kit.sweep({ method: "get", path: "/__test__/probe/{orgId}", targets: ["A"] });
    const tampered = outcomes.map((o) =>
      o.persona === "noMembership" ? { ...o, status: 200, body: { organizationId: kit.orgA.id } } : o,
    );
    expect(auditSweep(tampered).map((f) => f.kind)).toContain("leaked-to-outsider");
    expect(() => assertNoCrossOrgLeak(tampered)).toThrow();
    // …while the untampered result is clean, so the difference is the tamper.
    expect(auditSweep(outcomes)).toEqual([]);
  });

  it("★ I-06 on 500: a throw INSIDE an established org context leaks nothing", async () => {
    // The hardest of the three boom routes: OrgScopeGuard and CapabilityGuard
    // have both passed and the ALS context is open when the handler throws. The
    // envelope must still be the generic one — no org id, no user id, no stack.
    const member = kit.persona("activeInAOnly");
    const res = await request(testApp.server())
      .get(`/__test__/boom/org/${kit.orgA.id}`)
      .set("Authorization", `Bearer ${member.accessToken}`);

    assertErrorEnvelope(res, { code: "INTERNAL", status: 500 });
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain(BOOM_MESSAGE);
    expect(serialized).not.toContain(kit.orgA.id);
    expect(serialized).not.toContain(member.userId);
    expect(serialized).not.toContain(member.email);
    expect(res.headers["x-request-id"]).toBe(res.body.error.traceId);
  });

  it("a non-member hitting the same boom route gets 403 — never the 500", async () => {
    // Ordering proof: authorization runs before the handler, so a stranger can
    // never trigger (or observe) an internal error inside another org.
    const stranger = kit.persona("noMembership");
    const res = await request(testApp.server())
      .get(`/__test__/boom/org/${kit.orgA.id}`)
      .set("Authorization", `Bearer ${stranger.accessToken}`);
    assertErrorEnvelope(res, { code: "ORG_ACCESS_DENIED", status: 403 });
  });
});

d("route-registry audit against the live router", () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    if (testApp) await testApp.close();
  });

  it("the live application declares every org-scoped route it serves (I-02)", () => {
    const report = auditApp(testApp.app);
    // Non-vacuous: the enumeration really did find the F-001 surface.
    expect(report.routes.length).toBeGreaterThan(5);
    expect(report.routes.map((r) => `${r.method} ${r.path}`)).toContain("POST /auth/login");
    assertRouteRegistryClean(report);
  });

  it("RED PROOF: with the fixture filter off, the fixture routes ARE reported", () => {
    // The fixtures wear @AnyActiveMember()/@RequireCapability() but appear in
    // neither production table. That is exactly the shape of a new endpoint
    // somebody forgot to declare — so it is what proves the audit fires.
    const report = auditApp(testApp.app, { ignorePathPrefixes: [] });
    expect(report.problems.length).toBeGreaterThan(0);
    const routes = report.problems.map((p) => p.route);
    expect(routes).toContain("GET /__test__/probe/{orgId}");
    expect(routes).toContain("GET /__test__/probe/{orgId}/members");
    expect(() => assertRouteRegistryClean(report)).toThrow(/problem\(s\)/);
  });

  it("★ the table→router direction is CLEAN — `failOnPending` is on for good now", () => {
    // Written as "pending until the controllers land", with the author's own
    // exit condition: "the wave that ships them flips `failOnPending` on and
    // this list must empty." They have all landed, so it is flipped.
    //
    // Leaving it advisory any longer would have cost us: `GET /orgs/{orgId}/roles`
    // sat in the table with no handler for five waves, visible only as a
    // `pending` row nobody reads, while AC US-3 needed it for the invite
    // dropdown. `failOnPending: true` is what turns "declared but unbuilt" from
    // a note into a failure.
    const report = auditApp(testApp.app);
    expect(report.pending).toEqual([]);
    expect(() => assertRouteRegistryClean(report, { failOnPending: true })).not.toThrow();
  });
});

d("the deliberate 500 fixture + error envelope (I-06)", () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    if (testApp) await testApp.close();
  });

  it("a @Public() route that throws → 500 with a traceId and NOTHING about the error", async () => {
    const res = await request(testApp.server()).get("/__test__/boom/public");
    expect(res.status).toBe(500);
    assertErrorEnvelope(res, { code: "INTERNAL", status: 500 });
    // The thing support needs, on the status where the body says nothing else.
    expect(res.body.error.traceId).toBeTruthy();
    expect(res.headers["x-request-id"]).toBe(res.body.error.traceId);
    // …and the thing an attacker must never get.
    expect(JSON.stringify(res.body)).not.toContain(BOOM_MESSAGE);
    expect(JSON.stringify(res.body)).not.toContain("at Object");
    assertNoSecretFields(res.body);
  });

  it("a @UserScoped() route that throws → same envelope, same guarantees", async () => {
    // Without a bearer the tier is enforced BEFORE the handler runs — 401, not
    // 500. Asserting that first is what proves the 500 below really came from
    // the handler rather than from the chain falling over.
    const anonymous = await request(testApp.server()).get("/__test__/boom/user");
    assertErrorEnvelope(anonymous, { code: "UNAUTHENTICATED", status: 401 });

    const tokens = testApp.app.get(AccessTokenService, { strict: false });
    const res = await request(testApp.server())
      .get("/__test__/boom/user")
      .set("Authorization", `Bearer ${tokens.sign("no-such-user-id")}`);
    expect(res.status).toBe(500);
    assertErrorEnvelope(res, { code: "INTERNAL", status: 500 });
    expect(JSON.stringify(res.body)).not.toContain(BOOM_MESSAGE);
  });

  it("traceId is random per RESPONSE, not derived from the request", async () => {
    const a = await request(testApp.server()).get("/__test__/boom/public");
    const b = await request(testApp.server()).get("/__test__/boom/public");
    expect(a.body.error.traceId).not.toBe(b.body.error.traceId);
    // Two identical requests → identical bodies apart from the trace id.
    assertIdenticalErrorBodies(a, b);
  });

  it("a client-supplied x-request-id is NEVER echoed into the envelope", async () => {
    const res = await request(testApp.server())
      .get("/__test__/boom/public")
      .set("X-Request-Id", "attacker-controlled-value");
    expect(res.body.error.traceId).not.toBe("attacker-controlled-value");
    expect(JSON.stringify(res.body)).not.toContain("attacker-controlled");
  });
});

d("the fixtures cannot exist outside the test profile (§12.2 item 9)", () => {
  let plainApp: TestApp;

  beforeAll(async () => {
    plainApp = await createTestApp({ fixtures: false });
  });

  afterAll(async () => {
    if (plainApp) await plainApp.close();
  });

  it("an app built without TestFixturesModule serves no `/__test__` route at all", async () => {
    for (const path of ["/__test__/boom/public", "/__test__/boom/user", "/__test__/probe/x"]) {
      const res = await request(plainApp.server()).get(path);
      expect(res.status, `${path} must not exist`).toBe(404);
    }
  });

  it("…and the audit of that app is clean with NO prefix filter at all", () => {
    // The strongest form: without the fixtures there is nothing to filter, so
    // the production router stands on its own.
    assertRouteRegistryClean(auditApp(plainApp.app, { ignorePathPrefixes: [] }));
  });
});
