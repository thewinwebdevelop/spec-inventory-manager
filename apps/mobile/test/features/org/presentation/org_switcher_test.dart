// T-002-M3 — the AppBar switcher (ux-wireframe §4 + §13: bottom sheet).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/core/session/session_controller.dart';
import 'package:mobile/features/org/application/org_providers.dart';
import 'package:mobile/features/org/domain/entities/org_entities.dart';
import 'package:mobile/features/org/presentation/widgets/org_switcher.dart';

import '../harness.dart';
import '../org_fakes.dart';

const _shops = [
  MyOrganization(id: 'org_1', name: 'ร้านหอมกรุ่นเบเกอรี่', roleName: 'Owner', roleKey: 'owner'),
  MyOrganization(id: 'org_2', name: 'คลังของฝากเชียงใหม่', roleName: 'Staff', roleKey: 'staff'),
];

Widget _host({VoidCallback? onCreate}) => Scaffold(
      appBar: AppBar(title: OrgSwitcherTitle(onCreateOrganization: onCreate)),
      body: const SizedBox.shrink(),
    );

void main() {
  testWidgets('the shop name is on the AppBar — org context is always visible', (tester) async {
    await pumpScreen(
      tester,
      _host(),
      overrides: [orgDirectoryProvider.overrideWithValue(FakeOrgDirectory(orgs: _shops))],
      activeOrg: ownerOrg,
    );

    expect(find.text('ร้านหอมกรุ่นเบเกอรี่'), findsOneWidget);
  });

  testWidgets('★ no active shop, no switcher — a routing bug is not a UI state',
      (tester) async {
    await pumpScreen(
      tester,
      _host(),
      overrides: [orgDirectoryProvider.overrideWithValue(FakeOrgDirectory(orgs: _shops))],
    );

    expect(find.byType(InkWell), findsNothing);
  });

  testWidgets('★ tapping the name opens a BOTTOM SHEET, not a dropdown', (tester) async {
    await pumpScreen(
      tester,
      _host(),
      overrides: [orgDirectoryProvider.overrideWithValue(FakeOrgDirectory(orgs: _shops))],
      activeOrg: ownerOrg,
    );

    await tester.tap(find.text('ร้านหอมกรุ่นเบเกอรี่'));
    await tester.pumpAndSettle();

    expect(find.byType(BottomSheet), findsOneWidget);
    expect(find.text('สลับร้าน'), findsOneWidget);
    expect(find.text('คลังของฝากเชียงใหม่'), findsOneWidget);
  });

  testWidgets('★ the current shop is marked in WORDS, not only with a tick', (tester) async {
    // §14: status is never conveyed by an icon or colour alone.
    await pumpScreen(
      tester,
      _host(),
      overrides: [orgDirectoryProvider.overrideWithValue(FakeOrgDirectory(orgs: _shops))],
      activeOrg: ownerOrg,
    );

    await tester.tap(find.text('ร้านหอมกรุ่นเบเกอรี่').first);
    await tester.pumpAndSettle();

    expect(find.textContaining('ร้านที่ใช้อยู่'), findsOneWidget);
    expect(find.byIcon(Icons.check), findsOneWidget);
  });

  testWidgets('★ switching is ONE session write, then the sheet closes', (tester) async {
    final container = await pumpScreen(
      tester,
      _host(),
      overrides: [orgDirectoryProvider.overrideWithValue(FakeOrgDirectory(orgs: _shops))],
      activeOrg: ownerOrg,
    );

    await tester.tap(find.text('ร้านหอมกรุ่นเบเกอรี่').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('คลังของฝากเชียงใหม่'));
    await tester.pumpAndSettle();

    expect(container.read(activeOrgIdProvider), 'org_2');
    expect(find.byType(BottomSheet), findsNothing);
    // Everything downstream of `activeOrgIdProvider` rebuilds off that single
    // write — including the AppBar title.
    expect(find.text('คลังของฝากเชียงใหม่'), findsOneWidget);
  });

  testWidgets('★ a failed shop list breaks the SHEET, not the screen', (tester) async {
    // ux-wireframe §4: the person is still inside a working shop; only the
    // list of the others is broken.
    await pumpScreen(
      tester,
      _host(),
      overrides: [
        orgDirectoryProvider
            .overrideWithValue(FakeOrgDirectory(listFailure: const NetworkFailure())),
      ],
      activeOrg: ownerOrg,
    );

    await tester.tap(find.text('ร้านหอมกรุ่นเบเกอรี่'));
    await tester.pumpAndSettle();

    expect(find.text('โหลดรายการร้านไม่สำเร็จ'), findsOneWidget);
    expect(find.text('ลองใหม่'), findsOneWidget);
    // The shop name is still on the AppBar behind the sheet.
    expect(find.text('ร้านหอมกรุ่นเบเกอรี่'), findsOneWidget);
  });

  testWidgets('the sheet offers a way to create another shop', (tester) async {
    var created = false;
    await pumpScreen(
      tester,
      _host(onCreate: () => created = true),
      overrides: [orgDirectoryProvider.overrideWithValue(FakeOrgDirectory(orgs: _shops))],
      activeOrg: ownerOrg,
    );

    await tester.tap(find.text('ร้านหอมกรุ่นเบเกอรี่').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('สร้างร้านใหม่'));
    await tester.pumpAndSettle();

    expect(created, isTrue);
    expect(find.byType(BottomSheet), findsNothing);
  });
}
