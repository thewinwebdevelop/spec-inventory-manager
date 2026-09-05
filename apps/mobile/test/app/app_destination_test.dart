import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/app.dart';
import 'package:mobile/app/shop_shell.dart';
import 'package:mobile/core/api/refresh_coordinator.dart' show RefreshOutcome;
import 'package:mobile/core/session/session_controller.dart';
import 'package:mobile/core/session/session_state.dart';
import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/auth/domain/repositories/auth_repository.dart';
import 'package:mobile/features/org/application/org_providers.dart';
import 'package:mobile/features/org/domain/entities/org_entities.dart';
import 'package:mobile/features/org/presentation/screens/org_picker_screen.dart';

import '../features/org/org_fakes.dart';

/// ★ B-18 — where the app sends a signed-in person, and what it writes down.
///
/// The old `app.dart` kept a private three-value enum (bootstrap → authFlow →
/// `SecurityScreen`) and never touched the session controller. Two facts
/// followed, and BOTH were invisible to every existing test because each layer
/// was internally consistent:
///
///   · `signedIn()` had no caller anywhere in `lib/`. `SessionController`
///     starts at `SessionUnknown` and stayed there for the life of the
///     process — so `switchOrg` (which returns early unless the state is
///     already `SessionAuthed`) would have written NOTHING when somebody
///     tapped a shop, and `learnCapabilities` swallows its errors by design.
///     A dead row, silently.
///   · Every F-002 screen was unreachable: the picker, the create-shop form,
///     the members list and the shop profile had no caller either.
///
/// `session_controller_test.dart` proves the controller behaves. This file
/// proves the app USES it — which is the half that was missing.
class _RestoringAuth implements AuthRepository {
  @override
  Future<bool> hasStoredSession() async => true;

  @override
  Future<RefreshOutcome> silentRefreshDetailed() async => RefreshOutcome.success;

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError('${invocation.memberName} is not part of this test');
}

Future<ProviderContainer> pumpApp(WidgetTester tester) async {
  final container = ProviderContainer(
    overrides: [
      authRepositoryProvider.overrideWithValue(_RestoringAuth()),
      orgScopedRepositoryProvider.overrideWithValue(
        FakeOrgScoped(memberPages: [PagedResult(items: [member(id: 'usr_1', isMe: true)])]),
      ),
      orgDirectoryProvider.overrideWithValue(FakeOrgDirectory()),
    ],
  );
  addTearDown(container.dispose);

  await tester.pumpWidget(
    UncontrolledProviderScope(container: container, child: const OmniStockApp()),
  );
  await tester.pumpAndSettle();
  return container;
}

void main() {
  testWidgets('★ restoring a session WRITES it — `signedIn()` had no caller at all',
      (tester) async {
    final container = await pumpApp(tester);

    // The assertion is about the controller, not the screen. Before this, the
    // app could show authenticated pages while the one piece of state every
    // guard and every org-scoped provider reads still said `SessionUnknown`.
    expect(container.read(sessionControllerProvider), isA<SessionAuthed>());
  });

  testWidgets('★ signed in with no shop chosen is the PICKER, not the login screen',
      (tester) async {
    // `SessionAuthed(active: null)` is a state, not an error — the model draws
    // that distinction in its own doc comment, and until now nothing read it.
    await pumpApp(tester);

    expect(find.byType(OrgPickerScreen), findsOneWidget);
  });

  testWidgets('★ entering a shop actually moves the app — `switchOrg` was a no-op before',
      (tester) async {
    // The reason this could not work: `switchOrg` returns early unless the
    // state is already `SessionAuthed`, and nothing ever put it there. Tapping
    // a shop in the picker wrote nothing and looked like a dead row.
    final container = await pumpApp(tester);

    container.read(sessionControllerProvider.notifier).switchOrg(
          const ActiveOrg(orgId: 'org_1', name: 'ร้านหอมกรุ่นเบเกอรี่', capabilities: {}),
        );
    await tester.pumpAndSettle();

    expect(find.byType(ShopShell), findsOneWidget);
    expect(find.byType(OrgPickerScreen), findsNothing);
  });

  testWidgets('signing out goes back to login and clears the session', (tester) async {
    final container = await pumpApp(tester);

    container.read(sessionControllerProvider.notifier).signedOut();
    await tester.pumpAndSettle();

    expect(container.read(sessionControllerProvider), isA<SessionNone>());
    // The login screen's own heading — the app is out of the authenticated
    // half entirely, not merely showing an empty shop.
    expect(find.byType(OrgPickerScreen), findsNothing);
    expect(find.byType(ShopShell), findsNothing);
  });
}
