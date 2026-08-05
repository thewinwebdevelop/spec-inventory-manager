# omnistock_api_client.api.InvitationsApi

## Load the API package
```dart
import 'package:omnistock_api_client/api.dart';
```

All URIs are relative to *http://localhost:3000*

Method | HTTP request | Description
------------- | ------------- | -------------
[**acceptInvitation**](InvitationsApi.md#acceptinvitation) | **POST** /invitations/accept | Accept an invitation and join the shop
[**cancelInvitation**](InvitationsApi.md#cancelinvitation) | **DELETE** /orgs/{orgId}/invitations/{invitationId} | Cancel a pending invitation
[**createInvitation**](InvitationsApi.md#createinvitation) | **POST** /orgs/{orgId}/invitations | Invite somebody to the shop (returns the link once)
[**listInvitations**](InvitationsApi.md#listinvitations) | **GET** /orgs/{orgId}/invitations | List the shop&#39;s invitations
[**previewInvitation**](InvitationsApi.md#previewinvitation) | **POST** /invitations/preview | Look at an invitation before signing in or signing up (public)
[**reissueInvitationLink**](InvitationsApi.md#reissueinvitationlink) | **POST** /orgs/{orgId}/invitations/{invitationId}/link | Issue a NEW link for an existing invitation (rotates the token)


# **acceptInvitation**
> InvitationAcceptResult acceptInvitation(redeemInvitationRequest)

Accept an invitation and join the shop

F-002 US-4 (api-spec §3.15). USER-SCOPED: authenticated, but about the USER, not about an org. The organization comes from the invitation ROW and from nowhere else — `X-Organization-Id` is ignored entirely (I-3), which is a structural property of this route rather than a check somebody must remember.  The signed-in account's normalized email must match the invited address, otherwise `403 INVITATION_EMAIL_MISMATCH` with `details.emailMasked` so the UI can say which account to use. ⚠️ Phase 0 cannot verify email addresses (F-081), so this is defence in depth, NOT a control: whoever holds the link can redeem it.  Somebody previously REMOVED from the shop comes back only if the invitation was issued AFTER the removal; otherwise `409 INVITATION_SUPERSEDED`.  Already an active member → `409 ALREADY_MEMBER` and THE EXISTING ROLE IS NOT TOUCHED (the invitation is marked cancelled so it does not linger). An earlier draft upserted the role here, which opened \"accepting an invitation leaves the shop with zero Owners\".  Decision order, pinned by unit test: unknown token → expired → cancelled/accepted → email mismatch → role unavailable → already a member → superseded → success. Every one of these is re-checked INSIDE the transaction that holds the shop's row lock, so `accept` cannot slip between a `revoke`/`cancel`/`reissue` and win.  `Cache-Control: no-store` + `Referrer-Policy: no-referrer`. 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getInvitationsApi();
final RedeemInvitationRequest redeemInvitationRequest = ; // RedeemInvitationRequest | 

try {
    final response = api.acceptInvitation(redeemInvitationRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling InvitationsApi->acceptInvitation: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **redeemInvitationRequest** | [**RedeemInvitationRequest**](RedeemInvitationRequest.md)|  | 

### Return type

[**InvitationAcceptResult**](InvitationAcceptResult.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **cancelInvitation**
> CancelledInvitation cancelInvitation(orgId, invitationId, xOrganizationId)

Cancel a pending invitation

F-002 api-spec §3.13. Requires `manage_members`. Any link already sent stops working immediately. 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getInvitationsApi();
final String orgId = orgId_example; // String | Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
final String invitationId = invitationId_example; // String | Invitation id (`inv_…`).
final String xOrganizationId = xOrganizationId_example; // String | Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 

try {
    final response = api.cancelInvitation(orgId, invitationId, xOrganizationId);
    print(response);
} on DioException catch (e) {
    print('Exception when calling InvitationsApi->cancelInvitation: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **orgId** | **String**| Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`.  | 
 **invitationId** | **String**| Invitation id (`inv_…`). | 
 **xOrganizationId** | **String**| Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3).  | [optional] 

### Return type

[**CancelledInvitation**](CancelledInvitation.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createInvitation**
> IssuedInvitation createInvitation(orgId, createInvitationRequest, xOrganizationId)

Invite somebody to the shop (returns the link once)

F-002 US-3 (api-spec §3.11, D-012). Requires `manage_members`, plus `full_access` when the invited role itself holds `full_access` (D-028/C-1).  ⚠️ `token` and `inviteUrl` are shown THIS ONCE. Only an HMAC is stored (D-018), so there is no \"resend the same link\" — and no email is sent (D-012): the UI must offer a copy button and the user forwards it.  LIFETIME DEPENDS ON THE ROLE: 24 hours when the invited role holds `full_access` or `manage_members`, 7 days otherwise (D-028/I-7). ⛔ The UI must render `expiresAt` and never hard-code \"7 days\".  Inviting an address that already has a live invitation is `409 INVITATION_PENDING` WITH `details.invitationId` (+ `expiresAt`, `roleId`, `roleName`), so the UI can immediately offer \"issue a new link\" or \"cancel\" instead of leaving the user in a dead end (D-027).  `Cache-Control: no-store` + `Referrer-Policy: no-referrer` — the body carries a live credential. 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getInvitationsApi();
final String orgId = orgId_example; // String | Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
final CreateInvitationRequest createInvitationRequest = ; // CreateInvitationRequest | 
final String xOrganizationId = xOrganizationId_example; // String | Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 

try {
    final response = api.createInvitation(orgId, createInvitationRequest, xOrganizationId);
    print(response);
} on DioException catch (e) {
    print('Exception when calling InvitationsApi->createInvitation: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **orgId** | **String**| Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`.  | 
 **createInvitationRequest** | [**CreateInvitationRequest**](CreateInvitationRequest.md)|  | 
 **xOrganizationId** | **String**| Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3).  | [optional] 

### Return type

[**IssuedInvitation**](IssuedInvitation.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listInvitations**
> InvitationListPage listInvitations(orgId, status, cursor, limit, xOrganizationId)

List the shop's invitations

F-002 api-spec §3.10. Requires `manage_members` — every row carries somebody else's email address (PDPA, D-028/I-8).  Never returns a token or a link: only an HMAC of the token is stored (D-018), so there is nothing to return. Use `POST /orgs/{orgId}/invitations/{invitationId}/link` to mint a new one.  The members screen is ONE screen with TWO sections, fetched from this endpoint and `GET /orgs/{orgId}/members` separately and NOT merged (ux Q1): the two sources have different states and different actions (reissue/cancel vs change-role/remove), each with its own cursor and its own error states.  ⚠️ `?withTotal=true` is NOT supported here — see the T-002-21 report.  `Cache-Control: no-store` + `Referrer-Policy: no-referrer`. 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getInvitationsApi();
final String orgId = orgId_example; // String | Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
final String status = status_example; // String | Default `pending` — the actionable view. Any other value → `422`.
final String cursor = cursor_example; // String | Opaque keyset cursor from the previous page's `nextCursor`. Base64url — clients MUST NOT decode or construct one. Unreadable value → `422 VALIDATION_FAILED` with `fieldErrors.cursor`. 
final int limit = 56; // int | Page size. Default 25, clamped to 100. Non-integer / < 1 → `422 VALIDATION_FAILED` with `fieldErrors.limit` (a bug is not silently corrected). 
final String xOrganizationId = xOrganizationId_example; // String | Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 

try {
    final response = api.listInvitations(orgId, status, cursor, limit, xOrganizationId);
    print(response);
} on DioException catch (e) {
    print('Exception when calling InvitationsApi->listInvitations: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **orgId** | **String**| Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`.  | 
 **status** | **String**| Default `pending` — the actionable view. Any other value → `422`. | [optional] [default to 'pending']
 **cursor** | **String**| Opaque keyset cursor from the previous page's `nextCursor`. Base64url — clients MUST NOT decode or construct one. Unreadable value → `422 VALIDATION_FAILED` with `fieldErrors.cursor`.  | [optional] 
 **limit** | **int**| Page size. Default 25, clamped to 100. Non-integer / < 1 → `422 VALIDATION_FAILED` with `fieldErrors.limit` (a bug is not silently corrected).  | [optional] [default to 25]
 **xOrganizationId** | **String**| Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3).  | [optional] 

### Return type

[**InvitationListPage**](InvitationListPage.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **previewInvitation**
> InvitationPreview previewInvitation(redeemInvitationRequest)

Look at an invitation before signing in or signing up (public)

F-002 US-4 (api-spec §3.14). PUBLIC — the invite page has to render before the person decides whether to sign in or sign up, so there is nobody to authenticate. The quota is therefore the ONLY bound on this endpoint: 30/hour per IP (IPv6 collapsed to /64, so one subscriber cannot mint unlimited buckets).  ⛔ THE TOKEN IS IN THE BODY, NOT THE QUERY STRING (I-6). It is the single secret standing between a stranger and membership of a shop; in a URL it would be written to access logs, to every proxy in front of us and to the `Referer` of anything the invite page loads. A free side effect: a POST is not cached by anything.  Returns no `organizationId`, no full email address and no member list.  `Cache-Control: no-store` + `Referrer-Policy: no-referrer`.  @frontend: read the token out of the URL, `history.replaceState` it away immediately, and keep it in memory (never localStorage) for the whole sign-up → sign-in → accept flow. 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getInvitationsApi();
final RedeemInvitationRequest redeemInvitationRequest = ; // RedeemInvitationRequest | 

try {
    final response = api.previewInvitation(redeemInvitationRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling InvitationsApi->previewInvitation: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **redeemInvitationRequest** | [**RedeemInvitationRequest**](RedeemInvitationRequest.md)|  | 

### Return type

[**InvitationPreview**](InvitationPreview.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **reissueInvitationLink**
> ReissuedLink reissueInvitationLink(orgId, invitationId, xOrganizationId)

Issue a NEW link for an existing invitation (rotates the token)

F-002 api-spec §3.12 (D-027). Requires `manage_members`, plus `full_access` when the INVITATION's role holds `full_access` (NEW-2) — reissuing an Owner invitation is handing out Owner, so the rule that gates creating one gates copying it too. Without that, anyone with `manage_members` could make unlimited copies of the Owner key and the D-028 rule would be bypassed wholesale.  ⚠️ `200`, NOT `201` — nothing is created; an existing invitation's token is rotated. (The implementation shipped `201` in T-002-19 and was corrected to the locked contract in a follow-up commit, rather than the contract being bent to the code.)  ⚠️ THE PREVIOUS LINK STOPS WORKING IMMEDIATELY, and the expiry RESTARTS from now (`now + TTL(role)`), so an elevated-role invitation can be extended 24 hours at a time. The UI needs a confirmation dialog and must not use the words \"copy the existing link\".  The invitation's email and role do not change. Every call emits `org.invitation.link_reissued` so a leaked link can be traced.  An EXPIRED invitation can still be reissued (its stored status is still `pending`) — deliberately, to avoid a dead end on screen; with the Owner-only rule in place, forbidding it would buy no security.  `Cache-Control: no-store` + `Referrer-Policy: no-referrer`. 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getInvitationsApi();
final String orgId = orgId_example; // String | Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`. 
final String invitationId = invitationId_example; // String | Invitation id (`inv_…`).
final String xOrganizationId = xOrganizationId_example; // String | Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3). 

try {
    final response = api.reissueInvitationLink(orgId, invitationId, xOrganizationId);
    print(response);
} on DioException catch (e) {
    print('Exception when calling InvitationsApi->reissueInvitationLink: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **orgId** | **String**| Organization id. On F-002 org-scoped routes this is one of the two accepted sources of org context (the other is the `X-Organization-Id` header, D-025); sending both with different values is `422 ORG_MISMATCH`.  | 
 **invitationId** | **String**| Invitation id (`inv_…`). | 
 **xOrganizationId** | **String**| Org context (api-spec §1). Optional on routes that already carry `{orgId}` in the path; if both are sent they MUST match, otherwise `422 ORG_MISMATCH`. User-scoped and public routes ignore this header entirely (I-3).  | [optional] 

### Return type

[**ReissuedLink**](ReissuedLink.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

