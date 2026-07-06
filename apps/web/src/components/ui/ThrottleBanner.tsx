"use client";

import { useEffect, useRef } from "react";
import { authTh } from "../../i18n/auth";
import { formatThrottleMessage } from "../../lib/throttle-countdown";

/**
 * `ThrottleBanner` (ux-wireframe §3.2, D-005) — yellow/warning banner, NEVER
 * red/danger ("รอได้ ไม่ใช่หายนะ"). Countdown text uses the tabular-nums
 * token so mm:ss doesn't jitter every second (design-system.md §1.2
 * `type.numeric.tabular`). `aria-live` only fires on a 10s cadence per ui.md
 * §6 ("กัน screen reader spam") — implemented by only announcing when
 * `remainingSeconds % 10 === 0` (or the final 0).
 */
export function ThrottleBanner({ remainingSeconds }: { remainingSeconds: number }) {
  const message = formatThrottleMessage(remainingSeconds);
  const lastAnnouncedRef = useRef<number | null>(null);
  const shouldAnnounce =
    remainingSeconds === 0 || remainingSeconds % 10 === 0
      ? lastAnnouncedRef.current !== remainingSeconds
      : false;

  useEffect(() => {
    if (shouldAnnounce) lastAnnouncedRef.current = remainingSeconds;
  }, [shouldAnnounce, remainingSeconds]);

  return (
    <div
      data-testid="throttle-banner"
      role="status"
      aria-live={shouldAnnounce ? "polite" : "off"}
      className="mb-4 rounded-card border border-warning-border bg-warning-bg p-4 text-warning-text"
    >
      <div className="tabular-nums text-body-md font-semibold">{message}</div>
      <div className="mt-1 text-body-sm">{authTh.throttle.helper}</div>
    </div>
  );
}
