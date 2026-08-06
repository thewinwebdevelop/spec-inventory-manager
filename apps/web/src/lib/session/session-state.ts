/**
 * T-002-W1 ★ — auth bootstrap state (web.md §3.1).
 *
 * `unknown` is not a loading spinner detail, it is a security-relevant state.
 * `omni_rt` is scoped `Path=/auth` (D-019, C-1), so a request to
 * `/o/org_1/members` never carries it — Next.js middleware cannot see a
 * session at all on this stack, and there is no edge gate to write. Auth
 * gating happens in the browser AFTER the bootstrap refresh settles, which
 * means there is a window where the app genuinely does not know yet.
 *
 * Rendering anything org-shaped during that window is the bug this type
 * exists to prevent: a deep link to `/o/x/members` by a logged-out person
 * must show a skeleton and then `/login`, never a flash of the shell.
 *
 * ── Why `authed` carries no org list ───────────────────────────────────────
 * web.md §3.1's sketch has `{ status: "authed"; orgs: OrgSummary[] }`. It is
 * kept out here on purpose: the org list is a TanStack query
 * (`/me/organizations`), and a copy of it inside session state would be a
 * second source of truth for "which shops am I in" — the exact question that
 * has to be re-asked after a `403 ORG_ACCESS_DENIED` (ux-wireframe §12.1
 * requires a refetch). Two caches means the refetch can update one and leave
 * the switcher showing the shop the user was just removed from.
 */
export type SessionState =
  /** Bootstrap silent-refresh has not settled. Render a skeleton, nothing else. */
  | { readonly status: "unknown" }
  /** Confirmed logged out. */
  | { readonly status: "none" }
  /** Confirmed logged in — an access token is in memory. */
  | { readonly status: "authed" };

export const SESSION_UNKNOWN: SessionState = { status: "unknown" };
export const SESSION_NONE: SessionState = { status: "none" };
export const SESSION_AUTHED: SessionState = { status: "authed" };

/**
 * True only when we KNOW the user is logged out. `unknown` is deliberately
 * false: "we have not finished checking" must never be treated as "logged
 * out", or every reload would bounce a signed-in user to /login.
 */
export function isSignedOut(state: SessionState): boolean {
  return state.status === "none";
}

/** True only when we KNOW the user is logged in. `unknown` is false. */
export function isSignedIn(state: SessionState): boolean {
  return state.status === "authed";
}

/** Maps the bootstrap refresh result to a settled state. */
export function settledSession(refreshed: boolean): SessionState {
  return refreshed ? SESSION_AUTHED : SESSION_NONE;
}
