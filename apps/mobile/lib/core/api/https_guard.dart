import 'package:flutter/foundation.dart' show kReleaseMode;

/// D-023 — the generic (feature-agnostic) half of what used to be
/// `lib/auth/auth_client_factory.dart`: the https-in-release guard itself.
/// Lives in `core/api/` because every feature's generated-client factory
/// (auth today; stock/orders later, F-013/F-024) needs the SAME guard, not
/// just auth's — `core/` must never depend on `features/*` (boundary rule),
/// so the guard is kept dependency-free here and each feature's own
/// `data/*_client_factory.dart` calls it.
///
/// Pure guard, directly unit testable without depending on the compile-time
/// `kReleaseMode` const (which is always `false` under `flutter test`).
/// [isRelease] defaults to the real `kReleaseMode` in production use.
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
