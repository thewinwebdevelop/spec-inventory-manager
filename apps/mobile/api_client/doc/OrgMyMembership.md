# omnistock_api_client.model.OrgMyMembership

## Load the model package
```dart
import 'package:omnistock_api_client/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**roleId** | **String** |  | 
**roleName** | **String** |  | 
**roleKey** | **String** | `owner|admin|staff` for a system role, `null` for an F-003 custom one. Open set — an unknown value MUST fall back to showing `roleName`. ⛔ Never use it to decide permissions; use `capabilities`.  | 
**capabilities** | **BuiltList&lt;String&gt;** | What the client may OFFER. Not enforcement — the server refuses the call regardless (architecture §3.1).  | 
**status** | **String** | Always `active` here — a non-member cannot reach this endpoint. | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


