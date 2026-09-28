import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/core/ui/disclosure.dart';

void main() {
  Widget wrap(Widget child, {bool disableAnimations = false}) {
    return MaterialApp(
      theme: buildAppTheme(),
      home: MediaQuery(
        data: MediaQueryData(disableAnimations: disableAnimations),
        child: Scaffold(body: child),
      ),
    );
  }

  testWidgets('starts expanded by default and shows the child', (tester) async {
    await tester.pumpWidget(wrap(const Disclosure(
      title: 'ทีมงาน',
      child: Text('เนื้อหาที่พับได้'),
    )));

    expect(find.text('เนื้อหาที่พับได้'), findsOneWidget);
  });

  testWidgets('tapping the header collapses and hides the child', (tester) async {
    await tester.pumpWidget(wrap(const Disclosure(
      title: 'ทีมงาน',
      child: Text('เนื้อหาที่พับได้'),
    )));

    await tester.tap(find.text('ทีมงาน'));
    await tester.pumpAndSettle();

    expect(find.text('เนื้อหาที่พับได้'), findsNothing);
  });

  testWidgets('tapping again re-expands', (tester) async {
    await tester.pumpWidget(wrap(const Disclosure(
      title: 'ทีมงาน',
      child: Text('เนื้อหาที่พับได้'),
    )));

    await tester.tap(find.text('ทีมงาน'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('ทีมงาน'));
    await tester.pumpAndSettle();

    expect(find.text('เนื้อหาที่พับได้'), findsOneWidget);
  });

  testWidgets('respects initiallyExpanded: false', (tester) async {
    await tester.pumpWidget(wrap(const Disclosure(
      title: 'ทีมงาน',
      initiallyExpanded: false,
      child: Text('เนื้อหาที่พับได้'),
    )));

    expect(find.text('เนื้อหาที่พับได้'), findsNothing);
  });

  testWidgets('semantics label combines title + count, and toggles expanded flag', (tester) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(wrap(const Disclosure(
      title: 'ทีมงาน',
      countLabel: 'เลือก 0 จาก 2',
      child: Text('เนื้อหาที่พับได้'),
    )));

    final openNode = tester.getSemantics(find.text('ทีมงาน'));
    expect(openNode.label, contains('ทีมงาน, เลือก 0 จาก 2'));
    expect(openNode.getSemanticsData().flagsCollection.isExpanded.toBoolOrNull(), isTrue);

    await tester.tap(find.text('ทีมงาน'));
    await tester.pumpAndSettle();

    final closedNode = tester.getSemantics(find.text('ทีมงาน'));
    expect(closedNode.getSemanticsData().flagsCollection.isExpanded.toBoolOrNull(), isFalse);
    handle.dispose();
  });

  testWidgets('header row meets the 56px list-row tap target', (tester) async {
    await tester.pumpWidget(wrap(const Disclosure(
      title: 'ทีมงาน',
      child: Text('เนื้อหาที่พับได้'),
    )));

    final size = tester.getSize(find.byType(InkWell));
    expect(size.height, greaterThanOrEqualTo(AppSizes.listRowMinH));
  });

  testWidgets('chevron does not rotate over time when disableAnimations is set (reduced motion)',
      (tester) async {
    await tester.pumpWidget(wrap(
      const Disclosure(title: 'ทีมงาน', child: Text('เนื้อหาที่พับได้')),
      disableAnimations: true,
    ));

    await tester.tap(find.text('ทีมงาน'));
    // A single pump (no pumpAndSettle) is enough: with duration = Duration.zero
    // the rotation is already at its final value, proving no animated tween is
    // mid-flight (ui.md §2.2: reduced motion = ไม่หมุนแบบ animate).
    await tester.pump();

    final rotation = tester.widget<AnimatedRotation>(find.byType(AnimatedRotation));
    expect(rotation.duration, Duration.zero);
    expect(rotation.turns, -0.25);
  });
}
