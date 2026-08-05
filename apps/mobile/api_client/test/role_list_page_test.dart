import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

// tests for RoleListPage
void main() {
  final instance = RoleListPageBuilder();
  // TODO add properties to the builder and call build()

  group(RoleListPage, () {
    // BuiltList<RoleRow> items
    test('to test the property `items`', () async {
      // TODO
    });

    // Always `null` in F-002 — a shop has exactly its three system roles until F-003. The field is present so a client written today does not need rewriting the day a fourth role exists. 
    // String nextCursor
    test('to test the property `nextCursor`', () async {
      // TODO
    });

  });
}
