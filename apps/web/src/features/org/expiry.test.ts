/**
 * ★ B-15 — an invitation row must never claim a dead link is live.
 *
 * Found by the §12.2 manual pass: I cancelled an invitation, the confirm
 * dialog said "ลิงก์ที่ส่งไปแล้วจะใช้ไม่ได้ทันที", and the row it left behind
 * read "ลิงก์ใช้ได้ถึง 11 ก.ย. 2569 20:36 (อีกประมาณ 7 วัน)". The accepted one
 * said the same about a link that had already been redeemed. The only visible
 * difference between a live invitation and a dead one was the ABSENCE of two
 * buttons.
 *
 * `formatExpiry`'s own doc comment warns against exactly this — "telling
 * somebody a dead link is live" — and the members screen called it on every
 * row regardless of status. This file is the missing half: the module knowing
 * the rule was never the same as the screen obeying it.
 */
import { describe, it, expect } from "vitest";
import {
  formatExpiry,
  formatRemaining,
  invitationStatusLabel,
  isInvitationLinkLive,
} from "./expiry";

const NOW = new Date("2026-09-04T13:30:00.000Z"); // 20:30 Asia/Bangkok
const IN_24H = new Date("2026-09-05T13:30:00.000Z").toISOString();
const YESTERDAY = new Date("2026-09-03T13:30:00.000Z").toISOString();

describe("formatRemaining — the number is computed, never printed", () => {
  it("counts down in days, hours and minutes", () => {
    // Exactly 24h rounds into the DAYS branch — "1 วัน", not "24 ชั่วโมง".
    // The screen shows "24 ชั่วโมง" because by the time a row renders the
    // remainder has already slipped under a day.
    expect(formatRemaining(IN_24H, NOW)).toBe("อีกประมาณ 1 วัน");
    expect(formatRemaining(IN_24H, new Date(NOW.getTime() + 60_000))).toBe(
      "อีกประมาณ 24 ชั่วโมง",
    );
    expect(formatRemaining(new Date("2026-09-11T13:30:00Z").toISOString(), NOW)).toBe(
      "อีกประมาณ 7 วัน",
    );
    expect(formatRemaining(new Date("2026-09-04T13:40:00Z").toISOString(), NOW)).toBe(
      "อีกประมาณ 10 นาที",
    );
  });

  it("★ a past instant is 'หมดอายุแล้ว', never a negative countdown", () => {
    expect(formatRemaining(YESTERDAY, NOW)).toBe("หมดอายุแล้ว");
  });
});

describe("★ isInvitationLinkLive — the question the row is actually answering", () => {
  it("only a pending invitation that has not expired", () => {
    expect(isInvitationLinkLive({ status: "pending", expiresAt: IN_24H }, NOW)).toBe(true);
  });

  it("★ cancelled is dead even though `expiresAt` is days away", () => {
    // The exact row from the manual pass. `expiresAt` is NON-NULL on every
    // row by contract (ux Q14), accepted and cancelled included — so reading
    // it without reading `status` is how the screen came to lie.
    expect(isInvitationLinkLive({ status: "cancelled", expiresAt: IN_24H }, NOW)).toBe(false);
  });

  it("★ accepted is dead — the link was already spent", () => {
    expect(isInvitationLinkLive({ status: "accepted", expiresAt: IN_24H }, NOW)).toBe(false);
  });

  it("a pending row past its own expiry is dead without waiting for the server", () => {
    // ux-wireframe §14 (line 1091): show "หมดอายุแล้ว" immediately rather than
    // waiting for the stored status to be restated.
    expect(isInvitationLinkLive({ status: "pending", expiresAt: YESTERDAY }, NOW)).toBe(false);
  });
});

describe("★ invitationStatusLabel — the four labels ux-wireframe §7 specifies", () => {
  it("รอตอบรับ", () => {
    expect(invitationStatusLabel({ status: "pending", expiresAt: IN_24H }, NOW)).toBe("รอตอบรับ");
  });

  it("ยกเลิกแล้ว", () => {
    expect(invitationStatusLabel({ status: "cancelled", expiresAt: IN_24H }, NOW)).toBe(
      "ยกเลิกแล้ว",
    );
  });

  it("หมดอายุแล้ว — both from the server's status and from the clock", () => {
    expect(invitationStatusLabel({ status: "expired", expiresAt: YESTERDAY }, NOW)).toBe(
      "หมดอายุแล้ว",
    );
    expect(invitationStatusLabel({ status: "pending", expiresAt: YESTERDAY }, NOW)).toBe(
      "หมดอายุแล้ว",
    );
  });

  it("★ รับแล้วเมื่อ {วันเวลา} — M-04's 'who accepted, and when'", () => {
    // `acceptedAt` had been on the wire since the contract was locked and no
    // production line of web code had ever read it: the members screen could
    // not answer "ใครรับไปแล้วเมื่อไหร่" at all.
    const label = invitationStatusLabel(
      {
        status: "accepted",
        expiresAt: IN_24H,
        acceptedAt: "2026-09-04T13:35:00.000Z",
      },
      NOW,
    );
    expect(label).toContain("รับแล้วเมื่อ");
    expect(label).toContain("20:35"); // Asia/Bangkok, not UTC
  });

  it("accepted with no timestamp still says so, rather than falling back to the expiry", () => {
    expect(
      invitationStatusLabel({ status: "accepted", expiresAt: IN_24H, acceptedAt: null }, NOW),
    ).toBe("รับแล้ว");
  });
});

describe("formatExpiry stays exactly what it was — for the rows that earn it", () => {
  it("renders the absolute instant in Asia/Bangkok plus the rough remainder", () => {
    const line = formatExpiry(IN_24H, new Date(NOW.getTime() + 60_000));
    expect(line).toContain("ลิงก์ใช้ได้ถึง");
    expect(line).toContain("20:30");
    expect(line).toContain("อีกประมาณ 24 ชั่วโมง");
    // ⛔ the contract with frontend (ux-wireframe §14): no literal TTL anywhere.
    expect(line).not.toMatch(/^.*"(7 วัน|24 ชั่วโมง)".*$/);
  });
});
