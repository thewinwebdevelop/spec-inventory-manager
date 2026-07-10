// F-001 · T-001-01 / T-001-05 — refresh-token rotation reuse-decision (PURE fn,
// golden rules #4/#6 — the security core). arch §3.2/§3.3/§3.5, data-model
// §2.3/§2.4.
//
// Given the PRESENTED token's derived state + the relevant family facts as
// PLAIN VALUES (no DB, no clock — `now` is passed in), decide the action the
// refresh service must take under the row lock. The service executes the
// returned action inside/around the transaction (commit rules in data-model
// §2.4); this fn makes ZERO I/O so the full state matrix is unit-testable
// (test U3.1–U3.7).
//
// Derived state (NOT stored columns — data-model §2.3):
//   current   — newest in family: revokedAt=null AND expiresAt>now AND
//               familyExpiresAt>now AND no successor. Only a current token may
//               rotate.
//   consumed  — a successor exists (∃ row.rotatedFrom = presented.id). Present-
//               ing a consumed token is the reuse signal (outside leeway).
//   revoked   — revokedAt != null.

/** Reuse-leeway window (arch §3.5, D-011). Immediate-predecessor replay within
 * this window of the successor's creation is a benign retry, not reuse. */
export const REUSE_LEEWAY_MS = 60_000;

export type ReuseAction =
  /** Presented token is current → mint successor (rotate). */
  | "ALLOW_ROTATE"
  /** Genuine reuse (consumed/revoked outside leeway, or a deeper ancestor) →
   *  revoke the WHOLE family (committed), emit reuse_detected, generic 401. */
  | "REVOKE_FAMILY"
  /** Benign expiry: per-token expiresAt passed, OR family-lifetime cap
   *  (familyExpiresAt) passed (D-007). Generic 401, NO family burn, NO audit. */
  | "REJECT_EXPIRED"
  /** Immediate-predecessor replayed WITHIN the leeway window (D-011) —
   *  lost-response / multi-tab. Generic 401, NO family burn, NO audit. */
  | "REJECT_BENIGN_RETRY";

/**
 * Facts about the presented token + its family, as plain values. All times are
 * epoch-millis; `now` is injected so the decision is deterministic and testable.
 */
export interface ReuseDecisionInput {
  /** Current wall-clock, epoch ms (injected — no `Date.now()` in this fn). */
  now: number;
  /** Presented token's `revokedAt` (epoch ms) or null. */
  presentedRevokedAt: number | null;
  /** Presented token's per-token `expiresAt` (epoch ms). */
  presentedExpiresAt: number;
  /** Presented token's absolute family cap `familyExpiresAt` (epoch ms, D-007). */
  presentedFamilyExpiresAt: number;
  /**
   * The presented token's successor, if one exists (i.e. presented is
   * "consumed"). `null` when no row has `rotatedFrom = presented.id`.
   */
  successor: {
    /** The successor's `createdAt` (epoch ms) — for the leeway boundary. */
    createdAt: number;
    /**
     * Is the successor the CURRENT (live) token of the family — i.e. is the
     * presented token the IMMEDIATE predecessor of the current token? Only the
     * immediate predecessor is eligible for benign-retry leeway (arch §3.5);
     * a deeper ancestor (successor is itself consumed/revoked) never is.
     */
    isCurrent: boolean;
  } | null;
}

/**
 * Decide the rotation action. Evaluation order encodes the spec precedence:
 *
 *  1. Family-cap expiry (familyExpiresAt ≤ now, D-007) → REJECT_EXPIRED —
 *     ordinary session expiry, checked FIRST so an aged-out family never gets
 *     misclassified as reuse even if the presented token is also consumed.
 *  2. Explicitly revoked (revokedAt != null) → REVOKE_FAMILY — a revoked token
 *     replayed is a reuse/replay signal (data-model §2.3/§2.4). (Revoked tokens
 *     never get leeway — arch §3.5 coherence check (a).)
 *  3. Per-token expiry (expiresAt ≤ now) → REJECT_EXPIRED — benign expiry, no burn.
 *  4. Consumed (successor exists):
 *       - immediate predecessor of the CURRENT token AND successor age ≤ 60s →
 *         REJECT_BENIGN_RETRY (lost-response / multi-tab, D-011).
 *       - otherwise (older predecessor, OR deeper ancestor, OR successor no
 *         longer current) → REVOKE_FAMILY (genuine reuse).
 *  5. Current (no successor, not revoked, not expired, cap not reached) →
 *     ALLOW_ROTATE.
 */
export function decideReuse(input: ReuseDecisionInput): ReuseAction {
  const {
    now,
    presentedRevokedAt,
    presentedExpiresAt,
    presentedFamilyExpiresAt,
    successor,
  } = input;

  // 1. Absolute family-lifetime cap (D-007) — ordinary expiry, not reuse.
  if (presentedFamilyExpiresAt <= now) {
    return "REJECT_EXPIRED";
  }

  // 2. Explicitly revoked → reuse/replay (no leeway for a revoked token).
  if (presentedRevokedAt !== null) {
    return "REVOKE_FAMILY";
  }

  // 3. Per-token expiry — benign.
  if (presentedExpiresAt <= now) {
    return "REJECT_EXPIRED";
  }

  // 4. Consumed?
  if (successor !== null) {
    const withinLeeway = now - successor.createdAt <= REUSE_LEEWAY_MS;
    if (successor.isCurrent && withinLeeway) {
      // Immediate predecessor of the current token, replayed inside the window.
      return "REJECT_BENIGN_RETRY";
    }
    // Older predecessor, deeper ancestor, or successor itself already rotated
    // away → genuine reuse.
    return "REVOKE_FAMILY";
  }

  // 5. Current → rotate.
  return "ALLOW_ROTATE";
}
