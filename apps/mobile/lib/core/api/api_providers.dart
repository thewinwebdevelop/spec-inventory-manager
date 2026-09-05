import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../session/session_controller.dart';
import 'org_header_interceptor.dart';

/// T-002-M1 ★ — the two API clients, and the reason there are exactly two
/// (mobile.md §3.2).
///
/// [baseDioProvider] is org-AGNOSTIC: `/auth/*`, `GET /me/organizations`,
/// `POST /organizations`, and the invitation preview/accept endpoints. Those
/// exist precisely because the caller is not inside a shop — three of them are
/// reachable before the person has picked one, and one before they even have
/// an account. Sending `X-Organization-Id` on them would hand the server an
/// input those routes should never receive (security review I-3, the
/// confused-deputy finding; the web client learned the same thing at W3).
///
/// [orgDioProvider] is everything else, and it derives the org from the
/// session by STRUCTURE. A repository cannot obtain a client without going
/// through it, so "every org request carries the org" is not a rule anybody
/// has to remember — it is the only shape available. Switching shops is one
/// write to `SessionController`; Riverpod rebuilds every provider downstream
/// of `activeOrgIdProvider` and disposes the old state, so no per-provider
/// invalidation can be forgotten.
///
/// ── Why `baseDioProvider` has no default ─────────────────────────────────
/// `core/` may not import `features/` (boundary gate rule 2), and the wired
/// base client — with its `RefreshInterceptor` bound to the auth repository's
/// `RefreshCoordinator` — is built in `features/auth/data`. So the composition
/// root overrides this, exactly as it already does for `authRepositoryProvider`.
/// The alternative (a second base-Dio builder living in `core/`) would mean two
/// refresh policies in one app, which is how they drift.
final baseDioProvider = Provider<Dio>((ref) {
  throw UnimplementedError(
    'baseDioProvider has no default — override it at the ProviderScope/'
    'ProviderContainer root with the wired client from createAuthClient() '
    '(app) or a fake (test). core/ cannot build it: the refresh interceptor '
    'needs the auth repository\'s RefreshCoordinator, and core/ may not '
    'import features/ (boundary gate rule 2).',
  );
});

/// Org-scoped client. Throws when there is no active shop — see below.
final orgDioProvider = Provider<Dio>((ref) {
  final orgId = ref.watch(activeOrgIdProvider);
  if (orgId == null) {
    // Loud, never a fallback. Reaching here means a screen that needs a shop
    // rendered without one, which is a routing bug: the guard should have sent
    // the person to the picker. A silent fallback would send org-scoped
    // requests with no org and turn a routing bug into a 422 the user cannot
    // act on — or worse, into a request whose scope nobody stated.
    throw StateError(
      'orgDioProvider read with no active org — the route guard should have '
      'redirected to the shop picker before this screen was built.',
    );
  }

  final base = ref.watch(baseDioProvider);

  // A NEW Dio sharing the base's adapter and options, not the base itself:
  // mutating the shared instance's interceptors would put an org header on
  // `/auth/*` and on the org list, which is the exact thing this file exists
  // to keep apart.
  final dio = Dio(base.options)..httpClientAdapter = base.httpClientAdapter;

  // Order matters. `X-Organization-Id` goes on with the auth header — i.e.
  // BEFORE the refresh/retry interceptors — so a replayed request still
  // belongs to the same shop. See `OrgHeaderInterceptor`'s note.
  final authAttach = base.interceptors.length;
  dio.interceptors.addAll(base.interceptors);
  dio.interceptors.insert(
    // After the base chain's auth attach, before refresh/error mapping. The
    // base chain is `HttpsGuard → AuthAttach → Refresh → ErrorMapping`, so
    // index 2 is the slot the architecture diagram names.
    authAttach >= 2 ? 2 : authAttach,
    OrgHeaderInterceptor(organizationId: orgId),
  );
  return dio;
});
