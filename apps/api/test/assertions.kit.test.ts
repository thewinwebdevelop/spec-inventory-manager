// F-002 · T-002-22 — META-TEST for the shared assertions (deliverable 4).
//
// D-014 says every piece of work carries a test. For an assertion library the
// only test worth writing is the NEGATIVE one: each function is handed the
// exact body a leaking endpoint would return, and the test passes only if the
// assertion REJECTS it. An assertion nobody has ever seen fail is a comment.
//
// Each `it` therefore has two halves: "correctly detected" (the red case) and a
// clean case, so a function that simply throws on everything cannot pass either.
import { describe, it, expect } from "vitest";
import {
  ERROR_BODY_VOLATILE_KEYS,
  FORBIDDEN_RESPONSE_FIELDS,
  assertErrorEnvelope,
  assertIdenticalErrorBodies,
  assertNoForeignValues,
  assertNoSecretFields,
  assertResponseHeaders,
  findForeignValues,
  findSecretFields,
  normalizeErrorBody,
  traceIdOf,
  type HttpResponseLike,
} from "./assertions.kit";

const TRACE_A = "11111111-1111-4111-8111-111111111111";
const TRACE_B = "22222222-2222-4222-8222-222222222222";

/** `traceId: null` means "the field is absent" (NOT the default — passing
 *  `undefined` would silently select the default and the RED case would pass
 *  for the wrong reason). */
function errorResponse(
  code: string,
  traceId: string | null = TRACE_A,
  status = 403,
  extra: Record<string, unknown> = {},
): HttpResponseLike {
  return {
    status,
    body: {
      error: {
        code,
        message: "ไม่มีสิทธิ์เข้าถึง",
        ...(traceId === null ? {} : { traceId }),
        ...extra,
      },
    },
    headers: {},
  };
}

describe("findSecretFields / assertNoSecretFields", () => {
  it("RED: finds a passwordHash nested inside an array of members", () => {
    const body = {
      items: [
        { id: "u1", email: "a@x.co" },
        { id: "u2", email: "b@x.co", user: { passwordHash: "$argon2id$whatever" } },
      ],
    };
    expect(findSecretFields(body)).toEqual(["items[1].user.passwordHash"]);
    expect(() => assertNoSecretFields(body)).toThrow(/leaks secret field/);
  });

  it("RED: finds a tokenHash even at the root", () => {
    expect(findSecretFields({ tokenHash: "abc" })).toEqual(["tokenHash"]);
  });

  it("matches the KEY NAME, not a substring — legitimate fields survive", () => {
    // `tokenIssuedAt` / `acceptedUserCreatedAfterInvite` are real F-002 fields.
    // A substring matcher would flag them, somebody would loosen the check, and
    // the next real `tokenHash` would walk straight through.
    const body = { tokenIssuedAt: "2026-01-01", acceptedUserCreatedAfterInvite: true, passwordChangedAt: null };
    expect(findSecretFields(body)).toEqual([]);
    expect(() => assertNoSecretFields(body)).not.toThrow();
  });

  it("`allowFields` is an explicit opt-in, never a regex", () => {
    const body = { refreshToken: "rt_123" };
    expect(() => assertNoSecretFields(body)).toThrow();
    expect(() => assertNoSecretFields(body, { allowFields: ["refreshToken"] })).not.toThrow();
  });

  it("pins the forbidden list — widening it must be a reviewed act", () => {
    expect([...FORBIDDEN_RESPONSE_FIELDS]).toEqual([
      "passwordHash",
      "password",
      "newPassword",
      "currentPassword",
      "tokenHash",
      "rawToken",
      "refreshToken",
      "secret",
    ]);
  });
});

describe("findForeignValues / assertNoForeignValues", () => {
  it("RED: finds another person's email anywhere in the body", () => {
    const body = { members: [{ emailMasked: "b***@x.co" }], debug: "invited bob@other.co" };
    expect(findForeignValues(body, ["bob@other.co"])).toEqual(['debug ⊃ bob@other.co']);
    expect(() => assertNoForeignValues(body, ["bob@other.co"])).toThrow(/belonging to somebody else/);
  });

  it("is case-insensitive (a mapper that upper-cases is still a leak)", () => {
    expect(findForeignValues({ x: "BOB@OTHER.CO" }, ["bob@other.co"])).toHaveLength(1);
  });

  it("clean body with only the caller's own email passes", () => {
    expect(() => assertNoForeignValues({ email: "me@x.co" }, ["bob@other.co"])).not.toThrow();
  });
});

