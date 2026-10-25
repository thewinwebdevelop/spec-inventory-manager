// F-003 · T-003-B21 — what the role READ routes publish (api-spec §3 · AC-6.4 ·
// AC-7.4 · AC-9.6 · D-037). Pure fns (golden rule #6).
//
// `viewer.*` is a UX input, never enforcement: every write re-reads the actor
// in its transaction (AC-5.7). It is computed with the SAME `decideRoleWrite`
// the write path uses, so a verdict and the real refusal cannot disagree, and
// every input is something the viewer can already read (AC-6.4 — not an oracle).
import { CAPABILITY_GROUPS, CAPABILITY_REGISTRY, type CapabilityDef } from "./registry";
import { decideRoleWrite, type RoleWriteResult, type RoleWriteTarget } from "./role-write";

/** `{ allowed, reason }` — `reason` is an OPEN SET on the wire (api-spec §3). */
export interface RoleWriteVerdict {
  readonly allowed: boolean;
  readonly reason: string | null;
}

export interface RoleDetailViewerInput {
  /** `ROLE_WRITES_ENABLED` (architecture §12) — off ⇒ `writes_disabled` outranks everything. */
  readonly writesEnabled: boolean;
  /** The viewer's capabilities from the request's org context (read-only route). */
  readonly actorCapabilities: readonly string[];
  readonly role: RoleWriteTarget;
  /** Active holders of this role who are NOT the viewer (architecture §1.3). */
  readonly otherActiveHolders: number;
  /** The same numbers `RoleDetail.usage` publishes. */
  readonly usage: { readonly activeMembers: number; readonly pendingInvitations: number };
  readonly liveRoleCount: number;
  readonly maxRoles: number;
  readonly deletedRoleCount: number;
  readonly maxDeletedRoles: number;
}

export interface RoleDetailViewer {
  readonly canEdit: RoleWriteVerdict;
  readonly canDelete: RoleWriteVerdict;
  readonly canClone: RoleWriteVerdict;
}

export type RoleWriteDecider = typeof decideRoleWrite;

const ALLOWED: RoleWriteVerdict = Object.freeze({ allowed: true, reason: null });
const refuse = (reason: string): RoleWriteVerdict => Object.freeze({ allowed: false, reason });
const WRITES_DISABLED = refuse("writes_disabled");

function count(name: string, n: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`roleDetailViewer: ${name} must be a non-negative integer (got ${n})`);
  }
  return n;
}

/** decider refusal → wire reason (api-spec §3 fixed order = the decider's order). */
function fromDecision(result: RoleWriteResult, lockedAs: string): RoleWriteVerdict | null {
  if (result.ok) return null;
  switch (result.reason) {
    case "role_locked":
      return refuse(lockedAs);
    case "exceeds_actor":
      return refuse("exceeds_your_permissions");
    case "requires_manage_members":
      return refuse("in_use_requires_manage_members");
    case "target_not_below_actor":
      return refuse("equal_permissions_in_use");
    case "forbidden":
      // The route is gated on `manage_roles`; reaching this means the guard and
      // the context disagree — never paper over it with a "false".
      throw new Error("roleDetailViewer: viewer lacks manage_roles — the route guard was bypassed");
  }
}

/**
 * api-spec §3 `RoleDetail.viewer`. Order per verdict (first match wins):
 *   canEdit   writes_disabled → role_locked → exceeds → in_use_requires_mm → equal_in_use
 *   canDelete …same… → in_use → history_limit_reached
 *   canClone  writes_disabled → owner_role → exceeds → role_limit_reached
 *
 * Edit asks the decider with `next: "unchanged"` (the role as it is is what the
 * viewer could save without touching a checkbox). Clone asks "is the SOURCE ⊆
 * me" — the same question with nobody holding the new role — so the stored
 * caps are judged as stored, not passed off as `ValidatedCapabilities`.
 */
