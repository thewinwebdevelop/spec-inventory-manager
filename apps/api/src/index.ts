// Placeholder entry point for apps/api.
// NestJS skeleton (GET /health, org-scope seam stub) lands in T-000-08.
//
// The import below is intentionally the only contracts usage here in F-000:
// it proves apps/api can import the generated OpenAPI types from
// @omnistock/contracts and typecheck green (T-000-07 / AC11). T-000-08 wires
// the real NestJS handler for GET /health against this same contract type.
import type { components } from "@omnistock/contracts";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type HealthResponse = components["schemas"]["HealthResponse"];

export {};
