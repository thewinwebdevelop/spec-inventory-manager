import '../l10n/l10n.dart';

/// Maps server `ErrorResponse.code` -> Thai copy per ui.md §3. Centralized so
/// screens never hand-inline a raw error code (design-system.md §3). If a
/// code appears that isn't mapped here, falls back to the generic message —
/// never renders the raw machine code to the user. Mirrors
/// apps/web/src/lib/error-messages.ts exactly.
///
/// R3 (docs/architecture/refactor-plan.md §4, mobile.md §3.4) — these
/// functions are the auth feature's SPECIALIZED error-copy layer, re-homed
/// from `core/i18n/auth_th.dart` (deleted) to the ARB-backed
/// `AppLocalizations` (R4) but otherwise UNCHANGED: same switch, same
/// per-code copy, same generic fallback. They sit alongside — not instead
/// of — the new central `core/error/api_failure.dart` taxonomy
/// (`ApiFailure`/`failureMessage()`): auth's `ApiError`/status-code shape
/// predates that taxonomy and keeps its own mapping here (enumeration-safe
/// 401 handling, PASSWORD_TOO_SHORT vs PASSWORD_BREACHED, etc. — copy the
/// central generic fallback does not have the context to reproduce
/// correctly). `t` is threaded in by the caller (`AppLocalizations.of(context)`
/// in `presentation/`, the `l10n` getter in `application/` controllers —
/// see `core/l10n/l10n.dart`).
String signupErrorMessage(AppLocalizations t, String? code) {
  switch (code) {
    case 'EMAIL_INVALID':
      return t.authSignupErrorEmailInvalid;
    case 'PASSWORD_TOO_SHORT':
    case 'PASSWORD_TOO_LONG':
      return t.authSignupErrorPasswordTooShort;
    case 'PASSWORD_BREACHED':
      return t.authSignupErrorPasswordBreached;
    case 'EMAIL_TAKEN':
      return t.authSignupErrorEmailTaken;
    default:
      return t.authSignupErrorGeneric;
  }
}

/// D-005/arch §9: enumeration-safe — every 401 on login renders the SAME
/// generic copy regardless of code (wrong password vs unknown email vs
/// anything else must be indistinguishable to the user).
String loginErrorMessage(AppLocalizations t, String? code) => t.authLoginErrorInvalidCredentials;

String changePasswordErrorMessage(AppLocalizations t, String? code) {
  switch (code) {
    case 'INVALID_CREDENTIALS':
      return t.authChangePasswordErrorInvalidCurrent;
    case 'PASSWORD_TOO_SHORT':
    case 'PASSWORD_TOO_LONG':
      return t.authChangePasswordErrorPasswordTooShort;
    case 'PASSWORD_BREACHED':
      return t.authChangePasswordErrorPasswordBreached;
    default:
      return t.authChangePasswordErrorGeneric;
  }
}
