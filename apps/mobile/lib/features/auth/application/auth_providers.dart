import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/repositories/auth_repository.dart';

/// D-023 — Riverpod DI root for the auth feature. `ProviderScope.overrides`
/// (app root, production) or `ProviderContainer(overrides: [...])` /
/// `ProviderScope(overrides: [...])` (tests) swap in a fake/test-wired
/// [AuthRepository] here — every layer above (application controllers,
/// presentation screens) reads the repository through this provider instead
/// of constructing/receiving one ad hoc, so the DI seam is uniform and
/// override-able exactly once per test.
///
/// R5 (docs/architecture/refactor-plan.md §4) — typed to the ABSTRACT
/// [AuthRepository], not the concrete `AuthRepositoryImpl`
/// (mobile.md §6: "provider ผูก concrete ... กันโครงถูกลอกไป 30 features").
/// `application/` controllers therefore depend only on the abstract contract;
/// `createAuthClient(...)` (an `AuthRepositoryImpl`) and any fake used in
/// tests both satisfy the interface and override cleanly here.
///
/// No default implementation is provided — `main.dart`/`app/bootstrap.dart`
/// MUST override this with a real `createAuthClient(...)`-built instance
/// (client-security M-3: the base URL is never defaulted to a hardcoded
/// value) and every widget test MUST override it with a fake-wired instance
/// (never touches a real platform channel / network).
final authRepositoryProvider = Provider<AuthRepository>((ref) {
  throw UnimplementedError(
    'authRepositoryProvider has no default — override it at the '
    'ProviderScope/ProviderContainer root with a real (app) or fake (test) '
    'AuthRepository instance.',
  );
});
