import 'dart:ui' show CheckedState;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/core/ui/checkbox_row.dart';

void main() {
  Widget wrap(Widget child) {
    return MaterialApp(
      theme: buildAppTheme(),
      home: Scaffold(body: child),
    );
  }

  testWidgets('tapping an unchecked, enabled row calls onChanged(true)', (tester) async {
    bool? result;
    await tester.pumpWidget(wrap(CheckboxRow(
      label: 'ดูสินค้า',
      value: false,
      onChanged: (v) => result = v,
    )));

    await tester.tap(find.text('ดูสินค้า'));
    await tester.pump();

    expect(result, isTrue);
  });

  testWidgets('tapping a checked, enabled row calls onChanged(false)', (tester) async {
    bool? result;
    await tester.pumpWidget(wrap(CheckboxRow(
      label: 'ดูสินค้า',
      value: true,
      onChanged: (v) => result = v,
    )));

    await tester.tap(find.text('ดูสินค้า'));
    await tester.pump();

    expect(result, isFalse);
  });

  testWidgets('tapping a disabled row never calls onChanged', (tester) async {
    var called = false;
    await tester.pumpWidget(wrap(CheckboxRow(
      label: 'แก้ไขสินค้า',
      value: false,
      disabled: true,
      reason: 'ต้องมีสิทธิ์ดูสินค้าก่อน',
      onChanged: (_) => called = true,
    )));

    await tester.tap(find.text('แก้ไขสินค้า'));
    await tester.pump();

    expect(called, isFalse);
  });

  testWidgets('disabled row still renders the reason line (readable, not hidden)', (tester) async {
    await tester.pumpWidget(wrap(CheckboxRow(
      label: 'แก้ไขสินค้า',
      value: false,
      disabled: true,
      reason: 'ต้องมีสิทธิ์ดูสินค้าก่อน',
      onChanged: null,
    )));

    expect(find.text('ต้องมีสิทธิ์ดูสินค้าก่อน'), findsOneWidget);
  });

  testWidgets('disabled row keeps the semantics node enabled:false, not excluded', (tester) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(wrap(CheckboxRow(
      label: 'แก้ไขสินค้า',
      value: true,
      disabled: true,
      reason: 'ล็อกตามบทบาท',
      onChanged: null,
    )));

    final flags = tester.getSemantics(find.text('แก้ไขสินค้า').first).getSemanticsData().flagsCollection;
    expect(flags.isEnabled.toBoolOrNull(), isFalse);
    expect(flags.isChecked, CheckedState.isTrue);
    handle.dispose();
  });

  testWidgets('disabled row label keeps full-strength text colour (no dimming)', (tester) async {
    await tester.pumpWidget(wrap(CheckboxRow(
      label: 'แก้ไขสินค้า',
      value: false,
      disabled: true,
      reason: 'ล็อกตามบทบาท',
      onChanged: null,
    )));

    final text = tester.widget<Text>(find.text('แก้ไขสินค้า'));
    expect(text.style?.color, AppColors.text);
  });

  testWidgets('row is at least the 56px list-row tap target', (tester) async {
    await tester.pumpWidget(wrap(CheckboxRow(
      label: 'ดูสินค้า',
      value: false,
      onChanged: (_) {},
    )));

    final size = tester.getSize(find.byType(CheckboxRow));
    expect(size.height, greaterThanOrEqualTo(AppSizes.listRowMinH));
  });

  testWidgets('badge label renders as plain text next to the row label', (tester) async {
    await tester.pumpWidget(wrap(CheckboxRow(
      label: 'ซิงก์อัตโนมัติ',
      value: false,
      badgeLabel: 'เร็ว ๆ นี้',
      onChanged: (_) {},
    )));

    expect(find.text('เร็ว ๆ นี้'), findsOneWidget);
  });
}
