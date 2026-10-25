# omnistock_api_client.model.MemberRow

## Load the model package
```dart
import 'package:omnistock_api_client/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**userId** | **String** |  | 
**email** | **String** | PII under PDPA — the reason this READ requires `manage_members` and the reason the response is `no-store`.  | 
**roleId** | **String** |  | 
**roleName** | **String** |  | 
**roleKey** | **String** |  | 
**status** | **String** | `invited` is a dead state: memberships are created at ACCEPT time only (data-model §7). It is listed because the column allows it, not because a write path produces it.  | 
**activatedAt** | [**DateTime**](DateTime.md) |  | 
**revokedAt** | [**DateTime**](DateTime.md) |  | 
**createdAt** | [**DateTime**](DateTime.md) |  | 
**isMe** | **bool** | Decided server-side, so the client never compares ids itself. | 
**isOwner** | **bool** | This row's role holds `full_access`. Computed from CAPABILITIES, never from the role's name or key. Use it to hide buttons; the server enforces.  | 
**roleNameCustomized** | **bool** | F-003 (AC-1.5) — the shop renamed this role (always `true` when `roleKey` is `null`). Display `roleNameCustomized ? roleName : (translate roleKey ?? roleName)`.  | [optional] 
**viewerCanManage** | **bool** | F-003 (api-spec §3.1) — may the CALLER change this member's role or remove them? The same rule the write applies (the target must hold strictly less than the caller; your own row is `true`). A UX input, never enforcement: the write re-reads permissions and may still refuse.  ⚠️ PRESENT ONLY when the caller holds BOTH `manage_members` and `manage_roles`, and only on `active` rows (architecture §1.2 — anyone else would learn \"this role equals mine exactly\"). Absent ⇒ keep the F-002 behaviour (show the buttons on active, non-Owner, non-self rows) and show generic copy if the write answers `403 TARGET_NOT_BELOW_ACTOR`. `LAST_OWNER` is shop state, not part of this verdict.  | [optional] 
**manageBlockedReason** | **String** | Present with `viewerCanManage`; `null` when it is `true`. OPEN SET, in this fixed order: `owner_only` → `equal_permissions` (same permissions as you — ask the Owner) → `exceeds_your_permissions`. Any other value → generic copy.  | [optional] 
**viewerCanResetPassword** | **bool** | F-003 — may the CALLER reset this member's password? Same audience as `viewerCanManage`. `true` means \"no rule you can see blocks it\": the reset may still answer its uniform `404` for a reason that is not yours to see (e.g. the member also belongs to another shop).  | [optional] 
**resetBlockedReason** | **String** | Present with `viewerCanResetPassword`; `null` when it is `true`. OPEN SET, in this fixed order: `self` → `owner_only` → `equal_permissions` → `exceeds_your_permissions`. Any other value → generic copy.  | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


