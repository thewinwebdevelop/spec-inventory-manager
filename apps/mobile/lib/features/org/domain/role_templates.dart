/// T-003-M05 — R2 "เลือกบทบาทต้นแบบ": which templates are offered and which one
/// starts selected (ux-wireframe R2). Pure Dart.
///
/// ⛔ Nothing here decides a permission. Whether a role can be cloned is
/// `canClone` from the server; this file never compares capability sets and
/// never reads a role key. `capabilities.length` is used for the one thing the
/// spec asks for: the safest DEFAULT (fewest permissions) among roles the
/// server already said are cloneable.
library;

import 'entities/role_entities.dart';

/// The "start from empty" choice. Not a role id by construction.
const String blankTemplateId = '__blank__';

/// AC-3.2: `canClone.reason = owner_role` ⇒ not offered at all.
bool isOfferedAsTemplate(RoleDetailView role) => role.canClone.reason != 'owner_role';

List<RoleDetailView> offeredTemplates(List<RoleDetailView> roles) =>
    roles.where(isOfferedAsTemplate).toList(growable: false);

/// Cloneable role with the fewest capabilities (ties: first in server order);
/// none ⇒ [blankTemplateId].
String defaultTemplateId(List<RoleDetailView> roles) {
  RoleDetailView? best;
  for (final role in roles) {
    if (!isOfferedAsTemplate(role) || !role.canClone.allowed) continue;
    if (best == null || role.capabilities.length < best.capabilities.length) best = role;
  }
  return best?.id ?? blankTemplateId;
}

/// R2's "{n} สิทธิ์: {ป้าย 3 ตัวแรก}{…}" parts: catalog order, selectable
/// entries only, labels from the catalog. A key the catalog does not know is
/// counted in [count] but has no label — a raw key is never printed.
class TemplateCapabilitySummary {
  const TemplateCapabilitySummary({
    required this.count,
    required this.labels,
    required this.truncated,
  });

  final int count;
  final List<String> labels;
  final bool truncated;
}

const int templateLabelsShown = 3;

TemplateCapabilitySummary summarizeCapabilities(
  RoleDetailView role,
  CapabilityCatalogView catalog,
) {
  final held = role.capabilities.toSet();
  final labels = catalog.items
      .where((e) => e.selectable && held.contains(e.key))
      .map((e) => e.labelTh)
      .toList(growable: false);
  return TemplateCapabilitySummary(
    count: role.capabilities.length,
    labels: labels.take(templateLabelsShown).toList(growable: false),
    truncated: role.capabilities.length > templateLabelsShown,
  );
}
