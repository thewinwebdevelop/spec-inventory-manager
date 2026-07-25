import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

// tests for LoginRequest
void main() {
  final instance = LoginRequestBuilder();
  // TODO add properties to the builder and call build()

  group(LoginRequest, () {
    // String email
    test('to test the property `email`', () async {
      // TODO
    });

    // String password
    test('to test the property `password`', () async {
      // TODO
    });

    // Client session label (arch §4). Not a security boundary.
    // String deviceId
    test('to test the property `deviceId`', () async {
      // TODO
    });

    // Refresh-token delivery channel (api-spec §0). Web sends \"cookie\"; mobile omits or sends \"body\". 
    // String tokenTransport (default value: 'body')
    test('to test the property `tokenTransport`', () async {
      // TODO
    });

  });
}
