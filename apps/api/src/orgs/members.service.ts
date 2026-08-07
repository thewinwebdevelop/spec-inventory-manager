// F-002 · T-002-18 ★ — the membership endpoints (api-spec §3.7–§3.9 + §3.17).
//
// ── THE ONE INVARIANT THIS FILE EXISTS TO HOLD ─────────────────────────────
// An organization ALWAYS has at least one active Owner. It is a cross-row
// aggregate (`COUNT(active owners) ≥ 1`), so no unique index, CHECK or trigger
// can express it, and under Read Committed two individually-correct requests
// ("demote Owner A" ‖ "remove Owner B") each read a snapshot in which the other
// owner is still there — and both commit. The shop then has zero Owners, which
// in Phase 0 is unrecoverable: there is no back-office (F-085) and no
// "delete shop".
//
// The mechanism (architecture §5/§5.1), applied by EVERY mutating method below:
//
//   runInOrgLockTransaction(ORG_PRISMA, async (tx) => {
//     // ← `SET LOCAL lock_timeout` + `SELECT … FROM "Organization" … FOR UPDATE`
//     //   have already run as the FIRST statements of this transaction
//     … re-read EVERY fact the decision depends on, through `tx` …
//     … decide with the core-domain pure fns …
//     … write, through `tx` …
//   })
//
// M-2 IS NOT A STYLE RULE: every read that feeds a decision goes through `tx`.
// A single `this.prisma.…` inside one of these methods reads a snapshot the lock
// does not protect, and the bug comes back whole — as a test that passes most of
// the time. That is why `tx` is threaded explicitly into the private helpers and
// `this.prisma` appears in exactly one place in this file (the LIST, which takes
// no lock because it decides nothing).
//
// ── WHAT IS DELIBERATELY NOT HERE ──────────────────────────────────────────
//  * No capability check. `CapabilityGuard` did it from route metadata before
//    this service was reached (architecture §3.1) — a check the service performs
//    itself is a check the next endpoint forgets (I-2).
//  * No org id from the URL. It comes from the ALS context the guard chain tied
//    to a proven active membership; `ORG_PRISMA` applies it to every query.
//  * No retry on contention. These writes have no `Idempotency-Key` until F-011,
//    so a silent retry could duplicate a real effect. Contention surfaces as
//    `409 CONFLICT` + `details.reason="busy"` (§5.2) via `runInOrgLockTransaction`.
import { Inject, Injectable } from "@nestjs/common";
import {
  LastOwnerError,
  assertOwnerRemains,
  canAssignRole,
  isOwnerRole,
  toMemberRow,
  type MemberRow,
  type MembershipStatus,
  type OwnerChange,
  type OwnerMembership,
} from "@omnistock/core-domain";
import { domainError } from "../common";
import { paginate, type KeysetCursor } from "../common/cursor";
import { SecurityEventsService } from "../auth";
import {
  ORG_PRISMA,
  OrgContextStore,
  USER_SELECT,
  runInOrgLockTransaction,
  type OrgLockTx,
  type OrgScopedPrismaClient,
} from "../tenancy";

/** `?status=` on `GET /orgs/{orgId}/members`. `invited` is a dead state (§3.7). */
export type MemberListStatusFilter = "active" | "revoked" | "all";

export interface MemberListPage {
  readonly items: readonly MemberRow[];
  readonly nextCursor: string | null;
  /** Only when the caller asked with `?withTotal=true` (api-spec §1). */
  readonly total?: number;
}

/** `200` of `DELETE /orgs/{orgId}/members/{userId}` (api-spec §3.9). */
export interface RevokeMemberResult {
  readonly userId: string;
  readonly status: "revoked";
  readonly revokedAt: string;
  readonly cancelledInvitations: number;
}

/** `200` of `DELETE /orgs/{orgId}/membership` (api-spec §3.17). */
export interface LeaveOrgResult {
  readonly organizationId: string;
  readonly status: "revoked";
  readonly revokedAt: string;
  readonly cancelledInvitations: number;
}

