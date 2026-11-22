// T-003-M06 — R3's submit (POST / PATCH /roles), the re-reads that follow it,
// and CM3-05: a 409 ROLE_CHANGED is never resubmitted.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/core/session/session_controller.dart';
import 'package:mobile/core/session/session_state.dart';
import 'package:mobile/features/org/application/org_providers.dart';
import 'package:mobile/features/org/application/role_delete_error.dart';
import 'package:mobile/features/org/application/role_write_controller.dart';
import 'package:mobile/features/org/application/role_write_error.dart';
import 'package:mobile/features/org/domain/entities/org_entities.dart';
import 'package:mobile/features/org/domain/entities/role_entities.dart';

import '../org_fakes.dart';

const _ok = RoleVerdict(allowed: true);

RoleDetailView _role(String id, {int version = 1, List<String> caps = const ['manage_products']}) =>
    RoleDetailView(
      id: id,
      name: 'แพ็คของ',
      roleKey: null,
      nameCustomized: true,
      isSystem: false,
      grantsOwnership: false,
      capabilities: caps,
      usage: const RoleUsage(activeMembers: 0, pendingInvitations: 0),
      lastEdited: null,
      canEdit: _ok,
      canDelete: _ok,
      canClone: _ok,
      version: version,
    );

ProviderContainer _container(FakeOrgScoped scoped) {
  final container = ProviderContainer(
    overrides: [orgScopedRepositoryProvider.overrideWithValue(scoped)],
  );
  addTearDown(container.dispose);
  container.read(sessionControllerProvider.notifier).signedIn(
        orgs: const [],
        active: const ActiveOrg(orgId: 'org_1', name: 'ร้าน', capabilities: {'manage_roles'}),
      );
  final sub = container.listen(roleWriteControllerProvider, (_, __) {});
  addTearDown(sub.close);
  return container;
}

