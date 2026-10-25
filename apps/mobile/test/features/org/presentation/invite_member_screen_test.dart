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
  testWidgets(
      'data — the three roles; only Owner (server-locked) carries a description',
      (tester) async {
    await _pump(tester, FakeOrgScoped(roles: threeRoles));

    expect(find.text('อีเมลของคนที่จะเชิญ'), findsOneWidget);
    expect(find.text('เจ้าของร้าน'), findsOneWidget);
    expect(find.text('ผู้ดูแล'), findsOneWidget);
    expect(find.text('พนักงาน'), findsOneWidget);
    expect(find.text('ทำได้ทุกอย่าง รวมถึงตั้ง/ถอดเจ้าของร้านคนอื่น'), findsOneWidget);
    // ux-wireframe §0.1 — admin/staff descriptions were dropped: a store can
    // now edit what a role can do, so a fixed sentence tied to `key` would
    // lie about it, and `GET /roles` sends no capabilities to check against.
    expect(find.text('จัดการทีมงานและงานประจำวันได้ แต่ตั้งเจ้าของร้านไม่ได้'), findsNothing);
    expect(find.text('ทำงานประจำวัน ไม่เห็นรายชื่อทีมงานและข้อมูลผู้เสียภาษี'), findsNothing);
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

    expect(
        find.text('บทบาทนี้มีสิทธิ์สูง ลิงก์คำเชิญจึงมีอายุสั้นกว่าปกติเพื่อความปลอดภัย'),
        findsOneWidget);
    expect(find.textContaining('24 ชั่วโมง'), findsNothing);
  });

  RadioListTile<String> tileFor(WidgetTester tester, String label) =>
      tester.widget<RadioListTile<String>>(find.ancestor(
        of: find.text(label),
        matching: find.byType(RadioListTile<String>),
      ));

  testWidgets('R8 · viewerCanAssign=false disables the option and shows the server reason',
      (tester) async {
    final roles = [
      const RoleRow(
          id: 'rol_owner', name: 'Owner', key: 'owner', grantsOwnership: true,
          viewerCanAssign: false, assignBlockedReason: 'owner_only'),
      const RoleRow(
          id: 'rol_ext', name: 'บัญชีภายนอก', key: null, nameCustomized: true,
          viewerCanAssign: false, assignBlockedReason: 'exceeds_your_permissions'),
      const RoleRow(
          id: 'rol_pack', name: 'พนักงานแพ็คของ', key: null, nameCustomized: true,
          viewerCanAssign: true),
    ];
    await _pump(tester, FakeOrgScoped(roles: roles), asOwner: false);

    expect(tileFor(tester, 'บัญชีภายนอก').enabled, isFalse);
    Finder inTile(String label, String text) => find.descendant(
        of: find.ancestor(of: find.text(label), matching: find.byType(RadioListTile<String>)),
        matching: find.text(text));
    expect(inTile('บัญชีภายนอก', 'บทบาทนี้มีสิทธิ์ที่คุณไม่มี จึงมอบให้คนอื่นไม่ได้'),
        findsOneWidget);
    expect(inTile('เจ้าของร้าน', 'เฉพาะเจ้าของร้านเท่านั้นที่ตั้งเจ้าของร้านคนใหม่ได้'),
        findsOneWidget);
    expect(tileFor(tester, 'พนักงานแพ็คของ').enabled, isTrue);
  });

  testWidgets('R8 · an unknown assignBlockedReason falls back to generic copy', (tester) async {
    final roles = [
      const RoleRow(
          id: 'rol_x', name: 'X', key: null, nameCustomized: true,
          viewerCanAssign: false, assignBlockedReason: 'something_new'),
      const RoleRow(
          id: 'rol_ok', name: 'OK', key: null, nameCustomized: true, viewerCanAssign: true),
    ];
    await _pump(tester, FakeOrgScoped(roles: roles), asOwner: false);

    expect(find.text('คุณมอบบทบาทนี้ไม่ได้'), findsOneWidget);
    expect(tileFor(tester, 'X').enabled, isFalse);
  });

  testWidgets('R8 · the server flag beats the Owner-only default', (tester) async {
    final roles = [
      const RoleRow(
          id: 'rol_owner', name: 'Owner', key: 'owner', grantsOwnership: true,
          viewerCanAssign: true),
      const RoleRow(id: 'rol_staff', name: 'Staff', key: 'staff', viewerCanAssign: true),
    ];
    await _pump(tester, FakeOrgScoped(roles: roles), asOwner: false);
    expect(tileFor(tester, 'เจ้าของร้าน').enabled, isTrue);
  });

  testWidgets("R8 · a renamed system role shows the shop's name, not the translation",
      (tester) async {
    final roles = [
      const RoleRow(id: 'rol_staff', name: 'แคชเชียร์', key: 'staff', nameCustomized: true),
    ];
    await _pump(tester, FakeOrgScoped(roles: roles));
    expect(find.text('แคชเชียร์'), findsOneWidget);
    expect(find.text('พนักงาน'), findsNothing);
  });

  testWidgets('R8 · the default selection is never a disabled role', (tester) async {
    final roles = [
      const RoleRow(id: 'rol_a', name: 'A', key: null, viewerCanAssign: true),
      const RoleRow(
          id: 'rol_staff', name: 'Staff', key: 'staff', viewerCanAssign: false,
          assignBlockedReason: 'exceeds_your_permissions'),
    ];
    final scoped = FakeOrgScoped(roles: roles);
    await _pump(tester, scoped, asOwner: false);

    await tester.enterText(find.byType(TextField), 'malee@shop.com');
    await tester.tap(find.text('สร้างลิงก์คำเชิญ'));
    await tester.pumpAndSettle();
    // `staff` is the usual default but is closed to this caller; the form must
    // not submit it.
    expect(find.byType(InviteLinkScreen), findsOneWidget);
    expect(scoped.invitedRoleIds, ['rol_a']);
  });

  testWidgets('R8 · every role disabled: nothing is pre-selected and submit is disabled',
      (tester) async {
    final roles = [
      const RoleRow(
          id: 'rol_a', name: 'A', key: null, viewerCanAssign: false,
          assignBlockedReason: 'exceeds_your_permissions'),
      const RoleRow(
          id: 'rol_staff', name: 'Staff', key: 'staff', viewerCanAssign: false,
          assignBlockedReason: 'exceeds_your_permissions'),
    ];
    await _pump(tester, FakeOrgScoped(roles: roles), asOwner: false);

    final button = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
    expect(button.onPressed, isNull);
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
    expect(find.textContaining('บทบาท ผู้ดูแล'), findsOneWidget);
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

    expect(find.text('โหลดรายการบทบาทไม่สำเร็จ'), findsOneWidget);
    expect(find.text('ลองใหม่'), findsOneWidget);
  });
}
