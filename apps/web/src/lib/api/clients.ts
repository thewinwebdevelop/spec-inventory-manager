/**
 * T-002-W1 ★ — the two API transports. Web's counterpart to mobile's
 * `orgDioProvider` (web.md §3.2).
 *
 * There are exactly TWO, matching the api-spec's two route tiers, and which
 * one a call uses is not a detail:
 *
 *  - `createOrgApiClient(orgId)` — org-scoped endpoints. `X-Organization-Id`
 *    is baked into the client rather than attached per call, and the only way
 *    to get one is `useOrgApiClient()`, which derives the id from the URL via
 *    `useActiveOrg()`. A feature cannot call an org endpoint without the
 *    header, or with an org other than the one in the address bar.
 *  - `createUserApiClient()` — user-scoped endpoints (`/me/organizations`,
 *    `POST /organizations`). It sends NO org header, deliberately: those
 *    routes span every shop, and the API builds an org context out of the
 *    header even on a user-scoped route (security review I-3, the
 *    confused-deputy finding). Sending an org id there is handing the server
 *    an input it should never have received for that call.
 *
 * Auth is not reimplemented in either. Every request goes through F-001's
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

/**
 * The `fetch` openapi-fetch will call. Attaches Bearer (and the org header
 * when `orgId` is non-null), then hands the send function to
 * `requestWithRefresh` so a 401 gets exactly one silent refresh and one
 * retry.
 *
 * Headers are (re)built inside `send`, not once outside it: the retry must
 * carry the token that the refresh just produced, not the dead one that
 * caused the 401.
 *
 * `orgId: null` is the user-scoped tier and is spelled explicitly rather than
 * defaulted, so "no org header" is a decision somebody made at the call site
 * rather than an argument they forgot.
 */
function createAuthedFetch(
  orgId: string | null,
  deps: OrgTransportDeps = {},
): (input: Request) => Promise<Response> {
  const getToken = deps.getToken ?? getAccessToken;
  const doFetch = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const refresh = deps.refresh ?? silentRefresh;

  if (orgId !== null && !isValidOrgId(orgId)) {
    throw new Error(`createOrgFetch: invalid organization id ${JSON.stringify(orgId)}`);
  }

  return (input: Request) => {
    const send = () => {
      // `.clone()` per attempt: a Request body can only be read once, and the
      // retry needs its own copy.
      const attempt = input.clone();
      const headers = new Headers(attempt.headers);
      // Strip any caller-supplied org header unconditionally, THEN set ours
      // if this is an org-scoped client. On the user-scoped tier that leaves
      // the request with none — which is the point (see the header note).
      headers.delete(ORG_HEADER);
      if (orgId !== null) headers.set(ORG_HEADER, orgId);
      const token = getToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      else headers.delete("Authorization");
      return doFetch(new Request(attempt, { headers }));
    };
    return requestWithRefresh(send, refresh);
  };
}

export function createOrgFetch(
  orgId: string,
  deps: OrgTransportDeps = {},
): (input: Request) => Promise<Response> {
  return createAuthedFetch(orgId, deps);
}

export function createUserFetch(
  deps: OrgTransportDeps = {},
): (input: Request) => Promise<Response> {
  return createAuthedFetch(null, deps);
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

/**
 * Typed client for the USER-scoped tier: `GET /me/organizations` and
 * `POST /organizations`, the two calls that exist precisely because the
 * caller is not inside a shop yet.
 *
 * It sends no `X-Organization-Id`. That is the whole difference, and it is
 * load-bearing — see the header note at the top of this file (security
 * review I-3).
 */
export function createUserApiClient(deps: OrgTransportDeps = {}) {
  return createContractsClient(resolveApiBase(), { fetch: createUserFetch(deps) });
}

export type UserApiClient = ReturnType<typeof createUserApiClient>;

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
