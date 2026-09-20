// F-002 · T-002-03 ★ — the organization serialization anchor + the tx/lock
// timeout policy. Authoritative spec: architecture.md §5 / §5.1 / §5.2,
// §12.2 row 6. Tests: org-lock.test.ts (unit — the merge-blocking layer) and
// org-lock.db.test.ts (I-C-13 — what Postgres actually does).
//
// WHY THIS FILE EXISTS
// "Owner ≥ 1" and "a revoked member cannot be resurrected by a concurrent
// accept" are CROSS-ROW invariants. Under Read Committed two transactions read
// different snapshots, both conclude "someone else is still an Owner" / "this
// membership is still active", and both commit — so the invariant is violated
// by two individually-correct requests (architecture §5, §5.1). No unique index
// or trigger can express a COUNT(*) ≥ 1 across rows.
//
// The mechanism is therefore: EVERY transaction that writes `Membership` or
// `Invitation` first takes `SELECT id FROM "Organization" … FOR UPDATE` on its
// own tenant row, then RE-READS every condition it decides on through that same
// `tx`. One anchor per tenant ⇒ those writes serialize; a uniform lock order
// (Organization first, always) ⇒ no cross-path deadlock; a row lock ⇒ other
// tenants are untouched.
//
// The anchor costs something: a request can now WAIT for a lock, and a waiting
// request holds a pooled DB connection. That is a cross-tenant availability
// risk (§5.2 "noisy neighbour"), so waiting is bounded by `SET LOCAL
// lock_timeout` and the transaction by Prisma's `timeout`/`maxWait` — and every
// resulting failure is mapped to a `409 CONFLICT` + `details.reason = "busy"`,
// never a 500 and never a new 503 on a LOCKED contract.
//
// NestJS/HTTP is deliberately absent (golden rule: `packages/db` is mechanism).
// This module produces a typed `OrgBusyError` that already carries the decided
// status/code/details; apps/api only renders it.
import { AsyncLocalStorage } from "node:async_hooks";
import { ORG_TX_TIMEOUTS } from "@omnistock/config";
import { MissingOrgContextError, OrgScopeViolationError, type OrgScopeContext } from "./tenancy";

// ── §12.2 row 6 — the operations that MUST take the anchor ─────────────────

/** One row of the register: an HTTP route and the service method behind it. */
export interface OrgLockRequiredOperation {
  /** Stable key used by logs/metrics (`org_tx_lock_timeout_total{operation}`). */
  readonly operationKey: string;
  readonly method: "POST" | "PATCH" | "DELETE";
  /** OpenAPI-style path, exactly as api-spec §3 writes it. */
  readonly path: string;
  /** `Service.method` that owns the transaction (qa greps call sites against this). */
  readonly serviceMethod: string;
}

/**
 * architecture §5 + §12.2 row 6 — the SINGLE source of "which operations grab
 * the org lock".
 *
 * ★ B-5 — this used to claim that "a new membership/invitation write that
 * forgets the anchor is a red test". It was not. The only thing enumerating
 * this list was a test asserting the list equals a literal copy of itself: it
 * pinned itself perfectly and pinned no code at all.
 *
 * What actually holds today, stated precisely so nobody relies on more:
 *   - `orgs/system/org-lock-callsites.test.ts` walks FROM this list TO the
 *     source: every `serviceMethod` must exist, and no listed service may open
 *     a bare `$transaction` (the shape that writes with no lock).
 *   - per-method tests cover the seven operations below individually.
 *
 * What is still NOT enforced: that `SET LOCAL lock_timeout` is the first
 * statement on the wire. That needs the running app and a driver spy — a
 * forward commitment, not a guarantee.
 *
 * It lives in `packages/db` (not apps/api) because the mechanism does: the list
 * and `lockCurrentOrganization` must never drift apart, and `packages/db` is the
 * one place both apps/api and its tests can import without a cycle.
 */
