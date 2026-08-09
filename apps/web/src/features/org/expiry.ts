/**
 * T-002-W5 — rendering an invitation's expiry (ux-wireframe §1.4, §9.1).
 *
 * Two rules, and both exist because the duration is NOT a constant: the TTL
 * depends on the invited ROLE (24h for an elevated one, 7 days otherwise,
 * D-028/I-7) and is recomputed server-side on every reissue (D-027).
 *
 *   - the absolute instant, in Asia/Bangkok, from `expiresAt`;
 *   - a rough "(อีกประมาณ …)" so the reader does not have to do the sum.
 *
 * ⛔ Never print "7 วัน" or "24 ชั่วโมง" as literal text. A screen that does is
 * correct until the first reissue of an Owner invitation, and wrong forever
 * after in the direction that matters (telling somebody a dead link is live).
 */

/** Fixed to the shop's timezone: Phase 0 is Asia/Bangkok only (D-013). */
const TZ = "Asia/Bangkok";

const DATE_TIME = new Intl.DateTimeFormat("th-TH", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** "(อีกประมาณ 6 ชั่วโมง)" — rounded, because precision here is false comfort. */
export function formatRemaining(expiresAt: string, now: Date = new Date()): string {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return "หมดอายุแล้ว";
  if (ms >= DAY_MS) {
    const days = Math.round(ms / DAY_MS);
    return `อีกประมาณ ${days} วัน`;
  }
  if (ms >= HOUR_MS) {
    const hours = Math.round(ms / HOUR_MS);
    return `อีกประมาณ ${hours} ชั่วโมง`;
  }
  const minutes = Math.max(1, Math.round(ms / 60_000));
  return `อีกประมาณ ${minutes} นาที`;
}

/** "ลิงก์ใช้ได้ถึง 9 ส.ค. 2026, 14:30 (อีกประมาณ 24 ชั่วโมง)" */
export function formatExpiry(expiresAt: string, now: Date = new Date()): string {
  const at = new Date(expiresAt);
  if (Number.isNaN(at.getTime())) return "";
  return `ลิงก์ใช้ได้ถึง ${DATE_TIME.format(at)} (${formatRemaining(expiresAt, now)})`;
}
