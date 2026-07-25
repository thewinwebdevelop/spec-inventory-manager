import '../../../../core/api/refresh_coordinator.dart' show RefreshOutcome;
import '../entities/session.dart';

/// D-023 — domain contract for the auth feature (pure Dart: no Flutter, no
/// dio, no `omnistock_api_client`, no Riverpod — docs/mobile-architecture.md
/// §2). `run_auth_bootstrap` (the only current domain usecase with real
/// logic) depends on this abstraction instead of the concrete
/// `AuthRepositoryImpl`/generated `AuthApi`, so it stays testable with
/// `dart test` alone and swappable via Riverpod provider override at the
/// application layer.
///
/// R5 (docs/architecture/refactor-plan.md §4) — widened to the FULL surface
/// every `application/` controller actually calls (login/signup/sessions/
/// logout/change-password), so `authRepositoryProvider` can be typed
/// `Provider<AuthRepository>` instead of the concrete `AuthRepositoryImpl`
/// (mobile.md §6 gap-analysis row: "provider ผูก concrete ... กันโครง ...
/// ถูกลอกไป 30 features"). Return types stay wire-DTO-free (`Future<void>`
/// where the concrete impl's richer return value — `TokenResponse`/
/// `SignupResponse`/`OkResponse` — is not consumed by any current caller;
/// `List<Session>` where it already is, since `Session` is a domain entity,
/// not a generated DTO) so this file keeps satisfying gate rule 1 (`domain/`
/// must not import `omnistock_api_client`). `AuthRepositoryImpl`'s own
/// methods keep their richer concrete return types — a `Future<T>` is a
/// valid override of an interface member declared `Future<void>` (Dart's
/// void-covariance rule for function/method return types), so
/// `data/auth_repository_impl_test.dart`'s direct assertions on those
/// richer returns (e.g. `res.accessToken`) are untouched by this widening.
abstract class AuthRepository {
  /// Whether a refresh token is currently stored (secure storage) — the
  /// single source of truth for "was I logged in". Deliberately does not
  /// expose the raw token value itself: no consumer above `data/` needs the
  /// plaintext refresh token (client-security skill — keep the raw read
  /// private to `data/`), only whether one exists.
  Future<bool> hasStoredSession();

  /// Single-flight refresh attempt (mirrors
  /// `RefreshCoordinator.refreshDetailed`) — returns the terminal
  /// [RefreshOutcome] without throwing.
  Future<RefreshOutcome> silentRefreshDetailed();

  /// US-2 signup. Return value intentionally discarded by every current
  /// caller (`SignupController.submit` only awaits it) — see class doc.
  Future<void> signup({required String email, required String password});

  /// US-2 login (mobile always body-transport — see
  /// `data/auth_repository_impl.dart`).
  Future<void> login({required String email, required String password});

  /// US-4/US-5 — the domain [Session] list (already DTO-free; the
  /// wire->domain mapping happens in `data/`).
  Future<List<Session>> getSessions();

  /// Per-device / current-device logout (US-4).
  Future<void> logoutDevice({String? familyId});

  /// Logout-all-devices.
  Future<void> logoutAll();

  /// US-6 change-password.
  Future<void> changePassword({required String currentPassword, required String newPassword});
}
