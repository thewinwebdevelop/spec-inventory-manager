import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/auth/presentation/screens/bootstrap_screen.dart';
import '../features/auth/presentation/screens/security_screen.dart';
import 'auth_flow.dart';
import 'theme/app_theme.dart';

// T-001-17 — real F-001 auth screens (signup/login/help/security), replacing
// the F-000 placeholder shell. Still proves apps/mobile consumes the
// generated OpenAPI Dart client (package:omnistock_api_client) — now via
// real typed usage throughout lib/features/auth/**
// (AuthApi, LoginRequest, TokenResponse, Session, ...), not just a single
// enum reference.
//
// F-006 integration seam (see lib/app/auth_flow.dart doc comment): this
// widget is a *standalone* runnable proof, not the final app shell — F-006
// owns real navigation/IA (`app/router.dart`) and should wire
// `authRepositoryProvider`'s override + `BootstrapScreen`/`AuthFlow`/
// `SecurityScreen` into its own bootstrap rather than depend on this
// particular `MaterialApp`.
//
// D-023: this was `main.dart`'s `OmniStockApp` before the mobile
// architecture refactor — moved to `app/app.dart` (composition root) so
// `main.dart` can be the thin `runApp(ProviderScope(child: OmniStockApp()))`
// the doc specifies.

/// Which top-level destination `_OmniStockAppState` is showing. `bootstrap`
/// is the cold-start restore gate (T-001-17 M-2, pulled forward from F-006
/// by D-021→D-022) — the app never jumps straight to the login screen
/// without first checking whether a refresh token already lives in the
/// keychain/keystore.
enum _AppDestination { bootstrap, authFlow, authenticated }

class OmniStockApp extends ConsumerStatefulWidget {
  const OmniStockApp({super.key});

  @override
  ConsumerState<OmniStockApp> createState() => _OmniStockAppState();
}

class _OmniStockAppState extends ConsumerState<OmniStockApp> {
  var _destination = _AppDestination.bootstrap;

  @override
  Widget build(BuildContext context) {
    final Widget home;
    switch (_destination) {
      case _AppDestination.bootstrap:
        home = BootstrapScreen(
          onRestored: () => setState(() => _destination = _AppDestination.authenticated),
          onNeedsLogin: () => setState(() => _destination = _AppDestination.authFlow),
        );
      case _AppDestination.authenticated:
        home = SecurityScreen(
          onSessionExpired: () => setState(() => _destination = _AppDestination.authFlow),
        );
      case _AppDestination.authFlow:
        home = AuthFlow(
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
