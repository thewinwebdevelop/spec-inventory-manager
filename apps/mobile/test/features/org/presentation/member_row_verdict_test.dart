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

const _footer = 'ถอดสมาชิกออกจากร้าน หรือยกเลิกคำเชิญ ทำได้ที่เว็บ';

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

  testWidgets('★ M11 · verdict ABSENT is not fail-closed: active rows + own row open, Owner row locked',
      (tester) async {
    // adminOrg = manage_members only → the server sends no verdict (api §3.1).
    final tapped = await _pump(
      tester,
      [
        member(id: 'usr_2', email: 'mai@shop.com'),
        member(id: 'usr_1', email: 'me@shop.com', isMe: true),
        member(id: 'usr_0', email: 'owner@shop.com', isOwner: true, roleKey: 'owner'),
      ],
      org: adminOrg,
    );

    for (final email in ['mai@shop.com', 'me@shop.com']) {
      expect(_chevronIn(email), findsOneWidget, reason: email);
      expect(_lockIn(email), findsNothing, reason: email);
    }
    expect(_chevronIn('owner@shop.com'), findsNothing);
    expect(_lockIn('owner@shop.com'), findsOneWidget);
    expect(find.text(_ownerOnly), findsOneWidget);
    expect(_tileOf(tester, 'owner@shop.com').onTap, isNull);

    await tester.tap(find.text('mai@shop.com'));
    await tester.tap(find.text('me@shop.com'));
    await tester.tap(find.text('owner@shop.com'));
    expect(tapped.map((m) => m.userId), ['usr_2', 'usr_1']);
  });

  testWidgets('verdict ABSENT + an Owner viewer (older server) → the Owner row opens too',
      (tester) async {
    final tapped = await _pump(
      tester,
      [member(id: 'usr_0', email: 'owner2@shop.com', isOwner: true, roleKey: 'owner')],
      org: ownerOrg,
    );
    expect(_chevronIn('owner2@shop.com'), findsOneWidget);
    await tester.tap(find.text('owner2@shop.com'));
    expect(tapped, hasLength(1));
  });

  testWidgets('a tappable row says what a tap does (semantics hint); a locked one does not',
      (tester) async {
    await _pump(tester, [
      member(id: 'usr_2', email: 'mai@shop.com', viewerCanManage: true),
      member(id: 'usr_3', email: 'nok@shop.com', viewerCanManage: false, manageBlockedReason: 'equal_permissions'),
    ]);
    Finder hinted(String email) => find.ancestor(
          of: find.text(email),
          matching: find.byWidgetPredicate(
            (w) => w is Semantics && w.properties.hint == 'แตะเพื่อเปลี่ยนบทบาท',
          ),
        );
    expect(hinted('mai@shop.com'), findsOneWidget);
    expect(hinted('nok@shop.com'), findsNothing);
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

  testWidgets('★ M11 · with no seam override the row opens the REAL R10 sheet', (tester) async {
    await _pump(
      tester,
      [member(id: 'usr_2', email: 'mai@shop.com', viewerCanManage: true)],
      wired: false,
    );
    expect(_chevronIn('mai@shop.com'), findsOneWidget);
    await tester.tap(find.text('mai@shop.com'));
    await tester.pumpAndSettle();
    expect(find.byType(BottomSheet), findsOneWidget);
  });

  testWidgets('members section footer says where removal / invitation actions live', (tester) async {
    await _pump(tester, [member(id: 'usr_2', email: 'mai@shop.com', viewerCanManage: true)]);
    expect(find.text('ถอดสมาชิกออกจากร้าน หรือยกเลิกคำเชิญ ทำได้ที่เว็บ'), findsOneWidget);
  });

  testWidgets('no remove / reset-password / cancel-invitation action anywhere (F-002b)', (tester) async {
    await _pump(tester, [
      member(id: 'usr_2', email: 'mai@shop.com', viewerCanManage: true),
    ]);

    for (final word in ['ถอดออกจากร้าน', 'ตั้งรหัสผ่านใหม่', 'ยกเลิกคำเชิญ', 'รีเซ็ต']) {
      // The footer (ux R10 (ก)) NAMES these to say they live on the web —
      // that sentence is the only place the words may appear.
      expect(
        find.byWidgetPredicate(
          (w) => w is Text && (w.data ?? '').contains(word) && w.data != _footer,
        ),
        findsNothing,
        reason: word,
      );
    }
  });
}
