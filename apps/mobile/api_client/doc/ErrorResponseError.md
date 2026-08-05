# omnistock_api_client.model.ErrorResponseError

## Load the model package
```dart
import 'package:omnistock_api_client/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**code** | **String** | Machine-readable error code (e.g. INVALID_CREDENTIALS, ORG_ACCESS_DENIED, RATE_LIMITED). A shipped value never changes.  | 
**message** | **String** | User-facing Thai message. F-002 copy says \"ร้าน\" rather than \"องค์กร\" (D-029); identifiers and enum values stay English.  | 
**details** | [**BuiltMap&lt;String, JsonObject&gt;**](JsonObject.md) | Optional, code-specific context. Documented cases (F-002): `INVITATION_PENDING` → `{ invitationId, expiresAt, roleId, roleName }` (§3.11) · `ORG_LIMIT_REACHED` → `{ limit }` (§3.1) · `INVITATION_EMAIL_MISMATCH` → `{ emailMasked }` (§3.15) · `CONFLICT` → `{ reason: \"busy\" }` when the request lost the race for the shop's row lock (amend #4 / NEW-4 — retryable, never a 500). A client that does not recognise a key MUST still behave correctly.  | [optional] 
**fieldErrors** | **BuiltMap&lt;String, String&gt;** | Per-field Thai messages on a `422` (e.g. `{ \"taxId\": \"…\" }`).  | [optional] 
**traceId** | **String** | Opaque random UUID v4 issued by the SERVER for this request, echoed in `X-Request-Id`. Present on EVERY error response in practice; it stays optional in the schema so already-shipped clients are not broken (api-spec §1, NEW-7). Never derived from client input.  | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


