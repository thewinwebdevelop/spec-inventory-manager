import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/refresh_coordinator.dart';
import '../domain/entities/session.dart';
import 'auth_providers.dart';

/// D-023 PASS 2 — `AsyncNotifier<List<Session>>` fits the load/loading/error
/// 4-state rule (design-system.md §2) directly, same pattern as
/// `BootstrapController`.
///
/// ★ sanity-pass fix (Important #1): a dead session (`SessionExpiredException`)
/// PROPAGATES into `AsyncValue.error` — including from the initial fetch that
/// `build()` runs on mount. The earlier pass-2 shape swallowed it into a
/// side-channel + empty list, which meant the mount path (where nothing read
/// the side-channel) parked the user on an authenticated screen with an empty
/// list while storage was already wiped. Surfacing it in state makes the
/// outcome observable from EVERY path; the widget `ref.listen`s for it and
/// navigates (it is a navigation-triggering outcome, NOT a render-as-error
/// state — the widget filters it out of the error-UI branch). [load]/
/// [logoutAll] still ALSO report it via their return value for the
/// imperative call sites (retry button / GlobalKey refresh / logout-all).
///
/// ★ sanity-pass fix (Important #2): `AutoDispose` — this controller must
/// NOT survive across a logout/re-login on the same device. Without
/// autoDispose it lives for the app's lifetime (the default `Notifier`/
/// `AsyncNotifier` behavior), so a re-mounted `SessionList` after user A logs
/// out and user B logs in would `ref.watch` the SAME cached instance and
/// briefly render user A's session list. Making it autoDispose means the
/// provider is torn down once nothing is watching it (screen unmounted) and
/// rebuilt fresh (fresh `build()` call) on the next mount.
enum SessionListLoadResult { ok, sessionExpired }

class SessionListController extends AutoDisposeAsyncNotifier<List<Session>> {
  // Same `mounted`-equivalent guard as the form controllers: skip state
  // writes after autoDispose teardown (screen popped mid-request); the
  // truthful result is still returned.
  bool _disposed = false;

  @override
  Future<List<Session>> build() {
    ref.onDispose(() => _disposed = true);
    return _fetch();
  }

  /// Lets `SessionExpiredException` propagate — on the `build()` path Riverpod
  /// captures it into `AsyncValue.error`, which the widget observes via
  /// `ref.listen` (mount-path navigation, ★ Important #1).
  Future<List<Session>> _fetch() async {
    final sessions = await ref.read(authRepositoryProvider).getSessions();
    return sessions.toList()
      ..sort((a, b) => (b.lastUsedAt ?? b.createdAt).compareTo(a.lastUsedAt ?? a.createdAt));
  }

  /// Re-issues the load (pull-to-refresh / retry button / post-password-change
  /// refresh, ux-wireframe §9.4). Returns [SessionListLoadResult.sessionExpired]
  /// when the repository reports the session is dead — derived from the guarded
  /// state, so the return value and `AsyncValue.error` can never disagree.
  Future<SessionListLoadResult> load() async {
    state = const AsyncValue<List<Session>>.loading();
    final next = await AsyncValue.guard(_fetch);
    if (!_disposed) state = next;
    return next.error is SessionExpiredException
        ? SessionListLoadResult.sessionExpired
        : SessionListLoadResult.ok;
  }

  /// Optimistically removes [familyId] from the current list, then calls the
  /// repository; restores the previous list on failure. Returns true on
  /// success (widget shows the success toast), false on failure (widget
  /// shows the failure toast) — same contract as
  /// `SessionListState._confirmLogoutDevice`, minus the confirm-dialog step
  /// (that stays in presentation; it needs `BuildContext`).
  Future<bool> logoutDevice(String familyId) async {
    final previous = state.valueOrNull ?? const [];
    state = AsyncValue<List<Session>>.data(
      previous.where((s) => s.familyId != familyId).toList(),
    );
    try {
      await ref.read(authRepositoryProvider).logoutDevice(familyId: familyId);
      return true;
    } catch (_) {
      if (!_disposed) state = AsyncValue<List<Session>>.data(previous);
      return false;
    }
  }

  /// Returns [SessionListLoadResult.ok] on success (widget calls
  /// `onLoggedOutAll`) or [SessionListLoadResult.sessionExpired] when the
  /// repository reports the session was already dead (widget calls
  /// `onSessionExpired` instead). Any other failure returns null (widget
  /// shows a generic failure toast) — same 3-way branch
  /// `SessionListState.confirmLogoutAll` had.
  Future<SessionListLoadResult?> logoutAll() async {
    try {
      await ref.read(authRepositoryProvider).logoutAll();
      return SessionListLoadResult.ok;
    } on SessionExpiredException {
      return SessionListLoadResult.sessionExpired;
    } catch (_) {
      return null;
    }
  }
}

final sessionListControllerProvider =
    AutoDisposeAsyncNotifierProvider<SessionListController, List<Session>>(SessionListController.new);
