import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

// tests for OrgMyMembership
void main() {
  final instance = OrgMyMembershipBuilder();
  // TODO add properties to the builder and call build()

  group(OrgMyMembership, () {
    // String roleId
    test('to test the property `roleId`', () async {
      // TODO
    });

    // String roleName
    test('to test the property `roleName`', () async {
      // TODO
    });

    // `owner|admin|staff` for a system role, `null` for an F-003 custom one. Open set — an unknown value MUST fall back to showing `roleName`. ⛔ Never use it to decide permissions; use `capabilities`. 
    // String roleKey
    test('to test the property `roleKey`', () async {
      // TODO
    });

    // What the client may OFFER. Not enforcement — the server refuses the call regardless (architecture §3.1). 
    // BuiltList<String> capabilities
    test('to test the property `capabilities`', () async {
      // TODO
    });

    // Always `active` here — a non-member cannot reach this endpoint.
    // String status
    test('to test the property `status`', () async {
      // TODO
    });

  });
}
