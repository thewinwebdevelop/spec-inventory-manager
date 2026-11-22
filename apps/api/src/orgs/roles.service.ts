// F-002 · T-002-16b — the role list behind the invite dropdown (api-spec §3.6).
// F-003 · T-003-B23 ★ — `create` (POST /orgs/{orgId}/roles, incl. clone).
// F-003 · T-003-B24 ★ — `update` (PATCH /orgs/{orgId}/roles/{roleId}) — its own
//   transaction diagram is above the method.
// F-003 · T-003-B25 ★ — `delete` (DELETE /orgs/{orgId}/roles/{roleId}, soft) — likewise.
//
// THE CREATE TRANSACTION (api-spec §2 fixed order — every fact read through `tx`
// under the org lock, the pattern of `MembersService.updateRole`):
//
//   runInOrgLockTransaction(operation: "createRole") ─┐
//    1 actor caps re-read in tx (AC-5.7)              │  gone ⇒ ORG_ACCESS_DENIED
//    2 floor `manage_roles` (SR-08)                    │  ⇒ 403 FORBIDDEN
//    3 body shape                                      │  ⇒ 422 VALIDATION_FAILED
//    4 validateRoleName (live system roles, in tx)     │  ⇒ 422 / 409 ROLE_NAME_TAKEN
//    5 validateRoleCapabilities                        │  ⇒ ROLE_EMPTY · FULL_ACCESS_RESERVED(+event) · UNKNOWN_CAPABILITY
//    6 decideRoleWrite (seam ROLE_WRITE_DECIDER)       │  ⇒ 403 ROLE_EXCEEDS_ACTOR (+event)
//    7 live-role cap                                   │  ⇒ 409 ROLE_LIMIT_REACHED
//    8 assertOwnerRemains(role_create)                 │  ⇒ 409 LAST_OWNER (defensive — never expected)
//    9 role.create(roleCreateData(…))                  │  unique ⇒ 409 ROLE_NAME_TAKEN
//   10 RoleDetail read through the same tx            ┘
//   post-commit: org.role.created · or org.role.escalation_denied
//
// Refusals that carry an event leave the transaction as a VALUE (nothing was
// written) and the event is emitted after it ended (H-3) — never inside a tx
// that could still roll back.
import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  CAPABILITY_MANAGE_ROLES,
  UNCHANGED,
  canonicalizeCapabilities,
  clampedInvitationExpiry,
  decideRoleAssignVisible,
  hasCapability,
  invitationTtlHours,
  isElevatedRole,
  isOwnerRole,
  validateRoleCapabilities,
  validateRoleName,
  wireNameCustomized,
  viewerVerdictAudience,
  type GrantBlockedReason,
  type RoleWriteDecider,
  type RoleWriteResult,
  type ValidatedCapabilities,
} from "@omnistock/core-domain";
import { LIVE_ROLE_WHERE, domainError } from "../common";
import { SecurityEventsService, type EscalationDeniedPayload } from "../auth";
import {
  ORG_PRISMA,
  OrgContextStore,
  runInOrgLockTransaction,
  type OrgLockTx,
  type OrgScopedPrismaClient,
} from "../tenancy";
import { OrgOwnershipGuard } from "./org-ownership.guard";
import { ROLE_CAPACITY_LIMITS, type RoleCapacityLimits } from "./org-config";
import { RoleReadService, type RoleDetail } from "./role-read.service";
import { ROLE_WRITE_DECIDER } from "./role-write-decider";
import { roleCreateData, roleDeleteData, roleUpdateData } from "./role-write-data";

/** api-spec §7 DTO bounds on `capabilities` (the rest is core-domain's). */
const CAPABILITIES_MAX_ITEMS = 64;
const CAPABILITY_KEY_MAX_LENGTH = 64;

const FIELD = {
  nameRequired: "ต้องระบุชื่อบทบาท",
  nameInvalid: "ชื่อบทบาทไม่ถูกต้อง",
  nameForbiddenCharacter: "ชื่อบทบาทมีอักขระที่มองไม่เห็นหรือใช้ไม่ได้",
  nameTooLong: "ชื่อบทบาทยาวเกิน 50 ตัวอักษร",
  capabilitiesInvalid: "รายการสิทธิ์ไม่ถูกต้อง",
  capabilitiesEmpty: "ต้องเลือกสิทธิ์อย่างน้อย 1 อย่าง",
  capabilitiesReserved: "เลือกสิทธิ์ทั้งหมดของร้านไม่ได้",
  capabilitiesUnknown: "มีสิทธิ์ที่เลือกไม่ได้",
  versionInvalid: "ต้องระบุเวอร์ชันของบทบาทที่กำลังแก้",
  nothingToUpdate: "ต้องระบุชื่อหรือรายการสิทธิ์ที่จะแก้",
} as const;

/** Postgres `integer` — a larger `version` cannot match any row, and Prisma would 500 on it. */
const ROLE_VERSION_MAX = 2_147_483_647;

type CreateShape =
  | { readonly ok: true; readonly name: string; readonly capabilities: readonly string[] }
  | { readonly ok: false; readonly fieldErrors: Record<string, string> };

/**
 * api-spec §7 "DTO" row, done HERE rather than by class-validator: the fixed
 * order puts the shape check AFTER the in-tx `manage_roles` floor (a caller who
 * lost the capability gets `FORBIDDEN`, not a form error), and the global pipe
 * would answer before the service ran. Unknown fields are simply never read
 * (`key`, `isSystem`, `version` — AC-1.4).
 */
/**
 * Security review B23 L-1 — a raw-length cap BEFORE `validateRoleName`, which
 * NFC-normalises the string while the org lock is held. 200 code units is far
 * above anything that can normalise down to the 50-code-point rule's limit for
 * a real name, so the answer for a real name is unchanged; a 100 KB string is
 * refused at the shape check instead of being normalised under the lock.
 */
export const ROLE_NAME_RAW_MAX_LENGTH = 200;

/** `name` field of a create/update body, or the field error. */
function nameError(name: unknown): string | null {
  if (typeof name !== "string") return name === undefined ? FIELD.nameRequired : FIELD.nameInvalid;
  if (name.length > ROLE_NAME_RAW_MAX_LENGTH) return FIELD.nameTooLong;
  return null;
}

