// T-002-W2 ★ — the failure taxonomy, tested from the wire shape inwards.
//
// These build an `ApiRequestError` from a real envelope rather than
// constructing an `ApiFailure` by hand. That is deliberate: the F-002 API had
// a bug (`describeOrgBusy`) that survived its own test precisely because the
// test built the classifier's INPUT instead of driving the real path, so the
// classifier's real caller was never exercised. Here the envelope is what the
// server actually sends, per api-spec §4.
import { describe, it, expect } from "vitest";
import { ApiError, SessionExpiredError } from "../auth-client";
import type { ErrorResponse } from "../auth-client";
import {
  ApiRequestError,
  failureMessage,
  isOrgAccessDenied,
  isRetryable,
  toApiFailure,
  type ApiFailure,
} from "./error";
import { errorsTh } from "../../i18n/errors";

function envelope(
  code: string,
  extra: Partial<ErrorResponse["error"]> = {},
): ErrorResponse {
  return { error: { code, message: "ข้อความจากเซิร์ฟเวอร์", ...extra } };
}

function failureFor(status: number, body: ErrorResponse | null, retryAfter?: number): ApiFailure {
  return toApiFailure(new ApiRequestError(status, body, retryAfter));
}

describe("toApiFailure — the two 403s", () => {
  it("403 ORG_ACCESS_DENIED is its own kind (never `forbidden`)", () => {
    expect(failureFor(403, envelope("ORG_ACCESS_DENIED"))).toEqual({
      kind: "org-access-denied",
    });
  });

  it("403 FORBIDDEN keeps the code and stays `forbidden`", () => {
    expect(failureFor(403, envelope("FORBIDDEN"))).toEqual({
      kind: "forbidden",
      code: "FORBIDDEN",
    });
  });

  it("★ a screen cannot handle both with one branch — they are different kinds", () => {
    // The regression this guards: api-spec §4 + ux-wireframe §12 say
    // ORG_ACCESS_DENIED must drop the org context and navigate to the picker,
    // while FORBIDDEN must stay on the page. If both ever collapse into one
    // kind, a handler written for one silently does the wrong thing for the
    // other — and one of those wrong things is kicking a member out of a shop
    // they are still in.
    const denied = failureFor(403, envelope("ORG_ACCESS_DENIED"));
    const forbidden = failureFor(403, envelope("FORBIDDEN"));

    expect(denied.kind).not.toBe(forbidden.kind);
    expect(isOrgAccessDenied(denied)).toBe(true);
    expect(isOrgAccessDenied(forbidden)).toBe(false);
  });

  it("a 403 with an unknown code is FORBIDDEN, not access-denied", () => {
    // The non-destructive reading: stay where you are. Guessing
    // "org-access-denied" here would throw a member out of their shop on any
    // 403 the client has not seen before.
    expect(failureFor(403, envelope("SOMETHING_NEW"))).toEqual({
      kind: "forbidden",
      code: "SOMETHING_NEW",
    });
    expect(failureFor(403, null)).toEqual({ kind: "forbidden", code: undefined });
  });

  it("INVITATION_EMAIL_MISMATCH (403) is a plain forbidden — the user is not being removed", () => {
    // api-spec §3.15: logged in as the wrong account. The invite screen owns
    // the copy; what matters here is that it does NOT drop the org context.
    const f = failureFor(403, envelope("INVITATION_EMAIL_MISMATCH", { details: { emailMasked: "s***@shop.com" } }));
    expect(f.kind).toBe("forbidden");
    expect(isOrgAccessDenied(f)).toBe(false);
  });
});

describe("toApiFailure — 409 lock contention vs a real conflict", () => {
  it('409 with details.reason="busy" is `busy`', () => {
    expect(failureFor(409, envelope("CONFLICT", { details: { reason: "busy" } }))).toEqual({
      kind: "busy",
    });
  });

  it("409 without a reason keeps its code so the screen can use its own copy", () => {
    expect(
      failureFor(409, envelope("INVITATION_PENDING", { details: { invitationId: "inv_1" } })),
    ).toEqual({
      kind: "conflict",
      code: "INVITATION_PENDING",
      details: { invitationId: "inv_1" },
    });
  });

  it("★ busy is checked BEFORE the screen's own 409 copy", () => {
    // ux-wireframe §1.4: "เช็ค reason === 'busy' ก่อนเสมอ แล้วค่อย fallback".
    // A cancel-invitation call that loses the row lock comes back as
    // `409 CONFLICT { reason: "busy" }` — showing that screen's conflict copy
    // ("คำเชิญนี้ไม่ได้รออยู่แล้ว") would be a lie: the invitation is fine,
    // the shop was simply busy.
    const busy = failureFor(409, envelope("CONFLICT", { details: { reason: "busy" } }));
    expect(busy.kind).toBe("busy");
    expect(failureMessage(busy)).toBe(errorsTh.busy);
    expect(failureMessage(busy)).not.toBe(errorsTh.conflict);
  });

  it("only the exact string \"busy\" counts", () => {
    expect(failureFor(409, envelope("CONFLICT", { details: { reason: "BUSY" } })).kind).toBe("conflict");
    expect(failureFor(409, envelope("CONFLICT", { details: { reason: 1 } })).kind).toBe("conflict");
  });

  it("a plain ApiError (F-001, no details) at 409 is a conflict, never busy", () => {
    // The legacy class carries no `details`, so it must not be able to
    // accidentally satisfy the busy check.
    expect(toApiFailure(new ApiError(409, envelope("LAST_OWNER")))).toEqual({
      kind: "conflict",
      code: "LAST_OWNER",
      details: undefined,
    });
  });
});

