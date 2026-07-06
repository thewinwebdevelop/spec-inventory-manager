import 'package:flutter/material.dart';

import '../../i18n/auth_th.dart';
import '../../theme/app_theme.dart';
import '../auth_client.dart';
import '../auth_exceptions.dart';
import '../error_messages.dart';
import '../throttle_countdown_controller.dart';
import '../widgets/error_banner.dart';
import '../widgets/labeled_text_field.dart';
import '../widgets/password_field.dart';
import '../widgets/throttle_banner.dart';

/// "เข้าสู่ระบบ" (`/login`, ux-wireframe §3). [prefillEmail] mirrors the
/// query-param prefill after a successful signup (ux-wireframe §2: "พาไปหน้า
/// เข้าสู่ระบบ พร้อม email เติมไว้ล่วงหน้า").
class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    required this.authClient,
    required this.onLoginSuccess,
    required this.onNavigateToSignup,
    required this.onNavigateToHelp,
    this.prefillEmail,
  });

  final AuthClient authClient;
  final VoidCallback onLoginSuccess;
  final VoidCallback onNavigateToSignup;
  final VoidCallback onNavigateToHelp;
  final String? prefillEmail;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  late final TextEditingController _emailController;
  final _passwordController = TextEditingController();
  final _passwordFocusNode = FocusNode();
  final _throttleController = ThrottleCountdownController();

  bool _submitting = false;
  bool _hasCredentialsError = false;
  String? _generalError;

  @override
  void initState() {
    super.initState();
    _emailController = TextEditingController(text: widget.prefillEmail ?? '');
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _passwordFocusNode.dispose();
    _throttleController.dispose();
    super.dispose();
  }

  bool get _throttled => _throttleController.isActive;

  Future<void> _submit() async {
    if (_submitting || _throttled) return;

    final email = _emailController.text.trim();
    final password = _passwordController.text;

    setState(() {
      _generalError = null;
      _hasCredentialsError = false;
      _submitting = true;
    });

    try {
      await widget.authClient.login(email: email, password: password);
      if (!mounted) return;
      widget.onLoginSuccess();
    } on ApiError catch (e) {
      if (!mounted) return;
      if (e.status == 429) {
        _throttleController.start(e.retryAfterSeconds ?? 60);
        setState(() {});
      } else if (e.status == 401) {
        // Enumeration-safe (ux-wireframe §3.1): identical copy + border on
        // BOTH fields, clear password, refocus password.
        setState(() {
          _hasCredentialsError = true;
          _generalError = loginErrorMessage(e.code);
        });
        _passwordController.clear();
        _passwordFocusNode.requestFocus();
      } else {
        setState(() => _generalError = AuthTh.loginErrorGeneric);
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _generalError = AuthTh.loginErrorGeneric);
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
              Text(AuthTh.loginTitle, style: AppTypography.headingMd, textAlign: TextAlign.center),
              const SizedBox(height: AppSpacing.s8),
              ThrottleBanner(controller: _throttleController),
              if (_generalError != null) ErrorBanner(message: _generalError!),
              LabeledTextField(
                label: AuthTh.loginEmailLabel,
                controller: _emailController,
                enabled: !disabled,
                keyboardType: TextInputType.emailAddress,
                errorText: _hasCredentialsError ? '' : null,
              ),
              const SizedBox(height: AppSpacing.formGap),
              PasswordField(
                label: AuthTh.loginPasswordLabel,
                controller: _passwordController,
                focusNode: _passwordFocusNode,
                enabled: !disabled,
                errorText: _hasCredentialsError ? '' : null,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: AppSpacing.s2),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: widget.onNavigateToHelp,
                  child: Text(AuthTh.loginForgotPassword),
                ),
              ),
              const SizedBox(height: AppSpacing.s4),
              ElevatedButton(
                onPressed: disabled ? null : _submit,
                child: _submitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primaryFg),
                      )
                    : Text(_submitting ? AuthTh.loginSubmitLoading : AuthTh.loginSubmit),
              ),
              const SizedBox(height: AppSpacing.s4),
              Center(
                child: TextButton(
                  onPressed: widget.onNavigateToSignup,
                  child: Text(AuthTh.loginLinkToSignup),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
