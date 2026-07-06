import 'package:omnistock_api_client/omnistock_api_client.dart';

/// Thrown for any non-2xx auth response; carries the parsed error envelope
/// (when present) plus the HTTP status and `Retry-After` seconds (429
/// throttle UX, api-spec §3). Mirrors `apps/web/src/lib/auth-client.ts`'s
/// `ApiError` so both platforms map errors identically.
class ApiError implements Exception {
  ApiError(this.status, this.errorResponse, [this.retryAfterSeconds]);

  final int status;
  final ErrorResponse? errorResponse;
  final int? retryAfterSeconds;

  String? get code => errorResponse?.error.code;

  @override
  String toString() => 'ApiError(status: $status, code: $code)';
}

/// Thrown when silent refresh + retry-once both fail — the caller (screen/
/// router) must treat the session as dead: wipe secure storage + in-memory
/// state (client-security skill) and route to the login screen with the
/// polite "session expired" toast (ux-wireframe §7 — same copy regardless of
/// cause, never signals "reuse detected" to the client, api-spec §2.3).
class SessionExpiredException implements Exception {
  const SessionExpiredException();

  @override
  String toString() => 'SessionExpiredException';
}

bool isSessionExpired(Object err) => err is SessionExpiredException;
