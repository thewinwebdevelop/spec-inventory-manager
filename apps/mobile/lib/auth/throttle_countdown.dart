import 'dart:math';

import '../i18n/auth_th.dart';

/// Pure countdown formatting for `ThrottleBanner` (ux-wireframe §3.2, ui.md
/// §3.3). Kept as a pure function (no timers) so the mm:ss / short-form
/// boundary logic is unit-testable in isolation — [ThrottleCountdownController]
/// supplies the real-time ticking. Mirrors
/// apps/web/src/lib/throttle-countdown.ts exactly.
///
/// D-005: never say "locked"/"suspended" — only the mm:ss / seconds copy.
String pad2(int n) => n.toString().padLeft(2, '0');

/// Formats remaining seconds into the throttle banner copy.
/// >60s -> "mm:ss นาที" (long form); <=60s -> "N วินาที" (short form).
/// Clamped at 0 (never negative).
String formatThrottleMessage(num remainingSeconds) {
  final clamped = max(0, remainingSeconds.ceil());
  if (clamped > 60) {
    final mm = clamped ~/ 60;
    final ss = clamped % 60;
    return AuthTh.throttleBannerLong(pad2(mm), pad2(ss));
  }
  return AuthTh.throttleBannerShort(clamped);
}
