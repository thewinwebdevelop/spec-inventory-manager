import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

// tests for UpdateOrganizationRequest
void main() {
  final instance = UpdateOrganizationRequestBuilder();
  // TODO add properties to the builder and call build()

  group(UpdateOrganizationRequest, () {
    // String name
    test('to test the property `name`', () async {
      // TODO
    });

    // ⛔ Phase 0 accepts `null` and NOTHING ELSE (M-4). Any string → `422 VALIDATION_FAILED` with `fieldErrors.logo = \"ยังไม่รองรับการตั้งโลโก้ในเวอร์ชันนี้\"`. An arbitrary URL here would make every member of the shop fetch a resource chosen by whoever holds `manage_org_settings`. 
    // ModelNull logo
    test('to test the property `logo`', () async {
      // TODO
    });

    // IANA zone from `Intl.supportedValuesOf('timeZone')`; anything else is 422.
    // String timezone
    test('to test the property `timezone`', () async {
      // TODO
    });

  });
}