/** The membership shape every decision below is made from — read through `tx`. */
const MEMBERSHIP_DECISION_SELECT = {
  id: true,
  userId: true,
  roleId: true,
  status: true,
  revokedAt: true,
  role: { select: { name: true, key: true, capabilities: true } },
  // `USER_SELECT` is the ONLY sanctioned projection of the org-agnostic `User`
  // (packages/db): it has no relation keys, so the "walk through User back down
  // into another org's rows" shape (NEW-8) cannot be written here.
  user: { select: USER_SELECT },
} as const;

// ── the projections, spelled out ───────────────────────────────────────────
//
// ⚠️ `findMany` on the `$extends`-ed (org-scoped) client resolves to `any` —
// Prisma's extended delegate types defeat the inference that works on the plain
// client. Left alone, every `.map()` below would silently be `any`, which on a
// response that carries email addresses is precisely the place not to have it.
// So each `findMany` result is ASSIGNED to an explicit row type: the select and
// the type sit next to each other, and adding a column to one without the other
// is a compile error rather than an extra field on the wire.

/** One row of `GET /orgs/{orgId}/members`, as selected below. */
interface MemberListRow {
  readonly id: string;
  readonly userId: string;
  readonly roleId: string;
  readonly status: string;
  readonly activatedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
  readonly role: { readonly name: string; readonly key: string | null; readonly capabilities: string[] };
  readonly user: { readonly email: string };
}

/** A membership whose CURRENT role holds `full_access` — any status (§5). */
interface OwnerCandidateRow {
  readonly userId: string;
  readonly status: string;
  readonly role: { readonly capabilities: string[] };
}

/** A pending invitation being cancelled alongside a revocation (I-1). */
interface PendingInvitationRow {
  readonly id: string;
}

@Injectable()
export class MembersService {
  // Explicit @Inject on every parameter — `tsx` emits no `design:paramtypes`,
  // so a type-only parameter resolves to `undefined` in production only.
  constructor(
    @Inject(ORG_PRISMA) private readonly prisma: OrgScopedPrismaClient,
    @Inject(OrgContextStore) private readonly store: OrgContextStore,
    @Inject(SecurityEventsService) private readonly events: SecurityEventsService,
  ) {}

  // ── §3.7 GET /orgs/{orgId}/members ───────────────────────────────────────

