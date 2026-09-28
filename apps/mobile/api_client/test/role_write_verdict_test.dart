import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

// tests for RoleWriteVerdict
void main() {
  final instance = RoleWriteVerdictBuilder();
  // TODO add properties to the builder and call build()

  group(RoleWriteVerdict, () {
    // bool allowed
    test('to test the property `allowed`', () async {
      // TODO
    });

    // `null` when `allowed` is `true`. OPEN SET (api-spec §3), first match wins in this fixed order: `writes_disabled` → `role_locked` → `exceeds_your_permissions` → `in_use_requires_manage_members` → `equal_permissions_in_use` → `in_use` → `history_limit_reached`; `canClone` uses `owner_role` · `exceeds_your_permissions` · `role_limit_reached` · `writes_disabled`; `canCreate` uses `role_limit_reached` · `writes_disabled`. `writes_disabled` outranks every other reason while role writes are switched off. Any other value → generic copy. 
    // String reason
    test('to test the property `reason`', () async {
      // TODO
    });

  });
}
