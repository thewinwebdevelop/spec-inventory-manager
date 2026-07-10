import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/auth_repository_impl.dart';

/// D-023 — Riverpod DI root for the auth feature. `ProviderScope.overrides`
/// (app root, production) or `ProviderContainer(overrides: [...])` /
/// `ProviderScope(overrides: [...])` (tests) swap in a fake/test-wired
/// [AuthRepositoryImpl] here — every layer above (application controllers,
/// presentation screens) reads the repository through this provider instead
/// of constructing/receiving one ad hoc, so the DI seam is uniform and
/// override-able exactly once per test.
///
/// No default implementation is provided — `main.dart`/`app/bootstrap.dart`
/// MUST override this with a real `createAuthClient(...)`-built instance
/// (client-security M-3: the base URL is never defaulted to a hardcoded
/// value) and every widget test MUST override it with a fake-wired instance
/// (never touches a real platform channel / network).
final authRepositoryProvider = Provider<AuthRepositoryImpl>((ref) {
  throw UnimplementedError(
    'authRepositoryProvider has no default — override it at the '
    'ProviderScope/ProviderContainer root with a real (app) or fake (test) '
    'AuthRepositoryImpl instance.',
  );
});
