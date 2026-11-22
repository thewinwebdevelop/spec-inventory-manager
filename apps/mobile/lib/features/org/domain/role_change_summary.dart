/// T-003-M07 — what R3a (confirm before save) and R3b (409 ROLE_CHANGED) say
/// about a capability change. Pure Dart; the twin of web
/// `role-change-summary.ts`.
///
/// ⛔ Nothing here decides a permission. "removed" is [lostCapabilities] (the
/// rule the golden vectors pin), "added" is the same rule the other way round;
/// this only DESCRIBES a change, the server decides the write.
///
/// Display rules (UX01 · ux §0.4):
///  - `full_access` in a list → ONE line (its catalog label); the expansion it
///    brought is neither listed nor counted.
///  - a key the shop's catalog hides (tier `full`) is not shown and NOT
///    counted. Mobile bundles no registry (AC-7.1), so this holds by
///    construction: expansion runs over the shop's catalog only, so
///    `full_access` never expands into a hidden key; and a hidden key that is
///    STORED on the role goes back unchanged in the PATCH (ux §0.4
///    passthrough), so it is on both sides and never in a diff.
///  - any other key the catalog does not list (really unknown) counts towards
///    "และสิทธิ์อื่นอีก {n} รายการ…" — never dropped silently.
library;

import '../../../core/session/capabilities.dart';
import 'capability_expansion.dart';
import 'entities/role_entities.dart';
import 'role_form_model.dart';

/// The edges a comparison expands against: the shop's catalog — the server's
/// current `implies`, and exactly the keys this shop can see.
List<CapabilityEdge> comparisonRegistry(CapabilityCatalogView catalog) => [
      for (final i in catalog.items) CapabilityEdge(key: i.key, implies: i.implies),
    ];

class CapabilityChange {
  const CapabilityChange({required this.added, required this.removed});

  /// In `after`'s expansion, not in `before`'s — sorted by key.
  final List<String> added;

  /// In `before`'s expansion, not in `after`'s (= [lostCapabilities]).
  final List<String> removed;
}

CapabilityChange capabilityChange(
  Iterable<String> before,
  Iterable<String> after,
  List<CapabilityEdge> registry,
) =>
    CapabilityChange(
      added: lostCapabilities(after, before, registry),
      removed: lostCapabilities(before, after, registry),
    );

class CapabilityLines {
  const CapabilityLines({required this.labels, required this.otherCount});

  static const empty = CapabilityLines(labels: [], otherCount: 0);

  /// Thai labels from the catalog (server text, D-037), in catalog order.
  final List<String> labels;

  /// Keys that cannot be shown by name ("และสิทธิ์อื่นอีก {n} รายการ…").
  final int otherCount;

  bool get isEmpty => labels.isEmpty && otherCount == 0;
}

CapabilityLines capabilityLines(Iterable<String> keys, CapabilityCatalogView catalog) {
  final set = keys.toSet();
  if (set.isEmpty) return CapabilityLines.empty;
  if (set.contains(fullAccessCapability)) {
    final label = catalog.items.where((i) => i.key == fullAccessCapability).firstOrNull?.labelTh;
    return label != null
        ? CapabilityLines(labels: [label], otherCount: 0)
        : const CapabilityLines(labels: [], otherCount: 1);
  }
  final inCatalog = {for (final i in catalog.items) i.key};
  return CapabilityLines(
    labels: [for (final i in catalog.items) if (set.contains(i.key)) i.labelTh],
    otherCount: set.where((k) => !inCatalog.contains(k)).length,
  );
}

// ── R3a ─────────────────────────────────────────────────────────────────────

class SelfLoss {
  const SelfLoss({required this.lines, required this.losesManageRoles});

  final CapabilityLines lines;
  final bool losesManageRoles;
}

class SaveConfirmation {
  const SaveConfirmation({
    required this.roleName,
    required this.added,
    required this.removed,
    required this.usage,
    required this.selfLoss,
  });

  final String roleName;
  final CapabilityLines added;
  final CapabilityLines removed;

  /// The server's `RoleDetail.usage` — AC-3.11: N is never counted here.
  final RoleUsage usage;

  /// Only for the viewer's OWN role, and only when something is lost (AC-3.10).
  final SelfLoss? selfLoss;
}

SaveConfirmation buildSaveConfirmation({
  required String roleName,
  required List<String> before,
  required List<String> after,
  required CapabilityCatalogView catalog,
  required RoleUsage usage,
  required bool isMine,
}) {
  final change = capabilityChange(before, after, comparisonRegistry(catalog));
  final removed = capabilityLines(change.removed, catalog);
  return SaveConfirmation(
    roleName: roleName,
    added: capabilityLines(change.added, catalog),
    removed: removed,
    usage: usage,
    selfLoss: isMine && change.removed.isNotEmpty
        ? SelfLoss(lines: removed, losesManageRoles: change.removed.contains(manageRolesCapability))
        : null,
  );
}

// ── R3b ─────────────────────────────────────────────────────────────────────

typedef RoleDraft = ({String name, List<String> capabilities});

class DraftDiff {
  const DraftDiff({
    required this.name,
    required this.added,
    required this.removed,
    required this.addedKeys,
    required this.removedKeys,
  });

  final ({String from, String to})? name;
  final CapabilityLines added;
  final CapabilityLines removed;
  final List<String> addedKeys;
  final List<String> removedKeys;

  bool get isEmpty => name == null && addedKeys.isEmpty && removedKeys.isEmpty;
}

/// The person's own edits: the version they STARTED from → what they had in
/// the form.
DraftDiff draftDiff(RoleDraft start, RoleDraft draft, CapabilityCatalogView catalog) {
  final from = start.name.trim();
  final to = draft.name.trim();
  final change = capabilityChange(start.capabilities, draft.capabilities, comparisonRegistry(catalog));
  return DraftDiff(
    name: from != to ? (from: from, to: to) : null,
    added: capabilityLines(change.added, catalog),
    removed: capabilityLines(change.removed, catalog),
    addedKeys: change.added,
    removedKeys: change.removed,
  );
}

/// "ใส่การแก้ของฉันกลับเข้าไป" — [diff] laid over the LATEST version. Fills the
/// form only; the caller never submits (SR-14). An addition the viewer cannot
/// grant now ([viewerCan] = the checklist row's UX guard) is skipped and
/// reported; a non-selectable / unknown key is never ticked.
({String name, Set<String> selection, bool skipped}) reapplyDraft({
  required String latestName,
  required Set<String> latestSelection,
  required DraftDiff diff,
  required CapabilityCatalogView catalog,
  required bool Function(String key) viewerCan,
}) {
  final selectable = {for (final i in catalog.items) if (i.selectable) i.key};
  var selection = {...latestSelection}..removeAll(diff.removedKeys);
  var skipped = false;
  for (final k in diff.addedKeys) {
    if (!selectable.contains(k)) continue;
    if (!viewerCan(k)) {
      skipped = true;
      continue;
    }
    selection = toggleCapability(selection, k, true, catalog);
  }
  return (name: diff.name?.to ?? latestName, selection: selection, skipped: skipped);
}
