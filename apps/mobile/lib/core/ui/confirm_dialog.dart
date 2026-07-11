import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// `ConfirmDialog` (ui.md §2.1) — 2-button confirm (cancel/confirm), variant
/// `default`/`destructive`. Mobile renders as a bottom sheet (ux-wireframe
/// §8/§11.7: "Mobile: bottom sheet เลื่อนขึ้นจากล่างจอ") instead of web's
/// centered modal — same content/copy/button order, different container.
///
/// Accessibility (ui.md §6): for `destructive`, default focus stays on
/// "ยกเลิก" (never the destructive action) to avoid an accidental Enter/tap
/// confirming a destructive action.
///
/// Returns `true` if the user confirmed, `false` otherwise (cancelled or
/// dismissed by tapping outside / swiping down).
Future<bool> showConfirmDialog(
  BuildContext context, {
  required String title,
  required String body,
  required String cancelLabel,
  required String confirmLabel,
  bool destructive = false,
}) async {
  final result = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.card)),
    ),
    builder: (context) => _ConfirmSheet(
      title: title,
      body: body,
      cancelLabel: cancelLabel,
      confirmLabel: confirmLabel,
      destructive: destructive,
    ),
  );
  return result ?? false;
}

class _ConfirmSheet extends StatefulWidget {
  const _ConfirmSheet({
    required this.title,
    required this.body,
    required this.cancelLabel,
    required this.confirmLabel,
    required this.destructive,
  });

  final String title;
  final String body;
  final String cancelLabel;
  final String confirmLabel;
  final bool destructive;

  @override
  State<_ConfirmSheet> createState() => _ConfirmSheetState();
}

class _ConfirmSheetState extends State<_ConfirmSheet> {
  final _cancelFocusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    // Default focus on Cancel — never the destructive action (ui.md §6).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _cancelFocusNode.requestFocus();
    });
  }

  @override
  void dispose() {
    _cancelFocusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.s6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.title, style: AppTypography.headingSm),
            const SizedBox(height: AppSpacing.s3),
            Text(widget.body, style: AppTypography.bodyMd),
            const SizedBox(height: AppSpacing.s6),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    focusNode: _cancelFocusNode,
                    onPressed: () => Navigator.of(context).pop(false),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(AppSizes.tapTargetMin),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadius.button),
                      ),
                    ),
                    child: Text(widget.cancelLabel),
                  ),
                ),
                const SizedBox(width: AppSpacing.s3),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => Navigator.of(context).pop(true),
                    style: ElevatedButton.styleFrom(
                      backgroundColor:
                          widget.destructive ? AppColors.danger : AppColors.primary,
                      foregroundColor: AppColors.primaryFg,
                      minimumSize: const Size.fromHeight(AppSizes.tapTargetMin),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadius.button),
                      ),
                    ),
                    child: Text(widget.confirmLabel),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
