// F-003 · T-003-B06 ★ — "may this actor create / edit / delete this role?"
// (architecture §1 row `decideRoleWrite` · §1.3 · §13.6 · D-034 Addendum +
// Addendum 2 · SR-08 · SR-17 · AC-4.1/5.1/5.6/5.8). Pure fn (golden rule #6).
//
// Fixed order (architecture §1.3 "ลำดับใน decideRoleWrite"):
//   0. floor — actor holds `manage_roles` (read in tx)        → `forbidden`
//   1. the Owner role (`isSystem` / holds `full_access`)        → `role_locked`
//   2. actor holds `full_access`                               → ok (bypass, AC-5.6)
//   3. before ⊆ actor ∧ after ⊆ actor (expanded)               → `exceeds_actor`
//   4. update/delete with other active holders:
//        `decideMemberAuthority({op:"write_held_role", target: before})`
//        floor `manage_members`                                → `requires_manage_members`
//        before ⊊ actor                                        → `target_not_below_actor`
//
// Editing a role someone else holds = `change_role` for all of them at once,
// so it is judged on the same two axes as the member route: the ROLE AS IT IS
// (before) must be strictly below the actor, the role as it will be (after)
// only ⊆. Rename-only and no-op edits are NOT short-circuited (N-1).
//
// ⛔ No ⊊ here: the strict comparison lives in `member-authority.ts` only
// (gate G3-05). This file only does ⊆ (via `lostCapabilities`) and delegates.
import {
  CAPABILITY_FULL_ACCESS,
  CAPABILITY_MANAGE_ROLES,
  CAPABILITY_REGISTRY,
  type RegistryLike,
} from "./registry";
import { byKey, expandCapabilities } from "./expand";
import { lostCapabilities } from "./canonical";
import { decideMemberAuthority, type TargetRelation } from "./member-authority";
import type { ValidatedCapabilities } from "./role-validation";

export const ROLE_WRITE_OPS = Object.freeze(["create", "update", "delete"] as const);
export type RoleWriteOp = (typeof ROLE_WRITE_OPS)[number];

/** The role being edited/deleted, as read inside the transaction. */
export interface RoleWriteTarget {
  /** `true` = the Owner role (locked for everyone, the Owner included — AC-4.1). */
  readonly isSystem: boolean;
  /** Capabilities BEFORE the write. */
  readonly capabilities: readonly string[];
}

interface Actor {
  /** Capabilities of the actor's CURRENT role, read inside the transaction (SR-08 · AC-5.7). */
  readonly actorCapabilities: readonly string[];
}

declare const unchangedBrand: unique symbol;

/**
 * "The role's capabilities stay as they are" — the `next` of a rename-only
 * PATCH (and of the `viewer.canEdit` verdict). Built only by
 * {@link unchangedCapabilities}; stored caps cannot be re-validated into
 * `ValidatedCapabilities` (a key may have become non-selectable since), and
 * must not be cast into it (G3-02). Accepted on `update` only.
 */
export type UnchangedCapabilities = readonly string[] & { readonly [unchangedBrand]: true };

/** The explicit rename-only `next`: a frozen copy of the role's current capabilities. */
export function unchangedCapabilities(role: RoleWriteTarget): UnchangedCapabilities {
  return Object.freeze([...role.capabilities]) as unknown as UnchangedCapabilities;
}

/**
 * Discriminated by `op`. `otherActiveHolders` is REQUIRED (no default 0): the
 * call site must count active memberships of this role whose user is not the
 * actor (architecture §1.3 "นับผู้ถือ"). A new role has no holder — `0` literal.
 *
 * `next` (fix round 1 — security review M-1 · L-1; tightens architecture §1's
 * `next?`) is REQUIRED on create and update and must be validated
 * (`validateRoleCapabilities`) — or `unchangedCapabilities(role)` for a
 * rename-only update. A forgotten / unvalidated `next` does not compile, and at
 * runtime a missing one throws instead of skipping the after-⊆ check.
 */
export type RoleWriteInput =
  | (Actor & {
      readonly op: "create";
      /** Capabilities of the new role (clone = the source role's, validated). */
      readonly next: ValidatedCapabilities;
      readonly otherActiveHolders: 0;
    })
  | (Actor & {
      readonly op: "update";
      readonly role: RoleWriteTarget;
      /** Capabilities AFTER the write. Rename-only: `unchangedCapabilities(role)`. */
      readonly next: ValidatedCapabilities | UnchangedCapabilities;
      readonly otherActiveHolders: number;
    })
  | (Actor & {
      readonly op: "delete";
      readonly role: RoleWriteTarget;
      readonly otherActiveHolders: number;
    });

