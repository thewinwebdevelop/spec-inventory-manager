import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

// tests for RoleRow
void main() {
  final instance = RoleRowBuilder();
  // TODO add properties to the builder and call build()

  group(RoleRow, () {
    // String id
    test('to test the property `id`', () async {
      // TODO
    });

    // Display name. F-003 lets people rename roles, so do NOT map this to Thai copy — use `key`, and fall back to this string. 
    // String name
    test('to test the property `name`', () async {
      // TODO
    });

    // Stable slug for TRANSLATION ONLY (ux Q4). Guaranteed `owner`, `admin` or `staff` for the three system roles — those values are part of the contract and changing one is a breaking change. `null` for any role F-003 lets a user create, because `key` is the system's namespace.  OPEN SET: on `null` or an unrecognised value the client MUST fall back to `name`. Never `switch` without a default.  ⛔ NEVER a permission input, on either side. \"Is this the Owner?\" is answered by capabilities alone (architecture §3.2 / data-model §5.2); @qa's I-45 flips a Staff role's `key` to `\"owner\"` in the database to prove a client that trusted it would be wrong. 
    // String key
    test('to test the property `key`', () async {
      // TODO
    });

    // True for roles the system provisions with the shop. F-003 will refuse to delete these. 
    // bool isSystem
    test('to test the property `isSystem`', () async {
      // TODO
    });

  });
}
