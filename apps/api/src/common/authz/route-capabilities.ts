// F-002 · T-002-05 ★ — the endpoint→capability table + the `@AnyActiveMember()`
// allowlist, declared ONCE in production code (architecture §3.1 / §12.2 items
// 4 and 7; test-plan I-02 / G-13).
//
// WHY THESE LIVE HERE AND NOT IN A TEST: @qa's route-registry tests import
// them. A table re-declared inside the test suite proves only that the test
// agrees with itself — the moment production drifts, the test drifts with it.
//
// SHAPE IS PART OF THE CONTRACT: literal endpoint rows, never regexes (@qa's
// condition, §12.2 item 7). A regex allowlist is how "one more route" becomes
// invisible.
//
// Paths use the api-spec dialect (`{orgId}`), so a row here can be compared
// byte-for-byte with api-spec §2 by a human, and with the live Nest router via
// `toTemplatePath()` (see route-declarations.ts).
import { CAPABILITY_MANAGE_MEMBERS } from "@omnistock/core-domain";

/**
 * Capability guarding org profile + tax profile (api-spec §3.4/§3.5/§3.16).
 *
 * ⚠️ It belongs next to `CAPABILITY_MANAGE_MEMBERS` in
 * `packages/core-domain/src/auth/capabilities.ts` — F-001 opened that registry
 * and F-003 will own it. It is declared here only because T-002-05 must not
 * touch `packages/**`; moving it is a mechanical, single-commit change (the
 * string value is what must never move).
 */
export const CAPABILITY_MANAGE_ORG_SETTINGS = "manage_org_settings" as const;

/** Verbs that change state. Used to classify a route's tier — §3.1 / G-13(ค). */
export const MUTATING_HTTP_METHODS: readonly string[] = Object.freeze([
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);

/** Verbs that only read. `HEAD` is here because express answers it from `@Get()`. */
export const READ_HTTP_METHODS: readonly string[] = Object.freeze(["GET", "HEAD", "OPTIONS"]);

export function isMutatingMethod(method: string): boolean {
  return MUTATING_HTTP_METHODS.includes(method.toUpperCase());
}

/** One endpoint and the capability it demands. */
export interface RouteCapability {
  /** Upper-case HTTP verb. */
  readonly method: string;
  /** api-spec path template, e.g. `/orgs/{orgId}/members/{userId}`. */
  readonly path: string;
  readonly capability: string;
}

/** A route that any `active` member may call. */
export interface AnyActiveMemberRoute {
  readonly method: string;
  readonly path: string;
}

function row<T extends { method: string; path: string }>(entry: T): Readonly<T> {
  return Object.freeze({ ...entry, method: entry.method.toUpperCase() });
}

/**
 * Every org-scoped F-002 endpoint that requires a capability (api-spec §2).
 * F-002 enforces exactly two capabilities (§3.1); a third one appearing here
 * without a spec change is a review question, not a merge.
 *
 * NOT here on purpose:
 *  - `POST /organizations`, `GET /me/organizations`, `POST /invitations/accept`
 *    → `@UserScoped()`; `POST /invitations/preview` → `@Public()`. No org
 *    context exists on those, so no capability can be evaluated (I-3).
 *  - `POST /orgs/{orgId}/members/{userId}/reset-password` (F-001) → keeps its
 *    inline check and its 404-never-403 shape; adding it here would change a
 *    shipped wire behaviour (api-spec §2 note).
 */
export const ROUTE_CAPABILITIES: readonly RouteCapability[] = Object.freeze([
  row({ method: "PATCH", path: "/orgs/{orgId}", capability: CAPABILITY_MANAGE_ORG_SETTINGS }),
  row({
    method: "PUT",
    path: "/orgs/{orgId}/tax-profile",
    capability: CAPABILITY_MANAGE_ORG_SETTINGS,
  }),
  // D-030/NEW-11 — reveal reaches Admin by decision, fenced by its own endpoint,
  // its own event and its own rate limit rather than by a softer capability.
  row({
    method: "POST",
    path: "/orgs/{orgId}/tax-profile/reveal",
    capability: CAPABILITY_MANAGE_ORG_SETTINGS,
  }),
  // D-028/I-8/N-4 — these two READS carry other people's email (PII under
  // PDPA). They are the reason NEW-3 extended fail-closed to read routes.
  row({ method: "GET", path: "/orgs/{orgId}/members", capability: CAPABILITY_MANAGE_MEMBERS }),
  row({
    method: "PATCH",
    path: "/orgs/{orgId}/members/{userId}",
    capability: CAPABILITY_MANAGE_MEMBERS,
  }),
  row({
    method: "DELETE",
    path: "/orgs/{orgId}/members/{userId}",
    capability: CAPABILITY_MANAGE_MEMBERS,
  }),
  row({ method: "GET", path: "/orgs/{orgId}/invitations", capability: CAPABILITY_MANAGE_MEMBERS }),
  row({ method: "POST", path: "/orgs/{orgId}/invitations", capability: CAPABILITY_MANAGE_MEMBERS }),
  row({
    method: "POST",
    path: "/orgs/{orgId}/invitations/{invitationId}/link",
    capability: CAPABILITY_MANAGE_MEMBERS,
  }),
  row({
    method: "DELETE",
    path: "/orgs/{orgId}/invitations/{invitationId}",
    capability: CAPABILITY_MANAGE_MEMBERS,
  }),
]);

/**
 * The pinned allowlist for `@AnyActiveMember()` — split into two tiers
 * (architecture §3.1, after NEW-3).
 *
 * ⚠️ TWO LISTS, NOT ONE TOTAL. Compared as a single number ("3 routes"), adding
 * the cheapest read route could be masked by removing a mutating one. G-13
 * therefore asserts set-equality AND the size of each tier AND that the tier
 * matches the route's real HTTP verb — a mutating route hiding in `read` is red.
 */
export const ANY_ACTIVE_MEMBER_ROUTES: {
  readonly mutating: readonly AnyActiveMemberRoute[];
  readonly read: readonly AnyActiveMemberRoute[];
} = Object.freeze({
  // D-029 — leaving has NO `userId` in the path, so the target is structurally
  // always `ctx.userId`. That is why it needs no capability: there is no input
  // that could point it at somebody else (confused deputy closed by shape).
  mutating: Object.freeze([row({ method: "DELETE", path: "/orgs/{orgId}/membership" })]),
  // Both return only data about an org the caller already belongs to, and
  // neither carries another person's PII: `GET /orgs/{orgId}` goes through the
  // PDPA mapper (no TIN, no member list) and `roles` is role names only.
  read: Object.freeze([
    row({ method: "GET", path: "/orgs/{orgId}" }),
    row({ method: "GET", path: "/orgs/{orgId}/roles" }),
  ]),
});

/** `/orgs/:orgId/members` (Nest) → `/orgs/{orgId}/members` (api-spec). */
export function toTemplatePath(path: string): string {
  const collapsed = `/${path}`.replace(/\/+/g, "/");
  const trimmed = collapsed.length > 1 ? collapsed.replace(/\/$/, "") : "/";
  return trimmed.replace(/:([^/]+)/g, "{$1}");
}

/** Canonical `"GET /orgs/{orgId}/members"` key for comparing tables to routers. */
export function routeKey(route: { method: string; path: string }): string {
  return `${route.method.toUpperCase()} ${toTemplatePath(route.path)}`;
}
