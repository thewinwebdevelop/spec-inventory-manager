import 'package:flutter/material.dart';

import '../../i18n/auth_th.dart';
import '../../theme/app_theme.dart';
import '../auth_client.dart';
import 'change_password_form.dart';
import 'session_list.dart';

/// "ความปลอดภัย" (`/settings/security`, ux-wireframe §9.1/§11.5) — combines
/// change-password (§9) + session list (§4) in one screen, per ux-wireframe:
/// "ทั้งสองเรื่อง (รหัสผ่าน + เซสชัน) เป็น 'ความปลอดภัยของบัญชี' concept
/// เดียวกัน ... วางเป็น section คนละบล็อกในหน้าเดียว".
class SecurityScreen extends StatefulWidget {
  const SecurityScreen({
    super.key,
    required this.authClient,
    required this.onSessionExpired,
  });

  final AuthClient authClient;
  final VoidCallback onSessionExpired;

  @override
  State<SecurityScreen> createState() => _SecurityScreenState();
}

class _SecurityScreenState extends State<SecurityScreen> {
  final _sessionListKey = GlobalKey<SessionListState>();

  void _handlePasswordChanged() {
    // ux-wireframe §9.4: toast + refresh the session list so the user SEES
    // other devices disappear (not just trust the toast copy).
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          AuthTh.changePasswordSuccessToast,
          style: const TextStyle(color: AppColors.successText),
        ),
        backgroundColor: AppColors.successBg,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 5),
      ),
    );
    _sessionListKey.currentState?.load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(AuthTh.sessionsTitle)),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.screenPadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ChangePasswordForm(
                authClient: widget.authClient,
                onChanged: _handlePasswordChanged,
                onSessionExpired: widget.onSessionExpired,
              ),
              const SizedBox(height: AppSpacing.s8),
              const Divider(color: AppColors.borderDefault),
              const SizedBox(height: AppSpacing.s8),
              SessionList(
                key: _sessionListKey,
                authClient: widget.authClient,
                onSessionExpired: widget.onSessionExpired,
                onLoggedOutAll: widget.onSessionExpired,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
