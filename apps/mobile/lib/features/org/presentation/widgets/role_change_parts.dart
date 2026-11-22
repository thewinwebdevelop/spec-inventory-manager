import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/app_theme.dart';
import '../../application/role_write_controller.dart';
import '../../domain/role_change_summary.dart';
import 'role_screen_parts.dart';

/// T-003-M07 — R3a "ยืนยันก่อนบันทึก" and R3b "มีคนแก้บทบาทนี้ไปก่อนคุณ".
/// Everything they SAY was decided by `role_change_summary.dart` (pure,
/// tested); these widgets only render it.

/// Bullet list of [lines] — labels, then "และสิทธิ์อื่นอีก {n} รายการ…".
class CapabilityLineList extends StatelessWidget {
  const CapabilityLineList({super.key, required this.lines, this.color});

  final CapabilityLines lines;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final style = AppTypography.bodySm.copyWith(color: color ?? context.appColors.text);
    final items = [
      ...lines.labels,
      if (lines.otherCount > 0) t.roleFormUnknownCapabilitiesNote(lines.otherCount),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final item in items)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.s1),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('•', style: style),
                const SizedBox(width: AppSpacing.s2),
                Expanded(child: Text(item, style: style)),
              ],
            ),
          ),
      ],
    );
  }
}

/// Labels joined for one R3b diff line ("เพิ่ม: a, b").
String capabilityLinesText(AppLocalizations t, CapabilityLines lines) => [
      ...lines.labels,
      if (lines.otherCount > 0) t.roleFormUnknownCapabilitiesNote(lines.otherCount),
    ].join(', ');

// ── R3a ─────────────────────────────────────────────────────────────────────

/// Opens R3a and, on "บันทึก", runs [send] INSIDE the sheet (the button shows
/// "กำลังบันทึก..." and the sheet cannot be dismissed while it runs), then
/// closes with its result. `null` = cancelled (nothing was sent) or the write
/// was ignored because another was in flight.
///
/// One confirmation = one PATCH: the button latches on the first press, and
/// `RoleWriteController` ignores a second write while one is in flight.
Future<RoleWriteResult?> showRoleSaveConfirmSheet(
  BuildContext context, {
  required SaveConfirmation confirmation,
  required Future<RoleWriteResult?> Function() send,
}) =>
    showModalBottomSheet<RoleWriteResult>(
      context: context,
      isScrollControlled: true,
      // Swipe-down would bypass the in-flight lock; "แก้ต่อ" and the barrier
      // (which respects PopScope) close it instead.
      enableDrag: false,
      backgroundColor: context.appColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.card)),
      ),
      builder: (_) => _SaveConfirmSheet(confirmation: confirmation, send: send),
    );

class _SaveConfirmSheet extends StatefulWidget {
  const _SaveConfirmSheet({required this.confirmation, required this.send});

  final SaveConfirmation confirmation;
  final Future<RoleWriteResult?> Function() send;

  @override
  State<_SaveConfirmSheet> createState() => _SaveConfirmSheetState();
}

