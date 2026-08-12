// T-002-M3 — S6 on mobile: one screen, two sections (ux-wireframe §7).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/core/ui/skeleton.dart';
import 'package:mobile/features/org/application/org_providers.dart';
import 'package:mobile/features/org/domain/entities/org_entities.dart';
import 'package:mobile/features/org/presentation/screens/members_screen.dart';

import '../harness.dart';
import '../org_fakes.dart';

Future<void> _pump(WidgetTester tester, FakeOrgScoped scoped) async {
  await pumpScreen(
    tester,
    const MembersScreen(),
    overrides: [orgScopedRepositoryProvider.overrideWithValue(scoped)],
    activeOrg: ownerOrg,
  );
}

void main() {
  testWidgets('loading — skeletons shaped like the rows they replace', (tester) async {
    await _pump(tester, FakeOrgScoped(delay: const Duration(milliseconds: 50)));
    await tester.pump();

    expect(find.byType(SessionListSkeleton), findsWidgets);
    await tester.pumpAndSettle();
  });

  testWidgets('data — email, role and status, all as TEXT', (tester) async {
    await _pump(tester, FakeOrgScoped(memberPages: [
      PagedResult(items: [
        member(id: 'usr_1', email: 'somchai@shop.com', isMe: true, isOwner: true, roleKey: 'owner'),
        member(id: 'usr_2', email: 'malee@shop.com', roleKey: 'admin'),
      ]),
    ]));
    await tester.pumpAndSettle();

    expect(find.text('somchai@shop.com'), findsOneWidget);
    expect(find.text('malee@shop.com'), findsOneWidget);
    // `isMe` is the server's answer — no screen compares user ids.
    expect(find.text('(คุณ)'), findsOneWidget);
    expect(find.textContaining('เจ้าของร้าน · ใช้งานอยู่'), findsOneWidget);
    expect(find.textContaining('ผู้ดูแล · ใช้งานอยู่'), findsOneWidget);
  });

  testWidgets('★ no pending invitations — the whole section disappears', (tester) async {
    // ux-wireframe §7: an empty section with a heading is clutter reporting
    // the absence of work.
    await _pump(tester, FakeOrgScoped(memberPages: [
      PagedResult(items: [member(id: 'usr_1', isMe: true, isOwner: true, roleKey: 'owner')]),
    ]));
    await tester.pumpAndSettle();

    expect(find.textContaining('คำเชิญที่รอตอบรับ'), findsNothing);
  });

  testWidgets('pending invitations sit ABOVE the members — they are the outstanding work',
      (tester) async {
    await _pump(tester, FakeOrgScoped(
      invitationPages: [
        PagedResult(items: [invitation(email: 'new@example.com')]),
      ],
      memberPages: [
        PagedResult(items: [member(id: 'usr_1', email: 'somchai@shop.com', isMe: true)]),
      ],
    ));
    await tester.pumpAndSettle();

    expect(find.text('คำเชิญที่รอตอบรับ (1)'), findsOneWidget);
    expect(
      tester.getTopLeft(find.text('new@example.com')).dy,
      lessThan(tester.getTopLeft(find.text('somchai@shop.com')).dy),
    );
  });

  testWidgets('★ the invitation shows a real deadline, never a hard-coded duration',
      (tester) async {
    await _pump(tester, FakeOrgScoped(invitationPages: [
      PagedResult(items: [invitation(expiresAt: DateTime.utc(2026, 8, 9, 7, 30))]),
    ]));
    await tester.pumpAndSettle();

    expect(find.textContaining('ลิงก์ใช้ได้ถึง 9 ส.ค. 2026, 14:30'), findsOneWidget);
    // The two numbers ux forbids as literals (Q14 / D-027).
    expect(find.textContaining('7 วัน'), findsNothing);
    expect(find.textContaining('24 ชั่วโมง'), findsNothing);
  });

  testWidgets('★ each section fails on its own', (tester) async {
    await _pump(tester, FakeOrgScoped(
      invitationsFailure: const ServerFailure(),
      memberPages: [
        PagedResult(items: [member(id: 'usr_1', email: 'somchai@shop.com', isMe: true)]),
      ],
    ));
    await tester.pumpAndSettle();

    expect(find.text('โหลดคำเชิญไม่สำเร็จ'), findsOneWidget);
    // The other half still works — which is the whole point of two
    // controllers rather than one screen-wide future.
    expect(find.text('somchai@shop.com'), findsOneWidget);
    expect(find.text('โหลดรายชื่อสมาชิกไม่สำเร็จ'), findsNothing);
  });

  testWidgets('members failing keeps the invitations readable', (tester) async {
    await _pump(tester, FakeOrgScoped(
      membersFailure: const NetworkFailure(),
      invitationPages: [
        PagedResult(items: [invitation(email: 'new@example.com')]),
      ],
    ));
    await tester.pumpAndSettle();

    expect(find.text('โหลดรายชื่อสมาชิกไม่สำเร็จ'), findsOneWidget);
    expect(find.text('new@example.com'), findsOneWidget);
  });

  testWidgets('alone in the shop — says so, and offers the way out', (tester) async {
    await _pump(tester, FakeOrgScoped(memberPages: [
      PagedResult(items: [member(id: 'usr_1', isMe: true)]),
    ]));
    await tester.pumpAndSettle();

    expect(find.textContaining('ตอนนี้มีคุณอยู่คนเดียวในร้านนี้'), findsOneWidget);
  });

  group('backup-owner nudge (D-030)', () {
    Future<void> pumpNudge(WidgetTester tester, {String? nextCursor}) async {
      await _pump(tester, FakeOrgScoped(memberPages: [
        PagedResult(
          items: [
            member(id: 'usr_1', isMe: true, isOwner: true, roleKey: 'owner'),
            member(id: 'usr_2'),
          ],
          nextCursor: nextCursor,
        ),
      ]));
      await tester.pumpAndSettle();
    }

    testWidgets('★ shown when I am the only Owner on a COMPLETE list', (tester) async {
      await pumpNudge(tester);

      expect(find.textContaining('มีเจ้าของร้านคนเดียวคือคุณ'), findsOneWidget);
      expect(find.text('เชิญเจ้าของร้านอีกคน'), findsOneWidget);
      // Tone: never a warning icon, never the words ux forbids.
      expect(find.byIcon(Icons.warning), findsNothing);
      expect(find.textContaining('เสี่ยง'), findsNothing);
      expect(find.textContaining('อันตราย'), findsNothing);
    });

    testWidgets('★ hidden while the list is still partial', (tester) async {
      await pumpNudge(tester, nextCursor: 'cur_2');
      expect(find.textContaining('มีเจ้าของร้านคนเดียวคือคุณ'), findsNothing);
    });

    testWidgets('"ไว้ทีหลัง" hides it for this shop', (tester) async {
      await pumpNudge(tester);

      await tester.tap(find.text('ไว้ทีหลัง'));
      await tester.pumpAndSettle();

      expect(find.textContaining('มีเจ้าของร้านคนเดียวคือคุณ'), findsNothing);
    });
  });

  testWidgets('★ rows are not tappable while the actions do not exist', (tester) async {
    // An action sheet that opens onto nothing is worse than no affordance.
    await _pump(tester, FakeOrgScoped(memberPages: [
      PagedResult(items: [member(id: 'usr_1', email: 'somchai@shop.com', isMe: true)]),
    ]));
    await tester.pumpAndSettle();

    final tile = tester.widget<ListTile>(
      find.ancestor(of: find.text('somchai@shop.com'), matching: find.byType(ListTile)),
    );
    expect(tile.onTap, isNull);
  });

  testWidgets('more pages than one — "โหลดเพิ่ม" appends', (tester) async {
    await _pump(tester, FakeOrgScoped(memberPages: [
      PagedResult(items: [member(id: 'usr_1', email: 'a@shop.com')], nextCursor: 'cur_2'),
      PagedResult(items: [member(id: 'usr_2', email: 'b@shop.com')]),
    ]));
    await tester.pumpAndSettle();

    expect(find.text('b@shop.com'), findsNothing);
    await tester.tap(find.text('โหลดเพิ่ม'));
    await tester.pumpAndSettle();

    expect(find.text('a@shop.com'), findsOneWidget);
    expect(find.text('b@shop.com'), findsOneWidget);
  });

  testWidgets('revoked members are labelled, not just dimmed', (tester) async {
    await _pump(tester, FakeOrgScoped(memberPages: [
      PagedResult(items: [
        member(id: 'usr_1', isMe: true),
        member(id: 'usr_2', email: 'gone@shop.com', status: 'revoked'),
      ]),
    ]));
    await tester.pumpAndSettle();

    expect(find.textContaining('ถูกถอดแล้ว'), findsOneWidget);
    // The count is of ACTIVE members — a revoked row is not one of them.
    expect(find.text('สมาชิกในร้าน (1)'), findsOneWidget);
  });
}
