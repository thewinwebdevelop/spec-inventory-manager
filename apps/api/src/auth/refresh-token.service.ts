// F-001 · T-001-05 ★ — refresh-token service (the security core).
// arch §3/§4, data-model §2.4. Opaque token + keyed HMAC tokenHash (L-3);
// rotation in a row-locked txn; reuse → COMMITTED family revoke (H-3) with 60s
// leeway (D-011); familyExpiresAt guard (D-007); live-family cap 20/user with
// LRU-revoke-oldest on overflow (D-017).
//
// The decision ("allow/rotate/revoke-family/reject") is the core-domain PURE fn
// `decideReuse` (golden rule #6); THIS service only executes the returned action
// with the correct transaction/commit boundaries.
import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  decideReuse,
  decideFamilyCap,
  tokenExpiresAt,
  familyExpiresAt as computeFamilyExpiresAt,
  type LiveFamily,
} from "@omnistock/core-domain";
import { PrismaService } from "../prisma/prisma.service";
import { SecurityEventsService } from "./security-events.service";
import { generateRefreshTokenValue, hashRefreshToken } from "./refresh-token.crypto";

/** The issued token pair the caller returns to the client. */
export interface IssuedRefresh {
  /** Plaintext opaque token — returned to client ONCE, never persisted. */
  value: string;
  familyId: string;
  expiresAt: Date;
  familyExpiresAt: Date;
}

/** Result of a rotation attempt. */
export type RotateResult =
  | { ok: true; issued: IssuedRefresh; userId: string }
  /** Generic 401 INVALID_REFRESH to the client (expired / benign-retry / cap /
   *  reuse — reuse is logged distinctly server-side but wire is generic). */
  | { ok: false; reason: "INVALID_REFRESH" };

