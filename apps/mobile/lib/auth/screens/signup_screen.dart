import 'package:flutter/material.dart';

import '../../i18n/auth_th.dart';
import '../../theme/app_theme.dart';
import '../auth_client.dart';
import '../auth_exceptions.dart';
import '../error_messages.dart';
import '../throttle_countdown_controller.dart';
import '../validation.dart';
import '../widgets/error_banner.dart';
import '../widgets/labeled_text_field.dart';
import '../widgets/password_field.dart';
import '../widgets/throttle_banner.dart';

/// "สมัครใช้งาน" (`/signup`, ux-wireframe §2). Full-screen, safe-area aware
/// (ux-wireframe §11.1 mobile note) — no card/shadow (web-only chrome).
class SignupScreen extends StatefulWidget {
  const SignupScreen({
    super.key,
    required this.authClient,
    required this.onSignupSuccess,
    required this.onNavigateToLogin,
  });

  final AuthClient authClient;

  /// Called with the just-registered email so the caller can route to
  /// login with the field prefilled (ux-wireframe: "สมัครสำเร็จ → พาไปหน้า
  /// เข้าสู่ระบบ พร้อม email เติมไว้ล่วงหน้า" — no auto-login).
  final void Function(String email) onSignupSuccess;
  final VoidCallback onNavigateToLogin;

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _throttleController = ThrottleCountdownController();

  bool _submitting = false;
  String? _emailError;
  String? _passwordError;
  String? _generalError;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _throttleController.dispose();
    super.dispose();
  }

  bool get _throttled => _throttleController.isActive;

  void _validateEmailOnBlur() {
    final email = _emailController.text;
    setState(() {
      _emailError = email.isEmpty || isValidEmailShape(email) ? null : AuthTh.signupErrorEmailInvalid;
    });
  }

  Future<void> _submit() async {
    if (_submitting || _throttled) return;

    final email = _emailController.text.trim();
    final password = _passwordController.text;

    setState(() {
      _generalError = null;
      _emailError = isValidEmailShape(email) ? null : AuthTh.signupErrorEmailInvalid;
      _passwordError = isPasswordLongEnough(password) ? null : AuthTh.signupErrorPasswordTooShort;
    });
    if (_emailError != null || _passwordError != null) return;

    setState(() => _submitting = true);
    try {
      await widget.authClient.signup(email: email, password: password);
      if (!mounted) return;
      widget.onSignupSuccess(email);
    } on ApiError catch (e) {
      if (!mounted) return;
      if (e.status == 429) {
        _throttleController.start(e.retryAfterSeconds ?? 60);
        setState(() {});
      } else if (e.status == 422 || e.status == 409) {
        setState(() {
          if (e.code == 'PASSWORD_TOO_SHORT' || e.code == 'PASSWORD_BREACHED') {
            _passwordError = signupErrorMessage(e.code);
          } else {
            _emailError = signupErrorMessage(e.code);
          }
        });
      } else {
        setState(() => _generalError = signupErrorMessage(e.code));
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _generalError = AuthTh.signupErrorGeneric);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final disabled = _submitting || _throttled;
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.screenPadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: AppSpacing.s8),
              Text(AuthTh.signupTitle, style: AppTypography.headingMd, textAlign: TextAlign.center),
              const SizedBox(height: AppSpacing.s2),
              Text(
                AuthTh.signupSubtitle,
                style: AppTypography.bodyMd.copyWith(color: AppColors.textMuted),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.s8),
              ThrottleBanner(controller: _throttleController),
              if (_generalError != null) ErrorBanner(message: _generalError!),
              LabeledTextField(
                label: AuthTh.signupEmailLabel,
                controller: _emailController,
                placeholder: AuthTh.signupEmailPlaceholder,
                errorText: _emailError,
                enabled: !disabled,
                keyboardType: TextInputType.emailAddress,
                onEditingComplete: _validateEmailOnBlur,
              ),
              const SizedBox(height: AppSpacing.formGap),
              PasswordField(
                label: AuthTh.signupPasswordLabel,
                controller: _passwordController,
                placeholder: AuthTh.signupPasswordPlaceholder,
                helperText: AuthTh.signupPasswordHelper,
                errorText: _passwordError,
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
                    : Text(_submitting ? AuthTh.signupSubmitLoading : AuthTh.signupSubmit),
              ),
              const SizedBox(height: AppSpacing.s4),
              Center(
                child: TextButton(
                  onPressed: widget.onNavigateToLogin,
                  child: Text(AuthTh.signupLinkToLogin),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