export const ORG_LOCK_REQUIRED_OPERATIONS: readonly OrgLockRequiredOperation[] = Object.freeze([
  Object.freeze({
    operationKey: "updateMemberRole",
    method: "PATCH",
    path: "/orgs/{orgId}/members/{userId}",
    serviceMethod: "MembersService.updateRole",
  }),
  Object.freeze({
    operationKey: "revokeMember",
    method: "DELETE",
    path: "/orgs/{orgId}/members/{userId}",
    serviceMethod: "MembersService.revoke",
  }),
  Object.freeze({
    operationKey: "leaveOrganization",
    method: "DELETE",
    path: "/orgs/{orgId}/membership",
    serviceMethod: "MembersService.leave",
  }),
  Object.freeze({
    operationKey: "acceptInvitation",
    method: "POST",
    path: "/invitations/accept",
    serviceMethod: "InvitationsService.accept",
  }),
  Object.freeze({
    operationKey: "createInvitation",
    method: "POST",
    path: "/orgs/{orgId}/invitations",
    serviceMethod: "InvitationsService.create",
  }),
  Object.freeze({
    operationKey: "reissueInvitationLink",
    method: "POST",
    path: "/orgs/{orgId}/invitations/{invitationId}/link",
    serviceMethod: "InvitationsService.reissueLink",
  }),
  Object.freeze({
    operationKey: "cancelInvitation",
    method: "DELETE",
    path: "/orgs/{orgId}/invitations/{invitationId}",
    serviceMethod: "InvitationsService.cancel",
  }),
] as const);

// ── org context (N-2) ──────────────────────────────────────────────────────

/**
 * The org context the lock reads from. `apps/api`'s `OrgContextMiddleware`
 * establishes it once per request (`runWithOrgContext`), exactly like it does
 * for `withOrgScope` — the point of N-2 is that NO caller hands this helper an
 * organizationId string it could get wrong: locking the wrong row is a silent
 * loss of the whole invariant (the write proceeds, unserialized).
 *
 * apps/api currently owns its own `OrgContextStore` (an AsyncLocalStorage of the
 * same value). Until its middleware also runs through `runWithOrgContext`, it
 * may pass its context explicitly — but only when no ALS context is established
 * here, and a disagreement between the two is refused rather than resolved.
 */
const orgContextStorage = new AsyncLocalStorage<OrgScopeContext>();

/** Binds `ctx` for the duration of `fn`'s async call tree. */
export function runWithOrgContext<T>(ctx: OrgScopeContext, fn: () => T): T {
  assertContextShape(ctx, "runWithOrgContext(ctx, …)");
  return orgContextStorage.run(Object.freeze({ ...ctx }), fn);
}

/** The current org context, or `undefined` when none is established. */
export function getOrgContext(): OrgScopeContext | undefined {
  return orgContextStorage.getStore();
}

// ── errors ─────────────────────────────────────────────────────────────────

/**
 * The helper was called on something that is not an interactive-transaction
 * client. A `FOR UPDATE` outside a transaction is released the moment the
 * statement ends, so the "lock" would be a no-op that reads as protection.
 */
export class OrgLockOutsideTransactionError extends Error {
  constructor(detail: string) {
    super(
      `lockCurrentOrganization must run inside an interactive transaction: ${detail}. A row lock taken ` +
        `outside a transaction is released immediately, so every invariant it is supposed to serialize ` +
        `(Owner ≥ 1, revoke ‖ accept) would silently go unprotected. Use runInOrgLockTransaction(...) ` +
        `or pass the \`tx\` from prisma.$transaction(async (tx) => …). See F-002 architecture §5.1.`,
    );
    this.name = "OrgLockOutsideTransactionError";
  }
}

/** An explicitly-passed context disagrees with the ambient one (N-2). */
export class OrgLockContextMismatchError extends Error {
  constructor(
    readonly contextOrganizationId: string,
    readonly passedOrganizationId: string,
  ) {
    super(
      `org lock context mismatch: the ambient organization is ${JSON.stringify(contextOrganizationId)} but ` +
        `${JSON.stringify(passedOrganizationId)} was passed. Locking a row other than the request's own tenant ` +
        `serializes nothing and would let the concurrent write it was meant to block through (N-2).`,
    );
    this.name = "OrgLockContextMismatchError";
  }
}

/** The tenant row we anchor on does not exist — nothing was actually locked. */
export class OrgLockAnchorMissingError extends Error {
  constructor(readonly organizationId: string) {
    super(
      `cannot take the org lock: organization ${JSON.stringify(organizationId)} does not exist. ` +
        `FOR UPDATE on zero rows succeeds and locks nothing, so the transaction would run unserialized — ` +
        `refused instead (F-002 architecture §5.1).`,
    );
    this.name = "OrgLockAnchorMissingError";
  }
}

// ── §5.2 — what lock contention becomes on the wire ────────────────────────

/** Why the transaction gave up. Kept for logs/metrics, never for the client. */
export type OrgBusyReason = "lock_timeout" | "deadlock" | "serialization" | "tx_timeout" | "pool_timeout";

/** §5.2: `409`, because every endpoint in the §5 list already declares 409.
 *  A `503` would add a status to a LOCKED contract. */
