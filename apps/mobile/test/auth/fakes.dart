import 'package:omnistock_api_client/omnistock_api_client.dart';

import 'package:mobile/auth/secure_storage.dart';

/// In-memory [SecureStorage] fake for tests — no platform channel, no real
/// Keychain/Keystore. Lets token-store tests assert write/read/clear
/// semantics deterministically.
class FakeSecureStorage implements SecureStorage {
  final Map<String, String> _store = {};

  /// Test-only introspection: lets a test assert the underlying storage was
  /// actually written/deleted (not just that the public getter returns
  /// null), which is the whole point of the client-security assertion "never
  /// SharedPreferences/plaintext" — asserting VIA the real storage surface.
  Map<String, String> get raw => Map.unmodifiable(_store);

  @override
  Future<void> write(String key, String value) async {
    _store[key] = value;
  }

  @override
  Future<String?> read(String key) async => _store[key];

  @override
  Future<void> delete(String key) async {
    _store.remove(key);
  }
}

/// Builds a minimal [ErrorResponse] for ApiError construction in tests.
ErrorResponse buildErrorResponse(String code, [String message = 'test error']) {
  return ErrorResponse((b) => b.error = ErrorResponseErrorBuilder()
    ..code = code
    ..message = message);
}
