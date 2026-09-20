import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

// tests for InvitationPreview
void main() {
  final instance = InvitationPreviewBuilder();
  // TODO add properties to the builder and call build()

  group(InvitationPreview, () {
    // String organizationName
    test('to test the property `organizationName`', () async {
      // TODO
    });

    // String roleName
    test('to test the property `roleName`', () async {
      // TODO
    });

    // String roleKey
    test('to test the property `roleKey`', () async {
      // TODO
    });

    // `u***@example.com` — enough to pick the right account, not an address.
    // String emailMasked
    test('to test the property `emailMasked`', () async {
      // TODO
    });

    // DateTime expiresAt
    test('to test the property `expiresAt`', () async {
      // TODO
    });

    // Always `pending` on a `200`; the other states answer `409`.
    // String status
    test('to test the property `status`', () async {
      // TODO
    });

  });
}
