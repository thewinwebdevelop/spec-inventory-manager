/**
 * T-002-W4 ★ — what the tax card is allowed to show, per tier
 * (ux-wireframe §5 "กติกาการแสดงผล", answering Q13 + D-028/PDPA).
 *
 * The server already withholds `taxIdMasked` from a caller without
 * `manage_org_settings` (api-spec §3.3's three tiers), so this is a second
 * gate on the same rule. That is on purpose, and it is not belt-and-braces
 * theatre: the failure it guards against is a future response shape that
 * starts including a field it previously did not, arriving at a client that
 * renders whatever it is handed. `taxIdMasked` is four real digits of a
 * number that, for `entityType: "personal"`, is a national ID.
 *
 * Two traps the wireframe names explicitly, both encoded here:
 *  - "ไม่มีสิทธิ์: ไม่แสดงตัวเลขใด ๆ **แม้แต่ 4 ตัวท้าย**"
 *  - a client MUST NOT infer "declared" from the presence of a tax field —
 *    `taxProfileComplete` is the only answer to that question.
 */
import type { components } from "@omnistock/contracts";
import {
  can,
  CAPABILITY_FULL_ACCESS,
  CAPABILITY_MANAGE_ORG_SETTINGS,
} from "../../lib/org/capability";

export type OrgProfile = components["schemas"]["OrgProfile"];

/** api-spec §3.3 — the capability that unlocks the tax details. */
export { CAPABILITY_FULL_ACCESS, CAPABILITY_MANAGE_ORG_SETTINGS };

export type TaxCardView =
  /** No declaration yet. `canEdit` decides between the two copies §5 lists. */
  | { readonly kind: "undeclared"; readonly canEdit: boolean }
  /** Declared, but this caller may see no digits — only the VAT fact. */
  | { readonly kind: "summary"; readonly vatRegistered: boolean | null }
  /** Declared, and this caller may see the masked number + the reveal button. */
  | {
      readonly kind: "details";
      readonly entityType: "personal" | "company" | null;
      readonly taxIdMasked: string | null;
      readonly vatRegistered: boolean | null;
      readonly branchCode: string | null;
    };

export function taxCardView(
  profile: OrgProfile,
  capabilities: ReadonlySet<string>,
): TaxCardView {
  // ★ `can`, not `.has` — an Owner holds only `full_access` (see capability.ts).
  const canEdit = can(capabilities, CAPABILITY_MANAGE_ORG_SETTINGS);

  // `taxProfileComplete` decides, NOT the presence of `taxProfile` or of any
  // field inside it. A caller without the capability gets a `taxProfile` that
  // holds only `vatRegistered`, and reading that as "not declared" would tell
  // every Staff member their shop has no tax identity.
  if (!profile.taxProfileComplete) return { kind: "undeclared", canEdit };

  const view = profile.taxProfile;

  if (!canEdit) {
    // Digits are dropped here even if the server sent them. See the note at
    // the top: the point is that a shape change cannot leak them.
    return { kind: "summary", vatRegistered: view?.vatRegistered ?? null };
  }

  return {
    kind: "details",
    entityType: view?.entityType ?? null,
    taxIdMasked: view?.taxIdMasked ?? null,
    vatRegistered: view?.vatRegistered ?? null,
    branchCode: view?.branchCode ?? null,
  };
}

/**
 * The "เริ่มต้นใช้งาน" checklist (§5). Each item appears only while it is
 * still undone, so the card disappears on its own.
 */
export interface OnboardingItems {
  readonly inviteTeam: boolean;
  readonly declareTax: boolean;
  /** D-030 — "ตั้งเจ้าของร้านสำรองอีก 1 คน". */
  readonly inviteBackupOwner: boolean;
}


export function onboardingItems(
  profile: OrgProfile,
  capabilities: ReadonlySet<string>,
): OnboardingItems | null {
  // The whole card is for people who can act on it.
  // ★ `can`, not `.has`: this card was invisible to every Owner, and the
  // backup-owner nudge below is DEFINED for an Owner alone in their shop —
  // it could never have been reached.
  if (!can(capabilities, CAPABILITY_MANAGE_ORG_SETTINGS)) return null;

  const items: OnboardingItems = {
    inviteTeam: profile.counts.activeMembers === 1,
    declareTax: !profile.taxProfileComplete,
    // D-030's inference, spelled out in §5: I hold `full_access` AND I am the
    // only active member ⇒ this shop has exactly one Owner, and it is me.
    // `GET /orgs/{orgId}` carries no Owner count, and the wireframe is
    // explicit about not inventing one here — the multi-member case is warned
    // about on S6 instead.
    inviteBackupOwner:
      capabilities.has(CAPABILITY_FULL_ACCESS) && profile.counts.activeMembers === 1,
  };

  const anything = items.inviteTeam || items.declareTax || items.inviteBackupOwner;
  return anything ? items : null;
}
