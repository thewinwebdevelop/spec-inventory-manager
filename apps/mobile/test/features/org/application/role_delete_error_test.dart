// T-003-M08 — a refused `DELETE /roles/{id}` → what R5 shows and re-reads
// (ux R5 + §E). Dart twin of web `role-delete-failure.ts`.
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/features/org/application/role_delete_error.dart';
import 'package:mobile/features/org/application/role_write_error.dart';

void main() {
  test('409 ROLE_IN_USE → in-use with the SERVER numbers', () {
    final e = toRoleDeleteError(
      const ConflictFailure(code: 'ROLE_IN_USE', details: {'activeMembers': 2, 'pendingInvitations': 1}),
    );
    e as RoleDeleteInUse;
    expect(e.usage!.activeMembers, 2);
    expect(e.usage!.pendingInvitations, 1);
  });

  test('409 ROLE_IN_USE with unusable details → in-use with NO numbers (never invented)', () {
    for (final details in <Map<String, Object?>>[
      {},
      {'activeMembers': 2},
      {'activeMembers': '2', 'pendingInvitations': 0},
      {'activeMembers': -1, 'pendingInvitations': 0},
      {'activeMembers': 1.5, 'pendingInvitations': 0},
    ]) {
      final e = toRoleDeleteError(ConflictFailure(code: 'ROLE_IN_USE', details: details));
      expect((e as RoleDeleteInUse).usage, isNull, reason: '$details');
    }
  });

  test('409 ROLE_HISTORY_LIMIT_REACHED → history-limit, limit only when it is a number', () {
    final e = toRoleDeleteError(const ConflictFailure(code: 'ROLE_HISTORY_LIMIT_REACHED', details: {'limit': 500}));
    expect((e as RoleDeleteHistoryLimit).limit, 500);
    final n = toRoleDeleteError(const ConflictFailure(code: 'ROLE_HISTORY_LIMIT_REACHED'));
    expect((n as RoleDeleteHistoryLimit).limit, isNull);
  });

  test('404 → gone', () {
    expect(toRoleDeleteError(const NotFoundFailure()), isA<RoleDeleteGone>());
  });

  test('403 FORBIDDEN → forbidden (leave for the panel)', () {
    expect(toRoleDeleteError(const ForbiddenFailure()), isA<RoleDeleteForbidden>());
  });

  test('429 → throttled with Retry-After, or the shared default', () {
    expect((toRoleDeleteError(const ThrottledFailure(retryAfterSeconds: 12)) as RoleDeleteThrottled).seconds, 12);
    expect((toRoleDeleteError(const ThrottledFailure()) as RoleDeleteThrottled).seconds, defaultRoleRetryAfterSeconds);
  });

  test('the R3 codes a DELETE shares STAY on the screen with their own problem + re-reads', () {
    final cases = <ApiFailure, RoleBannerProblem>{
      const ForbiddenFailure(code: 'TARGET_NOT_BELOW_ACTOR'): RoleBannerProblem.targetNotBelowActor,
      const ForbiddenFailure(code: 'ROLE_HELD_REQUIRES_MANAGE_MEMBERS'): RoleBannerProblem.heldRequiresManageMembers,
      const ForbiddenFailure(code: 'ROLE_EXCEEDS_ACTOR'): RoleBannerProblem.exceedsActor,
      const ConflictFailure(code: 'ROLE_LOCKED'): RoleBannerProblem.roleLocked,
      const ServerFailure(code: 'ROLE_WRITES_DISABLED'): RoleBannerProblem.writesDisabled,
      const BusyFailure(): RoleBannerProblem.busy,
    };
    cases.forEach((failure, problem) {
      final e = toRoleDeleteError(failure);
      expect((e as RoleDeleteRefused).problem, problem, reason: '$failure');
      if (problem != RoleBannerProblem.busy) {
        expect(e.refetch, contains(RoleRefetch.role), reason: '$failure');
      }
    });
  });

  test('anything a DELETE cannot mean (save-only codes, unknown, 5xx, network) → the DELETE generic', () {
    for (final f in <ApiFailure>[
      const ConflictFailure(code: 'ROLE_CHANGED'),
      const ConflictFailure(code: 'ROLE_NAME_TAKEN'),
      const ConflictFailure(code: 'ROLE_LIMIT_REACHED', details: {'limit': 30}),
      const ValidationFailure(code: 'ROLE_EMPTY'),
      const ConflictFailure(code: 'SOMETHING_NEW'),
      const ServerFailure(),
      const NetworkFailure(),
    ]) {
      final e = toRoleDeleteError(f);
      expect((e as RoleDeleteRefused).problem, RoleBannerProblem.generic, reason: '$f');
      expect(e.refetch, isEmpty, reason: '$f');
    }
  });
}
