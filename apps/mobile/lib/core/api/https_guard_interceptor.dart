import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show kReleaseMode;

import 'https_guard.dart';

/// R2 (docs/architecture/refactor-plan.md §4, mobile.md §3.1) — the FIRST
/// link of the interceptor chain: a per-REQUEST re-check of the same guard
/// `features/auth/data/auth_client_factory.dart` already runs once at
/// construction time against the base URL (`guardBaseUrlForRelease`, kept
/// UNCHANGED — this interceptor calls the same pure function, doesn't
/// duplicate its logic). Defense in depth for anything that could make a
/// per-request URL diverge from the base URL validated at construction
/// (redirects, absolute URLs passed to a single call, a future multi-origin
/// Dio) — never lets a release build send a plaintext request.
///
/// `handler.reject(...)` rather than letting [guardBaseUrlForRelease]'s
/// `ArgumentError` throw synchronously out of `onRequest` — Dio interceptors
/// are expected to report failures through the handler, not via an
/// uncaught synchronous throw.
class HttpsGuardInterceptor extends Interceptor {
  HttpsGuardInterceptor({bool? isRelease}) : _isRelease = isRelease ?? kReleaseMode;

  final bool _isRelease;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    try {
      guardBaseUrlForRelease(options.uri.toString(), isRelease: _isRelease);
    } on ArgumentError catch (e, stackTrace) {
      handler.reject(
        DioException(
          requestOptions: options,
          error: e,
          stackTrace: stackTrace,
          type: DioExceptionType.unknown,
        ),
      );
      return;
    }
    handler.next(options);
  }
}
