// Smoke test for the app root (F-000 T-000-09 placeholder shell, superseded
// by T-001-17's real F-001 auth screens). Confirms the app boots and renders
// the login screen by default (after the cold-start bootstrap restore finds
// no session, T-001-17 M-2) — proves the generated Dart client
// (package:omnistock_api_client) is a real, wired, compile-time dependency
// exercised through lib/auth/** (AuthApi/LoginRequest/TokenResponse/...),
// not just a single unused enum reference as in the original F-000 stub.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

import 'package:mobile/auth/auth_client.dart';
import 'package:mobile/auth/token_store.dart';
import 'package:mobile/main.dart';

import 'auth/fake_dio_adapter.dart';
import 'auth/fakes.dart';

void main() {
  testWidgets('OmniStock boots through the bootstrap gate to the login screen (no keychain session)', (
    WidgetTester tester,
  ) async {
    // A fake TokenStore/SecureStorage — no refresh token ever written, and no
    // real FlutterSecureStorage platform channel touched (that channel has
    // no test-time implementation and would hang `pumpAndSettle`).
    final authClient = AuthClient(
      authApi: AuthApi(buildFakeDio(FakeHttpClientAdapter()), standardSerializers),
      tokenStore: TokenStore(secureStorage: FakeSecureStorage()),
    );

    await tester.pumpWidget(OmniStockApp(authClient: authClient));

    // T-001-17 M-2 — cold-start restore gate shown first, before the very
    // first frame settles (runAuthBootstrap's TokenStore read is async).
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    // No refresh token in the (fake, empty) keychain -> settles straight to
    // login, never calling the network.
    await tester.pumpAndSettle();

    // ux-wireframe §3 — "เข้าสู่ระบบ" is the default landing screen once
    // there's nothing to restore.
    expect(find.text('เข้าสู่ระบบ'), findsWidgets);
  });
}
