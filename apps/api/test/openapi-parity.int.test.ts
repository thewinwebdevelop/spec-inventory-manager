// F-002 · T-002-21 ★ — THE GATE: the PRODUCTION router against the SHIPPED
// contract, both directions.
//
// ── WHY `AppModule` AND NOT `createTestApp()` ──────────────────────────────
// `app.kit.ts` composes an application that is deliberately NOT identical to
// production: it leaves `HealthModule` out (it opens a BullMQ queue no int suite
// asserts on) and adds `/__test__` fixtures. For every other suite that is the
// right trade. For this one it would be a lie: a route that exists in production
// and not in the test composition is exactly the route that would slip past the
// audit. So this file boots the real composition root — the same module graph
// `main.ts` serves — and the answer it gives is about the real server.
//
// It needs the int lane because `AppModule` wires Prisma and a real Redis
// connection at boot. Nothing here issues a request; the audit reads decorator
// metadata off the live router.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import { INT_LANE_ENABLED, applyTestEnv } from "./app.kit";
import {
  assertOpenApiParity,
  auditAppAgainstSpec,
  auditOpenApiParity,
  readSpecOperations,
  type OpenApiParityReport,
} from "./openapi-parity.kit";

const d = INT_LANE_ENABLED ? describe : describe.skip;

// ── I-37 — a lane that silently skipped itself is not a result ─────────────
describe("int lane guard (I-37)", () => {
  it("in the integration lane, DB/Redis must be ENABLED — a skipped suite proves nothing", () => {
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

d("★ the live router and packages/contracts/openapi/openapi.yaml agree", () => {
  let app: INestApplication;
  let report: OpenApiParityReport;

  beforeAll(async () => {
    applyTestEnv();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    report = auditAppAgainstSpec(app);
  });

  afterAll(async () => {
    // Closes the BullMQ queue and disconnects the ioredis connection
    // `HealthModule` opened (its `onModuleDestroy`), so the runner exits.
    if (app) await app.close();
  });

  it("★ every route the server answers is published by the contract (router → spec)", () => {
    // The direction that was broken on 2026-08-05: 14 F-002 endpoints live, 0 in
    // the spec, every gate green.
    expect(
      report.missingFromSpec.map((f) => `${f.route}  ← ${f.source}`),
      "these endpoints ship but no generated client can call them",
    ).toEqual([]);
  });

  it("★ every operation the contract publishes is served (spec → router)", () => {
    // The direction that is worse: a client compiles against the published type
    // and 404s at runtime. `GET /orgs/{orgId}/roles` (api-spec §3.6) is the
    // reason this assertion exists — it is in the capability allowlist and in
    // the design doc, and no controller serves it, so it is deliberately NOT in
    // the contract.
    expect(
      report.missingFromRouter.map((f) => `${f.route}  ← ${f.source}`),
      "the contract promises endpoints the server does not have",
    ).toEqual([]);
  });

  it("★ the audit is not vacuous — it saw a real router and a real spec", () => {
    // Without these floors the two assertions above pass for an application
    // that registered nothing and a spec that declares nothing.
    expect(report.routes.length).toBeGreaterThanOrEqual(24);
    expect(report.operations.length).toBeGreaterThanOrEqual(24);
    expect(() => assertOpenApiParity(report, { minRoutes: 24, minOperations: 24 })).not.toThrow();
  });

  it("★ it would go RED if one path were dropped from the spec", () => {
    // Proves the gate bites against the REAL router, not only against the
    // fabricated pairs in the unit meta-test: remove one published operation and
    // the live route it served must be reported.
    const operations = readSpecOperations().filter(
      (o) => !(o.method === "DELETE" && o.path === "/orgs/{orgId}/membership"),
    );
    const injured = auditOpenApiParity(report.routes, operations);
    expect(injured.missingFromSpec.map((f) => f.route)).toEqual(["DELETE /orgs/{orgId}/membership"]);
    expect(() => assertOpenApiParity(injured)).toThrowError(/missing-from-spec/);
  });
});
