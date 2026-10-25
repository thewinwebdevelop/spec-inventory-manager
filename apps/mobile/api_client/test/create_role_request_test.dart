import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

// tests for CreateRoleRequest
void main() {
  final instance = CreateRoleRequestBuilder();
  // TODO add properties to the builder and call build()

  group(CreateRoleRequest, () {
    // 1–50 code points AFTER the server normalises it (NFC, trim, collapse inner whitespace); invisible/control characters (Unicode Cc/Cf) are refused. The response carries the normalised name. 
    // String name
    test('to test the property `name`', () async {
      // TODO
    });

    // Keys from the capability catalog with `selectable: true`. Stored in canonical form (api-spec §2) — the response may differ from what was sent (duplicates and implied keys removed, sorted). 
    // BuiltList<String> capabilities
    test('to test the property `capabilities`', () async {
      // TODO
    });

  });
}
