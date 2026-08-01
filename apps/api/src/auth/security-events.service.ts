// F-001 · T-001-08 — security event emission (F-005 seam). arch §3.3/§10.
// F-002 · T-002-12 ★ — union extended with the 15 F-002 events (F-002
// architecture §9 / §15 row 4). Transport is UNCHANGED on purpose: the
// in-process EventEmitter below is the test sink @qa asked for (test-plan
// §19.1 item 3 / architecture §12.2 item 3).
//
// Emits security events for F-005 audit-log to consume. This module does NOT
// store or route them (F-005 owns consumption); it only EMITS, and every event
// MUST be emitted POST-COMMIT so a rollback can never swallow it (H-3) — a
// rolled-back transaction must leave no trace saying it happened.
//
// MVP transport: a structured log line + an in-process EventEmitter other
// modules/tests can spy on (`collectSecurityEvents`). F-005 later swaps the
// sink (outbox/queue) without changing the call sites.
import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter } from "node:events";

/** F-001 events (shipped). Do not rename — F-005/audit greps these strings. */
export const F001_SECURITY_EVENT_TYPES = [
  "auth.refresh.reuse_detected",
  "auth.password.admin_reset",
  "auth.password.self_changed",
  "auth.throttle.fail_open",
] as const;

/**
 * F-002 events — EXACTLY the 15 rows of F-002 architecture §9, in table order.
 * Adding/removing a row here must be a deliberate, reviewed act: the unit test
 * pins the count at 15 (qa U-API-16) so a silent drift goes red.
 */
export const F002_SECURITY_EVENT_TYPES = [
  "org.created",
  "org.invitation.created",
  "org.invitation.link_reissued",
  "org.invitation.cancelled",
  "org.invitation.accepted",
  "org.member.reactivated",
  "org.member.role_changed",
  "org.member.revoked",
  // D-029 — leaving voluntarily is NOT being revoked; separate signal.
  "org.member.left",
  "org.tax_profile.set",
  // D-030 / ux Q7+Q13 — who looked at the owner's tax id, and when.
  "org.tax_profile.revealed",
  "org.access.denied",
  "org.access.capability_denied",
  // C-2 — admin reset refused because the target belongs to several orgs.
  "auth.password.admin_reset_blocked_multi_org",
  // NEW-1 / D-030 — deliberately a DIFFERENT event from the multi-org one:
  // "someone tried to reset the shop owner's password" is an account-takeover
  // signal, not a side effect of the multi-org policy.
  "auth.password.admin_reset_blocked_owner_target",
] as const;

/** Every event type the platform may emit today (F-001 + F-002). */
export const SECURITY_EVENT_TYPES = [
  ...F001_SECURITY_EVENT_TYPES,
  ...F002_SECURITY_EVENT_TYPES,
] as const;

export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[number];

/**
 * Documented payload keys per event (F-002 architecture §9 + the F-001 call
 * sites). Exported so tests assert against ONE source of truth instead of
 * re-declaring the table (test-plan §19.1 item 4).
 *
 * For the event types in {@link STRICT_PAYLOAD_EVENT_TYPES} this is not just
 * documentation — it is enforced: any key outside the list is dropped before
 * the event leaves this service.
 */
export const SECURITY_EVENT_PAYLOAD_KEYS: Readonly<
  Record<SecurityEventType, readonly string[]>
> = Object.freeze({
  // ── F-001 ────────────────────────────────────────────────────────────────
  "auth.refresh.reuse_detected": ["userId", "familyId", "deviceId"],
  "auth.password.admin_reset": ["actorUserId", "orgId", "targetUserId"],
  "auth.password.self_changed": ["userId"],
  "auth.throttle.fail_open": ["ip"],
  // ── F-002 §9 ─────────────────────────────────────────────────────────────
  "org.created": ["actorUserId", "organizationId", "planKey"],
  "org.invitation.created": [
    "actorUserId",
    "organizationId",
    "emailMasked",
    "roleId",
    "invitationId",
  ],
  "org.invitation.link_reissued": ["actorUserId", "organizationId", "invitationId"],
  "org.invitation.cancelled": ["actorUserId", "organizationId", "invitationId"],
  "org.invitation.accepted": [
    "userId",
    "organizationId",
    "invitationId",
    "roleId",
    "acceptedByUserId",
    "userCreatedAt",
    "userCreatedAfterTokenIssued",
  ],
  "org.member.reactivated": [
    "userId",
    "organizationId",
    "invitationId",
    "roleId",
    "previousRevokedAt",
  ],
  "org.member.role_changed": [
    "actorUserId",
    "organizationId",
    "targetUserId",
    "fromRoleId",
    "toRoleId",
    "grantsFullAccess",
  ],
  "org.member.revoked": [
    "actorUserId",
    "organizationId",
    "targetUserId",
    "cancelledInvitationIds",
  ],
  "org.member.left": [
    "userId",
    "organizationId",
    "roleId",
    "cancelledInvitationIds",
  ],
  // M-7ค — `taxIdPresent: true` ONLY. Never the tax id, not even partially.
  "org.tax_profile.set": [
    "actorUserId",
    "organizationId",
    "taxEntityType",
    "vatRegistered",
    "taxIdPresent",
  ],
  // D-030 — who revealed it; the value itself never enters the audit trail.
  "org.tax_profile.revealed": ["actorUserId", "organizationId"],
  "org.access.denied": ["userId", "organizationId", "reason"],
  "org.access.capability_denied": [
    "userId",
    "organizationId",
    "route",
    "requiredCapability",
    "reason",
  ],
  "auth.password.admin_reset_blocked_multi_org": [
    "actorUserId",
    "orgId",
    "targetUserId",
  ],
  "auth.password.admin_reset_blocked_owner_target": [
    "actorUserId",
    "orgId",
    "targetUserId",
  ],
});

