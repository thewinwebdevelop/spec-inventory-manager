// F-002 · T-002-16 — the org profile as the WIRE sees it (api-spec §3.3/§3.4).
//
// TWO DECISIONS LIVE HERE, both of which would be wrong to leave in a controller:
//
//  1. FIELD-LEVEL AUTHORIZATION (D-028/I-8 + ux Q13). `GET /orgs/{orgId}` is
//     readable by ANY active member, and the row it reads from carries the
//     owner's tax id. With `entityType="personal"` that number IS the owner's
//     national ID, so what each caller may see is a three-tier rule — and a rule
//     re-implemented per endpoint is a rule that will be forgotten by the third
//     endpoint. `PATCH` returns the same shape, so it goes through the same
//     mapper, not a copy of it.
//
//  2. THE PHASE-0 `logo` RULE (M-4). `logo` accepts `null` and nothing else
//     until F-040 ships uploads. It is not a style preference: a caller with
//     `manage_org_settings` who could set an arbitrary URL would make every
//     member of the shop fetch a URL of their choosing (tracking pixel today,
//     SSRF the day the server renders it).
//
// The full tax id NEVER travels through this file — `taxIdMasked` is the most
// it can produce. The one endpoint that returns the real number is
// `POST /orgs/{orgId}/tax-profile/reveal` (§3.16, T-002-17).
import { hasCapability, CAPABILITY_MANAGE_ORG_SETTINGS } from "../auth/capabilities";
import { maskTaxId } from "./tax-id-mask";
import {
  isSupportedTimezone,
  validateOrgName,
  ORG_TIMEZONE_INVALID_MESSAGE,
  type FieldValidation,
} from "./org-provisioning";

// ── PATCH validation (api-spec §3.4) ───────────────────────────────────────

/** api-spec §3.4 — the exact copy the form field shows under `logo`. */
export const ORG_LOGO_UNSUPPORTED_MESSAGE = "ยังไม่รองรับการตั้งโลโก้ในเวอร์ชันนี้";

/** The columns `PATCH /orgs/{orgId}` may write. Absent key = leave alone. */
export interface OrgProfilePatch {
  readonly name?: string;
  /** Only ever `null` in Phase 0 — see {@link validateOrgProfilePatch}. */
  readonly logo?: null;
  readonly timezone?: string;
}

/**
 * Validate a profile patch. Every rejected field is reported at once (the form
 * shows all its errors in one round trip) as `fieldErrors`, which the API layer
 * turns into `422 VALIDATION_FAILED`.
 *
 * An EMPTY patch is valid and writes nothing: `PATCH` with no recognised field
 * is a no-op that returns the current profile, not an error. There is nothing
 * for a client to fix in it, and 422 would make a harmless retry look broken.
 *
 * `undefined` means "not sent". `null` means "clear it" and is accepted for
 * `logo` alone — `name: null` / `timezone: null` are refusals, because a shop
 * with no name and a shop with no timezone are not states this system has.
 */
