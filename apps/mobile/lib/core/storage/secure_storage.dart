import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Minimal storage seam [TokenStore] depends on — lets tests substitute an
/// in-memory fake instead of driving a real platform channel (root
/// CLAUDE.md rule #4: "โครงสร้างโค้ดต้อง testable (pure fn/DI/seam)").
/// [FlutterSecureStorageAdapter] is the only production implementation and
/// is the ONLY code in this package allowed to construct a real
/// [FlutterSecureStorage] (Keychain on iOS, Keystore-backed
/// EncryptedSharedPreferences on Android — client-security skill: "Tokens in
/// flutter_secure_storage ... only — never SharedPreferences, files, or
/// logs").
abstract class SecureStorage {
  Future<void> write(String key, String value);
  Future<String?> read(String key);
  Future<void> delete(String key);
}

/// T-001-17 ★ (L-1): explicit platform options rather than the plugin's
/// implicit defaults, so the encryption posture is documented and pinned
/// in code (not "whatever the library defaults to this release"):
/// - Android: `encryptedSharedPreferences: true` — backs the value with
///   Android's `EncryptedSharedPreferences` (AES-256, Keystore-managed key)
///   instead of the legacy plain-SharedPreferences-plus-RSA-wrapped-key path.
/// - iOS: `accessibility: first_unlock_this_device` — the Keychain item is
///   readable only after the device's first unlock since boot, and (the
///   `_this_device` suffix) never migrates via an encrypted iCloud/iTunes
///   backup to a different device — appropriate for a refresh token, which
///   must not silently reappear on a restored/different device.
const _androidOptions = AndroidOptions(encryptedSharedPreferences: true);
const _iosOptions = IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device);

class FlutterSecureStorageAdapter implements SecureStorage {
  const FlutterSecureStorageAdapter([
    this._storage = const FlutterSecureStorage(
      aOptions: _androidOptions,
      iOptions: _iosOptions,
    ),
  ]);

  final FlutterSecureStorage _storage;

  @override
  Future<void> write(String key, String value) => _storage.write(key: key, value: value);

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}
