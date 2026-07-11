import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/security/screenshot_guard.dart';
import '../../application/signup_controller.dart';
import '../../../../core/ui/error_banner.dart';
import '../../../../core/ui/labeled_text_field.dart';
import '../../../../core/ui/password_field.dart';
import '../widgets/throttle_banner.dart';

/// "สมัครใช้งาน" (`/signup`, ux-wireframe §2). Full-screen, safe-area aware
/// (ux-wireframe §11.1 mobile note) — no card/shadow (web-only chrome).
///
/// D-023 PASS 2: rewired to a `ConsumerStatefulWidget` watching
/// `signupControllerProvider` — takes NO repository param anymore.
class SignupScreen extends ConsumerStatefulWidget {
  const SignupScreen({
    super.key,
    required this.onSignupSuccess,
    required this.onNavigateToLogin,
  });

  /// Called with the just-registered email so the caller can route to
  /// login with the field prefilled (ux-wireframe: "สมัครสำเร็จ → พาไปหน้า
  /// เข้าสู่ระบบ พร้อม email เติมไว้ล่วงหน้า" — no auto-login).
  final void Function(String email) onSignupSuccess;
  final VoidCallback onNavigateToLogin;

  @override
  ConsumerState<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends ConsumerState<SignupScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  // T-001-17 ★ (L-5) — obscure the password field from screenshots/the
  // app-switcher preview for as long as this screen is mounted.
  late final VoidCallback _releaseScreenshotGuard;

  @override
  void initState() {
    super.initState();
    _releaseScreenshotGuard = ScreenshotGuardScope.acquire();
  }

  @override
  void dispose() {
    _releaseScreenshotGuard();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _validateEmailOnBlur() {
    ref.read(signupControllerProvider.notifier).validateEmailOnBlur(_emailController.text);
  }

  Future<void> _submit() async {
    final email = _emailController.text;
    final password = _passwordController.text;
    final signedUpEmail =
        await ref.read(signupControllerProvider.notifier).submit(email: email, password: password);
    if (!mounted || signedUpEmail == null) return;
    widget.onSignupSuccess(signedUpEmail);
  }

  @override
  Widget build(BuildContext context) {
    final signupState = ref.watch(signupControllerProvider);
    final throttle = ref.read(signupControllerProvider.notifier).throttle;
    final disabled = signupState.submitting || throttle.isActive;
    final t = AppLocalizations.of(context);

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.screenPadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: AppSpacing.s8),
              Text(t.authSignupTitle, style: AppTypography.headingMd, textAlign: TextAlign.center),
              const SizedBox(height: AppSpacing.s2),
              Text(
                t.authSignupSubtitle,
                style: AppTypography.bodyMd.copyWith(color: AppColors.textMuted),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.s8),
              ThrottleBanner(controller: throttle),
              if (signupState.generalError != null) ErrorBanner(message: signupState.generalError!),
              LabeledTextField(
                label: t.authSignupEmailLabel,
                controller: _emailController,
                placeholder: t.authSignupEmailPlaceholder,
                errorText: signupState.emailError,
                enabled: !disabled,
                keyboardType: TextInputType.emailAddress,
                onEditingComplete: _validateEmailOnBlur,
              ),
              const SizedBox(height: AppSpacing.formGap),
              PasswordField(
                label: t.authSignupPasswordLabel,
                controller: _passwordController,
                placeholder: t.authSignupPasswordPlaceholder,
                helperText: t.authSignupPasswordHelper,
                errorText: signupState.passwordError,
                enabled: !disabled,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: AppSpacing.s6),
              ElevatedButton(
                onPressed: disabled ? null : _submit,
                child: signupState.submitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primaryFg),
                      )
                    : Text(signupState.submitting ? t.authSignupSubmitLoading : t.authSignupSubmit),
              ),
              const SizedBox(height: AppSpacing.s4),
              Center(
                child: TextButton(
                  onPressed: widget.onNavigateToLogin,
                  child: Text(t.authSignupLinkToLogin),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
