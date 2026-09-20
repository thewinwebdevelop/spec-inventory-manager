import '../../../core/error/api_failure.dart';

/// T-002-M3 — S2's error table, as a pure function (ux-wireframe §3 "States /
/// error mapping").
///
/// Split out of the widget for the same reason the web client split it: five
/// of the six rows are told apart only by an error CODE or a `details` key,
/// which is exactly the kind of distinction that rots unnoticed inside a
/// widget tree. Here the table can be tested as a table.
///
/// Returns a decision, never a string: the Thai copy is `ux`'s and lives in
/// `app_th.arb`. A mapper that returned finished sentences would put copy in
/// `application/`, where no translator will ever look for it.
sealed class CreateOrgError {
  const CreateOrgError();
}

/// Inline under the field, focus returns to it.
class CreateOrgFieldError extends CreateOrgError {
  const CreateOrgFieldError({this.serverMessage});

  /// The server's own `fieldErrors.name`, when it sent one. The screen
  /// prefers it over the generic copy — it is the only message that can name
  /// the actual rule that was broken.
  final String? serverMessage;
}

enum CreateOrgBanner {
  /// `409 ORG_LIMIT_REACHED` with a usable `details.limit`.
  limitReached,

  /// `503 ORG_PROVISIONING_UNAVAILABLE` — explicitly not the user's fault.
  provisioning,
  generic,
}

/// Banner above the form. [retry] decides whether it gets a retry button —
/// [CreateOrgBanner.limitReached] does not, because retrying cannot help.
class CreateOrgBannerError extends CreateOrgError {
  const CreateOrgBannerError(this.banner, {this.limit, this.retry = true});

  final CreateOrgBanner banner;

  /// Only set for [CreateOrgBanner.limitReached] — and only when the server
  /// actually sent a number.
  final int? limit;
  final bool retry;
}

/// 429 — the form waits. No countdown yet on mobile: the countdown widget
/// lives in `features/auth` and cross-feature imports are forbidden (gate
/// rule 4), so promoting it to `core/ui` is its own change.
class CreateOrgThrottled extends CreateOrgError {
  const CreateOrgThrottled({this.retryAfterSeconds});

  final int? retryAfterSeconds;
}

CreateOrgError toCreateOrgError(ApiFailure failure) {
  switch (failure) {
    case ThrottledFailure(:final retryAfterSeconds):
      return CreateOrgThrottled(retryAfterSeconds: retryAfterSeconds);

    case ValidationFailure(:final fieldErrors):
      return CreateOrgFieldError(serverMessage: fieldErrors['name']);

    case ConflictFailure(:final code, :final details):
      if (code == 'ORG_LIMIT_REACHED') {
        final limit = details['limit'];
        // `details.limit` carries the real cap precisely so the UI never
        // hard-codes it (api-spec §3.1). If it is missing or is not a
        // number, fall back to generic copy — inventing a figure here would
        // tell somebody they have five shops when their plan allows two.
        return limit is int
            ? CreateOrgBannerError(CreateOrgBanner.limitReached, limit: limit, retry: false)
            : const CreateOrgBannerError(CreateOrgBanner.generic);
      }
      return const CreateOrgBannerError(CreateOrgBanner.generic);

    case ServerFailure(:final code):
      // `503 ORG_PROVISIONING_UNAVAILABLE` is the one 5xx S2 must word
      // differently: it is our missing plan configuration, not anything the
      // person did, and the copy says so.
      return code == 'ORG_PROVISIONING_UNAVAILABLE'
          ? const CreateOrgBannerError(CreateOrgBanner.provisioning)
          : const CreateOrgBannerError(CreateOrgBanner.generic);

    // Everything else — network, 403, busy, and the session-level failures
    // that never reach a screen — gets the generic banner with a retry.
    case NetworkFailure():
    case AuthExpiredFailure():
    case OrgAccessDeniedFailure():
    case ForbiddenFailure():
    case EntitlementFailure():
    case BusyFailure():
    case NotFoundFailure():
    case ForceUpdateFailure():
      return const CreateOrgBannerError(CreateOrgBanner.generic);
  }
}
