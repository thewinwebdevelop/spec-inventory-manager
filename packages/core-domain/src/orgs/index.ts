// F-002 · T-002-08 — core-domain orgs barrel. Pure fns only (golden rules #4/#6):
// no framework, no DB, no clock, no randomness — `now` is always a parameter so
// the boundary behaviour is testable to the millisecond (test-plan §3).
//
// These are the decision points the F-002 services must NOT re-implement:
// the Owner ≥ 1 invariant (architecture §5), the Owner-only rule (C-1/D-028),
// TIN validation (US-7), derived invitation status (data-model §3.2) and the
// public-preview email mask.
export {
  assertOwnerRemains,
  activeOwnersAfter,
  LastOwnerError,
  type MembershipStatus,
  type OwnerMembership,
  type OwnerChange,
  type OwnerInvariantInput,
} from "./owner-invariant";

export { canAssignRole, isOwnerRole, type CanAssignRoleInput } from "./member-authz";

export {
  isValidThaiTaxId,
  isValidBranchCode,
  normalizeThaiTaxId,
  THAI_TAX_ID_LENGTH,
  BRANCH_CODE_LENGTH,
  HEAD_OFFICE_BRANCH_CODE,
} from "./thai-tax-id";

export {
  resolveInvitationStatus,
  type StoredInvitationStatus,
  type ResolvedInvitationStatus,
  type ResolvableInvitation,
} from "./invitation-status";

export { maskEmail, MaskEmailError, EMAIL_MASK } from "./invitation-email";

// T-002-08b — the remaining two pure fns of data-model §6: how long an
// invitation lives (D-028/I-7) + whether it may still be accepted (I-1/I-9/M-6),
// and the TIN mask that every read path but `…/tax-profile/reveal` goes through.
export {
  invitationTtlHours,
  isElevatedRole,
  canAcceptInvitation,
  INVITATION_TTL_HOURS_ELEVATED,
  INVITATION_TTL_HOURS_STANDARD,
  type AcceptInvitationDecision,
  type AcceptableInvitation,
  type AcceptorMembership,
  type CanAcceptInvitationInput,
} from "./invitation-policy";

export { maskTaxId, TAX_ID_MASK_CHAR, TAX_ID_VISIBLE_SUFFIX_LENGTH } from "./tax-id-mask";

// T-002-15 ★ — what "create a shop" decides before the transaction opens: the
// three system roles (data-model §5.2), the fixed defaults (D-013), the
// fail-closed per-user org cap (I-10) and the body validation of api-spec §3.1.
export {
  SYSTEM_ROLE_BLUEPRINT,
  ownerRoleBlueprint,
  isOrgCapReached,
  isSupportedTimezone,
  validateOrgName,
  validateNewOrganization,
  ORG_DEFAULT_TIMEZONE,
  ORG_DEFAULT_CURRENCY,
  DEFAULT_WAREHOUSE_NAME,
  ORG_NAME_MIN_LENGTH,
  ORG_NAME_MAX_LENGTH,
  ORG_NAME_REQUIRED_MESSAGE,
  ORG_NAME_TOO_LONG_MESSAGE,
  ORG_TIMEZONE_INVALID_MESSAGE,
  type SystemRoleBlueprint,
  type NewOrganizationInput,
  type FieldValidation,
} from "./org-provisioning";

// T-002-16 — the org profile as the wire sees it: PDPA field-level
// authorization (§3.3), the Phase-0 `logo` rule (M-4) and the short shape a
// removed member gets in the org switcher (M-10).
export {
  validateOrgProfilePatch,
  toOrgProfileView,
  toTaxProfileView,
  isTaxProfileComplete,
  toMyOrganizationItem,
  ORG_LOGO_UNSUPPORTED_MESSAGE,
  type OrgProfilePatch,
  type OrgProfileRow,
  type OrgProfileViewer,
  type OrgProfileCounts,
  type OrgProfileView,
  type OrgEntitlementView,
  type TaxProfileView,
  type MyOrganizationSource,
  type MyOrganizationItem,
  type MyOrganizationFullItem,
  type MyOrganizationShortItem,
} from "./org-profile";

// T-002-17 ★ — the tax profile: the all-or-nothing write rule (§3.5) and the
// ONE function in the system that produces a full TIN (§3.16). Everything else
// that touches the number goes through `maskTaxId` above.
export {
  validateTaxProfilePut,
  toTaxProfileReveal,
  TAX_PROFILE_CLEARED,
  TAX_ENTITY_TYPES,
  TAX_ID_INVALID_MESSAGE,
  TAX_ENTITY_TYPE_INVALID_MESSAGE,
  VAT_REGISTERED_INVALID_MESSAGE,
  BRANCH_CODE_INVALID_MESSAGE,
  TAX_PROFILE_INCOMPLETE_MESSAGE,
  type TaxProfileWrite,
  type TaxProfileValidation,
  type TaxProfileErrorCode,
  type RevealedTaxProfile,
} from "./tax-profile";

// T-002-09 ★ — the two fail-closed conditions the SHIPPED admin-reset endpoint
// grew when "one person, many organizations" became real (C-2/D-028 +
// NEW-1/D-030). Same `canAssignRole` rule as the membership routes, no copy.
export {
  decideAdminReset,
  isAdminResetCallerAuthorized,
  type AdminResetDecision,
  type AdminResetInput,
  type AdminResetMembershipFacts,
  type AdminResetRefusal,
} from "./admin-reset-authz";
