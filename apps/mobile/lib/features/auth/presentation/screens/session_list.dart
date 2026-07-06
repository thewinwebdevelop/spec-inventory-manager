import 'package:flutter/material.dart';

import '../../../../core/api/refresh_coordinator.dart';
import '../../../../core/i18n/auth_th.dart';
import '../../../../app/theme/app_theme.dart';
import '../../data/auth_repository_impl.dart';
import '../../domain/entities/session.dart';
import '../../../../core/ui/app_toast.dart';
import '../../../../core/ui/confirm_dialog.dart';
import '../widgets/session_list_item.dart';
import '../../../../core/ui/skeleton.dart';

/// Session list section — "อุปกรณ์ที่เข้าสู่ระบบ" (ux-wireframe §4/§11.5).
/// Owns its own load/loading/error state so it can be dropped into the
/// Security screen and refreshed on-demand (e.g. after a password change,
/// ux-wireframe §9.4).
class SessionList extends StatefulWidget {
  const SessionList({
    super.key,
    required this.authClient,
    required this.onSessionExpired,
    required this.onLoggedOutAll,
  });

  final AuthRepositoryImpl authClient;
  final VoidCallback onSessionExpired;
  final VoidCallback onLoggedOutAll;

  @override
  State<SessionList> createState() => SessionListState();
}

class SessionListState extends State<SessionList> {
  bool _loading = true;
  bool _hasError = false;
  List<Session> _sessions = const [];

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() {
      _loading = true;
      _hasError = false;
    });
    try {
      final res = await widget.authClient.getSessions();
      if (!mounted) return;
      setState(() {
        _sessions = res.toList()
          ..sort((a, b) => (b.lastUsedAt ?? b.createdAt).compareTo(a.lastUsedAt ?? a.createdAt));
        _loading = false;
      });
    } on SessionExpiredException {
      if (!mounted) return;
      widget.onSessionExpired();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _hasError = true;
      });
    }
  }

  Future<void> _confirmLogoutDevice(Session session) async {
    final confirmed = await showConfirmDialog(
      context,
      title: AuthTh.confirmLogoutDeviceTitle,
      body: AuthTh.confirmLogoutDeviceBody,
      cancelLabel: AuthTh.confirmLogoutDeviceCancel,
      confirmLabel: AuthTh.confirmLogoutDeviceConfirm,
      destructive: true,
    );
    if (!confirmed || !mounted) return;

    final previous = _sessions;
    setState(() {
      _sessions = _sessions.where((s) => s.familyId != session.familyId).toList();
    });
    try {
      await widget.authClient.logoutDevice(familyId: session.familyId);
      if (!mounted) return;
      showAppToast(context, AuthTh.sessionsToastDeviceLoggedOut);
    } catch (_) {
      if (!mounted) return;
      setState(() => _sessions = previous);
      showAppToast(context, AuthTh.sessionsToastDeviceLogoutFailed, variant: AppToastVariant.danger);
    }
  }

  Future<void> confirmLogoutAll() async {
    final confirmed = await showConfirmDialog(
      context,
      title: AuthTh.confirmLogoutAllTitle,
      body: AuthTh.confirmLogoutAllBody,
      cancelLabel: AuthTh.confirmLogoutAllCancel,
      confirmLabel: AuthTh.confirmLogoutAllConfirm,
      destructive: true,
    );
    if (!confirmed || !mounted) return;

    try {
      await widget.authClient.logoutAll();
      if (!mounted) return;
      widget.onLoggedOutAll();
    } on SessionExpiredException {
      if (!mounted) return;
      widget.onSessionExpired();
    } catch (_) {
      if (!mounted) return;
      showAppToast(context, AuthTh.sessionsErrorLogoutAllFailed, variant: AppToastVariant.danger);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(AuthTh.sessionsTitle, style: AppTypography.headingSm),
        const SizedBox(height: AppSpacing.s1),
        Text(AuthTh.sessionsSubtitle, style: AppTypography.bodySm),
        const SizedBox(height: AppSpacing.s4),
        // T-001-17 ★ (L-4): mobile can never resolve `current` (api-spec
        // §2.6 — Bearer-only calls get `current: false` on every row, since
        // that flag is only set from the `omni_rt` cookie). Only shown once
        // there's an actual list to look at (not during loading/error), and
        // only when there's more than 1 row — with exactly 1 session the
        // list has no logout-device button to be misled by anyway (the sole
        // row is necessarily this device, ux-wireframe §4 empty-state note).
        if (!_loading && !_hasError && _sessions.length > 1) ...[
          _MobileCurrentDeviceNotice(),
          const SizedBox(height: AppSpacing.s3),
        ],
        if (_loading)
          const SessionListSkeleton()
        else if (_hasError)
          Center(
            child: Column(
              children: [
                Text(AuthTh.sessionsErrorLoadFailed, style: AppTypography.bodyMd),
                const SizedBox(height: AppSpacing.s3),
                OutlinedButton(onPressed: load, child: Text(AuthTh.sessionsActionRetry)),
              ],
            ),
          )
        else ...[
          for (final session in _sessions)
            SessionListItem(
              session: session,
              onLogoutDevice: () => _confirmLogoutDevice(session),
            ),
          const SizedBox(height: AppSpacing.s3),
          ElevatedButton(
            onPressed: confirmLogoutAll,
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            child: Text(AuthTh.sessionsActionLogoutAll),
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
              AuthTh.sessionsMobileCannotIdentifyCurrent,
              style: AppTypography.bodySm.copyWith(color: AppColors.warningText),
            ),
          ),
        ],
      ),
    );
  }
}
