import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// `Toast` (ui.md §2.1) — bottom, above safe-area (ux-wireframe §8: "Mobile:
/// ด้านล่างจอ เหนือ safe-area"). Built on [SnackBar] (the Flutter-native
/// transient-message idiom) rather than a custom overlay.
enum AppToastVariant { success, danger }

void showAppToast(
  BuildContext context,
  String message, {
  AppToastVariant variant = AppToastVariant.success,
}) {
  showAppToastOn(ScaffoldMessenger.of(context), context.appColors, message, variant: variant);
}

/// The same toast, for a caller whose own context may be gone by the time
/// it has something to say (a sheet that closed itself on the answer — T-003-M11):
/// capture the messenger and the colours BEFORE the await, then call this.
void showAppToastOn(
  ScaffoldMessengerState messenger,
  AppColorsX appColors,
  String message, {
  AppToastVariant variant = AppToastVariant.success,
}) {
  final colors = switch (variant) {
    AppToastVariant.success => (bg: appColors.successBg, fg: appColors.successText),
    AppToastVariant.danger => (bg: appColors.dangerBg, fg: appColors.dangerText),
  };
  messenger
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
