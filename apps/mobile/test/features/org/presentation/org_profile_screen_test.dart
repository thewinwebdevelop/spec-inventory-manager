// ★ M-07 — S4's tax card on mobile: four states, three tiers, and the two
// things that must be true about the number itself.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/l10n/l10n.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/core/security/screenshot_guard.dart';
import 'package:mobile/core/session/session_controller.dart';
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

/// ★ The tier comes from the RESPONSE now, not from the session — the review
/// found the session's set empty for every entry point but create-shop, so a
/// real Owner arriving from the picker saw the read-only tier. These fixtures
/// therefore carry the capabilities the server would report.
const _ownerProfile = OrgProfileView(
  id: 'org_1',
  name: 'ร้านหอมกรุ่นเบเกอรี่',
  taxProfileComplete: true,
  capabilities: {'full_access'},
  entityType: 'personal',
  taxIdMasked: '•••••••••3454',
  vatRegistered: false,
  branchCode: '00000',
);

const _staffProfile = OrgProfileView(
  id: 'org_1',
  name: 'ร้านหอมกรุ่นเบเกอรี่',
  taxProfileComplete: true,
  capabilities: {'view_products'},
  taxIdMasked: '•••••••••3454',
  vatRegistered: false,
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
    await _pump(tester, FakeOrgScoped(profile: _ownerProfile));
    await tester.pumpAndSettle();

    expect(find.text('•••••••••3454'), findsOneWidget);
    expect(find.text(_fullTaxId), findsNothing);
    // §5: "บอกก่อนกด ไม่ใช่แอบเก็บ" — the press is audited, and the reader is
    // told before pressing, not after.
    expect(find.text('การกดดูเลขเต็มถูกบันทึกไว้เพื่อความปลอดภัยของร้าน'), findsOneWidget);
    expect(find.text('แสดงเลขเต็ม'), findsOneWidget);
  });

  testWidgets('★ press shows the full number; press again drops it', (tester) async {
    final scoped = FakeOrgScoped(profile: _ownerProfile);
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
    await _pump(tester, FakeOrgScoped(profile: _ownerProfile));
    await tester.pumpAndSettle();
    expect(ScreenshotGuardScope.debugRefCount, 0);

    await tester.tap(find.text('แสดงเลขเต็ม'));
    await tester.pumpAndSettle();
    expect(ScreenshotGuardScope.debugRefCount, 1, reason: 'a visible national ID is unguarded');

    await tester.tap(find.text('ซ่อนเลข'));
    await tester.pumpAndSettle();
    expect(ScreenshotGuardScope.debugRefCount, 0, reason: 'nothing sensitive left to guard');
  });

  testWidgets('★★ coming back to the screen never inherits the number', (tester) async {
    // ⚠️ REWRITTEN after the security review, twice. The original asserted only
    // the guard's refcount, and its sibling in the controller test called a
    // `forget()` that no production code called — between them they read as
    // proof of a property the app did not have: the number survived the
    // unmount and was painted again on re-entry, with NO new request and so no
    // audit event either.
    //
    // This version uses ONE container across two visits, which is what a route
    // pop and a second tap on the same menu entry look like. A fresh container
    // per visit would pass without any fix at all.
    final scoped = FakeOrgScoped(profile: _ownerProfile);
    final container = ProviderContainer(
      overrides: [orgScopedRepositoryProvider.overrideWithValue(scoped)],
    );
    addTearDown(container.dispose);
    container.read(sessionControllerProvider.notifier).signedIn(orgs: const [], active: ownerOrg);

    Future<void> visit() async {
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: const OrgProfileScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    await visit();
    await tester.tap(find.text('แสดงเลขเต็ม'));
    await tester.pumpAndSettle();
    expect(find.text(_fullTaxId), findsOneWidget);
    expect(ScreenshotGuardScope.debugRefCount, 1);

    // Leave — the same thing a route pop does.
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
    expect(ScreenshotGuardScope.debugRefCount, 0, reason: 'the guard would stay on forever');

    // …and come back.
    await visit();

    expect(
      find.text(_fullTaxId),
      findsNothing,
      reason: 'a shared shop phone would show the previous person a national ID',
    );
    expect(find.text('•••••••••3454'), findsOneWidget);
    expect(find.text('แสดงเลขเต็ม'), findsOneWidget);
    expect(scoped.revealCalls, 1, reason: 'and it was not re-fetched either');
  });

  testWidgets('★ a member without the capability sees NO digits and no button',
      (tester) async {
    // AC-7.4 / ux Q13 — not even the last four. The fake still returns the
    // masked value, so this proves the TIER drops it rather than the request
    // happening not to include it.
    await _pump(tester, FakeOrgScoped(profile: _staffProfile));
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
        profile: const OrgProfileView(
          id: 'org_1',
          name: 'ร้านใหม่',
          taxProfileComplete: false,
          capabilities: {'full_access'},
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('ร้านนี้ยังไม่ได้ประกาศข้อมูลผู้เสียภาษี'), findsOneWidget);
    expect(find.text('แก้ไขข้อมูลผู้เสียภาษีได้ที่เว็บ'), findsOneWidget);
  });

  testWidgets('a failed reveal explains itself and leaves the mask in place', (tester) async {
    await _pump(tester, FakeOrgScoped(profile: _ownerProfile, revealFailure: const ThrottledFailure()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('แสดงเลขเต็ม'));
    await tester.pumpAndSettle();

    // ★ The failure decides the sentence now (review, Low #8): a spent quota
    // reads as a spent quota, not as the generic "try again" that used to
    // cover a removed declaration and a 429 alike.
    expect(find.text('คำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง'), findsOneWidget);
    expect(find.text(_fullTaxId), findsNothing);
    expect(find.text('•••••••••3454'), findsOneWidget);
  });
}
