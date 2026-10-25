import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

// tests for RoleLastEditedBy
void main() {
  final instance = RoleLastEditedByBuilder();
  // TODO add properties to the builder and call build()

  group(RoleLastEditedBy, () {
    // OPEN SET. `me` → \"คุณ\" · `member` → the editor's CURRENT role in this shop (the three `role*` fields below) · `former_member` → \"อดีตสมาชิก\" (no longer an active member of this shop, including a deleted account). Any other value → generic copy. 
    // String kind
    test('to test the property `kind`', () async {
      // TODO
    });

    // Present only when `kind` is `member`. Display per AC-1.5.
    // String roleName
    test('to test the property `roleName`', () async {
      // TODO
    });

    // Present only when `kind` is `member`. Translation only — OPEN SET, fall back to `roleName`. 
    // String roleKey
    test('to test the property `roleKey`', () async {
      // TODO
    });

    // Present only when `kind` is `member`.
    // bool roleNameCustomized
    test('to test the property `roleNameCustomized`', () async {
      // TODO
    });

  });
}
