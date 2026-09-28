import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// `Disclosure` (design-system.md §9.1, ui.md §2.2) — a collapsible section
/// header. Shared across F-003's mobile capability checklist, channel
/// settings (F-020), and order detail (F-024) — same pattern, so it lives in
/// `core/ui` rather than being rebuilt per feature.
///
/// The whole header is a single button (>= `size.list-row.min-h`, 56px):
/// `icon.chevron-down` (open = 0°, closed = rotated −90°, i.e. pointing
/// right) + title (`type.button.md`) + an optional trailing count
/// (`type.body.sm`, muted). The rotation animates 150ms ease-out, except when
/// `MediaQuery.disableAnimations` is set (`prefers-reduced-motion`
/// equivalent) — then it snaps instantly (ui.md §2.2).
///
/// Content below is indented to match the header's own horizontal padding —
/// not extra-indented under the title text (ui.md §2.2).
class Disclosure extends StatefulWidget {
  const Disclosure({
    super.key,
    required this.title,
    this.countLabel,
    this.initiallyExpanded = true,
    required this.child,
  });

  final String title;

  /// Trailing muted count, e.g. "เลือก 0 จาก 2". Also folded into the
  /// semantics label ("{title}, {countLabel}", ui.md §2.2).
  final String? countLabel;

  final bool initiallyExpanded;
  final Widget child;

  @override
  State<Disclosure> createState() => _DisclosureState();
}

class _DisclosureState extends State<Disclosure> {
  late bool _expanded = widget.initiallyExpanded;

  void _toggle() => setState(() => _expanded = !_expanded);

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final reduceMotion = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    final duration = reduceMotion ? Duration.zero : const Duration(milliseconds: 150);
    final semanticsLabel =
        widget.countLabel != null ? '${widget.title}, ${widget.countLabel}' : widget.title;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          button: true,
          expanded: _expanded,
          label: semanticsLabel,
          child: InkWell(
            onTap: _toggle,
            child: Container(
              constraints: const BoxConstraints(minHeight: AppSizes.listRowMinH),
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.s4,
                vertical: AppSpacing.s3,
              ),
              decoration: BoxDecoration(
                border: Border(bottom: BorderSide(color: colors.borderDefault)),
              ),
              child: Row(
                children: [
                  AnimatedRotation(
                    // open (0 turns) vs. closed (−90°, i.e. −0.25 turn,
                    // pointing right) per ui.md §2.2.
                    turns: _expanded ? 0 : -0.25,
                    duration: duration,
                    curve: Curves.easeOut,
                    child: Icon(Icons.expand_more, size: AppSizes.iconMd, color: colors.text),
                  ),
                  const SizedBox(width: AppSpacing.s2),
                  Expanded(
                    child: Text(
                      widget.title,
                      style: AppTypography.buttonMd.copyWith(color: colors.text),
                    ),
                  ),
                  if (widget.countLabel != null)
                    Text(
                      widget.countLabel!,
                      style: AppTypography.bodySm.copyWith(color: colors.textMuted),
                    ),
                ],
              ),
            ),
          ),
        ),
        if (_expanded)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s4),
            child: widget.child,
          ),
      ],
    );
  }
}