export function roleDetailViewer(
  input: RoleDetailViewerInput,
  decide: RoleWriteDecider = decideRoleWrite,
): RoleDetailViewer {
  const holders = count("otherActiveHolders", input.otherActiveHolders);
  const active = count("usage.activeMembers", input.usage.activeMembers);
  const pending = count("usage.pendingInvitations", input.usage.pendingInvitations);
  const live = count("liveRoleCount", input.liveRoleCount);
  const deleted = count("deletedRoleCount", input.deletedRoleCount);
  const { actorCapabilities, role } = input;

  const edit = decide({
    op: "update",
    actorCapabilities,
    role,
    next: "unchanged",
    otherActiveHolders: holders,
  });
  const del = decide({ op: "delete", actorCapabilities, role, otherActiveHolders: holders });
  const clone = decide({
    op: "update",
    actorCapabilities,
    role,
    next: "unchanged",
    otherActiveHolders: 0,
  });

  // Decided even when the flag is off: a `forbidden` must still fail loud.
  const canEdit = fromDecision(edit, "role_locked") ?? ALLOWED;
  const canDelete =
    fromDecision(del, "role_locked") ??
    (active + pending > 0
      ? refuse("in_use")
      : deleted >= input.maxDeletedRoles
        ? refuse("history_limit_reached")
        : ALLOWED);
  const canClone =
    fromDecision(clone, "owner_role") ??
    (live >= input.maxRoles ? refuse("role_limit_reached") : ALLOWED);

  if (!input.writesEnabled) {
    return { canEdit: WRITES_DISABLED, canDelete: WRITES_DISABLED, canClone: WRITES_DISABLED };
  }
  return { canEdit, canDelete, canClone };
}

/** api-spec §3 `RoleDetailListPage.viewer`. */
export function roleListViewer(input: {
  readonly writesEnabled: boolean;
  readonly liveRoleCount: number;
  readonly maxRoles: number;
}): { readonly canCreate: RoleWriteVerdict; readonly limit: number } {
  const live = count("liveRoleCount", input.liveRoleCount);
  const canCreate = !input.writesEnabled
    ? WRITES_DISABLED
    : live >= input.maxRoles
      ? refuse("role_limit_reached")
      : ALLOWED;
  return { canCreate, limit: input.maxRoles };
}

// ── GET /capabilities ──────────────────────────────────────────────────────

export interface CapabilityCatalogEntry {
  readonly key: string;
  readonly labelTh: string;
  readonly descriptionTh: string;
  readonly group: string | null;
  readonly status: string;
  readonly implies: string[];
  readonly selectable: boolean;
}

export interface CapabilityCatalogView {
  readonly groups: { readonly key: string; readonly labelTh: string }[];
  readonly items: CapabilityCatalogEntry[];
}

/**
 * The catalog a shop sees. Tier `full` is HIDDEN, not flagged (AC-7.4 — the
 * F-007 entitlement decides it later); `tier` and `scope` stay internal.
 * Projected field by field into fresh arrays: the registry is frozen and shared.
 */
export function capabilityCatalog(
  registry: readonly CapabilityDef[] = CAPABILITY_REGISTRY,
  groups: readonly { readonly key: string; readonly labelTh: string }[] = CAPABILITY_GROUPS,
): CapabilityCatalogView {
  return {
    groups: groups.map((g) => ({ key: g.key, labelTh: g.labelTh })),
    items: registry
      .filter((c) => c.tier !== "full")
      .map((c) => ({
        key: c.key,
        labelTh: c.labelTh,
        descriptionTh: c.descriptionTh,
        group: c.group,
        status: c.status,
        implies: [...c.implies],
        selectable: c.selectable,
      })),
  };
}

// ── display rule + lastEdited.by ───────────────────────────────────────────

/** data-model AC-1.5 row: on the wire `nameCustomized = key === null || column`. */
export function wireNameCustomized(role: {
  readonly key: string | null;
  readonly nameCustomized: boolean;
}): boolean {
  return role.key === null || role.nameCustomized;
}

export type LastEditedBy =
  | { readonly kind: "me" }
  | { readonly kind: "former_member" }
  | {
      readonly kind: "member";
      readonly roleName: string;
      readonly roleKey: string | null;
      readonly roleNameCustomized: boolean;
    };

/**
 * AC-9.6 — decided at READ time. `editorMembership` must be the editor's
 * ACTIVE membership in THIS shop (read through the org-scoped client — SR-09),
 * or `null`: active elsewhere / revoked / deleted user are all `former_member`
 * and carry nothing about any role.
 */
export function lastEditedBy(input: {
  readonly editorUserId: string | null;
  readonly viewerUserId: string;
  readonly editorMembership: {
    readonly role: {
      readonly name: string;
      readonly key: string | null;
      readonly nameCustomized: boolean;
    };
  } | null;
}): LastEditedBy | null {
  if (input.editorUserId === null) return null;
  if (input.editorUserId === input.viewerUserId) return { kind: "me" };
  if (input.editorMembership === null) return { kind: "former_member" };
  const { role } = input.editorMembership;
  return {
    kind: "member",
    roleName: role.name,
    roleKey: role.key,
    roleNameCustomized: wireNameCustomized(role),
  };
}
