import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

// tests for MemberRow
void main() {
  final instance = MemberRowBuilder();
  // TODO add properties to the builder and call build()

  group(MemberRow, () {
    // String userId
    test('to test the property `userId`', () async {
      // TODO
    });

    // PII under PDPA — the reason this READ requires `manage_members` and the reason the response is `no-store`. 
    // String email
    test('to test the property `email`', () async {
      // TODO
    });

    // String roleId
    test('to test the property `roleId`', () async {
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

    // `invited` is a dead state: memberships are created at ACCEPT time only (data-model §7). It is listed because the column allows it, not because a write path produces it. 
    // String status
    test('to test the property `status`', () async {
      // TODO
    });

    // DateTime activatedAt
    test('to test the property `activatedAt`', () async {
      // TODO
    });

    // DateTime revokedAt
    test('to test the property `revokedAt`', () async {
      // TODO
    });

    // DateTime createdAt
    test('to test the property `createdAt`', () async {
      // TODO
    });

    // Decided server-side, so the client never compares ids itself.
    // bool isMe
    test('to test the property `isMe`', () async {
      // TODO
    });

    // This row's role holds `full_access`. Computed from CAPABILITIES, never from the role's name or key. Use it to hide buttons; the server enforces. 
    // bool isOwner
    test('to test the property `isOwner`', () async {
      // TODO
    });

  });
}
