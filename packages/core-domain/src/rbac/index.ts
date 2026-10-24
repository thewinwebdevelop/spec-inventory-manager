// F-003 — core-domain rbac barrel. Pure fns only (golden rule #6).
// `CAPABILITY_FULL_ACCESS` / `CAPABILITY_MANAGE_MEMBERS` /
// `CAPABILITY_MANAGE_ORG_SETTINGS` / `hasCapability` are exported through the
// `auth` barrel (their F-001 home) — not repeated here, to keep one export path.
export {
  CAPABILITY_REGISTRY,
  CAPABILITY_GROUPS,
  CAPABILITY_MANAGE_ROLES,
  registryInvariantViolations,
  impliesEdges,
  removedShippedImpliesEdges,
  type CapabilityDef,
  type CapabilityGroup,
  type CapabilityGroupDef,
  type CapabilityKey,
  type RegistryLike,
} from "./registry";

export { expandCapabilities } from "./expand";

export { canonicalizeCapabilities, lostCapabilities } from "./canonical";

export {
  validateRoleCapabilities,
  validateRoleName,
  normalizeRoleName,
  roleNameComparisonKey,
  reservedRoleNames,
  SYSTEM_ROLE_LABELS,
  ROLE_NAME_MAX_LENGTH,
  ROLE_NAME_FORBIDDEN_CHARACTER,
  type ValidatedCapabilities,
  type ValidatableRegistry,
  type RoleCapabilitiesValidation,
  type RoleNameValidation,
  type ReservedRoleNamesContext,
  type SystemRoleLabels,
} from "./role-validation";
// T-003-B05 — the one rule for touching a person / handing out a role (D-034).
export {
  decideMemberAuthority,
  MEMBER_AUTHORITY_OPS,
  type MemberAuthorityInput,
  type MemberAuthorityOp,
  type MemberAuthorityResult,
  type TargetRelation,
} from "./member-authority";
// T-003-B06 — create / edit / delete a role (D-034 Addendum + Addendum 2).
export {
  decideRoleWrite,
  unchangedCapabilities,
  ROLE_WRITE_OPS,
  type UnchangedCapabilities,
  type RoleWriteInput,
  type RoleWriteOp,
  type RoleWriteResult,
  type RoleWriteTarget,
} from "./role-write";
