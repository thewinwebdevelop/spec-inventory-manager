// R1 (refactor-plan §4) — central error-code registry (backend.md §3.5).
//
// ONE place that maps a machine code → HTTP status + default Thai message. The
// wire envelope is `{ error: { code, message, details?, fieldErrors?, traceId? } }`
// (§3.5); `DomainException` carries a registry entry and `DomainExceptionFilter`
// turns it into that envelope.
//
// GOLDEN RULE: a `code` string that has SHIPPED must never change value — the
// client `switch`es on it (backend.md §3.5, apps/api CLAUDE.md กฎเหล็ก §5). The
// values below are the exact strings F-001 already ships (auth inline throws);
// this registry is the extraction of those literals into one authority, not a
// redefinition. `error-codes.test.ts` pins each value so a rename turns CI red.
import { HttpStatus } from "@nestjs/common";

/** A single registry entry: the machine code, its HTTP status, and the default
 *  user-facing Thai message (overridable per-throw). */
export interface ErrorCodeDef {
  /** UPPER_SNAKE machine code — the client switches on this. Immutable once shipped. */
  readonly code: string;
  /** HTTP status this code maps to (the filter uses it as the response status). */
  readonly status: number;
  /** Default user-facing Thai message (a throw site may override). */
  readonly message: string;
}

/**
 * The registry. Keys equal their `.code` (enforced by test) so call sites read
 * `domainError("EMAIL_TAKEN")`. All strings below are byte-for-byte the values
 * F-001 already ships — do not edit a shipped value.
 */
export const ERROR_CODES = {
  // ── 415 transport guard (json-only.guard) ─────────────────────────────────
  UNSUPPORTED_MEDIA_TYPE: {
    code: "UNSUPPORTED_MEDIA_TYPE",
    status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    message: "ต้องส่งเป็น application/json",
  },

  // ── 422 validation / password policy ──────────────────────────────────────
  VALIDATION_FAILED: {
    code: "VALIDATION_FAILED",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "ข้อมูลไม่ถูกต้อง",
  },
  EMAIL_INVALID: {
    code: "EMAIL_INVALID",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "อีเมลไม่ถูกต้อง",
  },
  PASSWORD_TOO_SHORT: {
    code: "PASSWORD_TOO_SHORT",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
  },
  PASSWORD_TOO_LONG: {
    code: "PASSWORD_TOO_LONG",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "รหัสผ่านยาวเกินไป (ไม่เกิน 128 ตัวอักษร)",
  },
  PASSWORD_BREACHED: {
    code: "PASSWORD_BREACHED",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "รหัสผ่านนี้อยู่ในรายการที่ถูกเปิดเผยแล้ว กรุณาใช้รหัสอื่น",
  },

  // ── 409 conflict ──────────────────────────────────────────────────────────
  EMAIL_TAKEN: {
    code: "EMAIL_TAKEN",
    status: HttpStatus.CONFLICT,
    message: "อีเมลนี้ถูกใช้แล้ว",
  },
  CONFLICT: {
    code: "CONFLICT",
    status: HttpStatus.CONFLICT,
    message: "ข้อมูลขัดแย้งกับสถานะปัจจุบัน",
  },

  // ── 401 unauthenticated / credential / refresh ───────────────────────────
  INVALID_CREDENTIALS: {
    code: "INVALID_CREDENTIALS",
    status: HttpStatus.UNAUTHORIZED,
    message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  },
  NO_REFRESH_TOKEN: {
    code: "NO_REFRESH_TOKEN",
    status: HttpStatus.UNAUTHORIZED,
    message: "ไม่พบ refresh token",
  },
  INVALID_REFRESH: {
    code: "INVALID_REFRESH",
    status: HttpStatus.UNAUTHORIZED,
    message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่",
  },
  UNAUTHENTICATED: {
    code: "UNAUTHENTICATED",
    status: HttpStatus.UNAUTHORIZED,
    message: "ต้องเข้าสู่ระบบ",
  },

  // ── 403 forbidden (RBAC / CSRF) ───────────────────────────────────────────
  CSRF_FAILED: {
    code: "CSRF_FAILED",
    status: HttpStatus.FORBIDDEN,
    message: "CSRF token ไม่ถูกต้อง",
  },
  FORBIDDEN: {
    code: "FORBIDDEN",
    status: HttpStatus.FORBIDDEN,
    message: "ไม่มีสิทธิ์เข้าถึง",
  },

  // ── 404 not found (same-shape auth 404-never-403) ─────────────────────────
  NOT_FOUND: {
    code: "NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "ไม่พบข้อมูล",
  },

  // ── 429 throttle ──────────────────────────────────────────────────────────
  RATE_LIMITED: {
    code: "RATE_LIMITED",
    status: HttpStatus.TOO_MANY_REQUESTS,
    message: "รอสักครู่แล้วลองใหม่",
  },

  // ── 500 unknown fallback (filter maps ANY unrecognized error here) ────────
  INTERNAL: {
    code: "INTERNAL",
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: "เกิดข้อผิดพลาดภายในระบบ",
  },
} as const satisfies Record<string, ErrorCodeDef>;

/** Union of registry keys (each equals its own `.code`). */
export type ErrorCodeKey = keyof typeof ERROR_CODES;

/**
 * Map an HTTP status to a machine code for a *foreign* HttpException that does
 * not carry our envelope (defensive fallback in the filter — none of F-001's
 * throws hit this path, but a future raw `new ForbiddenException()` would).
 */
export function codeForStatus(status: number): string {
  switch (status) {
    case HttpStatus.UNSUPPORTED_MEDIA_TYPE:
      return ERROR_CODES.UNSUPPORTED_MEDIA_TYPE.code;
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return ERROR_CODES.VALIDATION_FAILED.code;
    case HttpStatus.CONFLICT:
      return ERROR_CODES.CONFLICT.code;
    case HttpStatus.UNAUTHORIZED:
      return ERROR_CODES.UNAUTHENTICATED.code;
    case HttpStatus.FORBIDDEN:
      return ERROR_CODES.FORBIDDEN.code;
    case HttpStatus.NOT_FOUND:
      return ERROR_CODES.NOT_FOUND.code;
    case HttpStatus.TOO_MANY_REQUESTS:
      return ERROR_CODES.RATE_LIMITED.code;
    default:
      return ERROR_CODES.INTERNAL.code;
  }
}