/**
 * Events whose payload is filtered to {@link SECURITY_EVENT_PAYLOAD_KEYS} —
 * anything else is dropped. These are the two families where a leaked field is
 * a security incident, not a formatting bug:
 *  - `org.tax_profile.*` must never carry the TIN, whole or masked (M-7ค).
 *  - `auth.password.admin_reset_blocked_*` must never carry a password/hash.
 * Enforced by construction so a future call site cannot regress it by adding
 * "just one debug field".
 */
export const STRICT_PAYLOAD_EVENT_TYPES: readonly SecurityEventType[] = Object.freeze([
  "org.tax_profile.set",
  "org.tax_profile.revealed",
  "auth.password.admin_reset_blocked_multi_org",
  "auth.password.admin_reset_blocked_owner_target",
]);

/**
 * Keys that must never reach an audit sink from ANY event — matched by exact
 * (case-insensitive) key name, never by substring, so legitimate fields like
 * `userCreatedAfterTokenIssued` / `invitationId` are untouched.
 * `email` is here because invitation events carry `emailMasked` only.
 */
export const REDACTED_PAYLOAD_KEYS: readonly string[] = Object.freeze([
  "email",
  "password",
  "newpassword",
  "currentpassword",
  "passwordhash",
  "hash",
  "secret",
  "token",
  "rawtoken",
  "tokenhash",
  "accesstoken",
  "refreshtoken",
  "taxid",
  "taxidmasked",
  "nationalid",
]);

export interface SecurityEvent {
  type: SecurityEventType;
  /** Event-specific payload — see {@link SECURITY_EVENT_PAYLOAD_KEYS}. */
  payload: Record<string, unknown>;
  /** Emission time (epoch ms). */
  at: number;
}

/** Sanitize a payload: drop secret-named keys everywhere, and for the strict
 *  families keep ONLY the documented keys. Returns the kept payload plus the
 *  names (never values) of what was dropped, for the warning log. */
function sanitizePayload(
  type: SecurityEventType,
  payload: Record<string, unknown>,
): { payload: Record<string, unknown>; dropped: string[] } {
  const strict = STRICT_PAYLOAD_EVENT_TYPES.includes(type);
  const allowed = SECURITY_EVENT_PAYLOAD_KEYS[type];
  const kept: Record<string, unknown> = {};
  const dropped: string[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (REDACTED_PAYLOAD_KEYS.includes(key.toLowerCase())) {
      dropped.push(key);
      continue;
    }
    if (strict && !allowed.includes(key)) {
      dropped.push(key);
      continue;
    }
    kept[key] = value;
  }
  return { payload: kept, dropped };
}

@Injectable()
export class SecurityEventsService {
  private readonly logger = new Logger("SecurityEvents");
  /** In-process emitter — tests/other modules subscribe; F-005 replaces sink. */
  readonly emitter = new EventEmitter();

  /**
   * Emit a security event. Callers MUST invoke this AFTER the relevant DB
   * transaction has committed (post-commit rule, H-3) so the event is never
   * lost with a rollback — and, just as important, so a rolled-back transaction
   * never emits an event claiming something happened.
   */
  emit(type: SecurityEventType, payload: Record<string, unknown>): void {
    const { payload: safePayload, dropped } = sanitizePayload(type, payload);
    if (dropped.length > 0) {
      // Key names only — never the values we just refused to emit.
      this.logger.warn(
        `security_event_payload_redacted type=${type} keys=${dropped.join(",")}`,
      );
    }
    const event: SecurityEvent = { type, payload: safePayload, at: Date.now() };
    // Structured log (F-005 / observability). Distinct, greppable signal.
    this.logger.log(`${type} ${JSON.stringify(safePayload)}`);
    this.emitter.emit(type, event);
    this.emitter.emit("*", event);
  }
}

/** Handle returned by {@link collectSecurityEvents}. */
export interface SecurityEventCollector {
  /** Events captured so far, in emission order. */
  readonly events: SecurityEvent[];
  /** Only the events of one type. */
  ofType(type: SecurityEventType): SecurityEvent[];
  /** Types captured so far, in emission order (handy for `toEqual([...])`). */
  types(): SecurityEventType[];
  /** Forget everything captured so far (per-case reset). */
  clear(): void;
  /** Unsubscribe — call in `afterEach` so suites don't leak listeners. */
  stop(): void;
}

/**
 * Subscribe to every security event a service emits and collect them for
 * assertions (test-plan §19.1 item 3 — the test sink). Works with the Nest
 * provider (`app.get(SecurityEventsService)`) or a bare instance.
 *
 * ```ts
 * const sink = collectSecurityEvents(app.get(SecurityEventsService));
 * // …act…
 * expect(sink.types()).toEqual(["org.created"]);
 * ```
 */
export function collectSecurityEvents(
  source: Pick<SecurityEventsService, "emitter">,
): SecurityEventCollector {
  const events: SecurityEvent[] = [];
  const listener = (event: SecurityEvent): void => {
    events.push(event);
  };
  source.emitter.on("*", listener);
  return {
    events,
    ofType: (type) => events.filter((e) => e.type === type),
    types: () => events.map((e) => e.type),
    clear: () => {
      events.length = 0;
    },
    stop: () => {
      source.emitter.off("*", listener);
    },
  };
}
