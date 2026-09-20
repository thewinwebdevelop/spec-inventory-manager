// F-002 · T-002-20 ★ — "which shop is this token for?", the third and last
// SYSTEM_PRISMA case of architecture §2.4.
//
// ── WHY THE UNFILTERED CLIENT IS UNAVOIDABLE HERE ──────────────────────────
// `ORG_PRISMA` filters by the request's organizationId. On `POST
// /invitations/preview` (public) and `POST /invitations/accept` (user-scoped)
// there IS no organizationId — I-3 forbids one, because the only place it could
// come from is a header the caller controls, and a caller who picks the tenant
// picks where our writes land. The organization is a FACT OF THE ROW, and the
// row can only be found by its token hash. That is the chicken-and-egg this
// file resolves, and it is why it lives in the `system/` jail rather than next
// to the service that calls it.
//
// ── THE FOUR RULES OF THIS FOLDER (§2.4), APPLIED ──────────────────────────
//  (ก) every method takes a SCOPE LIMITER as its first argument — a `tokenHash`
//      or a `userId`. There is no method here that can be called without one,
//      and none of them accepts a `where`.
//  (ข) the client is never returned, exposed or passed out of this file.
//  (ค) `invitation-lookup.service.test.ts` proves no path can read across
//      tokens or users (a query built without the limiter is the failure mode).
//  (ง) NOTHING here reads `X-Organization-Id`, or any request at all — this
//      class has no access to one. That is I-3 made structural rather than
//      remembered.
//
// ── WHAT IT DELIBERATELY DOES NOT DO ───────────────────────────────────────
// It DECIDES NOTHING. `preview` re-derives the status through the pure fn and
// `accept` re-reads every one of these rows through `tx` after taking the org
// lock (architecture §5.1 rule 2). The read below exists to answer "which
// tenant?", and treating its result as an authorization decision is exactly the
// TOCTOU the lock exists to close.
import { Inject, Injectable } from "@nestjs/common";
import { SYSTEM_PRISMA, USER_SELECT, type SystemPrismaClient } from "../../tenancy";

/** Everything the PREVIEW needs, and nothing else (api-spec §3.14). */
export interface InvitationByToken {
  readonly id: string;
  readonly organizationId: string;
  /** Normalized; masked by `toInvitationPreview` before it reaches the wire. */
  readonly email: string;
  readonly roleId: string;
  readonly status: string;
  readonly expiresAt: Date;
  readonly tokenIssuedAt: Date;
  readonly organizationName: string;
  readonly roleName: string;
  readonly roleKey: string | null;
}

/** The accepting account, as `USER_SELECT` allows it to be read. */
export interface AcceptorUser {
  readonly id: string;
  readonly email: string;
  /** Snapshotted into `Invitation.acceptedUserCreatedAt` (architecture §7.6). */
  readonly createdAt: Date;
}

@Injectable()
export class InvitationLookupService {
  // Explicit @Inject on every parameter — `tsx` emits no `design:paramtypes`,
  // so a type-only parameter resolves to `undefined` in production only.
  constructor(@Inject(SYSTEM_PRISMA) private readonly prisma: SystemPrismaClient) {}

  /**
   * The invitation whose stored hash is `tokenHash`, or `null`.
   *
   * `findUnique` on the UNIQUE column: one indexed hit, no scan, and the
   * comparison happens in the database on an index rather than in JS over a
   * candidate set — so there is no timing signal from searching (§7.3).
   *
   * ⛔ NOT `tokenHash: { contains: … }`, not a `findFirst` over a filtered set,
   * not a fallback "try the id as well". Every one of those turns this into a
   * search, and a search over invitations is the enumeration surface the whole
   * design is built to avoid.
   *
   * `tokenHash` is NEVER selected back. It is the stored secret; the caller
   * already knows the token it hashed, and a row carrying the hash is one spread
   * away from the wire.
   */
  async findByTokenHash(tokenHash: string): Promise<InvitationByToken | null> {
    const row = await this.prisma.invitation.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        organizationId: true,
        email: true,
        roleId: true,
        status: true,
        expiresAt: true,
        tokenIssuedAt: true,
        // Explicit `select` on every relation, never `include` (C-4): `include`
        // returns whole rows, and a whole `Organization` row carries the shop's
        // tax id — on a PUBLIC endpoint.
        organization: { select: { name: true } },
        role: { select: { name: true, key: true } },
      },
    });
    if (!row) return null;
    // Projected field by field: the `select` above and this object are the only
    // two places the shape is written, and they are next to each other.
    return {
      id: row.id,
      organizationId: row.organizationId,
      email: row.email,
      roleId: row.roleId,
      status: row.status,
      expiresAt: row.expiresAt,
      tokenIssuedAt: row.tokenIssuedAt,
      organizationName: row.organization.name,
      roleName: row.role.name,
      roleKey: row.role.key,
    };
  }

  /**
   * The accepting user's own row, by id.
   *
   * `User` is org-AGNOSTIC (architecture §2.2), so `withOrgScope` would inject
   * nothing even if a context existed — rule C-3 forbids a feature module from
   * starting a query here at all. It is read through `USER_SELECT`, the frozen
   * projection with no relation keys, so the "walk through User back down into
   * another org's memberships" shape (NEW-8) cannot be written, and
   * `passwordHash` is not selectable (C-4).
   *
   * Both fields are load-bearing: `email` is the §3.15 binding check, and
   * `createdAt` becomes the `acceptedUserCreatedAt` SNAPSHOT — a copy, not a
   * join, so the forensic flag survives the user being deleted under PDPA.
   */
  async findAcceptor(userId: string): Promise<AcceptorUser | null> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_SELECT,
    });
    return row ? { id: row.id, email: row.email, createdAt: row.createdAt } : null;
  }
}
