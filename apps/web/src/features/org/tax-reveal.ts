/**
 * T-002-W4 ★ — the reveal button's state machine, as pure data.
 *
 * ux-wireframe §5 gives four rules, and three of them are about NOT keeping
 * the number:
 *
 *  - press → request every time (the full TIN never rides along on
 *    `GET /orgs/{orgId}`, so there is nothing to fall back on);
 *  - press again → hide, and DISCARD the value ("ทิ้งค่าทิ้งจริง");
 *  - to see it again → ask again, which counts against the rate limit afresh;
 *  - the user is told, before pressing, that the press is recorded.
 *
 * Modelled here rather than in the component so "hidden" cannot accidentally
 * mean "still in a variable, just not rendered". `hide()` returns a state
 * with no field to hold a number at all — the value is unreachable by
 * construction, not merely unrendered.
 */

export type RevealState =
  /** Nothing has been asked for. */
  | { readonly status: "hidden" }
  /** A request is in flight. The button is disabled and reads "กำลังขอเลข...". */
  | { readonly status: "loading" }
  /** The number is on screen. This is the ONLY variant with a `taxId` field. */
  | { readonly status: "shown"; readonly taxId: string; readonly revealedAt: string }
  /** The last attempt failed. The previously shown number, if any, is gone. */
  | { readonly status: "error" };

export const REVEAL_HIDDEN: RevealState = { status: "hidden" };
export const REVEAL_LOADING: RevealState = { status: "loading" };
export const REVEAL_ERROR: RevealState = { status: "error" };

export function revealShown(taxId: string, revealedAt: string): RevealState {
  return { status: "shown", taxId, revealedAt };
}

/**
 * Pressing the button.
 *
 * From `shown` it goes to `hidden` — and because `hidden` has no `taxId`
 * field, the number is dropped rather than retained-but-flagged. A
 * `{ visible: boolean; taxId: string }` shape would have kept it alive in
 * memory (and in React DevTools) for as long as the screen lived.
 */
export function toggleReveal(state: RevealState): RevealState {
  return state.status === "shown" ? REVEAL_HIDDEN : REVEAL_LOADING;
}

/** True when the next press should fire a request. */
export function pressRequestsReveal(state: RevealState): boolean {
  return state.status !== "shown" && state.status !== "loading";
}

/** What the number renders as. `null` means "show the masked value instead". */
export function visibleTaxId(state: RevealState): string | null {
  return state.status === "shown" ? state.taxId : null;
}