@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityEvents: SecurityEventsService,
    // Injected so tests can supply a fixed secret / clock.
    private readonly refreshSecret: string,
    private readonly now: () => number = () => Date.now(),
  ) {}

  private get db() {
    return this.prisma.client;
  }

  /**
   * LOGIN: mint a brand-new family (fresh familyId, rotatedFrom=null). Enforces
   * the live-family cap (D-017): if the user already has ≥20 live families, the
   * OLDEST is revoked first (committed), then the new family is minted — login
   * never fails on the cap.
   */
  async issueOnLogin(userId: string, deviceId: string | null): Promise<IssuedRefresh> {
    const nowMs = this.now();
    const familyId = randomUUID();
    const value = generateRefreshTokenValue();
    const expiresAt = new Date(tokenExpiresAt(nowMs));
    const familyExpiresAt = new Date(computeFamilyExpiresAt(nowMs));

    // (#4, security review) count → evict → mint in ONE interactive txn so two
    // concurrent logins can't transiently yield 21 live families. The pure cap
    // decision (decideFamilyCap) runs on the rows read inside the txn; the
    // evict + mint commit atomically. (Soft cap either way — this just tightens
    // the concurrent-login race the reviewer flagged.)
    await this.db.$transaction(async (tx) => {
      // --- D-017 live-family cap: count live families, evict oldest if at cap ---
      const liveRows = await tx.refreshToken.findMany({
        where: {
          userId,
          revokedAt: null,
          expiresAt: { gt: new Date(nowMs) },
          familyExpiresAt: { gt: new Date(nowMs) },
        },
        select: { familyId: true, createdAt: true },
      });
      // Reduce to one LiveFamily per familyId (earliest createdAt = login time).
      const byFamily = new Map<string, number>();
      for (const r of liveRows) {
        const t = r.createdAt.getTime();
        const cur = byFamily.get(r.familyId);
        if (cur === undefined || t < cur) byFamily.set(r.familyId, t);
      }
      const liveFamilies: LiveFamily[] = [...byFamily.entries()].map(([fid, createdAt]) => ({
        familyId: fid,
        createdAt,
      }));
      const cap = decideFamilyCap(liveFamilies);
      if (cap.revokeFamilyId !== null) {
        // Revoke the oldest family BEFORE minting the new one. Capacity
        // management, NOT reuse — no reuse_detected event (I3.11).
        await tx.refreshToken.updateMany({
          where: { familyId: cap.revokeFamilyId, revokedAt: null },
          data: { revokedAt: new Date(nowMs) },
        });
      }

      // --- mint the new family (same txn) ---
      await tx.refreshToken.create({
        data: {
          userId,
          familyId,
          tokenHash: hashRefreshToken(value, this.refreshSecret),
          deviceId: deviceId ?? undefined,
          rotatedFrom: null,
          expiresAt,
          familyExpiresAt,
          lastUsedAt: new Date(nowMs),
        },
      });
    });

    return { value, familyId, expiresAt, familyExpiresAt };
  }

  /**
   * REFRESH (rotation) — data-model §2.4. Row-locks the presented token, runs
   * the pure reuse-decision, and executes the action with the correct commit
   * boundaries:
   *  - ALLOW_ROTATE       → consume presented + insert successor (same txn), 200.
   *  - REJECT_EXPIRED     → generic 401, NO family burn, NO audit.
   *  - REJECT_BENIGN_RETRY→ generic 401, NO family burn, NO audit (leeway).
   *  - REVOKE_FAMILY      → COMMITTED family revoke (H-3) + post-commit
   *                         reuse_detected event, generic 401 to client.
   */
  async rotate(presentedValue: string, deviceId: string | null): Promise<RotateResult> {
    const tokenHash = hashRefreshToken(presentedValue, this.refreshSecret);
    const nowMs = this.now();

    // Interactive txn with a row lock on the presented row (data-model §2.4 step
    // 1). We do the decision + the ALLOW_ROTATE mutation inside the lock; for
    // REVOKE_FAMILY we set the family revoke inside a COMMITTING txn (option (a)
    // in §2.4 — the same txn commits the revoke, never a throw-to-rollback).
    const outcome = await this.db.$transaction(async (tx) => {
      // Lock the presented row FOR UPDATE (raw — Prisma has no locking clause).
      const locked = await tx.$queryRaw<
        Array<{
          id: string;
          userId: string;
          familyId: string;
          revokedAt: Date | null;
          expiresAt: Date;
          familyExpiresAt: Date;
        }>
      >`SELECT "id", "userId", "familyId", "revokedAt", "expiresAt", "familyExpiresAt"
        FROM "RefreshToken" WHERE "tokenHash" = ${tokenHash} FOR UPDATE`;

      if (locked.length === 0) {
        // Unknown token (never issued, or bare-SHA-256 collision that HMAC
        // rejects) → generic 401, no state change.
        return { kind: "reject" as const };
      }
      const row = locked[0];

      // Find the successor (if any) → is presented "consumed"? And is that
      // successor the CURRENT (live) token = presented is immediate predecessor?
      const successor = await tx.refreshToken.findUnique({
        where: { rotatedFrom: row.id },
        select: { id: true, createdAt: true, revokedAt: true },
      });
      let successorInfo: { createdAt: number; isCurrent: boolean } | null = null;
      if (successor) {
        // successor is "current" iff it is not revoked and itself has no
        // successor (data-model §2.3 current predicate, sufficient for leeway).
        const hasGrandchild = await tx.refreshToken.findUnique({
          where: { rotatedFrom: successor.id },
          select: { id: true },
        });
        const isCurrent = successor.revokedAt === null && hasGrandchild === null;
        successorInfo = { createdAt: successor.createdAt.getTime(), isCurrent };
      }

      const action = decideReuse({
        now: nowMs,
        presentedRevokedAt: row.revokedAt ? row.revokedAt.getTime() : null,
        presentedExpiresAt: row.expiresAt.getTime(),
        presentedFamilyExpiresAt: row.familyExpiresAt.getTime(),
        successor: successorInfo,
      });

      if (action === "ALLOW_ROTATE") {
        // Consume presented (mark lastUsedAt) + insert successor. familyId +
        // familyExpiresAt INHERITED unchanged; expiresAt SLIDES.
        const value = generateRefreshTokenValue();
        const newExpiresAt = new Date(tokenExpiresAt(nowMs));
        await tx.refreshToken.create({
          data: {
            userId: row.userId,
            familyId: row.familyId,
            tokenHash: hashRefreshToken(value, this.refreshSecret),
            deviceId: deviceId ?? undefined,
            rotatedFrom: row.id,
            expiresAt: newExpiresAt,
            familyExpiresAt: row.familyExpiresAt, // inherited, does NOT slide
            lastUsedAt: new Date(nowMs),
          },
        });
        return {
          kind: "rotated" as const,
          userId: row.userId,
          issued: {
            value,
            familyId: row.familyId,
            expiresAt: newExpiresAt,
            familyExpiresAt: row.familyExpiresAt,
          },
        };
      }

      if (action === "REVOKE_FAMILY") {
        // COMMITTED family revoke inside this txn (H-3, option (a)). Return the
        // facts so the event is emitted POST-COMMIT (after this txn resolves).
        await tx.refreshToken.updateMany({
          where: { familyId: row.familyId, revokedAt: null },
          data: { revokedAt: new Date(nowMs) },
        });
        return {
          kind: "reuse" as const,
          userId: row.userId,
          familyId: row.familyId,
          deviceId,
        };
      }

      // REJECT_EXPIRED | REJECT_BENIGN_RETRY → generic 401, no burn, no audit.
      return { kind: "reject" as const };
    });

    if (outcome.kind === "rotated") {
      return { ok: true, issued: outcome.issued, userId: outcome.userId };
    }
    if (outcome.kind === "reuse") {
      // POST-COMMIT (the $transaction has resolved) — never lost with a rollback.
      this.securityEvents.emit("auth.refresh.reuse_detected", {
        userId: outcome.userId,
        familyId: outcome.familyId,
        deviceId: outcome.deviceId,
      });
      return { ok: false, reason: "INVALID_REFRESH" };
    }
    return { ok: false, reason: "INVALID_REFRESH" };
  }

  /** Resolve the family a presented refresh token belongs to (ownership-proving
   *  by hash). Returns null if unknown. Used by logout / change-password to
   *  identify the caller's current family (M-3 / N-1).
   *
   *  (#5, security review) `liveOnly` matches spec §2.7 "current/live family":
   *  change-password passes `liveOnly: true` so a revoked/expired token does NOT
   *  resolve to a family to spare → the caller falls through to the safe-
   *  direction revoke-all (de-facto logout-all). Logout leaves it false (its
   *  downstream revoke is user-scoped + idempotent, so matching a dead family is
   *  harmless there). */
  async resolveFamily(
    presentedValue: string,
    liveOnly = false,
  ): Promise<{ userId: string; familyId: string } | null> {
    const tokenHash = hashRefreshToken(presentedValue, this.refreshSecret);
    const row = await this.db.refreshToken.findUnique({
      where: { tokenHash },
      select: { userId: true, familyId: true, revokedAt: true, expiresAt: true, familyExpiresAt: true },
    });
    if (!row) return null;
    if (liveOnly) {
      const nowMs = this.now();
      const live =
        row.revokedAt === null && row.expiresAt.getTime() > nowMs && row.familyExpiresAt.getTime() > nowMs;
      if (!live) return null;
    }
    return { userId: row.userId, familyId: row.familyId };
  }

  /** Revoke a specific family, scoped to the owning user (M-3 ownership). A
   *  foreign/unknown familyId revokes nothing (idempotent). */
  async revokeFamily(userId: string, familyId: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { userId, familyId, revokedAt: null },
      data: { revokedAt: new Date(this.now()) },
    });
  }

  /** Revoke ALL of a user's families (logout-all / admin-reset / change-pw
   *  fallback). */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(this.now()) },
    });
  }

  /** Revoke all of a user's families EXCEPT the spared one (change-password
   *  keep-current, US-6). */
  async revokeAllExceptFamily(userId: string, spareFamilyId: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { userId, revokedAt: null, familyId: { not: spareFamilyId } },
      data: { revokedAt: new Date(this.now()) },
    });
  }

  /** List a user's LIVE families for /auth/sessions (bounded ≤20 by D-017). */
  async listLiveSessions(userId: string): Promise<
    Array<{ familyId: string; deviceId: string | null; createdAt: Date; lastUsedAt: Date | null }>
  > {
    const nowDate = new Date(this.now());
    const rows = await this.db.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: nowDate },
        familyExpiresAt: { gt: nowDate },
      },
      select: { familyId: true, deviceId: true, createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: "asc" },
    });
    // One entry per family: earliest createdAt = login; latest lastUsedAt.
    const byFamily = new Map<
      string,
      { familyId: string; deviceId: string | null; createdAt: Date; lastUsedAt: Date | null }
    >();
    for (const r of rows) {
      const existing = byFamily.get(r.familyId);
      if (!existing) {
        byFamily.set(r.familyId, { ...r });
      } else {
        if (r.createdAt < existing.createdAt) existing.createdAt = r.createdAt;
        if (r.lastUsedAt && (!existing.lastUsedAt || r.lastUsedAt > existing.lastUsedAt)) {
          existing.lastUsedAt = r.lastUsedAt;
        }
      }
    }
    return [...byFamily.values()];
  }
}
