import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/auth/token_store.dart';

import 'fakes.dart';

void main() {
  group('TokenStore', () {
    test('access token starts null', () {
      final store = TokenStore(secureStorage: FakeSecureStorage());
      expect(store.accessToken, isNull);
    });

    test('setAccessToken stores in memory only — never in secure storage', () {
      final fake = FakeSecureStorage();
      final store = TokenStore(secureStorage: fake);

      store.setAccessToken('access-123', expiresInSeconds: 900);

      expect(store.accessToken, 'access-123');
      // client-security: the access token must never touch secure storage.
      expect(fake.raw.values, isNot(contains('access-123')));
      expect(fake.raw, isEmpty);
    });

    test('clearAccessToken drops only the in-memory access token', () async {
      final fake = FakeSecureStorage();
      final store = TokenStore(secureStorage: fake);
      store.setAccessToken('access-123');
      await store.setRefreshToken('refresh-abc');

      store.clearAccessToken();

      expect(store.accessToken, isNull);
      expect(await store.getRefreshToken(), 'refresh-abc');
    });

    test('setRefreshToken persists to secure storage (write/read round-trip)', () async {
      final fake = FakeSecureStorage();
      final store = TokenStore(secureStorage: fake);

      await store.setRefreshToken('refresh-abc');

      expect(await store.getRefreshToken(), 'refresh-abc');
      expect(fake.raw.values, contains('refresh-abc'));
    });

    test('getRefreshToken returns null when never set', () async {
      final store = TokenStore(secureStorage: FakeSecureStorage());
      expect(await store.getRefreshToken(), isNull);
    });

    test('clearAll wipes BOTH the in-memory access token and the keychain-held refresh token', () async {
      final fake = FakeSecureStorage();
      final store = TokenStore(secureStorage: fake);
      store.setAccessToken('access-123');
      await store.setRefreshToken('refresh-abc');

      await store.clearAll();

      expect(store.accessToken, isNull);
      expect(await store.getRefreshToken(), isNull);
      expect(fake.raw, isEmpty);
    });

    test('clearAll is safe to call when nothing was ever set', () async {
      final store = TokenStore(secureStorage: FakeSecureStorage());
      await store.clearAll();
      expect(store.accessToken, isNull);
      expect(await store.getRefreshToken(), isNull);
    });
  });
}
