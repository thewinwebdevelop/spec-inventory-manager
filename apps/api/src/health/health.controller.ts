// F-000 · T-000-08 — GET /health. Spec: architecture.md + infra.md §9.
// Contract alignment (AC11, fix pass): imports the generated
// `components["schemas"]["HealthResponse"]` from @omnistock/contracts, which
// now declares `checks: { db, redis }` as an additive optional field
// (openapi.yaml, fix-pass regen) — so the controller's return type and the
// committed contract genuinely cannot drift; there is no longer a
// hand-maintained intersection type bridging "what the contract says" and
// "what we actually return".
//
// AC3: GET /health -> 200 {status:"ok", ...} on the happy path.
// AC15: response reflects Redis/BullMQ connectivity via `checks.redis`; when a
// dependency is down, HTTP 503 + status:"error" (per the contract's declared
// 503 response, T-000-07).
import { Controller, Get, HttpCode, HttpStatus, Inject, Res } from "@nestjs/common";
import type { Response } from "express";
import type { components } from "@omnistock/contracts";
import { HealthService } from "./health.service";

/**
 * The full /health payload, imported directly from the generated contract
 * type — `checks` (db/redis) is now part of `HealthResponse` itself (not a
 * hand-authored addition bolted on in this file), so the API and the contract
 * cannot silently diverge on this shape.
 */
type HealthResponsePayload = components["schemas"]["HealthResponse"];

@Controller("health")
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

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
