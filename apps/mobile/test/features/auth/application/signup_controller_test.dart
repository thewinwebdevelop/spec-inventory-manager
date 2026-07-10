import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/auth/application/signup_controller.dart';
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
  container.listen(signupControllerProvider, (_, __) {});
  return container;
}

void main() {
  group('SignupController (D-023 PASS 2 — application layer)', () {
    test('client-side validation blocks submit on a malformed email (no network call)', () async {
      final adapter = FakeHttpClientAdapter();
      final client = buildClient(adapter);
      final container = buildContainer(client);

      final result = await container
          .read(signupControllerProvider.notifier)
          .submit(email: 'not-an-email', password: 'password123');

      expect(result, isNull);
      expect(adapter.capturedRequests, isEmpty);
      expect(container.read(signupControllerProvider).emailError, 'รูปแบบอีเมลไม่ถูกต้อง');
    });

    test('client-side validation blocks submit on a too-short password', () async {
      final adapter = FakeHttpClientAdapter();
      final client = buildClient(adapter);
      final container = buildContainer(client);

      final result = await container
          .read(signupControllerProvider.notifier)
          .submit(email: 'somchai@shop.com', password: 'short');

      expect(result, isNull);
      expect(adapter.capturedRequests, isEmpty);
      expect(
        container.read(signupControllerProvider).passwordError,
        'รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 8 ตัวอักษร',
      );
    });

    test('validateEmailOnBlur sets/clears emailError without touching other fields', () {
      final client = buildClient(FakeHttpClientAdapter());
      final container = buildContainer(client);
      final controller = container.read(signupControllerProvider.notifier);

      controller.validateEmailOnBlur('not-an-email');
      expect(container.read(signupControllerProvider).emailError, isNotNull);

      controller.validateEmailOnBlur('somchai@shop.com');
      expect(container.read(signupControllerProvider).emailError, isNull);
    });

    test('success -> submit() returns the trimmed email (no auto-login)', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 201, jsonBody: {
        'userId': 'u1',
        'email': 'somchai@shop.com',
        'verified': 'false',
      }));
      final client = buildClient(adapter);
      final container = buildContainer(client);

      final result = await container
          .read(signupControllerProvider.notifier)
          .submit(email: '  somchai@shop.com  ', password: 'password123');

      expect(result, 'somchai@shop.com');
      expect(container.read(signupControllerProvider).submitting, isFalse);
    });

    test('409 EMAIL_TAKEN -> submit() returns null, sets emailError', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(
        statusCode: 409,
        jsonBody: {
          'error': {'code': 'EMAIL_TAKEN', 'message': 'taken'},
        },
      ));
      final client = buildClient(adapter);
      final container = buildContainer(client);

      final result = await container
          .read(signupControllerProvider.notifier)
          .submit(email: 'dup@shop.com', password: 'password123');

      expect(result, isNull);
      expect(container.read(signupControllerProvider).emailError, 'อีเมลนี้มีผู้ใช้งานแล้ว');
    });

    test('422 PASSWORD_TOO_SHORT from the server -> routes to passwordError, not emailError', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(
        statusCode: 422,
        jsonBody: {
          'error': {'code': 'PASSWORD_TOO_SHORT', 'message': 'short'},
        },
      ));
      final client = buildClient(adapter);
      final container = buildContainer(client);

      await container
          .read(signupControllerProvider.notifier)
          .submit(email: 'somchai@shop.com', password: 'password123');

      final state = container.read(signupControllerProvider);
      expect(state.passwordError, isNotNull);
      expect(state.emailError, isNull);
    });

    test('429 -> starts the throttle countdown', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(
        statusCode: 429,
        jsonBody: {
          'error': {'code': 'RATE_LIMITED', 'message': 'slow down'},
        },
        headers: {
          'retry-after': ['20'],
        },
      ));
      final client = buildClient(adapter);
      final container = buildContainer(client);
      final controller = container.read(signupControllerProvider.notifier);

      await controller.submit(email: 'somchai@shop.com', password: 'password123');

      expect(controller.throttle.isActive, isTrue);
      expect(controller.throttle.remainingSeconds, 20);
    });
  });
}
