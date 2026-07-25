import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/core/api/request_security.dart';

void main() {
  group('requestWantsBearerAuth', () {
    test('true when extra.secure contains a bearer-scheme entry (generated client shape)', () {
      final options = RequestOptions(path: '/x', extra: {
        'secure': [
          {'type': 'http', 'scheme': 'bearer', 'name': 'bearerAuth'},
        ],
      });
      expect(requestWantsBearerAuth(options), isTrue);
    });

    test('false for an empty secure list (security: [] endpoints — login/signup/logout/refresh)', () {
      final options = RequestOptions(path: '/x', extra: {'secure': <Map<String, String>>[]});
      expect(requestWantsBearerAuth(options), isFalse);
    });

    test('false when extra has no secure key at all', () {
      final options = RequestOptions(path: '/x');
      expect(requestWantsBearerAuth(options), isFalse);
    });

    test('false when secure is present but carries a non-bearer scheme only', () {
      final options = RequestOptions(path: '/x', extra: {
        'secure': [
          {'type': 'apiKey', 'name': 'x-api-key'},
        ],
      });
      expect(requestWantsBearerAuth(options), isFalse);
    });
  });
}
