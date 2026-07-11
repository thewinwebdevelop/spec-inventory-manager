import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/core/api/error_mapping_interceptor.dart';
import 'package:mobile/core/error/api_failure.dart';

import '../../features/auth/data/fake_dio_adapter.dart';

void main() {
  test('decorates a DioException.error with the mapped ApiFailure, request/response untouched', () async {
    final adapter = FakeHttpClientAdapter();
    adapter.enqueue(FakeResponse(statusCode: 404, jsonBody: {
      'error': {'code': 'NOT_FOUND', 'message': 'gone'},
    }));
    final dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000'));
    dio.httpClientAdapter = adapter;
    dio.interceptors.add(ErrorMappingInterceptor());

    await expectLater(
      () => dio.get('/whatever'),
      throwsA(isA<DioException>()
          .having((e) => e.error, 'error', isA<NotFoundFailure>())
          .having((e) => e.response?.statusCode, 'response.statusCode', 404)),
    );
  });
}
