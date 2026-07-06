import 'package:built_value/serializer.dart';
import 'package:dio/dio.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

import 'auth_exceptions.dart';
import 'token_store.dart';

/// T-001-17 ★ — mobile token/refresh flow.
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
/// request/response types (frontend does not decide API/data shape).
class AuthClient {
  AuthClient({
    required AuthApi authApi,
    required TokenStore tokenStore,
    String? deviceId,
  })  : _authApi = authApi,
        _tokenStore = tokenStore,
        _deviceId = deviceId;

  final AuthApi _authApi;
  final TokenStore _tokenStore;
  final String? _deviceId;

  TokenStore get tokenStore => _tokenStore;

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

  /// Rotates the refresh token. Presents the CURRENT refresh token from
  /// secure storage in the request body (body transport, api-spec §2.3).
  /// Returns true + stores the new pair on success; on failure, per mobile
  /// guidance M-2 (api-spec §5): **do not retry with the same token** — wipe
  /// storage. Never throws; callers treat it as a boolean gate (mirrors
  /// `silentRefresh` in apps/web/src/lib/auth-client.ts).
  Future<bool> silentRefresh() async {
    if (_inflightRefresh != null) return _inflightRefresh!;
    final future = _doRefresh();
    _inflightRefresh = future;
    try {
      return await future;
    } finally {
      _inflightRefresh = null;
    }
  }

  // Single-flight dedupe (mirrors apps/web/src/lib/auth-client.ts): several
  // concurrent 401s must share ONE /auth/refresh call, or a second/third
  // real refresh call would hit the just-rotated token as a benign-retry 401
  // (arch §3.5 leeway window) purely from a client-side race, wrongly
  // throwing SessionExpiredException for a still-live session.
  Future<bool>? _inflightRefresh;

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

  Future<bool> _doRefresh() async {
    final epochAtStart = _logoutEpoch;
    final currentRefreshToken = await _tokenStore.getRefreshToken();
    if (currentRefreshToken == null) {
      await _tokenStore.clearAll();
      return false;
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
        await _tokenStore.clearAll();
        return false;
      }
      if (_logoutEpoch != epochAtStart) {
        // A logout happened while this refresh was in flight — storage was
        // already deliberately wiped; do not rewrite a dead token into it.
        return false;
      }
      _tokenStore.setAccessToken(body.accessToken, expiresInSeconds: body.expiresIn);
      final rotated = body.refreshToken;
      if (rotated != null) {
        await _tokenStore.setRefreshToken(rotated);
      }
      return true;
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
        return false;
      }
      // Network/5xx/429: leave storage untouched — a transient failure
      // should not destroy a still-potentially-valid refresh token. The
      // caller surfaces this as a failed silentRefresh (-> session-expired
      // treatment for THIS request), but a later attempt may still succeed.
      return false;
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
  }) async {
    try {
      return await send();
    } on ApiError catch (first) {
      if (first.status != 401 || !isAuthExpiry(first)) rethrow;

      final refreshed = await silentRefresh();
      if (!refreshed) {
        throw const SessionExpiredException();
      }

      try {
        return await send();
      } on ApiError catch (second) {
        if (second.status == 401 && isAuthExpiry(second)) {
          // Refreshed successfully but the retried call still 401'd (e.g.
          // kicked mid-flight, ux-wireframe §7) — do not loop again.
          await _tokenStore.clearAll();
          throw const SessionExpiredException();
        }
        rethrow;
      }
    }
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

  Future<SessionsResponse> getSessions() {
    return requestWithRefresh(() async {
      try {
        final res = await _authApi.authSessions(headers: _bearerOptions().headers);
        final body = res.data;
        if (body == null) throw ApiError(res.statusCode ?? 0, null);
        return body;
      } on DioException catch (e) {
        throw _mapDioError(e);
      }
    });
  }

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
