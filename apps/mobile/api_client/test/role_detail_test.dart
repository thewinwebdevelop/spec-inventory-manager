import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

// tests for RoleDetail
void main() {
  final instance = RoleDetailBuilder();
  // TODO add properties to the builder and call build()

  group(RoleDetail, () {
    // String id
    test('to test the property `id`', () async {
      // TODO
    });

    // The stored name, already normalised (NFC, trimmed, inner whitespace collapsed). Display rule (AC-1.5): `nameCustomized ? name : (translate key ?? name)`. 
    // String name
    test('to test the property `name`', () async {
      // TODO
    });

    // Stable slug for TRANSLATION ONLY: `owner`, `admin` or `staff` for the system presets, `null` for every role a user created. OPEN SET — on `null` or an unrecognised value fall back to `name`.  ⛔ NEVER a permission input. Whether a role grants ownership is `grantsOwnership`; what it allows is `capabilities`. 
    // String key
    test('to test the property `key`', () async {
      // TODO
    });

    // The shop renamed this role (always `true` for a role with `key: null`). When `true`, show `name` as-is instead of translating `key`. 
    // bool nameCustomized
    test('to test the property `nameCustomized`', () async {
      // TODO
    });

    // The locked Owner role. It can be neither edited, renamed nor deleted. `viewer` already says so per action — use this for labelling only. 
    // bool isSystem
    test('to test the property `isSystem`', () async {
      // TODO
    });

    // Derived server-side from `capabilities` (`full_access`), never from `key`. 
    // bool grantsOwnership
    test('to test the property `grantsOwnership`', () async {
      // TODO
    });

    // The CANONICAL stored set, sorted by key (api-spec §2): a key implied by another key in the set is not repeated. The Owner role is exactly `[\"full_access\"]`. May contain keys whose catalog `status` is `upcoming`, and — from an older catalog — keys a client does not know: render those generically, never drop them silently. 
    // BuiltList<String> capabilities
    test('to test the property `capabilities`', () async {
      // TODO
    });

    // Optimistic-concurrency token. Send it back unchanged in `UpdateRoleRequest.version`. On a version conflict the client MUST re-fetch this role and show the difference — it must never resubmit automatically with the newer version (AC-3.12). 
    // int version
    test('to test the property `version`', () async {
      // TODO
    });

    // RoleUsage usage
    test('to test the property `usage`', () async {
      // TODO
    });

    // `null` = never edited since the system provisioned it (\"ค่าเริ่มต้นของระบบ\", AC-9.6). 
    // RoleLastEdited lastEdited
    test('to test the property `lastEdited`', () async {
      // TODO
    });

    // RoleDetailViewer viewer
    test('to test the property `viewer`', () async {
      // TODO
    });

    // DateTime createdAt
    test('to test the property `createdAt`', () async {
      // TODO
    });

  });
}
