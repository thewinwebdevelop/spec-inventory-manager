import 'package:dio/dio.dart';

import 'error_mapping.dart';

/// R2/R3 (docs/architecture/refactor-plan.md §4, mobile.md §3.4) — the LAST
/// link of the chain: decorates every `DioException` with the central
/// [ApiFailure] taxonomy (`err.error`), via [mapDioExceptionToApiFailure],
/// so a repository can do `catch (e) { throw e.error is ApiFailure ? e.error
/// as ApiFailure : const ServerFailure(); }` instead of re-deriving
/// status/code parsing per feature. Auth's OWN `ApiError` mapping
/// (`_mapDioError` in `features/auth/data/auth_repository_impl.dart`) is
/// untouched by this — it reads `e.response` directly, never `e.error`, so
/// this decoration is inert for auth today and purely additive for future
/// repositories.
///
/// `err.copyWith(error: failure)` — `DioException` is immutable; this
/// produces a new instance carrying the SAME request/response/stack trace
/// with only `.error` replaced, then continues the chain with THAT instance
/// so every interceptor "before" this one (added earlier in the list — which
/// see it AFTER this one, since `onError` unwinds in reverse-of-add order)
/// observes the decorated failure too.
class ErrorMappingInterceptor extends Interceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final failure = mapDioExceptionToApiFailure(err);
    handler.next(err.copyWith(error: failure));
  }
}
