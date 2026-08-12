import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/ui/app_toast.dart';
import '../../domain/repositories/org_repository.dart';
import '../widgets/expiry_text.dart';

/// S8 — ลิงก์คำเชิญ (แสดงครั้งเดียว), mobile (ux-wireframe §9.1 + §13:
/// full screen, copy button full width).
///
/// **Why "once" is literally true here.** The server stores only the token's
/// hash (D-018), so this string exists in exactly one place — this widget's
/// field — and nothing can produce it again. That is also why there is no
/// "คัดลอกลิงก์เดิม" anywhere in this feature: there is no old link to copy,
/// only a new one to issue, and issuing one kills the previous (D-027).
///
/// ux settled the guard: the warning strip is the ONLY gate. No dialog blocks
/// closing the screen (user decision, 2026-07-28) — a confirm on the way out
/// would train people to dismiss it.
class InviteLinkScreen extends StatelessWidget {
  const InviteLinkScreen({super.key, required this.invite});

  final IssuedInvite invite;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final colors = context.appColors;

    return Scaffold(
      appBar: AppBar(title: Text(t.inviteLinkTitle)),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.s6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSpacing.s4),
                decoration: BoxDecoration(
                  color: colors.warningBg,
                  border: Border.all(color: colors.warningBorder),
                  borderRadius: BorderRadius.circular(AppRadius.card),
                ),
                child: Text(
                  t.inviteLinkOnceWarning,
                  style: AppTypography.bodySm.copyWith(color: colors.warningText),
                ),
              ),
              const SizedBox(height: AppSpacing.s4),
              Text(t.inviteLinkFor(invite.email)),
              const SizedBox(height: AppSpacing.s2),
              // Read from the response, never computed from a constant: the
              // TTL depends on the invited role and restarts on reissue
              // (D-027/D-028).
              Text(formatExpiryLine(t, invite.expiresAt)),
              const SizedBox(height: AppSpacing.s4),
              // Selectable, not just copyable: somebody whose clipboard
              // permission is refused can still select the text by hand
              // (§14). `SelectableText` rather than a read-only `TextField`
              // because a controller built in `build()` is never disposed.
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSpacing.s3),
                decoration: BoxDecoration(
                  color: colors.surfaceMuted,
                  border: Border.all(color: colors.borderDefault),
                  borderRadius: BorderRadius.circular(AppRadius.card),
                ),
                child: SelectableText(
                  invite.inviteUrl,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
              const SizedBox(height: AppSpacing.s4),
              Semantics(
                label: t.inviteLinkSemantics,
                button: true,
                child: ElevatedButton.icon(
                  onPressed: () async {
                    await Clipboard.setData(ClipboardData(text: invite.inviteUrl));
                    if (context.mounted) showAppToast(context, t.inviteLinkCopied);
                  },
                  icon: const Icon(Icons.copy),
                  label: Text(t.inviteLinkCopy),
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size.fromHeight(AppSizes.tapTargetMin),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.s3),
              OutlinedButton(
                onPressed: () => Navigator.of(context).pop(),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(AppSizes.tapTargetMin),
                ),
                child: Text(t.inviteLinkDone),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
