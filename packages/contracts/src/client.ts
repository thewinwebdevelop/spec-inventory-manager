import createClient from "openapi-fetch";
import type { paths } from "./generated/ts/schema.js";

/**
 * Thin typed fetch client over the generated OpenAPI paths.
 * Consumers (apps/api for e2e/typed handlers, apps/web for calling /health)
 * import `createContractsClient` rather than reaching into
 * `openapi-fetch`/`generated/ts` directly, so the entry point stays stable if
 * the underlying generator ever changes (F-000 architecture.md §4.2).
 */
export function createContractsClient(baseUrl: string) {
  return createClient<paths>({ baseUrl });
}

export type { paths, components, operations } from "./generated/ts/schema.js";
