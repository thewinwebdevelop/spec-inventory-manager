// F-000 · T-000-08 — GET /health. Spec: architecture.md + infra.md §9.
// Contract alignment (AC11): imports the generated `components["schemas"]["HealthResponse"]`
// from @omnistock/contracts so api and contract can't drift on the committed
// `status: "ok" | "error"` field. `checks` is an additive field on top of
// that shape (contract-evolution: additive-only against an already-shipped
// surface) — a future contract revision can promote it into the OpenAPI spec
// once a consumer needs it typed.
//
// AC3: GET /health -> 200 {status:"ok", ...} on the happy path.
// AC15: response reflects Redis/BullMQ connectivity via `checks.redis`; when a
// dependency is down, HTTP 503 + status:"error" (per the contract's declared
// 503 response, T-000-07).
import { Controller, Get, HttpCode, HttpStatus, Inject, Res } from "@nestjs/common";
import type { Response } from "express";
import type { components } from "@omnistock/contracts";
import { HealthService } from "./health.service";

type ContractHealthResponse = components["schemas"]["HealthResponse"];

/**
 * Full /health payload: the contract's committed `status` field plus the
 * additive `checks` block (infra.md §9). `status` here is derived from the
 * richer internal "ok"|"degraded" result, collapsed to the contract's
 * "ok"|"error" enum so the wire shape matches openapi.yaml exactly.
 */
type HealthResponsePayload = ContractHealthResponse & {
  checks: { db: "ok" | "fail"; redis: "ok" | "fail" };
};

@Controller("health")
export class HealthController {
  constructor(
    @Inject(HealthService) private readonly healthService: HealthService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getHealth(@Res({ passthrough: true }) res: Response): Promise<HealthResponsePayload> {
    const result = await this.healthService.check();

    const payload: HealthResponsePayload = {
      status: result.status === "ok" ? "ok" : "error",
      checks: result.checks,
    };

    if (result.status !== "ok") {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return payload;
  }
}
