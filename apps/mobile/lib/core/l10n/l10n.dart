/// R4 (docs/architecture/refactor-plan.md §4, mobile.md §3.7) — the single
/// import seam for the generated `AppLocalizations` (gen_l10n, from
/// `lib/l10n/app_th.arb` via `l10n.yaml`; no build_runner). Every file that
/// needs copy imports THIS file, never the generated one directly, so the
/// generated package path (`package:flutter_gen/gen_l10n/app_localizations.dart`
/// — a Flutter-tool-managed synthetic package, not something this repo
/// owns/commits) stays an implementation detail.
///
/// Two ways to reach copy, matching where `BuildContext` is/isn't available:
/// - `presentation/` (has a `BuildContext`): `AppLocalizations.of(context)`
///   (re-exported below) — reacts to locale changes automatically once a
///   real locale switcher exists (F-006/settings, mobile.md §3.7).
/// - `application/` controllers (Riverpod `Notifier`s — no `BuildContext`):
///   the [l10n] top-level getter. Thai-only for now (no locale plumbing
///   threaded into controllers yet — that is F-006/settings scope, not this
///   hardening batch); this getter is the seam that work will replace with a
///   locale-aware lookup without changing any call site's shape.
library;

export 'package:flutter_gen/gen_l10n/app_localizations.dart';
export 'package:flutter_gen/gen_l10n/app_localizations_th.dart' show AppLocalizationsTh;

import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_gen/gen_l10n/app_localizations_th.dart';

/// Context-free copy lookup for `application/` controllers. Thai-only
/// (matches this batch's ARB scope — see class doc); always returns a fresh
/// instance since [AppLocalizationsTh] carries no state beyond its constant
/// getters, so nothing here needs disposing/caching.
AppLocalizations get l10n => AppLocalizationsTh();
