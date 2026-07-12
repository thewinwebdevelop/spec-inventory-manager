import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/core/api/refresh_coordinator.dart';
import 'package:mobile/core/api/refresh_interceptor.dart';

import '../../features/auth/data/fake_dio_adapter.dart';

/// R2 (docs/architecture/refactor-plan.md §4, mobile.md §3.1) — D-014: the
/// new central interceptor gets its own test, independent of any feature
/// repository (`features/auth/data/auth_repository_impl_test.dart` already
/// pins auth's own behavior through its extensive pre-existing suite,
/// UNCHANGED by this batch). This file drives [RefreshInterceptor] directly
/// against a [FakeHttpClientAdapter] the same way that suite does — 401 ->
/// refresh -> replay, concurrent single-flight, terminal wipe.
void main() {
  // A fake doRefresh/onLogout pair — RefreshInterceptor only cares about the
  // RefreshCoordinator contract (RefreshOutcome + a logout callback), not
  // token persistence, so no TokenStore/AuthApi is needed here at all.
  late int doRefreshCalls;
  late int onLogoutCalls;
  late RefreshOutcome Function() nextOutcome;

  RefreshCoordinator buildCoordinator() {
    doRefreshCalls = 0;
    onLogoutCalls = 0;
    nextOutcome = () => RefreshOutcome.success;
    return RefreshCoordinator(
      doRefresh: () async {
        doRefreshCalls++;
        return nextOutcome();
      },
      onLogout: () async {
        onLogoutCalls++;
      },
    );
  }

  // Mirrors `auth_client_factory.dart`'s two-Dio split: the retry MUST go
  // through a Dio that does not carry this SAME `RefreshInterceptor` (else
  // the retry re-enters the interceptor's own queue from within the
  // still-open `onError` awaiting it — a self-deadlock, see
  // `core/api/refresh_interceptor.dart`'s class doc). Both share the SAME
  // adapter so the test's response queue is a single, ordered source of
  // truth for every request (original + retry) regardless of which Dio
  // issued it.
  Dio buildDio(FakeHttpClientAdapter adapter, RefreshCoordinator coordinator) {
    final dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000'));
    dio.httpClientAdapter = adapter;
    final retryDio = Dio(BaseOptions(baseUrl: 'http://localhost:3000'));
    retryDio.httpClientAdapter = adapter;
    dio.interceptors.add(RefreshInterceptor(retryDio: retryDio, refreshCoordinator: coordinator));
    return dio;
  }

  Options bearerOptions({Map<String, dynamic>? extra}) => Options(
        extra: {
          'secure': [
            {'type': 'http', 'scheme': 'bearer', 'name': 'bearerAuth'},
          ],
          ...?extra,
        },
      );

  Options publicOptions() => Options(extra: {'secure': <Map<String, String>>[]});

  group('bearer-scoped 401 -> refresh -> retry succeeds', () {
    test('resolves the ORIGINAL request with the retried response, exactly 2 requests total', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(
        statusCode: 401,
        jsonBody: {
          'error': {'code': 'INVALID_CREDENTIALS', 'message': 'expired'},
        },
      ));
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {'ok': true}));
      final coordinator = buildCoordinator();
      final dio = buildDio(adapter, coordinator);

      final res = await dio.get<Map>('/whatever', options: bearerOptions());

      expect(res.statusCode, 200);
      expect(res.data, {'ok': true});
      expect(adapter.capturedRequests, hasLength(2));
      expect(doRefreshCalls, 1);
      expect(onLogoutCalls, 0);
    });

    test('the retried request carries a marker preventing a second retry attempt', () async {
      // If the retry itself somehow 401s again with authExpiry, the
      // interceptor's own recursion guard (not a second refresh) must be
      // what stops it — covered by the "still 401s" group below. This test
      // just pins that the retry is issued via `dio.fetch` (re-enters the
      // full chain) rather than a bespoke bypass.
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 401, jsonBody: {
        'error': {'code': 'X', 'message': 'x'},
      }));
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {'ok': true}));
      final coordinator = buildCoordinator();
      final dio = buildDio(adapter, coordinator);

      await dio.get<Map>('/whatever', options: bearerOptions());

      // Second captured request (the retry) must be a GET to the same path.
      expect(adapter.capturedRequests[1].method, 'GET');
      expect(adapter.capturedRequests[1].path, adapter.capturedRequests[0].path);
    });
  });

  group('missing generation stamp — fails toward a REAL refresh (★ sanity-pass fix)', () {
    test('a 401 whose options lost the stamp refreshes again instead of skipping', () async {
      final adapter = FakeHttpClientAdapter();
      // Request 1: 401 -> refresh #1 (generation 0 -> 1) -> retry 200.
      adapter.enqueue(FakeResponse(statusCode: 401, jsonBody: {
        'error': {'code': 'X', 'message': 'x'},
      }));
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {'ok': true}));
      // Request 2 (stamp stripped): 401 -> MUST refresh #2 -> retry 200.
      adapter.enqueue(FakeResponse(statusCode: 401, jsonBody: {
        'error': {'code': 'X', 'message': 'x'},
      }));
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {'ok': true}));
      final coordinator = buildCoordinator();
      final dio = buildDio(adapter, coordinator);
      // Strip the stamp AFTER RefreshInterceptor.onRequest ran (a later
      // interceptor in the chain sees options later) — simulates any future
      // code path whose options bypassed onRequest.
      dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) {
        options.extra.remove('_refreshInterceptorGeneration');
        handler.next(options);
      }));

      await dio.get<Map>('/first', options: bearerOptions());
      expect(doRefreshCalls, 1);

      final res = await dio.get<Map>('/second', options: bearerOptions());
      expect(res.statusCode, 200);
      // The old `?? 0` default read "generation 1 > 0" => skip path =>
      // retry with a possibly-dead token; the fix defaults the missing
      // stamp to the CURRENT generation, forcing a second real refresh.
      expect(doRefreshCalls, 2);
      expect(onLogoutCalls, 0);
    });
  });

  group('non-bearer (security: []) endpoints — never eligible for refresh', () {
    test('login/signup/logoutDevice/refresh-shaped requests pass a 401 through untouched', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 401, jsonBody: {
        'error': {'code': 'INVALID_CREDENTIALS', 'message': 'bad creds'},
      }));
      final coordinator = buildCoordinator();
      final dio = buildDio(adapter, coordinator);

      await expectLater(
        () => dio.get<Map>('/whatever', options: publicOptions()),
        throwsA(isA<DioException>().having((e) => e.response?.statusCode, 'status', 401)),
      );
      expect(adapter.capturedRequests, hasLength(1));
      expect(doRefreshCalls, 0, reason: 'security: [] endpoints must never trigger a refresh attempt (R2)');
    });
  });

  group('non-401 errors — untouched regardless of bearer scope', () {
    test('a 500 on a bearer-scoped call passes through without attempting refresh', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 500, jsonBody: {
        'error': {'code': 'INTERNAL', 'message': 'boom'},
      }));
      final coordinator = buildCoordinator();
      final dio = buildDio(adapter, coordinator);

      await expectLater(
        () => dio.get<Map>('/whatever', options: bearerOptions()),
        throwsA(isA<DioException>().having((e) => e.response?.statusCode, 'status', 500)),
      );
      expect(doRefreshCalls, 0);
    });
  });

  group('authExpiryOverride — per-request escape hatch (mirrors changePassword)', () {
    test('override returning false skips refresh entirely, error passes through', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 401, jsonBody: {
        'error': {'code': 'INVALID_CREDENTIALS', 'message': 'wrong current password'},
      }));
      final coordinator = buildCoordinator();
      final dio = buildDio(adapter, coordinator);

      await expectLater(
        () => dio.get<Map>(
          '/whatever',
          options: bearerOptions(extra: {
            'authExpiryOverride': (String? code) => code != 'INVALID_CREDENTIALS',
          }),
        ),
        throwsA(isA<DioException>().having((e) => e.response?.statusCode, 'status', 401)),
      );
      expect(adapter.capturedRequests, hasLength(1));
      expect(doRefreshCalls, 0);
    });

    test('override returning true (a bare 401, e.g. dead access token) still triggers refresh', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 401));
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {'ok': true}));
      final coordinator = buildCoordinator();
      final dio = buildDio(adapter, coordinator);

      final res = await dio.get<Map>(
        '/whatever',
        options: bearerOptions(extra: {
          'authExpiryOverride': (String? code) => code != 'INVALID_CREDENTIALS',
        }),
      );

      expect(res.statusCode, 200);
      expect(doRefreshCalls, 1);
    });
  });

  group('terminal failures — session-expired funnel + wipe', () {
    test('refresh itself fails -> rejects with SessionExpiredException, no retry issued, no extra wipe call', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 401, jsonBody: {
        'error': {'code': 'INVALID_CREDENTIALS', 'message': 'expired'},
      }));
      final coordinator = buildCoordinator();
      nextOutcome = () => RefreshOutcome.sessionExpired;
      final dio = buildDio(adapter, coordinator);

      await expectLater(
        () => dio.get<Map>('/whatever', options: bearerOptions()),
        throwsA(isA<DioException>().having((e) => e.error, 'error', isA<SessionExpiredException>())),
      );
      expect(adapter.capturedRequests, hasLength(1), reason: 'no retry when refresh itself failed');
      expect(doRefreshCalls, 1);
      // RefreshCoordinator's own doRefresh is responsible for wiping on a
      // dead-refresh-token outcome (unchanged, per-feature) — the
      // interceptor's OWN forceLogout() is reserved for the "refresh
      // succeeded but retry still 401s" case (see next test), so it must
      // NOT double-call onLogout here.
      expect(onLogoutCalls, 0);
    });

    test('refresh succeeds but the retried call STILL 401s -> forceLogout + SessionExpiredException, never loops again', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 401, jsonBody: {
        'error': {'code': 'INVALID_CREDENTIALS', 'message': 'expired'},
      }));
      adapter.enqueue(FakeResponse(statusCode: 401, jsonBody: {
        'error': {'code': 'INVALID_CREDENTIALS', 'message': 'still dead'},
      }));
      final coordinator = buildCoordinator();
      final dio = buildDio(adapter, coordinator);

      await expectLater(
        () => dio.get<Map>('/whatever', options: bearerOptions()),
        throwsA(isA<DioException>().having((e) => e.error, 'error', isA<SessionExpiredException>())),
      );
      // Exactly 2 requests: original + retry-once. No further loop.
      expect(adapter.capturedRequests, hasLength(2));
      expect(doRefreshCalls, 1);
      expect(onLogoutCalls, 1);
    });
  });

  group('single-flight — concurrent 401s share exactly ONE refresh', () {
    test('3 concurrent bearer-scoped requests that all 401 trigger exactly one doRefresh call', () async {
      final adapter = FakeHttpClientAdapter();
      // 3 original calls -> all 401.
      for (var i = 0; i < 3; i++) {
        adapter.enqueue(FakeResponse(statusCode: 401, jsonBody: {
          'error': {'code': 'INVALID_CREDENTIALS', 'message': 'expired'},
        }));
      }
      // The gated refresh — held open so all 3 requests are provably queued
      // behind it before any of them observes a result (mirrors
      // `auth_repository_impl_test.dart`'s single-flight test).
      final refreshGate = Completer<RefreshOutcome>();
      final coordinator = RefreshCoordinator(
        doRefresh: () {
          doRefreshCalls++;
          return refreshGate.future;
        },
        onLogout: () async {
          onLogoutCalls++;
        },
      );
      doRefreshCalls = 0;
      onLogoutCalls = 0;
      final dio = buildDio(adapter, coordinator);
      // 3 retry responses queued for once the refresh resolves.
      for (var i = 0; i < 3; i++) {
        adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {'ok': true}));
      }

      final call1 = dio.get<Map>('/a', options: bearerOptions());
      final call2 = dio.get<Map>('/b', options: bearerOptions());
      final call3 = dio.get<Map>('/c', options: bearerOptions());

      // Let the 3 original requests actually reach the adapter and their
      // onError handlers start (QueuedInterceptor serializes them — the
      // FIRST one to hit the gate is what matters here).
      await pumpEventQueue();

      expect(doRefreshCalls, 1, reason: 'single-flight: only the first 401 should start a refresh');

      refreshGate.complete(RefreshOutcome.success);

      final results = await Future.wait([call1, call2, call3]);
      expect(results.map((r) => r.statusCode), [200, 200, 200]);
      // Still exactly one refresh after all 3 settled.
      expect(doRefreshCalls, 1);
    });
  });
}
