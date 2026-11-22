import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/ui/error_banner.dart';
import '../../domain/entities/role_entities.dart';
import '../../domain/role_actions_model.dart';
import '../copy/role_list_copy.dart';
import '../copy/role_viewer_reason_copy.dart';
import 'capability_read_list.dart';
import 'role_delete_action.dart';
import 'role_screen_parts.dart';

/// R4 — ดูบทบาทแบบอ่านอย่างเดียว (ux-wireframe R4 · ui.md §3) · T-003-M08.
/// Mobile twin of web `RoleReadOnlyView.tsx` (W08): a full-screen push with no
/// bottom bar.
///
/// Shown whenever the SERVER says `viewer.canEdit.allowed = false` (every
/// reason) — the caller decides that; nothing here re-derives it from local
/// capabilities.
///
/// Layout (ux §0.3 (ก) "ลำดับบนจอ R4"):
///  - `writes_disabled` → ONE banner at the very top (`icon.info`), no repeat;
///    clone and delete DISABLED in "การจัดการอื่น".
///  - every other reason → ONE reason banner under the heading (`icon.lock`,
///    the server's first reason — never re-sorted), with the clone button
///    INSIDE it when `canClone` allows (or disabled + reason for
///    `role_limit_reached`).
///  - the Owner (`isSystem` / `grantsOwnership`): the single full-access card,
///    no name row, no "การจัดการอื่น" (AC-3.2 — never a clone button). The
///    "ล็อก" badge sits next to the name in the AppBar (the caller's).
///  - name is TEXT · capabilities via [CapabilityReadList] (a list, not
///    disabled checkboxes — ux §A).
///  - delete: [RoleDeleteAction] (R5), shown per [deleteAffordance].
class RoleReadOnlyView extends StatelessWidget {
  const RoleReadOnlyView({
    super.key,
    required this.role,
    required this.catalog,
    required this.isMine,
    required this.header,
    required this.onRetryCatalog,
    required this.onClone,
    required this.onRefetchRole,
    required this.onForbidden,
    this.conflictBanner,
  });

  final RoleDetailView role;

  /// `null` = the catalog failed to load.
  final CapabilityCatalogView? catalog;
  final bool isMine;

  /// Usage + last-edited lines (the same ones R3 shows).
  final List<Widget> header;

  /// R3b's banner when a 409 landed the person here (M07).
  final Widget? conflictBanner;
  final VoidCallback onRetryCatalog;
  final VoidCallback onClone;
  final VoidCallback onRefetchRole;
  final VoidCallback onForbidden;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final reason = role.canEdit.reason ?? '';
    final writesOff = reason == 'writes_disabled';
    final name = roleRowName(t, role);
    final clone = cloneAffordance(canClone: role.canClone, isSystem: role.isSystem);
    final showDelete = RoleDeleteAction.isShown(role);
    final cloneInSection = clone is CloneDisabled && clone.place == ClonePlace.section;
    final copy = roleEditOrDeleteReasonBanner(t, reason);

    Widget cloneButton({required bool enabled}) => OutlinedButton(
          key: const ValueKey('role-readonly-clone'),
          style: OutlinedButton.styleFrom(minimumSize: const Size(0, AppSizes.tapTargetMin)),
          onPressed: enabled ? onClone : null,
          child: Text(t.roleFormCloneCta),
        );

    final inBanner = <Widget>[
      if (clone is CloneInBanner) ...[
        const SizedBox(height: AppSpacing.s3),
        Align(alignment: Alignment.centerLeft, child: cloneButton(enabled: true)),
      ],
      if (clone is CloneDisabled && clone.place == ClonePlace.banner) ...[
        const SizedBox(height: AppSpacing.s3),
        Align(alignment: Alignment.centerLeft, child: cloneButton(enabled: false)),
        if (clone.reason != null) ...[
          const SizedBox(height: AppSpacing.s1),
          Text(roleCreateOrCloneBlockedCopy(t, clone.reason!), style: AppTypography.bodySm),
        ],
      ],
    ];

    return ListView(
      key: const ValueKey('role-readonly'),
      padding: const EdgeInsets.all(AppSpacing.screenPadding),
      children: [
        if (conflictBanner != null) ...[conflictBanner!, const SizedBox(height: AppSpacing.s3)],
        if (writesOff) ...[
          RoleInfoBanner(key: const ValueKey('role-reason-banner'), title: copy.title, body: copy.body),
          const SizedBox(height: AppSpacing.s3),
        ],
        ...header,
        if (!writesOff) ...[
          const SizedBox(height: AppSpacing.s4),
          RoleInfoBanner(
            key: const ValueKey('role-reason-banner'),
            title: copy.title,
            body: copy.body,
            icon: Icons.lock_outline,
            children: inBanner,
          ),
        ],
        if (!role.grantsOwnership) ...[
          const SizedBox(height: AppSpacing.s4),
          _NameRow(name: name),
        ],
        const SizedBox(height: AppSpacing.s6),
        Text(t.roleFormCapabilitiesHeader, style: AppTypography.headingSm),
        const SizedBox(height: AppSpacing.s3),
        if (catalog != null)
          CapabilityReadList(
            capabilities: role.capabilities,
            grantsOwnership: role.grantsOwnership,
            catalog: catalog!,
          )
        else
          ErrorBanner(message: t.roleFormCatalogLoadError, onRetry: onRetryCatalog, retryLabel: t.commonRetry),
        if (cloneInSection || showDelete) ...[
          const SizedBox(height: AppSpacing.s6),
          Text(t.roleFormOtherActionsHeader, style: AppTypography.headingSm),
          const SizedBox(height: AppSpacing.s2),
          if (cloneInSection) ...[cloneButton(enabled: false), const SizedBox(height: AppSpacing.s3)],
          if (showDelete)
            RoleDeleteAction(
              role: role,
              displayName: name,
              isMine: isMine,
              onRefetchRole: onRefetchRole,
              onForbidden: onForbidden,
            ),
        ],
      ],
    );
  }
}

class _NameRow extends StatelessWidget {
  const _NameRow({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    return MergeSemantics(
      key: const ValueKey('role-readonly-name'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(t.roleFormNameLabel, style: AppTypography.labelSm.copyWith(color: context.appColors.textMuted)),
          const SizedBox(height: AppSpacing.s1),
          Text(name, style: AppTypography.bodyMd),
        ],
      ),
    );
  }
}
