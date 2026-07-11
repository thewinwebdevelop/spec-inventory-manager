import 'package:dio/dio.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

import '../../../core/api/auth_token_interceptor.dart';
import '../../../core/api/error_mapping_interceptor.dart';
import '../../../core/api/https_guard.dart';
import '../../../core/api/https_guard_interceptor.dart';
import '../../../core/api/refresh_interceptor.dart';
import 'auth_repository_impl.dart';
import 'token_store.dart';

/// Bootstrap helper — builds an [AuthRepositoryImpl] wired to the GENERATED
/// [AuthApi] (no hand-reshaping of the contract, per frontend domain rules)
/// AND (R2, docs/architecture/refactor-plan.md §4) the shared `core/api/`
/// interceptor chain, so every bearer-scoped call this repository makes
/// gets auth-attach + silent-refresh-then-retry-once + central error
/// mapping for free instead of each call site building its own
/// `Options`/try-catch (mobile.md §3.1).
///
/// T-001-17 ★ client-security fix (M-3): [baseUrl]'s default (a generated
/// client's implicit cleartext `http://localhost:3000`) is never acceptable
/// as a prod fallback. [baseUrl] is therefore REQUIRED (no hardcoded
/// fallback here); per-environment values are F-006/devops's call, this
/// function only provides the seam + the guard (see [guardBaseUrlForRelease]
/// / [HttpsGuardInterceptor]).
///
/// ## Two Dio instances (`dio` + `_retryDio`) — why
///
/// [RefreshInterceptor] must issue its retry through a [Dio] that does NOT
/// carry `RefreshInterceptor` itself — retrying via `dio.fetch(...)` on the
/// SAME `Dio` this `QueuedInterceptor` is attached to would re-enter that
/// SAME queue from WITHIN an unresolved `onError` call on it (a
/// self-deadlock — see `core/api/refresh_interceptor.dart`'s class doc, the
/// exact bug this two-Dio split fixes). Both `Dio`s share the SAME
/// `httpClientAdapter` (one real/fake transport) and the SAME other 3
/// interceptors (https guard, auth-attach, error mapping) — only
/// `RefreshInterceptor` differs between them.
///
/// ## Two-phase wiring (why this isn't just "build interceptors, then build
/// the repo")
///
/// [RefreshInterceptor] needs the SAME [RefreshCoordinator] instance
/// [AuthRepositoryImpl] builds for itself internally (single-flight dedupe
/// is per-COORDINATOR-instance — the interceptor and this repository's own
/// `silentRefresh()`/`silentRefreshDetailed()` calls, e.g. from cold-start
/// bootstrap, MUST share one, not race two independent ones). That
/// coordinator doesn't exist until [AuthRepositoryImpl] is constructed, and
/// [AuthRepositoryImpl] needs the wired [AuthApi] to construct. So:
/// 1. Build both [Dio]s with the interceptors that DON'T need the
///    repository yet (https guard, auth-attach — needs only [tokenStore],
///    which exists up front — and error mapping).
/// 2. Construct [AuthApi]/[AuthRepositoryImpl] against the MAIN [Dio].
/// 3. Insert [RefreshInterceptor] into the MAIN [Dio] only (now that
///    `repo.refreshCoordinator` exists), at the position that keeps chain
///    order `HttpsGuard → AuthAttach → Refresh → ErrorMapping` (mobile.md
///    §3.4 — `dio.interceptors.insert`, not `.add`, so it lands BEFORE the
///    already-added [ErrorMappingInterceptor]).
///
/// Org header seam (F-002, mobile.md §3.2) — commented, NOT built: a future
/// `orgDioProvider` will add an `OrgHeaderInterceptor` to an org-scoped
/// Dio built the SAME way as this one (org list/switcher itself stays on
/// this org-AGNOSTIC client) — nothing here should be stretched to fake it.
AuthRepositoryImpl createAuthClient({
  required String baseUrl,
  OmnistockApiClient? apiClient,
  TokenStore? tokenStore,
  String? deviceId,
}) {
  guardBaseUrlForRelease(baseUrl);
  final store = tokenStore ?? TokenStore();

  final Dio dio;
  final AuthApi authApi;
  if (apiClient != null) {
    // Caller supplied its own wired client (e.g. a future test/composition
    // seam) — respect it verbatim, no interceptor chain imposed on top.
    dio = apiClient.dio;
    authApi = apiClient.getAuthApi();
  } else {
    List<Interceptor> baseInterceptors() => [
          HttpsGuardInterceptor(),
          AuthTokenInterceptor(getAccessToken: () => store.accessToken),
        ];

    dio = Dio(BaseOptions(baseUrl: baseUrl));
    final retryDio = Dio(BaseOptions(baseUrl: baseUrl))..httpClientAdapter = dio.httpClientAdapter;
    retryDio.interceptors.addAll([...baseInterceptors(), ErrorMappingInterceptor()]);
    dio.interceptors.addAll([
      ...baseInterceptors(),
      // RefreshInterceptor inserted below, once `repo` exists.
      ErrorMappingInterceptor(),
    ]);
    authApi = AuthApi(dio, standardSerializers);

    final repo = AuthRepositoryImpl(authApi: authApi, tokenStore: store, deviceId: deviceId);
    // Insert BEFORE ErrorMappingInterceptor (the last of the 2 already
    // added) so the chain order is HttpsGuard -> AuthAttach -> Refresh ->
    // ErrorMapping — see class doc "two-phase wiring".
    dio.interceptors.insert(
      dio.interceptors.length - 1,
      RefreshInterceptor(retryDio: retryDio, refreshCoordinator: repo.refreshCoordinator),
    );
    return repo;
  }

  return AuthRepositoryImpl(authApi: authApi, tokenStore: store, deviceId: deviceId);
}
