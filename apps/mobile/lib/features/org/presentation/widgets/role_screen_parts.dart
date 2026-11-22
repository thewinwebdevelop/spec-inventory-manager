import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/app_theme.dart';

/// The pieces R1 and R3 share (T-003-M06 lifted them out of `roles_screen.dart`
/// so the two screens cannot drift): the reason/info banner, the warning
/// banner, and the §0 ForbiddenPanel.

/// ux §0.3 reason banner — neutral (`surfaceMuted`), text always, never colour
/// alone. [icon] defaults to `icon.info`; the R4-style reasons use `icon.lock`.
class RoleInfoBanner extends StatelessWidget {
  const RoleInfoBanner({super.key, this.title, required this.body, this.icon = Icons.info_outline});

  final String? title;
  final String body;
  final IconData icon;

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
            Icon(icon, size: AppSizes.iconMd, color: colors.text),
            const SizedBox(width: AppSpacing.s2),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (title != null)
                    Text(title!, style: AppTypography.bodySm.copyWith(fontWeight: FontWeight.w700)),
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

/// Banner warning (`icon.warn`) — R3b's "มีคนแก้บทบาทนี้ไปก่อนคุณ" and the
/// role-form throttle countdown. [children] sit under the text (R3b's diff +
/// "ใส่การแก้ของฉันกลับเข้าไป" / "ปิด"; R3a's self-loss list).
class RoleWarningBanner extends StatelessWidget {
  const RoleWarningBanner({
    super.key,
    this.title,
    this.body,
    this.icon = Icons.warning_amber_outlined,
    this.children = const [],
    this.tabularFigures = false,
  });

  final String? title;

  /// `null` = title + [children] only (R3a's self-loss box: title, list, note).
  final String? body;
  final IconData icon;
  final List<Widget> children;

  /// Countdown numerals must not jitter (design-system ThrottleBanner).
  final bool tabularFigures;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final bodyStyle = AppTypography.bodySm.copyWith(
      color: colors.warningText,
      fontFeatures: tabularFigures ? const [FontFeature.tabularFigures()] : null,
    );
    return Semantics(
      liveRegion: true,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(AppSpacing.s4),
        decoration: BoxDecoration(
          color: colors.warningBg,
          border: Border.all(color: colors.warningBorder),
          borderRadius: BorderRadius.circular(AppRadius.card),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: AppSizes.iconMd, color: colors.warningText),
            const SizedBox(width: AppSpacing.s2),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (title != null)
                    Text(
                      title!,
                      style: AppTypography.bodySm.copyWith(
                        color: colors.warningText,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  if (body != null) Text(body!, style: bodyStyle),
                  ...children,
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// ux §0 ForbiddenPanel. "Back" leaves for the shop root (the shell, whose
/// first tab is "ข้อมูลร้าน"); the roles screens may have been pushed from
/// สมาชิก too, so it pops to the root rather than one step.
class RoleForbiddenPanel extends StatelessWidget {
  const RoleForbiddenPanel({super.key});

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.screenPadding),
      child: Semantics(
        liveRegion: true,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.lock_outline, size: 32, color: colors.textMuted),
            const SizedBox(height: AppSpacing.s3),
            Text(t.rolesForbiddenTitle, style: AppTypography.headingSm, textAlign: TextAlign.center),
            const SizedBox(height: AppSpacing.s2),
            Text(
              t.rolesForbiddenBody,
              style: AppTypography.bodySm.copyWith(color: colors.textMuted),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.s4),
            OutlinedButton(
              onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst),
              child: Text(t.rolesForbiddenBack),
            ),
          ],
        ),
      ),
    );
  }
}
