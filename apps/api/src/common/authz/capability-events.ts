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

/** Capability layer: "you are a member, but you may not do THIS" (§9). */
export const CAPABILITY_DENIED_EVENT = "org.access.capability_denied" as const;

/**
 * Tenancy layer: "you are not an active member of this org at all" (§9).
 *
 * Added after the security review of f66451f (Medium): §9 registered this event
 * and `SecurityEventsService` declared its payload rule, but **nothing emitted
 * it**. `OrgScopeGuard` threw `ORG_ACCESS_DENIED` / `ORG_MISMATCH` with no
 * signal at all, so F-002's headline insider-probing question — "is someone
 * walking organizations they don't belong to?" — had no answer in the audit
 * trail. Only the narrower capability denial did.
 *
 * It rides the same sink as the capability event rather than getting its own
 * port: two ports would mean two things to bind, and forgetting one is exactly
 * the silent-evidence-loss failure this seam exists to prevent.
 */
export const ORG_ACCESS_DENIED_EVENT = "org.access.denied" as const;

/** Access denials this seam carries. */
export type AccessDenialEvent = typeof CAPABILITY_DENIED_EVENT | typeof ORG_ACCESS_DENIED_EVENT;

/**
 * Minimal emit port. Structurally satisfied by `SecurityEventsService.emit`, so
 * binding the real one is `{ provide: CAPABILITY_EVENT_SINK, useExisting: SecurityEventsService }`
 * — no adapter class, no duplicated payload rules.
 */
export interface CapabilityEventSink {
  emit(type: AccessDenialEvent, payload: Record<string, unknown>): void;
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

  emit(type: AccessDenialEvent, payload: Record<string, unknown>): void {
    this.logger.log(`${type} ${JSON.stringify(payload)}`);
  }
}
