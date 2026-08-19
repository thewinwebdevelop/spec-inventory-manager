// ★ The capability set the app enters a shop with.
//
// FOUND BY THE M-07 SECURITY REVIEW, as a side effect of a different finding:
// `/me/organizations` deliberately publishes no capabilities (§3.5), so the
// picker and the switcher had nothing to pass to `enterOrganization` — and
// every screen that gates on capabilities saw an EMPTY set. A real Owner
// arriving from the picker was offered no Owner role on the invite screen, no
// tax details, no rename. It failed closed, which is exactly why nobody
// noticed: nothing broke, things were merely missing.
//
// So entering a shop now asks the server. These cases pin the two halves that
// matter: it is asked for, and a late answer for a shop the user has left is
// ignored.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/session/session_controller.dart';
import 'package:mobile/core/session/session_state.dart';
import 'package:mobile/features/org/application/org_providers.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/features/org/domain/entities/org_entities.dart';

import '../org_fakes.dart';

const _ownerProfile = OrgProfileView(
  id: 'org_1',
  name: 'ร้านหอมกรุ่นเบเกอรี่',
  taxProfileComplete: false,
  capabilities: {'full_access'},
);

/// `enterOrganization` takes a `WidgetRef`, so these run through a widget.
Future<WidgetRef> _refIn(WidgetTester tester, ProviderContainer container) async {
  late WidgetRef captured;
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: Consumer(
        builder: (context, ref, _) {
          captured = ref;
          return const SizedBox.shrink();
        },
      ),
    ),
  );
  return captured;
}

void main() {
  ProviderContainer signedIn(FakeOrgScoped scoped) {
    final container = ProviderContainer(
      overrides: [orgScopedRepositoryProvider.overrideWithValue(scoped)],
    );
    addTearDown(container.dispose);
    container.read(sessionControllerProvider.notifier).signedIn(orgs: const []);
    return container;
  }

  const shop = MyOrganization(
    id: 'org_1',
    name: 'ร้านหอมกรุ่นเบเกอรี่',
    roleName: 'เจ้าของร้าน',
    roleKey: 'owner',
  );

  testWidgets('★ entering from the picker learns what this member may do', (tester) async {
    final scoped = FakeOrgScoped(profile: _ownerProfile);
    final container = signedIn(scoped);
    final ref = await _refIn(tester, container);

    enterOrganization(ref, shop);
    // The switch is immediate; the answer arrives after a round trip.
    expect(container.read(activeOrgIdProvider), 'org_1');
    await tester.pumpAndSettle();

    expect(
      container.read(activeOrgProvider)?.capabilities,
      contains('full_access'),
      reason: 'an Owner from the picker was treated as having no rights',
    );
    expect(scoped.profileCalls, 1);
  });

  testWidgets('creating a shop does NOT re-ask — the 201 already said', (tester) async {
    // `POST /organizations` answers with the capabilities, so spending a second
    // request would be asking a question already answered (ux Q5).
    final scoped = FakeOrgScoped(profile: _ownerProfile);
    final container = signedIn(scoped);
    final ref = await _refIn(tester, container);

    enterOrganization(ref, shop, capabilities: const {'full_access'});
    await tester.pumpAndSettle();

    expect(container.read(activeOrgProvider)?.capabilities, contains('full_access'));
    expect(scoped.profileCalls, 0);
  });

  testWidgets('★ a late answer for a shop the user has LEFT is ignored', (tester) async {
    // Otherwise shop A's capabilities land inside shop B — the same shape as
    // the review's cross-shop finding about the revealed tax id.
    final scoped = FakeOrgScoped(
      profile: _ownerProfile,
      delay: const Duration(milliseconds: 40),
    );
    final container = signedIn(scoped);
    final ref = await _refIn(tester, container);

    enterOrganization(ref, shop);
    // …and immediately move to another shop, which has its own (empty) set.
    container.read(sessionControllerProvider.notifier).switchOrg(
          const ActiveOrg(orgId: 'org_2', name: 'ร้านที่สอง', capabilities: {}),
        );
    await tester.pumpAndSettle(const Duration(milliseconds: 100));

    expect(container.read(activeOrgIdProvider), 'org_2');
    expect(
      container.read(activeOrgProvider)?.capabilities,
      isEmpty,
      reason: "shop A's capabilities were granted inside shop B",
    );
  });

  testWidgets('★★ the answer still lands after the screen that asked is GONE', (tester) async {
    // The case the first version of this fix would have failed, silently.
    //
    // Entering a shop is precisely what replaces the picker, and the switcher
    // closes itself — so the widget whose `ref` started the request is nearly
    // always disposed before the response arrives. A `WidgetRef` touched after
    // that throws, the throw lands in `learnCapabilities`'s catch, and the app
    // is back to an empty capability set with nothing in the log to say so.
    final scoped = FakeOrgScoped(
      profile: _ownerProfile,
      delay: const Duration(milliseconds: 40),
    );
    final container = signedIn(scoped);
    final ref = await _refIn(tester, container);

    enterOrganization(ref, shop);
    // The picker goes away, exactly as navigating into the shop would do.
    await tester.pumpWidget(
      UncontrolledProviderScope(container: container, child: const SizedBox.shrink()),
    );
    await tester.pumpAndSettle(const Duration(milliseconds: 100));

    expect(
      container.read(activeOrgProvider)?.capabilities,
      contains('full_access'),
      reason: 'the answer was dropped because the screen that asked had closed',
    );
  });

  testWidgets('a failure to learn leaves the UI offering LESS, never more', (tester) async {
    final container = signedIn(FakeOrgScoped(profileFailure: const NetworkFailure()));
    final ref = await _refIn(tester, container);

    enterOrganization(ref, shop);
    await tester.pumpAndSettle();

    expect(container.read(activeOrgProvider)?.capabilities, isEmpty);
    // …and the server refuses whatever the screens would have offered anyway.
  });
}
