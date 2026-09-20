// ★ T-002-M3 — `details` and `fieldErrors` from the wire envelope (D-025).
//
// Driven from the ENVELOPE through `mapDioExceptionToApiFailure`, never by
// calling the pure mapper with hand-made arguments: the whole finding here was
// that the envelope carried these two fields and the extraction dropped them,
// which no test of the pure mapper could have caught.
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/error_mapping.dart';
import 'package:mobile/core/error/api_failure.dart';

DioException _wire(int status, Map<String, Object?> error) {
  final options = RequestOptions(path: '/organizations');
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
  group('409 details', () {
    test('★ ORG_LIMIT_REACHED carries details.limit to the screen', () {
      // api-spec §3.1 sends the number precisely so no client hard-codes the
      // cap — it is per-plan. Dropping it here left S2 choosing between an
      // invented figure and silence.
      final failure = mapDioExceptionToApiFailure(_wire(409, {
        'code': 'ORG_LIMIT_REACHED',
        'message': 'x',
        'details': {'limit': 3},
      }));

      expect(failure, isA<ConflictFailure>());
      expect((failure as ConflictFailure).details['limit'], 3);
    });

    test('★ values are not coerced — a string "3" stays a string', () {
      // So a caller checking `is int` fails the check instead of silently
      // rendering a number the server never sent as one.
      final failure = mapDioExceptionToApiFailure(_wire(409, {
        'code': 'ORG_LIMIT_REACHED',
        'details': {'limit': '3'},
      }));
      expect((failure as ConflictFailure).details['limit'], isA<String>());
    });

    test('INVITATION_PENDING carries the three keys S7 needs', () {
      final failure = mapDioExceptionToApiFailure(_wire(409, {
        'code': 'INVITATION_PENDING',
        'details': {
          'invitationId': 'inv_1',
          'roleName': 'Staff',
          'expiresAt': '2026-08-09T07:30:00.000Z',
        },
      }));
      final details = (failure as ConflictFailure).details;
      expect(details['invitationId'], 'inv_1');
      expect(details['roleName'], 'Staff');
      expect(details['expiresAt'], '2026-08-09T07:30:00.000Z');
    });

    test('a 409 with no details gets an empty map, never null', () {
      final failure = mapDioExceptionToApiFailure(_wire(409, {'code': 'LAST_OWNER'}));
      expect((failure as ConflictFailure).details, isEmpty);
    });

    test('★ busy still wins over details (the §1.4 ordering is untouched)', () {
      final failure = mapDioExceptionToApiFailure(_wire(409, {
        'code': 'CONFLICT',
        'details': {'reason': 'busy', 'limit': 3},
      }));
      expect(failure, isA<BusyFailure>());
    });
  });

  group('422 fieldErrors', () {
    test('★ reaches the screen so the field can say what is wrong', () {
      final failure = mapDioExceptionToApiFailure(_wire(422, {
        'code': 'VALIDATION_FAILED',
        'message': 'x',
        'fieldErrors': {'name': 'ยาวเกิน 120 ตัวอักษร'},
      }));

      expect(failure, isA<ValidationFailure>());
      expect((failure as ValidationFailure).fieldErrors['name'], 'ยาวเกิน 120 ตัวอักษร');
    });

    test('non-string values are dropped, not stringified', () {
      // A screen must never render `{}` or `null` at somebody.
      final failure = mapDioExceptionToApiFailure(_wire(422, {
        'code': 'VALIDATION_FAILED',
        'fieldErrors': {'name': 'ok', 'other': 42},
      }));
      final fields = (failure as ValidationFailure).fieldErrors;
      expect(fields['name'], 'ok');
      expect(fields.containsKey('other'), isFalse);
    });
  });

  group('5xx code', () {
    test('★ ORG_PROVISIONING_UNAVAILABLE survives as a code', () {
      // The one 5xx with its own copy ("ไม่ใช่ความผิดของคุณ", ux §3). Without
      // the code it was indistinguishable from any other server error.
      final failure = mapDioExceptionToApiFailure(_wire(503, {
        'code': 'ORG_PROVISIONING_UNAVAILABLE',
        'message': 'x',
      }));
      expect(failure, isA<ServerFailure>());
      expect((failure as ServerFailure).code, 'ORG_PROVISIONING_UNAVAILABLE');
    });

    test('an unlabelled 500 has a null code', () {
      expect(
        (mapDioExceptionToApiFailure(_wire(500, {'message': 'x'})) as ServerFailure).code,
        isNull,
      );
    });
  });

  group('malformed bodies degrade, never throw', () {
    test('a gateway HTML page', () {
      final options = RequestOptions(path: '/x');
      final failure = mapDioExceptionToApiFailure(DioException(
        requestOptions: options,
        response: Response<Object?>(
          requestOptions: options,
          statusCode: 422,
          data: '<html>gateway</html>',
        ),
      ));
      expect((failure as ValidationFailure).fieldErrors, isEmpty);
    });

    test('the extractors on their own', () {
      expect(extractFieldErrors(null), isEmpty);
      expect(extractDetails('not json'), isEmpty);
      expect(extractDetails({'error': {'details': 'not a map'}}), isEmpty);
      expect(extractFieldErrors({'error': {}}), isEmpty);
    });
  });
}
