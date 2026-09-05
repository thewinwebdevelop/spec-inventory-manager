// ★ M-07 — the reveal state machine and the card's tiers, as pure rules.
//
// The state SHAPE is the safeguard: only `RevealShown` has a field that can
// hold the number, so "hidden" cannot quietly mean "still in a variable". The
// cases below check that property directly, because a future refactor to
// something like `{ visible: bool, taxId: String }` would keep every screen
// looking identical and keep somebody's national ID in memory after they
// pressed ซ่อนเลข.
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/org/domain/tax_reveal.dart';

void main() {
  final shown = RevealShown(taxId: '0105560123454', revealedAt: DateTime(2026, 8, 19));

  group('the press', () {
    test('★ asks for a number only when one is not already on screen', () {
      expect(pressRequestsReveal(const RevealHidden()), isTrue);
      expect(pressRequestsReveal(const RevealError(null)), isTrue);
      // Showing → the press is a HIDE, not a second request.
      expect(pressRequestsReveal(shown), isFalse);
      // In flight → one request at a time: each is rate-limited AND audited,
      // so a double tap must not spend two of the user's twenty per hour.
      expect(pressRequestsReveal(const RevealLoading()), isFalse);
    });

    test('★ only the shown state can produce a number', () {
      expect(visibleTaxId(shown), '0105560123454');
      for (final state in <RevealState>[
        const RevealHidden(),
        const RevealLoading(),
        const RevealError('x'),
      ]) {
        expect(visibleTaxId(state), isNull, reason: '$state must not carry a number');
      }
    });
  });

  group('taxCardView — the tiers of §5', () {
    test('undeclared, and whether the reader is told they could fix it', () {
      final owner = taxCardView(complete: false, capabilities: {'full_access'});
      expect(owner, isA<TaxCardUndeclared>());
      expect((owner as TaxCardUndeclared).canEdit, isTrue);

      final staff = taxCardView(complete: false, capabilities: {'view_products'});
      expect((staff as TaxCardUndeclared).canEdit, isFalse);
    });

    test('★ a member without the capability gets NO digits — not even four', () {
      // AC-7.4 / ux Q13. The masked value is passed in on purpose: the rule is
      // that the tier drops it, not that the caller remembered not to fetch it.
      final view = taxCardView(
        complete: true,
        capabilities: {'view_products'},
        taxIdMasked: '•••••••••3454',
        vatRegistered: true,
      );

      expect(view, isA<TaxCardSummary>());
      // The summary type has no field able to hold a number at all.
      expect((view as TaxCardSummary).vatRegistered, isTrue);
    });

    test('★ an Owner holding only full_access sees the details tier', () {
      // The wildcard again — the bug that cost the Owner their own menus on
      // both platforms. A system Owner's role carries `full_access` and
      // nothing else, so a plain `contains('manage_org_settings')` would send
      // the shop's owner to the read-only tier.
      final view = taxCardView(
        complete: true,
        capabilities: {'full_access'},
        taxIdMasked: '•••••••••3454',
        entityType: 'personal',
      );

      expect(view, isA<TaxCardDetails>());
      expect((view as TaxCardDetails).taxIdMasked, '•••••••••3454');
    });

    test('an explicit manage_org_settings also reaches the details tier', () {
      final view = taxCardView(
        complete: true,
        capabilities: {'manage_org_settings'},
        taxIdMasked: '•••••••••3454',
      );
      expect(view, isA<TaxCardDetails>());
    });

    test('★ `complete` decides, not the presence of a field', () {
      // A member without the capability still receives a taxProfile carrying
      // only `vatRegistered`. Reading that as "nothing declared" would tell
      // every staff member their shop has no tax identity.
      final view = taxCardView(
        complete: true,
        capabilities: {'view_products'},
        vatRegistered: false,
      );
      expect(view, isA<TaxCardSummary>(), reason: 'declared, but not for this reader');
    });
  });
}
