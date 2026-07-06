import 'package:flutter/material.dart';

import 'auth/auth_client_factory.dart';
import 'auth/auth_flow.dart';
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
// `AuthFlow`/`SecurityScreen` into its own bootstrap rather than depend on
// this particular `MaterialApp`.
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

class OmniStockApp extends StatefulWidget {
  const OmniStockApp({super.key});

  @override
  State<OmniStockApp> createState() => _OmniStockAppState();
}

class _OmniStockAppState extends State<OmniStockApp> {
  late final _authClient = createAuthClient(baseUrl: _devBaseUrl);
  bool _authenticated = false;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'OmniStock',
      theme: buildAppTheme(),
      home: _authenticated
          ? SecurityScreen(
              authClient: _authClient,
              onSessionExpired: () => setState(() => _authenticated = false),
            )
          : AuthFlow(
              authClient: _authClient,
              onAuthenticated: () => setState(() => _authenticated = true),
            ),
    );
  }
}
