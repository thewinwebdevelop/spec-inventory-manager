import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/auth/application/auth_providers.dart';
import '../features/auth/data/auth_client_factory.dart';
import '../features/auth/data/auth_repository_impl.dart';

/// D-023 — app-wide composition root helper. Builds the
/// [ProviderScope.overrides] list `main.dart` needs to supply a REAL
/// [AuthRepositoryImpl] for [authRepositoryProvider] (which otherwise has no
/// default — see `features/auth/application/auth_providers.dart`).
///
/// T-001-17 ★ (M-3): [baseUrl] is required (no hardcoded prod default) and
/// is passed straight through to [createAuthClient]'s https-in-release
/// guard. F-006/devops owns the real per-environment value; this seam only
/// wires it into the Riverpod provider graph.
List<Override> buildAppOverrides({required String baseUrl}) {
  return [
    authRepositoryProvider.overrideWithValue(createAuthClient(baseUrl: baseUrl)),
  ];
}
