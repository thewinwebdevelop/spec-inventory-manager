// R1 — DomainExceptionFilter unit tests (D-014, backend.md §3.5).
// Covers: envelope shape, status mapping, details/fieldErrors pass-through,
// response headers (Retry-After), foreign HttpException reuse + status-mapped
// fallback, unknown-error 500 fallback (no internals leaked), and the
// server-issued `traceId` (F-002 architecture §15 row 2 · U-API-20 · NEW-7).
//
// R-01 (test-plan §9.3): the three cases that used to assert "NO traceId when
// the request carries no correlation id" are INVERTED here — the server now
// issues an opaque UUID v4 on EVERY error response. The inversion is deliberate
// and lands in the same commit as the code (never skipped, never deleted).
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
  type ArgumentsHost,
} from "@nestjs/common";
import { DomainExceptionFilter } from "./domain-exception.filter";
import { DomainException, domainError } from "./domain-exception";
import { ERROR_CODES } from "./error-codes";

/**
 * UUID v4, pinned exactly (NEW-7): version nibble = `4`, variant ∈ `8|9|a|b`.
 * A counter/timestamp/hash-of-request masquerading as a trace id fails this.
 */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

interface CapturedResponse {
  statusCode?: number;
  body?: { error: Record<string, unknown> };
  headers: Record<string, string>;
  status(s: number): CapturedResponse;
  json(b: unknown): CapturedResponse;
  setHeader(k: string, v: string): void;
}

/** Every log line the filter emitted during a test (message argument only). */
const logLines: string[] = [];

