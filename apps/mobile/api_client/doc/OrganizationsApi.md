# omnistock_api_client.api.OrganizationsApi

## Load the API package
```dart
import 'package:omnistock_api_client/api.dart';
```

All URIs are relative to *http://localhost:3000*

Method | HTTP request | Description
------------- | ------------- | -------------
[**createOrganization**](OrganizationsApi.md#createorganization) | **POST** /organizations | Create a shop (organization)
[**getOrganization**](OrganizationsApi.md#getorganization) | **GET** /orgs/{orgId} | Shop profile (org + plan + tax status + my membership)
[**listMyOrganizations**](OrganizationsApi.md#listmyorganizations) | **GET** /me/organizations | List the shops I belong to (org switcher)
[**listOrgRoles**](OrganizationsApi.md#listorgroles) | **GET** /orgs/{orgId}/roles | List this shop&#39;s roles (the invite dropdown)
[**putTaxProfile**](OrganizationsApi.md#puttaxprofile) | **PUT** /orgs/{orgId}/tax-profile | Declare (or clear) the shop&#39;s legal tax identity
[**revealTaxId**](OrganizationsApi.md#revealtaxid) | **POST** /orgs/{orgId}/tax-profile/reveal | Reveal the shop&#39;s full tax id (deliberate, recorded, rate-limited)
[**updateOrganization**](OrganizationsApi.md#updateorganization) | **PATCH** /orgs/{orgId} | Update the shop&#39;s name / logo / timezone


# **createOrganization**
> CreatedOrganization createOrganization(createOrganizationRequest)

Create a shop (organization)

F-002 US-1 (api-spec §3.1). USER-SCOPED: there is no org context on this request and there must not be one — the shop does not exist yet, so any `X-Organization-Id` the caller sends is ignored (I-3).  The `201` is deliberately complete enough to enter the new shop immediately (ux Q5): org, the creator's membership + role, the entitlement and the default warehouse. Seed the cache from it; do not refetch `GET /me/organizations` before navigating.  Everything is provisioned in ONE transaction: Organization + the three system Roles + the creator's Owner Membership + OrgEntitlement + a default Warehouse. The plan comes from a server-side env seam and FAILS CLOSED (`503 ORG_PROVISIONING_UNAVAILABLE`) rather than falling back to a tier nobody authorised.  Rate limit 10/hour/user (abuse control, fails OPEN if Redis is down). The 50-shops-per-user cap is enforced separately IN the transaction and fails CLOSED (`409 ORG_LIMIT_REACHED` with `details.limit`). 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getOrganizationsApi();
final CreateOrganizationRequest createOrganizationRequest = ; // CreateOrganizationRequest | 

try {
    final response = api.createOrganization(createOrganizationRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling OrganizationsApi->createOrganization: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **createOrganizationRequest** | [**CreateOrganizationRequest**](CreateOrganizationRequest.md)|  | 

### Return type

[**CreatedOrganization**](CreatedOrganization.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getOrganization**
> OrgProfile getOrganization(orgId, xOrganizationId)

Shop profile (org + plan + tax status + my membership)

F-002 api-spec §3.3. Any ACTIVE member may call it; the body is safe for them because it goes through the PDPA mapper — no member list, no full tax id, and `taxIdMasked` only for a caller holding `manage_org_settings` (ux Q13, which is stricter than D-028).  `myMembership.capabilities` exists so the client can hide buttons it should not offer. It is NOT enforcement — the server refuses the call regardless.  `Cache-Control: no-store` always: the body carries the shop's name and its tax status. 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getOrganizationsApi();
final String orgId = orgId_example; // String | Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
final String xOrganizationId = xOrganizationId_example; // String | Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 

try {
    final response = api.getOrganization(orgId, xOrganizationId);
    print(response);
} on DioException catch (e) {
    print('Exception when calling OrganizationsApi->getOrganization: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **orgId** | **String**| Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`.  | 
 **xOrganizationId** | **String**| Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3).  | [optional] 

### Return type

[**OrgProfile**](OrgProfile.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listMyOrganizations**
> MyOrganizationsPage listMyOrganizations(status, cursor, limit)

List the shops I belong to (org switcher)

F-002 US-2 (api-spec §3.2). USER-SCOPED — \"which shops am I in?\" has no single org to be scoped to, so `X-Organization-Id` is ignored (I-3).  `status=active` (the default) is evaluated as a DATABASE FILTER on every request: no cache, no TTL. A client that receives `403 ORG_ACCESS_DENIED` refetches this endpoint and the shop it was removed from is already gone (AC US-5 / D-027).  `status=all` additionally returns shops the caller was removed from, and those rows come back in the SHORT shape — id, name, status, `revokedAt` and nothing else (M-10). The role they held and the plan that shop is on are internal facts about an organization they are no longer part of.  ⚠️ `?withTotal=true` is NOT supported here (see the T-002-21 report): api-spec §1 states the convention generally, but only `GET /orgs/{orgId}/members` implements it. An unknown query parameter is ignored, so asking for it simply yields no `total`. 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getOrganizationsApi();
final String status = status_example; // String | `active` (default) returns the full shape. `all` adds shops the caller was removed from, in the short shape. Any other value → `422`. 
final String cursor = cursor_example; // String | Opaque keyset cursor from the previous page's `nextCursor`. Base64url — clients MUST NOT decode or construct one. Unreadable value → `422 VALIDATION_FAILED` with `fieldErrors.cursor`. 
final int limit = 56; // int | Page size. Default 25, clamped to 100. Non-integer / < 1 → `422 VALIDATION_FAILED` with `fieldErrors.limit` (a bug is not silently corrected). 

try {
    final response = api.listMyOrganizations(status, cursor, limit);
    print(response);
} on DioException catch (e) {
    print('Exception when calling OrganizationsApi->listMyOrganizations: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **status** | **String**| `active` (default) returns the full shape. `all` adds shops the caller was removed from, in the short shape. Any other value → `422`.  | [optional] [default to 'active']
 **cursor** | **String**| Opaque keyset cursor from the previous page's `nextCursor`. Base64url — clients MUST NOT decode or construct one. Unreadable value → `422 VALIDATION_FAILED` with `fieldErrors.cursor`.  | [optional] 
 **limit** | **int**| Page size. Default 25, clamped to 100. Non-integer / < 1 → `422 VALIDATION_FAILED` with `fieldErrors.limit` (a bug is not silently corrected).  | [optional] [default to 25]

### Return type

[**MyOrganizationsPage**](MyOrganizationsPage.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listOrgRoles**
> RoleListPage listOrgRoles(orgId, xOrganizationId)

List this shop's roles (the invite dropdown)

F-002 (api-spec §3.6). Any ACTIVE member may read it: the response carries no personal data and nothing about anybody else — three role names the caller can already see on their own membership. Requiring `manage_members` would mean a Staff member could not be shown the name of their own role.  It exists because AC US-3 makes choosing a role MANDATORY when inviting somebody: without this endpoint no client can populate that dropdown, so the acceptance criterion could not be met at all.  Read-only in F-002. F-003 adds create/update/delete. 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getOrganizationsApi();
final String orgId = orgId_example; // String | Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
final String xOrganizationId = xOrganizationId_example; // String | Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 

try {
    final response = api.listOrgRoles(orgId, xOrganizationId);
    print(response);
} on DioException catch (e) {
    print('Exception when calling OrganizationsApi->listOrgRoles: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **orgId** | **String**| Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`.  | 
 **xOrganizationId** | **String**| Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3).  | [optional] 

### Return type

[**RoleListPage**](RoleListPage.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **putTaxProfile**
> OrgProfile putTaxProfile(orgId, taxProfileRequest, xOrganizationId)

Declare (or clear) the shop's legal tax identity

F-002 US-7 (api-spec §3.5). Requires `manage_org_settings`. `PUT` of the WHOLE set: send the complete declaration, or `{}` to clear it. There is no half-declared state (data-model §3.3), so a partial body is `422` with a message on every field that is missing.  ⚠️ THE RESPONSE DOES NOT ECHO `taxId` BACK. It is the ordinary §3.3 profile body — `taxIdMasked` at most. The caller typed the number, so returning it adds nothing and only multiplies the places a full TIN appears. The value is never logged either; the security event records `taxIdPresent` and `entityType` only.  F-002 stores the declaration and exposes `taxProfileComplete`. Gating features on it is F-007's job, not this endpoint's. 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getOrganizationsApi();
final String orgId = orgId_example; // String | Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
final TaxProfileRequest taxProfileRequest = ; // TaxProfileRequest | 
final String xOrganizationId = xOrganizationId_example; // String | Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 

try {
    final response = api.putTaxProfile(orgId, taxProfileRequest, xOrganizationId);
    print(response);
} on DioException catch (e) {
    print('Exception when calling OrganizationsApi->putTaxProfile: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **orgId** | **String**| Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`.  | 
 **taxProfileRequest** | [**TaxProfileRequest**](TaxProfileRequest.md)|  | 
 **xOrganizationId** | **String**| Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3).  | [optional] 

### Return type

[**OrgProfile**](OrgProfile.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **revealTaxId**
> TaxIdReveal revealTaxId(orgId, xOrganizationId, body)

Reveal the shop's full tax id (deliberate, recorded, rate-limited)

F-002 api-spec §3.16 (ux Q7/Q13, D-030/NEW-11). Requires `manage_org_settings` — which Admin also holds, decided deliberately: the person who files the shop's tax documents has to be able to read the number. It is fenced by CONTROLS rather than by hiding it:   (a) a deliberate action, never a side effect of opening the shop page;   (b) `org.tax_profile.revealed` on every success (the event carries NO TIN);   (c) 20/hour per (user, shop);   (d) `no-store` + `no-cache` + `no-referrer`;   (e) `TAX_ID_RESPONSE_ALLOWLIST` = this route and nothing else, CI-pinned.   `POST` with an empty body `{}`, not `GET`: a GET would record a national-ID lookup in browser history, in proxy access logs and in the `Referer` of the next outbound link.  `200`, not `201` — nothing is created.  Known limitation (forward-commitment): the Owner has no screen showing these reveal events until F-005. 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getOrganizationsApi();
final String orgId = orgId_example; // String | Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
final String xOrganizationId = xOrganizationId_example; // String | Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 
final JsonObject body = Object; // JsonObject | Empty object. There is no input — the shop comes from the context.

try {
    final response = api.revealTaxId(orgId, xOrganizationId, body);
    print(response);
} on DioException catch (e) {
    print('Exception when calling OrganizationsApi->revealTaxId: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **orgId** | **String**| Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`.  | 
 **xOrganizationId** | **String**| Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3).  | [optional] 
 **body** | **JsonObject**| Empty object. There is no input — the shop comes from the context. | [optional] 

### Return type

[**TaxIdReveal**](TaxIdReveal.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateOrganization**
> OrgProfile updateOrganization(orgId, updateOrganizationRequest, xOrganizationId)

Update the shop's name / logo / timezone

F-002 api-spec §3.4. Requires `manage_org_settings`. Returns the SAME body as `GET` — one mapper, so the field-level authorization cannot drift between the two.  An absent key means \"leave alone\"; an empty patch is a valid no-op that returns the current profile. `logo` accepts `null` and nothing else until F-040 mints object keys (M-4). 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getOrganizationsApi();
final String orgId = orgId_example; // String | Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
final UpdateOrganizationRequest updateOrganizationRequest = ; // UpdateOrganizationRequest | 
final String xOrganizationId = xOrganizationId_example; // String | Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 

try {
    final response = api.updateOrganization(orgId, updateOrganizationRequest, xOrganizationId);
    print(response);
} on DioException catch (e) {
    print('Exception when calling OrganizationsApi->updateOrganization: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **orgId** | **String**| Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`.  | 
 **updateOrganizationRequest** | [**UpdateOrganizationRequest**](UpdateOrganizationRequest.md)|  | 
 **xOrganizationId** | **String**| Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3).  | [optional] 

### Return type

[**OrgProfile**](OrgProfile.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

