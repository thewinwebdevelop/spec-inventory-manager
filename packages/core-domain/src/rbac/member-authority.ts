// F-003 · T-003-B05 ★ — the ONE rule for "may this actor touch this person /
// hand out this role?" (architecture §1.1 · D-034 + Addendum/Addendum 2 ·
// D-035 P2 · SR-F003-01 · AC-5.3/5.4/5.6/5.8). Pure fn (golden rule #6).
//
// Two axes in one function, so no call site can pick "the other one":
//   • TARGET ⊊ — the person being changed/removed/reset (or the role being
//     rewritten while someone else holds it) must hold STRICTLY LESS than the
//     actor. Equal is refused: otherwise Admin A demotes Admin B to Staff, then
//     resets B's password and walks in as B (the D-034 attack).
//   • GRANT ⊆ — a role handed out (PATCH, invite, reissue, cancel, accept
//     re-check) must not exceed the actor. Equal is fine: an Admin may invite
//     another Admin.
//
// Every comparison runs on EXPANDED sets (`expandCapabilities`), so
// `manage_X → view_X` is honoured and an unknown key is kept (it makes the
// comparison fail — SR-11 fail-closed). The Owner (`full_access`) passes
// through an explicit bypass, never through expansion.
//
// ⛔ `isProperSubset` is called in THIS file only (gate G3-05). Anything else
// that needs "is the target below the actor?" calls `decideMemberAuthority`.
import {
  CAPABILITY_FULL_ACCESS,
  CAPABILITY_MANAGE_MEMBERS,
  CAPABILITY_REGISTRY,
  type RegistryLike,
} from "./registry";
import { expandCapabilities } from "./expand";

/** architecture §1.1 — the 8 operations that touch a person or hand out a role. */
export const MEMBER_AUTHORITY_OPS = Object.freeze([
  "change_role",
  "remove",
  "reset_password",
  "invite_create",
  "invite_reissue",
  "invite_cancel",
  "invite_accept_recheck",
  "write_held_role",
] as const);
export type MemberAuthorityOp = (typeof MEMBER_AUTHORITY_OPS)[number];

interface Actor {
  /** Capabilities of the actor's CURRENT role, read inside the transaction (AC-5.7). */
  readonly actorCapabilities: readonly string[];
  /**
   * `true` only for PATCH/DELETE `/members/{yourself}` — computed by the service
   * from the authenticated user id, never taken from the request. It relaxes the
   * target axis for `change_role` and `remove` ONLY.
   */
  readonly actorIsTarget: boolean;
}

/**
 * Discriminated by `op`, so each call site must supply exactly the axis its op
 * is judged on (a missing axis would otherwise read as "nothing to check").
 */
export type MemberAuthorityInput =
  | (Actor & {
      readonly op: "change_role";
      /** The target's CURRENT role (target axis). */
      readonly targetCurrentCapabilities: readonly string[];
      /** The role being given (grant axis). */
      readonly grantCapabilities: readonly string[];
    })
  | (Actor & {
      /** `write_held_role`: target = the role's capabilities BEFORE the edit. */
      readonly op: "remove" | "reset_password" | "write_held_role";
      readonly targetCurrentCapabilities: readonly string[];
    })
  | (Actor & {
      readonly op: "invite_create" | "invite_reissue" | "invite_cancel" | "invite_accept_recheck";
      /** The invitation's role. */
      readonly grantCapabilities: readonly string[];
    });

export type TargetRelation = "equal" | "superset" | "incomparable";

export type MemberAuthorityResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      /**
       * `forbidden`   — the actor lacks the `manage_members` floor (`excess` = that key).
       * `owner_only`  — an Owner is touched/granted and the actor is not one (`excess` = `full_access`).
       * `exceeds_actor` — grant ⊄ actor (`excess` = what the role has that the actor lacks).
       */
      readonly reason: "forbidden" | "owner_only" | "exceeds_actor";
      readonly excess: string[];
    }
  | {
      readonly ok: false;
      readonly reason: "target_not_below_actor";
      readonly relation: TargetRelation;
      /** `expand(target) \ expand(actor)`, sorted; `[]` when `equal`. */
      readonly excess: string[];
    };

const OK: MemberAuthorityResult = Object.freeze({ ok: true });

/** Which ops are judged on which axis (architecture §1.1 table). */
const TARGET_AXIS: ReadonlySet<MemberAuthorityOp> = new Set([
  "change_role",
  "remove",
  "reset_password",
  "write_held_role",
]);
const GRANT_AXIS: ReadonlySet<MemberAuthorityOp> = new Set([
  "change_role",
  "invite_create",
  "invite_reissue",
  "invite_cancel",
  "invite_accept_recheck",
]);
/** Self-exemption from the target axis: your own membership, PATCH/DELETE only. Reset is never relaxed (High-2). */
const SELF_EXEMPT: ReadonlySet<MemberAuthorityOp> = new Set(["change_role", "remove"]);
/** `write_held_role` has no Owner-only step: the Owner role is `role_locked` before it gets here. */
const OWNER_ONLY_CHECKED: ReadonlySet<MemberAuthorityOp> = new Set(
  MEMBER_AUTHORITY_OPS.filter((op) => op !== "write_held_role"),
);

