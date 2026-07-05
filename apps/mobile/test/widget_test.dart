// Smoke test for the T-000-09 placeholder shell. Confirms the app boots and
// renders the wired-client proof text (generated Dart client import compiles
// and is reachable at runtime) — not a real feature test.

import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/main.dart';

void main() {
  testWidgets('OmniStock placeholder shell renders and shows wired client status', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const OmniStockApp());

    expect(find.text('OmniStock'), findsOneWidget);
    expect(find.textContaining('generated client wired'), findsOneWidget);
    expect(find.textContaining('HealthResponseStatusEnum'), findsOneWidget);
  });
}
