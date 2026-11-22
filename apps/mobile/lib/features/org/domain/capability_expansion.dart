/// T-003-M07 — capability expansion + "what would I lose", pure Dart. An
/// exact port of core-domain `expandCapabilities` (`rbac/expand.ts`) and
/// `lostCapabilities` (`rbac/canonical.ts`), pinned by the SAME golden-vector
/// file (`rbac/fixtures/lost-capabilities.vectors.json`) the server's U-RB-09
/// and web's CW3-01 read (test-plan CM3-01).
///
/// ⛔ Nothing here decides a permission. Mobile uses this only to DESCRIBE a
/// change the person is about to make (ux R3a / R3b); the server decides the
/// write. There is no ⊆ / ⊊ comparison of two sets here (CM3-03).
///
/// ⛔ No registry is bundled: AC-7.1 says the client never hard-codes it. The
/// caller passes the edges — on mobile, the shop's `GET /capabilities`
/// (see `role_change_summary.dart`).
library;

import '../../../core/session/capabilities.dart';

/// One registry entry as far as expansion cares: a key and what it implies
/// (core-domain `RegistryLike`).
class CapabilityEdge {
  const CapabilityEdge({required this.key, this.implies = const []});

  final String key;
  final List<String> implies;
}

/// Code-unit order — deterministic across JS and Dart (core-domain `byKey`).
/// `String.compareTo` compares UTF-16 code units, exactly like JS `<`.
int byKey(String a, String b) => a.compareTo(b);

/// Everything a stored list grants, sorted by key:
///  - `full_access` → every key of [registry];
///  - each key → + its `implies` (closure, idempotent);
///  - unknown keys are KEPT, never dropped (SR-11 fail-closed).
List<String> expandCapabilities(Iterable<String> capabilities, List<CapabilityEdge> registry) {
  final implies = {for (final c in registry) c.key: c.implies};
  final out = <String>{...capabilities};
  if (out.contains(fullAccessCapability)) {
    for (final c in registry) {
      out.add(c.key);
    }
  }
  final queue = [...out];
  while (queue.isNotEmpty) {
    for (final target in implies[queue.removeLast()] ?? const <String>[]) {
      if (out.add(target)) queue.add(target);
    }
  }
  return out.toList()..sort(byKey);
}

/// `expand(before) \ expand(after)`, sorted by key (AC-3.10).
List<String> lostCapabilities(
  Iterable<String> before,
  Iterable<String> after,
  List<CapabilityEdge> registry,
) {
  final kept = expandCapabilities(after, registry).toSet();
  return expandCapabilities(before, registry).where((k) => !kept.contains(k)).toList();
}
