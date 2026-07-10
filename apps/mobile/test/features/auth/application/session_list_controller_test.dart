import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

import 'package:mobile/core/api/refresh_coordinator.dart';
import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/auth/application/session_list_controller.dart';
import 'package:mobile/features/auth/data/auth_repository_impl.dart';
import 'package:mobile/features/auth/data/token_store.dart';

import '../data/fake_dio_adapter.dart';
import '../data/fakes.dart';

AuthRepositoryImpl buildClient(FakeHttpClientAdapter adapter) {
  final dio = buildFakeDio(adapter);
  final authApi = AuthApi(dio, standardSerializers);
  final store = TokenStore(secureStorage: FakeSecureStorage());
  store.setAccessToken('access-1');
  return AuthRepositoryImpl(authApi: authApi, tokenStore: store);
}

ProviderContainer buildContainer(AuthRepositoryImpl client) {
  final container = ProviderContainer(
    overrides: [authRepositoryProvider.overrideWithValue(client)],
  );
  addTearDown(container.dispose);
  // Keep the autoDispose controller alive for the test's duration — in
  // production the mounted screen's ref.watch holds it; without a listener
  // the provider (and its ThrottleCountdownController) is torn down between
  // microtasks mid-test.
  container.listen(sessionListControllerProvider, (_, __) {});
  return container;
}

Map<String, Object?> sessionJson({
  required String familyId,
  String? deviceId,
  required String createdAt,
  String? lastUsedAt,
  required bool current,
}) {
  return {
    'familyId': familyId,
    'deviceId': deviceId,
    'createdAt': createdAt,
    'lastUsedAt': lastUsedAt,
    'current': current,
  };
}

