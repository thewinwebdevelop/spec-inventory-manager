import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/auth/data/auth_repository_impl.dart';
import 'package:mobile/features/auth/presentation/screens/login_screen.dart';
import 'package:mobile/features/auth/data/token_store.dart';

import '../../data/fake_dio_adapter.dart';
import '../../data/fakes.dart';

AuthRepositoryImpl buildClient(FakeHttpClientAdapter adapter) {
  final dio = buildFakeDio(adapter);
  final authApi = AuthApi(dio, standardSerializers);
  return AuthRepositoryImpl(authApi: authApi, tokenStore: TokenStore(secureStorage: FakeSecureStorage()));
}

/// D-023 PASS 2 — every test provides its fake-wired [AuthRepositoryImpl] via
/// a `ProviderScope` override of [authRepositoryProvider] instead of a
/// constructor argument on [LoginScreen] (which no longer takes one — the
/// screen now reads the repository through `application/login_controller.dart`'s
/// Riverpod provider graph).
Widget wrap(AuthRepositoryImpl client, Widget child) {
  return ProviderScope(
    overrides: [authRepositoryProvider.overrideWithValue(client)],
    child: MaterialApp(home: child),
  );
}

Finder submitButtonFinder() => find.widgetWithText(ElevatedButton, 'เข้าสู่ระบบ');

void main() {
  testWidgets('prefills the email field from prefillEmail (post-signup redirect)', (tester) async {
    final client = buildClient(FakeHttpClientAdapter());
    await tester.pumpWidget(wrap(
      client,
      LoginScreen(
        prefillEmail: 'somchai@shop.com',
        onLoginSuccess: () {},
        onNavigateToSignup: () {},
        onNavigateToHelp: () {},
      ),
    ));

    expect(find.text('somchai@shop.com'), findsOneWidget);
  });

  testWidgets('shows loading state on the submit button while the request is in flight', (tester) async {
    final adapter = FakeHttpClientAdapter();
    adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {
      'accessToken': 'a',
      'refreshToken': 'r',
      'expiresIn': 900,
      'tokenType': 'Bearer',
    }));
    final client = buildClient(adapter);
    var success = false;

    await tester.pumpWidget(wrap(
      client,
      LoginScreen(
        onLoginSuccess: () => success = true,
        onNavigateToSignup: () {},
        onNavigateToHelp: () {},
      ),
    ));

    await tester.enterText(find.byType(TextField).first, 'a@b.com');
    await tester.tap(submitButtonFinder());
    await tester.pump(); // start the async submit

    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    await tester.pumpAndSettle();
    expect(success, isTrue);
  });

  testWidgets('401 shows the enumeration-safe generic error and clears the password field', (tester) async {
    final adapter = FakeHttpClientAdapter();
    adapter.enqueue(FakeResponse(
      statusCode: 401,
      jsonBody: {
        'error': {'code': 'INVALID_CREDENTIALS', 'message': 'nope'},
      },
    ));
    final client = buildClient(adapter);

    await tester.pumpWidget(wrap(
      client,
      LoginScreen(
        onLoginSuccess: () {},
        onNavigateToSignup: () {},
        onNavigateToHelp: () {},
      ),
    ));

    await tester.enterText(find.byType(TextField).last, 'wrongpass');
    await tester.tap(submitButtonFinder());
    await tester.pumpAndSettle();

    expect(find.text('อีเมลหรือรหัสผ่านไม่ถูกต้อง'), findsOneWidget);
    // Password field cleared after a failed attempt.
    final field = tester.widget<TextField>(find.byType(TextField).last);
    expect(field.controller!.text, isEmpty);
  });

  testWidgets('429 shows the ThrottleBanner and disables the form', (tester) async {
    final adapter = FakeHttpClientAdapter();
    adapter.enqueue(FakeResponse(
      statusCode: 429,
      jsonBody: {
        'error': {'code': 'RATE_LIMITED', 'message': 'slow down'},
      },
      headers: {
        'retry-after': ['45'],
      },
    ));
    final client = buildClient(adapter);

    await tester.pumpWidget(wrap(
      client,
      LoginScreen(
        onLoginSuccess: () {},
        onNavigateToSignup: () {},
        onNavigateToHelp: () {},
      ),
    ));

    await tester.tap(submitButtonFinder());
    await tester.pumpAndSettle();

    expect(find.textContaining('เหลือ 45 วินาที'), findsOneWidget);

    final submitButton = tester.widget<ElevatedButton>(submitButtonFinder());
    expect(submitButton.onPressed, isNull);
  });
}
