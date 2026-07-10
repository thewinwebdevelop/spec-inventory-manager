/**
 * T-001-16 ★ — in-memory access-token store.
 *
 * client-security skill: "Access token lives in memory only (module/state).
 * Never localStorage, sessionStorage, or non-httpOnly cookies — XSS reads
 * those." The refresh token is NEVER handled here — it lives exclusively in
 * the `omni_rt` httpOnly cookie the server sets (api-spec.md §0); this module
 * has no field, getter, or serialization path for it, by construction.
 *
 * Module-scoped variable = memory only. It is intentionally NOT persisted
 * (survives only for the life of the JS heap / tab): a page reload loses the
 * access token and the app must silently refresh to get a new one, which is
 * the desired behavior (ux-wireframe §7 "silent refresh").
 *
 * `expiresInSeconds` is accepted (mirroring `TokenResponse.expiresIn`,
 * api-spec §2.2) but not currently tracked/read anywhere — the client only
 * ever reacts to a real `401` (requestWithRefresh in auth-client.ts), it
 * does not proactively pre-expire. Kept as a parameter so a future
 * proactive-refresh feature can add expiry tracking here without changing
 * every call site's signature (client-security review Minor #5: dropped the
 * previously-unused `hasFreshAccessToken` export rather than wiring a
 * pre-emptive-refresh code path that would have changed the already-reviewed
 * retry-once contract in auth-client.ts).
 */

let accessToken: string | null = null;

export function setAccessToken(token: string, _expiresInSeconds: number): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function clearAccessToken(): void {
  accessToken = null;
}
