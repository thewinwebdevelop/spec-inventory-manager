import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';


/// tests for OrganizationsApi
void main() {
  final instance = OmnistockApiClient().getOrganizationsApi();

  group(OrganizationsApi, () {
    // Create a shop (organization)
    //
    // F-002 US-1 (api-spec §3.1). USER-SCOPED: there is no org context on this request and there must not be one — the shop does not exist yet, so any `X-Organization-Id` the caller sends is ignored (I-3).  The `201` is deliberately complete enough to enter the new shop immediately (ux Q5): org, the creator's membership + role, the entitlement and the default warehouse. Seed the cache from it; do not refetch `GET /me/organizations` before navigating.  Everything is provisioned in ONE transaction: Organization + the three system Roles + the creator's Owner Membership + OrgEntitlement + a default Warehouse. The plan comes from a server-side env seam and FAILS CLOSED (`503 ORG_PROVISIONING_UNAVAILABLE`) rather than falling back to a tier nobody authorised.  Rate limit 10/hour/user (abuse control, fails OPEN if Redis is down). The 50-shops-per-user cap is enforced separately IN the transaction and fails CLOSED (`409 ORG_LIMIT_REACHED` with `details.limit`). 
    //
    //Future<CreatedOrganization> createOrganization(CreateOrganizationRequest createOrganizationRequest) async
    test('test createOrganization', () async {
      // TODO
    });

    // Shop profile (org + plan + tax status + my membership)
    //
    // F-002 api-spec §3.3. Any ACTIVE member may call it; the body is safe for them because it goes through the PDPA mapper — no member list, no full tax id, and `taxIdMasked` only for a caller holding `manage_org_settings` (ux Q13, which is stricter than D-028).  `myMembership.capabilities` exists so the client can hide buttons it should not offer. It is NOT enforcement — the server refuses the call regardless.  `Cache-Control: no-store` always: the body carries the shop's name and its tax status. 
    //
    //Future<OrgProfile> getOrganization(String orgId, { String xOrganizationId }) async
    test('test getOrganization', () async {
      // TODO
    });

    // List the shops I belong to (org switcher)
    //
    // F-002 US-2 (api-spec §3.2). USER-SCOPED — \"which shops am I in?\" has no single org to be scoped to, so `X-Organization-Id` is ignored (I-3).  `status=active` (the default) is evaluated as a DATABASE FILTER on every request: no cache, no TTL. A client that receives `403 ORG_ACCESS_DENIED` refetches this endpoint and the shop it was removed from is already gone (AC US-5 / D-027).  `status=all` additionally returns shops the caller was removed from, and those rows come back in the SHORT shape — id, name, status, `revokedAt` and nothing else (M-10). The role they held and the plan that shop is on are internal facts about an organization they are no longer part of.  ⚠️ `?withTotal=true` is NOT supported here (see the T-002-21 report): api-spec §1 states the convention generally, but only `GET /orgs/{orgId}/members` implements it. An unknown query parameter is ignored, so asking for it simply yields no `total`. 
    //
    //Future<MyOrganizationsPage> listMyOrganizations({ String status, String cursor, int limit }) async
    test('test listMyOrganizations', () async {
      // TODO
    });

    // Declare (or clear) the shop's legal tax identity
    //
    // F-002 US-7 (api-spec §3.5). Requires `manage_org_settings`. `PUT` of the WHOLE set: send the complete declaration, or `{}` to clear it. There is no half-declared state (data-model §3.3), so a partial body is `422` with a message on every field that is missing.  ⚠️ THE RESPONSE DOES NOT ECHO `taxId` BACK. It is the ordinary §3.3 profile body — `taxIdMasked` at most. The caller typed the number, so returning it adds nothing and only multiplies the places a full TIN appears. The value is never logged either; the security event records `taxIdPresent` and `entityType` only.  F-002 stores the declaration and exposes `taxProfileComplete`. Gating features on it is F-007's job, not this endpoint's. 
    //
    //Future<OrgProfile> putTaxProfile(String orgId, TaxProfileRequest taxProfileRequest, { String xOrganizationId }) async
    test('test putTaxProfile', () async {
      // TODO
    });

    // Reveal the shop's full tax id (deliberate, recorded, rate-limited)
    //
    // F-002 api-spec §3.16 (ux Q7/Q13, D-030/NEW-11). Requires `manage_org_settings` — which Admin also holds, decided deliberately: the person who files the shop's tax documents has to be able to read the number. It is fenced by CONTROLS rather than by hiding it:   (a) a deliberate action, never a side effect of opening the shop page;   (b) `org.tax_profile.revealed` on every success (the event carries NO TIN);   (c) 20/hour per (user, shop);   (d) `no-store` + `no-cache` + `no-referrer`;   (e) `TAX_ID_RESPONSE_ALLOWLIST` = this route and nothing else, CI-pinned.   `POST` with an empty body `{}`, not `GET`: a GET would record a national-ID lookup in browser history, in proxy access logs and in the `Referer` of the next outbound link.  `200`, not `201` — nothing is created.  Known limitation (forward-commitment): the Owner has no screen showing these reveal events until F-005. 
    //
    //Future<TaxIdReveal> revealTaxId(String orgId, { String xOrganizationId, JsonObject body }) async
    test('test revealTaxId', () async {
      // TODO
    });

    // Update the shop's name / logo / timezone
    //
    // F-002 api-spec §3.4. Requires `manage_org_settings`. Returns the SAME body as `GET` — one mapper, so the field-level authorization cannot drift between the two.  An absent key means \"leave alone\"; an empty patch is a valid no-op that returns the current profile. `logo` accepts `null` and nothing else until F-040 mints object keys (M-4). 
    //
    //Future<OrgProfile> updateOrganization(String orgId, UpdateOrganizationRequest updateOrganizationRequest, { String xOrganizationId }) async
    test('test updateOrganization', () async {
      // TODO
    });

  });
}
