// F-002 · T-002-16 — the response-header policy for the org endpoints
// (api-spec §1 "Cache / PII").
//
// WHY IT IS PRODUCTION CODE AND NOT A CONSTANT IN THE TEST
// architecture §12.2 item 4: tests IMPORT the policy, they never re-declare it.
// A copy inside the suite keeps passing against itself on the day the API stops
// setting the header — which is the only day the assertion mattered.
//
// SCOPE: the endpoints T-002-15/16 ship. `RESPONSE_HEADER_POLICY` for the whole
// feature (invitations, tax-profile reveal — the routes that carry a token, an
// email or a TIN) belongs to T-002-17/19 and will supersede this constant; the
// values here must be a SUBSET of it, never a different opinion.
import type { Response } from "express";

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

/** Apply a header policy to an express response. */
export function applyResponseHeaders(
  res: Response,
  headers: Readonly<Record<string, string>>,
): void {
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
}
