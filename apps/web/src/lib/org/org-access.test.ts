// T-002-W1 ★ — the org shell's decision table.
//
// ux-wireframe §12 specifies two OPPOSITE reactions to two failures that
// arrive as the same HTTP status. These tests exist because the wrong
// pairing is invisible in development: you only meet `ORG_ACCESS_DENIED` by
// being removed from a shop while looking at it.
import { describe, it, expect } from "vitest";
import { decideOrgShell } from "./org-access";
import { ApiRequestError } from "../api/error";
import { SessionExpiredError } from "../auth-client";
import { SESSION_AUTHED, SESSION_NONE, SESSION_UNKNOWN } from "../session/session-state";

const settled = { isPending: false, isError: false };
const pending = { isPending: true, isError: false };

function failed(status: number, code: string) {
  return {
    isPending: false,
    isError: true,
    error: new ApiRequestError(status, { error: { code, message: "x" } }),
  };
}

describe("decideOrgShell — session first", () => {
  it("an unsettled session outranks everything, even a failed profile", () => {
    // Until the bootstrap refresh lands, a 403/401 tells us nothing we can
    // act on. Reacting now is how a reload kicks a signed-in user to /login.
    expect(decideOrgShell(SESSION_UNKNOWN, failed(403, "ORG_ACCESS_DENIED"))).toEqual({
      kind: "loading",
    });
    expect(decideOrgShell(SESSION_UNKNOWN, settled)).toEqual({ kind: "loading" });
  });

  it("a confirmed logged-out session goes to sign-in", () => {
    expect(decideOrgShell(SESSION_NONE, pending)).toEqual({ kind: "sign-in" });
  });
});

describe("decideOrgShell — the two 403s do opposite things", () => {
  it("★ ORG_ACCESS_DENIED leaves the org", () => {
    expect(decideOrgShell(SESSION_AUTHED, failed(403, "ORG_ACCESS_DENIED"))).toEqual({
      kind: "leave-org",
    });
  });

  it("★ FORBIDDEN does NOT leave the org — the user is still a member", () => {
    // ux-wireframe §12.2: stay on the page. Treating this as leave-org would
    // eject a Staff member from their own shop for opening a page they
    // merely lack a capability for.
    const decision = decideOrgShell(SESSION_AUTHED, failed(403, "FORBIDDEN"));
    expect(decision.kind).toBe("error");
    expect(decision.kind === "error" && decision.failure).toEqual({
      kind: "forbidden",
      code: "FORBIDDEN",
    });
  });

  it("★ never logs out on ORG_ACCESS_DENIED — a session is not tied to a shop", () => {
    // D-027. `sign-in` here would destroy a perfectly good session over one
    // shop's membership.
    expect(decideOrgShell(SESSION_AUTHED, failed(403, "ORG_ACCESS_DENIED")).kind).not.toBe("sign-in");
  });
});

describe("decideOrgShell — everything else stays put", () => {
  it("422 ORG_MISMATCH is an error, not an eviction", () => {
    // api-spec §4 (N-1): a header/path mismatch is OUR bug. ux-wireframe §1.4
    // says explicitly it must not kick the user out of the shop.
    const decision = decideOrgShell(SESSION_AUTHED, failed(422, "ORG_MISMATCH"));
    expect(decision.kind).toBe("error");
  });

  it("a dead session routes to sign-in", () => {
    expect(
      decideOrgShell(SESSION_AUTHED, {
        isPending: false,
        isError: true,
        error: new SessionExpiredError(),
      }),
    ).toEqual({ kind: "sign-in" });
  });

  it("network and 5xx are retryable errors on the current page", () => {
    expect(
      decideOrgShell(SESSION_AUTHED, {
        isPending: false,
        isError: true,
        error: new TypeError("Failed to fetch"),
      }),
    ).toEqual({ kind: "error", failure: { kind: "network" } });
    expect(decideOrgShell(SESSION_AUTHED, failed(500, "INTERNAL")).kind).toBe("error");
  });

  it("pending then ready", () => {
    expect(decideOrgShell(SESSION_AUTHED, pending)).toEqual({ kind: "loading" });
    expect(decideOrgShell(SESSION_AUTHED, settled)).toEqual({ kind: "ready" });
  });
});
