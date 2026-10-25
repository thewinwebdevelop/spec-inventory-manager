// T-003-M10 ★ — R6 on mobile: "คนที่ใช้บทบาท "{ชื่อ}"" (ux R6, mobile push).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/core/ui/skeleton.dart';
import 'package:mobile/features/org/application/org_providers.dart';
import 'package:mobile/features/org/domain/entities/org_entities.dart';
import 'package:mobile/features/org/presentation/screens/members_screen.dart';

import '../harness.dart';
import '../org_fakes.dart';

const _footer = 'ถอดสมาชิกออกจากร้าน หรือยกเลิกคำเชิญ ทำได้ที่เว็บ';

Future<List<MemberRow>> _pump(
  WidgetTester tester,
  FakeOrgScoped scoped, {
  bool settle = true,
}) async {
  final tapped = <MemberRow>[];
  await pumpScreen(
    tester,
    RoleMembersScreen(roleId: 'rol_staff', roleName: 'พนักงาน', onChangeRole: tapped.add),
    overrides: [orgScopedRepositoryProvider.overrideWithValue(scoped)],
    activeOrg: adminOrg,
  );
  if (settle) await tester.pumpAndSettle();
  return tapped;
}

void main() {
  testWidgets('★ asks both endpoints for THIS role only — active members, open invitations',
      (tester) async {
    final scoped = FakeOrgScoped();
    await _pump(tester, scoped);

    expect(scoped.memberRoleIdsSeen, ['rol_staff']);
    expect(scoped.statusesSeen, ['active']);
    expect(scoped.invitationRoleIdsSeen, ['rol_staff']);
    // `pending` on the server = stored pending, which includes the ones that
    // have since expired — exactly ROLE_IN_USE.pendingInvitations (AC-3.9).
    expect(scoped.invitationStatusesSeen, ['pending']);
  });

  testWidgets('title, section headers with counts, pending AND expired invitations',
      (tester) async {
    await _pump(
      tester,
      FakeOrgScoped(
        invitationPages: [
          PagedResult(items: [
            invitation(id: 'inv_1', email: 'malee@shop.com', status: 'expired', roleKey: 'staff', roleName: 'Staff'),
            invitation(id: 'inv_2', email: 'new@shop.com', roleKey: 'staff', roleName: 'Staff'),
          ]),
        ],
        memberPages: [
          PagedResult(items: [
            member(id: 'usr_2', email: 'somchai@shop.com'),
            member(id: 'usr_3', email: 'nok@shop.com'),
          ]),
        ],
      ),
    );

    expect(find.text('คนที่ใช้บทบาท "พนักงาน"'), findsOneWidget);
    expect(find.text('คำเชิญที่ใช้บทบาทนี้ (2)'), findsOneWidget);
    expect(find.text('สมาชิกที่ใช้บทบาทนี้ (2)'), findsOneWidget);
    expect(find.text('malee@shop.com'), findsOneWidget);
    expect(find.text('พนักงาน · หมดอายุแล้ว'), findsOneWidget);
    expect(find.text('พนักงาน · รอตอบรับ'), findsOneWidget);
    // Invitations sit above members (wireframe).
    expect(
      tester.getTopLeft(find.text('malee@shop.com')).dy,
      lessThan(tester.getTopLeft(find.text('somchai@shop.com')).dy),
    );
    expect(find.text(_footer), findsOneWidget);
  });

  testWidgets('★ R7 verdicts apply here too — tappable vs locked + reason', (tester) async {
    final tapped = await _pump(
      tester,
      FakeOrgScoped(memberPages: [
        PagedResult(items: [
          member(id: 'usr_2', email: 'somchai@shop.com', viewerCanManage: true),
          member(id: 'usr_3', email: 'nok@shop.com', viewerCanManage: false, manageBlockedReason: 'equal_permissions'),
        ]),
      ]),
    );

    expect(find.text('คนนี้มีสิทธิ์เท่ากับคุณ — ให้เจ้าของร้านเปลี่ยนบทบาทหรือถอดออก'), findsOneWidget);
    await tester.tap(find.text('nok@shop.com'));
    await tester.tap(find.text('somchai@shop.com'));
    await tester.pumpAndSettle();
    expect(tapped.map((m) => m.userId), ['usr_2']);
  });

  testWidgets('★ invitation rows carry no action and no reason line (F-002b)', (tester) async {
    await _pump(
      tester,
      FakeOrgScoped(invitationPages: [
        PagedResult(items: [invitation(email: 'malee@shop.com')]),
      ]),
    );

    final tile = tester.widget<ListTile>(
      find.ancestor(of: find.text('malee@shop.com'), matching: find.byType(ListTile)),
    );
    expect(tile.onTap, isNull);
    expect(find.byIcon(Icons.lock_outline), findsNothing);
    expect(find.byIcon(Icons.chevron_right), findsNothing);
    expect(find.textContaining('ให้เจ้าของร้านยกเลิกหรือออกลิงก์ใหม่'), findsNothing);
  });

  testWidgets('empty per section', (tester) async {
    await _pump(
      tester,
      FakeOrgScoped(memberPages: [
        PagedResult(items: [member(id: 'usr_2', email: 'somchai@shop.com')]),
      ]),
    );

    expect(find.text('ไม่มีคำเชิญที่ใช้บทบาทนี้แล้ว'), findsOneWidget);
    expect(find.text('ไม่มีสมาชิกที่ใช้บทบาทนี้แล้ว'), findsNothing);
    expect(find.text('สมาชิกที่ใช้บทบาทนี้ (1)'), findsOneWidget);
  });

  testWidgets('★ both empty → success banner + back to the role, no footer', (tester) async {
    final navigatorKey = GlobalKey<NavigatorState>();
    await pumpScreen(
      tester,
      Navigator(
        key: navigatorKey,
        onGenerateRoute: (_) => MaterialPageRoute<void>(
          builder: (_) => const Scaffold(body: Text('R4 บทบาท')),
        ),
      ),
      overrides: [orgScopedRepositoryProvider.overrideWithValue(FakeOrgScoped())],
      activeOrg: adminOrg,
    );
    navigatorKey.currentState!.push(
      MaterialPageRoute<void>(
        builder: (_) => const RoleMembersScreen(roleId: 'rol_staff', roleName: 'พนักงาน'),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('ไม่มีใครใช้บทบาทนี้แล้ว — กลับไปลบบทบาทได้เลย'), findsOneWidget);
    expect(find.text(_footer), findsNothing);
    expect(find.text('ไม่มีคำเชิญที่ใช้บทบาทนี้แล้ว'), findsNothing);

    await tester.tap(find.text('กลับไปที่บทบาท "พนักงาน"'));
    await tester.pumpAndSettle();
    expect(find.text('R4 บทบาท'), findsOneWidget);
  });

  testWidgets('loading — skeleton per section', (tester) async {
    await _pump(tester, FakeOrgScoped(delay: const Duration(milliseconds: 50)), settle: false);
    await tester.pump();
    expect(find.byType(SessionListSkeleton), findsNWidgets(2));
    await tester.pumpAndSettle();
  });

  testWidgets('★ each section fails on its own, and retries on its own', (tester) async {
    final scoped = FakeOrgScoped(
      invitationsFailure: const ServerFailure(),
      memberPages: [
        PagedResult(items: [member(id: 'usr_2', email: 'somchai@shop.com')]),
      ],
    );
    await _pump(tester, scoped);

    expect(find.text('โหลดคำเชิญไม่สำเร็จ'), findsOneWidget);
    expect(find.text('somchai@shop.com'), findsOneWidget);
    // A failed section is not "empty" — no success banner over an error.
    expect(find.text('ไม่มีใครใช้บทบาทนี้แล้ว — กลับไปลบบทบาทได้เลย'), findsNothing);

    await tester.tap(find.text('ลองใหม่'));
    await tester.pumpAndSettle();
    expect(scoped.invitationCalls, 2);
    expect(scoped.memberCalls, 1);
  });
}
