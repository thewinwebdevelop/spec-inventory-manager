import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Skeleton shimmer (design-system.md §2: "loading: Skeleton shimmer ...
/// ไม่ใช่ spinner"). A highlight band **sweeps across** each placeholder
/// (`shimmerHi` over `surfaceMuted`) — visibly animated, unlike a faint opacity
/// pulse — and the skeleton mirrors the real layout of the screen it stands in
/// (here: the session-list rows, ux-wireframe §4).
class SessionListSkeleton extends StatefulWidget {
  const SessionListSkeleton({super.key, this.rowCount = 3});

  final int rowCount;

  @override
  State<SessionListSkeleton> createState() => _SessionListSkeletonState();
}

class _SessionListSkeletonState extends State<SessionListSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))
      ..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  // Widths (as row fractions) per skeleton line — varied so the rows don't look
  // mechanically identical.
  static const _rowWidths = <List<double>>[
    [0.55, 0.34],
    [0.72, 0.42],
    [0.46, 0.38],
  ];

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final colors = context.appColors;
        return Column(
          children: List.generate(widget.rowCount, (i) {
            final w = _rowWidths[i % _rowWidths.length];
            return Padding(
              padding: EdgeInsets.only(bottom: i == widget.rowCount - 1 ? 0 : AppSpacing.s3),
              child: _SkeletonRow(colors: colors, t: _controller.value, w1: w[0], w2: w[1]),
            );
          }),
        );
      },
    );
  }
}

/// One session-list-shaped skeleton row: leading circle + two text lines.
class _SkeletonRow extends StatelessWidget {
  const _SkeletonRow({required this.colors, required this.t, required this.w1, required this.w2});

  final AppColorsX colors;
  final double t;
  final double w1;
  final double w2;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.s4),
      decoration: BoxDecoration(
        border: Border.all(color: colors.borderDefault),
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
      child: Row(
        children: [
          _ShimmerBox(colors: colors, t: t, width: 40, height: 40, circle: true),
          const SizedBox(width: AppSpacing.s3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: w1,
                  child: _ShimmerBox(colors: colors, t: t, height: 12),
                ),
                const SizedBox(height: AppSpacing.s2),
                FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: w2,
                  child: _ShimmerBox(colors: colors, t: t, height: 10),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A single shimmering placeholder — a `surfaceMuted` block with a `shimmerHi`
/// band that slides left→right as [t] (0..1) advances.
class _ShimmerBox extends StatelessWidget {
  const _ShimmerBox({
    required this.colors,
    required this.t,
    this.width,
    required this.height,
    this.circle = false,
  });

  final AppColorsX colors;
  final double t;
  final double? width;
  final double height;
  final bool circle;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        shape: circle ? BoxShape.circle : BoxShape.rectangle,
        borderRadius: circle ? null : BorderRadius.circular(6),
        gradient: LinearGradient(
          colors: [colors.surfaceMuted, colors.shimmerHi, colors.surfaceMuted],
          stops: const [0.35, 0.5, 0.65],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          transform: _SlideGradient(t * 2 - 1),
        ),
      ),
    );
  }
}

/// Slides a gradient horizontally by [slide] × the box width (-1..1), so the
/// highlight band sweeps across.
class _SlideGradient extends GradientTransform {
  const _SlideGradient(this.slide);

  final double slide;

  @override
  Matrix4? transform(Rect bounds, {TextDirection? textDirection}) =>
      Matrix4.translationValues(bounds.width * slide, 0, 0);
}
