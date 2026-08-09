/**
 * T-002-W5 ★ — the one-time invitation link (ux-wireframe §9.1, D-027).
 *
 * The token in this state IS a bearer credential for membership of a shop. The
 * server stores only its hash (D-018), so "show me that link again" is not
 * merely unimplemented — it is unimplementable. Which makes the client the only
 * place the raw token ever exists, for as long as this panel is open.
 *
 * Modelled the same way as the TIN reveal, for the same reason: `closed` has no
 * field to hold a token. A `{ visible: boolean; token: string }` shape would
 * keep a live membership credential in memory (and in React DevTools) for the
 * life of the screen, while passing any test that only checks what is rendered.
 *
 * ── The one behavioural rule that is not obvious ───────────────────────────
 * §9.1 settled on ONE guard rail rather than two: the warning banner sits above
 * the close button, and there is deliberately NO "are you sure" dialog on
 * close. What replaces it is the button WEIGHT — "เสร็จแล้ว" is `secondary`
 * until the link has been copied and only then becomes `primary`. The exit is
 * made prominent once it is safe, instead of being blocked while it is not.
 * That is why `copied` lives in this state at all.
 */

export type InviteLinkState =
  /** Nothing to show. The ONLY variant with no token field. */
  | { readonly status: "closed" }
  | {
      readonly status: "open";
      /** The raw token's URL. Never persisted, never logged. */
      readonly inviteUrl: string;
      /** Who it is for — shown so the sender can check before sending. */
      readonly email: string;
      /** ISO instant. The UI reads THIS, never a hard-coded "7 days". */
      readonly expiresAt: string;
      /** Has the user copied it? Decides the close button's weight. */
      readonly copied: boolean;
    };

export const INVITE_LINK_CLOSED: InviteLinkState = { status: "closed" };

export function openInviteLink(input: {
  readonly inviteUrl: string;
  readonly email: string;
  readonly expiresAt: string;
}): InviteLinkState {
  return { status: "open", ...input, copied: false };
}

/**
 * Closing DISCARDS the link. There is no "reopen": the server cannot reissue
 * the same token, so a state that kept it would be offering something the
 * system has already promised not to do.
 */
export function closeInviteLink(): InviteLinkState {
  return INVITE_LINK_CLOSED;
}

export function markCopied(state: InviteLinkState): InviteLinkState {
  return state.status === "open" ? { ...state, copied: true } : state;
}

/**
 * `secondary` until copied, then `primary` (§9.1). The whole of the
 * "don't lose the link" guard rail is in this one function, so it is worth
 * being able to test it directly.
 */
export function closeButtonVariant(state: InviteLinkState): "primary" | "secondary" {
  return state.status === "open" && state.copied ? "primary" : "secondary";
}

/** The URL to render, or `null` when there is nothing to show. */
export function visibleInviteUrl(state: InviteLinkState): string | null {
  return state.status === "open" ? state.inviteUrl : null;
}
