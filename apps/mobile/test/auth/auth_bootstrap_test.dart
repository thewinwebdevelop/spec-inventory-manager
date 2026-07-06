import 'package:flutter_test/flutter_test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

import 'package:mobile/auth/auth_bootstrap.dart';
import 'package:mobile/auth/auth_client.dart';
import 'package:mobile/auth/token_store.dart';

import 'fake_dio_adapter.dart';
import 'fakes.dart';

AuthClient buildClient(FakeHttpClientAdapter adapter, {TokenStore? tokenStore}) {
  final dio = buildFakeDio(adapter);
  final authApi = AuthApi(dio, standardSerializers);
  return AuthClient(
    authApi: authApi,
    tokenStore: tokenStore ?? TokenStore(secureStorage: FakeSecureStorage()),
  );
}

void main() {
  group('runAuthBootstrap (T-001-17 M-2 — cold-start restore)', () {
    test('no refresh token in the keychain -> noSession, no network call made', () async {
      final adapter = FakeHttpClientAdapter();
      final client = buildClient(adapter);

      final result = await runAuthBootstrap(client);

      expect(result, AuthBootstrapStatus.noSession);
      expect(adapter.capturedRequests, isEmpty);
    });

    test('refresh token present + /auth/refresh succeeds -> restored, new pair stored', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {
        'accessToken': 'access-2',
        'refreshToken': 'refresh-2',
        'expiresIn': 900,
        'tokenType': 'Bearer',
      }));
      final fakeStorage = FakeSecureStorage();
      final tokenStore = TokenStore(secureStorage: fakeStorage);
      await tokenStore.setRefreshToken('refresh-1');
      final client = buildClient(adapter, tokenStore: tokenStore);

      final result = await runAuthBootstrap(client);

      expect(result, AuthBootstrapStatus.restored);
      expect(tokenStore.accessToken, 'access-2');
      expect(await tokenStore.getRefreshToken(), 'refresh-2');
    });

    test('refresh token present but dead (401 INVALID_REFRESH) -> sessionExpired, storage wiped', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(
        statusCode: 401,
        jsonBody: {
          'error': {'code': 'INVALID_REFRESH', 'message': 'dead'},
        },
      ));
      final fakeStorage = FakeSecureStorage();
      final tokenStore = TokenStore(secureStorage: fakeStorage);
      await tokenStore.setRefreshToken('refresh-1');
      final client = buildClient(adapter, tokenStore: tokenStore);

      final result = await runAuthBootstrap(client);

      expect(result, AuthBootstrapStatus.sessionExpired);
      expect(await tokenStore.getRefreshToken(), isNull);
      expect(fakeStorage.raw, isEmpty);
    });

    test('refresh token present but network/5xx failure (L-3) -> transientFailure, token PRESERVED', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 503, jsonBody: null));
      final fakeStorage = FakeSecureStorage();
      final tokenStore = TokenStore(secureStorage: fakeStorage);
      await tokenStore.setRefreshToken('refresh-1');
      final client = buildClient(adapter, tokenStore: tokenStore);

      final result = await runAuthBootstrap(client);

      expect(result, AuthBootstrapStatus.transientFailure);
      // Unlike sessionExpired, the token must survive a transient failure —
      // a later retry can still succeed.
      expect(await tokenStore.getRefreshToken(), 'refresh-1');
      expect(tokenStore.accessToken, isNull);
    });

    test('refresh token present but 429 (throttled) -> transientFailure, token preserved', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(
        statusCode: 429,
        jsonBody: {
          'error': {'code': 'RATE_LIMITED', 'message': 'slow down'},
        },
      ));
      final tokenStore = TokenStore(secureStorage: FakeSecureStorage());
      await tokenStore.setRefreshToken('refresh-1');
      final client = buildClient(adapter, tokenStore: tokenStore);

      final result = await runAuthBootstrap(client);

      expect(result, AuthBootstrapStatus.transientFailure);
      expect(await tokenStore.getRefreshToken(), 'refresh-1');
    });

    test('a retry after a transientFailure can still succeed (token was never wiped)', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 503, jsonBody: null)); // first attempt: transient 5xx
      final tokenStore = TokenStore(secureStorage: FakeSecureStorage());
      await tokenStore.setRefreshToken('refresh-1');
      final client = buildClient(adapter, tokenStore: tokenStore);

      final first = await runAuthBootstrap(client);
      expect(first, AuthBootstrapStatus.transientFailure);

      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {
        'accessToken': 'access-retry',
        'refreshToken': 'refresh-retry',
        'expiresIn': 900,
        'tokenType': 'Bearer',
      }));
      final second = await runAuthBootstrap(client);
      expect(second, AuthBootstrapStatus.restored);
      expect(tokenStore.accessToken, 'access-retry');
    });
  });
}
