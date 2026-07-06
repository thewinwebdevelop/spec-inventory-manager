import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';

/// Skeleton shimmer (design-system.md §2: "loading: Skeleton shimmer ...
/// ไม่ใช่ spinner"). Used for the session list loading state
/// (ux-wireframe §4).
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
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))
      ..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        widget.rowCount,
        (i) => Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.s3),
          child: FadeTransition(
            opacity: _controller.drive(Tween(begin: 0.4, end: 1.0)),
            child: Container(
              height: 64,
              decoration: BoxDecoration(
                color: AppColors.surfaceMuted,
                borderRadius: BorderRadius.circular(AppRadius.card),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
