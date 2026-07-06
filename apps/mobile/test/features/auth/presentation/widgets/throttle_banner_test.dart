import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/auth/application/throttle_countdown_controller.dart';
import 'package:mobile/features/auth/presentation/widgets/throttle_banner.dart';

void main() {
  Widget wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

  testWidgets('renders nothing when the controller is inactive', (tester) async {
    final controller = ThrottleCountdownController();
    await tester.pumpWidget(wrap(ThrottleBanner(controller: controller)));
    expect(find.byType(ThrottleBanner), findsOneWidget);
    expect(find.textContaining('เหลือ'), findsNothing);
    controller.dispose();
  });

  testWidgets('shows the short-form copy + helper text once active, never says ล็อก/ระงับ', (tester) async {
    final controller = ThrottleCountdownController();
    await tester.pumpWidget(wrap(ThrottleBanner(controller: controller)));

    controller.start(30);
    await tester.pump();

    expect(find.textContaining('เหลือ 30 วินาที'), findsOneWidget);
    expect(find.textContaining('เพื่อความปลอดภัยของบัญชีคุณ'), findsOneWidget);
    expect(find.textContaining('ล็อก'), findsNothing);
    expect(find.textContaining('ระงับ'), findsNothing);

    controller.dispose();
  });

  testWidgets('ticks down as the controller advances', (tester) async {
    final controller = ThrottleCountdownController();
    await tester.pumpWidget(wrap(ThrottleBanner(controller: controller)));

    controller.start(65);
    await tester.pump();
    expect(find.textContaining('01:05'), findsOneWidget);

    controller.dispose();
  });
}
