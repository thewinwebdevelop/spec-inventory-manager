// R1 — registry invariants (D-014). The registry is the single authority for
// machine codes; these tests pin the properties the client + filter rely on.
import { describe, it, expect } from "vitest";
import { HttpStatus } from "@nestjs/common";
import { ERROR_CODES, codeForStatus, type ErrorCodeKey } from "./error-codes";

describe("ERROR_CODES registry", () => {
  it("every entry's key equals its own `.code` (call sites read the key)", () => {
    for (const [key, def] of Object.entries(ERROR_CODES)) {
      expect(def.code).toBe(key);
    }
  });

  it("every entry has a numeric status and a non-empty Thai message", () => {
    for (const def of Object.values(ERROR_CODES)) {
      expect(typeof def.status).toBe("number");
      expect(def.status).toBeGreaterThanOrEqual(400);
      expect(def.message.length).toBeGreaterThan(0);
    }
  });

  // SHIPPED codes (F-001) — value + status are frozen. Changing any of these is
  // a breaking client contract change (backend.md §3.5). This map is the guard.
  it("pins the exact shipped code → status pairs (immutable once shipped)", () => {
    const shipped: Record<string, number> = {
      UNSUPPORTED_MEDIA_TYPE: 415,
      EMAIL_INVALID: 422,
      PASSWORD_TOO_SHORT: 422,
      PASSWORD_TOO_LONG: 422,
      PASSWORD_BREACHED: 422,
      EMAIL_TAKEN: 409,
      INVALID_CREDENTIALS: 401,
      NO_REFRESH_TOKEN: 401,
      INVALID_REFRESH: 401,
      UNAUTHENTICATED: 401,
      CSRF_FAILED: 403,
      NOT_FOUND: 404,
      RATE_LIMITED: 429,
    };
    for (const [code, status] of Object.entries(shipped)) {
      const def = ERROR_CODES[code as ErrorCodeKey];
      expect(def, `missing shipped code ${code}`).toBeDefined();
      expect(def.status, `status drift on ${code}`).toBe(status);
    }
  });

  it("pins the exact shipped Thai messages (client shows them verbatim)", () => {
    expect(ERROR_CODES.INVALID_CREDENTIALS.message).toBe("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    expect(ERROR_CODES.EMAIL_TAKEN.message).toBe("อีเมลนี้ถูกใช้แล้ว");
    expect(ERROR_CODES.NO_REFRESH_TOKEN.message).toBe("ไม่พบ refresh token");
    expect(ERROR_CODES.INVALID_REFRESH.message).toBe("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
    expect(ERROR_CODES.UNSUPPORTED_MEDIA_TYPE.message).toBe("ต้องส่งเป็น application/json");
    expect(ERROR_CODES.RATE_LIMITED.message).toBe("รอสักครู่แล้วลองใหม่");
    expect(ERROR_CODES.NOT_FOUND.message).toBe("ไม่พบข้อมูล");
    expect(ERROR_CODES.PASSWORD_TOO_SHORT.message).toBe("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
    expect(ERROR_CODES.PASSWORD_TOO_LONG.message).toBe("รหัสผ่านยาวเกินไป (ไม่เกิน 128 ตัวอักษร)");
    expect(ERROR_CODES.PASSWORD_BREACHED.message).toBe(
      "รหัสผ่านนี้อยู่ในรายการที่ถูกเปิดเผยแล้ว กรุณาใช้รหัสอื่น",
    );
  });
});

describe("codeForStatus (foreign-exception fallback)", () => {
  it("maps known statuses to a stable code", () => {
    expect(codeForStatus(HttpStatus.FORBIDDEN)).toBe("FORBIDDEN");
    expect(codeForStatus(HttpStatus.UNAUTHORIZED)).toBe("UNAUTHENTICATED");
    expect(codeForStatus(HttpStatus.NOT_FOUND)).toBe("NOT_FOUND");
    expect(codeForStatus(HttpStatus.UNPROCESSABLE_ENTITY)).toBe("VALIDATION_FAILED");
    expect(codeForStatus(HttpStatus.TOO_MANY_REQUESTS)).toBe("RATE_LIMITED");
    expect(codeForStatus(HttpStatus.CONFLICT)).toBe("CONFLICT");
    expect(codeForStatus(HttpStatus.UNSUPPORTED_MEDIA_TYPE)).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("maps anything unrecognized to INTERNAL", () => {
    expect(codeForStatus(418)).toBe("INTERNAL");
    expect(codeForStatus(500)).toBe("INTERNAL");
  });
});
