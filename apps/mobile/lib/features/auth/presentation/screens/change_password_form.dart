import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/security/screenshot_guard.dart';
import '../../application/change_password_controller.dart';
import '../../../../core/ui/error_banner.dart';
import '../../../../core/ui/password_field.dart';
import '../widgets/throttle_banner.dart';

/// "เปลี่ยนรหัสผ่าน" section (US-6, D-008, ux-wireframe §9). Reuse-only —
/// no new component beyond `PasswordField`/`ThrottleBanner`/`ErrorBanner`
/// (ui.md §2.1.1). Deliberately only 2 fields (no confirm-new-password,
/// ux-wireframe §9.3).
///
/// D-023 PASS 2: rewired to a `ConsumerStatefulWidget` watching
/// `changePasswordControllerProvider` — takes NO repository param anymore.
class ChangePasswordForm extends ConsumerStatefulWidget {
  const ChangePasswordForm({
    super.key,
    required this.onChanged,
    required this.onSessionExpired,
  });

  /// Called after a successful change so the caller can refresh the session
  /// list (ux-wireframe §9.4: "ให้ list refresh ทันทีหลัง toast").
  final VoidCallback onChanged;
  final VoidCallback onSessionExpired;

  @override
  ConsumerState<ChangePasswordForm> createState() => _ChangePasswordFormState();
}

class _ChangePasswordFormState extends ConsumerState<ChangePasswordForm> {
  final _currentController = TextEditingController();
  final _newController = TextEditingController();

  // T-001-17 ★ (L-5) — obscure the password fields from screenshots/the
  // app-switcher preview for as long as this form is mounted. Reference-
  // counted (ScreenshotGuardScope) since this form lives INSIDE
  // SecurityScreen alongside the session list, not as a standalone screen.
  late final VoidCallback _releaseScreenshotGuard;

  @override
  void initState() {
    super.initState();
    _releaseScreenshotGuard = ScreenshotGuardScope.acquire();
  }

  @override
  void dispose() {
    _releaseScreenshotGuard();
    _currentController.dispose();
    _newController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final current = _currentController.text;
    final next = _newController.text;
    final outcome = await ref
        .read(changePasswordControllerProvider.notifier)
        .submit(currentPassword: current, newPassword: next);
    if (!mounted) return;
    switch (outcome) {
      case ChangePasswordOutcome.success:
        _currentController.clear();
        _newController.clear();
        widget.onChanged();
      case ChangePasswordOutcome.sessionExpired:
        widget.onSessionExpired();
      case ChangePasswordOutcome.failure:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final changePasswordState = ref.watch(changePasswordControllerProvider);
    final throttle = ref.read(changePasswordControllerProvider.notifier).throttle;
    final disabled = changePasswordState.submitting || throttle.isActive;
    final t = AppLocalizations.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(t.authChangePasswordSectionTitle, style: AppTypography.headingSm),
        const SizedBox(height: AppSpacing.s4),
        ThrottleBanner(controller: throttle),
        if (changePasswordState.generalError != null) ErrorBanner(message: changePasswordState.generalError!),
        PasswordField(
          label: t.authChangePasswordCurrentLabel,
          controller: _currentController,
          errorText: changePasswordState.currentError,
          enabled: !disabled,
        ),
        const SizedBox(height: AppSpacing.formGap),
        PasswordField(
          label: t.authChangePasswordNewLabel,
          controller: _newController,
          placeholder: t.authChangePasswordNewPlaceholder,
          helperText: t.authChangePasswordNewHelper,
          errorText: changePasswordState.newError,
          enabled: !disabled,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _submit(),
        ),
        const SizedBox(height: AppSpacing.s6),
        ElevatedButton(
          onPressed: disabled ? null : _submit,
          child: changePasswordState.submitting
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primaryFg),
                )
              : Text(changePasswordState.submitting
                  ? t.authChangePasswordSubmitLoading
                  : t.authChangePasswordSubmit),
        ),
      ],
    );
  }
}
