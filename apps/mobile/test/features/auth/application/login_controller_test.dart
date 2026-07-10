import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/auth/application/login_controller.dart';
import 'package:mobile/features/auth/data/auth_repository_impl.dart';
import 'package:mobile/features/auth/data/token_store.dart';

import '../data/fake_dio_adapter.dart';
import '../data/fakes.dart';

AuthRepositoryImpl buildClient(FakeHttpClientAdapter adapter) {
  final dio = buildFakeDio(adapter);
  final authApi = AuthApi(dio, standardSerializers);
  return AuthRepositoryImpl(authApi: authApi, tokenStore: TokenStore(secureStorage: FakeSecureStorage()));
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
  container.listen(loginControllerProvider, (_, __) {});
  return container;
}

void main() {
  group('LoginController (D-023 PASS 2 — application layer)', () {
    test('initial state is idle, not submitting, no errors', () {
      final client = buildClient(FakeHttpClientAdapter());
      final container = buildContainer(client);

      final state = container.read(loginControllerProvider);

      expect(state.submitting, isFalse);
      expect(state.hasCredentialsError, isFalse);
      expect(state.generalError, isNull);
    });

    test('success -> submit() returns true, submitting flips back to false', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {
        'accessToken': 'a',
        'refreshToken': 'r',
        'expiresIn': 900,
        'tokenType': 'Bearer',
      }));
      final client = buildClient(adapter);
      final container = buildContainer(client);

      final future = container
          .read(loginControllerProvider.notifier)
          .submit(email: 'a@b.com', password: 'password123');
      // Submitting flips true synchronously before the await resolves.
      expect(container.read(loginControllerProvider).submitting, isTrue);

      final success = await future;

      expect(success, isTrue);
      expect(container.read(loginControllerProvider).submitting, isFalse);
      expect(container.read(loginControllerProvider).generalError, isNull);
    });

    test('401 -> submit() returns false, sets hasCredentialsError + generic copy + bumps clearPasswordSignal', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(
        statusCode: 401,
        jsonBody: {
          'error': {'code': 'INVALID_CREDENTIALS', 'message': 'nope'},
        },
      ));
      final client = buildClient(adapter);
      final container = buildContainer(client);

      final success =
          await container.read(loginControllerProvider.notifier).submit(email: 'a@b.com', password: 'wrong');

      expect(success, isFalse);
      final state = container.read(loginControllerProvider);
      expect(state.hasCredentialsError, isTrue);
      expect(state.generalError, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      expect(state.clearPasswordSignal, 1);
      expect(state.submitting, isFalse);
    });

    test('429 -> submit() returns false and starts the throttle countdown', () async {
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
      final client = buildClient(adapter);
      final container = buildContainer(client);
      final controller = container.read(loginControllerProvider.notifier);

      final success = await controller.submit(email: 'a@b.com', password: 'password123');

      expect(success, isFalse);
      expect(controller.throttle.isActive, isTrue);
      expect(controller.throttle.remainingSeconds, 30);
    });

    test('submit() is a no-op while throttled (no extra network call)', () async {
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
      final client = buildClient(adapter);
      final container = buildContainer(client);
      final controller = container.read(loginControllerProvider.notifier);

      await controller.submit(email: 'a@b.com', password: 'password123');
      expect(adapter.capturedRequests, hasLength(1));

      final blockedSuccess = await controller.submit(email: 'a@b.com', password: 'password123');
      expect(blockedSuccess, isFalse);
      expect(adapter.capturedRequests, hasLength(1)); // no second request issued
    });

    test('unmapped/network failure -> submit() returns false with the generic error copy', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 503, jsonBody: null));
      final client = buildClient(adapter);
      final container = buildContainer(client);

      final success =
          await container.read(loginControllerProvider.notifier).submit(email: 'a@b.com', password: 'password123');

      expect(success, isFalse);
      expect(container.read(loginControllerProvider).generalError, isNotNull);
      expect(container.read(loginControllerProvider).hasCredentialsError, isFalse);
    });
  });
}
