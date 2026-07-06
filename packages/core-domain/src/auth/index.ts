// F-001 · T-001-01 — core-domain auth barrel. Pure fns only (golden rules #4/#6):
// no framework, no DB, no I/O beyond loading the committed breached-password
// fixture. The apps/api services consume these; the reuse-decision + password
// policy + email normalize + backoff curve are the golden-rule-#4 unit-tested
// security core.
export {
  normalizeEmail,
  isValidEmailShape,
  emailIdentifier,
  type Identifier,
  type IdentifierType,
} from "./email";

export {
  checkPasswordPolicy,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  type PasswordPolicyError,
  type PasswordPolicyResult,
  type PasswordPolicyOptions,
} from "./password-policy";

export {
  isBreachedPassword,
  loadCommonPasswords,
  fixturePath,
  FIXTURE_VERSION,
} from "./common-passwords";

export {
  backoffSeconds,
  isBackedOff,
  BACKOFF_THRESHOLD,
  BACKOFF_BASE_SECONDS,
  BACKOFF_CEILING_SECONDS,
} from "./backoff";

export {
  decideReuse,
  REUSE_LEEWAY_MS,
  type ReuseAction,
  type ReuseDecisionInput,
} from "./reuse-decision";

export {
  buildAccessClaims,
  ACCESS_TOKEN_TTL_SECONDS,
  ACCESS_TOKEN_TYP,
  type AccessTokenClaims,
  type BuildAccessClaimsInput,
} from "./access-claims";

export {
  tokenExpiresAt,
  familyExpiresAt,
  decideFamilyCap,
  REFRESH_TOKEN_TTL_MS,
  FAMILY_LIFETIME_CAP_MS,
  LIVE_FAMILY_CAP,
  type LiveFamily,
  type CapDecision,
} from "./token-lifetime";

export {
  CAPABILITY_MANAGE_MEMBERS,
  CAPABILITY_FULL_ACCESS,
  hasCapability,
} from "./capabilities";
