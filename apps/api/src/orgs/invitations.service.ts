// F-002 · T-002-19 ★ — the org side of invitations (api-spec §3.10–§3.13).
//
// ── WHAT THE RAW TOKEN IS ──────────────────────────────────────────────────
// It is a bearer credential for MEMBERSHIP of a shop. D-012 says we do not send
// email in Phase 0: the inviter copies the link and delivers it themselves, so
// the token travels through channels we neither see nor control. Two properties
// follow, and both are enforced here rather than trusted:
//
//   * it is returned to the caller EXACTLY ONCE, at creation and at reissue.
//     `Invitation` stores only `tokenHash` (D-018), so "resend the same link"
//     is not merely unimplemented — it is unimplementable, which is the point.
//   * rotating it invalidates the previous one IMMEDIATELY. The old hash is
//     overwritten, so the old link stops resolving on the next request.
//
// ── WHY REISSUE GOES THROUGH `canAssignRole` (NEW-2) ───────────────────────
// D-027 made reissue restart the clock. Without an Owner-only check on THIS
// route, anybody holding `manage_members` could take an Owner invitation and
// mint an unlimited series of fresh Owner links — copying the key to the Owner
// door as often as they liked — while `POST /invitations` correctly refused
// them. The rule is not "who may create", it is "who may hand out"; both
// answers must be the same answer, so both call the same pure function.
//
// ── EVERY MUTATION TAKES THE ORG LOCK ──────────────────────────────────────
// Same discipline as `members.service.ts`: `runInOrgLockTransaction` first, then
// re-read every fact through `tx`, then decide, then write. `this.prisma`
// appears once in this file — the LIST, which decides nothing.
import { Inject, Injectable } from "@nestjs/common";
import {
  canAcceptInvitation,
  canAssignRole,
  invitationTtlHours,
  invitationExpiryFrom,
  isOwnerRole,
  isValidEmailShape,
  maskEmail,
  normalizeEmail,
  resolveInvitationStatus,
  toInvitationPreview,
  toInvitationAcceptResult,
  toInvitationRow,
  userCreatedAfterTokenIssued,
  type AcceptInvitationDecision,
  type InvitationPreview,
  type InvitationAcceptResult,
  type InvitationRow,
  type MembershipStatus,
  type StoredInvitationStatus,
} from "@omnistock/core-domain";
import { generateInvitationToken, hashInvitationToken } from "../prisma/invitation-token";
import { domainError, type ErrorCodeKey } from "../common";
import { paginate, type KeysetCursor } from "../common/cursor";
import { SecurityEventsService } from "../auth";
import {
  ORG_PRISMA,
  OrgContextStore,
  runInOrgLockTransaction,
  type OrgLockTx,
  type OrgScopedPrismaClient,
} from "../tenancy";
import { INVITATION_PENDING_CAP, WEB_APP_BASE_URL } from "./org-config";
import { InvitationLookupService } from "./system/invitation-lookup.service";

/** What the caller gets back once, and only once. */
export interface IssuedInvitation {
  readonly invitation: InvitationRow;
  readonly token: string;
  readonly inviteUrl: string;
}

export interface ReissuedLink {
  readonly token: string;
  readonly inviteUrl: string;
  readonly expiresAt: string;
  readonly tokenIssuedAt: string;
  readonly rotated: true;
}

/**
 * Field message for an address that is not an address (★ A-2). Thai, and
 * deliberately says nothing about the value itself — this string reaches an
 * error envelope, and the value is the PII the mask exists to protect.
 */
const EMAIL_INVALID_MESSAGE = "รูปแบบอีเมลไม่ถูกต้อง";

/** Role columns every decision here needs. */
const ROLE_SELECT = { id: true, name: true, key: true, capabilities: true } as const;

/** Invitation columns the wire projection needs — deliberately NOT `tokenHash`. */
const INVITATION_SELECT = {
  id: true,
  email: true,
  roleId: true,
  status: true,
  expiresAt: true,
  tokenIssuedAt: true,
  invitedByUserId: true,
  createdAt: true,
  acceptedAt: true,
  acceptedByUserId: true,
  acceptedUserCreatedAt: true,
  role: { select: { name: true, key: true } },
} as const;

interface InvitationSelected {
  id: string;
  email: string;
  roleId: string;
  status: string;
  expiresAt: Date;
  tokenIssuedAt: Date;
  invitedByUserId: string | null;
  createdAt: Date;
  acceptedAt: Date | null;
  acceptedByUserId: string | null;
  acceptedUserCreatedAt: Date | null;
  role: { name: string; key: string | null };
}

