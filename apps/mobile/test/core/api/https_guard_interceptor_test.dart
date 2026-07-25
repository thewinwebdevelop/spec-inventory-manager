import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/core/api/https_guard_interceptor.dart';

import '../../features/auth/data/fake_dio_adapter.dart';

void main() {
  group('HttpsGuardInterceptor — per-request https-in-release re-check (T-001-17 ★ M-3)', () {
    test('rejects a plaintext http request in a (simulated) release build', () async {
      final adapter = FakeHttpClientAdapter();
      final dio = Dio(BaseOptions(baseUrl: 'http://api.omnistock.example.com'));
      dio.httpClientAdapter = adapter;
      dio.interceptors.add(HttpsGuardInterceptor(isRelease: true));

      await expectLater(
        () => dio.get('/whatever'),
        throwsA(isA<DioException>().having((e) => e.error, 'error', isA<ArgumentError>())),
      );
      expect(adapter.capturedRequests, isEmpty, reason: 'the request must never reach the network');
    });

    test('allows https in a (simulated) release build', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {'ok': true}));
      final dio = Dio(BaseOptions(baseUrl: 'https://api.omnistock.example.com'));
      dio.httpClientAdapter = adapter;
      dio.interceptors.add(HttpsGuardInterceptor(isRelease: true));

      final res = await dio.get('/whatever');
      expect(res.statusCode, 200);
    });

    test('allows plaintext http outside release (local dev)', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {'ok': true}));
      final dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000'));
      dio.httpClientAdapter = adapter;
      dio.interceptors.add(HttpsGuardInterceptor(isRelease: false));

      final res = await dio.get('/whatever');
      expect(res.statusCode, 200);
    });
  });
}