describe("toApiFailure — the rest of api-spec §4", () => {
  it("422 ORG_MISMATCH is a client bug: validation, and NOT an access loss", () => {
    const f = failureFor(422, envelope("ORG_MISMATCH"));
    expect(f).toEqual({ kind: "validation", code: "ORG_MISMATCH", fieldErrors: {} });
    // The point of the rule (api-spec §4, N-1): a header/path mismatch is our
    // own bug and must never read as "you were removed from this shop".
    expect(isOrgAccessDenied(f)).toBe(false);
    expect(failureMessage(f)).toBe(errorsTh.clientBug);
  });

  it("422 TAX_ID_INVALID carries fieldErrors through", () => {
    expect(
      failureFor(422, envelope("TAX_ID_INVALID", { fieldErrors: { taxId: "เลขไม่ถูกต้อง" } })),
    ).toEqual({
      kind: "validation",
      code: "TAX_ID_INVALID",
      fieldErrors: { taxId: "เลขไม่ถูกต้อง" },
    });
  });

  it("429 carries Retry-After for the throttle countdown", () => {
    expect(failureFor(429, envelope("RATE_LIMITED"), 42)).toEqual({
      kind: "throttled",
      retryAfterSeconds: 42,
    });
  });

  it("404 / 503 / 500 map as documented", () => {
    expect(failureFor(404, envelope("INVITATION_INVALID")).kind).toBe("not-found");
    expect(failureFor(503, envelope("ORG_PROVISIONING_UNAVAILABLE"))).toEqual({
      kind: "server",
      code: "ORG_PROVISIONING_UNAVAILABLE",
    });
    expect(failureFor(500, null).kind).toBe("server");
  });

  it("401 and SessionExpiredError both mean auth-expired", () => {
    expect(failureFor(401, envelope("UNAUTHORIZED"))).toEqual({ kind: "auth-expired" });
    expect(toApiFailure(new SessionExpiredError())).toEqual({ kind: "auth-expired" });
  });

  it("a non-ApiError rejection is `network`, never a permission verdict", () => {
    // fetch rejects with TypeError when the connection dies. We never heard
    // from the server, so we must not claim the user lacks access.
    expect(toApiFailure(new TypeError("Failed to fetch"))).toEqual({ kind: "network" });
    expect(toApiFailure("boom")).toEqual({ kind: "network" });
    expect(toApiFailure(undefined)).toEqual({ kind: "network" });
  });
});

describe("failureMessage", () => {
  const everyKind: ApiFailure[] = [
    { kind: "network" },
    { kind: "throttled", retryAfterSeconds: 3 },
    { kind: "auth-expired" },
    { kind: "org-access-denied" },
    { kind: "forbidden" },
    { kind: "entitlement" },
    { kind: "validation", fieldErrors: {} },
    { kind: "busy" },
    { kind: "conflict" },
    { kind: "not-found" },
    { kind: "server" },
  ];

  it("returns Thai prose for every kind — never a code, never empty", () => {
    for (const f of everyKind) {
      const msg = failureMessage(f);
      expect(msg.length, f.kind).toBeGreaterThan(0);
      expect(msg, f.kind).toMatch(/[ก-๙]/); // Thai, not a machine code
    }
  });

  it("never leaks the words a user must not see", () => {
    // ux-wireframe §1.4 names these explicitly for the busy case.
    for (const f of everyKind) {
      const msg = failureMessage(f);
      for (const banned of ["busy", "CONFLICT", "reason", "traceId"]) {
        expect(msg, `${f.kind} leaked "${banned}"`).not.toContain(banned);
      }
    }
  });
});

describe("isRetryable", () => {
  it("busy is retryable — the form keeps its values and the user may press again", () => {
    expect(isRetryable({ kind: "busy" })).toBe(true);
  });

  it("a real conflict is NOT retryable — the data changed underneath", () => {
    expect(isRetryable({ kind: "conflict", code: "LAST_OWNER" })).toBe(false);
  });

  it("forbidden and validation are not retryable", () => {
    expect(isRetryable({ kind: "forbidden" })).toBe(false);
    expect(isRetryable({ kind: "validation", fieldErrors: {} })).toBe(false);
    expect(isRetryable({ kind: "org-access-denied" })).toBe(false);
  });
});
