import 'package:dio/dio.dart';

/// T-002-M1 ★ — attaches `X-Organization-Id` to every request on an
/// org-scoped Dio (mobile.md §3.2, api-spec §1).
///
/// An interceptor rather than `options.headers`, and its POSITION in the chain
/// is the reason:
///
/// ```
/// HttpsGuard → AuthTokenInterceptor → OrgHeaderInterceptor
///            → RefreshInterceptor → RetryInterceptor → ErrorMapping
/// ```
///
/// `RefreshInterceptor` REPLAYS a request after a silent refresh, and
/// `RetryInterceptor` replays idempotent ones on a transient failure. Both
/// build the retry from `RequestOptions`. Anything set by an interceptor
/// EARLIER in the chain is already on those options and survives the replay;
/// anything applied later is not. Putting the org header here — above refresh,
/// like the auth header — is what makes a retried request still belong to the
/// same shop.
///
/// A base-options header would also survive, but it would be invisible to the
/// test that proves the retry carried it, and it would put the org somewhere a
/// caller could overwrite per request. This overwrites instead: the org comes
/// from the active session, never from what a call site passed in.
class OrgHeaderInterceptor extends Interceptor {
  OrgHeaderInterceptor({required this.organizationId});

  /// The shop this client is bound to. Read at construction, because the
  /// provider that builds this Dio is itself rebuilt when the active org
  /// changes — there is no such thing as "the same client, different shop".
  final String organizationId;

  static const String headerName = 'X-Organization-Id';

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    // Assignment, not `putIfAbsent`: a value a call site supplied is either
    // the same one (harmless) or a different shop (a bug we must not honour).
    options.headers[headerName] = organizationId;
    handler.next(options);
  }
}
