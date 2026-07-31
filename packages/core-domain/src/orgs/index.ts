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
