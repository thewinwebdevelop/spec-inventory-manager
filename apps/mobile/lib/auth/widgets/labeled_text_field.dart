import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

/// Plain labeled text field (email etc.) — sibling to [PasswordField] so
/// signup/login share the same field chrome (ui.md §2.1 `AuthForm`).
class LabeledTextField extends StatelessWidget {
  const LabeledTextField({
    super.key,
    required this.label,
    required this.controller,
    this.placeholder,
    this.errorText,
    this.enabled = true,
    this.keyboardType,
    this.textInputAction = TextInputAction.next,
    this.onSubmitted,
    this.onEditingComplete,
    this.autofocus = false,
  });

  final String label;
  final TextEditingController controller;
  final String? placeholder;
  final String? errorText;
  final bool enabled;
  final TextInputType? keyboardType;
  final TextInputAction textInputAction;
  final ValueChanged<String>? onSubmitted;
  final VoidCallback? onEditingComplete;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppTypography.labelSm),
        const SizedBox(height: AppSpacing.s2),
        TextField(
          controller: controller,
          enabled: enabled,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          onSubmitted: onSubmitted,
          onEditingComplete: onEditingComplete,
          autofocus: autofocus,
          style: AppTypography.bodyMd,
          decoration: InputDecoration(
            hintText: placeholder,
            errorText: errorText,
          ),
        ),
      ],
    );
  }
}
