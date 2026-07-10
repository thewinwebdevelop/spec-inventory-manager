import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/core/api/https_guard.dart';

void main() {
  group('guardBaseUrlForRelease — base URL seam (T-001-17 ★ M-3)', () {
    test('a non-https base URL in a hypothetical release build is rejected', () {
      // We can't flip the real `kReleaseMode` const from a test (it's
      // compiled in), so this test exercises the SAME validation the factory
      // runs by calling the guard logic directly against a fake "release"
      // flag — pinning the intended behavior (client-security M-3: prod
      // must be https, never a silent cleartext fallback).
      expect(
        () => guardBaseUrlForRelease('http://api.omnistock.example.com', isRelease: true),
        throwsArgumentError,
      );
      expect(
        () => guardBaseUrlForRelease('https://api.omnistock.example.com', isRelease: true),
        returnsNormally,
      );
      expect(
        () => guardBaseUrlForRelease('http://localhost:3000', isRelease: false),
        returnsNormally,
      );
    });
  });
}
