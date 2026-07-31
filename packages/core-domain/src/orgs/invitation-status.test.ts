import { describe, it, expect } from "vitest";
import { resolveInvitationStatus } from "./invitation-status";

// F-002 · T-002-08 — U-CD-05 (test-plan §3) · data-model §3.2.
// `expired` is DERIVED at read time (stored `pending` + expiresAt <= now).
// There is no cron marking rows expired, so `now` is always an argument —
// never read from the clock inside the function.

const EXPIRES_AT = new Date("2026-08-01T10:00:00.000Z");
const at = (ms: number) => new Date(EXPIRES_AT.getTime() + ms);

describe("resolveInvitationStatus — pending vs the clock", () => {
  it("stays pending before expiry", () => {
    expect(resolveInvitationStatus({ status: "pending", expiresAt: EXPIRES_AT }, at(-1))).toBe(
      "pending",
    );
    expect(
      resolveInvitationStatus({ status: "pending", expiresAt: EXPIRES_AT }, at(-86_400_000)),
    ).toBe("pending");
  });

  it("is expired exactly AT expiry (boundary is <=, the safe side)", () => {
    expect(resolveInvitationStatus({ status: "pending", expiresAt: EXPIRES_AT }, at(0))).toBe(
      "expired",
    );
  });

  it("is expired after expiry", () => {
    expect(resolveInvitationStatus({ status: "pending", expiresAt: EXPIRES_AT }, at(1))).toBe(
      "expired",
    );
  });
});

describe("resolveInvitationStatus — terminal states are never overridden by time", () => {
  it("keeps `accepted` even long after expiresAt", () => {
    expect(resolveInvitationStatus({ status: "accepted", expiresAt: EXPIRES_AT }, at(1))).toBe(
      "accepted",
    );
    expect(resolveInvitationStatus({ status: "accepted", expiresAt: EXPIRES_AT }, at(-1))).toBe(
      "accepted",
    );
  });

  it("keeps `cancelled` even long after expiresAt", () => {
    expect(
      resolveInvitationStatus({ status: "cancelled", expiresAt: EXPIRES_AT }, at(31_536_000_000)),
    ).toBe("cancelled");
  });

  it("reports a row that somehow stores `expired` as expired (reserved enum value)", () => {
    // data-model §2: no write path stores `expired`. If one ever appears, the
    // fail-closed reading is `expired`, not `pending`.
    expect(resolveInvitationStatus({ status: "expired", expiresAt: EXPIRES_AT }, at(-1))).toBe(
      "expired",
    );
  });
});

describe("resolveInvitationStatus — purity", () => {
  it("is a function of (row, now) only — same inputs, same answer", () => {
    const row = { status: "pending", expiresAt: EXPIRES_AT } as const;
    expect(resolveInvitationStatus(row, at(-5))).toBe(resolveInvitationStatus(row, at(-5)));
    expect(resolveInvitationStatus(row, at(-5))).not.toBe(resolveInvitationStatus(row, at(5)));
  });

  it("does not mutate the row or the `now` it is given", () => {
    const expiresAt = new Date(EXPIRES_AT);
    const now = at(5);
    const nowMs = now.getTime();
    resolveInvitationStatus({ status: "pending", expiresAt }, now);
    expect(expiresAt.getTime()).toBe(EXPIRES_AT.getTime());
    expect(now.getTime()).toBe(nowMs);
  });
});
