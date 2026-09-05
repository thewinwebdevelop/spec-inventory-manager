import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

// tests for OrgProfile
void main() {
  final instance = OrgProfileBuilder();
  // TODO add properties to the builder and call build()

  group(OrgProfile, () {
    // String id
    test('to test the property `id`', () async {
      // TODO
    });

    // String name
    test('to test the property `name`', () async {
      // TODO
    });

    // String logo
    test('to test the property `logo`', () async {
      // TODO
    });

    // String timezone
    test('to test the property `timezone`', () async {
      // TODO
    });

    // Fixed `THB` in Phase 0 (D-013). Never accepted from a client.
    // String currency
    test('to test the property `currency`', () async {
      // TODO
    });

    // `null` when the shop has declared nothing — at EVERY permission tier, so \"not declared\" is not a permission signal either. 
    // TaxProfileView taxProfile
    test('to test the property `taxProfile`', () async {
      // TODO
    });

    // Derived (entity type + tax id + VAT flag all present). Visible to every member. F-002 only reports it; F-007 is what gates features on it. 
    // bool taxProfileComplete
    test('to test the property `taxProfileComplete`', () async {
      // TODO
    });

    // `null` only if the shop somehow has no entitlement row.
    // EntitlementSummary entitlement
    test('to test the property `entitlement`', () async {
      // TODO
    });

    // OrgMyMembership myMembership
    test('to test the property `myMembership`', () async {
      // TODO
    });

    // OrgCounts counts
    test('to test the property `counts`', () async {
      // TODO
    });

  });
}
