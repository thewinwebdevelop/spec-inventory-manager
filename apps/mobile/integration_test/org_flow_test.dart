import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/app/bootstrap.dart';
import 'package:mobile/core/l10n/l10n.dart';
import 'package:mobile/core/session/session_controller.dart';
import 'package:mobile/core/session/session_state.dart';
import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/org/application/org_providers.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/features/org/domain/entities/org_entities.dart';
import 'package:mobile/features/org/presentation/screens/create_org_screen.dart';
import 'package:mobile/features/org/presentation/screens/members_screen.dart';

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
    await tester.pumpAndSettle();
  }

  /// Signs a brand-new account in through the real auth repository, and puts
  /// the session where the router would have.
  Future<void> signUpAndSignIn(ProviderContainer container, String email) async {
    final auth = container.read(authRepositoryProvider);
    await auth.signup(email: email, password: password);
    await auth.login(email: email, password: password);
    container.read(sessionControllerProvider.notifier).signedIn(orgs: const []);
  }

  testWidgets('E-10 · creates a shop on a real API and lands inside it', (tester) async {
    final container = bootApp();
    await signUpAndSignIn(container, freshEmail('m-e10'));

    CreatedOrganization? created;
    await pump(tester, container, CreateOrgScreen(onCreated: (org) => created = org));

    final name = 'ร้านมือถือ ${DateTime.now().millisecondsSinceEpoch}';
    await tester.enterText(find.byType(TextField), name);
    await tester.pumpAndSettle();
    await tester.tap(find.text('สร้างร้าน'));
    // Real network: pump until the response lands rather than settling once.
    await tester.pumpAndSettle(const Duration(seconds: 10));

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
    await tester.pumpAndSettle(const Duration(seconds: 10));

    // The creator is a member, and an Owner. Their capability list is
    // `full_access` alone — the case that broke web's whole nav.
    expect(find.textContaining('สมาชิกในร้าน'), findsWidgets);
    expect(find.textContaining('@omnistock.test'), findsWidgets);
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

    final staffToken = await apiLogin(staffEmail);
    final accepted = await api.post<Map<String, dynamic>>(
      '/invitations/accept',
      data: {'token': Uri.parse(issued.inviteUrl).queryParameters['token']},
      options: Options(headers: {'Authorization': 'Bearer $staffToken'}),
    );
    expect(accepted.statusCode, 200, reason: 'accept failed: ${accepted.data}');

    staffContainer.read(sessionControllerProvider.notifier).switchOrg(
          ActiveOrg(orgId: org.id, name: org.name, capabilities: const {}),
        );
    // They are really in: an org-scoped read succeeds before the removal, so
    // the refusal below cannot be mistaken for "this never worked".
    final before = await staffContainer.read(orgScopedRepositoryProvider).listMembers();
    expect(before.items, isNotEmpty);

    // ── the removal, from another session ─────────────────────────────────
    final ownerToken = await apiLogin(ownerEmail);
    final headers = {
      'Authorization': 'Bearer $ownerToken',
      'X-Organization-Id': org.id,
    };
    final target = before.items.firstWhere((m) => m.email == staffEmail);
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
      await staffContainer.read(orgScopedRepositoryProvider).listMembers();
    } catch (e) {
      failure = e;
    }
    expect(failure, isNotNull, reason: 'a removed member could still read the member list');
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
}
