import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/error/api_failure.dart';
import '../../../core/session/session_controller.dart';
import '../../../core/session/session_failure_listener.dart';
import '../domain/entities/org_entities.dart';
import 'org_providers.dart';

/// T-002-M3 — the members and invitations sections of S6, each with its own
/// loading and its own error (ux-wireframe §7: "แสดง error เฉพาะส่วนนั้น …
/// อีกส่วนยังใช้งานได้").
///
/// A deliberately small paged controller, NOT a general one. `PagedListController`
/// + `AsyncStateView` + `PagedListView` are mobile.md §3.3's design and F-013's
/// job; building a speculative version of them here would be the thing F-013
/// has to unpick first. What this does is the minimum S6 is specified against:
/// first page, "โหลดเพิ่ม", per-section error, and — the reason `nextCursor` is
/// kept rather than dropped — an honest answer to "is that everybody?".
class PagedState<T> {
  const PagedState({
    this.items = const [],
    this.nextCursor,
    this.loading = true,
    this.loadingMore = false,
    this.failure,
  });

  final List<T> items;
  final String? nextCursor;
  final bool loading;
  final bool loadingMore;

  /// Set only when the FIRST page failed, or a "โหลดเพิ่ม" did. A failure that
  /// moved the session (`403 ORG_ACCESS_DENIED`) never lands here — the
  /// listener took it and the router is about to take over.
  final ApiFailure? failure;

  bool get hasMore => nextCursor != null;

  /// True only when every page has been loaded. The backup-owner nudge
  /// (D-030) is gated on this: counting Owners in a partial list and warning
  /// on the result is saying something you do not know (ux-wireframe §7).
  bool get isComplete => !loading && !loadingMore && failure == null && nextCursor == null;
}

/// Shared behaviour of the two sections. Subclasses supply only [fetch] —
/// which repository call, and which `status` filter.
abstract class PagedController<T> extends AutoDisposeFamilyNotifier<PagedState<T>, String> {
  /// Bumped on every (re)build and on dispose. An answer is applied only if
  /// the generation it was asked under is still current — so a page from
  /// shop A that lands after the switch to shop B is dropped (T-003-M11 L-1).
  /// A bool `_disposed` cannot say this: Riverpod reuses the notifier across
  /// a rebuild, and the old flag would then also silence B's own answer.
  int _generation = 0;

  /// [arg] is the `status` filter (`active`/`all`, `pending`/`all`) — part of
  /// the provider's identity, so switching the toggle builds a SEPARATE
  /// controller rather than mutating this one's list mid-flight.
  Future<PagedResult<T>> fetch({String? cursor});

  @override
  PagedState<T> build(String arg) {
    // ★ L-1 — WATCH the shop: entering another shop rebuilds this controller
    // with an EMPTY state, so shop A's rows are never painted under shop B's
    // name. (It used to `ref.read` the repository, which survived the switch
    // with A's rows on screen while the doc comment below claimed otherwise.)
    ref.watch(activeOrgIdProvider);
    _generation++;
    ref.onDispose(() => _generation++);
    // The first page starts on build: a section that needed an explicit
    // `load()` from `initState` would show its skeleton forever if a screen
    // forgot the call, and nothing in the type system would say so.
    Future<void>.microtask(refresh);
    // Not `const`: a constant cannot depend on the type variable [T], and an
    // untyped `PagedState<dynamic>` here would defeat the point of the type.
    return PagedState<T>();
  }

  Future<void> refresh() async {
    final asked = _generation;
    state = PagedState<T>(items: state.items, loading: true);
    try {
      final page = await fetch();
      if (asked != _generation) return;
      state = PagedState<T>(items: page.items, nextCursor: page.nextCursor, loading: false);
    } on ApiFailure catch (failure) {
      if (asked != _generation) return;
      state = PagedState<T>(loading: false, failure: _report(failure));
    }
  }

