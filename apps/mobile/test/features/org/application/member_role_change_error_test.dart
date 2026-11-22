// T-003-M11 ★ — ux R10 (ค): every refused `PATCH /members/{userId}` → which
// problem, and what the sheet does about it. Copy lives in presentation; this
// pins the behaviour column of the table.
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/features/org/application/member_role_change_error.dart';

void main() {
  MemberRoleChangeError map(ApiFailure f) => toMemberRoleChangeError(f);

  test('403 TARGET_NOT_BELOW_ACTOR → everything locked, refetch members, stay', () {
    final e = map(const ForbiddenFailure(code: 'TARGET_NOT_BELOW_ACTOR'));
    expect(e.problem, MemberRoleProblem.targetNotBelowActor);
    expect(e.locksSheet, isTrue);
    expect(e.refetchMembers, isTrue);
    expect(e.resetSelection, isFalse);
    expect(e.closesSheet, isFalse);
  });

  test('403 ROLE_EXCEEDS_ACTOR → refetch roles, back to the current role, stay', () {
    final e = map(const ForbiddenFailure(code: 'ROLE_EXCEEDS_ACTOR'));
    expect(e.problem, MemberRoleProblem.exceedsActor);
    expect(e.refetchRoles, isTrue);
    expect(e.resetSelection, isTrue);
    expect(e.closesSheet, isFalse);
  });

  test('403 FORBIDDEN (or no code) → re-learn my membership first, refetch roles + members', () {
    for (final f in [const ForbiddenFailure(code: 'FORBIDDEN'), const ForbiddenFailure()]) {
      final e = map(f);
      expect(e.problem, MemberRoleProblem.forbidden);
      expect(e.relearnMembership, isTrue);
      expect(e.refetchRoles, isTrue);
      expect(e.refetchMembers, isTrue);
    }
  });

  test('404 → close the sheet, refetch members', () {
    final e = map(const NotFoundFailure());
    expect(e.problem, MemberRoleProblem.gone);
    expect(e.closesSheet, isTrue);
    expect(e.refetchMembers, isTrue);
  });

  test('409 LAST_OWNER → back to the current role, stay', () {
    final e = map(const ConflictFailure(code: 'LAST_OWNER'));
    expect(e.problem, MemberRoleProblem.lastOwner);
    expect(e.resetSelection, isTrue);
    expect(e.closesSheet, isFalse);
  });

  test('409 busy → keep the choice, nothing re-read, never retried', () {
    final e = map(const BusyFailure());
    expect(e.problem, MemberRoleProblem.busy);
    expect(e.resetSelection, isFalse);
    expect(e.refetchRoles || e.refetchMembers, isFalse);
  });

  test('422 ROLE_INVALID → refetch roles, back to the current role', () {
    final e = map(const ValidationFailure(code: 'ROLE_INVALID'));
    expect(e.problem, MemberRoleProblem.roleInvalid);
    expect(e.refetchRoles, isTrue);
    expect(e.resetSelection, isTrue);
  });

  test('429 → countdown from Retry-After (60s when absent), keep the choice', () {
    final e = map(const ThrottledFailure(retryAfterSeconds: 90));
    expect(e.problem, MemberRoleProblem.throttled);
    expect(e.retryAfterSeconds, 90);
    expect(e.resetSelection, isFalse);
    expect(map(const ThrottledFailure()).retryAfterSeconds, 60);
  });

  test('network / 5xx / an unknown 409 or 422 / anything else → generic, keep the choice', () {
    for (final f in <ApiFailure>[
      const NetworkFailure(),
      const ServerFailure(),
      const ConflictFailure(code: 'SOMETHING_NEW'),
      const ValidationFailure(code: 'VALIDATION_FAILED'),
      const EntitlementFailure(),
    ]) {
      final e = map(f);
      expect(e.problem, MemberRoleProblem.generic, reason: '$f');
      expect(e.resetSelection, isFalse);
      expect(e.closesSheet, isFalse);
    }
  });
}
