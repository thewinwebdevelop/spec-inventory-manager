// F-001 · T-001-07 — auth orchestration service. Ties hashing (T-001-03), JWT
// (T-001-04), refresh (T-001-05), throttle (T-001-06), policy (core-domain), and
// security events (T-001-08) into the endpoint behaviors (api-spec §2).
//
// Enumeration-safe by construction: unknown-email login does a dummy argon2
// verify (§9); wrong-password and unknown-email both return the identical
// INVALID_CREDENTIALS shape. Throttle is ALWAYS its own 429 (M-1), never folded
// into the 401.
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  checkPasswordPolicy,
  normalizeEmail,
  isValidEmailShape,
  hasCapability,
  CAPABILITY_MANAGE_MEMBERS,
} from "@omnistock/core-domain";
import { PrismaService } from "../prisma/prisma.service";
import { HashingService } from "./hashing.service";
import { RefreshTokenService, type IssuedRefresh } from "./refresh-token.service";
import { AccessTokenService } from "./access-token.service";
import { SecurityEventsService } from "./security-events.service";
import { ThrottleService } from "./throttle.service";

function mapPolicyError(error: string): never {
  throw new UnprocessableEntityException({ error: { code: error, message: policyMessage(error) } });
}
function policyMessage(code: string): string {
  switch (code) {
    case "PASSWORD_TOO_SHORT":
      return "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";
    case "PASSWORD_TOO_LONG":
      return "รหัสผ่านยาวเกินไป (ไม่เกิน 128 ตัวอักษร)";
    case "PASSWORD_BREACHED":
      return "รหัสผ่านนี้อยู่ในรายการที่ถูกเปิดเผยแล้ว กรุณาใช้รหัสอื่น";
    default:
      return "รหัสผ่านไม่ผ่านเงื่อนไข";
  }
}

const INVALID_CREDENTIALS = {
  error: { code: "INVALID_CREDENTIALS", message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" },
};

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
      throw new UnprocessableEntityException({ error: { code: "EMAIL_INVALID", message: "อีเมลไม่ถูกต้อง" } });
    }
    const policy = checkPasswordPolicy(password);
    if (!policy.ok) mapPolicyError(policy.error);

    // Duplicate email is the one necessary enumeration leak (Gate 1 §4).
    const existing = await this.db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      throw new ConflictException({ error: { code: "EMAIL_TAKEN", message: "อีเมลนี้ถูกใช้แล้ว" } });
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
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const ok = await this.hashing.verify(user.passwordHash, password);
    if (!ok) {
      await hooks.onFailure();
      throw new UnauthorizedException(INVALID_CREDENTIALS);
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
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    const ok = await this.hashing.verify(user.passwordHash, currentPassword);
    if (!ok) {
      await hooks.onFailure();
      throw new UnauthorizedException(INVALID_CREDENTIALS);
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

  /**
   * Reset a member's password. Implements the FULL capability check INLINE (no
   * stub, no external guard): the caller must hold an ACTIVE Membership(orgId)
   * whose Role.capabilities ⊇ manage_members, AND the target must be an ACTIVE
   * member of orgId (H-2). Any failure → the SAME-SHAPE 404 (never 403 — no
   * org-existence/status/capability oracle). On success: set target hash, revoke
   * ALL target families, emit admin_reset.
   */
  async adminResetPassword(
    callerUserId: string,
    orgId: string,
    targetUserId: string,
    newPassword: string,
  ): Promise<void> {
    // (2) Caller check — active membership + capability, read fresh.
    const callerMembership = await this.db.membership.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: callerUserId } },
      select: { status: true, role: { select: { capabilities: true } } },
    });
    const callerOk =
      callerMembership?.status === "active" &&
      hasCapability(callerMembership.role.capabilities, CAPABILITY_MANAGE_MEMBERS);

    // (3) Target check — must be an ACTIVE member of orgId (H-2).
    const targetMembership = await this.db.membership.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
      select: { status: true },
    });
    const targetOk = targetMembership?.status === "active";

    // (4) Any failure → same-shape 404 (never 403). Do policy validation only
    // AFTER authorization so an unauthorized caller cannot probe policy either.
    if (!callerOk || !targetOk) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "ไม่พบข้อมูล" } });
    }

    const policy = checkPasswordPolicy(newPassword);
    if (!policy.ok) mapPolicyError(policy.error);

    const newHash = await this.hashing.hash(newPassword);
    const target = await this.db.user.update({
      where: { id: targetUserId },
      data: { passwordHash: newHash },
      select: { email: true },
    });
    await this.refresh.revokeAllForUser(targetUserId);
    // Anti-lockout escape hatch (arch §8.2/§10, I5.4): a reset must clear the
    // target's login backoff so they can immediately sign in with the new
    // password even if they were mid-backoff. The login account counter keys on
    // the normalized email (throttle:acct:{emailNorm}, data-model §4).
    await this.throttle.clearAccount(normalizeEmail(target.email));
    this.securityEvents.emit("auth.password.admin_reset", {
      actorUserId: callerUserId,
      orgId,
      targetUserId,
    });
  }
}
