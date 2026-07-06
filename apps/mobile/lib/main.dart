import 'package:flutter/material.dart';

import 'auth/auth_client.dart';
import 'auth/auth_client_factory.dart';
import 'auth/auth_flow.dart';
import 'auth/screens/bootstrap_screen.dart';
import 'auth/screens/security_screen.dart';
import 'theme/app_theme.dart';

// T-001-17 — real F-001 auth screens (signup/login/help/security), replacing
// the F-000 placeholder shell. Still proves apps/mobile consumes the
// generated OpenAPI Dart client (package:omnistock_api_client) — now via
// real typed usage throughout lib/auth/** (AuthApi, LoginRequest,
// TokenResponse, Session, ...), not just a single enum reference.
//
// F-006 integration seam (see lib/auth/auth_flow.dart doc comment): this
// `main()` is a *standalone* runnable proof, not the final app shell — F-006
// owns real navigation/IA and should wire `createAuthClient()` +
// `BootstrapScreen`/`AuthFlow`/`SecurityScreen` into its own bootstrap rather
// than depend on this particular `MaterialApp`.
//
// T-001-17 ★ (M-3): `createAuthClient` requires an explicit `baseUrl` (no
// hardcoded prod default) and rejects a non-https base URL outside debug
// builds. This placeholder shell only ever runs in debug (`fvm flutter run`/
// `flutter test`), so the plain-http local dev server is fine here; F-006
// owns picking the real per-environment (staging/prod https) URL.
const _devBaseUrl = 'http://localhost:3000';

void main() {
  runApp(const OmniStockApp());
}

/// Which top-level destination `_OmniStockAppState` is showing. `bootstrap`
/// is the cold-start restore gate (T-001-17 M-2, pulled forward from F-006
/// by D-021→D-022) — the app never jumps straight to the login screen
/// without first checking whether a refresh token already lives in the
/// keychain/keystore.
enum _AppDestination { bootstrap, authFlow, authenticated }

class OmniStockApp extends StatefulWidget {
  /// [authClient] is injectable so tests can substitute one wired to a fake
  /// [SecureStorage]/HTTP adapter instead of touching the real
  /// FlutterSecureStorage platform channel (which has no test-time
  /// implementation and would hang `flutter test` — see
  /// `test/widget_test.dart`). Production (`main()`) always uses the default,
  /// which builds a real [createAuthClient].
  const OmniStockApp({super.key, AuthClient? authClient}) : _authClient = authClient;

  final AuthClient? _authClient;

  @override
  State<OmniStockApp> createState() => _OmniStockAppState();
}

class _OmniStockAppState extends State<OmniStockApp> {
  late final _authClient = widget._authClient ?? createAuthClient(baseUrl: _devBaseUrl);
  var _destination = _AppDestination.bootstrap;

  @override
  Widget build(BuildContext context) {
    final Widget home;
    switch (_destination) {
      case _AppDestination.bootstrap:
        home = BootstrapScreen(
          authClient: _authClient,
          onRestored: () => setState(() => _destination = _AppDestination.authenticated),
          onNeedsLogin: () => setState(() => _destination = _AppDestination.authFlow),
        );
      case _AppDestination.authenticated:
        home = SecurityScreen(
          authClient: _authClient,
          onSessionExpired: () => setState(() => _destination = _AppDestination.authFlow),
        );
      case _AppDestination.authFlow:
        home = AuthFlow(
          authClient: _authClient,
          onAuthenticated: () => setState(() => _destination = _AppDestination.authenticated),
        );
    }

    return MaterialApp(
      title: 'OmniStock',
      theme: buildAppTheme(),
      home: home,
    );
  }
}
