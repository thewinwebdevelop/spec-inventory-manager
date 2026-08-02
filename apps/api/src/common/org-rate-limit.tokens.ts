// F-002 · T-002-14 — DI seams for `OrgRateLimitGuard`.
//
// Both exist for the same reason `CAPABILITY_EVENT_SINK` does: this guard lives
// in `common/`, and `common/` may not import a feature module (depcruise
// `api-leafward-only`). The Redis connection and `SecurityEventsService` both
// live behind that line, so the composition root injects them.
import { Injectable, Logger } from "@nestjs/common";

/** The Redis connection the guard counts in. */
export const ORG_RATE_LIMIT_REDIS = Symbol("ORG_RATE_LIMIT_REDIS");

/**
 * Emitted when Redis is unreachable and the guard let the request through
 * (architecture §8). Reuses the event F-001 already defined for exactly this
 * situation — a second "we stopped rate limiting" event type would split the
 * one signal an operator greps for across two strings.
 */
export const ORG_RATE_LIMIT_FAIL_OPEN_EVENT = "auth.throttle.fail_open" as const;

/**
 * Minimal emit port, structurally satisfied by `SecurityEventsService.emit`.
 * Binding the real one is
 * `{ provide: ORG_RATE_LIMIT_EVENT_SINK, useExisting: SecurityEventsService }`.
 */
export interface RateLimitEventSink {
  emit(type: typeof ORG_RATE_LIMIT_FAIL_OPEN_EVENT, payload: Record<string, unknown>): void;
}

/** DI token for {@link RateLimitEventSink}. */
export const ORG_RATE_LIMIT_EVENT_SINK = Symbol("ORG_RATE_LIMIT_EVENT_SINK");

/**
 * Optional token the composition root binds to the real `SecurityEventsService`.
 * Separate from the token above for the same reason `CAPABILITY_EVENT_SINK` has
 * an override twin: a provider supplied through a dynamic module does NOT
 * override the module's own static provider for the same token, so re-providing
 * it would compile, look right, and silently keep the log-only fallback.
 */
export const ORG_RATE_LIMIT_EVENT_SINK_OVERRIDE = Symbol("ORG_RATE_LIMIT_EVENT_SINK_OVERRIDE");

/**
 * Fallback sink: logs in the same `"<type> <json>"` shape
 * `SecurityEventsService` writes, so an operator greps one string either way.
 * Not a silent no-op — "we stopped enforcing quotas" is precisely the event
 * nobody may lose.
 */
@Injectable()
export class LoggingRateLimitEventSink implements RateLimitEventSink {
  private readonly logger = new Logger("SecurityEvents");

  emit(type: typeof ORG_RATE_LIMIT_FAIL_OPEN_EVENT, payload: Record<string, unknown>): void {
    this.logger.log(`${type} ${JSON.stringify(payload)}`);
  }
}
