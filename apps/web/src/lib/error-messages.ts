/**
 * Maps server `ErrorResponse.code` -> Thai copy per ui.md §3. Centralized so
 * screens never hand-inline a raw error code (design-system.md §3: "error
 * message ก็เป็น i18n key"). If a code appears that isn't mapped here
 * (unexpected drift from backend-api), we fall back to the generic message —
 * never render the raw machine code to the user.
 */
import { authTh } from "../i18n/auth";

export function signupErrorMessage(code: string | undefined): string {
  switch (code) {
    case "EMAIL_INVALID":
      return authTh.signup.error.emailInvalid;
    case "PASSWORD_TOO_SHORT":
    case "PASSWORD_TOO_LONG":
      return authTh.signup.error.passwordTooShort;
    case "PASSWORD_BREACHED":
      return authTh.signup.error.passwordBreached;
    case "EMAIL_TAKEN":
      return authTh.signup.error.emailTaken;
    default:
      return authTh.signup.error.generic;
  }
}

export function loginErrorMessage(_code: string | undefined): string {
  // D-005/arch §9: enumeration-safe — every 401 on login renders the SAME
  // generic copy regardless of code (wrong password vs unknown email vs
  // anything else must be indistinguishable to the user).
  return authTh.login.error.invalidCredentials;
}

export function changePasswordErrorMessage(code: string | undefined): string {
  switch (code) {
    case "INVALID_CREDENTIALS":
      return authTh.changePassword.error.invalidCurrent;
    case "PASSWORD_TOO_SHORT":
    case "PASSWORD_TOO_LONG":
      return authTh.changePassword.error.passwordTooShort;
    case "PASSWORD_BREACHED":
      return authTh.changePassword.error.passwordBreached;
    default:
      return authTh.changePassword.error.generic;
  }
}
