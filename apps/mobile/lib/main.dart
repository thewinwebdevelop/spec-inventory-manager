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
//
// ★ B-17 — READS THE SAME KEY ITS OWN INTEGRATION TEST READS.
// `--dart-define=API_BASE_URL=…` is what CI's emulator lane and
// `docs/features/F-002/manual-pass-runbook.md` both pass, and until the
// §12.2 manual pass nobody had noticed that ONLY
// `integration_test/org_flow_test.dart` read it. This file hardcoded
// `localhost`, which inside an emulator (or on a phone) is the DEVICE — so
// every request died with a connection refused that the login screen reports
// as the generic "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง". E-10 stayed green the
// whole time because it builds the provider graph itself from the define and
// never comes through here: the harness and the app were each internally
// consistent and disagreed with each other.
//
// The default stays `localhost` — right for the iOS simulator and for a
// desktop debug run. Android needs `10.0.2.2`, which is why the runbook says
// to pass it.
const _defaultBaseUrl = 'http://localhost:3000';
const _baseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: _defaultBaseUrl);

void main() {
  runApp(
    ProviderScope(
      overrides: buildAppOverrides(baseUrl: _baseUrl),
      child: const OmniStockApp(),
    ),
  );
}
