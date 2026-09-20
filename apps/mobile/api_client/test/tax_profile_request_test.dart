import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

// tests for TaxProfileRequest
void main() {
  final instance = TaxProfileRequestBuilder();
  // TODO add properties to the builder and call build()

  group(TaxProfileRequest, () {
    // String entityType
    test('to test the property `entityType`', () async {
      // TODO
    });

    // 13 digits + checksum (data-model §6). Separators are stripped before storage, so `1-1017-00207-36-6` and `1101700207366` are one value. Rejected → `422 TAX_ID_INVALID` + `fieldErrors.taxId`. ⚠️ With `entityType: personal` this IS the owner's national ID. It is never logged, never echoed back, and never appears in any response except `POST /orgs/{orgId}/tax-profile/reveal`. 
    // String taxId
    test('to test the property `taxId`', () async {
      // TODO
    });

    // A real boolean — the string `\"true\"` is refused, not coerced.
    // bool vatRegistered
    test('to test the property `vatRegistered`', () async {
      // TODO
    });

    // Optional. `\"00000\"` = head office.
    // String branchCode
    test('to test the property `branchCode`', () async {
      // TODO
    });

  });
}