void main() {
  group('SessionListController (D-023 PASS 2 — application layer)', () {
    test('build() loads sessions sorted by lastUsedAt/createdAt descending', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {
        'sessions': [
          sessionJson(
            familyId: 'older',
            createdAt: '2026-07-01T00:00:00.000Z',
            lastUsedAt: '2026-07-02T00:00:00.000Z',
            current: false,
          ),
          sessionJson(
            familyId: 'newer',
            createdAt: '2026-07-01T00:00:00.000Z',
            lastUsedAt: '2026-07-06T00:00:00.000Z',
            current: true,
          ),
        ],
      }));
      final client = buildClient(adapter);
      final container = buildContainer(client);

      final sessions = await container.read(sessionListControllerProvider.future);

      expect(sessions.map((s) => s.familyId).toList(), ['newer', 'older']);
    });

    test(
        'a dead session on the INITIAL build() fetch surfaces as '
        'AsyncValue.error(SessionExpiredException) — observable on the mount path (★ Important #1)',
        () async {
      final adapter = FakeHttpClientAdapter();
      // Access token expired (401, no app code) then refresh itself dead too.
      adapter.enqueue(FakeResponse(statusCode: 401));
      adapter.enqueue(FakeResponse(
        statusCode: 401,
        jsonBody: {
          'error': {'code': 'INVALID_REFRESH', 'message': 'dead'},
        },
      ));
      final client = buildClient(adapter);
      final container = buildContainer(client);

      // The earlier pass-2 shape swallowed this into an empty data state,
      // which left the mount path with no way to notice the dead session.
      await expectLater(
        container.read(sessionListControllerProvider.future),
        throwsA(isA<SessionExpiredException>()),
      );
      final state = container.read(sessionListControllerProvider);
      expect(state.hasError, isTrue);
      expect(state.error, isA<SessionExpiredException>());
    });

    test(
        'autoDispose: state does NOT survive teardown — a re-mount re-fetches '
        'instead of replaying the previous user\'s cached list (★ Important #2)',
        () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {
        'sessions': [
          sessionJson(familyId: 'user-a-device', createdAt: '2026-07-01T00:00:00.000Z', current: false),
        ],
      }));
      final client = buildClient(adapter);
      // Deliberately NOT buildContainer — that helper holds a permanent
      // keep-alive listener, which would prevent the autoDispose teardown
      // this test exists to prove.
      final container = ProviderContainer(
        overrides: [authRepositoryProvider.overrideWithValue(client)],
      );
      addTearDown(container.dispose);

      // First "mount": listen (keeps the autoDispose provider alive) and load.
      final sub = container.listen(sessionListControllerProvider, (_, __) {});
      final first = await container.read(sessionListControllerProvider.future);
      expect(first.map((s) => s.familyId), ['user-a-device']);

      // "Unmount": drop the only listener → autoDispose tears the state down.
      sub.close();
      await Future<void>.delayed(Duration.zero);

      // Second "mount" (e.g. user B after logout/re-login): must re-fetch —
      // the fake now returns a different list; a cached replay would show
      // user A's device row.
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {'sessions': <Map<String, Object?>>[]}));
      final sub2 = container.listen(sessionListControllerProvider, (_, __) {});
      final second = await container.read(sessionListControllerProvider.future);
      expect(second, isEmpty);
      sub2.close();
    });

    test('load() re-issues the request and returns sessionExpired on the retry when dead', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {'sessions': <Map<String, Object?>>[]}));
      final client = buildClient(adapter);
      final container = buildContainer(client);
      await container.read(sessionListControllerProvider.future);

      adapter.enqueue(FakeResponse(statusCode: 401));
      adapter.enqueue(FakeResponse(
        statusCode: 401,
        jsonBody: {
          'error': {'code': 'INVALID_REFRESH', 'message': 'dead'},
        },
      ));
      final result = await container.read(sessionListControllerProvider.notifier).load();

      expect(result, SessionListLoadResult.sessionExpired);
    });

    test('load() surfaces a generic failure as AsyncValue.error (renders the error state)', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 500));
      final client = buildClient(adapter);
      final container = buildContainer(client);

      // build() itself throws through AsyncNotifier's future -> caught by
      // the provider as an AsyncError; awaiting `.future` rethrows it.
      await expectLater(container.read(sessionListControllerProvider.future), throwsException);
      expect(container.read(sessionListControllerProvider).hasError, isTrue);
    });

    test('logoutDevice() optimistically removes the row, keeps it removed on success', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {
        'sessions': [
          sessionJson(familyId: 'f1', createdAt: '2026-07-01T00:00:00.000Z', current: true),
          sessionJson(familyId: 'f2', createdAt: '2026-07-01T00:00:00.000Z', current: false),
        ],
      }));
      adapter.enqueue(FakeResponse(statusCode: 204));
      final client = buildClient(adapter);
      final container = buildContainer(client);
      await container.read(sessionListControllerProvider.future);

      final success = await container.read(sessionListControllerProvider.notifier).logoutDevice('f2');

      expect(success, isTrue);
      expect(
        container.read(sessionListControllerProvider).valueOrNull!.map((s) => s.familyId),
        ['f1'],
      );
    });

    test('logoutDevice() restores the previous list when the repository call fails', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {
        'sessions': [
          sessionJson(familyId: 'f1', createdAt: '2026-07-01T00:00:00.000Z', current: true),
          sessionJson(familyId: 'f2', createdAt: '2026-07-01T00:00:00.000Z', current: false),
        ],
      }));
      adapter.enqueue(FakeResponse(statusCode: 500));
      final client = buildClient(adapter);
      final container = buildContainer(client);
      await container.read(sessionListControllerProvider.future);

      final success = await container.read(sessionListControllerProvider.notifier).logoutDevice('f2');

      expect(success, isFalse);
      expect(
        container.read(sessionListControllerProvider).valueOrNull!.map((s) => s.familyId).toSet(),
        {'f1', 'f2'},
      );
    });

    test('logoutAll() returns ok on success', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {'sessions': <Map<String, Object?>>[]}));
      adapter.enqueue(FakeResponse(statusCode: 204));
      final client = buildClient(adapter);
      final container = buildContainer(client);
      await container.read(sessionListControllerProvider.future);

      final result = await container.read(sessionListControllerProvider.notifier).logoutAll();

      expect(result, SessionListLoadResult.ok);
    });

    test('logoutAll() returns sessionExpired when the repository reports a dead session', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {'sessions': <Map<String, Object?>>[]}));
      final client = buildClient(adapter);
      final container = buildContainer(client);
      await container.read(sessionListControllerProvider.future);

      adapter.enqueue(FakeResponse(statusCode: 401));
      adapter.enqueue(FakeResponse(
        statusCode: 401,
        jsonBody: {
          'error': {'code': 'INVALID_REFRESH', 'message': 'dead'},
        },
      ));
      final result = await container.read(sessionListControllerProvider.notifier).logoutAll();

      expect(result, SessionListLoadResult.sessionExpired);
    });

    test('logoutAll() returns null on a generic failure', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {'sessions': <Map<String, Object?>>[]}));
      adapter.enqueue(FakeResponse(statusCode: 500));
      final client = buildClient(adapter);
      final container = buildContainer(client);
      await container.read(sessionListControllerProvider.future);

      final result = await container.read(sessionListControllerProvider.notifier).logoutAll();

      expect(result, isNull);
    });
  });
}
