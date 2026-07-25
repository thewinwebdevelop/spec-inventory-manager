#!/usr/bin/env bash
# Turborepo → Flutter adapter (T-000-09). See docs/features/F-000/infra.md §6/§7.
#
# Prefers `fvm flutter` when this project has an fvm pin (.fvm/fvm_config.json
# — used on dev machines where the globally-installed `flutter` doesn't match
# apps/mobile/.flutter-version). Falls back to plain `flutter` on PATH, which
# is what CI uses (subosito/flutter-action, pinned via .flutter-version, no
# fvm involved).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ -d ".fvm" ] && command -v fvm >/dev/null 2>&1; then
  exec fvm flutter "$@"
fi

exec flutter "$@"
