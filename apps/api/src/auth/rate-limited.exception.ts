// F-001 · T-001-07 — the 429 RATE_LIMITED exception (arch §8, M-1). Always its
// own response with a Retry-After header, never folded into a 401.
//
// R1: now a `DomainException` (common/) so it flows through the central registry
// + filter like every other typed error. Wire behavior is unchanged — code
// `RATE_LIMITED`, status 429, message "รอสักครู่แล้วลองใหม่", and the
// `Retry-After` header (the handler ALSO sets it on the passthrough Response
// before throwing; the filter re-applies it from `responseHeaders` — same
// value, belt-and-braces).
import { DomainException } from "../common/domain-exception";
import { ERROR_CODES } from "../common/error-codes";

export class RateLimitedException extends DomainException {
  readonly retryAfter: number;
  constructor(retryAfter: number) {
    super(ERROR_CODES.RATE_LIMITED, {
      headers: { "Retry-After": String(retryAfter) },
    });
    this.retryAfter = retryAfter;
  }
}
