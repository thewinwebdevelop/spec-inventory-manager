// Placeholder entry point for apps/web.
// Next.js app (Tenant admin console, consumes generated TS client) lands in
// T-000-09.
//
// The import below is intentionally the only contracts usage here in F-000:
// it proves apps/web can import the generated typed client from
// @omnistock/contracts and typecheck green (T-000-07 / AC11). T-000-09 wires
// the real call to GET /health against this same client.
import { createContractsClient } from "@omnistock/contracts";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _healthClient = createContractsClient("http://localhost:3000");

export {};
