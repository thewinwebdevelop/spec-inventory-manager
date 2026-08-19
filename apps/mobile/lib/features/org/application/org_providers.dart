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

/// Entering a shop from the picker.
///
/// Writes the session ONCE; every provider downstream of `activeOrgIdProvider`
/// rebuilds off that single write (mobile.md §3.2). Capabilities come from the
/// membership the picker already holds — a shop the caller is an active member
/// of always has them.
void enterOrganization(WidgetRef ref, MyOrganization org, {Set<String> capabilities = const {}}) {
  ref.read(sessionControllerProvider.notifier).switchOrg(
        ActiveOrg(orgId: org.id, name: org.name, capabilities: capabilities),
      );
}