/**
 * ★ A-4 — `?status=` → a Prisma predicate, in the SAME terms
 * `resolveInvitationStatus` decides in.
 *
 * `expired` is never written to the column, so filtering on it directly asked
 * for a value no row can hold: `?status=expired` returned an empty page
 * forever, and `?status=pending` returned dead links as live ones. The two
 * halves have to be translations of one rule:
 *
 *   pending   → stored `pending` AND not yet past `expiresAt`
 *   expired   → stored `pending` AND at or past `expiresAt`  (`<=`, the safe side)
 *   accepted  → stored `accepted`   (terminal — the clock cannot un-happen it)
 *   cancelled → stored `cancelled`  (terminal, likewise)
 *
 * An unrecognised value falls through to no filter rather than to an empty
 * page: the enum is validated at the controller, and answering "nothing here"
 * to a question we did not understand is exactly how A-4 read to a shop owner.
 */
function invitationStatusFilter(status: string | undefined, now: Date): Record<string, unknown> {
  switch (status) {
    case "pending":
      return { status: "pending", expiresAt: { gt: now } };
    case "expired":
      return { status: "pending", expiresAt: { lte: now } };
    case "accepted":
    case "cancelled":
      return { status };
    default:
      return {};
  }
}

/**
 * ★ A-4 — `now` is required, because `status` on the wire is DERIVED.
 *
 * `expired` is computed at read time and has no write path
 * (core-domain/orgs/invitation-status.ts). This used to cast the stored column
 * straight onto the resolved type, so a `pending` row whose `expiresAt` had
 * passed reported itself as live — on the one screen where an Owner sees which
 * membership credentials are still outstanding.
 *
 * `now` is a parameter rather than `new Date()` inside, so the boundary
 * (`expiresAt <= now` is already expired) stays testable to the millisecond,
 * and so one listing cannot resolve two rows against two different clocks.
 */
function toRow(row: InvitationSelected, now: Date): InvitationRow {
  return toInvitationRow(
    {
      id: row.id,
      email: row.email,
      roleId: row.roleId,
      status: resolveInvitationStatus(
        { status: row.status as StoredInvitationStatus, expiresAt: row.expiresAt },
        now,
      ),
      expiresAt: row.expiresAt,
      tokenIssuedAt: row.tokenIssuedAt,
      invitedByUserId: row.invitedByUserId ?? "",
      createdAt: row.createdAt,
      acceptedAt: row.acceptedAt,
      acceptedByUserId: row.acceptedByUserId,
      acceptedUserCreatedAt: row.acceptedUserCreatedAt,
    },
    row.role,
  );
}

// ── T-002-20: redemption ────────────────────────────────────────────────────

/**
 * Preview: a resolved status that is not `pending` → its wire code
 * (api-spec §3.14). Exhaustive over the three non-pending values, so a fourth
 * resolved status could not be added to core-domain without a compile error
 * here — silently answering 200 for it is the failure this type prevents.
 */
const PREVIEW_STATUS_ERRORS = Object.freeze({
  expired: "INVITATION_EXPIRED",
  cancelled: "INVITATION_CANCELLED",
  accepted: "INVITATION_ALREADY_ACCEPTED",
} as const satisfies Record<"expired" | "cancelled" | "accepted", ErrorCodeKey>);

/** Every way `accept` can refuse. `invalid`/`email_mismatch` are the two the
 *  pure fn does not answer (a missing row; the authenticated identity). */
type AcceptRefusal = AcceptInvitationDecision | "invalid" | "email_mismatch";

/**
 * Refusal → wire code (api-spec §3.15/§4). Written as a total map rather than a
 * `switch` with a `default`: a new decision value in core-domain must be given
 * an answer here, and the compiler asks for it.
 *
 * `ok` maps to `INTERNAL` because reaching this table with `ok` means the
 * success path returned a refusal — a bug, and one that must not be rendered as
 * a plausible 409.
 */
const ACCEPT_REFUSAL_ERRORS = Object.freeze({
  ok: "INTERNAL",
  invalid: "INVITATION_INVALID",
  expired: "INVITATION_EXPIRED",
  cancelled: "INVITATION_CANCELLED",
  already_accepted: "INVITATION_ALREADY_ACCEPTED",
  email_mismatch: "INVITATION_EMAIL_MISMATCH",
  role_unavailable: "INVITATION_ROLE_UNAVAILABLE",
  already_member: "ALREADY_MEMBER",
  superseded: "INVITATION_SUPERSEDED",
} as const satisfies Record<AcceptRefusal, ErrorCodeKey>);

/** The invitation columns the accept decision is made from — read through `tx`. */
interface AcceptInvitationRow {
  readonly id: string;
  readonly email: string;
  readonly roleId: string;
  readonly status: string;
  readonly expiresAt: Date;
  readonly tokenIssuedAt: Date;
}

