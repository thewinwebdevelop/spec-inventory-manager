/**
 * Unit tests for HealthController (D-014 backfill) — the HTTP-mapping layer
 * on top of HealthService.check() (AC3/AC15). Verifies the controller maps
 * the service's internal {status: "ok"|"degraded"} result onto the
 * *contract's* HealthResponse shape (status: "ok"|"error") and the correct
 * HTTP status code, using a fake HealthService and a fake Express Response
 * (the controller only calls `.status()` on it, per @Res({passthrough:true})).
 */
import { describe, expect, it } from "vitest";
import type { Response } from "express";
import type { components } from "@omnistock/contracts";
import { HealthController } from "./health.controller";
import type { HealthService, HealthCheckResult } from "./health.service";

type HealthResponsePayload = components["schemas"]["HealthResponse"];

function makeController(result: HealthCheckResult): {
  controller: HealthController;
  res: Response;
  statusCalls: number[];
} {
  const fakeHealthService = {
    check: async () => result,
  } as unknown as HealthService;

  const statusCalls: number[] = [];
  const res = {
    status(code: number) {
      statusCalls.push(code);
      return res;
    },
  } as unknown as Response;

  const controller = new HealthController(fakeHealthService);
  return { controller, res, statusCalls };
}

describe("HealthController.getHealth", () => {
  it("healthy result -> does not set an error status, payload matches HealthResponse shape", async () => {
    const { controller, res, statusCalls } = makeController({
      status: "ok",
      checks: { db: "ok", redis: "ok" },
    });

    const payload: HealthResponsePayload = await controller.getHealth(res);

    expect(payload).toEqual({
      status: "ok",
      checks: { db: "ok", redis: "ok" },
    });
    // @HttpCode(HttpStatus.OK) handles the 200 by decorator; the handler
    // itself must not override it with res.status() on the happy path.
    expect(statusCalls).toEqual([]);
  });

  it("unhealthy result -> sets 503 and maps status to 'error'", async () => {
    const { controller, res, statusCalls } = makeController({
      status: "degraded",
      checks: { db: "fail", redis: "ok" },
    });

    const payload: HealthResponsePayload = await controller.getHealth(res);

    expect(payload).toEqual({
      status: "error",
      checks: { db: "fail", redis: "ok" },
    });
    expect(statusCalls).toEqual([503]);
  });
});
