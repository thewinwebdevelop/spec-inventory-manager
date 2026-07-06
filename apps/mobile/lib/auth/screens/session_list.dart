import 'package:flutter/material.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

import '../../i18n/auth_th.dart';
import '../../theme/app_theme.dart';
import '../auth_client.dart';
import '../auth_exceptions.dart';
import '../widgets/app_toast.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/session_list_item.dart';
import '../widgets/skeleton.dart';

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

  final AuthClient authClient;
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
        _sessions = res.sessions.toList()
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
