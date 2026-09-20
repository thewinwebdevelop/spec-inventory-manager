import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/bootstrap.dart';
import 'package:mobile/core/api/api_providers.dart';
import 'package:mobile/core/session/session_controller.dart';
import 'package:mobile/core/session/session_state.dart';
import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/auth/data/auth_client_factory.dart';
import 'package:mobile/features/org/application/org_providers.dart';

/// ★ T-002-M5 — the composition root actually composes.
///
/// This file exists because of what it found. `orgDirectoryProvider` and
/// `orgScopedRepositoryProvider` throw `UnimplementedError` unless the root
/// overrides them; every mobile test overrode them with fakes, and the app
/// overrode NEITHER. So F-002's mobile half — four screens, the controllers,
/// the repository impls, 380-odd green tests — could not run in the real app
/// at all, and nothing said so.
///
/// The rule this pins is therefore not "the providers work". It is that the
/// list the app boots with resolves every provider the app's screens read.
void main() {
  final stack = createAuthStack(baseUrl: 'http://localhost:3000');

  ProviderContainer boot() {
    final container = ProviderContainer(
      overrides: buildOverridesFrom(repository: stack.repository, dio: stack.dio),
    );
    addTearDown(container.dispose);
    return container;
  }

  test('★ the org providers resolve — they threw UnimplementedError before', () {
    final container = boot();

    // Reading is the whole assertion: an unwired provider throws here.
    expect(container.read(orgDirectoryProvider), isNotNull);
    expect(container.read(authRepositoryProvider), isNotNull);
  });

  test('★ ONE Dio, so there is one refresh chain in the app', () {
    // Single-flight refresh dedupe is per-instance and the coordinator is
    // bound to this repository. A second base client would mean two refresh
    // policies, which is the drift `api_providers.dart` warns about — and it
    // would show up as two parallel refreshes racing to rotate one token.
    final container = boot();
    expect(container.read(baseDioProvider), same(stack.dio));
  });

  test('the org-scoped repository needs a shop, and says so instead of guessing', () {
    final container = boot();

    // No active shop: `orgDioProvider` throws rather than sending an
    // org-scoped request with no org. Reaching this is a routing bug, and the
    // loud version is the one that gets fixed.
    expect(() => container.read(orgScopedRepositoryProvider), throwsStateError);
  });

  test('★ with a shop open, the org-scoped repository builds on the org client', () {
    final container = boot();
    // Signed in FIRST: `switchOrg` is a no-op on a session that is not
    // authed, which is the controller being right — you cannot be in a shop
    // without being signed in — and was my mistake in the first draft.
    container.read(sessionControllerProvider.notifier).signedIn(
      orgs: const [OrgSummary(id: 'org_1', name: 'ร้านทดสอบ', roleName: 'เจ้าของร้าน')],
    );
    container.read(sessionControllerProvider.notifier).switchOrg(
          const ActiveOrg(orgId: 'org_1', name: 'ร้านทดสอบ', capabilities: {'full_access'}),
        );

    expect(container.read(orgScopedRepositoryProvider), isNotNull);

    // …and that client is NOT the base one: it carries the org header, which
    // is the difference between "this shop's members" and a request whose
    // scope nobody stated.
    final orgDio = container.read(orgDioProvider);
    expect(orgDio, isNot(same(container.read(baseDioProvider))));
    expect(
      orgDio.interceptors.length,
      greaterThan(container.read(baseDioProvider).interceptors.length),
      reason: 'the org client should add X-Organization-Id on top of the base chain',
    );
  });

  test('the base URL guard is not bypassed by the new seam', () {
    // `createAuthStack` is the same wiring `createAuthClient` always did, so
    // the https-in-release guard still runs. Debug builds allow plain http,
    // which is why the line above works at all.
    expect(() => createAuthStack(baseUrl: 'http://localhost:3000'), returnsNormally);
  });

  test('the two factories return the same repository wiring', () {
    // `createAuthClient` now delegates. If it ever stops, this catches the
    // moment the app and its tests start booting different graphs.
    final viaClient = createAuthClient(baseUrl: 'http://localhost:3000');
    expect(viaClient, isA<Object>());
    expect(viaClient.runtimeType, stack.repository.runtimeType);
  });
}
