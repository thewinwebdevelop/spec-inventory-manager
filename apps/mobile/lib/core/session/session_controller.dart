import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'session_state.dart';

/// T-002-M1 ★ — the single writer of [SessionState] (mobile.md §3.2/§3.3).
///
/// The router guard reads it, every feature reads it, and the API interceptors
/// write to it (`core/api` may depend on `core/session` — both are core). One
/// writer means "am I signed in, and into which shop" has exactly one answer
/// at any moment, which is what makes the router's redirect chain decidable.
class SessionController extends StateNotifier<SessionState> {
  SessionController() : super(const SessionUnknown());

  /// Cold-start restore finished and there is no session.
  void signedOut() => state = const SessionNone();

  void signedIn({required List<OrgSummary> orgs, ActiveOrg? active}) {
    state = SessionAuthed(orgs: orgs, active: active);
  }

  /// Switching shops is ONE write. Every provider that derives from
  /// `orgDioProvider` rebuilds off this, and their old state is disposed —
  /// there is no per-provider invalidation to forget (mobile.md §3.2).
  void switchOrg(ActiveOrg org) {
    final current = state;
    if (current is! SessionAuthed) return;
    state = current.copyWith(active: org);
  }

  /// ★ What this member may do in the ACTIVE shop, as the server reports it.
  ///
  /// Entering a shop from the picker or the switcher cannot know this: the
  /// contract deliberately keeps capabilities off `/me/organizations` (§3.5),
  /// so the list those screens read has shop names and roles and nothing about
  /// permission. Until the M-07 security review, nobody filled the gap — every
  /// entry point except create-shop left the set EMPTY, and every screen that
  /// gates on it therefore treated a real Owner as having no rights. It failed
  /// closed, which is why it went unnoticed.
  ///
  /// Ignored when it does not match the shop that is open now: a slow response
  /// for shop A must not grant its capabilities inside shop B.
  void capabilitiesLearned({required String orgId, required Set<String> capabilities}) {
    final current = state;
    if (current is! SessionAuthed) return;
    final active = current.active;
    if (active == null || active.orgId != orgId) return;
    state = current.copyWith(
      active: ActiveOrg(
        orgId: active.orgId,
        name: active.name,
        capabilities: capabilities,
        entitlements: active.entitlements,
      ),
    );
  }

  /// `403 ORG_ACCESS_DENIED` — no longer an active member of THIS shop.
  ///
  /// Drops the shop, keeps the session (D-027: a session is not tied to a
  /// shop). Signing the person out here would be the destructive reading of a
  /// status that says nothing about their account, and it is the mistake the
  /// web client answers with a separate `ApiFailure` kind to avoid.
  void orgAccessDenied() {
    final current = state;
    if (current is! SessionAuthed) return;
    state = current.withoutActiveOrg();
  }

  /// Terminal `401` — silent refresh has already been tried and failed.
  void sessionExpired() => state = const SessionNone();

  /// `426` — this build can no longer talk to the API.
  void forceUpdate() => state = const SessionForceUpdate();
}

final sessionControllerProvider =
    StateNotifierProvider<SessionController, SessionState>((ref) => SessionController());

/// The active shop id, or `null`.
///
/// Deliberately a derived provider rather than a field somebody sets: it has
/// exactly one source, and `orgDioProvider` watching it is what makes
/// "every org request carries the org" structural instead of remembered.
final activeOrgIdProvider = Provider<String?>((ref) {
  final session = ref.watch(sessionControllerProvider);
  return session is SessionAuthed ? session.active?.orgId : null;
});

/// The active shop, for capability checks on screen.
final activeOrgProvider = Provider<ActiveOrg?>((ref) {
  final session = ref.watch(sessionControllerProvider);
  return session is SessionAuthed ? session.active : null;
});
