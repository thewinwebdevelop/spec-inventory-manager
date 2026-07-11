import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/app_theme.dart';
import '../../application/session_list_controller.dart';
import '../../domain/entities/session.dart';
import '../../domain/exceptions.dart';
import '../../../../core/ui/app_toast.dart';
import '../../../../core/ui/confirm_dialog.dart';
import '../widgets/session_list_item.dart';
import '../../../../core/ui/skeleton.dart';

/// Session list section — "อุปกรณ์ที่เข้าสู่ระบบ" (ux-wireframe §4/§11.5).
///
/// D-023 PASS 2: rewired to a `ConsumerStatefulWidget` watching
/// `sessionListControllerProvider` (`AsyncNotifier<List<Session>>`) — takes
/// NO repository param anymore. `SecurityScreen` still refreshes this list
/// after a password change via a `GlobalKey<SessionListState>` calling
/// `load()`, so that public entry point is preserved unchanged.
class SessionList extends ConsumerStatefulWidget {
  const SessionList({
    super.key,
    required this.onSessionExpired,
    required this.onLoggedOutAll,
  });

  final VoidCallback onSessionExpired;
  final VoidCallback onLoggedOutAll;

  @override
  ConsumerState<SessionList> createState() => SessionListState();
}

class SessionListState extends ConsumerState<SessionList> {
  // ★ Important #1 — session-expiry can now surface from EVERY load path
  // (initial build(), retry, GlobalKey refresh, logout-all), each observed
  // both by the ref.listen below and by imperative return values; this guard
  // makes the navigation callback fire exactly once per mount (same
  // "decide exactly once" shape as BootstrapScreen's _decided flag).
  bool _notifiedExpiry = false;

  void _notifySessionExpiredOnce() {
    if (_notifiedExpiry || !mounted) return;
    _notifiedExpiry = true;
    widget.onSessionExpired();
  }

  Future<void> load() async {
    final result = await ref.read(sessionListControllerProvider.notifier).load();
    if (!mounted) return;
    if (result == SessionListLoadResult.sessionExpired) {
      _notifySessionExpiredOnce();
    }
  }

  Future<void> _confirmLogoutDevice(Session session) async {
    final t = AppLocalizations.of(context);
    final confirmed = await showConfirmDialog(
      context,
      title: t.authConfirmLogoutDeviceTitle,
      body: t.authConfirmLogoutDeviceBody,
      cancelLabel: t.authConfirmLogoutDeviceCancel,
      confirmLabel: t.authConfirmLogoutDeviceConfirm,
      destructive: true,
    );
    if (!confirmed || !mounted) return;

    final success = await ref.read(sessionListControllerProvider.notifier).logoutDevice(session.familyId);
    if (!mounted) return;
    if (success) {
      showAppToast(context, t.authSessionsToastDeviceLoggedOut);
    } else {
      showAppToast(context, t.authSessionsToastDeviceLogoutFailed, variant: AppToastVariant.danger);
    }
  }

  Future<void> confirmLogoutAll() async {
    final t = AppLocalizations.of(context);
    final confirmed = await showConfirmDialog(
      context,
      title: t.authConfirmLogoutAllTitle,
      body: t.authConfirmLogoutAllBody,
      cancelLabel: t.authConfirmLogoutAllCancel,
      confirmLabel: t.authConfirmLogoutAllConfirm,
      destructive: true,
    );
    if (!confirmed || !mounted) return;

    final result = await ref.read(sessionListControllerProvider.notifier).logoutAll();
    if (!mounted) return;
    switch (result) {
      case SessionListLoadResult.ok:
        widget.onLoggedOutAll();
      case SessionListLoadResult.sessionExpired:
        _notifySessionExpiredOnce();
      case null:
        showAppToast(context, t.authSessionsErrorLogoutAllFailed, variant: AppToastVariant.danger);
    }
  }

  @override
  Widget build(BuildContext context) {
    // ★ Important #1 — observe the INITIAL fetch (which runs inside the
    // controller's build(), before any imperative load() call exists) so a
    // dead session on mount navigates to login instead of parking the user
    // on an authenticated screen with wiped storage.
    ref.listen<AsyncValue<List<Session>>>(sessionListControllerProvider, (previous, next) {
      if (next.hasError && next.error is SessionExpiredException) {
        _notifySessionExpiredOnce();
      }
    });

    final asyncSessions = ref.watch(sessionListControllerProvider);
    final sessionExpired = asyncSessions.error is SessionExpiredException;
    // While expired we keep showing the skeleton until the (already-fired)
    // navigation takes over — never a misleading error/empty flash.
    final loading = (asyncSessions.isLoading && !asyncSessions.hasValue) || sessionExpired;
    final hasError = asyncSessions.hasError && !sessionExpired;
    final sessions = asyncSessions.valueOrNull ?? const <Session>[];
    final t = AppLocalizations.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(t.authSessionsTitle, style: AppTypography.headingSm),
        const SizedBox(height: AppSpacing.s1),
        Text(t.authSessionsSubtitle, style: AppTypography.bodySm),
        const SizedBox(height: AppSpacing.s4),
        // T-001-17 ★ (L-4): mobile can never resolve `current` (api-spec
        // §2.6 — Bearer-only calls get `current: false` on every row, since
        // that flag is only set from the `omni_rt` cookie). Only shown once
        // there's an actual list to look at (not during loading/error), and
        // only when there's more than 1 row — with exactly 1 session the
        // list has no logout-device button to be misled by anyway (the sole
        // row is necessarily this device, ux-wireframe §4 empty-state note).
        if (!loading && !hasError && sessions.length > 1) ...[
          _MobileCurrentDeviceNotice(),
          const SizedBox(height: AppSpacing.s3),
        ],
        if (loading)
          const SessionListSkeleton()
        else if (hasError)
          Center(
            child: Column(
              children: [
                Text(t.authSessionsErrorLoadFailed, style: AppTypography.bodyMd),
                const SizedBox(height: AppSpacing.s3),
                OutlinedButton(onPressed: load, child: Text(t.authSessionsActionRetry)),
              ],
            ),
          )
        else ...[
          for (final session in sessions)
            SessionListItem(
              session: session,
              onLogoutDevice: () => _confirmLogoutDevice(session),
            ),
          const SizedBox(height: AppSpacing.s3),
          ElevatedButton(
            onPressed: confirmLogoutAll,
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            child: Text(t.authSessionsActionLogoutAll),
          ),
        ],
      ],
    );
  }
}

/// T-001-17 ★ (L-4) — mobile-only notice above the session list. Uses the
/// same visual language as [ErrorBanner] (`AppColors.warningBg`/`Border`, not
/// `danger`, since this is informational, not an error) rather than
/// inventing a new banner variant.
class _MobileCurrentDeviceNotice extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.s4),
      decoration: BoxDecoration(
        color: AppColors.warningBg,
        border: Border.all(color: AppColors.warningBorder),
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline, color: AppColors.warningText, size: 20),
          const SizedBox(width: AppSpacing.s2),
          Expanded(
            child: Text(
              AppLocalizations.of(context).authSessionsMobileCannotIdentifyCurrent,
              style: AppTypography.bodySm.copyWith(color: AppColors.warningText),
            ),
          ),
        ],
      ),
    );
  }
}
