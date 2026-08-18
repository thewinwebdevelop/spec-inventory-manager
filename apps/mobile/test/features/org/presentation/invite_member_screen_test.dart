// T-002-M3 — S7 on mobile (ux-wireframe §8).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/features/org/application/org_providers.dart';
import 'package:mobile/features/org/domain/entities/org_entities.dart';
import 'package:mobile/features/org/presentation/screens/invite_link_screen.dart';
import 'package:mobile/features/org/presentation/screens/invite_member_screen.dart';

import '../harness.dart';
import '../org_fakes.dart';

Future<void> _pump(
  WidgetTester tester,
  FakeOrgScoped scoped, {
  bool asOwner = true,
  String? initialRoleKey,
}) async {
  await pumpScreen(
    tester,
    InviteMemberScreen(initialRoleKey: initialRoleKey),
    overrides: [orgScopedRepositoryProvider.overrideWithValue(scoped)],
    activeOrg: asOwner ? ownerOrg : adminOrg,
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('data — the three roles, each with what it can do', (tester) async {
    await _pump(tester, FakeOrgScoped(roles: threeRoles));

    expect(find.text('อีเมลของคนที่จะเชิญ'), findsOneWidget);
    expect(find.text('เจ้าของร้าน'), findsOneWidget);
    expect(find.text('ทำได้ทุกอย่าง รวมถึงตั้ง/ถอดเจ้าของร้านคนอื่น'), findsOneWidget);
    expect(find.text('ทำงานประจำวัน ไม่เห็นรายชื่อทีมงานและข้อมูลผู้เสียภาษี'), findsOneWidget);
    // D-012 — the expectation is set BEFORE the button.
    expect(find.textContaining('ระบบยังไม่ส่งอีเมลให้อัตโนมัติ'), findsOneWidget);
  });

  testWidgets('★ the default role is the LEAST privileged one', (tester) async {
    final scoped = FakeOrgScoped(roles: threeRoles);
    await _pump(tester, scoped);

    await tester.enterText(find.byType(TextField), 'malee@shop.com');
    await tester.tap(find.text('สร้างลิงก์คำเชิญ'));
    await tester.pumpAndSettle();

    // Never `roles.first`, which is the Owner row.
    expect(find.byType(InviteLinkScreen), findsOneWidget);
  });

  testWidgets('★ a non-Owner sees the Owner option DISABLED, with the reason', (tester) async {
    // D-028/C-1. Hiding it would leave an Admin wondering why the thing they
    // were told to do is not there.
    await _pump(tester, FakeOrgScoped(roles: threeRoles), asOwner: false);

    expect(find.text('เฉพาะเจ้าของร้านเท่านั้นที่ตั้งเจ้าของร้านคนใหม่ได้'), findsOneWidget);
    final ownerTile = tester.widget<RadioListTile<String>>(
      find.ancestor(
        of: find.text('เจ้าของร้าน'),
        matching: find.byType(RadioListTile<String>),
      ),
    );
    expect(ownerTile.enabled, isFalse);
  });

  testWidgets('★ B-9 · the flag decides, not the slug — a Staff role keyed "owner" stays offerable',
      (tester) async {
    // I-45's trick, from the client's side. The three screens that used to ask
    // `key == 'owner'` were right about the system roles and wrong in
    // principle: F-003 mints roles with no key, and a key can be edited in the
    // database to say anything. If this case ever fails, the shortcut is back.
    final trap = [
      const RoleRow(id: 'rol_owner', name: 'Owner', key: 'owner', grantsOwnership: true),
      // Keyed "owner", grants nothing.
      const RoleRow(id: 'rol_trap', name: 'พนักงาน', key: 'owner'),
    ];
    await _pump(tester, FakeOrgScoped(roles: trap), asOwner: false);

    final tiles = tester
        .widgetList<RadioListTile<String>>(find.byType(RadioListTile<String>))
        .toList();
    // Two options; exactly one of them — the real Owner row — is closed to a
    // non-Owner. `enabled` is nullable and null means "default", i.e. enabled.
    expect(tiles.where((t) => (t.enabled ?? true) == false), hasLength(1));
    expect(tiles.where((t) => (t.enabled ?? true) == true), hasLength(1));
  });

  testWidgets('an Owner may pick Owner', (tester) async {
    await _pump(tester, FakeOrgScoped(roles: threeRoles));

    expect(find.text('เฉพาะเจ้าของร้านเท่านั้นที่ตั้งเจ้าของร้านคนใหม่ได้'), findsNothing);
    final ownerTile = tester.widget<RadioListTile<String>>(
      find.ancestor(
        of: find.text('เจ้าของร้าน'),
        matching: find.byType(RadioListTile<String>),
      ),
    );
    expect(ownerTile.enabled, isTrue);
  });

  testWidgets('★ the short-TTL note appears for an elevated role, with no number in it',
      (tester) async {
    // ux Q14: the real duration only ever arrives with the link's
    // `expiresAt`.
    await _pump(tester, FakeOrgScoped(roles: threeRoles));
    expect(find.textContaining('อายุสั้นกว่าปกติ'), findsNothing);

    await tester.tap(find.text('ผู้ดูแล'));
    await tester.pumpAndSettle();

    expect(find.text('สิทธิ์ระดับนี้ ลิงก์คำเชิญจะมีอายุสั้นกว่าปกติเพื่อความปลอดภัย'),
        findsOneWidget);
    expect(find.textContaining('24 ชั่วโมง'), findsNothing);
  });

  testWidgets('the nudge opens this screen with Owner already chosen', (tester) async {
    await _pump(tester, FakeOrgScoped(roles: threeRoles), initialRoleKey: 'owner');

    // An Owner-level invitation is elevated, so its note is showing.
    expect(find.textContaining('อายุสั้นกว่าปกติ'), findsOneWidget);
  });

  testWidgets('★ success goes to the link panel and cannot be reversed into a second invite',
      (tester) async {
    await _pump(tester, FakeOrgScoped(roles: threeRoles));

    await tester.enterText(find.byType(TextField), 'malee@shop.com');
    await tester.tap(find.text('สร้างลิงก์คำเชิญ'));
    await tester.pumpAndSettle();

    expect(find.byType(InviteLinkScreen), findsOneWidget);
    // pushReplacement: there is no filled-in form behind this to submit again.
    expect(find.byType(InviteMemberScreen), findsNothing);
  });

  testWidgets('409 ALREADY_MEMBER lands under the email field', (tester) async {
    await _pump(
      tester,
      FakeOrgScoped(
        roles: threeRoles,
        createInvitationFailure: const ConflictFailure(code: 'ALREADY_MEMBER'),
      ),
    );

    await tester.enterText(find.byType(TextField), 'somchai@shop.com');
    await tester.tap(find.text('สร้างลิงก์คำเชิญ'));
    await tester.pumpAndSettle();

    expect(find.text('อีเมลนี้เป็นสมาชิกของร้านอยู่แล้ว'), findsOneWidget);
  });

  testWidgets('★ INVITATION_PENDING replaces the form with a way forward (D-027)',
      (tester) async {
    await _pump(
      tester,
      FakeOrgScoped(
        roles: threeRoles,
        createInvitationFailure: const ConflictFailure(
          code: 'INVITATION_PENDING',
          details: {
            'invitationId': 'inv_1',
            'roleName': 'ผู้ดูแล',
            'expiresAt': '2026-08-09T07:30:00.000Z',
          },
        ),
      ),
    );

    await tester.enterText(find.byType(TextField), 'malee@shop.com');
    await tester.tap(find.text('สร้างลิงก์คำเชิญ'));
    await tester.pumpAndSettle();

    expect(find.text('อีเมลนี้มีคำเชิญค้างอยู่แล้ว'), findsOneWidget);
    expect(find.textContaining('สิทธิ์ ผู้ดูแล'), findsOneWidget);
    expect(find.textContaining('ลิงก์ใช้ได้ถึง 9 ส.ค. 2026, 14:30'), findsOneWidget);

    // And the way back — never a dead end.
    await tester.tap(find.text('กลับไปแก้อีเมล'));
    await tester.pumpAndSettle();
    expect(find.text('อีเมลของคนที่จะเชิญ'), findsOneWidget);
  });

  testWidgets('403 explains the Owner-only rule and offers no pointless retry', (tester) async {
    await _pump(
      tester,
      FakeOrgScoped(
        roles: threeRoles,
        createInvitationFailure: const ForbiddenFailure(code: 'FORBIDDEN'),
      ),
    );

    await tester.enterText(find.byType(TextField), 'malee@shop.com');
    await tester.tap(find.text('สร้างลิงก์คำเชิญ'));
    await tester.pumpAndSettle();

    expect(find.textContaining('เฉพาะเจ้าของร้านเท่านั้นที่ตั้งเจ้าของร้านคนใหม่ได้'),
        findsWidgets);
    expect(find.text('ลองใหม่'), findsNothing);
  });

  testWidgets('roles failing to load is its own error, with a retry', (tester) async {
    await _pump(tester, FakeOrgScoped(rolesFailure: const NetworkFailure()));

    expect(find.text('โหลดรายการสิทธิ์ไม่สำเร็จ'), findsOneWidget);
    expect(find.text('ลองใหม่'), findsOneWidget);
  });
}
