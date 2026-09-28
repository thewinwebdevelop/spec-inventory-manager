// T-003-M01 ★ — `manage_roles` + the gate every F-003 entry point and screen
// reads (docs/architecture/mobile.md §3.3 · ux-wireframe R1 "ทางเข้า (mobile)").
//
// UX gating only: the server enforces regardless (api-spec: every roles route
// is gated `manage_roles`). What these tests pin is that the client reads the
// answer from the capabilities the server sent — through `can()`, so the
// `full_access` wildcard holds — and never invents one.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/session/capability_gate.dart';
import 'package:mobile/core/session/session_controller.dart';
import 'package:mobile/core/session/session_state.dart';

ActiveOrg _org(Set<String> caps, {String id = 'org_1'}) =>
    ActiveOrg(orgId: id, name: 'ร้านทดสอบ', capabilities: caps);

ProviderContainer _container({ActiveOrg? active, bool signedIn = true}) {
  final c = ProviderContainer();
  addTearDown(c.dispose);
  if (signedIn) {
    c.read(sessionControllerProvider.notifier).signedIn(orgs: const [], active: active);
  }
  return c;
}

void main() {
  test('the const is the name the server gates on — not a client paraphrase', () {
    // api-spec §route table: `GET /orgs/{orgId}/role-details` … gate `manage_roles`.
    expect(manageRolesCapability, 'manage_roles');
  });

  group('canProvider', () {
    test('★ an Owner (full_access only) may manage roles — the wildcard holds', () {
      final c = _container(active: _org({fullAccessCapability}));
      expect(c.read(canProvider(manageRolesCapability)), isTrue);
    });

    test('a holder of only manage_roles may (ux R1: no members tab, still an entry)', () {
      final c = _container(active: _org({manageRolesCapability}));
      expect(c.read(canProvider(manageRolesCapability)), isTrue);
      expect(c.read(canProvider(manageMembersCapability)), isFalse);
    });

    test('manage_members does NOT imply manage_roles', () {
      final c = _container(active: _org({manageMembersCapability, manageOrgSettingsCapability}));
      expect(c.read(canProvider(manageRolesCapability)), isFalse);
    });

    test('fails closed with no answer from the server', () {
      // Cold start (unknown), signed out, and signed in without a shop are all
      // "nobody told us" — the only safe reading is no.
      final unknown = ProviderContainer();
      addTearDown(unknown.dispose);
      expect(unknown.read(canProvider(manageRolesCapability)), isFalse);

      final none = _container(signedIn: false)
        ..read(sessionControllerProvider.notifier).signedOut();
      expect(none.read(canProvider(manageRolesCapability)), isFalse);

      expect(_container().read(canProvider(manageRolesCapability)), isFalse);
      expect(_container(active: _org(const {})).read(canProvider(manageRolesCapability)), isFalse);
    });

    test('★ follows the server: a refreshed capability set revokes on the spot', () async {
      final c = _container(active: _org({manageRolesCapability}));
      final seen = <bool>[];
      c.listen<bool>(canProvider(manageRolesCapability), (_, next) => seen.add(next),
          fireImmediately: true);

      c.read(sessionControllerProvider.notifier)
          .capabilitiesLearned(orgId: 'org_1', capabilities: {'view_products'});
      // Riverpod 2 re-evaluates dependents lazily; let it flush before asking
      // what listeners saw.
      await Future<void>.delayed(Duration.zero);

      expect(seen, [true, false]);
      expect(c.read(canProvider(manageRolesCapability)), isFalse);
    });

    test('switching shops re-answers for the new shop', () {
      final c = _container(active: _org({manageRolesCapability}));
      c.read(sessionControllerProvider.notifier).switchOrg(_org(const {}, id: 'org_2'));
      expect(c.read(canProvider(manageRolesCapability)), isFalse);
    });
  });

  group('CapabilityGate (entry points)', () {
    Future<ProviderContainer> pump(WidgetTester tester, ActiveOrg org) async {
      final c = _container(active: org);
      await tester.pumpWidget(UncontrolledProviderScope(
        container: c,
        child: const MaterialApp(
          home: Scaffold(
            body: CapabilityGate(
              capability: manageRolesCapability,
              child: Text('บทบาทและสิทธิ์'),
            ),
          ),
        ),
      ));
      return c;
    }

    testWidgets('★ shows the entry for an Owner', (tester) async {
      await pump(tester, _org({fullAccessCapability}));
      expect(find.text('บทบาทและสิทธิ์'), findsOneWidget);
    });

    testWidgets('hides the entry without the capability', (tester) async {
      await pump(tester, _org({manageMembersCapability}));
      expect(find.text('บทบาทและสิทธิ์'), findsNothing);
    });

    testWidgets('★ the entry disappears when the server takes the capability away',
        (tester) async {
      final c = await pump(tester, _org({manageRolesCapability}));
      expect(find.text('บทบาทและสิทธิ์'), findsOneWidget);

      c.read(sessionControllerProvider.notifier)
          .capabilitiesLearned(orgId: 'org_1', capabilities: const {});
      await tester.pump();

      expect(find.text('บทบาทและสิทธิ์'), findsNothing);
    });

    testWidgets('renders the fallback instead, when one is given', (tester) async {
      final c = _container(active: _org(const {}));
      await tester.pumpWidget(UncontrolledProviderScope(
        container: c,
        child: const MaterialApp(
          home: CapabilityGate(
            capability: manageRolesCapability,
            fallback: Text('fallback'),
            child: Text('entry'),
          ),
        ),
      ));
      expect(find.text('entry'), findsNothing);
      expect(find.text('fallback'), findsOneWidget);
    });
  });

  group('CapabilityScreenGuard (screens)', () {
    late int denied;

    Future<ProviderContainer> pump(WidgetTester tester, ActiveOrg org) async {
      denied = 0;
      final c = _container(active: org);
      await tester.pumpWidget(UncontrolledProviderScope(
        container: c,
        child: MaterialApp(
          home: CapabilityScreenGuard(
            capability: manageRolesCapability,
            onDenied: () => denied++,
            child: const Text('R1 screen'),
          ),
        ),
      ));
      await tester.pump();
      return c;
    }

    testWidgets('renders the screen and stays quiet while the capability holds',
        (tester) async {
      await pump(tester, _org({fullAccessCapability}));
      expect(find.text('R1 screen'), findsOneWidget);
      expect(denied, 0);
    });

    testWidgets('★ opened without the capability: nothing rendered, onDenied once',
        (tester) async {
      await pump(tester, _org({manageMembersCapability}));
      expect(find.text('R1 screen'), findsNothing);
      expect(denied, 1);
    });

    testWidgets('★ capability lost while on screen: content goes, onDenied exactly once',
        (tester) async {
      final c = await pump(tester, _org({manageRolesCapability}));
      expect(denied, 0);

      c.read(sessionControllerProvider.notifier)
          .capabilitiesLearned(orgId: 'org_1', capabilities: {'view_products'});
      await tester.pump();
      await tester.pump();

      expect(find.text('R1 screen'), findsNothing);
      expect(denied, 1);

      // Further rebuilds while still denied must not fire again (a double
      // `pop` would close the screen underneath too).
      c.read(sessionControllerProvider.notifier)
          .capabilitiesLearned(orgId: 'org_1', capabilities: const {});
      await tester.pump();
      await tester.pump();
      expect(denied, 1);
    });

    testWidgets('switching to a shop without the capability denies', (tester) async {
      final c = await pump(tester, _org({manageRolesCapability}));
      c.read(sessionControllerProvider.notifier).switchOrg(_org(const {}, id: 'org_2'));
      await tester.pump();
      await tester.pump();
      expect(find.text('R1 screen'), findsNothing);
      expect(denied, 1);
    });
  });
}
