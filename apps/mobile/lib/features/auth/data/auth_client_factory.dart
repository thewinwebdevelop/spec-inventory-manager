import 'package:omnistock_api_client/omnistock_api_client.dart';

import '../../../core/api/https_guard.dart';
import 'auth_repository_impl.dart';
import 'token_store.dart';

/// Bootstrap helper — builds an [AuthRepositoryImpl] wired to the GENERATED
/// [OmnistockApiClient] (no hand-reshaping of the contract, per frontend
/// domain rules). Lives in `features/auth/data/` (D-023 — the doc's own
/// migration map suggested `core/api/`, but this function constructs an
/// AUTH-SPECIFIC repository, which would make `core/` depend on
/// `features/auth/` and trip the boundary gate's rule 2 — see
/// `core/api/https_guard.dart`'s doc comment for the split rationale). Only
/// the feature-agnostic https-in-release guard moved to `core/api/`; every
/// future feature's own generated-client factory (F-013 stock, F-024 orders,
/// ...) lives next to that feature's `data/`, the same as this one, and
/// calls the shared `core/api/https_guard.dart` guard.
///
/// `app/bootstrap.dart` owns app-wide DI/bootstrap; this is the documented
/// seam it calls once at startup (or injects its own [OmnistockApiClient]
/// instance if it needs shared Dio config e.g. base URL per environment).
///
/// T-001-17 ★ client-security fix (M-3): the generated [OmnistockApiClient]'s
/// default `basePath` is cleartext `http://localhost:3000` — fine for local
/// dev, never acceptable as an implicit prod default. [baseUrl] is therefore
/// REQUIRED (no hardcoded fallback here); per-environment values are
/// F-006/devops's call, this function only provides the seam + the guard
/// (see [guardBaseUrlForRelease]).
AuthRepositoryImpl createAuthClient({
  required String baseUrl,
  OmnistockApiClient? apiClient,
  TokenStore? tokenStore,
  String? deviceId,
}) {
  guardBaseUrlForRelease(baseUrl);
  final client = apiClient ?? OmnistockApiClient(basePathOverride: baseUrl);
  return AuthRepositoryImpl(
    authApi: client.getAuthApi(),
    tokenStore: tokenStore ?? TokenStore(),
    deviceId: deviceId,
  );
}
