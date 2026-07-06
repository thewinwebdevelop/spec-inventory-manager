import 'package:flutter/material.dart';

import '../../i18n/auth_th.dart';
import '../../theme/app_theme.dart';
import '../throttle_countdown.dart';
import '../throttle_countdown_controller.dart';

/// `ThrottleBanner` (ui.md §2.1, D-005) — yellow/warning banner + real-time
/// countdown. **Never** red/danger (D-005: "รอได้ ไม่ใช่หายนะ"), never says
/// "ล็อก"/"ระงับ". Reused verbatim across login/signup/change-password
/// (ui.md §2.1.1) — one component, one copy source (`AuthTh.throttle*`).
///
/// `type.numeric.tabular` (design-system.md §1.2): the countdown digits use
/// `FontFeature.tabularFigures()` so the banner doesn't jitter/reflow every
/// second (ux-wireframe §11.3 note).
///
/// `aria-live`-equivalent: Flutter's [Semantics.liveRegion] announces changes
/// to assistive tech, but re-announcing every second would spam a screen
/// reader (ui.md §6: "ไม่ถี่เกินไป เช่นทุก 10 วินาที") — so the live region
/// wraps a value that only changes on a 10s cadence (or reaching zero),
/// while the visible text still ticks every second.
class ThrottleBanner extends StatelessWidget {
  const ThrottleBanner({super.key, required this.controller});

  final ThrottleCountdownController controller;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        if (!controller.isActive) return const SizedBox.shrink();
        final message = formatThrottleMessage(controller.remainingSeconds);
        final announceNow = controller.remainingSeconds % 10 == 0 || controller.remainingSeconds <= 1;
        return Container(
          width: double.infinity,
          padding: const EdgeInsets.all(AppSpacing.s4),
          margin: const EdgeInsets.only(bottom: AppSpacing.s4),
          decoration: BoxDecoration(
            color: AppColors.warningBg,
            border: Border.all(color: AppColors.warningBorder),
            borderRadius: BorderRadius.circular(AppRadius.card),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(
                liveRegion: announceNow,
                child: Text(
                  message,
                  style: AppTypography.bodyMd.copyWith(
                    color: AppColors.warningText,
                    fontFeatures: const [FontFeature.tabularFigures()],
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.s2),
              Text(
                AuthTh.throttleHelper,
                style: AppTypography.bodySm.copyWith(color: AppColors.warningText),
              ),
            ],
          ),
        );
      },
    );
  }
}
