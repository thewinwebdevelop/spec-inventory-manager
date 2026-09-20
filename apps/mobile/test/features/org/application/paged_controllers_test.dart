// T-002-M3 — the two sections of S6, each paging and failing on its own.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/core/session/session_controller.dart';
import 'package:mobile/core/session/session_state.dart';
import 'package:mobile/features/org/application/org_providers.dart';
import 'package:mobile/features/org/application/paged_controllers.dart';
import 'package:mobile/features/org/domain/entities/org_entities.dart';

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
  return container;
}

/// Subscribes, the way a screen does.
///
/// Not optional: these controllers are `autoDispose`, so a bare `read` with
/// no listener is torn down again before the first page can land — which is
/// exactly the behaviour a screen relies on when it leaves.
void _keep(ProviderContainer container, ProviderListenable<Object?> provider) {
  final sub = container.listen(provider, (_, __) {});
  addTearDown(sub.close);
}

/// Lets the microtask that `build` schedules run, AND the repository call it
/// starts. One `delayed(Duration.zero)` is not enough: it is queued before
/// the fetch's own timer, so it fires while the first page is still in
/// flight.
Future<void> _settle() async {
  for (var i = 0; i < 5; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

void main() {
  test('the first page loads without anybody calling load()', () async {
    final container = _container(FakeOrgScoped(memberPages: [
      PagedResult(items: [member(id: 'usr_1')]),
    ]));
    _keep(container, membersControllerProvider('active'));

    expect(container.read(membersControllerProvider('active')).loading, isTrue);
    await _settle();

    final state = container.read(membersControllerProvider('active'));
    expect(state.loading, isFalse);
    expect(state.items, hasLength(1));
    expect(state.isComplete, isTrue);
  });

  test('★ the status filter is part of the controller\'s identity', () async {
    // Flipping "แสดงสมาชิกที่ถูกถอดออกแล้ว" builds a SEPARATE controller
    // rather than mutating a list mid-flight, so a slow `all` response can
    // never land in the `active` list.
    final scoped = FakeOrgScoped(memberPages: [
      PagedResult(items: [member(id: 'usr_1')]),
      PagedResult(items: [member(id: 'usr_1'), member(id: 'usr_2', status: 'revoked')]),
    ]);
    final container = _container(scoped);

    _keep(container, membersControllerProvider('active'));
    _keep(container, membersControllerProvider('all'));
    await _settle();

    expect(container.read(membersControllerProvider('active')).items, hasLength(1));
    expect(container.read(membersControllerProvider('all')).items, hasLength(2));
    expect(scoped.statusesSeen, containsAll(<String>['active', 'all']));
  });

  test('★ loadMore appends and passes the cursor back', () async {
    final scoped = FakeOrgScoped(memberPages: [
      PagedResult(items: [member(id: 'usr_1')], nextCursor: 'cur_2'),
      PagedResult(items: [member(id: 'usr_2')]),
    ]);
    final container = _container(scoped);
    _keep(container, membersControllerProvider('active'));
    await _settle();

    expect(container.read(membersControllerProvider('active')).hasMore, isTrue);
    // Not complete yet — and the nudge is gated on exactly this.
    expect(container.read(membersControllerProvider('active')).isComplete, isFalse);

    await container.read(membersControllerProvider('active').notifier).loadMore();

    final state = container.read(membersControllerProvider('active'));
    expect(state.items.map((m) => m.userId), ['usr_1', 'usr_2']);
    expect(state.isComplete, isTrue);
    expect(scoped.cursorsSeen, [null, 'cur_2']);
  });

  test('★ two loadMore taps in the same frame fetch one page, not two', () async {
    final scoped = FakeOrgScoped(
      memberPages: [
        PagedResult(items: [member(id: 'usr_1')], nextCursor: 'cur_2'),
        PagedResult(items: [member(id: 'usr_2')]),
      ],
      delay: const Duration(milliseconds: 20),
    );
    final container = _container(scoped);
    _keep(container, membersControllerProvider('active'));
    await Future<void>.delayed(const Duration(milliseconds: 40));

    final notifier = container.read(membersControllerProvider('active').notifier);
    await Future.wait([notifier.loadMore(), notifier.loadMore()]);

    expect(container.read(membersControllerProvider('active')).items, hasLength(2));
    expect(scoped.memberCalls, 2, reason: 'page 1 + one page 2, never a duplicate append');
  });

  test('★ a failed page 2 keeps the rows already on screen', () async {
    final scoped = _FailingSecondPage();
    final container = ProviderContainer(
      overrides: [orgScopedRepositoryProvider.overrideWithValue(scoped)],
    );
    addTearDown(container.dispose);
    container.read(sessionControllerProvider.notifier).signedIn(orgs: const []);
    _keep(container, membersControllerProvider('active'));
    await _settle();

    await container.read(membersControllerProvider('active').notifier).loadMore();

    final state = container.read(membersControllerProvider('active'));
    expect(state.items, hasLength(1), reason: 'losing page 1 would punish the reader for our retry');
    expect(state.failure, isA<NetworkFailure>());
    // The cursor survives, so "โหลดเพิ่ม" can be pressed again.
    expect(state.hasMore, isTrue);
  });

  test('★ ORG_ACCESS_DENIED moves the SESSION and paints no error', () async {
    // ux-wireframe §12.1: the router is about to take over. An error banner
    // under a redirect is a flash of the wrong thing.
    final container = _container(FakeOrgScoped(membersFailure: const OrgAccessDeniedFailure()));
    _keep(container, membersControllerProvider('active'));
    await _settle();

    final state = container.read(membersControllerProvider('active'));
    expect(state.failure, isNull);
    expect(container.read(activeOrgIdProvider), isNull, reason: 'the shop was dropped');
    // The account is untouched — D-027: a session is not tied to a shop.
    expect(container.read(sessionControllerProvider), isA<SessionAuthed>());
  });

  test('a 403 FORBIDDEN stays with the section and keeps the shop', () async {
    final container = _container(FakeOrgScoped(membersFailure: const ForbiddenFailure()));
    _keep(container, membersControllerProvider('active'));
    await _settle();

    expect(container.read(membersControllerProvider('active')).failure, isA<ForbiddenFailure>());
    expect(container.read(activeOrgIdProvider), 'org_1');
  });

  test('★ the two sections fail independently', () async {
    // ux-wireframe §7: "อีกส่วนยังใช้งานได้". They are separate jobs and only
    // one of them is broken.
    final container = _container(FakeOrgScoped(
      invitationsFailure: const ServerFailure(),
      memberPages: [
        PagedResult(items: [member(id: 'usr_1')]),
      ],
    ));
    _keep(container, membersControllerProvider('active'));
    _keep(container, invitationsControllerProvider('pending'));
    await _settle();

    expect(container.read(invitationsControllerProvider('pending')).failure, isA<ServerFailure>());
    expect(container.read(membersControllerProvider('active')).failure, isNull);
    expect(container.read(membersControllerProvider('active')).items, hasLength(1));
  });

  test('refresh re-fetches from the first page', () async {
    final scoped = FakeOrgScoped(memberPages: [
      PagedResult(items: [member(id: 'usr_1')], nextCursor: 'cur_2'),
      PagedResult(items: [member(id: 'usr_2')]),
      PagedResult(items: [member(id: 'usr_3')]),
    ]);
    final container = _container(scoped);
    _keep(container, membersControllerProvider('active'));
    await _settle();
    await container.read(membersControllerProvider('active').notifier).loadMore();

    await container.read(membersControllerProvider('active').notifier).refresh();

    // The third canned page, requested with NO cursor.
    expect(container.read(membersControllerProvider('active')).items.single.userId, 'usr_3');
    expect(scoped.cursorsSeen.last, isNull);
  });

  test('invitations page the same way, through their own endpoint', () async {
    final container = _container(FakeOrgScoped(invitationPages: [
      PagedResult(items: [invitation(id: 'inv_1')], nextCursor: 'cur_2'),
      PagedResult(items: [invitation(id: 'inv_2')]),
    ]));
    _keep(container, invitationsControllerProvider('pending'));
    await _settle();

    await container.read(invitationsControllerProvider('pending').notifier).loadMore();
    expect(
      container.read(invitationsControllerProvider('pending')).items.map((i) => i.id),
      ['inv_1', 'inv_2'],
    );
  });
}

/// PagedResult 1 succeeds, page 2 fails — a shape the shared fake cannot express
/// with one failure field.
class _FailingSecondPage extends FakeOrgScoped {
  _FailingSecondPage();

  int _calls = 0;

  @override
  Future<PagedResult<MemberRow>> listMembers({String status = 'active', String? cursor}) async {
    if (_calls++ == 0) {
      return PagedResult(items: [member(id: 'usr_1')], nextCursor: 'cur_2');
    }
    throw const NetworkFailure();
  }
}
