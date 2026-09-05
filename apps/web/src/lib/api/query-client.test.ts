// Web restart point — the query client's retry policy is a safety property,
// not a tuning knob, so it is tested as one.
import { describe, it, expect } from "vitest";
import { createAppQueryClient, shouldRetryQuery, MAX_QUERY_RETRIES } from "./query-client";
import { ApiRequestError } from "./error";
import { SessionExpiredError } from "../auth-client";

function errorFor(status: number, code = "X", details?: Record<string, unknown>) {
  return new ApiRequestError(status, { error: { code, message: "x", ...(details ? { details } : {}) } });
}

describe("shouldRetryQuery", () => {
  it("retries a network failure, up to the cap", () => {
    const netErr = new TypeError("Failed to fetch");
    expect(shouldRetryQuery(0, netErr)).toBe(true);
    expect(shouldRetryQuery(MAX_QUERY_RETRIES - 1, netErr)).toBe(true);
    expect(shouldRetryQuery(MAX_QUERY_RETRIES, netErr)).toBe(false);
  });

  it("retries a 5xx", () => {
    expect(shouldRetryQuery(0, errorFor(500))).toBe(true);
    expect(shouldRetryQuery(0, errorFor(503, "ORG_PROVISIONING_UNAVAILABLE"))).toBe(true);
  });

  it("★ never retries a decision the server already made", () => {
    // Repeating these produces the same answer, delays the message the user
    // needs, and in the ORG_ACCESS_DENIED case keeps hammering a shop the
    // user was just removed from.
    for (const err of [
      errorFor(403, "ORG_ACCESS_DENIED"),
      errorFor(403, "FORBIDDEN"),
      errorFor(404, "NOT_FOUND"),
      errorFor(409, "LAST_OWNER"),
      errorFor(422, "TAX_ID_INVALID"),
      errorFor(429, "RATE_LIMITED"),
    ]) {
      expect(shouldRetryQuery(0, err), String(err.status + " " + err.code)).toBe(false);
    }
  });

  it("★ does not retry a busy 409 either — the PERSON presses retry", () => {
    // ux-wireframe §1.4 gives the user an explicit "ลองใหม่" affordance for
    // lock contention. Auto-retrying would race the very lock that is held,
    // and would do it invisibly.
    expect(shouldRetryQuery(0, errorFor(409, "CONFLICT", { reason: "busy" }))).toBe(false);
  });

  it("does not retry a dead session", () => {
    // The transport already spent its one silent refresh + retry. Another
    // round here is the loop F-001's review forbade, one layer up.
    expect(shouldRetryQuery(0, new SessionExpiredError())).toBe(false);
    expect(shouldRetryQuery(0, errorFor(401))).toBe(false);
  });
});

describe("createAppQueryClient", () => {
  it("★ mutations never auto-retry", () => {
    // No Idempotency-Key exists yet (api-spec §1 item 20) and the server does
    // not retry either — an automatic second POST is a duplicate write that
    // nothing downstream collapses.
    const defaults = createAppQueryClient().getDefaultOptions();
    expect(defaults.mutations?.retry).toBe(false);
  });

  it("queries use the vetted predicate, not a bare number", () => {
    const defaults = createAppQueryClient().getDefaultOptions();
    expect(defaults.queries?.retry).toBe(shouldRetryQuery);
  });

  it("refetches on window focus (web.md §3.7 — the WebSocket we did not build)", () => {
    expect(createAppQueryClient().getDefaultOptions().queries?.refetchOnWindowFocus).toBe(true);
  });
});
