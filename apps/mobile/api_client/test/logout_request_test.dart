import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

// tests for LogoutRequest
void main() {
  final instance = LogoutRequestBuilder();
  // TODO add properties to the builder and call build()

  group(LogoutRequest, () {
    // Body-transport refresh token (mobile). Web uses the cookie.
    // String refreshToken
    test('to test the property `refreshToken`', () async {
      // TODO
    });

    // Optional — revoke a specific LISTED family owned by the caller (M-3).
    // String familyId
    test('to test the property `familyId`', () async {
      // TODO
    });

  });
}
