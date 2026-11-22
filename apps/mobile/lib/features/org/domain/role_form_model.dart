/// T-003-M06 — R3's form model, pure Dart (ux-wireframe R3 + §0.4). The Dart
/// twin of web `role-form-model.ts`; same rules, same tests.
///
/// ⛔ Nothing here decides a permission. The row states are UX guards only:
///  - "ติ๊กล็อก (imply)" comes from the catalog's `implies` edges;
///  - "คุณไม่มีสิทธิ์นี้" asks a `viewerCan(key)` the caller wires to
///    [viewerCanGrant] (the one `full_access` rule + one level of implies).
/// The server decides every write (`ROLE_EXCEEDS_ACTOR`, …); this module never
/// compares two capability SETS (⊆/⊊) — test-plan CW3-03 / CM3-03.
///
/// Selection model: `selection` is the set of rows shown ticked that the user
/// owns — ticking `manage_X` also puts `view_X` in it, so unticking `manage_X`
/// later leaves `view_X` ticked-but-unlocked (ux R3: "ลดเหลือดู" is the common
/// intent). A row is LOCKED while another selected key implies it; locked rows
/// are not sent (api-spec §2 canonical form).
library;

import '../../../core/session/capabilities.dart';
import 'entities/role_entities.dart';

/// The synthetic group for `group` values not in `groups[]` (or `null`) —
/// ux §0.4 fallback. Its label ("อื่น ๆ") is copy, so it lives in l10n.
const String otherGroupKey = '__other__';

const String _upcoming = 'upcoming';

/// AC-3.4 — counted in code points after trimming (core-domain
/// `ROLE_NAME_MAX_LENGTH`).
const int roleNameMaxLength = 50;

class ChecklistRow {
  const ChecklistRow({
    required this.key,
    required this.label,
    required this.description,
    required this.upcoming,
    required this.checked,
    required this.locked,
    required this.disabled,
  });

  final String key;
  final String label;
  final String description;
  final bool upcoming;
  final bool checked;

  /// Ticked because another ticked key implies it — cannot be unticked.
  final bool locked;

  /// The viewer lacks it and it is not ticked (UX guard only).
  final bool disabled;
}

class ChecklistGroup {
  const ChecklistGroup({
    required this.key,
    required this.label,
    required this.rows,
    required this.selectedCount,
  });

  final String key;

  /// The server's `labelTh`; `null` for [otherGroupKey] (presentation prints
  /// the l10n "อื่น ๆ").
  final String? label;
  final List<ChecklistRow> rows;
  final int selectedCount;
}

class ChecklistView {
  const ChecklistView({
    required this.groups,
    required this.selectedCount,
    required this.total,
    required this.hasUpcoming,
  });

  final List<ChecklistGroup> groups;
  final int selectedCount;
  final int total;
  final bool hasUpcoming;
}

Map<String, List<String>> _impliesMap(CapabilityCatalogView catalog) =>
    {for (final i in catalog.items) i.key: i.implies};

/// Keys in [selection] that another selected key implies.
Set<String> _lockedKeys(Set<String> selection, CapabilityCatalogView catalog) {
  final implies = _impliesMap(catalog);
  final out = <String>{};
  for (final k in selection) {
    for (final v in implies[k] ?? const <String>[]) {
      if (v != k) out.add(v);
    }
  }
  return out;
}

ChecklistView buildChecklist(
  CapabilityCatalogView catalog,
  Set<String> selection,
  bool Function(String key) viewerCan,
) {
  final locked = _lockedKeys(selection, catalog);
  final known = {for (final g in catalog.groups) g.key};
  final buckets = <String, List<ChecklistRow>>{};
  var hasUpcoming = false;

  for (final item in catalog.items) {
    if (!item.selectable) continue;
    final isLocked = locked.contains(item.key);
    final checked = selection.contains(item.key) || isLocked;
    final upcoming = item.status == _upcoming;
    hasUpcoming = hasUpcoming || upcoming;
    final groupKey = item.group != null && known.contains(item.group) ? item.group! : otherGroupKey;
    (buckets[groupKey] ??= []).add(ChecklistRow(
      key: item.key,
      label: item.labelTh,
      description: item.descriptionTh,
      upcoming: upcoming,
      checked: checked,
      locked: isLocked,
      disabled: !checked && !viewerCan(item.key),
    ));
  }

  final order = <(String, String?)>[
    for (final g in catalog.groups) (g.key, g.labelTh),
    (otherGroupKey, null),
  ];
  final groups = <ChecklistGroup>[];
  for (final (key, label) in order) {
    final rows = buckets[key];
    if (rows == null || rows.isEmpty) continue;
    groups.add(ChecklistGroup(
      key: key,
      label: label,
      rows: List.unmodifiable(rows),
      selectedCount: rows.where((r) => r.checked).length,
    ));
  }
  final all = groups.expand((g) => g.rows);
  return ChecklistView(
    groups: List.unmodifiable(groups),
    selectedCount: all.where((r) => r.checked).length,
    total: all.length,
    hasUpcoming: hasUpcoming,
  );
}

/// UX guard for "คุณไม่มีสิทธิ์นี้": does the viewer hold [key] — through
/// `full_access`, directly, or because a key they hold implies it?
bool viewerCanGrant(Set<String> viewerCapabilities, String key, CapabilityCatalogView catalog) {
  if (hasCapability(viewerCapabilities, key)) return true;
  final implies = _impliesMap(catalog);
  return viewerCapabilities.any((held) => (implies[held] ?? const <String>[]).contains(key));
}

