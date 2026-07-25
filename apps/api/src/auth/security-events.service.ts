// F-001 · T-001-08 — security event emission (F-005 seam). arch §3.3/§10.
// Emits auth security events for F-005 audit-log to consume. F-001 does NOT
// store or route them (F-005 owns consumption); it only EMITS, and the critical
// events (reuse_detected, admin_reset, self_changed, fail_open) are emitted
// POST-COMMIT so a rollback can never swallow them (H-3).
//
// MVP transport: a structured log line + an in-process EventEmitter other
// modules/tests can spy on. F-005 later swaps the sink (outbox/queue) without
// changing the call sites.
import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter } from "node:events";

export type SecurityEventType =
  | "auth.refresh.reuse_detected"
  | "auth.password.admin_reset"
  | "auth.password.self_changed"
  | "auth.throttle.fail_open";

export interface SecurityEvent {
  type: SecurityEventType;
  /** Event-specific payload (userId, familyId, deviceId, actorUserId, …). */
  payload: Record<string, unknown>;
  /** Emission time (epoch ms). */
  at: number;
}

@Injectable()
export class SecurityEventsService {
  private readonly logger = new Logger("SecurityEvents");
  /** In-process emitter — tests/other modules subscribe; F-005 replaces sink. */
  readonly emitter = new EventEmitter();

  /**
   * Emit a security event. Callers MUST invoke this AFTER the relevant DB
   * transaction has committed (post-commit rule, H-3) so the event is never
   * lost with a rollback.
   */
  emit(type: SecurityEventType, payload: Record<string, unknown>): void {
    const event: SecurityEvent = { type, payload, at: Date.now() };
    // Structured log (F-005 / observability). Distinct, greppable signal.
    this.logger.log(`${type} ${JSON.stringify(payload)}`);
    this.emitter.emit(type, event);
    this.emitter.emit("*", event);
  }
}