/** `capabilities` of a create/update body: an array ≤ 64 of strings ≤ 64. */
function capabilitiesListOk(capabilities: unknown): capabilities is string[] {
  return (
    Array.isArray(capabilities) &&
    capabilities.length <= CAPABILITIES_MAX_ITEMS &&
    capabilities.every((k) => typeof k === "string" && k.length <= CAPABILITY_KEY_MAX_LENGTH)
  );
}

export function parseCreateRoleBody(body: unknown): CreateShape {
  const fieldErrors: Record<string, string> = {};
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      fieldErrors: { name: FIELD.nameRequired, capabilities: FIELD.capabilitiesInvalid },
    };
  }
  const { name, capabilities } = body as { name?: unknown; capabilities?: unknown };
  const badName = nameError(name);
  if (badName) fieldErrors.name = badName;
  if (!capabilitiesListOk(capabilities)) fieldErrors.capabilities = FIELD.capabilitiesInvalid;
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return { ok: true, name: name as string, capabilities: capabilities as string[] };
}

export type UpdateShape =
  | {
      readonly ok: true;
      readonly version: number;
      /** Absent = the name does not change. */
      readonly name?: string;
      /** Absent = the capabilities do not change (rename-only). */
      readonly capabilities?: readonly string[];
    }
  | { readonly ok: false; readonly fieldErrors: Record<string, string> };

/**
 * T-003-B24 — `UpdateRoleRequest` (api-spec §2 · §7), checked in the service for
 * the same reason as create: the shape check comes AFTER the in-tx floor and
 * `ROLE_LOCKED`. `version` is required (integer 1..2^31-1); `name` and
 * `capabilities` are optional but at least one must be present — a `null` is a
 * malformed value, not "absent". `key` / `isSystem` are never read (AC-1.4).
 */
export function parseUpdateRoleBody(body: unknown): UpdateShape {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, fieldErrors: { version: FIELD.versionInvalid } };
  }
  const { version, name, capabilities } = body as {
    version?: unknown;
    name?: unknown;
    capabilities?: unknown;
  };
  const fieldErrors: Record<string, string> = {};
  if (
    typeof version !== "number" ||
    !Number.isInteger(version) ||
    version < 1 ||
    version > ROLE_VERSION_MAX
  ) {
    fieldErrors.version = FIELD.versionInvalid;
  }
  if (name !== undefined) {
    const badName = nameError(name);
    if (badName) fieldErrors.name = badName;
  }
  if (capabilities !== undefined && !capabilitiesListOk(capabilities)) {
    fieldErrors.capabilities = FIELD.capabilitiesInvalid;
  }
  if (name === undefined && capabilities === undefined) {
    fieldErrors.name = FIELD.nothingToUpdate;
    fieldErrors.capabilities = FIELD.nothingToUpdate;
  }
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return {
    ok: true,
    version: version as number,
    ...(name !== undefined ? { name: name as string } : {}),
    ...(capabilities !== undefined ? { capabilities: capabilities as string[] } : {}),
  };
}

/** A refusal carried OUT of the locked transaction (nothing written). */
interface CreateRefusal {
  readonly kind: "refused";
  readonly event: EscalationDeniedPayload;
  readonly error: ReturnType<typeof domainError>;
}

/**
 * T-003-B24 — a refusal that is NOT a security event but leaves a warn log
 * (architecture §8 `role_write_refused`): `requires_manage_members` (§1.3) and
 * `ROLE_CHANGED`. Carried out as a value like `CreateRefusal`, logged after.
 */
interface LoggedRefusal {
  readonly kind: "logged";
  readonly reason: "requires_manage_members" | "role_changed";
  readonly error: ReturnType<typeof domainError>;
}

/** api-spec §3 `DeletedRole` — the 200 of DELETE. */
export interface DeletedRole {
  readonly id: string;
  readonly deletedAt: string;
}

/** architecture §8 — warn `role_deleted_rows_high` once a shop's deleted rows reach this share of the cap. */
const DELETED_ROWS_WARN_RATIO = 0.8;

