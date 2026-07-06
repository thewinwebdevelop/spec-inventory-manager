import 'package:flutter/material.dart';

import '../../i18n/auth_th.dart';
import '../../theme/app_theme.dart';

/// "ลืมรหัสผ่าน?" — static help (ux-wireframe §3.3/§11.4). No API call: not
/// self-serve reset in MVP (F-081 later). Rendered as a full-screen or bottom
/// sheet per ux-wireframe §11.4 mobile note — this implementation is a plain
/// screen (simplest to navigate to/from either).
class LoginHelpScreen extends StatelessWidget {
  const LoginHelpScreen({super.key, required this.onBackToLogin});

  final VoidCallback onBackToLogin;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.screenPadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: AppSpacing.s8),
              Text(AuthTh.helpTitle, style: AppTypography.headingMd, textAlign: TextAlign.center),
              const SizedBox(height: AppSpacing.s6),
              Text(AuthTh.helpBody, style: AppTypography.bodyMd),
              const SizedBox(height: AppSpacing.s6),
              const Divider(color: AppColors.borderDefault),
              const SizedBox(height: AppSpacing.s6),
              Text(
                AuthTh.helpBodySoloOwner,
                style: AppTypography.bodySm.copyWith(color: AppColors.textMuted),
              ),
              const SizedBox(height: AppSpacing.s8),
              ElevatedButton(
                onPressed: onBackToLogin,
                child: Text(AuthTh.helpBackToLogin),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
