/**
 * T-002-W6 — what "ออกจากร้านนี้" does about each refusal
 * (ux-wireframe §10.3), as a pure function.
 *
 * The four outcomes want three DIFFERENT behaviours from the confirm dialog,
 * and the wrong pairing is invisible until it happens to a real person:
 *
 *   - `LAST_OWNER` and `busy` keep the dialog OPEN with a message inside it —
 *     the user has something to do about them, and closing would throw away
 *     the intent along with the explanation;
 *   - `ORG_ACCESS_DENIED` CLOSES it and lets the org shell take over: pressing
 *     "leave" twice is not an error the user should be asked to fix, it means
 *     they already left;
 *   - anything else is a retry inside the dialog.
 *
 * §10.3 also states there is NO `403 FORBIDDEN` on this route — leaving needs
 * no capability (D-029) — so a 403 here can only be `ORG_ACCESS_DENIED`, and
 * treating an unknown 403 as anything else would invent a permission that does
 * not exist.
 */
import { toApiFailure } from "../../lib/api/error";

export type LeaveOrgOutcome =
  /** Show this message inside the dialog; keep it open. */
  | { readonly kind: "blocked"; readonly message: string; readonly offerMembersLink: boolean }
  /** Retryable — same message placement, plus a retry affordance. */
  | { readonly kind: "retryable"; readonly message: string }
  /** Already gone. Close, and let `OrgGuard` do §12.1. */
  | { readonly kind: "already-left" };

export const LEAVE_ORG_COPY = {
  lastOwner:
    "คุณเป็นเจ้าของร้านคนเดียวของร้านนี้ — ตั้งคนอื่นเป็นเจ้าของร้านก่อน แล้วจึงออกจากร้านนี้ได้",
  busy: "ระบบกำลังทำรายการอื่นของร้านนี้อยู่ กรุณารอสักครู่แล้วลองใหม่อีกครั้ง",
  generic: "ออกจากร้านไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
} as const;

export function toLeaveOrgOutcome(
  error: unknown,
  canManageMembers: boolean,
): LeaveOrgOutcome {
  const failure = toApiFailure(error);

  // §10.3: this route has no capability to lack, so a 403 means "you are no
  // longer an active member" — including the case where you already left and
  // pressed again.
  if (failure.kind === "org-access-denied" || failure.kind === "forbidden") {
    return { kind: "already-left" };
  }

  // Checked BEFORE the generic conflict, exactly as §1.4 requires: lock
  // contention must not be reported as "you are the last Owner".
  if (failure.kind === "busy") {
    return { kind: "retryable", message: LEAVE_ORG_COPY.busy };
  }

  if (failure.kind === "conflict" && failure.code === "LAST_OWNER") {
    return {
      kind: "blocked",
      message: LEAVE_ORG_COPY.lastOwner,
      // Only useful to somebody who can act on it — offering a link to a
      // screen that answers 403 is worse than offering nothing.
      offerMembersLink: canManageMembers,
    };
  }

  return { kind: "retryable", message: LEAVE_ORG_COPY.generic };
}