/** The role as PATCH reads it under the lock. */
interface RoleForUpdate {
  id: string;
  name: string;
  key: string | null;
  isSystem: boolean;
  capabilities: string[];
  version: number;
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((k, i) => k === b[i]);

/** Prisma's unique-violation code; on a custom-role INSERT the only unique that can fire is the live name. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * One role as §3.6 publishes it.
 *
 * ⛔ `capabilities` is deliberately ABSENT. It is the field that decides
 * authorization (`full_access` ⇒ Owner), and putting it on a list any active
 * member can read would invite a client to compute permissions from it —
 * exactly the "decide on the client" mistake `isOwner` exists to prevent
 * elsewhere. Nothing on the invite screen needs it: the server refuses an
 * over-privileged invitation itself (C-1/D-028), so the dropdown does not have
 * to filter.
 */
export interface RoleRow {
  readonly id: string;
  readonly name: string;
  /**
   * Stable slug for TRANSLATION ONLY (ux Q4). Guaranteed `owner`/`admin`/`staff`
   * for the three system roles; `null` for anything F-003 lets a user create,
   * because `key` is the system's namespace and a user-editable identifier is
   * something a client would wrongly come to trust.
   *
   * ⛔ Never a permission input — on either side. "Is this the Owner?" is
   * answered by capabilities, never by this string. @qa's I-45 flips a Staff
   * role's key to `"owner"` in the database precisely to prove that.
   */
  readonly key: string | null;
  /**
   * ★ B-9 — the ONE derived bit this list publishes about capabilities.
   *
   * `isOwnerRole(capabilities)`, the same function `toMemberRow` uses for
   * `isOwner`, so there is one answer to "is this ownership?" in the system.
   * Not `key === "owner"`: `key` is a display slug, F-003 lets people mint
   * roles, and I-45 flips a Staff role's key to `"owner"` in the database to
   * prove the two can disagree.
   *
   * Why publishing it does not undo the paragraph above: it says "granting
   * this role grants ownership", which a member can already read off the role's
   * NAME. What it removes is the client's need to guess — §10.1 asks for the
   * Owner option to be shown disabled to an Admin, and before this a non-Owner
   * client could not identify that option at all.
   */
  readonly grantsOwnership: boolean;
  readonly isSystem: boolean;
  /** F-003 (api-spec §4.1, AC-1.5) — `key === null || Role.nameCustomized`. */
  readonly nameCustomized: boolean;
  /**
   * F-003 (AC-2.2) — present ONLY when the caller holds `manage_members`:
   * `decideRoleAssignVisible` = the grant axis the invite / PATCH member write
   * applies. Says nothing about which capability is missing (AC-6.4).
   */
  readonly viewerCanAssign?: boolean;
  readonly assignBlockedReason?: GrantBlockedReason | null;
  /**
   * F-003 · D-039 (api-spec §4.1 · AC-10.3) — hours an invitation with this
   * role would live: `invitationTtlHours(capabilities)`, the SAME function that
   * sets `expiresAt` on create/reissue, so the warning and the link cannot
   * disagree. Never derived from `key`/name.
   *
   * Present ONLY when `viewerCanAssign === true`: the viewer could learn this
   * number anyway by inviting with that role (`expiresAt`), so it reveals
   * nothing about capabilities they could not already see (AC-6.4).
   */
  readonly inviteTtlHours?: number;
}

export interface RoleListPage {
  readonly items: readonly RoleRow[];
  /** Always `null` in F-002 — see the controller. */
  readonly nextCursor: string | null;
}

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  // Explicit @Inject on every parameter — `tsx` emits no `design:paramtypes`.
  constructor(
    @Inject(ORG_PRISMA) private readonly prisma: OrgScopedPrismaClient,
    @Inject(OrgContextStore) private readonly store: OrgContextStore,
    @Inject(SecurityEventsService) private readonly events: SecurityEventsService,
    // architecture §2 — the ONE "who are the owners" query, shared with MembersService.
    @Inject(OrgOwnershipGuard) private readonly ownership: OrgOwnershipGuard,
    // architecture §13.1 seam — production binds `decideRoleWrite` only.
    @Inject(ROLE_WRITE_DECIDER) private readonly decide: RoleWriteDecider,
    @Inject(ROLE_CAPACITY_LIMITS) private readonly limits: RoleCapacityLimits,
    @Inject(RoleReadService) private readonly reads: RoleReadService,
  ) {}

  // ── POST /orgs/{orgId}/roles ─────────────────────────────────────────────

  /**
   * Create a custom role (clone = this request pre-filled — api-spec §1). See
   * the file header for the transaction; `body` is the raw request body on
   * purpose (its shape is checked after the floor, step 3).
   */
  async create(body: unknown): Promise<RoleDetail> {
    const organizationId = this.requireOrganizationId();
    const actorUserId = this.requireUserId();
    const refusal = (
      reason: EscalationDeniedPayload["reason"],
      excessCapabilities: readonly string[],
      error: ReturnType<typeof domainError>,
    ): CreateRefusal => ({
      kind: "refused",
      error,
      event: {
        actorUserId,
        organizationId,
        roleId: null,
        targetUserId: null,
        operation: "create_role",
        reason,
        excessCapabilities,
      },
    });

    let outcome:
      | CreateRefusal
      | {
          readonly kind: "created";
          readonly role: { id: string; name: string; capabilities: string[] };
          readonly detail: RoleDetail;
        };
    try {
      outcome = await runInOrgLockTransaction(
        this.prisma,
        async (tx) => {
          // 1 — the actor as they are NOW, under the lock (AC-5.7 · SR-08).
          const actor = await this.readActor(tx, actorUserId);
          // 2 — floor. The guard checked the ALS snapshot; this is the in-tx re-read.
          if (!hasCapability(actor.capabilities, CAPABILITY_MANAGE_ROLES)) {
            throw domainError("FORBIDDEN");
          }

          // 3 — shape.
          const shape = parseCreateRoleBody(body);
          if (!shape.ok) throw domainError("VALIDATION_FAILED", { fieldErrors: shape.fieldErrors });

          // 4 — name: normalise · Cc/Cf · 1–50 · reserved (AC-3.4/3.5 · SR-04).
          // role-read: live — which system roles still show their translated label.
          const liveSystemRoles = (await tx.role.findMany({
            where: { key: { not: null }, ...LIVE_ROLE_WHERE },
            select: { key: true, nameCustomized: true },
          })) as { key: string | null; nameCustomized: boolean }[];
          const name = validateRoleName(shape.name, { liveSystemRoles, selfKey: null });
          if (!name.ok) {
            if (name.code === "ROLE_NAME_TAKEN") throw domainError("ROLE_NAME_TAKEN");
            throw domainError("VALIDATION_FAILED", {
              fieldErrors: {
                name:
                  name.reason === "forbidden_character"
                    ? FIELD.nameForbiddenCharacter
                    : name.reason === "too_long"
                      ? FIELD.nameTooLong
                      : FIELD.nameRequired,
              },
            });
          }

          // 5 — capabilities, fixed order inside the validator.
          const caps = validateRoleCapabilities(shape.capabilities);
          if (!caps.ok) {
            switch (caps.code) {
              case "ROLE_EMPTY":
                throw domainError("ROLE_EMPTY", {
                  fieldErrors: { capabilities: FIELD.capabilitiesEmpty },
                });
              case "FULL_ACCESS_RESERVED":
                // An escalation signal even from the Owner (arch §7 — only role_locked spares the Owner).
                return refusal(
                  "full_access_reserved",
                  ["full_access"],
                  domainError("FULL_ACCESS_RESERVED", {
                    fieldErrors: { capabilities: FIELD.capabilitiesReserved },
                  }),
                );
              case "UNKNOWN_CAPABILITY":
                throw domainError("UNKNOWN_CAPABILITY", {
                  details: { capabilities: [...caps.capabilities] },
                  fieldErrors: { capabilities: FIELD.capabilitiesUnknown },
                });
              default: {
                const unknown: never = caps;
                throw new Error(`validateRoleCapabilities: unmapped ${JSON.stringify(unknown)}`);
              }
            }
          }

          // 6 — ⊆ actor (AC-5.1). A new role has no holder: `otherActiveHolders: 0`.
          const verdict = this.decide({
            op: "create",
            actorCapabilities: actor.capabilities,
            next: caps.capabilities,
            otherActiveHolders: 0,
          });
          if (!verdict.ok) {
            switch (verdict.reason) {
              case "forbidden":
                // Unreachable after step 2 unless the two floors drift — answer like step 2.
                throw domainError("FORBIDDEN");
              case "exceeds_actor":
                return refusal("exceeds_actor", verdict.excess, domainError("ROLE_EXCEEDS_ACTOR"));
              default:
                // role_locked / requires_manage_members / target_not_below_actor need a target role.
                throw new Error(`decideRoleWrite(create) answered ${verdict.reason}`);
            }
          }

          // 7 — the cap counts LIVE roles, system ones included (AC-3.7 · arch §10).
          // role-read: live — soft-deleted rows do not hold a seat.
          const liveRoles = await tx.role.count({ where: { ...LIVE_ROLE_WHERE } });
          if (liveRoles >= this.limits.maxRolesPerOrg) {
            throw domainError("ROLE_LIMIT_REACHED", {
              details: { limit: this.limits.maxRolesPerOrg },
            });
          }

          // 8 — defensive, BEFORE the write (AC-4.3 · architecture §13.2 (ก)).
          await this.ownership.assertOwnerRemainsInTx(tx, { kind: "role_create" });

          // 9 — the write. `roleCreateData` only accepts the validated brand (G3-02).
          const role = (await tx.role.create({
            data: roleCreateData({
              organizationId,
              name: name.name,
              capabilities: caps.capabilities,
              actorUserId,
              now: new Date(),
            }),
            select: { id: true, name: true, capabilities: true },
          })) as { id: string; name: string; capabilities: string[] };

          // 10 — the 201 body, from the same snapshot, viewer = the actor read in this tx.
          const detail = await this.reads.getDetail(role.id, {
            client: tx,
            viewer: { userId: actorUserId, roleId: actor.roleId, capabilities: actor.capabilities },
          });
          return { kind: "created" as const, role, detail };
        },
        { operation: "createRole" },
      );
    } catch (error) {
      // `Role_org_name_ci_live_key` (normalised, case-insensitive, live only).
      if (isUniqueViolation(error)) throw domainError("ROLE_NAME_TAKEN");
      throw error;
    }

    if (outcome.kind === "refused") {
      await this.events.emitEscalationDenied(outcome.event);
      throw outcome.error;
    }

    // POST-COMMIT (H-3) — ids + name + caps only (AC-9.5).
    this.events.emit("org.role.created", {
      actorUserId,
      organizationId,
      roleId: outcome.role.id,
      name: outcome.role.name,
      capabilities: [...outcome.role.capabilities],
    });
    return outcome.detail;
  }

