/**
 * What `/` does, as a decision rather than an effect.
 *
 * ★ B-14 — decided by the user, 2026-09-01. `docs/architecture/web.md` had
 * said `authed→/o/[defaultOrg]`, and `defaultOrg` existed nowhere in the repo:
 * F-002's model has no default shop, a person belongs to zero, one or many.
 * The decision is to MIRROR LOGIN — `/select-org`, and let the picker decide,
 * because it is the screen that knows which of those three a person is in.
 *
 * Same shape as `decideOrgShell` and for the same reason: the branch is
 * testable without a router, and `unknown` is the branch that matters.
 */
import type { SessionState } from "./session-state";

export type RootDecision =
  /** Bootstrap has not settled. Render a skeleton — never a redirect. */
  | { readonly kind: "wait" }
  | { readonly kind: "sign-in" }
  | { readonly kind: "pick-shop" };

export function decideRoot(state: SessionState): RootDecision {
  switch (state.status) {
    case "authed":
      return { kind: "pick-shop" };
    case "none":
      return { kind: "sign-in" };
    // ⛔ `unknown` is NOT "signed out". `omni_rt` is `Path=/auth` (D-019), so a
    // cold load genuinely does not know yet until the bootstrap refresh
    // settles. Treating it as signed-out would bounce every signed-in person
    // to /login on every reload of `/` — which is exactly the flash that
    // session-state.ts exists to prevent.
    case "unknown":
      return { kind: "wait" };
  }
}
