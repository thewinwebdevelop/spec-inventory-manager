import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/session/capabilities.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/entities/role_entities.dart';
import '../../domain/role_form_model.dart';
import 'role_screen_parts.dart';

/// `CapabilityReadList` (ui.md §3) — R4: what a role grants, as a LIST, never
/// as disabled checkboxes (ux §A: a disabled box reads as "why can't I press
/// this?"). Mobile twin of web `CapabilityReadList.tsx` (W08).
///
///  - granted: `icon.check` + label (+ "ให้" for a screen reader)
///  - not granted: "–" + the label muted + the TEXT "ไม่ได้ให้" on the right —
///    colour is never the only signal (ux R4)
///  - "เร็ว ๆ นี้" badge kept · a row implied by another grant reads ✓ +
///    "มาพร้อมสิทธิ์จัดการ"
///  - keys the catalog does not know → one "และสิทธิ์อื่นอีก n รายการ…" line
///  - the Owner ([grantsOwnership], the SERVER's derivation from
///    `full_access` — never `key`) → ONE card instead of the list
///
/// Labels/descriptions come from `GET /capabilities` only (D-037). Rows are
/// not interactive, so they size to their content (ui.md §3: no 44px rule).
class CapabilityReadList extends StatelessWidget {
  const CapabilityReadList({
    super.key,
    required this.capabilities,
    required this.grantsOwnership,
    required this.catalog,
  });

  final List<String> capabilities;
  final bool grantsOwnership;
  final CapabilityCatalogView catalog;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final colors = context.appColors;
    final muted = AppTypography.bodySm.copyWith(color: colors.textMuted);

    final fullAccess =
        grantsOwnership ? catalog.items.where((i) => i.key == fullAccessCapability).firstOrNull : null;
    if (grantsOwnership) {
      return Container(
        key: const ValueKey('cap-read-full-access'),
        width: double.infinity,
        padding: const EdgeInsets.all(AppSpacing.s4),
        decoration: BoxDecoration(
          color: colors.surfaceMuted,
          borderRadius: BorderRadius.circular(AppRadius.card),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.check, size: AppSizes.iconMd, color: colors.text),
            const SizedBox(width: AppSpacing.s3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // The catalog's label (D-037); the l10n copy of the same
                  // text only if this catalog somehow lacks the entry.
                  Text(fullAccess?.labelTh ?? t.roleFullAccessCardTitle, style: AppTypography.bodyMd),
                  if (fullAccess != null && fullAccess.descriptionTh.isNotEmpty)
                    Text(fullAccess.descriptionTh, style: muted),
                ],
              ),
            ),
          ],
        ),
      );
    }

    final seeded = initialSelection(capabilities, catalog);
    // Read-only: nothing is "disabled because you lack it" — every row is shown.
    final view = buildChecklist(catalog, seeded.selection, (_) => true);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (i, group) in view.groups.indexed) ...[
          if (i > 0) const SizedBox(height: AppSpacing.s6),
          Container(
            padding: const EdgeInsets.only(bottom: AppSpacing.s2),
            decoration: BoxDecoration(border: Border(bottom: BorderSide(color: colors.borderDefault))),
            child: Text(
              group.label ?? t.roleFormOtherGroupLabel,
              style: AppTypography.labelSm.copyWith(color: colors.textMuted),
            ),
          ),
          const SizedBox(height: AppSpacing.s2),
          for (final row in group.rows) _ReadRow(key: ValueKey('cap-read-${row.key}'), row: row),
        ],
        if (seeded.passthrough.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.s4),
          Text(t.roleFormUnknownCapabilitiesNote(seeded.passthrough.length), style: muted),
        ],
      ],
    );
  }
}

class _ReadRow extends StatelessWidget {
  const _ReadRow({super.key, required this.row});

  final ChecklistRow row;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final colors = context.appColors;
    final muted = AppTypography.bodySm.copyWith(color: colors.textMuted);
    final labelStyle = AppTypography.bodyMd.copyWith(color: row.checked ? colors.text : colors.textMuted);

    return MergeSemantics(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.s2),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: AppSizes.iconMd,
              child: row.checked
                  ? Padding(
                      padding: const EdgeInsets.only(top: 3),
                      child: Icon(Icons.check, size: AppSizes.iconMd, color: colors.text),
                    )
                  : ExcludeSemantics(
                      child: Text('–', textAlign: TextAlign.center, style: labelStyle),
                    ),
            ),
            const SizedBox(width: AppSpacing.s2),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: AppSpacing.s2,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(row.label, style: labelStyle),
                      if (row.upcoming) RoleBadgeChip(label: t.roleFormUpcomingBadge),
                    ],
                  ),
                  if (row.locked) Text(t.roleFormImpliedLockLabel, style: muted),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.s3),
            if (row.checked)
              Semantics(label: t.roleReadonlyGivenLabel, child: const SizedBox.shrink())
            else
              Padding(
                // body.sm beside body.md: a little down to share the baseline.
                padding: const EdgeInsets.only(top: 2),
                child: Text(t.roleReadonlyNotGivenLabel, style: muted),
              ),
          ],
        ),
      ),
    );
  }
}
