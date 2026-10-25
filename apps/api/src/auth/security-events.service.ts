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
//
// F-003 · T-003-B16 ★ — +6 events (architecture §7 / §13.4), union = 25.
// `org.role.escalation_denied` is deduped on Redis (SR-12, fail-open) and can
// only be emitted through `emitEscalationDenied`.
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { createHash } from "node:crypto";
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

/**
 * F-003 events — EXACTLY the 6 rows of F-003 architecture §7, in table order.
 * Kept as its own list (F-002's 15 stay untouched — AC-9.4); the test pins it
 * with `toEqual` in order (U-API3-10) and the union at 25 (R3-01).
 */
export const F003_SECURITY_EVENT_TYPES = [
  "org.role.created",
  "org.role.updated",
  "org.role.deleted",
  // Deduped (SR-12) — only leaves through `emitEscalationDenied`.
  "org.role.escalation_denied",
  // refusal `target_not_proper_subset` on admin password reset.
  "auth.password.admin_reset_blocked_privilege",
  // D-035 — accept re-check of the inviter's authority failed (§6.1).
  "org.invitation.accept_blocked_inviter",
] as const;

/** Every event type the platform may emit today (F-001 + F-002 + F-003). */
export const SECURITY_EVENT_TYPES = [
  ...F001_SECURITY_EVENT_TYPES,
  ...F002_SECURITY_EVENT_TYPES,
  ...F003_SECURITY_EVENT_TYPES,
] as const;

export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[number];

/** The one event that is rate-limited per key before it leaves (arch §7 SR-12). */
export const ESCALATION_DENIED_EVENT = "org.role.escalation_denied" as const;

/** Types the plain {@link SecurityEventsService.emit} accepts — everything but
 *  the deduped one, so a call site cannot bypass the dedupe by accident. */
export type DirectSecurityEventType = Exclude<SecurityEventType, typeof ESCALATION_DENIED_EVENT>;

/**
 * The 8 write paths that run the escalation check and emit
 * `org.role.escalation_denied` on refusal (test-plan §5.3 — "8, not 6").
 * I3-49 asserts set-equality between this list and the operations the
 * decider spy sees on non-GET routes. Accept re-check and admin reset are NOT
 * here: they have their own events.
 */
export const ESCALATION_CHECKED_OPERATIONS = [
  "create_role",
  "update_role",
  "delete_role",
  "change_member_role",
  "remove_member",
  "invite_create",
  "invite_reissue",
  "invite_cancel",
] as const;
export type EscalationCheckedOperation = (typeof ESCALATION_CHECKED_OPERATIONS)[number];

/**
 * `reason` values of `escalation_denied` (arch §7). An OPEN set on the wire —
 * consumers must tolerate new values — but today the code produces exactly
 * these 4 (U-API3-12). `role_locked` only when the actor lacks `full_access`
 * (an Owner mis-clicking the Owner role is not an escalation signal).
 */
export const ESCALATION_DENIED_REASONS = [
  "exceeds_actor",
  "target_not_below_actor",
  "full_access_reserved",
  "role_locked",
] as const;
export type EscalationDeniedReason = (typeof ESCALATION_DENIED_REASONS)[number];

/** Payload a call site hands to {@link SecurityEventsService.emitEscalationDenied};
 *  `suppressedCount` is added by the service, never by the caller. */
export interface EscalationDeniedPayload {
  actorUserId: string;
  organizationId: string;
  roleId: string | null;
  targetUserId: string | null;
  operation: EscalationCheckedOperation;
  reason: EscalationDeniedReason;
  /** Target axis: `expand(target) \ expand(actor)` — may be empty on `equal`. */
  excessCapabilities: readonly string[];
}

/** Dedupe window (arch §7 SR-12: `SET NX EX 300`). */
export const ESCALATION_DEDUPE_WINDOW_SECONDS = 300;
/** How long an unreported suppression count waits for the next event. After
 *  this it is dropped — nobody tried again, so there is nothing to attach it to
 *  (the per-type suppressed metric already counted it). */
