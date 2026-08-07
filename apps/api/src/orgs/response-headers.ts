// F-002 · T-002-16/17 — the response-header policy for the F-002 endpoints
// (api-spec §1 "Cache / PII" · architecture §12.2 item 4 · test-plan I-05).
//
// WHY IT IS PRODUCTION CODE AND NOT A CONSTANT IN THE TEST
// architecture §12.2 item 4: tests IMPORT the policy, they never re-declare it.
// A copy inside the suite keeps passing against itself on the day the API stops
// setting the header — which is the only day the assertion mattered.
//
// TWO DIRECTIONS, WHICH IS WHY THIS IS A TABLE AND NOT TWO CONSTANTS (I-05):
//   policy → wire   a route listed here that does not set its headers = red.
//   wire → policy   a route under a PII prefix that is ABSENT from this table
//                   = red. That is the direction that catches "we shipped a
//                   new endpoint and forgot the policy", and it only works if
//                   each row also says WHY it is here (`carries`), which is
//                   what `RESPONSE_HEADER_POLICY` adds over a bare header map.
//
// ★ B-3 — the second direction used to be this comment and nothing else, and
// it described the trigger as "returns a token, an email or a TIN". Four
// routes returned none of those, returned MEMBERSHIP instead, and were absent
// from the table with no `Cache-Control` at all. The trigger is now the ROUTE
// PREFIX, not a guess about the body, and it is enforced by walking the live
// router (`test/response-header-policy.int.test.ts`) rather than by this
// paragraph.
//
// Rows exist for endpoints that T-002-19 has not built yet. That is deliberate
// and matches `ROUTE_CAPABILITIES`: the table is the contract with api-spec §1,
// and a row waiting for its route is visible, whereas a route waiting for its
// row is a leak nobody is looking for.
import type { Response } from "express";
import { routeKey, toTemplatePath } from "../common/authz";

// ── the header sets ─────────────────────────────────────────────────────────

/**
 * Every org profile response carries the shop's name and its tax STATUS, both
 * of which are customer PII under PDPA. `no-store` keeps them out of shared
 * caches and browser disk cache — a shop profile sitting in a proxy is exactly
 * the accident this header exists to prevent.
 *
 * `Pragma` is the HTTP/1.0 twin; api-spec §1 names both explicitly, so both are
 * set rather than assuming every intermediary speaks HTTP/1.1 cache-control.
 */
export const ORG_PROFILE_RESPONSE_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "Cache-Control": "no-store",
  Pragma: "no-cache",
});

/**
 * `POST /orgs/{orgId}/tax-profile/reveal` (§3.16) and the invitation routes
 * (I-6) add `Referrer-Policy: no-referrer` on top.
 *
 * `no-store` alone is not enough for these: the reveal response is rendered on a
 * page that will link out (a marketplace, a help article), and without this
 * header the browser sends the current URL — which identifies the shop whose
 * owner's national ID was just on screen — to that third party. The number
 * itself never travels in a URL (that is why §3.16 is a POST), but the URL is
 * still the trail of who was looking at what.
 */
export const TAX_ID_REVEAL_RESPONSE_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  ...ORG_PROFILE_RESPONSE_HEADERS,
  "Referrer-Policy": "no-referrer",
});

/** The invitation routes carry a token and/or an email — same header set (I-6). */
export const INVITATION_RESPONSE_HEADERS: Readonly<Record<string, string>> =
  TAX_ID_REVEAL_RESPONSE_HEADERS;

// ── the table ───────────────────────────────────────────────────────────────

/** Why a route is in the policy. Drives the wire → policy direction of I-05. */
export type ResponseSensitivity = "token" | "email" | "tin" | "membership";

export interface ResponseHeaderPolicyRow {
  /** Upper-case HTTP verb. */
  readonly method: string;
  /** api-spec path template, e.g. `/orgs/{orgId}/tax-profile/reveal`. */
  readonly path: string;
  /** Headers this response MUST carry. */
  readonly headers: Readonly<Record<string, string>>;
  /** The sensitive things this response may contain (api-spec §1). */
  readonly carries: readonly ResponseSensitivity[];
}

function policyRow(
  method: string,
  path: string,
  headers: Readonly<Record<string, string>>,
  carries: readonly ResponseSensitivity[],
): ResponseHeaderPolicyRow {
  return Object.freeze({ method: method.toUpperCase(), path, headers, carries: Object.freeze(carries) });
}

/**
 * api-spec §1 "Cache / PII", row for row: the responses that carry a token, an
 * email or a TIN (§3.3, §3.7, §3.10–§3.17).
 *
 * `"tin"` covers the MASKED form too. Four digits of a Thai national ID are
 * still four digits of a national ID, and a masked value cached in a proxy is
 * the same PDPA incident with a smaller payload.
 */
