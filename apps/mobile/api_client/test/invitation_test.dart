import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

// tests for Invitation
void main() {
  final instance = InvitationBuilder();
  // TODO add properties to the builder and call build()

  group(Invitation, () {
    // String id
    test('to test the property `id`', () async {
      // TODO
    });

    // Normalized (lower-cased, trimmed) at creation.
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

    // Resolved at read time — a stored `pending` row past `expiresAt` reads as `expired`. 
    // String status
    test('to test the property `status`', () async {
      // TODO
    });

    // NON-NULL ON EVERY ROW, accepted and cancelled ones included (ux Q14). ⛔ UI must render the remaining time FROM THIS VALUE — never hard-code \"7 days\": an elevated role's invitation lives 24 hours, and reissuing a link restarts the clock (D-027). 
    // DateTime expiresAt
    test('to test the property `expiresAt`', () async {
      // TODO
    });

    // When the CURRENT link was minted. Moves on every reissue.
    // DateTime tokenIssuedAt
    test('to test the property `tokenIssuedAt`', () async {
      // TODO
    });

    // String invitedByUserId
    test('to test the property `invitedByUserId`', () async {
      // TODO
    });

    // When the invitation first existed. Does NOT move on reissue.
    // DateTime createdAt
    test('to test the property `createdAt`', () async {
      // TODO
    });

    // DateTime acceptedAt
    test('to test the property `acceptedAt`', () async {
      // TODO
    });

    // String acceptedByUserId
    test('to test the property `acceptedByUserId`', () async {
      // TODO
    });

    // Was the accepting ACCOUNT created after `createdAt`? `null` until somebody accepts — \"we do not know yet\" is not \"no\". Phase 0 cannot verify email addresses, so this is the only signal that a link may have been redeemed by whoever found it. Render it as a soft flag, not an accusation. 
    // bool acceptedUserCreatedAfterInvite
    test('to test the property `acceptedUserCreatedAfterInvite`', () async {
      // TODO
    });

  });
}
