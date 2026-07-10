// F-001 · T-001-07 — the 429 RATE_LIMITED exception (arch §8, M-1). Always its
// own response with a Retry-After header, never folded into a 401. The handler
// sets `Retry-After` on the (passthrough) Response before throwing; this carries
// the seconds too for any filter that wants it.
import { HttpException, HttpStatus } from "@nestjs/common";

export class RateLimitedException extends HttpException {
  readonly retryAfter: number;
  constructor(retryAfter: number) {
    super(
      { error: { code: "RATE_LIMITED", message: "รอสักครู่แล้วลองใหม่" } },
      HttpStatus.TOO_MANY_REQUESTS,
    );
    this.retryAfter = retryAfter;
  }
}
