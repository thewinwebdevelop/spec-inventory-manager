import 'package:built_value/serializer.dart';
import 'package:dio/dio.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart'
    hide Session; // wire Session DTO — see _toDomainSession, imported below as `wire.Session`
import 'package:omnistock_api_client/omnistock_api_client.dart' as wire show Session;

import '../../../core/api/refresh_coordinator.dart';
import '../domain/entities/session.dart' as domain;
import '../domain/repositories/auth_repository.dart';
import 'auth_exceptions.dart';
import 'token_store.dart';

/// T-001-17 ★ — mobile token/refresh flow, now the "auth endpoints" half of
/// what used to be `lib/auth/auth_client.dart` (D-023 KEY SPLIT,
/// docs/mobile-architecture.md §5). The app-wide single-flight
/// refresh/retry-once/logout-epoch machinery lives in
/// `core/api/refresh_coordinator.dart` instead — this class only knows how
/// to call the auth HTTP endpoints and persist tokens.
///
/// Contract: docs/features/F-001/api-spec.md §0 (LOCKED). Skill:
/// client-security. Mirrors the shape of `apps/web/src/lib/auth-client.ts`
/// (same retry-once/session-expired semantics) but the transport is BODY,
/// not cookie (D-019's cookie-path fix is web-only — see api-spec §0 item 2
/// + ux-wireframe §8): mobile always omits `tokenTransport` (server default
/// `"body"`) and stores the plaintext refresh token in the OS
/// keychain/keystore via [TokenStore], never in a cookie.
///
/// Consumes the GENERATED [AuthApi] client only — no hand-reshaping of
/// request/response types (frontend does not decide API/data shape). This
/// is the ONLY place (besides `core/api/`) allowed to import
/// `omnistock_api_client` (docs/mobile-architecture.md §2 boundary rule).
class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl({
    required AuthApi authApi,
    required TokenStore tokenStore,
    String? deviceId,
  })  : _authApi = authApi,
        _tokenStore = tokenStore,
        _deviceId = deviceId {
    _refreshCoordinator = RefreshCoordinator(
      doRefresh: _doRefresh,
      onLogout: _wipeForLogout,
    );
  }

  final AuthApi _authApi;
  final TokenStore _tokenStore;
  final String? _deviceId;
  late final RefreshCoordinator _refreshCoordinator;

  TokenStore get tokenStore => _tokenStore;

  /// T-001-17 ★ (L-4): the label THIS client instance sends as `deviceId` on
  /// login/refresh (api-spec §2.2/§2.3) — echoed back verbatim as
  /// `Session.deviceId` (api-spec §2.6). Since `GET /auth/sessions` marks
  /// `current` from the `omni_rt` cookie only (api-spec §2.6: "null if no
  /// cookie, e.g. a Bearer-only mobile call"), mobile's `current` is always
  /// `false` server-side — comparing a listed session's `deviceId` against
  /// THIS getter is the only client-side signal mobile has for "is this row
  /// the device I'm holding", and is exposed here so the session-list UI can
  /// use it instead of trusting the always-false `current` flag.
  String? get deviceId => _deviceId;

  int? _retryAfterFromHeaders(Map<String, List<String>> headers) {
    final values = headers['retry-after'] ?? headers['Retry-After'];
    if (values == null || values.isEmpty) return null;
    return int.tryParse(values.first);
  }

  ApiError _mapDioError(DioException e) {
    final response = e.response;
    if (response == null) {
      // Network failure / no response at all — no ErrorResponse to parse.
      return ApiError(0, null);
    }
    final status = response.statusCode ?? 0;
    final retryAfter = _retryAfterFromHeaders(response.headers.map);
    return ApiError(status, _parseErrorResponse(response.data), retryAfter);
  }

  /// The generated [AuthApi] methods only deserialize the SUCCESS-path body
  /// (built_value's typed round-trip) — on a non-2xx response Dio hands us
  /// the raw transformed JSON (`Map<String, dynamic>`, since
  /// `receiveDataWhenStatusError` defaults true), not an [ErrorResponse]
  /// instance. This mirrors the JSON parsing `apps/web/src/lib/auth-client.ts`
  /// does itself (`await res.json()`) for the same reason (its client
  /// doesn't build a typed error object either).
  ErrorResponse? _parseErrorResponse(Object? data) {
    if (data is ErrorResponse) return data;
    if (data is Map) {
      try {
        return standardSerializers.deserialize(
          data,
          specifiedType: const FullType(ErrorResponse),
        ) as ErrorResponse;
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  // ---- Public endpoints (no access token needed) ----

  Future<SignupResponse> signup({
    required String email,
    required String password,
  }) async {
    try {
      final res = await _authApi.authSignup(
        signupRequest: SignupRequest((b) => b
          ..email = email
          ..password = password),
      );
      final body = res.data;
      if (body == null) {
        throw ApiError(res.statusCode ?? 0, null);
      }
      return body;
    } on DioException catch (e) {
      throw _mapDioError(e);
    }
  }

  /// US-2. Mobile ALWAYS uses body transport (omit `tokenTransport`, server
  /// default `"body"`, api-spec §0 item 2) — never declares `"cookie"`.
  /// On success, the access token goes to memory and the refresh token to
  /// the OS keychain/keystore (client-security skill).
  Future<TokenResponse> login({
    required String email,
    required String password,
  }) async {
    try {
      final res = await _authApi.authLogin(
        loginRequest: LoginRequest((b) {
          b
            ..email = email
            ..password = password
            ..tokenTransport = LoginRequestTokenTransportEnum.body;
          if (_deviceId != null) b.deviceId = _deviceId;
        }),
      );
      final body = res.data;
      if (body == null) {
        throw ApiError(res.statusCode ?? 0, null);
      }
      _tokenStore.setAccessToken(body.accessToken, expiresInSeconds: body.expiresIn);
      final refreshToken = body.refreshToken;
      if (refreshToken != null) {
        await _tokenStore.setRefreshToken(refreshToken);
      }
      return body;
    } on DioException catch (e) {
      throw _mapDioError(e);
    }
  }

  @override
  Future<String?> getStoredRefreshToken() => _tokenStore.getRefreshToken();

  /// Rotates the refresh token. Presents the CURRENT refresh token from
  /// secure storage in the request body (body transport, api-spec §2.3).
  /// Returns true + stores the new pair on success; on failure, per mobile
  /// guidance M-2 (api-spec §5): **do not retry with the same token** — wipe
  /// storage. Never throws; callers treat it as a boolean gate (mirrors
  /// `silentRefresh` in apps/web/src/lib/auth-client.ts).
  ///
  /// This is a thin delegation to [RefreshCoordinator.refresh] kept for
  /// existing callers ([requestWithRefresh]). Callers that need to react
  /// differently to a transient failure (L-3 — cold-start bootstrap) should
  /// call [silentRefreshDetailed] directly instead.
  Future<bool> silentRefresh() => _refreshCoordinator.refresh();

  /// Same single-flight refresh as [silentRefresh], but surfaces the
  /// [RefreshOutcome] distinction (L-3) instead of collapsing
  /// session-expired and transient-network-failure into the same `false`.
  @override
  Future<RefreshOutcome> silentRefreshDetailed() => _refreshCoordinator.refreshDetailed();

  // T-001-17 ★ (L-2): monotonically-bumped logout epoch. `_doRefresh` reads
  // the epoch BEFORE awaiting the network call and re-checks it right before
  // persisting the rotated pair — if a logout (`_wipeForLogout`) intervened
  // during the await, the epoch will have moved and we must NOT write a
  // freshly-rotated token back into storage that was just deliberately
  // wiped (a refresh completing after `clearAll()` would otherwise
  // resurrect a "logged out" session).
  int _logoutEpoch = 0;

  /// Every code path that wipes storage because the user is logging out
  /// (as opposed to a dead/expired session being cleaned up) goes through
  /// here so the epoch bump and the wipe always happen together.
  Future<void> _wipeForLogout() async {
    _logoutEpoch++;
    await _tokenStore.clearAll();
  }

  Future<RefreshOutcome> _doRefresh() async {
    final epochAtStart = _logoutEpoch;
    final currentRefreshToken = await _tokenStore.getRefreshToken();
    if (currentRefreshToken == null) {
      await _tokenStore.clearAll();
      return RefreshOutcome.sessionExpired;
    }
    try {
      final res = await _authApi.authRefresh(
        refreshRequest: RefreshRequest((b) {
          b.refreshToken = currentRefreshToken;
          if (_deviceId != null) b.deviceId = _deviceId;
        }),
      );
      final body = res.data;
      if (body == null) {
        // D-022 ★ re-review fix (Minor #5): a 200 status with no/unparseable
        // body is a broken proxy/CDN symptom (malformed success), NOT the
        // server's documented dead-refresh-token signal (that's a real 401,
        // handled below). Treat it the same as network/5xx/429: leave
        // storage untouched and let the caller offer retry — wiping a
        // possibly-still-live session over a malformed 200 would be strictly
        // worse than a spurious retry prompt.
        return RefreshOutcome.transientFailure;
      }
      if (_logoutEpoch != epochAtStart) {
        // A logout happened while this refresh was in flight — storage was
        // already deliberately wiped; do not rewrite a dead token into it.
        return RefreshOutcome.sessionExpired;
      }
      _tokenStore.setAccessToken(body.accessToken, expiresInSeconds: body.expiresIn);
      final rotated = body.refreshToken;
      if (rotated != null) {
        await _tokenStore.setRefreshToken(rotated);
      }
      return RefreshOutcome.success;
    } on DioException catch (e) {
      // 401 INVALID_REFRESH (expired/revoked/reuse-detected — all
      // indistinguishable on the wire, api-spec §2.3) → the session is
      // unrecoverable client-side. Mobile guidance M-2: wipe, don't retry
      // with the same (now possibly-consumed) token.
      final status = e.response?.statusCode;
      if (status == 401) {
        if (_logoutEpoch == epochAtStart) {
          await _tokenStore.clearAll();
        }
        return RefreshOutcome.sessionExpired;
      }
      // Network/5xx/429 (L-3): leave storage untouched — a transient failure
      // should not destroy a still-potentially-valid refresh token. Most call
      // sites (requestWithRefresh, via the silentRefresh bool projection)
      // still surface this as a failed refresh for THIS in-flight request;
      // callers that can distinguish (cold-start bootstrap) get
      // transientFailure instead of sessionExpired so they can offer a
      // retry/offline state rather than forcing a full re-login.
      return RefreshOutcome.transientFailure;
    }
  }

  /// Runs [send] once; on a 401 [ApiError] that [isAuthExpiry] accepts,
  /// attempts exactly one silent refresh then retries [send] exactly once. A
  /// second failure — refresh itself failing, or the retried call still
  /// 401-with-[isAuthExpiry]-true — surfaces as [SessionExpiredException].
  /// Never loops (client-security skill).
  ///
  /// [isAuthExpiry] defaults to "every 401 means the access token died" —
  /// correct for endpoints whose ONLY 401 source is `JwtAuthGuard` rejecting
  /// a dead/missing Bearer token (`getSessions`, `logoutAll`). It is
  /// overridden for `changePassword` (api-spec §2.7), whose 401 is
  /// double-duty: the SAME status also means "wrong `currentPassword`" (an
  /// `INVALID_CREDENTIALS`-coded semantic error, nothing to do with the
  /// access token) — treating that as session-expiry would wipe a live
  /// session and kick the user to login over a simple typo.
  Future<T> requestWithRefresh<T>(
    Future<T> Function() send, {
    bool Function(ApiError) isAuthExpiry = _defaultIsAuthExpiry,
  }) {
    return _refreshCoordinator.requestWithRefresh<T>(
      send,
      isAuthExpiry: (error) => error is ApiError && error.status == 401 && isAuthExpiry(error),
    );
  }

  static bool _defaultIsAuthExpiry(ApiError _) => true;

  /// `changePassword`'s 401 is only an access-token-expiry signal when it
  /// carries NO app-level error code (a bare `JwtAuthGuard` rejection body).
  /// A 401 that DOES carry `INVALID_CREDENTIALS` is the documented
  /// wrong-current-password outcome (api-spec §2.7) — never route that
  /// through silent-refresh/session-expiry.
  static bool _isChangePasswordAuthExpiry(ApiError e) => e.code != 'INVALID_CREDENTIALS';

  // ---- Authenticated endpoints (Bearer + silent-refresh-then-retry-once) ----

  Options _bearerOptions() {
    final token = _tokenStore.accessToken;
    return Options(headers: token != null ? {'Authorization': 'Bearer $token'} : null);
  }

  /// Returns the domain [domain.Session] entity list (not the generated
  /// wire DTO) — presentation never imports `omnistock_api_client` directly
  /// (docs/mobile-architecture.md §2 boundary rule); this is the ONLY place
  /// that maps the wire `Session` to the domain entity.
  Future<List<domain.Session>> getSessions() {
    return requestWithRefresh(() async {
      try {
        final res = await _authApi.authSessions(headers: _bearerOptions().headers);
        final body = res.data;
        if (body == null) throw ApiError(res.statusCode ?? 0, null);
        return body.sessions.map(_toDomainSession).toList();
      } on DioException catch (e) {
        throw _mapDioError(e);
      }
    });
  }

  domain.Session _toDomainSession(wire.Session s) => domain.Session(
        familyId: s.familyId,
        deviceId: s.deviceId,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
        current: s.current,
      );

  /// Per-device / current-device logout (US-4). Body-transport: presents
  /// the current refresh token so the server can resolve "current family"
  /// even without the Bearer token attached (mirrors api-spec §2.4 — the
  /// endpoint itself has `security: []`). Optional [familyId] targets a
  /// specific LISTED non-current session (§2.4/§2.6, M-3 ownership-checked
  /// server-side).
  Future<void> logoutDevice({String? familyId}) async {
    final currentRefreshToken = await _tokenStore.getRefreshToken();
    try {
      await _authApi.authLogout(
        logoutRequest: LogoutRequest((b) {
          if (currentRefreshToken != null) b.refreshToken = currentRefreshToken;
          if (familyId != null) b.familyId = familyId;
        }),
      );
    } on DioException catch (e) {
      throw _mapDioError(e);
    }
    // Only wipe local state when logging out the CURRENT device (no
    // familyId, or it targets the session we're on) — logging out a listed
    // OTHER device must not clear our own live session (ux-wireframe §4).
    if (familyId == null) {
      await _wipeForLogout();
    }
  }

  Future<void> logoutAll() async {
    await requestWithRefresh(() async {
      try {
        await _authApi.authLogoutAll(headers: _bearerOptions().headers);
        return null;
      } on DioException catch (e) {
        throw _mapDioError(e);
      }
    });
    await _wipeForLogout();
  }

  Future<OkResponse> changePassword({
    required String currentPassword,
    required String newPassword,
  }) {
    return requestWithRefresh(() async {
      final currentRefreshToken = await _tokenStore.getRefreshToken();
      try {
        final res = await _authApi.authChangePassword(
          changePasswordRequest: ChangePasswordRequest((b) {
            b
              ..currentPassword = currentPassword
              ..newPassword = newPassword;
            if (currentRefreshToken != null) b.refreshToken = currentRefreshToken;
          }),
          headers: _bearerOptions().headers,
        );
        final body = res.data;
        if (body == null) throw ApiError(res.statusCode ?? 0, null);
        return body;
      } on DioException catch (e) {
        throw _mapDioError(e);
      }
    }, isAuthExpiry: _isChangePasswordAuthExpiry);
  }
}