export function validateOrgProfilePatch(input: {
  readonly name?: unknown;
  readonly logo?: unknown;
  readonly timezone?: unknown;
}): FieldValidation<OrgProfilePatch> {
  const fieldErrors: Record<string, string> = {};
  const patch: { name?: string; logo?: null; timezone?: string } = {};

  if (input.name !== undefined) {
    const name = validateOrgName(input.name);
    if (name.ok) patch.name = name.value;
    else Object.assign(fieldErrors, name.fieldErrors);
  }

  if (input.logo !== undefined) {
    // ⛔ Do NOT relax this to "a string that looks like our object key" before
    // F-040 exists to mint those keys. `null` is the whole allowed domain.
    if (input.logo === null) patch.logo = null;
    else fieldErrors.logo = ORG_LOGO_UNSUPPORTED_MESSAGE;
  }

  if (input.timezone !== undefined) {
    if (isSupportedTimezone(input.timezone)) patch.timezone = input.timezone;
    else fieldErrors.timezone = ORG_TIMEZONE_INVALID_MESSAGE;
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return { ok: true, value: patch };
}

// ── the response mapper (api-spec §3.3) ────────────────────────────────────

/** The organization row's own columns, as stored (data-model §2). */
export interface OrgProfileRow {
  readonly id: string;
  readonly name: string;
  readonly logo: string | null;
  readonly timezone: string;
  readonly currency: string;
  readonly taxEntityType: string | null;
  readonly taxId: string | null;
  readonly vatRegistered: boolean | null;
  readonly taxBranchCode: string | null;
}

/** The caller's own membership in this org, as the mapper needs it. */
export interface OrgProfileViewer {
  readonly userId: string;
  readonly roleId: string;
  readonly roleName: string;
  /** Stable slug for on-screen translation — `null` for an F-003 custom role. */
  readonly roleKey: string | null;
  readonly capabilities: readonly string[];
  readonly status: string;
}

export interface OrgProfileCounts {
  readonly activeMembers: number;
  readonly pendingInvitations: number;
}

/** `{ planKey, tierLabel }`, or `null` when the org somehow has no entitlement. */
export interface OrgEntitlementView {
  readonly planKey: string;
  readonly tierLabel: string | null;
}

/**
 * The `taxProfile` object. EVERY field is optional on the wire (api-spec §3.3):
 * a client must work when a field is absent, and must NEVER read "no
 * `taxIdMasked`" as "not declared" — `taxProfileComplete` answers that.
 */
export interface TaxProfileView {
  entityType?: string;
  taxIdMasked?: string;
  vatRegistered?: boolean;
  branchCode?: string;
}

export interface OrgProfileView {
  readonly id: string;
  readonly name: string;
  readonly logo: string | null;
  readonly timezone: string;
  readonly currency: string;
  readonly taxProfile: TaxProfileView | null;
  readonly taxProfileComplete: boolean;
  readonly entitlement: OrgEntitlementView | null;
  readonly myMembership: {
    readonly roleId: string;
    readonly roleName: string;
    readonly roleKey: string | null;
    readonly capabilities: readonly string[];
    readonly status: string;
  };
  readonly counts: OrgProfileCounts;
}

/**
 * "Has this shop declared its legal identity?" (data-model §3.3). Derived, never
 * stored — a stored boolean and the columns it summarises drift apart the first
 * time somebody writes one without the other.
 */
export function isTaxProfileComplete(row: {
  readonly taxEntityType: string | null;
  readonly taxId: string | null;
  readonly vatRegistered: boolean | null;
}): boolean {
  return (
    typeof row.taxEntityType === "string" &&
    row.taxEntityType.trim() !== "" &&
    typeof row.taxId === "string" &&
    row.taxId.trim() !== "" &&
    typeof row.vatRegistered === "boolean"
  );
}

/**
 * Build the `taxProfile` object this VIEWER is allowed to see (api-spec §3.3):
 *
 * | viewer                       | gets                                              |
 * |------------------------------|---------------------------------------------------|
 * | has `manage_org_settings`    | entityType · taxIdMasked (last 4) · vatRegistered · branchCode |
 * | any other active member      | `vatRegistered` ONLY — no number in any form       |
 *
 * Staff get no digits at all, not even the last four: with
 * `entityType="personal"` those four digits belong to a national ID, and a
 * shop's staff have no task that needs them (ux Q13, which is stricter than
 * D-028 and wins).
 *
 * `null` when nothing has been declared — for every tier, so "not declared" is
 * not a permission signal either.
 */
export function toTaxProfileView(
  row: Pick<OrgProfileRow, "taxEntityType" | "taxId" | "vatRegistered" | "taxBranchCode">,
  viewer: { readonly capabilities: readonly string[] },
): TaxProfileView | null {
  const declaredAnything =
    row.taxEntityType !== null || row.taxId !== null || row.vatRegistered !== null;
  if (!declaredAnything) return null;

  const view: TaxProfileView = {};
  if (row.vatRegistered !== null) view.vatRegistered = row.vatRegistered;

  if (!hasCapability(viewer.capabilities, CAPABILITY_MANAGE_ORG_SETTINGS)) {
    // ⛔ Nothing else. Do not add "just the entity type" — it says whether the
    // TIN is a company number or the owner's national ID.
    return view;
  }

  if (row.taxEntityType !== null) view.entityType = row.taxEntityType;
  const masked = maskTaxId(row.taxId);
  if (masked !== null) view.taxIdMasked = masked;
  if (row.taxBranchCode !== null) view.branchCode = row.taxBranchCode;
  return view;
}

/** Assemble the whole `GET`/`PATCH /orgs/{orgId}` body (api-spec §3.3). */
export function toOrgProfileView(input: {
  readonly organization: OrgProfileRow;
  readonly viewer: OrgProfileViewer;
  readonly entitlement: OrgEntitlementView | null;
  readonly counts: OrgProfileCounts;
}): OrgProfileView {
  const { organization, viewer, entitlement, counts } = input;
  return {
    id: organization.id,
    name: organization.name,
    logo: organization.logo,
    timezone: organization.timezone,
    currency: organization.currency,
    taxProfile: toTaxProfileView(organization, viewer),
    taxProfileComplete: isTaxProfileComplete(organization),
    entitlement,
    myMembership: {
      roleId: viewer.roleId,
      roleName: viewer.roleName,
      roleKey: viewer.roleKey,
      // What the client uses to hide buttons it should not offer. It is NOT
      // enforcement — the server refuses the call regardless (architecture §3.1).
      capabilities: viewer.capabilities,
      status: viewer.status,
    },
    // Totals, never a list: every active member may see HOW MANY colleagues they
    // have; only `manage_members` may see WHO they are (D-028, PDPA).
    counts,
  };
}

// ── the org-switcher list (api-spec §3.2) ──────────────────────────────────

/** One row of `GET /me/organizations`, before the shape rule is applied. */
export interface MyOrganizationSource {
  readonly organization: { readonly id: string; readonly name: string; readonly logo: string | null };
  readonly membership: {
    readonly status: string;
    readonly roleId: string;
    readonly roleName: string;
    readonly roleKey: string | null;
    readonly revokedAt: Date | null;
  };
  readonly entitlement: OrgEntitlementView | null;
}

/** Full shape — the caller is still an active member of this shop. */
export interface MyOrganizationFullItem {
  readonly organization: MyOrganizationSource["organization"];
  readonly membership: {
    readonly roleId: string;
    readonly roleName: string;
    readonly roleKey: string | null;
    readonly status: string;
  };
  readonly entitlement: OrgEntitlementView | null;
}

/** Short shape — the caller is NOT a member any more (M-10). */
export interface MyOrganizationShortItem {
  readonly organization: MyOrganizationSource["organization"];
  readonly membership: { readonly status: string; readonly revokedAt: string | null };
}

export type MyOrganizationItem = MyOrganizationFullItem | MyOrganizationShortItem;

/**
 * api-spec §3.2 / M-10 — a shop the caller no longer belongs to comes back as
 * id + name + status and NOTHING else.
 *
 * The role they held and the plan that shop is on are internal facts about an
 * organization they are no longer part of; there is no screen that needs them,
 * and `?status=all` is the one place a removed member can still see the row at
 * all. Deciding this by `status === "active"` (rather than by which query
 * produced the row) means a future caller cannot get the full shape by asking
 * differently.
 */
export function toMyOrganizationItem(source: MyOrganizationSource): MyOrganizationItem {
  const { membership, entitlement } = source;
  // ⛔ PROJECT field-by-field — never pass `source.organization` through.
  //
  // TypeScript's structural typing accepts a WIDER object than the declared
  // three fields, and nothing strips the extras at runtime. Passing the row
  // through meant this function's guarantee held only as long as every caller's
  // Prisma `select` stayed narrow: widen one select somewhere far away — add
  // `taxId` for another screen — and a REMOVED member's `?status=all` row
  // silently starts carrying the shop's tax id. That is the exact leak the
  // reveal endpoint and its rate limit exist to prevent, arriving through a
  // list endpoint nobody was watching.
  //
  // Projecting here makes the guarantee independent of every caller, which is
  // the whole reason this decision lives in one pure function.
  const organization = {
    id: source.organization.id,
    name: source.organization.name,
    logo: source.organization.logo,
  };
  if (membership.status !== "active") {
    return {
      organization,
      membership: {
        status: membership.status,
        revokedAt: membership.revokedAt ? membership.revokedAt.toISOString() : null,
      },
    };
  }
  return {
    organization,
    membership: {
      roleId: membership.roleId,
      roleName: membership.roleName,
      roleKey: membership.roleKey,
      status: membership.status,
    },
    entitlement,
  };
}