/** The caller's membership in the invitation's org, as it is inside the lock. */
interface AcceptorMembershipRow {
  readonly id: string;
  readonly status: string;
  readonly revokedAt: Date | null;
  readonly roleId: string;
}

/**
 * What the transaction returns. A refusal is RETURNED, not thrown, for one
 * reason that matters: `already_member` has to COMMIT a write (closing the
 * invitation, I-9) before the caller is told "no", and a `throw` would roll it
 * back. Returning them all keeps one mapping site instead of two.
 */
type AcceptOutcome =
  | {
      readonly kind: "ok";
      readonly invitationId: string;
      readonly tokenIssuedAt: Date;
      readonly organization: { readonly id: string; readonly name: string };
      readonly role: { readonly id: string; readonly name: string; readonly key: string | null };
      /** `revokedAt` of the membership this accept woke up, or `null`. */
      readonly reactivatedFrom: Date | null;
    }
  | { readonly kind: "refused"; readonly decision: AcceptRefusal; readonly emailMasked?: string };

const REFUSED_INVALID: AcceptOutcome = Object.freeze({ kind: "refused", decision: "invalid" });

@Injectable()
export class InvitationsService {
  constructor(
    @Inject(ORG_PRISMA) private readonly prisma: OrgScopedPrismaClient,
    @Inject(OrgContextStore) private readonly store: OrgContextStore,
    @Inject(SecurityEventsService) private readonly events: SecurityEventsService,
    @Inject(INVITATION_PENDING_CAP) private readonly pendingCap: number,
    @Inject(WEB_APP_BASE_URL) private readonly webAppBaseUrl: string,
    // T-002-20 — the ONLY way this service can reach a row before it knows which
    // tenant it belongs to. Injected rather than reached for directly: the
    // unfiltered client stays behind the `system/` boundary (§2.4).
    @Inject(InvitationLookupService) private readonly lookup: InvitationLookupService,
  ) {}

  // ── §3.10 list ───────────────────────────────────────────────────────────

