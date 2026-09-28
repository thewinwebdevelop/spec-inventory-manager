import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// `StickyActionBar` (design-system.md §9.1, ui.md §2.3) — the bottom action
/// bar every long mobile form needs (products F-010, stock adjustment F-011,
/// this feature's R2/checklist/R10 sheet), so it's a shared widget rather
/// than being rebuilt per screen.
///
/// Mobile shape only (ui.md §5 — web's sticky-in-column, right-aligned,
/// two-button variant is a `frontend` (web) concern, not this widget): a
/// single full-width primary button, `surface` background, a 1px top
/// `borderDefault` divider (no shadow — a dark theme shadow wouldn't read,
/// and the divider alone is enough to separate the layer per ui.md §2.3),
/// and the bottom safe-area inset added on top of `space.3` padding.
///
/// Callers must reserve bottom space in their scroll content equal to this
/// bar's height, or the last row of a long list ends up hidden behind it
/// (ui.md §2.3).
class StickyActionBar extends StatelessWidget {
  const StickyActionBar({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
  });

  final String label;

  /// `null` (or [loading]) disables the button.
  final VoidCallback? onPressed;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(top: BorderSide(color: colors.borderDefault)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.s4,
            vertical: AppSpacing.s3,
          ),
          child: SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: loading ? null : onPressed,
              child: loading
                  ? SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: colors.btnFg),
                    )
                  : Text(label),
            ),
          ),
        ),
      ),
    );
  }
}
