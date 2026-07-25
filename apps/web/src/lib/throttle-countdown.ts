/**
 * Pure countdown formatting for `ThrottleBanner` (ux-wireframe §3.2, ui.md
 * §3.3). Kept as a pure function (no timers/DOM) so the mm:ss/short-form
 * boundary logic is unit-testable in isolation — the `useThrottleCountdown`
 * hook (hooks/use-throttle-countdown.ts) supplies the real-time ticking.
 *
 * D-005: never say "locked"/"suspended" — only the mm:ss / seconds copy.
 */
import { authTh } from "../i18n/auth";

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * Formats remaining seconds into the throttle banner copy.
 * >60s -> "mm:ss นาที" copy (long form); <=60s -> "N วินาที" copy (short form).
 * Clamped at 0 (never negative).
 */
export function formatThrottleMessage(remainingSeconds: number): string {
  const clamped = Math.max(0, Math.ceil(remainingSeconds));
  if (clamped > 60) {
    const mm = Math.floor(clamped / 60);
    const ss = clamped % 60;
    return authTh.throttle.bannerLong(pad2(mm), pad2(ss));
  }
  return authTh.throttle.bannerShort(clamped);
}
