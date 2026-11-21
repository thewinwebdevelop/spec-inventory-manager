import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/ui/checkbox_row.dart';
import '../../../../core/ui/disclosure.dart';
import '../../domain/role_form_model.dart';

/// R3 `CapabilityChecklist` (ui.md §3) — mobile flavour: one `Disclosure` per
/// group, ALL OPEN initially (ux R3 platform · ui.md §5), each header saying
/// "เลือก {n} จาก {m}" so a folded group still tells what is ticked.
///
/// Renders a [ChecklistView] and nothing else: which rows are locked /
/// disabled / upcoming was decided by `buildChecklist` (pure, tested), and
/// every one of those states is UX only — the server decides the write.
class CapabilityChecklist extends StatelessWidget {
  const CapabilityChecklist({
    super.key,
    required this.view,
    required this.unknownCount,
    required this.onToggle,
    this.errorText,
    this.enabled = true,
  });

  final ChecklistView view;

  /// Stored keys the catalog does not know — not rows, but one line, and they
  /// still go back on save (ux §0.4).
  final int unknownCount;
  final void Function(String key, bool checked) onToggle;
  final String? errorText;

  /// `false` while a write is in flight (the form locks).
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final colors = context.appColors;
    final muted = AppTypography.bodySm.copyWith(color: colors.textMuted);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(child: Text(t.roleFormCapabilitiesHeader, style: AppTypography.headingSm)),
            Semantics(
              liveRegion: true,
              child: Text(t.roleFormCapabilitiesCounter(view.selectedCount, view.total), style: muted),
            ),
          ],
        ),
        if (view.hasUpcoming) ...[
          const SizedBox(height: AppSpacing.s1),
          Text(t.roleFormUpcomingNote, style: muted),
        ],
        if (errorText != null) ...[
          const SizedBox(height: AppSpacing.s2),
          Semantics(
            liveRegion: true,
            child: Text(errorText!, style: AppTypography.bodySm.copyWith(color: colors.dangerText)),
          ),
        ],
        const SizedBox(height: AppSpacing.s2),
        for (final group in view.groups)
          Disclosure(
            key: ValueKey('cap-group-${group.key}'),
            title: group.label ?? t.roleFormOtherGroupLabel,
            countLabel: t.roleFormGroupCounter(group.selectedCount, group.rows.length),
            // CheckboxRow already insets by space.4 — the same as the header.
            contentPadding: EdgeInsets.zero,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final row in group.rows)
                  CheckboxRow(
                    key: ValueKey('cap-row-${row.key}'),
                    label: row.label,
                    description: row.description.isEmpty ? null : row.description,
                    badgeLabel: row.upcoming ? t.roleFormUpcomingBadge : null,
                    reason: row.locked
                        ? t.roleFormImpliedLockLabel
                        : row.disabled
                            ? t.roleFormCannotGrantLabel
                            : null,
                    value: row.checked,
                    disabled: row.locked || row.disabled || !enabled,
                    onChanged: row.locked || row.disabled || !enabled
                        ? null
                        : (checked) => onToggle(row.key, checked),
                  ),
              ],
            ),
          ),
        if (unknownCount > 0) ...[
          const SizedBox(height: AppSpacing.s2),
          Text(t.roleFormUnknownCapabilitiesNote(unknownCount), style: muted),
        ],
      ],
    );
  }
}
