/// T-001-17 ★ (M-2 — cold-start silent-refresh restore, pulled forward from
/// F-006 by D-021→D-022). Closes the US-3 "stay logged in across app
/// restart" gap on mobile: web gets this for free (the browser resends the
/// httpOnly `omni_rt` cookie on the very first request, D-019), but mobile's
/// refresh token lives in the Keychain/Keystore and is never attached
/// automatically — nothing calls `/auth/refresh` unless the app asks.
///
/// This is a pure orchestration seam (no widgets) specifically so F-006 can
/// call [runAuthBootstrap] from its own bootstrap/DI without depending on
/// [AuthFlow]'s particular `Navigator` wrapper (see auth_flow.dart's doc
/// comment) — `main.dart` here is just the first caller.
library;

import 'auth_client.dart';

/// Outcome of a cold-start restore attempt — one loading→terminal transition,
/// never loops (mirrors [AuthClient.requestWithRefresh]'s "never loops"
/// invariant, client-security skill).
enum AuthBootstrapStatus {
  /// Still attempting the restore (no refresh token read yet, or the
  /// `/auth/refresh` call is in flight). Callers show a brief loading state
  /// (design-system.md §2 "loading" — a spinner is fine here since this is a
  /// one-shot startup gate, not a data list; skeleton is reserved for the
  /// session list per ux-wireframe §7).
  loading,

  /// No refresh token was ever present in the keychain — not a failure, just
  /// "never logged in" / already logged out. Route straight to login, no
  /// error UI.
  noSession,

  /// A refresh token existed and `/auth/refresh` succeeded — a fresh
  /// access/refresh pair is stored; route to the authenticated destination.
  restored,

  /// The refresh token existed but is genuinely dead (expired/revoked/
  /// reuse-detected) — storage has been wiped (via [AuthClient]). Route to
  /// login (ux-wireframe §7's polite "session expired" toast is for
  /// mid-session expiry; a cold-start dead-session restore can route
  /// silently to plain login without that toast, since the user never saw an
  /// authenticated screen this launch to be bounced out of).
  sessionExpired,

  /// L-3: a refresh token existed but the attempt failed transiently
  /// (network / 5xx / 429) — the token was intentionally left untouched in
  /// storage. Do NOT force a full re-login/wipe: surface a retry/offline
  /// state so the user can retry once connectivity returns, and a *later*
  /// successful refresh can still restore the same session.
  transientFailure,
}

/// Runs the cold-start restore against [authClient] and returns the terminal
/// [AuthBootstrapStatus] (never [AuthBootstrapStatus.loading] — that's a
/// caller-side UI state shown *while this future is pending*, not a value
/// this function produces).
///
/// Reads the refresh token via the existing [AuthClient.tokenStore]/
/// `TokenStore`/`SecureStorage` seam only (client-security skill: the
/// keychain is the single source of truth for "was I logged in") — never
/// hand-rolls its own storage read.
Future<AuthBootstrapStatus> runAuthBootstrap(AuthClient authClient) async {
  final existingRefreshToken = await authClient.tokenStore.getRefreshToken();
  if (existingRefreshToken == null) {
    return AuthBootstrapStatus.noSession;
  }

  final outcome = await authClient.silentRefreshDetailed();
  switch (outcome) {
    case RefreshOutcome.success:
      return AuthBootstrapStatus.restored;
    case RefreshOutcome.sessionExpired:
      return AuthBootstrapStatus.sessionExpired;
    case RefreshOutcome.transientFailure:
      return AuthBootstrapStatus.transientFailure;
  }
}