  // ── PATCH /orgs/{orgId}/roles/{roleId} ───────────────────────────────────

  /**
   * Rename and/or replace the capabilities of a role (api-spec §1/§2 ·
   * architecture §2 "ลำดับใน RolesService.update" · §4 · §6 layer 1).
   *
   *   runInOrgLockTransaction(operation: "updateRole") ─┐
   *    1 role (live, org-scoped)                         │  ⇒ 404 NOT_FOUND
   *    2 actor caps re-read in tx · floor manage_roles   │  ⇒ ORG_ACCESS_DENIED · 403 FORBIDDEN
   *    2b the Owner role                                 │  ⇒ 409 ROLE_LOCKED (+event if not the Owner)
   *    3 body shape                                      │  ⇒ 422 VALIDATION_FAILED
   *    3b name (selfKey = this role's key) · caps        │  ⇒ 422 / 409 ROLE_NAME_TAKEN · ROLE_EMPTY ·
   *                                                      │    FULL_ACCESS_RESERVED(+event) · UNKNOWN_CAPABILITY
   *    4 other active holders (tx) → decideRoleWrite     │  ⇒ ROLE_EXCEEDS_ACTOR(+event) ·
   *                                                      │    ROLE_HELD_REQUIRES_MANAGE_MEMBERS(log) ·
   *                                                      │    TARGET_NOT_BELOW_ACTOR(+event)
   *    4b no-op ⇒ the current RoleDetail                 │  no version check · no write · no event
   *    5 assertOwnerRemains(role_capabilities_change)    │  ⇒ 409 LAST_OWNER (defensive)
   *    6 UPDATE … WHERE id AND version                   │  0 rows ⇒ 409 ROLE_CHANGED · unique ⇒ ROLE_NAME_TAKEN
   *    7 clamp the role's pending links (→ elevated)     │  Invitation UPDATE expiresAt (shorten only)
   *    8 RoleDetail through the same tx                  ┘
   *   post-commit: org.role.updated · or org.role.escalation_denied · or a warn log
   *
   * LOCK ORDER (review B20 L-4 · architecture §3): Organization → Role → Invitation.
   * Nothing after step 6 locks or writes `Membership` — admin-reset takes
   * Membership FOR SHARE → Role FOR SHARE, so a Membership lock here, after the
   * Role row, would be the other half of a deadlock. Steps 4/5 READ Membership
   * (plain reads, no lock) BEFORE the Role write.
   *
   * `ROLE_LOCKED` comes from the decider seam (`ROLE_WRITE_DECIDER`), asked early
   * with `next: "unchanged"` so it answers in its spec slot (before the body is
   * read); only its first two rules (floor / role_locked) are acted on there —
   * the full verdict is taken at step 4 on the validated body. Taking it from the
   * seam is what lets I3-15 / U-API3-01 prove the Owner invariant (step 5) holds
   * on its own when the decider is replaced by one that allows everything.
   */
  async update(roleId: string, body: unknown): Promise<RoleDetail> {
    const organizationId = this.requireOrganizationId();
    const actorUserId = this.requireUserId();
    const refusal = (
      reason: EscalationDeniedPayload["reason"],
      excessCapabilities: readonly string[],
      error: ReturnType<typeof domainError>,
    ): CreateRefusal => ({
      kind: "refused",
      error,
      event: {
        actorUserId,
        organizationId,
        roleId,
        targetUserId: null,
        operation: "update_role",
        reason,
        excessCapabilities,
      },
    });
    const logged = (
      reason: LoggedRefusal["reason"],
      error: LoggedRefusal["error"],
    ): LoggedRefusal => ({
      kind: "logged",
      reason,
      error,
    });

    type Updated = {
      readonly kind: "updated";
      readonly before: { name: string; capabilities: string[] };
      readonly after: { name: string; capabilities: string[] };
      readonly affectedActiveMembers: number;
      readonly invitationsShortened: number;
      readonly detail: RoleDetail;
    };
    let outcome: CreateRefusal | LoggedRefusal | Updated | { kind: "noop"; detail: RoleDetail };
    try {
      outcome = await runInOrgLockTransaction(
        this.prisma,
        async (tx) => {
          // 1 — the role, live and of THIS shop (ORG_PRISMA) — another shop's id is the same 404.
          // role-read: live — a deleted role cannot be edited.
          const role = (await tx.role.findFirst({
            where: { id: roleId, ...LIVE_ROLE_WHERE },
            select: {
              id: true,
              name: true,
              key: true,
              isSystem: true,
              capabilities: true,
              version: true,
            },
          })) as RoleForUpdate | null;
          if (!role) throw domainError("NOT_FOUND");

          // 2 — the actor as they are NOW, under the lock (AC-5.7 · SR-08).
          const actor = await this.readActor(tx, actorUserId);
          if (!hasCapability(actor.capabilities, CAPABILITY_MANAGE_ROLES)) {
            throw domainError("FORBIDDEN");
          }
          const target = { isSystem: role.isSystem, capabilities: role.capabilities };

          // 2b — the decider's first two rules, in their spec slot (see the method doc).
          const early = this.decide({
            op: "update",
            actorCapabilities: actor.capabilities,
            role: target,
            next: UNCHANGED,
            otherActiveHolders: 0,
          });
          if (!early.ok && early.reason === "forbidden") throw domainError("FORBIDDEN");
          if (!early.ok && early.reason === "role_locked")
            return this.lockedRefusal(actor, refusal);

          // 3 — shape.
          const shape = parseUpdateRoleBody(body);
          if (!shape.ok) throw domainError("VALIDATION_FAILED", { fieldErrors: shape.fieldErrors });

          // 3b — name (a system role may take its own label back — selfKey) and caps.
          // A system role may be named back to its OWN translated label (selfKey —
          // a naming policy, never authority; G-12 pins this line as presentation).
          const name =
            shape.name === undefined
              ? role.name
              : await this.validateNameInTx(tx, shape.name, role.key);
          let next: ValidatedCapabilities | typeof UNCHANGED = UNCHANGED;
          if (shape.capabilities !== undefined) {
            const caps = this.validateCapabilitiesOrRefuse(shape.capabilities, refusal);
            if ("kind" in caps) return caps;
            next = caps.capabilities;
          }

          // 4 — other ACTIVE holders, counted under the lock (architecture §1.3 · U-API3-03).
          const otherActiveHolders = await tx.membership.count({
            where: {
              organizationId,
              roleId: role.id,
              status: "active",
              userId: { not: actorUserId },
            },
          });
          const verdict = this.decide({
            op: "update",
            actorCapabilities: actor.capabilities,
            role: target,
            next,
            otherActiveHolders,
          });
          if (!verdict.ok) {
            const refused = this.mapUpdateVerdict(verdict, actor, refusal, logged);
            if (refused) return refused;
          }

          // 4b — no-op: the same normalised name and the same canonical set. AFTER every
          // permission rule (U-API3-05) and BEFORE the version check (api-spec §2 · MUT-18).
          const afterCaps: readonly string[] = next === UNCHANGED ? role.capabilities : next;
          const nameChanged = name !== role.name;
          const capsChanged =
            next !== UNCHANGED && !sameList(canonicalizeCapabilities(role.capabilities), next);
          // api-spec §4.2b — `viewer.*` from the actor caps read in THIS tx (step 2),
          // also when the actor edited their own role: the answer describes the
          // request as it was decided. (Judging it on the new caps would also trip
          // roleDetailViewer's "viewer holds manage_roles" guard on a self-lockout —
          // AC-3.10; the next request sees the new role anyway, AC-6.5.)
          const viewer = {
            userId: actorUserId,
            roleId: actor.roleId,
            capabilities: actor.capabilities,
          };
          if (!nameChanged && !capsChanged) {
            return {
              kind: "noop" as const,
              detail: await this.reads.getDetail(role.id, { client: tx, viewer }),
            };
          }

          // 5 — defensive, BEFORE the write, independent of step 4 (AC-4.3 · architecture §2).
          await this.ownership.assertOwnerRemainsInTx(tx, {
            kind: "role_capabilities_change",
            roleId: role.id,
            newCapabilities: afterCaps,
          });

          // 6 — the write, guarded by the version the user saw (AC-3.12 · architecture §4).
          const written = await tx.role.updateMany({
            where: { id: role.id, version: shape.version, ...LIVE_ROLE_WHERE },
            data: roleUpdateData({
              name: nameChanged ? name : null,
              capabilities: capsChanged && next !== UNCHANGED ? next : null,
              actorUserId,
              now: new Date(),
            }),
          });
          if (written.count === 0) {
            // Under the org lock nobody moved it since step 1: role.version IS current.
            return logged(
              "role_changed",
              domainError("ROLE_CHANGED", { details: { currentVersion: role.version } }),
            );
          }

          // 7 — architecture §6 layer 1: links of a role that BECAME elevated are cut.
          const invitationsShortened =
            capsChanged && !isElevatedRole(role.capabilities) && isElevatedRole(afterCaps)
              ? await this.clampPendingInvitations(tx, role.id, role.capabilities, afterCaps)
              : 0;

          // 8 — the 200 body from the same snapshot.
          return {
            kind: "updated" as const,
            before: { name: role.name, capabilities: [...role.capabilities] },
            after: { name, capabilities: [...afterCaps] },
            affectedActiveMembers: otherActiveHolders + (actor.roleId === role.id ? 1 : 0),
            invitationsShortened,
            detail: await this.reads.getDetail(role.id, { client: tx, viewer }),
          };
        },
        { operation: "updateRole" },
      );
    } catch (error) {
      // `Role_org_name_ci_live_key` (normalised, case-insensitive, live only).
      if (isUniqueViolation(error)) throw domainError("ROLE_NAME_TAKEN");
      throw error;
    }

    switch (outcome.kind) {
      case "refused":
        await this.events.emitEscalationDenied(outcome.event);
        throw outcome.error;
      case "logged":
        // architecture §8 — ids + reason only (no role name, no e-mail).
        this.logger.warn(
          `role_write_refused ${JSON.stringify({
            operation: "updateRole",
            reason: outcome.reason,
            organizationId,
            roleId,
          })}`,
        );
        throw outcome.error;
      case "noop":
        return outcome.detail;
      case "updated":
        // POST-COMMIT (H-3) — ids + role name + caps + counts only (AC-9.5).
        this.events.emit("org.role.updated", {
          actorUserId,
          organizationId,
          roleId,
          before: outcome.before,
          after: outcome.after,
          affectedActiveMembers: outcome.affectedActiveMembers,
          invitationsShortened: outcome.invitationsShortened,
        });
        return outcome.detail;
      default: {
        const unknown: never = outcome;
        throw new Error(`RolesService.update: unmapped outcome ${JSON.stringify(unknown)}`);
      }
    }
  }

