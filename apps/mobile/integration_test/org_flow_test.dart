import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/app/bootstrap.dart';
import 'package:mobile/core/api/api_providers.dart';
import 'package:mobile/core/l10n/l10n.dart';
import 'package:mobile/core/session/session_controller.dart';
import 'package:mobile/core/session/session_state.dart';
import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/org/application/org_providers.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/core/ui/checkbox_row.dart';
import 'package:mobile/features/org/domain/entities/org_entities.dart';
import 'package:mobile/features/org/domain/entities/role_entities.dart';
import 'package:mobile/features/org/presentation/screens/create_org_screen.dart';
import 'package:mobile/features/org/presentation/screens/members_screen.dart';
import 'package:mobile/features/org/presentation/screens/org_profile_screen.dart';
import 'package:mobile/features/org/presentation/screens/roles_screen.dart';

/// E-10 (test-plan §12.1) — the mobile half, on a real device against a real
/// API and a real Postgres.
///
/// ── What this proves that 391 widget tests cannot ────────────────────────
/// Every mobile test to date overrides the repositories with fakes, so all of
/// them agree with a client the app never builds. This one runs the REAL
/// provider graph from `buildAppOverrides` over real HTTP: the interceptor
/// chain, the org header, the DTO→entity mapping, the paged controllers and
/// the screens, against the same server the browser lane uses. The web lane
/// found six defects nothing else could see, two of them total; this is the
/// same instrument pointed at the other client.
///
/// ── What it deliberately does NOT do ─────────────────────────────────────
/// It does not drive the app's own navigation, because there is none yet:
/// `app/app.dart` is F-001's auth shell and the router is F-006's. So the
/// test composes the screens the way a router would, and says so. When F-006
/// lands, the composition here is what it replaces.
///
/// ── Reaching the API ─────────────────────────────────────────────────────
/// `--dart-define=API_BASE_URL=…`. On an Android emulator the host is
/// 10.0.2.2, never localhost — localhost is the emulated device itself, and
/// the failure mode is a connection refused that looks like the API is down.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  const baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );

  /// Unique per run: one database serves the whole CI run, web lane included.
  String freshEmail(String prefix) =>
      '$prefix-${DateTime.now().microsecondsSinceEpoch}@omnistock.test';
  const password = 'E2e-passphrase-8Kx!';

  /// Boots the real graph, exactly as `main.dart` does.
  ProviderContainer bootApp() {
    final container = ProviderContainer(overrides: buildAppOverrides(baseUrl: baseUrl));
    addTearDown(container.dispose);
    return container;
  }

  /// ⚠️ NEVER `pumpAndSettle` on these screens, and the reason cost a CI run.
  ///
  /// The loading skeleton is an `AnimationController(...)..repeat()`
  /// (`core/ui/skeleton.dart`), so a frame is always scheduled and
  /// `pumpAndSettle` never returns — it just renders frames as fast as it can
  /// until it gives up. On a software-rendered emulator that is a CPU storm:
  /// the first run of this lane lost the emulator process mid-case, and the
  /// suite reported three tests as "did not complete" with no exception to
  /// read. The skeleton is right to animate forever; the test was wrong to
  /// wait for it to stop.
  ///
  /// So: pump in fixed steps and stop as soon as the thing being waited for is
  /// on screen.
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
    // One frame, not a settle: the screen may be showing a skeleton.
    await tester.pump();
  }

  /// Signs a brand-new account in through the real auth repository, and puts
  /// the session where the router would have.
  ///
  /// ⚠️ BUDGET. F-001 throttles pre-auth requests per IP — `IP_WINDOW_MAX = 20`
  /// per five minutes, a FIXED window from the first request — and every
  /// signup and every login spends one (`/auth/refresh` too). The whole file
  /// runs in well under a minute, so every case shares ONE window.
  ///
  /// Writes-on (CI) spend, T-003-M08: E-10 2 · list 2 · tax 2 · removal 5 ·
  /// M06/M07 R3 2 · M07 self-edit 4 · M08 R4/R5 2 = 19 of 20. To get there
  /// M08 stopped three raw `/auth/login`s whose token the app already held:
  /// a call the person's own session makes goes through THAT container's
  /// authenticated Dio ([asMe]). The one raw login left (removal) is there
  /// because "another session" is what that case is about.
  ///
  /// A new account is 2 more; past 20 the next signup is a 429 and the case
  /// fails at its first line. The web lane had to add a Redis reset for
  /// exactly that reason, and that reset is a bypass of a real control
  /// rather than something to reach for casually.
  Future<void> signUpAndSignIn(ProviderContainer container, String email) async {
    final auth = container.read(authRepositoryProvider);
    await auth.signup(email: email, password: password);
    await auth.login(email: email, password: password);
    container.read(sessionControllerProvider.notifier).signedIn(orgs: const []);
  }

  /// What the generated client marks an authenticated call with — the auth
  /// interceptor attaches the container's in-memory access token to it.
  final asMe = Options(extra: <String, dynamic>{
    'secure': [
      {'type': 'http', 'scheme': 'bearer', 'name': 'bearerAuth'},
    ],
  });

  testWidgets('E-10 · creates a shop on a real API and lands inside it', (tester) async {
    final container = bootApp();
    await signUpAndSignIn(container, freshEmail('m-e10'));

    CreatedOrganization? created;
    await pump(tester, container, CreateOrgScreen(onCreated: (org) => created = org));

    final name = 'ร้านมือถือ ${DateTime.now().millisecondsSinceEpoch}';
    await tester.enterText(find.byType(TextField), name);
    await tester.pump();
    await tester.tap(find.text('สร้างร้าน'));

    // A real request is in flight. Pump in steps until the screen has moved
    // past "กำลังสร้างร้าน..." rather than settling — see `pumpUntil`.
    final deadline = DateTime.now().add(const Duration(seconds: 25));
    while (created == null && DateTime.now().isBefore(deadline)) {
      await tester.pump(const Duration(milliseconds: 100));
    }

    expect(created, isNotNull, reason: 'POST /organizations did not come back');
    expect(created!.name, name);

    // ★ The session is ALREADY in the new shop — the screen's contract is that
    // the caller does not have to re-fetch to enter (api-spec Q5), and this is
    // the client half of it.
    expect(container.read(activeOrgIdProvider), created!.id);
  });

  testWidgets('E-10 · the shop list and the members list come back from the server',
      (tester) async {
    final container = bootApp();
    await signUpAndSignIn(container, freshEmail('m-e10-list'));

    // Create one through the repository — this case is about READING.
    final scoped = container.read(orgDirectoryProvider);
    final org = await scoped.createOrganization(
      name: 'ร้านรายชื่อ ${DateTime.now().millisecondsSinceEpoch}',
    );
    container.read(sessionControllerProvider.notifier).switchOrg(
          ActiveOrg(orgId: org.id, name: org.name, capabilities: const {'full_access'}),
        );

    // AC-2.1 — the shop appears in the list the switcher reads. Read through
    // the repository rather than `myOrganizationsProvider.future`: that one is
    // autoDispose, and with no widget listening it can be torn down between
    // the read and the await, which is a flake nobody enjoys diagnosing.
    final mine = await container.read(orgDirectoryProvider).listMyOrganizations();
    expect(mine.map((o) => o.id), contains(org.id));

    await pump(tester, container, const MembersScreen());

    // The creator is a member, and an Owner. Their capability list is
    // `full_access` alone — the case that broke web's whole nav.
    await pumpUntil(tester, find.textContaining('สมาชิกในร้าน'));
    expect(find.textContaining('@omnistock.test'), findsWidgets);
  });

  testWidgets('★ M-07 · the tax id round trip against the real API', (tester) async {
    // ⚠️ THIS CASE USED TO BE NAMED A ROUND TRIP AND NEVER REVEALED A NUMBER.
    // The security review caught that: it declared nothing, so the success
    // path — deserialising `taxId`/`revealedAt`, and the property that the
    // profile endpoint STILL only carries a mask afterwards — was unproven
    // against the real server. That success path is exactly where a
    // deserialisation error would have stranded the screen in `loading`.
    //
    // It now declares a tax profile, reveals it, and checks both directions.
    // What stays manual is what a person has to look at: the app-switcher
    // thumbnail, and whether thirteen digits are readable and copyable in
    // somebody's hand.
    const validTaxId = '0105560123454'; // mod-11 checksum, weights 13…2

    final container = bootApp();
    final email = freshEmail('m-tax');
    await signUpAndSignIn(container, email);

    final org = await container.read(orgDirectoryProvider).createOrganization(
          name: 'ร้านภาษีมือถือ ${DateTime.now().millisecondsSinceEpoch}',
        );
    container.read(sessionControllerProvider.notifier).switchOrg(
          ActiveOrg(orgId: org.id, name: org.name, capabilities: const {'full_access'}),
        );

    // ── before anything is declared ──────────────────────────────────────
    final before = await container.read(orgScopedRepositoryProvider).getOrganization();
    expect(before.taxProfileComplete, isFalse);
    expect(before.taxIdMasked, isNull);

    // ★ Revealing an undeclared shop fails loudly — the client must not paint
    // "—" as though it were a number.
    Object? undeclaredFailure;
    try {
      await container.read(orgScopedRepositoryProvider).revealTaxId();
    } catch (e) {
      undeclaredFailure = e;
    }
    expect(undeclaredFailure, isNotNull, reason: 'reveal on a shop with no declaration');

    // ── declare it, through the API ──────────────────────────────────────
    // Mobile has no tax form (§13 item 3, and M-07's screen is read-only), so
    // the declaration goes the way it goes in real life: somebody does it on
    // the web. Saying so beats pretending the phone can.
    // The owner's own session (no second login — see the BUDGET note), the
    // way the web form would send it: org-scoped, bearer, raw body.
    final declared = await container.read(orgDioProvider).put<Map<String, dynamic>>(
      '/orgs/${org.id}/tax-profile',
      data: {
        'entityType': 'personal', // the case where the TIN IS a national ID
        'taxId': validTaxId,
        'vatRegistered': false,
      },
      options: asMe.copyWith(validateStatus: (_) => true),
    );
    expect(declared.statusCode, 200, reason: 'declaring the profile failed: ${declared.data}');
    // ★ Even the WRITE does not echo it back (contract §3.3).
    expect(declared.data.toString(), isNot(contains(validTaxId)));

    // ── the profile now says "declared", still with no digits ────────────
    final after = await container.read(orgScopedRepositoryProvider).getOrganization();
    expect(after.taxProfileComplete, isTrue);
    expect(after.taxIdMasked, isNotNull);
    expect(
      after.taxIdMasked,
      isNot(contains(validTaxId)),
      reason: 'the mask must not contain the whole number',
    );
    expect(after.capabilities, contains('full_access'),
        reason: 'the tier is decided from this field — it was dropped once already');

    // ── and the ONE endpoint that may say it, does ───────────────────────
    final revealed = await container.read(orgScopedRepositoryProvider).revealTaxId();
    expect(revealed.taxId, validTaxId, reason: 'the success path nobody had exercised');
    expect(revealed.revealedAt, isA<DateTime>());

    // ★ …and asking again does not change what the profile endpoint carries.
    // If a reveal ever "warmed" the profile response, every screen showing the
    // shop would start leaking the number.
    final stillMasked = await container.read(orgScopedRepositoryProvider).getOrganization();
    expect(stillMasked.taxIdMasked, isNot(equals(validTaxId)));

    // A second look is a second request — nothing is cached anywhere in the
    // chain, which is what makes the audit trail mean anything.
    final again = await container.read(orgScopedRepositoryProvider).revealTaxId();
    expect(again.taxId, validTaxId);
  });

  testWidgets('★ E-10 · removed mid-session: the shop goes, the session stays', (tester) async {
    // AC-5.1/AC-5.2 on mobile.
    //
    // ⚠️ Two steps go through the raw API rather than the app, and not for
    // convenience: F-002's mobile scope has no accept-invitation and no
    // remove-member (the invite link opens on the web — D-012 — and §7's row
    // actions are web-only). The mobile port has neither method, so a test
    // that pretended otherwise would be testing something that does not
    // exist. The removal coming from elsewhere is also what the AC describes:
    // another session ends your membership while you are using the app.
    final api = Dio(BaseOptions(baseUrl: baseUrl, validateStatus: (_) => true));

    Future<String> apiLogin(String email) async {
      final res = await api.post<Map<String, dynamic>>(
        '/auth/login',
        data: {'email': email, 'password': password, 'tokenTransport': 'body'},
      );
      expect(res.statusCode, 200, reason: 'the API refused a login: ${res.data}');
      return res.data!['accessToken'] as String;
    }

    // ── the owner, on a real mobile stack ─────────────────────────────────
    final ownerContainer = bootApp();
    final ownerEmail = freshEmail('m-owner');
    await signUpAndSignIn(ownerContainer, ownerEmail);

    final org = await ownerContainer.read(orgDirectoryProvider).createOrganization(
          name: 'ร้านถูกถอด ${DateTime.now().millisecondsSinceEpoch}',
        );
    ownerContainer.read(sessionControllerProvider.notifier).switchOrg(
          ActiveOrg(orgId: org.id, name: org.name, capabilities: const {'full_access'}),
        );

    // ── a second person joins ─────────────────────────────────────────────
    final staffEmail = freshEmail('m-staff');
    final roles = await ownerContainer.read(orgScopedRepositoryProvider).listRoles();
    final staffRole = roles.firstWhere((r) => r.key == 'staff', orElse: () => roles.last);
    // Invited through the APP — this half mobile does support, and it is the
    // one that exercises the org header and the one-shot link.
    final issued = await ownerContainer.read(orgScopedRepositoryProvider).createInvitation(
          email: staffEmail,
          roleId: staffRole.id,
        );
    expect(issued.inviteUrl, contains('/invite?token='));

    final staffContainer = bootApp();
    await signUpAndSignIn(staffContainer, staffEmail);

    // Their own session accepts (user-scoped: the base Dio, no org header).
    final accepted = await staffContainer.read(baseDioProvider).post<Map<String, dynamic>>(
      '/invitations/accept',
      data: {'token': Uri.parse(issued.inviteUrl).queryParameters['token']},
      options: asMe.copyWith(validateStatus: (_) => true),
    );
    expect(accepted.statusCode, 200, reason: 'accept failed: ${accepted.data}');

    staffContainer.read(sessionControllerProvider.notifier).switchOrg(
          ActiveOrg(orgId: org.id, name: org.name, capabilities: const {}),
        );
    // ── they are really in, proven with a call THEY may make ─────────────
    //
    // ⚠️ `listRoles`, not `listMembers`, and the first version got this wrong.
    // `GET …/members` requires `manage_members`, so a พนักงาน asking for it
    // gets `403 FORBIDDEN` — the server being right, and the opposite of what
    // this line is trying to establish. `GET …/roles` is `@AnyActiveMember()`:
    // it succeeds for exactly as long as they are a member, which is the
    // property the removal is about to end.
    final before = await staffContainer.read(orgScopedRepositoryProvider).listRoles();
    expect(before, isNotEmpty, reason: 'the invited member cannot reach their own shop');

    // ── the removal, from another session ─────────────────────────────────
    final ownerToken = await apiLogin(ownerEmail);
    final headers = {
      'Authorization': 'Bearer $ownerToken',
      'X-Organization-Id': org.id,
    };
    // Read through the OWNER's client — they hold `manage_members`.
    final members = await ownerContainer.read(orgScopedRepositoryProvider).listMembers();
    final target = members.items.firstWhere((m) => m.email == staffEmail);
    final removed = await api.delete<Map<String, dynamic>>(
      '/orgs/${org.id}/members/${target.userId}',
      options: Options(headers: headers),
    );
    expect(removed.statusCode, 200, reason: 'remove failed: ${removed.data}');

    // ── what the removed person's client does next ────────────────────────
    // The next org-scoped request is refused. What must NOT happen is the
    // session ending: being removed from one shop says nothing about the
    // account (D-027), which is why `orgAccessDenied` is its own method and
    // not a call to `sessionExpired`.
    Object? failure;
    try {
      await staffContainer.read(orgScopedRepositoryProvider).listRoles();
    } catch (e) {
      failure = e;
    }
    expect(failure, isNotNull, reason: 'a removed member could still reach the shop');
    expect(failure, isA<OrgAccessDeniedFailure>());

    staffContainer.read(sessionControllerProvider.notifier).orgAccessDenied();
    expect(staffContainer.read(activeOrgIdProvider), isNull, reason: 'the shop should be gone');
    expect(
      staffContainer.read(sessionControllerProvider),
      isA<SessionAuthed>(),
      reason: 'being removed from a shop must not log the person out',
    );

    // …and the shop is no longer in the list the switcher reads (AC-5.2).
    final theirShops = await staffContainer.read(orgDirectoryProvider).listMyOrganizations();
    expect(theirShops.map((o) => o.id), isNot(contains(org.id)));
  });

  // ── T-003-M06 · R3 ฟอร์มบทบาท on the real API ─────────────────────────────
  //
  // Which journey runs depends on how the API was booted, and the suite is
  // TOLD, never guesses: `--dart-define=E2E_ROLE_WRITES=on` when the API runs
  // with `ROLE_WRITES_ENABLED=true` (the web e2e lane's setting), absent
  // otherwise (the mobile lane today). Same contract as web's E2E_ROLE_WRITES.
  // Each mode's case is skipped — visibly — in the other mode.
  //
  // Budget: one account each (signup + login = 2 of the 20 pre-auth requests
  // per five minutes — see `signUpAndSignIn`), and only one of the two runs.
  const roleWritesOn = String.fromEnvironment('E2E_ROLE_WRITES') == 'on';

  /// Signs up, creates a shop through the repository and enters it with the
  /// capabilities the SERVER reports (not a hand-written set).
  Future<(ProviderContainer, String)> ownerInFreshShop(String prefix) async {
    final container = bootApp();
    await signUpAndSignIn(container, freshEmail(prefix));
    final org = await container.read(orgDirectoryProvider).createOrganization(
          name: 'ร้านบทบาท ${DateTime.now().millisecondsSinceEpoch}',
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

  /// Members screen → "จัดการบทบาท" → R1, the way a person gets there.
  Future<void> openRolesFromMembers(WidgetTester tester, ProviderContainer container) async {
    await pump(tester, container, const MembersScreen());
    await pumpUntil(tester, find.byKey(const ValueKey('manage-roles-button')));
    await tester.tap(find.byKey(const ValueKey('manage-roles-button')));
    await pumpUntil(tester, find.textContaining('จาก 30 บทบาท'));
  }

  // ⚠️ The R3 checklist is a LAZILY-built ListView. On a short screen (CI's
  // api-34 default profile) a row below the fold is never built, so waiting
  // for `cap-row-…` with `pumpUntil` waits forever (CI run on 61148de: 20 s
  // timeout on `cap-row-manage_stock`). Wait for the form's top instead, then
  // SCROLL the row into existence before reading or tapping it.
  final formName = find.byKey(const ValueKey('role-form-name'));

  /// The top screen's own scroll view (its ListView's Scrollable — not a
  /// TextField's internal one, which sits deeper in the tree). Routes below
  /// are offstage, so `find` does not see their lists.
  Finder screenScrollable() =>
      find.descendant(of: find.byType(ListView).first, matching: find.byType(Scrollable)).first;

  /// Builds + shows [row] (R1 role row, R3 checklist row) wherever the list
  /// is scrolled now.
  Future<Finder> reveal(WidgetTester tester, Finder row) async {
    if (row.evaluate().isEmpty) {
      try {
        await tester.scrollUntilVisible(row, 200, scrollable: screenScrollable());
      } on StateError {
        // Not below the fold — above it (the list was scrolled past it).
        await tester.scrollUntilVisible(row, -200, scrollable: screenScrollable());
      }
    }
    await tester.ensureVisible(row);
    await tester.pump(const Duration(milliseconds: 300));
    return row;
  }

  Future<void> tapRow(WidgetTester tester, String capability) async {
    final row = await reveal(tester, find.byKey(ValueKey('cap-row-$capability')));
    await tester.tap(row);
    await tester.pump(const Duration(milliseconds: 100));
  }

  Future<bool> ticked(WidgetTester tester, String capability) async =>
      tester.widget<CheckboxRow>(await reveal(tester, find.byKey(ValueKey('cap-row-$capability')))).value;

  /// R1 → one role's R3 (the role list is lazy too).
  Future<void> openRoleRow(WidgetTester tester, String roleId) async {
    await tester.tap(await reveal(tester, find.byKey(ValueKey('role-row-$roleId'))));
    await pumpUntil(tester, formName);
  }

  /// A short phone, on purpose and on every device: the lazy fold must always
  /// be in play, so a finder that skips the scroll fails HERE and not only on
  /// whichever CI emulator happens to be short (D-038 — the case that went red
  /// on CI was green on a Pixel 5).
  void shortPhone(WidgetTester tester) {
    tester.view.physicalSize = const Size(360, 600) * tester.view.devicePixelRatio;
    addTearDown(tester.view.resetPhysicalSize);
  }

  Future<void> pressSubmit(WidgetTester tester, String label) async {
    final button = find.widgetWithText(ElevatedButton, label);
    await tester.ensureVisible(button);
    await tester.tap(button);
    await tester.pump(const Duration(milliseconds: 100));
  }

  // T-003-M07 · R3a — the confirm sheet a capability change opens.
  final confirmSheet = find.byKey(const ValueKey('role-confirm-sheet'));
  Finder inSheet(String text) => find.descendant(of: confirmSheet, matching: find.text(text));

  /// Waits for R3a, checks the label on its primary, and presses it.
  Future<void> confirmInSheet(WidgetTester tester, {String label = 'บันทึก'}) async {
    await pumpUntil(tester, confirmSheet);
    final submit = find.byKey(const ValueKey('role-confirm-submit'));
    expect(find.descendant(of: submit, matching: find.text(label)), findsOneWidget);
    await tester.tap(submit);
    await tester.pump(const Duration(milliseconds: 100));
  }

  // R3b — the 409 banner.
  final conflictBanner = find.byKey(const ValueKey('role-conflict-banner'));
  Finder inBanner(String text) => find.descendant(of: conflictBanner, matching: find.text(text));

  testWidgets(
    'T-003-M06/M07 · EM3-01/06 · R3 clone → create, edit → R3a → save, then a real 409 → R3b diff, '
    're-apply sends nothing, saving again = one more PATCH',
    skip: !roleWritesOn,
    (tester) async {
      shortPhone(tester);
      final (container, _) = await ownerInFreshShop('m-r3');
      final repo = container.read(orgScopedRepositoryProvider);
      await openRolesFromMembers(tester, container);

      // ── R1 → R2 → R3 (clone of the fewest-capabilities role) ─────────────
      await tester.tap(find.widgetWithText(ElevatedButton, 'สร้างบทบาท'));
      await pumpUntil(tester, find.text('ถัดไป'));
      await tester.tap(find.widgetWithText(ElevatedButton, 'ถัดไป'));
      await pumpUntil(tester, find.textContaining('เริ่มจากสำเนาของ'));

      final before = await repo.listRoleDetails();
      final roleName = 'แพ็คของ ${DateTime.now().millisecondsSinceEpoch % 1000000}';
      await tester.enterText(find.byKey(const ValueKey('role-form-name')), roleName);
      await tester.pump(const Duration(milliseconds: 300));
      await pressSubmit(tester, 'สร้างบทบาท');

      // Back on R1 with the toast.
      await pumpUntil(tester, find.text('สร้างบทบาท "$roleName" แล้ว'));

      // ── the server, not the screen, is the judge ─────────────────────────
      final after = await repo.listRoleDetails();
      expect(after.items, hasLength(before.items.length + 1));
      final created = after.items.firstWhere((r) => r.name == roleName);
      final source = before.items
          .where((r) => r.canClone.allowed)
          .reduce((a, b) => b.capabilities.length < a.capabilities.length ? b : a);
      expect(created.capabilities.toSet(), source.capabilities.toSet(),
          reason: 'a clone carries the source capabilities');
      expect(created.version, 1);

      // ── R1 row → R3 edit → tick manage_stock → บันทึก ────────────────────
      // R1 has re-read the list (the count says so), and the row is there —
      // scrolled to: R1 is a lazy list and the new role is last.
      await pumpUntil(tester, find.textContaining('ใช้ไป ${after.items.length} จาก'));
      await openRoleRow(tester, created.id);
      final hadStock = await ticked(tester, 'manage_stock');
      await tapRow(tester, 'manage_stock');
      await pressSubmit(tester, 'บันทึก');

      // ── R3a: the change is described first, impact from the server ───────
      await pumpUntil(tester, confirmSheet);
      expect(inSheet('บันทึกการเปลี่ยนสิทธิ์ของ "$roleName"?'), findsOneWidget);
      expect(inSheet(hadStock ? 'เอาออก' : 'เพิ่ม'), findsOneWidget);
      expect(inSheet('จัดการสต๊อก'), findsOneWidget);
      expect(inSheet('ยังไม่มีสมาชิกใช้บทบาทนี้'), findsOneWidget,
          reason: 'usage.activeMembers = 0 on the server for a role nobody holds');
      // "แก้ต่อ" sends nothing — the server still has version 1.
      await tester.tap(find.byKey(const ValueKey('role-confirm-cancel')));
      await tester.pump(const Duration(milliseconds: 500));
      expect(confirmSheet, findsNothing);
      expect((await repo.getRoleDetail(created.id)).version, 1);

      await pressSubmit(tester, 'บันทึก');
      await confirmInSheet(tester);
      await pumpUntil(tester, find.text('บันทึกบทบาท "$roleName" แล้ว'));

      final saved = await repo.getRoleDetail(created.id);
      expect(saved.version, 2);
      expect(saved.capabilities.contains('manage_stock'), !hadStock);
      expect(saved.name, roleName, reason: 'name was not touched, so it was not sent');

      // ── EM3-06: someone else saves first; my save gets 409, NOT resubmitted ─
      final hadOrders = await ticked(tester, 'manage_orders');
      await tapRow(tester, 'manage_orders');
      await repo.updateRole(created.id, RoleUpdate(version: saved.version, name: '$roleName (อีกคน)'));
      await pressSubmit(tester, 'บันทึก');
      await confirmInSheet(tester);
      await pumpUntil(tester, find.text('มีคนแก้บทบาทนี้ไปก่อนคุณ'));
      await pumpUntil(tester, find.text('$roleName (อีกคน)'));

      final latest = await repo.getRoleDetail(created.id);
      expect(latest.version, 3, reason: 'only the other save landed — no silent retry with currentVersion');
      expect(latest.name, '$roleName (อีกคน)');
      expect(latest.capabilities.toSet(), saved.capabilities.toSet(),
          reason: 'my manage_orders change was not written over theirs');

      // ── R3b (M07): MY diff, re-apply fills the latest and sends NOTHING ──
      // The direction depends on the cloned source (Staff already has it).
      expect(inBanner('${hadOrders ? 'เอาออก' : 'เพิ่ม'}: จัดการออเดอร์และการแพ็ค'), findsOneWidget);
      expect(await ticked(tester, 'manage_orders'), hadOrders, reason: 'the form shows the latest version');
      // The banner is at the TOP of the same lazy list — scroll back to it.
      await tester.tap(await reveal(tester, inBanner('ใส่การแก้ของฉันกลับเข้าไป')));
      await tester.pump(const Duration(milliseconds: 500));
      await pumpUntil(tester, formName);
      expect(await ticked(tester, 'manage_orders'), !hadOrders, reason: 'my edit is back in the form');
      expect(inBanner('ใส่การแก้ของฉันกลับเข้าไป'), findsNothing);
      await tester.pump(const Duration(seconds: 1));
      expect((await repo.getRoleDetail(created.id)).version, 3, reason: 'SR-14: re-apply never sends');

      // Saving again is a new press, through R3a, on version 3.
      await pressSubmit(tester, 'บันทึก');
      await confirmInSheet(tester);
      await pumpUntil(tester, find.text('บันทึกบทบาท "$roleName (อีกคน)" แล้ว'));
      final resaved = await repo.getRoleDetail(created.id);
      expect(resaved.version, 4);
      expect(resaved.name, '$roleName (อีกคน)', reason: 'the other person\'s rename is kept');
      expect(resaved.capabilities.contains('manage_orders'), !hadOrders);
    },
  );

  testWidgets(
    'T-003-M07 · EM3-04 · AC-3.10 · an Admin edits their OWN role: lose another capability → warning, stays; '
    'lose manage_roles → warning → ข้อมูลร้าน + toast, entry gone',
    skip: !roleWritesOn,
    (tester) async {
      // Budget: owner (signup + login) + admin (signup + login) = 4 pre-auth
      // requests; the accept (no mobile screen — see E-10 removal) goes
      // through the admin's own session.
      shortPhone(tester);
      final (ownerContainer, orgId) = await ownerInFreshShop('m-r3a-owner');
      final ownerRepo = ownerContainer.read(orgScopedRepositoryProvider);
      final adminRole = (await ownerRepo.listRoleDetails()).items.firstWhere((r) => r.roleKey == 'admin');

      final adminEmail = freshEmail('m-r3a-admin');
      final issued = await ownerRepo.createInvitation(email: adminEmail, roleId: adminRole.id);
      final adminContainer = bootApp();
      await signUpAndSignIn(adminContainer, adminEmail);
      final accepted = await adminContainer.read(baseDioProvider).post<Map<String, dynamic>>(
        '/invitations/accept',
        data: {'token': Uri.parse(issued.inviteUrl).queryParameters['token']},
        options: asMe.copyWith(validateStatus: (_) => true),
      );
      expect(accepted.statusCode, 200, reason: 'accept failed: ${accepted.data}');
      adminContainer.read(sessionControllerProvider.notifier).switchOrg(
            ActiveOrg(orgId: orgId, name: 'ร้าน', capabilities: const {}),
          );
      await learnCapabilitiesWith(
        session: adminContainer.read(sessionControllerProvider.notifier),
        repository: adminContainer.read(orgScopedRepositoryProvider),
        orgId: orgId,
      );
      expect(adminContainer.read(activeOrgProvider)!.can('manage_roles'), isTrue);

      final adminRepo = adminContainer.read(orgScopedRepositoryProvider);
      final mine = await adminRepo.getRoleDetail(adminRole.id);
      expect(mine.canEdit.allowed, isTrue, reason: 'the server lets an Admin edit their own role');
      // Something to give up that is neither manage_roles nor manage_members.
      final other = mine.capabilities.firstWhere(
        (k) => k != 'manage_roles' && k != 'manage_members',
        orElse: () => fail('the Admin role has nothing else to give up: ${mine.capabilities}'),
      );
      final catalog = await adminRepo.getCapabilityCatalog();
      final otherLabel = catalog.items.firstWhere((i) => i.key == other).labelTh;

      // ── ข้อมูลร้าน → "บทบาทและสิทธิ์" → R1 → my role ──────────────────────
      await pump(tester, adminContainer, const OrgProfileScreen());
      await pumpUntil(tester, find.byKey(const ValueKey('roles-entry-row')));
      await tester.tap(find.byKey(const ValueKey('roles-entry-row')));
      await pumpUntil(tester, find.textContaining('จาก 30 บทบาท'));
      await openRoleRow(tester, adminRole.id);

      // ── lose something else → warning + "ถ้าต้องการคืน…", stays ──────────
      await tapRow(tester, other);
      await pressSubmit(tester, 'บันทึก');
      await pumpUntil(tester, confirmSheet);
      expect(inSheet('คุณจะเสียสิทธิ์เหล่านี้ทันที'), findsOneWidget);
      expect(inSheet('ถ้าต้องการคืน ให้เจ้าของร้านแก้ให้'), findsOneWidget);
      expect(inSheet(otherLabel), findsNWidgets(2), reason: 'under "เอาออก" and in the warning');
      expect(inSheet('มีผลกับสมาชิก 1 คนทันที ไม่ต้องออกจากระบบ'), findsOneWidget,
          reason: 'N = the server\'s usage.activeMembers (me)');
      expect(FocusManager.instance.primaryFocus?.debugLabel, 'role-confirm-cancel');
      await confirmInSheet(tester, label: 'บันทึก และยอมเสียสิทธิ์');
      await pumpUntil(tester, find.text('บันทึกบทบาท "ผู้ดูแล" แล้ว'));
      expect(find.byKey(const ValueKey('role-form-name')), findsOneWidget, reason: 'stays on the form');
      final afterOther = await ownerRepo.getRoleDetail(adminRole.id);
      expect(afterOther.capabilities, isNot(contains(other)));
      expect(afterOther.version, mine.version + 1, reason: 'one PATCH');

      // ── lose manage_roles → "กลับมาแก้เองไม่ได้" → ข้อมูลร้าน + toast ──────
      await pumpUntil(tester, formName);
      await tapRow(tester, 'manage_roles');
      await pressSubmit(tester, 'บันทึก');
      await pumpUntil(tester, confirmSheet);
      expect(inSheet('บันทึกแล้วคุณจะกลับมาแก้เองไม่ได้ ต้องให้เจ้าของร้านแก้คืน'), findsOneWidget);
      await confirmInSheet(tester, label: 'บันทึก และยอมเสียสิทธิ์');
      await pumpUntil(tester, find.text('บันทึกแล้ว — ตอนนี้คุณไม่มีสิทธิ์จัดการบทบาทแล้ว'));
      // Back on ข้อมูลร้าน — the root this test composed (the shell's first
      // tab in the app): the form and R1 are gone, and so is the entry once
      // the server's answer about me lands.
      Future<void> pumpUntilGone(Finder f) async {
        final deadline = DateTime.now().add(const Duration(seconds: 20));
        while (f.evaluate().isNotEmpty && DateTime.now().isBefore(deadline)) {
          await tester.pump(const Duration(milliseconds: 100));
        }
        expect(f, findsNothing);
      }

      await pumpUntilGone(find.byKey(const ValueKey('role-form-name')));
      await pumpUntilGone(find.byKey(ValueKey('role-row-${adminRole.id}')));
      expect(find.byType(OrgProfileScreen), findsOneWidget);
      await pumpUntilGone(find.byKey(const ValueKey('roles-entry-row')));
      final afterRoles = await ownerRepo.getRoleDetail(adminRole.id);
      expect(afterRoles.capabilities, isNot(contains('manage_roles')));
      expect(afterRoles.version, mine.version + 2);
    },
  );

  // ── T-003-M08 · R4 read-only + R5 delete on the real API ─────────────────
  final deleteButton = find.byKey(const ValueKey('role-delete-button'));
  final deleteDialog = find.byKey(const ValueKey('role-delete-dialog'));
  final inUseDialog = find.byKey(const ValueKey('role-delete-in-use-dialog'));
  final inUsePanel = find.byKey(const ValueKey('role-in-use-panel'));
  Finder within(Finder parent, String text) => find.descendant(of: parent, matching: find.text(text));

  Future<void> pumpUntilGone(WidgetTester tester, Finder f) async {
    final deadline = DateTime.now().add(const Duration(seconds: 20));
    while (f.evaluate().isNotEmpty && DateTime.now().isBefore(deadline)) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(f, findsNothing);
  }

  /// R1 row → R3/R4, waiting for [ready] (R4 has no name field).
  Future<void> openRow(WidgetTester tester, String roleId, Finder ready) async {
    await tester.tap(await reveal(tester, find.byKey(ValueKey('role-row-$roleId'))));
    await pumpUntil(tester, ready);
  }

  /// The AppBar ← of the top route. A pop/push transition still running
  /// shows TWO (the route leaving and the one under it), and the screen under
  /// it is already findable then — so wait for the transition to end first.
  Future<void> back(WidgetTester tester) async {
    final buttons = find.byType(BackButton);
    final deadline = DateTime.now().add(const Duration(seconds: 10));
    while (buttons.evaluate().length > 1 && DateTime.now().isBefore(deadline)) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    await tester.tap(buttons);
    await tester.pump(const Duration(milliseconds: 500));
  }

  testWidgets(
    'T-003-M08 · EM3-02/05 · R4 Owner = locked read view · R5: in use from usage → R6, '
    'a real 409 ROLE_IN_USE switches the dialog, delete → R1 without the row, 404 → toast + R1',
    skip: !roleWritesOn,
    (tester) async {
      shortPhone(tester);
      final (container, _) = await ownerInFreshShop('m-r45');
      final repo = container.read(orgScopedRepositoryProvider);
      final stamp = DateTime.now().millisecondsSinceEpoch % 1000000;

      // ── fixtures, through the app's own repository (no auth budget) ──────
      Future<RoleDetailView> role(String name) =>
          repo.createRole(name: '$name $stamp', capabilities: const ['manage_orders']);
      final withInvite = await role('มีคำเชิญ');
      final race = await role('แข่งกัน');
      final doomed = await role('ลบได้');
      final vanishing = await role('หายไปก่อน');
      final invitee = freshEmail('m-r5-invitee');
      await repo.createInvitation(email: invitee, roleId: withInvite.id);
      final owner = (await repo.listRoleDetails()).items.firstWhere((r) => r.isSystem);
      expect(owner.grantsOwnership, isTrue, reason: 'the server derives it from full_access');

      await openRolesFromMembers(tester, container);

      // ── R4 · the Owner role: locked, one card, nothing to clone or delete ─
      final readOnly = find.byKey(const ValueKey('role-readonly'));
      await openRow(tester, owner.id, readOnly);
      expect(find.text('ล็อก'), findsWidgets);
      expect(find.text('บทบาทเจ้าของร้านถูกล็อกไว้'), findsOneWidget);
      expect(await reveal(tester, find.byKey(const ValueKey('cap-read-full-access'))), findsOneWidget);
      expect(find.text('ไม่ได้ให้'), findsNothing, reason: 'a card, not a list');
      expect(formName, findsNothing);
      expect(find.byKey(const ValueKey('role-readonly-clone')), findsNothing);
      expect(deleteButton, findsNothing);
      expect(find.text('การจัดการอื่น'), findsNothing);
      await back(tester);
      await pumpUntilGone(tester, readOnly);

      // ── R5 (ข) from usage: the server says in_use → disabled + panel → R6 ─
      expect((await repo.getRoleDetail(withInvite.id)).canDelete.reason, 'in_use');
      await openRow(tester, withInvite.id, formName);
      await reveal(tester, inUsePanel);
      expect(tester.widget<OutlinedButton>(await reveal(tester, deleteButton)).onPressed, isNull);
      expect(within(inUsePanel, 'คำเชิญที่ยังไม่ปิด 1 ใบ'), findsOneWidget,
          reason: 'usage.pendingInvitations = 1 on the server');
      await tester.tap(await reveal(tester, find.byKey(const ValueKey('role-in-use-invitations'))));
      await pumpUntil(tester, find.text('คนที่ใช้บทบาท "มีคำเชิญ $stamp"'));
      await pumpUntil(tester, find.text(invitee));
      await back(tester);
      await pumpUntil(tester, formName);
      await back(tester);
      await pumpUntilGone(tester, formName); // R1 again

      // ── R5 (ข) by a real 409: someone invites between open and confirm ───
      await openRow(tester, race.id, formName);
      await tester.tap(await reveal(tester, deleteButton));
      await pumpUntil(tester, deleteDialog);
      expect(FocusManager.instance.primaryFocus?.debugLabel, 'role-delete-cancel');
      await repo.createInvitation(email: freshEmail('m-r5-race'), roleId: race.id);
      await tester.tap(find.byKey(const ValueKey('role-delete-confirm')));
      await pumpUntil(tester, inUseDialog);
      expect(within(inUseDialog, 'คำเชิญที่ยังไม่ปิด 1 ใบ'), findsOneWidget, reason: 'numbers from details');
      final stillThere = await repo.getRoleDetail(race.id);
      expect(stillThere.canDelete.reason, 'in_use', reason: 'the 409 left the role alone');
      await tester.tap(find.byKey(const ValueKey('role-delete-close')));
      await pumpUntilGone(tester, inUseDialog);
      // Re-read: the page now shows the panel under a disabled button.
      await pumpUntil(tester, formName);
      expect(within(await reveal(tester, inUsePanel), 'คำเชิญที่ยังไม่ปิด 1 ใบ'), findsOneWidget);
      await back(tester);
      await pumpUntilGone(tester, formName);

      // ── R5 (ก) success: one DELETE → toast → R1 without the row ──────────
      await openRow(tester, doomed.id, formName);
      await tester.tap(await reveal(tester, deleteButton));
      await pumpUntil(tester, deleteDialog);
      expect(within(deleteDialog, 'ลบบทบาท "ลบได้ $stamp"?'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('role-delete-confirm')));
      await pumpUntil(tester, find.text('ลบบทบาท "ลบได้ $stamp" แล้ว'));
      await pumpUntilGone(tester, formName);
      expect(find.byType(RolesScreen), findsOneWidget);
      await pumpUntilGone(tester, find.byKey(ValueKey('role-row-${doomed.id}'), skipOffstage: false));
      Object? gone;
      try {
        await repo.getRoleDetail(doomed.id);
      } catch (e) {
        gone = e;
      }
      expect(gone, isA<NotFoundFailure>(), reason: 'the server, not the screen, says it is gone');
      expect((await repo.listRoleDetails()).items.map((r) => r.id), isNot(contains(doomed.id)));

      // ── 404: deleted elsewhere while open → toast + R1 ───────────────────
      // The success toast floats over the bottom of a short screen for 4 s —
      // right where "ลบบทบาทนี้" lands once scrolled to. Wait it out first.
      await pumpUntilGone(tester, find.text('ลบบทบาท "ลบได้ $stamp" แล้ว'));
      await openRow(tester, vanishing.id, formName);
      await tester.tap(await reveal(tester, deleteButton));
      await pumpUntil(tester, deleteDialog);
      await repo.deleteRole(vanishing.id); // "another tab"
      await tester.tap(find.byKey(const ValueKey('role-delete-confirm')));
      await pumpUntil(tester, find.text('บทบาทนี้ถูกลบไปแล้ว'));
      await pumpUntilGone(tester, formName);
      await pumpUntilGone(tester, find.byKey(ValueKey('role-row-${vanishing.id}'), skipOffstage: false));
      // The roles that were never deleted are all still there.
      final left = (await repo.listRoleDetails()).items.map((r) => r.id).toSet();
      expect(left, containsAll([withInvite.id, race.id, owner.id]));
    },
  );

  testWidgets(
    'T-003-M06 · EM3-03 · writes off: R1 banner, create disabled, a row opens the read-only reason',
    skip: roleWritesOn,
    (tester) async {
      final (container, _) = await ownerInFreshShop('m-r3-off');
      await openRolesFromMembers(tester, container);

      expect(find.text('ยังสร้างหรือแก้บทบาทไม่ได้ในตอนนี้'), findsOneWidget);
      final create = find.widgetWithText(ElevatedButton, 'สร้างบทบาท');
      expect(tester.widget<ElevatedButton>(create).onPressed, isNull);

      final page = await container.read(orgScopedRepositoryProvider).listRoleDetails();
      final staff = page.items.firstWhere((r) => r.roleKey == 'staff');
      expect(staff.canEdit.reason, 'writes_disabled', reason: 'the server says why, not the client');

      await tester.tap(find.byKey(ValueKey('role-row-${staff.id}')));
      await pumpUntil(tester, find.text('ยังสร้างหรือแก้บทบาทไม่ได้ในตอนนี้'));
      expect(find.byKey(const ValueKey('role-form-name')), findsNothing);
      expect(find.widgetWithText(ElevatedButton, 'บันทึก'), findsNothing);
    },
  );
}
