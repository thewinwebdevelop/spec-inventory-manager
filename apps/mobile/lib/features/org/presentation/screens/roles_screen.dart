import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/error/api_failure.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/session/capability_gate.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/ui/skeleton.dart';
import '../../../../core/ui/sticky_action_bar.dart';
import '../../application/org_providers.dart';
import '../../domain/entities/role_entities.dart';
import '../../domain/role_list_row.dart';
import '../copy/role_display_copy.dart';
import '../copy/role_list_copy.dart';
import '../copy/role_viewer_reason_copy.dart';
import 'role_template_screen.dart';

/// R1 — รายการบทบาท (ux-wireframe R1), pushed from "ข้อมูลร้าน" or from the
/// members screen's "จัดการบทบาท".
///
/// ⛔ Every write affordance is drawn from the server's verdict and nothing
/// else (repo lesson "client-invented server facts"):
///  - "สร้างบทบาท" ← `RoleDetailsPage.canCreate` (+ `limit`);
///  - the "ดูได้อย่างเดียว" / "ล็อก" badge ← each role's `canEdit` / `isSystem`;
///  - the writes-off banner ← `canCreate.reason == writes_disabled` (the server
///    reports it on every write verdict while the flag is off).
/// This screen never reads the viewer's capability set to decide any of that
/// (the only capability question is the entry points', answered in the callers).
///
/// Four states: skeleton / error / data — and `items = []` is the error state,
/// since a shop always has its Owner role (an empty list means the answer is
/// wrong, not that there is nothing).
///
/// Seams for the screens that do not exist yet (T-003-M06+), both `null`
/// until they are built:
///  - [onOpenRole] — R3/R4. While `null` the rows are NOT tappable and carry no
///    "›": an affordance that opens onto nothing is worse than none.
///  - [onCreateNext] — R3's create mode, forwarded to R2's "ถัดไป".
/// Push R1 — the one way every entry point (ข้อมูลร้าน row, สมาชิก button)
/// opens it, so they cannot drift apart.
Future<void> openRolesScreen(BuildContext context) =>
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const RolesScreen()));

class RolesScreen extends ConsumerWidget {
  const RolesScreen({super.key, this.onOpenRole, this.onCreateNext});

  final ValueChanged<RoleDetailView>? onOpenRole;
  final ValueChanged<String?>? onCreateNext;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // UX gating, not enforcement: leaving when `manage_roles` is gone (role
    // edited, shop switched) is ux-wireframe's "ไม่ค้างบนจอที่เข้าไม่ได้".
    return CapabilityScreenGuard(
      capability: manageRolesCapability,
      onDenied: () => Navigator.of(context).maybePop(),
      child: _RolesBody(onOpenRole: onOpenRole, onCreateNext: onCreateNext),
    );
  }
}

class _RolesBody extends ConsumerStatefulWidget {
  const _RolesBody({required this.onOpenRole, required this.onCreateNext});

  final ValueChanged<RoleDetailView>? onOpenRole;
  final ValueChanged<String?>? onCreateNext;

  @override
  ConsumerState<_RolesBody> createState() => _RolesBodyState();
}

class _RolesBodyState extends ConsumerState<_RolesBody> {
  bool _relearned = false;

  void _retry() {
    ref.invalidate(roleDetailsProvider);
    ref.invalidate(capabilityCatalogProvider);
  }

  /// A 403 mid-session means our copy of the caller's capabilities is stale:
  /// ask the server again, once (the entry points then disappear on their
  /// own, and the guard above leaves the screen).
  void _relearnOnForbidden(Object? error) {
    if (_relearned || error is! ForbiddenFailure) return;
    _relearned = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) learnCapabilities(ref);
    });
  }

  void _openTemplates(RoleDetailsPage page, CapabilityCatalogView catalog) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => RoleTemplateScreen(
          roles: page.items,
          catalog: catalog,
          onNext: widget.onCreateNext,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final colors = context.appColors;
    final details = ref.watch(roleDetailsProvider);
    final catalog = ref.watch(capabilityCatalogProvider);
    // Display only ("(รวมคุณ)"). Not having it drops that suffix, nothing else.
    final myRoleId = ref.watch(orgProfileProvider).valueOrNull?.myRoleId;

    final failure = details.error ?? catalog.error;
    _relearnOnForbidden(failure);

    final page = details.valueOrNull;
    final catalogData = catalog.valueOrNull;
    final broken = failure != null || (page != null && page.items.isEmpty);
    final ready = !broken && page != null && catalogData != null;

    final canCreate = page?.canCreate;
    final writesOff = canCreate != null && writesDisabledBanner(canCreate);
    final blockedCopy = canCreate != null && !canCreate.allowed && !writesOff
        ? roleCreateOrCloneBlockedCopy(t, canCreate.reason ?? '', limit: page?.limit)
        : null;

    return Scaffold(
      appBar: AppBar(title: Text(t.rolesListTitle)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.screenPadding),
          children: [
            Text(t.rolesListDesc1, style: AppTypography.bodySm.copyWith(color: colors.textMuted)),
            Text(t.rolesListDesc2, style: AppTypography.bodySm.copyWith(color: colors.textMuted)),
            const SizedBox(height: AppSpacing.s3),
            if (writesOff) ...[
              _InfoBanner(
                title: t.roleReasonWritesDisabledTitle,
                body: t.roleReasonWritesDisabledBody,
              ),
              const SizedBox(height: AppSpacing.s3),
            ],
            if (ready) ...[
              Text(
                t.rolesListUsageCount(page.items.length, page.limit),
                style: AppTypography.bodySm.copyWith(color: colors.textMuted),
              ),
              const SizedBox(height: AppSpacing.s3),
              _RoleList(
                roles: page.items,
                myRoleId: myRoleId,
                onOpenRole: widget.onOpenRole,
              ),
            ] else if (broken)
              _ErrorPanel(onRetry: _retry)
            else
              const SessionListSkeleton(),
          ],
        ),
      ),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (blockedCopy != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s4),
              child: Text(
                blockedCopy,
                textAlign: TextAlign.center,
                style: AppTypography.bodySm.copyWith(color: colors.textMuted),
              ),
            ),
          // Disabled until BOTH reads are in (ux R2: "ถ้า R1 ยังไม่มีข้อมูล →
          // ปุ่มสร้างยัง disabled") and the server says the caller may create.
          StickyActionBar(
            label: t.rolesListCreateCta,
            onPressed: ready && canCreate!.allowed
                ? () => _openTemplates(page, catalogData)
                : null,
          ),
        ],
      ),
    );
  }
}

