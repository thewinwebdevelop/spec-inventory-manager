// Smoke test for the app root (F-000 T-000-09 placeholder shell, superseded
// by T-001-17's real F-001 auth screens). Confirms the app boots and renders
// the login screen by default — proves the generated Dart client
// (package:omnistock_api_client) is a real, wired, compile-time dependency
// exercised through lib/auth/** (AuthApi/LoginRequest/TokenResponse/...),
// not just a single unused enum reference as in the original F-000 stub.

import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/main.dart';

void main() {
  testWidgets('OmniStock boots to the login screen (pre-auth default)', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const OmniStockApp());
    await tester.pump();

    // ux-wireframe §3 — "เข้าสู่ระบบ" is the default landing screen.
    expect(find.text('เข้าสู่ระบบ'), findsWidgets);
  });
}
