import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/app/bootstrap.dart';
import 'package:mobile/app/shop_shell.dart';
import 'package:mobile/core/api/api_providers.dart';
import 'package:mobile/core/l10n/l10n.dart';
import 'package:mobile/core/session/session_controller.dart';
import 'package:mobile/core/session/session_state.dart';
import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/org/application/org_providers.dart';
import 'package:mobile/features/org/domain/entities/role_entities.dart';

/// F-003 role/member journeys on a real device against a real API — the
/// SECOND mobile integration file (T-003-M11).
///
/// ── Why a second file ────────────────────────────────────────────────────
/// F-001 throttles pre-auth requests per IP: 20 per five minutes, a fixed
/// window, and every signup and login spends one. `org_flow_test.dart`
/// already spends 19 of them (see its `signUpAndSignIn` BUDGET note). These
/// cases need their own people, so they live here, and CI runs this file
/// AFTER clearing the per-IP counter (`throttle:ip:*` — the same keys the web
/// lane's `resetIpThrottle` clears). Each file must fit one window on its
/// own: keep this one at ≤ 18.
///
/// Budget here: EM3-08..11 = OWN 2 + ADM_A 2 + STF 2 = 6.
///
/// Conventions are `org_flow_test.dart`'s (read its notes): never
/// `pumpAndSettle` on screens with a skeleton, a short phone on every device,
/// and the server — not the screen — is the judge.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  const baseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://10.0.2.2:3000');
  const roleWritesOn = String.fromEnvironment('E2E_ROLE_WRITES') == 'on';

  String freshEmail(String prefix) => '$prefix-${DateTime.now().microsecondsSinceEpoch}@omnistock.test';
  const password = 'E2e-passphrase-8Kx!';

  ProviderContainer bootApp() {
    final container = ProviderContainer(overrides: buildAppOverrides(baseUrl: baseUrl));
    addTearDown(container.dispose);
    return container;
  }

  /// Never `pumpAndSettle` here: the skeleton animates forever (see
  /// org_flow_test.dart). Pump in fixed steps until the thing is on screen.
  Future<void> pumpUntil(
    WidgetTester tester,
    Finder finder, {
    Duration timeout = const Duration(seconds: 20),
  }) async {
    final deadline = DateTime.now().add(timeout);
    while (DateTime.now().isBefore(deadline)) {
      await tester.pump(const Duration(milliseconds: 100));
      if (finder.evaluate().isNotEmpty) return;
    }
    fail('timed out after $timeout waiting for: $finder');
  }

  Future<void> pumpUntilGone(WidgetTester tester, Finder f) async {
    final deadline = DateTime.now().add(const Duration(seconds: 20));
    while (f.evaluate().isNotEmpty && DateTime.now().isBefore(deadline)) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(f, findsNothing);
  }

  Future<void> pump(WidgetTester tester, ProviderContainer container, Widget screen) async {
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: screen,
        ),
      ),
    );
    await tester.pump();
  }

  /// Spends TWO pre-auth requests (signup + login) — count them in the budget.
  Future<void> signUpAndSignIn(ProviderContainer container, String email) async {
    final auth = container.read(authRepositoryProvider);
    await auth.signup(email: email, password: password);
    await auth.login(email: email, password: password);
    container.read(sessionControllerProvider.notifier).signedIn(orgs: const []);
  }

  final asMe = Options(extra: <String, dynamic>{
    'secure': [
      {'type': 'http', 'scheme': 'bearer', 'name': 'bearerAuth'},
    ],
  });

  /// One account per case — sharing one owner container across cases broke
  /// an M08 check in the other file (see its `ownerInFreshShop`).
  Future<(ProviderContainer, String)> ownerInFreshShop(String prefix) async {
    final container = bootApp();
    await signUpAndSignIn(container, freshEmail(prefix));
    final org = await container.read(orgDirectoryProvider).createOrganization(
          name: 'ร้านสมาชิก ${DateTime.now().millisecondsSinceEpoch}',
        );
    container.read(sessionControllerProvider.notifier).switchOrg(
          ActiveOrg(orgId: org.id, name: org.name, capabilities: const {}),
        );
    await learnCapabilitiesWith(
      session: container.read(sessionControllerProvider.notifier),
      repository: container.read(orgScopedRepositoryProvider),
      orgId: org.id,
    );
    expect(container.read(activeOrgProvider)!.can('manage_roles'), isTrue,
        reason: 'the shop creator must hold manage_roles (via full_access)');
    return (container, org.id);
  }

  /// The top screen's own list (routes below are offstage).
  Finder screenScrollable() =>
      find.descendant(of: find.byType(ListView).first, matching: find.byType(Scrollable)).first;

  /// Builds + shows [row] in a lazily-built list, wherever it is scrolled now.
  Future<Finder> reveal(WidgetTester tester, Finder row) async {
    if (row.evaluate().isEmpty) {
      try {
        await tester.scrollUntilVisible(row, 200, scrollable: screenScrollable());
      } on StateError {
        await tester.scrollUntilVisible(row, -200, scrollable: screenScrollable());
      }
    }
    await tester.ensureVisible(row);
    await tester.pump(const Duration(milliseconds: 300));
    return row;
  }

  /// A short phone on every device (D-038 — see org_flow_test.dart).
  void shortPhone(WidgetTester tester) {
    tester.view.physicalSize = const Size(360, 600) * tester.view.devicePixelRatio;
    addTearDown(tester.view.resetPhysicalSize);
  }

  /// The AppBar ← of the top route, after any running transition ends.
  Future<void> back(WidgetTester tester) async {
    final buttons = find.byType(BackButton);
    final deadline = DateTime.now().add(const Duration(seconds: 10));
    while (buttons.evaluate().length > 1 && DateTime.now().isBefore(deadline)) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    await tester.tap(buttons);
    await tester.pump(const Duration(milliseconds: 500));
  }

  // ── T-003-M11 · R10 change a member's role, on the real API ─────────────
  //
  // One shop, three people: OWN, ADM_A (Admin — holds
  // manage_members ∧ manage_roles, so the server sends row verdicts) and STF.
  // Budget: OWN 2 + ADM_A 2 + STF 2 pre-auth requests; the accepts go through
  // each person's own session.
  //
  // Deviation from test-plan EM3-09, recorded: there is no second Admin
  // account (2 more requests would cross the 20/5-min window). The "equal to
  // me" lock is reached instead by EM3-10's own outcome — OWN moves STF to
  // Admin — so the SAME server verdict (`equal_permissions`) is asserted on
  // STF's row after the refusal, with no way left to open the sheet.
  final sheet = find.byType(BottomSheet);
  Finder inRoleSheet(Finder f) => find.descendant(of: sheet, matching: f);
  Finder optionIn(String label) => find.ancestor(
        of: inRoleSheet(find.textContaining(label)),
        matching: find.byType(RadioListTile<String>),
      );
  final sheetSave = find.byKey(const ValueKey('member-role-save'));
  Finder tileOf(String email) => find.ancestor(of: find.text(email), matching: find.byType(ListTile));

  Future<ProviderContainer> joinAs(
    ProviderContainer owner,
    String orgId,
    String roleId,
    String prefix, {
    void Function(RequestOptions)? onRequest,
  }) async {
    final email = freshEmail(prefix);
    final issued = await owner.read(orgScopedRepositoryProvider).createInvitation(email: email, roleId: roleId);
    final c = bootApp();
    await signUpAndSignIn(c, email);
    if (onRequest != null) {
      // On the BASE client before the org client is first built: orgDioProvider
      // copies the base interceptors when it is created.
      c.read(baseDioProvider).interceptors.add(InterceptorsWrapper(onRequest: (o, h) {
        onRequest(o);
        h.next(o);
      }));
    }
    final accepted = await c.read(baseDioProvider).post<Map<String, dynamic>>(
      '/invitations/accept',
      data: {'token': Uri.parse(issued.inviteUrl).queryParameters['token']},
      options: asMe.copyWith(validateStatus: (_) => true),
    );
    expect(accepted.statusCode, 200, reason: 'accept failed: ${accepted.data}');
    c.read(sessionControllerProvider.notifier).switchOrg(
          ActiveOrg(orgId: orgId, name: 'ร้าน', capabilities: const {}),
        );
    await learnCapabilitiesWith(
      session: c.read(sessionControllerProvider.notifier),
      repository: c.read(orgScopedRepositoryProvider),
      orgId: orgId,
    );
    return c;
  }

  testWidgets(
    'T-003-M11 · EM3-08..11 · R10 sheet on the real API: Owner row locked, STF row opens; options = the '
    'invite screen\'s; change to a custom role (server-checked) · ROLE_EXCEEDS_ACTOR · TARGET_NOT_BELOW_ACTOR '
    '· then STF\'s row is locked equal_permissions',
    skip: !roleWritesOn,
    (tester) async {
      shortPhone(tester);
      final (ownerC, orgId) = await ownerInFreshShop('m-r10');
      final ownerRepo = ownerC.read(orgScopedRepositoryProvider);
      final details = (await ownerRepo.listRoleDetails()).items;
      final adminRole = details.firstWhere((r) => r.roleKey == 'admin');
      final staffRole = details.firstWhere((r) => r.roleKey == 'staff');
      final adminCaps = adminRole.capabilities.toSet();
      final staffCaps = staffRole.capabilities.toSet();
      // c1: Admin has it, Staff does not, and losing it leaves the Admin both
      // on this screen (manage_members) and strictly above Staff.
      final c1 = adminCaps
          .difference(staffCaps)
          .difference({'manage_members', 'manage_roles'})
          .firstOrNull;
      if (c1 == null) fail('Admin has nothing beyond Staff to take away: $adminCaps vs $staffCaps');
      final catalog = await ownerRepo.getCapabilityCatalog();
      final outside = catalog.items
          .where((i) => i.selectable && !adminCaps.contains(i.key) && i.key != 'full_access')
          .map((i) => i.key)
          .firstOrNull;
      if (outside == null) fail('every selectable capability is the Admin\'s — no R_BILL to build');
      final stamp = DateTime.now().millisecondsSinceEpoch % 1000000;
      final rPack = await ownerRepo.createRole(name: 'แพ็คของ $stamp', capabilities: staffCaps.toList());
      final rPlus = await ownerRepo.createRole(name: 'แพ็คพิเศษ $stamp', capabilities: [...staffCaps, c1]);
      final rBill = await ownerRepo.createRole(name: 'บัญชีนอก $stamp', capabilities: [outside]);

      var patches = 0;
      final adminC = await joinAs(ownerC, orgId, adminRole.id, 'm-r10-admin', onRequest: (o) {
        if (o.method == 'PATCH' && o.path.contains('/members/')) patches++;
      });
      final stfC = await joinAs(ownerC, orgId, staffRole.id, 'm-r10-staff');
      final stfId = (await stfC.read(orgScopedRepositoryProvider).getOrganization()).myRoleId;
      expect(stfId, staffRole.id);
      final members = (await ownerRepo.listMembers()).items;
      final stf = members.firstWhere((m) => m.roleId == staffRole.id);
      final own = members.firstWhere((m) => m.isOwner);
      Future<String> stfRoleOnServer() async =>
          (await ownerRepo.listMembers()).items.firstWhere((m) => m.userId == stf.userId).roleId;

      // ── navigation: the shell's members tab, as ADM_A ───────────────────
      await pump(
        tester,
        adminC,
        Consumer(
          builder: (_, ref, __) => ShopShell(active: ref.watch(activeOrgProvider)!, onSignedOut: () {}),
        ),
      );
      await pumpUntil(tester, find.widgetWithText(NavigationBar, 'สมาชิก'));
      await tester.tap(find.widgetWithText(NavigationBar, 'สมาชิก'));
      await pumpUntil(tester, find.text(stf.email));

      // ── EM3-09 (control half): OWN locked owner_only, STF opens ──────────
      await reveal(tester, find.text(own.email));
      expect(tester.widget<ListTile>(tileOf(own.email)).onTap, isNull);
      expect(find.descendant(of: tileOf(own.email), matching: find.byIcon(Icons.lock_outline)), findsOneWidget);
      await reveal(tester, find.text(stf.email));
      expect(find.descendant(of: tileOf(stf.email), matching: find.byIcon(Icons.chevron_right)), findsOneWidget);

      // ── EM3-08: the sheet's options = the invite screen's ───────────────
      List<(String, bool)> offered() => [
            for (final e in find.byType(RadioListTile<String>).evaluate())
              (
                ((e.widget as RadioListTile<String>).title! as Text).data!.replaceAll(' (บทบาทปัจจุบัน)', ''),
                (e.widget as RadioListTile<String>).enabled ?? true,
              ),
          ];
      await tester.tap(find.byTooltip('เชิญสมาชิก'));
      await pumpUntil(tester, find.textContaining('แพ็คของ $stamp'));
      final inInvite = offered();
      await back(tester);
      await pumpUntil(tester, find.text(stf.email));

      await tester.tap(await reveal(tester, find.text(stf.email)));
      await pumpUntil(tester, optionIn('บัญชีนอก $stamp'));
      expect(inRoleSheet(find.text('เปลี่ยนบทบาทของ')), findsOneWidget);
      expect(offered(), inInvite, reason: 'one widget, one source (CM3-08 / EM3-08)');
      expect(tester.widget<RadioListTile<String>>(optionIn('บัญชีนอก $stamp')).enabled, isFalse);
      expect(inRoleSheet(find.text('บทบาทนี้มีสิทธิ์ที่คุณไม่มี จึงมอบให้คนอื่นไม่ได้')), findsOneWidget);
      expect(inRoleSheet(find.text('พนักงาน (บทบาทปัจจุบัน)')), findsOneWidget);
      expect(tester.widget<ButtonStyleButton>(sheetSave).onPressed, isNull, reason: 'no-op guard');

      await tester.ensureVisible(optionIn('แพ็คของ $stamp'));
      await tester.tap(optionIn('แพ็คของ $stamp'));
      await tester.pump(const Duration(milliseconds: 200));
      await tester.tap(sheetSave);
      await pumpUntil(tester, find.text('เปลี่ยนบทบาทของ ${stf.email} เป็น แพ็คของ $stamp แล้ว'));
      await pumpUntilGone(tester, sheet);
      await pumpUntil(tester, find.descendant(of: tileOf(stf.email), matching: find.textContaining('แพ็คของ $stamp')));
      expect(await stfRoleOnServer(), rPack.id, reason: 'the server, not the screen, is the judge');
      expect(patches, 1);

      // ── EM3-11: ROLE_EXCEEDS_ACTOR — OWN takes c1 from Admin mid-sheet ──
      await tester.tap(await reveal(tester, find.text(stf.email)));
      await pumpUntil(tester, optionIn('แพ็คพิเศษ $stamp'));
      await tester.ensureVisible(optionIn('แพ็คพิเศษ $stamp'));
      await tester.tap(optionIn('แพ็คพิเศษ $stamp'));
      await tester.pump(const Duration(milliseconds: 200));
      final adminNow = await ownerRepo.getRoleDetail(adminRole.id);
      await ownerRepo.updateRole(
        adminRole.id,
        RoleUpdate(version: adminNow.version, capabilities: adminCaps.difference({c1}).toList()),
      );
      await tester.ensureVisible(sheetSave);
      await tester.tap(sheetSave);
      await pumpUntil(
        tester,
        find.text('บทบาทนี้มีสิทธิ์ที่คุณไม่มี จึงมอบให้คนอื่นไม่ได้ เลือกบทบาทอื่น หรือให้เจ้าของร้านทำ'),
      );
      expect(await stfRoleOnServer(), rPack.id, reason: 'not written');
      expect(patches, 2, reason: 'one PATCH, never retried');
      expect(tester.widget<RadioGroup<String>>(find.byType(RadioGroup<String>)).groupValue, rPack.id,
          reason: 'back to the current role');
      await tester.tap(find.byKey(const ValueKey('member-role-dismiss')));
      await pumpUntilGone(tester, sheet);

      // ── EM3-10: TARGET_NOT_BELOW_ACTOR — OWN moves STF to Admin mid-sheet ─
      await tester.tap(await reveal(tester, find.text(stf.email)));
      await pumpUntil(tester, optionIn('พนักงาน'));
      await tester.ensureVisible(optionIn('พนักงาน').first);
      await tester.tap(optionIn('พนักงาน').first);
      await tester.pump(const Duration(milliseconds: 200));
      await ownerRepo.updateMemberRole(userId: stf.userId, roleId: adminRole.id);
      await tester.ensureVisible(sheetSave);
      await tester.tap(sheetSave);
      await pumpUntil(tester, inRoleSheet(find.text('คุณจัดการสมาชิกคนนี้ไม่ได้ — ให้เจ้าของร้านช่วย')));
      expect(find.descendant(of: sheetSave, matching: find.text('ปิด')), findsOneWidget);
      expect(await stfRoleOnServer(), adminRole.id, reason: "OWN's change stands — not overwritten");
      expect(patches, 3, reason: 'one PATCH, never retried');
      await tester.tap(sheetSave);
      await pumpUntilGone(tester, sheet);

      // ── EM3-09 (the equal half): STF is now equal to ADM_A ──────────────
      await pumpUntil(
        tester,
        find.descendant(
          of: tileOf(stf.email),
          matching: find.text('คนนี้มีสิทธิ์เท่ากับคุณ — ให้เจ้าของร้านเปลี่ยนบทบาทหรือถอดออก'),
        ),
      );
      expect(tester.widget<ListTile>(tileOf(stf.email)).onTap, isNull);
      await tester.tap(await reveal(tester, find.text(stf.email)));
      await tester.pump(const Duration(milliseconds: 500));
      expect(sheet, findsNothing, reason: 'a locked row has no way to open the sheet');
      expect(rBill.id, isNotEmpty);
      expect(rPlus.id, isNotEmpty);
    },
  );
}
