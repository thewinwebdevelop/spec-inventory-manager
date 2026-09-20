import '../../../core/error/api_failure.dart';

/// T-002-M3 — S7's error table (ux-wireframe §8 "Error mapping"), pure.
///
/// Nine rows, six of them 4xx told apart only by `code`. Two of those six
/// change the SHAPE of the screen rather than just its message, which is why
/// this returns a decision instead of a string.
sealed class InviteError {
  const InviteError();
}

enum InviteFieldProblem {
  /// `422 VALIDATION_FAILED` + `fieldErrors.email`.
  emailInvalid,

  /// `409 ALREADY_MEMBER` — not an error about the email's FORM, so it is
  /// worded as a fact plus a way to check ("ดูในรายชื่อสมาชิก").
  alreadyMember,
}

class InviteFieldError extends InviteError {
  const InviteFieldError(this.problem, {this.serverMessage});

  final InviteFieldProblem problem;
  final String? serverMessage;
}

/// `422 ROLE_INVALID` — the chosen role stopped existing between the list
/// loading and the submit (F-003 can delete roles). The screen re-fetches the
/// list rather than leaving a dead option selected.
class InviteRoleUnavailable extends InviteError {
  const InviteRoleUnavailable();
}

/// `409 INVITATION_PENDING` — the one row that replaces the form with a panel
/// (D-027: "ห้ามปล่อยผู้ใช้ตัน").
///
/// Everything shown on that panel comes from `details` — the server sends
/// `invitationId`, `roleName` and `expiresAt` for exactly this purpose
/// (api-spec §3.5). A screen that instead re-fetched the invitation list to
/// find the row would be reading a second, later snapshot to explain a
/// failure that happened against the first.
class InvitePending extends InviteError {
  const InvitePending({this.invitationId, this.roleName, this.expiresAt});

  final String? invitationId;
  final String? roleName;
  final DateTime? expiresAt;
}

enum InviteBanner {
  /// `409 INVITATION_LIMIT_REACHED`.
  limitReached,

  /// `403 FORBIDDEN` — including the Owner-only rule (D-028/C-1).
  forbidden,
  generic,
}

class InviteBannerError extends InviteError {
  const InviteBannerError(this.banner, {this.retry = true});

  final InviteBanner banner;
  final bool retry;
}

class InviteThrottled extends InviteError {
  const InviteThrottled({this.retryAfterSeconds});

  final int? retryAfterSeconds;
}

InviteError toInviteError(ApiFailure failure) {
  switch (failure) {
    case ThrottledFailure(:final retryAfterSeconds):
      return InviteThrottled(retryAfterSeconds: retryAfterSeconds);

    case ValidationFailure(:final code, :final fieldErrors):
      if (code == 'ROLE_INVALID') return const InviteRoleUnavailable();
      return InviteFieldError(
        InviteFieldProblem.emailInvalid,
        serverMessage: fieldErrors['email'],
      );

    case ConflictFailure(:final code, :final details):
      switch (code) {
        case 'ALREADY_MEMBER':
          return const InviteFieldError(InviteFieldProblem.alreadyMember);
        case 'INVITATION_PENDING':
          final expiresAt = details['expiresAt'];
          final roleName = details['roleName'];
          final invitationId = details['invitationId'];
          return InvitePending(
            invitationId: invitationId is String ? invitationId : null,
            roleName: roleName is String ? roleName : null,
            // Parsed leniently: a panel that loses its expiry line is worse
            // than one that shows the rest without it, and `tryParse` is the
            // only way to say "the server sent something I cannot read"
            // without throwing inside an error handler.
            expiresAt: expiresAt is String ? DateTime.tryParse(expiresAt) : null,
          );
        case 'INVITATION_LIMIT_REACHED':
          return const InviteBannerError(InviteBanner.limitReached, retry: false);
        default:
          return const InviteBannerError(InviteBanner.generic);
      }

    case ForbiddenFailure():
      return const InviteBannerError(InviteBanner.forbidden, retry: false);

    case NetworkFailure():
    case ServerFailure():
    case BusyFailure():
    case AuthExpiredFailure():
    case OrgAccessDeniedFailure():
    case EntitlementFailure():
    case NotFoundFailure():
    case ForceUpdateFailure():
      return const InviteBannerError(InviteBanner.generic);
  }
}
