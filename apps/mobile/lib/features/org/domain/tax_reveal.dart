/// ★ M-07 — the reveal button's state machine, and the tax card's tiers.
///
/// Mirrors web's `features/org/tax-reveal.ts` + `tax-card.ts` rather than
/// inventing a second set of rules: ux-wireframe §5 is one specification and
/// two platforms implementing it differently is how they drift. Pure Dart, no
/// Flutter, so `domain/` purity holds and the rules are testable without a
/// widget.
///
/// The state shape is the safeguard, exactly as on web: only [RevealShown] has
/// a field able to hold the number. "Hidden" therefore cannot mean "still in a
/// variable, just not painted" — hiding replaces the state with one that has
/// nowhere to keep it.
///
/// ── What is DIFFERENT on a phone ─────────────────────────────────────────
/// One extra rule with no web equivalent: [droppedOnBackground]. A phone gets
/// put down, handed over, and photographed by the OS itself for the app
/// switcher. So leaving the screen or backgrounding the app discards the
/// number — the person asks again when they come back, which costs one more
/// audited reveal and is the correct price.
library;

import '../../../core/session/session_state.dart';

const String manageOrgSettingsCapability = 'manage_org_settings';

sealed class RevealState {
  const RevealState();
}

/// Nothing has been asked for. No field to hold a number.
class RevealHidden extends RevealState {
  const RevealHidden();
}

/// A request is in flight; the button is disabled and says so.
class RevealLoading extends RevealState {
  const RevealLoading();
}

/// The ONLY variant that can hold the number.
class RevealShown extends RevealState {
  const RevealShown({required this.taxId, required this.revealedAt});

  final String taxId;
  final DateTime revealedAt;
}

/// The last attempt failed. Any previously shown number is gone with the state
/// that held it.
class RevealError extends RevealState {
  const RevealError(this.message);

  final String? message;
}

/// Does pressing the button now fire a request?
///
/// `shown` → no: the press is a HIDE. `loading` → no: one request at a time,
/// because each one is rate-limited and audited.
bool pressRequestsReveal(RevealState state) =>
    state is! RevealShown && state is! RevealLoading;

/// The number to paint, or `null` for "paint the masked value instead".
String? visibleTaxId(RevealState state) => state is RevealShown ? state.taxId : null;

/// ── the card's tiers (§5, mirroring `tax-card.ts`) ────────────────────────

sealed class TaxCardView {
  const TaxCardView();
}

/// No declaration yet. `canEdit` decides whether the reader is told they can
/// fix that — and on mobile, where the form does not exist, whether they are
/// pointed at the web app instead.
class TaxCardUndeclared extends TaxCardView {
  const TaxCardUndeclared({required this.canEdit});

  final bool canEdit;
}

/// Declared, and the reader may NOT see the details — not even the masked
/// number (ux Q13 / AC-7.4: "ไม่แสดงตัวเลขใด ๆ แม้แต่ 4 ตัวท้าย").
class TaxCardSummary extends TaxCardView {
  const TaxCardSummary({required this.vatRegistered});

  final bool? vatRegistered;
}

/// Declared, and the reader may see the masked number and ask for the whole one.
class TaxCardDetails extends TaxCardView {
  const TaxCardDetails({
    required this.entityType,
    required this.taxIdMasked,
    required this.vatRegistered,
    required this.branchCode,
  });

  final String? entityType;
  final String? taxIdMasked;
  final bool? vatRegistered;
  final String? branchCode;
}

/// What the card shows, given the profile and what this member may do.
///
/// `complete` — the server's `taxProfileComplete` — decides whether anything is
/// declared, NOT the presence of the view object or of a field inside it: a
/// member without the capability still receives a `taxProfile` carrying only
/// `vatRegistered`, and reading that as "not declared" would tell every staff
/// member their shop has no tax identity.
TaxCardView taxCardView({
  required bool complete,
  required Set<String> capabilities,
  String? entityType,
  String? taxIdMasked,
  bool? vatRegistered,
  String? branchCode,
}) {
  // ★ `full_access` is a wildcard — the same rule as `ActiveOrg.can`, and the
  // bug that cost the Owner their own menus on both platforms.
  final canEdit = capabilities.contains(fullAccessCapability) ||
      capabilities.contains(manageOrgSettingsCapability);

  if (!complete) return TaxCardUndeclared(canEdit: canEdit);
  if (!canEdit) return TaxCardSummary(vatRegistered: vatRegistered);

  return TaxCardDetails(
    entityType: entityType,
    // Dropped here even if the server sent them, so a shape change on the wire
    // cannot leak digits into a tier that must not have them.
    taxIdMasked: taxIdMasked,
    vatRegistered: vatRegistered,
    branchCode: branchCode,
  );
}
