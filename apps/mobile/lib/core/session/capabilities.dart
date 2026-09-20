/// The capability rule, with no Flutter in it.
///
/// Split out of `session_state.dart` after the M-07 security review: that file
/// imports `package:flutter/foundation.dart` for `@immutable`, so anything
/// importing it — including `features/org/domain/tax_reveal.dart`, which is
/// documented as pure Dart — pulled Flutter in transitively. The boundary gate
/// only inspects DIRECT imports and could not see it.
///
/// Splitting rather than duplicating: the tripwire that rejected a second copy
/// of this rule was right, and a second copy is still the wrong answer.
library;

/// The capability that IS ownership (D-028/C-1), and a WILDCARD for every
/// other capability.
const String fullAccessCapability = 'full_access';

/// The other capability F-002's screens ask about. It lived in
/// `features/org/domain/tax_reveal.dart` — a per-feature copy of a name the
/// server owns, which is the same shape as the wildcard bug even when the
/// value is right. Names live with the rule.
const String manageOrgSettingsCapability = 'manage_org_settings';

/// F-001 defines this one; it is here for the same reason.
const String manageMembersCapability = 'manage_members';

/// ★ The rule, in one place: `full_access` answers every question.
///
/// A system Owner's role carries `full_access` and nothing else, so a plain
/// `contains(required)` answers "no" for the person who may do anything — the
/// bug that cost the Owner their own menus on both platforms (B-1).
bool hasCapability(Set<String> capabilities, String required) =>
    capabilities.contains(fullAccessCapability) || capabilities.contains(required);
