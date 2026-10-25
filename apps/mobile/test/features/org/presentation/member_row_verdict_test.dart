// T-003-M10 ★ — R7 on mobile (ux R7 "mobile" + R10 (ก) · test-plan CM3-03).
//
// Every branch of the member-row verdict, rendered on the members screen:
// allowed · each blocked reason · unknown reason · reason missing · field
// absent · revoked — and BOTH directions of "the server's verdict beats the
// capabilities this device holds".
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/session/session_state.dart';
import 'package:mobile/features/org/application/org_providers.dart';
import 'package:mobile/features/org/domain/entities/org_entities.dart';
import 'package:mobile/features/org/presentation/screens/members_screen.dart';

import '../harness.dart';
import '../org_fakes.dart';

/// Holds every capability that could tempt a client into deciding for itself.
const _everythingOrg = ActiveOrg(
  orgId: 'org_1',
  name: 'ร้านหอมกรุ่นเบเกอรี่',
  capabilities: {'full_access', 'manage_members', 'manage_roles'},
);

Future<List<MemberRow>> _pump(
  WidgetTester tester,
  List<MemberRow> rows, {
  ActiveOrg org = _everythingOrg,
  bool wired = true,
}) async {
  final tapped = <MemberRow>[];
  await pumpScreen(
    tester,
    MembersScreen(onChangeRole: wired ? tapped.add : null),
    overrides: [
      orgScopedRepositoryProvider.overrideWithValue(
        FakeOrgScoped(memberPages: [PagedResult(items: rows)]),
      ),
    ],
    activeOrg: org,
  );
  await tester.pumpAndSettle();
  return tapped;
}

ListTile _tileOf(WidgetTester tester, String email) => tester.widget<ListTile>(
      find.ancestor(of: find.text(email), matching: find.byType(ListTile)),
    );

Finder _chevronIn(String email) => find.descendant(
      of: find.ancestor(of: find.text(email), matching: find.byType(ListTile)),
      matching: find.byIcon(Icons.chevron_right),
    );

Finder _lockIn(String email) => find.descendant(
      of: find.ancestor(of: find.text(email), matching: find.byType(ListTile)),
      matching: find.byIcon(Icons.lock_outline),
    );

const _ownerOnly = 'เฉพาะเจ้าของร้านเท่านั้นที่เปลี่ยนบทบาทหรือถอดเจ้าของร้านคนอื่นได้';
const _equal = 'คนนี้มีสิทธิ์เท่ากับคุณ — ให้เจ้าของร้านเปลี่ยนบทบาทหรือถอดออก';
const _exceeds = 'คนนี้มีสิทธิ์บางอย่างที่คุณไม่มี — ให้เจ้าของร้านเปลี่ยนบทบาทหรือถอดออก';
const _unknown = 'คุณจัดการสมาชิกคนนี้ไม่ได้ — ให้เจ้าของร้านช่วย';

