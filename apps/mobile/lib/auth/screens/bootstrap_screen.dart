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

  // D-022 ★ re-review fix (Minor #4): guards `onRestored`/`onNeedsLogin` so
  // they fire AT MOST once per screen instance. Without this, two rapid
  // retry taps (or a retry racing the initial `_run()`) could each run
  // `runAuthBootstrap` to a terminal outcome and each call the terminal
  // callback — F-006's Navigator caller only expects one route transition,
  // and a double-fire (e.g. two `pushReplacement`s) is a caller-side bug
  // this widget shouldn't be able to trigger.
  var _decided = false;

  @override
  void initState() {
    super.initState();
    _run();
  }

  Future<void> _run() async {
    if (_decided) return;
    setState(() => _status = AuthBootstrapStatus.loading);
    final result = await runAuthBootstrap(widget.authClient);
    if (!mounted || _decided) return;

    switch (result) {
      case AuthBootstrapStatus.restored:
        _decided = true;
        widget.onRestored();
        return;
      case AuthBootstrapStatus.noSession:
      case AuthBootstrapStatus.sessionExpired:
        _decided = true;
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

  /// D-022 (Important #2 — escape hatch): lets the user leave the
  /// offline/retry loop and log in with a password instead of being stuck
  /// forever on a persistent non-401 failure (broken proxy/CDN, wrong base
  /// URL, contract drift). Deliberately reuses [onNeedsLogin] — it is the
  /// SAME "go to the login flow" transition `noSession`/`sessionExpired`
  /// already use, and critically does NOT touch storage: the refresh token
  /// already in the keychain is simply left alone (a successful password
  /// login overwrites it with a fresh pair anyway; the old token family is
  /// server-side GC'able, so leaving it is not a security issue).
  void _useLoginInstead() {
    if (_decided) return;
    _decided = true;
    widget.onNeedsLogin();
  }

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
                      const SizedBox(height: AppSpacing.s2),
                      // D-022 (Important #2): escape hatch out of a
                      // persistent (non-401) transient-failure loop — does
                      // NOT wipe the keychain, see `_useLoginInstead`.
                      TextButton(
                        onPressed: _useLoginInstead,
                        child: Text(AuthTh.bootstrapOfflineUseLoginInstead),
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