describe("assertErrorEnvelope", () => {
  it("accepts the real envelope shape", () => {
    expect(() => assertErrorEnvelope(errorResponse("ORG_ACCESS_DENIED"), { code: "ORG_ACCESS_DENIED", status: 403 })).not.toThrow();
  });

  it("RED: no traceId → rejected (I-06 applies to EVERY error status)", () => {
    expect(() => assertErrorEnvelope(errorResponse("FORBIDDEN", null))).toThrow(/traceId/);
  });

  it("RED: a traceId that is not a random UUID v4 → rejected (NEW-7)", () => {
    // A counter or a hash of the request leaks traffic volume / is guessable.
    expect(() => assertErrorEnvelope(errorResponse("FORBIDDEN", "req-000017"))).toThrow(/UUID v4/);
  });

  it("RED: a stray key in the envelope → rejected", () => {
    expect(() =>
      assertErrorEnvelope(errorResponse("FORBIDDEN", TRACE_A, 403, { sqlState: "40P01" })),
    ).toThrow(/unknown key/);
  });

  it("RED: a 2xx is not an error response", () => {
    expect(() => assertErrorEnvelope({ status: 200, body: { ok: true } })).toThrow(/4xx\/5xx/);
  });

  it("RED: extra top-level keys next to `error` → rejected", () => {
    expect(() =>
      assertErrorEnvelope({ status: 500, body: { error: { code: "INTERNAL", message: "x", traceId: TRACE_A }, stack: "…" } }),
    ).toThrow(/top level/);
  });

  it("RED: a secret smuggled into the envelope → rejected", () => {
    expect(() =>
      assertErrorEnvelope(errorResponse("CONFLICT", TRACE_A, 409, { details: { passwordHash: "$argon2id$x" } })),
    ).toThrow(/leaks secret field/);
  });
});

describe("normalizeErrorBody / assertIdenticalErrorBodies", () => {
  it("the volatile allowlist has EXACTLY one member", () => {
    // The whole safety of comparing two error bodies rests on this. A second
    // member would let a real difference be normalized away.
    expect([...ERROR_BODY_VOLATILE_KEYS]).toEqual(["traceId"]);
  });

  it("RED: refuses to normalize a body with no traceId", () => {
    expect(() => normalizeErrorBody({ error: { code: "X", message: "y" } })).toThrow(/no `error.traceId`/);
  });

  it("two same-shape denials with different trace ids are indistinguishable", () => {
    expect(() =>
      assertIdenticalErrorBodies(errorResponse("ORG_ACCESS_DENIED", TRACE_A), errorResponse("ORG_ACCESS_DENIED", TRACE_B)),
    ).not.toThrow();
  });

  it("RED: a different code is caught even though traceId differs", () => {
    expect(() =>
      assertIdenticalErrorBodies(errorResponse("ORG_ACCESS_DENIED", TRACE_A), errorResponse("NOT_FOUND", TRACE_B)),
    ).toThrow(/distinguishable/);
  });

  it("RED: a SHARED traceId is caught — it would be derived from the request", () => {
    expect(() =>
      assertIdenticalErrorBodies(errorResponse("ORG_ACCESS_DENIED", TRACE_A), errorResponse("ORG_ACCESS_DENIED", TRACE_A)),
    ).toThrow(/SAME traceId/);
  });

  it("RED: a different status is caught before bodies are even compared", () => {
    expect(() =>
      assertIdenticalErrorBodies(errorResponse("X", TRACE_A, 403), errorResponse("X", TRACE_B, 404)),
    ).toThrow(/differ in status/);
  });

  it("traceIdOf reads the field, or undefined", () => {
    expect(traceIdOf(errorResponse("X").body)).toBe(TRACE_A);
    expect(traceIdOf({ ok: true })).toBeUndefined();
  });
});

describe("assertResponseHeaders", () => {
  const res: HttpResponseLike = {
    status: 200,
    body: {},
    headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" },
  };

  it("passes when every policy entry matches (string or shape)", () => {
    expect(() =>
      assertResponseHeaders(res, { "Cache-Control": "no-store", "Referrer-Policy": /no-referrer/ }),
    ).not.toThrow();
  });

  it("RED: a missing header is reported by name", () => {
    expect(() => assertResponseHeaders(res, { "X-Frame-Options": "DENY" })).toThrow(/X-Frame-Options: missing/);
  });

  it("RED: a present-but-wrong header is reported with both values", () => {
    expect(() => assertResponseHeaders(res, { "Cache-Control": "no-cache" })).toThrow(/expected no-cache, got "no-store"/);
  });
});
