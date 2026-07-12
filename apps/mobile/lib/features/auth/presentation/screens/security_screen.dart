import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/app_theme.dart';
import 'change_password_form.dart';
import 'session_list.dart';

/// "ความปลอดภัย" (`/settings/security`, ux-wireframe §9.1/§11.5) — combines
/// change-password (§9) + session list (§4) in one screen, per ux-wireframe:
/// "ทั้งสองเรื่อง (รหัสผ่าน + เซสชัน) เป็น 'ความปลอดภัยของบัญชี' concept
/// เดียวกัน ... วางเป็น section คนละบล็อกในหน้าเดียว".
///
/// D-023 PASS 2: no longer takes an `authClient` param — `ChangePasswordForm`/
/// `SessionList` resolve the repository via their own controllers'
/// `authRepositoryProvider` read, so this screen has nothing repository-shaped
/// left to thread through.
class SecurityScreen extends StatefulWidget {
  const SecurityScreen({
    super.key,
    required this.onSessionExpired,
  });

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
          AppLocalizations.of(context).authChangePasswordSuccessToast,
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
      appBar: AppBar(title: Text(AppLocalizations.of(context).authSessionsTitle)),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.screenPadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ChangePasswordForm(
                onChanged: _handlePasswordChanged,
                onSessionExpired: widget.onSessionExpired,
              ),
              const SizedBox(height: AppSpacing.s8),
              const Divider(color: AppColors.borderDefault),
              const SizedBox(height: AppSpacing.s8),
              SessionList(
                key: _sessionListKey,
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
