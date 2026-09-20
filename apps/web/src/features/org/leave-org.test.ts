// T-002-W6 ★ — leaving a shop: three behaviours for four outcomes
// (ux-wireframe §10.3).
import { describe, it, expect } from "vitest";
import { toLeaveOrgOutcome, LEAVE_ORG_COPY } from "./leave-org";
import { ApiRequestError } from "../../lib/api/error";

const err = (status: number, code: string, extra: Record<string, unknown> = {}) =>
  new ApiRequestError(status, { error: { code, message: "x", ...extra } });

describe("toLeaveOrgOutcome", () => {
  it("★ LAST_OWNER keeps the dialog open — the user has something to do about it", () => {
    // Closing would throw away the intent along with the explanation, and
    // this is the one refusal with a clear next action.
    const out = toLeaveOrgOutcome(err(409, "LAST_OWNER"), true);
    expect(out).toEqual({
      kind: "blocked",
      message: LEAVE_ORG_COPY.lastOwner,
      offerMembersLink: true,
    });
  });

  it("★ …and only offers the members link to somebody who can use it", () => {
    // Sending a Staff member to a screen that answers 403 is worse than
    // offering no link: it turns "here is what to do" into a second refusal.
    const out = toLeaveOrgOutcome(err(409, "LAST_OWNER"), false);
    expect(out.kind === "blocked" && out.offerMembersLink).toBe(false);
  });

  it("★ a busy 409 is checked BEFORE the LAST_OWNER copy", () => {
    // §1.4's ordering rule. Lock contention reported as "you are the last
    // Owner" would send somebody hunting for a co-owner they already have.
    const out = toLeaveOrgOutcome(err(409, "CONFLICT", { details: { reason: "busy" } }), true);
    expect(out).toEqual({ kind: "retryable", message: LEAVE_ORG_COPY.busy });
    expect(out.kind === "retryable" && out.message).not.toBe(LEAVE_ORG_COPY.lastOwner);
  });

  it("★ 403 means ALREADY LEFT — pressing twice is not an error to fix", () => {
    // §10.3: this route has no capability to lack (D-029), so a 403 can only
    // be `ORG_ACCESS_DENIED`. The dialog closes and the org shell takes over
    // with §12.1.
    expect(toLeaveOrgOutcome(err(403, "ORG_ACCESS_DENIED"), true)).toEqual({
      kind: "already-left",
    });
    // Even an unlabelled 403 — inventing a permission that does not exist on
    // this route would leave the user stuck in a dialog about nothing.
    expect(toLeaveOrgOutcome(err(403, "FORBIDDEN"), true)).toEqual({ kind: "already-left" });
  });

  it("network and 5xx stay in the dialog with a retry", () => {
    expect(toLeaveOrgOutcome(new TypeError("Failed to fetch"), true)).toEqual({
      kind: "retryable",
      message: LEAVE_ORG_COPY.generic,
    });
    expect(toLeaveOrgOutcome(err(500, "INTERNAL"), true).kind).toBe("retryable");
  });

  it("never renders a raw code", () => {
    for (const e of [err(409, "LAST_OWNER"), err(500, "INTERNAL"), new TypeError("x")]) {
      const out = toLeaveOrgOutcome(e, true);
      if (out.kind === "already-left") continue;
      expect(out.message).not.toMatch(/[A-Z_]{4,}/);
      expect(out.message).toMatch(/[ก-๙]/);
    }
  });
});
