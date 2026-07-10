import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';

/// `Toast` (ui.md §2.1) — bottom, above safe-area (ux-wireframe §8: "Mobile:
/// ด้านล่างจอ เหนือ safe-area"). Built on [SnackBar] (the Flutter-native
/// transient-message idiom) rather than a custom overlay.
enum AppToastVariant { success, danger }

void showAppToast(
  BuildContext context,
  String message, {
  AppToastVariant variant = AppToastVariant.success,
}) {
  final colors = switch (variant) {
    AppToastVariant.success => (bg: AppColors.successBg, fg: AppColors.successText),
    AppToastVariant.danger => (bg: AppColors.dangerBg, fg: AppColors.dangerText),
  };
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: colors.bg,
        duration: const Duration(seconds: 4),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.card)),
        content: Text(
          message,
          style: AppTypography.bodySm.copyWith(color: colors.fg, fontWeight: FontWeight.w600),
        ),
      ),
    );
}
