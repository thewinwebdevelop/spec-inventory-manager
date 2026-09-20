# omnistock_api_client.model.Invitation

## Load the model package
```dart
import 'package:omnistock_api_client/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **String** |  | 
**email** | **String** | Normalized (lower-cased, trimmed) at creation. | 
**roleId** | **String** |  | 
**roleName** | **String** |  | 
**roleKey** | **String** |  | 
**status** | **String** | Resolved at read time — a stored `pending` row past `expiresAt` reads as `expired`.  | 
**expiresAt** | [**DateTime**](DateTime.md) | NON-NULL ON EVERY ROW, accepted and cancelled ones included (ux Q14). ⛔ UI must render the remaining time FROM THIS VALUE — never hard-code \"7 days\": an elevated role's invitation lives 24 hours, and reissuing a link restarts the clock (D-027).  | 
**tokenIssuedAt** | [**DateTime**](DateTime.md) | When the CURRENT link was minted. Moves on every reissue. | 
**invitedByUserId** | **String** |  | 
**createdAt** | [**DateTime**](DateTime.md) | When the invitation first existed. Does NOT move on reissue. | 
**acceptedAt** | [**DateTime**](DateTime.md) |  | 
**acceptedByUserId** | **String** |  | 
**acceptedUserCreatedAfterInvite** | **bool** | Was the accepting ACCOUNT created after `createdAt`? `null` until somebody accepts — \"we do not know yet\" is not \"no\". Phase 0 cannot verify email addresses, so this is the only signal that a link may have been redeemed by whoever found it. Render it as a soft flag, not an accusation.  | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


