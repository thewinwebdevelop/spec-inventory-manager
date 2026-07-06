import '../../../../core/api/refresh_coordinator.dart' show RefreshOutcome;

/// D-023 — domain contract for the auth feature (pure Dart: no Flutter, no
/// dio, no `omnistock_api_client`, no Riverpod — docs/mobile-architecture.md
/// §2). `run_auth_bootstrap` (the only current domain usecase with real
/// logic) depends on this abstraction instead of the concrete
/// `AuthRepositoryImpl`/generated `AuthApi`, so it stays testable with
/// `dart test` alone and swappable via Riverpod provider override at the
/// application layer.
///
/// Only the surface `run_auth_bootstrap` actually needs is declared here —
/// the full auth surface (login/signup/sessions/logout/change-password) is
/// still reached through `AuthRepositoryImpl` directly by the
/// `application/` controllers (constructor-injected, itself overridable in
/// tests), matching what existed before the refactor (T-001-17's screens
/// called a single `AuthClient` for everything). Widening this contract to
/// cover the rest of the surface is a mechanical follow-up, not required to
/// preserve current behavior.
abstract class AuthRepository {
  /// Reads the refresh token from secure storage (or null if never set /
  /// already cleared) — the single source of truth for "was I logged in".
  Future<String?> getStoredRefreshToken();

  /// Single-flight refresh attempt (mirrors
  /// `RefreshCoordinator.refreshDetailed`) — returns the terminal
  /// [RefreshOutcome] without throwing.
  Future<RefreshOutcome> silentRefreshDetailed();
}
