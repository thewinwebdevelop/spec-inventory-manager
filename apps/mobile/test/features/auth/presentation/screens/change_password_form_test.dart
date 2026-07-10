import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/auth/data/auth_repository_impl.dart';
import 'package:mobile/features/auth/presentation/screens/change_password_form.dart';
import 'package:mobile/features/auth/data/token_store.dart';

import '../../data/fake_dio_adapter.dart';
import '../../data/fakes.dart';

Future<AuthRepositoryImpl> buildClient(FakeHttpClientAdapter adapter) async {
  final dio = buildFakeDio(adapter);
  final authApi = AuthApi(dio, standardSerializers);
  final store = TokenStore(secureStorage: FakeSecureStorage());
  store.setAccessToken('access-1');
  // A refresh token must be present so silentRefresh actually issues the
  // /auth/refresh network call the session-expired test queues a response
  // for, rather than short-circuiting immediately.
  await store.setRefreshToken('refresh-1');
  return AuthRepositoryImpl(authApi: authApi, tokenStore: store);
}

/// D-023 PASS 2 — provider-override wiring (see login_screen_test.dart doc).
Widget wrap(AuthRepositoryImpl client, Widget child) {
  return ProviderScope(
    overrides: [authRepositoryProvider.overrideWithValue(client)],
    child: MaterialApp(home: Scaffold(body: child)),
  );
}

Finder submitButtonFinder() => find.widgetWithText(ElevatedButton, 'เปลี่ยนรหัสผ่าน');

void main() {
  testWidgets('success clears both fields and calls onChanged', (tester) async {
    final adapter = FakeHttpClientAdapter();
    adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {'ok': 'true'}));
    final client = await buildClient(adapter);
    var changed = false;

    await tester.pumpWidget(wrap(
      client,
      ChangePasswordForm(
        onChanged: () => changed = true,
        onSessionExpired: () {},
      ),
    ));

    await tester.enterText(find.byType(TextField).first, 'oldpass12');
    await tester.enterText(find.byType(TextField).last, 'newpass123');
    await tester.tap(submitButtonFinder());
    await tester.pumpAndSettle();

    expect(changed, isTrue);
    final current = tester.widget<TextField>(find.byType(TextField).first);
    final next = tester.widget<TextField>(find.byType(TextField).last);
    expect(current.controller!.text, isEmpty);
    expect(next.controller!.text, isEmpty);
  });

  testWidgets('client-side validation blocks a too-short new password', (tester) async {
    final adapter = FakeHttpClientAdapter();
    final client = await buildClient(adapter);

    await tester.pumpWidget(wrap(
      client,
      ChangePasswordForm(onChanged: () {}, onSessionExpired: () {}),
    ));

    await tester.enterText(find.byType(TextField).first, 'oldpass12');
    await tester.enterText(find.byType(TextField).last, 'short');
    await tester.tap(submitButtonFinder());
    await tester.pumpAndSettle();

    expect(find.text('รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 8 ตัวอักษร'), findsOneWidget);
    expect(adapter.capturedRequests, isEmpty);
  });

  testWidgets('401 INVALID_CREDENTIALS shows the invalid-current-password copy — NOT session-expired', (tester) async {
    final adapter = FakeHttpClientAdapter();
    // A wrong currentPassword is a semantic 401 (api-spec §2.7), not an
    // access-token-expiry signal — must surface directly, with no
    // silent-refresh attempt at all (only 1 request expected).
    adapter.enqueue(FakeResponse(
      statusCode: 401,
      jsonBody: {
        'error': {'code': 'INVALID_CREDENTIALS', 'message': 'nope'},
      },
    ));
    final client = await buildClient(adapter);

    await tester.pumpWidget(wrap(
      client,
      ChangePasswordForm(onChanged: () {}, onSessionExpired: () {}),
    ));

    await tester.enterText(find.byType(TextField).first, 'wrongold');
    await tester.enterText(find.byType(TextField).last, 'newpass123');
    await tester.tap(submitButtonFinder());
    await tester.pumpAndSettle();

    expect(adapter.capturedRequests, hasLength(1));

    expect(find.text('รหัสผ่านปัจจุบันไม่ถูกต้อง'), findsOneWidget);
  });

  testWidgets('429 shows the shared ThrottleBanner', (tester) async {
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

    await tester.pumpWidget(wrap(
      client,
      ChangePasswordForm(onChanged: () {}, onSessionExpired: () {}),
    ));

    await tester.enterText(find.byType(TextField).first, 'oldpass12');
    await tester.enterText(find.byType(TextField).last, 'newpass123');
    await tester.tap(submitButtonFinder());
    await tester.pumpAndSettle();

    expect(find.textContaining('เหลือ 10 วินาที'), findsOneWidget);
  });

  testWidgets('session-expired routes through onSessionExpired, not a generic error banner', (tester) async {
    final adapter = FakeHttpClientAdapter();
    // A dead ACCESS token (bare JwtAuthGuard 401, no app-level error code) —
    // distinct from the wrong-currentPassword case covered above, which
    // MUST NOT trigger this path (see the dedicated auth_client_test.dart
    // cases for that distinction).
    adapter.enqueue(FakeResponse(statusCode: 401));
    // The refresh attempt itself then fails (dead refresh token too).
    adapter.enqueue(FakeResponse(
      statusCode: 401,
      jsonBody: {
        'error': {'code': 'INVALID_REFRESH', 'message': 'dead'},
      },
    ));
    final client = await buildClient(adapter);
    var sessionExpired = false;

    await tester.pumpWidget(wrap(
      client,
      ChangePasswordForm(
        onChanged: () {},
        onSessionExpired: () => sessionExpired = true,
      ),
    ));

    await tester.enterText(find.byType(TextField).first, 'oldpass12');
    await tester.enterText(find.byType(TextField).last, 'newpass123');
    await tester.tap(submitButtonFinder());
    await tester.pumpAndSettle();

    expect(sessionExpired, isTrue);
  });
}
