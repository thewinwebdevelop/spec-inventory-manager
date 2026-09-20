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
    reason: extractErrorReason(response.data),
    fieldErrors: extractFieldErrors(response.data),
    details: extractDetails(response.data),
  );
}

/// ★ T-002-M3 — `error.fieldErrors` (D-025).
///
/// Read here rather than left on the floor because two F-002 screens are
/// specified against it: S2's `422` puts the server's message under the shop
/// name, S7's under the email. Values that are not strings are DROPPED
/// instead of stringified — a screen must never render `{}` or `null` at a
/// user, and a partially-typed map is still useful.
Map<String, String> extractFieldErrors(Object? data) {
  final raw = _errorObject(data)?['fieldErrors'];
  if (raw is! Map) return const {};
  final out = <String, String>{};
  raw.forEach((key, value) {
    if (key is String && value is String) out[key] = value;
  });
  return out;
}

/// ★ T-002-M3 — `error.details` (D-025), kept as raw values.
///
/// The reason this exists at all: `409 ORG_LIMIT_REACHED` carries
/// `details.limit`, and api-spec §3.1 says so specifically so that no client
/// hard-codes the cap. Dropping `details` here would leave S2 with a choice
/// between inventing a number and saying nothing useful.
///
/// Types are NOT coerced — a caller that wants a number checks for one, so a
/// server sending `"5"` fails the check rather than silently becoming 5.
Map<String, Object?> extractDetails(Object? data) {
  final raw = _errorObject(data)?['details'];
  if (raw is! Map) return const {};
  final out = <String, Object?>{};
  raw.forEach((key, value) {
    if (key is String) out[key] = value;
  });
  return out;
}

/// The `error` object of the envelope, or null for any body that is not one
/// (a proxy error page, a CDN interstitial, an empty response).
Map<Object?, Object?>? _errorObject(Object? data) {
  if (data is Map) {
    final error = data['error'];
    if (error is Map) return error;
  }
  return null;
}

/// `Retry-After` header (seconds) — 429 throttle UX (api-spec §3). Header
/// names are case-insensitive on the wire; Dio's `Headers.map` preserves
/// whatever casing the server sent, so both common castings are checked.
int? extractRetryAfterSeconds(Map<String, List<String>> headers) {
  final values = headers['retry-after'] ?? headers['Retry-After'];
  if (values == null || values.isEmpty) return null;
  return int.tryParse(values.first);
}

/// ★ T-002-M2 — `error.details.reason` from the wire envelope.
///
/// Today the only value is `"busy"` (api-spec §1's lock-contention row), and
/// it arrives inside `details` — a field this mapper previously ignored
/// entirely, which is why a 409 that was really "the shop is mid-write" was
/// indistinguishable from "the invitation is not pending".
///
/// Same defensive shape as [extractErrorCode]: a malformed or absent body
/// (a proxy error page, a CDN interstitial) returns null rather than
/// throwing, so an unreadable response degrades to the generic conflict
/// rather than to a crash.
String? extractErrorReason(Object? data) {
  if (data is Map) {
    final error = data['error'];
    if (error is Map) {
      final details = error['details'];
      if (details is Map) {
        final reason = details['reason'];
        if (reason is String) return reason;
      }
    }
  }
  return null;
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
