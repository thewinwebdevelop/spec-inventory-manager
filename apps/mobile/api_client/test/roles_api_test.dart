import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';


/// tests for RolesApi
void main() {
  final instance = OmnistockApiClient().getRolesApi();

  group(RolesApi, () {
    // The capability catalog this shop can see (role checklist)
    //
    // F-003 (api-spec §1, §3 · D-037). The ONE source of capability keys, their Thai labels and descriptions, groups, status and `implies` edges — clients render the checklist from this and never hard-code a key (AC-7.1).  Org-scoped and requires `manage_roles`: a tier that needs an entitlement is HIDDEN entirely, not flagged (AC-7.4), so the answer can differ per shop — cache it per shop. `full_access` is present with `selectable: false` and `group: null` so a role holding it can be labelled; it is never a checklist item. 
    //
    //Future<CapabilityCatalog> getOrgCapabilityCatalog(String orgId, { String xOrganizationId }) async
    test('test getOrgCapabilityCatalog', () async {
      // TODO
    });

    // One role of this shop, in full (edit and clone screens)
    //
    // F-003 (api-spec §1, §3). The same `RoleDetail` as the matching item of `GET /orgs/{orgId}/role-details`. Requires `manage_roles`.  `lastEdited.by` is decided at read time against THIS shop only: `me`, a current member (their CURRENT role here), or `former_member` — never an e-mail, a user id, or anything from another shop. 
    //
    //Future<RoleDetail> getOrgRoleDetail(String orgId, String roleId, { String xOrganizationId }) async
    test('test getOrgRoleDetail', () async {
      // TODO
    });

    // Every live role of this shop, in full (the role list screen)
    //
    // F-003 (api-spec §1, §3). Each item is a `RoleDetail` — capabilities, usage counts, who edited it last and the caller's per-role verdicts — and the page carries the create verdict and the role ceiling. Requires `manage_roles`.  A separate path from `GET /orgs/{orgId}/roles` on purpose: that list is readable by every active member and does NOT publish `capabilities` (AC-6.4); one route, one capability.  One page, oldest first (`createdAt asc, id asc`); `nextCursor` is always `null` while the role ceiling fits in a page. `viewer.*` is a UX input — a write re-reads permissions and may still refuse. While role writes are switched off every write verdict is `writes_disabled`. 
    //
    //Future<RoleDetailListPage> listOrgRoleDetails(String orgId, { String xOrganizationId }) async
    test('test listOrgRoleDetails', () async {
      // TODO
    });

  });
}
