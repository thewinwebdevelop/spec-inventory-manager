import 'package:flutter/material.dart';

import '../i18n/auth_th.dart';
import '../../app/theme/app_theme.dart';

/// `PasswordField` (ui.md §2.1) — password input + show/hide eye toggle +
/// helper-text slot + inline error slot. Reused for signup, login,
/// change-password (current/new) per ui.md §2.1.1 ("ไม่มี component ใหม่").
///
/// Accessibility (ui.md §6): label bound to the real input (not
/// placeholder-only); the eye toggle carries a semantic label
/// ("แสดงรหัสผ่าน"/"ซ่อนรหัสผ่าน"); tap target >= `size.tap-target.min` (44px).
class PasswordField extends StatefulWidget {
  const PasswordField({
    super.key,
    required this.label,
    required this.controller,
    this.placeholder,
    this.helperText,
    this.errorText,
    this.enabled = true,
    this.autofocus = false,
    this.onSubmitted,
    this.textInputAction = TextInputAction.done,
    this.focusNode,
  });

  final String label;
  final TextEditingController controller;
  final String? placeholder;
  final String? helperText;
  final String? errorText;
  final bool enabled;
  final bool autofocus;
  final ValueChanged<String>? onSubmitted;
  final TextInputAction textInputAction;
  final FocusNode? focusNode;

  @override
  State<PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<PasswordField> {
  bool _obscure = true;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.label, style: AppTypography.labelSm),
        const SizedBox(height: AppSpacing.s2),
        TextField(
          controller: widget.controller,
          focusNode: widget.focusNode,
          obscureText: _obscure,
          enabled: widget.enabled,
          autofocus: widget.autofocus,
          textInputAction: widget.textInputAction,
          onSubmitted: widget.onSubmitted,
          style: AppTypography.bodyMd,
          decoration: InputDecoration(
            hintText: widget.placeholder,
            errorText: widget.errorText,
            suffixIcon: Semantics(
              button: true,
              label: _obscure ? AuthTh.commonPasswordShow : AuthTh.commonPasswordHide,
              child: IconButton(
                constraints: const BoxConstraints(
                  minWidth: AppSizes.tapTargetMin,
                  minHeight: AppSizes.tapTargetMin,
                ),
                icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                onPressed: widget.enabled
                    ? () => setState(() => _obscure = !_obscure)
                    : null,
              ),
            ),
          ),
        ),
        if (widget.helperText != null && widget.errorText == null) ...[
          const SizedBox(height: AppSpacing.s2),
          Text(widget.helperText!, style: AppTypography.bodySm),
        ],
      ],
    );
  }
}
