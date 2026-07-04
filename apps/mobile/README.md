# apps/mobile

Placeholder directory (T-000-01 · monorepo skeleton).

This is a Flutter/Dart app, not a Node package — `package.json` here is a
**Turborepo adapter shim only** (per
[docs/features/F-000/infra.md](../../docs/features/F-000/infra.md) §6/§7), so
`turbo build`/`lint`/`test` can see this workspace in the graph without
silently skipping it (AC2).

The real Flutter app (`pubspec.yaml`, `lib/`, `test/`, `analysis_options.yaml`,
consuming the generated Dart client from `packages/contracts`) is scaffolded
in **T-000-09**. Flutter SDK version is pinned in `.flutter-version`
(consumed by `subosito/flutter-action` in CI, and documented in this app's
`CLAUDE.md` once T-000-12 writes it).
