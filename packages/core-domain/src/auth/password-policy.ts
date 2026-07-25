// F-001 · T-001-01 — password policy (pure fn, golden rules #4/#6).
// NIST SP 800-63B (arch §5.2): min length 8, allow long passphrases (cap 128 to
// bound argon2 hashing cost), accept all Unicode incl. spaces, NO composition
// rules (no forced upper/digit/symbol). Reject against the breached/common set.
//
// The SAME fn gates signup (US-1) AND change-password's newPassword (US-6 /
// U6.1) — one policy, one source of truth. Returns a machine-readable result
// the service maps to the 422 error codes in api-spec §2.1/§2.7. No throw — a
// pure decision so it is unit-testable in isolation without a DB (test U1.2/U1.3).
import { isBreachedPassword } from "./common-passwords";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** Policy failure reasons → map 1:1 to api-spec 422 error codes. */
export type PasswordPolicyError =
  | "PASSWORD_TOO_SHORT"
  | "PASSWORD_TOO_LONG"
  | "PASSWORD_BREACHED";

export type PasswordPolicyResult =
  | { ok: true }
  | { ok: false; error: PasswordPolicyError };

export interface PasswordPolicyOptions {
  /**
   * Injectable breached-set membership test (default = the pinned top-10k
   * fixture). Overridable in tests so the policy can be exercised without the
   * real fixture, and so change-password reuses the identical check.
   */
  isBreached?: (password: string) => boolean;
}

/**
 * Validate a candidate password against the F-001 policy. Order of checks is
 * deliberate — length is a cheap structural gate before the (larger) breached
 * set lookup, and TOO_SHORT/TOO_LONG take precedence over BREACHED so the user
 * gets the most actionable single reason.
 *
 * Length is measured in Unicode code points (`[...password].length`), not
 * UTF-16 code units, so an 8-emoji passphrase is not falsely rejected as
 * "too short" and a long multi-byte passphrase is capped by real character
 * count (arch §5.2 "accept all Unicode incl. spaces").
 */
export function checkPasswordPolicy(
  password: string,
  opts: PasswordPolicyOptions = {},
): PasswordPolicyResult {
  const length = [...password].length;

  if (length < PASSWORD_MIN_LENGTH) {
    return { ok: false, error: "PASSWORD_TOO_SHORT" };
  }
  if (length > PASSWORD_MAX_LENGTH) {
    return { ok: false, error: "PASSWORD_TOO_LONG" };
  }

  const breached = opts.isBreached ?? ((p: string) => isBreachedPassword(p));
  if (breached(password)) {
    return { ok: false, error: "PASSWORD_BREACHED" };
  }

  return { ok: true };
}
