import 'package:flutter/material.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

import '../../i18n/auth_th.dart';
import '../../theme/app_theme.dart';
import '../relative_time.dart';

/// `SessionListItem` (ui.md §2.1) — 1 row per device/family (ux-wireframe
/// §4/§11.5). Current-device row has no logout button (logout on the
/// current device happens via the main "logout" action, not this list).
class SessionListItem extends StatelessWidget {
  const SessionListItem({
    super.key,
    required this.session,
    required this.onLogoutDevice,
  });

  final Session session;
  final VoidCallback? onLogoutDevice;

  @override
  Widget build(BuildContext context) {
    // ux-wireframe §11.5 sketch: the row label is the readable device name
    // (or the "ไม่ทราบชื่อ" fallback) — the SEPARATE "อุปกรณ์นี้" badge is
    // what signals the current device, not the label text itself (so a
    // current row never shows "อุปกรณ์นี้" twice).
    final deviceLabel = session.deviceId?.trim().isNotEmpty == true
        ? session.deviceId!
        : AuthTh.sessionsDeviceUnknown;
    final lastUsed = session.lastUsedAt ?? session.createdAt;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.s4),
      margin: const EdgeInsets.only(bottom: AppSpacing.s3),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.borderDefault),
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
      child: Row(
        children: [
          Icon(
            session.deviceId == null ? Icons.help_outline : Icons.devices,
            color: AppColors.textMuted,
          ),
          const SizedBox(width: AppSpacing.s3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        deviceLabel,
                        style: AppTypography.labelSm,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (session.current) ...[
                      const SizedBox(width: AppSpacing.s2),
                      _CurrentBadge(),
                    ],
                  ],
                ),
                const SizedBox(height: AppSpacing.s1),
                Text(
                  AuthTh.sessionsLastActive(formatRelativeTimeTh(lastUsed)),
                  style: AppTypography.bodySm,
                ),
              ],
            ),
          ),
          if (!session.current)
            OutlinedButton(
              onPressed: onLogoutDevice,
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.textMuted,
                minimumSize: const Size(0, AppSizes.tapTargetMin),
              ),
              child: Text(AuthTh.sessionsActionLogoutDevice),
            ),
        ],
      ),
    );
  }
}

class _CurrentBadge extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s2, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.badgeCurrentBg,
        borderRadius: BorderRadius.circular(AppRadius.badge),
      ),
      child: Text(
        AuthTh.sessionsBadgeCurrent,
        style: AppTypography.bodySm.copyWith(
          color: AppColors.badgeCurrentText,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
