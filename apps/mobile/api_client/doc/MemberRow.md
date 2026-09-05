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

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


