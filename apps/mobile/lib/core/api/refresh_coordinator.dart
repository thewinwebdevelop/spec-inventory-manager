/// D-023 (mobile architecture refactor) — the app-wide "every request" half
/// of what used to be `lib/auth/auth_client.dart` (T-001-17 ★). Pulled out of
/// the auth feature into `core/api/` so future features (F-013 stock, F-024
/// orders, ...) get single-flight silent-refresh-then-retry-once wired
/// through their own Dio clients for free, without re-deriving this
/// machinery per feature (docs/mobile-architecture.md §5 "KEY SPLIT").
///
/// This file is intentionally generic: it knows nothing about the auth
/// HTTP endpoints themselves (login/signup/refresh/logout — those stay in
/// `features/auth/data/auth_repository_impl.dart`, the only place allowed to
/// call the generated `AuthApi`). It only knows "how to run a single-flight
/// refresh with a logout-epoch guard" and "how to retry a request exactly
/// once after a successful refresh" — parameterized by a caller-supplied
/// refresh callback.
library;

/// T-001-17 ★ (L-3 — cold-start restore / refresh-failure UX). Distinguishes
/// a REAL dead session from a merely-transient failure so callers (cold-start
/// bootstrap, any silent-refresh call site) don't force a full re-login/wipe
/// over a flaky network.
enum RefreshOutcome {
  /// Refresh succeeded — a fresh access/refresh token pair is stored.
  success,

  /// The refresh token is genuinely dead (expired/revoked/reuse-detected, or
  /// simply absent) — storage has been wiped; the caller must treat the
  /// session as over (ux-wireframe §7: bounce to login + polite toast).
  sessionExpired,

  /// Network failure / 5xx / 429 — the refresh token was intentionally left
  /// untouched in storage (still potentially valid). The caller should offer
  /// a retry/offline state, NOT a forced re-login/wipe.
  transientFailure,
}

/// Thrown by [RefreshCoordinator.requestWithRefresh] when silent refresh +
/// retry-once both fail — the caller (screen/router) must treat the session
/// as dead: wipe secure storage + in-memory state (client-security skill)
/// and route to the login screen with the polite "session expired" toast
/// (ux-wireframe §7 — same copy regardless of cause, never signals "reuse
/// detected" to the client, api-spec §2.3).
class SessionExpiredException implements Exception {
  const SessionExpiredException();

  @override
  String toString() => 'SessionExpiredException';
}

bool isSessionExpired(Object err) => err is SessionExpiredException;

/// App-wide request/refresh machinery: single-flight refresh-on-401,
/// retry-once, logout-epoch guard. Generic over:
/// - [T] the app-level error type calls throw on failure (e.g. auth
///   feature's `ApiError`) — this coordinator never constructs one itself,
///   it only inspects it via [isAuthError]/[authErrorStatus].
///
/// Owns none of the actual HTTP transport or token persistence — the caller
/// (a feature's repository impl) supplies:
/// - [doRefresh]: performs exactly one real refresh attempt (network call +
///   token persistence) and returns the terminal [RefreshOutcome]. Must
///   itself be idempotent/side-effect-safe to call at most once per
///   [refresh]/[refreshDetailed] invocation (the coordinator guarantees the
///   single-flight dedupe around it, not [doRefresh] itself).
/// - [onLogout]: wipes local token state (storage + in-memory) — called
///   whenever this coordinator determines the session is over from within
///   [requestWithRefresh]'s second-failure path.
class RefreshCoordinator {
  RefreshCoordinator({
    required Future<RefreshOutcome> Function() doRefresh,
    required Future<void> Function() onLogout,
  })  : _doRefresh = doRefresh,
        _onLogout = onLogout;

  final Future<RefreshOutcome> Function() _doRefresh;
  final Future<void> Function() _onLogout;

  // Single-flight dedupe (mirrors apps/web/src/lib/auth-client.ts): several
  // concurrent 401s must share ONE refresh call, or a second/third real
  // refresh call would hit the just-rotated token as a benign-retry 401
  // (arch §3.5 leeway window) purely from a client-side race, wrongly
  // throwing SessionExpiredException for a still-live session.
  Future<RefreshOutcome>? _inflightRefresh;

  /// Thin bool projection of [refreshDetailed] kept for existing callers
  /// ([requestWithRefresh]) that only ever wipe/retry on a TRUE dead session
  /// anyway — a transient failure and a dead session both mean "this
  /// in-flight request can't be retried right now" from that call site's
  /// point of view. Callers that need to react differently to a transient
  /// failure (L-3 — cold-start bootstrap) should call [refreshDetailed]
  /// directly instead.
  Future<bool> refresh() async {
    final outcome = await refreshDetailed();
    return outcome == RefreshOutcome.success;
  }

  /// Runs [doRefresh] with single-flight dedupe — concurrent callers all
  /// await the same in-flight attempt rather than triggering their own.
  Future<RefreshOutcome> refreshDetailed() async {
    if (_inflightRefresh != null) return _inflightRefresh!;
    final future = _doRefresh();
    _inflightRefresh = future;
    try {
      return await future;
    } finally {
      _inflightRefresh = null;
    }
  }

  /// Runs [send] once; on a failure that [isAuthExpiry] accepts, attempts
  /// exactly one silent refresh then retries [send] exactly once. A second
  /// failure — refresh itself failing, or the retried call still failing
  /// with [isAuthExpiry] true — calls [onLogout] and throws
  /// [SessionExpiredException]. Never loops (client-security skill).
  ///
  /// [isAuthExpiry] and [isAuthError] let the caller define what "this
  /// failure means the access token died" looks like for its own error type
  /// (e.g. auth feature's `ApiError.status == 401`) without this generic
  /// coordinator knowing anything about that type's shape.
  Future<T> requestWithRefresh<T>(
    Future<T> Function() send, {
    required bool Function(Object error) isAuthExpiry,
  }) async {
    try {
      return await send();
    } catch (first) {
      if (!isAuthExpiry(first)) rethrow;

      final refreshed = await refresh();
      if (!refreshed) {
        throw const SessionExpiredException();
      }

      try {
        return await send();
      } catch (second) {
        if (isAuthExpiry(second)) {
          // Refreshed successfully but the retried call still failed the
          // same way (e.g. kicked mid-flight, ux-wireframe §7) — do not loop
          // again.
          await _onLogout();
          throw const SessionExpiredException();
        }
        rethrow;
      }
    }
  }
}
