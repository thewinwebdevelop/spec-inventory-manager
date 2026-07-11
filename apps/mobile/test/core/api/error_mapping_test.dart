import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/core/api/error_mapping.dart';
import 'package:mobile/core/error/api_failure.dart';

void main() {
  group('extractErrorCode', () {
    test('reads error.code from a decoded wire-envelope Map', () {
      expect(extractErrorCode({
        'error': {'code': 'INVALID_CREDENTIALS', 'message': 'x'},
      }), 'INVALID_CREDENTIALS');
    });

    test('returns null for a malformed/absent body (broken proxy/CDN)', () {
      expect(extractErrorCode(null), isNull);
      expect(extractErrorCode('not a map'), isNull);
      expect(extractErrorCode(<String, dynamic>{}), isNull);
      expect(extractErrorCode({'error': 'not a map'}), isNull);
    });
  });

  group('extractRetryAfterSeconds', () {
    test('parses the Retry-After header', () {
      expect(extractRetryAfterSeconds({'retry-after': ['42']}), 42);
    });

    test('checks the capitalized casing too', () {
      expect(extractRetryAfterSeconds({'Retry-After': ['7']}), 7);
    });

    test('null when absent', () {
      expect(extractRetryAfterSeconds({}), isNull);
    });
  });

  group('mapDioExceptionToApiFailure', () {
    test('no response at all -> NetworkFailure', () {
      final e = DioException(
        requestOptions: RequestOptions(path: '/x'),
        type: DioExceptionType.connectionTimeout,
      );
      expect(mapDioExceptionToApiFailure(e), isA<NetworkFailure>());
    });

    test('a real 401 response with a code -> AuthExpiredFailure carrying that code', () {
      final options = RequestOptions(path: '/x');
      final e = DioException(
        requestOptions: options,
        response: Response(
          requestOptions: options,
          statusCode: 401,
          data: {
            'error': {'code': 'INVALID_CREDENTIALS', 'message': 'expired'},
          },
        ),
        type: DioExceptionType.badResponse,
      );
      final failure = mapDioExceptionToApiFailure(e);
      expect(failure, isA<AuthExpiredFailure>());
      expect((failure as AuthExpiredFailure).code, 'INVALID_CREDENTIALS');
    });

    test('a 429 with a Retry-After header -> ThrottledFailure carrying the seconds', () {
      final options = RequestOptions(path: '/x');
      final e = DioException(
        requestOptions: options,
        response: Response(
          requestOptions: options,
          statusCode: 429,
          headers: Headers.fromMap({
            'retry-after': ['30'],
          }),
          data: {
            'error': {'code': 'RATE_LIMITED', 'message': 'slow down'},
          },
        ),
        type: DioExceptionType.badResponse,
      );
      final failure = mapDioExceptionToApiFailure(e);
      expect(failure, isA<ThrottledFailure>());
      expect((failure as ThrottledFailure).retryAfterSeconds, 30);
    });
  });
}
