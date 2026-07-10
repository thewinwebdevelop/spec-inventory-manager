import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/auth/data/auth_repository_impl.dart';
import 'package:mobile/features/auth/presentation/screens/signup_screen.dart';
import 'package:mobile/features/auth/data/token_store.dart';

import '../../data/fake_dio_adapter.dart';
import '../../data/fakes.dart';

AuthRepositoryImpl buildClient(FakeHttpClientAdapter adapter) {
  final dio = buildFakeDio(adapter);
  final authApi = AuthApi(dio, standardSerializers);
  return AuthRepositoryImpl(authApi: authApi, tokenStore: TokenStore(secureStorage: FakeSecureStorage()));
}

/// D-023 PASS 2 — provider-override wiring (see login_screen_test.dart doc).
Widget wrap(AuthRepositoryImpl client, Widget child) {
  return ProviderScope(
    overrides: [authRepositoryProvider.overrideWithValue(client)],
    child: MaterialApp(home: child),
  );
}

Finder submitButtonFinder() => find.widgetWithText(ElevatedButton, 'สมัครใช้งาน');

void main() {
  testWidgets('client-side validation blocks submit on an obviously malformed email (no network call)', (tester) async {
    final adapter = FakeHttpClientAdapter();
    final client = buildClient(adapter);

    await tester.pumpWidget(wrap(
      client,
      SignupScreen(
        onSignupSuccess: (_) {},
        onNavigateToLogin: () {},
      ),
    ));

    await tester.enterText(find.byType(TextField).first, 'not-an-email');
    await tester.enterText(find.byType(TextField).last, 'password123');
    await tester.tap(submitButtonFinder());
    await tester.pumpAndSettle();

    expect(find.text('รูปแบบอีเมลไม่ถูกต้อง'), findsOneWidget);
    expect(adapter.capturedRequests, isEmpty);
  });

  testWidgets('client-side validation blocks submit on a too-short password', (tester) async {
    final adapter = FakeHttpClientAdapter();
    final client = buildClient(adapter);

    await tester.pumpWidget(wrap(
      client,
      SignupScreen(
        onSignupSuccess: (_) {},
        onNavigateToLogin: () {},
      ),
    ));

    await tester.enterText(find.byType(TextField).first, 'somchai@shop.com');
    await tester.enterText(find.byType(TextField).last, 'short');
    await tester.tap(submitButtonFinder());
    await tester.pumpAndSettle();

    expect(find.text('รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 8 ตัวอักษร'), findsOneWidget);
    expect(adapter.capturedRequests, isEmpty);
  });

  testWidgets('successful signup calls onSignupSuccess with the submitted email (no auto-login)', (tester) async {
    final adapter = FakeHttpClientAdapter();
    adapter.enqueue(FakeResponse(statusCode: 201, jsonBody: {
      'userId': 'u1',
      'email': 'somchai@shop.com',
      'verified': 'false',
    }));
    final client = buildClient(adapter);
    String? signedUpEmail;

    await tester.pumpWidget(wrap(
      client,
      SignupScreen(
        onSignupSuccess: (email) => signedUpEmail = email,
        onNavigateToLogin: () {},
      ),
    ));

    await tester.enterText(find.byType(TextField).first, 'somchai@shop.com');
    await tester.enterText(find.byType(TextField).last, 'password123');
    await tester.tap(submitButtonFinder());
    await tester.pumpAndSettle();

    expect(signedUpEmail, 'somchai@shop.com');
  });

  testWidgets('409 EMAIL_TAKEN shows the Thai copy on the email field', (tester) async {
    final adapter = FakeHttpClientAdapter();
    adapter.enqueue(FakeResponse(
      statusCode: 409,
      jsonBody: {
        'error': {'code': 'EMAIL_TAKEN', 'message': 'taken'},
      },
    ));
    final client = buildClient(adapter);

    await tester.pumpWidget(wrap(
      client,
      SignupScreen(
        onSignupSuccess: (_) {},
        onNavigateToLogin: () {},
      ),
    ));

    await tester.enterText(find.byType(TextField).first, 'dup@shop.com');
    await tester.enterText(find.byType(TextField).last, 'password123');
    await tester.tap(submitButtonFinder());
    await tester.pumpAndSettle();

    expect(find.text('อีเมลนี้มีผู้ใช้งานแล้ว'), findsOneWidget);
  });

  testWidgets('429 shows the ThrottleBanner', (tester) async {
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

    await tester.pumpWidget(wrap(
      client,
      SignupScreen(
        onSignupSuccess: (_) {},
        onNavigateToLogin: () {},
      ),
    ));

    await tester.enterText(find.byType(TextField).first, 'somchai@shop.com');
    await tester.enterText(find.byType(TextField).last, 'password123');
    await tester.tap(submitButtonFinder());
    await tester.pumpAndSettle();

    expect(find.textContaining('เหลือ 20 วินาที'), findsOneWidget);
  });
}