void main() {
  testWidgets('★ viewerCanManage=true → chevron, and a tap hands over THAT row once', (tester) async {
    final tapped = await _pump(tester, [
      member(id: 'usr_2', email: 'mai@shop.com', viewerCanManage: true),
    ]);

    expect(_chevronIn('mai@shop.com'), findsOneWidget);
    expect(_lockIn('mai@shop.com'), findsNothing);

    await tester.tap(find.text('mai@shop.com'));
    await tester.pumpAndSettle();
    expect(tapped.map((m) => m.userId), ['usr_2']);
  });

  testWidgets('★ CM3-03 direction 2: verdict=true wins over a device that holds LESS', (tester) async {
    // adminOrg has no full_access and no manage_roles. The row is an Owner.
    // A client deciding for itself would lock it; the server said yes.
    final tapped = await _pump(
      tester,
      [member(id: 'usr_9', email: 'boss@shop.com', isOwner: true, roleKey: 'owner', viewerCanManage: true)],
      org: adminOrg,
    );

    expect(_chevronIn('boss@shop.com'), findsOneWidget);
    expect(find.text(_ownerOnly), findsNothing);
    await tester.tap(find.text('boss@shop.com'));
    expect(tapped, hasLength(1));
  });

  for (final (reason, copy) in [
    ('owner_only', _ownerOnly),
    ('equal_permissions', _equal),
    ('exceeds_your_permissions', _exceeds),
    ('a_reason_this_build_has_never_seen', _unknown),
    (null, _unknown),
  ]) {
    testWidgets('★ viewerCanManage=false, reason=$reason → lock + exact copy, nothing tappable',
        (tester) async {
      // CM3-03 direction 1: this device holds full_access + manage_members +
      // manage_roles, so local caps "say yes" — the server's no wins.
      final tapped = await _pump(tester, [
        member(id: 'usr_3', email: 'nok@shop.com', viewerCanManage: false, manageBlockedReason: reason),
      ]);

      expect(find.text(copy), findsOneWidget);
      expect(_lockIn('nok@shop.com'), findsOneWidget);
      expect(_chevronIn('nok@shop.com'), findsNothing);
      // Not "disabled": there is no tap handler at all.
      expect(_tileOf(tester, 'nok@shop.com').onTap, isNull);
      await tester.tap(find.text('nok@shop.com'));
      await tester.tap(find.text(copy));
      expect(tapped, isEmpty);
      // The raw key never reaches the screen.
      if (reason != null) expect(find.textContaining(reason), findsNothing);
    });
  }

  testWidgets('★ verdict ABSENT → no chevron, no reason, no tap — whatever the device holds',
      (tester) async {
    final tapped = await _pump(tester, [
      member(id: 'usr_2', email: 'mai@shop.com'),
      member(id: 'usr_1', email: 'me@shop.com', isMe: true),
    ]);

    for (final email in ['mai@shop.com', 'me@shop.com']) {
      expect(_chevronIn(email), findsNothing);
      expect(_lockIn(email), findsNothing);
      expect(_tileOf(tester, email).onTap, isNull);
    }
    for (final copy in [_ownerOnly, _equal, _exceeds, _unknown]) {
      expect(find.text(copy), findsNothing);
    }
    await tester.tap(find.text('mai@shop.com'));
    expect(tapped, isEmpty);
  });

  testWidgets('revoked rows: no chevron, no reason, even if a verdict came along', (tester) async {
    final tapped = await _pump(tester, [
      member(id: 'usr_1', email: 'me@shop.com', isMe: true, viewerCanManage: true),
      member(id: 'usr_4', email: 'pim@shop.com', status: 'revoked', viewerCanManage: true),
      member(
        id: 'usr_5',
        email: 'gone@shop.com',
        status: 'revoked',
        viewerCanManage: false,
        manageBlockedReason: 'owner_only',
      ),
    ]);

    expect(_chevronIn('pim@shop.com'), findsNothing);
    expect(_tileOf(tester, 'pim@shop.com').onTap, isNull);
    expect(find.text(_ownerOnly), findsNothing);
    await tester.tap(find.text('pim@shop.com'));
    expect(tapped, isEmpty);
  });

  testWidgets('no change-role handler wired → an allowed row offers nothing; locked rows still explain',
      (tester) async {
    // Until R10's sheet lands (T-003-M11) the screen has nothing to open, and
    // a chevron that opens nothing is worse than no affordance.
    await _pump(
      tester,
      [
        member(id: 'usr_2', email: 'mai@shop.com', viewerCanManage: true),
        member(id: 'usr_3', email: 'nok@shop.com', viewerCanManage: false, manageBlockedReason: 'equal_permissions'),
      ],
      wired: false,
    );

    expect(_chevronIn('mai@shop.com'), findsNothing);
    expect(_tileOf(tester, 'mai@shop.com').onTap, isNull);
    expect(find.text(_equal), findsOneWidget);
  });

  testWidgets('no remove / reset-password / cancel-invitation action anywhere (F-002b)', (tester) async {
    await _pump(tester, [
      member(id: 'usr_2', email: 'mai@shop.com', viewerCanManage: true),
    ]);

    for (final word in ['ถอดออกจากร้าน', 'ตั้งรหัสผ่านใหม่', 'ยกเลิกคำเชิญ', 'รีเซ็ต']) {
      expect(find.textContaining(word), findsNothing, reason: word);
    }
  });
}