void main() {
  test('create: POSTs once, returns the saved role, re-reads R1 and my capabilities', () async {
    final scoped = FakeOrgScoped(
      createRoleAnswers: [_role('rol_new')],
      profile: const OrgProfileView(
        id: 'org_1', name: 'ร้าน', taxProfileComplete: true,
        capabilities: {'manage_roles', 'manage_members'},
      ),
    );
    final container = _container(scoped);
    final list = container.listen(roleDetailsProvider, (_, __) {});
    addTearDown(list.close);
    await container.read(roleDetailsProvider.future);
    expect(scoped.roleDetailsCalls, 1);

    final result = await container
        .read(roleWriteControllerProvider.notifier)
        .create(name: 'แพ็คของ', capabilities: const ['manage_products']);

    expect((result as RoleWriteSaved).role.id, 'rol_new');
    expect(scoped.createdBodies.single.name, 'แพ็คของ');
    expect(scoped.createdBodies.single.capabilities, ['manage_products']);
    await container.read(roleDetailsProvider.future);
    expect(scoped.roleDetailsCalls, 2, reason: 'R1 underneath is re-read');
    await pumpEventQueue();
    expect(container.read(activeOrgProvider)!.capabilities, {'manage_roles', 'manage_members'});
  });

  test('★ update: PATCHes once with the body as given; after the save my capabilities are re-learned',
      () async {
    final scoped = FakeOrgScoped(
      updateRoleAnswers: [_role('rol_1', version: 2)],
      profile: const OrgProfileView(id: 'org_1', name: 'ร้าน', taxProfileComplete: true, capabilities: {}),
    );
    final container = _container(scoped);

    final result = await container.read(roleWriteControllerProvider.notifier).update(
          'rol_1',
          const RoleUpdate(version: 1, capabilities: ['manage_stock']),
        );

    expect((result as RoleWriteSaved).role.version, 2);
    expect(scoped.updates.single.roleId, 'rol_1');
    expect(scoped.updates.single.body.version, 1);
    expect(scoped.updates.single.body.name, isNull);
    expect(scoped.updates.single.body.capabilities, ['manage_stock']);
    await pumpEventQueue();
    expect(scoped.profileCalls, greaterThanOrEqualTo(1));
    // Editing my own role away from manage_roles: the session now says so,
    // and the screen guards leave on their own.
    expect(container.read(activeOrgProvider)!.capabilities, isEmpty);
  });

  test('★ CM3-05: 409 ROLE_CHANGED → failed(role-changed) and the mutation ran ONCE', () async {
    final scoped = FakeOrgScoped(
      updateRoleAnswers: [const ConflictFailure(code: 'ROLE_CHANGED', details: {'currentVersion': 5})],
    );
    final container = _container(scoped);

    final result = await container
        .read(roleWriteControllerProvider.notifier)
        .update('rol_1', const RoleUpdate(version: 1, name: 'x'));

    expect((result as RoleWriteFailed).error, isA<RoleChangedError>());
    await pumpEventQueue();
    expect(scoped.updates, hasLength(1));
    expect(container.read(roleWriteControllerProvider), isFalse, reason: 'not stuck submitting');
  });

  test('a refusal performs its re-reads: UNKNOWN_CAPABILITY → catalog', () async {
    final scoped = FakeOrgScoped(
      createRoleAnswers: [const ValidationFailure(code: 'UNKNOWN_CAPABILITY')],
    );
    final container = _container(scoped);
    final cat = container.listen(capabilityCatalogProvider, (_, __) {});
    addTearDown(cat.close);
    await container.read(capabilityCatalogProvider.future);

    await container.read(roleWriteControllerProvider.notifier).create(name: 'x', capabilities: const ['a']);
    await container.read(capabilityCatalogProvider.future);

    expect(scoped.catalogCalls, 2);
  });

  test('a second submit while one is in flight is ignored (no double POST)', () async {
    final gate = Completer<void>();
    final scoped = FakeOrgScoped(createRoleAnswers: [_role('rol_new')])..writeGate = gate;
    final container = _container(scoped);
    final notifier = container.read(roleWriteControllerProvider.notifier);

    final first = notifier.create(name: 'x', capabilities: const ['a']);
    expect(container.read(roleWriteControllerProvider), isTrue);
    final second = await notifier.create(name: 'x', capabilities: const ['a']);
    expect(second, isNull);

    gate.complete();
    expect(await first, isA<RoleWriteSaved>());
    expect(scoped.createdBodies, hasLength(1));
  });

  group('delete (T-003-M08 · R5)', () {
    test('★ success: ONE DELETE, R1 underneath is re-read', () async {
      final scoped = FakeOrgScoped(deleteRoleAnswers: [roleDeleted]);
      final container = _container(scoped);
      final list = container.listen(roleDetailsProvider, (_, __) {});
      addTearDown(list.close);
      await container.read(roleDetailsProvider.future);
      expect(scoped.roleDetailsCalls, 1);

      final result = await container.read(roleWriteControllerProvider.notifier).delete('rol_1');

      expect(result, isA<RoleDeleteDone>());
      expect(scoped.deletedRoleIds, ['rol_1']);
      await container.read(roleDetailsProvider.future);
      expect(scoped.roleDetailsCalls, 2, reason: 'R1 must not show the deleted row');
      expect(container.read(roleWriteControllerProvider), isFalse);
    });

    test('a second press while the DELETE is in flight is ignored (exactly one DELETE)', () async {
      final gate = Completer<void>();
      final scoped = FakeOrgScoped(deleteRoleAnswers: [roleDeleted])..writeGate = gate;
      final container = _container(scoped);
      final notifier = container.read(roleWriteControllerProvider.notifier);

      final first = notifier.delete('rol_1');
      expect(container.read(roleWriteControllerProvider), isTrue);
      expect(await notifier.delete('rol_1'), isNull);

      gate.complete();
      expect(await first, isA<RoleDeleteDone>());
      expect(scoped.deletedRoleIds, hasLength(1));
    });

    test('409 ROLE_IN_USE → failed(in-use, server numbers), R1 re-read, never retried', () async {
      final scoped = FakeOrgScoped(deleteRoleAnswers: [
        const ConflictFailure(code: 'ROLE_IN_USE', details: {'activeMembers': 1, 'pendingInvitations': 2}),
      ]);
      final container = _container(scoped);
      final list = container.listen(roleDetailsProvider, (_, __) {});
      addTearDown(list.close);
      await container.read(roleDetailsProvider.future);

      final result = await container.read(roleWriteControllerProvider.notifier).delete('rol_1');

      final error = (result as RoleDeleteFailed).error as RoleDeleteInUse;
      expect(error.usage!.pendingInvitations, 2);
      await container.read(roleDetailsProvider.future);
      expect(scoped.roleDetailsCalls, 2);
      expect(scoped.deletedRoleIds, hasLength(1));
    });

    test('404 → failed(gone), and R1 is re-read so the row disappears there too', () async {
      final scoped = FakeOrgScoped(deleteRoleAnswers: [const NotFoundFailure()]);
      final container = _container(scoped);
      final list = container.listen(roleDetailsProvider, (_, __) {});
      addTearDown(list.close);
      await container.read(roleDetailsProvider.future);

      final result = await container.read(roleWriteControllerProvider.notifier).delete('rol_1');

      expect((result as RoleDeleteFailed).error, isA<RoleDeleteGone>());
      await container.read(roleDetailsProvider.future);
      expect(scoped.roleDetailsCalls, 2);
    });
  });
}
