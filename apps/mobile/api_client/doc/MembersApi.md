# omnistock_api_client.api.MembersApi

## Load the API package
```dart
import 'package:omnistock_api_client/api.dart';
```

All URIs are relative to *http://localhost:3000*

Method | HTTP request | Description
------------- | ------------- | -------------
[**leaveOrganization**](MembersApi.md#leaveorganization) | **DELETE** /orgs/{orgId}/membership | Leave this shop myself
[**listMembers**](MembersApi.md#listmembers) | **GET** /orgs/{orgId}/members | List the shop&#39;s members
[**revokeMember**](MembersApi.md#revokemember) | **DELETE** /orgs/{orgId}/members/{userId} | Remove another member from the shop
[**updateMemberRole**](MembersApi.md#updatememberrole) | **PATCH** /orgs/{orgId}/members/{userId} | Change a member&#39;s role


# **leaveOrganization**
> LeaveOrgResult leaveOrganization(orgId, xOrganizationId)

Leave this shop myself

F-002 US-5 / D-029 (api-spec §3.17). ANY active member may call it — NO `manage_members` required.  ⚠️ WHY THIS IS A SEPARATE ROUTE rather than relaxing `DELETE /orgs/{orgId}/members/{userId}` when the id happens to be your own:   1. Confused deputy closed BY SHAPE — there is no `userId` anywhere in this      route, so the target is `ctx.userId` always and no bug can point it at      another person. The alternative closes the same hole with an `if`, and      an `if` is exactly what finding C-1 was.   2. The route registry stays decidable — the capability guard reads      metadata only; \"the capability depends on a value in the path\" cannot      be expressed in metadata and would push the decision into a service,      where forgetting it is silent.   3. Different event: `org.member.left`, not `org.member.revoked`. Afterwards      \"did they walk out or were they cleared out?\" is answerable.   Behaviour is identical to §3.9 apart from the actor: soft revoke, own pending invitations cancelled in the same transaction, the shop disappears from `GET /me/organizations` immediately, other shops and the session untouched.  `200` with a body rather than `204`: the caller needs `cancelledInvitations` and `revokedAt` for the confirmation copy.  ⛔ There is NO `403 FORBIDDEN` on this route — there is no capability to lack, so a 403 here can only be `ORG_ACCESS_DENIED`.  ⚠️ The last Owner cannot leave (`409 LAST_OWNER`) and F-002 has no \"delete shop\", so the way out is to appoint another Owner first. Accepted limitation. 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getMembersApi();
final String orgId = orgId_example; // String | Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
final String xOrganizationId = xOrganizationId_example; // String | Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 

try {
    final response = api.leaveOrganization(orgId, xOrganizationId);
    print(response);
} on DioException catch (e) {
    print('Exception when calling MembersApi->leaveOrganization: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **orgId** | **String**| Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`.  | 
 **xOrganizationId** | **String**| Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3).  | [optional] 

### Return type

[**LeaveOrgResult**](LeaveOrgResult.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listMembers**
> MemberListPage listMembers(orgId, status, cursor, limit, withTotal, xOrganizationId)

List the shop's members

F-002 US-5 (api-spec §3.7). ⚠️ THIS READ REQUIRES `manage_members`. Every row carries somebody's email address, which is PII under PDPA (D-028/I-8) — it is not a UX preference, and a Staff member calling it gets `403 FORBIDDEN`. If a screen needs \"who did this?\", take the name/id off the resource rather than pulling the whole directory.  `status` defaults to `all` here (unlike `GET /me/organizations`, whose default is `active`): this is the audit view of who is and who WAS in the shop, and hiding removed rows by default would make \"why can this person no longer sign in?\" unanswerable from the UI. `invited` is not an accepted value — memberships are only created at accept time (data-model §7), so the filter could only ever return nothing. People invited but not yet joined live in `GET /orgs/{orgId}/invitations`.  This is the ONLY list endpoint that supports `?withTotal=true` today.  `Cache-Control: no-store` — a list of email addresses must not sit in a shared cache (M-11). 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getMembersApi();
final String orgId = orgId_example; // String | Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
final String status = status_example; // String | Default `all`. Any other value → `422`.
final String cursor = cursor_example; // String | Opaque keyset cursor from the previous page's `nextCursor`. Base64url — clients MUST NOT decode or construct one. Unreadable value → `422 VALIDATION_FAILED` with `fieldErrors.cursor`. 
final int limit = 56; // int | Page size. Default 25, clamped to 100. Non-integer / < 1 → `422 VALIDATION_FAILED` with `fieldErrors.limit` (a bug is not silently corrected). 
final bool withTotal = true; // bool | Opt in to the `total` count on this page. OPT-IN PER ENDPOINT: only the endpoints that declare this parameter compute a total — see the endpoint's own documentation. (`GET /me/organizations` and `GET /orgs/{orgId}/invitations` do NOT support it today; api-spec §1 states the convention generally, the server implements it on `GET /orgs/{orgId}/members` only.) 
final String xOrganizationId = xOrganizationId_example; // String | Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 

try {
    final response = api.listMembers(orgId, status, cursor, limit, withTotal, xOrganizationId);
    print(response);
} on DioException catch (e) {
    print('Exception when calling MembersApi->listMembers: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **orgId** | **String**| Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`.  | 
 **status** | **String**| Default `all`. Any other value → `422`. | [optional] [default to 'all']
 **cursor** | **String**| Opaque keyset cursor from the previous page's `nextCursor`. Base64url — clients MUST NOT decode or construct one. Unreadable value → `422 VALIDATION_FAILED` with `fieldErrors.cursor`.  | [optional] 
 **limit** | **int**| Page size. Default 25, clamped to 100. Non-integer / < 1 → `422 VALIDATION_FAILED` with `fieldErrors.limit` (a bug is not silently corrected).  | [optional] [default to 25]
 **withTotal** | **bool**| Opt in to the `total` count on this page. OPT-IN PER ENDPOINT: only the endpoints that declare this parameter compute a total — see the endpoint's own documentation. (`GET /me/organizations` and `GET /orgs/{orgId}/invitations` do NOT support it today; api-spec §1 states the convention generally, the server implements it on `GET /orgs/{orgId}/members` only.)  | [optional] [default to false]
 **xOrganizationId** | **String**| Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3).  | [optional] 

### Return type

[**MemberListPage**](MemberListPage.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **revokeMember**
> RevokeMemberResult revokeMember(orgId, userId, xOrganizationId)

Remove another member from the shop

F-002 US-5 (api-spec §3.9). Requires `manage_members`, plus `full_access` when the target is an Owner (D-028/C-1).  SOFT delete: `status → revoked` and `revokedAt` is stamped. The row stays, because history references it and because `revokedAt` is a security input — an invitation issued BEFORE it can no longer be accepted (I-1).  In the SAME transaction, any pending invitation for that person's email in this shop is cancelled; `cancelledInvitations` reports how many, so the UI can say so.  Effect is immediate: the removed member's next request to this shop is `403 ORG_ACCESS_DENIED` and the shop is gone from their `GET /me/organizations`. Their session is not destroyed and their other shops are untouched.  Removing YOURSELF through this route works, but only if you already hold `manage_members`. Everyone else uses `DELETE /orgs/{orgId}/membership` — this route grants nobody a softer path (D-029).  Idempotency under a race: two concurrent revokes of the same person produce one `200` and one `404`, and `revokedAt` is written once. 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getMembersApi();
final String orgId = orgId_example; // String | Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
final String userId = userId_example; // String | Target member's user id.
final String xOrganizationId = xOrganizationId_example; // String | Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 

try {
    final response = api.revokeMember(orgId, userId, xOrganizationId);
    print(response);
} on DioException catch (e) {
    print('Exception when calling MembersApi->revokeMember: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **orgId** | **String**| Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`.  | 
 **userId** | **String**| Target member's user id. | 
 **xOrganizationId** | **String**| Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3).  | [optional] 

### Return type

[**RevokeMemberResult**](RevokeMemberResult.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateMemberRole**
> MemberRow updateMemberRole(orgId, userId, updateMemberRoleRequest, xOrganizationId)

Change a member's role

F-002 US-6 (api-spec §3.8). Requires `manage_members`, and additionally `full_access` (Owner-only, D-028/C-1) when EITHER the new role holds `full_access` (promoting somebody — including yourself — to Owner) OR the target's CURRENT role holds it (editing an Owner). Otherwise `403 FORBIDDEN`.  Acting on yourself is allowed (an Owner stepping down after appointing a successor), subject to the last-Owner rule.  Answers with the §3.7 member row, so the client never has to refetch the list to render the new state — which is why this response carries an email address and therefore the §3.7 `no-store` policy (api-spec §1 lists §3.7 but not §3.8 by number; the classification follows the SHAPE, and `RESPONSE_HEADER_POLICY` in apps/api encodes that).  The target's state is re-read INSIDE the transaction, after the shop's row lock is taken — so a `PATCH` racing a `DELETE` answers `404`, never a 500 or a resurrection. 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getMembersApi();
final String orgId = orgId_example; // String | Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
final String userId = userId_example; // String | Target member's user id.
final UpdateMemberRoleRequest updateMemberRoleRequest = ; // UpdateMemberRoleRequest | 
final String xOrganizationId = xOrganizationId_example; // String | Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 

try {
    final response = api.updateMemberRole(orgId, userId, updateMemberRoleRequest, xOrganizationId);
    print(response);
} on DioException catch (e) {
    print('Exception when calling MembersApi->updateMemberRole: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **orgId** | **String**| Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`.  | 
 **userId** | **String**| Target member's user id. | 
 **updateMemberRoleRequest** | [**UpdateMemberRoleRequest**](UpdateMemberRoleRequest.md)|  | 
 **xOrganizationId** | **String**| Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3).  | [optional] 

### Return type

[**MemberRow**](MemberRow.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