/// A stored set → the form's selection (implies expanded one level, like the
/// registry) + the keys the catalog does not know, which are not shown as rows
/// but are sent back on save (ux §0.4: "ห้ามทิ้งเงียบ ๆ").
({Set<String> selection, List<String> passthrough}) initialSelection(
  List<String> stored,
  CapabilityCatalogView catalog,
) {
  final inCatalog = {for (final i in catalog.items) i.key};
  final implies = _impliesMap(catalog);
  final selection = <String>{};
  final passthrough = <String>[];
  for (final k in stored) {
    if (!inCatalog.contains(k)) {
      passthrough.add(k);
      continue;
    }
    selection.add(k);
    selection.addAll(implies[k] ?? const <String>[]);
  }
  return (selection: selection, passthrough: passthrough);
}

/// Clone mode: the source's capabilities minus anything not selectable
/// (ux R3 โหมดสำเนา) — unknown keys are not copied either.
Set<String> cloneSelection(List<String> stored, CapabilityCatalogView catalog) {
  final selectable = {for (final i in catalog.items) if (i.selectable) i.key};
  return initialSelection(stored.where(selectable.contains).toList(), catalog).selection;
}

Set<String> toggleCapability(
  Set<String> selection,
  String key,
  bool checked,
  CapabilityCatalogView catalog,
) {
  final next = {...selection};
  if (checked) {
    next.add(key);
    next.addAll(_impliesMap(catalog)[key] ?? const <String>[]);
  } else {
    next.remove(key);
  }
  return next;
}

int _byKey(String a, String b) => a.compareTo(b);

/// core-domain `canonicalizeCapabilities`:
/// `sort_by_key(dedupe(S) \ { v | ∃k ∈ S, k ≠ v, v ∈ implies[k] })`.
/// Unknown keys are kept — rejecting them is the server's job.
List<String> canonicalCapabilities(Iterable<String> capabilities, CapabilityCatalogView catalog) {
  final implies = _impliesMap(catalog);
  final set = capabilities.toSet();
  final implied = <String>{};
  for (final k in set) {
    for (final v in implies[k] ?? const <String>[]) {
      if (v != k) implied.add(v);
    }
  }
  return set.where((k) => !implied.contains(k)).toList()..sort(_byKey);
}

/// What goes on the wire: ticked keys minus locked rows, plus unknown keys,
/// canonical order.
List<String> payloadCapabilities(
  Set<String> selection,
  List<String> passthrough,
  CapabilityCatalogView catalog,
) =>
    canonicalCapabilities([...selection, ...passthrough], catalog);

// ── name ────────────────────────────────────────────────────────────────────

enum RoleNameProblem { empty, tooLong }

/// ux R3: "{n}/50" counts code points after trimming.
int roleNameLength(String value) => value.trim().runes.length;

/// The two checks ux gives the client; everything else is the server's (§E).
RoleNameProblem? validateRoleNameInput(String value) {
  final n = roleNameLength(value);
  if (n == 0) return RoleNameProblem.empty;
  if (n > roleNameMaxLength) return RoleNameProblem.tooLong;
  return null;
}

/// core-domain `roleNameComparisonKey` minus the NFC step: Dart has no
/// normaliser in the SDK and this app takes no dependency for it. The only
/// use is SUGGESTING a clone name — a clash this misses comes back as
/// `409 ROLE_NAME_TAKEN` under the field, which the server decides anyway.
String _comparisonKey(String raw) => raw.trim().replaceAll(RegExp(r'\s+'), ' ').toLowerCase();

String _truncateCodePoints(String value, int max) {
  final runes = value.runes.toList();
  return runes.length <= max ? value : String.fromCharCodes(runes.take(max));
}

/// Clone mode's suggested name: "สำเนาของ {ชื่อต้นแบบ}" cut to ≤ 50 code points;
/// a clash with a live role's name gets " (2)", " (3)" … still within 50.
String cloneName(String sourceDisplayName, List<String> existingNames) {
  final taken = existingNames.map(_comparisonKey).toSet();
  final base = 'สำเนาของ $sourceDisplayName';
  final first = _truncateCodePoints(base, roleNameMaxLength).trim();
  if (!taken.contains(_comparisonKey(first))) return first;
  for (var n = 2;; n++) {
    final suffix = ' ($n)';
    final candidate =
        '${_truncateCodePoints(base, roleNameMaxLength - suffix.runes.length).trimRight()}$suffix';
    if (!taken.contains(_comparisonKey(candidate))) return candidate;
  }
}

// ── request bodies ──────────────────────────────────────────────────────────

bool _sameSet(List<String> a, List<String> b) {
  final sa = a.toSet();
  final sb = b.toSet();
  return sa.length == sb.length && sa.containsAll(sb);
}

/// PATCH body. ⚠️ `name` only when the trimmed value differs from what the
/// field started with — the field shows the TRANSLATION of an un-renamed
/// system role, and sending it back would mark the role renamed (ux R3 ⚠️).
/// `null` = nothing changed, send nothing.
RoleUpdate? buildRoleUpdate({
  required int version,
  required String initialName,
  required String name,
  required List<String> initialCapabilities,
  required List<String> capabilities,
}) {
  final trimmed = name.trim();
  final nameChanged = trimmed != initialName.trim();
  final capsChanged = !_sameSet(initialCapabilities, capabilities);
  if (!nameChanged && !capsChanged) return null;
  return RoleUpdate(
    version: version,
    name: nameChanged ? trimmed : null,
    capabilities: capsChanged ? List.unmodifiable(capabilities) : null,
  );
}
