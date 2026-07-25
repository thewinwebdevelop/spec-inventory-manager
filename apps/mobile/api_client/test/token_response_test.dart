import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

// tests for TokenResponse
void main() {
  final instance = TokenResponseBuilder();
  // TODO add properties to the builder and call build()

  group(TokenResponse, () {
    // HS256 JWT access token (Bearer). 15-minute TTL.
    // String accessToken
    test('to test the property `accessToken`', () async {
      // TODO
    });

    // The rotated refresh token on the BODY transport; `null` on the cookie transport (the token is in the httpOnly `omni_rt` cookie, never JS-readable — H-1). 
    // String refreshToken
    test('to test the property `refreshToken`', () async {
      // TODO
    });

    // Access-token TTL in seconds (900).
    // int expiresIn
    test('to test the property `expiresIn`', () async {
      // TODO
    });

    // String tokenType
    test('to test the property `tokenType`', () async {
      // TODO
    });

  });
}
