/**
 * T-002-W5 ★ — what the `⋯` menu on a member row may offer
 * (ux-wireframe §7's table), as a pure function.
 *
 * ⛔ This is UX, never enforcement. The server refuses the call regardless
 * (C-1/D-028 run inside the org lock, on capabilities read in the same
 * transaction). Every action hidden here still has an error path, because the
 * client's picture of who holds what is always a little bit old.
 *
 * It is a pure function rather than JSX conditionals for one reason: the table
 * has three axes (am I an Owner · is the TARGET an Owner · is the target me)
 * and the interesting cells are the ones that are easy to get backwards. An
 * Admin who could offer "change role" on an Owner would be showing a button
 * that produces a 403 — and, worse, would be telling a Staff-facing UI that
 * ownership is editable by someone who cannot edit it.
 *
 * ── Ownership is decided by CAPABILITIES ──────────────────────────────────
 * `full_access`, never `roleName`/`roleKey`. `roleKey` is an open set that
 * F-003 lets people create, and @qa's I-45 flips a Staff role's key to
 * `"owner"` in the database precisely to prove nothing reads it.
 */

// The names come from `lib/org/capability.ts`, which re-exports core-domain's
// — one place per platform for both the rule and the strings it is asked about.
import { CAPABILITY_FULL_ACCESS, CAPABILITY_MANAGE_MEMBERS } from "../../lib/org/capability";

export { CAPABILITY_FULL_ACCESS, CAPABILITY_MANAGE_MEMBERS };

export interface MemberActionInput {
  /** The viewer's capabilities in THIS shop (`myMembership.capabilities`). */
  readonly myCapabilities: ReadonlySet<string>;
  /**
   * `MemberRow.isOwner` — decided SERVER-side from capabilities, never from a
   * role name or key (api-spec §3.7 says so on the field).
   *
   * Taken as a boolean rather than re-derived here because the member list
   * deliberately does not publish `capabilities` — the same choice
   * `GET /orgs/{orgId}/roles` makes. Handing every reader the capability set
   * of every colleague, so each could recompute "is this an Owner", is exactly
   * the client-side authorization the server avoids by answering the question
   * itself.
   */
  readonly targetIsOwner: boolean;
  /** `MemberRow.isMe` — also decided server-side, so no id comparison here. */
  readonly isSelf: boolean;
  /** `active` rows only get actions (§7: a removed row has none). */
  readonly targetStatus: string;
}

export interface MemberActions {
  readonly changeRole: boolean;
  readonly removeFromOrg: boolean;
  /** §3.17/D-029 — only ever on your OWN row, and available to every member. */
  readonly leaveOrg: boolean;
  /**
   * When an Admin looks at an Owner: no menu, plus the explaining line. §7
   * asks for the sentence rather than a disabled item, so the user learns why
   * instead of wondering.
   */
  readonly ownerOnlyNotice: boolean;
}

const NONE: MemberActions = Object.freeze({
  changeRole: false,
  removeFromOrg: false,
  leaveOrg: false,
  ownerOnlyNotice: false,
});

export function isOwner(capabilities: Iterable<string>): boolean {
  for (const c of capabilities) if (c === CAPABILITY_FULL_ACCESS) return true;
  return false;
}

export function memberActionsFor(input: MemberActionInput): MemberActions {
  // A row that is not an active member is a record, not a person you can act
  // on (§7: revoked rows are dimmed and carry no menu).
  if (input.targetStatus !== "active") return NONE;

  const iAmOwner = isOwner(input.myCapabilities);
  const targetIsOwner = input.targetIsOwner;

  if (input.isSelf) {
    // Your own row: change your own role, and leave. `leaveOrg` does NOT
    // require `manage_members` — D-029 gives it to every active member, which
    // is why the affordance also lives on S4 where Staff can reach it.
    return {
      changeRole: true,
      removeFromOrg: false,
      leaveOrg: true,
      ownerOnlyNotice: false,
    };
  }

  if (targetIsOwner && !iAmOwner) {
    // C-1: touching somebody who holds `full_access` requires holding it.
    // No menu at all, and a sentence saying why.
    return { ...NONE, ownerOnlyNotice: true };
  }

  // An Admin may act on an ordinary member — including changing their role,
  // though not TO Owner. That second half is not expressible here (it is about
  // the role being granted, not the target), so it belongs to the role picker:
  // see `assignableRoles`.
  return {
    changeRole: true,
    removeFromOrg: true,
    leaveOrg: false,
    ownerOnlyNotice: false,
  };
}

/**
 * Which roles this viewer may put on somebody — the OTHER half of C-1.
 *
 * `memberActionsFor` answers "may I touch this person"; this answers "may I
 * hand out this role". Granting `full_access` is granting ownership, so only
 * an Owner may offer it. Same rule as the server's `canAssignRole`, and the
 * same reason it is a separate question: an Admin editing a Staff member is
 * allowed, right up until the role they pick is Owner.
 */
export function assignableRoles<T extends { readonly id: string; readonly key: string | null }>(
  roles: readonly T[],
  myCapabilities: ReadonlySet<string>,
  ownerRoleIds: ReadonlySet<string>,
): readonly T[] {
  if (isOwner(myCapabilities)) return roles;
  return roles.filter((role) => !ownerRoleIds.has(role.id));
}
