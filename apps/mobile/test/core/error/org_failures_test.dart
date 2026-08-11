// T-002-M2 ★ — the two 403s and the two 409s, on mobile.
//
// Same decisions as the web client, for the same reasons: api-spec §4 and
// ux-wireframe §12 give the two 403s OPPOSITE behaviour, and §1.4 requires
// `busy` to be recognised before any screen's own 409 copy.
//
// Driven from the WIRE ENVELOPE through `mapDioExceptionToApiFailure`, not by
// calling the pure mapper with hand-made arguments — the F-002 API had a bug
// (`describeOrgBusy`) that survived its own test precisely because the test
// built the classifier's input instead of the response it classifies.
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/error_mapping.dart';
import 'package:mobile/core/error/api_failure.dart';

DioException _wire(int status, Map<String, Object?> error) {
  final options = RequestOptions(path: '/orgs/org_1/members');
  return DioException(
    requestOptions: options,
    response: Response<Object?>(
      requestOptions: options,
      statusCode: status,
      data: <String, Object?>{'error': error},
    ),
  );
}

void main() {
  group('the two 403s', () {
    test('★ ORG_ACCESS_DENIED is its own failure, never Forbidden', () {
      final f = mapDioExceptionToApiFailure(
        _wire(403, {'code': 'ORG_ACCESS_DENIED', 'message': 'ไม่ใช่สมาชิก'}),
      );
      expect(f, isA<OrgAccessDeniedFailure>());
      expect(f, isNot(isA<ForbiddenFailure>()));
    });

    test('★ FORBIDDEN stays Forbidden and keeps its code', () {
      final f = mapDioExceptionToApiFailure(_wire(403, {'code': 'FORBIDDEN', 'message': 'x'}));
      expect(f, isA<ForbiddenFailure>());
      expect((f as ForbiddenFailure).code, 'FORBIDDEN');
    });

    test('★ a screen cannot handle both with one branch — they are different types', () {
      // The regression this guards: one drops the active shop and navigates
      // to the picker, the other stays put. Sharing a type means a handler
      // written for one silently does the wrong thing for the other, and one
      // of those wrong things is evicting a member who is still a member.
      final denied = mapDioExceptionToApiFailure(_wire(403, {'code': 'ORG_ACCESS_DENIED'}));
      final forbidden = mapDioExceptionToApiFailure(_wire(403, {'code': 'FORBIDDEN'}));
      expect(denied.runtimeType, isNot(forbidden.runtimeType));
    });

    test('★ an UNKNOWN 403 code stays Forbidden — the non-destructive reading', () {
      // Guessing OrgAccessDenied would throw somebody out of their shop on
      // any 403 this build has not seen before.
      expect(
        mapDioExceptionToApiFailure(_wire(403, {'code': 'SOMETHING_NEW'})),
        isA<ForbiddenFailure>(),
      );
      expect(mapDioExceptionToApiFailure(_wire(403, {})), isA<ForbiddenFailure>());
    });

    test('INVITATION_EMAIL_MISMATCH is a plain Forbidden — nobody is being removed', () {
      expect(
        mapDioExceptionToApiFailure(_wire(403, {'code': 'INVITATION_EMAIL_MISMATCH'})),
        isA<ForbiddenFailure>(),
      );
    });

    test('the entitlement axis is untouched', () {
      expect(
        mapDioExceptionToApiFailure(_wire(403, {'code': 'ENTITLEMENT_REQUIRED'})),
        isA<EntitlementFailure>(),
      );
    });
  });

  group('the two 409s', () {
    test('★ details.reason = "busy" is BusyFailure', () {
      final f = mapDioExceptionToApiFailure(_wire(409, {
        'code': 'CONFLICT',
        'message': 'x',
        'details': {'reason': 'busy'},
      }));
      expect(f, isA<BusyFailure>());
    });

    test('★ busy wins over the screen-specific 409 copy (§1.4 ordering)', () {
      // A cancel-invitation call that loses the row lock comes back as
      // `409 CONFLICT { reason: "busy" }`. Reporting the screen's own conflict
      // copy would be a lie: the invitation is fine, the shop was busy.
      final f = mapDioExceptionToApiFailure(_wire(409, {
        'code': 'CONFLICT',
        'details': {'reason': 'busy'},
      }));
      expect(f, isA<BusyFailure>());
      expect(f, isNot(isA<ConflictFailure>()));
    });

    test('a 409 with no reason keeps its code for the screen to switch on', () {
      final f = mapDioExceptionToApiFailure(_wire(409, {'code': 'LAST_OWNER'}));
      expect(f, isA<ConflictFailure>());
      expect((f as ConflictFailure).code, 'LAST_OWNER');
    });

    test('only the exact string "busy" counts', () {
      expect(
        mapDioExceptionToApiFailure(_wire(409, {
          'code': 'CONFLICT',
          'details': {'reason': 'BUSY'},
        })),
        isA<ConflictFailure>(),
      );
      expect(
        mapDioExceptionToApiFailure(_wire(409, {
          'code': 'CONFLICT',
          'details': {'reason': 1},
        })),
        isA<ConflictFailure>(),
      );
    });

    test('a malformed body degrades to the generic conflict, never a crash', () {
      // Proxy error pages and CDN interstitials are not JSON envelopes.
      final options = RequestOptions(path: '/x');
      final f = mapDioExceptionToApiFailure(DioException(
        requestOptions: options,
        response: Response<Object?>(
          requestOptions: options,
          statusCode: 409,
          data: '<html>gateway</html>',
        ),
      ));
      expect(f, isA<ConflictFailure>());
    });
  });

  group('extractErrorReason', () {
    test('reads details.reason, and nothing else', () {
      expect(
        extractErrorReason({
          'error': {'code': 'CONFLICT', 'details': {'reason': 'busy'}},
        }),
        'busy',
      );
      expect(extractErrorReason({'error': {'code': 'CONFLICT'}}), isNull);
      expect(extractErrorReason({'error': {'details': {}}}), isNull);
      expect(extractErrorReason(null), isNull);
      expect(extractErrorReason('not json'), isNull);
    });
  });
}