  // ── DELETE /orgs/{orgId}/roles/{roleId} ──────────────────────────────────

  /**
   * Soft-delete a role (api-spec §1/§2 · architecture §1.3 "DELETE", §2
   * "RolesService.delete" · data-model §2.2 delete conditions).
   *
   *   runInOrgLockTransaction(operation: "deleteRole") ─┐
   *    1 role (live, org-scoped)                         │  ⇒ 404 NOT_FOUND
   *    2 actor caps re-read in tx · floor manage_roles   │  ⇒ ORG_ACCESS_DENIED · 403 FORBIDDEN
   *    3 other active holders (tx) → decideRoleWrite     │  ⇒ ROLE_LOCKED(+event if not the Owner) ·
   *      (op "delete": floor → role_locked → Owner        │    ROLE_EXCEEDS_ACTOR(+event) ·
   *       bypass → exceeds → held rules)                 │    ROLE_HELD_REQUIRES_MANAGE_MEMBERS(log) ·
   *                                                      │    TARGET_NOT_BELOW_ACTOR(+event)
   *    4 in use: active members (ALL, the actor too) +   │  ⇒ 409 ROLE_IN_USE
   *      pending links (EXPIRED ones too — AC-3.9)       │    { activeMembers, pendingInvitations }
   *    5 deleted-row cap (history read)                  │  ⇒ 409 ROLE_HISTORY_LIMIT_REACHED { limit }
   *    6 assertOwnerRemains(role_delete)                 │  ⇒ 409 LAST_OWNER (defensive)
   *    7 UPDATE … SET deletedAt/By, version+1            ┘  0 rows ⇒ 404 (a writer that skipped the lock)
   *      WHERE id AND deletedAt IS NULL
   *   post-commit: org.role.deleted · or org.role.escalation_denied · or a warn log
   *
   * The held-role rules come BEFORE in-use on purpose (arch §1.3): "move the
   * members out first" would mislead both a designer (who can move nobody) and
   * an actor at the role's level (who may not move its holders). IN_USE comes
   * before the history cap (api-spec §2): the cap is only worth hitting for a
   * role that could otherwise go. No `version` (architecture §4: a delete grants
   * nothing; in-use is decided under the lock).
   *
   * LOCK ORDER (review B20 L-4 · architecture §3): Organization → Role. Steps
   * 3–5 READ Membership/Invitation before the write (plain reads, no row lock);
   * after step 7 nothing touches Membership (the soft-delete trigger's check is
   * a plain read too) — admin-reset takes Membership FOR SHARE → Role FOR SHARE.
   */
  async delete(roleId: string): Promise<DeletedRole> {
    const organizationId = this.requireOrganizationId();
    const actorUserId = this.requireUserId();
    const refusal = (
      reason: EscalationDeniedPayload["reason"],
      excessCapabilities: readonly string[],
      error: ReturnType<typeof domainError>,
    ): CreateRefusal => ({
      kind: "refused",
      error,
      event: {
        actorUserId,
        organizationId,
        roleId,
        targetUserId: null,
        operation: "delete_role",
        reason,
        excessCapabilities,
      },
    });
    const logged = (
      reason: LoggedRefusal["reason"],
      error: LoggedRefusal["error"],
    ): LoggedRefusal => ({ kind: "logged", reason, error });

    type Deleted = {
      readonly kind: "deleted";
      readonly role: { name: string; capabilities: string[] };
      readonly deletedAt: Date;
      readonly deletedRows: number;
    };
    const outcome: CreateRefusal | LoggedRefusal | Deleted = await runInOrgLockTransaction(
      this.prisma,
      async (tx) => {
        // 1 — the role, live and of THIS shop (ORG_PRISMA): another shop's id, an
        // unknown id and an already-deleted role are the same 404 (AC-6.3).
        const role = (await tx.role.findFirst({
          where: { id: roleId, ...LIVE_ROLE_WHERE },
          select: { id: true, name: true, isSystem: true, capabilities: true },
        })) as { id: string; name: string; isSystem: boolean; capabilities: string[] } | null;
        if (!role) throw domainError("NOT_FOUND");

        // 2 — the actor as they are NOW, under the lock (AC-5.7 · SR-08).
        const actor = await this.readActor(tx, actorUserId);
        if (!hasCapability(actor.capabilities, CAPABILITY_MANAGE_ROLES)) {
          throw domainError("FORBIDDEN");
        }

        // 3 — other ACTIVE holders, counted under the lock (architecture §1.3).
        const otherActiveHolders = await tx.membership.count({
          where: {
            organizationId,
            roleId: role.id,
            status: "active",
            userId: { not: actorUserId },
          },
        });
        const verdict = this.decide({
          op: "delete",
          actorCapabilities: actor.capabilities,
          role: { isSystem: role.isSystem, capabilities: role.capabilities },
          otherActiveHolders,
        });
        if (!verdict.ok) return this.mapUpdateVerdict(verdict, actor, refusal, logged);

        // 4 — in use (data-model §2.2): EVERY active holder (the actor too — you
        // cannot delete the role you stand on) and every pending link, expired
        // ones included (AC-3.9). Numbers only on the wire (AC-3.8).
        const activeMembers = await tx.membership.count({
          where: { organizationId, roleId: role.id, status: "active" },
        });
        // `organizationId` explicit, matching the membership count above —
        // ORG_PRISMA scopes it anyway (security review B25 L-3).
        const pendingInvitations = await tx.invitation.count({
          where: { organizationId, roleId: role.id, status: "pending" },
        });
        if (activeMembers > 0 || pendingInvitations > 0) {
          throw domainError("ROLE_IN_USE", { details: { activeMembers, pendingInvitations } });
        }

        // 5 — the soft-delete ceiling (SR-12 · architecture §10): the role stays live.
        // role-read: history — deleted-row cap (data-model §2.2): counts the rows that are gone
        const deletedRows = await tx.role.count({ where: { deletedAt: { not: null } } });
        if (deletedRows >= this.limits.maxDeletedRolesPerOrg) {
          throw domainError("ROLE_HISTORY_LIMIT_REACHED", {
            details: { limit: this.limits.maxDeletedRolesPerOrg },
          });
        }

        // 6 — defensive, BEFORE the write (AC-4.3 · architecture §2 shape 4).
        await this.ownership.assertOwnerRemainsInTx(tx, { kind: "role_delete", roleId: role.id });

        // 7 — the SOFT delete (data-model §2.2): the row stays for history (AC-3.9b).
        const deletedAt = new Date();
        const written = await tx.role.updateMany({
          where: { id: role.id, ...LIVE_ROLE_WHERE },
          data: roleDeleteData({ actorUserId, now: deletedAt }),
        });
        // Under the org lock nobody moved it since step 1 — 0 rows means a writer
        // skipped the lock; answer as if it were already gone.
        if (written.count === 0) throw domainError("NOT_FOUND");

        return {
          kind: "deleted" as const,
          role: { name: role.name, capabilities: [...role.capabilities] },
          deletedAt,
          deletedRows: deletedRows + 1,
        };
      },
      { operation: "deleteRole" },
    );

    switch (outcome.kind) {
      case "refused":
        await this.events.emitEscalationDenied(outcome.event);
        throw outcome.error;
      case "logged":
        // architecture §8 — ids + reason only (no role name, no e-mail).
        this.logger.warn(
          `role_write_refused ${JSON.stringify({
            operation: "deleteRole",
            reason: outcome.reason,
            organizationId,
            roleId,
          })}`,
        );
        throw outcome.error;
      case "deleted":
        // POST-COMMIT (H-3) — ids + role name + caps only (AC-9.5).
        this.events.emit("org.role.deleted", {
          actorUserId,
          organizationId,
          roleId,
          name: outcome.role.name,
          capabilities: outcome.role.capabilities,
        });
        // architecture §8 / §10 — the shop is nearing the ceiling (ids + a count only).
        if (outcome.deletedRows >= this.limits.maxDeletedRolesPerOrg * DELETED_ROWS_WARN_RATIO) {
          this.logger.warn(
            `role_deleted_rows_high ${JSON.stringify({ organizationId, count: outcome.deletedRows })}`,
          );
        }
        return { id: roleId, deletedAt: outcome.deletedAt.toISOString() };
      default: {
        const unknown: never = outcome;
        throw new Error(`RolesService.delete: unmapped outcome ${JSON.stringify(unknown)}`);
      }
    }
  }

