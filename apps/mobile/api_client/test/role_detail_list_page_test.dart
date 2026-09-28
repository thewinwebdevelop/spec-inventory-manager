import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

// tests for RoleDetailListPage
void main() {
  final instance = RoleDetailListPageBuilder();
  // TODO add properties to the builder and call build()

  group(RoleDetailListPage, () {
    // Every live role of the shop, `createdAt asc, id asc`.
    // BuiltList<RoleDetail> items
    test('to test the property `items`', () async {
      // TODO
    });

    // Always `null` while the role ceiling fits in one page. Present so a client written today survives the day it is not. 
    // String nextCursor
    test('to test the property `nextCursor`', () async {
      // TODO
    });

    // RoleDetailListViewer viewer
    test('to test the property `viewer`', () async {
      // TODO
    });

  });
}