export const ESCALATION_SUPPRESSED_COUNTER_TTL_SECONDS = 24 * 60 * 60;
/** Redis key prefixes (greppable in redis-cli). */
/**
 * Hard deadline per dedupe round-trip (security review of B16, High). The auth
 * Redis connection is the shared one (`maxRetriesPerRequest: null` + offline
 * queue — BullMQ's requirement), so when Redis is down a command does not
 * reject: it waits in the offline queue indefinitely. A `catch` alone would
 * never fire and the event would be lost (breaks SR-12 fail-open) while any
 * caller awaiting it hangs. Every store call is therefore raced against this
 * deadline; losing the race counts as a Redis failure. 250 ms: well above a
 * healthy same-region round-trip, short enough to sit on a 403 path.
 */
export const ESCALATION_DEDUPE_TIMEOUT_MS = 250;
export const ESCALATION_DEDUPE_PREFIX = "secevt:dedupe:";
export const ESCALATION_SUPPRESSED_PREFIX = "secevt:suppressed:";

/**
 * The 4 Redis commands the dedupe needs. ioredis's `Redis` satisfies this
 * structurally (verified against its RedisCommander typings), so production
 * binds the shared connection and tests bind an in-memory fake with a clock.
 */
export interface EscalationDedupeStore {
  set(key: string, value: string, ex: "EX", seconds: number, nx: "NX"): Promise<"OK" | null>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  getdel(key: string): Promise<string | null>;
}

/** DI token for {@link EscalationDedupeStore} (bound to the auth Redis). */
export const SECURITY_EVENTS_DEDUPE_STORE = Symbol("SECURITY_EVENTS_DEDUPE_STORE");

/**
 * Documented payload keys per event (F-002 architecture §9 + the F-001 call
 * sites). Exported so tests assert against ONE source of truth instead of
 * re-declaring the table (test-plan §19.1 item 4).
 *
 * For the event types in {@link STRICT_PAYLOAD_EVENT_TYPES} this is not just
 * documentation — it is enforced: any key outside the list is dropped before
 * the event leaves this service.
 */
export const SECURITY_EVENT_PAYLOAD_KEYS: Readonly<Record<SecurityEventType, readonly string[]>> =
  Object.freeze({
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
    "org.member.left": ["userId", "organizationId", "roleId", "cancelledInvitationIds"],
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
    "auth.password.admin_reset_blocked_multi_org": ["actorUserId", "orgId", "targetUserId"],
    "auth.password.admin_reset_blocked_owner_target": ["actorUserId", "orgId", "targetUserId"],
    // ── F-003 §7 — ids + role name + capabilities only (AC-9.5: no email, no
    //    person's name; `name` here is the ROLE's name) ─────────────────────────
    "org.role.created": ["actorUserId", "organizationId", "roleId", "name", "capabilities"],
    // `before`/`after` are `{ name, capabilities }` — see NESTED_PAYLOAD_KEYS.
    "org.role.updated": [
      "actorUserId",
      "organizationId",
      "roleId",
      "before",
      "after",
      "affectedActiveMembers",
      "invitationsShortened",
    ],
    "org.role.deleted": ["actorUserId", "organizationId", "roleId", "name", "capabilities"],
    "org.role.escalation_denied": [
      "actorUserId",
      "organizationId",
      "roleId",
      "targetUserId",
      "operation",
      "reason",
      "excessCapabilities",
      "suppressedCount",
    ],
    "auth.password.admin_reset_blocked_privilege": ["actorUserId", "orgId", "targetUserId"],
    // `actorUserId` = the invitee; `reason` ∈ inviter_not_active |
    // inviter_not_authorized | inviter_exceeds (open set).
    "org.invitation.accept_blocked_inviter": [
      "actorUserId",
      "organizationId",
      "invitationId",
      "issuerUserId",
      "reason",
      "excessCapabilities",
    ],
  });

/**
 * Keys whose value is an OBJECT with its own allow-list (strict events only).
 * A value that is not a plain object is dropped whole — `before: "a@b.c"`
 * must not slip through because the top-level key was allowed.
 */
export const NESTED_PAYLOAD_KEYS: Readonly<
  Partial<Record<SecurityEventType, Readonly<Record<string, readonly string[]>>>>
