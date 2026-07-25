/// T-001-17 ★ (M-2 — cold-start silent-refresh restore, pulled forward from
/// F-006 by D-021→D-022). Closes the US-3 "stay logged in across app
/// restart" gap on mobile: web gets this for free (the browser resends the
/// httpOnly `omni_rt` cookie on the very first request, D-019), but mobile's
/// refresh token lives in the Keychain/Keystore and is never attached
/// automatically — nothing calls `/auth/refresh` unless the app asks.
///
/// PURE DART (domain usecase, docs/mobile-architecture.md §2/§5): depends
/// only on the [AuthRepository] abstract contract — no Flutter, no dio, no
/// generated client, no Riverpod. `application/bootstrap_controller.dart`
/// wraps this in an `AsyncNotifier` for the presentation layer; `app/` (F-006)
/// calls the controller from its own bootstrap/DI without depending on any
/// particular widget tree.
library;

import '../entities/auth_bootstrap_status.dart';
import '../repositories/auth_repository.dart';
import '../../../../core/api/refresh_coordinator.dart' show RefreshOutcome;

/// Runs the cold-start restore against [repository] and returns the terminal
/// [AuthBootstrapStatus] (never [AuthBootstrapStatus.loading] — that's a
/// caller-side UI state shown *while this future is pending*, not a value
/// this function produces).
///
/// Reads session presence via the repository's storage seam only
/// (client-security skill: the keychain is the single source of truth for
/// "was I logged in") — never hand-rolls its own storage read, and never
/// touches the raw refresh token value itself (that stays private to
/// `data/`; this usecase only needs a yes/no).
Future<AuthBootstrapStatus> runAuthBootstrap(AuthRepository repository) async {
  final hasSession = await repository.hasStoredSession();
  if (!hasSession) {
    return AuthBootstrapStatus.noSession;
  }

  final outcome = await repository.silentRefreshDetailed();
  switch (outcome) {
    case RefreshOutcome.success:
      return AuthBootstrapStatus.restored;
    case RefreshOutcome.sessionExpired:
      return AuthBootstrapStatus.sessionExpired;
    case RefreshOutcome.transientFailure:
      return AuthBootstrapStatus.transientFailure;
  }
}
