import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/core/api/auth_token_interceptor.dart';

import '../../features/auth/data/fake_dio_adapter.dart';

void main() {
  group('AuthTokenInterceptor', () {
    test('attaches Authorization: Bearer <token> to a bearer-scoped request', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {'ok': true}));
      final dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000'));
      dio.httpClientAdapter = adapter;
      dio.interceptors.add(AuthTokenInterceptor(getAccessToken: () => 'the-access-token'));

      await dio.get(
        '/whatever',
        options: Options(extra: {
          'secure': [
            {'scheme': 'bearer'},
          ],
        }),
      );

      expect(adapter.capturedRequests.single.headers['Authorization'], 'Bearer the-access-token');
    });

    test('does NOT attach a header to a security:[] request (login/signup/logout/refresh shape)', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {'ok': true}));
      final dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000'));
      dio.httpClientAdapter = adapter;
      dio.interceptors.add(AuthTokenInterceptor(getAccessToken: () => 'the-access-token'));

      await dio.get('/whatever', options: Options(extra: {'secure': <Map<String, String>>[]}));

      expect(adapter.capturedRequests.single.headers.containsKey('Authorization'), isFalse);
    });

    test('omits the header (does not send "Bearer null") when no token is available yet', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {'ok': true}));
      final dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000'));
      dio.httpClientAdapter = adapter;
      dio.interceptors.add(AuthTokenInterceptor(getAccessToken: () => null));

      await dio.get(
        '/whatever',
        options: Options(extra: {
          'secure': [
            {'scheme': 'bearer'},
          ],
        }),
      );

      expect(adapter.capturedRequests.single.headers.containsKey('Authorization'), isFalse);
    });

    test('always reads the CURRENT token (a closure, not a snapshot) — picks up rotation', () async {
      final adapter = FakeHttpClientAdapter();
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {'ok': true}));
      adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {'ok': true}));
      var token = 'first';
      final dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000'));
      dio.httpClientAdapter = adapter;
      dio.interceptors.add(AuthTokenInterceptor(getAccessToken: () => token));
      final opts = Options(extra: {
        'secure': [
          {'scheme': 'bearer'},
        ],
      });

      await dio.get('/whatever', options: opts);
      token = 'rotated';
      await dio.get('/whatever', options: opts);

      expect(adapter.capturedRequests[0].headers['Authorization'], 'Bearer first');
      expect(adapter.capturedRequests[1].headers['Authorization'], 'Bearer rotated');
    });
  });
}
