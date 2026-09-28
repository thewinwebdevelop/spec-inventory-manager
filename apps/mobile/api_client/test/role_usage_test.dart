import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

// tests for RoleUsage
void main() {
  final instance = RoleUsageBuilder();
  // TODO add properties to the builder and call build()

  group(RoleUsage, () {
    // int activeMembers
    test('to test the property `activeMembers`', () async {
      // TODO
    });

    // Invitations still `pending` for this role, INCLUDING ones whose link has expired (AC-3.9) — both block deletion. 
    // int pendingInvitations
    test('to test the property `pendingInvitations`', () async {
      // TODO
    });

  });
}
