import 'dart:math';

/// Pure countdown formatting for `ThrottleBanner` (ux-wireframe §3.2, ui.md
/// §3.3). Kept as a pure function (no timers) so the mm:ss / short-form
/// boundary logic is unit-testable in isolation — [ThrottleCountdownController]
/// supplies the real-time ticking. Mirrors
/// apps/web/src/lib/throttle-countdown.ts exactly.
///
/// D-005: never say "locked"/"suspended" — only the mm:ss / seconds copy.
String pad2(int n) => n.toString().padLeft(2, '0');

/// R4 (docs/architecture/refactor-plan.md §4) — `longForm`/`shortForm` are
/// injected rather than read from a copy source directly: this file is
/// `domain/` (pure Dart, gate rule 1 — no flutter/dio/omnistock_api_client/
/// riverpod), and the generated `AppLocalizations` (gen_l10n) transitively
/// imports `dart:ui`, which rule 1 also forbids in `domain/`. The caller
/// (`presentation/widgets/throttle_banner.dart`, which DOES have a
/// `BuildContext`) supplies `AppLocalizations.authThrottleBannerLong`/
/// `authThrottleBannerShort` here — the mm:ss/short-form BOUNDARY MATH stays
/// the pure, unit-testable part; only the copy itself is late-bound.
///
/// Formats remaining seconds into the throttle banner copy.
/// >60s -> longForm(mm, ss) (long form); <=60s -> shortForm(n) (short form).
/// Clamped at 0 (never negative).
String formatThrottleMessage(
  num remainingSeconds, {
  required String Function(String mm, String ss) longForm,
  required String Function(int seconds) shortForm,
}) {
  final clamped = max(0, remainingSeconds.ceil());
  if (clamped > 60) {
    final mm = clamped ~/ 60;
    final ss = clamped % 60;
    return longForm(pad2(mm), pad2(ss));
  }
  return shortForm(clamped);
}
