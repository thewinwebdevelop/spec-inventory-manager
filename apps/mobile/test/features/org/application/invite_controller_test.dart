// T-002-M3 — S7's submit.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/core/session/session_controller.dart';
import 'package:mobile/core/session/session_state.dart';
import 'package:mobile/features/org/application/invite_controller.dart';
import 'package:mobile/features/org/application/invite_error.dart';
import 'package:mobile/features/org/application/org_providers.dart';
import 'package:mobile/features/org/application/paged_controllers.dart';
import 'package:mobile/features/org/domain/entities/org_entities.dart';
import 'package:mobile/features/org/domain/repositories/org_repository.dart';

import '../org_fakes.dart';

ProviderContainer _container(FakeOrgScoped scoped) {
  final container = ProviderContainer(
    overrides: [orgScopedRepositoryProvider.overrideWithValue(scoped)],
  );
  addTearDown(container.dispose);
  container.read(sessionControllerProvider.notifier).signedIn(
        orgs: const [],
        active: const ActiveOrg(orgId: 'org_1', name: 'ร้านหนึ่ง', capabilities: {'full_access'}),
      );
  // Held the way the screen holds it: `autoDispose` tears an unwatched
  // controller down immediately, which is what keeps a stale error off a
  // re-opened form.
  final sub = container.listen(inviteControllerProvider, (_, __) {});
  addTearDown(sub.close);
  return container;
}

void main() {
  test('★ the one-time link is RETURNED, never parked in the controller', () async {
    // The server keeps only the token's hash (D-018). A controller holding
    // the raw link would make it recoverable after the panel closed, undoing
    // the property D-018 exists to create.
    final container = _container(FakeOrgScoped());

    final issued = await container
        .read(inviteControllerProvider.notifier)
        .submit(rawEmail: 'malee@shop.com', roleId: 'rol_staff');

    expect(issued!.inviteUrl, contains('token'));
    expect(container.read(inviteControllerProvider).error, isNull);
    expect(container.read(inviteControllerProvider).submitting, isFalse);
  });

  test('★ expiresAt comes from the response, not from a constant', () async {
    // The TTL depends on the invited role (D-028/I-7) and restarts on every
    // reissue (D-027) — a client-computed deadline is wrong on both counts.
    final container = _container(FakeOrgScoped(
      issued: IssuedInvite(
        inviteUrl: 'https://x/invite?token=t',
        email: 'malee@shop.com',
        expiresAt: DateTime.utc(2026, 8, 10, 3),
      ),
    ));

    final issued = await container
        .read(inviteControllerProvider.notifier)
        .submit(rawEmail: 'malee@shop.com', roleId: 'rol_admin');

    expect(issued!.expiresAt, DateTime.utc(2026, 8, 10, 3));
  });

  test('★ the pending list is invalidated, not appended to locally', () async {
    // `status` and `expiresAt` are the server's to decide — `expired` is
    // computed at read time — so a locally built row would be a guess at
    // both.
    final container = _container(FakeOrgScoped(invitationPages: [
      const PagedResult(items: []),
    ]));
    container.listen(invitationsControllerProvider('pending'), (_, __) {});
    await Future<void>.delayed(Duration.zero);

    await container
        .read(inviteControllerProvider.notifier)
        .submit(rawEmail: 'malee@shop.com', roleId: 'rol_staff');

    expect(container.read(invitationsControllerProvider('pending')).loading, isTrue);
  });

  test('an empty email never leaves the device', () async {
    final scoped = FakeOrgScoped();
    final container = _container(scoped);

    expect(
      await container
          .read(inviteControllerProvider.notifier)
          .submit(rawEmail: '  ', roleId: 'rol_staff'),
      isNull,
    );
    expect(container.read(inviteControllerProvider).error, isA<InviteFieldError>());
  });

  test('a missing role is refused — the role is mandatory (AC US-3)', () async {
    final container = _container(FakeOrgScoped());

    expect(
      await container
          .read(inviteControllerProvider.notifier)
          .submit(rawEmail: 'malee@shop.com', roleId: null),
      isNull,
    );
    expect(container.read(inviteControllerProvider).error, isA<InviteRoleUnavailable>());
  });

  test('★ ROLE_INVALID re-fetches the role list', () async {
    // Leaving a deleted role selected would let the person submit the same
    // dead choice again.
    final container = _container(FakeOrgScoped(
      roles: threeRoles,
      createInvitationFailure: const ValidationFailure(code: 'ROLE_INVALID'),
    ));
    await container.read(rolesProvider.future);

    await container
        .read(inviteControllerProvider.notifier)
        .submit(rawEmail: 'malee@shop.com', roleId: 'rol_gone');

    expect(container.read(inviteControllerProvider).error, isA<InviteRoleUnavailable>());
    expect(container.read(rolesProvider), isA<AsyncLoading<List<RoleRow>>>());
  });

  test('a second submit while one is in flight is ignored', () async {
    final container = _container(FakeOrgScoped(delay: const Duration(milliseconds: 30)));
    final controller = container.read(inviteControllerProvider.notifier);

    final first = controller.submit(rawEmail: 'malee@shop.com', roleId: 'rol_staff');
    final second = controller.submit(rawEmail: 'malee@shop.com', roleId: 'rol_staff');

    expect(await second, isNull);
    expect(await first, isNotNull);
  });

  test('INVITATION_PENDING surfaces the panel, and clearError leaves it', () async {
    final container = _container(FakeOrgScoped(
      createInvitationFailure: const ConflictFailure(
        code: 'INVITATION_PENDING',
        details: {'invitationId': 'inv_1', 'roleName': 'ผู้ดูแล'},
      ),
    ));
    final controller = container.read(inviteControllerProvider.notifier);

    await controller.submit(rawEmail: 'malee@shop.com', roleId: 'rol_staff');
    expect(container.read(inviteControllerProvider).error, isA<InvitePending>());

    controller.clearError();
    expect(container.read(inviteControllerProvider).error, isNull);
  });
}
