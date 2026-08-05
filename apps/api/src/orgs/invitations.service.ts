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
  canAssignRole,
  invitationTtlHours,
  invitationExpiryFrom,
  isOwnerRole,
  maskEmail,
  normalizeEmail,
  toInvitationRow,
  type InvitationRow,
} from "@omnistock/core-domain";
import { generateInvitationToken, hashInvitationToken } from "../prisma/invitation-token";
import { domainError } from "../common";
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

function toRow(row: InvitationSelected): InvitationRow {
  return toInvitationRow(
    {
      id: row.id,
      email: row.email,
      roleId: row.roleId,
      status: row.status as InvitationRow["status"],
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

@Injectable()
export class InvitationsService {
  constructor(
    @Inject(ORG_PRISMA) private readonly prisma: OrgScopedPrismaClient,
    @Inject(OrgContextStore) private readonly store: OrgContextStore,
    @Inject(SecurityEventsService) private readonly events: SecurityEventsService,
    @Inject(INVITATION_PENDING_CAP) private readonly pendingCap: number,
    @Inject(WEB_APP_BASE_URL) private readonly webAppBaseUrl: string,
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
    const statusFilter = !input.status || input.status === "all" ? {} : { status: input.status };
    const where = {
      ...statusFilter,
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
    return { items: page.items.map(toRow), nextCursor: page.nextCursor };
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
    // addresses a shop holds.
    this.events.emit("org.invitation.created", {
      actorUserId,
      organizationId,
      emailMasked: maskEmail(email),
      roleId: created.row.roleId,
      invitationId: created.row.id,
    });

    return {
      invitation: toRow(created.row),
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
          select: { id: true, status: true, roleId: true, role: { select: ROLE_SELECT } },
        })) as { id: string; status: string; roleId: string; role: { capabilities: string[] } } | null;
        if (!invitation) throw domainError("NOT_FOUND");
        // An expired invitation is still stored as `pending` and may be
        // reissued on purpose (architecture §3.2): the alternative is a dead end
        // on screen, and with the Owner-only check below, allowing it buys the
        // attacker nothing.
        if (invitation.status !== "pending") throw domainError("CONFLICT");

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
