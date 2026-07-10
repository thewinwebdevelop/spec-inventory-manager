import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/auth/application/change_password_controller.dart';
import 'package:mobile/features/auth/data/auth_repository_impl.dart';
import 'package:mobile/features/auth/data/token_store.dart';

import '../data/fake_dio_adapter.dart';
import '../data/fakes.dart';

Future<AuthRepositoryImpl> buildClient(FakeHttpClientAdapter adapter) async {
  final dio = buildFakeDio(adapter);
  final authApi = AuthApi(dio, standardSerializers);
  final store = TokenStore(secureStorage: FakeSecureStorage());
  store.setAccessToken('access-1');
  await store.setRefreshToken('refresh-1');
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
  container.listen(changePasswordControllerProvider, (_, __) {});
  return container;
}

void main() {
  group('ChangePasswordController (D-023 PASS 2 — application layer)', () {
    test('client-side validation blocks a too-short new password (no network call)', () async {
      final adapter = FakeHttpClientAdapter();
      final client = await buildClient(adapter);
      final container = buildContainer(client);

      final outcome = await container
          .read(changePasswordControllerProvider.notifier)
          .submit(currentPassword: 'oldpass12', newPassword: 'short');

      expect(outcome, ChangePasswordOutcome.failure);
      expect(adapter.capturedRequests, isEmpty);
      expect(
        container.read(changePasswordControllerProvider).newError,
        'รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 8 ตัวอักษร',
      );
    });

    test('success -> outcome success, submitting flips back to false', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {'ok': 'true'}));
      final client = await buildClient(adapter);
      final container = buildContainer(client);

      final outcome = await container
          .read(changePasswordControllerProvider.notifier)
          .submit(currentPassword: 'oldpass12', newPassword: 'newpass123');

      expect(outcome, ChangePasswordOutcome.success);
      expect(container.read(changePasswordControllerProvider).submitting, isFalse);
    });

    test('401 INVALID_CREDENTIALS -> failure outcome, sets currentError, only 1 request (no silent-refresh)',
        () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(
        statusCode: 401,
        jsonBody: {
          'error': {'code': 'INVALID_CREDENTIALS', 'message': 'nope'},
        },
      ));
      final client = await buildClient(adapter);
      final container = buildContainer(client);

      final outcome = await container
          .read(changePasswordControllerProvider.notifier)
          .submit(currentPassword: 'wrongold', newPassword: 'newpass123');

      expect(outcome, ChangePasswordOutcome.failure);
      expect(adapter.capturedRequests, hasLength(1));
      expect(container.read(changePasswordControllerProvider).currentError, 'รหัสผ่านปัจจุบันไม่ถูกต้อง');
    });

    test('429 -> failure outcome, starts the throttle countdown', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(
        statusCode: 429,
        jsonBody: {
          'error': {'code': 'RATE_LIMITED', 'message': 'slow down'},
        },
        headers: {
          'retry-after': ['10'],
        },
      ));
      final client = await buildClient(adapter);
      final container = buildContainer(client);
      final controller = container.read(changePasswordControllerProvider.notifier);

      final outcome = await controller.submit(currentPassword: 'oldpass12', newPassword: 'newpass123');

      expect(outcome, ChangePasswordOutcome.failure);
      expect(controller.throttle.isActive, isTrue);
      expect(controller.throttle.remainingSeconds, 10);
    });

    test('session-expired (dead access + dead refresh) -> sessionExpired outcome, not a generic error', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 401));
      adapter.enqueue(FakeResponse(
        statusCode: 401,
        jsonBody: {
          'error': {'code': 'INVALID_REFRESH', 'message': 'dead'},
        },
      ));
      final client = await buildClient(adapter);
      final container = buildContainer(client);

      final outcome = await container
          .read(changePasswordControllerProvider.notifier)
          .submit(currentPassword: 'oldpass12', newPassword: 'newpass123');

      expect(outcome, ChangePasswordOutcome.sessionExpired);
      expect(container.read(changePasswordControllerProvider).generalError, isNull);
    });
  });
}