  /**
   * The member directory. `manage_members` (D-028/I-8/N-4) — this response
   * carries EVERY member's email address, which is PII under PDPA, and that is
   * why a read is capability-gated at all (NEW-3).
   *
   * No lock: it decides nothing and writes nothing, and locking reads is how a
   * list endpoint becomes a denial-of-service surface for its own tenant.
   */
  async list(input: {
    readonly status: MemberListStatusFilter;
    readonly limit: number;
    readonly cursor?: KeysetCursor;
    readonly withTotal: boolean;
  }): Promise<MemberListPage> {
    const viewerUserId = this.requireUserId();
    const { status, limit, cursor, withTotal } = input;

    // `invited` is a dead state (data-model §7): no production write path
    // produces it, so it is filtered OUT of `all` rather than shown as a row a
    // client would have to interpret. `?status=invited` is not an option at all.
    const statusFilter =
      status === "all"
        ? { status: { in: ["active", "revoked"] } }
        : { status };

    const where = {
      ...statusFilter,
      // Keyset predicate for the fixed `createdAt desc, id desc` sort (api-spec
      // §1). Offset pagination would skip and repeat rows as members are added
      // and removed under the reader.
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.createdAt) } },
              { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
            ],
          }
        : {}),
    };

    const rows: readonly MemberListRow[] = await this.prisma.membership.findMany({
      where,
      // `limit + 1` — the extra row is what makes `nextCursor: null` honest.
      take: limit + 1,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        userId: true,
        roleId: true,
        status: true,
        activatedAt: true,
        revokedAt: true,
        createdAt: true,
        role: { select: { name: true, key: true, capabilities: true } },
        user: { select: USER_SELECT },
      },
    });

    // `total` counts the SAME filter MINUS the cursor window — a total computed
    // with the cursor would shrink as the user pages, which is worse than not
    // having one at all.
    const total: number | undefined = withTotal
      ? await this.prisma.membership.count({ where: statusFilter })
      : undefined;

    const page = paginate(rows, limit, (row) => ({
      createdAt: row.createdAt.toISOString(),
      id: row.id,
    }));

    return {
      // ⛔ Projected FIELD BY FIELD through the pure mapper, never by spreading
      // the Prisma row: structural typing strips nothing at runtime, so a spread
      // would put whatever column is added next on the wire.
      items: page.items.map((row) =>
        toMemberRow({
          membership: {
            userId: row.userId,
            roleId: row.roleId,
            status: row.status as MembershipStatus,
            activatedAt: row.activatedAt,
            revokedAt: row.revokedAt,
            createdAt: row.createdAt,
          },
          role: { name: row.role.name, key: row.role.key, capabilities: row.role.capabilities },
          user: { email: row.user.email },
          viewerUserId,
        }),
      ),
      nextCursor: page.nextCursor,
      ...(total === undefined ? {} : { total }),
    };
  }

  // ── §3.8 PATCH /orgs/{orgId}/members/{userId} ────────────────────────────

  /**
   * Change a member's role.
   *
   * TRANSACTION (all of it under the org lock, all of it read through `tx`):
   *   1. the anchor                                     ← runInOrgLockTransaction
   *   2. re-read the TARGET membership       → not `active` ⇒ `404 NOT_FOUND`
   *      (this is the `PATCH ‖ DELETE` case, I-C-07: the target may have been
   *      revoked between the guard chain and this line)
   *   3. re-read the ACTOR's own role        → demoted mid-flight ⇒ `403`
   *   4. resolve the NEW role in THIS org    → not ours ⇒ `422 ROLE_INVALID`
   *   5. `canAssignRole`                     → false   ⇒ `403 FORBIDDEN`
   *   6. `assertOwnerRemains`                → throws  ⇒ `409 LAST_OWNER`
   *   7. write
   *   POST-COMMIT: `org.member.role_changed`
   *
   * Step 6 is what makes "two admins demoting two different Owners at the same
   * time" safe: both transactions want the same anchor, so the second one
   * evaluates the invariant on the state the first one COMMITTED.
   */
  async updateRole(input: {
    readonly targetUserId: string;
    readonly roleId: string;
  }): Promise<MemberRow> {
    const organizationId = this.requireOrganizationId();
    const actorUserId = this.requireUserId();

    const outcome = await runInOrgLockTransaction(
      this.prisma,
      async (tx) => {
        const target = await this.readActiveMembership(tx, input.targetUserId);
        // `404`, not `409`: from the caller's point of view there is no such
        // active member to change. api-spec §3.8 states this explicitly, and it
        // is the same answer a request that lost the `PATCH ‖ DELETE` race gets.
        if (!target) throw domainError("NOT_FOUND");

        const actorCapabilities = await this.readActorCapabilities(tx, actorUserId);

        // Scoped by `ORG_PRISMA`: a role id belonging to ANOTHER organization
        // does not exist for this query, so this read cannot return one — and
        // the `if` below is what turns that into a refusal.
        //
        // The previous wording here claimed cross-tenant role assignment was
        // "impossible by construction rather than by an `if`". Security review
        // B-1 showed that was false: the seam guards the `organizationId`
        // COLUMN and never looked at `data.roleId`, so a scoped write could
        // still attach another org's role — this read was simply the only
        // caller that happened not to. It is now true, but for a different
        // reason: `Membership.role` references `Role(organizationId, id)`, so
        // Postgres refuses the pair whatever any service forgets.
        //
        // A comment that overstates a guarantee is worse than none, because the
        // next reader stops checking.
        const newRole = await tx.role.findFirst({
          where: { id: input.roleId },
          select: { id: true, name: true, key: true, capabilities: true },
        });
        if (!newRole) throw domainError("ROLE_INVALID", { fieldErrors: { roleId: "บทบาทนี้ไม่ใช่บทบาทของร้านนี้" } });

        // C-1/D-028 — touching ownership in EITHER direction (granting
        // `full_access`, or modifying somebody who holds it) requires the actor
        // to hold `full_access` themselves. One pure fn, five call sites.
        const allowed = canAssignRole({
          actorCapabilities,
          targetIsOwner: isOwnerRole(target.role.capabilities),
          newRoleIsOwner: isOwnerRole(newRole.capabilities),
        });
        if (!allowed) throw domainError("FORBIDDEN");

        await this.assertOwnerRemainsInTx(tx, {
          kind: "role_change",
          userId: input.targetUserId,
          newRoleCapabilities: newRole.capabilities,
        });

        const updated = await tx.membership.update({
          where: { organizationId_userId: { organizationId, userId: input.targetUserId } },
          data: { roleId: newRole.id },
          select: {
            userId: true,
            roleId: true,
            status: true,
            activatedAt: true,
            revokedAt: true,
            createdAt: true,
            role: { select: { name: true, key: true, capabilities: true } },
            user: { select: USER_SELECT },
          },
        });

        return {
          fromRoleId: target.roleId,
          toRoleId: newRole.id,
          grantsFullAccess: isOwnerRole(newRole.capabilities),
          row: toMemberRow({
            membership: {
              userId: updated.userId,
              roleId: updated.roleId,
              status: updated.status as MembershipStatus,
              activatedAt: updated.activatedAt,
              revokedAt: updated.revokedAt,
              createdAt: updated.createdAt,
            },
            role: {
              name: updated.role.name,
              key: updated.role.key,
              capabilities: updated.role.capabilities,
            },
            user: { email: updated.user.email },
            viewerUserId: actorUserId,
          }),
        };
      },
      { operation: "updateMemberRole" },
    );

    // POST-COMMIT (H-3). `grantsFullAccess` is the whole reason this event has
    // its own field: promoting somebody to Owner is a privilege escalation, and
    // it must be greppable without joining back to the role table (§9).
    this.events.emit("org.member.role_changed", {
      actorUserId,
      organizationId,
      targetUserId: input.targetUserId,
      fromRoleId: outcome.fromRoleId,
      toRoleId: outcome.toRoleId,
      grantsFullAccess: outcome.grantsFullAccess,
    });

    return outcome.row;
  }

  // ── §3.9 DELETE /orgs/{orgId}/members/{userId} ───────────────────────────

  /**
   * Remove a member — SOFT (`status='revoked'`), never a delete: the row is
   * referenced by history and by the `revokedAt > tokenIssuedAt` rule that stops
   * a removed member walking back in with a link they kept (I-1).
   *
   * TRANSACTION: anchor → re-read target (`404` if not active — the `revoke ‖
   * revoke` case I-C-10, where exactly one request writes `revokedAt`) →
   * re-read actor → `canAssignRole` (removing an Owner needs `full_access`) →
   * `assertOwnerRemains` → write the revocation AND cancel that email's pending
   * invitations IN THE SAME TRANSACTION (I-1). POST-COMMIT: `org.member.revoked`.
   *
   * The invitation cancellation is not housekeeping: a pending invitation for a
   * person we just removed is a door back into the shop that nobody decided to
   * leave open. Doing it in another transaction would leave a window in which
   * the door exists — and if that second write failed, it would stay open.
   */
  async revoke(input: { readonly targetUserId: string }): Promise<RevokeMemberResult> {
    const organizationId = this.requireOrganizationId();
    const actorUserId = this.requireUserId();

    const outcome = await runInOrgLockTransaction(
      this.prisma,
      async (tx) => {
        const target = await this.readActiveMembership(tx, input.targetUserId);
        if (!target) throw domainError("NOT_FOUND");

        const actorCapabilities = await this.readActorCapabilities(tx, actorUserId);

        // `newRoleIsOwner: false` — a revoke grants nothing. What it can do is
        // REMOVE an Owner, which is the half of C-1 this argument pair covers.
        const allowed = canAssignRole({
          actorCapabilities,
          targetIsOwner: isOwnerRole(target.role.capabilities),
          newRoleIsOwner: false,
        });
        if (!allowed) throw domainError("FORBIDDEN");

        await this.assertOwnerRemainsInTx(tx, { kind: "revoke", userId: input.targetUserId });

        return this.writeRevocation(tx, {
          organizationId,
          targetUserId: input.targetUserId,
          email: target.user.email,
          roleId: target.roleId,
          revokedByUserId: actorUserId,
        });
      },
      { operation: "revokeMember" },
    );

    // POST-COMMIT. `cancelledInvitationIds` ties the audit line to I-1: it says
    // WHICH doors were closed, not merely that some were.
    this.events.emit("org.member.revoked", {
      actorUserId,
      organizationId,
      targetUserId: input.targetUserId,
      cancelledInvitationIds: outcome.cancelledInvitationIds,
    });

    return {
      userId: input.targetUserId,
      status: "revoked",
      revokedAt: outcome.revokedAt.toISOString(),
      cancelledInvitations: outcome.cancelledInvitationIds.length,
    };
  }

  // ── §3.17 DELETE /orgs/{orgId}/membership (D-029) ────────────────────────

  /**
   * Leave the shop voluntarily. Same MECHANICS as `revoke`, three deliberate
   * differences:
   *
   *  1. NO `userId` INPUT AT ALL. The target is `ctx.userId`, structurally —
   *     that is why the route needs no capability (D-029): there is no input a
   *     bug could point at somebody else. Relaxing `DELETE …/members/{userId}`
   *     when `userId === ctx.userId` would instead have produced a route whose
   *     required capability depends on a path value, which `CapabilityGuard`
   *     (metadata only, fail-closed) cannot decide — reopening C-1.
   *  2. NO `canAssignRole`. Leaving is not an act upon another person, so the
   *     Owner-only rule has nothing to protect here. An Owner MAY leave — as
   *     long as they are not the last one (rule 3).
   *  3. A DIFFERENT EVENT: `org.member.left`, never `org.member.revoked`.
   *     "The team walked out" and "the owner removed them" are different
   *     business AND security signals, and one event type cannot answer which
   *     happened afterwards (§9).
   *
   * The last-Owner rule still applies, so the only Owner of a shop cannot leave
   * it — a limitation recorded in api-spec §3.17 (promote somebody first).
   */
  async leave(): Promise<LeaveOrgResult> {
    const organizationId = this.requireOrganizationId();
    const actorUserId = this.requireUserId();

    const outcome = await runInOrgLockTransaction(
      this.prisma,
      async (tx) => {
        // Re-read INSIDE the tx: between the guard chain and this line the
        // caller may have been revoked (or have pressed the button twice). The
        // answer is `403 ORG_ACCESS_DENIED`, exactly what the guard would have
        // said one request later — never `404`, which on this route would leak
        // that the shop exists to somebody who is no longer in it.
        const self = await this.readActiveMembership(tx, actorUserId);
        if (!self) throw domainError("ORG_ACCESS_DENIED");

        await this.assertOwnerRemainsInTx(tx, { kind: "revoke", userId: actorUserId });

        const written = await this.writeRevocation(tx, {
          organizationId,
          targetUserId: actorUserId,
          email: self.user.email,
          roleId: self.roleId,
          // D-029 — self-revoke: the row records that they removed themselves.
          revokedByUserId: actorUserId,
        });
        return { ...written, roleId: self.roleId };
      },
      { operation: "leaveOrganization" },
    );

    this.events.emit("org.member.left", {
      userId: actorUserId,
      organizationId,
      roleId: outcome.roleId,
      cancelledInvitationIds: outcome.cancelledInvitationIds,
    });

    return {
      organizationId,
      status: "revoked",
      revokedAt: outcome.revokedAt.toISOString(),
      cancelledInvitations: outcome.cancelledInvitationIds.length,
    };
  }

  // ── internals — every one of them takes `tx` (M-2) ───────────────────────

  /**
   * The target's membership as it is RIGHT NOW, inside the locked transaction,
   * or `null` when it is not `active`.
   *
   * `findFirst` (not `findUnique`) so `withOrgScope` adds `organizationId` as an
   * ordinary filter: the row is only visible if it belongs to the request's
   * tenant, which makes "member of another shop with the same user id" return
   * nothing rather than a row we then have to remember to check.
   */
  private async readActiveMembership(tx: OrgLockTx, userId: string) {
    const membership = await tx.membership.findFirst({
      where: { userId },
      select: MEMBERSHIP_DECISION_SELECT,
    });
    // `invited` is a dead state and is treated exactly like `revoked`
    // (data-model §7): it must never be a usable membership.
    return membership && membership.status === "active" ? membership : null;
  }

  /**
   * The ACTOR's capabilities, re-read through `tx`.
   *
   * Not `ctx.capabilities`: that snapshot was taken by the middleware before the
   * lock existed, so a concurrent request that demoted the actor would not be
   * reflected in it and an Owner-only action could be authorized by a role its
   * holder no longer has. The guard already used the snapshot to answer "may you
   * be here at all"; this is the finer decision, and it belongs under the lock.
   */
  private async readActorCapabilities(tx: OrgLockTx, actorUserId: string): Promise<readonly string[]> {
    const actor = await this.readActiveMembership(tx, actorUserId);
    // Refused, not defaulted to `[]`: an actor whose membership vanished
    // mid-flight is a caller who no longer belongs here.
    if (!actor) throw domainError("ORG_ACCESS_DENIED");
    return actor.role.capabilities;
  }

  /**
   * `assertOwnerRemains` over the owners of THIS org, read through `tx`.
   *
   * The `where` selects memberships whose CURRENT role holds `full_access`, in
   * ANY status — the pure fn filters the statuses itself and needs the full set
   * to do it (a caller that pre-filtered to `active` would hide nothing, but a
   * caller that pre-filtered wrongly would hide the last Owner).
   */
  private async assertOwnerRemainsInTx(tx: OrgLockTx, change: OwnerChange): Promise<void> {
    const owners: readonly OwnerCandidateRow[] = await tx.membership.findMany({
      where: { role: { capabilities: { has: "full_access" } } },
      select: { userId: true, status: true, role: { select: { capabilities: true } } },
    });
    const input: readonly OwnerMembership[] = owners.map((row) => ({
      userId: row.userId,
      status: row.status as MembershipStatus,
      capabilities: row.role.capabilities,
    }));
    try {
      assertOwnerRemains({ owners: input, change });
    } catch (error) {
      // The pure fn throws its own typed error (it must not know about HTTP);
      // this is the ONE place it becomes a wire result.
      if (error instanceof LastOwnerError) throw domainError("LAST_OWNER");
      throw error;
    }
  }

  /**
   * The two writes that must be atomic (I-1): mark the membership revoked, and
   * cancel every `pending` invitation for that email in this org.
   *
   * The ids are collected BEFORE the update so the event can name them; both
   * statements run under the same anchor, so no concurrent invite can slip in
   * between them.
   */
  private async writeRevocation(
    tx: OrgLockTx,
    input: {
      readonly organizationId: string;
      readonly targetUserId: string;
      readonly email: string;
      readonly roleId: string;
      readonly revokedByUserId: string;
    },
  ): Promise<{ readonly revokedAt: Date; readonly cancelledInvitationIds: readonly string[] }> {
    const revokedAt = new Date();

    await tx.membership.update({
      where: {
        organizationId_userId: { organizationId: input.organizationId, userId: input.targetUserId },
      },
      data: { status: "revoked", revokedAt, revokedByUserId: input.revokedByUserId },
      select: { id: true },
    });

    // Emails are stored normalized (lowercase + trim); `User.email` is stored
    // the same way, so this is an equality match and not a case dance.
    const pending: readonly PendingInvitationRow[] = await tx.invitation.findMany({
      where: { email: input.email, status: "pending" },
      select: { id: true },
    });
    if (pending.length > 0) {
      await tx.invitation.updateMany({
        where: { id: { in: pending.map((row) => row.id) } },
        data: { status: "cancelled", cancelledAt: revokedAt },
      });
    }

    return { revokedAt, cancelledInvitationIds: pending.map((row) => row.id) };
  }

  private requireOrganizationId(): string {
    const ctx = this.store.get();
    // Unreachable through the guard chain: an org-scoped route only runs with
    // `orgOutcome === 'ok'`. Reaching here means the chain is mis-wired, which
    // is our bug — fail loud, never fall back to a path param.
    if (!ctx?.organizationId) throw domainError("INTERNAL");
    return ctx.organizationId;
  }

  private requireUserId(): string {
    const ctx = this.store.get();
    // An unattributable membership change is worse than a refused one: every
    // event below answers "who did this", and "someone" is not an answer.
    if (!ctx?.userId) throw domainError("INTERNAL");
    return ctx.userId;
  }
}