  /** `ROLE_LOCKED` — an escalation signal only when the actor is not the Owner (SR-13). */
  private lockedRefusal(
    actor: { capabilities: readonly string[] },
    refusal: (
      reason: EscalationDeniedPayload["reason"],
      excess: readonly string[],
      error: ReturnType<typeof domainError>,
    ) => CreateRefusal,
  ): CreateRefusal {
    if (isOwnerRole(actor.capabilities)) throw domainError("ROLE_LOCKED");
    return refusal("role_locked", [], domainError("ROLE_LOCKED"));
  }

  /** An update / delete verdict → its wire answer (the two routes share the rule set — arch §1.3). */
  private mapUpdateVerdict(
    verdict: Exclude<RoleWriteResult, { ok: true }>,
    actor: { capabilities: readonly string[] },
    refusal: (
      reason: EscalationDeniedPayload["reason"],
      excess: readonly string[],
      error: ReturnType<typeof domainError>,
    ) => CreateRefusal,
    logged: (reason: LoggedRefusal["reason"], error: LoggedRefusal["error"]) => LoggedRefusal,
  ): CreateRefusal | LoggedRefusal {
    switch (verdict.reason) {
      case "forbidden":
        throw domainError("FORBIDDEN");
      case "role_locked":
        return this.lockedRefusal(actor, refusal);
      case "exceeds_actor":
        return refusal("exceeds_actor", verdict.excess, domainError("ROLE_EXCEEDS_ACTOR"));
      case "requires_manage_members":
        // Not a security event (architecture §1.3): the actor already holds ⊇ the role.
        return logged("requires_manage_members", domainError("ROLE_HELD_REQUIRES_MANAGE_MEMBERS"));
      case "target_not_below_actor":
        return refusal(
          "target_not_below_actor",
          verdict.excess,
          domainError("TARGET_NOT_BELOW_ACTOR"),
        );
      default: {
        const unknown: never = verdict;
        throw new Error(`decideRoleWrite(update/delete) answered ${JSON.stringify(unknown)}`);
      }
    }
  }

