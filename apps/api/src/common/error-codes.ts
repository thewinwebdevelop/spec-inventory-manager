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

  // ── 422 org context (F-002 · api-spec §4) ─────────────────────────────────
  // Both are VALIDATION-class on purpose: they say "this request was addressed
  // wrong", not "you may not". Answering 403 here would bounce a perfectly
  // valid member out of the org they are looking at (N-1).
  ORG_CONTEXT_REQUIRED: {
    code: "ORG_CONTEXT_REQUIRED",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "ต้องระบุร้านที่ต้องการเข้าถึง",
  },
  ORG_MISMATCH: {
    code: "ORG_MISMATCH",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "ร้านใน header กับใน URL ไม่ตรงกัน",
  },

  // ── 422 tax profile (F-002 · api-spec §4 / §3.5 · T-002-17) ───────────────
  // A DISTINCT code from VALIDATION_FAILED because the client shows different
  // copy for it: "that is not a real tax id" points at one field the user can
  // fix, while VALIDATION_FAILED on this endpoint usually means "you have not
  // finished filling the form" (the all-or-nothing rule, data-model §3.3).
  //
  // ⚠️ The message never contains the rejected value — with
  // `entityType='personal'` a Thai TIN is the owner's national ID (M-7ค), and
  // an error message is the one string that gets copied into a bug report.
  TAX_ID_INVALID: {
    code: "TAX_ID_INVALID",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "เลขผู้เสียภาษีไม่ถูกต้อง",
  },
  // F-002 · T-002-18 — api-spec §4 / §3.8: the `roleId` in the body is not a
  // role of THIS shop (it does not exist, or it belongs to another tenant).
  //
  // ⚠️ 422, and the message says nothing about which of the two it was. The
  // lookup runs through `ORG_PRISMA`, so a role id from another org and a role
  // id that never existed are indistinguishable here BY CONSTRUCTION — which is
  // the point: a distinguishable answer would turn this endpoint into an oracle
  // for "does this role id exist somewhere in the platform?" (I-8).
  ROLE_INVALID: {
    code: "ROLE_INVALID",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "บทบาทนี้ไม่ใช่บทบาทของร้านนี้",
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
  // F-002 · api-spec §3.11 (D-027) — this email already has a live invitation.
  // It carries `details.invitationId` so the UI can offer "reissue" or "cancel"
  // instead of a dead end: without the id the only thing a user can do with
  // this error is retype the address and get it again.
  INVITATION_PENDING: {
    code: "INVITATION_PENDING",
    status: HttpStatus.CONFLICT,
    message: "อีเมลนี้มีคำเชิญค้างอยู่แล้ว",
  },
  // F-002 · api-spec §3.11 / §10 (M-3) — cap on invitations that are pending
  // AND not yet expired. Counting expired ones too would let a shop lock itself
  // out of inviting anybody by leaving old links to rot.
  INVITATION_LIMIT_REACHED: {
    code: "INVITATION_LIMIT_REACHED",
    status: HttpStatus.CONFLICT,
    message: "คำเชิญที่ค้างอยู่ครบจำนวนสูงสุดแล้ว",
  },
  // F-002 · api-spec §3.11/§3.15 — the invitee is already in this shop.
  ALREADY_MEMBER: {
    code: "ALREADY_MEMBER",
    status: HttpStatus.CONFLICT,
    message: "ผู้ใช้นี้เป็นสมาชิกของร้านนี้อยู่แล้ว",
  },

  // F-002 · api-spec §4 / architecture §6.3 (I-10) — the per-user shop cap.
  // 409 rather than 403: nothing about the CALLER is wrong, the request simply
  // conflicts with a state they can resolve (leave a shop, or ask us to raise
  // it). The throw site attaches `details: { limit }` so the UI can show the
  // real number instead of hard-coding "50" (which would then drift from env).
  ORG_LIMIT_REACHED: {
    code: "ORG_LIMIT_REACHED",
    status: HttpStatus.CONFLICT,
    message: "คุณมีร้านครบจำนวนสูงสุดแล้ว",
  },
  // F-002 · T-002-18 ★ — api-spec §4 / architecture §5. The change would leave
  // the shop with ZERO active Owners, which is unrecoverable in Phase 0 (there
  // is no back-office until F-085 and no "delete shop"), so it is refused rather
  // than warned about. Raised by `assertOwnerRemains` INSIDE the org-locked
  // transaction — the answer is only true if it was computed under the lock.
  //
  // 409, not 403: the caller may well have the right to do this; it is the
  // resulting STATE that is illegal, and they can fix it (promote someone first).
  // Covers leaving voluntarily too (§3.17 / D-029) — same rule, same code.
  LAST_OWNER: {
    code: "LAST_OWNER",
    status: HttpStatus.CONFLICT,
    message: "ร้านต้องมีเจ้าของอย่างน้อย 1 คน",
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
  // F-002 · I-5 — deliberately SEPARATE from FORBIDDEN. "You are not an active
  // member of this org" (incl. the org not existing, or you having been removed)
  // must be distinguishable by the client from "you are a member but lack this
  // capability": the first sends the user back to the org picker + refetches
  // /me/organizations, the second keeps them on the page with a toast. One code
  // for both guarantees the client does the wrong one of the two.
  ORG_ACCESS_DENIED: {
    code: "ORG_ACCESS_DENIED",
    status: HttpStatus.FORBIDDEN,
    message: "คุณไม่ได้เป็นสมาชิกของร้านนี้",
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

  // ── 503 provisioning (F-002 · api-spec §4 / architecture §6.2) ────────────
  // The system has no default plan to bind a new shop to. It is OUR
  // misconfiguration, never the user's input, so it is a 5xx and the message
  // says "try again / contact us" rather than blaming the request.
  //
  // ⛔ The alternative — quietly falling back to the `free` plan — is the bug
  // this code exists to prevent: it would grant a tier nobody authorised, and
  // it would do so silently (AC US-1).
  ORG_PROVISIONING_UNAVAILABLE: {
    code: "ORG_PROVISIONING_UNAVAILABLE",
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: "ระบบยังเปิดร้านใหม่ไม่ได้ในขณะนี้ กรุณาติดต่อทีมงาน",
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
