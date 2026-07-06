import 'package:flutter/material.dart';

import '../../../../core/api/refresh_coordinator.dart';
import '../../../../core/i18n/auth_th.dart';
import '../../../../app/theme/app_theme.dart';
import '../../data/auth_repository_impl.dart';
import '../../data/auth_exceptions.dart';
import '../../../../core/error/error_messages.dart';
import '../../../../core/security/screenshot_guard.dart';
import '../../application/throttle_countdown_controller.dart';
import '../../domain/validation.dart';
import '../../../../core/ui/error_banner.dart';
import '../../../../core/ui/password_field.dart';
import '../widgets/throttle_banner.dart';

/// "เปลี่ยนรหัสผ่าน" section (US-6, D-008, ux-wireframe §9). Reuse-only —
/// no new component beyond `PasswordField`/`ThrottleBanner`/`ErrorBanner`
/// (ui.md §2.1.1). Deliberately only 2 fields (no confirm-new-password,
/// ux-wireframe §9.3).
class ChangePasswordForm extends StatefulWidget {
  const ChangePasswordForm({
    super.key,
    required this.authClient,
    required this.onChanged,
    required this.onSessionExpired,
  });

  final AuthRepositoryImpl authClient;

  /// Called after a successful change so the caller can refresh the session
  /// list (ux-wireframe §9.4: "ให้ list refresh ทันทีหลัง toast").
  final VoidCallback onChanged;
  final VoidCallback onSessionExpired;

  @override
  State<ChangePasswordForm> createState() => _ChangePasswordFormState();
}

class _ChangePasswordFormState extends State<ChangePasswordForm> {
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _throttleController = ThrottleCountdownController();

  bool _submitting = false;
  String? _currentError;
  String? _newError;
  String? _generalError;

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
    _throttleController.dispose();
    super.dispose();
  }

  bool get _throttled => _throttleController.isActive;

  Future<void> _submit() async {
    if (_submitting || _throttled) return;

    final current = _currentController.text;
    final next = _newController.text;

    setState(() {
      _generalError = null;
      _currentError = null;
      _newError = isPasswordLongEnough(next) ? null : AuthTh.changePasswordErrorPasswordTooShort;
    });
    if (_newError != null) return;

    setState(() => _submitting = true);
    try {
      await widget.authClient.changePassword(currentPassword: current, newPassword: next);
      if (!mounted) return;
      _currentController.clear();
      _newController.clear();
      widget.onChanged();
    } on SessionExpiredException {
      if (!mounted) return;
      widget.onSessionExpired();
    } on ApiError catch (e) {
      if (!mounted) return;
      if (e.status == 429) {
        _throttleController.start(e.retryAfterSeconds ?? 60);
        setState(() {});
      } else if (e.status == 401) {
        setState(() => _currentError = changePasswordErrorMessage(e.code));
      } else if (e.status == 422) {
        setState(() => _newError = changePasswordErrorMessage(e.code));
      } else {
        setState(() => _generalError = AuthTh.changePasswordErrorGeneric);
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _generalError = AuthTh.changePasswordErrorGeneric);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final disabled = _submitting || _throttled;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(AuthTh.changePasswordSectionTitle, style: AppTypography.headingSm),
        const SizedBox(height: AppSpacing.s4),
        ThrottleBanner(controller: _throttleController),
        if (_generalError != null) ErrorBanner(message: _generalError!),
        PasswordField(
          label: AuthTh.changePasswordCurrentLabel,
          controller: _currentController,
          errorText: _currentError,
          enabled: !disabled,
        ),
        const SizedBox(height: AppSpacing.formGap),
        PasswordField(
          label: AuthTh.changePasswordNewLabel,
          controller: _newController,
          placeholder: AuthTh.changePasswordNewPlaceholder,
          helperText: AuthTh.changePasswordNewHelper,
          errorText: _newError,
          enabled: !disabled,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _submit(),
        ),
        const SizedBox(height: AppSpacing.s6),
        ElevatedButton(
          onPressed: disabled ? null : _submit,
          child: _submitting
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primaryFg),
                )
              : Text(_submitting ? AuthTh.changePasswordSubmitLoading : AuthTh.changePasswordSubmit),
        ),
      ],
    );
  }
}
