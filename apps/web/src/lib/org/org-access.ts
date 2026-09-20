/**
 * T-002-W1 ★ — what the org shell does about a failure, as a pure decision.
 *
 * The routing/rendering lives in `OrgGuard`; the DECISION lives here so it
 * can be tested without a router, a DOM, or a query client. ux-wireframe §12
 * gives two opposite behaviours for two failures that arrive with the same
 * HTTP status, and getting them the wrong way round is the kind of bug that
 * only shows up to a member who was just removed — i.e. never in
 * development.
 */
import { toApiFailure, type ApiFailure } from "../api/error";
import { isSignedIn, isSignedOut, type SessionState } from "../session/session-state";

export type OrgShellDecision =
  /** Bootstrap or the profile query has not settled. Skeleton, nothing else. */
  | { readonly kind: "loading" }
  /** Confirmed logged out — go to /login. */
  | { readonly kind: "sign-in" }
  /**
   * `403 ORG_ACCESS_DENIED` — leave the org entirely: navigate to the shop
   * picker, refetch `/me/organizations` (the shop will have vanished from
   * it), and show the yellow notice. NOT a logout: a session is not tied to
   * a shop (D-027).
   */
  | { readonly kind: "leave-org" }
  /** Anything else — stay put, show the error with a retry. */
  | { readonly kind: "error"; readonly failure: ApiFailure }
  /** Ready. */
  | { readonly kind: "ready" };

/**
 * @param session   bootstrap state (see session-state.ts)
 * @param profile   the org-profile query's state
 */
export function decideOrgShell(
  session: SessionState,
  profile: { readonly isPending: boolean; readonly isError: boolean; readonly error?: unknown },
): OrgShellDecision {
  // Order matters, and this is the order: an unsettled session outranks
  // everything, because until it settles we cannot tell a 401 from a
  // genuinely absent login, and bouncing a signed-in user to /login on every
  // reload is the failure that order prevents.
  if (session.status === "unknown") return { kind: "loading" };
  if (isSignedOut(session)) return { kind: "sign-in" };
  if (!isSignedIn(session)) return { kind: "loading" };

  if (profile.isError) {
    const failure = toApiFailure(profile.error);
    // The whole point of `org-access-denied` being its own kind: this branch
    // cannot be reached by a plain `FORBIDDEN`, so a member who merely lacks
    // a capability is never thrown out of their shop.
    if (failure.kind === "org-access-denied") return { kind: "leave-org" };
    if (failure.kind === "auth-expired") return { kind: "sign-in" };
    return { kind: "error", failure };
  }

  if (profile.isPending) return { kind: "loading" };
  return { kind: "ready" };
}
