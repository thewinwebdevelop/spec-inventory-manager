// T-002-M3 — S7's error table (ux-wireframe §8), tested as a table.
//
// Six 4xx rows told apart only by `code`, and two of them change the SHAPE of
// the screen rather than its message — which is exactly why this is a pure
// function with its own test instead of a chain of ifs inside a widget.
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/features/org/application/invite_error.dart';

void main() {
  test('422 with fieldErrors.email lands under the field', () {
    final error = toInviteError(
      const ValidationFailure(fieldErrors: {'email': 'อีเมลนี้ใช้ไม่ได้'}),
    ) as InviteFieldError;
    expect(error.problem, InviteFieldProblem.emailInvalid);
    expect(error.serverMessage, 'อีเมลนี้ใช้ไม่ได้');
  });

  test('★ 422 ROLE_INVALID is about the ROLE list, not the email', () {
    // Putting this under the email field would send somebody re-typing an
    // address that was never the problem — the role they picked stopped
    // existing (F-003 can delete roles).
    expect(
      toInviteError(const ValidationFailure(code: 'ROLE_INVALID')),
      isA<InviteRoleUnavailable>(),
    );
  });

  test('409 ALREADY_MEMBER is a fact about the email, not a format error', () {
    final error = toInviteError(const ConflictFailure(code: 'ALREADY_MEMBER'))
        as InviteFieldError;
    expect(error.problem, InviteFieldProblem.alreadyMember);
  });

  test('★ 409 INVITATION_PENDING carries what the panel needs (D-027)', () {
    final error = toInviteError(const ConflictFailure(
      code: 'INVITATION_PENDING',
      details: {
        'invitationId': 'inv_1',
        'roleName': 'ผู้ดูแล',
        'expiresAt': '2026-08-09T07:30:00.000Z',
      },
    )) as InvitePending;

    expect(error.invitationId, 'inv_1');
    expect(error.roleName, 'ผู้ดูแล');
    expect(error.expiresAt, DateTime.utc(2026, 8, 9, 7, 30));
  });

  test('★ an unreadable expiresAt loses the line, never the panel', () {
    // The panel is the way OUT of a dead end. Throwing inside an error
    // handler because the date did not parse would leave the person stuck at
    // exactly the moment D-027 exists to prevent.
    final error = toInviteError(const ConflictFailure(
      code: 'INVITATION_PENDING',
      details: {'invitationId': 'inv_1', 'expiresAt': 'yesterday-ish'},
    )) as InvitePending;

    expect(error.invitationId, 'inv_1');
    expect(error.expiresAt, isNull);
    expect(error.roleName, isNull);
  });

  test('409 INVITATION_LIMIT_REACHED is a banner with no retry', () {
    final error = toInviteError(const ConflictFailure(code: 'INVITATION_LIMIT_REACHED'))
        as InviteBannerError;
    expect(error.banner, InviteBanner.limitReached);
    expect(error.retry, isFalse);
  });

  test('★ 403 says which 403 it is, and does not offer a retry', () {
    // The Owner-only rule (D-028/C-1). Retrying the same request with the
    // same role cannot succeed; the person has to choose a different role.
    final error = toInviteError(const ForbiddenFailure(code: 'FORBIDDEN')) as InviteBannerError;
    expect(error.banner, InviteBanner.forbidden);
    expect(error.retry, isFalse);
  });

  test('429 keeps Retry-After', () {
    expect(
      (toInviteError(const ThrottledFailure(retryAfterSeconds: 30)) as InviteThrottled)
          .retryAfterSeconds,
      30,
    );
  });

  test('an unrecognised 409 code is generic, not silently one of the known ones', () {
    final error = toInviteError(const ConflictFailure(code: 'SOMETHING_NEW')) as InviteBannerError;
    expect(error.banner, InviteBanner.generic);
  });

  test('every remaining kind is answered', () {
    for (final failure in const <ApiFailure>[
      NetworkFailure(),
      ServerFailure(),
      BusyFailure(),
      AuthExpiredFailure(),
      OrgAccessDeniedFailure(),
      EntitlementFailure(),
      NotFoundFailure(),
      ForceUpdateFailure(),
    ]) {
      expect(toInviteError(failure), isA<InviteBannerError>(), reason: '$failure');
    }
  });
}
