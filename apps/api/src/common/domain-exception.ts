// R1 (refactor-plan §4) — the ONE typed exception for the wire (backend.md §3.5).
//
// A `DomainException` carries a registry entry (code + status + default message)
// plus optional `details` / `fieldErrors` / response headers. It EXTENDS Nest's
// `HttpException` on purpose:
//   1. its own `getResponse()` is already the envelope `{ error: { code, message } }`,
//      so even WITHOUT the global filter (e.g. the auth E2E test app, which wires
//      only ValidationPipe + cookie-parser) Nest's default handler emits the exact
//      same status + body F-001 shipped — the migration is wire-identical by
//      construction, and existing tests pass unchanged;
//   2. `instanceof HttpException`, `getStatus()`, `getResponse()` keep working for
//      any test/guard that inspects them.
// `DomainExceptionFilter` layers the optional `details` / `fieldErrors` / `traceId`
// fields + response headers on top when it IS registered.
import { HttpException } from "@nestjs/common";
import { ERROR_CODES, type ErrorCodeDef, type ErrorCodeKey } from "./error-codes";

/** The `error` object inside the envelope (traceId is added by the filter). */
export interface DomainErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  fieldErrors?: Record<string, string>;
}

export interface DomainExceptionOptions {
  /** Override the registry's default message (same status/code). */
  message?: string;
  /** Structured context for the client, e.g. `{ feature: "accounting" }`. */
  details?: Record<string, unknown>;
  /** Per-field validation messages (422 → maps onto a form). */
  fieldErrors?: Record<string, string>;
  /** Extra response headers the filter must set, e.g. `Retry-After`. */
  headers?: Record<string, string>;
}

export class DomainException extends HttpException {
  readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly fieldErrors?: Record<string, string>;
  /** Response headers the filter applies (e.g. `{ 'Retry-After': '30' }`). */
  readonly responseHeaders?: Record<string, string>;

  constructor(def: ErrorCodeDef, opts: DomainExceptionOptions = {}) {
    const message = opts.message ?? def.message;
    const errorBody: DomainErrorBody = { code: def.code, message };
    if (opts.details) errorBody.details = opts.details;
    if (opts.fieldErrors) errorBody.fieldErrors = opts.fieldErrors;
    // The HttpException response IS the envelope — so the default Nest handler
    // (no filter) already produces the shipped shape.
    super({ error: errorBody }, def.status);
    this.code = def.code;
    this.details = opts.details;
    this.fieldErrors = opts.fieldErrors;
    this.responseHeaders = opts.headers;
  }
}

/**
 * Ergonomic factory: `throw domainError("EMAIL_TAKEN")` or
 * `throw domainError("PASSWORD_TOO_SHORT", { message })`. `key` is a registry
 * key (compile-time checked), so a typo cannot ship a bogus code.
 */
export function domainError(key: ErrorCodeKey, opts?: DomainExceptionOptions): DomainException {
  return new DomainException(ERROR_CODES[key], opts);
}
