# apps/mobile

Flutter placeholder shell (T-000-09). `package.json` here is a **Turborepo
adapter shim only** (per
[docs/features/F-000/infra.md](../../docs/features/F-000/infra.md) §6/§7) —
mobile's real package manager is `pub`, not `pnpm`. The shim lets
`turbo build`/`lint`/`test` see this workspace in the graph without silently
skipping it (AC2); the scripts shell out to `flutter` via `scripts/flutter.sh`
(prefers `fvm flutter` when an fvm pin exists locally, else plain `flutter` on
PATH — matching CI's `subosito/flutter-action`).

Flutter SDK version is pinned in `.flutter-version` (consumed by
`subosito/flutter-action` in CI). This dev machine's global `flutter` resolves
to an older 2.10.5 install, so `apps/mobile/.fvm/fvm_config.json` pins a
per-project Flutter 3.27.3 (closest cached fvm version to `.flutter-version`'s
3.27.1) — see the T-000-09 build report for the full rationale.

`lib/main.dart` is a minimal placeholder screen that imports
`omnistock_api_client` (the generated Dart client under
`lib/generated/api/`, from `packages/contracts`/T-000-07) at the type level,
so the wiring is real and `flutter analyze` covers it (generated code itself
is excluded from analysis per `analysis_options.yaml`, F-000 scope —
analyzer-green over the generated client lands in F-006, D-004).

**Known gap (escalated to backend-api):** the committed generated Dart client
is missing its `built_value` companion `*.g.dart` files (never
`build_runner`-generated as part of T-000-07's `gen:contracts:dart` script),
so any real compile of code that imports it — `flutter build`/`flutter
test` — fails today, even though `flutter analyze` (which excludes the
generated path) is clean. See the T-000-09 build report.
