import 'package:dio/dio.dart';

/// R2 (docs/architecture/refactor-plan.md §4, mobile.md §3.1) — reads the
/// GENERATED client's own `extra['secure']` metadata (every `AuthApi.xxx()`
/// method sets it from the OpenAPI `security` requirement it was generated
/// from — see `api_client/lib/src/api/auth_api.dart`: an empty list for
/// `security: []` endpoints like login/signup/refresh/logout, a
/// `{scheme: 'bearer', ...}` entry for Bearer-authed ones) instead of a
/// per-repository convention. This is the STRUCTURAL signal
/// `core/api/auth_token_interceptor.dart` and `core/api/refresh_interceptor.dart`
/// both key off: whether to attach `Authorization: Bearer` and whether a 401
/// is even eligible for refresh-then-retry — driven by the CONTRACT, not a
/// flag a repository author could forget to set (mirrors the "ลืมไม่ได้
/// เชิงโครงสร้าง" design goal that motivated org-scoped Dio, mobile.md §3.2,
/// applied to the auth-attach/refresh decision instead of the org header).
bool requestWantsBearerAuth(RequestOptions options) {
  final secure = options.extra['secure'];
  if (secure is! List) return false;
  return secure.any((entry) => entry is Map && entry['scheme'] == 'bearer');
}
