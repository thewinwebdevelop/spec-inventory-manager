// ★ B-3 — the "wire → policy" direction, made real.
//
// `response-headers.ts` opens by claiming the table is checked BOTH ways:
//
//     policy → wire   a route listed here that does not set its headers = red.
//     wire → policy   a route that returns a token, an email or a TIN and is
//                     ABSENT from this table = red.
//
// The first direction exists. The second was prose: `carries` is written on
// every row and read by nothing except two hand-written spot checks. So
// `GET /me/organizations` — which answers "which shops is this person in, in
// what role, on what plan" — shipped with no row and no `Cache-Control` at
// all, and no gate noticed.
//
// The reason it slipped is worth stating, because it is the same shape as the
// rest of this feature's near-misses: the prose describes the trigger as
// "token, email or TIN", and `/me/organizations` returns none of those. It
// returns MEMBERSHIP, a class the `ResponseSensitivity` type already declares
// and which the table already uses as a reason to include a route
// (`DELETE /orgs/{orgId}/membership` is listed precisely because "when did
// this person leave which shop" is a fact about a person). The taxonomy knew;
// nothing consulted it.
//
// This walks the LIVE router instead of a list somebody maintains, so a route
// added tomorrow is covered the moment it exists.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { enumerateRoutes } from "../src/common/authz";
import { RESPONSE_HEADER_POLICY, responseHeaderPolicyFor } from "../src/orgs";
import { PrismaClient } from "@omnistock/db";
import { AccessTokenService } from "../src/auth/access-token.service";
import { INT_LANE_ENABLED, applyTestEnv, createTestApp, type TestApp } from "./app.kit";
import { createSeedKit, type SeedKit } from "./f002-seed.kit";

const d = INT_LANE_ENABLED ? describe : describe.skip;

/**
 * Surfaces whose bodies are about a PERSON or a SHOP. Everything under these
 * prefixes needs a policy row; `/auth/*` and `/health` are governed elsewhere
 * (F-001 sets its own headers, health returns no PII).
 *
 * A prefix list rather than an exemption list, on purpose: forgetting to add a
 * new PII surface here is visible in review, whereas forgetting to REMOVE a
 * route from an exemption list is invisible forever.
 */
const COVERED_PREFIXES = ["/orgs", "/organizations", "/me", "/invitations"] as const;

d("every PII-bearing route has a response-header policy (B-3)", () => {
  let app: TestApp;
  let prisma: PrismaClient;
  let kit: SeedKit;

  beforeAll(async () => {
    applyTestEnv();
    prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    await prisma.$connect();
    app = await createTestApp();
    kit = createSeedKit(prisma, { label: "hdr" });
  });

  afterAll(async () => {
    if (kit) await kit.cleanup();
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });

  it("the walk found the router (a walk that finds nothing proves nothing)", () => {
    const routes = enumerateRoutes(app.app);
    expect(routes.length).toBeGreaterThan(10);
    expect(routes.map((r) => `${r.method} ${r.path}`)).toContain("GET /me/organizations");
  });

  it("★ every route under a PII prefix is listed in RESPONSE_HEADER_POLICY", () => {
    const missing = enumerateRoutes(app.app)
      .filter((r) => COVERED_PREFIXES.some((prefix) => r.path.startsWith(prefix)))
      .filter((r) => responseHeaderPolicyFor(r.method, r.path) === undefined)
      .map((r) => `${r.method} ${r.path}`);

    expect(
      missing,
      "these routes answer with data about a person or a shop and have no row in " +
        "RESPONSE_HEADER_POLICY, so nothing states — or checks — that they must not be cached. " +
        "Add a row saying WHAT the body carries (`carries`), and apply the headers in the handler.",
    ).toEqual([]);
  });

  it("★ the row is a claim about a REAL response, not about the table", async () => {
    // The policy → wire direction, proven end to end for the route B-3 was
    // about. A table that only agrees with itself is what let this route ship
    // with no `Cache-Control` in the first place.
    //
    // It has to be an AUTHENTICATED request. `applyResponseHeaders` runs in the
    // handler, and a 401 is decided by `OrgScopeGuard` before the handler is
    // reached — so an unauthenticated probe would assert something this design
    // cannot deliver. That is a real limitation and it is fine: a 401 body
    // carries no facts about anybody. What must not be cached is the 200.
    const user = await kit.createUser();
    const token = app.app.get(AccessTokenService, { strict: false }).sign(user.id);

    const res = await request(app.server())
      .get("/me/organizations")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("the table only lists routes with a `carries` reason", () => {
    // `carries` is what makes the wire → policy direction expressible at all.
    // A row without one is a row nobody can check.
    for (const row of RESPONSE_HEADER_POLICY) {
      expect(row.carries.length, `${row.method} ${row.path}`).toBeGreaterThan(0);
    }
  });
});