export const ORG_BUSY_HTTP_STATUS = 409;
/** The EXISTING registry code — §5.2 adds no new error code (U-API-15 stays 18). */
export const ORG_BUSY_ERROR_CODE = "CONFLICT";
/** The one thing that distinguishes it from an ordinary 409 (`details` is an
 *  optional field the envelope already has ⇒ purely additive). */
export const ORG_BUSY_DETAILS: Readonly<{ reason: "busy" }> = Object.freeze({ reason: "busy" });

/**
 * Lock contention, already decided as a wire outcome.
 *
 * `message` and `details` are FIXED, opaque strings: a SQLSTATE, a Prisma code,
 * a table or constraint name on the wire tells an attacker about our schema and
 * tells the user nothing (test-plan U-API-21(ก) / I-C-13(ก) assert their
 * absence). The real cause stays available for the server-side log through
 * `reason` / `diagnostic` / `cause`.
 */
export class OrgBusyError extends Error {
  readonly httpStatus = ORG_BUSY_HTTP_STATUS;
  readonly errorCode = ORG_BUSY_ERROR_CODE;
  readonly details = ORG_BUSY_DETAILS;
  /** `true` ⇒ log at `error` + bump the metric: §5.1's uniform lock order means
   *  a deadlock/serialization failure is a BUG (someone wrote a tx off-policy),
   *  not normal contention. */
  readonly alert: boolean;
  /** Log-only diagnostics — must never reach the response body. */
  readonly diagnostic: Readonly<{ sqlState?: string; prismaCode?: string }>;

  constructor(
    readonly reason: OrgBusyReason,
    diagnostic: { sqlState?: string; prismaCode?: string },
    /** `operationKey` from ORG_LOCK_REQUIRED_OPERATIONS, for the metric label. */
    readonly operation?: string,
    options?: { cause?: unknown },
  ) {
    super("busy: another request for this workspace is being processed — please try again");
    this.name = "OrgBusyError";
    this.alert = reason === "deadlock" || reason === "serialization";
    this.diagnostic = Object.freeze({ ...diagnostic });
    if (options && "cause" in options) (this as { cause?: unknown }).cause = options.cause;
  }
}

/** SQLSTATE → reason. These three are the only "the database made us stop"
 *  states this design can produce (§5.2 table). */
const SQLSTATE_REASON: Readonly<Record<string, OrgBusyReason>> = Object.freeze({
  "55P03": "lock_timeout", // lock_not_available — `SET LOCAL lock_timeout` fired
  "40P01": "deadlock", // deadlock_detected
  "40001": "serialization", // serialization_failure
});

/** Prisma error code → reason (only codes that MEAN contention/timeout). */
const PRISMA_CODE_REASON: Readonly<Record<string, OrgBusyReason>> = Object.freeze({
  P2034: "serialization", // "write conflict or deadlock"
  P2028: "tx_timeout", // interactive tx exceeded `timeout` (or could not start)
  P2024: "pool_timeout", // could not get a connection within `maxWait`/pool timeout
});

/**
 * Decide whether `error` is lock contention — and NOTHING else.
 *
 * Deliberately narrow. A `409 CONFLICT + retry` shown for a unique-constraint
 * violation, a missing row, or a plain bug would hide every real failure behind
 * "try again", which is worse than the 500 this policy replaces (U-API-21(ข)).
 * `P2010` (raw query failed) is only contention when its `meta.code` says so.
 */
export function classifyOrgLockError(error: unknown): OrgBusyReason | null {
  const { sqlState, prismaCode } = readErrorCodes(error);
  if (sqlState && SQLSTATE_REASON[sqlState]) return SQLSTATE_REASON[sqlState];
  if (prismaCode && PRISMA_CODE_REASON[prismaCode]) return PRISMA_CODE_REASON[prismaCode];
  return null;
}

/** `classifyOrgLockError` + packaging. Returns `null` for anything else — the
 *  caller must then rethrow the original error untouched. */
export function toOrgBusyError(error: unknown, operation?: string): OrgBusyError | null {
  const reason = classifyOrgLockError(error);
  if (!reason) return null;
  const { sqlState, prismaCode } = readErrorCodes(error);
  return new OrgBusyError(reason, { sqlState, prismaCode }, operation, { cause: error });
}

/**
 * Rethrow `error` as an `OrgBusyError` if it is contention; otherwise rethrow it
 * exactly as it was. Never returns — fail-loud is the point.
 */
export function rethrowOrgLockError(error: unknown, operation?: string): never {
  const busy = toOrgBusyError(error, operation);
  throw busy ?? error;
}

