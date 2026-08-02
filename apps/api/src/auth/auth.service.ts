// F-001 · T-001-07 — auth orchestration service. Ties hashing (T-001-03), JWT
// (T-001-04), refresh (T-001-05), throttle (T-001-06), policy (core-domain), and
// security events (T-001-08) into the endpoint behaviors (api-spec §2).
//
// Enumeration-safe by construction: unknown-email login does a dummy argon2
// verify (§9); wrong-password and unknown-email both return the identical
// INVALID_CREDENTIALS shape. Throttle is ALWAYS its own 429 (M-1), never folded
// into the 401.
import { Injectable } from "@nestjs/common";
import { ORG_TX_TIMEOUTS } from "@omnistock/config";
import {
  checkPasswordPolicy,
  normalizeEmail,
  isValidEmailShape,
  decideAdminReset,
  isAdminResetCallerAuthorized,
  type AdminResetDecision,
  type AdminResetInput,
  type AdminResetMembershipFacts,
  type AdminResetRefusal,
  type PasswordPolicyError,
} from "@omnistock/core-domain";
import { domainError } from "../common/domain-exception";
import { PrismaService } from "../prisma/prisma.service";
import type { SecurityEventType } from "./security-events.service";
import { HashingService } from "./hashing.service";
import { RefreshTokenService, type IssuedRefresh } from "./refresh-token.service";
import { AccessTokenService } from "./access-token.service";
import { SecurityEventsService } from "./security-events.service";
import { ThrottleService } from "./throttle.service";

// Password-policy codes ARE registry keys (PASSWORD_TOO_SHORT/LONG/BREACHED),
// so a policy failure maps 1:1 onto the central registry — same 422, same code,
// same Thai message that F-001 shipped.
function mapPolicyError(error: PasswordPolicyError): never {
  throw domainError(error);
}

// ── T-002-09 ★ admin-reset: the two fail-closed conditions ─────────────────
// architecture §3.3 · §15 row 1 · C-2/D-028 + NEW-1/D-030 + NEW-5(ก).

/**
 * Thrown INSIDE the admin-reset transaction purely to roll it back. It never
 * reaches the wire: `adminResetPassword` catches exactly this type and converts
 * it into the same 404 the endpoint has always returned. Anything else thrown in
 * there (a policy 422, a driver error) propagates untouched.
 */
class AdminResetRefusedRollback extends Error {
  constructor() {
    super("admin reset refused — rolling back");
    this.name = "AdminResetRefusedRollback";
  }
}

/**
 * Refusal → audit event (architecture §3.3, "แยกใบ"). Only the two policy
 * refusals get an event; "not a member" / "no capability" stay silent exactly as
 * F-001 shipped them, so holding a token is not a licence to write alerts into
 * another organization's audit trail.
 *
 * The two are separate event types on purpose: "an Admin tried to reset the shop
 * OWNER's password" is an account-takeover signal, not a side effect of the
 * multi-org policy, and an investigator must be able to tell them apart.
 */
const ADMIN_RESET_REFUSAL_EVENTS: Readonly<Partial<Record<AdminResetRefusal, SecurityEventType>>> =
  Object.freeze({
    target_active_in_other_org: "auth.password.admin_reset_blocked_multi_org",
    target_is_owner: "auth.password.admin_reset_blocked_owner_target",
  });

/**
 * `SET LOCAL lock_timeout` value for the admin-reset transaction. Read from
 * @omnistock/config (env-tunable, U-CFG-07) — never inlined, or the policy and
 * the behaviour drift. Validated as a positive integer because it is
 * interpolated into SQL (`SET LOCAL` takes no bind parameters), so a non-integer
 * would be both a policy error and an injection surface.
 */
