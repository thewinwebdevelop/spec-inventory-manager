import '../l10n/l10n.dart';

/// R3 (docs/architecture/refactor-plan.md §4, mobile.md §3.4) — central
/// sealed error taxonomy every FUTURE feature repository catches instead of
/// rolling its own status-code-sniffing per feature. Auth's `ApiError`
/// (`features/auth/data/auth_exceptions.dart`) predates this and is
/// UNCHANGED by this batch — it stays a specialized, self-contained type;
/// see `core/error/error_messages.dart`'s doc comment for why it is not
/// migrated onto this taxonomy in this batch (re-homed copy only, R4).
///
/// Pure Dart — no Dio, no `omnistock_api_client` (gate rule 1/3 friendly:
/// this file is safe to import from anywhere, including `domain/` if a
/// future usecase ever needs to pattern-match a failure). The Dio/wire-
/// specific half (extracting status/code/retryAfter from a live
/// `DioException`) lives in `core/api/error_mapping.dart` instead — the
/// ONLY place besides `features/*/data/**` allowed to import
/// `omnistock_api_client` (gate rule 3).
///
/// `switch` over this sealed class is compiler-exhaustive — see
/// [failureMessage] — a new failure case can't be silently unhandled
/// anywhere it's switched over.
/// api-spec §4 — the one 403 code that means "not a member of this shop".
const String orgAccessDeniedCode = 'ORG_ACCESS_DENIED';

/// api-spec §1 — `details.reason` marking a 409 as temporary lock contention.
const String busyReason = 'busy';

sealed class ApiFailure implements Exception {
  const ApiFailure();
}

/// SocketException/timeout/no HTTP response at all.
class NetworkFailure extends ApiFailure {
  const NetworkFailure();
}

/// 429.
class ThrottledFailure extends ApiFailure {
  const ThrottledFailure({this.retryAfterSeconds});
  final int? retryAfterSeconds;
}

/// A 401 that a refresh-then-retry-once attempt could not resolve — the
/// TERMINAL "session is over" signal (mirrors
/// `core/api/refresh_coordinator.dart`'s `SessionExpiredException`, which is
/// what the interceptor chain actually throws for this case — see
/// `core/api/refresh_interceptor.dart`). Not every raw 401 becomes this; a
/// 401 a refresh CAN resolve never reaches a repository as a thrown failure
/// at all (the interceptor transparently retries it).
class AuthExpiredFailure extends ApiFailure {
  const AuthExpiredFailure({this.code});
  final String? code;
}

/// 403 — RBAC (capability), not tier. See [EntitlementFailure] for the tier
/// axis (mobile.md §1.2 case B3: RBAC `can()` vs tier `entitled()` are
/// deliberately separate axes, never conflated).
class ForbiddenFailure extends ApiFailure {
  const ForbiddenFailure({this.code});
  final String? code;
}

/// ★ T-002-M2 — `403 ORG_ACCESS_DENIED`: not an active member of THIS shop
/// (removed, never was, or the shop does not exist — api-spec §4).
///
/// Its OWN case, not `ForbiddenFailure(code: 'ORG_ACCESS_DENIED')`, because
/// the two demand opposite behaviour: this one drops the active shop and
/// sends the person to the picker; [ForbiddenFailure] keeps them where they
/// are and shows a message. A reader who forgets to check the code gets one
/// of them at random, and the wrong pick is the destructive direction —
/// throwing somebody out of a shop they are still a member of.
///
/// Separate cases make the omission a compile error instead, because
/// [failureMessage]'s `switch` is exhaustive. Same decision as the web
/// client's `ApiFailure` union: "ลืมแล้วพัง ไม่ใช่ลืมแล้วรั่ว".
///
/// ⛔ Never sign the person out here. A session is not tied to a shop
/// (D-027) — `SessionController.orgAccessDenied()` drops the org and keeps
/// the session.
class OrgAccessDeniedFailure extends ApiFailure {
  const OrgAccessDeniedFailure();
}

/// ★ T-002-M2 — `409 CONFLICT` + `details.reason == "busy"`: the shop is
/// mid-write on another request and this one lost the row lock
/// (api-spec §1 "Lock contention", architecture §5.2).
///
/// Its own case rather than a flag on [ConflictFailure] because
/// ux-wireframe §1.4 requires it to be checked BEFORE any screen's own 409
/// copy — a cancel-invitation screen must not report "คำเชิญนี้ไม่ได้รออยู่แล้ว"
/// for what is actually a temporary collision. A separate case makes that
/// ordering structural.
///
/// The wire is unchanged: it is still a plain 409, so api-spec §1's promise
/// that a client which does not recognise `reason` still behaves correctly
/// holds. Only our taxonomy names the case.
class BusyFailure extends ApiFailure {
  const BusyFailure();
}

/// 403 — tier/entitlement (not RBAC). `feature` carries the entitlement
/// code once F-007 defines a wire convention for it — see
/// [mapStatusToApiFailure]'s doc comment for the (conservative, additive)
/// default used until then.
class EntitlementFailure extends ApiFailure {
  const EntitlementFailure({this.feature});
  final String? feature;
}

