import '../i18n/auth_th.dart';

/// Maps server `ErrorResponse.code` -> Thai copy per ui.md §3. Centralized so
/// screens never hand-inline a raw error code (design-system.md §3). If a
/// code appears that isn't mapped here, falls back to the generic message —
/// never renders the raw machine code to the user. Mirrors
/// apps/web/src/lib/error-messages.ts exactly.
String signupErrorMessage(String? code) {
  switch (code) {
    case 'EMAIL_INVALID':
      return AuthTh.signupErrorEmailInvalid;
    case 'PASSWORD_TOO_SHORT':
    case 'PASSWORD_TOO_LONG':
      return AuthTh.signupErrorPasswordTooShort;
    case 'PASSWORD_BREACHED':
      return AuthTh.signupErrorPasswordBreached;
    case 'EMAIL_TAKEN':
      return AuthTh.signupErrorEmailTaken;
    default:
      return AuthTh.signupErrorGeneric;
  }
}

/// D-005/arch §9: enumeration-safe — every 401 on login renders the SAME
/// generic copy regardless of code (wrong password vs unknown email vs
/// anything else must be indistinguishable to the user).
String loginErrorMessage(String? code) => AuthTh.loginErrorInvalidCredentials;

String changePasswordErrorMessage(String? code) {
  switch (code) {
    case 'INVALID_CREDENTIALS':
      return AuthTh.changePasswordErrorInvalidCurrent;
    case 'PASSWORD_TOO_SHORT':
    case 'PASSWORD_TOO_LONG':
      return AuthTh.changePasswordErrorPasswordTooShort;
    case 'PASSWORD_BREACHED':
      return AuthTh.changePasswordErrorPasswordBreached;
    default:
      return AuthTh.changePasswordErrorGeneric;
  }
}