  /** `validateRoleName` against the live system roles read in `tx` → the normalised name, or throws. */
  private async validateNameInTx(
    tx: OrgLockTx,
    raw: string,
    selfKey: string | null,
  ): Promise<string> {
    // role-read: live — which system roles still show their translated label.
    const liveSystemRoles = (await tx.role.findMany({
      where: { key: { not: null }, ...LIVE_ROLE_WHERE },
      select: { key: true, nameCustomized: true },
    })) as { key: string | null; nameCustomized: boolean }[];
    const name = validateRoleName(raw, { liveSystemRoles, selfKey });
    if (name.ok) return name.name;
    if (name.code === "ROLE_NAME_TAKEN") throw domainError("ROLE_NAME_TAKEN");
    throw domainError("VALIDATION_FAILED", {
      fieldErrors: {
        name:
          name.reason === "forbidden_character"
            ? FIELD.nameForbiddenCharacter
            : name.reason === "too_long"
              ? FIELD.nameTooLong
              : FIELD.nameRequired,
      },
    });
  }

  /** `validateRoleCapabilities` in its fixed order → the brand, a refusal value (with event), or throws. */
  private validateCapabilitiesOrRefuse(
    input: readonly string[],
    refusal: (
      reason: EscalationDeniedPayload["reason"],
      excess: readonly string[],
      error: ReturnType<typeof domainError>,
    ) => CreateRefusal,
  ): { capabilities: ValidatedCapabilities } | CreateRefusal {
    const caps = validateRoleCapabilities(input);
    if (caps.ok) return { capabilities: caps.capabilities };
    switch (caps.code) {
      case "ROLE_EMPTY":
        throw domainError("ROLE_EMPTY", { fieldErrors: { capabilities: FIELD.capabilitiesEmpty } });
      case "FULL_ACCESS_RESERVED":
        return refusal(
          "full_access_reserved",
          ["full_access"],
          domainError("FULL_ACCESS_RESERVED", {
            fieldErrors: { capabilities: FIELD.capabilitiesReserved },
          }),
        );
      case "UNKNOWN_CAPABILITY":
        throw domainError("UNKNOWN_CAPABILITY", {
          details: { capabilities: [...caps.capabilities] },
          fieldErrors: { capabilities: FIELD.capabilitiesUnknown },
        });
      default: {
        const unknown: never = caps;
        throw new Error(`validateRoleCapabilities: unmapped ${JSON.stringify(unknown)}`);
      }
    }
  }