/// 400/422. `fieldErrors` is always empty today — the current wire
/// `ErrorResponse` envelope (`api_client/lib/src/model/error_response*.dart`)
/// only carries `{code, message}`, no per-field map yet (a `backend-api`
/// contract change, not a mobile decision — docs/architecture/refactor-plan.md
/// §2 "wire envelope").
class ValidationFailure extends ApiFailure {
  const ValidationFailure({this.code, this.fieldErrors = const {}});
  final String? code;
  final Map<String, String> fieldErrors;
}

/// 409.
class ConflictFailure extends ApiFailure {
  const ConflictFailure({this.code});
  final String? code;
}

/// 404.
class NotFoundFailure extends ApiFailure {
  const NotFoundFailure();
}

/// 5xx, and the safe fallback for any status this mapper doesn't otherwise
/// recognize — never silently drops a failure into an unhandled state.
class ServerFailure extends ApiFailure {
  const ServerFailure();
}

/// 426 / `APP_UPDATE_REQUIRED`.
class ForceUpdateFailure extends ApiFailure {
  const ForceUpdateFailure();
}

/// Pure status/code -> [ApiFailure] mapper — no Dio, no
/// `omnistock_api_client`; plain `dart test`. [status] is `null` for "no
/// HTTP response at all" (network failure/timeout — the Dio-specific caller,
/// `core/api/error_mapping.dart`, is the one that decides when that's true).
///
/// Entitlement-vs-Forbidden (403) disambiguation: until F-007 defines a real
/// wire code convention for tier-gated 403s, every 403 maps to
/// [ForbiddenFailure] UNLESS [code] already looks like an entitlement code
/// (`ENTITLEMENT_`/`TIER_` prefix) — a conservative default a real F-007
/// code list can only ever WIDEN, never break: an unrecognized 403 code
/// today stays [ForbiddenFailure], the safer of the two UX treatments
/// (hide/disable) rather than [EntitlementFailure]'s "show + upsell" for a
/// code that might not actually mean "wrong tier".
ApiFailure mapStatusToApiFailure(
  int? status, {
  String? code,
  int? retryAfterSeconds,
  /// `error.details.reason` — today only `"busy"` (api-spec §1). Passed in
  /// rather than sniffed here so this file stays pure Dart.
  String? reason,
}) {
  if (status == null) return const NetworkFailure();
  switch (status) {
    case 429:
      return ThrottledFailure(retryAfterSeconds: retryAfterSeconds);
    case 401:
      return AuthExpiredFailure(code: code);
    case 403:
      // ★ Checked FIRST, and by exact code: this is the one 403 that means
      // "you are not in this shop" rather than "you may not do this".
      if (code == orgAccessDeniedCode) return const OrgAccessDeniedFailure();
      if (code != null && (code.startsWith('ENTITLEMENT') || code.startsWith('TIER'))) {
        return EntitlementFailure(feature: code);
      }
      // An unlabelled 403 stays Forbidden — the NON-destructive reading.
      // Guessing OrgAccessDenied would evict a member on any 403 this build
      // has not seen before.
      return ForbiddenFailure(code: code);
    case 400:
    case 422:
      return ValidationFailure(code: code);
    case 409:
      // ★ Before the generic conflict, per ux-wireframe §1.4's explicit
      // ordering rule.
      if (reason == busyReason) return const BusyFailure();
      return ConflictFailure(code: code);
    case 404:
      return const NotFoundFailure();
    case 426:
      return const ForceUpdateFailure();
    default:
      return const ServerFailure();
  }
}

/// core/error/failure_messages.dart (mobile.md §3.4) — central Thai fallback
/// per failure category. A feature MAY add its own code-specific override on
/// top (auth does, via `core/error/error_messages.dart` — a parallel,
/// independent mapping keyed off its own `ApiError.code`, not this
/// function); this is the fallback every OTHER feature gets for free without
/// writing its own switch.
///
/// [NetworkFailure]/[ServerFailure] copy is quoted verbatim from
/// mobile.md §3.4's own spec comment. [AuthExpiredFailure] reuses the
/// already ux-approved `authSessionExpiredToast` copy (same semantic:
/// session is over — ux-wireframe §7). The rest are placeholder copy
/// pending `ux` sign-off (same precedent as `authBootstrapOfflineUseLoginInstead`,
/// D-022) — never render the raw machine `code`/`feature` to the user.
String failureMessage(AppLocalizations t, ApiFailure f) => switch (f) {
      NetworkFailure() => t.errorNetwork,
      ThrottledFailure() => t.errorThrottled,
      AuthExpiredFailure() => t.authSessionExpiredToast,
      OrgAccessDeniedFailure() => t.errorOrgAccessDenied,
      ForbiddenFailure() => t.errorForbidden,
      EntitlementFailure() => t.errorEntitlement,
      ValidationFailure() => t.errorValidation,
      BusyFailure() => t.errorBusy,
      ConflictFailure() => t.errorConflict,
      NotFoundFailure() => t.errorNotFound,
      ServerFailure() => t.errorServer,
      ForceUpdateFailure() => t.errorForceUpdate,
    };
