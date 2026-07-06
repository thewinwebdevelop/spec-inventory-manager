import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/i18n/auth_th.dart';
import '../../../../app/theme/app_theme.dart';
import '../../../../core/ui/error_banner.dart';
import '../../application/bootstrap_controller.dart';
import '../../domain/entities/auth_bootstrap_status.dart';

/// T-001-17 ★ (M-2/L-3) — the cold-start restore gate. F-006 integration
/// seam (mirrors auth_flow.dart's doc comment): this widget is a
/// self-contained "watch [bootstrapControllerProvider], show loading, then
/// hand off" screen that F-006 can drop in as its very first route, or
/// reimplement against the same [BootstrapController]/`runAuthBootstrap` if
/// it needs a different splash/branding treatment — nothing here is
/// load-bearing beyond the bootstrap call itself.
///
/// D-023: rewired from a plain `StatefulWidget` driving `AuthClient`
/// directly to a `ConsumerStatefulWidget` watching the Riverpod
/// `bootstrapControllerProvider` (`AsyncNotifier<AuthBootstrapStatus>`) —
/// same terminal states, same "decide exactly once" guard, now backed by a
/// provider that's overridable in tests instead of a constructor-injected
/// `AuthClient`.
///
/// States (design-system.md §2's 4-state rule, applied to a one-shot startup
/// gate rather than a data list):
/// - loading: brief spinner while the restore attempt is in flight.
/// - transientFailure (L-3): offline/retry banner — does NOT wipe the
///   session or force login, since the refresh token is still intact in the
///   keychain (only a genuine dead-session wipes it).
/// - restored / sessionExpired / noSession: hand off to [onRestored] /
///   [onNeedsLogin] respectively — a terminal decision, made exactly once.
class BootstrapScreen extends ConsumerStatefulWidget {
  const BootstrapScreen({
    super.key,
    required this.onRestored,
    required this.onNeedsLogin,
  });

  /// Fired once when a live session was restored — caller should route to
  /// the authenticated destination (post-login screen).
  final VoidCallback onRestored;

  /// Fired once when there is no session to restore (never logged in, or the
  /// refresh token is genuinely dead) — caller should route to login.
  final VoidCallback onNeedsLogin;

  @override
  ConsumerState<BootstrapScreen> createState() => BootstrapScreenState();
}

class BootstrapScreenState extends ConsumerState<BootstrapScreen> {
  // D-022 ★ re-review fix (Minor #4): guards `onRestored`/`onNeedsLogin` so
  // they fire AT MOST once per screen instance. Without this, two rapid
  // retry taps (or a retry racing the initial build) could each resolve the
  // controller to a terminal outcome and each call the terminal callback —
  // F-006's Navigator caller only expects one route transition, and a
  // double-fire (e.g. two `pushReplacement`s) is a caller-side bug this
  // widget shouldn't be able to trigger.
  var _decided = false;

  /// Exposed for tests / the retry button — re-runs the same one-shot
  /// bootstrap (never loops automatically; only on explicit user action).
  Future<void> retry() => ref.read(bootstrapControllerProvider.notifier).retry();

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

  void _handleTerminal(AuthBootstrapStatus status) {
    if (_decided) return;
    switch (status) {
      case AuthBootstrapStatus.restored:
        _decided = true;
        widget.onRestored();
      case AuthBootstrapStatus.noSession:
      case AuthBootstrapStatus.sessionExpired:
        _decided = true;
        widget.onNeedsLogin();
      case AuthBootstrapStatus.transientFailure:
        // Terminal FOR NOW — stay on this screen and offer retry (L-3);
        // does not touch storage, does not force login.
        break;
      case AuthBootstrapStatus.loading:
        break; // unreachable — the usecase never emits `loading` as a value.
    }
  }

  @override
  Widget build(BuildContext context) {
    // `ref.listen` fires on every state transition of the underlying
    // `AsyncNotifier` — including the FIRST resolution of `build()`'s future
    // (loading -> data), which is exactly the "bootstrap finished" moment
    // this screen needs to react to exactly once (guarded by `_decided`).
    ref.listen<AsyncValue<AuthBootstrapStatus>>(bootstrapControllerProvider, (previous, next) {
      next.whenData(_handleTerminal);
    });
    final asyncStatus = ref.watch(bootstrapControllerProvider);
    final isTransientFailure = asyncStatus.valueOrNull == AuthBootstrapStatus.transientFailure;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.screenPadding),
            child: isTransientFailure
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
