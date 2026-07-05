// Entry point for @omnistock/contracts.
// OpenAPI source of truth: packages/contracts/openapi/openapi.yaml.
// Consumers (apps/api, apps/web) import generated types/client from here only
// — never reach into `src/generated/ts` directly (F-000 architecture.md §4.2).
export { createContractsClient } from "./client.js";
export type { paths, components, operations } from "./client.js";

