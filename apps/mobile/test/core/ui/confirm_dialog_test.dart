import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/ui/confirm_dialog.dart';

void main() {
  Widget wrap(Widget Function(BuildContext) builder) {
    return MaterialApp(
      home: Scaffold(body: Builder(builder: builder)),
    );
  }

  testWidgets('returns true when confirm is tapped', (tester) async {
    late Future<bool> resultFuture;
    await tester.pumpWidget(wrap((context) {
      return ElevatedButton(
        onPressed: () {
          resultFuture = showConfirmDialog(
            context,
            title: 'ออกจากอุปกรณ์นี้?',
            body: 'อุปกรณ์นี้จะต้องเข้าสู่ระบบใหม่อีกครั้ง',
            cancelLabel: 'ยกเลิก',
            confirmLabel: 'ออกจากอุปกรณ์นี้',
            destructive: true,
          );
        },
        child: const Text('open'),
      );
    }));

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    expect(find.text('ออกจากอุปกรณ์นี้?'), findsOneWidget);
    await tester.tap(find.text('ออกจากอุปกรณ์นี้'));
    await tester.pumpAndSettle();

    expect(await resultFuture, isTrue);
  });

  testWidgets('returns false when cancel is tapped', (tester) async {
    late Future<bool> resultFuture;
    await tester.pumpWidget(wrap((context) {
      return ElevatedButton(
        onPressed: () {
          resultFuture = showConfirmDialog(
            context,
            title: 'ออกจากระบบทุกอุปกรณ์?',
            body: 'ทุกอุปกรณ์ที่เข้าสู่ระบบอยู่ (รวมเครื่องนี้) จะถูกออกจากระบบทันที',
            cancelLabel: 'ยกเลิก',
            confirmLabel: 'ออกจากระบบทุกอุปกรณ์',
            destructive: true,
          );
        },
        child: const Text('open'),
      );
    }));

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('ยกเลิก'));
    await tester.pumpAndSettle();

    expect(await resultFuture, isFalse);
  });

  testWidgets('destructive variant defaults focus to Cancel, never the destructive button', (tester) async {
    await tester.pumpWidget(wrap((context) {
      return ElevatedButton(
        onPressed: () {
          showConfirmDialog(
            context,
            title: 'ออกจากระบบทุกอุปกรณ์?',
            body: 'body',
            cancelLabel: 'ยกเลิก',
            confirmLabel: 'ออกจากระบบทุกอุปกรณ์',
            destructive: true,
          );
        },
        child: const Text('open'),
      );
    }));

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    final cancelButton = tester.widget<OutlinedButton>(find.widgetWithText(OutlinedButton, 'ยกเลิก'));
    expect(cancelButton.focusNode?.hasFocus, isTrue);
  });

  testWidgets('stacked: full-width buttons, the action ABOVE cancel, focus still on cancel',
      (tester) async {
    // ux R10a (mobile): "ปุ่มเรียงแนวตั้งเต็มกว้าง" — long Thai labels.
    late Future<bool> resultFuture;
    await tester.pumpWidget(wrap((context) {
      return ElevatedButton(
        onPressed: () {
          resultFuture = showConfirmDialog(
            context,
            title: 'เปลี่ยนบทบาทของตัวเอง?',
            body: 'body',
            cancelLabel: 'ไม่เปลี่ยน',
            confirmLabel: 'เปลี่ยนบทบาทของฉัน',
            destructive: true,
            stacked: true,
          );
        },
        child: const Text('open'),
      );
    }));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    final confirm = tester.getRect(find.widgetWithText(ElevatedButton, 'เปลี่ยนบทบาทของฉัน'));
    final cancel = tester.getRect(find.widgetWithText(OutlinedButton, 'ไม่เปลี่ยน'));
    expect(confirm.bottom, lessThanOrEqualTo(cancel.top));
    expect(confirm.width, cancel.width);
    final cancelButton = tester.widget<OutlinedButton>(find.widgetWithText(OutlinedButton, 'ไม่เปลี่ยน'));
    expect(cancelButton.focusNode!.hasFocus, isTrue);

    await tester.tap(find.text('ไม่เปลี่ยน'));
    await tester.pumpAndSettle();
    expect(await resultFuture, isFalse);
  });
}
