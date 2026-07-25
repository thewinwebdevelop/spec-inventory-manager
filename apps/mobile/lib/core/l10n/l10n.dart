/// R4 (docs/architecture/refactor-plan.md §4, mobile.md §3.7) — the single
/// import seam for the generated `AppLocalizations` (gen_l10n, from
/// `lib/l10n/app_th.arb` via `l10n.yaml`; no build_runner). Every file that
/// needs copy imports THIS file, never the generated one directly, so the
/// generated output path (`package:mobile/l10n/gen/app_localizations.dart`
/// — Flutter-tool-managed build output, gitignored, not something this repo
/// owns/commits) stays an implementation detail.
///
/// Import path note (Flutter 3.44.6, was 3.27.3): older Flutter versions
/// auto-registered a synthetic `package:flutter_gen/...` package for this;
/// that stopped happening on this SDK, so `l10n.yaml` now sets
/// `synthetic-package: false` + `output-dir: lib/l10n/gen` and this file
/// imports the generated code via the app's own package name instead. Every
/// OTHER file is unaffected — they only ever imported THIS file.
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

export 'package:mobile/l10n/gen/app_localizations.dart';
export 'package:mobile/l10n/gen/app_localizations_th.dart' show AppLocalizationsTh;

import 'package:mobile/l10n/gen/app_localizations.dart';
import 'package:mobile/l10n/gen/app_localizations_th.dart';

/// Context-free copy lookup for `application/` controllers. Thai-only
/// (matches this batch's ARB scope — see class doc); always returns a fresh
/// instance since [AppLocalizationsTh] carries no state beyond its constant
/// getters, so nothing here needs disposing/caching.
AppLocalizations get l10n => AppLocalizationsTh();
