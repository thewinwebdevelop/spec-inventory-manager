import '../../../core/error/api_failure.dart';

/// T-003-M06 — a refused `POST` / `PATCH /roles` → where R3 shows it and what
/// it re-reads (ux-wireframe §E "Route บทบาท (R3/R4/R5)"). The Dart twin of
/// web `role-write-failure.ts`.
///
/// No copy here: [RoleFieldProblem] / [RoleBannerProblem] are mapped to the
/// ux-owned strings in presentation. Never the server's `message`.
///
/// ⛔ [RoleChangedError] carries NOTHING to resubmit with. `details.currentVersion`
/// is on the wire, and retrying with it is exactly the last-write-wins AC-3.12
/// forbids (SR-14) — so it is deliberately not read at all.
sealed class RoleWriteError {
  const RoleWriteError();
}

/// `409 ROLE_CHANGED` — re-read and show; the person decides (R3b).
class RoleChangedError extends RoleWriteError {
  const RoleChangedError();
}

enum RoleFormField { name, capabilities }

enum RoleFieldProblem { nameInvalidChars, nameTaken, capabilitiesEmpty }

class RoleFieldError extends RoleWriteError {
  const RoleFieldError(this.problem);

  final RoleFieldProblem problem;

  RoleFormField get field =>
      problem == RoleFieldProblem.capabilitiesEmpty ? RoleFormField.capabilities : RoleFormField.name;
}

/// What a refusal asks to be read again.
enum RoleRefetch { role, catalog, list, profile }

enum RoleBannerProblem {
  unknownCapability,
  fullAccessReserved,
  roleLimitReached,
  roleLocked,
  exceedsActor,
  targetNotBelowActor,
  heldRequiresManageMembers,
  writesDisabled,
  busy,
  generic,
}

class RoleBannerError extends RoleWriteError {
  const RoleBannerError(
    this.problem, {
    this.refetch = const {},
    this.untick = const [],
    this.limit,
  });

  final RoleBannerProblem problem;
  final Set<RoleRefetch> refetch;

  /// Keys to untick (`UNKNOWN_CAPABILITY.details.capabilities`).
  final List<String> untick;

  /// `ROLE_LIMIT_REACHED.details.limit` — `null` when absent, never invented.
  final int? limit;
}

class RoleThrottledError extends RoleWriteError {
  const RoleThrottledError(this.seconds);

  final int seconds;
}

/// `403 FORBIDDEN` — leave the form for the ForbiddenPanel.
class RoleForbiddenError extends RoleWriteError {
  const RoleForbiddenError();
}

class RoleNotFoundError extends RoleWriteError {
  const RoleNotFoundError();
}

/// ux §E has no number for a 429 without `Retry-After`; this is the web
/// client's default, kept identical.
const int defaultRoleRetryAfterSeconds = 60;

List<String> _stringList(Object? value) =>
    value is List ? value.whereType<String>().toList(growable: false) : const [];

RoleWriteError toRoleWriteError(ApiFailure failure) {
  const generic = RoleBannerError(RoleBannerProblem.generic);
  switch (failure) {
    case ThrottledFailure(:final retryAfterSeconds):
      return RoleThrottledError(retryAfterSeconds ?? defaultRoleRetryAfterSeconds);
    case BusyFailure():
      return const RoleBannerError(RoleBannerProblem.busy);
    case NotFoundFailure():
      return const RoleNotFoundError();
    case ValidationFailure(:final code, :final fieldErrors, :final details):
      if (code == 'ROLE_EMPTY') return const RoleFieldError(RoleFieldProblem.capabilitiesEmpty);
      if (code == 'UNKNOWN_CAPABILITY') {
        return RoleBannerError(
          RoleBannerProblem.unknownCapability,
          refetch: const {RoleRefetch.catalog},
          untick: _stringList(details['capabilities']),
        );
      }
      if (code == 'FULL_ACCESS_RESERVED') return const RoleBannerError(RoleBannerProblem.fullAccessReserved);
      if (fieldErrors.containsKey('name')) return const RoleFieldError(RoleFieldProblem.nameInvalidChars);
      return generic;
    case ConflictFailure(:final code, :final details):
      return switch (code) {
        'ROLE_CHANGED' => const RoleChangedError(),
        'ROLE_NAME_TAKEN' => const RoleFieldError(RoleFieldProblem.nameTaken),
        'ROLE_LIMIT_REACHED' => RoleBannerError(
            RoleBannerProblem.roleLimitReached,
            refetch: const {RoleRefetch.list},
            limit: details['limit'] is int ? details['limit']! as int : null,
          ),
        'ROLE_LOCKED' => const RoleBannerError(
            RoleBannerProblem.roleLocked,
            refetch: {RoleRefetch.role, RoleRefetch.list},
          ),
        _ => generic,
      };
    case ForbiddenFailure(:final code):
      return switch (code) {
        'ROLE_EXCEEDS_ACTOR' => const RoleBannerError(
            RoleBannerProblem.exceedsActor,
            refetch: {RoleRefetch.profile, RoleRefetch.role, RoleRefetch.list},
          ),
        // Both STAY on the screen (unlike FORBIDDEN): re-read and the role
        // shows read-only with the matching reason (api-spec §5).
        'TARGET_NOT_BELOW_ACTOR' => const RoleBannerError(
            RoleBannerProblem.targetNotBelowActor,
            refetch: {RoleRefetch.role, RoleRefetch.list},
          ),
        'ROLE_HELD_REQUIRES_MANAGE_MEMBERS' => const RoleBannerError(
            RoleBannerProblem.heldRequiresManageMembers,
            refetch: {RoleRefetch.role, RoleRefetch.list},
          ),
        _ => const RoleForbiddenError(),
      };
    case ServerFailure(:final code):
      if (code == 'ROLE_WRITES_DISABLED') {
        return const RoleBannerError(
          RoleBannerProblem.writesDisabled,
          refetch: {RoleRefetch.role, RoleRefetch.list},
        );
      }
      return generic;
    case NetworkFailure() ||
          AuthExpiredFailure() ||
          OrgAccessDeniedFailure() ||
          EntitlementFailure() ||
          ForceUpdateFailure():
      // Session-level outcomes are handled by the session failure listener;
      // the form only says the save did not happen.
      return generic;
  }
}
