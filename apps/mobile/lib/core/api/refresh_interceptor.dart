import 'package:dio/dio.dart';

import 'error_mapping.dart';
import 'refresh_coordinator.dart';
import 'request_security.dart';

/// R2 (docs/architecture/refactor-plan.md §4, mobile.md §3.1) — lifts
/// silent-refresh-then-retry-once from the per-repository
/// `RefreshCoordinator.requestWithRefresh` wrapper (still present, UNCHANGED,
/// on `RefreshCoordinator` itself — kept for any direct/non-Dio caller) into
/// a `QueuedInterceptor` every request on this Dio gets for free. Reuses the
/// SAME [RefreshCoordinator] instance a repository already owns (single-
/// flight dedupe is per-COORDINATOR-instance, not per-interceptor — see
/// `features/auth/data/auth_client_factory.dart` for how the two get wired
/// to the identical instance).
///
/// `QueuedInterceptor` (not plain `Interceptor`): while THIS interceptor's
/// `onError` is awaiting a refresh, Dio queues every OTHER request's error
/// handling behind it (verified empirically — see this file's test). A
/// request that was merely queued behind another's in-flight refresh (not
/// truly concurrent with it) gets its turn only AFTER that refresh already
/// completed; [_generationAtSend] + [RefreshCoordinator.generation] detect
/// that case and retry directly with the now-current token instead of
/// firing a second, redundant network refresh (mobile.md §3.4 "queue
/// request อื่นระหว่าง refresh").
///
/// [retryDio] — deliberately a DIFFERENT [Dio] instance than the one this
/// interceptor is attached to (though normally sharing the same
/// `httpClientAdapter`/base config — see `auth_client_factory.dart`).
/// Retrying via `THIS interceptor's own dio.fetch(...)` would re-enter this
/// SAME `QueuedInterceptor`'s queue from WITHIN an unresolved `onError`
/// call on that exact queue — a self-deadlock (confirmed empirically: the
/// retry's own error can never be processed because the queue is still
/// held by the very `onError` invocation awaiting it). [retryDio] carries
/// the other interceptors (https guard, auth-attach, error-mapping) so the
/// retry still gets a fresh token attached etc., just not a second
/// `RefreshInterceptor`.
///
/// Endpoint eligibility is READ FROM THE CONTRACT
/// ([requestWantsBearerAuth]), not a per-repository flag — an endpoint with
/// `security: []` (login/signup/logout/the refresh call itself) is
/// structurally never eligible, which is exactly "no refresh attempt for
/// endpoints where that's wrong" without anyone needing to remember to say
/// so per call site.
///
/// `options.extra['authExpiryOverride']` (`bool Function(String? code)?`) —
/// escape hatch for the one documented double-duty-401 endpoint
/// (`changePassword`: a 401 with `code == 'INVALID_CREDENTIALS'` means
/// "wrong current password", NOT "access token died" — see
/// `features/auth/data/auth_repository_impl.dart`'s `changePassword` doc
/// comment). Defaults to "every 401 on a bearer-scoped endpoint is auth
/// expiry" when absent.
class RefreshInterceptor extends QueuedInterceptor {
  RefreshInterceptor({required this.retryDio, required this.refreshCoordinator});

  final Dio retryDio;
  final RefreshCoordinator refreshCoordinator;

  static const _retriedFlag = '_refreshInterceptorRetried';
  static const _generationKey = '_refreshInterceptorGeneration';

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    // Stamp the coordinator's generation at SEND time (cheap, every
    // request) — see class doc: this is what lets a request that was only
    // QUEUED (not truly racing) detect a refresh already happened.
    options.extra[_generationKey] = refreshCoordinator.generation;
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final options = err.requestOptions;

    // Never recurse onto a request this interceptor already retried once.
    if (options.extra[_retriedFlag] == true) {
      handler.next(err);
      return;
    }
    if (!requestWantsBearerAuth(options) || err.response?.statusCode != 401) {
      handler.next(err);
      return;
    }
    if (!_isAuthExpiry(err, options)) {
      handler.next(err);
      return;
    }

    // Missing stamp (options that somehow bypassed onRequest) must fail
    // toward a REAL refresh, never toward the skip path: defaulting to the
    // coordinator's CURRENT generation makes `alreadyRotated` false, so we
    // refresh rather than retry a possibly-dead token straight into
    // `forceLogout()` (★ sanity-pass finding, 2026-07-11).
    final sentGeneration =
        options.extra[_generationKey] as int? ?? refreshCoordinator.generation;
    final alreadyRotated = refreshCoordinator.generation > sentGeneration;

    if (!alreadyRotated) {
      // Single-flight refresh (mirrors `requestWithRefresh`'s `refresh()`
      // call exactly — the bool projection, not `refreshDetailed()`: a
      // per-REQUEST retry decision only ever needs "did this unblock the
      // request", never the transient-vs-terminal distinction cold-start
      // bootstrap needs).
      final refreshed = await refreshCoordinator.refresh();
      if (!refreshed) {
        handler.reject(_sessionExpired(options));
        return;
      }
    }
    // else: a DIFFERENT request's refresh already completed while this one
    // sat in the queue — skip straight to retrying with the now-current
    // token (avoids a second, redundant `/auth/refresh` call).

    try {
      final retryOptions = options.copyWith(
        extra: {...options.extra, _retriedFlag: true},
      );
      final response = await retryDio.fetch(retryOptions);
      handler.resolve(response);
    } on DioException catch (retryErr) {
      if (retryErr.response?.statusCode == 401 && _isAuthExpiry(retryErr, options)) {
        // Refreshed successfully but the retried call STILL failed the same
        // way (e.g. kicked mid-flight) — do not loop again; wipe now, since
        // the refresh itself succeeded (RefreshCoordinator's own dead-token
        // wipe branch did NOT fire for this outcome).
        await refreshCoordinator.forceLogout();
        handler.reject(_sessionExpired(options));
      } else {
        handler.next(retryErr);
      }
    }
  }

  bool _isAuthExpiry(DioException err, RequestOptions options) {
    final override = options.extra['authExpiryOverride'];
    if (override is bool Function(String?)) {
      return override(extractErrorCode(err.response?.data));
    }
    return true;
  }

  DioException _sessionExpired(RequestOptions options) => DioException(
        requestOptions: options,
        error: const SessionExpiredException(),
        type: DioExceptionType.unknown,
      );
}
