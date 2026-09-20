// F-002 · T-002-08 — derived invitation status (pure fn). data-model §3.2.
//
// `expired` is COMPUTED at read time, never stored: there is no cron marking
// rows expired. A stored status that lags real time is a classic bug source
// (someone accepts an expired invitation because the job has not run yet);
// computing on read is always correct and costs nothing. The reserved enum
// value `expired` therefore has no write path (data-model §2).
//
// `now` is a parameter, not `Date.now()` — the boundary behaviour is part of
// the contract and has to be testable to the millisecond.

/** What the DB column can hold (`expired` is reserved, never written). */
export type StoredInvitationStatus = "pending" | "accepted" | "expired" | "cancelled";

/** What the API and the UI see. */
export type ResolvedInvitationStatus = "pending" | "accepted" | "cancelled" | "expired";

export interface ResolvableInvitation {
  readonly status: StoredInvitationStatus;
  readonly expiresAt: Date;
}

/**
 * Stored `pending` + `expiresAt <= now` → `expired`. Terminal states
 * (`accepted`, `cancelled`) are never overridden by the clock: they record what
 * happened, and an expiry timestamp cannot un-happen it.
 *
 * The boundary is `<=`: at the exact expiry instant the invitation is already
 * expired (the safe side — never accept a link at the moment it dies).
 */
export function resolveInvitationStatus(
  invitation: ResolvableInvitation,
  now: Date,
): ResolvedInvitationStatus {
  switch (invitation.status) {
    case "accepted":
      return "accepted";
    case "cancelled":
      return "cancelled";
    case "expired":
      // No write path produces this, but if a row ever holds it, reading it as
      // expired is the fail-closed answer.
      return "expired";
    case "pending":
      return invitation.expiresAt.getTime() <= now.getTime() ? "expired" : "pending";
  }
}
