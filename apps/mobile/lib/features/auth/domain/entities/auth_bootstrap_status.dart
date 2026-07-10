/// T-001-17 ★ (M-2 — cold-start silent-refresh restore). Outcome of a
/// cold-start restore attempt — one loading→terminal transition, never loops
/// (mirrors the request/refresh coordinator's "never loops" invariant,
/// client-security skill). Pure Dart entity (domain layer) — no Flutter/dio/
/// generated-client/Riverpod dependency (docs/mobile-architecture.md §2).
enum AuthBootstrapStatus {
  /// Still attempting the restore (no refresh token read yet, or the
  /// refresh call is in flight). Callers show a brief loading state
  /// (design-system.md §2 "loading" — a spinner is fine here since this is a
  /// one-shot startup gate, not a data list; skeleton is reserved for the
  /// session list per ux-wireframe §7).
  loading,

  /// No refresh token was ever present in the keychain — not a failure, just
  /// "never logged in" / already logged out. Route straight to login, no
  /// error UI.
  noSession,

  /// A refresh token existed and refresh succeeded — a fresh access/refresh
  /// pair is stored; route to the authenticated destination.
  restored,

  /// The refresh token existed but is genuinely dead (expired/revoked/
  /// reuse-detected) — storage has been wiped (via the repository). Route to
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
