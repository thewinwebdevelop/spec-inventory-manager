import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/ui/sticky_action_bar.dart';
import '../../domain/entities/role_entities.dart';
import '../../domain/role_templates.dart';
import '../copy/role_list_copy.dart';

/// R2 — เลือกบทบาทต้นแบบ, mobile = a full-screen push (ux R2 / ui §5: the list
/// can reach 29 roles, a sheet would be too tight).
///
/// No loading state of its own: R1 only enables "สร้างบทบาท" once both reads
/// are in, and hands them over. Nothing is written here — the choice is a
/// starting point for R3's form.
///
/// ⛔ Which options are disabled, and why, is the server's `canClone` verdict
/// ([isOfferedAsTemplate] / [RoleVerdict]); this screen compares no capability
/// sets and reads no role key.
///
/// [onNext] is R3's seam (T-003-M06): it receives the chosen role id, or `null`
/// for "เริ่มจากว่าง". While it is `null` "ถัดไป" is disabled — a button that
/// opens onto nothing is worse than no button (same rule as `MembersScreen`).
class RoleTemplateScreen extends StatefulWidget {
  const RoleTemplateScreen({
    super.key,
    required this.roles,
    required this.catalog,
    this.onNext,
  });

  final List<RoleDetailView> roles;
  final CapabilityCatalogView catalog;
  final ValueChanged<String?>? onNext;

  @override
  State<RoleTemplateScreen> createState() => _RoleTemplateScreenState();
}

class _RoleTemplateScreenState extends State<RoleTemplateScreen> {
  late String _selected = defaultTemplateId(widget.roles);

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final colors = context.appColors;
    final offered = offeredTemplates(widget.roles);
    final onNext = widget.onNext;

    return Scaffold(
      appBar: AppBar(title: Text(t.roleTemplateDialogTitle)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.screenPadding),
          children: [
            Text(t.roleTemplateDialogIntro, style: AppTypography.bodySm.copyWith(color: colors.textMuted)),
            const SizedBox(height: AppSpacing.s4),
            Semantics(
              container: true,
              child: Column(
                children: [
                  for (final role in offered)
                    _TemplateCard(
                      key: ValueKey('template-${role.id}'),
                      title: roleRowName(t, role),
                      description: _describe(t, role, widget.catalog),
                      selected: _selected == role.id,
                      disabledReason: role.canClone.allowed ? null : _disabledReason(t, role),
                      onTap: () => setState(() => _selected = role.id),
                    ),
                  _TemplateCard(
                    key: const ValueKey('template-blank'),
                    title: t.roleTemplateBlankTitle,
                    description: t.roleTemplateBlankDesc,
                    selected: _selected == blankTemplateId,
                    onTap: () => setState(() => _selected = blankTemplateId),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.s2),
            Text(t.roleTemplateOwnerNote, style: AppTypography.bodySm.copyWith(color: colors.textMuted)),
          ],
        ),
      ),
      bottomNavigationBar: StickyActionBar(
        label: t.roleTemplateNext,
        onPressed: onNext == null
            ? null
            : () => onNext(_selected == blankTemplateId ? null : _selected),
      ),
    );
  }
}

String _describe(AppLocalizations t, RoleDetailView role, CapabilityCatalogView catalog) {
  final s = summarizeCapabilities(role, catalog);
  if (s.labels.isEmpty) return t.roleTemplateDescriptionNoLabels(s.count);
  return t.roleTemplateDescription(s.count, '${s.labels.join(', ')}${s.truncated ? '…' : ''}');
}

/// ux R2: `exceeds_your_permissions` has its own sentence; any other reason
/// (an OPEN set) gets the generic one — never the raw key.
String _disabledReason(AppLocalizations t, RoleDetailView role) =>
    switch (role.canClone.reason) {
      'exceeds_your_permissions' => t.roleTemplateCloneExceeds,
      _ => t.roleTemplateCloneUnknown,
    };

class _TemplateCard extends StatelessWidget {
  const _TemplateCard({
    super.key,
    required this.title,
    required this.description,
    required this.selected,
    this.disabledReason,
    this.onTap,
  });

  final String title;
  final String description;
  final bool selected;
  final String? disabledReason;
  final VoidCallback? onTap;

  bool get _disabled => disabledReason != null;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final muted = AppTypography.bodySm.copyWith(color: colors.textMuted);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.s2),
      child: Semantics(
        inMutuallyExclusiveGroup: true,
        checked: selected,
        enabled: !_disabled,
        button: !_disabled,
        child: Material(
          color: colors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.card),
            side: BorderSide(
              color: selected && !_disabled ? colors.primary : colors.borderDefault,
              width: selected && !_disabled ? 2 : 1,
            ),
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(AppRadius.card),
            onTap: _disabled ? null : onTap,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: AppSizes.tapTargetMin),
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.s4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ExcludeSemantics(
                      child: Icon(
                        selected && !_disabled
                            ? Icons.radio_button_checked
                            : Icons.radio_button_unchecked,
                        size: AppSizes.iconMd,
                        color: _disabled ? colors.textMuted : colors.primary,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.s3),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: AppTypography.bodyMd.copyWith(
                              color: _disabled ? colors.textMuted : colors.text,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.s1),
                          // The reason replaces the description when disabled
                          // (ux R2 wireframe) — not both.
                          Text(_disabled ? disabledReason! : description, style: muted),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