class _SaveConfirmSheetState extends State<_SaveConfirmSheet> {
  final _cancelFocus = FocusNode(debugLabel: 'role-confirm-cancel');
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    // ux R3a: with the self-loss warning the primary turns destructive and
    // focus starts on "แก้ต่อ" (focusCancel).
    if (widget.confirmation.selfLoss != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _cancelFocus.requestFocus();
      });
    }
  }

  @override
  void dispose() {
    _cancelFocus.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    if (_submitting) return;
    setState(() => _submitting = true);
    final result = await widget.send();
    if (mounted) Navigator.of(context).pop(result);
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final colors = context.appColors;
    final c = widget.confirmation;
    final selfLoss = c.selfLoss;
    final muted = AppTypography.bodySm.copyWith(color: colors.textMuted);
    final maxHeight = MediaQuery.sizeOf(context).height * 0.85;

    Widget section(String title, CapabilityLines lines) => Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.s4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.labelSmall),
              CapabilityLineList(lines: lines),
            ],
          ),
        );

    final buttonShape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.button));
    final cancel = OutlinedButton(
      key: const ValueKey('role-confirm-cancel'),
      focusNode: _cancelFocus,
      onPressed: _submitting ? null : () => Navigator.of(context).pop(),
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(AppSizes.tapTargetMin),
        shape: buttonShape,
      ),
      child: Text(t.roleConfirmContinueEditing),
    );
    final submit = ElevatedButton(
      key: const ValueKey('role-confirm-submit'),
      onPressed: _submitting ? null : _confirm,
      style: ElevatedButton.styleFrom(
        backgroundColor: selfLoss != null ? colors.btnDangerBg : colors.btnBg,
        foregroundColor: colors.btnFg,
        minimumSize: const Size.fromHeight(AppSizes.tapTargetMin),
        shape: buttonShape,
      ),
      child: Text(
        _submitting
            ? t.roleConfirmSubmitting
            : (selfLoss != null ? t.roleConfirmSubmitDestructive : t.roleConfirmSubmit),
        textAlign: TextAlign.center,
      ),
    );

    return PopScope(
      canPop: !_submitting,
      child: SafeArea(
        child: ConstrainedBox(
          key: const ValueKey('role-confirm-sheet'),
          constraints: BoxConstraints(maxHeight: maxHeight),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(AppSpacing.s6, AppSpacing.s6, AppSpacing.s6, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t.roleConfirmTitle(c.roleName), style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: AppSpacing.s4),
                      if (!c.added.isEmpty) section(t.roleConfirmAddedHeader, c.added),
                      if (!c.removed.isEmpty) section(t.roleConfirmRemovedHeader, c.removed),
                      Text(
                        c.usage.activeMembers > 0
                            ? t.roleConfirmImpactMembers(c.usage.activeMembers)
                            : t.roleConfirmImpactNoMembers,
                        style: muted,
                      ),
                      if (c.usage.pendingInvitations > 0)
                        Text(t.roleConfirmImpactPendingInvitations(c.usage.pendingInvitations), style: muted),
                      if (selfLoss != null) ...[
                        const SizedBox(height: AppSpacing.s4),
                        RoleWarningBanner(
                          title: t.roleConfirmLostCapabilitiesTitle,
                          children: [
                            CapabilityLineList(lines: selfLoss.lines, color: colors.warningText),
                            const SizedBox(height: AppSpacing.s2),
                            Text(
                              selfLoss.losesManageRoles ? t.roleConfirmLostManageRolesNote : t.roleConfirmLostOtherNote,
                              style: AppTypography.bodySm.copyWith(color: colors.warningText),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.s6),
                // Thai labels ("บันทึก และยอมเสียสิทธิ์") do not fit half a
                // phone width — stack them there, side by side when wide.
                child: LayoutBuilder(
                  builder: (context, box) => box.maxWidth < 480
                      ? Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [submit, const SizedBox(height: AppSpacing.s3), cancel],
                        )
                      : Row(
                          children: [
                            Expanded(child: cancel),
                            const SizedBox(width: AppSpacing.s3),
                            Expanded(child: submit),
                          ],
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── R3b ─────────────────────────────────────────────────────────────────────

/// "มีคนแก้บทบาทนี้ไปก่อนคุณ" + the person's own diff. [onReapply] absent →
/// no re-apply button (already re-applied, or the latest version is
/// read-only). Never sends anything (SR-14).
class RoleConflictBanner extends StatelessWidget {
  const RoleConflictBanner({
    super.key,
    required this.diff,
    required this.skipped,
    required this.onDismiss,
    this.onReapply,
  });

  final DraftDiff diff;
  final bool skipped;
  final VoidCallback onDismiss;
  final VoidCallback? onReapply;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final colors = context.appColors;
    final name = diff.name;
    final items = [
      if (name != null) t.roleConflictNameDiff(name.from, name.to),
      if (!diff.added.isEmpty) t.roleConflictAddedDiff(capabilityLinesText(t, diff.added)),
      if (!diff.removed.isEmpty) t.roleConflictRemovedDiff(capabilityLinesText(t, diff.removed)),
    ];
    final text = AppTypography.bodySm.copyWith(color: colors.warningText);
    final buttonStyle = OutlinedButton.styleFrom(
      foregroundColor: colors.warningText,
      side: BorderSide(color: colors.warningBorder),
      minimumSize: const Size(0, AppSizes.tapTargetMin),
    );
    return RoleWarningBanner(
      key: const ValueKey('role-conflict-banner'),
      title: t.roleConflictTitle,
      body: t.roleConflictBody,
      children: [
        for (final item in items)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.s1),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('•', style: text),
                const SizedBox(width: AppSpacing.s2),
                Expanded(child: Text(item, style: text)),
              ],
            ),
          ),
        if (skipped) ...[
          const SizedBox(height: AppSpacing.s2),
          Text(t.roleConflictSomeSkipped, style: text),
        ],
        const SizedBox(height: AppSpacing.s3),
        Wrap(
          spacing: AppSpacing.s2,
          runSpacing: AppSpacing.s2,
          children: [
            if (onReapply != null)
              OutlinedButton(style: buttonStyle, onPressed: onReapply, child: Text(t.roleConflictReapply)),
            OutlinedButton(style: buttonStyle, onPressed: onDismiss, child: Text(t.roleConflictClose)),
          ],
        ),
      ],
    );
  }
}
