import 'package:flutter/foundation.dart' show kReleaseMode;
import 'package:omnistock_api_client/omnistock_api_client.dart';

import 'auth_client.dart';
import 'token_store.dart';

/// Pure guard extracted out of [createAuthClient] so it's directly unit
/// testable without depending on the compile-time `kReleaseMode` const
/// (which is always `false` under `flutter test`). [isRelease] defaults to
/// the real `kReleaseMode` in production use.
///
/// Throws [ArgumentError] when [isRelease] is true and [baseUrl] is not
/// `https://` — a plaintext prod endpoint must be refused loudly rather than
/// silently sending credentials/tokens over cleartext HTTP. Debug/local
/// (`http://localhost`, `http://10.0.2.2`, etc.) is only permitted when NOT
/// in a release build.
void guardBaseUrlForRelease(String baseUrl, {bool isRelease = kReleaseMode}) {
  if (isRelease && !baseUrl.startsWith('https://')) {
    throw ArgumentError.value(
      baseUrl,
      'baseUrl',
      'must use https:// in release builds (client-security M-3) — '
          'plaintext http:// is only permitted outside kReleaseMode, for local dev',
    );
  }
}

/// Bootstrap helper — builds an [AuthClient] wired to the GENERATED
/// [OmnistockApiClient] (no hand-reshaping of the contract, per frontend
/// domain rules). F-006 owns app-wide DI/bootstrap; this is the documented
/// seam it should call once at startup (or inject its own [OmnistockApiClient]
/// instance if it needs shared Dio config e.g. base URL per environment).
///
/// T-001-17 ★ client-security fix (M-3): the generated [OmnistockApiClient]'s
/// default `basePath` is cleartext `http://localhost:3000` — fine for local
/// dev, never acceptable as an implicit prod default. [baseUrl] is therefore
/// REQUIRED (no hardcoded fallback here); per-environment values are
/// F-006/devops's call, this function only provides the seam + the guard
/// (see [guardBaseUrlForRelease]).
AuthClient createAuthClient({
  required String baseUrl,
  OmnistockApiClient? apiClient,
  TokenStore? tokenStore,
  String? deviceId,
}) {
  guardBaseUrlForRelease(baseUrl);
  final client = apiClient ?? OmnistockApiClient(basePathOverride: baseUrl);
  return AuthClient(
    authApi: client.getAuthApi(),
    tokenStore: tokenStore ?? TokenStore(),
    deviceId: deviceId,
  );
}
