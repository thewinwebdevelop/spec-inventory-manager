import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

// tests for CreateOrganizationRequest
void main() {
  final instance = CreateOrganizationRequestBuilder();
  // TODO add properties to the builder and call build()

  group(CreateOrganizationRequest, () {
    // Not unique — two shops may share a name.
    // String name
    test('to test the property `name`', () async {
      // TODO
    });

    // Optional IANA zone; defaults to Asia/Bangkok.
    // String timezone (default value: 'Asia/Bangkok')
    test('to test the property `timezone`', () async {
      // TODO
    });

  });
}