  /**
   * No lock: this decides nothing. It IS capability-gated (`manage_members`)
   * because every row carries somebody else's email address — the same PDPA
   * reason `GET /members` is gated (D-028/I-8).
   */
  async list(input: {
    readonly status?: string;
    readonly cursor?: KeysetCursor;
    readonly limit: number;
  }): Promise<{ items: readonly InvitationRow[]; nextCursor: string | null }> {
    // ONE clock for the whole page: the filter and the rendered `status` must
    // agree, and reading `new Date()` twice could put a row on the boundary in
    // one and not the other.
    const now = new Date();
    const where = {
      ...invitationStatusFilter(input.status, now),
      // Keyset predicate for the fixed `createdAt desc, id desc` sort (§1).
      // Offset pagination would skip and repeat rows as invitations are created
      // and cancelled under the reader.
      ...(input.cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(input.cursor.createdAt) } },
              { createdAt: new Date(input.cursor.createdAt), id: { lt: input.cursor.id } },
            ],
          }
        : {}),
    };

    const rows = (await this.prisma.invitation.findMany({
      where,
      // `limit + 1` — the extra row is what makes `nextCursor: null` honest.
      take: input.limit + 1,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: INVITATION_SELECT,
    })) as InvitationSelected[];

    const page = paginate(rows, input.limit, (row) => ({
      createdAt: row.createdAt.toISOString(),
      id: row.id,
    }));
    return { items: page.items.map((row) => toRow(row, now)), nextCursor: page.nextCursor };
  }

  // ── §3.11 create ─────────────────────────────────────────────────────────

  async create(input: { readonly email: string; readonly roleId: string; readonly now: Date }): Promise<IssuedInvitation> {
    const organizationId = this.requireOrganizationId();
    const actorUserId = this.requireUserId();
    // Normalized SERVER-side (api-spec §3.11): the partial unique index that
    // enforces "one pending invitation per (org, email)" compares raw strings,
    // so " New@Example.com " and "new@example.com" must already be the same
    // value before it ever sees them.
    const email = normalizeEmail(input.email);

    // ★ A-2 — masked BEFORE the transaction, not after it.
    //
    // The audit event (post-commit, below) needs a masked address, and
    // `maskEmail` throws on anything it cannot split into a local part and a
    // domain. Computing it there meant an address like `not-an-email` COMMITTED
    // a pending invitation and only then threw, surfacing as `500 INTERNAL`
    // with a live row left behind: that address became permanently
    // un-invitable (`409 INVITATION_PENDING` on every retry, for the whole
    // TTL) and it consumed one of the shop's 100 pending slots. At 30
    // creates/hour, a `manage_members` holder could exhaust the cap in about
    // four hours while every response looked like a server fault.
    //
    // Ordering is the fix, not the validation. A guard alone would leave the
    // same landmine armed for the next address `maskEmail` refuses; deriving
    // the value first makes "committed but unmaskable" unreachable, because
    // nothing is committed until the value exists.
    //
    // The guard is `isValidEmailShape` — the SAME check signup applies
    // (auth.service.ts) rather than "whatever `maskEmail` happens to tolerate".
    // `maskEmail` accepts `a@b`, which signup rejects, so an address that can
    // never become an account could be invited: an invitation nobody is able
    // to redeem, holding one of the 100 pending slots until it expires. One
    // definition of "an address" across both paths, or the two disagree about
    // who can exist.
    if (!isValidEmailShape(email)) {
      // The caller's input, so 422 — never 500. `fieldErrors.email` puts the
      // message on the field the invite form can focus (api-spec §4).
      throw domainError("VALIDATION_FAILED", {
        fieldErrors: { email: EMAIL_INVALID_MESSAGE },
      });
    }
    const emailMasked = maskEmail(email);

    const created = await runInOrgLockTransaction(
      this.prisma,
      async (tx) => {
        const role = await this.readRole(tx, input.roleId);
        const actorCapabilities = await this.readActorCapabilities(tx, actorUserId);

        // C-1/D-028 — inviting somebody AS an Owner is granting Owner.
        const allowed = canAssignRole({
          actorCapabilities,
          targetIsOwner: false,
          newRoleIsOwner: isOwnerRole(role.capabilities),
        });
        if (!allowed) throw domainError("FORBIDDEN");

        await this.assertNotAlreadyMember(tx, email);
        await this.assertNoPendingInvitation(tx, email);
        await this.assertPendingCapNotReached(tx, input.now);

        const token = generateInvitationToken();
        // TTL by ROLE, always recomputed — 24h for an elevated role, 7 days
        // otherwise (D-028/I-7). Never a constant at the call site: the UI is
        // required to read `expiresAt` rather than print "7 days".
        const expiresAt = invitationExpiryFrom(input.now, invitationTtlHours(role.capabilities));

        const row = (await tx.invitation.create({
          data: {
            organizationId,
            email,
            roleId: role.id,
            status: "pending",
            tokenHash: hashInvitationToken(token),
            tokenIssuedAt: input.now,
            expiresAt,
            invitedByUserId: actorUserId,
          },
          select: INVITATION_SELECT,
        })) as InvitationSelected;

        return { row, token };
      },
      { operation: "createInvitation" },
    );

    // POST-COMMIT. The email is MASKED (architecture §9): an audit trail that
    // records who was invited should not itself become a directory of the
    // addresses a shop holds. The mask was computed BEFORE the transaction —
    // see the note there; nothing that can throw belongs on this side of the
    // commit.
    this.events.emit("org.invitation.created", {
      actorUserId,
      organizationId,
      emailMasked,
      roleId: created.row.roleId,
      invitationId: created.row.id,
    });

    return {
      invitation: toRow(created.row, input.now),
      token: created.token,
      inviteUrl: this.inviteUrl(created.token),
    };
  }

  // ── §3.12 reissue link ───────────────────────────────────────────────────

  async reissueLink(input: { readonly invitationId: string; readonly now: Date }): Promise<ReissuedLink> {
    const organizationId = this.requireOrganizationId();
    const actorUserId = this.requireUserId();

    const reissued = await runInOrgLockTransaction(
      this.prisma,
      async (tx) => {
        const invitation = (await tx.invitation.findUnique({
          where: { id: input.invitationId },
          select: {
            id: true,
            status: true,
            roleId: true,
            expiresAt: true,
            role: { select: ROLE_SELECT },
          },
        })) as {
          id: string;
          status: string;
          roleId: string;
          expiresAt: Date;
          role: { capabilities: string[] };
        } | null;
        if (!invitation) throw domainError("NOT_FOUND");
        if (invitation.status !== "pending") throw domainError("CONFLICT");

        // ★ A-9 — expired means expired. Decided 2026-08-06, reversing the
        // earlier "reissue it, the alternative is a dead end on screen".
        //
        // An expired invitation is still STORED as `pending` (there is no write
        // path for `expired`), so reissue used to accept it and hand back a
        // fresh token. The consequence was a row that could never die: an Owner
        // link issued at any point in the past stayed a permanent option for
        // anyone holding `full_access`, uncounted by the pending cap (which
        // only counts `expiresAt > now`) and — until A-4 — invisible in every
        // status filter. "The link you thought was dead is one button away
        // from being alive" is not a property a membership credential should
        // have.
        //
        // The dead end the old comment feared does not exist: the row is still
        // cancellable (cancel reads the same stored column), and cancelling
        // frees the partial unique slot on (organizationId, email), so the
        // person can simply be invited again. Two deliberate steps instead of
        // one silent resurrection.
        //
        // The status must be RESOLVED here rather than compared to the column,
        // for the same reason as A-4 — the column cannot answer this question.
        if (resolveInvitationStatus({ status: "pending", expiresAt: invitation.expiresAt }, input.now) === "expired") {
          throw domainError("INVITATION_EXPIRED");
        }

        const actorCapabilities = await this.readActorCapabilities(tx, actorUserId);
        // NEW-2 — the whole reason this route is not just a token generator.
        const allowed = canAssignRole({
          actorCapabilities,
          targetIsOwner: false,
          newRoleIsOwner: isOwnerRole(invitation.role.capabilities),
        });
        // ⛔ THROWN BEFORE ANY WRITE. A 403 that had already rotated the token
        // would invalidate the inviter's live link as a side effect of being
        // refused — the caller is told "no" while the damage is done.
        if (!allowed) throw domainError("FORBIDDEN");

        const token = generateInvitationToken();
        // D-027 — the clock restarts. Same TTL rule as creation, recomputed from
        // the role's capabilities so an elevated invitation extends 24h at a
        // time and never inherits a 7-day window.
        const expiresAt = invitationExpiryFrom(
          input.now,
          invitationTtlHours(invitation.role.capabilities),
        );

        const row = (await tx.invitation.update({
          where: { id: invitation.id },
          data: { tokenHash: hashInvitationToken(token), tokenIssuedAt: input.now, expiresAt },
          select: { id: true, expiresAt: true, tokenIssuedAt: true },
        })) as { id: string; expiresAt: Date; tokenIssuedAt: Date };

        return { row, token };
      },
      { operation: "reissueInvitationLink" },
    );

    this.events.emit("org.invitation.link_reissued", {
      actorUserId,
      organizationId,
      invitationId: reissued.row.id,
    });

    return {
      token: reissued.token,
      inviteUrl: this.inviteUrl(reissued.token),
      expiresAt: reissued.row.expiresAt.toISOString(),
      tokenIssuedAt: reissued.row.tokenIssuedAt.toISOString(),
      rotated: true,
    };
  }

  // ── §3.13 cancel ─────────────────────────────────────────────────────────

  async cancel(input: { readonly invitationId: string; readonly now: Date }): Promise<{ id: string; status: "cancelled" }> {
    const organizationId = this.requireOrganizationId();
    const actorUserId = this.requireUserId();

    const cancelled = await runInOrgLockTransaction(
      this.prisma,
      async (tx) => {
        const invitation = (await tx.invitation.findUnique({
          where: { id: input.invitationId },
          select: { id: true, status: true },
        })) as { id: string; status: string } | null;
        if (!invitation) throw domainError("NOT_FOUND");
        if (invitation.status !== "pending") throw domainError("CONFLICT");

        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: "cancelled", cancelledAt: input.now },
          select: { id: true },
        });
        return invitation.id;
      },
      { operation: "cancelInvitation" },
    );

    this.events.emit("org.invitation.cancelled", {
      actorUserId,
      organizationId,
      invitationId: cancelled,
    });

    return { id: cancelled, status: "cancelled" };
  }

  // ── §3.14 preview (PUBLIC) ───────────────────────────────────────────────

  /**
   * What the invitee sees before deciding — api-spec §3.14.
   *
   * NO ORG CONTEXT EXISTS HERE and none is created (I-3). `this.prisma` is
   * untouchable on this path: reaching for it would throw
   * `MissingOrgContextError`, which is the designed failure (architecture §1.4
   * last row) rather than a quiet read of a caller-chosen tenant.
   *
   * ── WHAT IS AND IS NOT DISTINGUISHABLE (architecture §7.6) ──
   * An UNKNOWN token is `404 INVITATION_INVALID`, one body, one message, for
   * every reason a token might not resolve: never issued, mistyped, rotated
   * away by §3.12, or belonging to a shop that was deleted. That is the answer
   * an enumerator would be mining, so it carries no information at all.
   *
   * A token that DID resolve gets the precise state (`expired` / `cancelled` /
   * `already accepted`) — and that is not a leak, because the caller already
   * presented a 256-bit secret that matched a stored HMAC. They cannot learn
   * anything they did not already hold, and AC US-4 needs the distinction: each
   * state sends the user to a different recovery path.
   *
   * The rate limit (`publicInvitationEntry`, 30/hour/IP) is what bounds the only
   * remaining attack — guessing — and it is declared on the route, not here.
   */
  async preview(input: { readonly token: string; readonly now: Date }): Promise<InvitationPreview> {
    const row = await this.lookup.findByTokenHash(hashInvitationToken(input.token));
    // ⛔ One answer, whatever the reason. Do NOT add a branch here.
    if (!row) throw domainError("INVITATION_INVALID");

    // `expired` is DERIVED, never stored (data-model §3.2): there is no job
    // marking rows dead, so a link is expired the instant the clock says so.
    const status = resolveInvitationStatus(
      { status: row.status as StoredInvitationStatus, expiresAt: row.expiresAt },
      input.now,
    );
    if (status !== "pending") throw domainError(PREVIEW_STATUS_ERRORS[status]);

    return toInvitationPreview({
      organizationName: row.organizationName,
      roleName: row.roleName,
      roleKey: row.roleKey,
      // Masked INSIDE the projection — this service never holds a shape that
      // could put the full address on a public response.
      email: row.email,
      expiresAt: row.expiresAt,
      status,
    });
  }

  // ── §3.15 accept ─────────────────────────────────────────────────────────

  /**
   * Redeem an invitation — the one write in F-002 whose caller is, by
   * definition, not yet a member of the organization it writes to.
   *
   * ── WHERE THE ORGANIZATION COMES FROM (I-3) ──
   * From the invitation ROW, read by token hash through `SYSTEM_PRISMA`, and
   * from nowhere else. `X-Organization-Id` is ignored by the middleware on a
   * `@UserScoped()` route, so there is no header to read even if this code
   * wanted to; the context is then opened HERE, over the org the row proves —
   * the same shape a BullMQ processor uses (§2.1), not a second pattern.
   *
   * ── STATEMENT ORDER INSIDE THE TRANSACTION (§5.1) ──
   *   1. `SET LOCAL lock_timeout` + `SELECT … FROM "Organization" … FOR UPDATE`
   *      (issued by `runInOrgLockTransaction` before the callback runs)
   *   2. re-read the invitation BY TOKEN HASH through `tx`
   *   3. re-read the invitation's role   → still a role of THIS org? (M-6)
   *   4. re-read the caller's membership → active / revoked / absent
   *   5. `canAcceptInvitation(...)` on those three facts
   *   6. the email check, in ITS FIXED SLOT (see below)
   *   7. write: membership (create or reactivate) + invitation → accepted
   *   8. read the org row for the response
   *   POST-COMMIT: `org.invitation.accepted` (+ `org.member.reactivated`)
   *
   * Steps 2–4 are re-reads on purpose. The lookup outside the transaction
   * answers ONE question — "which tenant?" — and anything else it returned is a
   * snapshot taken before the lock existed. Between the two, a concurrent
   * `revoke` (which cancels pending invitations, I-1), `cancel` or reissue may
   * have committed; deciding on the outside read would let `accept` win a race
   * it must lose.
   *
   * ── THE EMAIL CHECK'S SLOT IS PART OF THE CONTRACT ──
   * api-spec §3.15 pins the order: expired → cancelled/accepted → EMAIL →
   * role_unavailable → already_member → superseded. The pure fn deliberately
   * does not know about the email (it answers 403, not 409, and needs the
   * authenticated user), so the three "clock and status" answers are returned
   * before it and the rest after. Moving it would change which error a user
   * sees in a state where several are true at once.
   */
  async accept(input: {
    readonly userId: string;
    readonly token: string;
    readonly now: Date;
  }): Promise<InvitationAcceptResult> {
    const tokenHash = hashInvitationToken(input.token);

    // OUTSIDE the transaction, and used for ONE thing: which organization is
    // this? Every field of it is re-read under the lock below.
    const located = await this.lookup.findByTokenHash(tokenHash);
    if (!located) throw domainError("INVITATION_INVALID");

    const acceptor = await this.lookup.findAcceptor(input.userId);
    // The access token verified, so the row must exist. If it does not, the
    // account was deleted mid-request — refuse rather than join a shop to a
    // user id nothing can resolve.
    if (!acceptor) throw domainError("INTERNAL");
    const acceptorEmail = normalizeEmail(acceptor.email);
    const organizationId = located.organizationId;

    const outcome = await this.store.run({ organizationId, userId: input.userId }, () =>
      runInOrgLockTransaction(
        this.prisma,
        async (tx): Promise<AcceptOutcome> => {
          const invitation = (await tx.invitation.findFirst({
            // The hash, not the id: a rotate (§3.12) replaces the hash, so a
            // link that was live when we located it above resolves to NOTHING
            // here — which is exactly `404 INVITATION_INVALID`, the same answer
            // an unknown token gets (I-C-05).
            where: { tokenHash },
            select: {
              id: true,
              email: true,
              roleId: true,
              status: true,
              expiresAt: true,
              tokenIssuedAt: true,
            },
          })) as AcceptInvitationRow | null;
          if (!invitation) return REFUSED_INVALID;

          // M-6 — `ORG_PRISMA` confines this to the invitation's org, so "the
          // role was deleted" and "the role belongs to another shop" are the
          // same answer by construction.
          const role = (await tx.role.findFirst({
            where: { id: invitation.roleId },
            select: { id: true, name: true, key: true },
          })) as { id: string; name: string; key: string | null } | null;

          const membership = (await tx.membership.findFirst({
            where: { userId: input.userId },
            select: { id: true, status: true, revokedAt: true, roleId: true },
          })) as AcceptorMembershipRow | null;

          const decision = canAcceptInvitation({
            invitation: {
              status: invitation.status as StoredInvitationStatus,
              expiresAt: invitation.expiresAt,
              tokenIssuedAt: invitation.tokenIssuedAt,
            },
            membership: membership
              ? {
                  status: membership.status as MembershipStatus,
                  revokedAt: membership.revokedAt,
                }
              : null,
            roleExistsInOrg: role !== null,
            now: input.now,
          });

          // 1) the clock and the stored status, before anything about the caller.
          if (decision === "expired" || decision === "cancelled" || decision === "already_accepted") {
            return { kind: "refused", decision };
          }

          // 2) the email binding — its fixed slot (api-spec §3.15).
          if (acceptorEmail !== invitation.email) {
            // `details.emailMasked` is what lets the UI say WHICH account to
            // sign in with. Masked, never the address: whoever is holding this
            // link may not be its owner (§7.6).
            return {
              kind: "refused",
              decision: "email_mismatch",
              emailMasked: maskEmail(invitation.email),
            };
          }

          // 3) the remaining state answers.
          if (decision === "role_unavailable" || decision === "superseded") {
            return { kind: "refused", decision };
          }

          if (decision === "already_member") {
            // I-9 — the caller's CURRENT role is not touched, not even to the
            // role on the invitation. The first draft upserted here, which made
            // "accept a Staff invitation" a way for the last Owner to demote
            // themselves and leave the shop with zero Owners.
            //
            // The invitation is closed instead of left `pending`, so the list
            // does not keep offering a link that can never do anything (§3.15).
            // It commits: this refusal is the one that WRITES.
            await tx.invitation.update({
              where: { id: invitation.id },
              data: { status: "cancelled", cancelledAt: input.now },
              select: { id: true },
            });
            return { kind: "refused", decision: "already_member" };
          }

          // ── decision === "ok" — the only path that writes a membership ────
          // `role` is non-null here: `roleExistsInOrg` was false ⇒
          // `role_unavailable` ⇒ returned above.
          const grantedRole = role as { id: string; name: string; key: string | null };
          const reactivatedFrom = membership?.status === "revoked" ? membership.revokedAt : null;

          if (membership) {
            await tx.membership.update({
              where: { organizationId_userId: { organizationId, userId: input.userId } },
              data: {
                status: "active",
                roleId: grantedRole.id,
                activatedAt: input.now,
                // Cleared because the row is active again and `revokedAt` is
                // read as "this person is out" by the member list and by I-1.
                // The history is not lost: `org.member.reactivated` carries
                // `previousRevokedAt`, and a future removal writes a new one.
                revokedAt: null,
                revokedByUserId: null,
              },
              select: { id: true },
            });
          } else {
            // `organizationId` is injected by the org scope — never passed in,
            // so this cannot be aimed at another tenant.
            await tx.membership.create({
              data: {
                userId: input.userId,
                roleId: grantedRole.id,
                status: "active",
                activatedAt: input.now,
              },
              select: { id: true },
            });
          }

          await tx.invitation.update({
            where: { id: invitation.id },
            data: {
              status: "accepted",
              acceptedAt: input.now,
              acceptedByUserId: input.userId,
              // A SNAPSHOT, not a join (architecture §7.6): the forensic flag
              // must still answer "was this account made after the invite?"
              // after the user row is deleted or anonymized under PDPA.
              acceptedUserCreatedAt: acceptor.createdAt,
            },
            select: { id: true },
          });

          const organization = (await tx.organization.findUnique({
            where: { id: organizationId },
            select: { id: true, name: true },
          })) as { id: string; name: string } | null;
          if (!organization) throw domainError("INTERNAL"); // unreachable: it is the locked row

          return {
            kind: "ok",
            invitationId: invitation.id,
            tokenIssuedAt: invitation.tokenIssuedAt,
            organization,
            role: grantedRole,
            reactivatedFrom,
          };
        },
        { operation: "acceptInvitation" },
      ),
    );

    if (outcome.kind === "refused") {
      throw domainError(ACCEPT_REFUSAL_ERRORS[outcome.decision], {
        ...(outcome.emailMasked ? { details: { emailMasked: outcome.emailMasked } } : {}),
      });
    }

    // POST-COMMIT (H-3) — a rolled-back transaction must leave no trace saying
    // it happened, so nothing above this line emits.
    this.events.emit("org.invitation.accepted", {
      userId: input.userId,
      organizationId,
      invitationId: outcome.invitationId,
      roleId: outcome.role.id,
      acceptedByUserId: input.userId,
      userCreatedAt: acceptor.createdAt.toISOString(),
      // Compared against `tokenIssuedAt`, deliberately NOT the wire flag's
      // baseline — see `userCreatedAfterTokenIssued` for why the two differ.
      userCreatedAfterTokenIssued: userCreatedAfterTokenIssued(
        acceptor.createdAt,
        outcome.tokenIssuedAt,
      ),
    });

    if (outcome.reactivatedFrom) {
      // I-1ค/M-7ข — a SEPARATE event. "A removed person came back" and "a new
      // person joined" are different signals; folded into one type, nobody
      // investigating a takeover could tell them apart afterwards.
      this.events.emit("org.member.reactivated", {
        userId: input.userId,
        organizationId,
        invitationId: outcome.invitationId,
        roleId: outcome.role.id,
        previousRevokedAt: outcome.reactivatedFrom.toISOString(),
      });
    }

    return toInvitationAcceptResult({
      organization: outcome.organization,
      membership: {
        roleId: outcome.role.id,
        roleName: outcome.role.name,
        roleKey: outcome.role.key,
      },
    });
  }

  // ── helpers (every one takes `tx` — M-2) ─────────────────────────────────

  private async readRole(tx: OrgLockTx, roleId: string) {
    const role = (await tx.role.findUnique({
      where: { id: roleId },
      select: ROLE_SELECT,
    })) as { id: string; name: string; key: string | null; capabilities: string[] } | null;
    // 422 rather than 404: the role id is INPUT the client sent, and the org is
    // real. `ORG_PRISMA` already confines the lookup to this tenant, so a role
    // belonging to another shop reads as "not a valid choice", never as
    // "exists elsewhere".
    if (!role) throw domainError("ROLE_INVALID");
    return role;
  }

  private async readActorCapabilities(tx: OrgLockTx, actorUserId: string): Promise<readonly string[]> {
    const membership = (await tx.membership.findFirst({
      where: { userId: actorUserId, status: "active" },
      select: { role: { select: { capabilities: true } } },
    })) as { role: { capabilities: string[] } } | null;
    // Re-read INSIDE the lock: the capability guard checked this before the
    // transaction opened, and a membership revoked in between must stop the
    // write rather than ride on a stale answer.
    if (!membership) throw domainError("ORG_ACCESS_DENIED");
    return membership.role.capabilities;
  }

  private async assertNotAlreadyMember(tx: OrgLockTx, email: string): Promise<void> {
    const existing = (await tx.membership.findFirst({
      where: { status: "active", user: { email } },
      select: { id: true },
    })) as { id: string } | null;
    if (existing) throw domainError("ALREADY_MEMBER");
  }

  private async assertNoPendingInvitation(tx: OrgLockTx, email: string): Promise<void> {
    const pending = (await tx.invitation.findFirst({
      where: { email, status: "pending" },
      select: { id: true, expiresAt: true, roleId: true, role: { select: { name: true } } },
    })) as { id: string; expiresAt: Date; roleId: string; role: { name: string } } | null;
    if (!pending) return;
    // D-027 — the details are what turn a dead end into a next step: with the
    // id in hand the UI can offer "reissue" or "cancel" instead of leaving the
    // user to retype the address and get the same error again.
    throw domainError("INVITATION_PENDING", {
      details: {
        invitationId: pending.id,
        expiresAt: pending.expiresAt.toISOString(),
        roleId: pending.roleId,
        roleName: pending.role.name,
      },
    });
  }

  private async assertPendingCapNotReached(tx: OrgLockTx, now: Date): Promise<void> {
    // M-3 — counts only invitations that are pending AND still live. Counting
    // expired ones would let a shop lock itself out of inviting anybody simply
    // by leaving old links to rot, which is a self-inflicted denial of service
    // with no security benefit.
    const live = await tx.invitation.count({
      where: { status: "pending", expiresAt: { gt: now } },
    });
    if (live >= this.pendingCap) {
      throw domainError("INVITATION_LIMIT_REACHED", { details: { limit: this.pendingCap } });
    }
  }

  private inviteUrl(token: string): string {
    return `${this.webAppBaseUrl}/invite?token=${encodeURIComponent(token)}`;
  }

  private requireOrganizationId(): string {
    const organizationId = this.store.get()?.organizationId;
    if (!organizationId) throw domainError("INTERNAL");
    return organizationId;
  }

  private requireUserId(): string {
    const userId = this.store.get()?.userId;
    if (!userId) throw domainError("INTERNAL");
    return userId;
  }
}
