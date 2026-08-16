import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api/api_providers.dart';
import '../core/session/session_controller.dart';
import '../features/auth/application/auth_providers.dart';
import '../features/auth/data/auth_client_factory.dart';
import '../features/auth/data/auth_repository_impl.dart';
import '../features/org/application/org_providers.dart';
import '../features/org/data/org_client_factory.dart';

/// D-023 — app-wide composition root helper. Builds the
/// [ProviderScope.overrides] list `main.dart` needs to supply a REAL
/// [AuthRepositoryImpl] for [authRepositoryProvider] (which otherwise has no
/// default — see `features/auth/application/auth_providers.dart`).
///
/// T-001-17 ★ (M-3): [baseUrl] is required (no hardcoded prod default) and
/// is passed straight through to [createAuthClient]'s https-in-release
/// guard. F-006/devops owns the real per-environment value; this seam only
/// wires it into the Riverpod provider graph.
///
/// ★ T-002-M5 — F-002's org providers are wired here too, and until now they
/// were not wired ANYWHERE. `orgDirectoryProvider` and
/// `orgScopedRepositoryProvider` both throw `UnimplementedError` by design,
/// to be overridden at the root; every test overrode them with fakes and the
/// app overrode neither. So the whole mobile half of F-002 — the impls, the
/// controllers, four screens — could not run outside a test. Found while
/// building the E-10 lane, which is exactly the kind of gap a lane that runs
/// the real app on a real device is for.
List<Override> buildAppOverrides({required String baseUrl}) {
  final stack = createAuthStack(baseUrl: baseUrl);
  return buildOverridesFrom(repository: stack.repository, dio: stack.dio);
}

/// The override list, given an already-built stack.
///
/// Split out so a test can supply its own `Dio` (a fake adapter, or one
/// pointed at a local server) and still exercise the REAL provider graph
/// rather than a graph assembled differently for testing.
List<Override> buildOverridesFrom({
  required AuthRepositoryImpl repository,
  required Dio dio,
}) {
  return [
    authRepositoryProvider.overrideWithValue(repository),
    // The org-AGNOSTIC client: `/auth/*` and `GET /me/organizations`. The same
    // instance the auth repository uses, so there is exactly one refresh
    // chain in the app (api_providers.dart explains why that matters).
    baseDioProvider.overrideWithValue(dio),
    orgDirectoryProvider.overrideWith((ref) => createOrgDirectory(ref.watch(baseDioProvider))),
    // Built on `orgDioProvider`, never on the base client: that is what puts
    // `X-Organization-Id` on these calls and keeps it off the other ones. It
    // rebuilds when the active shop changes, and throws — loudly, by design —
    // if something reads it with no shop open.
    orgScopedRepositoryProvider.overrideWith(
      (ref) => createOrgScoped(
        orgDio: ref.watch(orgDioProvider),
        orgId: ref.watch(activeOrgIdProvider)!,
      ),
    ),
  ];
}