export const RESPONSE_HEADER_POLICY: readonly ResponseHeaderPolicyRow[] = Object.freeze([
  // §3.3 / §3.4 — the profile body carries `taxIdMasked` for a caller with
  // `manage_org_settings`, and the shop's name for everybody.
  policyRow("GET", "/orgs/{orgId}", ORG_PROFILE_RESPONSE_HEADERS, ["tin"]),
  policyRow("PATCH", "/orgs/{orgId}", ORG_PROFILE_RESPONSE_HEADERS, ["tin"]),
  // §3.5 — answers with the §3.3 body, so it inherits the §3.3 rule exactly.
  policyRow("PUT", "/orgs/{orgId}/tax-profile", ORG_PROFILE_RESPONSE_HEADERS, ["tin"]),
  // ★ B-2 — the four invitation routes used to be listed HERE as well, with
  // the weaker header set and `carries: ["tin"]`. `responseHeaderPolicyFor` is
  // a `.find()`, so these rows won every lookup and the correct ones further
  // down were unreachable code that still read like enforcement. Removed; the
  // authoritative rows are in the §3.10–§3.13 block below, and a uniqueness
  // test now fails if a route is ever listed twice again.
  // §3.16 — the only response in the system with a FULL TIN.
  policyRow("POST", "/orgs/{orgId}/tax-profile/reveal", TAX_ID_REVEAL_RESPONSE_HEADERS, ["tin"]),
  // §3.7 / §3.10–§3.13 — member and invitation lists carry other people's
  // email addresses; the two POSTs additionally carry a one-time token (D-018).
  policyRow("GET", "/orgs/{orgId}/members", ORG_PROFILE_RESPONSE_HEADERS, ["email"]),
  // T-002-18 — api-spec §1 lists §3.7 (the member ROW shape) but not §3.8/§3.9
  // by number. §3.8 answers with that same row, email included, so the `email`
  // classification follows the SHAPE rather than the section number; leaving it
  // out would let a response carrying every bit of §3.7's PII be cached because
  // it arrived through a different verb. §3.9 carries no email, and is listed
  // for the same reason §3.17 is: "when was this person removed from which
  // shop" is still a fact about a person.
  policyRow("PATCH", "/orgs/{orgId}/members/{userId}", ORG_PROFILE_RESPONSE_HEADERS, ["email"]),
  policyRow("DELETE", "/orgs/{orgId}/members/{userId}", ORG_PROFILE_RESPONSE_HEADERS, ["membership"]),
  policyRow("GET", "/orgs/{orgId}/invitations", INVITATION_RESPONSE_HEADERS, ["email"]),
  policyRow("POST", "/orgs/{orgId}/invitations", INVITATION_RESPONSE_HEADERS, ["token", "email"]),
  policyRow(
    "POST",
    "/orgs/{orgId}/invitations/{invitationId}/link",
    INVITATION_RESPONSE_HEADERS,
    ["token", "email"],
  ),
  policyRow(
    "DELETE",
    "/orgs/{orgId}/invitations/{invitationId}",
    INVITATION_RESPONSE_HEADERS,
    ["email"],
  ),
  // §3.14 / §3.15 — the public preview echoes a masked email, and both consume
  // a token that must not reach a `Referer` header (I-6).
  policyRow("POST", "/invitations/preview", INVITATION_RESPONSE_HEADERS, ["email"]),
  policyRow("POST", "/invitations/accept", INVITATION_RESPONSE_HEADERS, ["email"]),
  // ★ B-3 — four routes the "wire → policy" direction was supposed to catch
  // and could not, because that direction was prose. It is a live gate now
  // (`test/response-header-policy.int.test.ts` walks the router), and these
  // are what it found on its first run.
  //
  // None of them returns a token, an email or a TIN — which is exactly why
  // they were missed. They return MEMBERSHIP: who is in which shop, in what
  // role, on what plan. The taxonomy already had a name for that class and
  // already used it as a reason to list a route (`DELETE …/membership`
  // below); nothing consulted it.
  policyRow("GET", "/me/organizations", ORG_PROFILE_RESPONSE_HEADERS, ["membership"]),
  policyRow("POST", "/organizations", ORG_PROFILE_RESPONSE_HEADERS, ["membership"]),
  policyRow("GET", "/orgs/{orgId}/roles", ORG_PROFILE_RESPONSE_HEADERS, ["membership"]),
  // F-001's admin reset. The body is `{ ok: true }`, but the REQUEST is an act
  // performed on a named person in a named shop, and the response confirms it
  // happened — a shared cache holding that is a disclosure of its own.
  policyRow(
    "POST",
    "/orgs/{orgId}/members/{userId}/reset-password",
    ORG_PROFILE_RESPONSE_HEADERS,
    ["membership"],
  ),
  // §3.17 — no email, no token, no TIN; listed because api-spec §1 puts
  // §3.10–§3.17 under `no-store` and because "when did this person leave which
  // shop" is still a fact about a person that must not sit in a shared cache.
  policyRow("DELETE", "/orgs/{orgId}/membership", ORG_PROFILE_RESPONSE_HEADERS, ["membership"]),
]);

/** The policy row for `method path` (`:orgId` or `{orgId}` dialect), if any. */
export function responseHeaderPolicyFor(
  method: string,
  path: string,
): ResponseHeaderPolicyRow | undefined {
  const key = routeKey({ method, path: toTemplatePath(path) });
  return RESPONSE_HEADER_POLICY.find((r) => routeKey(r) === key);
}

/**
 * The allowlist of endpoints that may put a FULL TIN on the wire, re-exported so
 * a PII assertion imports the header policy and the allowlist from ONE module.
 *
 * It is DEFINED once, in `common/authz/route-capabilities.ts` next to
 * `ANY_ACTIVE_MEMBER_ROUTES` (architecture §12.2 item 7 names that location).
 * This is a re-export, not a copy — there is exactly one array.
 */
export { TAX_ID_RESPONSE_ALLOWLIST, isTaxIdAllowedOnRoute } from "../common/authz";

// ── application ─────────────────────────────────────────────────────────────

/** Apply a header policy to an express response. */
export function applyResponseHeaders(
  res: Response,
  headers: Readonly<Record<string, string>>,
): void {
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
}
