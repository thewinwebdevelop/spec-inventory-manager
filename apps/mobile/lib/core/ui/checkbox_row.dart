import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_theme.dart';

/// `Checkbox` + `CheckboxRow` (design-system.md §9.1, ui.md §2.1) — the
/// shared "select one item in a list" row: bulk-select, channel settings,
/// filters, and F-003's capability checklist all need this, so it lives in
/// `core/ui` instead of being reinvented per feature.
///
/// `Checkbox` (the 20px box) is never meaningful alone (ui.md §2.1: "ไม่ใช้
/// เดี่ยว ๆ ต้องมี label เสมอ") — this file only exports [CheckboxRow]; the
/// box is the private [_CheckboxBox].
///
/// 4 visual states, no opacity ever used to signal state (ui.md §2.1 ⛔):
/// - empty: `surface` fill, outline-button-formula border (`btnBorder`)
/// - checked: `btnBg` fill, `primary` border, `icon.check` in `btnFg`
/// - locked/disabled + checked: `surfaceMuted` fill, `borderDefault` border,
///   check mark in `textMuted`
/// - disabled + empty: `surfaceMuted` fill, `borderDefault` border, no mark
///
/// The whole row (>= `size.list-row.min-h`, 56px) is the tap target, not the
/// 20px box (ui.md §6 tap-target table). The label never dims when
/// disabled/locked — status is communicated by the box + reason line, so a
/// sighted user can still tell *what* the permission is even when it's
/// unavailable. Disabled rows stay in the focus/semantics tree
/// (`Semantics(enabled: false)`, not excluded) so a screen reader can still
/// reach and read the reason line (ui.md §2.1: "disabled = aria-disabled ...
/// ยังโฟกัสได้").
class CheckboxRow extends StatefulWidget {
  const CheckboxRow({
    super.key,
    required this.label,
    this.description,
    this.badgeLabel,
    this.reason,
    required this.value,
    required this.onChanged,
    this.disabled = false,
  });

  /// Main label (`type.body.md`) — always visible, always full-strength text
  /// colour even when [disabled].
  final String label;

  /// Optional helper line (`type.body.sm`, muted) under the label.
  final String? description;

  /// Optional neutral badge text rendered at the end of the label line (e.g.
  /// "เร็ว ๆ นี้"). Text-only by design (no colour-only signalling).
  final String? badgeLabel;

  /// Optional lock/disabled reason line, rendered with `icon.lock` — read by
  /// assistive tech even when the row is [disabled].
  final String? reason;

  final bool value;

  /// `null` disables interaction the same as [disabled] — callers that don't
  /// yet have a handler should pass `null` rather than a no-op.
  final ValueChanged<bool>? onChanged;

  final bool disabled;

  @override
  State<CheckboxRow> createState() => _CheckboxRowState();
}

class _CheckboxRowState extends State<CheckboxRow> {
  final _focusNode = FocusNode(debugLabel: 'CheckboxRow');
  bool _focused = false;

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  bool get _interactive => !widget.disabled && widget.onChanged != null;

  void _toggle() {
    if (!_interactive) return;
    widget.onChanged!(!widget.value);
  }

