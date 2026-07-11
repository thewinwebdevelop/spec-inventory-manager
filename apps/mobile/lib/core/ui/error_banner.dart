import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// `ErrorBanner` (ui.md §2.1) — banner for general errors above a form,
/// distinct from inline field errors. Reused across every auth form.
class ErrorBanner extends StatelessWidget {
  const ErrorBanner({super.key, required this.message, this.onRetry, this.retryLabel});

  final String message;
  final VoidCallback? onRetry;
  final String? retryLabel;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(AppSpacing.s4),
        margin: const EdgeInsets.only(bottom: AppSpacing.s4),
        decoration: BoxDecoration(
          color: AppColors.dangerBg,
          border: Border.all(color: AppColors.dangerBorder),
          borderRadius: BorderRadius.circular(AppRadius.card),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.error_outline, color: AppColors.dangerText, size: 20),
            const SizedBox(width: AppSpacing.s2),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    message,
                    style: AppTypography.bodySm.copyWith(color: AppColors.dangerText),
                  ),
                  if (onRetry != null) ...[
                    const SizedBox(height: AppSpacing.s2),
                    TextButton(
                      onPressed: onRetry,
                      style: TextButton.styleFrom(
                        foregroundColor: AppColors.dangerText,
                        padding: EdgeInsets.zero,
                        minimumSize: const Size(0, AppSizes.tapTargetMin),
                      ),
                      child: Text(retryLabel ?? 'ลองใหม่'),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
