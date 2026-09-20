import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';


/// tests for MembersApi
void main() {
  final instance = OmnistockApiClient().getMembersApi();

  group(MembersApi, () {
    // Leave this shop myself
    //
    // F-002 US-5 / D-029 (api-spec §3.17). ANY active member may call it — NO `manage_members` required.  ⚠️ WHY THIS IS A SEPARATE ROUTE rather than relaxing `DELETE /orgs/{orgId}/members/{userId}` when the id happens to be your own:   1. Confused deputy closed BY SHAPE — there is no `userId` anywhere in this      route, so the target is `ctx.userId` always and no bug can point it at      another person. The alternative closes the same hole with an `if`, and      an `if` is exactly what finding C-1 was.   2. The route registry stays decidable — the capability guard reads      metadata only; \"the capability depends on a value in the path\" cannot      be expressed in metadata and would push the decision into a service,      where forgetting it is silent.   3. Different event: `org.member.left`, not `org.member.revoked`. Afterwards      \"did they walk out or were they cleared out?\" is answerable.   Behaviour is identical to §3.9 apart from the actor: soft revoke, own pending invitations cancelled in the same transaction, the shop disappears from `GET /me/organizations` immediately, other shops and the session untouched.  `200` with a body rather than `204`: the caller needs `cancelledInvitations` and `revokedAt` for the confirmation copy.  ⛔ There is NO `403 FORBIDDEN` on this route — there is no capability to lack, so a 403 here can only be `ORG_ACCESS_DENIED`.  ⚠️ The last Owner cannot leave (`409 LAST_OWNER`) and F-002 has no \"delete shop\", so the way out is to appoint another Owner first. Accepted limitation. 
    //
    //Future<LeaveOrgResult> leaveOrganization(String orgId, { String xOrganizationId }) async
    test('test leaveOrganization', () async {
      // TODO
    });

    // List the shop's members
    //
    // F-002 US-5 (api-spec §3.7). ⚠️ THIS READ REQUIRES `manage_members`. Every row carries somebody's email address, which is PII under PDPA (D-028/I-8) — it is not a UX preference, and a Staff member calling it gets `403 FORBIDDEN`. If a screen needs \"who did this?\", take the name/id off the resource rather than pulling the whole directory.  `status` defaults to `all` here (unlike `GET /me/organizations`, whose default is `active`): this is the audit view of who is and who WAS in the shop, and hiding removed rows by default would make \"why can this person no longer sign in?\" unanswerable from the UI. `invited` is not an accepted value — memberships are only created at accept time (data-model §7), so the filter could only ever return nothing. People invited but not yet joined live in `GET /orgs/{orgId}/invitations`.  This is the ONLY list endpoint that supports `?withTotal=true` today.  `Cache-Control: no-store` — a list of email addresses must not sit in a shared cache (M-11). 
    //
    //Future<MemberListPage> listMembers(String orgId, { String status, String cursor, int limit, bool withTotal, String xOrganizationId }) async
    test('test listMembers', () async {
      // TODO
    });

    // Remove another member from the shop
    //
    // F-002 US-5 (api-spec §3.9). Requires `manage_members`, plus `full_access` when the target is an Owner (D-028/C-1).  SOFT delete: `status → revoked` and `revokedAt` is stamped. The row stays, because history references it and because `revokedAt` is a security input — an invitation issued BEFORE it can no longer be accepted (I-1).  In the SAME transaction, any pending invitation for that person's email in this shop is cancelled; `cancelledInvitations` reports how many, so the UI can say so.  Effect is immediate: the removed member's next request to this shop is `403 ORG_ACCESS_DENIED` and the shop is gone from their `GET /me/organizations`. Their session is not destroyed and their other shops are untouched.  Removing YOURSELF through this route works, but only if you already hold `manage_members`. Everyone else uses `DELETE /orgs/{orgId}/membership` — this route grants nobody a softer path (D-029).  Idempotency under a race: two concurrent revokes of the same person produce one `200` and one `404`, and `revokedAt` is written once. 
    //
    //Future<RevokeMemberResult> revokeMember(String orgId, String userId, { String xOrganizationId }) async
    test('test revokeMember', () async {
      // TODO
    });

    // Change a member's role
    //
    // F-002 US-6 (api-spec §3.8). Requires `manage_members`, and additionally `full_access` (Owner-only, D-028/C-1) when EITHER the new role holds `full_access` (promoting somebody — including yourself — to Owner) OR the target's CURRENT role holds it (editing an Owner). Otherwise `403 FORBIDDEN`.  Acting on yourself is allowed (an Owner stepping down after appointing a successor), subject to the last-Owner rule.  Answers with the §3.7 member row, so the client never has to refetch the list to render the new state — which is why this response carries an email address and therefore the §3.7 `no-store` policy (api-spec §1 lists §3.7 but not §3.8 by number; the classification follows the SHAPE, and `RESPONSE_HEADER_POLICY` in apps/api encodes that).  The target's state is re-read INSIDE the transaction, after the shop's row lock is taken — so a `PATCH` racing a `DELETE` answers `404`, never a 500 or a resurrection. 
    //
    //Future<MemberRow> updateMemberRole(String orgId, String userId, UpdateMemberRoleRequest updateMemberRoleRequest, { String xOrganizationId }) async
    test('test updateMemberRole', () async {
      // TODO
    });

  });
}
