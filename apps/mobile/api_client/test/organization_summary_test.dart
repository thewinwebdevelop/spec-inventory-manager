import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

// tests for OrganizationSummary
void main() {
  final instance = OrganizationSummaryBuilder();
  // TODO add properties to the builder and call build()

  group(OrganizationSummary, () {
    // String id
    test('to test the property `id`', () async {
      // TODO
    });

    // String name
    test('to test the property `name`', () async {
      // TODO
    });

    // Phase 0: always `null`. Uploads arrive with F-040; until then `PATCH /orgs/{orgId}` accepts `null` and nothing else (M-4). 
    // String logo
    test('to test the property `logo`', () async {
      // TODO
    });

  });
}
