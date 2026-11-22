import '../../../core/error/api_failure.dart';
import '../domain/entities/role_entities.dart';
import 'role_write_error.dart';

/// T-003-M08 — a refused `DELETE /roles/{id}` → what R5 shows and what it
/// re-reads (ux-wireframe R5 + §E "Route บทบาท (R3/R4/R5)"). The Dart twin of
/// web `role-delete-failure.ts`.
///
/// The codes R3 shares (403 refusals that STAY on the screen,
/// `ROLE_WRITES_DISABLED`, `ROLE_LOCKED`, busy, 429, FORBIDDEN) reuse
/// [toRoleWriteError]; anything a DELETE cannot mean falls to
/// [RoleBannerProblem.generic], which R5 prints as the DELETE sentence
/// ("ลบบทบาทไม่สำเร็จ…"). No copy here, never the server's `message`.
sealed class RoleDeleteError {
  const RoleDeleteError();
}

/// `409 ROLE_IN_USE` → R5 (ข). [usage] = the server's `details`, or `null`
/// when they are unusable (no invented numbers).
class RoleDeleteInUse extends RoleDeleteError {
  const RoleDeleteInUse(this.usage);

  final RoleUsage? usage;
}

/// `409 ROLE_HISTORY_LIMIT_REACHED` → shown inside the dialog, confirm off.
class RoleDeleteHistoryLimit extends RoleDeleteError {
  const RoleDeleteHistoryLimit(this.limit);

  final int? limit;
}

/// `404` → "บทบาทนี้ถูกลบไปแล้ว" + R1.
class RoleDeleteGone extends RoleDeleteError {
  const RoleDeleteGone();
}

/// Stays on the screen with a sentence under the button + re-reads.
class RoleDeleteRefused extends RoleDeleteError {
  const RoleDeleteRefused(this.problem, {this.refetch = const {}});

  final RoleBannerProblem problem;
  final Set<RoleRefetch> refetch;
}

class RoleDeleteThrottled extends RoleDeleteError {
  const RoleDeleteThrottled(this.seconds);

  final int seconds;
}

/// `403 FORBIDDEN` → leave for the ForbiddenPanel.
class RoleDeleteForbidden extends RoleDeleteError {
  const RoleDeleteForbidden();
}

bool _isCount(Object? v) => v is int && v >= 0;

/// The R3 refusals a DELETE can also get, whose own copy applies unchanged.
const _sharedProblems = {
  RoleBannerProblem.busy,
  RoleBannerProblem.roleLocked,
  RoleBannerProblem.exceedsActor,
  RoleBannerProblem.targetNotBelowActor,
  RoleBannerProblem.heldRequiresManageMembers,
  RoleBannerProblem.writesDisabled,
};

RoleDeleteError toRoleDeleteError(ApiFailure failure) {
  if (failure case ConflictFailure(:final code, :final details)) {
    if (code == 'ROLE_IN_USE') {
      final members = details['activeMembers'];
      final invites = details['pendingInvitations'];
      return RoleDeleteInUse(
        _isCount(members) && _isCount(invites)
            ? RoleUsage(activeMembers: members! as int, pendingInvitations: invites! as int)
            : null,
      );
    }
    if (code == 'ROLE_HISTORY_LIMIT_REACHED') {
      final limit = details['limit'];
      return RoleDeleteHistoryLimit(limit is int ? limit : null);
    }
  }
  return switch (toRoleWriteError(failure)) {
    RoleNotFoundError() => const RoleDeleteGone(),
    RoleForbiddenError() => const RoleDeleteForbidden(),
    RoleThrottledError(:final seconds) => RoleDeleteThrottled(seconds),
    RoleBannerError(:final problem, :final refetch) when _sharedProblems.contains(problem) =>
      RoleDeleteRefused(problem, refetch: refetch),
    // Save-only outcomes (ROLE_CHANGED, field errors, ROLE_LIMIT_REACHED, …)
    // cannot come from a DELETE; unknown codes, 5xx, network → generic.
    _ => const RoleDeleteRefused(RoleBannerProblem.generic),
  };
}
