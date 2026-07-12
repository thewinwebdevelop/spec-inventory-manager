// R1 — DomainExceptionFilter unit tests (D-014, backend.md §3.5).
// Covers: envelope shape, status mapping, details/fieldErrors pass-through,
// response headers (Retry-After), foreign HttpException reuse + status-mapped
// fallback, unknown-error 500 fallback (no internals leaked), traceId presence.
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  UnprocessableEntityException,
  type ArgumentsHost,
} from "@nestjs/common";
import { DomainExceptionFilter } from "./domain-exception.filter";
import { DomainException, domainError } from "./domain-exception";
import { ERROR_CODES } from "./error-codes";

interface CapturedResponse {
  statusCode?: number;
  body?: { error: Record<string, unknown> };
  headers: Record<string, string>;
  status(s: number): CapturedResponse;
  json(b: unknown): CapturedResponse;
  setHeader(k: string, v: string): void;
}

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
  const req = { headers: reqHeaders };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

describe("DomainExceptionFilter", () => {
  const filter = new DomainExceptionFilter();

  beforeEach(() => {
    // Silence the intentional error log in the unknown-error test.
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });

  it("maps a DomainException to the envelope + registry status", () => {
    const { host, res } = mockHost();
    filter.catch(domainError("EMAIL_TAKEN"), host);
    expect(res.statusCode).toBe(HttpStatus.CONFLICT);
    expect(res.body).toEqual({
      error: { code: "EMAIL_TAKEN", message: "อีเมลนี้ถูกใช้แล้ว" },
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
      },
    });
  });

  it("applies response headers carried by the exception (Retry-After)", () => {
    const { host, res } = mockHost();
    filter.catch(new DomainException(ERROR_CODES.RATE_LIMITED, { headers: { "Retry-After": "30" } }), host);
    expect(res.statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(res.headers["Retry-After"]).toBe("30");
    expect(res.body?.error.code).toBe("RATE_LIMITED");
  });

  it("reuses a foreign HttpException that already carries our envelope", () => {
    const { host, res } = mockHost();
    const ex = new UnprocessableEntityException({
      error: { code: "PASSWORD_TOO_SHORT", message: "สั้นไป" },
    });
    filter.catch(ex, host);
    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: { code: "PASSWORD_TOO_SHORT", message: "สั้นไป" } });
  });

  it("maps a foreign HttpException WITHOUT our envelope by status", () => {
    const { host, res } = mockHost();
    // Raw Nest exception → default body { statusCode, message, error }.
    filter.catch(new ForbiddenException("nope"), host);
    expect(res.statusCode).toBe(403);
    expect(res.body?.error.code).toBe("FORBIDDEN");
    expect(typeof res.body?.error.message).toBe("string");
  });

  it("maps an unknown non-HTTP error to 500 INTERNAL and leaks nothing", () => {
    const { host, res } = mockHost();
    const boom = new Error("connection string postgres://user:secret@host leaked");
    filter.catch(boom, host);
    expect(res.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(res.body).toEqual({ error: { code: "INTERNAL", message: ERROR_CODES.INTERNAL.message } });
    // No stack / no original message anywhere in the response body.
    expect(JSON.stringify(res.body)).not.toContain("secret");
    expect(JSON.stringify(res.body)).not.toContain("stack");
  });

  it("emits traceId when the request carries an upstream correlation id", () => {
    const { host, res } = mockHost({ "x-request-id": "trace-abc-123" });
    filter.catch(domainError("INVALID_CREDENTIALS"), host);
    expect(res.body?.error.traceId).toBe("trace-abc-123");
  });

  it("omits traceId when no correlation id is present (byte-identical to F-001)", () => {
    const { host, res } = mockHost();
    filter.catch(domainError("INVALID_CREDENTIALS"), host);
    expect(res.body?.error).not.toHaveProperty("traceId");
    expect(res.body).toEqual({
      error: { code: "INVALID_CREDENTIALS", message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" },
    });
  });

  it("omits traceId when the correlation id fails validation (junk characters)", () => {
    // ★ sanity-pass fix (2026-07-11): unvalidated header must not be echoed.
    const { host, res } = mockHost({ "x-request-id": 'abc<script>alert(1)</script>{"a":1}' });
    filter.catch(domainError("INVALID_CREDENTIALS"), host);
    expect(res.body?.error).not.toHaveProperty("traceId");
  });

  it("omits traceId when the correlation id exceeds 128 characters", () => {
    const { host, res } = mockHost({ "x-request-id": "a".repeat(129) });
    filter.catch(domainError("INVALID_CREDENTIALS"), host);
    expect(res.body?.error).not.toHaveProperty("traceId");
  });

  it("still emits gateway-shaped ids (UUID) after validation", () => {
    const uuid = "0b6cbf13-7f9e-4b5d-9a44-2f1f4bafe2ce";
    const { host, res } = mockHost({ "x-trace-id": uuid });
    filter.catch(domainError("INVALID_CREDENTIALS"), host);
    expect(res.body?.error.traceId).toBe(uuid);
  });

  it("preserves the exact wire shape of a 415 from the json-only guard path", () => {
    const { host, res } = mockHost();
    // Same DomainException the JsonOnlyGuard now throws.
    filter.catch(domainError("UNSUPPORTED_MEDIA_TYPE"), host);
    expect(res.statusCode).toBe(415);
    expect(res.body).toEqual({
      error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "ต้องส่งเป็น application/json" },
    });
  });

  it("normalizes a plain HttpException 500 without leaking its message", () => {
    const { host, res } = mockHost();
    filter.catch(new HttpException("internal detail leak", HttpStatus.INTERNAL_SERVER_ERROR), host);
    expect(res.statusCode).toBe(500);
    expect(res.body?.error.code).toBe("INTERNAL");
    expect(JSON.stringify(res.body)).not.toContain("internal detail leak");
  });
});