function mockHost(reqHeaders: Record<string, string> = {}): {
  host: ArgumentsHost;
  res: CapturedResponse;
} {
  const res: CapturedResponse = {
    headers: {},
    status(s) {
      this.statusCode = s;
      return this;
    },
    json(b) {
      this.body = b as CapturedResponse["body"];
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
    },
  };
  const req = { headers: reqHeaders, method: "POST", originalUrl: "/auth/login" };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

/** Header lookup that survives casing differences in the response object. */
function headerOf(res: CapturedResponse, name: string): string | undefined {
  const hit = Object.entries(res.headers).find(
    ([k]) => k.toLowerCase() === name.toLowerCase(),
  );
  return hit?.[1];
}

describe("DomainExceptionFilter", () => {
  const filter = new DomainExceptionFilter();

  beforeEach(() => {
    logLines.length = 0;
    // Capture (and silence) the filter's own logging. Both levels are captured
    // because the trace line for a 4xx must not be logged at `error`.
    const capture = (msg: unknown): undefined => {
      logLines.push(String(msg));
      return undefined;
    };
    vi.spyOn(Logger.prototype, "error").mockImplementation(capture);
    vi.spyOn(Logger.prototype, "warn").mockImplementation(capture);
  });

  it("maps a DomainException to the envelope + registry status", () => {
    const { host, res } = mockHost();
    filter.catch(domainError("EMAIL_TAKEN"), host);
    expect(res.statusCode).toBe(HttpStatus.CONFLICT);
    expect(res.body).toEqual({
      error: {
        code: "EMAIL_TAKEN",
        message: "อีเมลนี้ถูกใช้แล้ว",
        traceId: expect.stringMatching(UUID_V4),
      },
    });
  });

  it("passes through details and fieldErrors when present", () => {
    const { host, res } = mockHost();
    filter.catch(
      new DomainException(ERROR_CODES.VALIDATION_FAILED, {
        details: { feature: "accounting" },
        fieldErrors: { email: "อีเมลไม่ถูกต้อง" },
      }),
      host,
    );
    expect(res.body).toEqual({
      error: {
        code: "VALIDATION_FAILED",
        message: "ข้อมูลไม่ถูกต้อง",
        details: { feature: "accounting" },
        fieldErrors: { email: "อีเมลไม่ถูกต้อง" },
        traceId: expect.stringMatching(UUID_V4),
      },
    });
  });

  it("applies response headers carried by the exception (Retry-After)", () => {
    const { host, res } = mockHost();
    filter.catch(new DomainException(ERROR_CODES.RATE_LIMITED, { headers: { "Retry-After": "30" } }), host);
    expect(res.statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(res.headers["Retry-After"]).toBe("30");
    expect(res.body?.error.code).toBe("RATE_LIMITED");
    expect(res.body?.error.traceId).toMatch(UUID_V4);
  });

  it("reuses a foreign HttpException that already carries our envelope", () => {
    const { host, res } = mockHost();
    const ex = new UnprocessableEntityException({
      error: { code: "PASSWORD_TOO_SHORT", message: "สั้นไป" },
    });
    filter.catch(ex, host);
    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({
      error: {
        code: "PASSWORD_TOO_SHORT",
        message: "สั้นไป",
        traceId: expect.stringMatching(UUID_V4),
      },
    });
  });

  it("maps a foreign HttpException WITHOUT our envelope by status", () => {
    const { host, res } = mockHost();
    // Raw Nest exception → default body { statusCode, message, error }.
    filter.catch(new ForbiddenException("nope"), host);
    expect(res.statusCode).toBe(403);
    expect(res.body?.error.code).toBe("FORBIDDEN");
    expect(typeof res.body?.error.message).toBe("string");
    expect(res.body?.error.traceId).toMatch(UUID_V4);
  });

  it("maps an unknown non-HTTP error to 500 INTERNAL and leaks nothing", () => {
    const { host, res } = mockHost();
    const boom = new Error("connection string postgres://user:secret@host leaked");
    filter.catch(boom, host);
    expect(res.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(res.body).toEqual({
      error: {
        code: "INTERNAL",
        message: ERROR_CODES.INTERNAL.message,
        traceId: expect.stringMatching(UUID_V4),
      },
    });
    // No stack / no original message anywhere in the response body.
    expect(JSON.stringify(res.body)).not.toContain("secret");
    expect(JSON.stringify(res.body)).not.toContain("stack");
  });

  // ── U-API-20 · server-issued traceId (NEW-7) ───────────────────────────────

  it("R-01(a) issues a traceId even when the request carries NO correlation id", () => {
    // WAS: "omits traceId when no correlation id is present". Inverted on
    // purpose — Q12 requires a traceId on every error response.
    const { host, res } = mockHost();
    filter.catch(domainError("INVALID_CREDENTIALS"), host);
    expect(res.body?.error).toHaveProperty("traceId");
    expect(res.body?.error.traceId).toMatch(UUID_V4);
    expect(res.body).toEqual({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
        traceId: res.body?.error.traceId,
      },
    });
  });

  it("R-01(b) issues its own traceId when the correlation id is junk (never echoes it)", () => {
    // WAS: "omits traceId when the correlation id fails validation".
    const junk = 'abc<script>alert(1)</script>{"a":1}';
    const { host, res } = mockHost({ "x-request-id": junk });
    filter.catch(domainError("INVALID_CREDENTIALS"), host);
    expect(res.body?.error.traceId).toMatch(UUID_V4);
    expect(JSON.stringify(res.body)).not.toContain("script");
    expect(headerOf(res, "X-Request-Id")).toBe(res.body?.error.traceId);
  });

  it("R-01(c) issues its own traceId when the correlation id is 10k characters", () => {
    // WAS: "omits traceId when the correlation id exceeds 128 characters".
    const huge = "a".repeat(10_000);
    const { host, res } = mockHost({ "x-request-id": huge });
    filter.catch(domainError("INVALID_CREDENTIALS"), host);
    expect(res.body?.error.traceId).toMatch(UUID_V4);
    expect(res.body?.error.traceId).not.toBe(huge);
    expect(headerOf(res, "X-Request-Id")?.length).toBe(36);
  });

  it("U-API-20 does NOT reflect a client-supplied X-Request-Id (body or header)", () => {
    const spoof = "attacker-chosen-trace-id";
    const { host, res } = mockHost({ "x-request-id": spoof });
    filter.catch(domainError("INVALID_CREDENTIALS"), host);
    expect(res.body?.error.traceId).not.toBe(spoof);
    expect(res.body?.error.traceId).toMatch(UUID_V4);
    expect(headerOf(res, "X-Request-Id")).not.toBe(spoof);
    expect(headerOf(res, "X-Request-Id")).toBe(res.body?.error.traceId);
  });

  it("U-API-20 does NOT reflect a gateway-shaped client UUID either", () => {
    // WAS: "still emits gateway-shaped ids (UUID) after validation" — a valid
    // shape is not a reason to trust the value; the server always issues its own.
    const uuid = "0b6cbf13-7f9e-4b5d-9a44-2f1f4bafe2ce";
    const { host, res } = mockHost({ "x-trace-id": uuid });
    filter.catch(domainError("INVALID_CREDENTIALS"), host);
    expect(res.body?.error.traceId).toMatch(UUID_V4);
    expect(res.body?.error.traceId).not.toBe(uuid);
  });

  it("U-API-20 emits a UUID v4 traceId + echoes it as X-Request-Id on EVERY status", () => {
    const cases: Array<[string, unknown, number]> = [
      ["401", domainError("INVALID_CREDENTIALS"), 401],
      ["403", domainError("FORBIDDEN"), 403],
      ["404", domainError("NOT_FOUND"), 404],
      ["409", domainError("EMAIL_TAKEN"), 409],
      ["415", domainError("UNSUPPORTED_MEDIA_TYPE"), 415],
      ["422", domainError("VALIDATION_FAILED"), 422],
      ["429", domainError("RATE_LIMITED"), 429],
      ["404 (foreign HttpException)", new NotFoundException("gone"), 404],
      ["500 (unknown error fixture)", new Error("boom"), 500],
      ["500 (plain HttpException)", new HttpException("x", 500), 500],
    ];
    for (const [label, thrown, status] of cases) {
      const { host, res } = mockHost();
      filter.catch(thrown, host);
      expect(res.statusCode, label).toBe(status);
      expect(String(res.body?.error.traceId ?? ""), label).not.toBe("");
      expect(String(res.body?.error.traceId), label).toMatch(UUID_V4);
      expect(headerOf(res, "X-Request-Id"), label).toBe(res.body?.error.traceId);
    }
  });

  it("U-API-20 two consecutive errors get different trace ids", () => {
    const a = mockHost();
    const b = mockHost();
    filter.catch(domainError("INVALID_CREDENTIALS"), a.host);
    filter.catch(domainError("INVALID_CREDENTIALS"), b.host);
    expect(a.res.body?.error.traceId).not.toBe(b.res.body?.error.traceId);
  });

  it("U-API-20 1,000 trace ids: all unique, NOT monotonic, no request data embedded", () => {
    const orgId = "8f14e45f-ceea-467a-9a1e-1b1d1b1d1b1d";
    const userId = "3c59dc04-8e88-450e-8d7f-2fa2f7a8f8a1";
    const email = "owner@shop.example";
    const now = String(Date.now());
    const ids: string[] = [];
    for (let i = 0; i < 1000; i += 1) {
      const { host, res } = mockHost({
        "x-organization-id": orgId,
        "x-request-id": `${email}-${now}-${i}`,
      });
      filter.catch(domainError("INVALID_CREDENTIALS"), host);
      ids.push(String(res.body?.error.traceId));
    }
    // (ก) no collisions
    expect(new Set(ids).size).toBe(1000);
    // (ข) issued in time order but NOT sorted → not a counter/timestamp
    expect(ids).not.toEqual([...ids].sort());
    // (ค) nothing about the request is embedded in the value
    for (const id of ids) {
      expect(id).toMatch(UUID_V4);
      expect(id).not.toContain(now);
      expect(id.includes(orgId)).toBe(false);
      expect(id.includes(userId)).toBe(false);
      expect(id.includes(email)).toBe(false);
    }
  });

  // ── log correlation (Q12: ops must be able to join body ↔ log) ─────────────

  it("U-API-20 logs the traceId on the SAME line as the error (4xx, warn level)", () => {
    const { host, res } = mockHost();
    filter.catch(domainError("INVALID_CREDENTIALS"), host);
    const traceId = String(res.body?.error.traceId);
    const line = logLines.find((l) => l.includes(traceId));
    expect(line, "no log line carried the traceId").toBeDefined();
    expect(line).toContain("INVALID_CREDENTIALS");
    expect(line).toContain("401");
  });

  it("U-API-20 logs the traceId on the SAME line as the error (500)", () => {
    const { host, res } = mockHost();
    filter.catch(new Error("kaboom"), host);
    const traceId = String(res.body?.error.traceId);
    const line = logLines.find((l) => l.includes(traceId));
    expect(line, "no log line carried the traceId").toBeDefined();
    expect(line).toContain("INTERNAL");
    expect(line).toContain("500");
  });

  it("U-API-20 keeps the client's id as upstreamRequestId in the LOG ONLY", () => {
    const upstream = "gw-7a1c9f2e-0001";
    const { host, res } = mockHost({ "x-request-id": upstream });
    filter.catch(domainError("INVALID_CREDENTIALS"), host);
    // Log: present, joinable with the server-issued trace id on one line.
    const traceId = String(res.body?.error.traceId);
    const line = logLines.find((l) => l.includes(traceId));
    expect(line).toContain(upstream);
    // Wire: absent from both body and headers.
    expect(JSON.stringify(res.body)).not.toContain(upstream);
    expect(Object.values(res.headers).join("|")).not.toContain(upstream);
  });

  it("U-API-20 never writes an unvalidated upstream id into the log line", () => {
    // Log-injection guard: CRLF + 10k junk must not reach the log verbatim.
    const nasty = `evil\r\nFAKE LOG LINE ${"x".repeat(10_000)}`;
    const { host, res } = mockHost({ "x-request-id": nasty });
    filter.catch(domainError("INVALID_CREDENTIALS"), host);
    const traceId = String(res.body?.error.traceId);
    const line = logLines.find((l) => l.includes(traceId));
    expect(line).toBeDefined();
    expect(line).not.toContain("FAKE LOG LINE");
    expect(line).not.toContain("\n");
    expect(line!.length).toBeLessThan(400);
  });

  it("preserves the exact wire shape of a 415 from the json-only guard path", () => {
    const { host, res } = mockHost();
    // Same DomainException the JsonOnlyGuard now throws.
    filter.catch(domainError("UNSUPPORTED_MEDIA_TYPE"), host);
    expect(res.statusCode).toBe(415);
    expect(res.body).toEqual({
      error: {
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: "ต้องส่งเป็น application/json",
        traceId: expect.stringMatching(UUID_V4),
      },
    });
  });

  it("normalizes a plain HttpException 500 without leaking its message", () => {
    const { host, res } = mockHost();
    filter.catch(new HttpException("internal detail leak", HttpStatus.INTERNAL_SERVER_ERROR), host);
    expect(res.statusCode).toBe(500);
    expect(res.body?.error.code).toBe("INTERNAL");
    expect(res.body?.error.traceId).toMatch(UUID_V4);
    expect(JSON.stringify(res.body)).not.toContain("internal detail leak");
  });
});
