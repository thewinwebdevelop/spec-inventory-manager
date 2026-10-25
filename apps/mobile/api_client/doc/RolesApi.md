# omnistock_api_client.api.RolesApi

## Load the API package
```dart
import 'package:omnistock_api_client/api.dart';
```

All URIs are relative to *http://localhost:3000*

Method | HTTP request | Description
------------- | ------------- | -------------
[**getOrgCapabilityCatalog**](RolesApi.md#getorgcapabilitycatalog) | **GET** /orgs/{orgId}/capabilities | The capability catalog this shop can see (role checklist)
[**getOrgRoleDetail**](RolesApi.md#getorgroledetail) | **GET** /orgs/{orgId}/roles/{roleId} | One role of this shop, in full (edit and clone screens)
[**listOrgRoleDetails**](RolesApi.md#listorgroledetails) | **GET** /orgs/{orgId}/role-details | Every live role of this shop, in full (the role list screen)


# **getOrgCapabilityCatalog**
> CapabilityCatalog getOrgCapabilityCatalog(orgId, xOrganizationId)

The capability catalog this shop can see (role checklist)

F-003 (api-spec §1, §3 · D-037). The ONE source of capability keys, their Thai labels and descriptions, groups, status and `implies` edges — clients render the checklist from this and never hard-code a key (AC-7.1).  Org-scoped and requires `manage_roles`: a tier that needs an entitlement is HIDDEN entirely, not flagged (AC-7.4), so the answer can differ per shop — cache it per shop. `full_access` is present with `selectable: false` and `group: null` so a role holding it can be labelled; it is never a checklist item. 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getRolesApi();
final String orgId = orgId_example; // String | Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
final String xOrganizationId = xOrganizationId_example; // String | Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 

try {
    final response = api.getOrgCapabilityCatalog(orgId, xOrganizationId);
    print(response);
} on DioException catch (e) {
    print('Exception when calling RolesApi->getOrgCapabilityCatalog: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **orgId** | **String**| Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`.  | 
 **xOrganizationId** | **String**| Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3).  | [optional] 

### Return type

[**CapabilityCatalog**](CapabilityCatalog.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getOrgRoleDetail**
> RoleDetail getOrgRoleDetail(orgId, roleId, xOrganizationId)

One role of this shop, in full (edit and clone screens)

F-003 (api-spec §1, §3). The same `RoleDetail` as the matching item of `GET /orgs/{orgId}/role-details`. Requires `manage_roles`.  `lastEdited.by` is decided at read time against THIS shop only: `me`, a current member (their CURRENT role here), or `former_member` — never an e-mail, a user id, or anything from another shop. 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getRolesApi();
final String orgId = orgId_example; // String | Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
final String roleId = roleId_example; // String | Role id (`RoleDetail.id`).
final String xOrganizationId = xOrganizationId_example; // String | Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 

try {
    final response = api.getOrgRoleDetail(orgId, roleId, xOrganizationId);
    print(response);
} on DioException catch (e) {
    print('Exception when calling RolesApi->getOrgRoleDetail: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **orgId** | **String**| Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`.  | 
 **roleId** | **String**| Role id (`RoleDetail.id`). | 
 **xOrganizationId** | **String**| Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3).  | [optional] 

### Return type

[**RoleDetail**](RoleDetail.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listOrgRoleDetails**
> RoleDetailListPage listOrgRoleDetails(orgId, xOrganizationId)

Every live role of this shop, in full (the role list screen)

F-003 (api-spec §1, §3). Each item is a `RoleDetail` — capabilities, usage counts, who edited it last and the caller's per-role verdicts — and the page carries the create verdict and the role ceiling. Requires `manage_roles`.  A separate path from `GET /orgs/{orgId}/roles` on purpose: that list is readable by every active member and does NOT publish `capabilities` (AC-6.4); one route, one capability.  One page, oldest first (`createdAt asc, id asc`); `nextCursor` is always `null` while the role ceiling fits in a page. `viewer.*` is a UX input — a write re-reads permissions and may still refuse. While role writes are switched off every write verdict is `writes_disabled`. 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getRolesApi();
final String orgId = orgId_example; // String | Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
final String xOrganizationId = xOrganizationId_example; // String | Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 

try {
    final response = api.listOrgRoleDetails(orgId, xOrganizationId);
    print(response);
} on DioException catch (e) {
    print('Exception when calling RolesApi->listOrgRoleDetails: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **orgId** | **String**| Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`.  | 
 **xOrganizationId** | **String**| Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3).  | [optional] 

### Return type

[**RoleDetailListPage**](RoleDetailListPage.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

