// T-002-M3 — S2's error table, tested as a table (ux-wireframe §3).
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/features/org/application/create_org_error.dart';

void main() {
  test('★ ORG_LIMIT_REACHED uses the server\'s number and offers no retry', () {
    final error = toCreateOrgError(
      const ConflictFailure(code: 'ORG_LIMIT_REACHED', details: {'limit': 3}),
    ) as CreateOrgBannerError;

    expect(error.banner, CreateOrgBanner.limitReached);
    expect(error.limit, 3);
    // Retrying cannot create a shop the plan does not allow; a retry button
    // would say otherwise.
    expect(error.retry, isFalse);
  });

  test('★ a missing or unusable limit falls back to generic — never an invented number', () {
    for (final details in <Map<String, Object?>>[
      const {},
      const {'limit': '3'},
      const {'limit': null},
    ]) {
      final error = toCreateOrgError(
        ConflictFailure(code: 'ORG_LIMIT_REACHED', details: details),
      ) as CreateOrgBannerError;
      expect(error.banner, CreateOrgBanner.generic, reason: 'details=$details');
      expect(error.limit, isNull);
    }
  });

  test('★ 503 ORG_PROVISIONING_UNAVAILABLE gets its own copy', () {
    final error = toCreateOrgError(const ServerFailure(code: 'ORG_PROVISIONING_UNAVAILABLE'))
        as CreateOrgBannerError;
    expect(error.banner, CreateOrgBanner.provisioning);
    // It IS worth retrying — the configuration may land — which is why this
    // one keeps the button that `limitReached` loses.
    expect(error.retry, isTrue);
  });

  test('any other 5xx stays generic', () {
    expect(
      (toCreateOrgError(const ServerFailure()) as CreateOrgBannerError).banner,
      CreateOrgBanner.generic,
    );
    expect(
      (toCreateOrgError(const ServerFailure(code: 'INTERNAL')) as CreateOrgBannerError).banner,
      CreateOrgBanner.generic,
    );
  });

  test('422 lands under the field, preferring the server\'s message', () {
    final withMessage = toCreateOrgError(
      const ValidationFailure(fieldErrors: {'name': 'ชื่อร้านซ้ำกับที่มีอยู่'}),
    ) as CreateOrgFieldError;
    expect(withMessage.serverMessage, 'ชื่อร้านซ้ำกับที่มีอยู่');

    // A 422 about some other field must not put that field's message under
    // the shop name.
    final other = toCreateOrgError(
      const ValidationFailure(fieldErrors: {'timezone': 'x'}),
    ) as CreateOrgFieldError;
    expect(other.serverMessage, isNull);
  });

  test('429 keeps Retry-After when the server sent one', () {
    expect(
      (toCreateOrgError(const ThrottledFailure(retryAfterSeconds: 45)) as CreateOrgThrottled)
          .retryAfterSeconds,
      45,
    );
    expect(
      (toCreateOrgError(const ThrottledFailure()) as CreateOrgThrottled).retryAfterSeconds,
      isNull,
    );
  });

  test('every remaining failure kind has an answer, and it is retryable', () {
    // The switch is exhaustive over the sealed taxonomy — a new failure kind
    // will not compile until it is given a row here.
    for (final failure in const <ApiFailure>[
      NetworkFailure(),
      BusyFailure(),
      ForbiddenFailure(),
      OrgAccessDeniedFailure(),
      EntitlementFailure(),
      NotFoundFailure(),
      AuthExpiredFailure(),
      ForceUpdateFailure(),
      ConflictFailure(code: 'SOMETHING_ELSE'),
    ]) {
      final error = toCreateOrgError(failure);
      expect(error, isA<CreateOrgBannerError>(), reason: '$failure');
      expect((error as CreateOrgBannerError).banner, CreateOrgBanner.generic);
      expect(error.retry, isTrue);
    }
  });
}
