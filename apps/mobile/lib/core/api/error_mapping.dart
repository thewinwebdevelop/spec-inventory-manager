import 'package:dio/dio.dart';

import '../error/api_failure.dart';

/// R2/R3 (docs/architecture/refactor-plan.md §4, mobile.md §3.4) — the
/// Dio-specific half of the central error taxonomy. Lives in `core/api/`
/// (not `core/error/`) — extracting status/code/retry-after from a live
/// `DioException`/response body doesn't need `omnistock_api_client` (the
/// wire error envelope is plain JSON — `{ error: { code, message } }` — Dio
/// hands back the raw decoded `Map`, not a typed `ErrorResponse`, on a
/// non-2xx response; mirrors `features/auth/data/auth_repository_impl.dart`'s
/// `_parseErrorResponse` doc comment), so this file has no `dart:ui`/wire
/// coupling either — kept `core/api/` anyway to mirror where the interceptor
/// that calls it lives (`error_mapping_interceptor.dart`).
///
/// `core/error/api_failure.dart`'s [mapStatusToApiFailure] stays pure
/// (`dart test`, no Dio) — this function is the thin glue on top.
ApiFailure mapDioExceptionToApiFailure(DioException e) {
  final response = e.response;
  if (response == null) return const NetworkFailure();
  return mapStatusToApiFailure(
    response.statusCode,
    code: extractErrorCode(response.data),
    retryAfterSeconds: extractRetryAfterSeconds(response.headers.map),
  );
}

/// `Retry-After` header (seconds) — 429 throttle UX (api-spec §3). Header
/// names are case-insensitive on the wire; Dio's `Headers.map` preserves
/// whatever casing the server sent, so both common castings are checked.
int? extractRetryAfterSeconds(Map<String, List<String>> headers) {
  final values = headers['retry-after'] ?? headers['Retry-After'];
  if (values == null || values.isEmpty) return null;
  return int.tryParse(values.first);
}

/// Machine-readable `error.code` from the wire envelope
/// (`{ error: { code, message } }`) — never surfaces `message` itself (B6:
/// server-provided prose is not routed to the user; only `code` selects a
/// central/feature-owned Thai string). Defensive against a malformed/absent
/// body (proxy/CDN error pages etc.) — returns null rather than throwing.
String? extractErrorCode(Object? data) {
  if (data is Map) {
    final error = data['error'];
    if (error is Map) {
      final code = error['code'];
      if (code is String) return code;
    }
  }
  return null;
}
