/// Boundary-gate extension (docs/architecture/refactor-plan.md §4, mobile.md
/// §5.2 new rule 7: "presentation/ ห้าม import core/api/ ตรง ๆ") — domain-
/// layer re-export so `presentation/screens/session_list.dart` can keep
/// doing its `is SessionExpiredException` UI branching (deciding whether to
/// show the skeleton vs navigate away — not a network call, just reading the
/// TYPE of an already-surfaced `AsyncValue.error`) without importing
/// `core/api/` directly. `core/api/refresh_coordinator.dart` (pure Dart, no
/// flutter/dio/omnistock_api_client/riverpod) stays a legal import for a
/// `domain/` file under rule 1 — this file is exactly the kind of thin
/// re-export seam gate rule 7 is meant to push call sites through.
library;

export '../../../core/api/refresh_coordinator.dart' show SessionExpiredException, isSessionExpired;
