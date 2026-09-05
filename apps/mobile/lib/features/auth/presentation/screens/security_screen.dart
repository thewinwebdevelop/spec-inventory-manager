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
    this.appBarActions = const <Widget>[],
  });

  final VoidCallback onSessionExpired;

  /// ★ B-18/B-16 — actions the SHELL puts in this screen's AppBar.
  ///
  /// It exists for one of them: "ออกจากระบบ". This screen lists the devices a
  /// person is signed in on, and ux-wireframe §4 (F-001, line 176) is explicit
  /// that the CURRENT device deliberately has no button in that list —
  /// "การออกจากเครื่องปัจจุบันใช้ 'ออกจากระบบ' จากเมนูหลัก". Mobile had no main
  /// menu, so that sentence pointed at nothing and the only way out of the app
  /// was "ออกจากระบบทุกอุปกรณ์", which ends every session on every device the
  /// person owns. Exactly the web's B-16, on the other platform.
  ///
  /// Passed IN rather than built here on purpose: signing out needs the auth
  /// repository and a destination, and this screen has stayed free of both
  /// since D-023 PASS 2. F-006 moves the control to its real nav and passes
  /// nothing.
  final List<Widget> appBarActions;

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
          style: TextStyle(color: context.appColors.successText),
        ),
        backgroundColor: context.appColors.successBg,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 5),
      ),
    );
    _sessionListKey.currentState?.load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(AppLocalizations.of(context).authSessionsTitle),
        actions: widget.appBarActions,
      ),
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
              Divider(color: context.appColors.borderDefault),
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
