import 'secure_storage.dart';

/// T-001-17 ★ — token storage seam.
///
/// client-security skill (mobile): "Tokens in flutter_secure_storage
/// (Keychain/Keystore) only — never SharedPreferences, files, or logs" +
/// "Clear all auth state on logout (storage + in-memory + any cached
/// client)". This module is the ONLY place in apps/mobile allowed to touch
/// the refresh token string.
///
/// - **Access token**: in-memory only (a plain instance field on
///   [TokenStore]) — never written to secure storage, never logged. Lost on
///   process death, which is fine: the refresh token survives in the
///   keychain and a silent refresh on the next 401 gets a new one
///   (ux-wireframe §7 "silent refresh").
/// - **Refresh token**: [SecureStorage] only — production wiring is
///   [FlutterSecureStorageAdapter] (Keychain on iOS,
///   EncryptedSharedPreferences/Keystore-backed on Android). No
///   plaintext/SharedPreferences path exists in this module.
///
/// Injectable [SecureStorage] so tests substitute an in-memory fake instead
/// of touching a real platform channel.
class TokenStore {
  TokenStore({SecureStorage? secureStorage})
      : _secureStorage = secureStorage ?? const FlutterSecureStorageAdapter();

  static const _refreshTokenKey = 'omni_refresh_token';

  final SecureStorage _secureStorage;

  String? _accessToken;

  /// In-memory access token (never persisted). Returns null if not
  /// currently logged in / not yet (re)issued.
  String? get accessToken => _accessToken;

  /// Stores the access token in memory only. `expiresInSeconds` mirrors
  /// `TokenResponse.expiresIn` (api-spec §2.2) but is not currently tracked
  /// for proactive pre-expiry — the client only reacts to a real 401
  /// (mirrors apps/web/src/lib/token-store.ts's documented parameter, kept
  /// for future proactive-refresh work without a signature change).
  void setAccessToken(String token, {int? expiresInSeconds}) {
    _accessToken = token;
  }

  /// Drops the in-memory access token only (does not touch the refresh
  /// token in secure storage) — used mid-flow before a refresh attempt.
  void clearAccessToken() {
    _accessToken = null;
  }

  /// Persists the refresh token to the OS keychain/keystore. Called after a
  /// successful login/refresh response (body-transport, api-spec §0 item 2).
  Future<void> setRefreshToken(String token) {
    return _secureStorage.write(_refreshTokenKey, token);
  }

  /// Reads the refresh token from the OS keychain/keystore, or null if never
  /// set / already cleared.
  Future<String?> getRefreshToken() {
    return _secureStorage.read(_refreshTokenKey);
  }

  /// Clear-on-logout (client-security skill, mandatory): wipes BOTH the
  /// keychain-held refresh token AND the in-memory access token. Call this
  /// on explicit logout, logout-all, and whenever a refresh attempt
  /// definitively fails (dead session — mirrors mobile guidance M-2 in
  /// api-spec.md §5: "wipe secure storage and go to the login screen").
  Future<void> clearAll() async {
    _accessToken = null;
    await _secureStorage.delete(_refreshTokenKey);
  }
}
