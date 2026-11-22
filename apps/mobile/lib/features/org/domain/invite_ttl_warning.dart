/// T-003-M09 (D-039) — does the selected role get the "ลิงก์อายุสั้นกว่าปกติ"
/// note on the invite screen?
///
/// Decided ONLY from the server's `RoleRow.inviteTtlHours` — the output of
/// the same `invitationTtlHours(capabilities)` the server uses to set
/// `expiresAt`. Never `key` (a custom role with elevated capabilities has no
/// key, which is exactly QA03 F1), never `grantsOwnership`, and never a
/// hard-coded 24/168: the TTL policy is the server's (AC-10.3), and a number
/// baked in here is right until the policy changes and wrong after.
///
/// "Shorter than usual" is read literally as "shorter than the longest TTL
/// the server published in this same list" — the copy is comparative and
/// carries no number (ux Q14), so the comparison is all the client needs.
/// When nothing in the list is longer (one role, or every role equal) there
/// is no "usual" to be shorter than, and the note stays off: a missed hint,
/// never a false one. The deadline itself is printed later from the link's
/// `expiresAt`.
///
/// Pure Dart (gate rule 1).
library;

import 'entities/org_entities.dart';

bool showsShortLinkWarning(RoleRow? selected, Iterable<RoleRow> roles) {
  final hours = selected?.inviteTtlHours;
  if (hours == null) return false;
  int? longest;
  for (final r in roles) {
    final h = r.inviteTtlHours;
    if (h != null && (longest == null || h > longest)) longest = h;
  }
  return longest != null && hours < longest;
}