> = Object.freeze({
  "org.role.updated": Object.freeze({
    before: ["name", "capabilities"],
    after: ["name", "capabilities"],
  }),
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
  // ★ A-10 — the invitation/membership families handle EMAIL ADDRESSES, and
  // they were relying on two things that are not enforcement: every call site
  // remembering `maskEmail`, and `REDACTED_PAYLOAD_KEYS` stripping a key
  // literally named `email`. The second does not strip `emailMasked` — rightly,
  // that is the key we mean to send — so a call site that put a FULL address
  // under `emailMasked` would pass every check. `org.tax_profile.*` is on this
  // list for exactly that shape of risk; these have it too.
  "org.invitation.created",
  "org.invitation.accepted",
  "org.invitation.link_reissued",
  "org.invitation.cancelled",
  "org.member.reactivated",
  // F-003 — all 6 (arch §13.4 "payload strict"). AC-9.5 is a compliance
  // promise (no email / person's name), so it is enforced here, not trusted to
  // each of the 8+ call sites.
  ...F003_SECURITY_EVENT_TYPES,
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
    const nestedAllowed = strict ? NESTED_PAYLOAD_KEYS[type]?.[key] : undefined;
    if (nestedAllowed) {
      if (!isPlainObject(value)) {
        dropped.push(key);
        continue;
      }
      const inner: Record<string, unknown> = {};
      for (const [innerKey, innerValue] of Object.entries(value)) {
        if (nestedAllowed.includes(innerKey)) inner[innerKey] = innerValue;
        else dropped.push(`${key}.${innerKey}`);
      }
      kept[key] = inner;
      continue;
    }
    kept[key] = value;
  }
  return { payload: kept, dropped };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Raced against a dedupe store call so a hung connection reads as a failure. */
class DedupeTimeoutError extends Error {
  constructor(step: string) {
    super(`dedupe ${step} exceeded ${ESCALATION_DEDUPE_TIMEOUT_MS}ms`);
    this.name = "DedupeTimeoutError";
  }
}

/**
 * Settles with `work` or rejects at {@link ESCALATION_DEDUPE_TIMEOUT_MS},
 * whichever is first. `Promise.race` keeps a handler on `work`, so a late
 * rejection after the deadline is not an unhandledRejection. The timer is
 * cleared on settle and unref'd so it never holds the process open.
 */
function withDedupeDeadline<T>(step: string, work: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DedupeTimeoutError(step)), ESCALATION_DEDUPE_TIMEOUT_MS);
    (timer as { unref?: () => void }).unref?.();
  });
  return Promise.race([work(), deadline]).finally(() => clearTimeout(timer));
}

/** Dedupe key tuple (arch §7): JSON-encoded so `null` ≠ `"null"` and no id can
 *  forge a delimiter, then hashed so the Redis key length is bounded. */
function escalationDedupeHash(p: EscalationDeniedPayload): string {
  const tuple = [p.actorUserId, p.organizationId, p.operation, p.reason, p.roleId, p.targetUserId];
  return createHash("sha256").update(JSON.stringify(tuple)).digest("hex");
}

@Injectable()
export class SecurityEventsService {
  private readonly logger = new Logger("SecurityEvents");
  /** In-process emitter — tests/other modules subscribe; F-005 replaces sink. */
  readonly emitter = new EventEmitter();
  /** `security_event_suppressed_total{type}` — per-process counter (arch §8). */
  private readonly suppressed = new Map<SecurityEventType, number>();
  private warnedUnwired = false;

  // ⚠️ explicit `@Inject` — `tsx` emits no design:paramtypes (see
  // org-rate-limit.guard.ts). `@Optional` so bare `new SecurityEventsService()`
  // (tests, log-only contexts) keeps working: no store = fail-open = every
  // escalation event emitted, exactly as when Redis is down.
  constructor(
    @Optional()
    @Inject(SECURITY_EVENTS_DEDUPE_STORE)
    private readonly dedupeStore?: EscalationDedupeStore,
  ) {}

  /**
   * Emit a security event. Callers MUST invoke this AFTER the relevant DB
   * transaction has committed (post-commit rule, H-3) so the event is never
   * lost with a rollback — and, just as important, so a rolled-back transaction
   * never emits an event claiming something happened.
   *
   * `org.role.escalation_denied` is not accepted here — use
   * {@link emitEscalationDenied}, which applies the SR-12 dedupe.
   */
  emit(type: DirectSecurityEventType, payload: Record<string, unknown>): void {
    // Runtime twin of the type-level exclusion: an `as any` / untyped JS caller
    // must not slip past the SR-12 dedupe. Fail loud — this is a programming
    // error at the call site, and a test on that path turns it red.
    if ((type as string) === ESCALATION_DENIED_EVENT) {
      throw new Error(
        `${ESCALATION_DENIED_EVENT} must be emitted via SecurityEventsService.emitEscalationDenied() (SR-12 dedupe)`,
      );
    }
    this.deliver(type, payload);
  }

