// T-002-M3 — S2's controller (D-014: application = ProviderContainer + overrides).
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/core/session/session_controller.dart';
import 'package:mobile/core/session/session_state.dart';
import 'package:mobile/features/org/application/create_org_controller.dart';
import 'package:mobile/features/org/application/create_org_error.dart';
import 'package:mobile/features/org/application/org_providers.dart';
import 'package:mobile/features/org/domain/entities/org_entities.dart';

import '../org_fakes.dart';

ProviderContainer _container(FakeOrgDirectory directory, {bool signedIn = true}) {
  final container = ProviderContainer(
    overrides: [orgDirectoryProvider.overrideWithValue(directory)],
  );
  addTearDown(container.dispose);
  if (signedIn) {
    container.read(sessionControllerProvider.notifier).signedIn(orgs: const []);
  }
  // Subscribes the way the screen does. The controller is `autoDispose`, so
  // an unwatched `read` is torn down again immediately — which is the right
  // behaviour (a popped form leaves no stale banner behind) and the reason a
  // test must hold it the way a mounted widget would.
  final sub = container.listen(createOrgControllerProvider, (_, __) {});
  addTearDown(sub.close);
  return container;
}

void main() {
  test('★ the new shop is ACTIVE before submit returns', () {
    // ux-wireframe §3: success goes straight into the new shop. If the
    // session were written after navigating, the first org-scoped screen
    // would build with no active shop and `orgDioProvider` throws on exactly
    // that.
    final directory = FakeOrgDirectory();
    final container = _container(directory);

    return container
        .read(createOrgControllerProvider.notifier)
        .submit('ร้านหอมกรุ่นเบเกอรี่')
        .then((created) {
      expect(created!.id, 'org_new');
      expect(container.read(activeOrgIdProvider), 'org_new');
      expect(container.read(activeOrgProvider)?.name, 'ร้านหอมกรุ่นเบเกอรี่');
      // The creator is the Owner, and this is the one moment the client
      // learns capabilities without a second request (ux Q5).
      expect(container.read(activeOrgProvider)?.capabilities, contains('full_access'));
    });
  });

  test('★ the shop list is invalidated so the switcher cannot miss the new shop', () async {
    final directory = FakeOrgDirectory(
      orgs: const [MyOrganization(id: 'org_1', name: 'เดิม', roleName: 'Owner', roleKey: 'owner')],
    );
    final container = _container(directory);

    await container.read(myOrganizationsProvider.future);
    await container.read(createOrgControllerProvider.notifier).submit('ใหม่');

    // Invalidated, not mutated: the list's contents are the server's.
    expect(container.read(myOrganizationsProvider), isA<AsyncLoading<List<MyOrganization>>>());
  });

  test('the name is trimmed before it is sent', () async {
    final directory = FakeOrgDirectory();
    final container = _container(directory);

    await container.read(createOrgControllerProvider.notifier).submit('  ร้านหนึ่ง  ');
    expect(directory.namesSeen.single, 'ร้านหนึ่ง');
  });

  test('★ an empty or over-long name never leaves the device', () async {
    final directory = FakeOrgDirectory();
    final container = _container(directory);
    final controller = container.read(createOrgControllerProvider.notifier);

    expect(await controller.submit('   '), isNull);
    expect(await controller.submit('ก' * (orgNameMaxLength + 1)), isNull);

    expect(directory.createCalls, 0, reason: 'a round trip to be told the field is empty');
    expect(container.read(createOrgControllerProvider).error, isA<CreateOrgFieldError>());
  });

  test('★ a second submit while one is in flight is ignored — there is no Idempotency-Key', () async {
    // Two taps would be two shops (ux-wireframe §3).
    final directory = FakeOrgDirectory(delay: const Duration(milliseconds: 30));
    final container = _container(directory);
    final controller = container.read(createOrgControllerProvider.notifier);

    final first = controller.submit('ร้านหนึ่ง');
    final second = controller.submit('ร้านหนึ่ง');

    expect(await second, isNull);
    expect(await first, isNotNull);
    expect(directory.createCalls, 1);
  });

  test('a failure maps through the table and leaves no active shop', () async {
    final container = _container(FakeOrgDirectory(
      createFailure: const ConflictFailure(code: 'ORG_LIMIT_REACHED', details: {'limit': 2}),
    ));

    expect(await container.read(createOrgControllerProvider.notifier).submit('ร้านหนึ่ง'), isNull);

    final error = container.read(createOrgControllerProvider).error as CreateOrgBannerError;
    expect(error.banner, CreateOrgBanner.limitReached);
    expect(error.limit, 2);
    expect(container.read(activeOrgIdProvider), isNull);
    expect(container.read(createOrgControllerProvider).submitting, isFalse);
  });

  test('clearError keeps the form usable', () async {
    final container = _container(FakeOrgDirectory(createFailure: const NetworkFailure()));
    final controller = container.read(createOrgControllerProvider.notifier);

    await controller.submit('ร้านหนึ่ง');
    expect(container.read(createOrgControllerProvider).error, isNotNull);

    controller.clearError();
    expect(container.read(createOrgControllerProvider).error, isNull);
  });

  test('a shop created while signed out changes no session', () async {
    // `switchOrg` only applies to an authed session — a guard, not a silent
    // no-op the caller has to know about.
    final container = _container(FakeOrgDirectory(), signedIn: false);

    expect(await container.read(createOrgControllerProvider.notifier).submit('ร้านหนึ่ง'),
        isNotNull);
    expect(container.read(sessionControllerProvider), isA<SessionUnknown>());
  });
}