class _RoleList extends StatelessWidget {
  const _RoleList({required this.roles, required this.myRoleId, required this.onOpenRole});

  final List<RoleDetailView> roles;
  final String? myRoleId;
  final ValueChanged<RoleDetailView>? onOpenRole;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border.all(color: colors.borderDefault),
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadius.card),
        child: Column(
          children: [
            for (var i = 0; i < roles.length; i++) ...[
              if (i > 0) Divider(height: 1, color: colors.borderDefault),
              _RoleRow(
                key: ValueKey('role-row-${roles[i].id}'),
                role: roles[i],
                isMine: myRoleId != null && roles[i].id == myRoleId,
                onTap: onOpenRole == null ? null : () => onOpenRole!(roles[i]),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _RoleRow extends StatelessWidget {
  const _RoleRow({super.key, required this.role, required this.isMine, required this.onTap});

  final RoleDetailView role;
  final bool isMine;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final colors = context.appColors;
    final muted = AppTypography.bodySm.copyWith(color: colors.textMuted);
    final badge = switch (roleBadgeFor(role)) {
      RoleBadge.locked => t.rolesListBadgeLocked,
      RoleBadge.readOnly => t.rolesListBadgeReadOnly,
      null => null,
    };

    final content = ConstrainedBox(
      constraints: const BoxConstraints(minHeight: AppSizes.listRowMinH),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s4, vertical: AppSpacing.s3),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: AppSpacing.s2,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(roleRowName(t, role), style: AppTypography.bodyMd),
                      if (badge != null) _Badge(label: badge),
                    ],
                  ),
                  Text(roleRowUsageLine(t, role, isMine: isMine), style: muted),
                  // Mobile: last edited is its own (third) line, never truncated.
                  Text(
                    roleLastEditedLine(t, roleLastEditedFrom(t, role.lastEdited)),
                    style: muted,
                  ),
                ],
              ),
            ),
            if (onTap != null)
              Icon(Icons.chevron_right, size: AppSizes.iconMd, color: colors.textMuted),
          ],
        ),
      ),
    );

    return onTap == null ? content : InkWell(onTap: onTap, child: content);
  }
}

/// Neutral, text always (never colour alone).
class _Badge extends StatelessWidget {
  const _Badge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadius.badge),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s2, vertical: 2),
        child: Text(label, style: AppTypography.labelSm.copyWith(color: colors.text)),
      ),
    );
  }
}

class _InfoBanner extends StatelessWidget {
  const _InfoBanner({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Semantics(
      liveRegion: true,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(AppSpacing.s4),
        decoration: BoxDecoration(
          color: colors.surfaceMuted,
          border: Border.all(color: colors.borderDefault),
          borderRadius: BorderRadius.circular(AppRadius.card),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.info_outline, size: AppSizes.iconMd, color: colors.text),
            const SizedBox(width: AppSpacing.s2),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: AppTypography.bodySm.copyWith(fontWeight: FontWeight.w700)),
                  Text(body, style: AppTypography.bodySm),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorPanel extends StatelessWidget {
  const _ErrorPanel({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final colors = context.appColors;
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.s6),
        decoration: BoxDecoration(
          border: Border.all(color: colors.borderDefault),
          borderRadius: BorderRadius.circular(AppRadius.card),
        ),
        child: Column(
          children: [
            Text(t.rolesListLoadError, style: AppTypography.headingSm, textAlign: TextAlign.center),
            const SizedBox(height: AppSpacing.s2),
            Text(
              t.rolesListLoadErrorHint,
              style: AppTypography.bodySm.copyWith(color: colors.textMuted),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.s3),
            OutlinedButton(onPressed: onRetry, child: Text(t.commonRetry)),
          ],
        ),
      ),
    );
  }
}
