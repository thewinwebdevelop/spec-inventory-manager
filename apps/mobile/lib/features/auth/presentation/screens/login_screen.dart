import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/security/screenshot_guard.dart';
import '../../application/login_controller.dart';
import '../../../../core/ui/error_banner.dart';
import '../../../../core/ui/labeled_text_field.dart';
import '../../../../core/ui/password_field.dart';
import '../widgets/throttle_banner.dart';

/// "เข้าสู่ระบบ" (`/login`, ux-wireframe §3). [prefillEmail] mirrors the
/// query-param prefill after a successful signup (ux-wireframe §2: "พาไปหน้า
/// เข้าสู่ระบบ พร้อม email เติมไว้ล่วงหน้า").
///
/// D-023 PASS 2: rewired to a `ConsumerStatefulWidget` watching
/// `loginControllerProvider` (`Notifier<LoginState>`) — takes NO repository
/// param anymore (resolved via `authRepositoryProvider` inside the
/// controller; test injection = provider override, same seam
/// `BootstrapScreen` uses). Text-field controllers/focus nodes stay local
/// widget state (ephemeral UI state, per D-023 step 1) — only the
/// submit/loading/error/throttle transitions moved to `application/`.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({
    super.key,
    required this.onLoginSuccess,
    required this.onNavigateToSignup,
    required this.onNavigateToHelp,
    this.prefillEmail,
  });

  final VoidCallback onLoginSuccess;
  final VoidCallback onNavigateToSignup;
  final VoidCallback onNavigateToHelp;
  final String? prefillEmail;

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  late final TextEditingController _emailController;
  final _passwordController = TextEditingController();
  final _passwordFocusNode = FocusNode();

  // T-001-17 ★ (L-5) — obscure the password field from screenshots/the
  // app-switcher preview for as long as this screen is mounted.
  late final VoidCallback _releaseScreenshotGuard;

  // Tracks the last `clearPasswordSignal` this widget has already reacted
  // to (mirrors `BootstrapScreen`'s `_decided` guard pattern) so a rebuild
  // triggered by something else doesn't re-clear the password field.
  int _lastHandledClearSignal = 0;

  @override
  void initState() {
    super.initState();
    _emailController = TextEditingController(text: widget.prefillEmail ?? '');
    _releaseScreenshotGuard = ScreenshotGuardScope.acquire();
  }

  @override
  void dispose() {
    _releaseScreenshotGuard();
    _emailController.dispose();
    _passwordController.dispose();
    _passwordFocusNode.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    final success = await ref
        .read(loginControllerProvider.notifier)
        .submit(email: email, password: password);
    if (!mounted) return;
    if (success) {
      widget.onLoginSuccess();
    }
  }

  @override
  Widget build(BuildContext context) {
    final loginState = ref.watch(loginControllerProvider);
    final throttle = ref.read(loginControllerProvider.notifier).throttle;

    if (loginState.clearPasswordSignal != _lastHandledClearSignal) {
      _lastHandledClearSignal = loginState.clearPasswordSignal;
      _passwordController.clear();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _passwordFocusNode.requestFocus();
      });
    }

    final disabled = loginState.submitting || throttle.isActive;
    final t = AppLocalizations.of(context);
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.screenPadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: AppSpacing.s8),
              Text(t.authLoginTitle, style: AppTypography.headingMd, textAlign: TextAlign.center),
              const SizedBox(height: AppSpacing.s8),
              ThrottleBanner(controller: throttle),
              if (loginState.generalError != null) ErrorBanner(message: loginState.generalError!),
              LabeledTextField(
                label: t.authLoginEmailLabel,
                controller: _emailController,
                enabled: !disabled,
                keyboardType: TextInputType.emailAddress,
                errorText: loginState.hasCredentialsError ? '' : null,
              ),
              const SizedBox(height: AppSpacing.formGap),
              PasswordField(
                label: t.authLoginPasswordLabel,
                controller: _passwordController,
                focusNode: _passwordFocusNode,
                enabled: !disabled,
                errorText: loginState.hasCredentialsError ? '' : null,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: AppSpacing.s2),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: widget.onNavigateToHelp,
                  child: Text(t.authLoginForgotPassword),
                ),
              ),
              const SizedBox(height: AppSpacing.s4),
              ElevatedButton(
                onPressed: disabled ? null : _submit,
                child: loginState.submitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primaryFg),
                      )
                    : Text(loginState.submitting ? t.authLoginSubmitLoading : t.authLoginSubmit),
              ),
              const SizedBox(height: AppSpacing.s4),
              Center(
                child: TextButton(
                  onPressed: widget.onNavigateToSignup,
                  child: Text(t.authLoginLinkToSignup),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
