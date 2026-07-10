import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';
import 'app/bootstrap.dart';

// D-023 (mobile architecture refactor) — main.dart is now thin: it only
// builds the ProviderScope override list (`buildAppOverrides`, `app/
// bootstrap.dart`) and hands off to `OmniStockApp` (`app/app.dart`). All
// navigation/composition logic that used to live here moved to `app/`;
// F-006 (real app shell/router) builds on top of that seam, not this file.
//
// T-001-17 ★ (M-3): `createAuthClient` (via `buildAppOverrides`) requires an
// explicit `baseUrl` (no hardcoded prod default) and rejects a non-https
// base URL outside debug builds. This placeholder shell only ever runs in
// debug (`fvm flutter run`/`flutter test`), so the plain-http local dev
// server is fine here; F-006/devops owns picking the real per-environment
// (staging/prod https) URL.
const _devBaseUrl = 'http://localhost:3000';

void main() {
  runApp(
    ProviderScope(
      overrides: buildAppOverrides(baseUrl: _devBaseUrl),
      child: const OmniStockApp(),
    ),
  );
}