/** "Is this an Owner role?" — the literal key, as `isOwnerRole` reads it (data-model §5.2). */
const holdsFullAccess = (caps: readonly string[]) => caps.includes(CAPABILITY_FULL_ACCESS);

/** Keys of expanded `a` that expanded `b` lacks, sorted (expand output is already sorted). */
function missingFrom(a: readonly string[], b: readonly string[], registry: RegistryLike): string[] {
  const eb = new Set(expandCapabilities(b, registry));
  return expandCapabilities(a, registry).filter((k) => !eb.has(k));
}

/** a ⊆ b, both sides expanded. Module-private. */
function isSubset(a: readonly string[], b: readonly string[], registry: RegistryLike): boolean {
  return missingFrom(a, b, registry).length === 0;
}

/** a ⊊ b, both sides expanded. Module-private — gate G3-05 allows calls in this file only. */
function isProperSubset(
  a: readonly string[],
  b: readonly string[],
  registry: RegistryLike,
): boolean {
  return isSubset(a, b, registry) && !isSubset(b, a, registry);
}

function relationOf(
  target: readonly string[],
  actor: readonly string[],
  registry: RegistryLike,
): TargetRelation {
  if (isSubset(target, actor, registry)) return "equal"; // ⊆ ∧ ¬⊊ ⇒ equal
  return isSubset(actor, target, registry) ? "superset" : "incomparable";
}

function requireSet(
  input: MemberAuthorityInput,
  field: "targetCurrentCapabilities" | "grantCapabilities",
) {
  const value = (input as unknown as Record<string, unknown>)[field];
  if (!Array.isArray(value)) {
    // Fail loud (BUILD-RULES): a call site that forgot an axis must not be read as "allowed".
    throw new Error(`decideMemberAuthority(${input.op}): ${field} is required`);
  }
  return value as readonly string[];
}

/**
 * The fixed order (architecture §1.1):
 *  1. floor — actor holds `manage_members` (expanded) → else `forbidden`
 *  2. Owner-only — target or granted role holds `full_access` and the actor does not → `owner_only`
 *  3. actor holds `full_access` → `ok` (explicit bypass — SR-11)
 *  4. target axis — `¬actorIsTarget(for PATCH/DELETE) ∧ ¬(target ⊊ actor)` → `target_not_below_actor`
 *  5. grant axis — `¬(grant ⊆ actor)` → `exceeds_actor`
 *
 * 1 and 2 come first so that every case F-002's `canAssignRole` refused still
 * maps to the same `403 FORBIDDEN` (api-spec §4.3 "ลำดับ code").
 */
export function decideMemberAuthority(
  input: MemberAuthorityInput,
  registry: RegistryLike = CAPABILITY_REGISTRY,
): MemberAuthorityResult {
  const { op, actorCapabilities: actor } = input;
  if (!(MEMBER_AUTHORITY_OPS as readonly string[]).includes(op)) {
    throw new Error(`decideMemberAuthority: unknown op ${JSON.stringify(op)}`);
  }
  const target = TARGET_AXIS.has(op) ? requireSet(input, "targetCurrentCapabilities") : null;
  const grant = GRANT_AXIS.has(op) ? requireSet(input, "grantCapabilities") : null;

  // (1) floor
  if (!expandCapabilities(actor, registry).includes(CAPABILITY_MANAGE_MEMBERS)) {
    return { ok: false, reason: "forbidden", excess: [CAPABILITY_MANAGE_MEMBERS] };
  }
  const actorIsOwner = holdsFullAccess(actor);

  // (2) Owner-only (D-030)
  if (
    OWNER_ONLY_CHECKED.has(op) &&
    !actorIsOwner &&
    ((target !== null && holdsFullAccess(target)) || (grant !== null && holdsFullAccess(grant)))
  ) {
    return { ok: false, reason: "owner_only", excess: [CAPABILITY_FULL_ACCESS] };
  }

  // (3) Owner bypass
  if (actorIsOwner) return OK;

  // (4) target ⊊ actor
  const selfExempt = input.actorIsTarget && SELF_EXEMPT.has(op);
  if (target !== null && !selfExempt && !isProperSubset(target, actor, registry)) {
    return {
      ok: false,
      reason: "target_not_below_actor",
      relation: relationOf(target, actor, registry),
      excess: missingFrom(target, actor, registry),
    };
  }

  // (5) grant ⊆ actor
  if (grant !== null && !isSubset(grant, actor, registry)) {
    return { ok: false, reason: "exceeds_actor", excess: missingFrom(grant, actor, registry) };
  }

  return OK;
}
