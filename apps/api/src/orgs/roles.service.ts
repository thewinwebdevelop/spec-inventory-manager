// F-002 · T-002-16b — the role list behind the invite dropdown (api-spec §3.6).
// F-003 · T-003-B23 ★ — `create` (POST /orgs/{orgId}/roles, incl. clone).
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
import { Inject, Injectable } from "@nestjs/common";
import {
  CAPABILITY_MANAGE_ROLES,
  decideRoleAssignVisible,
  hasCapability,
  isOwnerRole,
  validateRoleCapabilities,
  validateRoleName,
  wireNameCustomized,
  viewerVerdictAudience,
  type GrantBlockedReason,
  type RoleWriteDecider,
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
import { roleCreateData } from "./role-write-data";

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
} as const;

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

export function parseCreateRoleBody(body: unknown): CreateShape {
  const fieldErrors: Record<string, string> = {};
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      fieldErrors: { name: FIELD.nameRequired, capabilities: FIELD.capabilitiesInvalid },
    };
  }
  const { name, capabilities } = body as { name?: unknown; capabilities?: unknown };
  if (typeof name !== "string")
    fieldErrors.name = name === undefined ? FIELD.nameRequired : FIELD.nameInvalid;
  else if (name.length > ROLE_NAME_RAW_MAX_LENGTH) fieldErrors.name = FIELD.nameTooLong;
  const listOk =
    Array.isArray(capabilities) &&
    capabilities.length <= CAPABILITIES_MAX_ITEMS &&
    capabilities.every((k) => typeof k === "string" && k.length <= CAPABILITY_KEY_MAX_LENGTH);
  if (!listOk) fieldErrors.capabilities = FIELD.capabilitiesInvalid;
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return { ok: true, name: name as string, capabilities: capabilities as string[] };
}

/** A refusal carried OUT of the locked transaction (nothing written). */
interface CreateRefusal {
  readonly kind: "refused";
  readonly event: EscalationDeniedPayload;
  readonly error: ReturnType<typeof domainError>;
}

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
}

export interface RoleListPage {
  readonly items: readonly RoleRow[];
  /** Always `null` in F-002 — see the controller. */
  readonly nextCursor: string | null;
}

@Injectable()
export class RolesService {
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
      // to derive `grantsOwnership` and `viewerCanAssign` below. The projection
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
        };
      }),
      nextCursor: null,
    };
  }
}
