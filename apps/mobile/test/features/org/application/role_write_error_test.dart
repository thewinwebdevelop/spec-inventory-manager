// T-003-M06 (CM3-06) — a refused role write → what R3 does (ux-wireframe §E).
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/features/org/application/role_write_error.dart';

void main() {
  test('★ 409 ROLE_CHANGED → role-changed, carrying nothing to resubmit with (SR-14)', () {
    final e = toRoleWriteError(
      const ConflictFailure(code: 'ROLE_CHANGED', details: {'currentVersion': 9}),
    );
    expect(e, isA<RoleChangedError>());
  });

  test('field errors: name (invalid chars / taken) and capabilities (ROLE_EMPTY)', () {
    final invalid = toRoleWriteError(
      const ValidationFailure(code: 'VALIDATION_FAILED', fieldErrors: {'name': 'bad'}),
    ) as RoleFieldError;
    expect(invalid.problem, RoleFieldProblem.nameInvalidChars);

    final taken = toRoleWriteError(const ConflictFailure(code: 'ROLE_NAME_TAKEN')) as RoleFieldError;
    expect(taken.problem, RoleFieldProblem.nameTaken);

    final empty = toRoleWriteError(const ValidationFailure(code: 'ROLE_EMPTY')) as RoleFieldError;
    expect(empty.problem, RoleFieldProblem.capabilitiesEmpty);
  });

  test('UNKNOWN_CAPABILITY → banner, refetch catalog, untick details.capabilities', () {
    final e = toRoleWriteError(const ValidationFailure(
      code: 'UNKNOWN_CAPABILITY',
      details: {'capabilities': ['gone_a', 3, 'gone_b']},
    )) as RoleBannerError;
    expect(e.problem, RoleBannerProblem.unknownCapability);
    expect(e.refetch, {RoleRefetch.catalog});
    expect(e.untick, ['gone_a', 'gone_b']);
  });

  test('ROLE_LIMIT_REACHED carries details.limit (null when absent — never invented)', () {
    final withLimit = toRoleWriteError(
      const ConflictFailure(code: 'ROLE_LIMIT_REACHED', details: {'limit': 30}),
    ) as RoleBannerError;
    expect(withLimit.limit, 30);
    expect(withLimit.refetch, {RoleRefetch.list});

    final without = toRoleWriteError(const ConflictFailure(code: 'ROLE_LIMIT_REACHED')) as RoleBannerError;
    expect(without.limit, isNull);
  });

  test('★ TARGET_NOT_BELOW_ACTOR / ROLE_HELD_REQUIRES_MANAGE_MEMBERS STAY on screen (banner + re-read role); FORBIDDEN leaves',
      () {
    final target = toRoleWriteError(const ForbiddenFailure(code: 'TARGET_NOT_BELOW_ACTOR')) as RoleBannerError;
    expect(target.problem, RoleBannerProblem.targetNotBelowActor);
    expect(target.refetch, containsAll([RoleRefetch.role, RoleRefetch.list]));

    final held = toRoleWriteError(
      const ForbiddenFailure(code: 'ROLE_HELD_REQUIRES_MANAGE_MEMBERS'),
    ) as RoleBannerError;
    expect(held.problem, RoleBannerProblem.heldRequiresManageMembers);
    expect(held.refetch, contains(RoleRefetch.role));

    expect(toRoleWriteError(const ForbiddenFailure(code: 'FORBIDDEN')), isA<RoleForbiddenError>());
    expect(toRoleWriteError(const ForbiddenFailure()), isA<RoleForbiddenError>());
  });

  test('ROLE_EXCEEDS_ACTOR re-reads my capabilities + the role', () {
    final e = toRoleWriteError(const ForbiddenFailure(code: 'ROLE_EXCEEDS_ACTOR')) as RoleBannerError;
    expect(e.refetch, {RoleRefetch.profile, RoleRefetch.role, RoleRefetch.list});
  });

  test('503 ROLE_WRITES_DISABLED → writes-disabled banner + re-read (new viewer.*)', () {
    final e = toRoleWriteError(const ServerFailure(code: 'ROLE_WRITES_DISABLED')) as RoleBannerError;
    expect(e.problem, RoleBannerProblem.writesDisabled);
    expect(e.refetch, containsAll([RoleRefetch.role, RoleRefetch.list]));
  });

  test('ROLE_LOCKED → banner + re-read; FULL_ACCESS_RESERVED → banner', () {
    expect((toRoleWriteError(const ConflictFailure(code: 'ROLE_LOCKED')) as RoleBannerError).problem,
        RoleBannerProblem.roleLocked);
    expect((toRoleWriteError(const ValidationFailure(code: 'FULL_ACCESS_RESERVED')) as RoleBannerError).problem,
        RoleBannerProblem.fullAccessReserved);
  });

  test('429 → throttled (Retry-After, else 60s); busy → busy; 404 → not-found', () {
    expect((toRoleWriteError(const ThrottledFailure(retryAfterSeconds: 125)) as RoleThrottledError).seconds, 125);
    expect((toRoleWriteError(const ThrottledFailure()) as RoleThrottledError).seconds, 60);
    expect((toRoleWriteError(const BusyFailure()) as RoleBannerError).problem, RoleBannerProblem.busy);
    expect(toRoleWriteError(const NotFoundFailure()), isA<RoleNotFoundError>());
  });

  test('unknown codes / LAST_OWNER / 5xx / network → the generic save failure', () {
    for (final f in const <ApiFailure>[
      ConflictFailure(code: 'LAST_OWNER'),
      ConflictFailure(code: 'BRAND_NEW'),
      ValidationFailure(code: 'BRAND_NEW'),
      ServerFailure(),
      NetworkFailure(),
    ]) {
      expect((toRoleWriteError(f) as RoleBannerError).problem, RoleBannerProblem.generic, reason: '$f');
    }
  });
}
