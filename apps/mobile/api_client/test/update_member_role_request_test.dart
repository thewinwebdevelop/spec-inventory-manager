import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

// tests for UpdateMemberRoleRequest
void main() {
  final instance = UpdateMemberRoleRequestBuilder();
  // TODO add properties to the builder and call build()

  group(UpdateMemberRoleRequest, () {
    // Must be a role OF THIS SHOP — otherwise `422 ROLE_INVALID`. A role id from another tenant and one that never existed are indistinguishable by construction (no cross-tenant existence oracle). 
    // String roleId
    test('to test the property `roleId`', () async {
      // TODO
    });

  });
}