  KeyEventResult _handleKey(FocusNode node, KeyEvent event) {
    if (!_interactive) return KeyEventResult.ignored;
    if (event is KeyDownEvent &&
        (event.logicalKey == LogicalKeyboardKey.space ||
            event.logicalKey == LogicalKeyboardKey.enter)) {
      _toggle();
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final semanticsLabel = <String>[
      widget.label,
      if (widget.description != null) widget.description!,
      if (widget.reason != null) widget.reason!,
    ].join(', ');

    return Semantics(
      // aria-disabled equivalent: stays in the tree (not excluded/hidden) so
      // the reason line is still reachable (ui.md §2.1).
      enabled: !widget.disabled,
      checked: widget.value,
      label: semanticsLabel,
      child: Focus(
        focusNode: _focusNode,
        // Focusable regardless of [disabled] — a disabled row must still be
        // reachable to read its reason (ui.md §2.1).
        canRequestFocus: true,
        onFocusChange: (v) => setState(() => _focused = v),
        onKeyEvent: _handleKey,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: _interactive ? _toggle : null,
          child: Container(
            constraints: const BoxConstraints(minHeight: AppSizes.listRowMinH),
            decoration: BoxDecoration(
              // Focus ring lives on the row (CheckboxRow), not the 20px box
              // (ui.md §2.1 table, `focus` row).
              border: _focused
                  ? Border.all(color: colors.primary, width: 2.5)
                  : Border.all(color: Colors.transparent, width: 2.5),
            ),
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.s4,
              vertical: AppSpacing.s3,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Box aligned to the top of the label line, not vertically
                // centred — a 2-line description would otherwise leave the
                // box floating (ui.md §2.1).
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: _CheckboxBox(
                    value: widget.value,
                    disabled: widget.disabled,
                    colors: colors,
                  ),
                ),
                const SizedBox(width: AppSpacing.s3),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              widget.label,
                              style: AppTypography.bodyMd.copyWith(color: colors.text),
                            ),
                          ),
                          if (widget.badgeLabel != null) ...[
                            const SizedBox(width: AppSpacing.s2),
                            _NeutralBadge(label: widget.badgeLabel!, colors: colors),
                          ],
                        ],
                      ),
                      if (widget.description != null) ...[
                        const SizedBox(height: AppSpacing.s1),
                        Text(
                          widget.description!,
                          style: AppTypography.bodySm.copyWith(color: colors.textMuted),
                        ),
                      ],
                      if (widget.reason != null) ...[
                        const SizedBox(height: AppSpacing.s1),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.lock_outline, size: AppSizes.iconSm, color: colors.textMuted),
                            const SizedBox(width: AppSpacing.s1),
                            Expanded(
                              child: Text(
                                widget.reason!,
                                style: AppTypography.bodySm.copyWith(color: colors.textMuted),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The 20px box only — never rendered outside [CheckboxRow].
class _CheckboxBox extends StatelessWidget {
  const _CheckboxBox({required this.value, required this.disabled, required this.colors});

  final bool value;
  final bool disabled;
  final AppColorsX colors;

  @override
  Widget build(BuildContext context) {
    final Color bg;
    final Color border;
    final Color? checkColor;
    if (disabled) {
      bg = colors.surfaceMuted;
      border = colors.borderDefault;
      checkColor = value ? colors.textMuted : null;
    } else if (value) {
      bg = colors.btnBg;
      border = colors.primary;
      checkColor = colors.btnFg;
    } else {
      bg = colors.surface;
      border = colors.btnBorder; // same outline formula as outline buttons
      checkColor = null;
    }

    return Container(
      width: AppSizes.checkbox,
      height: AppSizes.checkbox,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadius.checkbox),
        border: Border.all(color: border, width: AppSizes.checkboxBorderWidth),
      ),
      child: checkColor != null
          ? Icon(Icons.check, size: 14, color: checkColor)
          : null,
    );
  }
}

/// Text-only neutral badge (e.g. "เร็ว ๆ นี้") inline in a [CheckboxRow].
/// Not the shared `Badge` component (that's a separate reuse item per ui.md
/// §1) — kept private/local to this row until a second consumer needs it as
/// a standalone widget.
class _NeutralBadge extends StatelessWidget {
  const _NeutralBadge({required this.label, required this.colors});

  final String label;
  final AppColorsX colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s2, vertical: 2),
      decoration: BoxDecoration(
        color: colors.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadius.badge),
      ),
      child: Text(
        label,
        style: AppTypography.bodySm.copyWith(color: colors.textMuted, fontWeight: FontWeight.w600),
      ),
    );
  }
}
