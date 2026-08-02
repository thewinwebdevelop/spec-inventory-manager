// F-002 · T-002-05 ★ — the seam through which `CapabilityGuard` reports a denial.
//
// WHY A PORT INSTEAD OF INJECTING `SecurityEventsService` DIRECTLY: the boundary
// gate (packages/config/depcruise/.dependency-cruiser.api.cjs, rule
// `api-leafward-only`) forbids `common/` from importing a feature module, and
// `SecurityEventsService` lives in `auth/`. Dependencies point leaf-ward only.
//
// ⚠️ What must NOT happen here is a SECOND emitter: two sinks means @qa's
// `collectSecurityEvents(app)` subscribes to one of them and silently misses the
// other. So this file declares a token + interface only, and the composition
// root binds the real service to it. Until it does, the default below still
// writes the same greppable log line the real service writes, so the signal
// exists from day one instead of being a promise.
import { Injectable, Logger } from "@nestjs/common";

/** The one event this layer emits (F-002 architecture §9, already in the registry). */
export const CAPABILITY_DENIED_EVENT = "org.access.capability_denied" as const;

/**
 * Minimal emit port. Structurally satisfied by `SecurityEventsService.emit`, so
 * binding the real one is `{ provide: CAPABILITY_EVENT_SINK, useExisting: SecurityEventsService }`
 * — no adapter class, no duplicated payload rules.
 */
export interface CapabilityEventSink {
  emit(type: typeof CAPABILITY_DENIED_EVENT, payload: Record<string, unknown>): void;
}

/** DI token for {@link CapabilityEventSink}. */
export const CAPABILITY_EVENT_SINK = Symbol("CAPABILITY_EVENT_SINK");

/**
 * Optional token the composition root binds to the REAL sink
 * (`SecurityEventsService`) — see `TenancyModule.withCapabilityEventSink`.
 *
 * ⚠️ Why a second token instead of just re-providing `CAPABILITY_EVENT_SINK`:
 * a provider supplied through a dynamic module does NOT override the module's
 * own static provider for the same token — Nest keeps the static one. Doing it
 * that way looks correct, compiles, and silently keeps the log-only default;
 * the app would have shipped with the audit trail half missing and every test
 * green. So the override is its own token and the default provider explicitly
 * asks for it.
 */
export const CAPABILITY_EVENT_SINK_OVERRIDE = Symbol("CAPABILITY_EVENT_SINK_OVERRIDE");

/**
 * Default binding: log-only, in the same `"<type> <json>"` shape
 * `SecurityEventsService` uses, so an operator greps one string either way.
 * It is not a silent no-op on purpose — a denial that nothing records is a
 * denial nobody can investigate.
 */
@Injectable()
export class LoggingCapabilityEventSink implements CapabilityEventSink {
  private readonly logger = new Logger("SecurityEvents");

  emit(type: typeof CAPABILITY_DENIED_EVENT, payload: Record<string, unknown>): void {
    this.logger.log(`${type} ${JSON.stringify(payload)}`);
  }
}
