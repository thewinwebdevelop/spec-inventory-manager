import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/core/l10n/l10n.dart';

/// R3 (docs/architecture/refactor-plan.md §4, mobile.md §3.4) — D-014: the
/// central taxonomy's mapping matrix + the compiler-exhaustive [failureMessage]
/// switch, both pure `dart test` (no Dio/platform channel needed).
void main() {
  group('mapStatusToApiFailure — status/code -> ApiFailure matrix', () {
    test('null status (no HTTP response at all) -> NetworkFailure', () {
      expect(mapStatusToApiFailure(null), isA<NetworkFailure>());
    });

    test('429 -> ThrottledFailure carrying retryAfterSeconds', () {
      final f = mapStatusToApiFailure(429, retryAfterSeconds: 42);
      expect(f, isA<ThrottledFailure>());
      expect((f as ThrottledFailure).retryAfterSeconds, 42);
    });

    test('401 -> AuthExpiredFailure carrying code', () {
      final f = mapStatusToApiFailure(401, code: 'INVALID_CREDENTIALS');
      expect(f, isA<AuthExpiredFailure>());
      expect((f as AuthExpiredFailure).code, 'INVALID_CREDENTIALS');
    });

    test('403 with an unrecognized code -> ForbiddenFailure (RBAC), not EntitlementFailure', () {
      final f = mapStatusToApiFailure(403, code: 'NOT_A_MEMBER');
      expect(f, isA<ForbiddenFailure>());
      expect((f as ForbiddenFailure).code, 'NOT_A_MEMBER');
    });

    test('403 with an ENTITLEMENT_-prefixed code -> EntitlementFailure', () {
      final f = mapStatusToApiFailure(403, code: 'ENTITLEMENT_ACCOUNTING');
      expect(f, isA<EntitlementFailure>());
      expect((f as EntitlementFailure).feature, 'ENTITLEMENT_ACCOUNTING');
    });

    test('403 with a TIER_-prefixed code -> EntitlementFailure', () {
      final f = mapStatusToApiFailure(403, code: 'TIER_PRO_REQUIRED');
      expect(f, isA<EntitlementFailure>());
    });

    test('403 with no code -> ForbiddenFailure (the safer default)', () {
      expect(mapStatusToApiFailure(403), isA<ForbiddenFailure>());
    });

    test('400 -> ValidationFailure with empty fieldErrors (wire envelope has none yet)', () {
      final f = mapStatusToApiFailure(400, code: 'BAD_REQUEST');
      expect(f, isA<ValidationFailure>());
      expect((f as ValidationFailure).fieldErrors, isEmpty);
    });

    test('422 -> ValidationFailure', () {
      expect(mapStatusToApiFailure(422), isA<ValidationFailure>());
    });

    test('409 -> ConflictFailure carrying code', () {
      final f = mapStatusToApiFailure(409, code: 'DOCUMENT_NUMBER_CONFLICT');
      expect(f, isA<ConflictFailure>());
      expect((f as ConflictFailure).code, 'DOCUMENT_NUMBER_CONFLICT');
    });

    test('404 -> NotFoundFailure', () {
      expect(mapStatusToApiFailure(404), isA<NotFoundFailure>());
    });

    test('426 -> ForceUpdateFailure', () {
      expect(mapStatusToApiFailure(426), isA<ForceUpdateFailure>());
    });

    test('500 -> ServerFailure', () {
      expect(mapStatusToApiFailure(500), isA<ServerFailure>());
    });

    test('an unrecognized status (e.g. 418) safely falls back to ServerFailure, never throws/drops', () {
      expect(mapStatusToApiFailure(418), isA<ServerFailure>());
    });
  });

  group('failureMessage — central Thai fallback, one branch per sealed subtype', () {
    final t = AppLocalizationsTh();

    test('NetworkFailure', () {
      expect(failureMessage(t, const NetworkFailure()), 'เชื่อมต่อไม่ได้ กรุณาลองใหม่');
    });

    test('AuthExpiredFailure reuses the ux-approved session-expired toast copy', () {
      expect(failureMessage(t, const AuthExpiredFailure()), 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
    });

    test('ServerFailure', () {
      expect(failureMessage(t, const ServerFailure()), 'ระบบขัดข้องชั่วคราว');
    });

    test('never renders the raw code/feature to the user for any variant', () {
      const withCode = ForbiddenFailure(code: 'SOME_INTERNAL_CODE');
      const withFeature = EntitlementFailure(feature: 'ENTITLEMENT_FOO');
      expect(failureMessage(t, withCode).contains('SOME_INTERNAL_CODE'), isFalse);
      expect(failureMessage(t, withFeature).contains('ENTITLEMENT_FOO'), isFalse);
    });

    test('every sealed subtype resolves to a non-empty message (exhaustive switch compiles + runs)', () {
      const failures = <ApiFailure>[
        NetworkFailure(),
        ThrottledFailure(),
        AuthExpiredFailure(),
        ForbiddenFailure(),
        EntitlementFailure(),
        ValidationFailure(),
        ConflictFailure(),
        NotFoundFailure(),
        ServerFailure(),
        ForceUpdateFailure(),
      ];
      for (final f in failures) {
        expect(failureMessage(t, f), isNotEmpty, reason: '$f produced an empty message');
      }
    });
  });
}
