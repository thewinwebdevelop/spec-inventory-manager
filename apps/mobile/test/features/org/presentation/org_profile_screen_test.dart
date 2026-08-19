// ★ M-07 — S4's tax card on mobile: four states, three tiers, and the two
// things that must be true about the number itself.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/core/security/screenshot_guard.dart';
import 'package:mobile/core/session/session_state.dart';
import 'package:mobile/core/ui/skeleton.dart';
import 'package:mobile/features/org/application/org_providers.dart';
import 'package:mobile/features/org/domain/entities/org_entities.dart';
import 'package:mobile/features/org/presentation/screens/org_profile_screen.dart';

import '../harness.dart';
import '../org_fakes.dart';

const _fullTaxId = '0105560123454';

Future<void> _pump(
  WidgetTester tester,
  FakeOrgScoped scoped, {
  ActiveOrg org = ownerOrg,
}) async {
  await pumpScreen(
    tester,
    const OrgProfileScreen(),
    overrides: [orgScopedRepositoryProvider.overrideWithValue(scoped)],
    activeOrg: org,
  );
}

/// A member with neither `full_access` nor `manage_org_settings`.
const _staffOrg = ActiveOrg(
  orgId: 'org_1',
  name: 'ร้านหอมกรุ่นเบเกอรี่',
  capabilities: {'view_products'},
);

void main() {
  setUp(ScreenshotGuardScope.resetForTest);

  testWidgets('loading — a skeleton, not an empty screen', (tester) async {
    await _pump(tester, FakeOrgScoped(delay: const Duration(milliseconds: 50)));
    await tester.pump();

    expect(find.byType(SessionListSkeleton), findsWidgets);
    await tester.pumpAndSettle();
  });

  testWidgets('error — says so, and offers a retry', (tester) async {
    await _pump(tester, FakeOrgScoped(profileFailure: const NetworkFailure()));
    await tester.pumpAndSettle();

    expect(find.text('โหลดข้อมูลร้านไม่สำเร็จ'), findsOneWidget);
    expect(find.text('ลองใหม่'), findsOneWidget);
  });

  testWidgets('★ the number is MASKED until asked for, and the notice comes first',
      (tester) async {
    await _pump(tester, FakeOrgScoped());
    await tester.pumpAndSettle();

    expect(find.text('•••••••••3454'), findsOneWidget);
    expect(find.text(_fullTaxId), findsNothing);
    // §5: "บอกก่อนกด ไม่ใช่แอบเก็บ" — the press is audited, and the reader is
    // told before pressing, not after.
    expect(find.text('การกดดูเลขเต็มถูกบันทึกไว้เพื่อความปลอดภัยของร้าน'), findsOneWidget);
    expect(find.text('แสดงเลขเต็ม'), findsOneWidget);
  });

  testWidgets('★ press shows the full number; press again drops it', (tester) async {
    final scoped = FakeOrgScoped();
    await _pump(tester, scoped);
    await tester.pumpAndSettle();

    await tester.tap(find.text('แสดงเลขเต็ม'));
    await tester.pumpAndSettle();
    expect(find.text(_fullTaxId), findsOneWidget);
    // The mobile-only consequence is announced while the number is visible.
    expect(find.text('เลขเต็มจะถูกซ่อนอัตโนมัติเมื่อสลับออกจากแอป'), findsOneWidget);

    await tester.tap(find.text('ซ่อนเลข'));
    await tester.pumpAndSettle();

    expect(find.text(_fullTaxId), findsNothing);
    expect(find.text('•••••••••3454'), findsOneWidget);
    expect(scoped.revealCalls, 1, reason: 'hiding is local — it must not spend a reveal');
  });

  testWidgets('★★ the OS screenshot guard is held only while the number is out',
      (tester) async {
    // The app-switcher half of M-07. Held during `loading` too, so the first
    // painted frame is already covered; released when the number goes away, so
    // a screen showing only a mask does not blank the thumbnail forever.
    await _pump(tester, FakeOrgScoped());
    await tester.pumpAndSettle();
    expect(ScreenshotGuardScope.debugRefCount, 0);

    await tester.tap(find.text('แสดงเลขเต็ม'));
    await tester.pumpAndSettle();
    expect(ScreenshotGuardScope.debugRefCount, 1, reason: 'a visible national ID is unguarded');

    await tester.tap(find.text('ซ่อนเลข'));
    await tester.pumpAndSettle();
    expect(ScreenshotGuardScope.debugRefCount, 0, reason: 'nothing sensitive left to guard');
  });

  testWidgets('★★ leaving the screen releases the guard', (tester) async {
    await _pump(tester, FakeOrgScoped());
    await tester.pumpAndSettle();
    await tester.tap(find.text('แสดงเลขเต็ม'));
    await tester.pumpAndSettle();
    expect(ScreenshotGuardScope.debugRefCount, 1);

    // Replace the screen — the same thing a route pop does.
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();

    expect(ScreenshotGuardScope.debugRefCount, 0, reason: 'the guard would stay on forever');
  });

  testWidgets('★ a member without the capability sees NO digits and no button',
      (tester) async {
    // AC-7.4 / ux Q13 — not even the last four. The fake still returns the
    // masked value, so this proves the TIER drops it rather than the request
    // happening not to include it.
    await _pump(tester, FakeOrgScoped(), org: _staffOrg);
    await tester.pumpAndSettle();

    expect(find.text('•••••••••3454'), findsNothing);
    expect(find.textContaining('3454'), findsNothing);
    expect(find.text('แสดงเลขเต็ม'), findsNothing);
    expect(find.text('รายละเอียดเปิดให้เฉพาะผู้ที่ดูแลข้อมูลร้าน'), findsOneWidget);
  });

  testWidgets('undeclared — an Owner is told where the form is, not left at a dead end',
      (tester) async {
    // F-002 has no tax form on the phone (§13 item 3). Saying nothing would
    // leave the one person who can fix it with no idea how.
    await _pump(
      tester,
      FakeOrgScoped(
        profile: const OrgProfileView(id: 'org_1', name: 'ร้านใหม่', taxProfileComplete: false),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('ร้านนี้ยังไม่ได้ประกาศข้อมูลผู้เสียภาษี'), findsOneWidget);
    expect(find.text('แก้ไขข้อมูลผู้เสียภาษีได้ที่เว็บ'), findsOneWidget);
  });

  testWidgets('a failed reveal explains itself and leaves the mask in place', (tester) async {
    await _pump(tester, FakeOrgScoped(revealFailure: const ThrottledFailure()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('แสดงเลขเต็ม'));
    await tester.pumpAndSettle();

    expect(find.text('ขอดูเลขเต็มไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'), findsOneWidget);
    expect(find.text(_fullTaxId), findsNothing);
    expect(find.text('•••••••••3454'), findsOneWidget);
  });
}
