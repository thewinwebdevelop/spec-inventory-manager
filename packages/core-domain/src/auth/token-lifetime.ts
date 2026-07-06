// F-001 · T-001-01 / T-001-05 — refresh-token lifetime + live-family-cap math
// (pure fns, golden rule #6). arch §2.3 / §3.1, data-model §2.2/§2.5, D-007/D-017.
//
// One place for the tunable 60d/90d/20 constants (arch §2.3 "both live in one
// config constant so the values are tunable") and the pure derivations the
// refresh service applies. No DB, no clock — times injected.

/** Per-token TTL (ms) — 60 days. SLIDES: each rotation mints a fresh one. */
export const REFRESH_TOKEN_TTL_MS = 60 * 24 * 60 * 60 * 1000;

/** Absolute family-lifetime cap (ms) — 90 days from login. INHERITED unchanged
 *  on rotation (does NOT slide) — D-007. */
export const FAMILY_LIFETIME_CAP_MS = 90 * 24 * 60 * 60 * 1000;

/** Max live families per user (D-017). 21st login LRU-revokes the oldest. */
export const LIVE_FAMILY_CAP = 20;

/** Per-token expiry for a token minted (or rotated) at `nowMs`. */
export function tokenExpiresAt(nowMs: number): number {
  return nowMs + REFRESH_TOKEN_TTL_MS;
}

/** Family cap for a family first created (login) at `loginMs`. On rotation the
 *  successor copies the predecessor's value verbatim — do NOT recompute. */
export function familyExpiresAt(loginMs: number): number {
  return loginMs + FAMILY_LIFETIME_CAP_MS;
}

/**
 * A live family, summarized for the LRU cap decision (D-017): its id and the
 * family's original login time (MIN(createdAt) of its rows, data-model §2.5).
 */
export interface LiveFamily {
  familyId: string;
  /** Family's original login time (epoch ms) — the LRU key. */
  createdAt: number;
}

export interface CapDecision {
  /** familyId to revoke BEFORE minting the new one, or null if under cap. */
  revokeFamilyId: string | null;
}

/**
 * Given the user's current LIVE families, decide whether a new login must evict
 * one to stay within `LIVE_FAMILY_CAP` (D-017). If already at/over the cap,
 * returns the OLDEST family's id (LRU by `createdAt`) to revoke first; otherwise
 * `null`. Login itself NEVER fails on the cap — it evicts, then mints.
 *
 * Pure: the service passes the queried live families in and applies the returned
 * revoke (its own committed txn) before the new family insert (data-model §2.5).
 */
export function decideFamilyCap(
  liveFamilies: readonly LiveFamily[],
  cap: number = LIVE_FAMILY_CAP,
): CapDecision {
  if (liveFamilies.length < cap) {
    return { revokeFamilyId: null };
  }
  // At or over the cap → evict the oldest (smallest createdAt). Deterministic
  // tie-break on familyId so the choice is stable if two share a createdAt.
  let oldest = liveFamilies[0];
  for (const f of liveFamilies) {
    if (
      f.createdAt < oldest.createdAt ||
      (f.createdAt === oldest.createdAt && f.familyId < oldest.familyId)
    ) {
      oldest = f;
    }
  }
  return { revokeFamilyId: oldest.familyId };
}
