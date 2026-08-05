import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

// tests for RevokeMemberResult
void main() {
  final instance = RevokeMemberResultBuilder();
  // TODO add properties to the builder and call build()

  group(RevokeMemberResult, () {
    // String userId
    test('to test the property `userId`', () async {
      // TODO
    });

    // Soft delete — the row stays, so history and `revokedAt` survive.
    // String status
    test('to test the property `status`', () async {
      // TODO
    });

    // DateTime revokedAt
    test('to test the property `revokedAt`', () async {
      // TODO
    });

    // Pending invitations for that email that were cancelled in the SAME transaction (normally 0 or 1) — so the UI can say \"their pending invitation was withdrawn too\". 
    // int cancelledInvitations
    test('to test the property `cancelledInvitations`', () async {
      // TODO
    });

  });
}
