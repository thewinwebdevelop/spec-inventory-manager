import createClient from "openapi-fetch";
import type { ClientOptions } from "openapi-fetch";
import type { paths } from "./generated/ts/schema.js";

/** Everything openapi-fetch accepts except `baseUrl`, which is the first arg. */
export type ContractsClientOptions = Omit<ClientOptions, "baseUrl">;

/**
 * Thin typed fetch client over the generated OpenAPI paths.
 * Consumers (apps/api for e2e/typed handlers, apps/web for calling /health)
 * import `createContractsClient` rather than reaching into
 * `openapi-fetch`/`generated/ts` directly, so the entry point stays stable if
 * the underlying generator ever changes (F-000 architecture.md §4.2).
 *
 * `options` is a straight passthrough — notably `fetch`, which is how
 * apps/web injects its org-scoped transport (Bearer + `X-Organization-Id` +
 * silent-refresh-then-retry-once, T-002-W1). It carries no request/response
 * SHAPE of its own, so this is not a contract change: the wire is still
 * whatever `openapi/openapi.yaml` says.
 */
export function createContractsClient(baseUrl: string, options: ContractsClientOptions = {}) {
  return createClient<paths>({ ...options, baseUrl });
}

export type { paths, components, operations } from "./generated/ts/schema.js";
