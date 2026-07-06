import 'package:flutter/material.dart';

import '../../i18n/auth_th.dart';
import '../../theme/app_theme.dart';
import '../auth_bootstrap.dart';
import '../auth_client.dart';
import '../widgets/error_banner.dart';

/// T-001-17 ★ (M-2/L-3) — the cold-start restore gate. F-006 integration
/// seam (mirrors auth_flow.dart's doc comment): this widget is a
/// self-contained "run [runAuthBootstrap], show loading, then hand off"
/// screen that F-006 can drop in as its very first route, or reimplement
/// against the same [runAuthBootstrap] function if it needs a different
/// splash/branding treatment — nothing here is load-bearing beyond the
/// bootstrap call itself.
///
/// States (design-system.md §2's 4-state rule, applied to a one-shot startup
/// gate rather than a data list):
/// - loading: brief spinner while the restore attempt is in flight.
/// - transientFailure (L-3): offline/retry banner — does NOT wipe the
///   session or force login, since the refresh token is still intact in the
///   keychain (only a genuine dead-session wipes it).
/// - restored / sessionExpired / noSession: hand off to [onRestored] /
///   [onNeedsLogin] respectively — a terminal decision, made exactly once.
class BootstrapScreen extends StatefulWidget {
  const BootstrapScreen({
    super.key,
    required this.authClient,
    required this.onRestored,
    required this.onNeedsLogin,
  });

  final AuthClient authClient;

  /// Fired once when a live session was restored — caller should route to
  /// the authenticated destination (post-login screen).
  final VoidCallback onRestored;

  /// Fired once when there is no session to restore (never logged in, or the
  /// refresh token is genuinely dead) — caller should route to login.
  final VoidCallback onNeedsLogin;

  @override
  State<BootstrapScreen> createState() => BootstrapScreenState();
}

class BootstrapScreenState extends State<BootstrapScreen> {
  AuthBootstrapStatus _status = AuthBootstrapStatus.loading;

  @override
  void initState() {
    super.initState();
    _run();
  }

  Future<void> _run() async {
    setState(() => _status = AuthBootstrapStatus.loading);
    final result = await runAuthBootstrap(widget.authClient);
    if (!mounted) return;

    switch (result) {
      case AuthBootstrapStatus.restored:
        widget.onRestored();
        return;
      case AuthBootstrapStatus.noSession:
      case AuthBootstrapStatus.sessionExpired:
        widget.onNeedsLogin();
        return;
      case AuthBootstrapStatus.transientFailure:
        // Terminal FOR NOW — stay on this screen and offer retry (L-3);
        // does not touch storage, does not force login.
        setState(() => _status = AuthBootstrapStatus.transientFailure);
        return;
      case AuthBootstrapStatus.loading:
        return; // unreachable — runAuthBootstrap never returns `loading`.
    }
  }

  /// Exposed for tests / the retry button — re-runs the same one-shot
  /// bootstrap (never loops automatically; only on explicit user action).
  Future<void> retry() => _run();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.screenPadding),
            child: _status == AuthBootstrapStatus.transientFailure
                ? Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        AuthTh.bootstrapOfflineTitle,
                        style: AppTypography.headingSm,
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: AppSpacing.s4),
                      ErrorBanner(
                        message: AuthTh.bootstrapOfflineBody,
                        onRetry: retry,
                        retryLabel: AuthTh.bootstrapOfflineRetry,
                      ),
                    ],
                  )
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const CircularProgressIndicator(),
                      const SizedBox(height: AppSpacing.s4),
                      Text(AuthTh.bootstrapLoading, style: AppTypography.bodyMd),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}