function readErrorCodes(error: unknown): { sqlState?: string; prismaCode?: string } {
  if (typeof error !== "object" || error === null) return {};
  const err = error as { code?: unknown; meta?: unknown; message?: unknown };

  const prismaCode = typeof err.code === "string" && /^P\d{4}$/.test(err.code) ? err.code : undefined;

  // Raw queries surface the real SQLSTATE in `meta.code` (probed against the
  // real Postgres: P2010 + meta.code = '55P03'). Some driver/engine paths only
  // put it in `code`, so accept that shape too.
  let sqlState: string | undefined;
  const metaCode = (err.meta as { code?: unknown } | undefined)?.code;
  if (typeof metaCode === "string") sqlState = metaCode;
  else if (typeof err.code === "string" && !prismaCode) sqlState = err.code;

  return { sqlState, prismaCode };
}

// ── the anchor ─────────────────────────────────────────────────────────────

/**
 * The minimum surface `lockCurrentOrganization` needs. Structural on purpose:
 * `Prisma.TransactionClient`, an extended client's tx, and a test double all
 * satisfy it, and `packages/db` stays free of a hard dependency on one client
 * flavour (the app's client is `$extends(ledgerGuardExtension)`).
 */
export interface OrgLockTransactionClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $executeRawUnsafe(query: string, ...values: any[]): PromiseLike<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $queryRawUnsafe(query: string, ...values: any[]): PromiseLike<unknown>;
}

/** Members Prisma REMOVES from an interactive-transaction client (verified
 *  against 5.22 at runtime). Seeing any of them means we are not in a tx. */
const NON_TX_MEMBERS = ["$transaction", "$connect", "$disconnect", "$extends", "$use"] as const;

/**
 * Take the org serialization anchor. MUST be the first statement of the
 * transaction (`runInOrgLockTransaction` guarantees it).
 *
 * `SET LOCAL lock_timeout` comes FIRST and inside the same transaction — the
 * order matters: without it the `FOR UPDATE` below would wait indefinitely,
 * holding a pooled connection, and the eventual failure would be Prisma's
 * ambiguous tx timeout instead of the mappable `55P03` (§5.2). `SET LOCAL` also
 * keeps the change scoped to this transaction, so a pooled connection never
 * carries it to the next request.
 *
 * @param tx  the interactive-transaction client (never a full client)
 * @param ctx optional bridge for a caller whose ALS lives elsewhere; the
 *            ambient context wins and a disagreement throws (N-2)
 */
