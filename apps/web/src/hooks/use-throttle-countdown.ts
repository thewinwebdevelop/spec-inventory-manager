"use client";

import { useEffect, useState } from "react";

/**
 * Real-time countdown state for `ThrottleBanner` (ux-wireframe §3.2: "นับ
 * ถอยหลังเป็น นาที:วินาที ที่ปรับ real-time ทุกวินาที"). Ticks locally from a
 * `Retry-After` seconds value captured at the moment of the 429 response —
 * it does NOT poll the server every second (per ui.md / ux-wireframe §3.2
 * note: "ไม่ poll ซ้ำทุกวินาที"). Re-arm by calling `start(seconds)` again
 * (e.g. when a retried submit returns a fresh 429 + Retry-After during the
 * wait — the spec's clock-skew re-sync note).
 */
export function useThrottleCountdown() {
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (remainingSeconds <= 0) return;
    const id = setInterval(() => {
      setRemainingSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [remainingSeconds > 0]);

  const start = (seconds: number) => setRemainingSeconds(Math.max(0, Math.ceil(seconds)));
  const isActive = remainingSeconds > 0;

  return { remainingSeconds, isActive, start };
}
