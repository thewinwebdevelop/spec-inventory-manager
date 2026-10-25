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
**roleNameCustomized** | **bool** | F-003 (AC-1.5) — the shop renamed this role (always `true` when `roleKey` is `null`): show `roleName` as-is instead of translating `roleKey`.  | [optional] 
**viewerCanManage** | **bool** | F-003 (api-spec §3.1) — may the CALLER cancel this invitation or issue a new link? `false` when the invitation's role grants ownership and the caller is not an Owner, or when the role has a permission the caller lacks. Says exactly what `RoleRow.viewerCanAssign` says for the same role. A UX input, never enforcement.  Present only when the caller holds `manage_members` and the stored status is pending — `status` `pending` OR `expired` (an expired link can still be cancelled or reissued). Absent on accepted / cancelled rows.  | [optional] 
**manageBlockedReason** | **String** | Present with `viewerCanManage`; `null` when it is `true`. OPEN SET: `owner_only` → `exceeds_your_permissions`. Any other value → generic copy.  | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


