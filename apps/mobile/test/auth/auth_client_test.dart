import 'package:flutter_test/flutter_test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

import 'package:mobile/auth/auth_client.dart';
import 'package:mobile/auth/auth_exceptions.dart';
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
  group('AuthClient.login — body transport (mobile, never cookie)', () {
    test('sends tokenTransport=body and stores access token in memory + refresh token in secure storage', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {
        'accessToken': 'access-1',
        'refreshToken': 'refresh-1',
        'expiresIn': 900,
        'tokenType': 'Bearer',
      }));
      final tokenStore = TokenStore(secureStorage: FakeSecureStorage());
      final client = buildClient(adapter, tokenStore: tokenStore);

      final res = await client.login(email: 'somchai@shop.com', password: 'password123');

      expect(res.accessToken, 'access-1');
      expect(tokenStore.accessToken, 'access-1');
      expect(await tokenStore.getRefreshToken(), 'refresh-1');

      // Assert the wire request declared body transport, never cookie
      // (D-019's cookie-path fix is web-only; mobile always uses body).
      final sentBody = adapter.capturedRequests.single.data as Map;
      expect(sentBody['tokenTransport'], 'body');
    });

    test('401 INVALID_CREDENTIALS surfaces as ApiError with the generic code', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(
        statusCode: 401,
        jsonBody: {
          'error': {'code': 'INVALID_CREDENTIALS', 'message': 'bad creds'},
        },
      ));
      final client = buildClient(adapter);

      await expectLater(
        () => client.login(email: 'x@shop.com', password: 'wrong'),
        throwsA(isA<ApiError>()
            .having((e) => e.status, 'status', 401)
            .having((e) => e.code, 'code', 'INVALID_CREDENTIALS')),
      );
    });

    test('429 surfaces retryAfterSeconds from the Retry-After header', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(
        statusCode: 429,
        jsonBody: {
          'error': {'code': 'RATE_LIMITED', 'message': 'slow down'},
        },
        headers: {
          'retry-after': ['42'],
        },
      ));
      final client = buildClient(adapter);

      await expectLater(
        () => client.login(email: 'x@shop.com', password: 'y'),
        throwsA(isA<ApiError>()
            .having((e) => e.status, 'status', 429)
            .having((e) => e.retryAfterSeconds, 'retryAfterSeconds', 42)),
      );
    });
  });

  group('AuthClient.signup', () {
    test('201 returns the SignupResponse', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 201, jsonBody: {
        'userId': 'u1',
        'email': 'somchai@shop.com',
        // built_value models `verified` as an enum whose sole wire value is
        // the STRING "false" (not JSON boolean false) — see
        // SignupResponseVerifiedEnum in the generated model.
        'verified': 'false',
      }));
      final client = buildClient(adapter);

      final res = await client.signup(email: 'somchai@shop.com', password: 'password123');
      expect(res.userId, 'u1');
    });

    test('409 EMAIL_TAKEN surfaces as ApiError', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(
        statusCode: 409,
        jsonBody: {
          'error': {'code': 'EMAIL_TAKEN', 'message': 'taken'},
        },
      ));
      final client = buildClient(adapter);

      await expectLater(
        () => client.signup(email: 'dup@shop.com', password: 'password123'),
        throwsA(isA<ApiError>().having((e) => e.code, 'code', 'EMAIL_TAKEN')),
      );
    });
  });

  group('AuthClient authenticated calls — silent-refresh-then-retry-once', () {
    Future<TokenStore> loggedInStore() async {
      final store = TokenStore(secureStorage: FakeSecureStorage());
      store.setAccessToken('stale-access');
      await store.setRefreshToken('refresh-1');
      return store;
    }

    test('a live session (no 401) does not trigger a refresh call', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {
        'sessions': [
          {
            'familyId': 'f1',
            'deviceId': 'device-1',
            'createdAt': '2026-07-01T00:00:00.000Z',
            'lastUsedAt': '2026-07-06T00:00:00.000Z',
            'current': true,
          }
        ],
      }));
      final tokenStore = await loggedInStore();
      final client = buildClient(adapter, tokenStore: tokenStore);

      final res = await client.getSessions();

      expect(res.sessions.length, 1);
      expect(adapter.capturedRequests, hasLength(1));
    });

    test('401 -> silent refresh -> retry succeeds once, never loops', () async {
      final adapter = FakeHttpClientAdapter();
      // 1) first getSessions call -> 401
      adapter.enqueue(FakeResponse(
        statusCode: 401,
        jsonBody: {
          'error': {'code': 'INVALID_CREDENTIALS', 'message': 'expired'},
        },
      ));
      // 2) refresh call -> succeeds with a new pair
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {
        'accessToken': 'fresh-access',
        'refreshToken': 'fresh-refresh',
        'expiresIn': 900,
        'tokenType': 'Bearer',
      }));
      // 3) retried getSessions call -> succeeds
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {
        'sessions': <Map<String, Object?>>[],
      }));

      final tokenStore = await loggedInStore();
      final client = buildClient(adapter, tokenStore: tokenStore);

      final res = await client.getSessions();

      expect(res.sessions, isEmpty);
      expect(adapter.capturedRequests, hasLength(3));
      expect(tokenStore.accessToken, 'fresh-access');
      expect(await tokenStore.getRefreshToken(), 'fresh-refresh');
    });

    test('401 -> refresh itself fails (401 INVALID_REFRESH) -> SessionExpiredException, storage wiped', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(
        statusCode: 401,
        jsonBody: {
          'error': {'code': 'INVALID_CREDENTIALS', 'message': 'expired'},
        },
      ));
      adapter.enqueue(FakeResponse(
        statusCode: 401,
        jsonBody: {
          'error': {'code': 'INVALID_REFRESH', 'message': 'dead'},
        },
      ));

      final tokenStore = await loggedInStore();
      final client = buildClient(adapter, tokenStore: tokenStore);

      await expectLater(() => client.getSessions(), throwsA(isA<SessionExpiredException>()));

      // client-security: a dead session must wipe storage completely.
      expect(tokenStore.accessToken, isNull);
      expect(await tokenStore.getRefreshToken(), isNull);
      // Never retried a second time against the refresh endpoint.
      expect(adapter.capturedRequests, hasLength(2));
    });

    test('401 -> refresh succeeds -> retried call STILL 401s (kicked mid-flight) -> SessionExpiredException, never loops again', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(
        statusCode: 401,
        jsonBody: {
          'error': {'code': 'INVALID_CREDENTIALS', 'message': 'expired'},
        },
      ));
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {
        'accessToken': 'fresh-access',
        'refreshToken': 'fresh-refresh',
        'expiresIn': 900,
        'tokenType': 'Bearer',
      }));
      adapter.enqueue(FakeResponse(
        statusCode: 401,
        jsonBody: {
          'error': {'code': 'INVALID_CREDENTIALS', 'message': 'still dead'},
        },
      ));

      final tokenStore = await loggedInStore();
      final client = buildClient(adapter, tokenStore: tokenStore);

      await expectLater(() => client.getSessions(), throwsA(isA<SessionExpiredException>()));
      // Exactly 3 calls total: original + refresh + retry-once. No further loop.
      expect(adapter.capturedRequests, hasLength(3));
      expect(tokenStore.accessToken, isNull);
    });

    test('no refresh token in storage -> silentRefresh fails immediately without a network call', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(
        statusCode: 401,
        jsonBody: {
          'error': {'code': 'INVALID_CREDENTIALS', 'message': 'expired'},
        },
      ));
      final tokenStore = TokenStore(secureStorage: FakeSecureStorage());
      tokenStore.setAccessToken('stale-access'); // no refresh token stored
      final client = buildClient(adapter, tokenStore: tokenStore);

      await expectLater(() => client.getSessions(), throwsA(isA<SessionExpiredException>()));
      // Only the original 401'd call — no refresh call attempted at all.
      expect(adapter.capturedRequests, hasLength(1));
    });

    test(
        'T-001-17 ★ M-1: 3 concurrent 401s each calling silentRefresh() share EXACTLY ONE '
        'POST /auth/refresh, and the live session is not wiped (mirrors web T-001-16 '
        'single-flight test)', () async {
      final adapter = FakeHttpClientAdapter();
      final gate = adapter.enqueueGated();
      final tokenStore = await loggedInStore();
      final client = buildClient(adapter, tokenStore: tokenStore);

      // Three "callers" each independently observe a 401 on their own request
      // around the same moment and each call silentRefresh() — this must
      // share ONE in-flight /auth/refresh call, never three (a second/third
      // real refresh call would consume the just-rotated token and hit a
      // benign-retry 401, wrongly manufacturing a dead-session signal for an
      // actually-live session).
      final call1 = client.silentRefresh();
      final call2 = client.silentRefresh();
      final call3 = client.silentRefresh();

      // Let Dio's async request pipeline (interceptors/transformers) actually
      // reach the adapter's `fetch` before asserting — the 3 `silentRefresh()`
      // calls above only *schedule* work synchronously.
      await pumpEventQueue();

      // Still only the one gated request in flight — assert BEFORE resolving,
      // same shape as the web single-flight test's pre-resolve assertion.
      expect(adapter.capturedRequests, hasLength(1));
      expect(adapter.capturedRequests.single.path, contains('refresh'));

      gate.complete(FakeResponse(statusCode: 200, jsonBody: {
        'accessToken': 'shared-access',
        'refreshToken': 'shared-refresh',
        'expiresIn': 900,
        'tokenType': 'Bearer',
      }));

      final results = await Future.wait([call1, call2, call3]);

      expect(results, [true, true, true]);
      // Exactly one POST /auth/refresh total, even after all 3 callers
      // resolved — no extra call was queued behind the dedupe.
      expect(adapter.capturedRequests, hasLength(1));
      // The live session was rotated, never wiped, by the shared refresh.
      expect(tokenStore.accessToken, 'shared-access');
      expect(await tokenStore.getRefreshToken(), 'shared-refresh');
    });

    test('T-001-17 ★ M-1: single-flight clears after settling — a LATER (non-concurrent) '
        'call fires a fresh /auth/refresh', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {
        'accessToken': 'first',
        'refreshToken': 'refresh-first',
        'expiresIn': 900,
        'tokenType': 'Bearer',
      }));
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {
        'accessToken': 'second',
        'refreshToken': 'refresh-second',
        'expiresIn': 900,
        'tokenType': 'Bearer',
      }));
      final tokenStore = await loggedInStore();
      final client = buildClient(adapter, tokenStore: tokenStore);

      expect(await client.silentRefresh(), isTrue);
      expect(tokenStore.accessToken, 'first');

      expect(await client.silentRefresh(), isTrue);
      expect(tokenStore.accessToken, 'second');

      expect(adapter.capturedRequests, hasLength(2));
    });

    test(
        'T-001-17 ★ L-2: a refresh that completes AFTER a logout wipe must NOT resurrect '
        'the wiped session (logout-epoch race)', () async {
      final adapter = FakeHttpClientAdapter();
      final gate = adapter.enqueueGated();
      // logoutDevice()'s own network call.
      adapter.enqueue(FakeResponse(statusCode: 204));

      final tokenStore = await loggedInStore();
      final client = buildClient(adapter, tokenStore: tokenStore);

      // A refresh starts (e.g. triggered by a 401 elsewhere) but its network
      // response is held open ("in flight")...
      final refreshFuture = client.silentRefresh();
      await pumpEventQueue();
      expect(adapter.capturedRequests, hasLength(1));

      // ...meanwhile the user explicitly logs out on THIS device, wiping
      // storage right now, while the refresh above is still pending.
      await client.logoutDevice();
      expect(tokenStore.accessToken, isNull);
      expect(await tokenStore.getRefreshToken(), isNull);

      // NOW the stale in-flight refresh resolves with a rotated pair.
      gate.complete(FakeResponse(statusCode: 200, jsonBody: {
        'accessToken': 'late-rotated-access',
        'refreshToken': 'late-rotated-refresh',
        'expiresIn': 900,
        'tokenType': 'Bearer',
      }));

      final refreshed = await refreshFuture;

      // The late refresh must not resurrect a dead token into wiped storage.
      expect(refreshed, isFalse);
      expect(tokenStore.accessToken, isNull);
      expect(await tokenStore.getRefreshToken(), isNull);
    });
  });

  group('AuthClient.logoutDevice — clear-on-logout (client-security)', () {
    test('logging out the CURRENT device (no familyId) wipes local token state', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 204));
      final tokenStore = TokenStore(secureStorage: FakeSecureStorage());
      tokenStore.setAccessToken('access-1');
      await tokenStore.setRefreshToken('refresh-1');
      final client = buildClient(adapter, tokenStore: tokenStore);

      await client.logoutDevice();

      expect(tokenStore.accessToken, isNull);
      expect(await tokenStore.getRefreshToken(), isNull);
    });

    test('logging out a LISTED OTHER device (familyId set) does NOT wipe our own session', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 204));
      final tokenStore = TokenStore(secureStorage: FakeSecureStorage());
      tokenStore.setAccessToken('access-1');
      await tokenStore.setRefreshToken('refresh-1');
      final client = buildClient(adapter, tokenStore: tokenStore);

      await client.logoutDevice(familyId: 'some-other-family');

      expect(tokenStore.accessToken, 'access-1');
      expect(await tokenStore.getRefreshToken(), 'refresh-1');
    });
  });

  group('AuthClient.logoutAll — clear-on-logout (client-security)', () {
    test('success wipes all local token state', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 204));
      final tokenStore = TokenStore(secureStorage: FakeSecureStorage());
      tokenStore.setAccessToken('access-1');
      await tokenStore.setRefreshToken('refresh-1');
      final client = buildClient(adapter, tokenStore: tokenStore);

      await client.logoutAll();

      expect(tokenStore.accessToken, isNull);
      expect(await tokenStore.getRefreshToken(), isNull);
    });
  });

  group('AuthClient.changePassword', () {
    test('success returns OkResponse and sends the current refresh token to help the server spare this session', () async {
      final adapter = FakeHttpClientAdapter();
      // built_value models `ok` as an enum whose sole wire value is the
      // STRING "true" (not JSON boolean true) — see OkResponseOkEnum.
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {'ok': 'true'}));
      final tokenStore = TokenStore(secureStorage: FakeSecureStorage());
      tokenStore.setAccessToken('access-1');
      await tokenStore.setRefreshToken('refresh-1');
      final client = buildClient(adapter, tokenStore: tokenStore);

      final res = await client.changePassword(currentPassword: 'old12345', newPassword: 'new123456');

      expect(res.ok, OkResponseOkEnum.true_);
      final sentBody = adapter.capturedRequests.single.data as Map;
      expect(sentBody['refreshToken'], 'refresh-1');
    });

    test('429 exposes retryAfterSeconds for the ThrottleBanner', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(
        statusCode: 429,
        jsonBody: {
          'error': {'code': 'RATE_LIMITED', 'message': 'slow down'},
        },
        headers: {
          'retry-after': ['30'],
        },
      ));
      final tokenStore = TokenStore(secureStorage: FakeSecureStorage());
      tokenStore.setAccessToken('access-1');
      final client = buildClient(adapter, tokenStore: tokenStore);

      await expectLater(
        () => client.changePassword(currentPassword: 'x', newPassword: 'new123456'),
        throwsA(isA<ApiError>().having((e) => e.retryAfterSeconds, 'retryAfterSeconds', 30)),
      );
    });

    test('401 INVALID_CREDENTIALS (wrong currentPassword) surfaces directly — no silent-refresh, no SessionExpiredException', () async {
      // api-spec §2.7: change-password's 401 is double-duty on the wire — it
      // can mean "wrong currentPassword" (an app-level semantic error, code
      // INVALID_CREDENTIALS) which has NOTHING to do with the access token's
      // validity. Blindly treating every 401 here as auth-expiry (like
      // getSessions/logoutAll correctly do) would silently wipe a live
      // session and kick the user to login over a simple password typo.
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(
        statusCode: 401,
        jsonBody: {
          'error': {'code': 'INVALID_CREDENTIALS', 'message': 'wrong current password'},
        },
      ));
      final tokenStore = TokenStore(secureStorage: FakeSecureStorage());
      tokenStore.setAccessToken('access-1');
      await tokenStore.setRefreshToken('refresh-1');
      final client = buildClient(adapter, tokenStore: tokenStore);

      await expectLater(
        () => client.changePassword(currentPassword: 'wrong', newPassword: 'new123456'),
        throwsA(isA<ApiError>()
            .having((e) => e.status, 'status', 401)
            .having((e) => e.code, 'code', 'INVALID_CREDENTIALS')),
      );

      // Exactly ONE request — no silent-refresh attempt was made.
      expect(adapter.capturedRequests, hasLength(1));
      // Tokens are untouched — this was not treated as a dead session.
      expect(tokenStore.accessToken, 'access-1');
      expect(await tokenStore.getRefreshToken(), 'refresh-1');
    });

    test('a bare 401 with no app error code (dead access token) DOES trigger silent-refresh-then-retry', () async {
      final adapter = FakeHttpClientAdapter();
      // 1) first call -> 401 with no body at all (bare JwtAuthGuard rejection).
      adapter.enqueue(FakeResponse(statusCode: 401));
      // 2) refresh -> succeeds.
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {
        'accessToken': 'fresh-access',
        'refreshToken': 'fresh-refresh',
        'expiresIn': 900,
        'tokenType': 'Bearer',
      }));
      // 3) retried call -> succeeds.
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {'ok': 'true'}));

      final tokenStore = TokenStore(secureStorage: FakeSecureStorage());
      tokenStore.setAccessToken('stale-access');
      await tokenStore.setRefreshToken('refresh-1');
      final client = buildClient(adapter, tokenStore: tokenStore);

      final res = await client.changePassword(currentPassword: 'old12345', newPassword: 'new123456');

      expect(res.ok, OkResponseOkEnum.true_);
      expect(adapter.capturedRequests, hasLength(3));
      expect(tokenStore.accessToken, 'fresh-access');
    });
  });
}
