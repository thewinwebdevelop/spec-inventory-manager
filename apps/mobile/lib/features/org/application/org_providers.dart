import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/session/session_controller.dart';
import '../../../core/session/session_state.dart';
import '../domain/entities/org_entities.dart';
import '../domain/repositories/org_repository.dart';

/// T-002-M3 — DI for the org feature (D-023 style: manual providers, every
/// one overridable in a test).
///
/// Both repository providers are typed to the ABSTRACT port, never the impl
/// (the R5 rule the auth feature follows) — a test overrides them with a fake
/// and never goes near Dio.
///
/// The split between them is the point of this file. [orgDirectoryProvider]
/// is built on `baseDioProvider` and [orgScopedRepositoryProvider] on
/// `orgDioProvider`, so a controller physically cannot call an org-scoped
/// endpoint through the org-agnostic client, or the other way round.
final orgDirectoryProvider = Provider<OrgDirectory>((ref) {
  throw UnimplementedError(
    'orgDirectoryProvider has no default — override it at the root with an '
    'OrgDirectoryImpl built on baseDioProvider (app) or a fake (test).',
  );
});

final orgScopedRepositoryProvider = Provider<OrgScoped>((ref) {
  throw UnimplementedError(
    'orgScopedRepositoryProvider has no default — override it at the root '
    'with an OrgScopedImpl built on orgDioProvider (app) or a fake (test). '
    'Reading it with no active shop is a routing bug: orgDioProvider throws.',
  );
});

/// The shop list behind the picker and the AppBar switcher.
///
/// One provider for both, deliberately: they show the same data, so a shop
/// that vanished cannot linger in one of them (the same reasoning as the web
/// client's single `/me/organizations` query).
final myOrganizationsProvider = FutureProvider.autoDispose<List<MyOrganization>>((ref) async {
  return ref.watch(orgDirectoryProvider).listMyOrganizations();
});

/// The members and invitations lists live in `paged_controllers.dart` —
/// they are paginated and each owns its own error, which a `FutureProvider`
/// cannot express (ux-wireframe §7).

/// ★ M-07 — the shop's profile, for the tax card.
///
/// `autoDispose`: leaving the screen throws the profile away, which matters
/// less than it does for the revealed number (this holds only the MASKED
/// value) but keeps the two on the same footing.
final orgProfileProvider = FutureProvider.autoDispose<OrgProfileView>((ref) async {
  return ref.watch(orgScopedRepositoryProvider).getOrganization();
});

final rolesProvider = FutureProvider.autoDispose<List<RoleRow>>((ref) async {
  return ref.watch(orgScopedRepositoryProvider).listRoles();
});

/// Shops whose backup-owner nudge (D-030) has been dismissed with "ไว้ทีหลัง".
///
/// Deliberately NOT autoDispose and deliberately NOT persisted, which is
/// exactly what ux-wireframe §7 asks for: dismissal survives leaving the
/// members screen, and comes back "เมื่อเปิดแอปรอบใหม่". Writing it to storage
/// would silence a recoverability warning forever on one tap; scoping it to
/// the widget would put it back in the person's face on every visit.
///
/// Keyed by shop id: dismissing it for one shop says nothing about another.
final backupOwnerNudgeDismissedProvider = StateProvider<Set<String>>((ref) => const {});

/// Entering a shop from the picker or the switcher.
///
/// Writes the session ONCE; every provider downstream of `activeOrgIdProvider`
/// rebuilds off that single write (mobile.md §3.2).
///
/// ★ Then it asks the server what this member may do, because the caller
/// cannot know: `/me/organizations` deliberately publishes no capabilities
/// (§3.5), so the picker and the switcher had nothing to pass and every screen
/// that gates on capabilities saw an empty set — a real Owner offered no Owner
/// role, no tax details, no rename. Found by the M-07 security review, which
/// also named the second screen still reading that empty set.
///
/// The fetch is deliberately NOT awaited by the caller: entering a shop should
/// not wait on a round trip, and the screens gate closed until it lands, which
/// is the safe direction. `capabilitiesLearned` ignores an answer for a shop
/// the user has already left.
void enterOrganization(WidgetRef ref, MyOrganization org, {Set<String> capabilities = const {}}) {
  ref.read(sessionControllerProvider.notifier).switchOrg(
        ActiveOrg(orgId: org.id, name: org.name, capabilities: capabilities),
      );
  if (capabilities.isEmpty) unawaited(learnCapabilities(ref));
}

/// Reads `GET /orgs/{orgId}` for `myMembership.capabilities` and tells the
/// session. Errors are swallowed on purpose: failing to LEARN a capability
/// leaves the UI offering less, never more, and the server refuses regardless.
Future<void> learnCapabilities(WidgetRef ref) async {
  final orgId = ref.read(activeOrgIdProvider);
  if (orgId == null) return;
  // ★ Everything comes off `ref` BEFORE the await, and nothing after it.
  //
  // The screen that started this is usually gone by the time the answer
  // arrives — entering a shop is exactly the thing that replaces the picker,
  // and the switcher closes itself. A `WidgetRef` used after its widget is
  // disposed throws, and the throw would land in the catch below, so the fix
  // would have failed the same silent, fail-closed way as the bug it fixes:
  // capabilities never learned, screens never opened, nothing in the log.
  // These two objects outlive the widget (they belong to the container).
  //
  // Both reads are INSIDE the try, and before the await. Entering a shop must
  // not throw because a background lookup could not be assembled — the picker
  // does not depend on the org repository for anything else, and its tests
  // rightly do not wire one. Whether the app wires it at all is B-4's
  // question, and `bootstrap_test.dart` is where that is pinned.
  try {
    final session = ref.read(sessionControllerProvider.notifier);
    final repository = ref.read(orgScopedRepositoryProvider);
    final profile = await repository.getOrganization();
    session.capabilitiesLearned(orgId: orgId, capabilities: profile.capabilities);
  } catch (_) {
    // Nothing to do and nothing to say: the screens stay closed, and every
    // action they hide is refused by the server anyway.
  }
}