function adminResetLockTimeoutMs(): number {
  const ms = ORG_TX_TIMEOUTS.lockTimeoutMs;
  if (!Number.isInteger(ms) || ms <= 0) {
    throw new Error(
      `ORG_TX_TIMEOUTS.lockTimeoutMs must be a positive integer (got ${String(ms)})`,
    );
  }
  return ms;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashing: HashingService,
    private readonly refresh: RefreshTokenService,
    private readonly accessTokens: AccessTokenService,
    private readonly securityEvents: SecurityEventsService,
    private readonly throttle: ThrottleService,
  ) {}

  private get db() {
    return this.prisma.client;
  }

  // ─── US-1 signup ───────────────────────────────────────────────────────────

  async signup(rawEmail: string, password: string): Promise<{ userId: string; email: string; verified: boolean }> {
    const email = normalizeEmail(rawEmail);
    if (!isValidEmailShape(email)) {
      throw domainError("EMAIL_INVALID");
    }
    const policy = checkPasswordPolicy(password);
    if (!policy.ok) mapPolicyError(policy.error);

    // Duplicate email is the one necessary enumeration leak (Gate 1 §4).
    const existing = await this.db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      throw domainError("EMAIL_TAKEN");
    }
    const passwordHash = await this.hashing.hash(password);
    const user = await this.db.user.create({
      data: { email, passwordHash, verified: false },
      select: { id: true, email: true, verified: true },
    });
    return { userId: user.id, email: user.email, verified: user.verified };
  }

  // ─── US-2 login ────────────────────────────────────────────────────────────

  /**
   * Verify credentials → issue tokens. Returns the access token + issued refresh
   * (the controller handles transport). Throttle is applied by the controller
   * BEFORE this (it must always be its own 429). This method records/clears the
   * account failure counter via the passed callbacks so timing stays uniform.
   */
  async login(
    rawEmail: string,
    password: string,
    deviceId: string | null,
    hooks: { onFailure: () => Promise<void>; onSuccess: () => Promise<void> },
  ): Promise<{ accessToken: string; issued: IssuedRefresh; expiresIn: number; userId: string }> {
    const email = normalizeEmail(rawEmail);
    const user = await this.db.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      // Unknown email: dummy argon2 verify so timing matches a real verify (§9),
      // then the SAME generic failure. Record the account failure (M-1: counter
      // keys on submitted email whether or not a user exists).
      await this.hashing.dummyVerify(password);
      await hooks.onFailure();
      throw domainError("INVALID_CREDENTIALS");
    }

    const ok = await this.hashing.verify(user.passwordHash, password);
    if (!ok) {
      await hooks.onFailure();
      throw domainError("INVALID_CREDENTIALS");
    }

    // Success — clear the account counter (self-heal) and rehash if params bumped.
    await hooks.onSuccess();
    if (this.hashing.needsRehash(user.passwordHash)) {
      const upgraded = await this.hashing.hash(password);
      await this.db.user.update({ where: { id: user.id }, data: { passwordHash: upgraded } });
    }

    const issued = await this.refresh.issueOnLogin(user.id, deviceId);
    const accessToken = this.accessTokens.sign(user.id);
    return { accessToken, issued, expiresIn: this.accessTokens.ttlSeconds, userId: user.id };
  }

  // ─── US-6 change-password ────────────────────────────────────────────────

  /**
   * Verify current password (throttled by the controller), enforce policy on
   * new, set the new hash, revoke all OTHER families (spare `spareFamilyId` when
   * resolvable — N-1), emit self_changed. Wrong current → generic 401.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    spareFamilyId: string | null,
    hooks: { onFailure: () => Promise<void>; onSuccess: () => Promise<void> },
  ): Promise<void> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    // A live Bearer should always resolve, but be defensive.
    if (!user) {
      await hooks.onFailure();
      throw domainError("INVALID_CREDENTIALS");
    }
    const ok = await this.hashing.verify(user.passwordHash, currentPassword);
    if (!ok) {
      await hooks.onFailure();
      throw domainError("INVALID_CREDENTIALS");
    }
    await hooks.onSuccess();

    const policy = checkPasswordPolicy(newPassword);
    if (!policy.ok) mapPolicyError(policy.error);

    const newHash = await this.hashing.hash(newPassword);
    await this.db.user.update({ where: { id: userId }, data: { passwordHash: newHash } });

    // Revoke other families; spare the current one when resolvable (N-1),
    // otherwise revoke ALL (safe-direction fallback).
    if (spareFamilyId) {
      await this.refresh.revokeAllExceptFamily(userId, spareFamilyId);
    } else {
      await this.refresh.revokeAllForUser(userId);
    }
    // Post-commit-ish (these updates have resolved) — F-005 seam.
    this.securityEvents.emit("auth.password.self_changed", { userId });
  }

  // ─── US-5 admin reset — FULL inline capability check (C-1, api-spec §2.8) ──
  // ─── + T-002-09 ★ C-2/D-028 · NEW-1/D-030 · NEW-5(ก), all in ONE tx ────────

  /**
   * Reset a member's password. Implements the FULL capability check INLINE (no
   * stub, no external guard), and since F-002 that check has FOUR conditions —
   * every one of which lands on the SAME-SHAPE 404 (never 403, never a
   * distinguishable body: no org-existence/status/capability/ownership oracle):
   *
   *   1. caller holds an ACTIVE Membership(orgId) with `manage_members` (F-001)
   *   2. target is an ACTIVE member of orgId (F-001, H-2)
   *   3. **C-2 / D-028** — target is NOT active in any OTHER organization.
   *      `User.passwordHash` is a GLOBAL credential; F-002 made "one person,
   *      many orgs" real, so without this an Admin of org B could reset the
   *      password of someone who is the Owner of org A and log in as them.
   *   4. **NEW-1 / D-030** — if the target is an Owner (`full_access`), the
   *      caller must hold `full_access` too. Condition 3 is INERT in the most
   *      common dogfood case (an Owner belonging to exactly one org), so
   *      without this the Owner-only rule is decoration: an Admin takes the
   *      shop over through the credential instead of through the role.
   *
   * **NEW-5(ก) — one transaction, checked twice.** The reads that decide and
   * the write that acts must not be able to disagree: the transaction opens by
   * taking `SELECT … FOR UPDATE` on the target `User` row (serializing
   * concurrent resets of the same person), every read goes through that same
   * `tx` (M-2 — never `this.db`), and the whole decision is re-evaluated AFTER
   * the write and BEFORE commit. A membership created in another org while we
   * were deciding therefore rolls the write back instead of slipping through.
   *
   * On success: set target hash, revoke ALL target families, clear the login
   * backoff, emit `admin_reset`. On a refusal the write never happens, sessions
   * are NOT revoked and the backoff is NOT cleared — otherwise a "blocked" 404
   * would still let an Admin kick the Owner out of every device on repeat (a
   * DoS the status code cannot see, U-API-07(ซ)).
   */
  /**
   * One membership, read as the pure decision fn wants it. Takes the client so
   * the SAME shape is read by the cheap pre-check (on `this.db`) and by the
   * authoritative reads inside the transaction (on `tx`) — two readers with
   * subtly different `select`s is how a decision starts disagreeing with itself.
   */
  private async readMembershipFacts(
    client: {
      membership: {
        findUnique: (args: {
          where: { organizationId_userId: { organizationId: string; userId: string } };
          select: { status: true; role: { select: { capabilities: true } } };
        }) => Promise<{ status: string; role: { capabilities: string[] } } | null>;
      };
    },
    organizationId: string,
    userId: string,
  ): Promise<AdminResetMembershipFacts> {
    const m = await client.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { status: true, role: { select: { capabilities: true } } },
    });
    return {
      status: (m?.status as AdminResetMembershipFacts["status"]) ?? null,
      capabilities: m?.role.capabilities ?? [],
    };
  }

  async adminResetPassword(
    callerUserId: string,
    orgId: string,
    targetUserId: string,
    newPassword: string,
  ): Promise<void> {
    // Carried out of the transaction callback in a box: the values must survive
    // the deliberate rollback, and TypeScript does not track assignments made
    // inside a callback.
    const outcome: { refused: AdminResetDecision | null; targetEmail: string | null } = {
      refused: null,
      targetEmail: null,
    };

    // (0) Password policy FIRST, before anything reads the database.
    //
    // It used to run after the decision, which made the 422 an oracle (security
    // review of f66451f, Medium-1): send a deliberately weak password, and a
    // 422 meant "this target was allowed" while a 404 meant "this target is an
    // Owner or belongs to another org" — the exact question the uniform 404
    // exists to refuse, answered for free, without touching the password and
    // (on the 422 branch) without emitting a single event.
    //
    // Moving it here costs nothing: `checkPasswordPolicy` is a pure fn with no
    // I/O, and the policy is already public through signup, so an unauthorized
    // caller learns nothing they could not learn by registering an account.
    // Now a weak password yields 422 for EVERY target, and a well-formed one
    // yields the uniform 404 for every refusal.
    const policy = checkPasswordPolicy(newPassword);
    if (!policy.ok) mapPolicyError(policy.error);

    // (0b) Gate the EXPENSIVE work on the caller, then hash OUTSIDE the
    // transaction (security review of f66451f, Medium-3).
    //
    // argon2 is 19 MiB / t=2 on node's 4-thread libuv pool, shared with every
    // login verify. Hashing inside the transaction meant a Postgres connection
    // sat idle-in-transaction — holding a `FOR UPDATE` lock on the target's
    // `User` row — for however long that queue took. Under a login flood that
    // is a self-inflicted lock-timeout (and, per §15 row 6b's gap, a 500).
    //
    // The property this must not lose is "an unauthorized caller cannot make us
    // burn an argon2 hash", so the caller is checked first — through the SAME
    // pure fn `decideAdminReset` uses, never a second copy. The target is NOT
    // decided here: those facts are the ones that must be read under the lock.
    const callerFacts = await this.readMembershipFacts(this.db, orgId, callerUserId);
    if (!isAdminResetCallerAuthorized(callerFacts)) {
      // Silent, exactly as F-001 shipped it: holding a token is not a licence to
      // write alerts into another organization's audit trail.
      throw domainError("NOT_FOUND");
    }
    const newHash = await this.hashing.hash(newPassword);

    try {
      await this.db.$transaction(
        async (tx) => {
          // (1) Serialize on the target's User row. `SET LOCAL` first so the
          // wait is bounded (and scoped to this transaction, so a pooled
          // connection never carries it to the next request).
          await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '${adminResetLockTimeoutMs()}ms'`);
          const locked = await tx.$queryRawUnsafe<Array<{ id: string; email: string }>>(
            'SELECT id, email FROM "User" WHERE id = $1 FOR UPDATE',
            targetUserId,
          );
          // FOR UPDATE on zero rows succeeds and locks NOTHING — that must read
          // as "no target", not as "locked".
          const targetUser = Array.isArray(locked) ? locked[0] : undefined;

          /** Every fact the decision needs, ALL read through `tx` (M-2). */
          const readFacts = async (): Promise<AdminResetInput> => {
            // Re-read the caller too, even though (0b) already checked them
            // outside the transaction: a membership revoked while we were
            // hashing must stop the write, and the pre-check is an optimisation,
            // never the authority.
            const caller = await this.readMembershipFacts(tx, orgId, callerUserId);
            const target = await this.readMembershipFacts(tx, orgId, targetUserId);
            // The ONE deliberately cross-org query in this file (C-2). It is
            // legal here because `auth/` is on the SYSTEM_PRISMA allowlist
            // (architecture §2.1) and because the whole point of the check is
            // "does this person exist outside the caller's tenant?" — a
            // question no org-scoped client can answer. It reads a COUNT only:
            // no id, name or email of another org ever leaves this scope.
            const targetActiveMembershipsInOtherOrgs = await tx.membership.count({
              where: { userId: targetUserId, status: "active", organizationId: { not: orgId } },
            });
            return {
              caller,
              target,
              targetActiveMembershipsInOtherOrgs,
              targetUserExists: targetUser !== undefined,
            };
          };

          // (2)+(3) Decide BEFORE any work — an unauthorized caller must not be
          // able to probe the password policy or burn an argon2 hash either.
          const before = decideAdminReset(await readFacts());
          if (!before.allowed) {
            outcome.refused = before;
            throw new AdminResetRefusedRollback();
          }

          // (4) Write. The hash was computed BEFORE the transaction opened —
          // see the comment at the `hashing.hash` call below for why.
          await tx.user.update({ where: { id: targetUserId }, data: { passwordHash: newHash } });

          // (5) Re-decide on freshly read facts before committing (NEW-5ก).
          // Read Committed gives each statement a new snapshot, so a membership
          // another transaction committed while we were hashing IS visible here
          // — and rolls this write back.
          const after = decideAdminReset(await readFacts());
          if (!after.allowed) {
            outcome.refused = after;
            throw new AdminResetRefusedRollback();
          }

          outcome.targetEmail = targetUser?.email ?? null;
        },
        { timeout: ORG_TX_TIMEOUTS.txTimeoutMs, maxWait: ORG_TX_TIMEOUTS.maxWaitMs },
      );
    } catch (err) {
      // Our own rollback signal is the ONLY thing swallowed here.
      if (!(err instanceof AdminResetRefusedRollback)) throw err;
    }

    const refused = outcome.refused;
    if (refused !== null) {
      // POST-COMMIT (here: post-ROLLBACK) — the block really happened, and the
      // payload is `{ actorUserId, orgId, targetUserId }`: no password, no hash,
      // no email. `SecurityEventsService` additionally filters these two event
      // types down to exactly those keys, so a future "just one debug field"
      // cannot leak either.
      for (const reason of refused.refusals) {
        const type = ADMIN_RESET_REFUSAL_EVENTS[reason];
        if (type) {
          this.securityEvents.emit(type, { actorUserId: callerUserId, orgId, targetUserId });
        }
      }
      // The SAME 404 as "user not found" — same code, same message, same
      // fields. Constructed at ONE place for all four refusals so the bodies
      // cannot drift apart into an oracle.
      throw domainError("NOT_FOUND");
    }

    const targetEmail = outcome.targetEmail;
    if (targetEmail === null) {
      // Unreachable: `targetUserExists` is part of the decision above.
      throw new Error("admin reset committed without a target email");
    }

    await this.refresh.revokeAllForUser(targetUserId);
    // Anti-lockout escape hatch (arch §8.2/§10, I5.4): a reset must clear the
    // target's login backoff so they can immediately sign in with the new
    // password even if they were mid-backoff. The login account counter keys on
    // the normalized email (throttle:acct:{emailNorm}, data-model §4).
    await this.throttle.clearAccount(normalizeEmail(targetEmail));
    this.securityEvents.emit("auth.password.admin_reset", {
      actorUserId: callerUserId,
      orgId,
      targetUserId,
    });
  }
}
