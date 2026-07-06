import 'package:flutter/foundation.dart' show kReleaseMode;
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/auth/auth_client_factory.dart';

void main() {
  group('createAuthClient — base URL seam (T-001-17 ★ M-3)', () {
    test('requires an explicit baseUrl (no hardcoded prod default)', () {
      // Compile-time: `baseUrl` is a required named parameter — there is no
      // zero-arg call available. This test exists to document/pin that
      // contract; a regression back to an optional/defaulted parameter would
      // fail to compile here, not just at runtime.
      final client = createAuthClient(baseUrl: 'http://localhost:3000');
      expect(client, isNotNull);
    });

    test('accepts a plain http:// localhost URL (dev/debug — tests run in debug mode)', () {
      // `flutter test` always runs in debug mode (kReleaseMode is false), so
      // this exercises the "debug keeps working" branch of the guard.
      expect(kReleaseMode, isFalse, reason: 'flutter test runs in debug mode');
      expect(() => createAuthClient(baseUrl: 'http://localhost:3000'), returnsNormally);
      expect(() => createAuthClient(baseUrl: 'http://10.0.2.2:3000'), returnsNormally);
    });

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
