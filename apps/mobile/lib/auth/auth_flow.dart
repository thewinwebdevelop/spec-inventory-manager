import 'package:flutter/material.dart';

import 'auth_client.dart';
import 'screens/login_help_screen.dart';
import 'screens/login_screen.dart';
import 'screens/signup_screen.dart';

/// F-006 integration seam (T-001-17 note): F-006 owns the app shell/nav IA
/// (bottom-nav/drawer, "ตั้งค่า" → "ความปลอดภัย" entry point per ux-wireframe
/// §8/§9.1) and the post-login destination. This widget is a **self-contained
/// pre-auth flow** (login ⇄ signup ⇄ help, all wired to the same
/// [AuthClient]) that F-006 can either:
///   1. push as its initial route until a real access token exists, or
///   2. inline/replace piece by piece into its own navigator — each screen
///      ([SignupScreen], [LoginScreen], [LoginHelpScreen], and
///      `SecurityScreen` post-login) is already a standalone,
///      dependency-injected widget; nothing here requires this particular
///      [Navigator] wrapper.
///
/// [onAuthenticated] fires once a real token pair exists (after login, or
/// signup followed by the user's own login) — F-006 should replace this
/// whole flow with its authenticated app shell at that point (ux-wireframe
/// §1 flow map: "[Org context: F-002]").
class AuthFlow extends StatefulWidget {
  const AuthFlow({
    super.key,
    required this.authClient,
    required this.onAuthenticated,
  });

  final AuthClient authClient;
  final VoidCallback onAuthenticated;

  @override
  State<AuthFlow> createState() => _AuthFlowState();
}

class _AuthFlowState extends State<AuthFlow> {
  final _navigatorKey = GlobalKey<NavigatorState>();

  @override
  Widget build(BuildContext context) {
    return Navigator(
      key: _navigatorKey,
      initialRoute: '/login',
      onGenerateRoute: (settings) {
        switch (settings.name) {
          case '/signup':
            return MaterialPageRoute(
              settings: settings,
              builder: (context) => SignupScreen(
                authClient: widget.authClient,
                onSignupSuccess: (email) {
                  _navigatorKey.currentState!.pushReplacementNamed('/login', arguments: email);
                },
                onNavigateToLogin: () => _navigatorKey.currentState!.pop(),
              ),
            );
          case '/help':
            return MaterialPageRoute(
              settings: settings,
              builder: (context) => LoginHelpScreen(
                onBackToLogin: () => _navigatorKey.currentState!.pop(),
              ),
            );
          case '/login':
          default:
            final prefill = settings.arguments as String?;
            return MaterialPageRoute(
              settings: settings,
              builder: (context) => LoginScreen(
                authClient: widget.authClient,
                prefillEmail: prefill,
                onLoginSuccess: widget.onAuthenticated,
                onNavigateToSignup: () => _navigatorKey.currentState!.pushNamed('/signup'),
                onNavigateToHelp: () => _navigatorKey.currentState!.pushNamed('/help'),
              ),
            );
        }
      },
    );
  }
}
