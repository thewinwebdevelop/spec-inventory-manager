// F-001 · T-001-01 — account-throttle backoff curve (pure fn, golden rule #6).
// arch §8.2: after 5 consecutive failures for an account, apply EXPONENTIAL
// backoff on subsequent attempts: ~1s → 2s → 4s → 8s … capped at a ceiling
// (15 min). NEVER a permanent hard-lock (US-5 AC "ห้ามล็อกตัวเองออกถาวร") — the
// window always expires and a success clears the counter (that reset lives in
// the throttle service; this fn only computes the delay for a given failure
// count). Test U2.3: monotonic non-decreasing, clamped at ceiling, n<5 → 0.
//
// This is the shared curve used by BOTH the login account throttle
// (`throttle:acct:{emailNorm}`) and the change-password throttle
// (`throttle:acct:{userId}`, N-2) and admin-reset (§2.8) — one curve, one place.

/** Consecutive failures before ANY backoff applies (arch §8.2). */
export const BACKOFF_THRESHOLD = 5;

/** Base delay (seconds) at the first backed-off attempt (the 6th failure). */
export const BACKOFF_BASE_SECONDS = 1;

/** Ceiling (seconds) — 15 minutes. The window can never exceed this. */
export const BACKOFF_CEILING_SECONDS = 15 * 60;

/**
 * Given the number of CONSECUTIVE failures so far for an account, return the
 * `Retry-After` seconds the NEXT attempt must wait.
 *
 * - `failureCount < 5` → **0** (no backoff yet; threshold is 5).
 * - `failureCount >= 5` → `base * 2^(failureCount - 5)` seconds, clamped at the
 *   15-min ceiling. So: 5→1s, 6→2s, 7→4s, 8→8s … → 900s ceiling.
 *
 * Pure integer math; no clock, no state. The throttle service records the
 * count in Redis and calls this to derive the window; it self-heals because the
 * window elapses and a success resets the count (arch §8.2).
 */
export function backoffSeconds(failureCount: number): number {
  if (!Number.isInteger(failureCount) || failureCount < 0) {
    throw new RangeError(`failureCount must be a non-negative integer, got ${failureCount}`);
  }
  if (failureCount < BACKOFF_THRESHOLD) return 0;

  const exponent = failureCount - BACKOFF_THRESHOLD;
  // Guard against overflow before hitting the ceiling: cap the exponent so
  // 2^exponent stays a safe integer, then clamp the product.
  const safeExponent = Math.min(exponent, 40);
  const raw = BACKOFF_BASE_SECONDS * 2 ** safeExponent;
  return Math.min(raw, BACKOFF_CEILING_SECONDS);
}

/** True once the failure count has reached the backoff threshold. */
export function isBackedOff(failureCount: number): boolean {
  return failureCount >= BACKOFF_THRESHOLD;
}
