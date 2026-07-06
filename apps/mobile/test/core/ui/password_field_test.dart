import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/ui/password_field.dart';

void main() {
  Widget wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

  testWidgets('starts obscured (password hidden) and toggles on eye tap', (tester) async {
    final controller = TextEditingController(text: 'secret123');
    await tester.pumpWidget(wrap(PasswordField(label: 'รหัสผ่าน', controller: controller)));

    TextField field() => tester.widget<TextField>(find.byType(TextField));
    expect(field().obscureText, isTrue);

    await tester.tap(find.byIcon(Icons.visibility_outlined));
    await tester.pump();

    expect(field().obscureText, isFalse);
    expect(find.byIcon(Icons.visibility_off_outlined), findsOneWidget);
  });

  testWidgets('eye toggle carries the Thai a11y label for both states', (tester) async {
    final controller = TextEditingController();
    await tester.pumpWidget(wrap(PasswordField(label: 'รหัสผ่าน', controller: controller)));

    expect(find.bySemanticsLabel('แสดงรหัสผ่าน'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.visibility_outlined));
    await tester.pump();

    expect(find.bySemanticsLabel('ซ่อนรหัสผ่าน'), findsOneWidget);
  });

  testWidgets('shows helper text only when there is no error', (tester) async {
    final controller = TextEditingController();
    await tester.pumpWidget(wrap(PasswordField(
      label: 'รหัสผ่าน',
      controller: controller,
      helperText: 'อย่างน้อย 8 ตัวอักษร',
    )));
    expect(find.text('อย่างน้อย 8 ตัวอักษร'), findsOneWidget);

    await tester.pumpWidget(wrap(PasswordField(
      label: 'รหัสผ่าน',
      controller: controller,
      helperText: 'อย่างน้อย 8 ตัวอักษร',
      errorText: 'รหัสผ่านสั้นเกินไป',
    )));
    expect(find.text('อย่างน้อย 8 ตัวอักษร'), findsNothing);
    expect(find.text('รหัสผ่านสั้นเกินไป'), findsOneWidget);
  });

  testWidgets('disabling the field also disables the eye toggle', (tester) async {
    final controller = TextEditingController();
    await tester.pumpWidget(wrap(PasswordField(
      label: 'รหัสผ่าน',
      controller: controller,
      enabled: false,
    )));
    final button = tester.widget<IconButton>(find.byType(IconButton));
    expect(button.onPressed, isNull);
  });
}