  /// Puts [next] in place of every row [test] matches — the R10 sheet hands
  /// over the `200` row so the screen is right BEFORE the re-read lands
  /// (ux R10 success: "อัปเดตแถวจาก 200 แล้ว refetch").
  void replaceWhere(bool Function(T) test, T next) {
    state = PagedState<T>(
      items: [for (final item in state.items) test(item) ? next : item],
      nextCursor: state.nextCursor,
      loading: state.loading,
      loadingMore: state.loadingMore,
      failure: state.failure,
    );
  }

  Future<void> loadMore() async {
    final cursor = state.nextCursor;
    // Guarded rather than merely disabled in the UI: two taps in the same
    // frame would otherwise append the same page twice.
    if (cursor == null || state.loadingMore || state.loading) return;
    final asked = _generation;
    state = PagedState<T>(
      items: state.items,
      nextCursor: cursor,
      loading: false,
      loadingMore: true,
    );
    try {
      final page = await fetch(cursor: cursor);
      if (asked != _generation) return;
      state = PagedState<T>(
        items: [...state.items, ...page.items],
        nextCursor: page.nextCursor,
        loading: false,
      );
    } on ApiFailure catch (failure) {
      if (asked != _generation) return;
      // The rows already on screen stay. Losing them because page 3 failed
      // would punish the reader for our retry.
      state = PagedState<T>(
        items: state.items,
        nextCursor: cursor,
        loading: false,
        failure: _report(failure),
      );
    }
  }

  /// Gives the session its say first, and returns null when it took the
  /// failure — the screen must not paint an error under a redirect.
  ApiFailure? _report(ApiFailure failure) {
    return ref.read(sessionFailureListenerProvider).handle(failure) ? null : failure;
  }
}

class MembersController extends PagedController<MemberRow> {
  @override
  Future<PagedResult<MemberRow>> fetch({String? cursor}) =>
      ref.read(orgScopedRepositoryProvider).listMembers(status: arg, cursor: cursor);
}

class InvitationsController extends PagedController<InvitationRow> {
  @override
  Future<PagedResult<InvitationRow>> fetch({String? cursor}) =>
      ref.read(orgScopedRepositoryProvider).listInvitations(status: arg, cursor: cursor);
}

/// Both are `autoDispose`, and every controller WATCHES the active shop (see
/// [PagedController.build]) — so a shop switch rebuilds them empty and no
/// stale list survives it (T-003-M11 L-1, pinned in paged_controllers_test).
final membersControllerProvider =
    NotifierProvider.autoDispose.family<MembersController, PagedState<MemberRow>, String>(
  MembersController.new,
);

final invitationsControllerProvider =
    NotifierProvider.autoDispose.family<InvitationsController, PagedState<InvitationRow>, String>(
  InvitationsController.new,
);

/// T-003-M10 — ux R6 "คนที่ใช้บทบาท …": the same two sections, narrowed to one
/// role. [arg] is the `roleId`; the status is fixed by R6 (active members,
/// stored-pending invitations — i.e. pending + expired, AC-3.9).
class RoleMembersController extends PagedController<MemberRow> {
  @override
  Future<PagedResult<MemberRow>> fetch({String? cursor}) => ref
      .read(orgScopedRepositoryProvider)
      .listMembers(status: 'active', roleId: arg, cursor: cursor);
}

class RoleInvitationsController extends PagedController<InvitationRow> {
  @override
  Future<PagedResult<InvitationRow>> fetch({String? cursor}) => ref
      .read(orgScopedRepositoryProvider)
      .listInvitations(status: 'pending', roleId: arg, cursor: cursor);
}

final roleMembersControllerProvider =
    NotifierProvider.autoDispose.family<RoleMembersController, PagedState<MemberRow>, String>(
  RoleMembersController.new,
);

final roleInvitationsControllerProvider = NotifierProvider.autoDispose
    .family<RoleInvitationsController, PagedState<InvitationRow>, String>(
  RoleInvitationsController.new,
);
