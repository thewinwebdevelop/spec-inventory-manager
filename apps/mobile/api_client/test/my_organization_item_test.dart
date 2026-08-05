import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

// tests for MyOrganizationItem
void main() {
  final instance = MyOrganizationItemBuilder();
  // TODO add properties to the builder and call build()

  group(MyOrganizationItem, () {
    // OrganizationSummary organization
    test('to test the property `organization`', () async {
      // TODO
    });

    // MyOrganizationMembership membership
    test('to test the property `membership`', () async {
      // TODO
    });

    // Present only on the `active` (full) shape; absent on a revoked row.
    // EntitlementSummary entitlement
    test('to test the property `entitlement`', () async {
      // TODO
    });

  });
}
