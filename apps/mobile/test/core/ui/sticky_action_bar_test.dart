import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/core/ui/sticky_action_bar.dart';

void main() {
  Widget wrap(Widget child) {
    return MaterialApp(
      theme: buildAppTheme(),
      home: Scaffold(body: Column(children: [Expanded(child: Container()), child])),
    );
  }

  testWidgets('renders a single full-width primary button with the given label', (tester) async {
    await tester.pumpWidget(wrap(StickyActionBar(label: 'บันทึกบทบาท', onPressed: () {})));

    expect(find.text('บันทึกบทบาท'), findsOneWidget);
    expect(find.byType(ElevatedButton), findsOneWidget);

    final buttonSize = tester.getSize(find.byType(ElevatedButton));
    final barSize = tester.getSize(find.byType(StickyActionBar));
    // full-width: button spans (bar width minus the s4 side padding on both edges)
    expect(buttonSize.width, closeTo(barSize.width - AppSpacing.s4 * 2, 0.5));
  });

  testWidgets('tapping the button calls onPressed', (tester) async {
    var tapped = false;
    await tester.pumpWidget(wrap(StickyActionBar(label: 'บันทึก', onPressed: () => tapped = true)));

    await tester.tap(find.text('บันทึก'));
    await tester.pump();

    expect(tapped, isTrue);
  });

  testWidgets('loading disables the button and hides the label', (tester) async {
    await tester.pumpWidget(wrap(StickyActionBar(label: 'บันทึก', onPressed: () {}, loading: true)));

    final button = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
    expect(button.onPressed, isNull);
    expect(find.text('บันทึก'), findsNothing);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('null onPressed disables the button', (tester) async {
    await tester.pumpWidget(wrap(const StickyActionBar(label: 'บันทึก', onPressed: null)));

    final button = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
    expect(button.onPressed, isNull);
  });

  testWidgets('button meets the 44px tap target', (tester) async {
    await tester.pumpWidget(wrap(StickyActionBar(label: 'บันทึก', onPressed: () {})));

    final buttonSize = tester.getSize(find.byType(ElevatedButton));
    expect(buttonSize.height, greaterThanOrEqualTo(AppSizes.tapTargetMin));
  });
}