  /**
   * Emit `org.role.escalation_denied`, deduped per key
   * `(actorUserId, organizationId, operation, reason, roleId, targetUserId)`
   * for {@link ESCALATION_DEDUPE_WINDOW_SECONDS} (arch §7 SR-12):
   *  - first in the window → emitted, carrying `suppressedCount` = how many
   *    were swallowed for this key in the previous window(s) (then reset);
   *  - repeat inside the window → NOT emitted, counter `INCR`, metric +1;
   *  - Redis error, Redis not answering within {@link ESCALATION_DEDUPE_TIMEOUT_MS}
   *    per step, or no store → emitted every time (fail-open: this is volume
   *    control on a log, losing volume beats losing the signal). Worst-case
   *    latency is 2 × the deadline (SET + GETDEL, or SET + INCR/EXPIRE).
   * Post-commit rule applies as for {@link emit}. Never throws on Redis
   * trouble — a refusal must stay a 403, not become a 500.
   */
  async emitEscalationDenied(payload: EscalationDeniedPayload): Promise<void> {
    const type = ESCALATION_DENIED_EVENT;
    const store = this.dedupeStore;
    if (!store) {
      if (!this.warnedUnwired) {
        this.warnedUnwired = true;
        this.logger.warn(`security_event_dedupe_unwired type=${type} — emitting every event`);
      }
      this.deliver(type, { ...payload, suppressedCount: 0 });
      return;
    }

    const hash = escalationDedupeHash(payload);
    let first: boolean;
    try {
      first =
        (await withDedupeDeadline("set", () =>
          store.set(
            `${ESCALATION_DEDUPE_PREFIX}${hash}`,
            "1",
            "EX",
            ESCALATION_DEDUPE_WINDOW_SECONDS,
            "NX",
          ),
        )) === "OK";
    } catch (err) {
      this.logger.warn(`security_event_dedupe_fail_open type=${type} step=set: ${String(err)}`);
      this.deliver(type, { ...payload, suppressedCount: 0 });
      return;
    }

    const counterKey = `${ESCALATION_SUPPRESSED_PREFIX}${hash}`;
    if (!first) {
      // Suppressed. NX already proved this key's signal went out in the
      // current window, so a counter failure only loses the tally.
      this.suppressed.set(type, (this.suppressed.get(type) ?? 0) + 1);
      this.logger.log(`metric security_event_suppressed_total type=${type} inc=1`);
      try {
        // One deadline for the pair: the whole suppressed path stays bounded.
        await withDedupeDeadline("incr", async () => {
          await store.incr(counterKey);
          await store.expire(counterKey, ESCALATION_SUPPRESSED_COUNTER_TTL_SECONDS);
        });
      } catch (err) {
        this.logger.warn(`security_event_dedupe_fail_open type=${type} step=incr: ${String(err)}`);
      }
      return;
    }

    let suppressedCount = 0;
    try {
      const raw = await withDedupeDeadline("getdel", () => store.getdel(counterKey));
      suppressedCount = raw === null ? 0 : Number(raw);
      if (!Number.isSafeInteger(suppressedCount) || suppressedCount < 0) suppressedCount = 0;
    } catch (err) {
      this.logger.warn(`security_event_dedupe_fail_open type=${type} step=getdel: ${String(err)}`);
    }
    this.deliver(type, { ...payload, suppressedCount });
  }

  /** `security_event_suppressed_total{type}` as seen by THIS process. */
  suppressedTotal(type: SecurityEventType): number {
    return this.suppressed.get(type) ?? 0;
  }

  private deliver(type: SecurityEventType, payload: Record<string, unknown>): void {
    const { payload: safePayload, dropped } = sanitizePayload(type, payload);
    if (dropped.length > 0) {
      // Key names only — never the values we just refused to emit.
      this.logger.warn(`security_event_payload_redacted type=${type} keys=${dropped.join(",")}`);
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