export async function lockCurrentOrganization(
  tx: OrgLockTransactionClient,
  ctx?: OrgScopeContext,
): Promise<void> {
  const { organizationId } = resolveOrgContext(ctx);
  assertInsideTransaction(tx);

  const lockTimeoutMs = readLockTimeoutMs();
  // Not parameterizable: `SET LOCAL` takes no bind parameters. `lockTimeoutMs`
  // is proven to be a positive integer above, so nothing else can reach the SQL.
  await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '${lockTimeoutMs}ms'`);

  const rows = await tx.$queryRawUnsafe('SELECT id FROM "Organization" WHERE id = $1 FOR UPDATE', organizationId);
  // `FOR UPDATE` on zero rows succeeds and locks NOTHING — that must not read
  // as "locked". (An unknown result shape is left alone: a test double may
  // legitimately not model rows.)
  if (Array.isArray(rows) && rows.length === 0) throw new OrgLockAnchorMissingError(organizationId);
}

function resolveOrgContext(passed?: OrgScopeContext): OrgScopeContext {
  const ambient = getOrgContext();
  if (passed !== undefined && passed !== null) {
    assertContextShape(passed, "lockCurrentOrganization(tx, ctx)");
    if (ambient && ambient.organizationId !== passed.organizationId) {
      throw new OrgLockContextMismatchError(ambient.organizationId, passed.organizationId);
    }
  }
  const ctx = ambient ?? passed;
  if (!ctx || typeof ctx.organizationId !== "string" || ctx.organizationId.trim() === "") {
    throw new MissingOrgContextError("Organization", "lockCurrentOrganization");
  }
  return ctx;
}

/**
 * N-2 in one check: an `organizationId` may only arrive inside the request's
 * context object. A bare string is exactly the "caller passed the wrong org"
 * shape the rule exists to prevent, so it is refused loudly instead of used.
 */
function assertContextShape(ctx: unknown, where: string): asserts ctx is OrgScopeContext {
  if (typeof ctx === "string") {
    throw new OrgScopeViolationError(
      "Organization",
      "lockCurrentOrganization",
      `${where} received a bare organizationId string. The org is read from the request context, never from a ` +
        `caller-supplied id (N-2) — pass the context object (or establish it with runWithOrgContext)`,
    );
  }
  if (typeof ctx !== "object" || ctx === null || typeof (ctx as OrgScopeContext).organizationId !== "string") {
    throw new OrgScopeViolationError(
      "Organization",
      "lockCurrentOrganization",
      `${where} received something that is not an org context (expected { organizationId: string })`,
    );
  }
}

function assertInsideTransaction(tx: unknown): void {
  if (typeof tx !== "object" || tx === null) {
    throw new OrgLockOutsideTransactionError(`expected a transaction client, got ${typeof tx}`);
  }
  const present = NON_TX_MEMBERS.filter(
    (member) => typeof (tx as Record<string, unknown>)[member] === "function",
  );
  if (present.length > 0) {
    throw new OrgLockOutsideTransactionError(
      `the client passed still exposes ${present.join("/")}, which an interactive transaction client does not — ` +
        `this looks like the full PrismaClient`,
    );
  }
  const missing = (["$executeRawUnsafe", "$queryRawUnsafe"] as const).filter(
    (member) => typeof (tx as Record<string, unknown>)[member] !== "function",
  );
  if (missing.length > 0) {
    throw new OrgLockOutsideTransactionError(`the client passed has no ${missing.join("/")}`);
  }
}

function readLockTimeoutMs(): number {
  // U-CFG-07 / test-plan §19.1 item 11: the number lives in @omnistock/config
  // (env-tunable) — never inline here, or the policy and the behaviour drift and
  // I-C-13 has to wait the production 3 s on every run.
  const ms = ORG_TX_TIMEOUTS.lockTimeoutMs;
  if (!Number.isInteger(ms) || ms <= 0) {
    throw new Error(
      `ORG_TX_TIMEOUTS.lockTimeoutMs must be a positive integer (got ${String(ms)}) — it is interpolated into ` +
        `SET LOCAL lock_timeout, so a non-integer is both a policy error and an injection surface`,
    );
  }
  return ms;
}

// ── the transaction helper (so no call site can forget any of this) ────────

/** Any client that can open an interactive transaction. */
export interface OrgLockCapableClient {
  $transaction<R>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fn: (tx: any) => Promise<R>,
    options?: { timeout?: number; maxWait?: number; isolationLevel?: unknown },
  ): Promise<R>;
}

/** The tx type a given client hands its interactive-transaction callback. */
export type OrgLockTxOf<TClient> = TClient extends {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $transaction<R>(fn: (tx: infer TTx) => Promise<R>, options?: any): Promise<R>;
}
  ? TTx
  : never;

export interface OrgLockTransactionOptions {
  /** `operationKey` from ORG_LOCK_REQUIRED_OPERATIONS — used as the metric label. */
  operation?: string;
  /** Bridge for a caller whose ALS lives elsewhere (see `lockCurrentOrganization`). */
  ctx?: OrgScopeContext;
}

/**
 * Open the transaction every §5 operation must run in: the §5.2 timeouts are
 * applied for you, the anchor is taken as the first statement, and lock
 * contention comes back as an `OrgBusyError` (409/busy) instead of a 500.
 *
 * Three things are deliberately NOT left to the call site, because "remember
 * to…" is how each of them silently disappears in a refactor:
 *   1. `{ timeout, maxWait }` — a `$transaction` without them queues on the pool
 *      forever and turns one hot tenant into a whole-instance outage (§5.2).
 *   2. the anchor as the FIRST statement — taking it later means the reads that
 *      decide the write already happened on the unprotected snapshot (§5.1).
 *   3. the error mapping — an unmapped `55P03` is the 500 qa forbade (I-C-10).
 *
 * There is NO automatic retry: these writes have no `Idempotency-Key` until
 * F-011, so a silent retry could duplicate a real effect. Retrying is the
 * user's decision (§5.2).
 */
export async function runInOrgLockTransaction<TClient extends OrgLockCapableClient, R>(
  prisma: TClient,
  fn: (tx: OrgLockTxOf<TClient>) => Promise<R>,
  options: OrgLockTransactionOptions = {},
): Promise<R> {
  // Resolved BEFORE opening the transaction: no context means the request is
  // unscoped, and burning a pooled connection to discover that is pointless.
  const ctx = resolveOrgContext(options.ctx);

  try {
    return await prisma.$transaction(
      async (tx: OrgLockTxOf<TClient>) => {
        await lockCurrentOrganization(tx as unknown as OrgLockTransactionClient, ctx);
        return fn(tx);
      },
      { timeout: ORG_TX_TIMEOUTS.txTimeoutMs, maxWait: ORG_TX_TIMEOUTS.maxWaitMs },
    );
  } catch (error) {
    rethrowOrgLockError(error, options.operation);
  }
}
