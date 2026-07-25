# omnistock_api_client.api.AuthApi

## Load the API package
```dart
import 'package:omnistock_api_client/api.dart';
```

All URIs are relative to *http://localhost:3000*

Method | HTTP request | Description
------------- | ------------- | -------------
[**authAdminResetPassword**](AuthApi.md#authadminresetpassword) | **POST** /orgs/{orgId}/members/{userId}/reset-password | Admin resets a member&#39;s password
[**authChangePassword**](AuthApi.md#authchangepassword) | **POST** /auth/change-password | Change the caller&#39;s own password
[**authLogin**](AuthApi.md#authlogin) | **POST** /auth/login | Authenticate and receive tokens
[**authLogout**](AuthApi.md#authlogout) | **POST** /auth/logout | Revoke the current session (family)
[**authLogoutAll**](AuthApi.md#authlogoutall) | **POST** /auth/logout-all | Revoke ALL the user&#39;s sessions
[**authRefresh**](AuthApi.md#authrefresh) | **POST** /auth/refresh | Rotate the refresh token → new token pair
[**authSessions**](AuthApi.md#authsessions) | **GET** /auth/sessions | List the user&#39;s live sessions/devices
[**authSignup**](AuthApi.md#authsignup) | **POST** /auth/signup | Create a user account (email + password)


# **authAdminResetPassword**
> OkResponse authAdminResetPassword(orgId, userId, adminResetRequest)

Admin resets a member's password

US-5. Bearer-authed. The capability check is INLINE application logic (F-001-owned): the caller must have an ACTIVE Membership(orgId) whose role grants `manage_members`, AND the target must be an ACTIVE member of orgId (H-2). Any failure → the same-shape 404 (never 403 — no org-existence/status/capability oracle). On success: sets the target's password and revokes all the target's families. The capability check is not expressible as an OpenAPI security requirement. 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getAuthApi();
final String orgId = orgId_example; // String | Organization id (the caller's authority derives from a shared membership)
final String userId = userId_example; // String | Target member's user id
final AdminResetRequest adminResetRequest = ; // AdminResetRequest | 

try {
    final response = api.authAdminResetPassword(orgId, userId, adminResetRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling AuthApi->authAdminResetPassword: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **orgId** | **String**| Organization id (the caller's authority derives from a shared membership) | 
 **userId** | **String**| Target member's user id | 
 **adminResetRequest** | [**AdminResetRequest**](AdminResetRequest.md)|  | 

### Return type

[**OkResponse**](OkResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authChangePassword**
> OkResponse authChangePassword(changePasswordRequest)

Change the caller's own password

US-6 (D-008). Bearer-authed, org-agnostic. Verifies currentPassword (account-throttled, N-2), enforces the signup policy on newPassword, sets the new hash, and revokes all the caller's OTHER families — sparing the current family resolved from the presented refresh token (cookie/body, N-1); if none is resolvable, revokes ALL (safe direction). CSRF-checked on the cookie path. 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getAuthApi();
final ChangePasswordRequest changePasswordRequest = ; // ChangePasswordRequest | 

try {
    final response = api.authChangePassword(changePasswordRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling AuthApi->authChangePassword: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **changePasswordRequest** | [**ChangePasswordRequest**](ChangePasswordRequest.md)|  | 

### Return type

[**OkResponse**](OkResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authLogin**
> TokenResponse authLogin(loginRequest)

Authenticate and receive tokens

US-2. Public (IP + account throttle). The client declares its transport via `tokenTransport` (default \"body\"). With \"cookie\" (web) the refresh token is set as an httpOnly Secure SameSite=Strict cookie `omni_rt` (Path=/auth) plus a readable `omni_csrf` cookie, and the body `refreshToken` is null (H-1). With \"body\" (mobile/default) the plaintext refresh token is returned in the body and no cookies are set. Wrong password and unknown email both return the identical 401 INVALID_CREDENTIALS (enumeration-safe). Throttle is ALWAYS its own 429 + Retry-After (M-1), never folded into the 401. 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getAuthApi();
final LoginRequest loginRequest = ; // LoginRequest | 

try {
    final response = api.authLogin(loginRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling AuthApi->authLogin: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **loginRequest** | [**LoginRequest**](LoginRequest.md)|  | 

### Return type

[**TokenResponse**](TokenResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authLogout**
> authLogout(logoutRequest)

Revoke the current session (family)

US-4. Revokes the caller's current family (from the presented refresh token; cookie or body) and clears the auth cookies. Optional body `familyId` revokes a specific LISTED family that MUST belong to the caller (M-3); a foreign/unknown familyId is a no-op. Always 204 (idempotent). CSRF-checked on the cookie path. Auth is via the refresh token (cookie/body), so `security` is []. 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getAuthApi();
final LogoutRequest logoutRequest = ; // LogoutRequest | 

try {
    api.authLogout(logoutRequest);
} on DioException catch (e) {
    print('Exception when calling AuthApi->authLogout: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **logoutRequest** | [**LogoutRequest**](LogoutRequest.md)|  | [optional] 

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authLogoutAll**
> authLogoutAll()

Revoke ALL the user's sessions

US-4. Bearer-authed. Revokes every family for the authenticated user and clears the caller's cookies. 204. 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getAuthApi();

try {
    api.authLogoutAll();
} on DioException catch (e) {
    print('Exception when calling AuthApi->authLogoutAll: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authRefresh**
> TokenResponse authRefresh(refreshRequest)

Rotate the refresh token → new token pair

US-3. Dual-transport: the refresh token is presented via the `omni_rt` cookie (web) OR a body `refreshToken` field (mobile). Resolution order: cookie first, then body. On the cookie path an `X-CSRF-Token` header must equal the `omni_csrf` cookie (403 otherwise). The response follows the presented transport. Rotation mints a new refresh token; the old one becomes unusable. Reuse of a consumed/revoked token outside the 60s leeway (D-011) revokes the whole family, but the wire response is the same generic 401 INVALID_REFRESH. IP-throttled (L-5) — no account dimension. Auth is carried by the cookie or body (not a standard bearer/apiKey scheme), so `security` is []. 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getAuthApi();
final RefreshRequest refreshRequest = ; // RefreshRequest | 

try {
    final response = api.authRefresh(refreshRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling AuthApi->authRefresh: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **refreshRequest** | [**RefreshRequest**](RefreshRequest.md)|  | 

### Return type

[**TokenResponse**](TokenResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authSessions**
> SessionsResponse authSessions()

List the user's live sessions/devices

US-3. Bearer-authed. Lists live (non-revoked, non-expired) families for the user — bounded at 20 (D-017). The family matching the `omni_rt` cookie (if present) is marked current. Also reads the cookie to mark current — that is an input, not an auth requirement. 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getAuthApi();

try {
    final response = api.authSessions();
    print(response);
} on DioException catch (e) {
    print('Exception when calling AuthApi->authSessions: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**SessionsResponse**](SessionsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authSignup**
> SignupResponse authSignup(signupRequest)

Create a user account (email + password)

US-1. Public (IP-throttled). Creates a user with verified=false and returns NO tokens (MVP: client then calls /auth/login). All /auth/_* POSTs require Content-Type: application/json (415 otherwise, login-CSRF defense, L-2). 

### Example
```dart
import 'package:omnistock_api_client/api.dart';

final api = OmnistockApiClient().getAuthApi();
final SignupRequest signupRequest = ; // SignupRequest | 

try {
    final response = api.authSignup(signupRequest);
    print(response);
} on DioException catch (e) {
    print('Exception when calling AuthApi->authSignup: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **signupRequest** | [**SignupRequest**](SignupRequest.md)|  | 

### Return type

[**SignupResponse**](SignupResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

