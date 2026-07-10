import 'package:omnistock_api_client/omnistock_api_client.dart';

/// Thrown for any non-2xx auth response; carries the parsed error envelope
/// (when present) plus the HTTP status and `Retry-After` seconds (429
/// throttle UX, api-spec §3). Mirrors `apps/web/src/lib/auth-client.ts`'s
/// `ApiError` so both platforms map errors identically.
///
/// Lives in `features/auth/data/` (not `domain/`) because it carries the
/// GENERATED `ErrorResponse` type — the domain layer is pure Dart and may
/// never import `omnistock_api_client` (docs/mobile-architecture.md §2).
/// `SessionExpiredException` (the session-is-dead signal) lives in
/// `core/api/refresh_coordinator.dart` instead, since it's thrown by the
/// app-wide (not auth-specific) request/refresh machinery.
class ApiError implements Exception {
  ApiError(this.status, this.errorResponse, [this.retryAfterSeconds]);

  final int status;
  final ErrorResponse? errorResponse;
  final int? retryAfterSeconds;

  String? get code => errorResponse?.error.code;

  @override
  String toString() => 'ApiError(status: $status, code: $code)';
}