  /**
   * architecture §6 layer 1 — shorten (never extend) the role's PENDING links to
   * `tokenIssuedAt + 24h`. One guarded UPDATE per link that must move: the new
   * value is per row (its own `tokenIssuedAt`), and `expiresAt > new` in the
   * `where` keeps it a LEAST even if a row moved since it was read.
   */
  private async clampPendingInvitations(
    tx: OrgLockTx,
    roleId: string,
    before: readonly string[],
    after: readonly string[],
  ): Promise<number> {
    const pending = (await tx.invitation.findMany({
      where: { roleId, status: "pending" },
      select: { id: true, tokenIssuedAt: true, expiresAt: true },
    })) as { id: string; tokenIssuedAt: Date; expiresAt: Date }[];
    let shortened = 0;
    for (const invitation of pending) {
      const expiresAt = clampedInvitationExpiry({ before, after, invitation });
      if (expiresAt === null) continue;
      const res = await tx.invitation.updateMany({
        where: { id: invitation.id, status: "pending", expiresAt: { gt: expiresAt } },
        data: { expiresAt },
      });
      shortened += res.count;
    }
    return shortened;
  }

  /** The actor's ACTIVE membership in this org, through `tx` (ORG_PRISMA-scoped). */
  private async readActor(
    tx: OrgLockTx,
    actorUserId: string,
  ): Promise<{ roleId: string; capabilities: readonly string[] }> {
    const membership = (await tx.membership.findFirst({
      where: { userId: actorUserId, status: "active" },
      select: { roleId: true, role: { select: { capabilities: true } } },
    })) as { roleId: string; role: { capabilities: string[] } } | null;
    // Refused, not defaulted to `[]`: the caller no longer belongs here.
    if (!membership) throw domainError("ORG_ACCESS_DENIED");
    return { roleId: membership.roleId, capabilities: membership.role.capabilities };
  }

  private requireOrganizationId(): string {
    const ctx = this.store.get();
    if (!ctx?.organizationId) throw domainError("INTERNAL");
    return ctx.organizationId;
  }

  private requireUserId(): string {
    const ctx = this.store.get();
    if (!ctx?.userId) throw domainError("INTERNAL");
    return ctx.userId;
  }

  async list(): Promise<RoleListPage> {
    // The caller's capabilities from the request's org context (read-only
    // verdict — api-spec §3 "viewer.*"). Missing = mis-wired chain: fail loud.
    const viewerCapabilities = this.store.get()?.capabilities;
    if (!viewerCapabilities) throw domainError("INTERNAL");
    const assign = viewerVerdictAudience(viewerCapabilities).assign;

    // No `where` on organizationId: `ORG_PRISMA` applies the tenant filter, and
    // adding a second one here would suggest the client is trustworthy without
    // it. No lock — this decides nothing.
    // role-read: live — GET /roles is the dropdown of roles that can be handed out.
    const rows = (await this.prisma.role.findMany({
      // LIVE (data-model §2.2): a deleted role is not a choice in the dropdown.
      where: { ...LIVE_ROLE_WHERE },
      // `capabilities` is selected and NEVER published — it is read here only
      // to derive `grantsOwnership`, `viewerCanAssign` and `inviteTtlHours` below. The projection
      // at the end is what keeps it off the wire.
      select: {
        id: true,
        name: true,
        key: true,
        isSystem: true,
        capabilities: true,
        nameCustomized: true,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    })) as {
      id: string;
      name: string;
      key: string | null;
      isSystem: boolean;
      capabilities: string[];
      nameCustomized: boolean;
    }[];

    return {
      // Projected field by field. The row also carries `capabilities`, and a
      // spread would publish it — structural typing strips nothing at runtime
      // (the `toMyOrganizationItem` lesson, M-10).
      items: rows.map((row) => {
        const verdict = assign
          ? decideRoleAssignVisible(viewerCapabilities, row.capabilities)
          : null;
        return {
          id: row.id,
          name: row.name,
          key: row.key,
          // Derived, then the array is dropped. `capabilities` must not appear in
          // this object literal — the field-by-field projection is the control.
          grantsOwnership: isOwnerRole(row.capabilities),
          isSystem: row.isSystem,
          nameCustomized: wireNameCustomized(row),
          ...(verdict
            ? { viewerCanAssign: verdict.allowed, assignBlockedReason: verdict.reason }
            : {}),
          // D-039 — only where the viewer may invite with it (AC-6.4). From the
          // capabilities, through the one TTL function — never from `key`.
          ...(verdict?.allowed === true
            ? { inviteTtlHours: invitationTtlHours(row.capabilities) }
            : {}),
        };
      }),
      nextCursor: null,
    };
  }
}
