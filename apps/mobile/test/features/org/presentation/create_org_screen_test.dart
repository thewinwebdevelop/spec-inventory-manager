// T-002-M3 — S2 on mobile.
//
// The states table of ux-wireframe §3, on screen. There is deliberately no
// skeleton case: this screen fetches nothing on entry, so a loading state
// would be a state it can never be in.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/features/org/application/org_providers.dart';
import 'package:mobile/core/session/session_controller.dart';
import 'package:mobile/features/org/domain/entities/org_entities.dart';
import 'package:mobile/features/org/presentation/screens/create_org_screen.dart';

import '../harness.dart';
import '../org_fakes.dart';

void main() {
  testWidgets('data — one field, a helper, and what will happen', (tester) async {
    await pumpScreen(
      tester,
      const CreateOrgScreen(),
      overrides: [orgDirectoryProvider.overrideWithValue(FakeOrgDirectory())],
    );

    expect(find.text('ชื่อร้าน'), findsOneWidget);
    expect(find.text('ตั้งชื่อที่คุณเรียกร้านตัวเอง เปลี่ยนทีหลังได้'), findsOneWidget);
    // ux is explicit that timezone/currency/plan are NOT asked — they are
    // stated instead.
    expect(find.textContaining('ใช้สกุลเงินบาท'), findsOneWidget);
    expect(find.text('สร้างร้าน'), findsOneWidget);
  });

  testWidgets('★ submitting disables the button — there is no Idempotency-Key', (tester) async {
    final directory = FakeOrgDirectory(delay: const Duration(milliseconds: 50));
    await pumpScreen(
      tester,
      const CreateOrgScreen(),
      overrides: [orgDirectoryProvider.overrideWithValue(directory)],
    );

    await tester.enterText(find.byType(TextField), 'ร้านหนึ่ง');
    await tester.tap(find.text('สร้างร้าน'));
    await tester.pump();

    expect(find.text('กำลังสร้างร้าน...'), findsOneWidget);
    final button = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
    expect(button.onPressed, isNull, reason: 'a second tap would be a second shop');

    await tester.pumpAndSettle();
    expect(directory.createCalls, 1);
  });

  testWidgets('empty name — inline under the field, and nothing is sent', (tester) async {
    final directory = FakeOrgDirectory();
    await pumpScreen(
      tester,
      const CreateOrgScreen(),
      overrides: [orgDirectoryProvider.overrideWithValue(directory)],
    );

    await tester.tap(find.text('สร้างร้าน'));
    await tester.pumpAndSettle();

    expect(find.text('กรอกชื่อร้าน (ไม่เกิน 120 ตัวอักษร)'), findsOneWidget);
    expect(directory.createCalls, 0);
  });

  testWidgets('★ the cap shows the SERVER\'s number, not one written into the app',
      (tester) async {
    // api-spec §3.1 sends `details.limit` precisely so no build hard-codes a
    // per-plan number.
    await pumpScreen(
      tester,
      const CreateOrgScreen(),
      overrides: [
        orgDirectoryProvider.overrideWithValue(FakeOrgDirectory(
          createFailure: const ConflictFailure(
            code: 'ORG_LIMIT_REACHED',
            details: {'limit': 7},
          ),
        )),
      ],
    );

    await tester.enterText(find.byType(TextField), 'ร้านหนึ่ง');
    await tester.tap(find.text('สร้างร้าน'));
    await tester.pumpAndSettle();

    expect(find.textContaining('ครบ 7 ร้านแล้ว'), findsOneWidget);
    // Retrying cannot create a shop the plan does not allow.
    expect(find.text('ลองใหม่'), findsNothing);
  });

  testWidgets('503 provisioning — "not your fault", and a retry', (tester) async {
    await pumpScreen(
      tester,
      const CreateOrgScreen(),
      overrides: [
        orgDirectoryProvider.overrideWithValue(FakeOrgDirectory(
          createFailure: const ServerFailure(code: 'ORG_PROVISIONING_UNAVAILABLE'),
        )),
      ],
    );

    await tester.enterText(find.byType(TextField), 'ร้านหนึ่ง');
    await tester.tap(find.text('สร้างร้าน'));
    await tester.pumpAndSettle();

    expect(find.textContaining('ไม่ใช่ความผิดของคุณ'), findsOneWidget);
    expect(find.text('ลองใหม่'), findsOneWidget);
  });

  testWidgets('★ success enters the new shop and tells the caller', (tester) async {
    CreatedOrganization? handedBack;
    final container = await pumpScreen(
      tester,
      CreateOrgScreen(onCreated: (org) => handedBack = org),
      overrides: [orgDirectoryProvider.overrideWithValue(FakeOrgDirectory())],
    );

    await tester.enterText(find.byType(TextField), 'ร้านใหม่');
    await tester.tap(find.text('สร้างร้าน'));
    await tester.pumpAndSettle();

    // The shop is ACTIVE before the caller is told — navigating first would
    // build the next screen with no shop, and `orgDioProvider` throws on that.
    expect(container.read(activeOrgIdProvider), 'org_new');
    expect(handedBack?.name, 'ร้านใหม่');
    expect(find.textContaining('เรียบร้อย'), findsOneWidget);
  });
}
