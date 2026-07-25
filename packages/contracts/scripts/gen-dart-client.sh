#!/usr/bin/env bash
# Generate the Dart contract client (T-000-07). dart-dio emits built_value code
# that REQUIRES `.g.dart` companions from build_runner — openapi-generator alone
# produces a client that does not compile. This runs both steps so the committed
# output is complete (the contracts-drift CI job diffs it).
#
# The client is emitted OUTSIDE apps/mobile/lib on purpose (apps/mobile/api_client):
# a Dart package nested inside another package's lib/ makes the CFE resolve the
# library files and their .g.dart parts at different language versions.
#
# Dart resolution: prefer the repo's FVM-pinned SDK (dev machines); fall back to
# `dart` on PATH (CI, where flutter-action/setup provides it).
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
OUT="$ROOT/apps/mobile/api_client"

cd "$ROOT/packages/contracts"
pnpm exec openapi-generator-cli generate \
  -i openapi/openapi.yaml -g dart-dio -o "$OUT" \
  --additional-properties=pubName=omnistock_api_client,pubAuthor=OmniStock

PINNED="$ROOT/apps/mobile/.fvm/flutter_sdk/bin/dart"
if [ -x "$PINNED" ]; then DART="$PINNED"; else DART="dart"; fi

cd "$OUT"
"$DART" pub get
"$DART" run build_runner build --delete-conflicting-outputs
