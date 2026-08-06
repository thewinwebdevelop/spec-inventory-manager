/**
 * T-002-W1 ★ — the org-scoped transport. Web's counterpart to mobile's
 * `orgDioProvider` (web.md §3.2): the ONLY way a feature talks to an
 * org-scoped endpoint.
 *
 * The point of the shape is that `X-Organization-Id` is not something a
 * feature remembers to attach — it is baked into the client a feature has to
 * ask for, and the only way to get one is `useOrgApiClient()`, which derives
 * the id from the URL segment via `useActiveOrg()`. A feature CANNOT
 * accidentally call an org endpoint without the header, and cannot call it
 * with a different org's id than the one in the address bar.
 *
 * Auth is not reimplemented here. Every request goes through F-001's
 * `requestWithRefresh` — the ★ security-reviewed silent-refresh-then-
 * retry-ONCE orchestration (never loop, single-flight refresh). A second
 * refresh/retry policy living next to the first is exactly how the two drift.
 */
import { createContractsClient } from "@omnistock/contracts";
import type { ErrorResponse } from "../auth-client";
import { requestWithRefresh, silentRefresh } from "../auth-client";
import { getAccessToken } from "../token-store";
import { API_BASE } from "../api-base";
import { ApiRequestError } from "./error";

export const ORG_HEADER = "X-Organization-Id";

/**
 * Shape an organization id is allowed to have before it is put in a header.
 *
 * `orgId` reaches us from the URL (`/o/[orgId]/...`), i.e. from whatever the
 * user pasted into the address bar. `Headers.set` already rejects control
 * characters, so this is not the last line of defence against header
 * injection — it is here so a junk segment fails as an obvious client-side
 * error instead of becoming a real request that the server then has to
 * reject, and so the failure names the actual problem.
 *
 * Deliberately permissive about the ID FORMAT itself (cuid2 today, could be
 * something else tomorrow): this asserts "plausible opaque identifier", not
 * "cuid2". The server is the authority on whether the org exists and whether
 * the caller belongs to it — never this regex.
 */
const ORG_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function isValidOrgId(orgId: string): boolean {
  return ORG_ID_PATTERN.test(orgId);
}

function parseRetryAfter(res: Response): number | undefined {
  const header = res.headers.get("Retry-After");
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds : undefined;
}

/**
 * The `fetch` openapi-fetch will call. Attaches the org header + Bearer, then
 * hands the send function to `requestWithRefresh` so a 401 gets exactly one
 * silent refresh and one retry.
 *
 * Headers are (re)built inside `send`, not once outside it: the retry must
 * carry the token that the refresh just produced, not the dead one that
 * caused the 401.
 */
export interface OrgTransportDeps {
  readonly getToken?: () => string | null;
  readonly fetchImpl?: typeof globalThis.fetch;
  /** Seam for tests only — production always uses F-001's single-flight
   * `silentRefresh`, so there is exactly one refresh policy in the app. */
  readonly refresh?: () => Promise<boolean>;
}

/**
 * Absolutises `API_BASE` against the PAGE's own origin.
 *
 * A browser resolves `new Request("/api/x")` against the document; undici
 * (what jsdom and Node give us) refuses it outright. Rather than let the test
 * environment dictate a weaker test, the base is resolved here — and resolved
 * from `window.location.origin`, never from configuration.
 *
 * That distinction matters: api-base.ts's whole argument is that there is no
 * `NEXT_PUBLIC_API_ORIGIN`-style cross-origin base, because a cross-origin
 * API would defeat the dev proxy and force `SameSite=None` on `omni_rt`.
 * Taking the page's own origin cannot introduce one — the result is the same
 * request the relative path produced, spelled out.
 */
export function resolveApiBase(base: string = API_BASE): string {
  if (/^https?:\/\//.test(base)) return base;
  const origin = typeof window === "undefined" ? undefined : window.location?.origin;
  return origin ? `${origin}${base}` : base;
}

export function createOrgFetch(
  orgId: string,
  deps: OrgTransportDeps = {},
): (input: Request) => Promise<Response> {
  const getToken = deps.getToken ?? getAccessToken;
  const doFetch = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const refresh = deps.refresh ?? silentRefresh;

  if (!isValidOrgId(orgId)) {
    throw new Error(`createOrgFetch: invalid organization id ${JSON.stringify(orgId)}`);
  }

  return (input: Request) => {
    const send = () => {
      // `.clone()` per attempt: a Request body can only be read once, and the
      // retry needs its own copy.
      const attempt = input.clone();
      const headers = new Headers(attempt.headers);
      headers.set(ORG_HEADER, orgId);
      const token = getToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      else headers.delete("Authorization");
      return doFetch(new Request(attempt, { headers }));
    };
    return requestWithRefresh(send, refresh);
  };
}

/**
 * Typed client for every org-scoped endpoint, bound to one organization.
 *
 * Based at `API_BASE` (`/api`) and never `AUTH_BASE` — the two are separate
 * on purpose (api-base.ts): `omni_rt` is scoped `Path=/auth`, so routing an
 * org call through `/auth` would drag the refresh cookie onto requests that
 * have no business seeing it.
 */
export function createOrgApiClient(orgId: string, deps: OrgTransportDeps = {}) {
  return createContractsClient(resolveApiBase(), { fetch: createOrgFetch(orgId, deps) });
}

export type OrgApiClient = ReturnType<typeof createOrgApiClient>;

/** What openapi-fetch resolves to: never a throw, always this triple. */
interface FetchResult<T> {
  readonly data?: T;
  readonly error?: unknown;
  readonly response: Response;
}

/**
 * Turns openapi-fetch's `{ data, error, response }` into "resolve or throw",
 * which is what TanStack Query (and `toApiFailure`) expect.
 *
 * The throw is always an `ApiRequestError`, so `details` (→ `reason: "busy"`)
 * and `fieldErrors` survive all the way to `toApiFailure`. Losing them here
 * would silently turn every lock-contention 409 into a generic conflict and
 * every 422 into a message with no field highlighting.
 */
export async function unwrap<T>(promise: Promise<FetchResult<T>>): Promise<T> {
  const { data, error, response } = await promise;
  if (response.ok && data !== undefined) return data;
  const body = (error ?? null) as ErrorResponse | null;
  throw new ApiRequestError(response.status, body, parseRetryAfter(response));
}
