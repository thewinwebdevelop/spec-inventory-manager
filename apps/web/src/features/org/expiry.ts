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

/**
 * ★ B-15 — what an invitation ROW is allowed to say about its link.
 *
 * `formatExpiry` above warns, in its own doc comment, against "telling
 * somebody a dead link is live" — and the members screen then called it on
 * every row regardless of status. A cancelled invitation read
 * "ลิงก์ใช้ได้ถึง 11 ก.ย. 2569 20:36 (อีกประมาณ 7 วัน)" one second after the
 * confirm dialog had promised "ลิงก์ที่ส่งไปแล้วจะใช้ไม่ได้ทันที". The module
 * had the rule; the call site ignored it.
 *
 * ux-wireframe §7 (line 549) already specifies the four labels — this is not a
 * copy gap, it is a requirement that was never built:
 *   `รอตอบรับ · หมดอายุแล้ว · ยกเลิกแล้ว · รับแล้วเมื่อ {วันเวลา}`
 * …and §14 line 1091 requires a row past `expiresAt` to read "หมดอายุแล้ว"
 * IMMEDIATELY, without waiting for the server to restate its status.
 */
export type InvitationLifecycle = "pending" | "accepted" | "cancelled" | "expired";

export function invitationStatusLabel(
  invitation: {
    readonly status: string;
    readonly expiresAt: string;
    readonly acceptedAt?: string | null;
  },
  now: Date = new Date(),
): string {
  switch (invitation.status) {
    case "accepted": {
      // `acceptedAt` has been on the wire since the contract was locked and no
      // screen had ever read it — which is why "ใครรับไปแล้วเมื่อไหร่" (M-04)
      // could not be answered from the members list at all.
      const at = invitation.acceptedAt ? new Date(invitation.acceptedAt) : null;
      return at && !Number.isNaN(at.getTime())
        ? `รับแล้วเมื่อ ${DATE_TIME.format(at)}`
        : "รับแล้ว";
    }
    case "cancelled":
      return "ยกเลิกแล้ว";
    case "expired":
      return "หมดอายุแล้ว";
    default: {
      // A stored `pending` row past its own `expiresAt`: say so now.
      const at = new Date(invitation.expiresAt).getTime();
      return Number.isFinite(at) && at <= now.getTime() ? "หมดอายุแล้ว" : "รอตอบรับ";
    }
  }
}

/** True only while the link in somebody's chat app would still work. */
export function isInvitationLinkLive(
  invitation: { readonly status: string; readonly expiresAt: string },
  now: Date = new Date(),
): boolean {
  if (invitation.status !== "pending") return false;
  const at = new Date(invitation.expiresAt).getTime();
  return Number.isFinite(at) && at > now.getTime();
}
