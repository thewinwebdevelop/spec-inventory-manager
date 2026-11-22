import '../../../core/error/api_failure.dart';

/// T-003-M11 ★ — a refused `PATCH /members/{userId}` (ux R10 (ค)) → which
/// sentence, and what the sheet does about it. The behaviour column of the
/// table lives here as data, so the sheet cannot forget one of its re-reads;
/// the words are mapped in presentation (`app_th.arb`), never the server's
/// `message`.
///
/// Nothing is ever retried — least of all `busy` (ux: "ไม่ retry อัตโนมัติ").
/// `401` / `ORG_ACCESS_DENIED` are the session listener's (central app
/// behaviour, not F-003's) and only reach here as [MemberRoleProblem.generic].
enum MemberRoleProblem {
  targetNotBelowActor,
  exceedsActor,
  forbidden,
  gone,
  lastOwner,
  busy,
  roleInvalid,
  throttled,
  generic,
}

class MemberRoleChangeError {
  const MemberRoleChangeError(
    this.problem, {
    this.locksSheet = false,
    this.resetSelection = false,
    this.refetchRoles = false,
    this.refetchMembers = false,
    this.relearnMembership = false,
    this.closesSheet = false,
    this.retryAfterSeconds,
  });

  final MemberRoleProblem problem;

  /// Every option disabled, the primary button becomes "ปิด".
  final bool locksSheet;

  /// Selection goes back to the member's current role.
  final bool resetSelection;
  final bool refetchRoles;
  final bool refetchMembers;

  /// Re-read `myMembership` BEFORE choosing the copy (FORBIDDEN).
  final bool relearnMembership;
  final bool closesSheet;

  /// Only for [MemberRoleProblem.throttled].
  final int? retryAfterSeconds;
}

/// ux §E has no number for a 429 without `Retry-After`; the web client's
/// default, kept identical (role_write_error.dart does the same).
const int defaultMemberRetryAfterSeconds = 60;

MemberRoleChangeError toMemberRoleChangeError(ApiFailure failure) {
  const generic = MemberRoleChangeError(MemberRoleProblem.generic);
  return switch (failure) {
    ForbiddenFailure(code: 'TARGET_NOT_BELOW_ACTOR') => const MemberRoleChangeError(
        MemberRoleProblem.targetNotBelowActor,
        locksSheet: true,
        refetchMembers: true,
      ),
    ForbiddenFailure(code: 'ROLE_EXCEEDS_ACTOR') => const MemberRoleChangeError(
        MemberRoleProblem.exceedsActor,
        resetSelection: true,
        refetchRoles: true,
      ),
    ForbiddenFailure() => const MemberRoleChangeError(
        MemberRoleProblem.forbidden,
        relearnMembership: true,
        refetchRoles: true,
        refetchMembers: true,
      ),
    NotFoundFailure() => const MemberRoleChangeError(
        MemberRoleProblem.gone,
        closesSheet: true,
        refetchMembers: true,
      ),
    ConflictFailure(code: 'LAST_OWNER') =>
      const MemberRoleChangeError(MemberRoleProblem.lastOwner, resetSelection: true),
    BusyFailure() => const MemberRoleChangeError(MemberRoleProblem.busy),
    ValidationFailure(code: 'ROLE_INVALID') => const MemberRoleChangeError(
        MemberRoleProblem.roleInvalid,
        resetSelection: true,
        refetchRoles: true,
      ),
    ThrottledFailure(:final retryAfterSeconds) => MemberRoleChangeError(
        MemberRoleProblem.throttled,
        retryAfterSeconds: retryAfterSeconds ?? defaultMemberRetryAfterSeconds,
      ),
    _ => generic,
  };
}