export type RoleWriteResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      /** `forbidden` — no `manage_roles` (`excess` = that key) · `exceeds_actor` — before/after ⊄ actor. */
      readonly reason: "forbidden" | "exceeds_actor";
      readonly excess: string[];
    }
  | {
      readonly ok: false;
      /** `role_locked` — the Owner role · `requires_manage_members` — held by others, actor lacks `manage_members`. */
      readonly reason: "role_locked" | "requires_manage_members";
    }
  | {
      readonly ok: false;
      readonly reason: "target_not_below_actor";
      /** Always `equal` on this route (⊆ already passed) — kept for the event payload. */
      readonly relation: TargetRelation;
      readonly excess: string[];
    };

const OK: RoleWriteResult = Object.freeze({ ok: true });

function fail(op: string, message: string): never {
  throw new Error(`decideRoleWrite(${op}): ${message}`);
}

/** Validates the shape a call site that bypassed the type could still send — fail loud, never "allowed". */
function readInput(input: RoleWriteInput): {
  before: readonly string[] | null;
  after: readonly string[] | null;
  role: RoleWriteTarget | null;
  holders: number;
} {
  const op = input.op as string;
  if (!(ROLE_WRITE_OPS as readonly string[]).includes(op)) {
    throw new Error(`decideRoleWrite: unknown op ${JSON.stringify(op)}`);
  }
  if (!Array.isArray(input.actorCapabilities)) fail(op, "actorCapabilities is required");
  const holders = (input as { otherActiveHolders?: unknown }).otherActiveHolders;
  if (typeof holders !== "number" || !Number.isInteger(holders) || holders < 0) {
    fail(op, "otherActiveHolders is required and must be a non-negative integer");
  }
  if (input.op === "create") {
    if (holders !== 0) fail(op, "otherActiveHolders must be 0 — a new role has no holder");
    if (!Array.isArray(input.next)) fail(op, "next is required");
    return { before: null, after: input.next, role: null, holders };
  }
  const role = (input as { role?: RoleWriteTarget }).role;
  if (!role || typeof role.isSystem !== "boolean" || !Array.isArray(role.capabilities)) {
    fail(op, "role { isSystem, capabilities } is required");
  }
  if (input.op === "delete") return { before: role.capabilities, after: null, role, holders };
  // M-1: no default — a forgotten `next` must not read as "unchanged" and skip the after-⊆ leg.
  if (!Array.isArray(input.next)) {
    fail(op, "next is required (rename-only: pass unchangedCapabilities(role))");
  }
  return { before: role.capabilities, after: input.next, role, holders };
}

export function decideRoleWrite(
  input: RoleWriteInput,
  registry: RegistryLike = CAPABILITY_REGISTRY,
): RoleWriteResult {
  const { before, after, role, holders } = readInput(input);
  const actor = input.actorCapabilities;

  // (0) floor `manage_roles` (SR-08) — expanded, so the Owner's `full_access` counts.
  if (!expandCapabilities(actor, registry).includes(CAPABILITY_MANAGE_ROLES)) {
    return { ok: false, reason: "forbidden", excess: [CAPABILITY_MANAGE_ROLES] };
  }

  // (1) the Owner role is locked for every caller, the Owner included (AC-4.1).
  if (role !== null && (role.isSystem || role.capabilities.includes(CAPABILITY_FULL_ACCESS))) {
    return { ok: false, reason: "role_locked" };
  }

  // (2) Owner bypass — explicit, never through expansion (SR-11).
  if (actor.includes(CAPABILITY_FULL_ACCESS)) return OK;

  // (3) before ⊆ actor ∧ after ⊆ actor (AC-5.1). `lostCapabilities(x, actor)` = expand(x) \ expand(actor).
  const excess = new Set<string>();
  for (const side of [before, after]) {
    if (side !== null) for (const k of lostCapabilities(side, actor, registry)) excess.add(k);
  }
  if (excess.size > 0) {
    return { ok: false, reason: "exceeds_actor", excess: [...excess].sort(byKey) };
  }

  // (4) held by someone else ⇒ the change_role rule for all holders at once (§1.3).
  if (before !== null && holders > 0) {
    const verdict = decideMemberAuthority(
      {
        op: "write_held_role",
        actorCapabilities: actor,
        actorIsTarget: false,
        targetCurrentCapabilities: before,
      },
      registry,
    );
    if (verdict.ok) return OK;
    switch (verdict.reason) {
      case "forbidden":
        return { ok: false, reason: "requires_manage_members" };
      case "target_not_below_actor":
        return {
          ok: false,
          reason: "target_not_below_actor",
          relation: verdict.relation,
          excess: verdict.excess,
        };
      default:
        // `owner_only` / `exceeds_actor` cannot happen for `write_held_role` after (1)–(3).
        fail(input.op, `unexpected write_held_role refusal ${JSON.stringify(verdict.reason)}`);
    }
  }

  return OK;
}
