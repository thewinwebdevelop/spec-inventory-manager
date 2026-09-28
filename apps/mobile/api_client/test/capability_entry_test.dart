import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

// tests for CapabilityEntry
void main() {
  final instance = CapabilityEntryBuilder();
  // TODO add properties to the builder and call build()

  group(CapabilityEntry, () {
    // Stable snake_case identifier — the value stored in `RoleDetail.capabilities`. OPEN SET: new keys ship with new features. 
    // String key
    test('to test the property `key`', () async {
      // TODO
    });

    // String labelTh
    test('to test the property `labelTh`', () async {
      // TODO
    });

    // One sentence — what holding it actually lets someone do.
    // String descriptionTh
    test('to test the property `descriptionTh`', () async {
      // TODO
    });

    // A `CapabilityGroup.key`, or `null` for an entry that is not a checklist item (`full_access`). OPEN SET — an unknown group goes in a generic section. 
    // String group
    test('to test the property `group`', () async {
      // TODO
    });

    // OPEN SET. `live` · `upcoming` (shown as \"เร็ว ๆ นี้\"; may be ticked in advance, AC-7.5). Any other value → generic copy. 
    // String status
    test('to test the property `status`', () async {
      // TODO
    });

    // Keys granted automatically with this one (one level only, e.g. `manage_X` → `view_X`). Shown ticked and disabled. 
    // BuiltList<String> implies
    test('to test the property `implies`', () async {
      // TODO
    });

    // `false` = may never appear in a create/update request (`full_access`). 
    // bool selectable
    test('to test the property `selectable`', () async {
      // TODO
    });

  });
}
