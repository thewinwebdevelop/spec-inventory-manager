import 'package:dio/dio.dart';

import 'request_security.dart';

/// R2 (docs/architecture/refactor-plan.md §4, mobile.md §3.1/§3.4) —
/// attaches `Authorization: Bearer <token>` to every outgoing request whose
/// generated-client `security` requirement wants one
/// ([requestWantsBearerAuth]) — future repositories get this for free
/// ("Repositories then make plain calls" — no per-call `_bearerOptions()`
/// boilerplate to remember, unlike the pre-R2 pattern).
///
/// [getAccessToken] is a callback, not a stored token, so the interceptor
/// always reads the CURRENT value (e.g. right after a refresh rotated it —
/// critical for `core/api/refresh_interceptor.dart`'s retry-once, which
/// re-enters the request pipeline through this same interceptor to pick up
/// the freshly-rotated token). Mirrors `TokenStore.accessToken`'s existing
/// "in-memory only" contract (client-security skill) — this interceptor
/// never persists anything itself.
///
/// Seam for F-002 (commented, NOT built — do not add org header logic here):
/// the org-scoped Dio (`orgDioProvider`, mobile.md §3.2) will add an
/// `OrgHeaderInterceptor` ALONGSIDE this one on the org-scoped client only
/// (auth's own base client stays org-agnostic, login/sessions have no org
/// context) — that interceptor doesn't exist yet and nothing here should be
/// stretched to fake it.
class AuthTokenInterceptor extends Interceptor {
  AuthTokenInterceptor({required this.getAccessToken});

  final String? Function() getAccessToken;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (requestWantsBearerAuth(options)) {
      final token = getAccessToken();
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      }
    }
    handler.next(options);
  }
}
